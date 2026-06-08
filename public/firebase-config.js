// Firebase configuration and synchronization module
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut, 
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Default Firebase configuration (placeholder, can be customized via settings panel)
const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyDummyKeyForAlisherUsta12345678",
    authDomain: "alisher-usta-db.firebaseapp.com",
    projectId: "alisher-usta-db",
    storageBucket: "alisher-usta-db.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef1234567"
};

let app = null;
let auth = null;
let db = null;
let provider = null;
let isFirebaseInitialized = false;

// Load config from localStorage or use default
function getFirebaseConfig() {
    const savedConfig = localStorage.getItem('alisher_usta_firebase_config');
    if (savedConfig) {
        try {
            return JSON.parse(savedConfig);
        } catch (e) {
            console.error("Firebase config parsing error", e);
        }
    }
    return DEFAULT_FIREBASE_CONFIG;
}

// Check if config is a placeholder
function isPlaceholderConfig(config) {
    return config.apiKey.includes("DummyKey") || config.projectId.includes("Dummy");
}

// Initializing Firebase
const currentConfig = getFirebaseConfig();

if (!isPlaceholderConfig(currentConfig)) {
    try {
        app = initializeApp(currentConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        provider = new GoogleAuthProvider();
        isFirebaseInitialized = true;
        console.log("Firebase successfully initialized!");
    } catch (error) {
        console.error("Firebase initialization failed:", error);
    }
} else {
    console.log("Firebase is using a placeholder config. App running in LocalStorage mode.");
}

// Cloud sync status elements update helper
function updateSyncStatusUI(user) {
    const badge = document.getElementById('sync-badge');
    const headerProfileBtn = document.getElementById('header-profile-btn');
    const settingsAvatar = document.getElementById('user-avatar-container');
    const settingsName = document.getElementById('user-display-name');
    const settingsEmail = document.getElementById('user-email');
    const loginBtn = document.getElementById('google-login-btn');
    const logoutBtn = document.getElementById('google-logout-btn');

    if (user) {
        // Logged In
        if (badge) {
            badge.textContent = "Bulutda Saqlangan";
            badge.className = "badge badge-online";
        }
        
        const photoURL = user.photoURL || 'https://via.placeholder.com/150';
        
        if (headerProfileBtn) {
            headerProfileBtn.innerHTML = `<img src="${photoURL}" alt="${user.displayName || 'Profil'}">`;
        }
        
        if (settingsAvatar) {
            settingsAvatar.innerHTML = `<img src="${photoURL}" alt="${user.displayName || 'Profil'}">`;
        }
        
        if (settingsName) settingsName.textContent = user.displayName || 'Foydalanuvchi';
        if (settingsEmail) settingsEmail.textContent = user.email || '';
        
        if (loginBtn) loginBtn.classList.add('collapsed');
        if (logoutBtn) logoutBtn.classList.remove('collapsed');
    } else {
        // Logged Out / Offline
        if (badge) {
            badge.textContent = "Faqat telefonda";
            badge.className = "badge badge-offline";
        }
        
        if (headerProfileBtn) {
            headerProfileBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="20" height="20">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="currentColor"/>
                </svg>`;
        }
        
        if (settingsAvatar) {
            settingsAvatar.innerHTML = `
                <svg viewBox="0 0 24 24" width="48" height="48" fill="var(--muted-color)">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
                </svg>`;
        }
        
        if (settingsName) settingsName.textContent = "Mehmon (Oflayn rejim)";
        if (settingsEmail) settingsEmail.textContent = "Ma'lumotlar faqat shu qurilma xotirasida saqlanadi.";
        
        if (loginBtn) loginBtn.classList.remove('collapsed');
        if (logoutBtn) logoutBtn.classList.add('collapsed');
    }
}

// Sync local storage data with Firestore
export async function syncDataToCloud(userId, data) {
    if (!isFirebaseInitialized || !db) return false;
    try {
        const userDocRef = doc(db, 'alisher_usta_users', userId);
        await setDoc(userDocRef, {
            data: data,
            lastSynced: new Date().toISOString()
        }, { merge: true });
        console.log("Cloud sync completed!");
        return true;
    } catch (e) {
        console.error("Cloud sync failed:", e);
        return false;
    }
}

// Fetch data from Firestore
export async function fetchFromCloud(userId) {
    if (!isFirebaseInitialized || !db) return null;
    try {
        const userDocRef = doc(db, 'alisher_usta_users', userId);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            return docSnap.data().data;
        }
    } catch (e) {
        console.error("Fetching from cloud failed:", e);
    }
    return null;
}

// Listen to Auth State and execute callback
export function setupAuthListener(onUserChanged) {
    if (!isFirebaseInitialized || !auth) {
        // Fallback: update UI immediately to offline mode
        updateSyncStatusUI(null);
        return;
    }
    
    onAuthStateChanged(auth, async (user) => {
        updateSyncStatusUI(user);
        if (onUserChanged) {
            await onUserChanged(user);
        }
    });
}

// Login trigger
export async function loginWithGoogle() {
    if (!isFirebaseInitialized || !auth || !provider) {
        alert("Google Login xizmati sozlanmagan. Iltimos, sozlamalar bo'limidan shaxsiy Firebase parametrlaringizni kiriting!");
        return null;
    }
    try {
        const result = await signInWithPopup(auth, provider);
        return result.user;
    } catch (error) {
        console.error("Google sign in error:", error);
        alert("Google hisobiga ulanishda xatolik yuz berdi: " + error.message);
        return null;
    }
}

// Logout trigger
export async function logoutUser() {
    if (!isFirebaseInitialized || !auth) return;
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout error:", error);
    }
}

// Expose configuration status
export function getFirebaseStatus() {
    return {
        initialized: isFirebaseInitialized,
        config: currentConfig,
        isPlaceholder: isPlaceholderConfig(currentConfig)
    };
}
