document.addEventListener('DOMContentLoaded', () => {
    // Check if Firebase is initialized
    if (typeof db === 'undefined') {
        alert("Firebase bağlantısı yok! Lütfen firebase-config.js dosyasını kontrol edin.");
        return;
    }

    // --- State ---
    let currentUser = null;
    let users = [];
    let roomItems = [];
    let itemsState = [];

    // --- References ---
    const usersRef = db.collection('users');
    const itemsRef = db.collection('items');
    const historyRef = db.collection('history');

    // --- DOM Elements ---
    const checklistContainer = document.getElementById('checklistContainer');
    const progressBar = document.getElementById('progressBar');
    const progressCircle = document.getElementById('progressCircle');
    const completedCount = document.getElementById('completedCount');
    const markAllBtn = document.getElementById('markAllDoneBtn');
    const searchInput = document.getElementById('searchInput');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const historyList = document.getElementById('historyList');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const form = document.getElementById('controlForm');

    // Auth DOM
    const loginOverlay = document.getElementById('loginOverlay');
    const loginForm = document.getElementById('loginForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const welcomeUser = document.getElementById('welcomeUser');
    const adminPanelBtn = document.getElementById('adminPanelBtn');

    // Defaults
    const defaultRoomItems = [
        "Yatak Düzeni", "Çarşaf Değişimi", "Yastık Kılıfları",
        "Banyo Temizliği", "Havlu Değişimi", "Tuvalet Temizliği",
        "Zemin Temizliği", "Toz Alma", "Minibar Kontrolü",
        "Su Isıtıcı / Bardak", "Klima Kontrolü", "Televizyon",
        "Aydınlatma", "Oda Kokusu", "Çöp Kovası"
    ];

    // Initial Auth Check
    currentUser = Auth.getCurrentUser();
    if (currentUser) {
        checkAuth();
    } else {
        loginOverlay.classList.remove('hidden');
    }

    // Listeners (Realtime updates)
    setupRealtimeListeners();

    // --- Core Functions ---

    function setupRealtimeListeners() {
        // Users Listener
        usersRef.onSnapshot(snapshot => {
            users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Update current user info if changed
            if (currentUser) {
                const refreshed = users.find(u => u.email === currentUser.email);
                if (refreshed) {
                    currentUser = refreshed;
                    Auth.setCurrentUser(currentUser);
                    updateUserGreeting();
                } else {
                    // Deleted?
                    logout();
                }
            }
        });

        // Items Listener
        itemsRef.onSnapshot(snapshot => {
            const data = snapshot.docs
                .map(doc => doc.data().name)
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b, 'tr')); // Alfabetik sıralama (Türkçe karakter duyarlı)

            itemsState = data.map(name => {
                const existing = itemsState.find(i => i.name === name);
                return { name, status: existing ? existing.status : null };
            });

            roomItems = data;

            // Always try to render if we have a user
            if (currentUser) {
                renderChecklist();
                updateStats();
            }
        });

        // History Listener
        historyRef.orderBy('timestamp', 'desc').limit(20).onSnapshot(snapshot => {
            const history = snapshot.docs.map(doc => doc.data());
            renderHistory(history);
        });
    }

    function checkAuth() {
        if (!currentUser) {
            loginOverlay.classList.remove('hidden');
        } else {
            loginOverlay.classList.add('hidden');
            updateUserGreeting();
            applyRolePermissions();
            // Force render when auth is checked
            if (itemsState.length > 0) {
                renderChecklist();
            }
            updateStats();
        }
    }

    function updateUserGreeting() {
        const roleLabels = {
            founder: 'Kurucu',
            admin: 'Yönetici',
            staff: 'Personel'
        };
        const roleText = roleLabels[currentUser.role] || 'Kullanıcı';
        welcomeUser.innerHTML = `Merhaba, <b>${currentUser.fullName || currentUser.username}</b> (${roleText})`;
    }

    function applyRolePermissions() {
        // Show admin panel button for admin and founder
        if (currentUser.role === 'admin' || currentUser.role === 'founder') {
            adminPanelBtn.classList.remove('hidden');
            clearHistoryBtn.classList.remove('hidden');
        }
    }

    function logout() {
        Auth.logout();
    }

    // --- UI Rendering ---

    function renderChecklist(filter = 'all', searchQuery = '') {
        // Don't render if itemsState is empty (still loading from Firebase)
        if (itemsState.length === 0) {
            return;
        }

        const activeFilterBtn = document.querySelector('.filter-btn.active');
        filter = activeFilterBtn ? activeFilterBtn.dataset.filter : 'all';
        searchQuery = searchInput.value;

        checklistContainer.innerHTML = '';

        itemsState.forEach((item, index) => {
            if (filter === 'incomplete' && item.status === 'done') return;
            if (filter === 'done' && item.status !== 'done') return;
            if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return;

            const div = document.createElement('div');
            div.className = 'checklist-item';
            div.dataset.status = item.status || 'none';
            div.innerHTML = `
                <span class="item-name">${item.name}</span>
                <div class="btn-group">
                    <button type="button" class="status-btn done ${item.status === 'done' ? 'active' : ''}" 
                        onclick="setItemStatus('${item.name}', 'done')">
                        <i class="fa-solid fa-check"></i>
                    </button>
                    <button type="button" class="status-btn not-done ${item.status === 'not-done' ? 'active' : ''}" 
                        onclick="setItemStatus('${item.name}', 'not-done')">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
            checklistContainer.appendChild(div);
        });
        updateStats();
    }

    window.setItemStatus = function (name, status) {
        const item = itemsState.find(i => i.name === name);
        if (item) {
            item.status = (item.status === status) ? null : status;
            renderChecklist();
        }
    };

    function updateStats() {
        const doneCount = itemsState.filter(i => i.status === 'done').length;
        const total = itemsState.length;
        const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);

        completedCount.textContent = `${doneCount}/${total}`;
        progressBar.style.width = `${percent}%`;
        progressCircle.style.setProperty('--percent', percent);
        progressCircle.querySelector('.percent-text').textContent = `${percent}%`;
    }

    function renderHistory(history) {
        historyList.innerHTML = '';
        if (history.length === 0) {
            historyList.innerHTML = '<div class="empty-state">Henüz kayıt yok</div>';
            return;
        }

        history.forEach(rec => {
            const div = document.createElement('div');
            div.className = 'history-card';
            const isFull = rec.progress === rec.totalItems;
            div.innerHTML = `
                <div class="h-card-header">
                    <span>Oda ${rec.roomNo} <span style="font-size:0.8em; color:var(--text-muted)">(${rec.user})</span></span>
                    <span class="h-card-status ${isFull ? 'complete' : ''}">
                        ${isFull ? 'Tamamlandı' : `${rec.progress}/${rec.totalItems}`}
                    </span>
                </div>
                <div class="h-card-time">
                    ${rec.date} - ${rec.time}
                </div>
            `;
            historyList.appendChild(div);
        });
    }

    // --- Actions ---

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const inputEmail = document.getElementById('email').value.trim();
        const inputPassword = document.getElementById('password').value;

        if (users.length === 0) {
            Toast.error('Veritabanı henüz yüklenmedi, lütfen saniyeler sonra tekrar deneyin.');
            return;
        }

        // Extremely flexible matching to avoid casing issues or manual entry errors
        const user = users.find(u => {
            const dbEmail = (u.email || u.Email || u.EMAIL || "").toString().trim().toLowerCase();
            const dbPassword = (u.password || u.Password || u.PASSWORD || "").toString();
            return dbEmail === inputEmail.toLowerCase() && dbPassword === inputPassword;
        });

        if (user) {
            Loading.show('Giriş Yapılıyor...');

            setTimeout(() => {
                currentUser = user;
                Auth.setCurrentUser(user);
                loginForm.reset();
                checkAuth();
                Loading.hide();
                Toast.success('Giriş başarılı! Hoş geldiniz.');
                Logger.log('Giriş Yaptı');
            }, 1000);
        } else {
            Toast.error('Hatalı E-Posta veya Şifre!');
            console.log("💡 İpucu: Veritabanındaki şifre ve mail ile girdiğinizin tam eşleştiğinden emin olun.");
            Logger.log('Giriş Denemesi', { attemptedEmail: inputEmail, success: false });
        }
    });

    logoutBtn.addEventListener('click', async () => {
        if (await Confirm.ask('Çıkış yapmak istediğinize emin misiniz?')) {
            Logger.log('Çıkış Yaptı');
            Auth.logout();
        }
    });

    // Admin Panel Button
    if (adminPanelBtn) {
        adminPanelBtn.addEventListener('click', () => {
            window.location.href = 'admin.html';
        });
    }

    // Save Record
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const roomNo = document.getElementById('roomNo').value;
        const date = document.getElementById('date').value;
        const time = document.getElementById('time').value;
        const notes = document.getElementById('notes').value;

        const doneItems = itemsState.filter(item => item.status === 'done').length;
        const totalItems = itemsState.length;
        const progress = totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 100);

        try {
            Loading.show('Kayıt kaydediliyor...');

            const record = {
                roomNo,
                date,
                time,
                notes,
                userName: currentUser.fullName || currentUser.username,
                progress: doneItems, // Store actual count for history display
                totalItems,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };

            await historyRef.add(record);

            // Log action
            await Logger.log('Oda Kaydı Oluşturdu', { roomNo, progress: `${progress}%` });

            Toast.success('Kayıt başarıyla eklendi!');
            if (window.confetti) confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#667eea', '#764ba2', '#ffffff']
            });

            form.reset();
            // Reset items
            itemsState.forEach(item => item.status = null);
            renderChecklist();
        } catch (error) {
            console.error('Error saving record:', error);
            Toast.error('Kayıt kaydedilirken hata oluştu!');
        } finally {
            Loading.hide();
        }
    });

    clearHistoryBtn.addEventListener('click', async () => {
        if (await Confirm.ask("Tüm geçmiş silinsin mi? (Geri alınamaz)")) {
            try {
                Loading.show('Geçmiş temizleniyor...');
                const snapshot = await historyRef.get();
                const batch = db.batch();
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                Loading.hide();
                Toast.success("Geçmiş temizlendi.");
            } catch (err) {
                Loading.hide();
                Toast.error("Hata: " + err.message);
            }
        }
    });

    clearLogsBtn.addEventListener('click', async () => {
        if (await Confirm.ask('Tüm geçmiş kayıtları silmek istediğinize emin misiniz?')) {
            try {
                Loading.show('Geçmiş temizleniyor...');
                const snapshot = await db.collection('history').get();
                const batch = db.batch();
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                Toast.success('Geçmiş temizlendi.');
                Logger.log('Geçmişi Temizledi');
                Loading.hide();
            } catch (error) {
                console.error('Geçmiş temizleme hatası:', error);
                Toast.error('Geçmiş temizlenemedi!');
                Loading.hide();
            }
        }
    });

    // --- Search & Filter ---
    searchInput.addEventListener('input', () => renderChecklist());
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderChecklist();
        });
    });

    // Mark All
    markAllBtn.addEventListener('click', () => {
        itemsState.forEach(i => i.status = 'done');
        renderChecklist();
        Toast.success('Tüm öğeler tamamlandı olarak işaretlendi!');
    });

    // --- Utility: Success/Confetti ---
    function showSuccess(roomNo) {
        document.getElementById('modalRoomBadge').textContent = `Oda ${roomNo}`;
        document.getElementById('successModal').classList.remove('hidden');
        if (window.confetti) confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    }

    document.getElementById('closeModalBtn').addEventListener('click', () => {
        document.getElementById('successModal').classList.add('hidden');
        form.reset();
        // Reset local checks
        itemsState = itemsState.map(i => ({ name: i.name, status: null }));
        renderChecklist();

        const now = new Date();
        document.getElementById('date').valueAsDate = now;
        document.getElementById('time').value = now.toTimeString().slice(0, 5);
    });

    // --- Forgot Password ---
    const forgotLink = document.getElementById('forgotPasswordLink');
    if (forgotLink) {
        forgotLink.addEventListener('click', () => {
            document.getElementById('loginOverlay').classList.add('hidden');
            document.getElementById('forgotPasswordModal').classList.remove('hidden');
        });
    }

    const resetForm = document.getElementById('resetPasswordForm');
    const forgotForm = document.getElementById('forgotPasswordForm');

    let recoveryUserId = null;
    let generatedCode = null;

    if (forgotForm) {
        forgotForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('recoveryEmail').value;
            const targetUser = users.find(u => u.email === email);

            if (!targetUser) {
                Toast.error('Kullanıcı bulunamadı.');
                return;
            }
            recoveryUserId = targetUser.id;
            generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
            Toast.info(`[SİMÜLASYON] Kodunuz: ${generatedCode}`, 5000);
            document.getElementById('forgotPasswordModal').classList.add('hidden');
            document.getElementById('resetPasswordModal').classList.remove('hidden');
        });
    }

    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (document.getElementById('resetCode').value !== generatedCode) {
                Toast.error('Hatalı Kod');
                return;
            }
            const newPass = document.getElementById('newResetPass').value;
            if (newPass !== document.getElementById('newResetPassConfirm').value) {
                Toast.error('Şifre eşleşmiyor');
                return;
            }

            try {
                Loading.show('Şifre güncelleniyor...');
                await usersRef.doc(recoveryUserId).update({ password: newPass });
                Loading.hide();
                Toast.success('Şifre güncellendi.');
                document.getElementById('resetPasswordModal').classList.add('hidden');
                loginOverlay.classList.remove('hidden');
            } catch (err) {
                Loading.hide();
                Toast.error('Hata: ' + err.message);
            }
        });
    }

    // Back buttons
    document.querySelectorAll('#backToLogin').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('forgotPasswordModal').classList.add('hidden');
            loginOverlay.classList.remove('hidden');
        });
    });

});
