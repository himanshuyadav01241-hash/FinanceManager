// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    sendEmailVerification,
    deleteUser
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

// Your Firebase Configuration (Keep your keys here)
const firebaseConfig = {
    apiKey: "AIzaSy...", 
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Core Services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ==========================================
    Authentication Services
========================================== */
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

// THIS IS THE EXACT EXPORT SCRIPT.JS IS LOOKING FOR:
export async function deleteCurrentUserAccount(uid) {
    const user = auth.currentUser;
    if (!user) throw new Error("No active user authenticated.");

    // 1. Remove user settings record from Firestore database
    const userRef = doc(db, "users", uid);
    await deleteDoc(userRef);

    // 2. Erase user from Firebase Authentication
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
