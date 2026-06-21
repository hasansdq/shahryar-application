import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  projectId: "shahryar-462406",
  appId: "1:919814705160:web:31b7598f460ade4da5c1bd",
  apiKey: "AIzaSyCkPBjWmNpktCeCJ7QbkdmVFpE1zeT6eTo",
  authDomain: "shahryar-462406.firebaseapp.com",
  storageBucket: "shahryar-462406.firebasestorage.app",
  messagingSenderId: "919814705160"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
