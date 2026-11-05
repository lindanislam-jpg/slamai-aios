/* The free-channel catalog.
 *
 * Every entry here is a *public, legal, free-to-air* playlist published by the
 * open-source iptv-org project, which indexes channels that broadcasters stream
 * publicly themselves. Nothing here is a paid service and nothing is decrypted
 * or re-hosted — these are plain playlist URLs, fetched live.
 *
 * To watch a subscription you pay for, add its M3U URL or provider login under
 * Sources instead. That path is deliberately user-supplied: this app never
 * ships credentials or circumvents anyone's access control.
 */

export interface CatalogEntry {
  id: string;
  label: string;
  url: string;
  /** Short, honest description of what's inside. */
  note: string;
}

export interface CatalogGroup {
  id: string;
  label: string;
  blurb: string;
  entries: CatalogEntry[];
}

const IPTV = "https://iptv-org.github.io/iptv";

export const CATALOG: CatalogGroup[] = [
  {
    id: "everything",
    label: "Everything",
    blurb: "One big worldwide index. Start here, then filter by country or genre inside the app.",
    entries: [
      {
        id: "world-all",
        label: "All free channels worldwide",
        url: `${IPTV}/index.m3u`,
        note: "The full index — thousands of channels, every country. Large playlist, takes a few seconds to load.",
      },
      {
        id: "world-category",
        label: "Grouped by genre",
        url: `${IPTV}/index.category.m3u`,
        note: "Same channels, pre-grouped by genre instead of country.",
      },
    ],
  },
  {
    id: "genres",
    label: "By genre",
    blurb: "Smaller, faster playlists when you know what you want to watch.",
    entries: [
      { id: "cat-news", label: "News", url: `${IPTV}/categories/news.m3u`, note: "Rolling news from around the world." },
      { id: "cat-movies", label: "Movies", url: `${IPTV}/categories/movies.m3u`, note: "Free film channels, mostly ad-supported." },
      { id: "cat-series", label: "Series", url: `${IPTV}/categories/series.m3u`, note: "Channels that run TV series back to back." },
      { id: "cat-sports", label: "Sport", url: `${IPTV}/categories/sports.m3u`, note: "Free-to-air sport. Big leagues are usually NOT here — those are paid rights." },
      { id: "cat-documentary", label: "Documentary", url: `${IPTV}/categories/documentary.m3u`, note: "Factual and nature channels." },
      { id: "cat-entertainment", label: "Entertainment", url: `${IPTV}/categories/entertainment.m3u`, note: "General entertainment." },
      { id: "cat-kids", label: "Kids", url: `${IPTV}/categories/kids.m3u`, note: "Children's channels." },
      { id: "cat-music", label: "Music", url: `${IPTV}/categories/music.m3u`, note: "Music video and radio-style channels." },
      { id: "cat-comedy", label: "Comedy", url: `${IPTV}/categories/comedy.m3u`, note: "Comedy channels." },
      { id: "cat-cooking", label: "Food", url: `${IPTV}/categories/cooking.m3u`, note: "Cooking and food." },
      { id: "cat-travel", label: "Travel", url: `${IPTV}/categories/travel.m3u`, note: "Travel and places." },
      { id: "cat-religious", label: "Religious", url: `${IPTV}/categories/religious.m3u`, note: "Faith channels." },
    ],
  },
  {
    id: "countries",
    label: "By country",
    blurb: "A country's own free channels. Pick the ones you actually watch — they load fast.",
    entries: [
      { id: "c-uk", label: "United Kingdom", url: `${IPTV}/countries/uk.m3u`, note: "UK free-to-air." },
      { id: "c-us", label: "United States", url: `${IPTV}/countries/us.m3u`, note: "US free channels." },
      { id: "c-ca", label: "Canada", url: `${IPTV}/countries/ca.m3u`, note: "Canadian free channels." },
      { id: "c-in", label: "India", url: `${IPTV}/countries/in.m3u`, note: "Indian free channels." },
      { id: "c-pk", label: "Pakistan", url: `${IPTV}/countries/pk.m3u`, note: "Pakistani free channels." },
      { id: "c-bd", label: "Bangladesh", url: `${IPTV}/countries/bd.m3u`, note: "Bangladeshi free channels." },
      { id: "c-ae", label: "UAE", url: `${IPTV}/countries/ae.m3u`, note: "Emirati free channels." },
      { id: "c-sa", label: "Saudi Arabia", url: `${IPTV}/countries/sa.m3u`, note: "Saudi free channels." },
      { id: "c-tr", label: "Türkiye", url: `${IPTV}/countries/tr.m3u`, note: "Turkish free channels." },
      { id: "c-de", label: "Germany", url: `${IPTV}/countries/de.m3u`, note: "German free channels." },
      { id: "c-fr", label: "France", url: `${IPTV}/countries/fr.m3u`, note: "French free channels." },
      { id: "c-es", label: "Spain", url: `${IPTV}/countries/es.m3u`, note: "Spanish free channels." },
      { id: "c-it", label: "Italy", url: `${IPTV}/countries/it.m3u`, note: "Italian free channels." },
      { id: "c-nl", label: "Netherlands", url: `${IPTV}/countries/nl.m3u`, note: "Dutch free channels." },
      { id: "c-pl", label: "Poland", url: `${IPTV}/countries/pl.m3u`, note: "Polish free channels." },
      { id: "c-br", label: "Brazil", url: `${IPTV}/countries/br.m3u`, note: "Brazilian free channels." },
      { id: "c-mx", label: "Mexico", url: `${IPTV}/countries/mx.m3u`, note: "Mexican free channels." },
      { id: "c-ng", label: "Nigeria", url: `${IPTV}/countries/ng.m3u`, note: "Nigerian free channels." },
      { id: "c-za", label: "South Africa", url: `${IPTV}/countries/za.m3u`, note: "South African free channels." },
      { id: "c-eg", label: "Egypt", url: `${IPTV}/countries/eg.m3u`, note: "Egyptian free channels." },
      { id: "c-au", label: "Australia", url: `${IPTV}/countries/au.m3u`, note: "Australian free channels." },
      { id: "c-jp", label: "Japan", url: `${IPTV}/countries/jp.m3u`, note: "Japanese free channels." },
      { id: "c-kr", label: "South Korea", url: `${IPTV}/countries/kr.m3u`, note: "Korean free channels." },
      { id: "c-cn", label: "China", url: `${IPTV}/countries/cn.m3u`, note: "Chinese free channels." },
      { id: "c-id", label: "Indonesia", url: `${IPTV}/countries/id.m3u`, note: "Indonesian free channels." },
      { id: "c-ph", label: "Philippines", url: `${IPTV}/countries/ph.m3u`, note: "Philippine free channels." },
      { id: "c-ru", label: "Russia", url: `${IPTV}/countries/ru.m3u`, note: "Russian free channels." },
      { id: "c-pt", label: "Portugal", url: `${IPTV}/countries/pt.m3u`, note: "Portuguese free channels." },
      { id: "c-gr", label: "Greece", url: `${IPTV}/countries/gr.m3u`, note: "Greek free channels." },
      { id: "c-ro", label: "Romania", url: `${IPTV}/countries/ro.m3u`, note: "Romanian free channels." },
    ],
  },
  {
    id: "languages",
    label: "By language",
    blurb: "Everything in one language, wherever it's broadcast from.",
    entries: [
      { id: "l-eng", label: "English", url: `${IPTV}/languages/eng.m3u`, note: "English-language channels worldwide." },
      { id: "l-ara", label: "Arabic", url: `${IPTV}/languages/ara.m3u`, note: "Arabic-language channels." },
      { id: "l-hin", label: "Hindi", url: `${IPTV}/languages/hin.m3u`, note: "Hindi-language channels." },
      { id: "l-urd", label: "Urdu", url: `${IPTV}/languages/urd.m3u`, note: "Urdu-language channels." },
      { id: "l-ben", label: "Bengali", url: `${IPTV}/languages/ben.m3u`, note: "Bengali-language channels." },
      { id: "l-spa", label: "Spanish", url: `${IPTV}/languages/spa.m3u`, note: "Spanish-language channels." },
      { id: "l-fra", label: "French", url: `${IPTV}/languages/fra.m3u`, note: "French-language channels." },
      { id: "l-por", label: "Portuguese", url: `${IPTV}/languages/por.m3u`, note: "Portuguese-language channels." },
      { id: "l-tur", label: "Turkish", url: `${IPTV}/languages/tur.m3u`, note: "Turkish-language channels." },
      { id: "l-deu", label: "German", url: `${IPTV}/languages/deu.m3u`, note: "German-language channels." },
      { id: "l-rus", label: "Russian", url: `${IPTV}/languages/rus.m3u`, note: "Russian-language channels." },
      { id: "l-zho", label: "Chinese", url: `${IPTV}/languages/zho.m3u`, note: "Chinese-language channels." },
    ],
  },
];

export const CATALOG_ENTRIES: CatalogEntry[] = CATALOG.flatMap((g) => g.entries);

export function catalogEntry(id: string): CatalogEntry | undefined {
  return CATALOG_ENTRIES.find((e) => e.id === id);
}

/** The sources a brand-new install starts with: small, fast, broadly useful. */
export const STARTER_SOURCE_IDS = ["cat-news", "c-uk"];

/* ------------------------------------------------------------------ *
 * Display helpers
 * ------------------------------------------------------------------ */

/** "gb" → 🇬🇧. Computed from the code, so every country works without a table. */
export function flag(code?: string): string {
  if (!code || code.length !== 2 || !/^[a-z]{2}$/i.test(code)) return "";
  const base = 0x1f1e6;
  const up = code.toUpperCase();
  return String.fromCodePoint(base + up.charCodeAt(0) - 65, base + up.charCodeAt(1) - 65);
}

/** Title-case a playlist label like "english" or "news" for display. */
export function pretty(value: string): string {
  return value.replace(/(^|\s|-)([a-z])/g, (_, p, c) => p + c.toUpperCase());
}
