// ===============================================
// claimsFlow.js
// طلب استرداد الغرض + التحقق من الملكية
// يعتمد على claims.js و database.js (البنت الثانية)
//
// الفكرة:
// 1. اللي لقى الغرض ما يكتب كل التفاصيل في الوصف العام
//    (يخبي شي مثل: وش داخل المحفظة، خدش، ملصق، رقم تسلسلي...)
// 2. اللي يطلب الغرض لازم يكتب هالتفاصيل الخاصة
// 3. اللي لقى الغرض يقارنها ويقبل أو يرفض
// ===============================================

import { auth } from "./firebase.js";
import { submitClaim, getReceivedClaims, getMyClaims, reviewClaim } from "./claims.js";
import { getReportById, updateReportStatus } from "./database.js";

const MIN_DETAILS_LENGTH = 15;

// ===== 1) طلب استرداد غرض =====
export async function requestItem(reportId, verificationDetails) {
  const details = (verificationDetails || "").trim();

  if (details.length < MIN_DETAILS_LENGTH) {
    throw new Error("اكتب تفاصيل أكثر تثبت إن الغرض لك (مثل علامة مميزة أو شي داخله).");
  }

  // ما نخلي نفس الشخص يطلب نفس الغرض مرتين
  const mine = await getMyClaims();
  const already = mine.some(c => c.reportId === reportId && c.status !== "rejected");
  if (already) {
    throw new Error("سبق وأرسلت طلب لهذا الغرض، انتظر الرد.");
  }

  return submitClaim(reportId, details);
}

// ===== 2) الطلبات اللي وصلتني (أنا اللي لقيت الغرض) =====
// ترجع الطلبات المعلّقة ومعها بيانات البلاغ عشان أقارن
export async function getClaimsToReview() {
  const claims = await getReceivedClaims();
  const pending = claims.filter(c => c.status === "pending");

  const result = [];
  for (const c of pending) {
    const report = await getReportById(c.reportId);
    if (report) result.push({ ...c, report });
  }
  return result;
}

// ===== 3) قبول أو رفض الطلب =====
// decision: "approved" أو "rejected"
// عند القبول: البلاغ يصير "resolved" وباقي الطلبات على نفس الغرض تنرفض
export async function respondToClaim(claimId, decision) {
  const user = auth.currentUser;
  if (!user) throw new Error("Please log in first.");

  const claims = await getReceivedClaims();
  const claim = claims.find(c => c.id === claimId);

  if (!claim) throw new Error("الطلب غير موجود أو ما يخصك.");
  if (claim.status !== "pending") throw new Error("تم الرد على هذا الطلب مسبقاً.");

  await reviewClaim(claimId, decision);

  if (decision === "approved") {
    await updateReportStatus(claim.reportId, "resolved");

    const others = claims.filter(
      c => c.reportId === claim.reportId && c.id !== claimId && c.status === "pending"
    );
    for (const o of others) {
      await reviewClaim(o.id, "rejected");
    }
  }
}

// ===== 4) طلباتي أنا (اللي أرسلتها) مع حالتها =====
const STATUS_LABELS = {
  pending: "قيد المراجعة",
  approved: "تم القبول ✅ تواصل مع الشخص لاستلام غرضك",
  rejected: "مرفوض"
};

export async function getMyClaimsDetailed() {
  const claims = await getMyClaims();
  const result = [];
  for (const c of claims) {
    const report = await getReportById(c.reportId);
    result.push({ ...c, report, statusLabel: STATUS_LABELS[c.status] || c.status });
  }
  return result;
}
