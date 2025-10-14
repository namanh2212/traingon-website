let currentVideo = null;
let currentServerIndex = 0;
let currentTagFilter = null;

const FALLBACK_THUMBNAIL_SRC =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox%3D%270%200%2016%209%27%3E%3Crect%20width%3D%2716%27%20height%3D%279%27%20fill%3D%27%230f172a%27%2F%3E%3Cpath%20fill%3D%27%231f2937%27%20d%3D%27M0%200h16v9H0z%27%2F%3E%3Crect%20x%3D%271%27%20y%3D%271%27%20width%3D%2714%27%20height%3D%277%27%20fill%3D%27none%27%20stroke%3D%27%23334155%27%20stroke-width%3D%27.5%27%2F%3E%3Cpath%20fill%3D%27%23475569%27%20d%3D%27M4.5%203.5l1.75%202.25%201.25-1.5%201.75%202.25h-7z%27%2F%3E%3Ccircle%20cx%3D%275.5%27%20cy%3D%273.5%27%20r%3D%27.75%27%20fill%3D%27%2364748b%27%2F%3E%3C%2Fsvg%3E";

const tagResultsSection = document.getElementById("tagResultsSection");
const tagResultsTitle = document.getElementById("tagResultsTitle");
const tagResultsSubtitle = document.getElementById("tagResultsSubtitle");
const tagResultsGrid = document.getElementById("tagResultsGrid");
const tagResultsClose = document.getElementById("tagResultsClose");

if (tagResultsClose) {
  tagResultsClose.addEventListener("click", () => hideTagResults());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Get key from URL: prefer slug (/video/:slug), fallback id (/watch/:id or ?id=)
function getVideoKey() {
  const qsId = new URLSearchParams(location.search).get("id");
  if (qsId) return { id: qsId };
  const mWatch = location.pathname.match(/^\/watch\/([^\/]+)/);
  if (mWatch) return { id: mWatch[1] };
  const mSlug = location.pathname.match(/^\/video\/([^\/?#]+)/i);
  if (mSlug) return { slug: decodeURIComponent(mSlug[1]) };
  return {};
}

// Helper: nạp script 1 lần, trả promise resolve khi globalName có mặt
function loadScriptOnce(src, globalName) {
  return new Promise((resolve, reject) => {
    if (globalName && typeof window[globalName] !== "undefined")
      return resolve(window[globalName]);
    // nếu script đã có trong DOM thì đợi onload/onerror
    const exists = Array.from(document.scripts).some((s) => s.src === src);
    if (exists && globalName && typeof window[globalName] !== "undefined")
      return resolve(window[globalName]);

    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => {
      if (!globalName || typeof window[globalName] !== "undefined")
        resolve(window[globalName]);
      else reject(new Error(globalName + " not available after load"));
    };
    s.onerror = () => reject(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });
}

// Load video data
async function loadVideo() {
  const key = getVideoKey();
  if (!key.id && !key.slug) {
    window.location.href = "/";
    return;
  }

  try {
    console.log("Loading video with key:", key);
    const url = key.slug
      ? `/api/videos/resolve?slug=${encodeURIComponent(key.slug)}`
      : `/api/videos/${encodeURIComponent(key.id)}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Video not found");
    }

    currentVideo = await response.json();
    console.log("Video loaded:", currentVideo);

    // Update page title
    document.title = `${currentVideo.title} - Traingon.top`;

    // Render video
    renderVideo();

    // SEO tags (chỉ gọi sau khi đã có currentVideo)
    applySEO(currentVideo);

    // Load related videos
    loadRelatedVideos();
  } catch (error) {
    console.error("Error loading video:", error);
    document.getElementById("videoPlayer").innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 60vh; background: rgba(255,255,255,0.1); border-radius: 16px; color: #a7a7b3; text-align: center;">
                <div>
                    <div style="font-size: 2rem; margin-bottom: 1rem;">❌</div>
                    <div>Video không tồn tại hoặc đã bị xóa</div>
                    <button onclick="window.location.href='/'" style="margin-top: 1rem; background: linear-gradient(135deg, #ff6b6b, #ff5252); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 12px; cursor: pointer;">Về trang chủ</button>
                </div>
            </div>
        `;
  }
}

// Render video
function renderVideo() {
  if (!currentVideo) return;

  hideTagResults({ clearActive: true });

  // Render server buttons if multiple servers
  if (currentVideo.embedUrls && currentVideo.embedUrls.length > 1) {
    const serverButtons = document.getElementById("serverButtons");
    serverButtons.style.display = "flex";

    let buttonsHtml = "";
    currentVideo.embedUrls.forEach((url, index) => {
      buttonsHtml += `
                <button class="server-btn ${index === 0 ? "active" : ""}" onclick="switchServer(${index})">
                    Server ${index + 1}
                </button>
            `;
    });

    serverButtons.innerHTML = buttonsHtml;
  }

  // Render video player
  renderVideoPlayer();

  // Render video details
  renderVideoDetails();

  // Setup mobile chat
  setupMobileChat();
}

// helper: thêm/ghi đè thẻ <meta>/<link> an toàn
function upsertTag(selector, create) {
  let el = document.querySelector(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  return el;
}
function absUrl(u) {
  if (!u) return "";
  try {
    return new URL(u, location.origin).href;
  } catch {
    return u;
  }
}
function isoDate(s) {
  const d = s ? new Date(s) : null;
  return d && !isNaN(d) ? d.toISOString() : undefined;
}
// PTmmSS / PTHHMMSS (nếu có duration giây)
function isoDuration(sec) {
  if (!sec || isNaN(sec)) return undefined;
  const s = Math.floor(sec % 60),
    m = Math.floor(sec / 60) % 60,
    h = Math.floor(sec / 3600);
  return (
    `PT${h ? h + "H" : ""}${m ? m + "M" : ""}${s ? s + "S" : ""}` || "PT0S"
  );
}

function applySEO(v) {
  if (!v) return;

  // nguồn dữ liệu
  const title = v.title || "Video";
  const desc = (v.notes || v.description || v.title || "")
    .toString()
    .slice(0, 160);
  const image = absUrl(v.thumbnail || (v.images && v.images[0]));
  const pageUrl = location.origin + location.pathname; // canonical /video/<slug>
  const site = "Traingon.top";
  const locale = "en_US"; // hoặc "vi_VN" nếu bạn muốn
  const keywords =
    Array.isArray(v.tags) && v.tags.length ? v.tags.join(", ") : undefined;

  // <title>
  document.title = `${title} - ${site}`;

  // description
  upsertTag('meta[name="description"]', () => {
    const m = document.createElement("meta");
    m.setAttribute("name", "description");
    return m;
  }).setAttribute("content", desc);

  // keywords (không bắt buộc SEO, nhưng bạn muốn giống đối thủ)
  if (keywords) {
    upsertTag('meta[name="keywords"]', () => {
      const m = document.createElement("meta");
      m.setAttribute("name", "keywords");
      return m;
    }).setAttribute("content", `${title}, ${keywords}, ${site.toLowerCase()}`);
  }

  // robots (cho preview tối đa)
  upsertTag('meta[name="robots"]', () => {
    const m = document.createElement("meta");
    m.setAttribute("name", "robots");
    return m;
  }).setAttribute(
    "content",
    "index, follow, max-snippet:-1, max-video-preview:-1, max-image-preview:large",
  );

  // canonical
  upsertTag('link[rel="canonical"]', () => {
    const l = document.createElement("link");
    l.setAttribute("rel", "canonical");
    return l;
  }).setAttribute("href", pageUrl);

  // Open Graph
  upsertTag('meta[property="og:type"]', () => {
    const m = document.createElement("meta");
    m.setAttribute("property", "og:type");
    return m;
  }).setAttribute("content", "video.other");
  upsertTag('meta[property="og:locale"]', () => {
    const m = document.createElement("meta");
    m.setAttribute("property", "og:locale");
    return m;
  }).setAttribute("content", locale);
  upsertTag('meta[property="og:site_name"]', () => {
    const m = document.createElement("meta");
    m.setAttribute("property", "og:site_name");
    return m;
  }).setAttribute("content", site);
  upsertTag('meta[property="og:title"]', () => {
    const m = document.createElement("meta");
    m.setAttribute("property", "og:title");
    return m;
  }).setAttribute("content", `${title} - ${site}`);
  upsertTag('meta[property="og:description"]', () => {
    const m = document.createElement("meta");
    m.setAttribute("property", "og:description");
    return m;
  }).setAttribute("content", desc);
  if (image) {
    upsertTag('meta[property="og:image"]', () => {
      const m = document.createElement("meta");
      m.setAttribute("property", "og:image");
      return m;
    }).setAttribute("content", image);
    upsertTag('meta[property="og:image:type"]', () => {
      const m = document.createElement("meta");
      m.setAttribute("property", "og:image:type");
      return m;
    }).setAttribute("content", "image/jpeg");
    upsertTag('meta[property="og:image:alt"]', () => {
      const m = document.createElement("meta");
      m.setAttribute("property", "og:image:alt");
      return m;
    }).setAttribute("content", `${title} - ${site}`);
  }
  upsertTag('meta[property="og:url"]', () => {
    const m = document.createElement("meta");
    m.setAttribute("property", "og:url");
    return m;
  }).setAttribute("content", pageUrl);

  // Twitter
  upsertTag('meta[name="twitter:card"]', () => {
    const m = document.createElement("meta");
    m.setAttribute("name", "twitter:card");
    return m;
  }).setAttribute("content", "summary_large_image");
  upsertTag('meta[name="twitter:title"]', () => {
    const m = document.createElement("meta");
    m.setAttribute("name", "twitter:title");
    return m;
  }).setAttribute("content", `${title} - ${site}`);
  upsertTag('meta[name="twitter:description"]', () => {
    const m = document.createElement("meta");
    m.setAttribute("name", "twitter:description");
    return m;
  }).setAttribute("content", desc);
  if (image) {
    upsertTag('meta[name="twitter:image"]', () => {
      const m = document.createElement("meta");
      m.setAttribute("name", "twitter:image");
      return m;
    }).setAttribute("content", image);
  }

  // JSON-LD VideoObject
  let ld = document.getElementById("ld-video");
  if (!ld) {
    ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.id = "ld-video";
    document.head.appendChild(ld);
  }
  const ldObj = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: title,
    description: desc,
    thumbnailUrl: image ? image : undefined,
    uploadDate: isoDate(v.createdAt || v.updatedAt),
    duration: isoDuration(v.durationSeconds), // nếu có trường thời lượng (giây)
    contentUrl:
      v.embedUrls && v.embedUrls.length ? absUrl(v.embedUrls[0]) : undefined,
    url: pageUrl,
  };
  // enrich thêm nếu có
  if (Array.isArray(v.tags) && v.tags.length)
    ldObj.keywords = v.tags.join(", ");
  if (typeof v.views === "number")
    ldObj.interactionStatistic = {
      "@type": "InteractionCounter",
      interactionType: { "@type": "WatchAction" },
      userInteractionCount: v.views,
    };
  ld.textContent = JSON.stringify(ldObj);
}

// Render video player
// Thay thế toàn bộ hàm cũ bằng hàm mới này
function renderVideoPlayer() {
  const wrap = document.getElementById("videoPlayer");
  const url = (currentVideo.embedUrls || [])[currentServerIndex] || "";

  // Phát HLS hoặc file mp4/webm/ogg
  const isHls = /\.m3u8(\?|$)/i.test(url);
  const isFile = /\.(mp4|webm|ogg)(\?|$)/i.test(url);

  // Tạo khung video
  wrap.innerHTML = `
    <video id="html5player"
      class="plyr" 
      playsinline controls preload="metadata"
      style="width:100%;height:100%;background:#000;border-radius:12px;object-fit:contain;">
    </video>
  `;
  const el = document.getElementById("html5player");
  el.setAttribute("controlsList", "nodownload");
  el.addEventListener("contextmenu", (e) => e.preventDefault());

  // 1) Nạp CSS Plyr nếu chưa có
  if (!document.querySelector("link[data-plyr]")) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/plyr@3.7.8/dist/plyr.css";
    link.setAttribute("data-plyr", "1");
    document.head.appendChild(link);
  }

  // 2) Nạp JS Hls & Plyr (nếu chưa có)
  const loadAll = Promise.all([
    isHls
      ? loadScriptOnce("https://cdn.jsdelivr.net/npm/hls.js@latest", "Hls")
      : Promise.resolve(),
    loadScriptOnce(
      "https://cdn.jsdelivr.net/npm/plyr@3.7.8/dist/plyr.min.js",
      "Plyr",
    ),
  ]);

  loadAll
    .then(() => {
      let player;

      // Khởi tạo Plyr với bộ control gọn, đẹp
      const plyrOptions = {
        controls: [
          "play-large",
          "play",
          "progress",
          "current-time",
          "duration",
          "mute",
          "fast-forward",
          "settings",
          "pip",
          "airplay",
          "fullscreen",
        ],
        seekTime: 10, // tua 10s
        settings: ["quality", "speed"],
        ratio: "16:9",
        muted: false,
        volume: 1, // mặc định 100%
        storage: { enabled: false }, // không nhớ volume giữa các phiên
      };

      if (isHls) {
        if (window.Hls && window.Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(url);
          hls.attachMedia(el);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            player = new Plyr(el, plyrOptions);
          });
        } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
          // Safari
          el.src = url;
          player = new Plyr(el, plyrOptions);
        } else {
          wrap.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:center;height:60vh;background:rgba(255,255,255,0.1);border-radius:16px;color:#a7a7b3;text-align:center;">
            <div>
              <div style="font-size:2rem;margin-bottom:1rem;">⚠️</div>
              <div>Trình duyệt không hỗ trợ HLS</div>
            </div>
          </div>`;
        }
      } else if (isFile) {
        el.src = url;
        player = new Plyr(el, plyrOptions);
      } else {
        // Trường hợp là iframe/embed khác → nhúng trực tiếp
        wrap.innerHTML = `
        <div style="position:relative;padding-top:56.25%;border-radius:12px;overflow:hidden;background:#000;">
          <iframe src="${url}" allowfullscreen
            style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"></iframe>
        </div>
      `;
      }
    })
    .catch((e) => {
      console.error("Init Plyr/HLS error:", e);
      wrap.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:60vh;background:rgba(255,255,255,0.1);border-radius:16px;color:#a7a7b3;text-align:center;">
        <div>
          <div style="font-size:2rem;margin-bottom:1rem;">❌</div>
          <div>Không thể khởi tạo trình phát</div>
        </div>
      </div>`;
    });
}

// Switch server
function switchServer(index) {
  currentServerIndex = index;

  // Update active button
  document.querySelectorAll(".server-btn").forEach((btn, i) => {
    btn.classList.toggle("active", i === index);
  });

  // Re-render player
  renderVideoPlayer();
}

// Render video details
function renderVideoDetails() {
  const videoDetails = document.getElementById("videoDetails");

  const tags = currentVideo.tags
    ? currentVideo.tags
        .map(
          (tag) =>
            `<button type="button" class="tag" data-tag="${escapeHtml(
              tag,
            )}">${escapeHtml(tag)}</button>`,
        )
        .join("")
    : "";

  const dl = currentVideo.downloadLink;
  const downloadSection = dl
    ? `
    <a href="${dl}${dl.includes("?") ? "&" : "?"}dl=1"
       class="download-link"
       rel="noopener">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
      </svg>
      Download
    </a>
  `
    : "";

  videoDetails.innerHTML = `
        <h1 class="video-title">${currentVideo.title}</h1>
        <div class="video-meta">
            <div class="video-meta-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
                ${formatViews(currentVideo.views || 0)} views
            </div>
            <div class="video-meta-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
                    <path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                </svg>
                ${currentVideo.duration}
            </div>
            <div class="video-meta-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.1 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
                </svg>
                ${formatDate(currentVideo.createdAt)}
            </div>
        </div>
        ${tags ? `<div class="video-tags">${tags}</div>` : ""}
        ${currentVideo.notes ? `<div class="video-description">${currentVideo.notes}</div>` : ""}
        ${downloadSection}
    `;

  videoDetails.style.display = "block";
  attachTagHandlers();
}

function attachTagHandlers() {
  const tagsContainer = document.querySelector(".video-tags");
  if (!tagsContainer) {
    hideTagResults({ clearActive: true });
    return;
  }

  const buttons = tagsContainer.querySelectorAll(".tag");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tag = btn.dataset.tag || btn.textContent.trim();
      if (!tag) return;
      if (
        tag === currentTagFilter &&
        tagResultsSection &&
        tagResultsSection.style.display !== "none"
      ) {
        hideTagResults();
        return;
      }
      showTagResults(tag);
    });
  });
}

function setActiveTagButton(tag) {
  const buttons = document.querySelectorAll(".video-tags .tag");
  buttons.forEach((btn) => {
    btn.classList.toggle("active", Boolean(tag) && btn.dataset.tag === tag);
  });
}

async function showTagResults(tag) {
  if (!tagResultsSection || !tagResultsGrid || !tagResultsTitle) return;

  currentTagFilter = tag;
  setActiveTagButton(tag);

  tagResultsSection.style.display = "block";
  tagResultsTitle.textContent = `Videos tagged "${tag}"`;
  if (tagResultsSubtitle)
    tagResultsSubtitle.textContent = "Đang tải danh sách video...";
  tagResultsGrid.innerHTML = `
    <div class="tag-results-loading">
      <span></span>
      <p>Loading videos...</p>
    </div>
  `;

  try {
    const response = await fetch(`/api/tags/${encodeURIComponent(tag)}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const videos = await response.json();
    const others = Array.isArray(videos)
      ? videos.filter((v) => v.id !== currentVideo?.id)
      : [];

    if (!Array.isArray(videos) || videos.length === 0) {
      tagResultsGrid.innerHTML =
        '<div class="tag-results-empty">Không tìm thấy video nào cho tag này.</div>';
      if (tagResultsSubtitle)
        tagResultsSubtitle.textContent = "Không có video nào được gắn tag này.";
    } else if (others.length === 0) {
      tagResultsGrid.innerHTML =
        '<div class="tag-results-empty">Chỉ có video hiện tại được gắn tag này. Hãy thêm video khác để mở rộng danh sách.</div>';
      if (tagResultsSubtitle)
        tagResultsSubtitle.textContent = "Chưa có video nào khác với tag này.";
    } else {
      tagResultsGrid.innerHTML = renderTagResultCards(others);
      if (tagResultsSubtitle) {
        const count = others.length;
        tagResultsSubtitle.textContent =
          count === 1
            ? "Tìm thấy 1 video khác có tag này."
            : `Tìm thấy ${count} video khác có tag này.`;
      }
    }

    tagResultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error("Tag results error:", error);
    tagResultsGrid.innerHTML = `
      <div class="tag-results-empty">
        Không thể tải danh sách video. Vui lòng thử lại sau.
      </div>
    `;
    if (tagResultsSubtitle)
      tagResultsSubtitle.textContent = "Đã xảy ra lỗi khi tải video theo tag.";
  }
}

function hideTagResults({ clearActive = true } = {}) {
  if (tagResultsSection) {
    tagResultsSection.style.display = "none";
  }
  if (tagResultsGrid) tagResultsGrid.innerHTML = "";
  if (tagResultsTitle) tagResultsTitle.textContent = "";
  if (tagResultsSubtitle) tagResultsSubtitle.textContent = "";
  if (clearActive) setActiveTagButton(null);
  currentTagFilter = null;
}

function renderTagResultCards(videos) {
  return videos
    .map((video) => {
      const slug = slugifyTitle(video.title || video.id || "");
      const href = slug
        ? `/video/${slug}`
        : `/watch/${encodeURIComponent(video.id)}`;
      const thumbnail = escapeHtml(
        video.thumbnail || FALLBACK_THUMBNAIL_SRC,
      );
      return `
        <a class="video-card related-video-card" href="${href}">
          <div class="video-thumbnail">
            <img src="${thumbnail}" alt="${escapeHtml(
        video.title,
      )}" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_THUMBNAIL_SRC}'">
            <div class="video-duration">${escapeHtml(video.duration || "")}</div>
          </div>
          <div class="video-info">
            <h3 class="video-title">${escapeHtml(video.title)}</h3>
            <div class="video-meta">
              <div class="video-views">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
                ${formatViews(video.views || 0)}
              </div>
            </div>
          </div>
        </a>
      `;
    })
    .join("");
}

// Load related videos - SỬA LẠI HOÀN TOÀN
async function loadRelatedVideos() {
  try {
    console.log("Loading related videos for video ID:", currentVideo.id);

    // Show loading state
    const relatedGrid = document.getElementById("relatedGrid");
    if (!relatedGrid) {
      console.error("Related grid element not found");
      return;
    }

    // Show loading skeleton
    relatedGrid.innerHTML = `
            <div class="related-loading">
                <div class="related-skeleton"></div>
                <div class="related-skeleton"></div>
                <div class="related-skeleton"></div>
                <div class="related-skeleton"></div>
            </div>
        `;

    const response = await fetch(`/api/videos/${currentVideo.id}/related`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const relatedVideos = await response.json();
    console.log("Related videos received:", relatedVideos);

    if (relatedVideos.length === 0) {
      relatedGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: #a7a7b3;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📹</div>
                    <h3 style="color: #eaeaea; margin-bottom: 1rem;">Chưa có video liên quan</h3>
                    <p>Hãy thêm nhiều video hơn để có gợi ý phù hợp</p>
                    <a href="/" style="display: inline-block; margin-top: 1rem; background: linear-gradient(135deg, #ff6b6b, #ff5252); color: white; padding: 0.75rem 1.5rem; border-radius: 12px; text-decoration: none;">
                        Khám phá thêm video
                    </a>
                </div>
            `;
      return;
    }

    // Render related videos
    relatedGrid.innerHTML = relatedVideos
      .map((video) => {
        const slug = slugifyTitle(video.title || "");
        const href = slug
          ? `/video/${slug}`
          : `/watch/${encodeURIComponent(video.id)}`;
        const thumbnail = escapeHtml(
          video.thumbnail || FALLBACK_THUMBNAIL_SRC,
        );
        const title = escapeHtml(video.title);
        const duration = escapeHtml(video.duration || "");
        const viewsLabel = formatViews(video.views || 0);
        return `
            <a class="video-card related-video-card" href="${href}">
                <div class="video-thumbnail">
                    <img src="${thumbnail}" alt="${title}" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_THUMBNAIL_SRC}'">
                    <div class="video-duration">${duration}</div>
                </div>
                <div class="video-info">
                    <h3 class="video-title">${title}</h3>
                    <div class="video-meta">
                        <div class="video-views">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                            </svg>
                            ${viewsLabel}
                        </div>
                    </div>
                </div>
            </a>
        `;
      })
      .join("");

    console.log("Related videos rendered successfully");
  } catch (error) {
    console.error("Error loading related videos:", error);
    const relatedGrid = document.getElementById("relatedGrid");
    if (relatedGrid) {
      relatedGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: #ff4757;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                    <h3 style="color: #eaeaea; margin-bottom: 1rem;">Lỗi tải video liên quan</h3>
                    <p style="margin-bottom: 2rem;">Không thể tải danh sách video gợi ý</p>
                    <button onclick="loadRelatedVideos()" style="background: linear-gradient(135deg, #ff6b6b, #ff5252); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 12px; cursor: pointer; font-weight: 600;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 0.5rem;">
                            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                        </svg>
                        Thử lại
                    </button>
                </div>
            `;
    }
  }
}

// Function to navigate to another video
function slugifyTitle(title) {
  return String(title || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function navigateToVideo(videoId, title) {
  const base = title || (currentVideo && currentVideo.title) || "";
  const slug = slugifyTitle(base);
  window.location.href = `/video/${slug || encodeURIComponent(videoId)}`;
}

// Setup mobile chat
function setupMobileChat() {
  const isMobile = window.innerWidth <= 1023;
  const desktopChat = document.querySelector(".desktop-chat");
  const mobileChat = document.querySelector(".mobile-chat");
  const chatAccordion = document.querySelector(".chat-accordion");
  const chatContent = document.querySelector(".chat-content");

  if (isMobile) {
    if (desktopChat) desktopChat.style.display = "none";
    if (mobileChat) mobileChat.style.display = "block";

    // Ẩn nút mở/đóng và MỞ SẴN chat
    if (chatAccordion) chatAccordion.style.display = "none";
    if (chatContent) chatContent.classList.add("active");
  } else {
    if (desktopChat) desktopChat.style.display = "block";
    if (mobileChat) mobileChat.style.display = "none";
  }
}

// Format views count
function formatViews(views) {
  const oneDecimal = (n) => n.toFixed(1).replace(/\.0$/, "");
  if (views >= 1000000000) {
    // 1B+
    return oneDecimal(views / 1000000000) + "B";
  } else if (views >= 1000000) {
    // 1M+
    return oneDecimal(views / 1000000) + "M";
  } else if (views >= 1000) {
    // 1K+
    return oneDecimal(views / 1000) + "K";
  }
  return views.toString();
}

// Format date
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("vi-VN");
}

// Make functions global
window.navigateToVideo = navigateToVideo;
window.loadRelatedVideos = loadRelatedVideos;
window.switchServer = switchServer;

// Initialize everything
document.addEventListener("DOMContentLoaded", () => {
  console.log("Video page loaded");
  loadVideo();

  // Handle window resize for mobile chat
  window.addEventListener("resize", () => {
    setupMobileChat();
  });
});

/***** ============ EXOCLICK DUAL POP (PAGE + DOWNLOAD) ============ *****/
// ĐÃ ĐIỀN SẴN ZONE ID:
//  - Cú 1 (toàn trang): 5711248
//  - Cú 2 (nút download): 5700208
const EXO_ZONE_PAGE_CLICK = "5711248"; // click toàn trang
const EXO_ZONE_DOWNLOAD = "5700208"; // click nút download (class .download-link)

(function setupExoDualPop() {
  if (window.__exo_dual_setup) return;
  window.__exo_dual_setup = true;

  function _exoClearGlobals() {
    [
      "ad_idzone",
      "ad_popup_fallback",
      "ad_popup_force",
      "ad_chrome_enabled",
      "ad_new_tab",
      "ad_frequency_period",
      "ad_frequency_count",
      "ad_trigger_method",
      "ad_trigger_class",
      "ad_trigger_delay",
      "ad_capping_enabled",
    ].forEach((k) => {
      try {
        delete window[k];
      } catch (e) {}
    });
  }

  function _exoInjectConfig(cfg) {
    const s = document.createElement("script");
    s.type = "application/javascript";
    s.text = `
      var ad_idzone = "${cfg.zone}";
      var ad_popup_fallback = false;
      var ad_popup_force = true;
      var ad_chrome_enabled = true;
      var ad_new_tab = true;

      var ad_frequency_period = ${cfg.freqPeriod ?? 5};
      var ad_frequency_count  = ${cfg.freqCount ?? 1};

      var ad_trigger_method = ${cfg.method};
      ${cfg.method === 2 ? `var ad_trigger_class = "${cfg.cls || "download-link"}";` : ""}
      var ad_trigger_delay = ${cfg.delay ?? 0};
      var ad_capping_enabled = false;
    `;
    document.body.appendChild(s);
  }

  function _exoLoadLib() {
    const lib = document.createElement("script");
    lib.src = "https://a.pemsrv.com/popunder1000.js";
    lib.async = true;
    document.body.appendChild(lib);
  }

  function initExo(cfg) {
    _exoClearGlobals();
    _exoInjectConfig(cfg);
    _exoLoadLib();
  }

  // —— CÚ 1: CLICK TOÀN TRANG (ZONE 5711248) — chỉ init 1 lần ——
  function initPageClickOnce() {
    if (window.__exo_page_click_inited) return;
    window.__exo_page_click_inited = true;
    initExo({
      zone: EXO_ZONE_PAGE_CLICK,
      method: 1,
      freqCount: 1,
      freqPeriod: 5,
    });
  }

  // —— CÚ 2: NÚT DOWNLOAD (ZONE 5700208) — init khi nút xuất hiện ——
  function initDownloadClickWhenReady() {
    if (window.__exo_dl_inited) return;

    const btn = document.querySelector(".download-link");
    if (btn) {
      window.__exo_dl_inited = true;
      initExo({
        zone: EXO_ZONE_DOWNLOAD,
        method: 2,
        cls: "download-link",
        freqCount: 1,
        freqPeriod: 5,
      });
      return;
    }

    // Chưa có nút → chờ render xong mới init (an toàn với render động)
    const obs = new MutationObserver(() => {
      const b = document.querySelector(".download-link");
      if (b) {
        obs.disconnect();
        if (!window.__exo_dl_inited) {
          window.__exo_dl_inited = true;
          initExo({
            zone: EXO_ZONE_DOWNLOAD,
            method: 2,
            cls: "download-link",
            freqCount: 1,
            freqPeriod: 5,
          });
        }
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  // Khởi động:
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPageClickOnce, {
      once: true,
    });
  } else {
    initPageClickOnce();
  }
  initDownloadClickWhenReady();
})();
/***** ============ /EXOCLICK DUAL POP ============ *****/
