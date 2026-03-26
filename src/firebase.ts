import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Replace these with your Firebase project config
// Get these from Firebase Console > Project Settings
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'nwpcnpils',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Cloud Functions
export const functions = getFunctions(app, 'europe-west2');

// Connect to emulator in development if VITE_USE_EMULATOR is set
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  connectFunctionsEmulator(functions, 'localhost', 5001);
}
