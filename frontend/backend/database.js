import { db, auth } from "./firebase.js";

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

const reportsRef = collection(db, "reports");

// Add a report
export async function addReport(data) {

  if (!auth.currentUser) {
    throw new Error("Please log in first.");
  }

  const report = {
    type: data.type,
    title: data.title,
    category: data.category,
    description: data.description,
    color: data.color || "",
    contactName: data.contactName || "",
    contactEmail: data.contactEmail || "",
    contactPhone: data.contactPhone || "",
    brand: data.brand || "",
    location: data.location,
    date: data.date,
    imageUrl: data.imageUrl || "",
    status: "open",
    userId: auth.currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const result = await addDoc(reportsRef, report);

  return result.id;
}

// Get all reports
export async function getReports() {

  const snapshot = await getDocs(reportsRef);

  return snapshot.docs.map(document => ({
    ...document.data(),
    id: document.id
  }));
}

// Get one report
export async function getReportById(id) {

  const snapshot = await getDoc(
    doc(db, "reports", id)
  );

  if (!snapshot.exists()) {
    return null;
  }

  return {
    ...snapshot.data(),
    id: snapshot.id
  };
}

// Update report status
export async function updateReportStatus(id, status) {

  if (!["open", "pending", "resolved"].includes(status)) {
    throw new Error("Invalid status.");
  }

  await updateDoc(doc(db, "reports", id), {
    status: status,
    updatedAt: serverTimestamp()
  });
}

// Delete a report
export async function deleteReport(id) {

  await deleteDoc(doc(db, "reports", id));

}