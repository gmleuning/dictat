// Settings preview: re-applies the look whenever a setting changes.
(() => {
  const root = document.documentElement;
  const update = () => WKC_LOOK.load((S) => { WKC_LOOK.apply(S, root); WKC_LOOK.ensureFonts(S); });
  update();
  chrome.storage.onChanged.addListener(update);
  if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", update);
  for (const b of document.querySelectorAll(".wkc-toggle")) {
    b.addEventListener("click", () => b.closest(".wkc-lang").classList.toggle("wkc-collapsed"));
  }
})();
