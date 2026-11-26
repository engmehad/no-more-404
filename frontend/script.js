/* ==========================================================
   No More 404 — script.js (متصل بـ Firebase عبر مجلد backend/)
   يُستخدم في index.html و login.html — لازم يُحمَّل كـ type="module"
   ========================================================== */

import {
  monitorAuth,
  logout,
  registerWithEmail,
  loginWithEmail,
  getUserProfile
} from "./backend/auth.js";

import { getReports } from "./backend/database.js";

import { prepareImage } from "./backend/images.js";

import { getMyClaims } from "./backend/claims.js";

import { searchReports } from "./backend/search.js";

import {
  addReportAndMatch,
  checkMatchesForMyReports,
  getMyNotificationsDetailed,
  getUnreadCount,
  markAllAsRead,
  getMatchesForReport
} from "./backend/matching.js";

import {
  requestItem,
  getClaimsToReview,
  respondToClaim
} from "./backend/claimsFlow.js";


const arErr = (e) => ({
  'auth/invalid-credential': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  'auth/invalid-email': 'البريد الإلكتروني غير صحيح.',
  'auth/email-already-in-use': 'هذا البريد مسجّل مسبقاً، جرّب تسجيل الدخول.',
  'auth/weak-password': 'كلمة المرور ضعيفة (6 أحرف على الأقل).',
  'auth/too-many-requests': 'محاولات كثيرة، حاول لاحقاً.',
  'auth/network-request-failed': 'تعذّر الاتصال بالإنترنت.',
}[e && e.code] || 'حدث خطأ، حاول مرة أخرى.');

const Auth = {
  user: null,
  profile: null,
  currentUser() {
    const u = this.user;
    return u && {
      uid: u.uid,
      name: u.displayName || u.email,
      email: u.email,
      phone: (this.profile && this.profile.phone) || '',
    };
  },
  async signup({ name, email, phone, password }) {
    try { await registerWithEmail(name.trim(), email.trim(), password, (phone || '').trim()); return { ok: true }; }
    catch (e) { console.error(e); return { ok: false, error: arErr(e) }; }
  },
  async login(email, password) {
    try { await loginWithEmail(email.trim(), password); return { ok: true }; }
    catch (e) { console.error(e); return { ok: false, error: arErr(e) }; }
  },
  logout,
};
// ننتظر Firebase يحدد إن كان فيه مستخدم مسجّل قبل ما نكمل
Auth.user = await new Promise(res => {
  let off = null, done = false;
  off = monitorAuth(u => { if (done) return; done = true; res(u); if (off) off(); });
  if (done && off) off();
});
if (Auth.user) { try { Auth.profile = await getUserProfile(Auth.user.uid); } catch (e) { console.error(e); } }

/* ---------- Login page logic ---------- */
(function authPage() {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  if (!loginForm || !signupForm) return;

  const params = new URLSearchParams(location.search);
  const NEXT = { home: 'index.html#home', browse: 'index.html#browse', add: 'index.html#add', about: 'index.html#about' };
  const goNext = () => { location.href = NEXT[params.get('next')] || 'index.html'; };

  if (Auth.currentUser()) { goNext(); return; }

  const tabs = [...document.querySelectorAll('.tab[data-mode]')];
  function setMode(mode) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
    loginForm.hidden = mode !== 'login';
    signupForm.hidden = mode !== 'signup';
    document.getElementById('authTitle').textContent = mode === 'login' ? 'أهلاً بعودتك 👋' : 'أنشئ حسابك';
    document.getElementById('authSub').textContent = mode === 'login'
      ? 'سجّل دخولك لنشر البلاغات ومتابعتها.'
      : 'ثوانٍ قليلة وتبدأ بالإبلاغ عن أغراضك وتتبعها.';
    history.replaceState(null, '', '?mode=' + mode + (params.get('next') ? '&next=' + params.get('next') : ''));
  }
  tabs.forEach(t => t.addEventListener('click', () => setMode(t.dataset.mode)));
  document.querySelectorAll('[data-switch]').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); setMode(a.dataset.switch); }));
  setMode(params.get('mode') === 'signup' ? 'signup' : 'login');

  // show / hide password
  document.querySelectorAll('.pw__toggle').forEach(btn => btn.addEventListener('click', () => {
    const input = btn.parentElement.querySelector('input');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.textContent = show ? 'إخفاء' : 'إظهار';
  }));

  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
  function fail(form, msg, ...fields) {
    const err = form.querySelector('.form__error');
    err.textContent = msg; err.hidden = false;
    form.querySelectorAll('.field').forEach(f => f.classList.remove('invalid'));
    fields.forEach(f => f && f.closest('.field').classList.add('invalid'));
    if (fields[0]) fields[0].focus();
  }
  function busy(form, on, label) {
    const b = form.querySelector('button[type="submit"]');
    b.disabled = on; b.textContent = on ? 'لحظة…' : label;
  }
  form: {
    [loginForm, signupForm].forEach(f => f.addEventListener('input', () => {
      f.querySelector('.form__error').hidden = true;
      f.querySelectorAll('.field').forEach(x => x.classList.remove('invalid'));
    }));
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = loginForm;
    if (!emailOk(f.email.value)) return fail(f, 'أدخل بريداً إلكترونياً صحيحاً.', f.email);
    if (!f.password.value) return fail(f, 'أدخل كلمة المرور.', f.password);
    busy(f, true);
    const res = await Auth.login(f.email.value, f.password.value);
    if (!res.ok) { busy(f, false, 'تسجيل الدخول'); return fail(f, res.error, f.email, f.password); }
    goNext();
  });

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = signupForm;
    if (f.name.value.trim().length < 2) return fail(f, 'أدخل اسمك (حرفان على الأقل).', f.name);
    if (!emailOk(f.email.value)) return fail(f, 'أدخل بريداً إلكترونياً صحيحاً.', f.email);
    if (f.phone.value.trim() && !/^[+\d\s-]{7,16}$/.test(f.phone.value.trim())) return fail(f, 'رقم الجوال غير صحيح.', f.phone);
    if (f.password.value.length < 6) return fail(f, 'كلمة المرور يجب ألا تقل عن 6 أحرف.', f.password);
    if (f.password.value !== f.confirm.value) return fail(f, 'كلمتا المرور غير متطابقتين.', f.confirm);
    busy(f, true);
    const res = await Auth.signup({ name: f.name.value, email: f.email.value, phone: f.phone.value, password: f.password.value });
    if (!res.ok) { busy(f, false, 'إنشاء الحساب'); return fail(f, res.error, f.email); }
    goNext();
  });
})();


/* ==========================================================
   Main page (index.html) — runs only when the items grid exists
   ========================================================== */
(async function mainPage() {
if (!document.getElementById("itemsGrid")) return;

/* ==========================================================
   No More 404 — Application Logic
   (Auth module is defined at the top of this file)
   ========================================================== */

/* ---------- Config & Data ---------- */
const CATEGORIES = [
  { id: 'electronics', name: 'إلكترونيات',   icon: '📱', color: '#2E90FA' },
  { id: 'bags',        name: 'حقائب',        icon: '🎒', color: '#F79009' },
  { id: 'books',       name: 'كتب',          icon: '📚', color: '#7A5AF8' },
  { id: 'keys',        name: 'مفاتيح',       icon: '🔑', color: '#12B76A' },
  { id: 'cards',       name: 'بطاقات شخصية', icon: '🪪', color: '#EE46BC' },
  { id: 'other',       name: 'أخرى',         icon: '📦', color: '#667085' },
];

const STATUS_LABEL = { lost: 'مفقود', found: 'معثور عليه' };
const TRACK_STEPS = ['قيد المراجعة', 'قيد التنفيذ', 'تم الحل'];

const ICONS = {
  pin:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-6.200 7-12a7 7 0 1 0-14 0c0 5.800 7 12 7 12z"/><circle cx="12" cy="10" r="2.500"/></svg>',
  cal:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 11h18"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
};

/* ---------- State ---------- */
let user = Auth.currentUser();

// ترجمة شكل البلاغ في قاعدة البيانات إلى شكل الواجهة
const fromDb = (r) => {
  const d = r.date || '';
  return {
    id: r.id, owner: r.userId, dbStatus: r.status,
    status: r.type === 'found' ? 'found' : 'lost',
    title: r.title || '', category: r.category || 'other',
    place: r.location || '', desc: r.description || '', image: r.imageUrl || '',
    color: r.color || '', brand: r.brand || '',
    date: d.slice(0, 10) || new Date().toISOString().slice(0, 10),
    time: d.slice(11, 16) || '00:00',
    contact: { name: r.contactName || '—', email: r.contactEmail || '—', phone: r.contactPhone || '' },
  };
};

let items = [];
let loadFailed = false;
try { items = (await getReports()).map(fromDb); }
catch (ex) { console.error(ex); loadFailed = true; }

let tracked = [];
const state = { query: '', status: 'all', category: 'all' };

// بلاغاتي + طلبات الاسترجاع الخاصة بي (للتتبع في نافذة الحساب)
async function loadTracked() {
  if (!user) { tracked = []; return; }
  const stageOf = { open: 0, pending: 1, resolved: 2 };
  const mine = items.filter(i => i.owner === user.uid).map(i => ({
    ref: String(i.id).slice(0, 6).toUpperCase(), title: i.title,
    type: i.status === 'lost' ? 'بلاغ فقدان' : 'بلاغ عثور', stage: stageOf[i.dbStatus] ?? 0,
  }));
  let claims = [];
  try {
    claims = (await getMyClaims()).filter(c => c.status !== 'rejected').map(c => ({
      ref: String(c.id).slice(0, 6).toUpperCase(),
      title: 'طلب استرجاع: ' + ((items.find(i => i.id === c.reportId) || {}).title || ''),
      type: 'طلب استرجاع', stage: c.status === 'approved' ? 2 : 0,
    }));
  } catch (ex) { console.error(ex); }
  tracked = [...claims, ...mine];
}

// إعادة تحميل البلاغات من قاعدة البيانات (بعد قبول/رفض طلب مثلاً)
async function reloadItems() {
  items = (await getReports()).map(fromDb);
  renderStats(); renderCategories(); buildGrid();
}

/* ---------- Utilities ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const catOf = (id) => CATEGORIES.find(c => c.id === id) || CATEGORIES[5];
const esc = (s) => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const normalize = (s) => String(s).toLowerCase()
  .replace(/[\u064B-\u065F\u0670]/g, '')
  .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();

function formatDay(iso) {
  const d = new Date(iso + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - d) / 86400000);
  const base = d.toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long' });
  if (diff === 0) return 'اليوم – ' + base;
  if (diff === 1) return 'أمس – ' + base;
  return base;
}
function formatTime(t) {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'م' : 'ص'}`;
}

function placeholderImage(item) {
  const c = catOf(item.category);
  const tint = item.status === 'lost' ? '#FEF3F2' : '#ECFDF3';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${tint}"/><stop offset="1" stop-color="#E4E9F0"/></linearGradient></defs>
    <rect width="400" height="300" fill="url(#g)"/>
    <g stroke="#fff" stroke-width="2" opacity=".8"><path d="M0 100H400M0 200H400M100 0V300M200 0V300M300 0V300"/></g>
    <path d="M20 250 C 100 180, 160 270, 230 190 S 340 140, 390 80" fill="none" stroke="${c.color}" stroke-opacity=".35" stroke-width="4" stroke-dasharray="2 12" stroke-linecap="round"/>
    <circle cx="200" cy="150" r="64" fill="#fff" opacity=".9"/>
    <text x="200" y="175" font-size="72" text-anchor="middle">${c.icon}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
const imgOf = (item) => item.image || placeholderImage(item);

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

/* ---------- Rendering ---------- */
function renderCategories() {
  $('#categories').innerHTML = CATEGORIES.map(c => {
    const n = items.filter(i => i.category === c.id).length;
    return `<button class="cat ${state.category === c.id ? 'active' : ''}" data-cat="${c.id}" aria-pressed="${state.category === c.id}">
      <span class="cat__icon">${c.icon}</span>
      <span class="cat__name">${c.name}</span>
      <span class="cat__count">${n} بلاغ</span>
    </button>`;
  }).join('');
}

function itemCard(item, delay) {
  const cat = catOf(item.category);
  const anim = delay == null ? '' : ` pop" style="animation-delay:${delay}ms`;
  return `<article class="item${anim}" data-id="${item.id}">
    <div class="item__img">
      <img src="${imgOf(item)}" alt="${esc(item.title)}" loading="lazy">
      <span class="badge badge--${item.status}">${STATUS_LABEL[item.status]}</span>
    </div>
    <div class="item__body">
      <h4 class="item__title">${esc(item.title)}</h4>
      <span class="item__cat">${cat.icon} ${cat.name}</span>
      <div class="meta">
        <div class="meta__row"><span class="meta__ico">${ICONS.pin}</span>${esc(item.place)}</div>
        <div class="meta__row"><span class="meta__ico">${ICONS.cal}</span>${formatDay(item.date)}</div>
        <div class="meta__row"><span class="meta__ico">${ICONS.clock}</span>${formatTime(item.time)}</div>
      </div>
      <button class="btn btn--primary" data-details="${item.id}">عرض التفاصيل</button>
    </div>
  </article>`;
}

// Build all cards once. Filtering only shows/hides them (no re-render, no flicker).
function buildGrid({ newId = null, stagger = false } = {}) {
  updateSearch();
  const sorted = [...items].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  $('#itemsGrid').innerHTML = sorted.map((it, i) =>
    itemCard(it, stagger ? Math.min(i, 8) * 60 : (it.id === newId ? 0 : null))).join('');
  applyFilters();
}

// البحث بالكلمات يستخدم search.js (يفهم الأحرف العربية المتشابهة والألوان والماركة)
let searchIds = null; // null = ما فيه كلمة بحث
const toSearchable = (i) => ({
  id: i.id, title: i.title, description: i.desc, category: catOf(i.category).name,
  color: i.color, brand: i.brand, location: i.place,
});
function updateSearch() {
  const q = state.query.trim();
  searchIds = q ? new Set(searchReports(items.map(toSearchable), q).map(r => r.id)) : null;
}

function matches(item) {
  return (state.status === 'all' || item.status === state.status)
    && (state.category === 'all' || item.category === state.category)
    && (!searchIds || searchIds.has(item.id));
}

function applyFilters() {
  let visible = 0;
  $$('#itemsGrid .item').forEach(card => {
    const item = items.find(i => i.id === card.dataset.id);
    const show = item && matches(item);
    const wasHidden = card.classList.contains('is-hidden');
    card.classList.toggle('is-hidden', !show);
    if (show) {
      visible++;
      if (wasHidden) { card.classList.remove('pop'); card.style.animationDelay = ''; void card.offsetWidth; card.classList.add('pop'); }
    }
  });
  $('#emptyState').hidden = visible > 0;
  $('#resultCount').textContent = visible ? `${visible} نتيجة` : '';
}
$('#itemsGrid').addEventListener('animationend', (e) => { if (e.target.classList.contains('item')) e.target.classList.remove('pop'); });

function renderStats() {
  $('#statTotal').textContent = items.length;
  $('#statLost').textContent  = items.filter(i => i.status === 'lost').length;
  $('#statFound').textContent = items.filter(i => i.status === 'found').length;
}

/* ---------- Search & Filters ---------- */
$('#searchInput').addEventListener('input', (e) => { state.query = e.target.value; updateSearch(); applyFilters(); });

$$('.filters .chip').forEach(chip => chip.addEventListener('click', () => {
  $$('.filters .chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  state.status = chip.dataset.status;
  applyFilters();
}));

$('#categories').addEventListener('click', (e) => {
  const btn = e.target.closest('.cat'); if (!btn) return;
  state.category = state.category === btn.dataset.cat ? 'all' : btn.dataset.cat;
  $$('#categories .cat').forEach(c => {
    const on = c.dataset.cat === state.category;
    c.classList.toggle('active', on); c.setAttribute('aria-pressed', on);
  });
  applyFilters();
});

$('#resetFilters').addEventListener('click', () => {
  state.query = ''; state.status = 'all'; state.category = 'all';
  $('#searchInput').value = '';
  $$('.filters .chip').forEach(c => c.classList.toggle('active', c.dataset.status === 'all'));
  $$('#categories .cat').forEach(c => { c.classList.remove('active'); c.setAttribute('aria-pressed', 'false'); });
  updateSearch();
  applyFilters();
});

/* ---------- Modals ---------- */
function openModal(id) {
  const m = $('#' + id);
  m.classList.add('open'); m.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
}
function closeModals() {
  $$('.modal.open').forEach(m => { m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); });
  document.body.classList.remove('no-scroll');
}
$$('.modal').forEach(m => m.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModals(); }));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });

const CLAIM_ERR = {
  'Please log in first.': 'سجّل دخولك أولاً.',
  'Enter verification details.': 'اكتب تفاصيل تثبت ملكيتك للغرض.',
  'Report not found.': 'البلاغ غير موجود.',
  'This item is not available.': 'هذا الغرض غير متاح للاسترجاع.',
  'You cannot claim your own item.': 'لا يمكنك تقديم طلب على بلاغك أنت.',
};

const lockCard = (text) => `
  <div class="lock">
    <div class="lock__ico">🔒</div>
    <p>${text}</p>
    <div class="lock__btns">
      <a class="btn btn--primary" href="login.html?mode=login&next=browse">تسجيل الدخول</a>
      <a class="btn btn--outline" href="login.html?mode=signup&next=browse">إنشاء حساب</a>
    </div>
  </div>`;

/* Item details modal */
$('#itemsGrid').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-details]'); if (!btn) return;
  showItem(btn.dataset.details);
});

function showItem(id) {
  const item = items.find(i => i.id === id); if (!item) return;
  const isLost = item.status === 'lost';
  const mine = !!user && item.owner === user.uid;
  const canClaim = !isLost && !mine; // طلب الاسترجاع لبلاغات «معثور عليه» من غير صاحبها
  const body = $('#itemModalBody');

  const contactPanel = user ? `
    <div class="contact-card">
      <div class="contact-line"><span>👤</span><div><small>صاحب البلاغ</small><b>${esc(item.contact.name)}</b></div></div>
      <div class="contact-line"><span>✉️</span><div><small>البريد الإلكتروني</small><b dir="ltr">${esc(item.contact.email)}</b></div></div>
      ${item.contact.phone ? `<div class="contact-line"><span>📞</span><div><small>الجوال</small><b dir="ltr">${esc(item.contact.phone)}</b></div></div>` : ''}
    </div>` : lockCard('سجّل دخولك لعرض بيانات التواصل مع صاحب البلاغ.');

  const claimPanel = user ? `
    <form id="claimForm" novalidate>
      <label class="field"><span>${isLost ? 'أين وجدته؟' : 'صف الغرض لإثبات ملكيتك'} *</span>
        <textarea name="proof" rows="3" required placeholder="${isLost ? 'اذكر المكان والوقت الذي وجدت فيه الغرض' : 'مثال: لون الغطاء، محتويات داخلية، علامات مميزة…'}"></textarea></label>
      <label class="field"><span>رقم جوال للتواصل *</span>
        <input type="tel" name="phone" required dir="ltr" value="${esc(user.phone)}"></label>
      <p class="form__error" hidden></p>
      <button type="submit" class="btn btn--primary btn--block">إرسال الطلب</button>
    </form>` : lockCard('سجّل دخولك لتقديم طلب استرجاع.');

  body.innerHTML = `
    <div class="modal__cover"><img src="${imgOf(item)}" alt="${esc(item.title)}"></div>
    <span class="badge badge--${item.status}">${STATUS_LABEL[item.status]}</span>
    <h3 class="modal__title" id="itemModalTitle">${esc(item.title)}</h3>
    <p class="modal__desc">${esc(item.desc || 'لا يوجد وصف إضافي.')}</p>
    ${(item.color || item.brand) ? `<p class="modal__desc">${item.color ? 'اللون: ' + esc(item.color) : ''}${item.color && item.brand ? ' • ' : ''}${item.brand ? 'الماركة: ' + esc(item.brand) : ''}</p>` : ''}
    <div class="meta">
      <div class="meta__row"><span class="meta__ico">${ICONS.pin}</span>${esc(item.place)}</div>
      <div class="meta__row"><span class="meta__ico">${ICONS.cal}</span>${formatDay(item.date)}</div>
      <div class="meta__row"><span class="meta__ico">${ICONS.clock}</span>${formatTime(item.time)}</div>
    </div>
    ${(mine && item.dbStatus === 'open') ? '<div class="matches" id="matchBox"><h4>🔎 تطابقات محتملة</h4><p class="muted">جارٍ البحث…</p></div>' : ''}
    ${!canClaim ? '' : `<div class="tabs" role="tablist">
      <button class="tab active" data-tab="contact" role="tab">طريقة التواصل</button>
      <button class="tab" data-tab="claim" role="tab">قدّم طلب استرجاع</button>
    </div>`}
    <div class="panel active" data-panel="contact">${contactPanel}</div>
    ${!canClaim ? '' : `<div class="panel" data-panel="claim">${claimPanel}</div>`}`;

  $$('.tab', body).forEach(tab => tab.addEventListener('click', () => {
    $$('.tab', body).forEach(t => t.classList.toggle('active', t === tab));
    $$('.panel', body).forEach(p => p.classList.toggle('active', p.dataset.panel === tab.dataset.tab));
  }));

  const claim = $('#claimForm');
  if (claim) claim.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('.form__error', claim);
    if (!claim.proof.value.trim() || !claim.phone.value.trim()) { err.textContent = 'يرجى تعبئة جميع الحقول المطلوبة.'; err.hidden = false; return; }
    if (claim.proof.value.trim().length < 15) { err.textContent = 'اكتب تفاصيل أكثر تثبت أن الغرض لك (علامة مميزة أو شيء بداخله).'; err.hidden = false; return; }
    const sendBtn = claim.querySelector('button[type="submit"]');
    sendBtn.disabled = true;
    let claimId;
    try {
      claimId = await requestItem(item.id, claim.proof.value.trim() + '\nجوال للتواصل: ' + claim.phone.value.trim());
    } catch (ex) {
      err.textContent = CLAIM_ERR[ex.message] || (/[\u0600-\u06FF]/.test(ex.message) ? ex.message : 'تعذّر إرسال الطلب، حاول مرة أخرى.');
      err.hidden = false; sendBtn.disabled = false; return;
    }
    await loadTracked(); renderAvatar();
    const ref = String(claimId).slice(0, 6).toUpperCase();
    $('.panel[data-panel="claim"]', body).innerHTML = `
      <div class="success"><div class="success__ico">✓</div>
      <h4>تم إرسال طلبك بنجاح</h4>
      <p class="muted">رقم الطلب <b dir="ltr">${ref}</b> — يمكنك متابعته من أيقونة حسابك.</p></div>`;
  });

  // التطابقات المحتملة لبلاغي (من matching.js)
  const matchBox = $('#matchBox', body);
  if (matchBox) getMatchesForReport(item.id).then(list => {
    matchBox.innerHTML = '<h4>🔎 تطابقات محتملة</h4>' + (list.length
      ? list.map(m => `<button class="match" data-match="${esc(m.report.id)}">
          <span class="match__score">${m.score}%</span>
          <span class="match__info"><b>${esc(m.report.title)}</b><small>${m.report.type === 'found' ? 'معثور عليه' : 'مفقود'} • ${esc(m.report.location || '')}</small></span>
        </button>`).join('')
      : '<p class="muted">لا توجد تطابقات حالياً. سننبهك عند ظهور تطابق.</p>');
    $$('[data-match]', matchBox).forEach(b => b.addEventListener('click', () => {
      if (items.some(i => i.id === b.dataset.match)) showItem(b.dataset.match);
    }));
  }).catch(() => matchBox.remove());

  openModal('itemModal');
}

/* ---------- Account / Profile ---------- */
const initialOf = (name) => esc((name || '?').trim().charAt(0));

function renderAvatar() {
  const btn = $('#profileBtn');
  if (user) {
    btn.innerHTML = `<span class="avatar__letter">${initialOf(user.name)}</span>`;
    btn.title = user.name;
    btn.dataset.count = tracked.filter(t => t.stage < 2).length;
  } else {
    btn.title = 'تسجيل الدخول';
    btn.dataset.count = 0;
  }
}

function renderProfile(review = []) {
  const body = $('#profileBody');
  const rows = tracked.length ? tracked.map(t => {
    const pill = ['review', 'progress', 'solved'][t.stage];
    return `<div class="track ${t.stage === 2 ? 'track--solved' : ''}">
      <div class="track__top"><b>${esc(t.title)}</b><span class="pill pill--${pill}">${TRACK_STEPS[t.stage]}</span></div>
      <div class="track__ref">${t.type} • رقم <span dir="ltr">${t.ref}</span>${t.demo ? ' • <em class="demo-tag">مثال توضيحي</em>' : ''}</div>
      <div class="track__bar">${TRACK_STEPS.map((s, i) => `<div class="track__step ${i <= t.stage ? 'done' : ''}"><i></i>${s}</div>`).join('')}</div>
    </div>`;
  }).join('') : '<div class="tracker__empty">لا توجد بلاغات حتى الآن. أضف أول بلاغ من قسم «إضافة بلاغ».</div>';

  const reviewHtml = review.length ? `
    <h4 class="profile__sub">طلبات استرجاع تحتاج مراجعتك</h4>
    <div class="tracker">${review.map(c => `
      <div class="track">
        <div class="track__top"><b>${esc(c.report.title)}</b><span class="pill pill--review">طلب جديد</span></div>
        <p class="claim__text">${esc(c.verificationDetails)}</p>
        <div class="claim__btns">
          <button class="btn btn--primary" data-claim="${esc(c.id)}" data-decision="approved">قبول</button>
          <button class="btn btn--outline" data-claim="${esc(c.id)}" data-decision="rejected">رفض</button>
        </div>
      </div>`).join('')}</div>` : '';

  body.innerHTML = `
    <div class="profile__head">
      <div class="avatar avatar--lg"><span class="avatar__letter avatar__letter--lg">${initialOf(user.name)}</span></div>
      <div><h3 id="profileTitle">${esc(user.name)}</h3><span class="muted">طالب في المنصة</span></div>
    </div>
    <ul class="profile__info">
      <li><span>البريد الإلكتروني</span><b dir="ltr">${esc(user.email)}</b></li>
      <li><span>رقم الجوال</span><b dir="ltr">${user.phone ? esc(user.phone) : '—'}</b></li>
    </ul>
    ${reviewHtml}
    <h4 class="profile__sub">تتبع بلاغاتي النشطة</h4>
    <div class="tracker">${rows}</div>
    <button class="btn btn--outline btn--block logout" id="logoutBtn">تسجيل الخروج</button>`;

  $('#logoutBtn').addEventListener('click', () => { Auth.logout().then(() => location.reload()); });

  $$('[data-claim]', body).forEach(b => b.addEventListener('click', async () => {
    $$('[data-claim]', body).forEach(x => x.disabled = true);
    try {
      await respondToClaim(b.dataset.claim, b.dataset.decision);
      toast(b.dataset.decision === 'approved' ? 'تم قبول الطلب، تواصل مع صاحب الغرض لتسليمه ✅' : 'تم رفض الطلب');
      await reloadItems(); await loadTracked(); renderAvatar();
      renderProfile(await getClaimsToReview().catch(() => []));
    } catch (ex) {
      console.error(ex);
      toast(/[\u0600-\u06FF]/.test(ex.message) ? ex.message : 'تعذّر تنفيذ الإجراء، حاول مرة أخرى.');
      $$('[data-claim]', body).forEach(x => x.disabled = false);
    }
  }));
}

$('#profileBtn').addEventListener('click', async () => {
  if (user) { await loadTracked(); renderProfile(await getClaimsToReview().catch(() => [])); }
  else $('#profileBody').innerHTML = `
    <div class="lock lock--lg">
      <div class="lock__ico">👤</div>
      <h3 id="profileTitle">مرحباً بك في No More 404</h3>
      <p>سجّل دخولك أو أنشئ حساباً لنشر البلاغات ومتابعة حالتها.</p>
      <div class="lock__btns">
        <a class="btn btn--primary" href="login.html?mode=login&next=home">تسجيل الدخول</a>
        <a class="btn btn--outline" href="login.html?mode=signup&next=home">إنشاء حساب</a>
      </div>
    </div>`;
  openModal('profileModal');
});

/* ---------- Add Report Form ---------- */
(function initForm() {
  $('#formCategory').innerHTML = '<option value="" disabled selected>اختر التصنيف</option>' +
    CATEGORIES.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  const now = new Date();
  $('#formDate').value = now.toISOString().slice(0, 10);
  $('#formDate').max = now.toISOString().slice(0, 10);
  $('#formTime').value = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  $('#authNotice').hidden = !!user;
})();

// حقول اللون والماركة + تنبيه «لا تذكر كل التفاصيل» (تُضاف تلقائياً للنموذج)
(function enhanceForm() {
  const form = $('#reportForm');
  const grid = $('.form__grid', form);
  const full = $('.field--full', grid);
  if (grid && full && !$('[name="color"]', grid)) {
    full.insertAdjacentHTML('beforebegin',
      '<label class="field"><span>اللون</span><input type="text" name="color" maxlength="30" placeholder="مثال: أسود"></label>' +
      '<label class="field"><span>الماركة (اختياري)</span><input type="text" name="brand" maxlength="30" placeholder="مثال: آبل"></label>');
  }
  const seg = $('.seg', form);
  if (seg && !$('.form-hint', form)) {
    const hint = document.createElement('p');
    hint.className = 'form-hint'; hint.hidden = true;
    hint.textContent = '💡 لا تذكر كل التفاصيل في الوصف، خلّ شيئاً مميزاً (علامة، أو شيء داخل الغرض) تتحقق به من صاحبه.';
    seg.after(hint);
    $$('input[name="status"]', form).forEach(r => r.addEventListener('change', () => {
      hint.hidden = form.status.value !== 'found';
    }));
  }
})();

let uploadedImage = null;
let imageJob = null;
$('#formImage').addEventListener('change', (e) => {
  const file = e.target.files[0];
  uploadedImage = null; imageJob = null;
  if (!file) return;
  // prepareImage يتحقق من النوع ويصغّر الصورة تلقائياً
  imageJob = prepareImage(file).then(r => { uploadedImage = r; }).catch(() => {
    toast('تعذّر استخدام الصورة، اختر صورة JPG أو PNG أو WEBP أصغر حجماً.');
    e.target.value = '';
  });
});

$('#reportForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!user) { toast('سجّل دخولك أولاً لنشر البلاغ'); $('#authNotice').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  const f = e.target, err = $('#formError');
  let valid = true;
  ['title', 'category', 'place', 'date', 'time'].forEach(name => {
    const bad = !String(f[name].value).trim();
    f[name].closest('.field').classList.toggle('invalid', bad);
    if (bad) valid = false;
  });
  if (!valid) { err.textContent = 'يرجى تعبئة جميع الحقول المطلوبة (*).'; err.hidden = false; return; }
  err.hidden = true;

  const submitBtn = f.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  let newItem, matchCount = 0;
  try {
    if (imageJob) await imageJob;
    const data = {
      type: f.status.value, title: f.title.value.trim(), category: f.category.value,
      description: f.desc.value.trim(), location: f.place.value.trim(),
      date: `${f.date.value}T${f.time.value}`,
      imageUrl: uploadedImage || '',
      color: f.color ? f.color.value.trim() : '', brand: f.brand ? f.brand.value.trim() : '',
      contactName: user.name, contactEmail: user.email, contactPhone: user.phone,
    };
    // ينشر البلاغ ويبحث عن تطابقات مباشرة (matching.js)
    const res = await addReportAndMatch(data);
    const id = res.reportId; matchCount = res.matches.length;
    newItem = fromDb({ ...data, id, userId: user.uid, status: 'open' });
    items.unshift(newItem);
    await loadTracked();
  } catch (ex) {
    console.error(ex);
    toast('تعذّر نشر البلاغ، تأكد من الاتصال وقواعد Firestore.');
    return;
  } finally { submitBtn.disabled = false; }

  f.reset(); uploadedImage = null; imageJob = null; f.status.value = 'lost';
  const fh = $('.form-hint', f); if (fh) fh.hidden = true;
  $('#formDate').value = new Date().toISOString().slice(0, 10);
  state.query = ''; state.status = 'all'; state.category = 'all';
  $('#searchInput').value = '';
  $$('.filters .chip').forEach(c => c.classList.toggle('active', c.dataset.status === 'all'));
  renderStats(); renderCategories(); buildGrid({ newId: newItem.id }); renderAvatar();
  toast(matchCount ? `تم النشر ✓ ولقينا ${matchCount} تطابق محتمل 🎯` : 'تم نشر البلاغ بنجاح ✓');
  refreshBell();
  $('#browse').scrollIntoView({ behavior: 'smooth' });
});
$$('#reportForm input, #reportForm select').forEach(el => el.addEventListener('input', () => el.closest('.field')?.classList.remove('invalid')));

/* ---------- Notifications (الجرس) ---------- */
let bellBtn = null;
function setupBell() {
  if (!user) return;
  bellBtn = $('#bellBtn');
  if (!bellBtn) {
    bellBtn = document.createElement('button');
    bellBtn.id = 'bellBtn'; bellBtn.className = 'bell';
    bellBtn.setAttribute('aria-label', 'الإشعارات'); bellBtn.title = 'الإشعارات';
    bellBtn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>';
    $('.navbar__actions').prepend(bellBtn);
  }
  if (!$('#notifModal')) {
    const m = document.createElement('div');
    m.className = 'modal'; m.id = 'notifModal'; m.setAttribute('aria-hidden', 'true');
    m.innerHTML = '<div class="modal__backdrop" data-close></div><div class="modal__dialog" role="dialog" aria-modal="true" aria-labelledby="notifTitle"><button class="modal__close" data-close aria-label="إغلاق">×</button><div class="modal__body" id="notifBody"></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModals(); });
  }
  $('#notifBody').addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]'); if (!b) return;
    if (items.some(i => i.id === b.dataset.open)) { closeModals(); showItem(b.dataset.open); }
  });
  bellBtn.addEventListener('click', openNotifications);
}

// يفحص تطابقات بلاغاتي ويحدّث الرقم فوق الجرس
async function refreshBell() {
  if (!user || !bellBtn) return;
  try {
    await checkMatchesForMyReports();
    bellBtn.dataset.count = await getUnreadCount();
  } catch (ex) { console.error(ex); }
}

async function openNotifications() {
  const body = $('#notifBody');
  body.innerHTML = '<h3 id="notifTitle">الإشعارات</h3><p class="muted">جارٍ التحميل…</p>';
  openModal('notifModal');
  let list;
  try { list = await getMyNotificationsDetailed(); }
  catch (ex) {
    console.error(ex);
    body.innerHTML = '<h3 id="notifTitle">الإشعارات</h3><div class="tracker__empty">تعذّر تحميل الإشعارات.</div>';
    return;
  }
  body.innerHTML = '<h3 id="notifTitle">الإشعارات</h3>' + (list.length
    ? `<div class="notifs">${list.map(n => `
        <button class="notif ${n.isRead ? '' : 'notif--new'}" data-open="${esc(n.matchedReportId)}">
          <span class="notif__score">${n.matchScore}%</span>
          <span class="notif__txt">
            <b>تطابق محتمل مع بلاغك «${esc(n.myReport.title)}»</b>
            <small>${n.matchedReport.type === 'found' ? 'معثور عليه' : 'مفقود'}: ${esc(n.matchedReport.title)} • ${esc(n.matchedReport.location || '')}</small>
          </span>
        </button>`).join('')}</div>`
    : '<div class="tracker__empty">لا توجد إشعارات حتى الآن. سننبهك عند ظهور تطابق مع بلاغاتك.</div>');
  try { await markAllAsRead(); bellBtn.dataset.count = 0; } catch (ex) { console.error(ex); }
}

/* ---------- Navigation ---------- */
const navLinks = $$('.nav__link');
const sections = navLinks.map(l => document.querySelector(l.getAttribute('href')));
const setActive = (hash) => navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === hash));

$$('[data-nav]').forEach(a => a.addEventListener('click', (e) => {
  const hash = a.getAttribute('href');
  const target = document.querySelector(hash);
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: 'smooth' });
  setActive(hash);
  $('#nav').classList.remove('open');
  $('#menuToggle').setAttribute('aria-expanded', 'false');
}));

function onScroll() {
  $('#navbar').classList.toggle('scrolled', window.scrollY > 10);
  const y = window.scrollY + 140;
  let current = sections[0];
  sections.forEach(s => { if (s.offsetTop <= y) current = s; });
  if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) current = sections[sections.length - 1];
  setActive('#' + current.id);
}
window.addEventListener('scroll', onScroll, { passive: true });

$('#menuToggle').addEventListener('click', () => {
  const open = $('#nav').classList.toggle('open');
  $('#menuToggle').setAttribute('aria-expanded', open);
});

/* ---------- Init ---------- */
$('#year').textContent = new Date().getFullYear();
renderStats();
renderCategories();
buildGrid({ stagger: true });
await loadTracked();
renderAvatar();
onScroll();
setupBell();
refreshBell(); // بدون await عشان ما نعطّل ظهور الصفحة
if (loadFailed) toast('تعذّر تحميل البلاغات من قاعدة البيانات، راجع الإعدادات.');

})();