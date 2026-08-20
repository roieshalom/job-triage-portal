// OnPaper backend — Vercel serverless function.
// Holds the Anthropic key server-side (as an env var, never in the repo) and
// gates access behind a shared passcode. The static triage.roiesh.com page
// POSTs { cv, jd, passcode } here; this function calls Claude and returns the
// gaps as { text }.
//
// Env vars (set in Vercel, not in code):
//   ANTHROPIC_API_KEY  — your Anthropic API key (sk-ant-…)
//   ONPAPER_PASSCODE   — the shared door passcode the page must send
//
// Later, "who is the user" (real accounts, per-user metering) slots in where
// the passcode check is today.

const MODEL = "claude-opus-4-8"; // swap freely; sonnet is cheaper/faster

// Only these origins may call the endpoint from a browser.
const ALLOWED_ORIGINS = [
  "https://triage.roiesh.com",
  "http://localhost:8777", // local testing
];

const SYSTEM = [
  "You compare a candidate's CV against a job description and name the real gaps.",
  "",
  "Hard rules:",
  "- Only name a gap if the job description explicitly asks for something the CV does not clearly show. Reference the exact JD requirement you are keying off.",
  "- Do not invent requirements the JD doesn't state. Do not guess at the candidate's skills beyond what the CV text shows.",
  "- No generic career advice, no filler, no encouragement. If you can't ground a claim in the pasted text, don't make it.",
  '- Every fix must be a concrete action the candidate can take with what they already have (rephrase/surface existing experience, add a specific line, quantify a result) — not "go learn X" unless the JD hard-requires X and the CV shows zero evidence of it.',
  "- If the CV genuinely covers the JD's key requirements, say so and list fewer than 3 gaps (even zero). Do not pad to reach a count.",
  "",
  "Output format (plain text, no markdown, no preamble):",
  "For each gap (2-3 max, fewer if that's honest):",
  "",
  "GAP N: <one-line gap>",
  "  Evidence: <the JD requirement, and what the CV does or doesn't show>",
  "  Fix: <one concrete, grounded action>",
  "",
  "End after the last gap. No summary line.",
].join("\n");

function buildUser(cv, jd) {
  return (
    "JOB DESCRIPTION:\n" + jd.trim() +
    "\n\nCV:\n" + cv.trim() +
    "\n\nName the top gaps between this CV and this job, with one concrete fix each. Follow the rules exactly."
  );
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.ANTHROPIC_API_KEY;
  const passcode = process.env.ONPAPER_PASSCODE;
  if (!key || !passcode) {
    return res.status(500).json({ error: "Server not configured (missing env vars)." });
  }

  // Body may arrive parsed or as a string depending on runtime.
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  if (body.passcode !== passcode) {
    return res.status(401).json({ error: "Wrong or missing passcode." });
  }

  const cv = (body.cv || "").trim();
  const jd = (body.jd || "").trim();
  if (!cv || !jd) {
    return res.status(400).json({ error: "Both a CV and a job description are required." });
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM,
        messages: [{ role: "user", content: buildUser(cv, jd) }],
      }),
    });

    if (!r.ok) {
      let detail = "";
      try { detail = (await r.json()).error.message; } catch {}
      return res.status(502).json({ error: "Claude API " + r.status + (detail ? ": " + detail : "") });
    }

    const data = await r.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: "Request failed: " + err.message });
  }
}
