const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcrypt');
const compression = require('compression');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Multer configuration
const storage = multer.diskStorage({
  destination: 'public/uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Data file path
const DATA_FILE = path.join(__dirname, 'data', 'videos.json');

// Initialize data file if not exists
async function initDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify([], null, 2));
  }
}

// Read videos data
async function readVideos() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Write videos data
async function writeVideos(videos) {
  await fs.writeFile(DATA_FILE, JSON.stringify(videos, null, 2));
}

// Helper function for subsequence matching
function subsequenceMatch(text, query) {
  if (!query || query.length < 2) return false;
  
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  
  let textIndex = 0;
  let queryIndex = 0;
  
  while (textIndex < textLower.length && queryIndex < queryLower.length) {
    if (textLower[textIndex] === queryLower[queryIndex]) {
      queryIndex++;
    }
    textIndex++;
  }
  
  return queryIndex === queryLower.length;
}

// Admin auth middleware
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (token !== 'Adat1997$') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// API Routes

// Get videos (public) - WITH ADVANCED SEARCH
app.get('/api/videos', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', category = '', sort = 'newest' } = req.query;
    let videos = await readVideos();
    
    // Filter published videos only
    videos = videos.filter(v => v.published !== false);
    
    // Advanced Search filter
    if (search && search.trim().length >= 2) {
      const searchTerm = search.trim();
      console.log('Searching for:', searchTerm);
      
      videos = videos.filter(v => {
        // Check title with subsequence matching
        const titleMatch = subsequenceMatch(v.title, searchTerm);
        
        // Also check tags for additional matches
        const tagMatch = v.tags && v.tags.some(tag => 
          subsequenceMatch(tag, searchTerm)
        );
        
        // Also support exact word matching for better results
        const exactMatch = v.title.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Support partial word matching with spaces
        const wordsMatch = searchTerm.toLowerCase().split(' ').every(word => 
          word.length >= 2 && v.title.toLowerCase().includes(word)
        );
        
        return titleMatch || tagMatch || exactMatch || wordsMatch;
      });
      
      console.log(`Found ${videos.length} videos matching "${searchTerm}"`);
    }
    
    // Category filter
    if (category && category !== 'all') {
      videos = videos.filter(v => v.category === category);
    }
    
    // Sort
    switch (sort) {
      case 'oldest':
        videos.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case 'views':
        videos.sort((a, b) => (b.views || 0) - (a.views || 0));
        break;
      default: // newest
        videos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    // Pagination
    const total = videos.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedVideos = videos.slice(startIndex, endIndex);
    
    res.json({
      videos: paginatedVideos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single video
app.get('/api/videos/:id', async (req, res) => {
  try {
    const videos = await readVideos();
    const video = videos.find(v => v.id === req.params.id);
    
    if (!video || video.published === false) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    // Increment views
    video.views = (video.views || 0) + 1;
    await writeVideos(videos);
    
    res.json(video);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get related videos - SỬA LẠI LOGIC HOÀN TOÀN
app.get('/api/videos/:id/related', async (req, res) => {
  try {
    const videos = await readVideos();
    const currentVideo = videos.find(v => v.id === req.params.id);
    
    if (!currentVideo) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    console.log('Finding related videos for:', currentVideo.title);
    
    // Filter out current video and unpublished videos
    const availableVideos = videos.filter(v => 
      v.id !== req.params.id && v.published !== false
    );
    
    console.log('Available videos for relation:', availableVideos.length);
    
    if (availableVideos.length === 0) {
      return res.json([]);
    }
    
    let relatedVideos = [];
    
    // 1. Find videos with similar titles (advanced matching)
    const currentTitle = currentVideo.title.toLowerCase();
    const currentWords = currentTitle.split(/[\s\-_.,!@#$%^&*()]+/).filter(word => word.length >= 2);
    
    console.log('Current video words:', currentWords);
    
    // Method 1: Find videos sharing common words or subsequences
    const titleMatches = availableVideos.filter(v => {
      const videoTitle = v.title.toLowerCase();
      const videoWords = videoTitle.split(/[\s\-_.,!@#$%^&*()]+/).filter(word => word.length >= 2);
      
      // Check if they share significant words or subsequences
      const hasSharedWords = currentWords.some(currentWord => 
        videoWords.some(videoWord => {
          // Exact match
          if (currentWord === videoWord) return true;
          
          // One contains the other
          if (currentWord.length >= 3 && videoWord.includes(currentWord)) return true;
          if (videoWord.length >= 3 && currentWord.includes(videoWord)) return true;
          
          // Subsequence matching for longer words
          if (currentWord.length >= 4 && subsequenceMatch(videoWord, currentWord)) return true;
          if (videoWord.length >= 4 && subsequenceMatch(currentWord, videoWord)) return true;
          
          return false;
        })
      );
      
      // Also check subsequence matching on full titles
      const titleSubsequence = subsequenceMatch(videoTitle, currentTitle.substring(0, Math.min(10, currentTitle.length)));
      
      return hasSharedWords || titleSubsequence;
    });
    
    console.log('Title matches found:', titleMatches.length);
    
    // Score and sort title matches by relevance
    const scoredTitleMatches = titleMatches.map(video => {
      const videoTitle = video.title.toLowerCase();
      const videoWords = videoTitle.split(/[\s\-_.,!@#$%^&*()]+/).filter(word => word.length >= 2);
      
      let score = 0;
      
      // Score based on shared words
      currentWords.forEach(currentWord => {
        videoWords.forEach(videoWord => {
          if (currentWord === videoWord) score += 10; // Exact word match
          else if (currentWord.includes(videoWord) || videoWord.includes(currentWord)) score += 5; // Partial match
          else if (subsequenceMatch(currentWord, videoWord) || subsequenceMatch(videoWord, currentWord)) score += 3; // Subsequence match
        });
      });
      
      return { ...video, score };
    }).sort((a, b) => b.score - a.score);
    
    relatedVideos = scoredTitleMatches.slice(0, 4);
    
    // Method 2: If not enough, find by category
    if (relatedVideos.length < 4) {
      const categoryMatches = availableVideos.filter(v => 
        v.category === currentVideo.category && 
        !relatedVideos.find(r => r.id === v.id)
      );
      
      console.log('Category matches found:', categoryMatches.length);
      const needed = 4 - relatedVideos.length;
      relatedVideos = [...relatedVideos, ...categoryMatches.slice(0, needed)];
    }
    
    // Method 3: If still not enough, find by tags
    if (relatedVideos.length < 4 && currentVideo.tags && currentVideo.tags.length > 0) {
      const tagMatches = availableVideos.filter(v => 
        v.tags && v.tags.some(tag => currentVideo.tags.includes(tag)) &&
        !relatedVideos.find(r => r.id === v.id)
      );
      
      console.log('Tag matches found:', tagMatches.length);
      const needed = 4 - relatedVideos.length;
      relatedVideos = [...relatedVideos, ...tagMatches.slice(0, needed)];
    }
    
    // Method 4: If still not enough, add random videos
    if (relatedVideos.length < 4) {
      const remainingVideos = availableVideos.filter(v => 
        !relatedVideos.find(r => r.id === v.id)
      );
      
      // Shuffle and add random videos
      const shuffledRemaining = remainingVideos.sort(() => 0.5 - Math.random());
      const needed = 4 - relatedVideos.length;
      const randomVideos = shuffledRemaining.slice(0, needed);
      
      console.log('Random videos added:', randomVideos.length);
      relatedVideos = [...relatedVideos, ...randomVideos];
    }
    
    // Clean up and limit to exactly 4
    const finalRelated = relatedVideos.slice(0, 4).map(video => ({
      id: video.id,
      title: video.title,
      thumbnail: video.thumbnail,
      duration: video.duration,
      views: video.views || 0,
      category: video.category,
      tags: video.tags || []
    }));
    
    console.log('Final related videos:', finalRelated.length);
    
    res.json(finalRelated);
  } catch (error) {
    console.error('Related videos error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin API Routes

// Get all videos (admin)
app.get('/api/admin/videos', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', category = '', sort = 'newest' } = req.query;
    let videos = await readVideos();
    
    // Search filter
    if (search) {
      videos = videos.filter(v => 
        v.title.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    // Category filter
    if (category && category !== 'all') {
      videos = videos.filter(v => v.category === category);
    }
    
    // Sort
    switch (sort) {
      case 'oldest':
        videos.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case 'views':
        videos.sort((a, b) => (b.views || 0) - (a.views || 0));
        break;
      default: // newest
        videos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    // Add sequential numbers
    videos = videos.map((video, index) => ({
      ...video,
      sequentialId: index + 1
    }));
    
    // Pagination
    const total = videos.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedVideos = videos.slice(startIndex, endIndex);
    
    res.json({
      videos: paginatedVideos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create video (admin)
app.post('/api/admin/videos', requireAuth, upload.single('thumbnail'), async (req, res) => {
  try {
    const videos = await readVideos();
    const {
      title,
      embedUrls,
      thumbnailUrl,
      duration,
      category,
      tags,
      notes,
      downloadLink
    } = req.body;
    
    const newVideo = {
      id: Date.now().toString(),
      title,
      embedUrls: JSON.parse(embedUrls || '[]'),
      thumbnail: req.file ? `/uploads/${req.file.filename}` : thumbnailUrl,
      duration,
      category: category || 'none',
      tags: JSON.parse(tags || '[]'),
      notes: notes || '',
      downloadLink: downloadLink || '',
      views: 0,
      published: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    videos.unshift(newVideo);
    await writeVideos(videos);
    
    res.json(newVideo);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update video (admin)
app.put('/api/admin/videos/:id', requireAuth, upload.single('thumbnail'), async (req, res) => {
  try {
    const videos = await readVideos();
    const videoIndex = videos.findIndex(v => v.id === req.params.id);
    
    if (videoIndex === -1) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    const {
      title,
      embedUrls,
      thumbnailUrl,
      duration,
      category,
      tags,
      notes,
      downloadLink,
      published
    } = req.body;
    
    videos[videoIndex] = {
      ...videos[videoIndex],
      title,
      embedUrls: JSON.parse(embedUrls || '[]'),
      thumbnail: req.file ? `/uploads/${req.file.filename}` : thumbnailUrl || videos[videoIndex].thumbnail,
      duration,
      category: category || 'none',
      tags: JSON.parse(tags || '[]'),
      notes: notes || '',
      downloadLink: downloadLink || '',
      published: published !== 'false',
      updatedAt: new Date().toISOString()
    };
    
    await writeVideos(videos);
    
    res.json(videos[videoIndex]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete video (admin)
app.delete('/api/admin/videos/:id', requireAuth, async (req, res) => {
  try {
    const videos = await readVideos();
    const filteredVideos = videos.filter(v => v.id !== req.params.id);
    
    if (videos.length === filteredVideos.length) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    await writeVideos(filteredVideos);
    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Toggle video visibility (admin)
app.patch('/api/admin/videos/:id/toggle', requireAuth, async (req, res) => {
  try {
    const videos = await readVideos();
    const video = videos.find(v => v.id === req.params.id);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    video.published = !video.published;
    video.updatedAt = new Date().toISOString();
    
    await writeVideos(videos);
    res.json(video);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/video.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'video.html'));
});

// Admin routes
app.get('/admin', (req, res) => {
  res.redirect('/admin/login.html');
});

app.get('/admin/', (req, res) => {
  res.redirect('/admin/login.html');
});

app.get('/admin/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html'));
});

app.get('/admin/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

app.get('/admin/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

app.get('/admin/add-video.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'add-video.html'));
});

app.get('/admin/edit-video.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'edit-video.html'));
});

// Initialize and start server
async function startServer() {
  await initDataFile();
  
  // Create uploads directory
  await fs.mkdir('public/uploads', { recursive: true });
  
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
