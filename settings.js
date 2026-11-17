// Shared by the content scripts, the settings page and its preview.
// (var, not const: content scripts share one global scope across files.)
var WKC_DEFAULTS = {
  enabled: true,
  // appearance
  accent: "#2c4a72",
  bg: "#ffffff",
  autoDark: true,           // follow Wiktionary's / the system's dark mode
  h2Style: "rule",          // rule | hairline | none
  // typography
  webfonts: true,           // load the chosen fonts from Google Fonts
  bodyFont: "literata",     // built-in key, or "custom:<Family>"
  koFont: "default",        // "default" (Noto per CJK style) or "custom:<Family>"
  zhFont: "default",
  jaFont: "default",
  customFonts: [],          // [{ name, source: "google" | "local", spec }]
  cjkStyle: "sans",         // sans | serif
  hantFont: true,           // Taiwan-standard glyphs (TC) for traditional Chinese
  fontSize: 16,
  lineHeight: 1.7,
  width: 720,
  // layout
  preferred: ["English", "Chinese", "Korean", "Japanese", "Translingual"],
  moveToTop: false,
  collapseAbove: 4,
  toc: "multi",             // always | multi | never
  hideTranslations: false,
  hideEtyTree: false,
  hideDescendants: false,
  hideAnagrams: false,
  quoteMode: "open",        // open | collapsed | hidden
  quoteStyle: "compact",    // compact | full
  nymsMode: "open",         // synonyms/antonyms/hyponyms under senses: open | collapsed | hidden
  // CJK
  boxCharSize: 26,
  cjkRomanization: true,    // keep romanizations in inline CJK term lists
  // missing pages
  lowercaseMissing: true,   // missing page with capitals -> the all-lowercase entry, if it exists
  // Korean / Naver
  naverMissing: true,       // missing Hangul page -> Naver
  naverBanner: true,        // Hangul page without a Korean section -> show a Naver link
  naverRedLinks: true,      // red links to Hangul titles -> Naver
  naverSearch: true,        // Hangul search with no exact match -> Naver
  // pronunciation
  audioOnly: true,          // drop IPA, rhymes, romanization tables etc.; keep audio only
  forvo: true,              // no audio -> Forvo search link
  // etymology
  etyStyle: "timeline",     // timeline | original
  abbrevPIE: true
};

var WKC_NAVER = "https://en.dict.naver.com/#/search?query=%s";
var WKC_FORVO = "https://forvo.com/search/%s/";

var WKC_BODY_FONTS = {
  "literata":      { label: "Literata",       family: '"Literata"',       g: "Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;0,7..72,700;1,7..72,400", fallback: 'Georgia, "Times New Roman", serif' },
  "source-serif":  { label: "Source Serif 4", family: '"Source Serif 4"', g: "Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400", fallback: 'Georgia, serif' },
  "eb-garamond":   { label: "EB Garamond",    family: '"EB Garamond"',    g: "EB+Garamond:ital,wght@0,400;0,600;0,700;1,400", fallback: 'Garamond, Georgia, serif' },
  "inter":         { label: "Inter",          family: '"Inter"',          g: "Inter:ital,wght@0,400;0,600;0,700;1,400", fallback: 'system-ui, sans-serif' },
  "ibm-plex-sans": { label: "IBM Plex Sans",  family: '"IBM Plex Sans"',  g: "IBM+Plex+Sans:ital,wght@0,400;0,600;0,700;1,400", fallback: 'system-ui, sans-serif' },
  "system-serif":  { label: "System serif",   family: "",                 g: null, fallback: 'ui-serif, Georgia, "Times New Roman", serif' },
  "system-sans":   { label: "System sans",    family: "",                 g: null, fallback: 'system-ui, -apple-system, "Segoe UI", sans-serif' }
};

var WKC_ACCENTS = [
  ["Ink", "#2c4a72"], ["Oxblood", "#8a2b2b"], ["Forest", "#2f5d3a"],
  ["Plum", "#5b3a6b"], ["Teal", "#1f5f66"], ["Graphite", "#3d4148"]
];
var WKC_BGS = [
  ["White", "#ffffff"], ["Paper", "#fbf7ee"], ["Mist", "#f3f5f7"], ["Night", "#17181a"]
];
