// --- Firebase Configuration ---
// ÖNEMLİ: Kendi Firebase projenizin ayarlarını buraya yapıştırın.
// Firebase Console -> Project Settings -> General -> Your Apps -> Config kısmından alabilirsiniz.
const firebaseConfig = {
    apiKey: "AIzaSyCnLLUG3UjmnmY0wF3pFcUwJDU2VrQXR78",
    authDomain: "my-first-web-project-3437.firebaseapp.com",
    projectId: "my-first-web-project-3437",
    storageBucket: "my-first-web-project-3437.firebasestorage.app",
    messagingSenderId: "405678652779",
    appId: "1:405678652779:web:22d00a3e6913f8db5ee02e"
};

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    console.log("Firebase başarıyla başlatıldı.");
} catch (error) {
    console.error("Firebase başlatma hatası:", error);
    alert("Firebase bağlantı hatası! Lütfen script.js içindeki ayarları kontrol edin.");
}
