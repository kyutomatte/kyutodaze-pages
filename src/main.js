import "./styles.css";
import { initHeroWebgl } from "./hero-webgl.js";
import { createLocaleStore, getLocalizedValue, translate } from "./i18n.js";
import { getMediaPreviewUrl } from "./media-preview.js";
import { fromSitePath, toPublicAssetUrl, toSitePath } from "./site-url.js";

const localeStore = createLocaleStore();

const routes = new Set([
  "home",
  "kyutomatte",
  "cargo",
  "open-work",
  "open-works",
  "jeju-wave-radio-webapp",
  "splatify-webapp",
  "splatify-webapp-export",
  "feedback"
]);
const openWorkRouteAliases = {
  "touch-designer": "interactive-visuals"
};
let allWorks = [];
let galleriesByWorkId = new Map();
let activeGalleryItems = [];
let activeGalleryIndex = 0;
let activeSummaryArtist = "";
let currentCategoryFilter = "all";
let openWorksList = [];
let openWorkDetailRows = [];
let openWorksPageRows = [];
let openWorkLinkRows = [];
let openWorkExampleRows = [];
let openWorkManualRows = [];
let workMediaRows = [];
let openWorkDetailsBySlug = {};
let openWorkExternalLinksBySlug = {};
let openWorkExamplesBySlug = {};
let openWorkManualsBySlug = {};
let openWorksPage = { title: "Open Works", summary: "" };
const feedbackUiState = { submitting: false, statusKey: "" };
let beadCurtainHero = null;
let beadCurtainEnterTimer = 0;
let beadCurtainTouchArmed = false;
let beadCurtainEntering = false;
let homeDataLoaded = false;
let beadCursor = null;
let beadCursorClickTimer = 0;
const OVERVIEW_MEDIA_LIMIT = 3;
const BEAD_CURTAIN_HOME_DELAY_MS = 2950;
const BEAD_CURSOR_CLICK_MS = 720;
const SPLATIFY_WEBAPP_URL = "https://kyutomatte.github.io/splatify-pre-release/";
const JEJU_WAVE_RADIO_WEBAPP_PATH = "/apps/jeju-wave-radio/web/";
const DATA_CACHE_VERSION = "2026-07-17-works-order";
const FEEDBACK_RECIPIENT = "gray.ojat@gmail.com";
const FEEDBACK_ENDPOINT = (import.meta.env?.VITE_FEEDBACK_ENDPOINT ?? "").trim();

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function restoreSheetLeadingQuote(value) {
  const text = String(value ?? "");
  if (/^[‘’'“”]/.test(text)) return text;
  return /^[^']+'(?:\s|$)/.test(text) ? `'${text}` : text;
}

function parseCsv(text) {
  const rows = [];
  let cell = "";
  let row = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);

  const headers = rows.shift()?.map((header) => header.trim()) ?? [];
  return rows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]))
  );
}

async function fetchCsv(path) {
  const url = new URL(toPublicAssetUrl(path), window.location.origin);
  url.searchParams.set("v", DATA_CACHE_VERSION);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load ${path}`);
  return parseCsv(await response.text());
}

function getYouTubeEmbedUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtube.com" && url.pathname === "/watch") {
      const videoId = url.searchParams.get("v");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
    }

    if (host === "youtube.com" && url.pathname.startsWith("/shorts/")) {
      const videoId = url.pathname.split("/").filter(Boolean)[1];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
    }

    if (host === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
    }

    if (host === "youtube.com" && url.pathname.startsWith("/embed/")) {
      return value;
    }
  } catch {
    return "";
  }

  return "";
}

function getYouTubeVideoId(value) {
  const embedUrl = getYouTubeEmbedUrl(value);
  if (!embedUrl) return "";

  try {
    return new URL(embedUrl).pathname.split("/").filter(Boolean)[1] ?? "";
  } catch {
    return "";
  }
}

function extractEmbeddableUrl(value) {
  const source = value?.trim() ?? "";
  if (!source) return "";

  const iframeSource = source.match(/\bsrc=(["'])(.*?)\1/i)?.[2];
  return iframeSource || source;
}

function normalizeMediaUrl(value) {
  const source = value?.trim() ?? "";
  if (!source) return "";
  if (source.startsWith("/") && !source.startsWith("//")) return toPublicAssetUrl(source);

  try {
    const url = new URL(source);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "drive.google.com") {
      const fileId = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get("id");
      if (fileId) return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }
  } catch {
    return source;
  }

  return source;
}

function getSafeOpenWorkExternalUrl(value) {
  const source = value?.trim() ?? "";
  if (!source) return "";
  if (source.startsWith("#") || /^\/(?!\/)/.test(source)) return source;

  try {
    const url = new URL(source);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? source : "";
  } catch {
    return "";
  }
}

function getExternalLinkAttributes(url) {
  return /^(https?:|mailto:)/i.test(url) ? ' target="_blank" rel="noreferrer"' : "";
}

function groupGalleryMedia(items) {
  const grouped = new Map();

  for (const item of items) {
    const workId = item.work_id?.trim();
    const type = item.type?.trim().toLowerCase();
    const url = normalizeMediaUrl(item.url);

    if (!workId || !(type === "still" || type === "video") || !url) continue;

    const mediaItem = {
      workId,
      type,
      url,
      caption: getLocalizedValue(item, "caption", localeStore.getLocale()).trim(),
      sort: Number.parseFloat(item.sort) || 0
    };

    if (!grouped.has(workId)) grouped.set(workId, []);
    grouped.get(workId).push(mediaItem);
  }

  for (const mediaItems of grouped.values()) {
    mediaItems.sort((first, second) => first.sort - second.sort);
  }

  return grouped;
}

function getCategoryKey(category) {
  const value = category?.toLowerCase() ?? "";

  if (value.includes("music video") || value.includes("m/v") || value.includes("뮤직비디오")) return "mv";
  if (value.includes("album") || value.includes("앨범")) return "album";
  if (value.includes("graphic") || value.includes("그래픽")) return "graphic";
  if (value.includes("fashion") || value.includes("패션")) return "fashion";
  if (value.includes("ai") || value.includes("3d") || value.includes("commercial")) return "ai3d";

  return "graphic";
}

function getLocalizedCategory(work, locale) {
  const categoryKey = getCategoryKey(work.category_en || work.category);
  const localizedTaxonomy = translate(`taxonomy.${categoryKey}`, locale);
  return localizedTaxonomy === `taxonomy.${categoryKey}`
    ? getLocalizedValue(work, "category", locale).trim()
    : localizedTaxonomy;
}

function getArtistSummaryLabel(works) {
  const categoryKeys = works.map((work) => work.categoryKey ?? getCategoryKey(work.category));
  if (categoryKeys.some((key) => key === "mv" || key === "fashion")) return translate("taxonomy.visualCreative", localeStore.getLocale());

  const counts = new Map();
  for (const key of categoryKeys) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const [topCategory = "graphic"] = [...counts.entries()].sort(
    (first, second) => second[1] - first[1]
  )[0] ?? [];

  return translate(`taxonomy.${topCategory}`, localeStore.getLocale());
}

function getFilteredWorks(works) {
  if (currentCategoryFilter === "all") return works;
  return works.filter((work) => (work.categoryKey ?? getCategoryKey(work.category)) === currentCategoryFilter);
}

function isOverviewWork(work) {
  const value = work.overview?.toLowerCase();
  return value === "true" || value === "1";
}

function getArtistYearRange(works) {
  const years = works
    .flatMap((work) => [...String(work.year ?? "").matchAll(/\b\d{4}\b/g)].map(([year]) => Number(year)))
    .filter((year) => Number.isFinite(year));

  if (years.length > 0) {
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    return minYear === maxYear ? String(minYear) : `${minYear}-${maxYear}`;
  }

  return [...new Set(works.map((work) => work.year).filter(Boolean))].join(" / ");
}

function updateCategoryFilterButtons() {
  document.querySelectorAll("[data-category-filter]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.categoryFilter === currentCategoryFilter));
  });
}

function setCategoryFilter(filter) {
  currentCategoryFilter = currentCategoryFilter === filter ? "all" : filter;
  activeSummaryArtist = "";
  setWorkView("summary");
  updateCategoryFilterButtons();
}

function getOpenWorkSlug(pathname) {
  const slug = fromSitePath(pathname).replace(/^\/+/, "").replace(/\/+$/, "");
  if (!slug || routes.has(slug) || slug.includes("/") || slug.includes(".")) return "";
  return slug;
}

function getCanonicalOpenWorkSlug(slug) {
  return openWorkRouteAliases[slug] ?? slug;
}

function isAppRoutePath(pathname) {
  const localPath = fromSitePath(pathname);
  const route = localPath.replace(/^\/+/, "");
  return !route || routes.has(route) || Boolean(getOpenWorkSlug(localPath));
}

function getRoute(pathname) {
  const localPath = fromSitePath(pathname);
  const route = localPath.replace(/^\/+/, "");
  if (!route) return "bead-curtain";
  if (getOpenWorkSlug(localPath)) return "open-work";
  return routes.has(route) ? route : "home";
}

function ensureBeadCurtainHero() {
  if (beadCurtainHero) return;
  beadCurtainHero = initHeroWebgl(document.querySelector("[data-bead-curtain-webgl]"));
}

function updateBeadCursorPosition(event) {
  if (!beadCursor || getRoute(window.location.pathname) !== "bead-curtain") return;

  beadCursor.style.setProperty("--bead-cursor-x", `${event.clientX}px`);
  beadCursor.style.setProperty("--bead-cursor-y", `${event.clientY}px`);
  beadCursor.classList.add("has-position");
}

function sparkleBeadCursor(event) {
  if (!beadCursor || getRoute(window.location.pathname) !== "bead-curtain") return;
  if ("button" in event && event.button !== 0) return;

  updateBeadCursorPosition(event);
  window.clearTimeout(beadCursorClickTimer);
  beadCursor.classList.remove("is-clicking");
  void beadCursor.offsetWidth;
  beadCursor.classList.add("is-clicking");
  beadCursorClickTimer = window.setTimeout(() => {
    beadCursor?.classList.remove("is-clicking");
  }, BEAD_CURSOR_CLICK_MS);
}

function ensureBeadCursor() {
  if (beadCursor) return;

  beadCursor = document.querySelector("[data-bead-cursor]");
  if (!beadCursor) return;

  window.addEventListener(
    "pointermove",
    (event) => updateBeadCursorPosition(event),
    { passive: true }
  );

  window.addEventListener(
    "pointerdown",
    (event) => sparkleBeadCursor(event),
    { passive: true }
  );

}

function syncBeadCursor(route) {
  ensureBeadCursor();
  if (!beadCursor) return;
  const isBeadCurtain = route === "bead-curtain";
  beadCursor.classList.toggle("is-visible", isBeadCurtain);
  if (!isBeadCurtain) beadCursor.classList.remove("is-whiteout", "is-clicking");
}

function getSplatifyExportUrl() {
  return SPLATIFY_WEBAPP_URL;
}

function syncFrameSource(frame, source) {
  if (!frame) return;
  if (source) {
    if (frame.getAttribute("src") !== source) frame.src = source;
  } else if (frame.hasAttribute("src")) {
    frame.removeAttribute("src");
  }
}

function syncSplatifyWebappFrames(route) {
  const webappFrame = document.querySelector("[data-splatify-webapp-frame]");
  const exportFrame = document.querySelector("[data-splatify-export-frame]");
  const jejuWaveRadioFrame = document.querySelector("[data-jeju-wave-radio-frame]");

  syncFrameSource(webappFrame, route === "splatify-webapp" ? SPLATIFY_WEBAPP_URL : "");
  syncFrameSource(exportFrame, route === "splatify-webapp-export" ? getSplatifyExportUrl() : "");
  syncFrameSource(jejuWaveRadioFrame, route === "jeju-wave-radio-webapp" ? toPublicAssetUrl(JEJU_WAVE_RADIO_WEBAPP_PATH) : "");
}

function clearBeadCurtainEnterTimer() {
  if (!beadCurtainEnterTimer) return;
  window.clearTimeout(beadCurtainEnterTimer);
  beadCurtainEnterTimer = 0;
}

function isCoarsePointerInput(event) {
  return event?.pointerType === "touch" || window.matchMedia?.("(hover: none), (pointer: coarse)").matches === true;
}

function resetBeadCurtainInteraction() {
  beadCurtainTouchArmed = false;
  beadCurtainEntering = false;
  document.querySelector("[data-bead-curtain-webgl]")?.classList.remove("is-touch-armed", "is-entering");
}

function handleBeadCurtainPointerDown(event) {
  const canvas = event.target.closest("[data-bead-curtain-webgl]");
  if (!canvas || getRoute(window.location.pathname) !== "bead-curtain") return;

  if (beadCurtainEntering) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  if (!isCoarsePointerInput(event)) return;

  if (!beadCurtainTouchArmed) {
    beadCurtainTouchArmed = true;
    canvas.classList.add("is-touch-armed");
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  enterHomeAfterBeadCurtain(event);
}

function enterHomeAfterBeadCurtain(event) {
  if (getRoute(window.location.pathname) !== "bead-curtain" || beadCurtainEnterTimer || beadCurtainEntering) return;

  beadCurtainEntering = true;
  document.querySelector("[data-bead-curtain-webgl]")?.classList.add("is-entering");
  beadCurtainHero?.startTransition(event);
  ensureBeadCursor();
  sparkleBeadCursor(event);
  beadCursor?.classList.add("is-whiteout");

  beadCurtainEnterTimer = window.setTimeout(() => {
    beadCurtainEnterTimer = 0;
    navigate("/home");
  }, BEAD_CURTAIN_HOME_DELAY_MS);
}

function renderRoute(route) {
  if (route !== "bead-curtain") {
    clearBeadCurtainEnterTimer();
    resetBeadCurtainInteraction();
  }
  document.body.dataset.page = route;
  syncBeadCursor(route);
  syncSplatifyWebappFrames(route);
  document.querySelectorAll("[data-route]").forEach((page) => {
    page.hidden = page.dataset.route !== route;
  });

  if (route === "open-work") {
    const slug = getOpenWorkSlug(window.location.pathname) || "sleepless";
    renderOpenWorkPage(slug);
  } else if (route === "open-works") {
    renderOpenWorksIndex();
  } else if (route === "feedback") {
    renderFeedbackPage();
  } else if (route === "bead-curtain") {
    resetBeadCurtainInteraction();
    ensureBeadCurtainHero();
  }

  const titleKey = {
    "open-work": "document.openWorks",
    "open-works": "document.openWorks",
    feedback: "document.feedback",
    "bead-curtain": "document.site",
    kyutomatte: "document.archive",
    cargo: "document.cargo"
  }[route] ?? "document.home";
  document.title = translate(titleKey, localeStore.getLocale());
}

function smoothScrollToWorks() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getActiveWorkView() {
  return document.querySelector(".new-home-page")?.dataset.workView === "overview" ? "overview" : "summary";
}

function setWorkView(view) {
  const nextView = view === "overview" ? "overview" : "summary";
  const homePage = document.querySelector(".new-home-page");
  if (!homePage) return;

  homePage.dataset.workView = nextView;
  document.querySelectorAll("[data-view-toggle]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.viewToggle === nextView));
  });

  renderWorks();
}

function resetHomeView() {
  currentCategoryFilter = "all";
  activeSummaryArtist = "";
  setWorkView("summary");
  updateCategoryFilterButtons();
  smoothScrollToWorks();
}

function getMediaItemsForWork(work, mediaByWorkId) {
  const stills = (mediaByWorkId.get(work.id) ?? []).filter((item) => item.type === "still");
  if (stills.length > 0) return stills;

  const url = extractEmbeddableUrl(work.url);
  const imageItems = url
    .split(/\s+/)
    .map((url, index) => ({
      workId: work.id,
      type: "still",
      url: normalizeMediaUrl(url),
      caption: restoreSheetLeadingQuote(work.text),
      sort: index + 1
    }))
    .filter((item) => /\.(png|jpe?g|webp|gif)$/i.test(item.url));

  if (imageItems.length > 0) return imageItems;

  const youtubeVideoId = getYouTubeVideoId(url);
  if (youtubeVideoId) {
    return [
      {
        workId: work.id,
        type: "still",
        url: `https://i.ytimg.com/vi/${youtubeVideoId}/hqdefault.jpg`,
        caption: restoreSheetLeadingQuote(work.text),
        sort: 1
      }
    ];
  }

  return [];
}

function shuffleOverviewItems(items) {
  const shuffledItems = [...items];

  for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffledItems[index], shuffledItems[randomIndex]] = [shuffledItems[randomIndex], shuffledItems[index]];
  }

  return shuffledItems;
}

function getOverviewItemsForWork(work, mediaByWorkId) {
  return shuffleOverviewItems(
    getMediaItemsForWork(work, mediaByWorkId).filter((item) => item.type === "still")
  ).slice(0, OVERVIEW_MEDIA_LIMIT);
}

function getOverviewStillItems(works, mediaByWorkId) {
  const groups = shuffleOverviewItems(
    works
      .filter((work) => isOverviewWork(work))
      .map((work) => ({
        work,
        items: getOverviewItemsForWork(work, mediaByWorkId)
      }))
      .filter((group) => group.items.length > 0)
  );
  const stillItems = [];
  let previousWorkId = "";

  for (let index = 0; index < OVERVIEW_MEDIA_LIMIT; index += 1) {
    const roundGroups = shuffleOverviewItems(groups.filter((group) => group.items[index]));
    if (roundGroups.length > 1 && roundGroups[0].work.id === previousWorkId) {
      const swapIndex = roundGroups.findIndex((group) => group.work.id !== previousWorkId);
      [roundGroups[0], roundGroups[swapIndex]] = [roundGroups[swapIndex], roundGroups[0]];
    }

    for (const group of roundGroups) {
      stillItems.push({ work: group.work, item: group.items[index] });
      previousWorkId = group.work.id;
    }
  }

  return stillItems;
}

function getGalleryTriggerMedia(firstItem, alt) {
  const previewUrl = getMediaPreviewUrl(firstItem.url);
  return `<img src="${escapeHtml(previewUrl)}" alt="${alt}" loading="lazy" decoding="async" data-original-src="${escapeHtml(firstItem.url)}" />`;
}

function renderGalleryTrigger(work, mediaItems) {
  const firstItem = mediaItems[0];
  const title = escapeHtml(work.artist);
  const locale = localeStore.getLocale();
  const alt = escapeHtml(firstItem.caption || `${work.artist} ${translate("gallery.media", locale)}`);
  const caption = mediaItems.length > 1 ? `<span class="feed-gallery-count">${mediaItems.length}</span>` : "";

  return `
    <button class="feed-gallery-trigger" type="button" data-gallery-work-id="${escapeHtml(work.id)}" aria-label="${title} ${escapeHtml(translate("gallery.label", locale))}">
      ${getGalleryTriggerMedia(firstItem, alt)}
      ${caption}
    </button>
  `;
}

function renderMedia(work, mediaByWorkId) {
  const mediaItems = mediaByWorkId.get(work.id) ?? [];
  if (mediaItems.length > 0) return renderGalleryTrigger(work, mediaItems);

  const url = extractEmbeddableUrl(work.url);
  const title = escapeHtml(work.artist);
  const locale = localeStore.getLocale();

  if (!url) return "";

  const youtubeEmbedUrl = getYouTubeEmbedUrl(url);
  if (youtubeEmbedUrl) {
    return `<iframe src="${escapeHtml(youtubeEmbedUrl)}" title="${title}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
  }

  if (/\.(mp4|webm|mov)$/i.test(url)) {
    return `<video src="${escapeHtml(url)}" controls muted playsinline></video>`;
  }

  if (/\.(png|jpe?g|webp|gif)$/i.test(url)) {
    const previewUrl = getMediaPreviewUrl(url);
    return `<a class="feed-link-card" href="${escapeHtml(url)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(previewUrl)}" alt="${title} ${escapeHtml(translate("gallery.thumbnail", locale))}" loading="lazy" decoding="async" data-original-src="${escapeHtml(url)}" /></a>`;
  }

  return `<a class="feed-link-card feed-text-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(translate("media.openLink", locale))}</a>`;
}

function renderSummaryWorkRows(works, mediaByWorkId) {
  return `
    <ul class="summary-detail-list">
      ${works
        .map(
          (work) => `
            <li class="summary-detail-row">
              <span>${escapeHtml(work.category)}</span>
              <span>${escapeHtml(work.year)}</span>
              <p>${escapeHtml(restoreSheetLeadingQuote(work.text))}</p>
              <div class="summary-detail-media">${renderMedia(work, mediaByWorkId)}</div>
            </li>
          `
        )
        .join("")}
    </ul>
  `;
}

function setActiveSummaryArtist(artist) {
  activeSummaryArtist = activeSummaryArtist === artist ? "" : artist;
  renderWorks();
}

function renderSummaryGroups(works, mediaByWorkId = new Map()) {
  const groups = [];

  for (const work of works) {
    const summaryKey = work.summaryKey ?? work.artist;
    const group = groups.find((item) => item.key === summaryKey);
    if (group) {
      group.items.push(work);
    } else {
      groups.push({ key: summaryKey, artist: work.artist, items: [work] });
    }
  }

  return `
    <div class="summary-list" data-view-panel="summary">
      ${groups
        .map((group) => {
          const expanded = activeSummaryArtist === group.key;
          return `
            <section class="summary-work-group" data-summary-group="${escapeHtml(group.key)}" data-summary-expanded="${expanded}">
              <button class="summary-row" type="button" data-summary-artist="${escapeHtml(group.key)}" aria-expanded="${expanded}">
                <span class="summary-row-icon" aria-hidden="true">${expanded ? "−" : "+"}</span>
                <strong>${escapeHtml(group.artist)}</strong>
                <span class="summary-row-year">${escapeHtml(getArtistYearRange(group.items))}</span>
                <small class="summary-row-label">${escapeHtml(getArtistSummaryLabel(group.items))}</small>
              </button>
              <div class="summary-group-body">
                ${expanded ? renderSummaryWorkRows(group.items, mediaByWorkId) : ""}
              </div>
            </section>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderOverviewGrid(works, mediaByWorkId = new Map()) {
  const stillItems = getOverviewStillItems(works, mediaByWorkId);

  return `
    <div class="overview-stills-grid">
      ${stillItems
        .map(
          ({ work, item }) => `
            <button class="overview-still-button" type="button" data-gallery-work-id="${escapeHtml(work.id)}" aria-label="${escapeHtml(work.artist)} ${escapeHtml(translate("gallery.stills", localeStore.getLocale()))}">
              <img src="${escapeHtml(getMediaPreviewUrl(item.url))}" alt="${escapeHtml(item.caption || `${work.artist} ${translate("gallery.still", localeStore.getLocale())}`)}" loading="lazy" decoding="async" data-original-src="${escapeHtml(item.url)}" />
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

function renderWorks(works = allWorks, mediaByWorkId = galleriesByWorkId) {
  const list = document.querySelector("[data-works-list]");
  if (!list) return;

  const localizedWorks = works.map((work) => ({
    ...work,
    summaryKey: work.artist?.trim() || work.artist_en?.trim() || work.id,
    categoryKey: getCategoryKey(work.category_en || work.category),
    artist: getLocalizedValue(work, "artist", localeStore.getLocale()).trim(),
    category: getLocalizedCategory(work, localeStore.getLocale()),
    text: getLocalizedValue(work, "text", localeStore.getLocale()).trim()
  }));
  const summaryWorks = getFilteredWorks(localizedWorks);
  const activeView = getActiveWorkView();

  list.innerHTML =
    activeView === "overview"
      ? renderOverviewGrid(localizedWorks, mediaByWorkId)
      : renderSummaryGroups(summaryWorks, mediaByWorkId);
}

function renderOpenWorks(items) {
  const list = document.querySelector("[data-open-works-list]");
  if (!list) return;

  list.innerHTML = items
    .map(
      (item) => `
        <a class="open-work-link" href="${escapeHtml(item.slug)}">
          <span class="open-work-arrow" aria-hidden="true">→</span>
          <span class="open-work-title">${escapeHtml(getLocalizedValue(item, "title", localeStore.getLocale()))}</span>
          <small>${escapeHtml(getLocalizedValue(item, "summary", localeStore.getLocale()))}</small>
        </a>
      `
    )
    .join("");
}

function renderOpenWorksIndex() {
  if (!homeDataLoaded) return;

  const list = document.querySelector("[data-open-works-index-list]");
  setText("[data-open-works-page-title]", openWorksPage.title);
  setText("[data-open-works-page-summary]", openWorksPage.summary);

  if (!list) return;

  list.innerHTML = openWorksList
    .map((item) => {
      const slug = item.slug?.replace(/^\/+/, "") ?? "";
      const detail = openWorkDetailsBySlug[slug] ?? {};

      return `
        <a class="open-work-index-link" href="${escapeHtml(item.slug)}">
          <span class="open-work-arrow" aria-hidden="true">→</span>
          <strong>${escapeHtml(getLocalizedValue(item, "title", localeStore.getLocale()))}</strong>
          <p>${escapeHtml(getLocalizedValue(item, "summary", localeStore.getLocale()))}</p>
          <small>${escapeHtml(detail.kicker || "")}</small>
        </a>
      `;
    })
    .join("");
}

function getOpenWorkDetails(openWorks, detailRows) {
  const locale = localeStore.getLocale();
  const detailsBySlug = Object.fromEntries(
    openWorks
      .filter((item) => item.slug)
      .map((item) => [
        item.slug.replace(/^\/+/, ""),
        {
          title: getLocalizedValue(item, "title", locale).trim(),
          summary: getLocalizedValue(item, "summary", locale).trim(),
          slug: item.slug.replace(/^\/+/, "")
        }
      ])
  );

  for (const row of detailRows) {
    const slug = row.slug?.trim();
    if (!slug) continue;

    detailsBySlug[slug] = {
      ...(detailsBySlug[slug] ?? { slug }),
      kicker: getLocalizedValue(row, "kicker", locale).trim(),
      summary: getLocalizedValue(row, "detail_summary", locale).trim() || detailsBySlug[slug]?.summary || "",
      format: getLocalizedValue(row, "format", locale).trim(),
      status: getLocalizedValue(row, "status", locale).trim(),
      role: getLocalizedValue(row, "role", locale).trim(),
      lede: getLocalizedValue(row, "lede", locale).trim(),
      detail: getLocalizedValue(row, "detail", locale).trim(),
      features: getLocalizedValue(row, "features", locale)
        .split("|")
        .map((feature) => feature.trim())
        .filter(Boolean),
      actionLabel: getLocalizedValue(row, "action_label", locale).trim() || translate("feedback.label", locale),
      externalNote: getLocalizedValue(row, "external_note", locale).trim(),
      imageUrl: normalizeMediaUrl(row.image_url),
      imageAlt: getLocalizedValue(row, "image_alt", locale).trim() || detailsBySlug[slug]?.title || ""
    };
  }

  return detailsBySlug;
}

function getOpenWorkExternalLinks(rows) {
  const locale = localeStore.getLocale();
  return rows.reduce((linksBySlug, row) => {
    const slug = row.slug?.trim();
    const label = getLocalizedValue(row, "label", locale).trim();
    if (!slug || !label) return linksBySlug;

    const link = {
      label,
      url: row.url?.trim() ?? "",
      sort: Number.parseInt(row.sort, 10) || 0
    };

    linksBySlug[slug] = [...(linksBySlug[slug] ?? []), link].sort((a, b) => a.sort - b.sort);
    return linksBySlug;
  }, {});
}

function getOpenWorkExamples(rows) {
  const locale = localeStore.getLocale();
  return rows.reduce((examplesBySlug, row) => {
    const slug = row.slug?.trim();
    const mediaUrl = normalizeMediaUrl(row.media_url);
    if (!slug || !mediaUrl) return examplesBySlug;

    const example = {
      kicker: getLocalizedValue(row, "kicker", locale).trim() || translate("openWork.example", locale),
      title: getLocalizedValue(row, "title", locale).trim() || translate("openWork.example", locale),
      mediaUrl,
      mediaType: row.media_type?.trim().toLowerCase() || "video",
      caption: getLocalizedValue(row, "caption", locale).trim(),
      sort: Number.parseInt(row.sort, 10) || 0
    };

    examplesBySlug[slug] = [...(examplesBySlug[slug] ?? []), example].sort((a, b) => a.sort - b.sort);
    return examplesBySlug;
  }, {});
}

function getOpenWorkManuals(rows) {
  const locale = localeStore.getLocale();
  return rows.reduce((manualsBySlug, row) => {
    const slug = row.slug?.trim();
    const stepTitle = getLocalizedValue(row, "step_title", locale).trim();
    const body = getLocalizedValue(row, "body", locale).trim();
    if (!slug || !stepTitle || !body) return manualsBySlug;

    const step = {
      slug,
      sectionTitle: getLocalizedValue(row, "section_title", locale).trim() || translate("openWork.manual", locale),
      title: stepTitle,
      body,
      layout: row.step_title === "환경별 설치 방법"
        ? "jebi-table"
        : row.step_title === "호출 예시"
          ? "jebi-call-grid"
          : row.step_title === "처음 실행 허용하기"
            ? "macos-permission"
            : row.slug === "jebi-agent"
              ? "jebi-rich"
              : "plain",
      sort: Number.parseInt(row.sort, 10) || 0
    };

    manualsBySlug[slug] = [...(manualsBySlug[slug] ?? []), step].sort((a, b) => a.sort - b.sort);
    return manualsBySlug;
  }, {});
}

function renderManualTable(body) {
  const rows = body
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => row.split("|").map((cell) => cell.trim()));
  const [headers = [], ...items] = rows;

  return `
    <div class="open-work-manual-table-wrap">
      <table class="open-work-manual-table">
        <thead>
          <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${items
            .map((row) => `<tr>${headers.map((_, index) => `<td>${escapeHtml(row[index] ?? "")}</td>`).join("")}</tr>`)
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderManualRichBlocks(body) {
  return body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith("PROMPT:")) {
        return `<div class="open-work-manual-prompt">${escapeHtml(block.replace(/^PROMPT:\s*/, ""))}</div>`;
      }

      if (block.startsWith("CMD:")) {
        return `<pre class="open-work-manual-code"><code>${escapeHtml(block.replace(/^CMD:\s*/, ""))}</code></pre>`;
      }

      return `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`;
    })
    .join("");
}

function renderManualCallGrid(body) {
  const rows = body
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => row.split("|").map((cell) => cell.trim()));
  const [, ...items] = rows;

  return `
    <div class="open-work-manual-call-grid">
      ${items
        .map(([type = "", example = "", description = ""]) => `
          <article class="open-work-manual-call-card">
            <span>${escapeHtml(type)}</span>
            <strong>${escapeHtml(example)}</strong>
            <p>${escapeHtml(description)}</p>
          </article>
        `)
        .join("")}
    </div>
  `;
}

function renderJebiManualBody(step) {
  if (step.layout === "jebi-table") {
    return renderManualTable(step.body);
  }

  if (step.layout === "jebi-call-grid") {
    return renderManualCallGrid(step.body);
  }

  return `<div class="open-work-manual-rich">${renderManualRichBlocks(step.body)}</div>`;
}

function renderManualStepBody(step) {
  if (step.layout.startsWith("jebi-")) {
    return renderJebiManualBody(step);
  }

  if (step.layout !== "macos-permission") {
    return `<p>${escapeHtml(step.body)}</p>`;
  }

  const permissionMarker = step.body.search(/(?:먼저 Done|Select Done)/);
  const lead = permissionMarker >= 0 ? step.body.slice(0, permissionMarker).trim() : "";
  const locale = localeStore.getLocale();

  return `
    <div class="open-work-manual-note">
      ${lead ? `<p>${escapeHtml(lead)}</p>` : ""}
      <ol class="open-work-manual-path" aria-label="${escapeHtml(translate("openWork.macosPermissionPath", locale))}">
        <li>${escapeHtml(translate("openWork.macosPermissionStep1", locale))}</li>
        <li>${escapeHtml(translate("openWork.macosPermissionStep2", locale))}</li>
        <li>${escapeHtml(translate("openWork.macosPermissionStep3", locale))}</li>
      </ol>
      <p class="open-work-manual-smallprint">${escapeHtml(translate("openWork.macosPermissionNote", locale))}</p>
    </div>
  `;
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function renderOpenWorkPage(slug) {
  const locale = localeStore.getLocale();
  slug = getCanonicalOpenWorkSlug(slug);
  const work = openWorkDetailsBySlug[slug];
  const page = document.querySelector("[data-open-work-page]");
  const action = document.querySelector("[data-open-work-action]");
  const features = document.querySelector("[data-open-work-features]");
  const media = document.querySelector("[data-open-work-media]");
  const image = document.querySelector("[data-open-work-image]");
  const related = document.querySelector("[data-open-work-related]");
  const externalActions = document.querySelector("[data-open-work-external-actions]");
  const externalLinks = document.querySelector("[data-open-work-external-links]");
  const externalNote = document.querySelector("[data-open-work-external-note]");
  const example = document.querySelector("[data-open-work-example]");
  const exampleKicker = document.querySelector("[data-open-work-example-kicker]");
  const exampleTitle = document.querySelector("[data-open-work-example-title]");
  const exampleMedia = document.querySelector("[data-open-work-example-media]");
  const manual = document.querySelector("[data-open-work-manual]");
  const manualTitle = document.querySelector("[data-open-work-manual-title]");
  const manualSteps = document.querySelector("[data-open-work-manual-steps]");

  if (!work && Object.keys(openWorkDetailsBySlug).length === 0) {
    setText("[data-open-work-title]", translate("navigation.openWorks", locale));
    setText("[data-open-work-summary]", translate("openWork.loading", locale));
    return;
  }

  if (!work) {
    setText("[data-open-work-kicker]", translate("navigation.openWorks", locale));
    setText("[data-open-work-title]", translate("openWork.notFound", locale));
    setText("[data-open-work-summary]", translate("openWork.notFound", locale));
    setText("[data-open-work-format]", "");
    setText("[data-open-work-status]", "");
    setText("[data-open-work-role]", "");
    setText("[data-open-work-lede]", "");
    setText("[data-open-work-detail]", "");
    if (action) {
      action.textContent = translate("openWork.backToList", locale);
      action.href = toSitePath("/open-works");
    }
    if (page) page.classList.remove("has-open-work-media");
    if (features) features.innerHTML = "";
    if (externalActions) externalActions.hidden = true;
    if (externalLinks) externalLinks.innerHTML = "";
    if (externalNote) {
      externalNote.hidden = true;
      externalNote.replaceChildren();
    }
    if (example && exampleMedia) {
      example.hidden = true;
      exampleMedia.innerHTML = "";
    }
    if (manual && manualSteps) {
      manual.hidden = true;
      manualSteps.innerHTML = "";
    }
    if (media && image) {
      media.hidden = true;
      image.removeAttribute("src");
      image.alt = "";
    }
    if (related) related.innerHTML = "";
    return;
  }

  setText("[data-open-work-kicker]", work.kicker);
  setText("[data-open-work-title]", work.title);
  setText("[data-open-work-summary]", work.summary);
  setText("[data-open-work-format]", work.format);
  setText("[data-open-work-status]", work.status);
  setText("[data-open-work-role]", work.role);
  setText("[data-open-work-lede]", work.lede);
  setText("[data-open-work-detail]", work.detail);

  if (action) {
    action.textContent = `${work.title} ${work.actionLabel}`;
    action.href = `${toSitePath("/feedback")}?work=${encodeURIComponent(work.slug)}`;
  }

  if (page) page.classList.toggle("has-open-work-media", Boolean(work.imageUrl));

  if (externalActions && externalLinks && externalNote) {
    const links = openWorkExternalLinksBySlug[work.slug] ?? [];
    externalActions.hidden = links.length === 0;
    externalLinks.hidden = links.length === 0;
    externalLinks.innerHTML = links
      .map((link) => {
        const safeUrl = getSafeOpenWorkExternalUrl(link.url);
        if (!safeUrl) {
          return `<span class="open-work-external-link is-disabled" aria-disabled="true">${escapeHtml(link.label)}</span>`;
        }

        const downloadAttribute = safeUrl.startsWith("/assets/downloads/") ? " download" : "";
        const href = safeUrl.startsWith("/") ? toSitePath(safeUrl) : safeUrl;
        return `<a class="open-work-external-link" href="${escapeHtml(href)}"${downloadAttribute}${getExternalLinkAttributes(href)}>${escapeHtml(link.label)}</a>`;
      })
      .join("");
    externalNote.hidden = true;
    externalNote.replaceChildren();
  }

  if (media && image) {
    media.hidden = !work.imageUrl;
    if (work.imageUrl) {
      image.src = work.imageUrl;
      image.alt = work.imageAlt;
    } else {
      image.removeAttribute("src");
      image.alt = "";
    }
  }

  if (features) {
    features.innerHTML = (work.features ?? [])
      .map(
        (feature, index) => `
          <article class="open-work-feature">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <p>${escapeHtml(feature)}</p>
          </article>
        `
      )
      .join("");
  }

  if (example && exampleKicker && exampleTitle && exampleMedia) {
    const examples = openWorkExamplesBySlug[work.slug] ?? [];
    example.hidden = examples.length === 0;
    const firstExample = examples[0];
    exampleKicker.textContent = firstExample?.kicker || translate("openWork.example", locale);
    exampleTitle.textContent = firstExample?.title || translate("openWork.example", locale);
    exampleMedia.innerHTML = examples
      .map((item) => {
        if (item.mediaType === "image") {
          return `<figure><img src="${escapeHtml(item.mediaUrl)}" alt="${escapeHtml(item.caption || item.title)}" />${item.caption ? `<figcaption>${escapeHtml(item.caption)}</figcaption>` : ""}</figure>`;
        }

        return `<figure><video src="${escapeHtml(item.mediaUrl)}" controls muted playsinline preload="metadata"></video>${item.caption ? `<figcaption>${escapeHtml(item.caption)}</figcaption>` : ""}</figure>`;
      })
      .join("");
  }

  if (manual && manualTitle && manualSteps) {
    const steps = openWorkManualsBySlug[work.slug] ?? [];
    manual.hidden = steps.length === 0;
    manualTitle.textContent = steps[0]?.sectionTitle || translate("openWork.manual", locale);
    manualSteps.innerHTML = steps
      .map(
        (step, index) => `
          <article class="open-work-manual-step">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <h3>${escapeHtml(step.title)}</h3>
            ${renderManualStepBody(step)}
          </article>
        `
      )
      .join("");
  }

  if (related) {
    related.innerHTML = Object.entries(openWorkDetailsBySlug)
      .filter(([relatedSlug]) => relatedSlug !== slug)
      .map(
        ([relatedSlug, relatedWork]) => `
              <a class="open-work-related-link" href="${toSitePath(`/${escapeHtml(relatedSlug)}`)}">
            <span aria-hidden="true">→</span>
            <strong>${escapeHtml(relatedWork.title)}</strong>
            <small>${escapeHtml(relatedWork.kicker)}</small>
          </a>
        `
      )
      .join("");
  }
}

function renderFeedbackPage() {
  const locale = localeStore.getLocale();
  const select = document.querySelector("[data-feedback-work-select]");
  const intro = document.querySelector("[data-feedback-intro]");
  const selectedSlug = select?.value || new URLSearchParams(window.location.search).get("work") || "";

  if (select) {
    select.innerHTML = openWorksList
      .map((item) => {
        const slug = item.slug?.replace(/^\/+/, "") ?? "";
        const selected = slug === selectedSlug ? " selected" : "";
        return `<option value="${escapeHtml(slug)}"${selected}>${escapeHtml(getLocalizedValue(item, "title", locale))}</option>`;
      })
      .join("");
    if (selectedSlug) select.value = selectedSlug;
  }

  const selectedWork = openWorkDetailsBySlug[selectedSlug];
  if (intro) {
    intro.textContent = `${selectedWork ? `${selectedWork.title} — ` : ""}${translate("feedback.intro", locale)}`;
  }

  renderFeedbackState(document.querySelector("[data-feedback-form]"));
}

function getFeedbackPayload(form) {
  const formData = new FormData(form);
  const slug = String(formData.get("work") ?? "");
  const work = openWorkDetailsBySlug[slug];
  const title = work?.title || slug || translate("feedback.mailtoFallbackWorkTitle", localeStore.getLocale());
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  return { slug, title, email, message };
}

function openFeedbackMailto(payload) {
  const locale = localeStore.getLocale();
  const title = payload.title || translate("feedback.mailtoFallbackWorkTitle", locale);
  const body = [
    `${translate("feedback.mailtoWorkLabel", locale)}: ${title}`,
    payload.email ? `${translate("feedback.mailtoEmailLabel", locale)}: ${payload.email}` : "",
    "",
    payload.message
  ]
    .filter(Boolean)
    .join("\n");

  window.location.href = `mailto:${FEEDBACK_RECIPIENT}?subject=${encodeURIComponent(`${title} ${translate("feedback.mailtoSubjectSuffix", locale)}`)}&body=${encodeURIComponent(body)}`;
}

async function sendFeedbackToEndpoint(payload) {
  if (!FEEDBACK_ENDPOINT) return false;

  const response = await fetch(FEEDBACK_ENDPOINT, {
    method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error(`Feedback endpoint returned ${response.status}`);
  return true;
}

function renderFeedbackState(form) {
  if (!form) return;

  const locale = localeStore.getLocale();
  const status = form.querySelector("[data-feedback-status]");
  const submit = form.querySelector(".feedback-submit");
  if (status) status.textContent = feedbackUiState.statusKey ? translate(feedbackUiState.statusKey, locale) : "";
  if (submit) {
    submit.disabled = feedbackUiState.submitting;
    submit.textContent = translate(feedbackUiState.submitting ? "feedback.submitting" : "feedback.submit", locale);
  }
}

function setFeedbackStatus(form, statusKey) {
  feedbackUiState.statusKey = statusKey;
  renderFeedbackState(form);
}

function setFeedbackSubmitting(form, submitting) {
  feedbackUiState.submitting = submitting;
  renderFeedbackState(form);
}

async function handleFeedbackSubmit(form) {
  const payload = getFeedbackPayload(form);

  if (!FEEDBACK_ENDPOINT) {
    openFeedbackMailto(payload);
    return;
  }

  setFeedbackSubmitting(form, true);
  setFeedbackStatus(form, "feedback.sending");

  try {
    await sendFeedbackToEndpoint(payload);
    form.reset();
    setFeedbackStatus(form, "feedback.sent");
  } catch {
    setFeedbackStatus(form, "feedback.failed");
    openFeedbackMailto(payload);
  } finally {
    setFeedbackSubmitting(form, false);
  }
}

async function loadHomeData() {
  const [works, openWorks, openWorkDetails, pageRows, openWorkLinks, openWorkExamples, openWorkManuals, workMedia] = await Promise.all([
    fetchCsv("/data/works.csv"),
    fetchCsv("/data/open-works.csv"),
    fetchCsv("/data/open-work-details.csv"),
    fetchCsv("/data/open-works-page.csv"),
    fetchCsv("/data/open-work-links.csv"),
    fetchCsv("/data/open-work-examples.csv"),
    fetchCsv("/data/open-work-manuals.csv"),
    fetchCsv("/data/work-media.csv")
  ]);

  allWorks = works;
  openWorksList = openWorks;
  openWorkDetailRows = openWorkDetails;
  openWorksPageRows = pageRows;
  openWorkLinkRows = openWorkLinks;
  openWorkExampleRows = openWorkExamples;
  openWorkManualRows = openWorkManuals;
  workMediaRows = workMedia;
}

function refreshLocalizedData() {
  const locale = localeStore.getLocale();
  const pageRow = openWorksPageRows[0] ?? {};
  openWorksPage = {
    title: getLocalizedValue(pageRow, "title", locale).trim() || translate("navigation.openWorks", locale),
    summary: getLocalizedValue(pageRow, "summary", locale).trim()
  };
  openWorkDetailsBySlug = getOpenWorkDetails(openWorksList, openWorkDetailRows);
  openWorkExternalLinksBySlug = getOpenWorkExternalLinks(openWorkLinkRows);
  openWorkExamplesBySlug = getOpenWorkExamples(openWorkExampleRows);
  openWorkManualsBySlug = getOpenWorkManuals(openWorkManualRows);
  galleriesByWorkId = groupGalleryMedia(workMediaRows);
}

function applyLocaleStatic(locale) {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    if (element.matches(".feedback-submit")) return;
    element.textContent = translate(element.dataset.i18n, locale);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = translate(element.dataset.i18nPlaceholder, locale);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", translate(element.dataset.i18nAriaLabel, locale));
  });
  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    element.setAttribute("title", translate(element.dataset.i18nTitle, locale));
  });
  document.querySelectorAll("[data-language-option]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.languageOption === locale));
  });
}

function applyLocale(locale) {
  applyLocaleStatic(locale);
  renderFeedbackState(document.querySelector("[data-feedback-form]"));

  if (homeDataLoaded) {
    refreshLocalizedData();
    refreshActiveGalleryLocale();
    renderWorks();
    renderOpenWorks(openWorksList);
  }

  renderRoute(getRoute(window.location.pathname));
}

function refreshActiveGalleryLocale() {
  const activeWorkId = activeGalleryItems[0]?.workId;
  if (!activeWorkId) return;

  const localizedItems = galleriesByWorkId.get(activeWorkId) ?? [];
  if (localizedItems.length === 0) return;

  activeGalleryItems = localizedItems;
  activeGalleryIndex = Math.min(activeGalleryIndex, activeGalleryItems.length - 1);
  updateGallery();
}

function updateGallery() {
  const lightbox = document.querySelector("[data-gallery-lightbox]");
  const image = document.querySelector("[data-gallery-image]");
  const video = document.querySelector("[data-gallery-video]");
  const caption = document.querySelector("[data-gallery-caption]");
  const count = document.querySelector("[data-gallery-count]");
  const prev = document.querySelector("[data-gallery-prev]");
  const next = document.querySelector("[data-gallery-next]");
  const item = activeGalleryItems[activeGalleryIndex];

  if (!lightbox || !image || !video || !caption || !count || !item) return;

  if (item.type === "video") {
    image.hidden = true;
    image.removeAttribute("src");
    video.hidden = false;
    video.src = item.url;
  } else {
    video.pause();
    video.hidden = true;
    video.removeAttribute("src");
    image.hidden = false;
    image.src = item.url;
    image.alt = item.caption || translate("gallery.workStill", localeStore.getLocale());
  }

  caption.textContent = item.caption;
  count.textContent = `${activeGalleryIndex + 1} / ${activeGalleryItems.length}`;

  if (prev) prev.disabled = activeGalleryItems.length < 2;
  if (next) next.disabled = activeGalleryItems.length < 2;
}

function openGallery(workId) {
  const items = galleriesByWorkId.get(workId) ?? [];
  const lightbox = document.querySelector("[data-gallery-lightbox]");
  if (!items.length || !lightbox) return;

  activeGalleryItems = items;
  activeGalleryIndex = 0;
  updateGallery();
  lightbox.hidden = false;
  document.body.classList.add("gallery-open");
  requestAnimationFrame(() => lightbox.classList.add("is-open"));
}

function closeGallery() {
  const lightbox = document.querySelector("[data-gallery-lightbox]");
  const video = document.querySelector("[data-gallery-video]");
  if (!lightbox) return;

  video?.pause();
  lightbox.classList.remove("is-open");
  document.body.classList.remove("gallery-open");

  window.setTimeout(() => {
    if (!lightbox.classList.contains("is-open")) lightbox.hidden = true;
  }, 180);
}

function moveGallery(step) {
  if (activeGalleryItems.length < 2) return;

  activeGalleryIndex =
    (activeGalleryIndex + step + activeGalleryItems.length) % activeGalleryItems.length;
  updateGallery();
}

function navigate(pathname, search = "", hash = "") {
  const localPath = fromSitePath(pathname);
  const route = getRoute(localPath);
  const nextPath = route === "bead-curtain" ? "/" : route === "open-work" ? localPath : `/${route}`;
  window.history.pushState({}, "", `${toSitePath(nextPath)}${search}${hash}`);
  renderRoute(route);
}

localeStore.subscribe(applyLocale);
applyLocaleStatic(localeStore.getLocale());
renderRoute(getRoute(window.location.pathname));

document.addEventListener(
  "error",
  (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;

    const originalSrc = image.dataset.originalSrc;
    if (!originalSrc || image.src.endsWith(originalSrc)) return;

    image.removeAttribute("data-original-src");
    image.src = originalSrc;
  },
  true
);

document.addEventListener("pointerdown", handleBeadCurtainPointerDown, true);

document.addEventListener("click", (event) => {
  const languageButton = event.target.closest("[data-language-option]");
  if (languageButton) {
    event.preventDefault();
    localeStore.setLocale(languageButton.dataset.languageOption);
    return;
  }

  if (event.target.closest("[data-bead-curtain-webgl]")) {
    event.preventDefault();
    if (isCoarsePointerInput()) return;
    enterHomeAfterBeadCurtain(event);
    return;
  }

  const galleryTrigger = event.target.closest("[data-gallery-work-id]");
  if (galleryTrigger) {
    event.preventDefault();
    openGallery(galleryTrigger.dataset.galleryWorkId);
    return;
  }

  if (event.target.closest("[data-gallery-close]")) {
    event.preventDefault();
    closeGallery();
    return;
  }

  if (event.target.closest("[data-gallery-prev]")) {
    event.preventDefault();
    moveGallery(-1);
    return;
  }

  if (event.target.closest("[data-gallery-next]")) {
    event.preventDefault();
    moveGallery(1);
    return;
  }

  if (event.target.matches("[data-gallery-lightbox]")) {
    closeGallery();
    return;
  }

  const summaryButton = event.target.closest("[data-summary-artist]");
  if (summaryButton) {
    event.preventDefault();
    setActiveSummaryArtist(summaryButton.dataset.summaryArtist);
    return;
  }

  if (event.target.closest("[data-home-reset]")) {
    event.preventDefault();
    resetHomeView();
    return;
  }

  const link = event.target.closest('a[href^="/"]');
  if (!link) return;

  const url = new URL(link.href);
  if (url.origin !== window.location.origin || !isAppRoutePath(url.pathname)) return;

  const route = getRoute(url.pathname);

  event.preventDefault();
  navigate(url.pathname, url.search, url.hash);
});

document.addEventListener("submit", (event) => {
  const feedbackForm = event.target.closest("[data-feedback-form]");
  if (!feedbackForm) return;

  event.preventDefault();
  void handleFeedbackSubmit(feedbackForm);
});

document.addEventListener("keydown", (event) => {
  if (document.querySelector("[data-gallery-lightbox]")?.hidden) return;

  if (event.key === "Escape") closeGallery();
  if (event.key === "ArrowLeft") moveGallery(-1);
  if (event.key === "ArrowRight") moveGallery(1);
});

document.querySelectorAll("[data-view-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    setWorkView(button.dataset.viewToggle);
  });
});

document.querySelectorAll("[data-category-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    setCategoryFilter(button.dataset.categoryFilter);
  });
});

document.querySelectorAll("[data-scroll-top]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

window.addEventListener("popstate", () => {
  renderRoute(getRoute(window.location.pathname));
});

loadHomeData()
  .then(() => {
    homeDataLoaded = true;
    applyLocale(localeStore.getLocale());
  })
  .catch((error) => {
    console.error(error);
  });
