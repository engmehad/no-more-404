import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

const provider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  const userRef = doc(db, "users", user.uid);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists()) {
    await setDoc(userRef, {
      userId: user.uid,
      name: user.displayName,
      email: user.email,
      createdAt: serverTimestamp()
    });
  }

  return user;
}

export async function logout() {
  await signOut(auth);
}

export function monitorAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

// إنشاء حساب بالبريد وكلمة المرور
export async function registerWithEmail(name, email, password, phone = "") {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(user, { displayName: name });
  await setDoc(doc(db, "users", user.uid), {
    userId: user.uid,
    name: name,
    email: email,
    phone: phone,
    createdAt: serverTimestamp()
  });
  return user;
}

// تسجيل الدخول بالبريد وكلمة المرور
export async function loginWithEmail(email, password) {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return user;
}

// قراءة بيانات المستخدم المخزنة (الجوال وغيره)
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}