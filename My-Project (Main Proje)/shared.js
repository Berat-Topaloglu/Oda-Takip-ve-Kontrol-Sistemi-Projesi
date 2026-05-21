/* ============================================
   SHARED UTILITIES & HELPERS
   ============================================ */

// Firebase Database Reference (set by firebase-config.js)
// window.db is available globally

// ============================================
// AUTH UTILITIES
// ============================================

const Auth = {
    getCurrentUser() {
        const userData = sessionStorage.getItem('currentUser');
        return userData ? JSON.parse(userData) : null;
    },

    setCurrentUser(user) {
        sessionStorage.setItem('currentUser', JSON.stringify(user));
    },

    logout() {
        Loading.show('Sistemden Çıkış Yapılıyor...');
        sessionStorage.removeItem('currentUser');
        localStorage.removeItem('lastPage');

        // Görsel tatmin için yapay gecikme
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 800);
    },

    requireAuth() {
        const user = this.getCurrentUser();
        if (!user) {
            window.location.href = 'index.html';
            return null;
        }
        return user;
    },

    requireRole(allowedRoles) {
        const user = this.requireAuth();
        if (!user) return null;

        if (!allowedRoles.includes(user.role)) {
            alert('Bu sayfaya erişim yetkiniz yok!');
            window.location.href = 'index.html';
            return null;
        }
        return user;
    }
};

// ============================================
// TOAST NOTIFICATIONS
// ============================================

const Toast = {
    container: null,

    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;
            document.body.appendChild(this.container);
        }
    },

    show(message, type = 'info', duration = 3000) {
        this.init();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        const colors = {
            success: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            error: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            warning: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
            info: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
        };

        toast.style.cssText = `
            background: ${colors[type] || colors.info};
            color: white;
            padding: 15px 20px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 300px;
            animation: slideIn 0.3s ease;
            font-family: 'Outfit', sans-serif;
            font-weight: 500;
        `;

        toast.innerHTML = `
            <span style="font-size: 20px;">${icons[type] || icons.info}</span>
            <span>${message}</span>
        `;

        this.container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    success(message, duration) {
        this.show(message, 'success', duration);
    },

    error(message, duration) {
        this.show(message, 'error', duration);
    },

    warning(message, duration) {
        this.show(message, 'warning', duration);
    },

    info(message, duration) {
        this.show(message, 'info', duration);
    }
};

// Add toast animations to document
if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// ============================================
// LOADING OVERLAY
// ============================================

const Loading = {
    overlay: null,

    show(message = 'Yükleniyor...') {
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.id = 'loading-overlay-container';
            this.overlay.className = 'loading-overlay';
            this.overlay.innerHTML = `
                <div class="loading-content">
                    <div class="modern-loader">
                        <div class="loader-ring"></div>
                        <div class="loader-ring"></div>
                        <div class="loader-ring"></div>
                    </div>
                    <p class="loading-text">${message}</p>
                </div>
            `;
            document.body.appendChild(this.overlay);
        }

        const textEl = this.overlay.querySelector('.loading-text');
        if (textEl) textEl.textContent = message;

        this.overlay.style.display = 'flex';
        // Force reflow
        this.overlay.offsetHeight;
        this.overlay.classList.add('fade-in');
    },

    hide() {
        if (this.overlay) {
            this.overlay.classList.remove('fade-in');
            setTimeout(() => {
                this.overlay.style.display = 'none';
            }, 300);
        }
    }
};

// ============================================
// CUSTOM CONFIRM MODAL
// ============================================

const Confirm = {
    overlay: null,
    resolve: null,

    init() {
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.id = 'confirm-overlay';
            this.overlay.innerHTML = `
                <div class="confirm-box">
                    <h3 id="confirm-title">Onay Gerekli</h3>
                    <p id="confirm-message">Bu işlemi yapmak istediğinize emin misiniz?</p>
                    <div class="confirm-buttons">
                        <button class="confirm-btn confirm-btn-no">Vazgeç</button>
                        <button class="confirm-btn confirm-btn-yes">Tamam</button>
                    </div>
                </div>
            `;
            document.body.appendChild(this.overlay);

            this.overlay.querySelector('.confirm-btn-yes').addEventListener('click', () => this.handle(true));
            this.overlay.querySelector('.confirm-btn-no').addEventListener('click', () => this.handle(false));

            // ESC key support
            window.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.overlay.style.display === 'flex') {
                    this.handle(false);
                }
            });
        }
    },

    async ask(message, title = 'Onay Gerekli') {
        this.init();
        document.getElementById('confirm-message').textContent = message;
        document.getElementById('confirm-title').textContent = title;
        this.overlay.style.display = 'flex';

        return new Promise((res) => {
            this.resolve = res;
        });
    },

    handle(value) {
        this.overlay.style.display = 'none';
        if (this.resolve) this.resolve(value);
    }
};

// ============================================
// FORM VALIDATION
// ============================================

const Validator = {
    email(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    phone(phone) {
        const cleaned = phone.replace(/\D/g, '');
        return cleaned.length >= 10;
    },

    password(password) {
        return password.length >= 6;
    },

    required(value) {
        return value && value.trim().length > 0;
    }
};

// ============================================
// DATE & TIME UTILITIES
// ============================================

const DateTime = {
    formatDate(date) {
        if (!(date instanceof Date)) date = new Date(date);
        return date.toLocaleDateString('tr-TR');
    },

    formatTime(date) {
        if (!(date instanceof Date)) date = new Date(date);
        return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    },

    formatDateTime(date) {
        return `${this.formatDate(date)} ${this.formatTime(date)}`;
    },

    getCurrentDate() {
        return new Date().toISOString().split('T')[0];
    },

    getCurrentTime() {
        return new Date().toTimeString().slice(0, 5);
    }
};

// ============================================
// ACTIVITY LOGGER
// ============================================

const Logger = {
    async log(action, details = {}) {
        const currentUser = Auth.getCurrentUser();
        // Allow 'Giriş Denemesi' without current user
        if (!currentUser && action !== 'Giriş Denemesi') return;

        const logData = {
            userId: currentUser ? (currentUser.id || 'N/A') : 'Unauthenticated',
            userName: currentUser ? (currentUser.fullName || currentUser.username) : (details.attemptedEmail || 'Unknown'),
            userRole: currentUser ? currentUser.role : 'N/A',
            action: action,
            details: details,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            // For easy display
            date: new Date().toLocaleDateString('tr-TR'),
            time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        };

        try {
            await window.db.collection('activityLogs').add(logData);
            console.log(`[ActivityLog]: ${action} kaydedildi.`);
        } catch (error) {
            console.error('Log kaydetme hatası:', error);
        }
    }
};

// ============================================
// PAGE TRANSITIONS LOGIC
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const transitionContainer = document.querySelector('.page-transition-wrapper');
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const lastPage = localStorage.getItem('lastPage');

    if (transitionContainer) {
        // En uygun giriş animasyonunu belirle
        if (lastPage === 'admin.html' && currentPage === 'index.html') {
            transitionContainer.classList.add('page-transition', 'from-left');
        } else {
            transitionContainer.classList.add('page-transition', 'from-right');
        }
    }

    // Navigasyon tıklamalarını yakala
    document.querySelectorAll('a, button[onclick*="location.href"]').forEach(el => {
        el.addEventListener('click', (e) => {
            let href = el.getAttribute('href');

            // onclick="window.location.href='...'" durumunu işle
            if (!href && el.getAttribute('onclick')) {
                const match = el.getAttribute('onclick').match(/href=['"](.*?)['"]/);
                if (match) href = match[1];
            }

            if (href && (href === 'index.html' || href === 'admin.html')) {
                // Aynı sayfaya gitmeye çalışıyorsa animasyon yapma
                if (currentPage === href) return;

                e.preventDefault();
                localStorage.setItem('lastPage', currentPage);

                if (transitionContainer) {
                    transitionContainer.classList.remove('page-transition', 'from-left', 'from-right');

                    // Geçiş yönünü belirle
                    if (currentPage === 'index.html' && href === 'admin.html') {
                        transitionContainer.classList.add('page-exit', 'to-left');
                    } else {
                        transitionContainer.classList.add('page-exit', 'to-right');
                    }

                    setTimeout(() => {
                        window.location.href = href;
                    }, 450); // CSS 0.5s süresiyle tam uyumlu (küçük bir emniyet payı ile)
                } else {
                    window.location.href = href;
                }
            }
        });
    });
});

// ============================================
// EXPORT FOR USE
// ============================================

window.Auth = Auth;
window.Toast = Toast;
window.Loading = Loading;
window.Validator = Validator;
window.DateTime = DateTime;
window.Logger = Logger;
