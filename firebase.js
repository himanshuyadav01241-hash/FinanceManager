// firebase.js
// 1. Import the specific SDK functions from the official Firebase CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
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

// 2. Your Web App's Firebase Configuration (Replace with your exact keys)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "YOUR_AUTH_DOMAIN_HERE",
    projectId: "YOUR_PROJECT_ID_HERE",
    storageBucket: "YOUR_STORAGE_BUCKET_HERE",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE",
    appId: "YOUR_APP_ID_HERE"
};

// 3. Initialize Firebase Services modules cleanly
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ==========================================
    Authentication Services
========================================== */
export async function registerUser(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
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

/* ==========================================
    User Settings / Theme Configs Store
========================================== */
export async function saveUserSettings(uid, settings) {
    const userRef = doc(db, "users", uid);
    return setDoc(userRef, settings, { merge: true });
}

export async function getUserSettings(uid) {
    const userRef = doc(db, "users", uid);
    const docSnap = await getDoc(userRef);
    return docSnap.exists() ? docSnap.data() : null;
}

/* ==========================================
    Transactions Ledger CRUD Store Pipeline
========================================== */
export async function syncAddTransaction(uid, transactionData) {
    const txCollectionRef = collection(db, "users", uid, "transactions");
    const docRef = await addDoc(txCollectionRef, transactionData);
    return docRef.id;
}

export async function syncGetTransactions(uid) {
    const txCollectionRef = collection(db, "users", uid, "transactions");
    const q = query(txCollectionRef, orderBy("id", "asc"));
    const querySnapshot = await getDocs(q);
    
    const list = [];
    querySnapshot.forEach((doc) => {
        list.push({ docId: doc.id, ...doc.data() });
    });
    return list;
}

export async function syncUpdateTransaction(uid, docId, updatedFields) {
    const txDocRef = doc(db, "users", uid, "transactions", docId);
    return updateDoc(txDocRef, updatedFields);
}

export async function syncDeleteTransaction(uid, docId) {
    const txDocRef = doc(db, "users", uid, "transactions", docId);
    return deleteDoc(txDocRef);
}
