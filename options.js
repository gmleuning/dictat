(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  let S = { ...WKC_DEFAULTS };

  const status = (msg, err) => {
    const el = $("#status");
    el.textContent = msg; el.classList.toggle("err", !!err);
    clearTimeout(status.t);
    if (!err) status.t = setTimeout(() => (el.textContent = ""), 3000);
  };

  // Chrome allows ~120 sync writes a minute, so changes are batched: the
  // screen updates at once, storage is written 500 ms after the last change.
  let pending = {}, timer = null;
  function flush() {
    const patch = pending; pending = {}; timer = null;
    if (!Object.keys(patch).length) return;
    WKC_LOOK.save(patch, (err) => {
      if (err) status("Couldn't sync this change (" + err + "). It's kept on this computer and will apply here.", true);
    });
  }
  const save = (patch) => {
    Object.assign(S, patch); Object.assign(pending, patch);
    clearTimeout(timer); timer = setTimeout(flush, 500);
    refresh();
  };
  window.addEventListener("pagehide", flush);

  // ---- swatches ----
  function buildSwatches(key, list) {
    const box = $(`[data-swatches="${key}"]`);
    for (const [name, hex] of list) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "swatch"; b.style.background = hex; b.dataset.hex = hex;
      b.title = `${name} ${hex}`; b.setAttribute("aria-label", `${name} (${hex})`);
      b.addEventListener("click", () => save({ [key]: hex }));
      box.append(b);
    }
  }
  buildSwatches("accent", WKC_ACCENTS);
  buildSwatches("bg", WKC_BGS);

  // ---- font menus ----
  function fillFontMenus() {
    const custom = S.customFonts || [];
    for (const sel of $$("select[data-fontslot]")) {
      const keep = S[sel.dataset.key];
      sel.replaceChildren();
      const add = (value, label, group) => { const o = document.createElement("option"); o.value = value; o.textContent = label; (group || sel).append(o); };
      if (sel.dataset.fontslot === "body") {
        for (const [k, f] of Object.entries(WKC_BODY_FONTS)) add(k, f.label);
      } else add("default", "Default (Noto, per setting above)");
      if (custom.length) {
        const g = document.createElement("optgroup"); g.label = "Your fonts";
        for (const f of custom) add("custom:" + f.name, f.name + (f.source === "local" ? " (installed)" : " (Google)"), g);
        sel.append(g);
      }
      sel.value = keep;
      if (sel.value !== keep) sel.value = sel.dataset.fontslot === "body" ? "literata" : "default";
    }
    const list = $("#fontList");
    list.replaceChildren();
    for (const f of custom) {
      const li = document.createElement("li");
      const nm = document.createElement("span"); nm.className = "nm"; nm.textContent = f.name; nm.style.fontFamily = `"${f.name}", sans-serif`;
      const src = document.createElement("span"); src.className = "src"; src.textContent = f.source === "local" ? "installed" : "Google Fonts";
      const del = document.createElement("button"); del.type = "button"; del.textContent = "Remove";
      del.addEventListener("click", () => {
        const patch = { customFonts: (S.customFonts || []).filter((x) => x.name !== f.name) };
        for (const k of ["bodyFont", "koFont", "zhFont", "jaFont"]) if (S[k] === "custom:" + f.name) patch[k] = k === "bodyFont" ? "literata" : "default";
        save(patch); fillFontMenus();
      });
      li.append(nm, src, del);
      list.append(li);
      if (f.source === "google") loadGoogle(f.spec);
    }
  }
  function loadGoogle(spec) {
    const id = "gf-" + spec.replace(/\W+/g, "-");
    if (document.getElementById(id)) return;
    const l = document.createElement("link"); l.id = id; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=" + spec + "&display=swap";
    document.head.append(l);
  }

  // ---- add a font ----
  let source = "google";
  $("#fontSource").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    source = b.value;
    for (const x of $$("#fontSource button")) x.setAttribute("aria-pressed", String(x === b));
    $("#fontBrowse").hidden = !(source === "local" && "queryLocalFonts" in window);
    $("#fontHint").textContent = source === "google"
      ? "Any family from fonts.google.com. Weights and italics are picked up automatically where the family has them."
      : "Type the name exactly as your system lists it" + ("queryLocalFonts" in window ? ", or browse (Chrome asks permission once)." : ".");
  });
  $("#fontBrowse").addEventListener("click", async () => {
    try {
      const fonts = await window.queryLocalFonts();
      const fams = [...new Set(fonts.map((f) => f.family))].sort((a, b) => a.localeCompare(b));
      const dl = $("#localFonts"); dl.replaceChildren();
      for (const f of fams) { const o = document.createElement("option"); o.value = f; dl.append(o); }
      $("#fontName").focus();
      status(`${fams.length} installed fonts found; start typing to pick one.`);
    } catch (err) { status("Couldn't list installed fonts (" + (err.message || err) + "). You can still type a name.", true); }
  });
  $("#fontName").addEventListener("input", () => {
    const n = $("#fontName").value.trim();
    const sample = $("#fontSample");
    sample.hidden = !n;
    sample.style.fontFamily = `"${n}", monospace`;
  });
  async function googleSpec(name) {
    const fam = name.trim().replace(/\s+/g, "+");
    for (const spec of [`${fam}:ital,wght@0,400;0,600;0,700;1,400`, `${fam}:wght@400;700`, fam]) {
      try {
        const r = await fetch("https://fonts.googleapis.com/css2?family=" + spec + "&display=swap");
        if (r.ok) return spec;
      } catch (e) { return null; }
    }
    return null;
  }
  $("#fontAdd").addEventListener("click", async () => {
    const name = $("#fontName").value.trim().replace(/["\\]/g, "");
    if (!name) return;
    if ((S.customFonts || []).some((f) => f.name.toLowerCase() === name.toLowerCase())) { status(`${name} is already in your fonts.`); return; }
    let entry = { name, source };
    if (source === "google") {
      status(`Checking Google Fonts for “${name}”…`);
      const spec = await googleSpec(name);
      if (!spec) { status(`Google Fonts has no family called “${name}”. Check the spelling at fonts.google.com.`, true); return; }
      entry.spec = spec;
      loadGoogle(spec);
    }
    save({ customFonts: [...(S.customFonts || []), entry] });
    fillFontMenus();
    $("#fontName").value = ""; $("#fontSample").hidden = true;
    status(`Added ${name}. Pick it in one of the font menus above.`);
  });

  // ---- show current values ----
  function refresh() {
    for (const el of $$("[data-key]")) {
      const k = el.dataset.key, v = S[k];
      if (el.classList.contains("seg")) {
        for (const b of el.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.value === v));
      } else if (el.type === "checkbox") el.checked = !!v;
      else if (el.tagName === "TEXTAREA") { if (document.activeElement !== el) el.value = (v || []).join("\n"); }
      else if (el.tagName === "SELECT") { if (el.value !== v) el.value = v; }
      else if (document.activeElement !== el || el.type === "range") el.value = v;
    }
    for (const o of $$("[data-out]")) {
      const k = o.dataset.out, v = S[k];
      o.textContent = k === "lineHeight" ? (+v).toFixed(2) : v + "px";
    }
    for (const k of ["accent", "bg"]) {
      for (const b of $$(`[data-swatches="${k}"] .swatch`)) b.setAttribute("aria-pressed", String(b.dataset.hex === S[k]));
      const picker = $(`[data-color-for="${k}"]`);
      if (/^#[0-9a-f]{6}$/i.test(S[k])) picker.value = S[k];
    }
    const c = WKC_LOOK.contrast(WKC_LOOK.valid(S.accent, "#2c4a72"), WKC_LOOK.valid(S.bg, "#ffffff"));
    const out = $('[data-contrast="accent"]');
    out.textContent = `${c.toFixed(1)}:1 on this background` + (c < 4.5 ? " · hard to read (aim for 4.5+)" : "");
    out.className = "contrast " + (c < 4.5 ? "warn" : "ok");
  }

  // ---- inputs ----
  for (const el of $$("[data-key]")) {
    const k = el.dataset.key;
    if (el.classList.contains("seg")) {
      el.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) save({ [k]: b.value }); });
    } else if (el.type === "checkbox") {
      el.addEventListener("change", () => save({ [k]: el.checked }));
    } else if (el.type === "range" || el.type === "number") {
      el.addEventListener("input", () => { const n = parseFloat(el.value); if (!isNaN(n)) save({ [k]: n }); });
    } else if (el.tagName === "SELECT") {
      el.addEventListener("change", () => save({ [k]: el.value }));
    } else if (el.tagName === "TEXTAREA") {
      el.addEventListener("input", () => save({ [k]: el.value.split("\n").map((x) => x.trim()).filter(Boolean) }));
    } else if (el.classList.contains("hex")) {
      el.addEventListener("input", () => {
        let v = el.value.trim().toLowerCase();
        if (/^[0-9a-f]{6}$/.test(v)) v = "#" + v;
        const ok = /^#[0-9a-f]{6}$/.test(v);
        el.setAttribute("aria-invalid", String(!ok && v.length > 0));
        if (ok) save({ [k]: v });
      });
      el.addEventListener("blur", () => { el.value = S[k]; el.removeAttribute("aria-invalid"); });
    }
  }
  for (const p of $$("[data-color-for]")) p.addEventListener("input", () => save({ [p.dataset.colorFor]: p.value }));

  // ---- export / import / reset ----
  $("#export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "dictat-settings.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $("#import").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const clean = {};
      for (const k of Object.keys(WKC_DEFAULTS)) {
        if (!(k in data)) continue;
        const want = WKC_DEFAULTS[k];
        if (Array.isArray(want) ? Array.isArray(data[k]) : typeof data[k] === typeof want) clean[k] = data[k];
      }
      save(clean); fillFontMenus();
      status(`Imported ${Object.keys(clean).length} settings.`);
    } catch (err) { status("That file isn't a settings export.", true); }
    e.target.value = "";
  });
  $("#reset").addEventListener("click", () => {
    if (!confirm("Reset all settings to their defaults? Your added fonts are kept.")) return;
    save({ ...WKC_DEFAULTS, customFonts: S.customFonts || [] });
    fillFontMenus();
    status("Settings reset.");
  });

  WKC_LOOK.load((s) => { S = s; fillFontMenus(); refresh(); });
})();
