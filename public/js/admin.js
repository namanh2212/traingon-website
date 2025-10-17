// Global state
let currentPage = 1;
let currentSearch = "";
let currentCategory = "";
let currentSort = "newest";
let isLoading = false;
let tags = [];
let adminAnnouncements = [];
let adminAnnouncementTimer = null;

// Initialize dashboard - CHỈ CHO TRANG DASHBOARD
function initDashboard() {
  console.log("Initializing dashboard");

  // Check các elements cần thiết có tồn tại không
  const loadingSkeleton = document.getElementById("loadingSkeleton");
  const videoTable = document.getElementById("videoTable");
  const searchInput = document.getElementById("searchInput");

  if (!loadingSkeleton || !videoTable || !searchInput) {
    console.error("Dashboard elements not found - not on dashboard page");
    return;
  }

  // Logout
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  // Search
  let searchTimeout;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentSearch = e.target.value.trim();
      currentPage = 1;
      loadVideos();
    }, 300);
  });

  // Filters
  const categoryFilter = document.getElementById("categoryFilter");
  if (categoryFilter) {
    categoryFilter.addEventListener("change", (e) => {
      currentCategory = e.target.value;
      currentPage = 1;
      loadVideos();
    });
  }

  const sortFilter = document.getElementById("sortFilter");
  if (sortFilter) {
    sortFilter.addEventListener("change", (e) => {
      currentSort = e.target.value;
      currentPage = 1;
      loadVideos();
    });
  }

  initAnnouncementManager();
  // Initial
  loadVideos();
}

function initAnnouncementManager() {
  const form = document.getElementById("announcementForm");
  const list = document.getElementById("announcementList");
  if (!form || !list) return;

  const panel = document.getElementById("announcementPanel");
  const toggle = document.getElementById("announcementToggle");
  const messageInput = document.getElementById("announcementMessage");
  const durationInput = document.getElementById("announcementDuration");
  const unitSelect = document.getElementById("announcementUnit");
  const submitBtn = form.querySelector(".send-announcement");

  const setSubmitting = (state) => {
    if (!submitBtn) return;
    if (state) {
      submitBtn.setAttribute("disabled", "true");
      submitBtn.classList.add("is-loading");
    } else {
      submitBtn.removeAttribute("disabled");
      submitBtn.classList.remove("is-loading");
    }
  };

  let announcementsLoaded = false;

  const updateToggleState = (expanded) => {
    if (!toggle) return;
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    toggle.classList.toggle("is-active", expanded);
    toggle.textContent = expanded ? "Ẩn thông báo" : "Thông báo";
  };

  const closePanel = () => {
    if (!panel) return;
    panel.setAttribute("hidden", "true");
    updateToggleState(false);
    stopAdminAnnouncementCountdown();
  };

  const openPanel = async () => {
    if (!panel) return;
    panel.removeAttribute("hidden");
    updateToggleState(true);
    if (!announcementsLoaded) {
      await loadAdminAnnouncements();
      announcementsLoaded = true;
    } else {
      loadAdminAnnouncements();
    }
  };

  if (toggle && panel) {
    updateToggleState(!panel.hasAttribute("hidden"));
    toggle.addEventListener("click", async () => {
      if (panel.hasAttribute("hidden")) {
        await openPanel();
      } else {
        closePanel();
      }
    });

    if (!panel.hasAttribute("hidden")) {
      openPanel();
    }
  } else {
    loadAdminAnnouncements().finally(() => {
      announcementsLoaded = true;
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = (messageInput?.value || "").trim();
    const durationValue = Number(durationInput?.value);
    const durationUnit = unitSelect?.value || "hours";

    if (!message) {
      if (typeof showToast === "function")
        showToast("Vui lòng nhập nội dung thông báo", "error");
      else alert("Vui lòng nhập nội dung thông báo");
      return;
    }

    if (!Number.isFinite(durationValue) || durationValue <= 0) {
      if (typeof showToast === "function")
        showToast("Thời gian hiển thị phải lớn hơn 0", "error");
      else alert("Thời gian hiển thị phải lớn hơn 0");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, durationValue, durationUnit }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const errMessage =
          payload?.error || "Gửi thông báo thất bại. Vui lòng thử lại.";
        if (typeof showToast === "function") showToast(errMessage, "error");
        else alert(errMessage);
        return;
      }

      if (typeof showToast === "function")
        showToast("Đã gửi thông báo", "success");
      form.reset();
      if (durationInput) durationInput.value = "12";
      await loadAdminAnnouncements();
      announcementsLoaded = true;
    } catch (error) {
      console.error("Submit announcement error:", error);
      if (typeof showToast === "function")
        showToast("Không thể gửi thông báo", "error");
      else alert("Không thể gửi thông báo");
    } finally {
      setSubmitting(false);
    }
  });
}

async function loadAdminAnnouncements() {
  const list = document.getElementById("announcementList");
  if (!list) return;

  try {
    const res = await fetch("/api/admin/announcements", {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    adminAnnouncements = Array.isArray(data) ? data : [];
    renderAdminAnnouncements();
  } catch (error) {
    console.error("Load admin announcements error:", error);
    stopAdminAnnouncementCountdown();
    if (!list.children.length) {
      const msg = document.createElement("div");
      msg.className = "announcement-empty";
      msg.textContent = "Không thể tải danh sách thông báo.";
      list.appendChild(msg);
    }
  }
}

function renderAdminAnnouncements() {
  const list = document.getElementById("announcementList");
  if (!list) return;

  stopAdminAnnouncementCountdown();
  list.innerHTML = "";

  if (!adminAnnouncements.length) {
    const empty = document.createElement("div");
    empty.className = "announcement-empty";
    empty.textContent = "Chưa có thông báo nào.";
    list.appendChild(empty);
    return;
  }

  const now = Date.now();
  adminAnnouncements.forEach((item) => {
    const card = document.createElement("div");
    const announcementId = String(item.id || "");
    card.className = "announcement-card";
    card.dataset.id = announcementId;

    const messageEl = document.createElement("div");
    messageEl.className = "announcement-card-message";
    messageEl.appendChild(buildAnnouncementMessageFragment(item.message || ""));
    card.appendChild(messageEl);

    const meta = document.createElement("div");
    meta.className = "announcement-card-meta";

    const expiresAt = new Date(item.expiresAt || item.expiredAt || item.expired_at);
    const expiresMs = expiresAt.getTime();

    const countdownWrap = document.createElement("span");
    countdownWrap.className = "announcement-meta-item";
    const countdownLabel = document.createElement("span");
    countdownLabel.textContent = "⏳ Còn lại:";
    const countdownValue = document.createElement("strong");
    countdownValue.className = "announcement-countdown";
    countdownValue.dataset.expiresAt = String(expiresMs);
    countdownValue.textContent = formatAnnouncementCountdown(expiresMs - now);
    countdownWrap.append(countdownLabel, countdownValue);

    const createdWrap = document.createElement("span");
    createdWrap.className = "announcement-meta-item";
    const createdLabel = document.createElement("span");
    createdLabel.textContent = "🕒 Tạo lúc:";
    const createdValue = document.createElement("strong");
    createdValue.textContent = formatAnnouncementDateTime(item.createdAt);
    createdWrap.append(createdLabel, createdValue);

    meta.append(countdownWrap, createdWrap);
    card.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "announcement-card-actions";
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "announcement-delete";
    deleteBtn.textContent = "Xóa thông báo";
    deleteBtn.addEventListener("click", () => {
      const performDelete = () => deleteAdminAnnouncement(announcementId);
      if (typeof showConfirmModal === "function") {
        showConfirmModal(
          "Xóa thông báo",
          "Bạn có chắc chắn muốn xóa thông báo này ngay lập tức?",
          performDelete,
        );
      } else if (window.confirm("Bạn có chắc chắn muốn xóa thông báo này?")) {
        performDelete();
      }
    });
    actions.appendChild(deleteBtn);
    card.appendChild(actions);

    list.appendChild(card);
  });

  startAdminAnnouncementCountdown();
}

async function deleteAdminAnnouncement(id) {
  if (!id) return;

  try {
    const res = await fetch(`/api/admin/announcements/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      const message = payload?.error || "Không thể xóa thông báo.";
      if (typeof showToast === "function") showToast(message, "error");
      else alert(message);
      return;
    }

    if (typeof showToast === "function") showToast("Đã xóa thông báo", "success");
    await loadAdminAnnouncements();
  } catch (error) {
    console.error("Delete announcement error:", error);
    if (typeof showToast === "function")
      showToast("Không thể xóa thông báo", "error");
    else alert("Không thể xóa thông báo");
  }
}

function buildAnnouncementMessageFragment(text) {
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

function startAdminAnnouncementCountdown() {
  stopAdminAnnouncementCountdown();
  if (!adminAnnouncements.length) return;

  adminAnnouncementTimer = setInterval(() => {
    const now = Date.now();
    let changed = false;

    document.querySelectorAll(".announcement-card").forEach((card) => {
      const countdown = card.querySelector(".announcement-countdown");
      if (!countdown) return;
      const expiresMs = Number(countdown.dataset.expiresAt);
      if (!Number.isFinite(expiresMs)) return;

      const diff = expiresMs - now;
      if (diff <= 0) {
        const id = card.dataset.id;
        card.remove();
        if (id) {
          adminAnnouncements = adminAnnouncements.filter(
            (item) => String(item.id) !== String(id),
          );
        }
        changed = true;
      } else {
        countdown.textContent = formatAnnouncementCountdown(diff);
      }
    });

    if (changed && adminAnnouncements.length === 0) {
      stopAdminAnnouncementCountdown();
      const list = document.getElementById("announcementList");
      if (list) {
        list.innerHTML = "";
        const empty = document.createElement("div");
        empty.className = "announcement-empty";
        empty.textContent = "Chưa có thông báo nào.";
        list.appendChild(empty);
      }
    }
  }, 1000);
}

function stopAdminAnnouncementCountdown() {
  if (adminAnnouncementTimer) {
    clearInterval(adminAnnouncementTimer);
    adminAnnouncementTimer = null;
  }
}

function formatAnnouncementCountdown(diffMs) {
  if (!Number.isFinite(diffMs) || diffMs <= 0) return "00:00";
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => n.toString().padStart(2, "0");
  if (days > 0) {
    return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatAnnouncementDateTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("vi-VN", { hour12: false });
}

// ==== B2 AUTO-NORMALIZE (friendly endpoint -> cần /file/) ====
function __b2_buildCacheUrl(bucket, key, search) {
  const safePath = String(key)
    .split("/")
    .filter(Boolean)
    .map((seg) =>
      encodeURIComponent(decodeURIComponent(seg.replace(/\+/g, " "))),
    )
    .join("/");
  return `https://b2.traingon.top/file/${encodeURIComponent(bucket)}/${safePath}${search || ""}`;
}
function normalizeB2(url) {
  if (!url || typeof url !== "string") return (url || "").trim();
  url = url.trim();
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const parts = u.pathname.split("/").filter(Boolean);
    if (
      host.startsWith("f") &&
      host.endsWith(".backblazeb2.com") &&
      parts[0] === "file" &&
      parts.length >= 3
    ) {
      const bucket = parts[1];
      const key = parts.slice(2).join("/");
      return __b2_buildCacheUrl(bucket, key, u.search);
    }
    if (/\.s3\.[^/]+\.backblazeb2\.com$/.test(host)) {
      const bucket = host.split(".s3.")[0];
      const key = u.pathname.replace(/^\/+/, "");
      return key ? __b2_buildCacheUrl(bucket, key, u.search) : url;
    }
    if (/^s3\.[^/]+\.backblazeb2\.com$/.test(host) && parts.length >= 2) {
      const bucket = parts[0];
      const key = parts.slice(1).join("/");
      return __b2_buildCacheUrl(bucket, key, u.search);
    }
    return url;
  } catch {
    return url;
  }
}

function attachEmbedNormalization(input) {
  if (!input) return;
  const handler = () => {
    const raw = (input.value || "").trim();
    if (!raw) return;
    const norm = normalizeB2(raw);
    if (norm !== raw) input.value = norm;
  };
  ["blur", "change"].forEach((ev) => input.addEventListener(ev, handler));
  input.addEventListener("paste", () => setTimeout(handler, 0));
}

function createEmbedListController({
  container,
  addButton,
  namePrefix,
  placeholderPrefix = "Server",
  min = 1,
  max = 10,
  requiredFirst = true,
}) {
  if (!container || !namePrefix) return null;
  const settings = {
    container,
    addButton,
    namePrefix,
    placeholderPrefix,
    min: Math.max(0, Number(min) || 0),
    max: Math.max(0, Number(max) || 0),
    requiredFirst: Boolean(requiredFirst),
  };

  const buildGroup = (value = "") => {
    const group = document.createElement("div");
    group.className = "embed-input-group";

    const content = document.createElement("div");
    content.className = "embed-input-content";

    const input = document.createElement("input");
    input.type = "url";
    input.className = "form-input";
    input.autocomplete = "off";
    content.appendChild(input);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "embed-remove-btn";
    removeBtn.textContent = "Xóa";
    removeBtn.addEventListener("click", () => {
      const groups = settings.container.querySelectorAll(".embed-input-group");
      if (groups.length <= Math.max(1, settings.min)) {
        input.value = "";
        input.focus();
        return;
      }
      group.remove();
      renumber();
    });
    content.appendChild(removeBtn);

    group.appendChild(content);

    const error = document.createElement("div");
    error.className = "form-error";
    group.appendChild(error);

    if (typeof value === "string" && value.trim()) {
      const norm = normalizeB2(value.trim());
      input.value = norm;
    }
    attachEmbedNormalization(input);
    return group;
  };

  const renumber = () => {
    const groups = settings.container.querySelectorAll(".embed-input-group");
    groups.forEach((group, idx) => {
      const input = group.querySelector('input[type="url"]');
      const error = group.querySelector(".form-error");
      const removeBtn = group.querySelector(".embed-remove-btn");
      const index = idx + 1;
      if (input) {
        input.name = `${settings.namePrefix}${index}`;
        input.placeholder = `${settings.placeholderPrefix} ${index}`;
        if (settings.requiredFirst) input.required = idx === 0;
      }
      if (error) error.id = `${settings.namePrefix}${index}Error`;
      if (removeBtn) {
        const groupsCount = groups.length;
        const canRemove =
          groupsCount > Math.max(1, settings.min) || settings.min === 0;
        removeBtn.classList.toggle(
          "hidden",
          !canRemove || (settings.requiredFirst && idx === 0 && groupsCount <= settings.min),
        );
        removeBtn.disabled =
          !canRemove || (settings.requiredFirst && idx === 0 && groupsCount <= settings.min);
      }
    });
  };

  const ensureMinimum = () => {
    const existing = settings.container.querySelectorAll(".embed-input-group")
      .length;
    if (existing >= Math.max(1, settings.min)) return;
    const needed = Math.max(1, settings.min) - existing;
    for (let i = 0; i < needed; i++) {
      settings.container.appendChild(buildGroup(""));
    }
  };

  const addGroup = (value = "") => {
    const current = settings.container.querySelectorAll(".embed-input-group")
      .length;
    if (settings.max && current >= settings.max) {
      if (typeof showToast === "function")
        showToast(`Tối đa ${settings.max} link embed`, "error");
      return null;
    }
    const group = buildGroup(value);
    settings.container.appendChild(group);
    renumber();
    return group;
  };

  if (settings.addButton) {
    if (settings.addButton.__embedHandler) {
      settings.addButton.removeEventListener(
        "click",
        settings.addButton.__embedHandler,
      );
    }
    settings.addButton.__embedHandler = () => {
      const group = addGroup("");
      if (group) {
        const input = group.querySelector('input[type="url"]');
        if (input) input.focus();
      }
    };
    settings.addButton.addEventListener(
      "click",
      settings.addButton.__embedHandler,
    );
  }

  const controller = {
    render(values = []) {
      settings.container.innerHTML = "";
      const arr = Array.isArray(values)
        ? values.filter((v) => typeof v === "string" && v.trim())
        : [];
      if (arr.length) {
        arr.forEach((value) => settings.container.appendChild(buildGroup(value)));
      }
      ensureMinimum();
      renumber();
    },
    add(value = "") {
      const group = addGroup(value);
      if (group) renumber();
    },
    clear() {
      settings.container.innerHTML = "";
      ensureMinimum();
      renumber();
    },
    getValues({ unique = true } = {}) {
      const values = [];
      const seen = new Set();
      settings.container
        .querySelectorAll('input[type="url"]')
        .forEach((input) => {
          const raw = (input.value || "").trim();
          if (!raw) return;
          const norm = normalizeB2(raw);
          if (norm !== raw) input.value = norm;
          if (!unique || !seen.has(norm)) {
            if (unique) seen.add(norm);
            values.push(norm);
          }
        });
      return values;
    },
    focusFirst() {
      const firstInput = settings.container.querySelector(
        '.embed-input-group input[type="url"]',
      );
      if (firstInput) firstInput.focus();
    },
  };

  settings.container.__controller = controller;
  controller.render([]);
  return controller;
}

// Loading states - CHỈ CHO DASHBOARD
function showLoadingSkeleton() {
  const loadingSkeleton = document.getElementById("loadingSkeleton");
  const videoTable = document.getElementById("videoTable");
  const videoCards = document.getElementById("videoCards");
  const emptyState = document.getElementById("emptyState");
  const errorState = document.getElementById("errorState");

  if (loadingSkeleton) loadingSkeleton.style.display = "block";
  if (videoTable) videoTable.style.display = "none";
  if (videoCards) videoCards.style.display = "none";
  if (emptyState) emptyState.style.display = "none";
  if (errorState) errorState.style.display = "none";
}
function hideLoadingSkeleton() {
  const loadingSkeleton = document.getElementById("loadingSkeleton");
  const videoTable = document.getElementById("videoTable");
  const videoCards = document.getElementById("videoCards");

  if (loadingSkeleton) loadingSkeleton.style.display = "none";
  if (window.innerWidth > 768) {
    if (videoTable) videoTable.style.display = "block";
  } else {
    if (videoCards) videoCards.style.display = "block";
  }
}
function showEmptyState() {
  const emptyState = document.getElementById("emptyState");
  const errorState = document.getElementById("errorState");
  if (emptyState) emptyState.style.display = "block";
  if (errorState) errorState.style.display = "none";
}
function showErrorState() {
  const errorState = document.getElementById("errorState");
  const emptyState = document.getElementById("emptyState");
  if (errorState) errorState.style.display = "block";
  if (emptyState) emptyState.style.display = "none";
}

// Load videos - CHỈ CHO DASHBOARD
async function loadVideos() {
  if (isLoading) return;

  // Not on dashboard page?
  const loadingSkeleton = document.getElementById("loadingSkeleton");
  if (!loadingSkeleton) {
    console.log("Not on dashboard page, skipping loadVideos");
    return;
  }

  isLoading = true;
  showLoadingSkeleton();

  try {
    const params = new URLSearchParams({
      page: currentPage,
      limit: 20,
      search: currentSearch,
      category: currentCategory,
      sort: currentSort,
    });

    const response = await fetch(`/api/admin/videos?${params}`, {
      credentials: "include",
    });
    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = "/admin/login.html";
        return;
      }
      throw new Error("Failed to load videos");
    }

    const data = await response.json();
    hideLoadingSkeleton();

    if (!data.videos?.length) {
      showEmptyState();
    } else {
      renderVideos(data.videos);
      renderPagination(data.pagination);
    }
    updateStats(data.pagination.total);
  } catch (err) {
    console.error("Error loading videos:", err);
    hideLoadingSkeleton();
    showErrorState();
  } finally {
    isLoading = false;
  }
}

// ====== ADD VIDEO PAGE ======
function initAddVideoForm() {
  console.log("Initializing add video form");

  const form = document.getElementById("addVideoForm");
  if (!form) {
    console.error("Add video form not found");
    return;
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  initEmbedInputs();
  initSecondaryEmbedSection();
  initThumbnailHandling();
  initImageLinkHandling();
  initDurationFormatting();
  initCategoryHandling();
  initTagsHandling();
  initNotesCounter();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submitVideoForm(false);
  });

  const saveAndNewBtn = document.getElementById("saveAndNew");
  if (saveAndNewBtn) {
    saveAndNewBtn.addEventListener("click", () => submitVideoForm(true));
  }
}

// ====== EDIT VIDEO PAGE ======
function initEditVideoForm() {
  console.log("Initializing edit video form");

  const form = document.getElementById("updateVideoForm");
  if (!form) {
    console.error("Edit video form not found");
    showErrorState();
    return;
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  const urlParams = new URLSearchParams(window.location.search);
  const videoId = urlParams.get("id");
  if (!videoId) {
    console.error("No video ID provided");
    showEditErrorState();
    return;
  }

  console.log("Loading video for edit:", videoId);
  loadVideoForEdit(videoId);
}

async function loadVideoForEdit(videoId) {
  try {
    const loadingState = document.getElementById("loadingState");
    const editForm = document.getElementById("editForm");
    const errorState = document.getElementById("errorState");

    if (loadingState) loadingState.style.display = "block";
    if (editForm) editForm.style.display = "none";
    if (errorState) errorState.style.display = "none";

    const response = await fetch(
      `/api/admin/videos/${encodeURIComponent(videoId)}`,
      {
        credentials: "include",
      },
    );
    if (!response.ok) throw new Error("Video not found");

    const video = await response.json();
    if (!video) throw new Error("Video not found");

    if (loadingState) loadingState.style.display = "none";
    if (editForm) editForm.style.display = "block";

    populateEditForm(video);
  } catch (error) {
    console.error("Error loading video for edit:", error);
    const loadingState = document.getElementById("loadingState");
    const editForm = document.getElementById("editForm");
    const errorState = document.getElementById("errorState");
    if (loadingState) loadingState.style.display = "none";
    if (editForm) editForm.style.display = "none";
    if (errorState) errorState.style.display = "block";
  }
}

function populateEditForm(video) {
  console.log("Populating form with video data:", video);

  const videoIdElement = document.getElementById("videoId");
  const videoViewsElement = document.getElementById("videoViews");
  if (videoIdElement) videoIdElement.textContent = `ID: ${video.id}`;
  if (videoViewsElement) videoViewsElement.textContent = video.views || 0;

  const titleInput = document.getElementById("title");
  if (titleInput) titleInput.value = video.title || "";

  initEmbedInputs(video.embedUrls || []);

  const thumbnailUrlInput = document.getElementById("thumbnailUrlInput");
  if (video.thumbnail) {
    const norm = normalizeB2(video.thumbnail);
    if (thumbnailUrlInput) thumbnailUrlInput.value = norm;
    previewThumbnailUrl(norm);
  }

  const durationInput = document.getElementById("duration");
  if (durationInput) durationInput.value = video.duration || "";

  const categorySelect = document.getElementById("category");
  if (categorySelect) {
    categorySelect.value = video.category || "other";
    const downloadLinkGroup = document.getElementById("downloadLinkGroup");
    if (downloadLinkGroup) downloadLinkGroup.style.display = "block"; // luôn hiển thị
  }

  const publishedRadio = document.querySelector(
    `input[name="published"][value="${video.published !== false}"]`,
  );
  if (publishedRadio) publishedRadio.checked = true;

  const downloadLinkInput = document.getElementById("downloadLink");
  if (downloadLinkInput) downloadLinkInput.value = video.downloadLink || "";

  tags = video.tags || [];
  renderEditTags();

  const notesTextarea = document.getElementById("notes");
  const notesCount = document.getElementById("notesCount");
  if (notesTextarea) {
    notesTextarea.value = video.notes || "";
    if (notesCount) notesCount.textContent = (video.notes || "").length;
  }

  initThumbnailHandling();
  initSecondaryEmbedSection(video.secondaryEmbedUrls || []);
  initImageLinkHandling(video.imageUrls || []);
  initDurationFormatting();
  initCategoryHandling();
  initEditTagsHandling();
  initNotesCounter();

  const form = document.getElementById("updateVideoForm");
  if (form) {
    form.removeEventListener("submit", handleEditFormSubmit);
    form.addEventListener("submit", handleEditFormSubmit);
  }

  window.currentEditVideoId = video.id;
}

function handleEditFormSubmit(e) {
  e.preventDefault();
  submitEditVideoForm(window.currentEditVideoId);
}

function renderEditTags() {
  const tagsDisplay = document.getElementById("tagsDisplay");
  if (tagsDisplay) {
    tagsDisplay.innerHTML = tags
      .map(
        (tag, index) => `
      <span class="tag-chip">
        ${tag}
        <button type="button" class="tag-remove" onclick="removeTagByIndex(${index})">×</button>
      </span>`,
      )
      .join("");
  }
}
function initEditTagsHandling() {
  const tagsInput = document.getElementById("tagsInput");
  window.removeTagByIndex = (i) => {
    tags.splice(i, 1);
    renderEditTags();
  };
  if (!tagsInput) return;
  tagsInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = tagsInput.value.trim();
      if (tag && !tags.includes(tag)) {
        tags.push(tag);
        renderEditTags();
      }
      tagsInput.value = "";
    } else if (
      e.key === "Backspace" &&
      tagsInput.value === "" &&
      tags.length > 0
    ) {
      tags.pop();
      renderEditTags();
    }
  });

  // Nút + Tag (mobile-friendly)
  const addTagBtn = document.getElementById("addTagBtn");
  if (addTagBtn) {
    addTagBtn.addEventListener("click", () => {
      const t = tagsInput.value.trim();
      if (t && !tags.includes(t)) {
        tags.push(t);
        // dùng renderEditTags() sẵn có
        const tagsDisplay = document.getElementById("tagsDisplay");
        tagsDisplay.innerHTML = tags
          .map(
            (tag, index) => `
            <span class="tag-chip">
              ${tag}
              <button type="button" class="tag-remove" onclick="removeTagByIndex(${index})">×</button>
            </span>`,
          )
          .join("");
      }
      tagsInput.value = "";
      tagsInput.focus();
    });
  }
}

async function submitEditVideoForm(videoId) {
  const form = document.getElementById("updateVideoForm");
  if (!form) return;
  if (!form.reportValidity()) return;

  const formData = new FormData(form);

  const embedInputsContainer = document.getElementById("embedInputs");
  const primaryController = embedInputsContainer?.__controller || null;
  const embedUrls = primaryController ? primaryController.getValues() : [];
  if (!embedUrls.length) {
    showToast("Vui lòng nhập ít nhất một embed URL", "error");
    return;
  }
  formData.set("embedUrls", JSON.stringify(embedUrls));

  const secondarySection = document.getElementById("secondaryEmbedSection");
  const secondaryController = secondarySection?.__controller;
  const secondaryEmbedUrls =
    secondaryController && typeof secondaryController.getValues === "function"
      ? secondaryController.getValues()
      : [];
  formData.set("secondaryEmbedUrls", JSON.stringify(secondaryEmbedUrls));

  const imageInputs = document.querySelectorAll(".image-link-input");
  const imageUrls = [];
  imageInputs.forEach((input) => {
    if (!input) return;
    const raw = (input.value || "").trim();
    if (!raw) return;
    const norm = normalizeB2(raw);
    if (norm !== raw) input.value = norm;
    if (!imageUrls.includes(norm)) imageUrls.push(norm);
  });
  formData.set("imageUrls", JSON.stringify(imageUrls));

  // tags
  formData.set("tags", JSON.stringify(tags));

  // thumbnail
  const thumbnailType = document.querySelector(
    'input[name="thumbnailType"]:checked',
  )?.value;
  if (thumbnailType === "url") {
    const el = document.getElementById("thumbnailUrlInput");
    const raw = (el?.value || "").trim();
    if (raw) {
      const norm = normalizeB2(raw);
      if (el) el.value = norm;
      formData.set("thumbnailUrl", norm);
    }
    formData.delete("thumbnail");
  }

  // Normalize downloadLink nếu có
  const dli = document.getElementById("downloadLink");
  if (dli && dli.value.trim()) {
    const nd = normalizeB2(dli.value.trim());
    dli.value = nd;
    formData.set("downloadLink", nd);
  }

  try {
    const response = await fetch(`/api/admin/videos/${videoId}`, {
      method: "PUT",
      credentials: "include",
      body: formData,
    });
    if (response.ok) {
      showToast("Đã cập nhật video thành công", "success");
      setTimeout(() => {
        window.location.href = "/admin/dashboard.html";
      }, 1500);
    } else {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to update video");
    }
  } catch (error) {
    console.error("Error updating video:", error);
    showToast("Có lỗi xảy ra: " + error.message, "error");
  }
}
function showEditErrorState() {
  const loadingState = document.getElementById("loadingState");
  const editForm = document.getElementById("editForm");
  const errorState = document.getElementById("errorState");
  if (loadingState) loadingState.style.display = "none";
  if (editForm) editForm.style.display = "none";
  if (errorState) errorState.style.display = "block";
}

// ====== ROUTER CHÍNH ======
function initCurrentPage() {
  const path = window.location.pathname;
  console.log("Initializing page:", path);
  if (path.includes("dashboard.html") || path.includes("index.html")) {
    initDashboard();
  } else if (path.includes("add-video.html")) {
    initAddVideoForm();
  } else if (path.includes("edit-video.html")) {
    initEditVideoForm();
  } else {
    console.log("Unknown admin page:", path);
  }
}

// Render videos
function renderVideos(videos) {
  // Desktop table
  const tableBody = document.getElementById("videoTableBody");
  if (tableBody) {
    tableBody.innerHTML = videos
      .map(
        (video) => `
      <div class="table-row">
        <div class="table-cell">${video.sequentialId}</div>
        <div class="table-cell video-title-cell">${video.title}</div>
        <div class="table-cell">${formatViews(video.views || 0)}</div>
        <div class="table-cell">${video.duration}</div>
        <div class="table-cell">${getCategoryDisplay(video.category)}</div>
        <div class="table-cell">${formatDate(video.createdAt)}</div>
        <div class="table-cell">
          <span class="status-badge ${video.published === false ? "status-draft" : "status-published"}">
            ${video.published === false ? "Ẩn" : "Hiện"}
          </span>
        </div>
        <div class="table-cell">
          <div class="action-buttons">
            <a href="/admin/edit-video.html?id=${video.id}" class="action-btn action-btn-edit">Sửa</a>
            <button class="action-btn action-btn-toggle" onclick="toggleVideo('${video.id}')">${video.published === false ? "Hiện" : "Ẩn"}</button>
            <button class="action-btn action-btn-delete" onclick="deleteVideo('${video.id}', '${video.title}')">Xóa</button>
          </div>
        </div>
      </div>`,
      )
      .join("");
  }

  // Mobile cards
  const videoCards = document.getElementById("videoCards");
  if (videoCards) {
    videoCards.innerHTML = videos
      .map(
        (video) => `
      <div class="video-card-mobile">
        <div class="card-header">
          <div>
            <div class="card-title">${video.title}</div>
            <span class="status-badge ${video.published === false ? "status-draft" : "status-published"}">
              ${video.published === false ? "Ẩn" : "Hiện"}
            </span>
          </div>
        </div>
        <div class="card-meta">
          <div><strong>STT:</strong> ${video.sequentialId}</div>
          <div><strong>Views:</strong> ${formatViews(video.views || 0)}</div>
          <div><strong>Thời lượng:</strong> ${video.duration}</div>
          <div><strong>Danh mục:</strong> ${getCategoryDisplay(video.category)}</div>
          <div><strong>Ngày tạo:</strong> ${formatDate(video.createdAt)}</div>
        </div>
        <div class="card-actions">
          <a href="/admin/edit-video.html?id=${video.id}" class="action-btn action-btn-edit">Sửa</a>
          <button class="action-btn action-btn-toggle" onclick="toggleVideo('${video.id}')">${video.published === false ? "Hiện" : "Ẩn"}</button>
          <button class="action-btn action-btn-delete" onclick="deleteVideo('${video.id}', '${video.title}')">Xóa</button>
        </div>
      </div>`,
      )
      .join("");
  }
}

// Toggle video visibility
async function toggleVideo(id) {
  try {
    const response = await fetch(`/api/admin/videos/${id}/toggle`, {
      method: "PATCH",
      credentials: "include",
    });
    if (response.ok) {
      showToast("Đã cập nhật trạng thái video", "success");
      loadVideos();
    } else {
      throw new Error("Failed to toggle video");
    }
  } catch (error) {
    console.error("Error toggling video:", error);
    showToast("Có lỗi xảy ra khi cập nhật trạng thái", "error");
  }
}

// Delete video
function deleteVideo(id, title) {
  showConfirmModal(
    "Xóa video",
    `Bạn có chắc chắn muốn xóa video "${title}"? Hành động này không thể hoàn tác.`,
    () => performDeleteVideo(id),
  );
}
async function performDeleteVideo(id) {
  try {
    const response = await fetch(`/api/admin/videos/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (response.ok) {
      showToast("Đã xóa video thành công", "success");
      loadVideos();
    } else {
      throw new Error("Failed to delete video");
    }
  } catch (error) {
    console.error("Error deleting video:", error);
    showToast("Có lỗi xảy ra khi xóa video", "error");
  }
}

// Pagination
function renderPagination(pagination) {
  const paginationEl = document.getElementById("pagination");
  if (!paginationEl || pagination.pages <= 1) {
    if (paginationEl) paginationEl.innerHTML = "";
    return;
  }

  let html = "";
  if (pagination.page > 1)
    html += `<button class="pagination-btn" onclick="goToPage(${pagination.page - 1})">Trước</button>`;

  const startPage = Math.max(1, pagination.page - 2);
  const endPage = Math.min(pagination.pages, pagination.page + 2);

  if (startPage > 1) {
    html += `<button class="pagination-btn" onclick="goToPage(1)">1</button>`;
    if (startPage > 2)
      html += `<span style="padding: 0 0.5rem; color: #a7a7b3;">...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="pagination-btn ${i === pagination.page ? "active" : ""}" onclick="goToPage(${i})">${i}</button>`;
  }

  if (endPage < pagination.pages) {
    if (endPage < pagination.pages - 1)
      html += `<span style="padding: 0 0.5rem; color: #a7a7b3;">...</span>`;
    html += `<button class="pagination-btn" onclick="goToPage(${pagination.pages})">${pagination.pages}</button>`;
  }

  if (pagination.page < pagination.pages)
    html += `<button class="pagination-btn" onclick="goToPage(${pagination.page + 1})">Sau</button>`;
  paginationEl.innerHTML = html;
}
function goToPage(page) {
  currentPage = page;
  loadVideos();
}
function updateStats(total) {
  const totalVideos = document.getElementById("totalVideos");
  if (totalVideos)
    totalVideos.textContent = `${total} video${total !== 1 ? "s" : ""}`;
  const lastUpdate = document.getElementById("lastUpdate");
  if (lastUpdate)
    lastUpdate.textContent = `Cập nhật: ${new Date().toLocaleString("vi-VN")}`;
}

// Embed inputs (add/edit)
function initEmbedInputs(initialValues = []) {
  const container = document.getElementById("embedInputs");
  const addBtn = document.getElementById("addPrimaryEmbedBtn");
  if (!container) return null;

  const controller =
    container.__controller ||
    createEmbedListController({
      container,
      addButton: addBtn,
      namePrefix: "embedUrl",
      placeholderPrefix: "URL Video - Server",
      min: 1,
      max: 12,
      requiredFirst: true,
    });

  if (!controller) return null;

  const values = Array.isArray(initialValues)
    ? initialValues.filter((v) => typeof v === "string" && v.trim())
    : [];
  controller.render(values);
  return controller;
}

// Thumbnail handling
function initThumbnailHandling() {
  const thumbnailOptions = document.querySelectorAll(
    'input[name="thumbnailType"]',
  );
  const thumbnailUrl = document.getElementById("thumbnailUrl");
  const thumbnailUpload = document.getElementById("thumbnailUpload");
  const thumbnailUrlInput = document.getElementById("thumbnailUrlInput");
  const uploadArea = document.getElementById("uploadArea");
  const thumbnailFile = document.getElementById("thumbnailFile");

  if (!thumbnailOptions.length) return;

  thumbnailOptions.forEach((option) => {
    option.addEventListener("change", (e) => {
      if (e.target.value === "url") {
        if (thumbnailUrl) thumbnailUrl.style.display = "block";
        if (thumbnailUpload) thumbnailUpload.style.display = "none";
      } else {
        if (thumbnailUrl) thumbnailUrl.style.display = "none";
        if (thumbnailUpload) thumbnailUpload.style.display = "block";
      }
    });
  });

  if (thumbnailUrlInput) {
    const applyThumb = (val) => {
      const raw = (val || "").trim();
      if (!raw) return;
      const norm = normalizeB2(raw);
      thumbnailUrlInput.value = norm;
      previewThumbnailUrl(norm);
    };
    thumbnailUrlInput.addEventListener("blur", (e) =>
      applyThumb(e.target.value),
    );
    thumbnailUrlInput.addEventListener("change", (e) =>
      applyThumb(e.target.value),
    );
    thumbnailUrlInput.addEventListener("paste", () =>
      setTimeout(() => applyThumb(thumbnailUrlInput.value), 0),
    );
  }

  if (uploadArea && thumbnailFile) {
    uploadArea.addEventListener("click", () => thumbnailFile.click());
    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.classList.add("dragover");
    });
    uploadArea.addEventListener("dragleave", () =>
      uploadArea.classList.remove("dragover"),
    );
    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.classList.remove("dragover");
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const dt = new DataTransfer();
        dt.items.add(files[0]);
        thumbnailFile.files = dt.files;
        previewThumbnailFile(files[0]);
      }
    });
    thumbnailFile.addEventListener("change", (e) => {
      if (e.target.files.length > 0) previewThumbnailFile(e.target.files[0]);
    });
  }
}
function previewThumbnailUrl(url) {
  const norm = normalizeB2(url);
  const preview = document.getElementById("thumbnailPreview");
  if (preview) {
    preview.innerHTML = `
      <img src="${norm}" alt="Thumbnail preview" onerror="this.parentElement.innerHTML='<p style=color:#ff4757;>Không thể tải ảnh</p>'">
      <div class="preview-info">Preview thumbnail</div>`;
  }
}
function previewThumbnailFile(file) {
  if (!file.type.startsWith("image/"))
    return showToast("Vui lòng chọn file ảnh", "error");
  if (file.size > 5 * 1024 * 1024)
    return showToast("File ảnh không được vượt quá 5MB", "error");
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById("thumbnailFilePreview");
    if (preview) {
      preview.innerHTML = `
        <img src="${e.target.result}" alt="Thumbnail preview">
        <div class="preview-info">${file.name} (${formatFileSize(file.size)})</div>`;
    }
  };
  reader.readAsDataURL(file);
}

function initImageLinkHandling(initialLinks = []) {
  const container = document.getElementById("imageLinksContainer");
  const addBtn = document.getElementById("addImageLinkBtn");
  if (!container || !addBtn) return;

  const showPlaceholder = (previewEl) => {
    if (!previewEl) return;
    previewEl.innerHTML =
      '<div class="image-link-preview-placeholder">Nhập link để xem preview</div>';
  };

  const setPreview = (previewEl, url) => {
    if (!previewEl) return;
    previewEl.innerHTML = "";
    if (!url) {
      showPlaceholder(previewEl);
      return;
    }
    const img = document.createElement("img");
    img.src = url;
    img.alt = "Ảnh xem trước";
    img.addEventListener("error", () => {
      previewEl.innerHTML =
        '<div class="image-link-preview-error">Không thể tải ảnh</div>';
    });
    previewEl.appendChild(img);
  };

  const buildRow = (value = "") => {
    const wrapper = document.createElement("div");
    wrapper.className = "image-link-row";

    const field = document.createElement("div");
    field.className = "image-link-field";

    const input = document.createElement("input");
    input.type = "url";
    input.placeholder = "https://example.com/image.jpg";
    input.className = "form-input image-link-input";
    if (typeof value === "string") input.value = value;

    const preview = document.createElement("div");
    preview.className = "image-link-preview";

    field.appendChild(input);
    field.appendChild(preview);
    wrapper.appendChild(field);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "image-link-remove";
    removeBtn.textContent = "Xóa";
    wrapper.appendChild(removeBtn);

    const normalizeAndPreview = () => {
      const raw = (input.value || "").trim();
      if (!raw) {
        showPlaceholder(preview);
        return;
      }
      const normalized = normalizeB2(raw);
      input.value = normalized;
      setPreview(preview, normalized);
    };

    input.addEventListener("blur", normalizeAndPreview);
    input.addEventListener("change", normalizeAndPreview);
    input.addEventListener("paste", () =>
      setTimeout(normalizeAndPreview, 0),
    );
    input.addEventListener("input", () => {
      if (!input.value.trim()) showPlaceholder(preview);
    });

    removeBtn.addEventListener("click", () => {
      wrapper.remove();
      if (!container.childElementCount) {
        container.appendChild(buildRow(""));
      }
    });

    if (typeof value === "string" && value.trim()) {
      const normalized = normalizeB2(value.trim());
      input.value = normalized;
      setPreview(preview, normalized);
    } else {
      showPlaceholder(preview);
    }

    return wrapper;
  };

  const render = (values = []) => {
    container.innerHTML = "";
    const arr = Array.isArray(values)
      ? values.filter((item) => typeof item === "string" && item.trim())
      : [];
    arr.forEach((val) => container.appendChild(buildRow(val)));
    if (!container.childElementCount) {
      container.appendChild(buildRow(""));
    }
  };

  const handleAdd = () => {
    container.appendChild(buildRow(""));
  };

  if (addBtn.__imageLinkHandler) {
    addBtn.removeEventListener("click", addBtn.__imageLinkHandler);
  }
  addBtn.__imageLinkHandler = handleAdd;
  addBtn.addEventListener("click", handleAdd);

  container.__renderImageLinks = render;

  render(initialLinks);
}

function initSecondaryEmbedSection(initialLinks = []) {
  const section = document.getElementById("secondaryEmbedSection");
  const addGroupBtn = document.getElementById("addSecondaryGroupBtn");
  const groupsContainer = document.getElementById("secondaryGroupsContainer");
  const emptyState = document.getElementById("secondaryGroupsEmpty");
  if (!section || !addGroupBtn || !groupsContainer || !emptyState) return null;

  let sequence = 0;
  const groups = [];

  const normalizeInitial = (input) => {
    if (!Array.isArray(input) || !input.length) return [];
    const hasNested = input.some((item) => Array.isArray(item));
    if (hasNested) {
      return input
        .map((item) =>
          Array.isArray(item)
            ? item
                .map((url) =>
                  typeof url === "string" ? url.trim() : "",
                )
                .filter(Boolean)
            : [],
        )
        .filter((arr) => arr.length);
    }
    const single = input
      .map((url) => (typeof url === "string" ? url.trim() : ""))
      .filter(Boolean);
    return single.length ? [single] : [];
  };

  const syncEmptyState = () => {
    emptyState.style.display = groups.length ? "none" : "block";
  };

  const refreshTitles = () => {
    groups.forEach((group, idx) => {
      group.title.textContent = `Video phụ #${idx + 1}`;
    });
  };

  const removeGroup = (id) => {
    const index = groups.findIndex((g) => g.id === id);
    if (index === -1) return;
    const [removed] = groups.splice(index, 1);
    removed.el.remove();
    refreshTitles();
    syncEmptyState();
  };

  const createGroup = (values = []) => {
    sequence += 1;
    const id = `secondary_${Date.now()}_${sequence}`;
    const wrapper = document.createElement("div");
    wrapper.className = "embed-secondary-group";

    const header = document.createElement("div");
    header.className = "embed-group-header";

    const titleEl = document.createElement("div");
    titleEl.className = "embed-group-title";
    header.appendChild(titleEl);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "embed-group-remove";
    removeBtn.textContent = "Xóa video";
    header.appendChild(removeBtn);

    wrapper.appendChild(header);

    const inputsContainer = document.createElement("div");
    inputsContainer.className = "embed-inputs";
    wrapper.appendChild(inputsContainer);

    const actions = document.createElement("div");
    actions.className = "embed-inner-actions";
    const addLinkBtn = document.createElement("button");
    addLinkBtn.type = "button";
    addLinkBtn.className = "btn-secondary embed-add-btn";
    addLinkBtn.textContent = "+ Thêm link";
    actions.appendChild(addLinkBtn);
    wrapper.appendChild(actions);

    groupsContainer.appendChild(wrapper);

    const controller = createEmbedListController({
      container: inputsContainer,
      addButton: addLinkBtn,
      namePrefix: `secondaryEmbedUrl_${sequence}_`,
      placeholderPrefix: "URL Video phụ - Server",
      min: 1,
      max: 12,
      requiredFirst: true,
    });

    controller.render(values);

    const groupData = {
      id,
      el: wrapper,
      controller,
      title: titleEl,
    };

    removeBtn.addEventListener("click", () => removeGroup(id));

    groups.push(groupData);
    refreshTitles();
    syncEmptyState();
    if (!values.length) controller.focusFirst();
    return groupData;
  };

  if (addGroupBtn.__secondaryHandler) {
    addGroupBtn.removeEventListener("click", addGroupBtn.__secondaryHandler);
  }
  addGroupBtn.__secondaryHandler = () => {
    createGroup();
  };
  addGroupBtn.addEventListener("click", addGroupBtn.__secondaryHandler);

  const controller = {
    addGroup(values = []) {
      return createGroup(values);
    },
    clear() {
      groups.forEach((group) => group.el.remove());
      groups.length = 0;
      sequence = 0;
      syncEmptyState();
    },
    setGroups(list = []) {
      controller.clear();
      list.forEach((groupValues) => {
        const normalized = Array.isArray(groupValues)
          ? groupValues
              .map((url) => (typeof url === "string" ? url.trim() : ""))
              .filter(Boolean)
          : [];
        createGroup(normalized);
      });
    },
    getValues() {
      return groups
        .map((group) => group.controller.getValues())
        .filter((arr) => Array.isArray(arr) && arr.length);
    },
    count() {
      return groups.length;
    },
  };

  section.__controller = controller;

  const initialGroups = normalizeInitial(initialLinks);
  if (initialGroups.length) {
    controller.setGroups(initialGroups);
  } else {
    syncEmptyState();
  }

  return controller;
}

// Duration formatting
function initDurationFormatting() {
  const durationInput = document.getElementById("duration");
  if (!durationInput) return;
  durationInput.addEventListener("input", (e) => {
    let value = e.target.value.replace(/[^\d:]/g, "");
    if (value.length === 2 && !value.includes(":")) value += ":";
    else if (value.length === 5 && value.split(":").length === 2) {
      const parts = value.split(":");
      if (parseInt(parts[1]) > 59) {
        const hours = Math.floor(parseInt(parts[1]) / 60);
        const minutes = parseInt(parts[1]) % 60;
        value =
          parseInt(parts[0]) +
          hours +
          ":" +
          minutes.toString().padStart(2, "0") +
          ":";
      }
    }
    e.target.value = value;
  });
}

// Category handling
function initCategoryHandling() {
  const categorySelect = document.getElementById("category");
  const downloadLinkGroup = document.getElementById("downloadLinkGroup");
  if (downloadLinkGroup) downloadLinkGroup.style.display = "block"; // luôn hiển thị
  if (categorySelect && downloadLinkGroup) {
    categorySelect.addEventListener("change", () => {
      downloadLinkGroup.style.display = "block";
    });
  }
}

// Tags handling
function initTagsHandling() {
  const tagsInput = document.getElementById("tagsInput");
  const tagsDisplay = document.getElementById("tagsDisplay");
  if (!tagsInput || !tagsDisplay) return;

  tagsInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagsInput.value.trim());
      tagsInput.value = "";
    } else if (
      e.key === "Backspace" &&
      tagsInput.value === "" &&
      tags.length > 0
    ) {
      removeTag(tags.length - 1);
    }
  });

  function addTag(tag) {
    if (tag && !tags.includes(tag)) {
      tags.push(tag);
      renderTags();
    }
  }
  function removeTag(index) {
    tags.splice(index, 1);
    renderTags();
  }
  function renderTags() {
    tagsDisplay.innerHTML = tags
      .map(
        (tag, index) => `
      <span class="tag-chip">
        ${tag}
        <button type="button" class="tag-remove" onclick="removeTagByIndex(${index})">×</button>
      </span>`,
      )
      .join("");
  }
  window.removeTagByIndex = removeTag;

  // Nút + Tag (mobile-friendly)
  const addTagBtn = document.getElementById("addTagBtn");
  if (addTagBtn) {
    addTagBtn.addEventListener("click", () => {
      const t = tagsInput.value.trim();
      if (t && !tags.includes(t)) {
        tags.push(t);
        // dùng renderTags() sẵn có trong hàm
        const tagsDisplay = document.getElementById("tagsDisplay");
        tagsDisplay.innerHTML = tags
          .map(
            (tag, index) => `
            <span class="tag-chip">
              ${tag}
              <button type="button" class="tag-remove" onclick="removeTagByIndex(${index})">×</button>
            </span>`,
          )
          .join("");
      }
      tagsInput.value = "";
      tagsInput.focus();
    });
  }
}

// Notes counter
function initNotesCounter() {
  const notesTextarea = document.getElementById("notes");
  const notesCount = document.getElementById("notesCount");
  if (notesTextarea && notesCount) {
    notesTextarea.addEventListener("input", (e) => {
      notesCount.textContent = e.target.value.length;
    });
  }
}

// Submit add video
async function submitVideoForm(saveAndNew = false) {
  const form = document.getElementById("addVideoForm");
  if (!form) return;
  if (!form.reportValidity()) return;

  const formData = new FormData(form);
  const secondarySection = document.getElementById("secondaryEmbedSection");
  const secondaryController = secondarySection?.__controller;

  const embedInputsContainer = document.getElementById("embedInputs");
  const primaryController = embedInputsContainer?.__controller || null;
  const embedUrls = primaryController ? primaryController.getValues() : [];
  if (!embedUrls.length) {
    showToast("Vui lòng nhập ít nhất một embed URL", "error");
    return;
  }
  formData.set("embedUrls", JSON.stringify(embedUrls));

  const secondaryEmbedUrls =
    secondaryController && typeof secondaryController.getValues === "function"
      ? secondaryController.getValues()
      : [];
  formData.set("secondaryEmbedUrls", JSON.stringify(secondaryEmbedUrls));

  const imageInputs = document.querySelectorAll(".image-link-input");
  const imageUrls = [];
  imageInputs.forEach((input) => {
    if (!input) return;
    const raw = (input.value || "").trim();
    if (!raw) return;
    const norm = normalizeB2(raw);
    if (norm !== raw) input.value = norm;
    if (!imageUrls.includes(norm)) imageUrls.push(norm);
  });
  formData.set("imageUrls", JSON.stringify(imageUrls));

  formData.set("tags", JSON.stringify(tags));

  const thumbnailType = document.querySelector(
    'input[name="thumbnailType"]:checked',
  )?.value;
  if (thumbnailType === "url") {
    const el = document.getElementById("thumbnailUrlInput");
    const raw = (el?.value || "").trim();
    if (raw) {
      const norm = normalizeB2(raw);
      if (el) el.value = norm;
      formData.set("thumbnailUrl", norm);
    }
    formData.delete("thumbnail");
  }

  // Normalize downloadLink nếu có
  const dlEl = document.getElementById("downloadLink");
  if (dlEl && dlEl.value.trim()) {
    const nd = normalizeB2(dlEl.value.trim());
    dlEl.value = nd;
    formData.set("downloadLink", nd);
  }

  try {
    const response = await fetch("/api/admin/videos", {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (response.ok) {
      showToast("Đã thêm video thành công", "success");
      if (saveAndNew) {
        form.reset();
        tags = [];
        const tagsDisplay = document.getElementById("tagsDisplay");
        const notesCount = document.getElementById("notesCount");
        const thumbnailPreview = document.getElementById("thumbnailPreview");
        const thumbnailFilePreview = document.getElementById(
          "thumbnailFilePreview",
        );
        if (tagsDisplay) tagsDisplay.innerHTML = "";
        if (notesCount) notesCount.textContent = "0";
        if (thumbnailPreview) thumbnailPreview.innerHTML = "";
        if (thumbnailFilePreview) thumbnailFilePreview.innerHTML = "";
        const imageLinksContainer = document.getElementById(
          "imageLinksContainer",
        );
        if (imageLinksContainer) {
          if (typeof imageLinksContainer.__renderImageLinks === "function") {
            imageLinksContainer.__renderImageLinks([]);
          } else {
            initImageLinkHandling();
          }
        }
        if (primaryController) primaryController.render([]);
        if (secondaryController) secondaryController.clear();
        const thumbnailTypeUrl = document.querySelector(
          'input[name="thumbnailType"][value="url"]',
        );
        const thumbnailUrl = document.getElementById("thumbnailUrl");
        const thumbnailUpload = document.getElementById("thumbnailUpload");
        if (thumbnailTypeUrl) thumbnailTypeUrl.checked = true;
        if (thumbnailUrl) thumbnailUrl.style.display = "block";
        if (thumbnailUpload) thumbnailUpload.style.display = "none";
      } else {
        window.location.href = "/admin/dashboard.html";
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to create video");
    }
  } catch (error) {
    console.error("Error creating video:", error);
    showToast("Có lỗi xảy ra: " + error.message, "error");
  }
}

// Utils
function formatViews(views) {
  const oneDecimal = (n) => n.toFixed(1).replace(/\.0$/, "");
  if (views >= 1_000_000_000) return oneDecimal(views / 1_000_000_000) + "B";
  if (views >= 1_000_000) return oneDecimal(views / 1_000_000) + "M";
  if (views >= 1_000) return oneDecimal(views / 1_000) + "K";
  return views.toString();
}
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("vi-VN");
}
function getCategoryDisplay(category) {
  const categories = {
    china: "China",
    gaydar: "Gaydar",
    vietnam: "Vietnam",
    japan: "Japan",
    western: "Western",
    magazine: "Magazine",
    straight: "Straight",
    other: "Other",
  };
  return categories[category] || "Other";
}
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024,
    sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Toast
function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("show");
  }, 100);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      if (container.contains(toast)) container.removeChild(toast);
    }, 300);
  }, 3000);
}

// Confirm modal
function showConfirmModal(title, message, onConfirm) {
  const modal = document.getElementById("confirmModal");
  const titleEl = document.getElementById("confirmTitle");
  const messageEl = document.getElementById("confirmMessage");
  const cancelBtn = document.getElementById("confirmCancel");
  const okBtn = document.getElementById("confirmOk");
  if (!modal || !titleEl || !messageEl || !cancelBtn || !okBtn) return;

  titleEl.textContent = title;
  messageEl.textContent = message;
  modal.classList.add("show");

  function closeModal() {
    modal.classList.remove("show");
    cancelBtn.removeEventListener("click", closeModal);
    okBtn.removeEventListener("click", confirmAction);
    modal.removeEventListener("click", outsideClick);
  }
  function confirmAction() {
    onConfirm();
    closeModal();
  }
  function outsideClick(e) {
    if (e.target === modal) closeModal();
  }

  cancelBtn.addEventListener("click", closeModal);
  okBtn.addEventListener("click", confirmAction);
  modal.addEventListener("click", outsideClick);
}

// ====== SẮP XẾP THỦ CÔNG ======
let reorderList = [];
async function openReorderModal() {
  const res = await fetch("/api/admin/videos?limit=1000&sort=manual", {
    credentials: "include",
  });

  if (!res.ok) {
    alert("Không tải được danh sách");
    return;
  }
  const data = await res.json();
  const arr = Array.isArray(data?.videos)
    ? data.videos
    : Array.isArray(data)
      ? data
      : [];
  reorderList = arr.map((v) => ({
    id: String(v.id),
    title: v.title || "#" + v.id,
  }));
  renderReorderList();
  const modal = document.getElementById("reorderModal");
  if (modal) modal.style.display = "flex";
}
function renderReorderList() {
  const el = document.getElementById("reorderList");
  if (!el) return;
  if (!reorderList.length) {
    el.innerHTML = "<li>Chưa có video nào.</li>";
    return;
  }
  el.innerHTML = reorderList
    .map(
      (v, i) => `
    <li data-id="${v.id}">
      <span class="idx">${i + 1}.</span>
      <span class="ttl">${v.title}</span>
      <span class="act">
        <button class="up"  data-id="${v.id}" title="Lên">↑</button>
        <button class="down" data-id="${v.id}" title="Xuống">↓</button>
        <button class="top" data-id="${v.id}" title="Đầu">Đầu</button>
      </span>
    </li>`,
    )
    .join("");
}
function moveItem(id, delta) {
  const i = reorderList.findIndex((v) => v.id === String(id));
  const j = i + delta;
  if (i < 0 || j < 0 || j >= reorderList.length) return;
  [reorderList[i], reorderList[j]] = [reorderList[j], reorderList[i]];
  renderReorderList();
}
function moveItemToTop(id) {
  const i = reorderList.findIndex((v) => v.id === String(id));
  if (i < 0) return;
  reorderList.unshift(...reorderList.splice(i, 1));
  renderReorderList();
}

async function saveOrder() {
  const order = reorderList.map((v) => v.id);
  const res = await fetch("/api/admin/videos/reorder", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order }),
  });
  if (res.ok) {
    if (typeof showToast === "function") showToast("Đã lưu thứ tự mới");
    const modal = document.getElementById("reorderModal");
    if (modal) modal.style.display = "none";
    if (typeof loadVideos === "function") loadVideos();
  } else {
    alert("Lưu thất bại");
  }
}
document.addEventListener("DOMContentLoaded", () => {
  const btnOpen = document.getElementById("openReorder");
  const btnSave = document.getElementById("saveOrder");
  const modal = document.getElementById("reorderModal");
  if (btnOpen) btnOpen.addEventListener("click", openReorderModal);
  if (btnSave) btnSave.addEventListener("click", saveOrder);
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (
        e.target.classList.contains("close") ||
        e.target.id === "reorderModal"
      )
        modal.style.display = "none";
      if (e.target.classList.contains("up")) moveItem(e.target.dataset.id, -1);
      if (e.target.classList.contains("down"))
        moveItem(e.target.dataset.id, +1);
      if (e.target.classList.contains("top"))
        moveItemToTop(e.target.dataset.id);
    });
  }
});

// Export global
window.initCurrentPage = initCurrentPage;
window.initDashboard = initDashboard;
window.initAddVideoForm = initAddVideoForm;
window.initEditVideoForm = initEditVideoForm;
window.loadVideos = loadVideos;
window.toggleVideo = toggleVideo;
window.deleteVideo = deleteVideo;
window.goToPage = goToPage;
window.showToast = showToast;
window.showConfirmModal = showConfirmModal;
