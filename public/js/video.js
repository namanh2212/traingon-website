let currentVideo = null;
let currentServerIndex = 0;

// Get video ID from URL
function getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Load video data
async function loadVideo() {
    const videoId = getVideoId();
    if (!videoId) {
        window.location.href = '/';
        return;
    }
    
    try {
        console.log('Loading video with ID:', videoId);
        const response = await fetch(`/api/videos/${videoId}`);
        if (!response.ok) {
            throw new Error('Video not found');
        }
        
        currentVideo = await response.json();
        console.log('Video loaded:', currentVideo);
        
        // Update page title
        document.title = `${currentVideo.title} - Traingon.top`;
        
        // Render video
        renderVideo();
        
        // Load related videos
        loadRelatedVideos();
        
    } catch (error) {
        console.error('Error loading video:', error);
        document.getElementById('videoPlayer').innerHTML = `
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
        const serverButtons = document.getElementById('serverButtons');
        serverButtons.style.display = 'flex';
        
        let buttonsHtml = '';
        currentVideo.embedUrls.forEach((url, index) => {
            buttonsHtml += `
                <button class="server-btn ${index === 0 ? 'active' : ''}" onclick="switchServer(${index})">
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
function renderVideoPlayer() {
    const videoPlayer = document.getElementById('videoPlayer');
    const embedUrl = currentVideo.embedUrls[currentServerIndex];
    
    // Extract embed URL if it's a full page URL
    let iframeUrl = embedUrl;
    if (embedUrl.includes('mixdrop.co/') && !embedUrl.includes('/e/')) {
        const videoId = embedUrl.split('/').pop();
        iframeUrl = `https://mixdrop.co/e/${videoId}`;
    } else if (embedUrl.includes('streamtape.com/') && !embedUrl.includes('/e/')) {
        const videoId = embedUrl.split('/').pop();
        iframeUrl = `https://streamtape.com/e/${videoId}`;
    }
    
    videoPlayer.innerHTML = `
        <iframe src="${iframeUrl}" 
                width="100%" 
                height="100%" 
                frameborder="0" 
                scrolling="no" 
                allowfullscreen>
        </iframe>
    `;
}

// Switch server
function switchServer(index) {
    currentServerIndex = index;
    
    // Update active button
    document.querySelectorAll('.server-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
    });
    
    // Re-render player
    renderVideoPlayer();
}

// Render video details
function renderVideoDetails() {
    const videoDetails = document.getElementById('videoDetails');
    
    const tags = currentVideo.tags ? currentVideo.tags.map(tag => 
        `<span class="tag">${tag}</span>`
    ).join('') : '';
    
    const downloadSection = currentVideo.category === 'japan' && currentVideo.downloadLink ? `
        <a href="${currentVideo.downloadLink}" class="download-link" target="_blank">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
            Tải xuống
        </a>
    ` : '';
    
    videoDetails.innerHTML = `
        <h1 class="video-title">${currentVideo.title}</h1>
        <div class="video-meta">
            <div class="video-meta-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
                ${formatViews(currentVideo.views || 0)} lượt xem
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
        ${tags ? `<div class="video-tags">${tags}</div>` : ''}
        ${currentVideo.notes ? `<div class="video-description">${currentVideo.notes}</div>` : ''}
        ${downloadSection}
    `;
    
    videoDetails.style.display = 'block';
}

// Load related videos - SỬA LẠI HOÀN TOÀN
async function loadRelatedVideos() {
    try {
        console.log('Loading related videos for video ID:', currentVideo.id);
        
        // Show loading state
        const relatedGrid = document.getElementById('relatedGrid');
        if (!relatedGrid) {
            console.error('Related grid element not found');
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
        console.log('Related videos received:', relatedVideos);
        
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
        relatedGrid.innerHTML = relatedVideos.map(video => `
            <div class="video-card related-video-card" onclick="navigateToVideo('${video.id}')">
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
            </div>
        `).join('');
        
        console.log('Related videos rendered successfully');
        
    } catch (error) {
        console.error('Error loading related videos:', error);
        const relatedGrid = document.getElementById('relatedGrid');
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
function navigateToVideo(videoId) {
    console.log('Navigating to video:', videoId);
    window.location.href = `/video.html?id=${videoId}`;
}

// Setup mobile chat
function setupMobileChat() {
    const screenWidth = window.innerWidth;
    const desktopChat = document.querySelector('.desktop-chat');
    const mobileChat = document.querySelector('.mobile-chat');
    
    if (screenWidth <= 1023) {
        if (desktopChat) desktopChat.style.display = 'none';
        if (mobileChat) mobileChat.style.display = 'block';
        
        // Setup mobile chat accordion
        const chatAccordion = document.querySelector('.chat-accordion');
        const chatContent = document.querySelector('.chat-content');
        
        if (chatAccordion && chatContent) {
            chatAccordion.addEventListener('click', () => {
                chatContent.classList.toggle('active');
                chatAccordion.textContent = chatContent.classList.contains('active') 
                    ? '💬 Đóng Chat Room' 
                    : '💬 Mở Chat Room';
            });
        }
    } else {
        if (desktopChat) desktopChat.style.display = 'block';
        if (mobileChat) mobileChat.style.display = 'none';
    }
}

// Format views count
function formatViews(views) {
    if (views >= 1000000) {
        return Math.floor(views / 1000000) + 'M';
    } else if (views >= 1000) {
        return Math.floor(views / 1000) + 'K';
    }
    return views.toString();
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
}

// Make functions global
window.navigateToVideo = navigateToVideo;
window.loadRelatedVideos = loadRelatedVideos;
window.switchServer = switchServer;

// Initialize everything
document.addEventListener('DOMContentLoaded', () => {
    console.log('Video page loaded');
    loadVideo();
    
    // Handle window resize for mobile chat
    window.addEventListener('resize', () => {
        setupMobileChat();
    });
});
