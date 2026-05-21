// ============================================
// ADMIN PANEL JAVASCRIPT
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication and role
    const currentUser = Auth.requireRole(['admin', 'founder']);
    if (!currentUser) return;

    // Display user info
    const roleText = currentUser.role === 'founder' ? 'Kurucu' : 'Yönetici';
    document.getElementById('welcomeUser').textContent =
        `${currentUser.fullName || currentUser.username} (${roleText})`;

    // State
    let users = [];
    let items = [];
    let records = [];

    // Firebase references
    const usersRef = db.collection('users');
    const itemsRef = db.collection('items');
    const historyRef = db.collection('history');

    // ============================================
    // REALTIME LISTENERS
    // ============================================

    // Users listener
    usersRef.onSnapshot(snapshot => {
        users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderUserList();
        updateStats();
    });

    // Items listener
    itemsRef.onSnapshot(snapshot => {
        items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateStats();
    });

    // History listener
    historyRef.onSnapshot(snapshot => {
        records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateStats();
    });

    // Requests listener (Only for founder)
    if (currentUser.role === 'founder') {
        document.getElementById('founderInbox').style.display = 'block';
        document.getElementById('requestStatCard').style.display = 'block';

        db.collection('requests').onSnapshot(snapshot => {
            const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            document.getElementById('pendingRequests').textContent = requests.length;
            renderInbox(requests);
        });
    }

    // ============================================
    // RENDER FUNCTIONS
    // ============================================

    function renderUserList() {
        const tbody = document.getElementById('userListBody');
        tbody.innerHTML = '';

        if (users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 40px; color: #999;">
                        <i class="fa-solid fa-users" style="font-size: 3rem; margin-bottom: 10px; display: block;"></i>
                        Henüz kullanıcı yok
                    </td>
                </tr>
            `;
            return;
        }

        users.forEach(user => {
            const tr = document.createElement('tr');

            const roleLabels = {
                founder: 'Kurucu',
                admin: 'Yönetici',
                staff: 'Personel'
            };

            const isProtected = user.role === 'founder';

            tr.innerHTML = `
                <td>
                    <div style="font-weight: 600; font-size: 1rem;">${user.fullName || user.username}</div>
                    <div style="font-size: 0.85rem; color: #999;">@${user.username}</div>
                </td>
                <td>${user.email}</td>
                <td>${user.phone || 'N/A'}</td>
                <td>
                    <span class="role-badge ${user.role}">${roleLabels[user.role] || user.role}</span>
                </td>
                <td>
                    ${!isProtected ? `
                        <button class="action-btn delete" onclick="deleteUser('${user.id}')" title="Sil">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    ` : '<span style="color: #999; font-size: 0.9rem;">Korumalı</span>'}
                </td>
            `;

            tbody.appendChild(tr);
        });
    }

    function renderItemList() {
        const container = document.getElementById('adminItemList');
        container.innerHTML = '';

        if (items.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999; padding: 10px;">Öğe bulunamadı.</p>';
            return;
        }

        // Alfabetik sıralama
        const sortedItems = [...items].sort((a, b) => a.name.localeCompare(b.name, 'tr'));

        sortedItems.forEach(item => {
            const div = document.createElement('div');
            div.className = 'data-item';
            div.style.cssText = 'padding: 8px 12px; border-bottom: 1px solid #f8f8f8; display: flex; justify-content: space-between; align-items: center;';
            div.innerHTML = `
                <span>${item.name}</span>
                <button class="action-btn delete" onclick="deleteItem('${item.id}')" style="padding: 4px 8px; font-size: 0.9rem;">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            `;
            container.appendChild(div);
        });
    }

    function renderInbox(requests) {
        const tbody = document.getElementById('inboxListBody');
        tbody.innerHTML = '';

        if (requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999; padding: 20px;">Yeni mesaj yok.</td></tr>';
            return;
        }

        requests.forEach(req => {
            const tr = document.createElement('tr');
            const date = req.timestamp ? new Date(req.timestamp.seconds * 1000).toLocaleString('tr-TR') : '...';

            tr.innerHTML = `
                <td><strong>Kullanıcı Silme</strong></td>
                <td>${req.requestedByName}</td>
                <td><span class="role-badge admin">@${req.targetUserName}</span></td>
                <td style="font-size: 0.85rem;">${date}</td>
                <td>
                    <button class="btn-success" onclick="handleRequest('${req.id}', true)" style="padding: 5px 10px; font-size: 0.8rem; display: inline-flex;">Onayla</button>
                    <button class="btn-danger" onclick="handleRequest('${req.id}', false)" style="padding: 5px 10px; font-size: 0.8rem; display: inline-flex;">Reddet</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function updateStats() {
        document.getElementById('totalUsers').textContent = users.length;
        document.getElementById('totalItems').textContent = items.length;
        document.getElementById('totalRecords').textContent = records.length;
        renderItemList(); // Update item list when items change
    }

    // ============================================
    // FORM HANDLERS
    // ============================================

    // Add User Form
    document.getElementById('addUserForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('newUsername').value.trim();
        const fullName = document.getElementById('newFullName').value.trim();
        const email = document.getElementById('newEmail').value.trim();
        const phone = document.getElementById('newPhone').value.trim();
        const dob = document.getElementById('newDob').value;
        const password = document.getElementById('newPassword').value;
        const confirmPass = document.getElementById('confirmPassword').value;
        const role = document.getElementById('newRole').value;

        // Validation
        if (!Validator.required(username) || !Validator.required(fullName)) {
            Toast.error('Lütfen tüm alanları doldurun!');
            return;
        }

        if (!Validator.email(email)) {
            Toast.error('Geçerli bir e-posta adresi girin!');
            return;
        }

        if (!Validator.phone(phone)) {
            Toast.error('Geçerli bir telefon numarası girin!');
            return;
        }

        if (!Validator.password(password)) {
            Toast.error('Şifre en az 6 karakter olmalıdır!');
            return;
        }

        if (password !== confirmPass) {
            Toast.error('Şifreler eşleşmiyor!');
            return;
        }

        // Check duplicates
        if (users.find(u => u.username === username)) {
            Toast.error('Bu kullanıcı adı zaten kullanımda!');
            return;
        }

        if (users.find(u => u.email === email)) {
            Toast.error('Bu e-posta adresi zaten kullanımda!');
            return;
        }

        try {
            Loading.show('Kullanıcı ekleniyor...');

            await usersRef.add({
                username,
                fullName,
                email,
                phone,
                dob,
                password,
                role,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            await Logger.log('Kullanıcı Ekledi', { newUser: username, role: role });

            Toast.success('Kullanıcı başarıyla eklendi!');
            document.getElementById('addUserForm').reset();
        } catch (error) {
            console.error('Error adding user:', error);
            Toast.error('Kullanıcı eklenirken hata oluştu: ' + error.message);
        } finally {
            Loading.hide();
        }
    });

    // Add Item Form
    document.getElementById('addItemForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const itemName = document.getElementById('newItemName').value.trim();
        const description = document.getElementById('itemDescription').value.trim();

        if (!Validator.required(itemName)) {
            Toast.error('Öğe adı boş olamaz!');
            return;
        }

        // Check duplicates
        if (items.find(item => item.name === itemName)) {
            Toast.error('Bu öğe zaten listede var!');
            return;
        }

        try {
            Loading.show('Öğe ekleniyor...');

            await itemsRef.add({
                name: itemName,
                description: description || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            await Logger.log('Öğe Ekledi', { itemName: itemName });

            Toast.success('Öğe başarıyla eklendi!');
            document.getElementById('addItemForm').reset();
        } catch (error) {
            console.error('Error adding item:', error);
            Toast.error('Öğe eklenirken hata oluştu: ' + error.message);
        } finally {
            Loading.hide();
        }
    });

    // ============================================
    // ACTION HANDLERS
    // ============================================

    window.deleteUser = async function (userId) {
        const targetUser = users.find(u => u.id === userId);
        if (!targetUser) return;

        // Hiyerarşi Kontrolü
        if (currentUser.role === 'admin' && targetUser.role === 'admin') {
            const ok = await Confirm.ask(`Yönetici "@${targetUser.username}" silme yetkiniz yok. Kurucuya onay isteği gönderilsin mi?`, 'Yetki Kısıtlı');
            if (ok) {
                try {
                    Loading.show('Talep iletiliyor...');
                    await db.collection('requests').add({
                        type: 'delete_user',
                        targetUserId: userId,
                        targetUserName: targetUser.username,
                        requestedBy: currentUser.username,
                        requestedByName: currentUser.fullName || currentUser.username,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    Toast.success('Talebiniz kurucuya iletildi.');
                } catch (e) {
                    Toast.error('Talep iletilemedi!');
                } finally {
                    Loading.hide();
                }
            }
            return;
        }

        if (!await Confirm.ask(`"${targetUser.fullName || targetUser.username}" kullanıcısını silmek istediğinize emin misiniz?`)) {
            return;
        }

        try {
            Loading.show('Kullanıcı siliniyor...');
            await usersRef.doc(userId).delete();
            await Logger.log('Kullanıcı Sildi', { deletedUser: targetUser.username });
            Toast.success('Kullanıcı başarıyla silindi!');
        } catch (error) {
            console.error('Error deleting user:', error);
            Toast.error('Kullanıcı silinirken hata oluştu: ' + error.message);
        } finally {
            Loading.hide();
        }
    };

    window.deleteItem = async function (itemId) {
        const item = items.find(i => i.id === itemId);
        if (!item) return;

        if (!await Confirm.ask(`"${item.name}" öğesini listeden kaldırmak istediğinize emin misiniz?`, 'Öğe Silme')) {
            return;
        }

        try {
            Loading.show('Öğe siliniyor...');
            await itemsRef.doc(itemId).delete();
            await Logger.log('Öğe Sildi', { itemName: item.name });
            Toast.success('Öğe başarıyla kaldırıldı.');
        } catch (error) {
            Toast.error('Öğe silinemedi!');
        } finally {
            Loading.hide();
        }
    };

    window.handleRequest = async function (reqId, approved) {
        try {
            Loading.show(approved ? 'İşlem Onaylanıyor...' : 'İşlem Reddediliyor...');
            const reqRef = db.collection('requests').doc(reqId);
            const reqDoc = await reqRef.get();

            if (approved && reqDoc.exists) {
                const data = reqDoc.data();
                await usersRef.doc(data.targetUserId).delete();
                await Logger.log('Talep Üzerine Sildi', { deletedUser: data.targetUserName, requestedBy: data.requestedBy });
                Toast.success('İşlem onaylandı ve kullanıcı silindi.');
            } else {
                Toast.info('İstek reddedildi.');
            }

            await reqRef.delete();
        } catch (e) {
            Toast.error('İşlem tamamlanamadı!');
        } finally {
            Loading.hide();
        }
    };

    // Initial stats update
    updateStats();
});
