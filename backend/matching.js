// ===============================================
// matching.js
// ربط خوارزمية المطابقة مع Firebase + الإشعارات
// يعتمد على ملفات البنت الثانية: database.js و notifications.js
// ===============================================

import { auth } from "./firebase.js";
import { addReport, getReports, getReportById } from "./database.js";
import { createNotification, getNotifications, markAsRead } from "./notifications.js";
import { findMatches, MATCH_THRESHOLD } from "./similarity.js";

// ===== 1) إضافة بلاغ + البحث عن تطابق مباشرة =====
// استخدميها بدل addReport في صفحة "أبلغ عن غرض"
// ترجع { reportId, matches }
export async function addReportAndMatch(data) {
  const reportId = await addReport(data);

  const allReports = await getReports();
  const newReport = allReports.find(r => r.id === reportId);
  if (!newReport) return { reportId, matches: [] };

  const matches = findMatches(newReport, allReports);

  // نسوي إشعار لصاحب البلاغ الجديد عن كل تطابق
  for (const m of matches) {
    try {
      await createNotification(reportId, m.report.id, m.score);
    } catch (e) {
      // فشل الإشعار ما لازم يفشّل نشر البلاغ
      console.warn("createNotification failed", e);
    }
  }

  return { reportId, matches };
}

// ===== 2) فحص كل بلاغاتي المفتوحة =====
// استدعيها بعد تسجيل الدخول أو عند فتح صفحة الإشعارات.
// ليش؟ لأن createNotification ينشئ الإشعار للمستخدم الحالي فقط،
// فلو أحد أضاف بلاغ يطابق بلاغك، تجيك الإشعار أول ما تدخلين.
// (الإشعار ما يتكرر لأن رقمه ثابت لكل زوج بلاغات)
export async function checkMatchesForMyReports() {
  const user = auth.currentUser;
  if (!user) return [];

  const allReports = await getReports();
  const myReports = allReports.filter(
    r => r.userId === user.uid && r.status === "open"
  );

  const newMatches = [];
  for (const mine of myReports) {
    const matches = findMatches(mine, allReports);
    for (const m of matches) {
      await createNotification(mine.id, m.report.id, m.score);
      newMatches.push({ myReport: mine, ...m });
    }
  }
  return newMatches;
}

// ===== 3) التطابقات المحتملة لبلاغ معيّن (لصفحة تفاصيل البلاغ) =====
export async function getMatchesForReport(reportId, minScore = MATCH_THRESHOLD) {
  const allReports = await getReports();
  const report = allReports.find(r => r.id === reportId);
  if (!report) return [];
  return findMatches(report, allReports, minScore);
}

// ===== 4) الإشعارات جاهزة للعرض =====
// ترجع الإشعارات مرتبة (الأحدث أول) ومعها بيانات البلاغين
export async function getMyNotificationsDetailed() {
  const list = await getNotifications();

  list.sort((a, b) => {
    const ta = a.createdAt?.seconds ?? 0;
    const tb = b.createdAt?.seconds ?? 0;
    return tb - ta;
  });

  const detailed = [];
  for (const n of list) {
    const [myReport, matchedReport] = await Promise.all([
      getReportById(n.reportId),
      getReportById(n.matchedReportId)
    ]);
    // لو أحد البلاغين انحذف نتجاهل الإشعار
    if (!myReport || !matchedReport) continue;
    detailed.push({ ...n, myReport, matchedReport });
  }
  return detailed;
}

// عدد الإشعارات غير المقروءة (للرقم اللي فوق أيقونة الجرس)
export async function getUnreadCount() {
  const list = await getNotifications();
  return list.filter(n => !n.isRead).length;
}

export async function markAllAsRead() {
  const list = await getNotifications();
  await Promise.all(list.filter(n => !n.isRead).map(n => markAsRead(n.id)));
}