let currentVideo = null;
let currentServerIndex = 0;

// Get video ID from URL
// Hỗ trợ cả /watch/:id/:slug và /video.html?id=
function getVideoId() {
  const m = location.pathname.match(/^\/watch\/([^\/]+)/);
  if (m) return m[1];
  return new URLSearchParams(location.search).get("id");
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
  const videoId = getVideoId();
  if (!videoId) {
    window.location.href = "/";
    return;
  }

  try {
    console.log("Loading video with ID:", videoId);
    const response = await fetch(`/api/videos/${videoId}`);
    if (!response.ok) {
      throw new Error("Video not found");
    }

    currentVideo = await response.json();
    console.log("Video loaded:", currentVideo);

    // Update page title
    document.title = `${currentVideo.title} - Traingon.top`;

    // Render video
    renderVideo();

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
      class="plyr__video-embed" 
      playsinline controls preload="metadata"
      style="width:100%;height:100%;background:#000;border-radius:12px;object-fit:contain;">
    </video>
  `;
  const el = document.getElementById("html5player");
  el.setAttribute("controlsList", "nodownload");
  el.addEventListener("contextmenu", (e) => e.preventDefault());

  // 1) Nạp CSS Plyr nếu chưa có
  if (!document.querySelector('link[data-plyr]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/plyr@3.7.8/dist/plyr.css";
    link.setAttribute("data-plyr", "1");
    document.head.appendChild(link);
  }

  // 2) Nạp JS Hls & Plyr (nếu chưa có)
  const loadAll = Promise.all([
    isHls ? loadScriptOnce("https://cdn.jsdelivr.net/npm/hls.js@latest", "Hls") : Promise.resolve(),
    loadScriptOnce("https://cdn.jsdelivr.net/npm/plyr@3.7.8/dist/plyr.min.js", "Plyr"),
  ]);

  loadAll.then(() => {
    let player;

    // Khởi tạo Plyr với bộ control gọn, đẹp
    const plyrOptions = {
  controls: [
    'play-large','play','progress','current-time','duration','mute',
    // bỏ 'mute','volume'
    'settings','pip','airplay','fullscreen'
  ],
  settings: ['quality', 'speed'],
  ratio: '16:9',
  muted: false,
  volume: 1,                 // mặc định 100%
  storage: { enabled: false } // không nhớ volume giữa các phiên
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
  }).catch((e) => {
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
    ? currentVideo.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")
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
      Tải xuống
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
      .map(
        (video) => `
            <a class="video-card related-video-card" href="/watch/${video.id}/${(
              video.title || ""
            )
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, "")}">

                <div class="video-thumbnail">
                    <img src="${video.thumbnail}" alt="${video.title}" loading="lazy" onerror="this.src='/images/placeholder.jpg'">
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
            </a>
        `,
      )
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
function navigateToVideo(videoId, title) {
  const base = title || (currentVideo && currentVideo.title) || "";
  const slug = base
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  window.location.href = `/watch/${videoId}/${slug}`;
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
