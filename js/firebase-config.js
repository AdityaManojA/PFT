/**
 * Firebase Configuration for SBAFA
 * Linked Firebase Project: sbafa-ft
 */

export const firebaseConfig = {
  apiKey: "AIzaSyAxSptDWa8INfst6MkwYneBQz6FtJn27IU",
  authDomain: "sbafa-ft.firebaseapp.com",
  projectId: "sbafa-ft",
  storageBucket: "sbafa-ft.firebasestorage.app",
  messagingSenderId: "396883332575",
  appId: "1:396883332575:web:8f2b6a8f9d2c13cc42486a"
};

/**
 * Cache and return the active Firebase configuration
 */
export async function loadFirebaseConfig() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem('sbafa_firebase_config', JSON.stringify(firebaseConfig));
    } catch (e) {}
  }
  return firebaseConfig;
}

// Auto-populate localStorage immediately on module load
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    localStorage.setItem('sbafa_firebase_config', JSON.stringify(firebaseConfig));
  } catch (e) {}
}
