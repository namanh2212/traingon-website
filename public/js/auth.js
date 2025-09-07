// auth.js (cookie mode, 2 bước: login -> token)

function showError(msg) {
  const el = document.getElementById("errorMessage");
  if (el) {
    el.textContent = msg;
    el.style.display = "block";
  } else alert(msg);
}

// Kiểm tra trạng thái đăng nhập cho các trang admin
async function requireAuth() {
  try {
    const r = await fetch("/api/auth/me", { credentials: "include" });
    const j = await r.json();
    if (j.ok) return true;
  } catch (e) {
    console.error(e);
  }
  if (!location.pathname.endsWith("/login.html")) {
    location.href = "/admin/login.html";
  }
  return false;
}

async function logout() {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } catch (e) {}
  location.href = "/admin/login.html";
}

// Chỉ khởi tạo 1 lần
let __authInitDone = false;
function initLogin() {
  if (__authInitDone) return;
  __authInitDone = true;

  const loginForm = document.getElementById("loginForm"); // bước 1
  const tokenForm = document.getElementById("tokenForm"); // bước 2
  const step1 = document.getElementById("loginForm");
  const step2 = document.getElementById("tokenForm");

  if (!loginForm || !tokenForm) {
    console.warn("Login page: missing #loginForm or #tokenForm");
    return;
  }

  let tmpUser = "",
    tmpPass = "";

  // Bước 1: user/pass -> gọi /api/auth/check, đúng mới cho qua bước token
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    tmpUser = document.getElementById("username")?.value?.trim() || "";
    tmpPass = document.getElementById("password")?.value || "";
    if (!tmpUser || !tmpPass) return showError("Nhập tài khoản và mật khẩu");

    const ok = await fetch("/api/auth/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: tmpUser, password: tmpPass }),
    })
      .then((r) => r.ok)
      .catch(() => false);

    if (!ok) return showError("Tài khoản hoặc mật khẩu sai");

    step1 && (step1.style.display = "none");
    step2 && (step2.style.display = "");
  });

  // Bước 2: token -> gọi /api/auth/login để set cookie HttpOnly
  tokenForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = document.getElementById("token")?.value || "";
    if (!token) return showError("Nhập token");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: tmpUser, password: tmpPass, token }),
      });
      if (res.ok) {
        location.href = "/admin/index.html";
      } else {
        showError("Sai token hoặc thông tin không khớp. Thử lại.");
        step2 && (step2.style.display = "none");
        step1 && (step1.style.display = "");
      }
    } catch (err) {
      console.error(err);
      showError("Lỗi kết nối, thử lại.");
    }
  });
}

// Export ra global cho login.html gọi
window.requireAuth = requireAuth;
window.logout = logout;
window.initLogin = initLogin;
