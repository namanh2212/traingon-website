console.log('Auth.js loaded');

// Simple check function
function checkAuth() {
    const token = sessionStorage.getItem('adminToken');
    return token === 'Adat1997$';
}

function logout() {
    sessionStorage.removeItem('adminToken');
    window.location.href = '/admin/login.html';
}

// Login page logic
function initLogin() {
    console.log('Initializing login page');
    
    const loginForm = document.getElementById('loginForm');
    const tokenForm = document.getElementById('tokenForm');
    const errorMessage = document.getElementById('errorMessage');

    if (!loginForm || !tokenForm) {
        console.log('Login forms not found');
        return;
    }

    // Check if already authenticated
    if (checkAuth()) {
        console.log('Already authenticated, redirecting to dashboard');
        window.location.href = '/admin/dashboard.html';
        return;
    }

    console.log('Not authenticated, showing login form');

    // Handle login form
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        console.log('Login attempt for:', username);
        
        if (username === 'admin' && password === 'Adat1997') {
            loginForm.style.display = 'none';
            tokenForm.style.display = 'block';
            if (errorMessage) errorMessage.style.display = 'none';
            console.log('Credentials correct, showing token form');
        } else {
            showError('Tài khoản hoặc mật khẩu không đúng');
        }
    });

    // Handle token form
    tokenForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const token = document.getElementById('token').value;
        
        console.log('Token verification attempt');
        
        if (token === 'Adat1997$') {
            sessionStorage.setItem('adminToken', token);
            console.log('Token correct, redirecting to dashboard');
            window.location.href = '/admin/dashboard.html';
        } else {
            showError('Token không đúng');
        }
    });

    function showError(message) {
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
        }
        console.log('Error:', message);
    }
}

// Admin page protection
function requireAuth() {
    console.log('Checking authentication for admin page');
    console.log('Current path:', window.location.pathname);
    
    if (!checkAuth()) {
        console.log('Not authenticated, redirecting to login');
        window.location.href = '/admin/login.html';
        return false;
    }
    
    console.log('Authentication OK');
    return true;
}

// Export functions globally
window.checkAuth = checkAuth;
window.logout = logout;
window.initLogin = initLogin;
window.requireAuth = requireAuth;

console.log('Auth functions exported globally');
