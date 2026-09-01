/* ============================================================
   OnPaper gap report — shared render logic (single source of truth).

   Loaded by BOTH the live tool (index.html, OnPaper tab) and the local
   design sandbox (report-preview.html). Turns the backend's plain-text
   output into the paper document. Edit here and both update.

   Backend output shape (see onpaper-api/api/prompt.md):
     ROLE: ...
     COMPANY: ...
     MATCH: Very low | Low | Medium | Good | Very good
     DEALBREAKERS: ... | None flagged.
     GAP N: <title> [Hard | Closable]
       Evidence: <body>
       Fix: <recommendation>

   Public API (window.OnPaperReport):
     parseReport(text)            -> { role, company, match, deal, body }
     render(container, text, opts) -> paints the report into `container`
                                      and wires the Download-PDF button.
       opts.date : Date to stamp (defaults to now) — handy for the sandbox.
   ============================================================ */
(function (root) {
  "use strict";

  function parseReport(text) {
    var role = "", company = "", match = "", deal = "", body = [];
    (text || "").split(/\r?\n/).forEach(function (l) {
      var m;
      if ((m = l.match(/^\s*ROLE:\s*(.*)$/i)))              { role = m[1].trim(); }
      else if ((m = l.match(/^\s*COMPANY:\s*(.*)$/i)))       { company = m[1].trim(); }
      else if ((m = l.match(/^\s*MATCH:\s*(.*)$/i)))         { match = m[1].trim(); }
      else if ((m = l.match(/^\s*DEALBREAKERS?:\s*(.*)$/i))) { deal = m[1].trim(); }
      else { body.push(l); }
    });
    while (body.length && body[0].trim() === "") body.shift();
    return { role: role, company: company, match: match, deal: deal, body: body.join("\n").trim() };
  }

  function subjectLine(role, company) {
    if (role && company) return role + " — " + company;
    return role || company || "";
  }

  function matchKey(match) {
    var m = (match || "").toLowerCase();
    if (m.indexOf("very low") === 0) return "vlow";
    if (m.indexOf("very good") === 0) return "vgood";
    if (m.indexOf("low") === 0) return "low";
    if (m.indexOf("medium") === 0) return "med";
    if (m.indexOf("good") === 0) return "good";
    return "";
  }

  // Collapse the backend's 5 grades into a 3-tier "fit" verdict for the report.
  // Very low / Low -> LOW FIT (red); Medium -> MEDIUM FIT (amber);
  // Good / Very good -> HIGH FIT (green). `cls` reuses the matchword colors.
  function fitTier(match) {
    var k = matchKey(match);
    if (k === "good" || k === "vgood") return { label: "HIGH FIT", cls: "good" };
    if (k === "med") return { label: "MEDIUM FIT", cls: "med" };
    if (k === "low" || k === "vlow") return { label: "LOW FIT", cls: "low" };
    return null; // grade missing / unrecognized -> match line is omitted
  }

  // Parse the report body into structured gaps for the paper layout.
  // Each gap: GAP N: <title> [Hard|Closable] / Evidence: <body> / Fix: <rec>
  function parseGaps(body) {
    var gaps = [], cur = null, mode = null;
    (body || "").split(/\r?\n/).forEach(function (line) {
      var mHead = line.match(/^\s*GAP\s+\d+\s*:\s*(.*)$/i);
      if (mHead) {
        if (cur) gaps.push(cur);
        var title = mHead[1].trim(), status = "";
        var mTag = title.match(/\[\s*(Hard|Stretch|Closable)\s*\]\s*$/i);
        if (mTag) { status = mTag[1].toLowerCase(); title = title.replace(/\[\s*(Hard|Stretch|Closable)\s*\]\s*$/i, "").trim(); }
        cur = { title: title, status: status, body: "", rec: "" };
        mode = "body";
        return;
      }
      if (!cur) return;
      var mEv = line.match(/^\s*Evidence\s*:\s*(.*)$/i);
      if (mEv) { cur.body = mEv[1].trim(); mode = "body"; return; }
      var mFix = line.match(/^\s*Fix\s*:\s*(.*)$/i);
      if (mFix) { cur.rec = mFix[1].trim(); mode = "rec"; return; }
      var t = line.trim();
      if (!t) return;
      if (mode === "rec") cur.rec += (cur.rec ? " " : "") + t;
      else cur.body += (cur.body ? " " : "") + t;
    });
    if (cur) gaps.push(cur);
    return gaps;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  var NUM_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven"];
  function numWord(n) { return NUM_WORDS[n] || String(n); }

  // Build the paper HTML from the backend's plain-text output.
  function build(out, opts) {
    opts = opts || {};
    var r = parseReport(out);
    var gaps = parseGaps(r.body);
    var now = opts.date instanceof Date ? opts.date : new Date();
    var dateStr = now.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    var subject = subjectLine(r.role, r.company) || "Gap report";
    var fit = fitTier(r.match);
    var n = gaps.length;

    var lead = n === 0
      ? "Nothing the role explicitly asks for is missing from your CV — no closable gaps found."
      : (n === 1 ? "One thing" : numWord(n) + " things") +
        " the role asks for that your CV doesn't yet show — each with one concrete recommendation.";

    // ---- paper document ----
    var STATUS_LABEL = { hard: "Hard", stretch: "Stretch", closable: "Closable" };
    var gapsHtml = gaps.map(function (g, i) {
      // Any of hard | stretch | closable; unknown/empty falls back to the neutral chip.
      var st = STATUS_LABEL[g.status] ? g.status : "closable";
      var stLabel = g.status ? (STATUS_LABEL[g.status] || "Closable") : "Gap";
      return '' +
        '<article class="rep-gap">' +
          '<span class="rep-chip rep-mono rep-chip--' + st + '">' +
            '<span class="rep-chip-num">Gap ' + pad2(i + 1) + '</span>' +
            (g.status ? '<span class="rep-chip-div"></span><span class="rep-chip-status">' + stLabel + '</span>' : '') +
          '</span>' +
          '<h2 class="rep-gap-title">' + esc(g.title) + '</h2>' +
          (g.body ? '<p class="rep-gap-body">' + esc(g.body) + '</p>' : '') +
          (g.rec ? '<div class="rep-rec">' +
            '<div class="rep-rec-label rep-mono">Recommendation</div>' +
            '<p class="rep-rec-text">' + esc(g.rec) + '</p>' +
          '</div>' : '') +
        '</article>';
    }).join("");

    var html = '' +
      '<div class="rep-stack">' +
        '<div class="rep-toolbar">' +
          '<button type="button" class="rep-tool-btn" data-rep="pdf"><span aria-hidden="true">↓</span> Download PDF</button>' +
        '</div>' +
        '<div class="rep-paper">' +
        '<div class="rep-head">' +
          '<div class="rep-masthead">' +
            '<span class="rep-logo">On<b>Paper</b></span>' +
            '<span class="rep-mast-div"></span>' +
            '<span class="rep-eyebrow rep-mono">Gap Report</span>' +
          '</div>' +
          '<span class="rep-date rep-mono">' + esc(dateStr) + '</span>' +
        '</div>' +
        '<h1 class="rep-title">' + esc(subject) + '</h1>' +
        (fit ? '<div class="rep-match">' +
          '<span class="rep-match-label rep-mono">Match</span>' +
          '<span class="rep-matchword rep-matchword--' + fit.cls + '">' + fit.label + '</span>' +
        '</div>' : '') +
        '<hr class="rep-hair rep-hair-top">' +
        '<p class="rep-lead">' + esc(lead) + '</p>' +
        (n ? '<div class="rep-gaps">' + gapsHtml + '</div>' : '') +
        '<hr class="rep-hair rep-foot-rule">' +
        '<div class="rep-foot">' +
          '<span class="rep-foot-brand rep-mono">OnPaper</span>' +
          '<span class="rep-foot-tag rep-mono">Gaps, not scores. Fixes, not filler.</span>' +
        '</div>' +
        '</div>' + // .rep-paper
      '</div>';    // .rep-stack

    return { html: html, parsed: r, gaps: gaps };
  }

  // Paint the report into `container` and wire the single Download-PDF button.
  function render(container, out, opts) {
    var built = build(out, opts);
    container.innerHTML = built.html;

    container.querySelector('[data-rep="pdf"]').addEventListener("click", function () {
      document.body.classList.add("printing-report");
      var done = function () {
        document.body.classList.remove("printing-report");
        window.removeEventListener("afterprint", done);
      };
      window.addEventListener("afterprint", done);
      window.print();
      setTimeout(done, 1000); // fallback for browsers that don't fire afterprint
    });
    return built;
  }

  root.OnPaperReport = {
    parseReport: parseReport,
    subjectLine: subjectLine,
    matchKey: matchKey,
    parseGaps: parseGaps,
    build: build,
    render: render
  };
})(window);
