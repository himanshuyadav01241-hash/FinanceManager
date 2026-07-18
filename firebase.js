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

// 2. Live Production Firebase Configuration Space
const firebaseConfig = {
    apiKey: "AIzaSyCCnwz-4HDj0baMMfhJ0oHWXfuhrFTvIr0",
    authDomain: "financeos-6eaf2.firebaseapp.com",
    projectId: "financeos-6eaf2",
    storageBucket: "financeos-6eaf2.firebasestorage.app",
    messagingSenderId: "503013740949",
    appId: "1:503013740949:web:a18ef8f8433711a672e69c",
    measurementId: "G-F769EYMHLJ"
};

// 3. Initialize Firebase Engine Frameworks
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
