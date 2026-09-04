import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Remplace ces valeurs par celles de TON projet Firebase
// (Console Firebase > Paramètres du projet > Tes applications > Config SDK)
const firebaseConfig = {
  apiKey: "AIzaSyDnYhYiygdpGZstwNOhLIK7S2DorKx3ZiI",
  authDomain: "uniparco-budget.firebaseapp.com",
  projectId: "uniparco-budget",
  storageBucket: "uniparco-budget.firebasestorage.app",
  messagingSenderId: "1094210557302",
  appId: "1:1094210557302:web:0eefdf3cfab1711be59657"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
