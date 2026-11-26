// ===============================================
// search.js
// البحث بالكلمات + التصفية حسب التصنيف والموقع والتاريخ
// ===============================================

import { normalizeText, tokenize, normalizeColor } from "./textUtils.js";

// النص اللي نبحث فيه لكل بلاغ
function searchableText(report) {
  return normalizeText([
    report.title,
    report.description,
    report.category,
    report.color,
    normalizeColor(report.color), // عشان "black" تلقى "أسود" والعكس
    report.brand,
    report.location
  ].join(" "));
}

// ===== البحث بالكلمات =====
// يرجع البلاغات اللي فيها كل كلمات البحث، مرتبة حسب الأهمية
export function searchReports(reports, keyword) {
  const words = tokenize(keyword);
  if (words.length === 0) return reports;

  const results = [];

  for (const report of reports) {
    const text = searchableText(report);
    const title = normalizeText(report.title);

    // لازم كل كلمة تكون موجودة (ولو جزء من كلمة)
    const allFound = words.every(w => text.includes(w) || text.includes(normalizeColor(w)));
    if (!allFound) continue;

    // الترتيب: الكلمة في العنوان أهم من الوصف
    let rank = 0;
    for (const w of words) {
      if (title.includes(w)) rank += 3;
      else rank += 1;
    }
    results.push({ report, rank });
  }

  return results
    .sort((a, b) => b.rank - a.rank)
    .map(r => r.report);
}

// ===== التصفية =====
// filters = { type, category, location, dateFrom, dateTo, status }
// أي فلتر فاضي يتجاهل
export function filterReports(reports, filters = {}) {
  const {
    type = "",
    category = "",
    location = "",
    dateFrom = "",
    dateTo = "",
    status = ""
  } = filters;

  const from = dateFrom ? new Date(dateFrom).getTime() : null;
  const to = dateTo ? new Date(dateTo).getTime() : null;
  const loc = normalizeText(location);
  const cat = normalizeText(category);

  return reports.filter(r => {
    if (type && r.type !== type) return false;
    if (status && r.status !== status) return false;
    if (cat && normalizeText(r.category) !== cat) return false;
    if (loc && !normalizeText(r.location).includes(loc)) return false;

    if (from !== null || to !== null) {
      const d = new Date(r.date).getTime();
      if (Number.isNaN(d)) return false;
      if (from !== null && d < from) return false;
      if (to !== null && d > to) return false;
    }
    return true;
  });
}

// ===== ترتيب النتائج =====
// sortBy: "newest" | "oldest"
export function sortReports(reports, sortBy = "newest") {
  const copy = [...reports];
  copy.sort((a, b) => {
    const diff = new Date(b.date) - new Date(a.date);
    return sortBy === "oldest" ? -diff : diff;
  });
  return copy;
}

// ===== كل شي مع بعض =====
// هذي الدالة اللي تستدعيها صفحة البحث
export function searchAndFilter(reports, keyword = "", filters = {}, sortBy = "newest") {
  const filtered = filterReports(reports, filters);
  const searched = searchReports(filtered, keyword);
  // لو فيه كلمة بحث نخلي ترتيب الأهمية، غير كذا نرتب بالتاريخ
  return keyword.trim() ? searched : sortReports(searched, sortBy);
}

// قائمة التصنيفات والمواقع الموجودة (للقوائم المنسدلة في الفلاتر)
export function getFilterOptions(reports) {
  const categories = new Set();
  const locations = new Set();
  for (const r of reports) {
    if (r.category) categories.add(r.category.trim());
    if (r.location) locations.add(r.location.trim());
  }
  return {
    categories: [...categories].sort(),
    locations: [...locations].sort()
  };
}
