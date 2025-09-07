// Global state
let currentPage = 1;
let currentSearch = '';
let currentCategory = '';
let currentSort = 'newest';
let isLoading = false;
let tags = [];

// Initialize dashboard - CHỈ CHO TRANG DASHBOARD
function initDashboard() {
  console.log('Initializing dashboard');

  // Check các elements cần thiết có tồn tại không
  const loadingSkeleton = document.getElementById('loadingSkeleton');
  const videoTable = document.getElementById('videoTable');
  const searchInput = document.getElementById('searchInput');

  if (!loadingSkeleton || !videoTable || !searchInput) {
    console.error('Dashboard elements not found - not on dashboard page');
    return;
  }

  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  // Search
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentSearch = e.target.value.trim();
      currentPage = 1;
      loadVideos();
    }, 300);
  });

  // Filters
  const categoryFilter = document.getElementById('categoryFilter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', (e) => {
      currentCategory = e.target.value;
      currentPage = 1;
      loadVideos();
    });
  }

  const sortFilter = document.getElementById('sortFilter');
  if (sortFilter) {
    sortFilter.addEventListener('change', (e) => {
      currentSort = e.target.value;
      currentPage = 1;
      loadVideos();
    });
  }

  // Initial
  loadVideos();
}

// ==== B2 AUTO-NORMALIZE (friendly endpoint -> cần /file/) ====
function __b2_buildCacheUrl(bucket, key, search) {
  const safePath = String(key).split('/').filter(Boolean)
    .map(seg => encodeURIComponent(decodeURIComponent(seg.replace(/\+/g, ' '))))
    .join('/');
  return `https://b2.traingon.top/file/${encodeURIComponent(bucket)}/${safePath}${search || ''}`;
}
function normalizeB2(url) {
  if (!url || typeof url !== 'string') return (url || '').trim();
  url = url.trim();
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const parts = u.pathname.split('/').filter(Boolean);
    if (host.startsWith('f') && host.endsWith('.backblazeb2.com') && parts[0] === 'file' && parts.length >= 3) {
      const bucket = parts[1]; const key = parts.slice(2).join('/'); return __b2_buildCacheUrl(bucket, key, u.search);
    }
    if (/\.s3\.[^/]+\.backblazeb2\.com$/.test(host)) {
      const bucket = host.split('.s3.')[0]; const key = u.pathname.replace(/^\/+/, ''); return key ? __b2_buildCacheUrl(bucket, key, u.search) : url;
    }
    if (/^s3\.[^/]+\.backblazeb2\.com$/.test(host) && parts.length >= 2) {
      const bucket = parts[0]; const key = parts.slice(1).join('/'); return __b2_buildCacheUrl(bucket, key, u.search);
    }
    return url;
  } catch { return url; }
}

// Loading states - CHỈ CHO DASHBOARD
function showLoadingSkeleton() {
  const loadingSkeleton = document.getElementById('loadingSkeleton');
  const videoTable = document.getElementById('videoTable');
  const videoCards = document.getElementById('videoCards');
  const emptyState = document.getElementById('emptyState');
  const errorState = document.getElementById('errorState');

  if (loadingSkeleton) loadingSkeleton.style.display = 'block';
  if (videoTable) videoTable.style.display = 'none';
  if (videoCards) videoCards.style.display = 'none';
  if (emptyState) emptyState.style.display = 'none';
  if (errorState) errorState.style.display = 'none';
}
function hideLoadingSkeleton() {
  const loadingSkeleton = document.getElementById('loadingSkeleton');
  const videoTable = document.getElementById('videoTable');
  const videoCards = document.getElementById('videoCards');

  if (loadingSkeleton) loadingSkeleton.style.display = 'none';
  if (window.innerWidth > 768) {
    if (videoTable) videoTable.style.display = 'block';
  } else {
    if (videoCards) videoCards.style.display = 'block';
  }
}
function showEmptyState() {
  const emptyState = document.getElementById('emptyState');
  const errorState = document.getElementById('errorState');
  if (emptyState) emptyState.style.display = 'block';
  if (errorState) errorState.style.display = 'none';
}
function showErrorState() {
  const errorState = document.getElementById('errorState');
  const emptyState = document.getElementById('emptyState');
  if (errorState) errorState.style.display = 'block';
  if (emptyState) emptyState.style.display = 'none';
}

// Load videos - CHỈ CHO DASHBOARD
async function loadVideos() {
  if (isLoading) return;

  // Not on dashboard page?
  const loadingSkeleton = document.getElementById('loadingSkeleton');
  if (!loadingSkeleton) {
    console.log('Not on dashboard page, skipping loadVideos');
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
      sort: currentSort
    });

    const response = await fetch(`/api/admin/videos?${params}`, { credentials: 'include' });
    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/admin/login.html';
        return;
      }
      throw new Error('Failed to load videos');
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
    console.error('Error loading videos:', err);
    hideLoadingSkeleton();
    showErrorState();
  } finally {
    isLoading = false;
  }
}

// ====== ADD VIDEO PAGE ======
function initAddVideoForm() {
  console.log('Initializing add video form');

  const form = document.getElementById('addVideoForm');
  if (!form) {
    console.error('Add video form not found');
    return;
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  initEmbedInputs();
  initThumbnailHandling();
  initDurationFormatting();
  initCategoryHandling();
  initTagsHandling();
  initNotesCounter();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submitVideoForm(false);
  });

  const saveAndNewBtn = document.getElementById('saveAndNew');
  if (saveAndNewBtn) {
    saveAndNewBtn.addEventListener('click', () => submitVideoForm(true));
  }
}

// ====== EDIT VIDEO PAGE ======
function initEditVideoForm() {
  console.log('Initializing edit video form');

  const form = document.getElementById('updateVideoForm');
  if (!form) {
    console.error('Edit video form not found');
    showErrorState();
    return;
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  const urlParams = new URLSearchParams(window.location.search);
  const videoId = urlParams.get('id');
  if (!videoId) {
    console.error('No video ID provided');
    showEditErrorState();
    return;
  }

  console.log('Loading video for edit:', videoId);
  loadVideoForEdit(videoId);
}

async function loadVideoForEdit(videoId) {
  try {
    const loadingState = document.getElementById('loadingState');
    const editForm = document.getElementById('editForm');
    const errorState = document.getElementById('errorState');

    if (loadingState) loadingState.style.display = 'block';
    if (editForm) editForm.style.display = 'none';
    if (errorState) errorState.style.display = 'none';

    const response = await fetch(`/api/admin/videos/${encodeURIComponent(videoId)}`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Video not found');

    const video = await response.json();
    if (!video) throw new Error('Video not found');

    if (loadingState) loadingState.style.display = 'none';
    if (editForm) editForm.style.display = 'block';

    populateEditForm(video);
  } catch (error) {
    console.error('Error loading video for edit:', error);
    const loadingState = document.getElementById('loadingState');
    const editForm = document.getElementById('editForm');
    const errorState = document.getElementById('errorState');
    if (loadingState) loadingState.style.display = 'none';
    if (editForm) editForm.style.display = 'none';
    if (errorState) errorState.style.display = 'block';
  }
}

function populateEditForm(video) {
  console.log('Populating form with video data:', video);

  const videoIdElement = document.getElementById('videoId');
  const videoViewsElement = document.getElementById('videoViews');
  if (videoIdElement) videoIdElement.textContent = `ID: ${video.id}`;
  if (videoViewsElement) videoViewsElement.textContent = video.views || 0;

  const titleInput = document.getElementById('title');
  if (titleInput) titleInput.value = video.title || '';

  const embedUrls = video.embedUrls || [];
  const embedCount = Math.max(1, embedUrls.length);
  const embedCountRadio = document.querySelector(`input[name="embedCount"][value="${embedCount}"]`);
  if (embedCountRadio) embedCountRadio.checked = true;

  updateEmbedInputsForEdit(embedCount);
  setTimeout(() => {
    embedUrls.forEach((url, index) => {
      const input = document.querySelector(`input[name="embedUrl${index + 1}"]`);
      if (input) input.value = url;
    });
  }, 100);

  const thumbnailUrlInput = document.getElementById('thumbnailUrlInput');
  if (video.thumbnail) {
    const norm = normalizeB2(video.thumbnail);
    if (thumbnailUrlInput) thumbnailUrlInput.value = norm;
    previewThumbnailUrl(norm);
  }

  const durationInput = document.getElementById('duration');
  if (durationInput) durationInput.value = video.duration || '';

  const categorySelect = document.getElementById('category');
  if (categorySelect) {
    categorySelect.value = video.category || 'none';
    const downloadLinkGroup = document.getElementById('downloadLinkGroup');
    if (downloadLinkGroup) downloadLinkGroup.style.display = video.category === 'japan' ? 'block' : 'none';
  }

  const publishedRadio = document.querySelector(`input[name="published"][value="${video.published !== false}"]`);
  if (publishedRadio) publishedRadio.checked = true;

  const downloadLinkInput = document.getElementById('downloadLink');
  if (downloadLinkInput) downloadLinkInput.value = video.downloadLink || '';

  tags = video.tags || [];
  renderEditTags();

  const notesTextarea = document.getElementById('notes');
  const notesCount = document.getElementById('notesCount');
  if (notesTextarea) {
    notesTextarea.value = video.notes || '';
    if (notesCount) notesCount.textContent = (video.notes || '').length;
  }

  initThumbnailHandling();
  initDurationFormatting();
  initCategoryHandling();
  initEditTagsHandling();
  initNotesCounter();
  initEmbedInputsForEdit();

  const form = document.getElementById('updateVideoForm');
  if (form) {
    form.removeEventListener('submit', handleEditFormSubmit);
    form.addEventListener('submit', handleEditFormSubmit);
  }

  window.currentEditVideoId = video.id;
}

function initEmbedInputsForEdit() {
  const embedOptions = document.querySelectorAll('input[name="embedCount"]');
  embedOptions.forEach(option => {
    option.addEventListener('change', (e) => {
      const count = parseInt(e.target.value);

      const currentValues = [];
      for (let i = 1; i <= 3; i++) {
        const input = document.querySelector(`input[name="embedUrl${i}"]`);
        if (input && input.value.trim()) currentValues.push(input.value.trim());
      }

      updateEmbedInputsForEdit(count);

      setTimeout(() => {
        currentValues.forEach((value, index) => {
          if (index < count) {
            const input = document.querySelector(`input[name="embedUrl${index + 1}"]`);
            if (input) input.value = value;
          }
        });
      }, 50);
    });
  });
}
function updateEmbedInputsForEdit(count) {
  const embedInputs = document.getElementById('embedInputs');
  if (!embedInputs) return;
  let html = '';
  for (let i = 1; i <= count; i++) {
    html += `
      <div class="embed-input-group">
        <input type="url" name="embedUrl${i}" placeholder="URL Mixdrop/Streamtape... Server ${i}" ${i === 1 ? 'required' : ''} class="form-input">
        <div class="form-error" id="embedUrl${i}Error"></div>
      </div>`;
  }
  embedInputs.innerHTML = html;
}
function handleEditFormSubmit(e) {
  e.preventDefault();
  submitEditVideoForm(window.currentEditVideoId);
}

function renderEditTags() {
  const tagsDisplay = document.getElementById('tagsDisplay');
  if (tagsDisplay) {
    tagsDisplay.innerHTML = tags.map((tag, index) => `
      <span class="tag-chip">
        ${tag}
        <button type="button" class="tag-remove" onclick="removeTagByIndex(${index})">×</button>
      </span>`).join('');
  }
}
function initEditTagsHandling() {
  const tagsInput = document.getElementById('tagsInput');
  if (!tagsInput) return;
  tagsInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = tagsInput.value.trim();
      if (tag && !tags.includes(tag)) { tags.push(tag); renderEditTags(); }
      tagsInput.value = '';
    } else if (e.key === 'Backspace' && tagsInput.value === '' && tags.length > 0) {
      tags.pop(); renderEditTags();
    }
  });
}
async function submitEditVideoForm(videoId) {
  const form = document.getElementById('updateVideoForm');
  if (!form) return;

  const formData = new FormData(form);

  // embedUrls
  const embedUrls = [];
  const embedCount = parseInt(document.querySelector('input[name="embedCount"]:checked')?.value || '1');
  for (let i = 1; i <= embedCount; i++) {
    const input = document.querySelector(`input[name="embedUrl${i}"]`);
    if (input && input.value.trim()) embedUrls.push(input.value.trim());
  }
  if (Array.isArray(embedUrls) && embedUrls.length === 1) {
    const normalized = normalizeB2(embedUrls[0]);
    embedUrls[0] = normalized;
    const onlyInput = document.querySelector('input[name="embedUrl1"]');
    if (onlyInput) onlyInput.value = normalized;
  }
  formData.set('embedUrls', JSON.stringify(embedUrls));

  // tags
  formData.set('tags', JSON.stringify(tags));

  // thumbnail
  const thumbnailType = document.querySelector('input[name="thumbnailType"]:checked')?.value;
  if (thumbnailType === 'url') {
    const el = document.getElementById('thumbnailUrlInput');
    const raw = (el?.value || '').trim();
    if (raw) {
      const norm = normalizeB2(raw);
      if (el) el.value = norm;
      formData.set('thumbnailUrl', norm);
    }
    formData.delete('thumbnail');
  }

  try {
    const response = await fetch(`/api/admin/videos/${videoId}`, {
      method: 'PUT',
      credentials: 'include',
      body: formData
    });
    if (response.ok) {
      showToast('Đã cập nhật video thành công', 'success');
      setTimeout(() => { window.location.href = '/admin/dashboard.html'; }, 1500);
    } else {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to update video');
    }
  } catch (error) {
    console.error('Error updating video:', error);
    showToast('Có lỗi xảy ra: ' + error.message, 'error');
  }
}
function showEditErrorState() {
  const loadingState = document.getElementById('loadingState');
  const editForm = document.getElementById('editForm');
  const errorState = document.getElementById('errorState');
  if (loadingState) loadingState.style.display = 'none';
  if (editForm) editForm.style.display = 'none';
  if (errorState) errorState.style.display = 'block';
}

// ====== ROUTER CHÍNH ======
function initCurrentPage() {
  const path = window.location.pathname;
  console.log('Initializing page:', path);
  if (path.includes('dashboard.html') || path.includes('index.html')) {
    initDashboard();
  } else if (path.includes('add-video.html')) {
    initAddVideoForm();
  } else if (path.includes('edit-video.html')) {
    initEditVideoForm();
  } else {
    console.log('Unknown admin page:', path);
  }
}

// Render videos
function renderVideos(videos) {
  // Desktop table
  const tableBody = document.getElementById('videoTableBody');
  if (tableBody) {
    tableBody.innerHTML = videos.map(video => `
      <div class="table-row">
        <div class="table-cell">${video.sequentialId}</div>
        <div class="table-cell video-title-cell">${video.title}</div>
        <div class="table-cell">${formatViews(video.views || 0)}</div>
        <div class="table-cell">${video.duration}</div>
        <div class="table-cell">${getCategoryDisplay(video.category)}</div>
        <div class="table-cell">${formatDate(video.createdAt)}</div>
        <div class="table-cell">
          <span class="status-badge ${video.published === false ? 'status-draft' : 'status-published'}">
            ${video.published === false ? 'Ẩn' : 'Hiện'}
          </span>
        </div>
        <div class="table-cell">
          <div class="action-buttons">
            <a href="/admin/edit-video.html?id=${video.id}" class="action-btn action-btn-edit">Sửa</a>
            <button class="action-btn action-btn-toggle" onclick="toggleVideo('${video.id}')">${video.published === false ? 'Hiện' : 'Ẩn'}</button>
            <button class="action-btn action-btn-delete" onclick="deleteVideo('${video.id}', '${video.title}')">Xóa</button>
          </div>
        </div>
      </div>`).join('');
  }

  // Mobile cards
  const videoCards = document.getElementById('videoCards');
  if (videoCards) {
    videoCards.innerHTML = videos.map(video => `
      <div class="video-card-mobile">
        <div class="card-header">
          <div>
            <div class="card-title">${video.title}</div>
            <span class="status-badge ${video.published === false ? 'status-draft' : 'status-published'}">
              ${video.published === false ? 'Ẩn' : 'Hiện'}
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
          <button class="action-btn action-btn-toggle" onclick="toggleVideo('${video.id}')">${video.published === false ? 'Hiện' : 'Ẩn'}</button>
          <button class="action-btn action-btn-delete" onclick="deleteVideo('${video.id}', '${video.title}')">Xóa</button>
        </div>
      </div>`).join('');
  }
}

// Toggle video visibility
async function toggleVideo(id) {
  try {
    const response = await fetch(`/api/admin/videos/${id}/toggle`, {
      method: 'PATCH',
      credentials: 'include'
    });
    if (response.ok) {
      showToast('Đã cập nhật trạng thái video', 'success');
      loadVideos();
    } else {
      throw new Error('Failed to toggle video');
    }
  } catch (error) {
    console.error('Error toggling video:', error);
    showToast('Có lỗi xảy ra khi cập nhật trạng thái', 'error');
  }
}

// Delete video
function deleteVideo(id, title) {
  showConfirmModal(
    'Xóa video',
    `Bạn có chắc chắn muốn xóa video "${title}"? Hành động này không thể hoàn tác.`,
    () => performDeleteVideo(id)
  );
}
async function performDeleteVideo(id) {
  try {
    const response = await fetch(`/api/admin/videos/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (response.ok) {
      showToast('Đã xóa video thành công', 'success');
      loadVideos();
    } else {
      throw new Error('Failed to delete video');
    }
  } catch (error) {
    console.error('Error deleting video:', error);
    showToast('Có lỗi xảy ra khi xóa video', 'error');
  }
}

// Pagination
function renderPagination(pagination) {
  const paginationEl = document.getElementById('pagination');
  if (!paginationEl || pagination.pages <= 1) {
    if (paginationEl) paginationEl.innerHTML = '';
    return;
  }

  let html = '';
  if (pagination.page > 1) html += `<button class="pagination-btn" onclick="goToPage(${pagination.page - 1})">Trước</button>`;

  const startPage = Math.max(1, pagination.page - 2);
  const endPage = Math.min(pagination.pages, pagination.page + 2);

  if (startPage > 1) {
    html += `<button class="pagination-btn" onclick="goToPage(1)">1</button>`;
    if (startPage > 2) html += `<span style="padding: 0 0.5rem; color: #a7a7b3;">...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="pagination-btn ${i === pagination.page ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
  }

  if (endPage < pagination.pages) {
    if (endPage < pagination.pages - 1) html += `<span style="padding: 0 0.5rem; color: #a7a7b3;">...</span>`;
    html += `<button class="pagination-btn" onclick="goToPage(${pagination.pages})">${pagination.pages}</button>`;
  }

  if (pagination.page < pagination.pages) html += `<button class="pagination-btn" onclick="goToPage(${pagination.page + 1})">Sau</button>`;
  paginationEl.innerHTML = html;
}
function goToPage(page) { currentPage = page; loadVideos(); }
function updateStats(total) {
  const totalVideos = document.getElementById('totalVideos');
  if (totalVideos) totalVideos.textContent = `${total} video${total !== 1 ? 's' : ''}`;
  const lastUpdate = document.getElementById('lastUpdate');
  if (lastUpdate) lastUpdate.textContent = `Cập nhật: ${new Date().toLocaleString('vi-VN')}`;
}

// Embed inputs (add page)
function initEmbedInputs() {
  const embedOptions = document.querySelectorAll('input[name="embedCount"]');
  const embedInputs = document.getElementById('embedInputs');
  if (!embedInputs) return;

  embedOptions.forEach(option => {
    option.addEventListener('change', (e) => {
      const count = parseInt(e.target.value);
      updateEmbedInputs(count);
    });
  });

  updateEmbedInputs(1);
}
function updateEmbedInputs(count) {
  const embedInputs = document.getElementById('embedInputs');
  if (!embedInputs) return;
  let html = '';
  for (let i = 1; i <= count; i++) {
    html += `
      <div class="embed-input-group">
        <input type="url" name="embedUrl${i}" placeholder="URL Mixdrop/Streamtape... Server ${i}" ${i === 1 ? 'required' : ''} class="form-input">
        <div class="form-error" id="embedUrl${i}Error"></div>
      </div>`;
  }
  embedInputs.innerHTML = html;
}

// Thumbnail handling
function initThumbnailHandling() {
  const thumbnailOptions = document.querySelectorAll('input[name="thumbnailType"]');
  const thumbnailUrl = document.getElementById('thumbnailUrl');
  const thumbnailUpload = document.getElementById('thumbnailUpload');
  const thumbnailUrlInput = document.getElementById('thumbnailUrlInput');
  const uploadArea = document.getElementById('uploadArea');
  const thumbnailFile = document.getElementById('thumbnailFile');

  if (!thumbnailOptions.length) return;

  thumbnailOptions.forEach(option => {
    option.addEventListener('change', (e) => {
      if (e.target.value === 'url') {
        if (thumbnailUrl) thumbnailUrl.style.display = 'block';
        if (thumbnailUpload) thumbnailUpload.style.display = 'none';
      } else {
        if (thumbnailUrl) thumbnailUrl.style.display = 'none';
        if (thumbnailUpload) thumbnailUpload.style.display = 'block';
      }
    });
  });

  if (thumbnailUrlInput) {
    const applyThumb = (val) => {
      const raw = (val || '').trim();
      if (!raw) return;
      const norm = normalizeB2(raw);
      thumbnailUrlInput.value = norm;
      previewThumbnailUrl(norm);
    };
    thumbnailUrlInput.addEventListener('blur',  (e) => applyThumb(e.target.value));
    thumbnailUrlInput.addEventListener('change',(e) => applyThumb(e.target.value));
    thumbnailUrlInput.addEventListener('paste', () => setTimeout(() => applyThumb(thumbnailUrlInput.value), 0));
  }

  if (uploadArea && thumbnailFile) {
    uploadArea.addEventListener('click', () => thumbnailFile.click());
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const dt = new DataTransfer();
        dt.items.add(files[0]);
        thumbnailFile.files = dt.files;
        previewThumbnailFile(files[0]);
      }
    });
    thumbnailFile.addEventListener('change', (e) => {
      if (e.target.files.length > 0) previewThumbnailFile(e.target.files[0]);
    });
  }
}
function previewThumbnailUrl(url) {
  const norm = normalizeB2(url);
  const preview = document.getElementById('thumbnailPreview');
  if (preview) {
    preview.innerHTML = `
      <img src="${norm}" alt="Thumbnail preview" onerror="this.parentElement.innerHTML='<p style=color:#ff4757;>Không thể tải ảnh</p>'">
      <div class="preview-info">Preview thumbnail</div>`;
  }
}
function previewThumbnailFile(file) {
  if (!file.type.startsWith('image/')) return showToast('Vui lòng chọn file ảnh', 'error');
  if (file.size > 5 * 1024 * 1024) return showToast('File ảnh không được vượt quá 5MB', 'error');
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('thumbnailFilePreview');
    if (preview) {
      preview.innerHTML = `
        <img src="${e.target.result}" alt="Thumbnail preview">
        <div class="preview-info">${file.name} (${formatFileSize(file.size)})</div>`;
    }
  };
  reader.readAsDataURL(file);
}

// Duration formatting
function initDurationFormatting() {
  const durationInput = document.getElementById('duration');
  if (!durationInput) return;
  durationInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/[^\d:]/g, '');
    if (value.length === 2 && !value.includes(':')) value += ':';
    else if (value.length === 5 && value.split(':').length === 2) {
      const parts = value.split(':');
      if (parseInt(parts[1]) > 59) {
        const hours = Math.floor(parseInt(parts[1]) / 60);
        const minutes = parseInt(parts[1]) % 60;
        value = (parseInt(parts[0]) + hours) + ':' + minutes.toString().padStart(2, '0') + ':';
      }
    }
    e.target.value = value;
  });
}

// Category handling
function initCategoryHandling() {
  const categorySelect = document.getElementById('category');
  const downloadLinkGroup = document.getElementById('downloadLinkGroup');
  if (categorySelect && downloadLinkGroup) {
    categorySelect.addEventListener('change', (e) => {
      downloadLinkGroup.style.display = (e.target.value === 'japan') ? 'block' : 'none';
    });
  }
}

// Tags handling
function initTagsHandling() {
  const tagsInput = document.getElementById('tagsInput');
  const tagsDisplay = document.getElementById('tagsDisplay');
  if (!tagsInput || !tagsDisplay) return;

  tagsInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagsInput.value.trim());
      tagsInput.value = '';
    } else if (e.key === 'Backspace' && tagsInput.value === '' && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  });

  function addTag(tag) { if (tag && !tags.includes(tag)) { tags.push(tag); renderTags(); } }
  function removeTag(index) { tags.splice(index, 1); renderTags(); }
  function renderTags() {
    tagsDisplay.innerHTML = tags.map((tag, index) => `
      <span class="tag-chip">
        ${tag}
        <button type="button" class="tag-remove" onclick="removeTagByIndex(${index})">×</button>
      </span>`).join('');
  }
  window.removeTagByIndex = removeTag;
}

// Notes counter
function initNotesCounter() {
  const notesTextarea = document.getElementById('notes');
  const notesCount = document.getElementById('notesCount');
  if (notesTextarea && notesCount) {
    notesTextarea.addEventListener('input', (e) => {
      notesCount.textContent = e.target.value.length;
    });
  }
}

// Submit add video
async function submitVideoForm(saveAndNew = false) {
  const form = document.getElementById('addVideoForm');
  if (!form) return;

  const formData = new FormData(form);

  const embedUrls = [];
  const embedCount = parseInt(document.querySelector('input[name="embedCount"]:checked')?.value || '1');
  for (let i = 1; i <= embedCount; i++) {
    const input = document.querySelector(`input[name="embedUrl${i}"]`);
    if (input && input.value.trim()) embedUrls.push(input.value.trim());
  }
  if (Array.isArray(embedUrls) && embedUrls.length === 1) {
    const normalized = normalizeB2(embedUrls[0]);
    embedUrls[0] = normalized;
    const onlyInput = document.querySelector('input[name="embedUrl1"]');
    if (onlyInput) onlyInput.value = normalized;
  }
  formData.set('embedUrls', JSON.stringify(embedUrls));

  formData.set('tags', JSON.stringify(tags));

  const thumbnailType = document.querySelector('input[name="thumbnailType"]:checked')?.value;
  if (thumbnailType === 'url') {
    const el = document.getElementById('thumbnailUrlInput');
    const raw = (el?.value || '').trim();
    if (raw) {
      const norm = normalizeB2(raw);
      if (el) el.value = norm;
      formData.set('thumbnailUrl', norm);
    }
    formData.delete('thumbnail');
  }

  try {
    const response = await fetch('/api/admin/videos', {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    if (response.ok) {
      showToast('Đã thêm video thành công', 'success');
      if (saveAndNew) {
        form.reset();
        tags = [];
        const tagsDisplay = document.getElementById('tagsDisplay');
        const notesCount = document.getElementById('notesCount');
        const thumbnailPreview = document.getElementById('thumbnailPreview');
        const thumbnailFilePreview = document.getElementById('thumbnailFilePreview');
        if (tagsDisplay) tagsDisplay.innerHTML = '';
        if (notesCount) notesCount.textContent = '0';
        if (thumbnailPreview) thumbnailPreview.innerHTML = '';
        if (thumbnailFilePreview) thumbnailFilePreview.innerHTML = '';
        const embedCount1 = document.querySelector('input[name="embedCount"][value="1"]');
        if (embedCount1) { embedCount1.checked = true; updateEmbedInputs(1); }
        const thumbnailTypeUrl = document.querySelector('input[name="thumbnailType"][value="url"]');
        const thumbnailUrl = document.getElementById('thumbnailUrl');
        const thumbnailUpload = document.getElementById('thumbnailUpload');
        if (thumbnailTypeUrl) thumbnailTypeUrl.checked = true;
        if (thumbnailUrl) thumbnailUrl.style.display = 'block';
        if (thumbnailUpload) thumbnailUpload.style.display = 'none';
      } else {
        window.location.href = '/admin/dashboard.html';
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to create video');
    }
  } catch (error) {
    console.error('Error creating video:', error);
    showToast('Có lỗi xảy ra: ' + error.message, 'error');
  }
}

// Utils
function formatViews(views) {
  const oneDecimal = (n) => n.toFixed(1).replace(/\.0$/, '');
  if (views >= 1_000_000_000) return oneDecimal(views / 1_000_000_000) + 'B';
  if (views >= 1_000_000)     return oneDecimal(views / 1_000_000) + 'M';
  if (views >= 1_000)         return oneDecimal(views / 1_000) + 'K';
  return views.toString();
}
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('vi-VN');
}
function getCategoryDisplay(category) {
  const categories = { 'none': 'None', 'gaydar': 'Gaydar', 'asian': 'Asian', 'japan': 'Japan', 'straight': 'Straight' };
  return categories[category] || 'None';
}
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Toast
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('show'); }, 100);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => { if (container.contains(toast)) container.removeChild(toast); }, 300);
  }, 3000);
}

// Confirm modal
function showConfirmModal(title, message, onConfirm) {
  const modal = document.getElementById('confirmModal');
  const titleEl = document.getElementById('confirmTitle');
  const messageEl = document.getElementById('confirmMessage');
  const cancelBtn = document.getElementById('confirmCancel');
  const okBtn = document.getElementById('confirmOk');
  if (!modal || !titleEl || !messageEl || !cancelBtn || !okBtn) return;

  titleEl.textContent = title;
  messageEl.textContent = message;
  modal.classList.add('show');

  function closeModal() {
    modal.classList.remove('show');
    cancelBtn.removeEventListener('click', closeModal);
    okBtn.removeEventListener('click', confirmAction);
    modal.removeEventListener('click', outsideClick);
  }
  function confirmAction() { onConfirm(); closeModal(); }
  function outsideClick(e) { if (e.target === modal) closeModal(); }

  cancelBtn.addEventListener('click', closeModal);
  okBtn.addEventListener('click', confirmAction);
  modal.addEventListener('click', outsideClick);
}

// ====== SẮP XẾP THỦ CÔNG ======
let reorderList = [];
async function openReorderModal() {
  const res = await fetch('/api/admin/videos?limit=1000', { credentials: 'include' });
  if (!res.ok) { alert('Không tải được danh sách'); return; }
  const data = await res.json();
  const arr = Array.isArray(data?.videos) ? data.videos : (Array.isArray(data) ? data : []);
  reorderList = arr.map(v => ({ id: String(v.id), title: v.title || ('#' + v.id) }));
  renderReorderList();
  const modal = document.getElementById('reorderModal');
  if (modal) modal.style.display = 'flex';
}
function renderReorderList() {
  const el = document.getElementById('reorderList');
  if (!el) return;
  if (!reorderList.length) { el.innerHTML = '<li>Chưa có video nào.</li>'; return; }
  el.innerHTML = reorderList.map((v, i) => `
    <li data-id="${v.id}">
      <span class="idx">${i + 1}.</span>
      <span class="ttl">${v.title}</span>
      <span class="act">
        <button class="up"  data-id="${v.id}" title="Lên">↑</button>
        <button class="down" data-id="${v.id}" title="Xuống">↓</button>
        <button class="top" data-id="${v.id}" title="Đầu">Đầu</button>
      </span>
    </li>`).join('');
}
function moveItem(id, delta) {
  const i = reorderList.findIndex(v => v.id === String(id));
  const j = i + delta;
  if (i < 0 || j < 0 || j >= reorderList.length) return;
  [reorderList[i], reorderList[j]] = [reorderList[j], reorderList[i]];
  renderReorderList();
}
function moveItemToTop(id) {
  const i = reorderList.findIndex(v => v.id === String(id));
  if (i < 0) return;
  reorderList.unshift(...reorderList.splice(i, 1));
  renderReorderList();
}
async function saveOrder() {
  const order = reorderList.map(v => v.id);
  const res = await fetch('/api/admin/videos/reorder', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order })
  });
  if (res.ok) {
    if (typeof showToast === 'function') showToast('Đã lưu thứ tự mới');
    const modal = document.getElementById('reorderModal');
    if (modal) modal.style.display = 'none';
    if (typeof loadVideos === 'function') loadVideos();
  } else {
    alert('Lưu thất bại');
  }
}
document.addEventListener('DOMContentLoaded', () => {
  const btnOpen = document.getElementById('openReorder');
  const btnSave = document.getElementById('saveOrder');
  const modal = document.getElementById('reorderModal');
  if (btnOpen) btnOpen.addEventListener('click', openReorderModal);
  if (btnSave) btnSave.addEventListener('click', saveOrder);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target.classList.contains('close') || e.target.id === 'reorderModal') modal.style.display = 'none';
      if (e.target.classList.contains('up'))   moveItem(e.target.dataset.id, -1);
      if (e.target.classList.contains('down')) moveItem(e.target.dataset.id, +1);
      if (e.target.classList.contains('top'))  moveItemToTop(e.target.dataset.id);
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
