import { db, auth } from "./firebase.js";

import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

// Create a matching notification
export async function createNotification(
  reportId,
  matchedReportId,
  matchScore
) {

  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please log in first.");
  }

  if (!Number.isFinite(matchScore) ||
      matchScore < 0 || matchScore > 100) {
    throw new Error("Invalid match score.");
  }

  const notificationId =
    `${user.uid}_${reportId}_${matchedReportId}`;

  const notificationRef = doc(
    db, "notifications", notificationId
  );

  const existing = await getDoc(notificationRef);

  if (existing.exists()) {
    return notificationId;
  }

  await setDoc(notificationRef, {
    userId: user.uid,
    reportId: reportId,
    matchedReportId: matchedReportId,
    matchScore: matchScore,
    message: `Potential match found! ${matchScore}% similarity.`,
    isRead: false,
    createdAt: serverTimestamp()
  });

  return notificationId;
}

// Get user notifications
export async function getNotifications() {

  if (!auth.currentUser) {
    throw new Error("Please log in first.");
  }

  const q = query(
    collection(db, "notifications"),
    where("userId", "==", auth.currentUser.uid)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(d => ({
    ...d.data(),
    id: d.id
  }));
}

// Mark notification as read
export async function markAsRead(notificationId) {

  await updateDoc(
    doc(db, "notifications", notificationId),
    { isRead: true }
  );
}