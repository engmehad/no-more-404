import { db, auth } from "./firebase.js";

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

// Submit a claim
export async function submitClaim(reportId, verificationDetails) {

  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please log in first.");
  }

  if (!verificationDetails.trim()) {
    throw new Error("Enter verification details.");
  }

  const report = await getDoc(
    doc(db, "reports", reportId)
  );

  if (!report.exists()) {
    throw new Error("Report not found.");
  }

  const data = report.data();

  if (data.type !== "found" || data.status !== "open") {
    throw new Error("This item is not available.");
  }

  if (data.userId === user.uid) {
    throw new Error("You cannot claim your own item.");
  }

  const result = await addDoc(
    collection(db, "claims"), {
      reportId: reportId,
      claimantId: user.uid,
      ownerId: data.userId,
      verificationDetails: verificationDetails.trim(),
      status: "pending",
      createdAt: serverTimestamp()
    }
  );

  return result.id;
}

// Get received claims
export async function getReceivedClaims() {

  if (!auth.currentUser) {
    throw new Error("Please log in first.");
  }

  const q = query(
    collection(db, "claims"),
    where("ownerId", "==", auth.currentUser.uid)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(d => ({
    ...d.data(),
    id: d.id
  }));
}

// Get submitted claims
export async function getMyClaims() {

  if (!auth.currentUser) {
    throw new Error("Please log in first.");
  }

  const q = query(
    collection(db, "claims"),
    where("claimantId", "==", auth.currentUser.uid)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(d => ({
    ...d.data(),
    id: d.id
  }));
}

// Approve or reject a claim
export async function reviewClaim(claimId, status) {

  if (!["approved", "rejected"].includes(status)) {
    throw new Error("Invalid status.");
  }

  await updateDoc(doc(db, "claims", claimId), {
    status: status
  });
}