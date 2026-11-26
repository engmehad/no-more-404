// ===============================================
// similarity.js
// حساب درجة التشابه بين بلاغ مفقود وبلاغ موجود
// (بدون Firebase — دوال نقية)
// ===============================================

import { normalizeText, tokenize, colorSimilarity } from "./textUtils.js";

// أوزان العوامل (مجموعها 100)
export const WEIGHTS = {
  category: 30,
  color: 15,
  brand: 10,
  location: 15,
  date: 15,
  keywords: 15
};

// أقل نسبة تعتبر "تطابق محتمل" ويطلع لها إشعار
export const MATCH_THRESHOLD = 60;

function daysBetween(d1, d2) {
  const t1 = new Date(d1).getTime();
  const t2 = new Date(d2).getTime();
  if (Number.isNaN(t1) || Number.isNaN(t2)) return null;
  return (t2 - t1) / 86400000;
}

// ===== كل عامل لحاله (يرجع رقم بين 0 و 1) =====

function categoryScore(a, b) {
  return normalizeText(a.category) &&
    normalizeText(a.category) === normalizeText(b.category) ? 1 : 0;
}

function brandScore(a, b) {
  const b1 = normalizeText(a.brand);
  const b2 = normalizeText(b.brand);
  if (!b1 || !b2) return 0.5; // واحد منهم ما كتب الماركة: نعطي نص الدرجة
  return b1 === b2 || b1.includes(b2) || b2.includes(b1) ? 1 : 0;
}

function locationScore(a, b) {
  const l1 = normalizeText(a.location);
  const l2 = normalizeText(b.location);
  if (!l1 || !l2) return 0;
  if (l1 === l2) return 1;
  if (l1.includes(l2) || l2.includes(l1)) return 0.8;
  // نفس الكلمات بترتيب مختلف مثل "مبنى 5 الجامعة" و "الجامعة مبنى 5"
  const t1 = new Set(l1.split(" ").map(w => tokenize(w)[0] || w));
  const t2 = new Set(l2.split(" ").map(w => tokenize(w)[0] || w));
  let shared = 0;
  for (const w of t1) if (t2.has(w)) shared++;
  const ratio = shared / Math.min(t1.size, t2.size);
  if (ratio === 1) return 1;
  return ratio >= 0.5 ? 0.6 : ratio > 0 ? 0.3 : 0;
}

// lost = بلاغ المفقود ، found = بلاغ الموجود
function dateScore(lost, found) {
  const diff = daysBetween(lost.date, found.date); // كم يوم بعد الفقدان انلقى
  if (diff === null) return 0;
  if (diff < -1) return 0;     // انلقى قبل ما ينفقد؟ مستحيل
  if (diff <= 2) return 1;
  if (diff <= 7) return 0.7;
  if (diff <= 14) return 0.4;
  if (diff <= 30) return 0.2;
  return 0;
}

function keywordsScore(a, b) {
  const w1 = new Set(tokenize(`${a.title} ${a.description}`));
  const w2 = new Set(tokenize(`${b.title} ${b.description}`));
  if (w1.size === 0 || w2.size === 0) return 0;
  let common = 0;
  for (const w of w1) if (w2.has(w)) common++;
  // نقسم على الأصغر عشان الوصف القصير ما يتظلم
  return Math.min(1, common / Math.min(w1.size, w2.size));
}

// ===== الدالة الرئيسية =====
// ترجع { score, breakdown } — score من 0 إلى 100
export function calculateSimilarity(reportA, reportB) {
  // نرتبهم: مين المفقود ومين الموجود
  const lost = reportA.type === "lost" ? reportA : reportB;
  const found = reportA.type === "lost" ? reportB : reportA;

  const parts = {
    category: categoryScore(lost, found),
    color: colorSimilarity(lost.color, found.color),
    brand: brandScore(lost, found),
    location: locationScore(lost, found),
    date: dateScore(lost, found),
    keywords: keywordsScore(lost, found)
  };

  const breakdown = {};
  let score = 0;
  for (const key of Object.keys(WEIGHTS)) {
    const points = Math.round(parts[key] * WEIGHTS[key] * 10) / 10;
    breakdown[key] = points;
    score += points;
  }

  // لو التصنيف مختلف، صعب يكون نفس الغرض: نخفض النتيجة
  if (parts.category === 0) score = score * 0.6;

  return { score: Math.round(Math.min(100, score)), breakdown };
}

// هل ينفع نقارن هالبلاغين أصلاً؟
export function canBeMatched(a, b) {
  return (
    a.id !== b.id &&
    a.type !== b.type &&                       // واحد مفقود وواحد موجود
    ["lost", "found"].includes(a.type) &&
    ["lost", "found"].includes(b.type) &&
    a.status === "open" && b.status === "open" &&
    a.userId !== b.userId                      // مو نفس الشخص
  );
}

// يرجع قائمة التطابقات لبلاغ معيّن مرتبة من الأعلى
export function findMatches(report, allReports, minScore = MATCH_THRESHOLD) {
  return allReports
    .filter(other => canBeMatched(report, other))
    .map(other => {
      const { score, breakdown } = calculateSimilarity(report, other);
      return { report: other, score, breakdown };
    })
    .filter(m => m.score >= minScore)
    .sort((x, y) => y.score - x.score);
}
