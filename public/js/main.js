// Age gate functionality
function initAgeGate() {
    const ageGate = document.getElementById('ageGate');
    const enterBtn = document.getElementById('enterSite');
    
    // Check if user already confirmed age
    if (localStorage.getItem('ageConfirmed') === 'true') {
        ageGate.classList.add('hidden');
        document.body.style.overflow = 'auto';
    } else {
        document.body.style.overflow = 'hidden';
    }
    
    enterBtn.addEventListener('click', () => {
        localStorage.setItem('ageConfirmed', 'true');
        ageGate.classList.add('hidden');
        document.body.style.overflow = 'auto';
    });
}

// Global state
let currentPage = 1;
let currentCategory = 'all';
let currentSearch = '';
let isLoading = false;
let searchTimeout;

// Advanced search function
function performSearch(query) {
    // Clear previous timeout
    clearTimeout(searchTimeout);
    
    // Only search if query has 2+ characters or is empty (to reset)
    if (query.trim().length > 0 && query.trim().length < 2) {
        return;
    }
    
    // Debounce search to avoid too many API calls
    searchTimeout = setTimeout(() => {
        currentSearch = query.trim();
        currentPage = 1;
        console.log('Performing search for:', currentSearch);
        
        // Update UI to show searching state
        const searchInput = document.getElementById('searchInput');
        const mobileSearchInput = document.getElementById('mobileSearchInput');
        
        if (currentSearch) {
            if (searchInput) searchInput.classList.add('searching');
            if (mobileSearchInput) mobileSearchInput.classList.add('searching');
        }
        
        loadVideos();
    }, 300); // Wait 300ms after user stops typing
}

// Search functionality with advanced features
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    const mobileSearchToggle = document.querySelector('.mobile-search-toggle');
    const mobileSearch = document.querySelector('.mobile-search');
    const mobileSearchClose = document.querySelector('.mobile-search-close');
    
    // Desktop search
    if (searchInput) {
        // Real-time search as user types
        searchInput.addEventListener('input', (e) => {
            performSearch(e.target.value);
        });
        
        // Handle Enter key for immediate search
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(searchTimeout);
                performSearch(e.target.value);
            }
        });
        
        // Clear searching state when not focused
        searchInput.addEventListener('blur', () => {
            setTimeout(() => {
                searchInput.classList.remove('searching');
            }, 1000);
        });
    }
    
    // Mobile search toggle
    if (mobileSearchToggle) {
        mobileSearchToggle.addEventListener('click', () => {
            mobileSearch.classList.add('active');
            mobileSearchInput.focus();
        });
    }
    
    if (mobileSearchClose) {
        mobileSearchClose.addEventListener('click', () => {
            mobileSearch.classList.remove('active');
            mobileSearchInput.value = '';
            performSearch('');
        });
    }
    
    // Mobile search
    if (mobileSearchInput) {
        // Real-time search for mobile
        mobileSearchInput.addEventListener('input', (e) => {
            performSearch(e.target.value);
        });
        
        mobileSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(searchTimeout);
                performSearch(e.target.value);
                mobileSearch.classList.remove('active');
            }
        });
        
        // Clear searching state
        mobileSearchInput.addEventListener('blur', () => {
            setTimeout(() => {
                mobileSearchInput.classList.remove('searching');
            }, 1000);
        });
    }
}

// Category filter
function initCategoryFilter() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update category and reload
            currentCategory = btn.dataset.category;
            currentPage = 1;
            
            loadVideos();
        });
    });
}

// Generate skeleton loading
function generateSkeleton(count = 20) {
    const skeleton = document.getElementById('loadingSkeleton');
    skeleton.innerHTML = '';
    
    for (let i = 0; i < count; i++) {
        const skeletonCard = document.createElement('a');
        skeletonCard.className = 'skeleton-card';
        skeletonCard.innerHTML = `
            <div class="skeleton-thumbnail skeleton"></div>
            <div class="skeleton-info">
                <div class="skeleton-title skeleton"></div>
                <div class="skeleton-meta skeleton"></div>
            </div>
        `;
        skeleton.appendChild(skeletonCard);
    }
}

// Load videos with advanced search
async function loadVideos() {
    if (isLoading) return;
    
    isLoading = true;
    const videoGrid = document.getElementById('videoGrid');
    const loadingSkeleton = document.getElementById('loadingSkeleton');
    const pagination = document.getElementById('pagination');
    
    // Show skeleton
    videoGrid.style.visibility = 'hidden';
    loadingSkeleton.style.display = 'grid';
    pagination.innerHTML = '';
    
    try {
        const params = new URLSearchParams({
            page: currentPage,
            limit: getItemsPerPage(),
            category: currentCategory === 'all' ? '' : currentCategory,
            search: currentSearch
        });
        
	

        // Mobile = 16 / trang, PC giữ nguyên như hiện tại
if (window.matchMedia('(max-width: 768px)').matches) {
  params.set('limit','20');
}

	console.log('Loading videos with params:', Object.fromEntries(params));
        
        const response = await fetch(`/api/videos?${params}`);
        const data = await response.json();
        
        // Hide skeleton and remove searching state
        loadingSkeleton.style.display = 'none';
        videoGrid.style.visibility = 'visible';
        
        const searchInput = document.getElementById('searchInput');
        const mobileSearchInput = document.getElementById('mobileSearchInput');
        if (searchInput) searchInput.classList.remove('searching');
        if (mobileSearchInput) mobileSearchInput.classList.remove('searching');
        
        if (data.videos.length === 0) {
            const noResultsMessage = currentSearch 
                ? `Không tìm thấy video với từ khóa "<strong>${currentSearch}</strong>"<br>
                   <small>Hãy thử tìm kiếm với từ khóa khác hoặc ít ký tự hơn</small>` 
                : 'Không tìm thấy video trong danh mục này';
                
            videoGrid.innerHTML = `
                <div class="no-results" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
                    <h3 style="margin-bottom: 1rem;">Không có kết quả</h3>
                    <p style="color: #a7a7b3; margin-bottom: 2rem;">${noResultsMessage}</p>
                    ${currentSearch ? `
                        <button onclick="clearSearch()" class="btn-secondary">
                            ✕ Xóa tìm kiếm
                        </button>
                    ` : ''}
                </div>
            `;
        } else {
            renderVideos(data.videos);
            
            // Show search results info
            if (currentSearch) {
                const searchInfo = document.createElement('a');
                searchInfo.className = 'search-info';
                searchInfo.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 1rem;">
                        <span style="color: #eaeaea;">
                            <strong>${data.pagination.total}</strong> video cho "<strong>${currentSearch}</strong>"
                        </span>
                        <button onclick="clearSearch()" style="background: rgba(255,107,107,0.2); border: 1px solid #ff6b6b; color: #ff6b6b; padding: 0.25rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem; transition: all 0.2s ease;">
                            ✕ Xóa
                        </button>
                    </div>
                `;
                videoGrid.insertBefore(searchInfo, videoGrid.firstChild);
            }
        }
        
        renderPagination(data.pagination);
        
    } catch (error) {
        console.error('Error loading videos:', error);
        loadingSkeleton.style.display = 'none';
        videoGrid.style.display = 'grid';
        
        // Remove searching state on error
        const searchInput = document.getElementById('searchInput');
        const mobileSearchInput = document.getElementById('mobileSearchInput');
        if (searchInput) searchInput.classList.remove('searching');
        if (mobileSearchInput) mobileSearchInput.classList.remove('searching');
        
        videoGrid.innerHTML = `
            <div class="no-results" style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                <h3>Lỗi tải dữ liệu</h3>
                <p style="color: #a7a7b3; margin-bottom: 2rem;">Vui lòng thử lại sau</p>
                <button onclick="loadVideos()" class="btn-primary">Thử lại</button>
            </div>
        `;
    }
    
    isLoading = false;
}

// Helper function to clear search
function clearSearch() {
    currentSearch = '';
    currentPage = 1;
    
    // Clear search inputs
    const searchInput = document.getElementById('searchInput');
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    
    if (searchInput) {
        searchInput.value = '';
        searchInput.classList.remove('searching');
    }
    if (mobileSearchInput) {
        mobileSearchInput.value = '';
        mobileSearchInput.classList.remove('searching');
    }
    
    loadVideos();
}

// Get items per page based on screen size
function getItemsPerPage() {
    const width = window.innerWidth;
    if (width <= 480) return 12; // 2 columns
    if (width <= 768) return 15; // 3 columns
    if (width <= 1199) return 16; // 4 columns
    return 20; // 5 columns
}

// Render videos
function renderVideos(videos) {
    const videoGrid = document.getElementById('videoGrid');
    videoGrid.innerHTML = '';
    
    videos.forEach(video => {
        const videoCard = document.createElement('a');
        videoCard.className = 'video-card';
    videoCard.href = '/video.html?id=' + video.id;
        videoCard.innerHTML = `
            <div class="video-thumbnail">
                <img src="${video.thumbnail}" alt="${video.title}" loading="lazy" decoding="async"
		     width="1280" height="720" 
                     onerror="this.src='/images/placeholder.jpg'">
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
        `;videoGrid.appendChild(videoCard);
    });
}

// Format views count
function formatViews(views) {
  const oneDecimal = (n) => n.toFixed(1).replace(/\.0$/, '');
  if (views >= 1000000000) {        // 1B+
    return oneDecimal(views / 1000000000) + 'B';
  } else if (views >= 1000000) {    // 1M+
    return oneDecimal(views / 1000000) + 'M';
  } else if (views >= 1000) {       // 1K+
    return oneDecimal(views / 1000) + 'K';
  }
  return views.toString();
}


// Render pagination
function renderPagination(pagination) {
    const paginationEl = document.getElementById('pagination');
    
    if (pagination.pages <= 1) {
        paginationEl.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Previous button
    if (pagination.page > 1) {
        html += `<button class="pagination-btn" onclick="goToPage(${pagination.page - 1})">Trước</button>`;
    }
    
    // Page numbers
    const startPage = Math.max(1, pagination.page - 2);
    const endPage = Math.min(pagination.pages, pagination.page + 2);
    
    if (startPage > 1) {
        html += `<button class="pagination-btn" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) {
            html += `<span style="padding: 0 0.5rem; color: #a7a7b3;">...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="pagination-btn ${i === pagination.page ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    
    if (endPage < pagination.pages) {
        if (endPage < pagination.pages - 1) {
            html += `<span style="padding: 0 0.5rem; color: #a7a7b3;">...</span>`;
        }
        html += `<button class="pagination-btn" onclick="goToPage(${pagination.pages})">${pagination.pages}</button>`;
    }
    
    // Next button
    if (pagination.page < pagination.pages) {
        html += `<button class="pagination-btn" onclick="goToPage(${pagination.page + 1})">Sau</button>`;
    }
    
    paginationEl.innerHTML = html;
}

// Go to page
function goToPage(page) {
    currentPage = page;
    loadVideos();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Make functions global
window.clearSearch = clearSearch;
window.goToPage = goToPage;

// Initialize everything
document.addEventListener('DOMContentLoaded', () => {
    initAgeGate();
    initSearch();
    initCategoryFilter();
    
    // Generate initial skeleton
    generateSkeleton();
    
    // Load initial videos
    setTimeout(() => {
        loadVideos();
    }, 100);
    
    // Handle window resize: chỉ reload khi đổi breakpoint (xs/sm/md/lg)
let resizeTimeout;
let __sizeBucket = getSizeBucket(); // lưu bucket hiện tại

window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const b = getSizeBucket();
    if (b !== __sizeBucket && !isLoading) {
      __sizeBucket = b;
      loadVideos(); // chỉ gọi khi đổi bucket
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



});

// Floating Chat (Home)
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

  btn.addEventListener('click', () => {
    panel.classList.contains('open') ? hide() : open();
  });
  closeBtn?.addEventListener('click', hide);
  backdrop?.addEventListener('click', hide);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });

  // Nếu lần trước user để mở, tự mở lại
  if (localStorage.getItem('chatOpen') === '1') open();
}

document.addEventListener('DOMContentLoaded', () => {
  try { initFloatingChat(); } catch (e) { console.error(e); }
});
