// ============================================
// Firebase Configuration - Firestore Only
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyDJKGrVA-mH0o5B2Z5sV3Yx5tTqp5txAco",
    authDomain: "hall-booking-system-7b489.firebaseapp.com",
    projectId: "hall-booking-system-7b489",
    storageBucket: "hall-booking-system-7b489.firebasestorage.app",
    messagingSenderId: "497241282468",
    appId: "1:497241282468:web:7ecf67213bf07ab0c71331",
    measurementId: "G-E8FLD3PGJD"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore only (no Storage needed)
const db = firebase.firestore();

console.log("🔥 Firebase Firestore initialized successfully");