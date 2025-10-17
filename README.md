# Traingon.top

Nền tảng streaming nội dung người lớn dành cho cộng đồng gay với giao diện tối ưu cho SEO, trình phát đa nguồn và hệ thống quản trị giàu tính năng. Repository này chứa toàn bộ mã nguồn front-end (static) và back-end (Node.js/Express) của dự án.

## Công nghệ & kiến trúc

- **Node.js 22+** với `express`, `helmet`, `compression`, `cors`, `multer`, `cookie-parser`
- **SQLite** (sử dụng module `node:sqlite`) lưu trữ meta data video và thông báo
- **Static front-end** phục vụ trực tiếp từ thư mục `public`
- **Tích hợp CDN/Reverse proxy** phía trước (Cloudflare, Nginx) và hỗ trợ proxy headers (`app.set("trust proxy", 1)`)
- **Quản lý tiến trình** khuyến nghị bằng PM2 khi chạy production

## Cấu trúc thư mục chính

```text
traingon-website/
├── data/                 # SQLite DB (videos.db) + dữ liệu JSON (ignored)
├── public/               # Tài sản tĩnh, trang người dùng & admin
│   ├── admin/            # Giao diện quản trị (HTML thuần)
│   ├── css/              # style.css, admin.css
│   ├── js/               # main.js, video.js, admin.js, auth.js, ads.js
│   └── uploads/          # Thư mục upload thumbnail (git ignore)
├── server.js             # Express server + API + SEO routes
├── package.json          # Scripts & dependencies
├── nginx.conf            # Mẫu cấu hình Nginx reverse proxy
└── .env.example          # Mẫu cấu hình môi trường
```

## Tính năng nổi bật

- **Frontend**
  - Cửa sổ xác thực tuổi (age gate) trước khi truy cập
  - Trang chủ responsive, phân trang theo danh mục, tìm kiếm tức thì theo tiêu đề
  - Tích hợp trình phát đa nguồn (Mixdrop, Streamtape) và trình hiển thị hình ảnh/gợi ý video
  - Trang video SEO-first: tạo trang động `/video/:slug` với JSON-LD, sitemap.xml tự sinh
  - Hỗ trợ chat room (CBox) và quảng cáo (thông qua `public/js/ads.js`)
- **Admin panel**
  - Đăng nhập 2 bước: user/pass + token, lưu cookie HttpOnly
  - CRUD video (embed_urls chính/phụ, thumbnail upload bằng Multer, tags, notes, download link, bật/tắt hiển thị, reorder)
  - Quản lý thông báo hiển thị trên trang người dùng
  - Responsive cho mobile/tablet, tìm kiếm/lọc realtime
- **Backend & tiện ích**
  - Tự khởi tạo SQLite schema khi chạy lần đầu (`data/videos.db`)
  - Đồng bộ dữ liệu với file JSON (`data/videos.json`) để hỗ trợ sitemap, backup
  - Gzip + bảo vệ header (Helmet), CORS mở cho public front-end, cookie parser cho admin session

## Yêu cầu hệ thống

- Node.js **v22.0.0 trở lên** (để sử dụng `node:sqlite`). Khi chạy trên Node 22 hiện tại cần bật cờ `--experimental-sqlite`.
- npm 9+ (đi kèm Node 22) hoặc pnpm/yarn nếu muốn, nhưng README sử dụng npm.
- Hệ điều hành Linux 64-bit (Ubuntu 22.04 LTS khuyến nghị) cho môi trường production / VPS.
- Quyền ghi vào các thư mục `data/` và `public/uploads/`.
- (Khuyến nghị) PM2 ≥ 5.4 để quản lý tiến trình và tự khởi động.
- (Khuyến nghị) Nginx ≥ 1.20 và Certbot cho TLS.

## Thiết lập môi trường cục bộ

1. Cài Node 22 (ví dụ qua [nvm](https://github.com/nvm-sh/nvm)):
   ```bash
   nvm install 22
   nvm use 22
   ```
2. Clone repository và cài dependencies:
   ```bash
   git clone https://github.com/<username>/traingon-website.git
   cd traingon-website
   npm install
   ```
3. Tạo file `.env`:
   ```bash
   cp .env.example .env
   # chỉnh sửa các biến trong .env
   ```
4. Chạy ở chế độ phát triển (nodemon + hot reload):
   ```bash
   # đảm bảo bật experimental sqlite
   set NODE_OPTIONS=--experimental-sqlite        # Windows (PowerShell: $env:NODE_OPTIONS="--experimental-sqlite")
   export NODE_OPTIONS=--experimental-sqlite     # Linux/macOS

   npm run dev
   ```
   Truy cập `http://localhost:3000`. Admin panel tại `/admin/` (sử dụng thông tin `.env`).

5. Chạy production local:
   ```bash
   NODE_ENV=production NODE_OPTIONS=--experimental-sqlite npm start
   ```

### Biến môi trường

| Biến              | Bắt buộc | Mặc định | Mô tả |
|-------------------|----------|----------|-------|
| `PORT`            | Không    | `3000`   | Cổng dịch vụ Express. Khi chạy qua Nginx, nên để `3000`. |
| `NODE_ENV`        | Có       | `production` | Dùng để quyết định secure cookie (`production`) hoặc relaxed (`development`). |
| `ADMIN_USER`      | Có       | `admin` (ví dụ) | Tên đăng nhập bước 1. Phải thay đổi trước khi đưa lên production. |
| `ADMIN_PASSWORD`  | Có       | `your_password_here` | Mật khẩu admin. Chuỗi plain-text, cân nhắc đủ mạnh. |
| `ADMIN_TOKEN`     | Có       | `your_secure_token_here` | Token bước 2 (giống OTP cố định). Gợi ý dùng chuỗi dài ngẫu nhiên. |

`DATA_PATH`, `UPLOAD_PATH`, `MAX_FILE_SIZE`, `SESSION_SECRET` có trong `.env.example` để dự phòng mở rộng nhưng chưa được tham chiếu trong `server.js`. Bạn có thể bỏ qua hoặc tận dụng khi mở rộng code.

### Thư mục dữ liệu & backup

- `data/videos.db`: cơ sở dữ liệu SQLite chính. Sao lưu định kỳ (ví dụ bằng `sqlite3 data/videos.db ".backup 'videos-$(date +%F).db'"`).
- `data/announcements.json`: danh sách thông báo admin (tạo tự động).
- `data/videos.json`: bản sao JSON (nếu cấu hình) phục vụ sitemap/SEO.
- `public/uploads/`: chứa thumbnail do admin upload. Sao lưu cùng lúc với DB để đảm bảo đồng bộ.

## Triển khai trên VPS (Ubuntu 22.04+ ví dụ)

### 1. Chuẩn bị máy chủ

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential git curl ufw
sudo ufw allow OpenSSH
sudo ufw enable
```

Tạo user không dùng root (tuỳ chọn):
```bash
sudo adduser traingon
sudo usermod -aG sudo traingon
su - traingon
```

### 2. Cài Node.js 22 và npm

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
npm install -g pm2
```

Thiết lập biến môi trường cho SQLite:
```bash
echo 'export NODE_OPTIONS="--experimental-sqlite"' >> ~/.profile
source ~/.profile
```

### 3. Lấy mã nguồn & cài đặt

```bash
git clone https://github.com/<username>/traingon-website.git
cd traingon-website
npm install --production
cp .env.example .env
nano .env      # cập nhật PORT, ADMIN_USER/PASSWORD/TOKEN, NODE_ENV=production
mkdir -p data public/uploads
```

### 4. Khởi chạy bằng PM2

Tạo file `ecosystem.config.js` (không commit) giống ví dụ:

```js
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "traingon",
      script: "server.js",
      cwd: "/var/www/traingon-website", // chỉnh đường dẫn thực tế
      env: {
        NODE_ENV: "production",
        NODE_OPTIONS: "--experimental-sqlite"
      },
      watch: false,
      autorestart: true,
      max_memory_restart: "512M",
      out_file: "/var/log/traingon/out.log",
      error_file: "/var/log/traingon/error.log"
    }
  ]
}
```

Sau đó chạy:
```bash
mkdir -p /var/log/traingon
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd    # làm theo hướng dẫn để bật tự động khi reboot
```

Các lệnh hữu ích:
```bash
pm2 status
pm2 logs traingon
pm2 restart traingon
pm2 stop traingon
```

### 5. Cấu hình reverse proxy với Nginx

Tạo file `/etc/nginx/sites-available/traingon.conf` (sử dụng mẫu `nginx.conf` trong repo làm tham chiếu):

```nginx
upstream traingon_app {
    server 127.0.0.1:3000;
}

limit_req_zone $binary_remote_addr zone=general:10m rate=30r/m;
limit_req_zone $binary_remote_addr zone=api:10m rate=60r/m;
limit_req_zone $binary_remote_addr zone=admin:10m rate=10r/m;

server {
    listen 80;
    server_name traingon.top www.traingon.top;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name traingon.top www.traingon.top;

    ssl_certificate /etc/letsencrypt/live/traingon.top/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/traingon.top/privkey.pem;

    include snippets/ssl-params.conf;  # tuỳ chỉnh (hoặc copy trực tiếp từ nginx.conf)

    location /admin/ {
        limit_req zone=admin burst=10 nodelay;
        proxy_pass http://traingon_app;
        include proxy_params;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://traingon_app;
        include proxy_params;
    }

    location / {
        limit_req zone=general burst=30 nodelay;
        proxy_pass http://traingon_app;
        include proxy_params;
    }
}
```

Kích hoạt site:
```bash
sudo ln -s /etc/nginx/sites-available/traingon.conf /etc/nginx/sites-enabled/traingon.conf
sudo nginx -t
sudo systemctl reload nginx
```

Thiết lập HTTPS với Certbot:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d traingon.top -d www.traingon.top
```

### 6. Cập nhật & bảo trì

- Deploy bản mới:
  ```bash
  cd /var/www/traingon-website
  git pull
  npm install --production
  pm2 restart traingon
  ```
- Kiểm tra log:
  ```bash
  pm2 logs traingon
  journalctl -u nginx
  ```
- Sao lưu định kỳ:
  ```bash
  sqlite3 data/videos.db ".backup '/backups/videos-$(date +%F).db'"
  tar czf /backups/uploads-$(date +%F).tar.gz public/uploads
  ```

## Bảo mật & vận hành tốt

- Thay đổi toàn bộ thông tin `ADMIN_*` trước khi mở site, và cập nhật định kỳ.
- Giới hạn truy cập `/admin` bằng firewall (UFW, Cloudflare) hoặc Basic Auth phụ nếu cần.
- Không commit file `.env`, `data/*.db`, `public/uploads/*`, `ecosystem.config.js`.
- Bật HTTPS, cân nhắc thêm Web Application Firewall (Cloudflare hoạt động tốt với `app.set("trust proxy", 1)` đã cấu hình).
- Theo dõi dung lượng đĩa (`data/videos.db` và `public/uploads` có thể lớn dần).

## Xử lý sự cố thường gặp

- **Lỗi `ERR_MODULE_NOT_FOUND: Cannot find module 'node:sqlite'`**  
  Đảm bảo Node ≥ 22 và biến `NODE_OPTIONS=--experimental-sqlite` được set trước khi chạy.
- **Không upload được thumbnail**  
  Kiểm tra quyền ghi thư mục `public/uploads/` và giới hạn dung lượng nginx/Express.
- **Admin không giữ đăng nhập**  
  Kiểm tra cookie `tg_admin`; với HTTPS phải bật `secure` (Node chạy `NODE_ENV=production`) và reverse proxy truyền chính xác header `X-Forwarded-Proto`.

## Giấy phép

Mặc định repository sử dụng giấy phép ISC (tham khảo `package.json`). Vui lòng tuân thủ các điều khoản khi tái phân phối mã nguồn.
