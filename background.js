const store = chrome.storage.sync;
function badge(enabled) {
  chrome.action.setBadgeText({ text: enabled === false ? "off" : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#8a8f95" });
}
store.get({ enabled: true }, (s) => badge(s.enabled));
chrome.storage.onChanged.addListener((c, area) => { if (area === "sync" && c.enabled) badge(c.enabled.newValue); });

// v0.1 kept settings in storage.local; carry them over once (and keep the
// "__pending" fallback that look.js uses when a sync write is refused).
chrome.runtime.onInstalled.addListener(() => {
  const OLD = ["enabled", "webfonts", "hantFont", "collapseAbove", "preferred"];
  chrome.storage.local.get(OLD, (old) => {
    if (!old || !Object.keys(old).length) return;
    store.get(null, (cur) => {
      const carry = {};
      for (const k of OLD) if (k in old && !(k in cur)) carry[k] = old[k];
      store.set(carry, () => chrome.storage.local.remove(OLD));
    });
  });
});

chrome.action.onClicked.addListener((tab) => {
  store.get({ enabled: true }, (s) => {
    store.set({ enabled: !s.enabled }, () => {
      if (tab && tab.id != null && /^https:\/\/en\.wiktionary\.org\//.test(tab.url || "")) chrome.tabs.reload(tab.id);
    });
  });
});
