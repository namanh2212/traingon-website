const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcrypt");
const compression = require("compression");
const helmet = require("helmet");

const app = express();
const PORT = process.env.PORT || 3000;

require("dotenv").config();
const cookieParser = require("cookie-parser");

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
  }),
);
app.use(compression());
app.use(cors());
app.use(express.json());

// Serve /video.html nhưng bỏ mọi meta robots và chèn canonical về /watch
app.get("/video.html", async (req, res) => {
  try {
    const id = String(req.query.id || "");
    let html = await fs.readFile(
      path.join(__dirname, "public", "video.html"),
      "utf8",
    );
    // Bỏ bất kỳ meta robots nào trong file gốc
    html = html.replace(/<meta[^>]*name=['"]robots['"][^>]*>\s*/i, "");
    if (id) {
      const raw = await fs.readFile(DATA_FILE, "utf8");
      const videos = JSON.parse(raw);
      const v = videos.find((x) => String(x.id) === id);
      const s = slugify(v?.title || id);
      const canonical = `${siteOrigin(req)}/watch/${id}/${s}`;
      if (v?.title) {
        html = html.replace(
          /<title>[\s\S]*?<\/title>/i,
          `<title>${escapeHtml(v.title)} — Traingon</title>`,
        );
      }
      html = html.replace(
        "</head>",
        `<link rel="canonical" href="${canonical}">\n</head>`,
      );
    }
    res.status(200).send(html);
  } catch (e) {
    console.error(e);
    res.sendFile(path.join(__dirname, "public", "video.html"));
  }
});

app.use(express.static("public"));

app.use(cookieParser());
app.set("trust proxy", 1); // đứng sau Cloudflare/Nginx

// Multer configuration
const storage = multer.diskStorage({
  destination: "public/uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// Data file path
const DATA_FILE = path.join(__dirname, "data", "videos.json");

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
    const data = await fs.readFile(DATA_FILE, "utf8");
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

// Admin auth middleware (dựa vào cookie HttpOnly)
function requireAuth(req, res, next) {
  if (req.cookies?.tg_admin === "1") return next();
  return res.status(401).json({ error: "Unauthorized" });
}

// ===== Public APIs =====

// Get videos (public) - WITH ADVANCED SEARCH
app.get("/api/videos", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      category = "",
      sort = "newest",
      time = "newest", // NEW: "newest" | "7d"
    } = req.query;
    let videos = await readVideos();

    // Filter published videos only
    videos = videos.filter((v) => v.published !== false);

    // Advanced Search filter
    if (search && search.trim().length >= 2) {
      const searchTerm = search.trim();
      videos = videos.filter((v) => {
        // title subsequence + exact + words + tag match
        const titleMatch = subsequenceMatch(v.title, searchTerm);
        const tagMatch =
          v.tags && v.tags.some((tag) => subsequenceMatch(tag, searchTerm));
        const exactMatch = v.title
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
        const wordsMatch = searchTerm
          .toLowerCase()
          .split(" ")
          .every(
            (word) => word.length >= 2 && v.title.toLowerCase().includes(word),
          );
        return titleMatch || tagMatch || exactMatch || wordsMatch;
      });
    }

    // Category filter
    if (category && category !== "all") {
      videos = videos.filter((v) => v.category === category);
    }

    // NEW: Time filter (Last 7 days)
if (time === "7d") {
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  videos = videos.filter((v) => {
    const t = Date.parse(v.createdAt || v.updatedAt || "");
    return !isNaN(t) && t >= since;
  });
}

    // ===== Sort cho Public (ưu tiên orderIndex nếu có) =====
switch (sort) {
  case "views":
    videos.sort((a, b) => (b.views || 0) - (a.views || 0));
    break;
  case "views_asc":
  videos.sort((a, b) => (a.views || 0) - (b.views || 0));
  break;
  case "oldest":
    videos.sort(
      (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
    );
    break;
  case "manual":
    videos.sort((a, b) => {
      const ao = a.orderIndex ?? -Infinity;
      const bo = b.orderIndex ?? -Infinity;
      if (bo !== ao) return bo - ao;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
    break;
  default: // "newest" mặc định cũng ưu tiên orderIndex
    videos.sort((a, b) => {
      const ao = a.orderIndex ?? -Infinity;
      const bo = b.orderIndex ?? -Infinity;
      if (bo !== ao) return bo - ao;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
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
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get single video (public, +1 view)
app.get("/api/videos/:id", async (req, res) => {
  try {
    const videos = await readVideos();
    const video = videos.find((v) => v.id === req.params.id);
    if (!video || video.published === false) {
      return res.status(404).json({ error: "Video not found" });
    }
    video.views = (video.views || 0) + 1;
    await writeVideos(videos);
    res.json(video);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Related videos
app.get("/api/videos/:id/related", async (req, res) => {
  try {
    const videos = await readVideos();
    const currentVideo = videos.find((v) => v.id === req.params.id);
    if (!currentVideo)
      return res.status(404).json({ error: "Video not found" });

    const available = videos.filter(
      (v) => v.id !== req.params.id && v.published !== false,
    );
    if (!available.length) return res.json([]);

    let related = [];

    // Method 1: title relevance
    const currentTitle = currentVideo.title.toLowerCase();
    const currentWords = currentTitle
      .split(/[\s\-_.,!@#$%^&*()]+/)
      .filter((w) => w.length >= 2);
    const titleMatches = available.filter((v) => {
      const vt = v.title.toLowerCase();
      const vw = vt.split(/[\s\-_.,!@#$%^&*()]+/).filter((w) => w.length >= 2);
      const hasShared = currentWords.some((cw) =>
        vw.some((ww) => {
          if (cw === ww) return true;
          if (cw.length >= 3 && ww.includes(cw)) return true;
          if (ww.length >= 3 && cw.includes(ww)) return true;
          if (cw.length >= 4 && subsequenceMatch(ww, cw)) return true;
          if (ww.length >= 4 && subsequenceMatch(cw, ww)) return true;
          return false;
        }),
      );
      const titleSub = subsequenceMatch(
        vt,
        currentTitle.substring(0, Math.min(10, currentTitle.length)),
      );
      return hasShared || titleSub;
    });

    const scored = titleMatches
      .map((v) => {
        const vt = v.title.toLowerCase();
        const vw = vt
          .split(/[\s\-_.,!@#$%^&*()]+/)
          .filter((w) => w.length >= 2);
        let score = 0;
        currentWords.forEach((cw) => {
          vw.forEach((ww) => {
            if (cw === ww) score += 10;
            else if (cw.includes(ww) || ww.includes(cw)) score += 5;
            else if (subsequenceMatch(cw, ww) || subsequenceMatch(ww, cw))
              score += 3;
          });
        });
        return { ...v, score };
      })
      .sort((a, b) => b.score - a.score);

    related = scored.slice(0, 4);

    // Method 2: same category
    if (related.length < 4) {
      const more = available.filter(
        (v) =>
          v.category === currentVideo.category &&
          !related.find((r) => r.id === v.id),
      );
      related = [...related, ...more.slice(0, 4 - related.length)];
    }

    // Method 3: same tags
    if (related.length < 4 && currentVideo.tags?.length) {
      const more = available.filter(
        (v) =>
          v.tags &&
          v.tags.some((t) => currentVideo.tags.includes(t)) &&
          !related.find((r) => r.id === v.id),
      );
      related = [...related, ...more.slice(0, 4 - related.length)];
    }

    // Method 4: random fill
    if (related.length < 4) {
      const remain = available.filter(
        (v) => !related.find((r) => r.id === v.id),
      );
      const shuffled = remain.sort(() => 0.5 - Math.random());
      related = [...related, ...shuffled.slice(0, 4 - related.length)];
    }

    const final = related.slice(0, 4).map((v) => ({
      id: v.id,
      title: v.title,
      thumbnail: v.thumbnail,
      duration: v.duration,
      views: v.views || 0,
      category: v.category,
      tags: v.tags || [],
    }));

    res.json(final);
  } catch (error) {
    console.error("Related videos error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== AUTH (USER+PASS+TOKEN từ .env) =====

// Check nhanh bước 1 (user+pass)
app.post("/api/auth/check", (req, res) => {
  const u = String(req.body?.username ?? "").trim();
  const p = String(req.body?.password ?? "");

  const U = String(process.env.ADMIN_USER ?? "").trim();
  const P = String(process.env.ADMIN_PASSWORD ?? "").trim();

  const ok = u === U && p === P;
  return res.sendStatus(ok ? 204 : 401);
});

// Login đủ 3 thông tin để set cookie HttpOnly
app.post("/api/auth/login", (req, res) => {
  const u = String(req.body?.username ?? "").trim();
  const p = String(req.body?.password ?? "");
  const t = String(req.body?.token ?? "");

  const U = String(process.env.ADMIN_USER ?? "").trim();
  const P = String(process.env.ADMIN_PASSWORD ?? "").trim();
  const T = String(process.env.ADMIN_TOKEN ?? "").trim();

  const ok = u === U && p === P && t === T;
  if (!ok) return res.sendStatus(401);

  const isProd = process.env.NODE_ENV === "production";
  res.cookie("tg_admin", "1", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 7 * 24 * 3600 * 1000,
  });
  res.sendStatus(204);
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("tg_admin");
  res.sendStatus(204);
});

app.get("/api/auth/me", (req, res) => {
  res.json({ ok: req.cookies?.tg_admin === "1" });
});

// ===== Admin APIs (bảo vệ bởi requireAuth) =====

app.get("/api/admin/videos", requireAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      category = "",
      sort = "newest",
    } = req.query;
    let videos = await readVideos();

    if (search) {
      videos = videos.filter((v) =>
        v.title.toLowerCase().includes(search.toLowerCase()),
      );
    }
    if (category && category !== "all") {
      videos = videos.filter((v) => v.category === category);
    }
    // ===== Sort cho Admin (ưu tiên orderIndex nếu có) =====
switch (sort) {
  case "views":
    videos.sort((a, b) => (b.views || 0) - (a.views || 0));
    break;
  case "oldest":
    videos.sort(
      (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
    );
    break;
  case "manual": // đúng thứ tự thủ công: orderIndex desc, rồi fallback newest
    videos.sort((a, b) => {
      const ao = a.orderIndex ?? -Infinity;
      const bo = b.orderIndex ?? -Infinity;
      if (bo !== ao) return bo - ao;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
    break;
  default: // "newest" cũng ưu tiên orderIndex nếu đã reorder
    videos.sort((a, b) => {
      const ao = a.orderIndex ?? -Infinity;
      const bo = b.orderIndex ?? -Infinity;
      if (bo !== ao) return bo - ao;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
}



    videos = videos.map((v, i) => ({ ...v, sequentialId: i + 1 }));

    const total = videos.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginated = videos.slice(startIndex, endIndex);

    res.json({
      videos: paginated,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// CHỈ cập nhật orderIndex, KHÔNG đụng createdAt/updatedAt
app.patch("/api/admin/videos/reorder", requireAuth, async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order) || !order.length) {
      return res.status(400).json({ error: "Invalid order" });
    }

    const videos = await readVideos();
    const byId = new Map(videos.map((v) => [String(v.id), v]));
    const idSet = new Set(order.map(String));

    // ghép mảng theo thứ tự người dùng truyền lên
    const sorted = [];
    for (const id of order) {
      const v = byId.get(String(id));
      if (v) sorted.push(v);
    }
    // phần còn lại giữ nguyên phía sau
    for (const v of videos) {
      if (!idSet.has(String(v.id))) sorted.push(v);
    }

    // gán orderIndex: số lớn hơn = ưu tiên cao hơn
    const max = sorted.length;
    sorted.forEach((v, idx) => {
      v.orderIndex = max - idx;
    });

    await writeVideos(sorted);
    res.json({ message: "Reordered", total: sorted.length });
  } catch (err) {
    console.error("Reorder error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


app.get("/api/admin/videos/:id", requireAuth, async (req, res) => {
  try {
    const videos = await readVideos();
    const video = videos.find((v) => String(v.id) === String(req.params.id));
    if (!video) return res.status(404).json({ error: "Video not found" });
    res.json(video);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post(
  "/api/admin/videos",
  requireAuth,
  upload.single("thumbnail"),
  async (req, res) => {
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
        downloadLink,
      } = req.body;

      const newVideo = {
        id: Date.now().toString(),
        title,
        embedUrls: JSON.parse(embedUrls || "[]"),
        thumbnail: req.file ? `/uploads/${req.file.filename}` : thumbnailUrl,
        duration,
        category: category || "none",
        tags: JSON.parse(tags || "[]"),
        notes: notes || "",
        downloadLink: downloadLink || "",
        views: 0,
        published: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      videos.unshift(newVideo);
      await writeVideos(videos);
      res.json(newVideo);
    } catch (error) {
      res.status(500).json({ error: "Server error" });
    }
  },
);

app.put(
  "/api/admin/videos/:id",
  requireAuth,
  upload.single("thumbnail"),
  async (req, res) => {
    try {
      const videos = await readVideos();
      const idx = videos.findIndex((v) => v.id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: "Video not found" });

      const {
        title,
        embedUrls,
        thumbnailUrl,
        duration,
        category,
        tags,
        notes,
        downloadLink,
        published,
      } = req.body;

      videos[idx] = {
        ...videos[idx],
        title,
        embedUrls: JSON.parse(embedUrls || "[]"),
        thumbnail: req.file
          ? `/uploads/${req.file.filename}`
          : thumbnailUrl || videos[idx].thumbnail,
        duration,
        category: category || "none",
        tags: JSON.parse(tags || "[]"),
        notes: notes || "",
        downloadLink: downloadLink || "",
        published: published !== "false",
        updatedAt: new Date().toISOString(),
      };

      await writeVideos(videos);
      res.json(videos[idx]);
    } catch (error) {
      res.status(500).json({ error: "Server error" });
    }
  },
);

app.delete("/api/admin/videos/:id", requireAuth, async (req, res) => {
  try {
    const videos = await readVideos();
    const filtered = videos.filter((v) => v.id !== req.params.id);
    if (videos.length === filtered.length)
      return res.status(404).json({ error: "Video not found" });
    await writeVideos(filtered);
    res.json({ message: "Video deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.patch("/api/admin/videos/:id/toggle", requireAuth, async (req, res) => {
  try {
    const videos = await readVideos();
    const video = videos.find((v) => v.id === req.params.id);
    if (!video) return res.status(404).json({ error: "Video not found" });
    video.published = !video.published;
    video.updatedAt = new Date().toISOString();
    await writeVideos(videos);
    res.json(video);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Admin routes
app.get("/admin", (req, res) => res.redirect("/admin/login.html"));
app.get("/admin/", (req, res) => res.redirect("/admin/login.html"));
app.get("/admin/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin", "login.html"));
});
app.get("/admin/dashboard.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin", "index.html"));
});
app.get("/admin/index.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin", "index.html"));
});
app.get("/admin/add-video.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin", "add-video.html"));
});
app.get("/admin/edit-video.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin", "edit-video.html"));
});

// === [SEO] /watch/:id/:slug + /sitemap.xml (auto từ data/videos.json) ===
const escapeHtml = (s) =>
  String(s || "").replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        m
      ],
  );
const slugify = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // bỏ dấu tiếng Việt
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const siteOrigin = (req) => {
  const host =
    req.headers["x-forwarded-host"] || req.get("host") || req.headers.host;
  if (!host) return "https://traingon.top"; // phòng hờ
  const isLocal = /^localhost(:\d+)?$|^127\.0\.0\.1(:\d+)?$/.test(host);
  const proto = isLocal ? "http" : "https";
  return `${proto}://${host}`;
};

// Trang SEO cho từng video: có <title> + JSON-LD, người dùng sẽ được redirect sang video.html
// === SEO-first watch page: render full player (no JS redirect) ===
app.get("/watch/:id/:slug?", async (req, res) => {
  try {
    const id = String(req.params.id);
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const videos = JSON.parse(raw);
    const v = videos.find((x) => String(x.id) === id);
    if (!v) return res.status(404).send("Not found");

    const origin = siteOrigin(req);
    const s = slugify(v.title || id);
    const canonical = `${origin}/watch/${id}/${s}`;
    const thumb = v.thumbnail || "";
    const uploadDate = (v.createdAt || "").slice(0, 10);

    // Nạp template gốc public/video.html rồi “vá” <head>
    let html = await fs.readFile(
      path.join(__dirname, "public", "video.html"),
      "utf8",
    );
    html = html.replace(/<meta[^>]*name=['"]robots['"][^>]*>\s*/i, ""); // bỏ noindex nếu còn
    html = html.replace(
      /<title>[\s\S]*?<\/title>/i,
      `<title>${escapeHtml(v.title)} — Traingon</title>`,
    );

    const isoUpload = new Date(v.createdAt || Date.now()).toISOString(); // có múi giờ
    const embedUrl = canonical; // xem ngay trên /watch
    const contentUrl = v.downloadLink || ""; // nếu có link tải thì điền, không có thì để ""

    const headInject = `
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="video.other">
<meta property="og:site_name" content="Traingon">
<meta property="og:title" content="${escapeHtml(v.title)} — Traingon">
<meta property="og:description" content="${escapeHtml(v.description || v.title || "Watch now")}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${thumb}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(v.title)} — Traingon">
<meta name="twitter:description" content="${escapeHtml(v.description || v.title || "Watch now")}">
<meta name="twitter:image" content="${thumb}">
<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: v.title,
      description: v.description || v.title || "Watch video",
      thumbnailUrl: v.thumbnail ? [v.thumbnail] : undefined,
      uploadDate: isoUpload, // ISO 8601 có timezone
      embedUrl: embedUrl, // >= 1 trong 2 trường
      ...(contentUrl ? { contentUrl: contentUrl } : {}),
      url: canonical,
    })}</script>`;
    html = html.replace("</head>", headInject + "\n</head>");

    // Chèn H1 ẩn ngay đầu <body> (dùng regex để dù <body> có class/attr vẫn chèn được)
    html = html.replace(
      /<body([^>]*)>/i,
      `<body$1><h1 style="position:absolute;left:-9999px;clip:rect(1px,1px,1px,1px);width:1px;height:1px;overflow:hidden;">${escapeHtml(v.title)}</h1>`,
    );

    res.set("Cache-Control", "public, max-age=3600");
    res.status(200).send(html);
  } catch (e) {
    console.error(e);
    res.redirect("/");
  }
});

// Sitemap tự sinh từ data/videos.json (bao gồm tất cả video cũ & mới)
app.get("/sitemap.xml", async (req, res) => {
  try {
    const origin = siteOrigin(req); // hàm này đã có sẵn ở trên
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const videos = JSON.parse(raw);

    // helper: định dạng YYYY-MM-DD
    const fmt = (d) => {
      try {
        const t = d ? new Date(d) : null;
        return t ? t.toISOString().slice(0, 10) : "";
      } catch {
        return "";
      }
    };

    // lastmod cho trang chủ = ngày mới nhất trong dữ liệu
    const newest = videos.reduce((m, v) => {
      const t = Date.parse(v.updatedAt || v.createdAt || "");
      return isNaN(t) ? m : Math.max(m, t);
    }, 0);
    const homeLastmod = newest ? fmt(new Date(newest)) : "";

    const items = videos
      .filter((v) => v && v.id && v.published !== false)
      .map((v) => {
        const s = slugify(v.title || v.id); // slugify đã khai báo ở trên
        const lastmod = fmt(v.updatedAt || v.createdAt);
        return `<url>
  <loc>${origin}/watch/${v.id}/${s}</loc>
  <changefreq>weekly</changefreq>
  ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}
</url>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${origin}/</loc>
    <changefreq>daily</changefreq>
    ${homeLastmod ? `<lastmod>${homeLastmod}</lastmod>` : ""}
  </url>
  ${items}
</urlset>`;

    res.set("Cache-Control", "public, max-age=3600");
    res.type("application/xml").send(xml);
  } catch (e) {
    console.error(e);
    res.type("text/plain").status(500).send("sitemap error");
  }
});

// Initialize and start server
async function startServer() {
  await initDataFile();
  await fs.mkdir("public/uploads", { recursive: true });
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer().catch(console.error);
