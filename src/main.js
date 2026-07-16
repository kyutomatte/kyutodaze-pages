import "./styles.css";
import { initHeroWebgl } from "./hero-webgl.js";
import { getMediaPreviewUrl } from "./media-preview.js";
import { fromSitePath, toPublicAssetUrl, toSitePath } from "./site-url.js";

const routes = new Set([
  "home",
  "kyutomatte",
  "cargo",
  "open-work",
  "open-works",
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
let openWorkDetailsBySlug = {};
let openWorkExternalLinksBySlug = {};
let openWorkExamplesBySlug = {};
let openWorkManualsBySlug = {};
let openWorksPage = { title: "Open Works", summary: "다양한 작업들의 아카이빙 및 실험실 공간입니다." };
let beadCurtainHero = null;
let beadCurtainEnterTimer = 0;
let beadCursor = null;
let beadCursorClickTimer = 0;
const OVERVIEW_MEDIA_LIMIT = 3;
const BEAD_CURTAIN_HOME_DELAY_MS = 2950;
const BEAD_CURSOR_CLICK_MS = 720;
const SPLATIFY_WEBAPP_URL = "https://kyutomatte.github.io/splatify/";
const DATA_CACHE_VERSION = "2026-07-16-jebi-github-link";
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
  if (text.startsWith("'")) return text;
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
      caption: item.caption?.trim() ?? "",
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

  if (value.includes("music video") || value.includes("m/v")) return "mv";
  if (value.includes("album")) return "album";
  if (value.includes("graphic")) return "graphic";
  if (value.includes("fashion")) return "fashion";
  if (value.includes("ai") || value.includes("3d") || value.includes("commercial")) return "ai3d";

  return "graphic";
}

const categoryLabelByKey = {
  album: "Album",
  graphic: "Graphic",
  ai3d: "AI/3D"
};

function getArtistSummaryLabel(works) {
  const categoryKeys = works.map((work) => getCategoryKey(work.category));
  if (categoryKeys.some((key) => key === "mv" || key === "fashion")) return "Visual Creative";

  const counts = new Map();
  for (const key of categoryKeys) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const [topCategory = "graphic"] = [...counts.entries()].sort(
    (first, second) => second[1] - first[1]
  )[0] ?? [];

  return categoryLabelByKey[topCategory] ?? "Graphic";
}

function getFilteredWorks(works) {
  if (currentCategoryFilter === "all") return works;
  return works.filter((work) => getCategoryKey(work.category) === currentCategoryFilter);
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
  setWorkView("summary", { scroll: false });
  updateCategoryFilterButtons();

  renderWorks();
  smoothScrollToWorks();
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
  if ("pointerType" in event && event.pointerType === "touch") return;

  beadCursor.style.setProperty("--bead-cursor-x", `${event.clientX}px`);
  beadCursor.style.setProperty("--bead-cursor-y", `${event.clientY}px`);
  beadCursor.classList.add("has-position");
}

function sparkleBeadCursor(event) {
  if (!beadCursor || getRoute(window.location.pathname) !== "bead-curtain") return;
  if ("pointerType" in event && event.pointerType === "touch") return;
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

  window.addEventListener(
    "mousedown",
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
  const jobId = new URLSearchParams(window.location.search).get("jobId")?.trim();
  return jobId ? `${SPLATIFY_WEBAPP_URL}export/${encodeURIComponent(jobId)}` : SPLATIFY_WEBAPP_URL;
}

function syncSplatifyWebappFrames(route) {
  const webappFrame = document.querySelector("[data-splatify-webapp-frame]");
  const exportFrame = document.querySelector("[data-splatify-export-frame]");

  if (webappFrame) {
    if (route === "splatify-webapp") {
      webappFrame.src = SPLATIFY_WEBAPP_URL;
    } else {
      webappFrame.removeAttribute("src");
    }
  }

  if (exportFrame) {
    if (route === "splatify-webapp-export") {
      exportFrame.src = getSplatifyExportUrl();
    } else {
      exportFrame.removeAttribute("src");
    }
  }
}

function clearBeadCurtainEnterTimer() {
  if (!beadCurtainEnterTimer) return;
  window.clearTimeout(beadCurtainEnterTimer);
  beadCurtainEnterTimer = 0;
}

function enterHomeAfterBeadCurtain() {
  if (getRoute(window.location.pathname) !== "bead-curtain" || beadCurtainEnterTimer) return;

  ensureBeadCursor();
  beadCursor?.classList.add("is-whiteout");

  beadCurtainEnterTimer = window.setTimeout(() => {
    beadCurtainEnterTimer = 0;
    navigate("/home");
  }, BEAD_CURTAIN_HOME_DELAY_MS);
}

function renderRoute(route) {
  if (route !== "bead-curtain") clearBeadCurtainEnterTimer();
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
    ensureBeadCurtainHero();
  }

  if (route === "open-work") {
    document.title = "Open Works — KYUTO.MATTE";
  } else if (route === "open-works") {
    document.title = "Open Works — KYUTO.MATTE";
  } else if (route === "feedback") {
    document.title = "Feedback — KYUTO.MATTE";
  } else if (route === "bead-curtain") {
    document.title = "KYUTO.MATTE";
  } else if (route === "kyutomatte") {
    document.title = "Work Archive — KYUTO.MATTE";
  } else if (route === "cargo") {
    document.title = "Cargo Legacy — KYUTO.MATTE";
  } else {
    document.title = "KYUTO.MATTE — Visual Creative";
  }
}

function smoothScrollToWorks() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getActiveWorkView() {
  return document.querySelector(".new-home-page")?.dataset.workView === "overview" ? "overview" : "summary";
}

function setWorkView(view, options = {}) {
  const nextView = view === "overview" ? "overview" : "summary";
  const { scroll = true } = options;
  const homePage = document.querySelector(".new-home-page");
  if (!homePage) return;

  homePage.dataset.workView = nextView;
  document.querySelectorAll("[data-view-toggle]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.viewToggle === nextView));
  });

  renderWorks();
  if (scroll) smoothScrollToWorks();
}

function resetHomeView() {
  currentCategoryFilter = "all";
  activeSummaryArtist = "";
  setWorkView("summary", { scroll: false });
  updateCategoryFilterButtons();
  renderWorks();
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
  const alt = escapeHtml(firstItem.caption || `${work.artist} media`);
  const caption = mediaItems.length > 1 ? `<span class="feed-gallery-count">${mediaItems.length}</span>` : "";

  return `
    <button class="feed-gallery-trigger" type="button" data-gallery-work-id="${escapeHtml(work.id)}" aria-label="${title} gallery">
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
    return `<a class="feed-link-card" href="${escapeHtml(url)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(previewUrl)}" alt="${title} thumbnail" loading="lazy" decoding="async" data-original-src="${escapeHtml(url)}" /></a>`;
  }

  return `<a class="feed-link-card feed-text-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Open link</a>`;
}

function renderWorkEntry(work, index = 0, mediaByWorkId = new Map()) {
  const overview = isOverviewWork(work);
  const groupContinuation = index > 0;
  const workText = restoreSheetLeadingQuote(work.text);

  return `
    <article class="feed-entry"${overview ? ' data-overview-featured="true"' : ""}${groupContinuation ? ' data-group-continuation="true"' : ""}>
      <header class="feed-entry-header">
        <h2>${escapeHtml(work.artist)}</h2>
        <p>${escapeHtml(work.category)}</p>
        <p>${escapeHtml(work.year)}</p>
      </header>
      <div class="feed-media">${renderMedia(work, mediaByWorkId)}</div>
      <p class="feed-copy">${escapeHtml(workText)}</p>
    </article>
  `;
}

function renderWorkGroups(works, mediaByWorkId = new Map()) {
  const groups = [];

  for (const work of works) {
    const currentGroup = groups[groups.length - 1];
    if (currentGroup?.artist === work.artist) {
      currentGroup.items.push(work);
    } else {
      groups.push({ artist: work.artist, items: [work] });
    }
  }

  return groups
    .map((group) => {
      const overview = group.items.some((work) => isOverviewWork(work));

      return `
        <section class="feed-work-group"${overview ? ' data-overview-featured="true"' : ""}>
          ${group.items.map((work, index) => renderWorkEntry(work, index, mediaByWorkId)).join("")}
        </section>
      `;
    })
    .join("");
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
    const group = groups.find((item) => item.artist === work.artist);
    if (group) {
      group.items.push(work);
    } else {
      groups.push({ artist: work.artist, items: [work] });
    }
  }

  return `
    <div class="summary-list" data-view-panel="summary">
      ${groups
        .map((group) => {
          const expanded = activeSummaryArtist === group.artist;
          return `
            <section class="summary-work-group" data-summary-group="${escapeHtml(group.artist)}" data-summary-expanded="${expanded}">
              <button class="summary-row" type="button" data-summary-artist="${escapeHtml(group.artist)}" aria-expanded="${expanded}">
                <span class="summary-row-icon" aria-hidden="true">${expanded ? "−" : "+"}</span>
                <strong>${escapeHtml(group.artist)}</strong>
                <span class="summary-row-year">${escapeHtml(getArtistYearRange(group.items))}</span>
                <small class="summary-row-label">${escapeHtml(getArtistSummaryLabel(group.items))}</small>
              </button>
              <div class="summary-group-body">
                ${activeSummaryArtist === group.artist ? renderSummaryWorkRows(group.items, mediaByWorkId) : ""}
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
    <div class="overview-stills-grid" data-view-panel="overview">
      ${stillItems
        .map(
          ({ work, item }) => `
            <button class="overview-still-button" type="button" data-gallery-work-id="${escapeHtml(work.id)}" aria-label="${escapeHtml(work.artist)} stills">
              <img src="${escapeHtml(getMediaPreviewUrl(item.url))}" alt="${escapeHtml(item.caption || `${work.artist} still`)}" loading="lazy" decoding="async" data-original-src="${escapeHtml(item.url)}" />
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

  const summaryWorks = getFilteredWorks(works);
  const activeView = getActiveWorkView();

  list.innerHTML =
    activeView === "overview"
      ? renderOverviewGrid(works, mediaByWorkId)
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
          <span class="open-work-title">${escapeHtml(item.title)}</span>
          <small>${escapeHtml(item.summary)}</small>
        </a>
      `
    )
    .join("");
}

function renderOpenWorksIndex() {
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
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.summary)}</p>
          <small>${escapeHtml(detail.kicker || "")}</small>
        </a>
      `;
    })
    .join("");
}

function getOpenWorkDetails(openWorks, detailRows) {
  const detailsBySlug = Object.fromEntries(
    openWorks
      .filter((item) => item.slug)
      .map((item) => [
        item.slug.replace(/^\/+/, ""),
        {
          title: item.title?.trim() ?? "",
          summary: item.summary?.trim() ?? "",
          slug: item.slug.replace(/^\/+/, "")
        }
      ])
  );

  for (const row of detailRows) {
    const slug = row.slug?.trim();
    if (!slug) continue;

    detailsBySlug[slug] = {
      ...(detailsBySlug[slug] ?? { slug }),
      kicker: row.kicker?.trim() ?? "",
      summary: row.detail_summary?.trim() || detailsBySlug[slug]?.summary || "",
      format: row.format?.trim() ?? "",
      status: row.status?.trim() ?? "",
      role: row.role?.trim() ?? "",
      lede: row.lede?.trim() ?? "",
      detail: row.detail?.trim() ?? "",
      features: (row.features ?? "")
        .split("|")
        .map((feature) => feature.trim())
        .filter(Boolean),
      actionLabel: row.action_label?.trim() || "문의하기",
      imageUrl: normalizeMediaUrl(row.image_url),
      imageAlt: row.image_alt?.trim() || detailsBySlug[slug]?.title || ""
    };
  }

  return detailsBySlug;
}

function getOpenWorkExternalLinks(rows) {
  return rows.reduce((linksBySlug, row) => {
    const slug = row.slug?.trim();
    const label = row.label?.trim();
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
  return rows.reduce((examplesBySlug, row) => {
    const slug = row.slug?.trim();
    const mediaUrl = normalizeMediaUrl(row.media_url);
    if (!slug || !mediaUrl) return examplesBySlug;

    const example = {
      kicker: row.kicker?.trim() || "Example",
      title: row.title?.trim() || "Example",
      mediaUrl,
      mediaType: row.media_type?.trim().toLowerCase() || "video",
      caption: row.caption?.trim() ?? "",
      sort: Number.parseInt(row.sort, 10) || 0
    };

    examplesBySlug[slug] = [...(examplesBySlug[slug] ?? []), example].sort((a, b) => a.sort - b.sort);
    return examplesBySlug;
  }, {});
}

function getOpenWorkManuals(rows) {
  return rows.reduce((manualsBySlug, row) => {
    const slug = row.slug?.trim();
    const stepTitle = row.step_title?.trim();
    const body = row.body?.trim();
    if (!slug || !stepTitle || !body) return manualsBySlug;

    const step = {
      slug,
      sectionTitle: row.section_title?.trim() || "사용 설명서",
      title: stepTitle,
      body,
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
  if (step.title === "환경별 설치 방법") {
    return renderManualTable(step.body);
  }

  if (step.title === "호출 예시") {
    return renderManualCallGrid(step.body);
  }

  return `<div class="open-work-manual-rich">${renderManualRichBlocks(step.body)}</div>`;
}

function renderManualStepBody(step) {
  if (step.slug === "jebi-agent") {
    return renderJebiManualBody(step);
  }

  if (step.title !== "처음 실행 허용하기") {
    return `<p>${escapeHtml(step.body)}</p>`;
  }

  const lead = step.body.split("먼저 Done")[0].trim();

  return `
    <div class="open-work-manual-note">
      <p>${escapeHtml(lead)}</p>
      <ol class="open-work-manual-path" aria-label="macOS first launch permission path">
        <li>Done을 눌러 경고창을 닫습니다.</li>
        <li>System Settings &gt; Privacy &amp; Security로 이동합니다.</li>
        <li>Open Anyway를 선택한 뒤 앱을 다시 엽니다.</li>
      </ol>
      <p class="open-work-manual-smallprint">한국어 경로: 완료를 누른 뒤 시스템 설정 &gt; 개인정보 보호 및 보안에서 그래도 열기를 선택하세요. macOS 버전에 따라 버튼 이름이 조금 다를 수 있습니다.</p>
    </div>
  `;
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function renderOpenWorkPage(slug) {
  slug = getCanonicalOpenWorkSlug(slug);
  const work = openWorkDetailsBySlug[slug];
  const page = document.querySelector("[data-open-work-page]");
  const action = document.querySelector("[data-open-work-action]");
  const features = document.querySelector("[data-open-work-features]");
  const media = document.querySelector("[data-open-work-media]");
  const image = document.querySelector("[data-open-work-image]");
  const related = document.querySelector("[data-open-work-related]");
  const externalLinks = document.querySelector("[data-open-work-external-links]");
  const example = document.querySelector("[data-open-work-example]");
  const exampleKicker = document.querySelector("[data-open-work-example-kicker]");
  const exampleTitle = document.querySelector("[data-open-work-example-title]");
  const exampleMedia = document.querySelector("[data-open-work-example-media]");
  const manual = document.querySelector("[data-open-work-manual]");
  const manualTitle = document.querySelector("[data-open-work-manual-title]");
  const manualSteps = document.querySelector("[data-open-work-manual-steps]");

  if (!work && Object.keys(openWorkDetailsBySlug).length === 0) {
    setText("[data-open-work-title]", "Open work");
    setText("[data-open-work-summary]", "Loading open work...");
    return;
  }

    if (!work) {
    setText("[data-open-work-kicker]", "Open Works");
    setText("[data-open-work-title]", "Open work not found");
    setText("[data-open-work-summary]", "목록에서 다시 선택해주세요.");
    setText("[data-open-work-format]", "");
    setText("[data-open-work-status]", "");
    setText("[data-open-work-role]", "");
    setText("[data-open-work-lede]", "");
    setText("[data-open-work-detail]", "");
    if (action) {
      action.textContent = "목록으로";
          action.href = toSitePath("/open-works");
    }
    if (page) page.classList.remove("has-open-work-media");
    if (features) features.innerHTML = "";
    if (externalLinks) {
      externalLinks.hidden = true;
      externalLinks.innerHTML = "";
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

  if (externalLinks) {
    const links = openWorkExternalLinksBySlug[work.slug] ?? [];
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
    exampleKicker.textContent = firstExample?.kicker || "Example";
    exampleTitle.textContent = firstExample?.title || "Example";
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
    manualTitle.textContent = steps[0]?.sectionTitle || "사용 설명서";
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
  const select = document.querySelector("[data-feedback-work-select]");
  const intro = document.querySelector("[data-feedback-intro]");
  const selectedSlug = new URLSearchParams(window.location.search).get("work") ?? "";

  if (select) {
    select.innerHTML = openWorksList
      .map((item) => {
        const slug = item.slug?.replace(/^\/+/, "") ?? "";
        const selected = slug === selectedSlug ? " selected" : "";
        return `<option value="${escapeHtml(slug)}"${selected}>${escapeHtml(item.title)}</option>`;
      })
      .join("");
  }

  const selectedWork = openWorkDetailsBySlug[selectedSlug];
  if (intro) {
    intro.textContent = selectedWork
      ? `${selectedWork.title}에 대한 의견을 남겨주세요.`
      : "Open work에 대한 의견을 남겨주세요.";
  }
}

function getFeedbackPayload(form) {
  const formData = new FormData(form);
  const slug = String(formData.get("work") ?? "");
  const work = openWorkDetailsBySlug[slug];
  const title = work?.title || slug || "Open work";
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  return { slug, title, email, message };
}

function openFeedbackMailto(payload) {
  const body = [
    `Work: ${payload.title}`,
    payload.email ? `Email: ${payload.email}` : "",
    "",
    payload.message
  ]
    .filter(Boolean)
    .join("\n");

  window.location.href = `mailto:${FEEDBACK_RECIPIENT}?subject=${encodeURIComponent(`${payload.title} feedback`)}&body=${encodeURIComponent(body)}`;
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

function setFeedbackStatus(form, message) {
  const status = form.querySelector("[data-feedback-status]");
  if (status) status.textContent = message;
}

function setFeedbackSubmitting(form, submitting) {
  const submit = form.querySelector(".feedback-submit");
  if (!submit) return;

  submit.disabled = submitting;
  submit.textContent = submitting ? "SENDING" : "SUBMIT";
}

async function handleFeedbackSubmit(form) {
  const payload = getFeedbackPayload(form);

  if (!FEEDBACK_ENDPOINT) {
    openFeedbackMailto(payload);
    return;
  }

  setFeedbackSubmitting(form, true);
  setFeedbackStatus(form, "전송 중입니다.");

  try {
    await sendFeedbackToEndpoint(payload);
    form.reset();
    setFeedbackStatus(form, "메시지가 전송되었습니다.");
  } catch {
    setFeedbackStatus(form, "전송에 문제가 있어 메일 앱으로 연결합니다.");
    openFeedbackMailto(payload);
  } finally {
    setFeedbackSubmitting(form, false);
  }
}

async function loadHomeData() {
  const [works, openWorks, openWorkDetails, openWorksPageRows, openWorkLinks, openWorkExamples, openWorkManuals, workMedia] = await Promise.all([
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
  openWorksPage = openWorksPageRows[0] ?? openWorksPage;
  openWorkDetailsBySlug = getOpenWorkDetails(openWorksList, openWorkDetails);
  openWorkExternalLinksBySlug = getOpenWorkExternalLinks(openWorkLinks);
  openWorkExamplesBySlug = getOpenWorkExamples(openWorkExamples);
  openWorkManualsBySlug = getOpenWorkManuals(openWorkManuals);
  galleriesByWorkId = groupGalleryMedia(workMedia);
  renderWorks();
  renderOpenWorks(openWorksList);
  if (getRoute(window.location.pathname) === "open-work") {
    renderOpenWorkPage(getOpenWorkSlug(window.location.pathname));
  } else if (getRoute(window.location.pathname) === "open-works") {
    renderOpenWorksIndex();
  } else if (getRoute(window.location.pathname) === "feedback") {
    renderFeedbackPage();
  }
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
    image.alt = item.caption || "Work still";
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

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-bead-curtain-webgl]")) {
    event.preventDefault();
    enterHomeAfterBeadCurtain();
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

loadHomeData().catch((error) => {
  console.error(error);
});
