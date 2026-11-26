// ===============================================
// textUtils.js
// أدوات تنظيف النص العربي والإنجليزي
// (بدون Firebase — دوال نقية تُستخدم في البحث والمطابقة)
// ===============================================

// كلمات شائعة ما لها قيمة في البحث أو المطابقة
const STOP_WORDS = new Set([
  "في", "من", "على", "الى", "عن", "مع", "او", "و", "ثم", "هذا", "هذه",
  "ذلك", "تلك", "التي", "الذي", "كان", "كانت", "فيه", "فيها", "عند",
  "لون", "لونه", "لونها", "تقريبا", "جدا", "حق", "مال", "فيها", "بها", "به",
  "the", "a", "an", "and", "or", "of", "in", "on", "at", "with", "is", "it",
  "my", "to", "for", "near"
]);

// توحيد النص: حروف صغيرة، إزالة التشكيل، توحيد الألف والياء والتاء المربوطة
export function normalizeText(text) {
  if (!text) return "";
  return String(text)
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "") // التشكيل والتطويل
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")      // إزالة الرموز
    .replace(/\s+/g, " ")
    .trim();
}

// إزالة "ال" التعريف و"و" العطف من أول الكلمة
function stem(word) {
  let w = word;
  if (w.length > 4 && (w.startsWith("وال") || w.startsWith("بال") || w.startsWith("فال"))) {
    w = w.slice(3);
  } else if (w.length > 3 && w.startsWith("ال")) {
    w = w.slice(2);
  } else if (w.length > 3 && w.startsWith("و")) {
    w = w.slice(1);
  }
  return w;
}

// تقطيع النص إلى كلمات مفيدة
export function tokenize(text) {
  return normalizeText(text)
    .split(" ")
    .filter(w => w.length > 1 && !STOP_WORDS.has(w))
    .map(stem)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

// ===== الألوان =====
// كل لون (عربي/إنجليزي/مذكر/مؤنث) يتحول لاسم موحد
const COLOR_MAP = {
  black: ["اسود", "سوداء", "سودا", "black"],
  white: ["ابيض", "بيضاء", "بيضا", "white"],
  red: ["احمر", "حمراء", "حمرا", "red"],
  blue: ["ازرق", "زرقاء", "زرقا", "blue"],
  navy: ["كحلي", "كحليه", "navy"],
  green: ["اخضر", "خضراء", "خضرا", "green"],
  yellow: ["اصفر", "صفراء", "صفرا", "yellow"],
  brown: ["بني", "بنيه", "brown"],
  gray: ["رمادي", "رماديه", "gray", "grey"],
  silver: ["فضي", "فضيه", "silver"],
  gold: ["ذهبي", "ذهبيه", "gold", "golden"],
  pink: ["وردي", "ورديه", "زهري", "pink"],
  purple: ["بنفسجي", "بنفسجيه", "purple"],
  orange: ["برتقالي", "برتقاليه", "orange"],
  beige: ["بيج", "beige"]
};

// ألوان قريبة من بعض (تاخذ نص الدرجة)
const SIMILAR_COLORS = [
  ["blue", "navy"],
  ["gray", "silver"],
  ["gold", "yellow"],
  ["brown", "beige"],
  ["red", "pink"],
  ["purple", "pink"],
  ["orange", "yellow"],
  ["black", "navy"]
];

const COLOR_LOOKUP = {};
for (const [key, words] of Object.entries(COLOR_MAP)) {
  for (const w of words) COLOR_LOOKUP[normalizeText(w)] = key;
}

export function normalizeColor(color) {
  const n = normalizeText(color);
  if (!n) return "";
  if (COLOR_LOOKUP[n]) return COLOR_LOOKUP[n];
  // لو كتب "اسود لامع" نأخذ أول كلمة لون نعرفها
  for (const word of n.split(" ")) {
    if (COLOR_LOOKUP[word]) return COLOR_LOOKUP[word];
  }
  return n;
}

// 1 = نفس اللون ، 0.5 = لون قريب ، 0 = مختلف
export function colorSimilarity(a, b) {
  const c1 = normalizeColor(a);
  const c2 = normalizeColor(b);
  if (!c1 || !c2) return 0;
  if (c1 === c2) return 1;
  const close = SIMILAR_COLORS.some(
    ([x, y]) => (x === c1 && y === c2) || (x === c2 && y === c1)
  );
  return close ? 0.5 : 0;
}
