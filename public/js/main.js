// =======================
// Global state
// =======================
let currentPage = 1;
let currentCategory = 'all';
let currentSearch = '';
let isLoading = false;
let searchTimeout;

// =======================
// Sync State <-> URL (page, category, search)
// =======================
function getStateFromURL() {
  const p = new URLSearchParams(location.search);
  const search = (p.get('search') || '').trim();
  let category = (p.get('category') || 'all').toLowerCase();
  if (!['all','gaydar','asian','japan','straight'].includes(category)) category = 'all';
  const page = Math.max(1, parseInt(p.get('page') || '1', 10) || 1);
  return { search, category, page };
}

function applyState({ search, category, page }) {
  currentSearch = search;
  currentCategory = category;
  currentPage = page;

  // đồng bộ ô tìm kiếm (nếu có)
  const si = document.getElementById('searchInput');
  const mi = document.getElementById('mobileSearchInput');
  if (si) si.value = search;
  if (mi) mi.value = search;

  markActiveNav();
}

function updateURL(push = false) {
  const q = new URLSearchParams(location.search);

  if (currentCategory && currentCategory !== 'all') q.set('category', currentCategory); else q.delete('category');
  if (currentSearch) q.set('search', currentSearch); else q.delete('search');
  if (currentPage && currentPage > 1) q.set('page', String(currentPage)); else q.delete('page');

  const qs = q.toString();
  const url = qs ? `/?${qs}` : '/';
  const state = { page: currentPage, category: currentCategory, search: currentSearch };
  if (push) history.pushState(state, '', url);
  else history.replaceState(state, '', url);
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

    const searchInput = document.getElementById('searchInput');
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    if (currentSearch) {
      if (searchInput) searchInput.classList.add('searching');
      if (mobileSearchInput) mobileSearchInput.classList.add('searching');
    }

    updateURL(true); // ghi ?search=&page= vào URL
    loadVideos();
  }, 300);
}

function initSearch() {
  const searchInput = document.getElementById('searchInput');
  const mobileSearchInput = document.getElementById('mobileSearchInput');
  const mobileSearchToggle = document.querySelector('.mobile-search-toggle');
  const mobileSearch = document.querySelector('.mobile-search');
  const mobileSearchClose = document.querySelector('.mobile-search-close');

  // Desktop
  if (searchInput) {
    searchInput.addEventListener('input', (e) => performSearch(e.target.value));
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(searchTimeout);
        performSearch(e.target.value);
      }
    });
    searchInput.addEventListener('blur', () => {
      setTimeout(() => searchInput.classList.remove('searching'), 1000);
    });
  }

  // Mobile toggle
  if (mobileSearchToggle) {
    mobileSearchToggle.addEventListener('click', () => {
      if (!mobileSearch) return;
      mobileSearch.classList.add('active');
      mobileSearchInput?.focus();
    });
  }
  if (mobileSearchClose) {
    mobileSearchClose.addEventListener('click', () => {
      if (!mobileSearch) return;
      mobileSearch.classList.remove('active');
      if (mobileSearchInput) {
        mobileSearchInput.value = '';
        performSearch('');
      }
    });
  }

  // Mobile input
  if (mobileSearchInput) {
    mobileSearchInput.addEventListener('input', (e) => performSearch(e.target.value));
    mobileSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(searchTimeout);
        performSearch(e.target.value);
        mobileSearch?.classList.remove('active');
      }
    });
    mobileSearchInput.addEventListener('blur', () => {
      setTimeout(() => mobileSearchInput.classList.remove('searching'), 1000);
    });
  }
}

// Optional: legacy filter buttons (không dùng nữa, để tránh lỗi cũ)
function initCategoryFilter() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.category;
      currentPage = 1;
      updateURL(true);
      loadVideos();
    });
  });
}

// =======================
// Skeleton
// =======================
function generateSkeleton(count = 20) {
  const skeleton = document.getElementById('loadingSkeleton');
  if (!skeleton) return;
  skeleton.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const el = document.createElement('a');
    el.className = 'skeleton-card';
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
  const allLinks = document.querySelectorAll('.nav .nav-link, .mobile-nav .nav-link');
  allLinks.forEach(a => {
    const u = new URL(a.getAttribute('href'), location.origin);
    const c = (new URLSearchParams(u.search).get('category') || 'all').toLowerCase();
    a.classList.toggle('active', c === currentCategory);
  });
}

// =======================
// Mobile hamburger + drawer
// =======================
function initMobileNav() {
  const btn = document.getElementById('menuToggle');
  const drawer = document.getElementById('mobileNav');
  const backdrop = document.getElementById('navBackdrop');

  if (!btn || !drawer) return; // nếu chưa thêm HTML mobile-nav thì bỏ qua

  const open = () => {
    drawer.classList.add('open');
    backdrop?.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    drawer.setAttribute('aria-hidden', 'false');
  };
  const close = () => {
    drawer.classList.remove('open');
    backdrop?.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    drawer.setAttribute('aria-hidden', 'true');
  };
  const toggle = () => (drawer.classList.contains('open') ? close() : open());

  btn.addEventListener('click', toggle);
  backdrop?.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  // Đóng khi chọn danh mục trong drawer
  drawer.addEventListener('click', (e) => {
    const a = e.target.closest('a.nav-link');
    if (a) close();
  });

  // Khi phóng to >768px thì tự đóng
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) close();
  });
}

// =======================
// API: Load videos
// =======================
async function loadVideos() {
  if (isLoading) return;
  isLoading = true;

  const videoGrid = document.getElementById('videoGrid');
  const loadingSkeleton = document.getElementById('loadingSkeleton');
  const pagination = document.getElementById('pagination');

  if (videoGrid) videoGrid.style.visibility = 'hidden';
  if (loadingSkeleton) loadingSkeleton.style.display = 'grid';
  if (pagination) pagination.innerHTML = '';

  try {
    const params = new URLSearchParams({
      page: currentPage,
      limit: getItemsPerPage(),
      category: currentCategory === 'all' ? '' : currentCategory,
      search: currentSearch
    });

    // Mobile: ép limit 20 để lưới đẹp
    if (window.matchMedia('(max-width: 768px)').matches) params.set('limit', '20');

    const res = await fetch(`/api/videos?${params}`);
    const data = await res.json();

    if (loadingSkeleton) loadingSkeleton.style.display = 'none';
    if (videoGrid) videoGrid.style.visibility = 'visible';

    const searchInput = document.getElementById('searchInput');
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    if (searchInput) searchInput.classList.remove('searching');
    if (mobileSearchInput) mobileSearchInput.classList.remove('searching');

    if (!data.videos || data.videos.length === 0) {
      if (videoGrid) {
        const noResultsMessage = currentSearch
          ? `No videos found for "<strong>${currentSearch}</strong>"<br><small>Try a different or shorter keyword</small>`
          : 'No videos in this category';
        videoGrid.innerHTML = `
          <div class="no-results" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
            <h3 style="margin-bottom: 1rem;">No results</h3>
            <p style="color: #a7a7b3; margin-bottom: 2rem;">${noResultsMessage}</p>
            ${currentSearch ? `<button onclick="clearSearch()" class="btn-secondary">✕ Clear search</button>` : ''}
          </div>`;
      }
    } else {
      renderVideos(data.videos);

      // Info cho truy vấn
      if (currentSearch && videoGrid) {
        const info = document.createElement('a');
        info.className = 'search-info';
        info.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:1rem;">
            <span style="color:#eaeaea;"><strong>${data.pagination.total}</strong> video for "<strong>${currentSearch}</strong>"</span>
            <button onclick="clearSearch()" style="background:rgba(255,107,107,.2);border:1px solid #ff6b6b;color:#ff6b6b;padding:.25rem .75rem;border-radius:6px;cursor:pointer;font-size:.8rem;transition:.2s">✕ Clear</button>
          </div>`;
        videoGrid.insertBefore(info, videoGrid.firstChild);
      }
    }

    renderPagination(data.pagination);
    markActiveNav(); // cập nhật trạng thái active sau khi render

  } catch (err) {
    console.error('Error loading videos:', err);
    if (loadingSkeleton) loadingSkeleton.style.display = 'none';
    if (videoGrid) {
      videoGrid.style.display = 'grid';
      videoGrid.innerHTML = `
        <div class="no-results" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
          <h3>Failed to load data</h3>
          <p style="color:#a7a7b3;margin-bottom:2rem;">Please try again later</p>
          <button onclick="loadVideos()" class="btn-primary">Retry</button>
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
  currentSearch = '';
  currentPage = 1;

  const searchInput = document.getElementById('searchInput');
  const mobileSearchInput = document.getElementById('mobileSearchInput');
  if (searchInput) { searchInput.value = ''; searchInput.classList.remove('searching'); }
  if (mobileSearchInput) { mobileSearchInput.value = ''; mobileSearchInput.classList.remove('searching'); }

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
  const videoGrid = document.getElementById('videoGrid');
  if (!videoGrid) return;
  videoGrid.innerHTML = '';

  videos.forEach(video => {
    const a = document.createElement('a');
    a.className = 'video-card';

    const slug = (video.title || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    a.href = '/watch/' + video.id + '/' + slug;
    a.innerHTML = `
      <div class="video-thumbnail">
        <img src="${video.thumbnail}" alt="${video.title}" loading="lazy" decoding="async"
             width="1280" height="720" onerror="this.src='/images/placeholder.jpg'">
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
  const oneDecimal = (n) => n.toFixed(1).replace(/\.0$/, '');
  if (v >= 1_000_000_000) return oneDecimal(v/1_000_000_000)+'B';
  if (v >= 1_000_000)     return oneDecimal(v/1_000_000)+'M';
  if (v >= 1_000)         return oneDecimal(v/1_000)+'K';
  return v.toString();
}

function renderPagination(pagination) {
  const el = document.getElementById('pagination');
  if (!el || !pagination || pagination.pages <= 1) {
    if (el) el.innerHTML = '';
    return;
  }
  let html = '';
  if (pagination.page > 1) {
    html += `<button class="pagination-btn" onclick="goToPage(${pagination.page - 1})">Prev</button>`;
  }
  const start = Math.max(1, pagination.page - 2);
  const end = Math.min(pagination.pages, pagination.page + 2);
  if (start > 1) {
    html += `<button class="pagination-btn" onclick="goToPage(1)">1</button>`;
    if (start > 2) html += `<span style="padding:0 .5rem;color:#a7a7b3;">...</span>`;
  }
  for (let i = start; i <= end; i++) {
    html += `<button class="pagination-btn ${i===pagination.page ? 'active':''}" onclick="goToPage(${i})">${i}</button>`;
  }
  if (end < pagination.pages) {
    if (end < pagination.pages - 1) html += `<span style="padding:0 .5rem;color:#a7a7b3;">...</span>`;
    html += `<button class="pagination-btn" onclick="goToPage(${pagination.pages})">${pagination.pages}</button>`;
  }
  if (pagination.page < pagination.pages) {
    html += `<button class="pagination-btn" onclick="goToPage(${pagination.page + 1})">Next</button>`;
  }
  el.innerHTML = html;
}

function goToPage(page) {
  currentPage = page;
  updateURL(true); // pushState để Back quay về trang trước
  loadVideos();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Xuất các hàm cần dùng từ HTML
window.clearSearch = clearSearch;
window.goToPage = goToPage;

// =======================
// Floating Chat (home)
// =======================
function initFloatingChat() {
  const btn = document.getElementById('chatToggle');
  const panel = document.getElementById('chatPanel');
  const closeBtn = document.getElementById('chatClose');
  const backdrop = document.getElementById('chatBackdrop');
  if (!btn || !panel) return;

  const open = () => {
    panel.classList.add('open');
    backdrop?.classList.add('open');
    localStorage.setItem('chatOpen', '1');
  };
  const hide = () => {
    panel.classList.remove('open');
    backdrop?.classList.remove('open');
    localStorage.removeItem('chatOpen');
  };

  // Toggle panel; nếu có teaser đang hiện thì bỏ đi
  btn.addEventListener('click', () => {
    const t = document.getElementById('chatTeaser');
    if (t) t.remove();
    panel.classList.contains('open') ? hide() : open();
  });

  closeBtn?.addEventListener('click', hide);
  backdrop?.addEventListener('click', hide);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });

  // Khôi phục trạng thái mở (nếu có)
  if (localStorage.getItem('chatOpen') === '1') open();

  // ---- TEASER: luôn hiện trên TRANG CHỦ sau ~3s, rung ~5s rồi tự tắt ----
  if (location.pathname === '/') {
    setTimeout(() => {
      if (!btn) return;

      let teaser = document.getElementById('chatTeaser');
      if (!teaser) {
        teaser = document.createElement('div');
        teaser.id = 'chatTeaser';
        teaser.className = 'chat-teaser';
        teaser.innerHTML = '<strong>Chat with me</strong><br><span>Request video</span>';
        btn.appendChild(teaser);
      }

      // show + shake
      teaser.classList.add('show', 'shake');

      // tắt sau 5s (không lưu localStorage => lần sau vào trang chủ lại hiện tiếp)
      setTimeout(() => {
        teaser.classList.remove('show', 'shake');
        teaser.remove();
      }, 5000);

      // Click vào bong bóng -> mở chat ngay
      teaser.addEventListener('click', () => {
        teaser.remove();
        open();
      }, { once: true });

    }, 3000); // delay 5s
  }
}



// =======================
// Init
// =======================
document.addEventListener('DOMContentLoaded', () => {
  initSearch();
  initMobileNav();

  // lấy state từ URL & chuẩn hoá URL ban đầu
  applyState(getStateFromURL());
  updateURL(false);

  markActiveNav();

  generateSkeleton();
  setTimeout(() => { loadVideos(); }, 100);

  // Reload data khi đổi breakpoint để lưới gọn
  let resizeTimeout;
  let __sizeBucket = getSizeBucket();
  window.addEventListener('resize', () => {
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
    if (w <= 480) return 'xs';
    if (w <= 768) return 'sm';
    if (w <= 1199) return 'md';
    return 'lg';
  }

  // Back/Forward: khôi phục state từ history/URL rồi load
  window.addEventListener('popstate', (e) => {
    const st = e.state || getStateFromURL();
    applyState(st);
    loadVideos();
  });

  // Floating chat (trang chủ)
  try { initFloatingChat(); } catch (e) { console.error(e); }
});
