// Visual settings -> CSS variables, classes and the Google Fonts <link>.
// Used by boot.js/clean.js on Wiktionary and by the settings preview.
var WKC_LOOK = (() => {
  "use strict";
  const hexRe = /^#([0-9a-f]{6})$/i;
  const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const toHex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  function lum(hex) {
    const [r, g, b] = rgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrast(a, b) { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }
  function mix(a, b, t) { const A = rgb(a), B = rgb(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); }
  function readable(fg, bg, min = 4.5) {
    // nudge fg toward white (dark bg) or black (light bg) until it reads
    const toward = lum(bg) < 0.2 ? "#ffffff" : "#000000";
    for (let t = 0; t <= 1.0001; t += 0.05) { const c = mix(fg, toward, t); if (contrast(c, bg) >= min) return c; }
    return toward;
  }
  const valid = (hex, fb) => (hexRe.test(hex || "") ? hex.toLowerCase() : fb);

  function wantsDark(S, root) {
    const bg = valid(S.bg, "#ffffff");
    if (lum(bg) < 0.2) return true;
    if (!S.autoDark) return false;
    const c = root.classList;
    if (c.contains("skin-theme-clientpref-night")) return true;
    if (c.contains("skin-theme-clientpref-day")) return false;
    return !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
  }

  const customFont = (S, v) => {
    if (typeof v !== "string" || !v.startsWith("custom:")) return null;
    const name = v.slice(7);
    return (S.customFonts || []).find((f) => f.name === name) || null;
  };
  const q = (name) => '"' + name.replace(/["\\]/g, "") + '"';

  function fontsURL(S) {
    const fams = [];
    const body = WKC_BODY_FONTS[S.bodyFont];
    if (body && body.g) fams.push(body.g);
    const kind = S.cjkStyle === "serif" ? "Serif" : "Sans";
    for (const r of ["SC", "TC", "JP", "KR"]) fams.push(`Noto+${kind}+${r}:wght@400;500;700`);
    for (const slot of ["bodyFont", "koFont", "zhFont", "jaFont"]) {
      const f = customFont(S, S[slot]);
      if (f && f.source === "google" && f.spec && !fams.includes(f.spec)) fams.push(f.spec);
    }
    return "https://fonts.googleapis.com/css2?" + fams.map((f) => "family=" + f).join("&") + "&display=swap";
  }

  function ensureFonts(S, doc = document) {
    const parent = doc.head || doc.documentElement;
    let link = doc.getElementById("wkc-fonts");
    if (!S.webfonts) { if (link) link.remove(); return; }
    if (!doc.getElementById("wkc-preconnect")) {
      for (const [href, cross] of [["https://fonts.googleapis.com", false], ["https://fonts.gstatic.com", true]]) {
        const l = doc.createElement("link");
        l.rel = "preconnect"; l.href = href; if (cross) l.crossOrigin = "anonymous";
        if (!cross) l.id = "wkc-preconnect";
        parent.appendChild(l);
      }
    }
    const href = fontsURL(S);
    if (!link) { link = doc.createElement("link"); link.id = "wkc-fonts"; link.rel = "stylesheet"; parent.appendChild(link); }
    if (link.getAttribute("href") !== href) link.setAttribute("href", href);
  }

  const OWN = /^wkc-(dark|hant|cjk-serif|h2-\w+|hide-\w+|quotes-\w+|nyms-\w+)$/;
  function apply(S, root = document.documentElement) {
    const dark = wantsDark(S, root);
    let bg = valid(S.bg, "#ffffff");
    if (dark && lum(bg) >= 0.2) bg = "#17181a";
    let accent = valid(S.accent, "#2c4a72");
    if (dark) accent = readable(accent, bg);
    const st = root.style;
    const cb = customFont(S, S.bodyFont);
    const body = cb ? { family: q(cb.name), fallback: 'Georgia, "Times New Roman", serif' } : (WKC_BODY_FONTS[S.bodyFont] || WKC_BODY_FONTS.literata);
    for (const [slot, v] of [["koFont", "--wkc-font-ko"], ["zhFont", "--wkc-font-zh"], ["jaFont", "--wkc-font-ja"]]) {
      const f = customFont(S, S[slot]);
      if (f) st.setProperty(v, q(f.name) + ","); else st.removeProperty(v);
    }
    st.setProperty("--wkc-bg", bg);
    st.setProperty("--wkc-link", accent);
    st.setProperty("--font-body", [body.family, body.fallback, '"Noto Sans SC"', "sans-serif"].filter(Boolean).join(", "));
    st.setProperty("--wkc-size", String(Math.min(22, Math.max(13, +S.fontSize || 16))));
    st.setProperty("--wkc-lh", String(Math.min(2.2, Math.max(1.3, +S.lineHeight || 1.7))));
    st.setProperty("--wkc-width", Math.min(1100, Math.max(520, +S.width || 720)) + "px");
    st.setProperty("--wkc-box-char", Math.min(40, Math.max(18, +S.boxCharSize || 26)) + "px");
    for (const c of Array.from(root.classList)) if (OWN.test(c)) root.classList.remove(c);
    const add = (on, c) => on && root.classList.add(c);
    add(dark, "wkc-dark");
    add(S.hantFont, "wkc-hant");
    add(S.cjkStyle === "serif", "wkc-cjk-serif");
    root.classList.add("wkc-h2-" + (["rule", "hairline", "none"].includes(S.h2Style) ? S.h2Style : "rule"));
    add(S.hideTranslations, "wkc-hide-translations");
    root.classList.add("wkc-quotes-" + (["open", "collapsed", "hidden"].includes(S.quoteMode) ? S.quoteMode : "open"));
    root.classList.add("wkc-nyms-" + (["open", "collapsed", "hidden"].includes(S.nymsMode) ? S.nymsMode : "open"));
    add(S.hideEtyTree, "wkc-hide-etytree");
    add(S.hideDescendants, "wkc-hide-descendants");
    add(S.hideAnagrams, "wkc-hide-anagrams");
  }

  // Settings live in chrome.storage.sync. If a sync write is refused (quota),
  // the values are kept in storage.local, which then takes precedence.
  function storage() { return chrome.storage.sync || chrome.storage.local; }
  function load(cb) {
    storage().get(WKC_DEFAULTS, (s) => {
      chrome.storage.local.get(null, (loc) => {
        const over = (loc && loc.__pending) || {};
        const S = Object.assign({}, s, over);
        cb(S);
      });
    });
  }
  function save(patch, done) {
    chrome.storage.sync.set(patch, () => {
      const err = chrome.runtime.lastError;
      if (!err) {
        chrome.storage.local.get({ __pending: {} }, (loc) => {
          const p = loc.__pending; for (const k of Object.keys(patch)) delete p[k];
          chrome.storage.local.set({ __pending: p }, () => done && done(null));
        });
        return;
      }
      chrome.storage.local.get({ __pending: {} }, (loc) => {
        chrome.storage.local.set({ __pending: Object.assign(loc.__pending, patch) }, () => done && done(err.message || String(err)));
      });
    });
  }

  return { apply, ensureFonts, fontsURL, contrast, readable, lum, valid, load, save, storage };
})();
