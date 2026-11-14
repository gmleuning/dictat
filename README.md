# dictat 0.4

A Chrome extension (Manifest V3) that turns en.wiktionary.org entry pages into a single quiet reading column, and lets you tune nearly all of it: colour, type, language order, which sections show, and how etymology, quotations and pronunciation are presented. Settings include Korean (Naver) and Forvo shortcuts, and an export/import file.

## Install / update
Go to `chrome://extensions`, turn on Developer mode, click "Load unpacked" and choose this folder. To update, replace the files and click the reload arrow on the extension's card.

- Toolbar icon: turns the extension off or on.
- Right-click the icon, then Options: opens the settings page with a live preview.
- The "Original" pill (top right) shows the page as Wiktionary renders it; "Clean" brings it back.

## What it does
- Settings page with live preview: accent and background colours, automatic dark mode, heading style; body and per-language CJK fonts (built-in, Google Fonts or installed), text size, line spacing, column width.
- Language control: choose which languages start open, move them to the top, hide the rest behind Contents when a page has many.
- Per-section control: hide translations, etymology trees, descendants or anagrams; open, collapse or hide quotations (compact or as written) and synonym/antonym lists.
- Single-column layout with contents, collapsible language sections and categories in a box.
- Pronunciation: audio players only. If a pronunciation section has no audio, a Forvo search link appears instead.
- Etymology: "From … from …" chains become a timeline, with Related / Doublet / Cognates rows. Chinese, Japanese and Korean are left as written.
- Translations: one disclosure per part of speech.
- Chinese, Japanese and Korean: character boxes, per-language fonts, inline term lists.
- Naver (en.dict.naver.com):
  - A missing page with a Hangul title, or a Hangul search with no exact match, goes to Naver.
  - Red links to Hangul titles point to Naver.
  - A Hangul page with no Korean entry shows a Naver link.

Settings are stored in Chrome sync storage, so they follow your Chrome profile.

## Scope
Runs on entry pages and Reconstruction: pages (action=view). The Naver search redirect also runs on Special:Search. Everything else is left alone. The mobile site is not covered.
