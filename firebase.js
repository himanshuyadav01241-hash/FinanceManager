firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, addDoc, getDoc, getDocs, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCCnwz-4HDj0baMMfhJ0oHWXfuhrFTvIr0",
  authDomain: "financeos-6eaf2.firebaseapp.com",
  projectId: "financeos-6eaf2",
  storageBucket: "financeos-6eaf2.firebasestorage.app",
  messagingSenderId: "503013740949",
  appId: "1:503013740949:web:a18ef8f8433711a672e69c",
  measurementId: "G-F769EYMHLJ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

/* --- APPLICATION LAYER AUTH ACTIONS --- */
export const registerUser = (email, password) => createUserWithEmailAndPassword(auth, email, password);
export const loginUser = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const logoutUser = () => signOut(auth);
export const monitorAuthState = (callback) => onAuthStateChanged(auth, callback);

/* --- CONFIG DATA CONTROL METRICS --- */
export const saveUserSettings = async (userId, settings) => {
    try {
        await setDoc(doc(db, "users", userId, "config", "appSettings"), settings, { merge: true });
    } catch (e) { console.error("Database connection failure updating settings:", e); }
};

export const getUserSettings = async (userId) => {
    try {
        const snap = await getDoc(doc(db, "users", userId, "config", "appSettings"));
        return snap.exists() ? snap.data() : null;
    } catch (e) { console.error("Database connections error getting settings:", e); return null; }
};

/* --- TRANSACTION LEDGER FIRESTORE CRUD --- */
export const syncAddTransaction = async (userId, tx) => {
    try {
        const docRef = await addDoc(collection(db, "users", userId, "transactions"), tx);
        return docRef.id;
    } catch (e) { console.error("Failed adding ledger operation record:", e); }
};

export const syncGetTransactions = async (userId) => {
    try {
        const snap = await getDocs(collection(db, "users", userId, "transactions"));
        let txList = [];
        snap.forEach(doc => txList.push({ docId: doc.id, ...doc.data() }));
        return txList;
    } catch (e) { console.error("Failed collecting structural transactions list:", e); return []; }
};

export const syncUpdateTransaction = async (userId, docId, updatedFields) => {
    try {
        await updateDoc(doc(db, "users", userId, "transactions", docId), updatedFields);
    } catch (e) { console.error("Failed updating structured database entry:", e); }
};

export const syncDeleteTransaction = async (userId, docId) => {
    try {
        await deleteDoc(doc(db, "users", userId, "transactions", docId));
    } catch (e) { console.error("Failed removing transaction data record:", e); }
};