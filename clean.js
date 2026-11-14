// dictat: rebuilds an entry page into a single quiet column.
// Strategy: MOVE (never clone) Wiktionary's content nodes into a new wrapper,
// so the site's own scripts (show/hide toggles, popups) keep working.
// Every transform is optional: when a pattern isn't found, the content is left
// as Wiktionary rendered it and only the generic styles apply.
(() => {
  "use strict";
  const D = document;
  const root = D.documentElement;
  const $ = (s, el = D) => el.querySelector(s);
  const $$ = (s, el = D) => Array.from(el.querySelectorAll(s));
  const h = (tag, attrs = {}, ...kids) => {
    const el = D.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const k of kids) if (k != null && k !== false) el.append(k);
    return el;
  };
  const unboot = () => { if (window.__wkcUnboot) window.__wkcUnboot(); };
  if (!window.__wkcBoot) return; // boot.js decided not to run on this page

  const CJK_LANGS = new Set([
    "Chinese", "Mandarin", "Cantonese", "Hokkien", "Teochew", "Hakka", "Wu", "Min Nan", "Min Dong",
    "Gan", "Xiang", "Jin", "Dungan", "Literary Chinese", "Classical Chinese", "Old Chinese", "Middle Chinese",
    "Japanese", "Old Japanese", "Okinawan", "Korean", "Middle Korean", "Old Korean", "Jeju"
  ]);
  const KOREAN_LANGS = new Set(["Korean", "Middle Korean", "Old Korean", "Jeju"]);
  const NO_ETY = new Set([...CJK_LANGS].filter((l) => !/Japanese|Okinawan/.test(l)));
  const POS = new Set([
    "Noun", "Proper noun", "Verb", "Adjective", "Adverb", "Pronoun", "Preposition", "Postposition",
    "Conjunction", "Interjection", "Particle", "Numeral", "Number", "Determiner", "Article", "Classifier",
    "Counter", "Affix", "Prefix", "Suffix", "Infix", "Interfix", "Circumfix", "Phrase", "Proverb", "Idiom",
    "Prepositional phrase", "Contraction", "Symbol", "Letter", "Character", "Han character", "Hanzi", "Kanji",
    "Hanja", "Syllable", "Romanization", "Participle", "Root", "Abbreviation", "Initialism", "Acronym",
    "Definitions", "Ideophone", "Combining form", "Adnominal", "Diacritical mark", "Punctuation mark",
    "Ligature", "Predicative", "Converb", "Gerund", "Clitic"
  ]);
  const MAJOR = /^(Etymology|Pronunciation|Glyph origin|Alternative forms|Alternative scripts|Usage notes|References|Further reading|Anagrams)(\s+\d+)?$/;
  const HAN1 = /^\p{Script=Han}$/u;
  const HANGUL_ONLY = /^(?=.*\p{Script=Hangul})[\p{Script=Hangul}\s]+$/u;
  const CJK_SEL = ".Hani, .Hant, .Hans, .Jpan, .Kore, .Hang, [lang|='zh'], [lang|='ja'], [lang|='ko']";
  const fill = (tpl, q) => tpl.replace("%s", encodeURIComponent(q));

  const pageTitle = () => {
    const u = new URL(location.href);
    const t = u.pathname.startsWith("/wiki/") ? decodeURIComponent(u.pathname.slice(6)) : (u.searchParams.get("title") || "");
    return t.replace(/_/g, " ");
  };

  function isEntryPage() {
    const b = D.body;
    if (!b || !b.classList.contains("action-view")) return false;
    if (!(b.classList.contains("ns-0") || b.classList.contains("ns-118"))) return false;
    if (b.classList.contains("page-Wiktionary_Main_Page")) return false;
    return !$("table.diff");
  }

  // ---------- headings (old parser, current parser, Parsoid) ----------
  const H_SEL = "h1,h2,h3,h4,h5,h6";
  function hNode(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.classList.contains("mw-heading")) return el.querySelector(H_SEL);
    return /^H[1-6]$/.test(el.tagName) ? el : null;
  }
  const hLevel = (el) => { const n = hNode(el); return n ? +n.tagName[1] : 0; };
  const hText = (n) => (n.querySelector(".mw-headline") || n).textContent.trim();
  const hId = (n) => n.id || (n.querySelector(".mw-headline") || {}).id || "";
  const slug = (t) => t.toLowerCase().replace(/\s+\d+$/, "").replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
  function unwrapParsoidSections(po) {
    let s;
    while ((s = po.querySelector("section[data-mw-section-id]"))) s.replaceWith(...s.childNodes);
  }
  const scriptClasses = (el) => Array.from(el.classList).filter((c) => /^[A-Z][a-z]{3}(-[a-z]+)?$/.test(c)).join(" ");

  // =====================================================================
  // Etymology: "From A x, from B y (“gloss”), from C z. Related to … ." -> timeline
  // =====================================================================
  const ETY = (() => {
    const ABBR_BEFORE = /(?:\b(?:e\.g|i\.e|cf|c|ca|lit|esp|viz|vs|fl|approx|cent|sc|q\.v))$/i;
    const START = /^\s*(.*?)\bfrom\s+(?:(the\s+root\s+)|the\s+(verb|noun|adjective|adverb|stem|participle)\s+)?$/i;
    const LINK = /\bfrom\s+(the\s+root\s+)?$/i;
    const TAG_OK = /^(?:(?:ultimately|probably|possibly|perhaps|likely|maybe|in\s+turn|itself|either|or)\s+)*(?:(?:a|an)\s+)?(?:(?:learned|semi-learned|unadapted|orthographic|partial|early|late)\s+)?(?:borrowing|borrowed|inherited|derived|calque[d]?|via)?\s*$/i;
    const GLUE = /^\s*(?:,|,?\s*or|,?\s*and|\/|\+)?\s*$/i;
    const RELS = [
      [/^(?:it\s+is\s+|this\s+is\s+)?(?:also\s+)?related\s+to\b\s*/i, "Related"],
      [/^not\s+related\s+to\b\s*/i, "Not related"],
      [/^(?:ultimately\s+)?(?:an?\s+)?(?:(distant|piecewise|ultimate)\s+)?doublets?\s+(?:of|with)\s*/i, "Doublet"],
      [/^cognates?\b(?:\s+(?:with|include|are|of))?\s*:?\s*/i, "Cognates"],
      [/^compared?\b(?:\s+also)?(?:\s+(?:to|with))?\b\s*/i, "Compare"],
      [/^equivalent\s+to\b\s*/i, "Equivalent"],
      [/^(?:by\s+)?surface(?:-|\s)?analy[sz](?:ed|able|is)(?:\s+as)?,?\s*/i, "Surface analysis"],
      [/^akin\s+to\b\s*/i, "Akin"],
      [/^displaced\s+native\b\s*/i, "Displaced"],
      [/^more\s+at\b\s*/i, "More at"],
      [/^see\s+also\b\s*/i, "See also"],
      [/^(?:or\s+)?(?:(?:possibly|perhaps|probably|alternatively|also)\s+)+(?:derived\s+|borrowed\s+|inherited\s+)?from\s+/i, "Alternatively"]
    ];

    function tokens(p) {
      const out = [];
      const walk = (node) => {
        for (const n of node.childNodes) {
          if (n.nodeType === 3) { if (n.nodeValue) out.push({ t: "text", v: n.nodeValue }); continue; }
          if (n.nodeType !== 1) continue;
          const c = n.classList;
          if (c.contains("etyl")) out.push({ t: "lang", v: n.textContent.trim() });
          else if (c.contains("mention-gloss")) out.push({ t: "gloss", v: n.textContent.trim() });
          else if (c.contains("mention-gloss-paren") || c.contains("mention-gloss-double-quote") || c.contains("mention-gloss-separator") || c.contains("annotation-paren")) continue;
          else if (c.contains("tr") || c.contains("mention-tr")) out.push({ t: "tr", v: n.textContent.trim() });
          else if (n.tagName === "A" && /Appendix:Glossary/.test(n.getAttribute("href") || "")) out.push({ t: "text", v: n.textContent });
          else if (n.tagName === "A" && c.contains("extiw") && /wikipedia\.org|^\/wiki\/w:/.test(n.getAttribute("href") || "")) out.push({ t: "lang", v: n.textContent.trim(), wiki: true });
          else if (c.contains("mention") || (n.tagName === "I" && n.querySelector("a")) || n.tagName === "A") out.push({ t: "form", node: n });
          else if (n.tagName === "SUP" || c.contains("reference")) out.push({ t: "ref", node: n });
          else if (n.tagName === "SPAN" && !n.className && !n.getAttribute("lang")) walk(n);
          else if (n.tagName === "I" || n.tagName === "B" || n.tagName === "SPAN") out.push({ t: "form", node: n });
          else out.push({ t: "other", node: n });
        }
      };
      walk(p);
      const merged = [];
      for (const tk of out) {
        const last = merged[merged.length - 1];
        if (tk.t === "text" && last && last.t === "text") last.v += tk.v; else merged.push(tk);
      }
      return merged;
    }

    // split one text token at sentence ends -> [before, after] or null
    function sentenceSplit(v) {
      const re = /\.(?=\s+[A-Z“"(]|\s*$)/g;
      let m;
      while ((m = re.exec(v))) {
        if (ABBR_BEFORE.test(v.slice(0, m.index))) continue;
        return [v.slice(0, m.index), v.slice(m.index + 1)];
      }
      return null;
    }

    function parseChain(toks, ownLang) {
      const first = toks[0];
      if (!first || first.t !== "text") return null;
      const sm = START.exec(first.v);
      if (!sm) return null;
      const startTag = sm[1].trim();
      if (startTag && !TAG_OK.test(startTag)) return null;
      const steps = [];
      let cur = { lang: null, items: [], tag: (sm[2] ? "root" : sm[3] ? sm[3] : startTag).toLowerCase(), note: "" };
      steps.push(cur);
      let i = 1, rest = [];
      for (; i < toks.length; i++) {
        const tk = toks[i];
        if (tk.t === "text") {
          const semi = /;\s*(.*)$/s.exec(tk.v);
          if (semi && RELS.some(([re]) => re.test(semi[1]))) {
            const before = tk.v.slice(0, semi.index).replace(/^[\s,]+|[\s,]+$/g, "");
            if (before) { cur.note += (cur.note ? "; " : "") + before; }
            rest = [{ t: "text", v: semi[1].replace(/^./, (x) => x.toUpperCase()) }, ...toks.slice(i + 1)];
            break;
          }
          const sp = sentenceSplit(tk.v);
          const v = sp ? sp[0] : tk.v;
          const lm = LINK.exec(v);
          if (lm && !sp) {
            let pre = v.slice(0, lm.index).replace(/^[\s,;]+/, "").replace(/[\s,]+$/, "");
            if (/\b(also|alternatively|or)\b/i.test(pre)) {
              rest = [{ t: "text", v: pre.replace(/^./, (x) => x.toUpperCase()) + " from " }, ...toks.slice(i + 1)];
              break;
            }
            let tag = "";
            const parts = pre.split(/\s*;\s*/);
            const last = parts.pop();
            if (TAG_OK.test(last)) { tag = last.trim(); if (parts.length) cur.note += (cur.note ? "; " : "") + parts.join("; "); }
            else cur.note += (cur.note ? "; " : "") + pre;
            if (cur.note.length > 90) return null;
            cur = { lang: null, items: [], tag: (lm[1] ? (tag ? tag + " " : "") + "root" : tag).toLowerCase(), note: "" };
            steps.push(cur);
            continue;
          }
          if (!GLUE.test(v)) {
            let note = v.replace(/^[\s,;]+|[\s,;]+$/g, "");
            if (/^\(.*\)$/.test(note)) note = note.slice(1, -1);
            if (note) { cur.note += (cur.note ? "; " : "") + note; if (cur.note.length > 90) return null; }
          } else if (v.trim() && cur.items.length) cur.items.push({ sep: v.replace(/^\s+|\s+$/g, "").replace(/^,$/, ",") });
          if (sp) { rest = [{ t: "text", v: sp[1] }, ...toks.slice(i + 1)]; break; }
          continue;
        }
        if (tk.t === "lang") {
          if (!cur.lang && !cur.items.length) cur.lang = tk.v;
          else cur.items.push({ lang: tk.v });
        } else if (tk.t === "form") cur.items.push({ form: tk.node });
        else if (tk.t === "gloss") cur.items.push({ gloss: tk.v });
        else if (tk.t === "tr") cur.items.push({ tr: tk.v });
        else if (tk.t === "ref") cur.items.push({ ref: tk.node });
        else return null;
      }
      if (!steps[0].lang && ownLang && steps[0].items.some((x) => x.form)) steps[0].lang = ownLang;
      if (!steps[0].lang) return null;
      if (steps.some((s) => !s.items.some((x) => x.form) && !s.lang)) return null;
      if (!steps[0].items.some((x) => x.form)) return null;
      // steps without their own language continue the previous one
      for (let k = 1; k < steps.length; k++) if (!steps[k].lang) { steps[k].lang = steps[k - 1].lang; steps[k].cont = true; }
      return { steps, rest };
    }

    function sentences(toks) {
      const out = [];
      let cur = [];
      for (const tk of toks) {
        if (tk.t !== "text") { cur.push(tk); continue; }
        let v = tk.v, sp;
        while ((sp = sentenceSplit(v))) {
          if (sp[0].trim()) cur.push({ t: "text", v: sp[0] + "." });
          else if (cur.length) cur.push({ t: "text", v: "." });
          if (cur.some((x) => x.t !== "text" || x.v.trim() !== ".")) out.push(cur);
          cur = [];
          v = sp[1];
        }
        if (v) cur.push({ t: "text", v });
      }
      if (cur.some((x) => x.t !== "text" || x.v.trim())) out.push(cur);
      return out;
    }

    function classify(sent) {
      if (!sent.length || sent[0].t !== "text") return null;
      const txt = sent[0].v.replace(/^\s+/, "");
      for (const [re, label] of RELS) {
        const m = re.exec(txt);
        if (m) {
          const body = [{ t: "text", v: txt.slice(m[0].length) }, ...sent.slice(1)];
          // drop the final full stop
          const last = body[body.length - 1];
          if (last.t === "text") last.v = last.v.replace(/\.\s*$/, "");
          if (label === "Alternatively" || label === "Compare") {
            // show the alternative as its own small chain: a ← b ← c
            for (const tk of body) if (tk.t === "text" && /^[\s,;]*from\s*$/i.test(tk.v)) { tk.t = "sep"; tk.v = "←"; }
          }
          return { label, note: m[1] ? m[1].toLowerCase() : "", body };
        }
      }
      return null;
    }

    const langName = (v, S) => (S.abbrevPIE && v === "Proto-Indo-European" ? "PIE" : v);

    function renderItems(items, S, paren) {
      const frag = D.createDocumentFragment();
      let pendingTr = null;
      const flushTr = (gloss) => {
        if (pendingTr == null && gloss == null) return;
        const g = h("span", { class: "wkc-ety-gloss" });
        if (paren) g.append(" (");
        else g.append(" ");
        if (pendingTr != null) g.append(h("span", { class: "wkc-ety-tr", text: pendingTr }));
        if (pendingTr != null && gloss != null) g.append(", ");
        if (gloss != null) g.append("“" + gloss + "”");
        if (paren) g.append(")");
        frag.append(g);
        pendingTr = null;
      };
      for (const it of items) {
        if (it.tr != null) { if (pendingTr != null) flushTr(null); pendingTr = it.tr; continue; }
        if (it.gloss != null) { flushTr(it.gloss); continue; }
        flushTr(null);
        if (it.form) { const c = it.form.cloneNode(true); c.classList.add("wkc-ety-form"); frag.append(c); }
        else if (it.lang) frag.append(" ", h("span", { class: "wkc-ety-lang-inline", text: langName(it.lang, S) }), " ");
        else if (it.ref) frag.append(it.ref.cloneNode(true));
        else if (it.sep) frag.append(/^[,]$/.test(it.sep) ? ", " : " " + it.sep + " ");
        else if (it.text != null) frag.append(it.text);
      }
      flushTr(null);
      return frag;
    }

    // sentence tokens -> items (for relation rows and leftover prose)
    function sentItems(sent) {
      return sent.map((tk) => {
        if (tk.t === "text") return { text: tk.v };
        if (tk.t === "sep") return { sep: tk.v };
        if (tk.t === "lang") return { lang: tk.v };
        if (tk.t === "form") return { form: tk.node };
        if (tk.t === "gloss") return { gloss: tk.v };
        if (tk.t === "tr") return { tr: tk.v };
        return { ref: tk.node };
      });
    }

    function build(sub, S, ownLang) {
      const ps = Array.from(sub.children).filter((n) => n.tagName === "P");
      const p0 = ps[0];
      if (!p0) return;
      const toks0 = tokens(p0);
      let chain = parseChain(toks0, ownLang);
      let formed = null;
      if (!chain) {
        // "From estää (“to prevent”) + -e." -> a "Formed from" row
        const ss = sentences(toks0);
        const s0 = ss[0];
        if (!s0 || s0[0].t !== "text" || !/^\s*from\s+/i.test(s0[0].v)) return;
        if (!s0.some((x) => x.t === "text" && /\+/.test(x.v))) return;
        const body = [{ t: "text", v: s0[0].v.replace(/^\s*from\s+/i, "") }, ...s0.slice(1)];
        const last = body[body.length - 1];
        if (last.t === "text") last.v = last.v.replace(/\.\s*$/, "");
        formed = { label: "Formed from", note: "", body };
        chain = { steps: [], rest: ss.slice(1).flat() };
      }

      // merge consecutive steps in the same language
      const lines = [];
      for (const st of chain.steps) {
        const prev = lines[lines.length - 1];
        if (prev && (st.cont || st.lang === prev.lang)) prev.parts.push(st);
        else lines.push({ lang: st.lang, parts: [st] });
      }
      const ol = h("ol", { class: "wkc-ety-chain" });
      for (const ln of lines) {
        const forms = h("span", { class: "wkc-ety-forms" });
        ln.parts.forEach((st, k) => {
          if (k) forms.append(h("span", { class: "wkc-ety-arrow", text: " ← " }));
          if (st.tag) forms.append(h("span", { class: "wkc-ety-tag", text: st.tag + " " }));
          forms.append(renderItems(st.items, S, false));
          if (st.note) forms.append(h("span", { class: "wkc-ety-note", text: " (" + st.note + ")" }));
        });
        ol.append(h("li", {}, h("span", { class: "wkc-ety-lang", text: langName(ln.lang, S) }), forms));
      }

      // the rest of the first paragraph, then any following paragraphs that are
      // nothing but relation sentences ("Cognate with …")
      const rows = formed ? [formed] : [], prose = [];
      for (const s of sentences(chain.rest)) {
        const c = classify(s);
        if (c) rows.push(c); else prose.push(s);
      }
      const consumed = [p0];
      for (const p of ps.slice(1)) {
        const ss = sentences(tokens(p));
        const cs = ss.map(classify);
        if (ss.length && cs.every(Boolean)) { rows.push(...cs); consumed.push(p); }
      }

      const box = h("div", { class: "wkc-ety" }, chain.steps.length ? ol : null);
      if (rows.length) {
        const dl = h("dl", { class: "wkc-ety-rel" });
        for (const r of rows) {
          const dd = h("dd", {});
          const items = sentItems(r.body);
          const nForms = items.filter((x) => x.form).length;
          const content = renderItems(items, S, true);
          if (r.note) dd.append(h("span", { class: "wkc-ety-note", text: `${r.note} · ` }));
          if (r.label === "Cognates" && nForms > 6) {
            dd.append(h("details", { class: "wkc-ety-more" }, h("summary", { text: `${nForms} cognates` }), h("div", {}, content)));
          } else dd.append(content);
          dl.append(h("dt", { text: r.label }), dd);
        }
        box.append(dl);
      }
      for (const s of prose) box.append(h("p", { class: "wkc-ety-prose" }, renderItems(sentItems(s), S, true)));

      const tgl = h("button", { type: "button", class: "wkc-ety-toggle", text: "original text" });
      box.append(tgl);
      tgl.addEventListener("click", () => {
        const show = sub.classList.toggle("wkc-ety-show-orig");
        tgl.textContent = show ? "hide original" : "original text";
      });
      consumed.forEach((p) => p.classList.add("wkc-ety-orig"));
      p0.before(box);
    }
    return { build };
  })();

  // =====================================================================
  // Audio rows
  // =====================================================================
  const VARIETY = /^(Mandarin|Cantonese|Taishanese|Hakka|Hokkien|Teochew|Wu|Min Dong|Min Nan|Min Bei|Gan|Xiang|Jin|Dungan|Southern Min|Eastern Min|Northern Min)/;
  function audioRow(el) {
    // el: table.audiotable or a bare <audio>
    const audio = el.tagName === "AUDIO" ? el : $("audio", el);
    if (!audio) return null;
    let label = "";
    if (el.tagName === "TABLE" && el.rows[0] && el.rows[0].cells[0]) {
      label = el.rows[0].cells[0].textContent.trim().replace(/:\s*$/, "");
      const paren = /\(([^)]+)\)/.exec(label);
      label = paren ? paren[1] : label.replace(/^Audio\s*/i, "");
    }
    if (!label) {
      // Chinese pronunciation box: find the variety this audio sits under
      for (let li = el.closest("li"); li; li = li.parentElement && li.parentElement.closest("li")) {
        const m = VARIETY.exec(li.textContent.trim());
        if (m) { label = m[1]; break; }
      }
    }
    const player = h("audio", { controls: true, preload: "none" });
    for (const src of $$("source", audio)) player.append(h("source", { src: src.getAttribute("src"), type: src.getAttribute("type") }));
    if (!player.children.length) {
      const file = audio.getAttribute("src") ||
        (audio.dataset.mwtitle && "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(audio.dataset.mwtitle));
      if (!file) return null;
      player.src = file;
    }
    const fileLink = el.tagName === "TABLE" ? $("td.audiometa a, a[href*='/File:']", el) : null;
    return h("li", { class: "wkc-audio" },
      h("span", { class: "wkc-audio-label", text: label || "Audio" }), player,
      fileLink ? h("a", { class: "wkc-audio-file", href: fileLink.href, title: "File page", text: "file" }) : null);
  }
  function forvoRow(title) {
    return h("li", { class: "wkc-audio wkc-forvo" },
      h("span", { class: "wkc-audio-label", text: "Forvo" }),
      h("a", { href: fill(WKC_FORVO, title), target: "_blank", rel: "noopener", text: `Search pronunciations of “${title}” ↗` }));
  }

  // =====================================================================
  // Quotations: passage first, then "— Author, Title (date)", full source on demand
  // =====================================================================
  function compactQuote(cw) {
    const src = cw.querySelector(":scope > .cited-source");
    const body = cw.querySelector(":scope > dl");
    if (!src || !body || !body.querySelector(".e-quotation")) return;
    const full = src.textContent.replace(/\s+/g, " ").trim();
    const dm = /^([^,]*\d[^,]*),\s*/.exec(full);
    const date = dm ? dm[1].replace(/\s*\((?:date\s+)?(?:written|published|composed|recorded)[^)]*\)/i, "").trim() : "";
    const rest = dm ? full.slice(dm[0].length) : full;
    let title = "", quoted = false, at = -1;
    const qm = /“([^”]+)”/.exec(rest);
    const citeEl = src.querySelector("cite");
    if (qm) { title = qm[1]; quoted = true; at = qm.index; }
    else if (citeEl) { title = citeEl.textContent.replace(/\s+/g, " ").trim(); at = rest.indexOf(title); }
    title = title.replace(/\s*\[(?:…|\.\.\.)\]/g, "").replace(/[\s,:;]+$/, "");
    if (title.length > 70) { const cut = title.search(/[:;]/); if (cut > 10) title = title.slice(0, cut); }
    let author = at > 0 ? rest.slice(0, at).replace(/[\s,]+$/, "").replace(/,?\s+in$/, "") : "";
    if (author.length > 70 || /\d{4}/.test(author)) author = "";
    if (!title && !author) return;

    const fullBox = h("div", { class: "wkc-quote-full", hidden: true }, src);
    const more = h("button", { type: "button", class: "wkc-quote-more", text: "source" });
    more.addEventListener("click", () => { fullBox.hidden = !fullBox.hidden; more.classList.toggle("open", !fullBox.hidden); });
    const attr = h("div", { class: "wkc-quote-src" }, "— ",
      author ? author + (title ? ", " : "") : null,
      title ? (quoted ? "“" + title + "”" : h("cite", { text: title })) : null,
      date ? ` (${date})` : null, " ", more);
    cw.replaceChildren(h("div", { class: "wkc-quote-text" }, body), attr, fullBox);
    cw.classList.add("wkc-quote");
  }

  // =====================================================================
  // Build
  // =====================================================================
  function run(S) {
    const content = $("#mw-content-text");
    const po = $(".mw-parser-output", content);
    const restore = { parent: content.parentNode, next: content.nextSibling };
    const titleEl = $("#firstHeading");
    const title = titleEl ? titleEl.textContent.trim() : pageTitle();
    const cats = $$("#mw-normal-catlinks ul li a").map((a) => ({ href: a.href, text: a.textContent.trim() }));
    const revid = (() => {
      const p = $("#t-permalink a");
      const fromLink = p && new URL(p.href, location.href).searchParams.get("oldid");
      if (fromLink) return fromLink;
      for (const sc of $$("script:not([src])")) { const m = /"wgRevisionId":(\d+)/.exec(sc.textContent); if (m) return m[1]; }
      return null;
    })();
    const pageName = (() => { const m = /^\/wiki\/(.+)$/.exec(location.pathname); return m ? m[1] : encodeURIComponent(title.replace(/ /g, "_")); })();

    try {
      po.querySelectorAll(".mw-editsection, .printfooter, .minitoc, .sister-project, .sister-wikipedia, .maintenance-box, .request-box, .mw-empty-elt, #toc, .toc")
        .forEach((n) => n.remove());
      unwrapParsoidSections(po);

      // ----- language sections -----
      let sections = [];
      let cur = null;
      for (const n of Array.from(po.childNodes)) {
        if (n.nodeType === 1 && hLevel(n) === 2) {
          const hn = hNode(n);
          const lang = hText(hn);
          const sec = h("section", { class: "wkc-lang" + (CJK_LANGS.has(lang) ? " wkc-cjk" : ""), "data-lang": lang });
          po.insertBefore(sec, n);
          n.classList.add("wkc-sechead");
          sec.append(n);
          cur = { el: sec, lang, id: hId(hn), hn };
          sections.push(cur);
          continue;
        }
        if (cur) cur.el.append(n);
        else if (n.nodeType === 1) n.classList.add("wkc-preamble");
      }
      for (const s of sections) {
        let last = s.el.lastElementChild;
        while (last && last.tagName === "HR") { last.remove(); last = s.el.lastElementChild; }
      }

      // ----- sub-sections: each heading + the content up to the next heading -----
      for (const s of sections) {
        let sub = null;
        for (const n of Array.from(s.el.childNodes)) {
          if (n.nodeType === 1 && n.classList.contains("wkc-sechead")) continue;
          const lvl = n.nodeType === 1 ? hLevel(n) : 0;
          if (lvl >= 3) {
            const hn = hNode(n);
            const t = hText(hn);
            const major = MAJOR.test(t) || POS.has(t);
            hn.classList.add(major ? "wkc-h-major" : "wkc-h-minor");
            sub = h("div", { class: "wkc-sub", "data-sec": slug(t) });
            n.before(sub);
            sub.append(n);
            continue;
          }
          if (sub) sub.append(n);
        }
      }

      // ----- headword lines, sense lists -----
      for (const hw of $$("strong.headword", po)) {
        const line = hw.closest("p, .headword-line") || hw.parentElement;
        if (line) line.classList.add("wkc-headword");
      }
      for (const ol of $$(".wkc-lang > ol, .wkc-sub > ol", po)) ol.classList.add("wkc-senses");

      // ----- pronunciation: audio only (+ Forvo when there is none) -----
      if (S.audioOnly) {
        for (const sub of $$(".wkc-sub[data-sec='pronunciation']", po)) {
          const head = sub.firstElementChild;
          const body = Array.from(sub.childNodes).filter((n) => n !== head);
          const found = [];
          for (const n of body) {
            if (n.nodeType !== 1) continue;
            const tables = n.matches("table.audiotable") ? [n] : $$("table.audiotable", n);
            found.push(...tables);
            for (const a of $$("audio", n)) if (!a.closest("table.audiotable")) found.push(a);
          }
          const rows = found.map(audioRow).filter(Boolean);
          body.forEach((n) => n.remove());
          const list = h("ul", { class: "wkc-audio-list" }, ...rows);
          if (!rows.length && S.forvo) list.append(forvoRow(title));
          if (list.children.length) sub.append(list);
          else sub.remove();
        }
      }
      // any remaining audiotables elsewhere get the same player
      for (const tbl of $$("table.audiotable", po)) {
        const row = audioRow(tbl);
        if (row) tbl.replaceWith(h("ul", { class: "wkc-audio-list wkc-audio-inline" }, row));
      }
      if (!S.audioOnly) {
        for (const li of $$(".wkc-lang li", po)) {
          const f = li.firstChild;
          if (f && f.nodeType === 3) {
            const m = /^\s*(Rhymes|Hyphenation|Homophones?|Syllabification|Paronyms?):\s*/.exec(f.nodeValue);
            if (m) { f.nodeValue = f.nodeValue.slice(m[0].length); li.insertBefore(h("span", { class: "wkc-label", text: m[1] }), f); }
          }
        }
        for (const a of $$("a[href*='International_Phonetic_Alphabet']", po)) {
          a.classList.add("wkc-label");
          const sup = a.nextElementSibling;
          if (sup && sup.tagName === "SUP" && /key/.test(sup.textContent)) sup.classList.add("wkc-ipa-key");
          const after = (sup && sup.classList.contains("wkc-ipa-key") ? sup : a).nextSibling;
          if (after && after.nodeType === 3) after.nodeValue = after.nodeValue.replace(/^\s*:\s*/, "");
        }
      }

      // ----- translations: fold every sense table into one disclosure -----
      for (const sub of $$(".wkc-sub[data-sec='translations']", po)) {
        const head = sub.firstElementChild;
        const body = Array.from(sub.childNodes).filter((n) => n !== head);
        const frames = body.filter((n) => n.nodeType === 1 && n.matches(".NavFrame, .pseudo"));
        if (!frames.length) continue;
        const inner = h("div", { class: "wkc-details-body" });
        body.forEach((n) => inner.append(n));
        sub.append(h("details", { class: "wkc-details wkc-trans" },
          h("summary", { text: `Show translations · ${frames.length} ${frames.length === 1 ? "sense" : "senses"}` }), inner));
      }

      // ----- figures: sound clips become audio rows; image tables lose table styling -----
      for (const fig of $$("figure", po)) {
        const audio = $("audio", fig);
        if (!audio || $("img, video", fig)) continue;
        const row = audioRow(audio);
        if (!row) continue;
        const cap = $("figcaption", fig);
        if (cap) row.append(h("span", { class: "wkc-audio-caption" }, ...cap.childNodes));
        fig.replaceWith(h("ul", { class: "wkc-audio-list" }, row));
      }
      for (const t of $$("table", po)) if ($("img, video", t)) t.classList.add("wkc-plain");

      // ----- show/hide boxes (conjugations, declensions, translations…) -----
      for (const head of $$(".NavHead", po)) {
        for (const n of Array.from(head.childNodes)) {
          if (n.nodeType === 3) { n.nodeValue = n.nodeValue.replace(/^[\s\u00a0]+/, ""); if (n.nodeValue) break; }
          else if (!n.classList || !n.classList.contains("NavToggle")) break;
        }
      }
      // a "unit" is a NavFrame, or a plain wrapper holding exactly one NavFrame
      // (plus template <link>/<style> tags); runs of units become one list
      const isSkip = (n) => n && (n.tagName === "LINK" || n.tagName === "STYLE");
      const unitFrame = (n) => {
        if (!n || n.nodeType !== 1) return null;
        if (n.classList.contains("NavFrame")) return n;
        if (n.tagName !== "DIV" || n.className) return null;
        const kids = Array.from(n.children).filter((k) => !isSkip(k));
        return kids.length === 1 && kids[0].classList.contains("NavFrame") ? kids[0] : null;
      };
      for (const f of $$(".NavFrame", po)) {
        if (f.closest(".wkc-navgroup, .wkc-trans") || f.parentElement.closest(".NavFrame")) continue;
        const first = f.parentElement.tagName === "DIV" && !f.parentElement.className && unitFrame(f.parentElement) === f ? f.parentElement : f;
        const run = [first];
        let n = first.nextElementSibling;
        while (n && (isSkip(n) || unitFrame(n))) { if (!isSkip(n)) run.push(n); n = n.nextElementSibling; }
        if (run.length < 2) continue;
        const g = h("div", { class: "wkc-navgroup" });
        first.before(g);
        for (const u of run) g.append(unitFrame(u));
        for (const u of run) if (u !== unitFrame(u) && !u.querySelector(".NavFrame")) u.remove();
      }

      // ----- quotations -----
      if (S.quoteStyle === "compact") {
        for (const cw of $$(".wkc-lang .citation-whole", po)) {
          try { compactQuote(cw); } catch (e) { /* leave as written */ }
        }
      }

      // ----- etymology timeline (every language except Chinese and Korean) -----
      if (S.etyStyle === "timeline") {
        for (const s of sections) {
          if (NO_ETY.has(s.lang)) continue;
          for (const sub of $$(".wkc-sub[data-sec='etymology']", s.el)) {
            try { ETY.build(sub, S, s.lang); } catch (e) { console.warn("[dictat] etymology skipped", e); }
          }
        }
      }

      // ----- character boxes (zh-forms, "Hanja in this term", ja-kanjitab) -----
      for (const s of sections) {
        if (!s.el.classList.contains("wkc-cjk")) continue;
        for (const t of $$("table", s.el)) {
          if (t.closest(".wkc-box, .NavFrame, .mw-collapsible, .zhpron")) continue;
          const charLinks = $$("a", t).filter((a) => HAN1.test(a.textContent.trim()));
          const rows = t.rows ? t.rows.length : 0;
          if (!charLinks.length || rows > 8) continue;
          const floated = t.classList.contains("floatright") || /float\s*:\s*right/.test(t.getAttribute("style") || "");
          if (!(/in this term/i.test(t.textContent) || floated)) continue;
          t.classList.add("wkc-box");
          t.removeAttribute("style");
          charLinks.forEach((a) => a.classList.add("wkc-box-char"));
          for (const th of $$("th[colspan], td[colspan]", t)) if (/in this term/i.test(th.textContent)) th.classList.add("wkc-box-label");
        }
      }

      // ----- CJK term lists: short items flow inline, separated by dots -----
      for (const s of sections) {
        if (!s.el.classList.contains("wkc-cjk")) continue;
        for (const ul of $$("ul", s.el)) {
          if (ul.closest(".wkc-senses, .NavFrame, table, .zhpron, .wkc-audio-list")) continue;
          const lis = Array.from(ul.children).filter((c) => c.tagName === "LI");
          if (lis.length < 2) continue;
          const ok = lis.every((li) => !li.querySelector("ul, ol, dl, table") && li.textContent.trim().length <= 32 && li.querySelector(CJK_SEL));
          if (!ok) continue;
          ul.classList.add("wkc-inline");
          if (!S.cjkRomanization) {
            for (const li of lis) {
              const keep = li.querySelector(CJK_SEL);
              const top = keep && Array.from(li.childNodes).find((c) => c === keep || (c.nodeType === 1 && c.contains(keep)));
              if (top) li.replaceChildren(top);
            }
          }
        }
      }

      // ----- Naver: red links to Hangul titles -----
      if (S.naverRedLinks) {
        for (const a of $$("a.new", po)) {
          let t = null;
          try { t = new URL(a.href, location.href).searchParams.get("title"); } catch (e) { /* ignore */ }
          if (t && HANGUL_ONLY.test(t.replace(/_/g, " "))) {
            const q = t.replace(/_/g, " ");
            a.href = fill(WKC_NAVER, q);
            a.classList.add("wkc-naver-link");
            a.title = `${q} on Naver Dictionary`;
          }
        }
      }

      // ----- wide tables scroll inside the column -----
      for (const t of $$("table", po)) {
        if (t.classList.contains("wkc-box") || t.classList.contains("wkc-plain") || t.parentElement.closest("table") || t.parentElement.classList.contains("wkc-scroll")) continue;
        const wrap = h("div", { class: "wkc-scroll" });
        t.replaceWith(wrap);
        wrap.append(t);
      }

      // ----- preferred languages first -----
      if (S.moveToTop && sections.length > 1) {
        const order = S.preferred.map((p) => sections.find((s) => s.lang === p)).filter(Boolean);
        const restS = sections.filter((s) => !order.includes(s));
        const mark = D.createComment("wkc");
        sections[0].el.before(mark);
        for (const s of order) mark.before(s.el);
        mark.remove();
        sections = order.concat(restS);
      }

      // ----- page shell -----
      const hw0 = $(".wkc-lang strong.headword", po);
      const h1 = h("h1", { class: "wkc-title" },
        h("span", { lang: hw0 ? hw0.getAttribute("lang") : null, class: hw0 ? scriptClasses(hw0) : null, text: title }));
      const header = h("header", { class: "wkc-header" },
        h("div", { class: "wkc-bar" }, h("a", { class: "wkc-home", href: "/wiki/Wiktionary:Main_Page", text: "Wiktionary" })),
        h1, h("p", { class: "wkc-tagline", text: "From Wiktionary, the free dictionary" }));
      // "See also: …" hatnotes go under the title, above the contents
      const hat = $$(":scope > .wkc-preamble", po).filter((n) => n.tagName !== "STYLE" && n.textContent.trim());
      if (hat.length) header.append(h("div", { class: "wkc-hatnotes" }, ...hat));

      if (S.naverBanner && HANGUL_ONLY.test(title) && !sections.some((s) => KOREAN_LANGS.has(s.lang))) {
        header.append(h("p", { class: "wkc-banner" }, "No Korean entry on Wiktionary · ",
          h("a", { href: fill(WKC_NAVER, title), text: "look up on Naver ↗" })));
      }

      // which languages start open
      const pref = new Set(S.preferred);
      const collapseSome = sections.length > S.collapseAbove;
      const anyPreferred = sections.some((s) => pref.has(s.lang));
      sections.forEach((s, i) => { s.startOpen = !collapseSome || (anyPreferred ? pref.has(s.lang) : i === 0); });
      const someHidden = sections.some((s) => !s.startOpen);

      // Contents: open languages, plus the hidden ones behind "N more languages"
      let toc = null, tocItems = new Map();
      const wantToc = someHidden || (S.toc === "always" ? sections.length >= 1 : S.toc === "multi" ? sections.length > 1 : false);
      if (wantToc) {
        const order = [...S.preferred.map((p) => sections.find((s) => s.lang === p)).filter(Boolean)];
        for (const s of sections) if (!order.includes(s)) order.push(s);
        const compact = sections.length > 6;
        const mk = (s) => { const li = h("li", {}, h("a", { href: "#" + s.id, text: s.lang })); tocItems.set(s, li); return li; };
        const openList = h(compact ? "ul" : "ol", { class: "wkc-toc-open-list" }, ...order.filter((s) => s.startOpen).map(mk));
        toc = h("nav", { class: "wkc-toc" + (compact ? " wkc-toc-compact" : ""), "aria-label": "Contents" },
          h("h2", { text: `Contents · ${sections.length} ${sections.length === 1 ? "language" : "languages"}` }), openList);
        const hidden = order.filter((s) => !s.startOpen);
        if (hidden.length) {
          const more = h("details", { class: "wkc-toc-more" },
            h("summary", { text: `${hidden.length} more ${hidden.length === 1 ? "language" : "languages"}` }),
            h("ul", {}, ...hidden.map(mk)));
          toc.append(more);
        }
      }
      let catBox = null;
      if (cats.length) {
        catBox = h("details", { class: "wkc-details wkc-cats" }, h("summary", { text: "Categories" }),
          h("div", { class: "wkc-details-body" }, h("ul", {}, ...cats.map((c) => h("li", {}, h("a", { href: c.href, text: c.text }))))));
      }
      const classic = new URL(location.href);
      classic.searchParams.set("wkc", "off");
      const footer = h("footer", { class: "wkc-footer" },
        h("p", {},
          revid ? "Retrieved from " : null,
          revid ? h("a", { href: `/w/index.php?title=${pageName}&oldid=${revid}`, text: `revision ${revid}` }) : null,
          revid ? " · " : null,
          "Text available under ", h("a", { href: "https://creativecommons.org/licenses/by-sa/4.0/", text: "CC BY-SA 4.0" }),
          "; additional terms may apply."),
        h("p", {},
          h("a", { href: `/w/index.php?title=${pageName}&action=edit`, text: "Edit" }), " · ",
          h("a", { href: `/w/index.php?title=${pageName}&action=history`, text: "History" }), " · ",
          h("a", { href: `/wiki/Talk:${pageName}`, text: "Discussion" }), " · ",
          h("a", { href: classic.href, text: "Classic view" })));

      const page = h("div", { class: "wkc-page" }, header, toc, content, catBox, footer);
      const KEEP = /^(mw-teleport-target|mwe-popups|mw-notification-area)$/;
      for (const el of Array.from(D.body.children)) {
        if (el.tagName === "SCRIPT" || KEEP.test(el.id) || Array.from(el.classList).some((c) => KEEP.test(c))) continue;
        el.classList.add("wkc-hidden");
      }
      D.body.prepend(page);
      root.classList.add("wkc");

      // ----- language sections: open / hidden -----
      sections.forEach((s) => {
        const btn = h("button", { type: "button", class: "wkc-toggle", title: "Hide this language" });
        const inner = s.hn.querySelector(".mw-headline") || s.hn;
        btn.append(...inner.childNodes);
        inner.append(btn);
        const li = tocItems.get(s);
        const set = (open) => {
          s.el.classList.toggle("wkc-collapsed", !open);
          if (li) li.classList.toggle("wkc-toc-open", open);
        };
        if (li) li.dataset.lang = s.lang;
        btn.addEventListener("click", () => set(false));
        s.open = () => {
          set(true);
          // a picked language joins the open list in Contents
          const openList = toc && toc.querySelector(".wkc-toc-open-list");
          if (li && openList && !openList.contains(li)) {
            openList.append(li);
            const more = toc.querySelector(".wkc-toc-more");
            const left = more && more.querySelectorAll("li").length;
            if (more && !left) more.remove();
            else if (more) more.querySelector("summary").textContent = `${left} more ${left === 1 ? "language" : "languages"}`;
          }
        };
        set(s.startOpen);
        if (li) li.querySelector("a").addEventListener("click", (e) => {
          e.preventDefault();
          s.open();
          history.replaceState(null, "", "#" + s.id);
          s.el.scrollIntoView({ block: "start" });
        });
      });
      const openForHash = () => {
        const id = decodeURIComponent(location.hash.slice(1));
        const target = id && D.getElementById(id);
        if (!target) return;
        const s = sections.find((x) => x.el.contains(target));
        if (s && s.el.classList.contains("wkc-collapsed")) { s.open(); target.scrollIntoView(); }
      };
      window.addEventListener("hashchange", openForHash);
      openForHash();

      // ----- floating switch to Wiktionary's own layout (this page only) -----
      const sw = h("a", { class: "wkc-switch", href: classic.href, title: "Show this page as Wiktionary renders it", text: "Original" });
      sw.addEventListener("click", () => {
        // land on the language section currently at the top of the screen
        const top = sections.filter((s) => !s.el.classList.contains("wkc-collapsed"))
          .find((s) => s.el.getBoundingClientRect().bottom > 80);
        const u = new URL(classic.href);
        if (top && top.id) u.hash = top.id;
        sw.href = u.href;
      });
      D.body.append(sw);

    } catch (err) {
      console.error("[dictat] transform failed; showing the normal page.", err);
      root.classList.remove("wkc");
      $$(".wkc-hidden").forEach((el) => el.classList.remove("wkc-hidden"));
      if (content.parentNode !== restore.parent) restore.parent.insertBefore(content, restore.next);
      const p = $(".wkc-page");
      if (p) p.remove();
    }
  }

  WKC_LOOK.load((S) => {
    let leaving = false;
    try {
      if (!S.enabled || !isEntryPage()) return;
      // Missing page with a Hangul title -> Naver
      if ($(".noarticletext")) {
        const t = pageTitle();
        if (S.naverMissing && HANGUL_ONLY.test(t)) { leaving = true; location.replace(fill(WKC_NAVER, t)); return; }
        return;
      }
      if (!$("#mw-content-text .mw-parser-output")) return;
      WKC_LOOK.apply(S, root); // again: the page's inline script reset <html class>
      run(S);
    } finally {
      if (!leaving) unboot();
    }
  });

  // Live updates from the settings page (look only; structure needs a reload).
  chrome.storage.onChanged.addListener(() => {
    if (!root.classList.contains("wkc")) return;
    WKC_LOOK.load((S) => { WKC_LOOK.apply(S, root); WKC_LOOK.ensureFonts(S); });
  });
})();
