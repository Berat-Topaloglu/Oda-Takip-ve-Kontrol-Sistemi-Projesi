// --- Firebase Configuration ---
// ÖNEMLİ: Kendi Firebase projenizin ayarlarını buraya yapıştırın.
// Firebase Console -> Project Settings -> General -> Your Apps -> Config kısmından alabilirsiniz.
const firebaseConfig = {
    apiKey: "AIzaSyCCHPKRn0TtjOTTOs2d9gEdKsP1Z-99jCk",
    authDomain: "my-project-23ef2.firebaseapp.com",
    projectId: "my-project-23ef2",
    storageBucket: "my-project-23ef2.firebasestorage.app",
    messagingSenderId: "576059632187",
    appId: "1:576059632187:web:04a8b6fc8b6a52100b0a1e"
};

// Initialize Firebase
let db; // Global database reference
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    window.db = db; // Make it globally accessible
    console.log("✅ Firebase başarıyla başlatıldı!");
    console.log("📊 Veritabanı bağlantısı aktif.");
} catch (error) {
    console.error("❌ Firebase başlatma hatası:", error);
    alert("Firebase bağlantı hatası! Lütfen konsolu kontrol edin.");
}
