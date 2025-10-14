// =======================
// Global state
// =======================
let currentPage = 1;
let currentCategory = "all";
let currentSearch = "";
let isLoading = false;
let searchTimeout;

const ANNOUNCEMENT_CHECK_INTERVAL = 15000;
const ANNOUNCEMENT_REFRESH_INTERVAL = 5 * 60 * 1000;
const announcementTickerState = {
  items: [],
  isLoading: false,
  checkTimer: null,
  refreshTimer: null,
};

const FALLBACK_THUMBNAIL_SRC =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox%3D%270%200%2016%209%27%3E%3Crect%20width%3D%2716%27%20height%3D%279%27%20fill%3D%27%230f172a%27%2F%3E%3Cpath%20fill%3D%27%231f2937%27%20d%3D%27M0%200h16v9H0z%27%2F%3E%3Crect%20x%3D%271%27%20y%3D%271%27%20width%3D%2714%27%20height%3D%277%27%20fill%3D%27none%27%20stroke%3D%27%23334155%27%20stroke-width%3D%27.5%27%2F%3E%3Cpath%20fill%3D%27%23475569%27%20d%3D%27M4.5%203.5l1.75%202.25%201.25-1.5%201.75%202.25h-7z%27%2F%3E%3Ccircle%20cx%3D%275.5%27%20cy%3D%273.5%27%20r%3D%27.75%27%20fill%3D%27%2364748b%27%2F%3E%3C%2Fsvg%3E";

// Filters state
let currentViewSort = "none"; // 'none' | 'highest' | 'lowest'
let currentTimeFilter = "newest"; // 'newest' | '7d' | 'oldest'

// =======================
// Sync State <-> URL (page, category, search, view, time)
// =======================
function getStateFromURL() {
  const p = new URLSearchParams(location.search);
  const search = (p.get("search") || "").trim();

  let category = (p.get("category") || "all").toLowerCase();
  const allowed = [
    "all",
    "china",
    "gaydar",
    "vietnam",
    "japan",
    "western",
    "magazine",
    "other",
    "straight", // bạn vẫn giữ
  ];
  if (!allowed.includes(category)) category = "all";

  let view = (p.get("view") || "none").toLowerCase();
  if (!["none", "highest", "lowest"].includes(view)) view = "none";

  let time = (p.get("time") || "newest").toLowerCase();
  if (!["newest", "7d", "oldest"].includes(time)) time = "newest";

  // rule: if view != none then time cannot be 'oldest'
  if (view !== "none" && time === "oldest") time = "newest";

  const page = Math.max(1, parseInt(p.get("page") || "1", 10) || 1);
  return { search, category, page, view, time };
}

function applyState({ search, category, page, view, time }) {
  currentSearch = search;
  currentCategory = category;
  currentPage = page;
  currentViewSort = view || "none";
  currentTimeFilter = time || "newest";

  // sync inputs
  const si = document.getElementById("searchInput");
  const mi = document.getElementById("mobileSearchInput");
  if (si) si.value = search;
  if (mi) mi.value = search;

  updateFilterUI();
  markActiveNav();
}

function updateURL(push = false) {
  const q = new URLSearchParams(location.search);

  if (currentCategory && currentCategory !== "all")
    q.set("category", currentCategory);
  else q.delete("category");
  if (currentSearch) q.set("search", currentSearch);
  else q.delete("search");
  if (currentPage && currentPage > 1) q.set("page", String(currentPage));
  else q.delete("page");

  if (currentViewSort !== "none") q.set("view", currentViewSort);
  else q.delete("view");
  if (currentTimeFilter !== "newest") q.set("time", currentTimeFilter);
  else q.delete("time");

  const qs = q.toString();
  const url = qs ? `/?${qs}` : "/";
  const state = {
    page: currentPage,
    category: currentCategory,
    search: currentSearch,
    view: currentViewSort,
    time: currentTimeFilter,
  };
  if (push) history.pushState(state, "", url);
  else history.replaceState(state, "", url);
}

// =======================
// Search (desktop + mobile)
// =======================
function performSearch(query) {
  clearTimeout(searchTimeout);

  if (query.trim().length > 0 && query.trim().length < 2) return;

  searchTimeout = setTimeout(() => {
    currentSearch = query.trim();
    currentPage = 1;

    const searchInput = document.getElementById("searchInput");
    const mobileSearchInput = document.getElementById("mobileSearchInput");
    if (currentSearch) {
      if (searchInput) searchInput.classList.add("searching");
      if (mobileSearchInput) mobileSearchInput.classList.add("searching");
    }

    updateURL(true);
    loadVideos();
  }, 300);
}

function initSearch() {
  const searchInput = document.getElementById("searchInput");
  const mobileSearchInput = document.getElementById("mobileSearchInput");
  const mobileSearchToggle = document.querySelector(".mobile-search-toggle");
  const mobileSearch = document.querySelector(".mobile-search");
  const mobileSearchClose = document.querySelector(".mobile-search-close");

  // Desktop
  if (searchInput) {
    searchInput.addEventListener("input", (e) => performSearch(e.target.value));
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        clearTimeout(searchTimeout);
        performSearch(e.target.value);
      }
    });
    searchInput.addEventListener("blur", () => {
      setTimeout(() => searchInput.classList.remove("searching"), 1000);
    });
  }

  // Mobile toggle
  if (mobileSearchToggle) {
    mobileSearchToggle.addEventListener("click", () => {
      if (!mobileSearch) return;
      mobileSearch.classList.add("active");
      mobileSearchInput?.focus();
    });
  }
  if (mobileSearchClose) {
    mobileSearchClose.addEventListener("click", () => {
      if (!mobileSearch) return;
      mobileSearch.classList.remove("active");
      if (mobileSearchInput) {
        mobileSearchInput.value = "";
        performSearch("");
      }
    });
  }

  // Mobile input
  if (mobileSearchInput) {
    mobileSearchInput.addEventListener("input", (e) =>
      performSearch(e.target.value),
    );
    mobileSearchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        clearTimeout(searchTimeout);
        performSearch(e.target.value);
        mobileSearch?.classList.remove("active");
      }
    });
    mobileSearchInput.addEventListener("blur", () => {
      setTimeout(() => mobileSearchInput.classList.remove("searching"), 1000);
    });
  }
}

// Optional: legacy filter buttons (not used now)
function initCategoryFilter() {
  const filterBtns = document.querySelectorAll(".filter-btn");
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentCategory = btn.dataset.category;
      currentPage = 1;
      updateURL(true);
      loadVideos();
    });
  });
}

// =======================
// Filters UI
// =======================
function updateFilterUI() {
  // active state
  document.querySelectorAll("#viewSortMenu li").forEach((li) => {
    li.classList.toggle("active", li.dataset.view === currentViewSort);
  });
  document.querySelectorAll("#timeFilterMenu li").forEach((li) => {
    li.classList.toggle("active", li.dataset.time === currentTimeFilter);
  });

  // disable 'Oldest' when views != none
  const oldest = document.querySelector(
    '#timeFilterMenu li[data-time="oldest"]',
  );
  if (oldest) {
    if (currentViewSort !== "none") oldest.classList.add("disabled");
    else oldest.classList.remove("disabled");
  }

  // cập nhật nhãn nút theo lựa chọn
  const vLabel = document.querySelector("#viewSortBtn .label");
  const tLabel = document.querySelector("#timeFilterBtn .label");
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  if (vLabel) {
    vLabel.textContent =
      currentViewSort === "none" ? "Views" : `Views: ${cap(currentViewSort)}`;
  }
  if (tLabel) {
    let t = currentTimeFilter;
    if (t === "7d") t = "Last 7 days";
    else t = cap(t); // Newest / Oldest
    tLabel.textContent = `Time: ${t}`;
  }
}

function initFiltersUI() {
  const vWrap = document.getElementById("filterViews");
  const tWrap = document.getElementById("filterTime");
  const vBtn = document.getElementById("viewSortBtn");
  const tBtn = document.getElementById("timeFilterBtn");

  if (!vWrap || !tWrap) return;

  // open/close inline panels
  const closeAll = () => {
    vWrap.classList.remove("open");
    tWrap.classList.remove("open");
  };
  vBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    vWrap.classList.toggle("open");
    tWrap.classList.remove("open");
  });
  tBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    tWrap.classList.toggle("open");
    vWrap.classList.remove("open");
  });
  document.addEventListener("click", closeAll);

  // select view
  document.querySelectorAll("#viewSortMenu li").forEach((li) => {
    li.addEventListener("click", () => {
      const val = li.dataset.view;
      if (!val) return;
      currentViewSort = val;
      if (currentViewSort !== "none" && currentTimeFilter === "oldest") {
        currentTimeFilter = "newest";
      }
      currentPage = 1;
      updateFilterUI();
      updateURL(true);
      loadVideos();
      closeAll();
    });
  });

  // select time
  document.querySelectorAll("#timeFilterMenu li").forEach((li) => {
    li.addEventListener("click", () => {
      const val = li.dataset.time;
      if (!val) return;
      if (val === "oldest" && currentViewSort !== "none") return; // guard xung đột
      currentTimeFilter = val;
      currentPage = 1;
      updateFilterUI();
      updateURL(true);
      loadVideos();
      closeAll();
    });
  });

  updateFilterUI();
}

// =======================
// Skeleton
// =======================
function generateSkeleton(count = 20) {
  const skeleton = document.getElementById("loadingSkeleton");
  if (!skeleton) return;
  skeleton.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const el = document.createElement("a");
    el.className = "skeleton-card";
    el.innerHTML = `
      <div class="skeleton-thumbnail skeleton"></div>
      <div class="skeleton-info">
        <div class="skeleton-title skeleton"></div>
        <div class="skeleton-meta skeleton"></div>
      </div>
    `;
    skeleton.appendChild(el);
  }
}

// =======================
// Mark active in nav (desktop + mobile)
// =======================
function markActiveNav() {
  const allLinks = document.querySelectorAll(
    ".nav .nav-link, .mobile-nav .nav-link",
  );
  allLinks.forEach((a) => {
    const u = new URL(a.getAttribute("href"), location.origin);
    const c = (
      new URLSearchParams(u.search).get("category") || "all"
    ).toLowerCase();
    a.classList.toggle("active", c === currentCategory);
  });
}

// =======================
// Mobile hamburger + drawer
// =======================
function initMobileNav() {
  const btn = document.getElementById("menuToggle");
  const drawer = document.getElementById("mobileNav");
  const backdrop = document.getElementById("navBackdrop");

  if (!btn || !drawer) return;

  const open = () => {
    drawer.classList.add("open");
    backdrop?.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
    drawer.setAttribute("aria-hidden", "false");
  };
  const close = () => {
    drawer.classList.remove("open");
    backdrop?.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    drawer.setAttribute("aria-hidden", "true");
  };
  const toggle = () => (drawer.classList.contains("open") ? close() : open());

  btn.addEventListener("click", toggle);
  backdrop?.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  // Close when choose a link
  drawer.addEventListener("click", (e) => {
    const a = e.target.closest("a.nav-link");
    if (a) close();
  });

  // Auto close when >768px
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) close();
  });
}

// =======================
// API: Load videos (server-side filter/sort/paginate)
// =======================
async function loadVideos() {
  if (isLoading) return;
  isLoading = true;

  const videoGrid = document.getElementById("videoGrid");
  const loadingSkeleton = document.getElementById("loadingSkeleton");
  const paginationEl = document.getElementById("pagination");

  if (videoGrid) videoGrid.style.visibility = "hidden";
  if (loadingSkeleton) loadingSkeleton.style.display = "grid";
  if (paginationEl) paginationEl.innerHTML = "";

  try {
    const limit = getItemsPerPage();
    const params = new URLSearchParams({
      page: currentPage,
      limit: limit,
      category: currentCategory === "all" ? "" : currentCategory,
      search: currentSearch,
    });
    if (window.matchMedia("(max-width: 768px)").matches) {
      params.set("limit", "20");
    }

    // NEW: gửi sort/time để server lọc & sort toàn cục trước khi phân trang
    let sort = "newest";
    if (currentViewSort === "highest") sort = "views";
    else if (currentViewSort === "lowest") sort = "views_asc";
    else if (currentTimeFilter === "oldest" && currentViewSort === "none")
      sort = "oldest";
    params.set("sort", sort);

    if (currentTimeFilter === "7d") params.set("time", "7d");

    const res = await fetch(`/api/videos?${params}`);
    const data = await res.json();

    if (loadingSkeleton) loadingSkeleton.style.display = "none";
    if (videoGrid) videoGrid.style.visibility = "visible";

    // KHÔNG còn lọc/sort ở client – dùng dữ liệu đã phân trang từ server
    const list = Array.isArray(data.videos) ? data.videos : [];
    const pageList = list;
    const pagination = data.pagination;

    if (!pageList || pageList.length === 0) {
      if (videoGrid) {
        const noResultsMessage = currentSearch
          ? `No videos found for "<strong>${currentSearch}</strong>"<br><small>Try a different or shorter keyword</small>`
          : "No videos in this category";
        videoGrid.innerHTML = `
          <div class="no-results" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
            <h3 style="margin-bottom: 1rem;">No results</h3>
            <p style="color: #a7a7b3; margin-bottom: 2rem;">${noResultsMessage}</p>
            ${currentSearch ? `<button onclick="clearSearch()" class="btn-secondary">✕ Clear search</button>` : ""}
          </div>`;
      }
    } else {
      renderVideos(pageList);

      // clear trạng thái “searching”
      const searchInput = document.getElementById("searchInput");
      const mobileSearchInput = document.getElementById("mobileSearchInput");
      if (searchInput) searchInput.classList.remove("searching");
      if (mobileSearchInput) mobileSearchInput.classList.remove("searching");

      // badge thông tin search
      if (currentSearch && videoGrid) {
        const info = document.createElement("a");
        info.className = "search-info";
        const totalText = data.pagination?.total ?? pageList.length;
        info.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:1rem;">
            <span style="color:#eaeaea;"><strong>${totalText}</strong> videos for "<strong>${currentSearch}</strong>"</span>
            <button onclick="clearSearch()" style="background:rgba(255,107,107,.2);border:1px solid #ff6b6b;color:#ff6b6b;padding:.25rem .75rem;border-radius:6px;cursor:pointer;font-size:.8rem;transition:.2s">✕ Clear</button>
          </div>`;
        videoGrid.insertBefore(info, videoGrid.firstChild);
      }
    }

    renderPagination(pagination);
    markActiveNav();
  } catch (err) {
    console.error("Error loading videos:", err);
    if (loadingSkeleton) loadingSkeleton.style.display = "none";
    if (videoGrid) {
      videoGrid.style.display = "grid";
      videoGrid.innerHTML = `
        <div class="no-results" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
          <h3>Failed to load data</h3>
          <p style="color:#a7a7b3;margin-bottom:2rem;">Please try again later</p>
        </div>`;
    }
  } finally {
    isLoading = false;
  }
}

// =======================
// Helpers
// =======================
function clearSearch() {
  currentSearch = "";
  currentPage = 1;

  const searchInput = document.getElementById("searchInput");
  const mobileSearchInput = document.getElementById("mobileSearchInput");
  if (searchInput) {
    searchInput.value = "";
    searchInput.classList.remove("searching");
  }
  if (mobileSearchInput) {
    mobileSearchInput.value = "";
    mobileSearchInput.classList.remove("searching");
  }

  updateURL(true);
  loadVideos();
}

function getItemsPerPage() {
  const w = window.innerWidth;
  if (w <= 480) return 12;
  if (w <= 768) return 15;
  if (w <= 1199) return 16;
  return 20;
}

function renderVideos(videos) {
  const videoGrid = document.getElementById("videoGrid");
  if (!videoGrid) return;
  videoGrid.innerHTML = "";

  videos.forEach((video) => {
    const a = document.createElement("a");
    a.className = "video-card";

    const slug = (video.title || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    a.href = "/video/" + slug;
    const thumbSrc = video.thumbnail || FALLBACK_THUMBNAIL_SRC;

    a.innerHTML = `
      <div class="video-thumbnail">
        <img src="${thumbSrc}" alt="${video.title}" loading="lazy" decoding="async"
             width="1280" height="720" onerror="this.onerror=null;this.src='${FALLBACK_THUMBNAIL_SRC}'">
        <div class="video-duration">${video.duration}</div>
      </div>
      <div class="video-info">
        <h3 class="video-title">${video.title}</h3>
        <div class="video-meta">
          <div class="video-views">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
            ${formatViews(video.views || 0)}
          </div>
        </div>
      </div>
    `;
    videoGrid.appendChild(a);
  });
}

function formatViews(v) {
  const oneDecimal = (n) => n.toFixed(1).replace(/\.0$/, "");
  if (v >= 1_000_000_000) return oneDecimal(v / 1_000_000_000) + "B";
  if (v >= 1_000_000) return oneDecimal(v / 1_000_000) + "M";
  if (v >= 1_000) return oneDecimal(v / 1_000) + "K";
  return v.toString();
}

function renderPagination(pagination) {
  const el = document.getElementById("pagination");
  if (!el || !pagination || pagination.pages <= 1) {
    if (el) el.innerHTML = "";
    return;
  }
  let html = "";
  if (pagination.page > 1) {
    html += `<button class="pagination-btn" onclick="goToPage(${pagination.page - 1})">Prev</button>`;
  }
  const start = Math.max(1, pagination.page - 2);
  const end = Math.min(pagination.pages, pagination.page + 2);
  if (start > 1) {
    html += `<button class="pagination-btn" onclick="goToPage(1)">1</button>`;
    if (start > 2)
      html += `<span style="padding:0 .5rem;color:#a7a7b3;">...</span>`;
  }
  for (let i = start; i <= end; i++) {
    html += `<button class="pagination-btn ${i === pagination.page ? "active" : ""}" onclick="goToPage(${i})">${i}</button>`;
  }
  if (end < pagination.pages) {
    if (end < pagination.pages - 1)
      html += `<span style="padding:0 .5rem;color:#a7a7b3;">...</span>`;
    html += `<button class="pagination-btn" onclick="goToPage(${pagination.pages})">${pagination.pages}</button>`;
  }
  if (pagination.page < pagination.pages) {
    html += `<button class="pagination-btn" onclick="goToPage(${pagination.page + 1})">Next</button>`;
  }
  el.innerHTML = html;
}

function goToPage(page) {
  currentPage = page;
  updateURL(true);
  loadVideos();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Expose for inline handlers
window.clearSearch = clearSearch;
window.goToPage = goToPage;

async function loadAnnouncementsTicker() {
  const bar = document.getElementById("announcementBar");
  const track = document.getElementById("announcementTrack");
  if (!bar || !track) return;

  if (announcementTickerState.isLoading) return;
  announcementTickerState.isLoading = true;

  try {
    const res = await fetch("/api/announcements");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const now = Date.now();

    const items = (Array.isArray(data) ? data : [])
      .map((item) => {
        const expiresMs = new Date(item.expiresAt || item.expiredAt).getTime();
        return {
          id: item.id || item._id || `${expiresMs}-${Math.random().toString(36).slice(2, 8)}`,
          message: String(item.message ?? ""),
          createdAt: item.createdAt,
          expiresAt: item.expiresAt,
          expiresMs,
        };
      })
      .filter((item) => Number.isFinite(item.expiresMs) && item.expiresMs > now);

    announcementTickerState.items = items;
    renderAnnouncementTicker();
    setupAnnouncementTickerTimers();
  } catch (error) {
    console.error("Announcement ticker error:", error);
    if (!announcementTickerState.items.length) {
      bar.hidden = true;
      clearAnnouncementTickerTimers();
    }
  } finally {
    announcementTickerState.isLoading = false;
  }
}

function renderAnnouncementTicker() {
  const bar = document.getElementById("announcementBar");
  const track = document.getElementById("announcementTrack");
  if (!bar || !track) return;

  track.innerHTML = "";
  const items = announcementTickerState.items;
  if (!Array.isArray(items) || !items.length) {
    bar.hidden = true;
    clearAnnouncementTickerTimers();
    return;
  }

  const originals = items.map((item, index) => {
    const el = document.createElement("div");
    el.className = "announcement-item";
    el.dataset.id = String(item.id || index);
    el.appendChild(createAnnouncementFragment(item.message || ""));
    return el;
  });

  originals.forEach((el) => track.appendChild(el));
  originals.forEach((el) => track.appendChild(el.cloneNode(true)));

  const totalChars = Math.max(
    20,
    items.reduce((sum, item) => sum + String(item.message || "").length, 0),
  );
  const duration = Math.max(28, Math.min(120, totalChars * 0.45));
  track.style.setProperty("--announcement-duration", `${duration}s`);

  bar.hidden = false;
}

function setupAnnouncementTickerTimers() {
  clearAnnouncementTickerTimers();
  if (!announcementTickerState.items.length) return;

  announcementTickerState.checkTimer = setInterval(() => {
    const now = Date.now();
    const active = announcementTickerState.items.filter(
      (item) => item.expiresMs && item.expiresMs > now,
    );
    if (active.length !== announcementTickerState.items.length) {
      announcementTickerState.items = active;
      renderAnnouncementTicker();
      if (!active.length) {
        clearAnnouncementTickerTimers();
      }
    }
  }, ANNOUNCEMENT_CHECK_INTERVAL);

  announcementTickerState.refreshTimer = setInterval(() => {
    loadAnnouncementsTicker();
  }, ANNOUNCEMENT_REFRESH_INTERVAL);
}

function clearAnnouncementTickerTimers() {
  if (announcementTickerState.checkTimer) {
    clearInterval(announcementTickerState.checkTimer);
    announcementTickerState.checkTimer = null;
  }
  if (announcementTickerState.refreshTimer) {
    clearInterval(announcementTickerState.refreshTimer);
    announcementTickerState.refreshTimer = null;
  }
}

function createAnnouncementFragment(text) {
  const fragment = document.createDocumentFragment();
  const normalized = String(text ?? "").replace(/\r?\n/g, " ");
  if (!normalized) {
    fragment.appendChild(document.createTextNode(""));
    return fragment;
  }

  const linkPattern =
    /((?:https?:\/\/)?(?:[\w-]+\.)+[\w-]{2,}(?:\/[\w\d\-._~:/?#[\]@!$&'()*+,;=%]*)?)/gi;
  let lastIndex = 0;
  let match;
  while ((match = linkPattern.exec(normalized)) !== null) {
    const start = match.index;
    const raw = match[0];
    if (start > lastIndex) {
      fragment.appendChild(
        document.createTextNode(normalized.slice(lastIndex, start)),
      );
    }

    let url = raw;
    let trailing = "";
    const trailingMatch = url.match(/[),.;!?]+$/);
    if (trailingMatch) {
      trailing = trailingMatch[0];
      url = url.slice(0, -trailing.length);
    }

    if (url) {
      const hasProtocol = /^https?:\/\//i.test(url);
      const href = hasProtocol ? url : `https://${url}`;
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.textContent = url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.className = "announcement-link";
      fragment.appendChild(anchor);
    } else {
      fragment.appendChild(document.createTextNode(raw));
    }

    if (trailing) {
      fragment.appendChild(document.createTextNode(trailing));
    }
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < normalized.length) {
    fragment.appendChild(document.createTextNode(normalized.slice(lastIndex)));
  }

  return fragment;
}

// =======================
// Floating Chat (home)
// =======================
function initFloatingChat() {
  const btn = document.getElementById("chatToggle");
  const panel = document.getElementById("chatPanel");
  const closeBtn = document.getElementById("chatClose");
  const backdrop = document.getElementById("chatBackdrop");
  if (!btn || !panel) return;

  const open = () => {
    panel.classList.add("open");
    backdrop?.classList.add("open");
    localStorage.setItem("chatOpen", "1");
  };
  const hide = () => {
    panel.classList.remove("open");
    backdrop?.classList.remove("open");
    localStorage.removeItem("chatOpen");
  };

  btn.addEventListener("click", () => {
    const t = document.getElementById("chatTeaser");
    if (t) t.remove();
    panel.classList.contains("open") ? hide() : open();
  });

  closeBtn?.addEventListener("click", hide);
  backdrop?.addEventListener("click", hide);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hide();
  });

  if (localStorage.getItem("chatOpen") === "1") open();

  // teaser every time on homepage
  if (location.pathname === "/") {
    setTimeout(() => {
      if (!btn) return;

      let teaser = document.getElementById("chatTeaser");
      if (!teaser) {
        teaser = document.createElement("div");
        teaser.id = "chatTeaser";
        teaser.className = "chat-teaser";
        teaser.innerHTML =
          "<strong>Chat with me</strong><br><span>Request video</span>";
        btn.appendChild(teaser);
      }

      teaser.classList.add("show", "shake");

      setTimeout(() => {
        teaser.classList.remove("show", "shake");
        teaser.remove();
      }, 5000);

      teaser.addEventListener(
        "click",
        () => {
          teaser.remove();
          open();
        },
        { once: true },
      );
    }, 3000);
  }
}

// =======================
// Init
// =======================
document.addEventListener("DOMContentLoaded", () => {
  initSearch();
  initMobileNav();

  // from URL
  applyState(getStateFromURL());
  updateURL(false);

  initFiltersUI();
  loadAnnouncementsTicker();
  markActiveNav();

  generateSkeleton();
  setTimeout(() => {
    loadVideos();
  }, 100);

  // Reload data when breakpoint changes
  let resizeTimeout;
  let __sizeBucket = getSizeBucket();
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const b = getSizeBucket();
      if (b !== __sizeBucket && !isLoading) {
        __sizeBucket = b;
        loadVideos();
      }
    }, 200);
  });
  function getSizeBucket() {
    const w = window.innerWidth;
    if (w <= 480) return "xs";
    if (w <= 768) return "sm";
    if (w <= 1199) return "md";
    return "lg";
  }

  // Back/Forward
  window.addEventListener("popstate", (e) => {
    const st = e.state || getStateFromURL();
    applyState(st);
    loadVideos();
  });

  // Floating chat
  try {
    initFloatingChat();
  } catch (e) {
    console.error(e);
  }
});
