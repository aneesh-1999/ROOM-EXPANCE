import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

// Firebase configuration using credentials from our project setup
const firebaseConfig = {
  apiKey: "AIzaSyBvkho7Qq_rmR5KUT-fH_g6zMtFaJxmoT0",
  authDomain: "ai-studio-applet-webapp-de5cb.firebaseapp.com",
  projectId: "ai-studio-applet-webapp-de5cb",
  storageBucket: "ai-studio-applet-webapp-de5cb.firebasestorage.app",
  messagingSenderId: "466782740690",
  appId: "1:466782740690:web:e92852494f27b74b978d0b"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with persistent offline cache for smooth PWA performance
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, "ai-studio-7a495509-3c2e-4c54-aafa-b8beac816b93");

export { db };
