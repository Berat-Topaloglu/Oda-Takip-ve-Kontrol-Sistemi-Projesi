document.addEventListener('DOMContentLoaded', () => {
    // Check if Firebase is initialized
    if (typeof db === 'undefined') {
        alert("Firebase bağlantısı yok! Lütfen firebase-config.js dosyasını kontrol edin.");
        return;
    }

    // --- State ---
    let currentUser = null; // Session logic (simple for now, or use Auth persistence)
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
    const adminPanel = document.getElementById('adminPanel');
    const founderPanel = document.getElementById('founderPanel');
    const userListBody = document.getElementById('userListBody');

    // Forms
    const addUserForm = document.getElementById('addUserForm');
    const addItemForm = document.getElementById('addItemForm');

    // Defaults
    const defaultRoomItems = [
        "Yatak Düzeni", "Çarşaf Değişimi", "Yastık Kılıfları",
        "Banyo Temizliği", "Havlu Değişimi", "Tuvalet Temizliği",
        "Zemin Temizliği", "Toz Alma", "Minibar Kontrolü",
        "Su Isıtıcı / Bardak", "Klima Kontrolü", "Televizyon",
        "Aydınlatma", "Oda Kokusu", "Çöp Kovası"
    ];

    // --- Initialization & Seeding ---

    // Set Time
    const now = new Date();
    document.getElementById('date').valueAsDate = now;
    document.getElementById('time').value = now.toTimeString().slice(0, 5);

    // Initial Auth Check
    const sessionUser = sessionStorage.getItem('currentUser');
    if (sessionUser) {
        currentUser = JSON.parse(sessionUser);
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

            // Check Seeding
            if (users.length === 0) {
                seedFounder();
            }

            // Update current user info if changed
            if (currentUser) {
                const refreshed = users.find(u => u.email === currentUser.email);
                if (refreshed) {
                    currentUser = refreshed;
                    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
                    updateUserGreeting();
                } else {
                    // Deleted?
                    logout();
                }
            }

            if (currentUser && currentUser.role === 'founder') {
                renderUserList();
            }
        });

        // Items Listener
        itemsRef.onSnapshot(snapshot => {
            const data = snapshot.docs.map(doc => doc.data().name);
            if (data.length === 0) {
                // Seed Default Items
                defaultRoomItems.forEach(name => itemsRef.add({ name, createdAt: firebase.firestore.FieldValue.serverTimestamp() }));
            }

            // Merge with existing state logic or reset
            // If items changed significantly, we might want to reset state or preserve it.
            // For simplicity, we just check if new items appeared.

            // Update itemsState structure if new items added
            // (Preserve status of existing checks is complex without ID tracking per check instance, 
            // but for this app it resets on reload anyway mostly)

            if (itemsState.length === 0) {
                // First load
                itemsState = data.map(name => ({ name, status: null }));
            } else {
                // update list but try to keep status if name matches
                const newState = data.map(name => {
                    const existing = itemsState.find(i => i.name === name);
                    return { name, status: existing ? existing.status : null };
                });
                itemsState = newState;
            }
            roomItems = data;

            if (currentUser) renderChecklist();
        });

        // History Listener
        historyRef.orderBy('timestamp', 'desc').limit(20).onSnapshot(snapshot => {
            const history = snapshot.docs.map(doc => doc.data());
            renderHistory(history);
        });
    }

    async function seedFounder() {
        // Seed the requested Founder
        await usersRef.add({
            role: 'founder',
            email: 'berattopaloglu61@gmail.com',
            password: 'Berat_6161',
            fullName: 'Berat Topaloğlu',
            username: 'kurucu', // Keep for backward compat display
            phone: '5551112233',
            dob: '1990-01-01',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log("Kurucu seed edildi.");
    }

    function checkAuth() {
        if (!currentUser) {
            loginOverlay.classList.remove('hidden');
        } else {
            loginOverlay.classList.add('hidden');
            updateUserGreeting();
            applyRolePermissions();
            renderChecklist();
            updateStats();
        }
    }

    function updateUserGreeting() {
        let roleText = 'Personel';
        if (currentUser.role === 'admin') roleText = 'Yönetici';
        if (currentUser.role === 'founder') roleText = 'Kurucu';
        welcomeUser.innerHTML = `Merhaba, <b>${currentUser.fullName || currentUser.username}</b> (${roleText})`;
    }

    function applyRolePermissions() {
        // Reset
        adminPanel.classList.add('hidden');
        founderPanel.classList.add('hidden');
        clearHistoryBtn.classList.add('hidden');

        if (currentUser.role === 'founder') {
            founderPanel.classList.remove('hidden');

            // Move Add Item to Founder Panel if needed
            const addItemCard = document.getElementById('addItemForm').parentElement;
            const founderGrid = founderPanel.querySelector('.admin-grid');
            if (founderGrid && addItemCard.parentElement !== founderGrid) {
                founderGrid.appendChild(addItemCard);
            }

            clearHistoryBtn.classList.remove('hidden');
            renderUserList();

        } else if (currentUser.role === 'admin') {
            adminPanel.classList.remove('hidden');

            // Move Add Item back to Admin Panel
            const addItemCard = document.getElementById('addItemForm').parentElement;
            const adminGrid = adminPanel.querySelector('.admin-grid');
            if (adminGrid && addItemCard.parentElement !== adminGrid) {
                adminGrid.appendChild(addItemCard);
            }

            clearHistoryBtn.classList.remove('hidden');
        }
    }

    function logout() {
        sessionStorage.removeItem('currentUser');
        currentUser = null;
        location.reload();
    }

    // --- UI Rendering ---

    function renderChecklist(filter = 'all', searchQuery = '') { // Using global filters stored in DOM or vars
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

    function renderUserList() {
        if (!userListBody) return;
        userListBody.innerHTML = '';
        users.forEach((u) => {
            const divName = u.fullName || u.username;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="font-weight:600">${u.username}</div>
                    <div style="font-size:0.8em; color:var(--text-muted)">${u.email}</div>
                </td>
                <td>
                    <span class="role-badge ${u.role}">${u.role}</span>
                </td>
                <td>
                    ${u.role !== 'founder' ? `
                    <button class="action-icon-btn delete" onclick="deleteUser('${u.id}')" title="Sil">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                    ` : '<small class="text-muted">Dokunulmaz</small>'}
                </td>
            `;
            userListBody.appendChild(tr);
        });
    }

    // --- Actions ---

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        // Login using email
        const user = users.find(u => u.email === email && u.password === password);

        if (user) {
            currentUser = user;
            sessionStorage.setItem('currentUser', JSON.stringify(user));
            loginForm.reset();
            checkAuth();
        } else {
            alert('Hatalı E-Posta veya Şifre!');
        }
    });

    logoutBtn.addEventListener('click', () => {
        if (confirm('Çıkış yapmak istediğinize emin misiniz?')) logout();
    });

    // Add User (Admin/Founder)
    addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('newUsername').value;
        const password = document.getElementById('newPassword').value;
        const confirmPass = document.getElementById('confirmPassword').value;
        const role = document.getElementById('newRole').value;

        const fullName = document.getElementById('newFullName').value;
        const email = document.getElementById('newEmail').value;
        const phone = document.getElementById('newPhone').value;
        const dob = document.getElementById('newDob').value;

        if (password !== confirmPass) {
            alert('Şifreler eşleşmiyor!');
            return;
        }

        // Check duplicates
        if (users.find(u => u.username === username || u.email === email)) {
            alert('Bu kullanıcı adı veya e-posta zaten kullanımda!');
            return;
        }

        try {
            await usersRef.add({
                username, password, role, fullName, email, phone, dob,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert('Kullanıcı başarıyla eklendi!');
            addUserForm.reset();
        } catch (err) {
            console.error(err);
            alert('Kullanıcı eklenirken hata oluştu: ' + err.message);
        }
    });

    // Delete User
    window.deleteUser = async function (id) {
        if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return;
        try {
            await usersRef.doc(id).delete();
            alert("Kullanıcı silindi.");
        } catch (err) {
            alert('Silme hatası: ' + err.message);
        }
    };

    // Add Item
    addItemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newItemName = document.getElementById('newItemName').value;

        if (roomItems.includes(newItemName)) {
            alert('Bu öğe zaten listede var!');
            return;
        }

        try {
            await itemsRef.add({ name: newItemName, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            alert('Öğe listeye eklendi!');
            addItemForm.reset();
        } catch (err) {
            alert('Hata: ' + err.message);
        }
    });

    // Save Record
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const roomNo = document.getElementById('roomNo').value;
        const date = document.getElementById('date').value;
        const time = document.getElementById('time').value;
        const notes = document.getElementById('notes').value;

        if (!roomNo) {
            alert("Lütfen Oda Numarası giriniz.");
            return;
        }

        const record = {
            user: currentUser.fullName || currentUser.username,
            roomNo,
            date,
            time,
            notes,
            progress: itemsState.filter(i => i.status === 'done').length,
            totalItems: itemsState.length,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await historyRef.add(record);
            showSuccess(roomNo);
        } catch (err) {
            alert('Kayıt hatası: ' + err.message);
        }
    });

    clearHistoryBtn.addEventListener('click', async () => {
        if (confirm("Tüm geçmiş silinsin mi? (Geri alınamaz)")) {
            // Delete all docs (batch logic usually needed for huge lists, simple loop for now)
            try {
                const snapshot = await historyRef.get();
                const batch = db.batch();
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                alert("Geçmiş temizlendi.");
            } catch (err) {
                alert("Hata: " + err.message);
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
    });

    // --- Utility: Success/Confetti (Same as before) ---
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

    // --- Forgot Password (Same Simulation) ---
    // (Logic copied from previous, adapted for users array which is synced)
    const forgotLink = document.getElementById('forgotPasswordLink');
    if (forgotLink) {
        forgotLink.addEventListener('click', () => {
            document.getElementById('loginOverlay').classList.add('hidden');
            document.getElementById('forgotPasswordModal').classList.remove('hidden');
        });
    }
    // ... (Remainder of UI logic works same, just updating 'users' which updates firebase via edit logic if we added update capability)
    // Note: Forgot password simulates changing local array pass. 
    // To make it persistent in FB, we need doc ID.
    // Enhanced version below:

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
                alert('Kullanıcı bulunamadı.');
                return;
            }
            recoveryUserId = targetUser.id;
            generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
            alert(`[SİMÜLASYON] Kodunuz: ${generatedCode}`);
            document.getElementById('forgotPasswordModal').classList.add('hidden');
            document.getElementById('resetPasswordModal').classList.remove('hidden');
        });
    }

    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (document.getElementById('resetCode').value !== generatedCode) {
                alert('Hatalı Kod'); return;
            }
            const newPass = document.getElementById('newResetPass').value;
            if (newPass !== document.getElementById('newResetPassConfirm').value) {
                alert('Şifre eşleşmiyor'); return;
            }

            try {
                await usersRef.doc(recoveryUserId).update({ password: newPass });
                alert('Şifre güncellendi.');
                document.getElementById('resetPasswordModal').classList.add('hidden');
                loginOverlay.classList.remove('hidden');
            } catch (err) {
                alert('Hata: ' + err.message);
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
