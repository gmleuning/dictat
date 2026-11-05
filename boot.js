// document_start: decide whether this page is ours, redirect Hangul searches
// with no exact match to Naver, hide the page until clean.js has rebuilt it,
// and start loading fonts as early as possible.
(() => {
  "use strict";
  const root = document.documentElement;
  const url = new URL(location.href);
  const original = url.searchParams.get("wkc") === "off";

  const HANGUL_ONLY = /^(?=.*\p{Script=Hangul})[\p{Script=Hangul}\s]+$/u;
  let title = url.pathname.startsWith("/wiki/")
    ? decodeURIComponent(url.pathname.slice(6))
    : (url.searchParams.get("title") || "");
  title = title.replace(/_/g, " ");

  // Special:Search without fulltext= is MediaWiki's "go" search: it only lands
  // on the results page when no page with that exact title exists.
  if (/^Special:Search(\/|$)/i.test(title)) {
    const q = (url.searchParams.get("search") || title.split("/").slice(1).join("/") || "").trim();
    if (q && HANGUL_ONLY.test(q) && !url.searchParams.has("fulltext") && !url.searchParams.has("offset")) {
      WKC_LOOK.load((S) => {
        if (S.enabled && S.naverSearch) location.replace(WKC_NAVER.replace("%s", encodeURIComponent(q)));
      });
    }
    return;
  }

  const action = url.searchParams.get("action");
  if (action && action !== "view") return;
  if (url.searchParams.has("diff")) return;
  const m = /^([^:]+):/.exec(title);
  const SKIP_NS = /^(Special|Talk|User|User talk|Wiktionary|Wiktionary talk|File|File talk|MediaWiki|MediaWiki talk|Template|Template talk|Help|Help talk|Category|Category talk|Appendix|Appendix talk|Concordance|Concordance talk|Index|Index talk|Rhymes|Rhymes talk|Transwiki|Transwiki talk|Thesaurus|Thesaurus talk|Citations|Citations talk|Sign gloss|Sign gloss talk|Reconstruction talk|Module|Module talk|Gadget|Gadget talk|Gadget definition|Gadget definition talk|Topic|Media|WT|WS|T|MOD|CAT|AP|RC|Wikipedia|w|Project)$/i;
  if (m && SKIP_NS.test(m[1])) return;
  if (title === "" || title === "Wiktionary:Main Page") return;

  if (original) {
    // Wiktionary's own layout was asked for: just add the switch back.
    WKC_LOOK.load((S) => {
      if (!S.enabled) return;
      const add = () => {
        if (!document.body.classList.contains("ns-0") && !document.body.classList.contains("ns-118")) return;
        const back = new URL(location.href);
        back.searchParams.delete("wkc");
        const a = document.createElement("a");
        a.className = "wkc-switch wkc-switch-clean";
        a.href = back.href;
        a.title = "Back to the cleaned-up layout";
        a.textContent = "Clean";
        document.body.appendChild(a);
      };
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", add); else add();
    });
    return;
  }

  // Wiktionary's first inline script overwrites <html class>, so hiding is a
  // <style> element and the hand-off to clean.js is a variable in the shared
  // content-script scope.
  window.__wkcBoot = true;
  const hide = document.createElement("style");
  hide.id = "wkc-boot-style";
  hide.textContent = "body{visibility:hidden!important}";
  root.appendChild(hide);
  window.__wkcUnboot = () => hide.remove();
  setTimeout(window.__wkcUnboot, 5000); // never leave a page blank

  WKC_LOOK.load((S) => {
    if (!S.enabled) { window.__wkcBoot = false; window.__wkcUnboot(); return; }
    WKC_LOOK.apply(S, root);       // CSS variables survive the class reset
    WKC_LOOK.ensureFonts(S);
  });
})();
