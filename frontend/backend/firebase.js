import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";


  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyBEXOcN68IEJJH6f3qVxOmD7jQ9i2bT8S0",
    authDomain: "lost-and-found-bdbe5.firebaseapp.com",
    projectId: "lost-and-found-bdbe5",
    storageBucket: "lost-and-found-bdbe5.firebasestorage.app",
    messagingSenderId: "91824345042",
    appId: "1:91824345042:web:637bd9e6e76112716dc20b"
  };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };