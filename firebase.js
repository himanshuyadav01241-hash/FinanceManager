// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    sendEmailVerification,
    deleteUser,
    GoogleAuthProvider,   // 👈 Loaded Google Core Auth
    signInWithPopup       // 👈 Loaded Popup Pipeline
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    collection, 
    addDoc, 
    getDocs, 
    updateDoc, 
    deleteDoc, 
    query, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ✅ LIVE PRODUCTION CONFIGURATION RE-ENGAGED
const firebaseConfig = {
    apiKey: "AIzaSyCCnwz-4HDj0baMMfhJ0oHWXfuhrFTvIr0",
    authDomain: "financeos-6eaf2.firebaseapp.com",
    projectId: "financeos-6eaf2",
    storageBucket: "financeos-6eaf2.firebasestorage.app",
    messagingSenderId: "503013740949",
    appId: "1:503013740949:web:a18ef8f8433711a672e69c",
    measurementId: "G-F769EYMHLJ"
};

// Initialize Core Services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize Provider Engine
const googleProvider = new GoogleAuthProvider(); 

/* ==========================================
    Authentication Services
========================================== */

// ✅ Google Quick Auth Integration Flow
export async function loginWithGoogle() {
    return signInWithPopup(auth, googleProvider);
}

export async function registerUser(email, password) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(userCredential.user);
    return userCredential;
}

export async function loginUser(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

export async function logoutUser() {
    return signOut(auth);
}

export function monitorAuthState(callback) {
    onAuthStateChanged(auth, callback);
}

// Account Deletion Pipeline Export (Updated to clean subcollections first)
export async function deleteCurrentUserAccount(uid) {
    const user = auth.currentUser;
    if (!user) throw new Error("No active user authenticated.");

    // 1. Fetch and clean up all transactions in the subcollection first
    const txRef = collection(db, "users", uid, "transactions");
    const txSnapshot = await getDocs(txRef);
    
    // Delete every single transaction document sequentially
    const deletePromises = [];
    txSnapshot.forEach((docSnap) => {
        deletePromises.push(deleteDoc(docSnap.ref));
    });
    await Promise.all(deletePromises);

    // 2. Remove the main user settings profile record from Firestore
    const userRef = doc(db, "users", uid);
    await deleteDoc(userRef);

    // 3. Finally, erase the user from Firebase Authentication
    await deleteUser(user);
}

/* ==========================================
    Database Settings Synchronization
========================================== */
export async function saveUserSettings(uid, settingsData) {
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, settingsData, { merge: true });
}

export async function getUserSettings(uid) {
    const userRef = doc(db, "users", uid);
    const docSnap = await getDoc(userRef);
    return docSnap.exists() ? docSnap.data() : null;
}

/* ==========================================
    Transactions Collection CRUD Sync Pipeline
========================================== */
export async function syncAddTransaction(uid, transaction) {
    const txRef = collection(db, "users", uid, "transactions");
    const docRef = await addDoc(txRef, transaction);
    return docRef.id;
}

export async function syncGetTransactions(uid) {
    const txRef = collection(db, "users", uid, "transactions");
    const q = query(txRef, orderBy("id", "asc"));
    const querySnapshot = await getDocs(q);
    
    let list = [];
    querySnapshot.forEach(doc => {
        list.push({ docId: doc.id, ...doc.data() });
    });
    return list;
}

export async function syncUpdateTransaction(uid, docId, updatedFields) {
    const txDocRef = doc(db, "users", uid, "transactions", docId);
    await updateDoc(txDocRef, updatedFields);
}

export async function syncDeleteTransaction(uid, docId) {
    const txDocRef = doc(db, "users", uid, "transactions", docId);
    await deleteDoc(txDocRef);
}
