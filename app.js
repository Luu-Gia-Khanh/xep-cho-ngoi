/* ===== Lớp Mình Xinh — Xếp chỗ ngồi ===== */
(() => {
'use strict';

/* ---------------- Utils ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const hash = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
const clone = o => JSON.parse(JSON.stringify(o));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FRAME = 1000 / 60;

const STORE_KEY = 'lop-minh-xinh.v1';
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const H2C_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
const LEVEL_SHORT = { G: 'Giỏi', K: 'Khá', T: 'TB', Y: 'Yếu' };
const LV_NUM = { G: 3, K: 2, T: 1, Y: 0 };

/* ---------------- Data ---------------- */
const DEMO = ['Nguyễn Minh Anh|F', 'Trần Gia Bảo|M', 'Lê Ngọc Châu|F', 'Phạm Đức Duy|M', 'Hoàng Thu Hà|F', 'Vũ Quang Huy|M',
  'Đặng Khánh Linh|F', 'Bùi Tuấn Kiệt|M', 'Đỗ Phương Mai|F', 'Ngô Hoàng Nam|M', 'Dương Bảo Ngọc|F', 'Lý Minh Khôi|M',
  'Phan Thảo Nhi|F', 'Trịnh Gia Phúc|M', 'Võ Hà My|F', 'Hồ Anh Quân|M', 'Mai Diệu Linh|F', 'Tạ Đăng Khoa|M',
  'Cao Thanh Trúc|F', 'Lâm Nhật Minh|M', 'Chu Bảo Trâm|F', 'Đinh Hữu Thắng|M', 'Kiều Ngân Vy|F', 'Quách Tiến Đạt|M'];

function newClass(name) {
  return { id: uid(), name, students: [], layout: { rows: 5, cols: 4, spd: 2, disabled: [] }, seats: {}, locked: [], saved: [], photos: {} };
}
// Photos live in class.photos (id → small JPEG data URL), outside students, so undo snapshots stay light.
const okPhoto = p => typeof p === 'string' && p.length < 400000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p);
// Photos are validated when they enter the app (load / upload / share), so rendering only looks them up.
const photoOf = (s, c = cls()) => (c.photos && c.photos[s.id]) || '';
// Short blob: URLs instead of long data: URLs keep re-renders cheap and hit the decoded-image cache.
const photoUrls = new Map();
function photoSrc(p) {
  let u = photoUrls.get(p);
  if (!u) {
    try {
      const comma = p.indexOf(','), bin = atob(p.slice(comma + 1)), arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      u = URL.createObjectURL(new Blob([arr], { type: p.slice(5, p.indexOf(';')) }));
    } catch (e) { u = p; }
    photoUrls.set(p, u);
  }
  return u;
}
function avaHTML(s, photo, extra = '') {
  return photo ? `<span class="ava photo ${extra}" style="background-image:url(${photoSrc(photo)})"></span>` : `<span class="ava ${extra}">${esc(initial(s))}</span>`;
}
function resizePhoto(file, size = 144) {
  return new Promise((res, rej) => {
    if (!/^image\//.test(file.type || 'image/')) return rej(new Error('type'));
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      const cv = document.createElement('canvas'); cv.width = cv.height = size;
      const g = cv.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
      // faces sit in the upper part of portrait photos, so crop a little above centre
      g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) * .3, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      res(cv.toDataURL('image/jpeg', .8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')); };
    img.src = url;
  });
}
function mkStudent(o) {
  return { id: uid(), name: String(o.name || '').trim(), gender: o.gender || '', level: o.level || '', height: o.height || '',
    priority: !!o.priority, note: o.note || '', avoid: o.avoid || [] };
}
function demoClass() {
  const c = newClass('Lớp 3A (mẫu)');
  const lv = ['G', 'K', 'K', 'T', 'G', 'T', 'K', 'Y'];
  c.students = DEMO.map((t, i) => {
    const [name, gender] = t.split('|');
    return mkStudent({ name, gender, level: lv[i % lv.length], height: 118 + hash(name) % 22, priority: i === 4 || i === 11, note: i === 4 ? 'Cận thị nhẹ' : '' });
  });
  const a = c.students[1], b = c.students[7];
  a.avoid = [b.id]; b.avoid = [a.id];
  return c;
}
function normalizeDb(d) {
  d.settings = Object.assign({ sound: true, view: 'student', scale: 1, autoFit: true, welcomed: false }, d.settings || {});
  d.settings.arrange = Object.assign({ mode: 'random', scope: 'all', priority: true, avoid: true }, d.settings.arrange || {});
  d.classes.forEach(c => {
    c.id ||= uid(); c.name ||= 'Lớp';
    c.layout = Object.assign({ rows: 5, cols: 4, spd: 2, disabled: [] }, c.layout || {});
    c.seats ||= {}; c.locked ||= []; c.saved ||= []; c.students ||= [];
    c.students.forEach(s => {
      s.id ||= uid(); s.name = String(s.name || ''); s.gender ||= ''; s.level ||= ''; s.height ||= '';
      s.note ||= ''; s.avoid ||= []; s.priority = !!s.priority;
    });
    const ids = new Set(c.students.map(s => s.id)), photos = {};
    for (const [id, p] of Object.entries(c.photos || {})) if (ids.has(id) && okPhoto(p)) photos[id] = p;
    c.photos = photos;
  });
  if (!d.classes.some(c => c.id === d.current)) d.current = d.classes[0].id;
  return d;
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { const d = JSON.parse(raw); if (d && Array.isArray(d.classes) && d.classes.length) return normalizeDb(d); }
  } catch (e) { /* storage unavailable */ }
  return null;
}
let db = load();
if (!db) { const c = demoClass(); db = normalizeDb({ classes: [c], current: c.id }); }

let saveTimer;
function persist() { try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); return true; } catch (e) { return false; } }
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { if (!persist()) toast('Trình duyệt không cho lưu dữ liệu 😢 — nhớ “Sao lưu” ra file nhé', 'warn'); }, 200);
}
window.addEventListener('beforeunload', persist);

const cls = () => db.classes.find(c => c.id === db.current);

/* ---------------- Lite mode for slower devices ----------------
   settings.lite: null = automatic, true / false = chosen by the teacher.
   Automatic: very low-end hardware starts in lite mode; otherwise frame times are sampled
   during big animations and lite mode turns on by itself if the device can't keep up. */
const lowEnd = () => (navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2;
let LITE = db.settings.lite ?? lowEnd();
document.documentElement.classList.toggle('lite', LITE);
function setLite(on, auto = false) {
  LITE = on;
  db.settings.lite = auto ? null : on;
  if (auto) db.settings.autoLite = true;
  document.documentElement.classList.toggle('lite', on);
  save();
}
let probeRaf = 0;
function probeSmoothness(ms = 1000) {
  if (LITE || probeRaf || db.settings.lite === false || reduceMotion || document.hidden) return;
  let frames = 0, slow = 0, last = performance.now();
  const end = last + ms;
  probeRaf = requestAnimationFrame(function tick(t) {
    const dt = t - last; last = t; frames++;
    if (dt > 30) slow++;
    if (t < end) { probeRaf = requestAnimationFrame(tick); return; }
    probeRaf = 0;
    if (frames >= 12 && slow / frames > .35) {
      setLite(true, true);
      toast('⚡ Đã bật <b>chế độ nhẹ</b> để máy chạy mượt hơn (đổi trong ❓ Hướng dẫn)', 'info');
    }
  });
}

/* ---------------- Seat geometry ---------------- */
const K = (r, c, s) => `${r}-${c}-${s}`;
const parseK = k => k.split('-').map(Number);
const deskOff = (c, r, x) => c.layout.disabled.includes(`${r}-${x}`);
function seatKeys(c = cls()) {
  const { rows, cols, spd } = c.layout, out = [];
  for (let r = 0; r < rows; r++) for (let x = 0; x < cols; x++) {
    if (deskOff(c, r, x)) continue;
    for (let s = 0; s < spd; s++) out.push(K(r, x, s));
  }
  return out;
}
function cleanSeats(c = cls()) {
  const valid = new Set(seatKeys(c)), ids = new Set(c.students.map(s => s.id)), seen = new Set();
  for (const k of Object.keys(c.seats)) {
    const id = c.seats[k];
    if (!valid.has(k) || !ids.has(id) || seen.has(id)) delete c.seats[k]; else seen.add(id);
  }
  c.locked = [...new Set(c.locked)].filter(k => c.seats[k]);
}
const seatOfId = (c, id) => Object.keys(c.seats).find(k => c.seats[k] === id);
const given = n => { const p = n.trim().split(/\s+/); return p[p.length - 1] || n; };
const surname = n => n.trim().split(/\s+/).slice(0, -1).join(' ');
const initial = s => (given(s.name)[0] || '?').toUpperCase();
const viCmp = (a, b) => given(a.name).localeCompare(given(b.name), 'vi') || a.name.localeCompare(b.name, 'vi');
const seatLabel = k => { const [r, x, s] = parseK(k); return `Dãy ${x + 1} · Bàn ${r + 1}` + (cls().layout.spd > 1 ? ` · Chỗ ${s + 1}` : ''); };
const avatarHue = s => (s.gender === 'F' ? 338 : s.gender === 'M' ? 205 : 268) + hash(s.id) % 30 - 15;
const avatarColor = s => `hsl(${avatarHue(s)} 92% 84%)`;
const avatarInk = s => `hsl(${avatarHue(s)} 45% 34%)`;

/* ---------------- History (undo / redo) ---------------- */
const hists = new Map();
const H = () => { if (!hists.has(db.current)) hists.set(db.current, { u: [], r: [] }); return hists.get(db.current); };
const snap = () => { const c = cls(); return JSON.stringify({ students: c.students, layout: c.layout, seats: c.seats, locked: c.locked }); };
function commit() { const h = H(); h.u.push(snap()); if (h.u.length > 80) h.u.shift(); h.r.length = 0; }
function undo() {
  const h = H(); if (!h.u.length) return toast('Không còn bước nào để hoàn tác', 'info');
  const cur = snap(); withFlip(() => { h.r.push(cur); Object.assign(cls(), JSON.parse(h.u.pop())); }, { arc: true, stagger: 5 });
  sfx.whoosh();
}
function redo() {
  const h = H(); if (!h.r.length) return toast('Không có bước nào để làm lại', 'info');
  const cur = snap(); withFlip(() => { h.u.push(cur); Object.assign(cls(), JSON.parse(h.r.pop())); }, { arc: true, stagger: 5 });
  sfx.whoosh();
}

/* ---------------- Sound (tiny WebAudio synth) ---------------- */
let actx;
function tone(freq, dur = .09, type = 'sine', vol = .07, slide = 0, at = 0) {
  if (!db.settings.sound) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t = actx.currentTime + at, o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + .03);
  } catch (e) { /* no audio */ }
}
// Creating an AudioContext costs ~50-80 ms of main thread. Do it while idle right after the first
// interaction, instead of inside the first sound — which usually lands at the start of an animation.
function warmAudio() {
  if (actx || !db.settings.sound) return;
  const make = () => { try { actx ||= new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ } };
  if (window.requestIdleCallback) requestIdleCallback(make, { timeout: 800 }); else setTimeout(make, 50);
}
document.addEventListener('pointerup', warmAudio, { once: true, capture: true });
document.addEventListener('keydown', warmAudio, { once: true, capture: true });
const sfx = {
  pick: () => tone(620, .1, 'sine', .06, 1.6),
  tick: () => tone(1100, .04, 'triangle', .025),
  drop: () => { tone(520, .12, 'triangle', .08, .55); tone(1040, .06, 'sine', .03, 1, .04); },
  swap: () => { tone(500, .09, 'triangle', .07, 1.4); tone(700, .1, 'triangle', .06, .7, .08); },
  pop: () => tone(880, .07, 'sine', .06, 1.3),
  deny: () => { tone(220, .09, 'square', .03); tone(180, .12, 'square', .03, 1, .09); },
  whoosh: () => tone(300, .18, 'sine', .04, 2.4),
  shuffle: () => { for (let i = 0; i < 7; i++) tone(500 + Math.random() * 500, .06, 'triangle', .035, 1.2, i * .05); },
  success: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .18, 'triangle', .07, 1, i * .09)),
};

/* ---------------- Spring physics helpers ---------------- */
const curveCache = new Map();
function springCurve(k = 170, c = 17, m = 1) {
  const key = `${k}|${c}|${m}`;
  if (curveCache.has(key)) return curveCache.get(key);
  let x = 0, v = 0; const out = [0], dt = 1 / 240;
  for (let f = 0; f < 240; f++) {
    for (let s = 0; s < 4; s++) { const a = (-k * (x - 1) - c * v) / m; v += a * dt; x += v * dt; }
    out.push(x);
    if (Math.abs(1 - x) < .0015 && Math.abs(v) < .02) break;
  }
  out[out.length - 1] = 1; curveCache.set(key, out); return out;
}
function springAnim(el, fn, { k = 220, c = 18, delay = 0, fill = 'backwards' } = {}) {
  if (reduceMotion) return null;
  const cv = springCurve(k, c);
  return el.animate(cv.map((p, i) => fn(p, i, cv)), { duration: cv.length * FRAME, delay, easing: 'linear', fill });
}
const springIn = el => springAnim(el, p => ({ transform: `translateY(${(1 - p) * 40}px) scale(${.7 + .3 * p})`, opacity: clamp(p * 1.6, 0, 1) }), { k: 260, c: 18 });
const popIn = (el, delay = 0) => springAnim(el, p => ({ transform: `scale(${Math.max(0, p)}) rotate(${(1 - p) * -14}deg)`, opacity: clamp(p * 2, 0, 1) }), { k: 240, c: 14, delay });
// Squash around the bottom edge, expressed purely as a transform so it stays on the compositor.
const squash = el => {
  const h = el.offsetHeight / 2;
  return springAnim(el, p => { const q = 1 - p, sy = 1 - q * .16; return { transform: `translateY(${h * (1 - sy)}px) scale(${1 + q * .16}, ${sy})` }; }, { k: 320, c: 11 });
};
const jelly = el => springAnim(el, p => ({ transform: `scale(${.88 + .12 * p}, ${1.08 - .08 * p})` }), { k: 380, c: 12 });
const bump = el => springAnim(el, p => ({ transform: `scale(${1.35 - .35 * p})` }), { k: 300, c: 12 });
function shake(el) {
  if (!el || reduceMotion) return;
  el.animate([{ transform: 'none' }, { transform: 'translateX(-7px) rotate(-3deg)' }, { transform: 'translateX(6px) rotate(3deg)' },
    { transform: 'translateX(-4px) rotate(-1deg)' }, { transform: 'translateX(2px)' }, { transform: 'none' }], { duration: 420 });
}

/* Cards that are mid-flight are hidden in the real layout and shown as clones in #flyLayer */
const hidden = new Map();
const hide = id => hidden.set(id, (hidden.get(id) || 0) + 1);
function unhide(id) {
  const n = (hidden.get(id) || 1) - 1;
  if (n > 0) { hidden.set(id, n); return; }
  hidden.delete(id);
  const el = cardEl(id); if (el) el.classList.remove('is-hidden');
}
const cardEl = id => $(`#app .card[data-id="${id}"]`);

/* FLIP: measure → mutate → render → animate every card from its old place to the new one */
function withFlip(mutate, opts = {}) {
  const before = new Map();
  $$('#app .card[data-id]').forEach(el => before.set(el.dataset.id, el.getBoundingClientRect()));
  mutate();
  save(); render();
  if (reduceMotion) return 0;
  const vw = innerWidth, vh = innerHeight, moves = [], fresh = [];
  $$('#app .card[data-id]').forEach(el => {
    const id = el.dataset.id; if (id === opts.skip) return;
    const a = el.getBoundingClientRect(), b = before.get(id);
    if (!b) { fresh.push(el); return; }
    if (Math.abs(b.left - a.left) < 1 && Math.abs(b.top - a.top) < 1 && Math.abs(b.width - a.width) < 1) return;
    const off = r => r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw;
    if (off(a) && off(b)) return;
    moves.push({ el, a, b });
  });
  // Lite mode: shorter stagger so fewer clones are alive at the same time.
  const st = (opts.stagger || 0) * (LITE ? .6 : 1);
  moves.forEach((m, i) => fly(m.el, m.b, m.a, { delay: Math.min(i * st, 900), arc: opts.arc }));
  fresh.forEach((el, i) => popIn(el, Math.min(i * (st || 12), 900)));
  if (moves.length + fresh.length > 8) probeSmoothness();
  return moves.length + fresh.length;
}
function fly(el, from, to, { delay = 0, arc = false } = {}) {
  const id = el.dataset.id;
  const f = el.cloneNode(true);
  f.classList.add('flyer'); f.classList.remove('is-hidden', 'placeholder');
  Object.assign(f.style, { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px' });
  $('#flyLayer').appendChild(f);
  hide(id); el.classList.add('is-hidden');
  const dx = from.left + from.width / 2 - (to.left + to.width / 2), dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const sx = from.width / to.width, sy = from.height / to.height, dist = Math.hypot(dx, dy);
  const lift = arc ? Math.min(70, dist * .2) : Math.min(16, dist * .07);
  const cv = springCurve(arc ? 120 : 180, arc ? 13 : 18);
  let prev = 0;
  const frames = cv.map(p => {
    const v = p - prev; prev = p; const t = clamp(p, 0, 1);
    const x = dx * (1 - p), y = dy * (1 - p) - lift * Math.sin(Math.PI * t);
    const rot = clamp(-dx * v * .3, -16, 16);
    const pump = 1 + (arc ? .14 : .05) * Math.sin(Math.PI * t);
    return { transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${(sx + (1 - sx) * p) * pump}, ${(sy + (1 - sy) * p) * pump})` };
  });
  const anim = f.animate(frames, { duration: cv.length * FRAME, delay, easing: 'linear', fill: 'both' });
  let done = false;
  const finish = () => {
    if (done) return; done = true;
    f.remove(); unhide(id);
    if (arc && !hidden.has(id)) { const cur = cardEl(id); if (cur) squash(cur); }
  };
  anim.onfinish = anim.oncancel = finish;
  setTimeout(finish, delay + cv.length * FRAME + 500);
}

/* ---------------- Rendering ---------------- */
const room = $('#room');
let editDesks = false, query = '', selected = null;
const prevStats = [];

function render() {
  const c = cls(); cleanSeats(c);
  applyScale(db.settings.scale);
  if (selected && !c.students.some(s => s.id === selected)) clearSelection();
  renderTop(c); renderStats(c); renderPool(c); renderRoom(c);
  autoFit();
  if (selected) showPickBar();
}
function renderTop(c) {
  $('#className').textContent = c.name;
  $('#classCount').textContent = `${c.students.length} HS`;
  $('#btnUndo').disabled = !H().u.length;
  $('#btnRedo').disabled = !H().r.length;
  $('#btnSound').textContent = db.settings.sound ? '🔊' : '🔇';
  $('#btnEditDesks').classList.toggle('on', editDesks);
  $('#btnEditDesks').textContent = editDesks ? '✅ Xong' : '✏️ Sửa bàn';
  $$('#viewSeg button').forEach(b => b.classList.toggle('on', b.dataset.view === db.settings.view));
  document.title = `${c.name} – Lớp Mình Xinh`;
}
function positionSeg() {
  const on = $('#viewSeg button.on'), th = $('#viewSeg .thumb');
  if (on) { th.style.left = on.offsetLeft + 'px'; th.style.width = on.offsetWidth + 'px'; }
}
function renderStats(c) {
  const total = c.students.length;
  const f = c.students.filter(s => s.gender === 'F').length, m = c.students.filter(s => s.gender === 'M').length;
  const seats = seatKeys(c).length, seated = Object.keys(c.seats).length, lack = total - seats, unknown = total - f - m;
  const vals = [f, m, `${seated}/${seats}`, lack > 0 ? lack : seats - seated, unknown];
  $('#stats').innerHTML = `
    <button class="stat" data-gender style="--c:#ffe6ef" title="Cập nhật giới tính"><span class="e">👧</span><span><b>${vals[0]}</b><small>Bạn nữ</small></span></button>
    <button class="stat" data-gender style="--c:#e3f2ff" title="Cập nhật giới tính"><span class="e">👦</span><span><b>${vals[1]}</b><small>Bạn nam</small></span></button>
    ${unknown ? `<button class="stat stat-wide" data-gender="unknown" style="--c:#f5eef8"><span class="e">🤍</span><span><b>${unknown}</b> bạn chưa rõ giới tính</span><span class="go">Cập nhật ›</span></button>` : ''}
    <div class="stat" style="--c:#efe9ff"><span class="e">🪑</span><span><b>${vals[2]}</b><small>Đã xếp / số chỗ</small></span></div>
    <div class="stat${lack > 0 ? ' warn' : ''}" style="--c:#dcf7ee"><span class="e">${lack > 0 ? '⚠️' : '💺'}</span><span><b>${vals[3]}</b><small>${lack > 0 ? 'Thiếu chỗ ngồi' : 'Chỗ còn trống'}</small></span></div>`;
  const order = unknown ? [0, 1, 4, 2, 3] : [0, 1, 2, 3];
  $$('#stats b').forEach((b, i) => { const j = order[i]; if (prevStats[j] !== undefined && prevStats[j] !== vals[j]) bump(b); prevStats[j] = vals[j]; });
}
$('#stats').addEventListener('click', e => {
  const t = e.target.closest('[data-gender]');
  if (t) openGender(t.dataset.gender === 'unknown');
});
function cardHTML(s, kind, locked = false) {
  const match = query && norm(s.name).includes(query);
  const cl = ['card', `sz-${kind}`, `g-${s.gender || 'U'}`, locked ? 'locked' : '', query ? (match ? 'match' : 'dim') : '',
    hidden.has(s.id) ? 'is-hidden' : '', s.id === selected ? 'selected' : ''].join(' ');
  const badges = (s.priority ? '<i title="Ưu tiên bàn đầu">👓</i>' : '') + (s.note ? `<i title="${esc(s.note)}">📝</i>` : '');
  const style = `--av:${avatarColor(s)};--avt:${avatarInk(s)}`;
  const ava = avaHTML(s, photoOf(s));
  if (kind === 'seat') {
    return `<div class="${cl}" data-id="${s.id}" style="${style}" title="${esc(s.name)}${s.note ? ' — ' + esc(s.note) : ''}">
      ${ava}<b class="gn">${esc(given(s.name))}</b><small class="sn">${esc(surname(s.name)) || '&nbsp;'}</small>
      <span class="badges">${badges}</span>
      <button class="card-btn b-lock" data-act="lock" title="${locked ? 'Mở khóa chỗ' : 'Khóa chỗ (giữ nguyên khi xếp tự động)'}">${locked ? '🔒' : '🔓'}</button>
      <button class="card-btn b-out" data-act="out" title="Đưa về danh sách">✕</button></div>`;
  }
  const meta = [s.gender ? (s.gender === 'F' ? 'Nữ' : 'Nam') : '', LEVEL_SHORT[s.level] || '', s.height ? s.height + ' cm' : ''].filter(Boolean).join(' · ');
  return `<div class="${cl}" data-id="${s.id}" style="${style}">${ava}
    <span class="pn"><b>${esc(s.name)}</b><small>${meta || 'Bấm để thêm thông tin'}</small></span><span class="badges">${badges}</span></div>`;
}
function renderPool(c) {
  const seated = new Set(Object.values(c.seats));
  const all = c.students.filter(s => !seated.has(s.id)).sort(viCmp);
  const list = query ? all.filter(s => norm(s.name).includes(query)) : all;
  $('#poolCount').textContent = all.length;
  const pool = $('#pool');
  if (!c.students.length) pool.innerHTML = `<div class="empty"><div class="empty-ico">🐣</div><b>Lớp chưa có học sinh</b><span>Bấm <b>📥 Nhập DS</b> để nhập từ Excel, hoặc <b>＋ Thêm HS</b> từng bạn nhé!</span></div>`;
  else if (!list.length && query) pool.innerHTML = `<div class="empty"><div class="empty-ico">🔍</div><b>Không có bạn chưa xếp nào khớp</b><span>Nếu bạn ấy đã có chỗ, thẻ sẽ sáng lên trên sơ đồ.</span></div>`;
  else if (!list.length) pool.innerHTML = `<div class="empty"><div class="empty-ico">🎉</div><b>Cả lớp đã có chỗ!</b><span>Kéo thẻ về đây nếu muốn bỏ chỗ của bạn nào đó.</span></div>`;
  else pool.innerHTML = list.map(s => cardHTML(s, 'pool')).join('');
}
function renderRoom(c) {
  const { rows, cols, spd } = c.layout;
  room.style.setProperty('--spd', spd);
  room.classList.toggle('flip', db.settings.view === 'teacher');
  room.classList.toggle('editing', editDesks);
  $('#boardText').textContent = `Bảng · ${c.name}`;
  const locked = new Set(c.locked), S = new Map(c.students.map(s => [s.id, s]));
  let lab = '<span class="row-label"></span>';
  for (let x = 0; x < cols; x++) lab += `<span class="col-label">Dãy ${x + 1}</span>`;
  $('#colLabels').innerHTML = lab;
  let h = '';
  for (let r = 0; r < rows; r++) {
    h += `<div class="desk-row"><span class="row-label">Bàn<br>${r + 1}</span>`;
    for (let x = 0; x < cols; x++) {
      const off = deskOff(c, r, x);
      h += `<div class="desk${off ? ' off' : ''}" data-desk="${r}-${x}" title="${editDesks ? (off ? 'Bấm để bật lại bàn này' : 'Bấm để tắt bàn này') : `Dãy ${x + 1} · Bàn ${r + 1}`}"><div class="seats">`;
      for (let s = 0; s < spd; s++) {
        if (off) { h += '<div class="seat"></div>'; continue; }
        const k = K(r, x, s), st = S.get(c.seats[k]), lk = locked.has(k);
        h += `<div class="seat${st ? ' filled' : ''}${lk ? ' locked' : ''}" data-seat="${k}">${st ? cardHTML(st, 'seat', lk) : '<span class="seat-empty">＋</span>'}</div>`;
      }
      h += '</div></div>';
    }
    h += '</div>';
  }
  $('#rows').innerHTML = h;
}

/* ---------------- Drag & drop with spring physics ---------------- */
let drag = null;
const stageScroll = $('#stageScroll'), poolEl = $('#pool'), sidebar = $('#sidebar');

// Mouse: drag starts after a few pixels. Touch / pen: a short long-press starts the drag,
// so a normal swipe still scrolls the room and the list; a quick tap selects the card.
let lastPointer = 'mouse', tapAt = 0;
const SHEET_MQ = matchMedia('(max-width: 900px) and (min-height: 521px)');
document.addEventListener('pointerdown', e => {
  lastPointer = e.pointerType || 'mouse';
  if (drag || e.button > 0 || editDesks) return;
  const card = e.target.closest('#app .card[data-id]');
  if (!card || e.target.closest('.card-btn')) return;
  const seat = card.closest('.seat');
  drag = { id: card.dataset.id, el: card, from: seat ? seat.dataset.seat : null, sx: e.clientX, sy: e.clientY, px: e.clientX, py: e.clientY,
    pid: e.pointerId, started: false, touch: e.pointerType === 'touch' || e.pointerType === 'pen' };
  if (drag.touch) {
    card.classList.add('pressing');
    drag.pressT = setTimeout(() => { if (drag && !drag.started && drag.el === card) { card.classList.remove('pressing'); tryBegin(); } }, 280);
  }
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
});
// Once a touch drag has started, stop the page from scrolling under the finger.
document.addEventListener('touchmove', e => { if (drag && drag.started) e.preventDefault(); }, { passive: false });
document.addEventListener('contextmenu', e => { if (e.target.closest('.card')) e.preventDefault(); });
function cancelPress() { if (!drag) return; clearTimeout(drag.pressT); drag.el.classList.remove('pressing'); }
function tryBegin() {
  const d = drag;
  if (d.from && cls().locked.includes(d.from)) {
    cancelPress(); shake(d.el); sfx.deny();
    toast(d.touch ? 'Chỗ này đang khóa 🔒 — chạm vào bạn ấy để mở khóa' : 'Chỗ này đang khóa 🔒 — bấm vào ổ khóa để mở nhé', 'warn');
    stopListening(); drag = null; return false;
  }
  if (d.touch) navigator.vibrate?.(12);
  clearSelection();
  beginDrag();
  return true;
}
function stopListening() {
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onCancel);
}
function onMove(e) {
  const d = drag; if (!d || e.pointerId !== d.pid) return;
  d.px = e.clientX; d.py = e.clientY;
  if (!d.started) {
    const moved = Math.hypot(d.px - d.sx, d.py - d.sy);
    if (d.touch) { if (moved > 10) { cancelPress(); stopListening(); drag = null; } return; }
    if (moved < 6 || !tryBegin()) return;
  }
  e.preventDefault();
}
function beginDrag() {
  const d = drag, r = d.el.getBoundingClientRect();
  Object.assign(d, { started: true, ox: d.sx - r.left, oy: d.sy - r.top, x: r.left, y: r.top, vx: 0, vy: 0, rot: 0, vr: 0, s: 1, vs: 0, w: r.width, h: r.height, last: performance.now() });
  const g = d.el.cloneNode(true);
  g.classList.add('ghost'); g.classList.remove('match', 'dim', 'placeholder');
  Object.assign(g.style, { width: r.width + 'px', height: r.height + 'px', transformOrigin: `${d.ox}px ${d.oy}px`, transform: `translate3d(${r.left}px, ${r.top}px, 0)` });
  document.body.appendChild(g); d.ghost = g;
  window.getSelection()?.removeAllRanges();
  d.el.classList.add('placeholder');
  document.body.classList.add('dragging');
  if (SHEET_MQ.matches) document.body.classList.remove('sheet-open');
  sfx.pick();
  d.raf = requestAnimationFrame(step);
}
function step(now) {
  const d = drag; if (!d) return;
  const f = clamp((now - d.last) / FRAME, .25, 3); d.last = now;
  let tx, ty, k, damp;
  if (d.landing) {
    tx = d.land.x; ty = d.land.y; k = .15; damp = .72;
    d.w += (d.land.w - d.w) * (1 - Math.pow(.75, f)); d.h += (d.land.h - d.h) * (1 - Math.pow(.75, f));
    d.ghost.style.width = d.w + 'px'; d.ghost.style.height = d.h + 'px';
  } else {
    tx = d.px - d.ox; ty = d.py - d.oy; k = .3; damp = .6;
    // hit-testing forces a style/layout check, so only do it when the finger moved or the view scrolled
    if (autoScroll(f) || d.px !== d.hx || d.py !== d.hy) { d.hx = d.px; d.hy = d.py; updateHover(); }
  }
  // position spring (frame-rate independent approximation)
  d.vx = (d.vx + (tx - d.x) * k * f) * Math.pow(damp, f); d.x += d.vx * f;
  d.vy = (d.vy + (ty - d.y) * k * f) * Math.pow(damp, f); d.y += d.vy * f;
  // pendulum: card hangs from the grab point and swings against the motion
  const rt = d.landing ? 0 : clamp(d.vx * 1.15, -24, 24);
  d.vr = (d.vr + (rt - d.rot) * .17 * f) * Math.pow(.8, f); d.rot += d.vr * f;
  const stT = d.landing ? 1 : 1.07;
  d.vs = (d.vs + (stT - d.s) * .22 * f) * Math.pow(.68, f); d.s += d.vs * f;
  d.ghost.style.transform = `translate3d(${d.x}px, ${d.y}px, 0) rotate(${d.rot}deg) scale(${d.s})`;
  if (d.landing && Math.abs(tx - d.x) < .6 && Math.abs(ty - d.y) < .6 && Math.hypot(d.vx, d.vy) < .5 && Math.abs(d.rot) < .4 && Math.abs(d.s - 1) < .01) return finishLanding();
  d.raf = requestAnimationFrame(step);
}
function autoScroll(f) {
  const d = drag;
  if (!d.scRects || d.scRectsAt !== d.hx) { d.scRects = [stageScroll, poolEl].map(sc => [sc, sc.getBoundingClientRect()]); d.scRectsAt = d.hx; }
  let moved = false;
  for (const [sc, r] of d.scRects) {
    if (d.px < r.left || d.px > r.right || d.py < r.top || d.py > r.bottom) continue;
    const e = 56, top = sc.scrollTop, left = sc.scrollLeft;
    if (d.py < r.top + e) sc.scrollTop -= (r.top + e - d.py) / 3 * f;
    else if (d.py > r.bottom - e) sc.scrollTop += (d.py - (r.bottom - e)) / 3 * f;
    if (sc === stageScroll) {
      if (d.px < r.left + e) sc.scrollLeft -= (r.left + e - d.px) / 3 * f;
      else if (d.px > r.right - e) sc.scrollLeft += (d.px - (r.right - e)) / 3 * f;
    }
    if (sc.scrollTop !== top || sc.scrollLeft !== left) moved = true;
  }
  return moved;
}
function updateHover() {
  const d = drag, el = document.elementFromPoint(d.px, d.py);
  let target = null, kind = null;
  const seat = el && el.closest('.seat[data-seat]');
  if (seat) { target = seat; kind = 'seat'; }
  else if (el && el.closest('#sidebar')) { target = sidebar; kind = 'pool'; }
  if (target === d.hover) return;
  d.hover?.classList.remove('hover', 'deny', 'drop-hover');
  d.hover = target; d.hoverKind = kind;
  if (!target) return;
  if (kind === 'pool') { if (d.from) target.classList.add('drop-hover'); return; }
  const k = target.dataset.seat;
  if (k === d.from) return;
  if (cls().locked.includes(k)) target.classList.add('deny');
  else { target.classList.add('hover'); sfx.tick(); }
}
function onUp(e) {
  const d = drag; if (!d || e.pointerId !== d.pid) return;
  stopListening();
  if (!d.started) {
    cancelPress(); drag = null; tapAt = performance.now();
    if (d.touch) handleTap(d.id, d.from); else openStudent(d.id);
    return;
  }
  drop();
}
function onCancel(e) {
  const d = drag; if (!d || e.pointerId !== d.pid) return;
  stopListening();
  if (!d.started) { cancelPress(); drag = null; return; }
  d.hover?.classList.remove('hover', 'deny', 'drop-hover'); d.hover = null; d.hoverKind = null;
  drop();
}
function drop() {
  const d = drag, c = cls();
  d.hover?.classList.remove('hover', 'deny', 'drop-hover');
  document.body.classList.remove('dragging');
  let dest = null, toPool = false;
  if (d.hoverKind === 'seat') {
    const k = d.hover.dataset.seat;
    if (k !== d.from) {
      if (c.locked.includes(k)) { sfx.deny(); toast('Chỗ đó đang khóa 🔒', 'warn'); }
      else dest = k;
    }
  } else if (d.hoverKind === 'pool' && d.from) toPool = true;

  if (dest || toPool) {
    const occupant = dest ? c.seats[dest] : null;
    hide(d.id);
    withFlip(() => {
      commit();
      if (dest) {
        if (d.from) {
          if (occupant) c.seats[d.from] = occupant; else delete c.seats[d.from];
          c.locked = c.locked.filter(k => k !== d.from);
        }
        c.seats[dest] = d.id;
      } else {
        delete c.seats[d.from];
        c.locked = c.locked.filter(k => k !== d.from);
      }
    }, { skip: d.id, arc: true });
    d.hidden = true;
    occupant ? sfx.swap() : sfx.drop();
  }
  const tgt = cardEl(d.id);
  if (!tgt) { d.ghost.remove(); if (d.hidden) unhide(d.id); drag = null; return; }
  if (toPool) tgt.scrollIntoView({ block: 'nearest' });
  const r = tgt.getBoundingClientRect();
  d.land = { x: r.left, y: r.top, w: r.width, h: r.height };
  d.landing = true;
  d.landTimer = setTimeout(finishLanding, 1500);
}
function finishLanding() {
  const d = drag; if (!d) return;
  cancelAnimationFrame(d.raf); clearTimeout(d.landTimer);
  d.ghost.remove();
  drag = null;
  if (d.hidden) unhide(d.id);
  const el = cardEl(d.id);
  if (el) { el.classList.remove('placeholder'); squash(el); }
}
window.addEventListener('blur', () => { if (drag && drag.started && !drag.landing) { stopListening(); drag.hover = null; drag.hoverKind = null; drop(); } });

/* ---------------- Seat actions ---------------- */
function toggleLock(k) {
  const c = cls(); if (!c.seats[k]) return;
  commit();
  const on = !c.locked.includes(k);
  c.locked = on ? [...c.locked, k] : c.locked.filter(x => x !== k);
  save(); render();
  const el = $(`.seat[data-seat="${k}"] .card`); if (el) jelly(el);
  sfx.pop();
  toast(on ? '🔒 Đã khóa chỗ — xếp tự động sẽ giữ nguyên bạn này' : '🔓 Đã mở khóa chỗ', 'info');
}
function unseat(k) {
  const c = cls(); if (!c.seats[k]) return;
  withFlip(() => { commit(); delete c.seats[k]; c.locked = c.locked.filter(x => x !== k); }, { arc: true });
  sfx.drop();
}
document.addEventListener('click', e => {
  const b = e.target.closest('.card-btn');
  if (b) {
    const k = b.closest('.seat')?.dataset.seat; if (!k) return;
    b.dataset.act === 'lock' ? toggleLock(k) : unseat(k);
    return;
  }
  const desk = editDesks && e.target.closest('#rows .desk');
  if (desk) { toggleDesk(desk.dataset.desk); return; }
  if (performance.now() - tapAt < 450 || e.target.closest('.modal-wrap, #pickBar')) return;
  const seat = e.target.closest('.seat[data-seat]');
  if (selected) {
    if (seat) return placeSelected(seat.dataset.seat);
    if (e.target.closest('#sidebar') && !e.target.closest('.btn, input, .link, .sheet-handle, .card, .stat')) return unseatSelected();
    if (!e.target.closest('.btn, .card, #sidebar, .stage-tools, .topbar')) clearSelection();
    return;
  }
  if ((lastPointer === 'touch' || lastPointer === 'pen') && seat && !seat.classList.contains('filled')) toast('👆 Chạm vào một bạn trước, rồi chạm vào chỗ này để xếp', 'info');
});

/* Tap-to-place (touch): tap a card to pick it up, tap a seat to put it there */
function handleTap(id, seatKey) {
  if (selected === id) { clearSelection(); openStudent(id); return; }
  if (selected && seatKey) { placeSelected(seatKey); return; }
  select(id);
}
function select(id) {
  selected = id;
  $$('#app .card.selected').forEach(x => x.classList.remove('selected'));
  const el = cardEl(id);
  if (el) { el.classList.add('selected'); jelly(el); }
  document.body.classList.add('picking');
  showPickBar(); sfx.pick();
}
function clearSelection() {
  if (!selected) return;
  selected = null;
  $$('#app .card.selected').forEach(x => x.classList.remove('selected'));
  document.body.classList.remove('picking');
  $('#pickBar').hidden = true;
}
function showPickBar() {
  const c = cls(), s = c.students.find(x => x.id === selected), bar = $('#pickBar');
  if (!s) { bar.hidden = true; return; }
  const k = seatOfId(c, s.id), lk = k && c.locked.includes(k);
  bar.innerHTML = `<span class="pk-ava" style="--av:${avatarColor(s)};--avt:${avatarInk(s)}">${avaHTML(s, photoOf(s, c))}</span>
    <span class="pk-txt"><b>${esc(given(s.name))}</b><small>${lk ? '🔒 Đang khóa chỗ' : `Chạm vào chỗ ngồi để ${k ? 'đổi chỗ' : 'xếp'}`}</small></span>
    <button type="button" class="btn icon sm" data-pick="info" title="Thông tin">ⓘ</button>
    ${k ? `<button type="button" class="btn icon sm" data-pick="lock" title="${lk ? 'Mở khóa' : 'Khóa chỗ'}">${lk ? '🔒' : '🔓'}</button><button type="button" class="btn icon sm" data-pick="out" title="Bỏ chỗ">↩️</button>` : ''}
    <button type="button" class="btn icon sm" data-pick="x" title="Bỏ chọn">✕</button>`;
  if (bar.hidden) { bar.hidden = false; springIn(bar); }
}
$('#pickBar').addEventListener('click', e => {
  const a = e.target.closest('[data-pick]')?.dataset.pick; if (!a) return;
  const id = selected, k = id && seatOfId(cls(), id);
  if (a === 'info') { clearSelection(); openStudent(id); }
  else if (a === 'lock' && k) { toggleLock(k); showPickBar(); }
  else if (a === 'out') unseatSelected();
  else clearSelection();
});
function placeSelected(k) {
  const c = cls(), id = selected;
  const from = seatOfId(c, id);
  if (from === k) { clearSelection(); return; }
  if (c.locked.includes(k)) { sfx.deny(); shake($(`.seat[data-seat="${k}"]`)); toast('Chỗ đó đang khóa 🔒', 'warn'); return; }
  if (from && c.locked.includes(from)) { sfx.deny(); toast('Bạn này đang khóa chỗ 🔒 — mở khóa trước nhé', 'warn'); return; }
  clearSelection();
  const occupant = c.seats[k];
  withFlip(() => {
    commit();
    if (from) { if (occupant) c.seats[from] = occupant; else delete c.seats[from]; }
    c.seats[k] = id;
  }, { arc: true });
  occupant ? sfx.swap() : sfx.drop();
}
function unseatSelected() {
  const k = seatOfId(cls(), selected);
  clearSelection();
  if (k) unseat(k);
}
function toggleDesk(id) {
  const c = cls();
  const off = c.layout.disabled.includes(id);
  withFlip(() => {
    commit();
    c.layout.disabled = off ? c.layout.disabled.filter(x => x !== id) : [...c.layout.disabled, id];
  }, { arc: true });
  const el = $(`[data-desk="${id}"]`); if (el) jelly(el);
  sfx.pop();
}

/* ---------------- Auto arrange ---------------- */
function neighbourEdges(c) {
  const { rows, cols, spd } = c.layout, edges = [];
  const ok = (r, x) => r >= 0 && r < rows && x >= 0 && x < cols && !deskOff(c, r, x);
  for (let r = 0; r < rows; r++) for (let x = 0; x < cols; x++) {
    if (!ok(r, x)) continue;
    for (let s = 0; s < spd; s++) {
      if (s + 1 < spd) edges.push([K(r, x, s), K(r, x, s + 1), 'desk']);
      if (s === spd - 1 && ok(r, x + 1)) edges.push([K(r, x, s), K(r, x + 1, 0), 'side']);
      if (ok(r + 1, x)) edges.push([K(r, x, s), K(r + 1, x, s), 'back']);
    }
  }
  return edges;
}
function arrange(c, o) {
  cleanSeats(c);
  const keys = seatKeys(c), locked = new Set(c.locked), S = new Map(c.students.map(s => [s.id, s]));
  const map = {};
  let ids, free;
  if (o.scope === 'empty') {
    Object.assign(map, c.seats);
    const seated = new Set(Object.values(c.seats));
    ids = c.students.filter(s => !seated.has(s.id)).map(s => s.id);
    free = keys.filter(k => !c.seats[k]);
  } else {
    locked.forEach(k => { map[k] = c.seats[k]; });
    const fixed = new Set(Object.values(map));
    ids = c.students.filter(s => !fixed.has(s.id)).map(s => s.id);
    free = keys.filter(k => !locked.has(k));
  }
  shuffle(ids);
  const sorted = o.mode === 'abc' || o.mode === 'height';
  if (o.mode === 'abc') ids.sort((a, b) => viCmp(S.get(a), S.get(b)));
  if (o.mode === 'height') ids.sort((a, b) => (Number(S.get(a).height) || 999) - (Number(S.get(b).height) || 999));
  if (o.priority) ids.sort((a, b) => (S.get(b).priority ? 1 : 0) - (S.get(a).priority ? 1 : 0));
  const n = Math.min(ids.length, free.length), slots = free.slice(0, n);
  slots.forEach((k, i) => { map[k] = ids[i]; });

  const rowOf = k => +k.split('-')[0];
  const minRow = slots.length ? Math.min(...slots.map(rowOf)) : 0;
  const edges = neighbourEdges(c);
  const W = { desk: 1, side: .35, back: .25 };
  const edgePen = ([k1, k2, t]) => {
    const a = map[k1], b = map[k2]; if (!a || !b) return 0;
    const A = S.get(a), B = S.get(b); let p = 0;
    if (o.avoid && (A.avoid.includes(b) || B.avoid.includes(a))) p += t === 'desk' ? 100 : t === 'side' ? 30 : 22;
    if (o.mode === 'alt' && A.gender && B.gender && A.gender === B.gender) p += 6 * W[t];
    if (o.mode === 'pair' && t === 'desk' && A.level && B.level) p += Math.abs(LV_NUM[A.level] + LV_NUM[B.level] - 3) * 4;
    return p;
  };
  const prioPen = k => (o.priority && map[k] && S.get(map[k]).priority ? (rowOf(k) - minRow) * 9 : 0);
  let cur = edges.reduce((a, e) => a + edgePen(e), 0) + slots.reduce((a, k) => a + prioPen(k), 0);
  // A swap only changes the edges touching the two seats, so score just those (≈20× faster than a full recount).
  const bySeat = new Map();
  edges.forEach(e => { for (const k of [e[0], e[1]]) { if (!bySeat.has(k)) bySeat.set(k, []); bySeat.get(k).push(e); } });
  const local = (ki, kj) => {
    let p = prioPen(ki) + prioPen(kj);
    for (const e of bySeat.get(ki) || []) p += edgePen(e);
    for (const e of bySeat.get(kj) || []) if (e[0] !== ki && e[1] !== ki) p += edgePen(e);
    return p;
  };
  const iters = n < 2 ? 0 : sorted ? 1500 : 6000;
  for (let t = 0; t < iters && cur > 0; t++) {
    const i = Math.random() * n | 0, j = Math.random() * n | 0;
    if (i === j || (sorted && rowOf(slots[i]) !== rowOf(slots[j]))) continue;
    const ki = slots[i], kj = slots[j], before = local(ki, kj);
    [map[ki], map[kj]] = [map[kj], map[ki]];
    const after = local(ki, kj);
    if (after <= before) cur += after - before; else [map[ki], map[kj]] = [map[kj], map[ki]];
  }
  c.seats = map;
  c.locked = c.locked.filter(k => map[k]);
  return { placed: n, left: ids.length - n };
}
let arranging = false;
function runArrange(o) {
  const c = cls();
  if (!c.students.length) { toast('Lớp chưa có học sinh nào 🥺 — nhập danh sách trước nhé', 'warn'); return; }
  if (arranging) return;
  arranging = true;
  sfx.shuffle();
  if (!reduceMotion) $$('#rows .seat:not(.locked) .card').forEach((el, i) => el.animate([
    { transform: 'none' }, { transform: `translateY(-10px) rotate(${(Math.random() - .5) * 26}deg) scale(1.06)` },
    { transform: `translateY(2px) rotate(${(Math.random() - .5) * 16}deg) scale(.97)` }, { transform: 'none' }], { duration: 380, delay: (i % 8) * 12, easing: 'ease-in-out' }));
  setTimeout(() => {
    let res;
    const n = withFlip(() => { commit(); res = arrange(c, o); }, { stagger: 20, arc: true });
    setTimeout(() => {
      arranging = false; sfx.success(); confettiCannons();
      toast(res.left > 0 ? `Đã xếp ${res.placed} bạn — còn ${res.left} bạn chưa có chỗ vì thiếu ghế 🪑` : `Xong rồi! Đã xếp ${res.placed} bạn ✨`, res.left ? 'warn' : 'ok');
    }, reduceMotion ? 0 : Math.min(n * 20, 900) + 450);
  }, reduceMotion ? 0 : 400);
}
function rotateSeats(axis) {
  const c = cls(), { rows, cols, spd } = c.layout, locked = new Set(c.locked);
  if (!Object.keys(c.seats).length) return toast('Sơ đồ đang trống, chưa có gì để đổi 🙂', 'info');
  withFlip(() => {
    commit();
    const next = { ...c.seats };
    const outer = axis === 'cols' ? rows : cols, inner = axis === 'cols' ? cols : rows;
    for (let a = 0; a < outer; a++) for (let s = 0; s < spd; s++) {
      const seq = [];
      for (let b = 0; b < inner; b++) {
        const r = axis === 'cols' ? a : b, x = axis === 'cols' ? b : a, k = K(r, x, s);
        if (!deskOff(c, r, x) && !locked.has(k)) seq.push(k);
      }
      if (seq.length < 2) continue;
      const vals = seq.map(k => c.seats[k]);
      vals.unshift(vals.pop());
      seq.forEach((k, i) => { if (vals[i]) next[k] = vals[i]; else delete next[k]; });
    }
    c.seats = next;
  }, { stagger: 10, arc: true });
  sfx.whoosh();
  toast(axis === 'cols' ? '↔️ Cả lớp đã chuyển sang dãy bên cạnh' : '↕️ Mỗi bạn lùi 1 bàn, bàn cuối lên bàn đầu', 'info');
}

/* ---------------- Confetti (physics particles) ---------------- */
const cvs = $('#confetti'), ctx = cvs.getContext('2d');
let parts = [], confRaf = 0;
const CONF_COLORS = ['#ff7eb0', '#ffb6d0', '#a98bff', '#7fe0c0', '#ffd56b', '#7fc0ff', '#ffa98a'];
// Confetti doesn't need retina sharpness: capping the pixel ratio cuts fill cost up to 4× on phones.
let DPR = 1, confLast = 0;
function sizeCanvas() { DPR = Math.min(devicePixelRatio || 1, LITE ? 1 : 1.5); cvs.width = innerWidth * DPR; cvs.height = innerHeight * DPR; }
sizeCanvas();
cvs.style.visibility = 'hidden';
let resizeT;
addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { sizeCanvas(); positionSeg(); }, 150); });
function burst(x, y, count, angle, spread, power) {
  if (reduceMotion) return;
  count = Math.round(count * (LITE ? .4 : innerWidth < 640 ? .7 : 1));
  if (parts.length > 260) return;
  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random() - .5) * spread, sp = power * (.55 + Math.random() * .6);
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: .2 + Math.random() * .12, rot: Math.random() * 6, vr: (Math.random() - .5) * .35,
      size: 6 + Math.random() * 7, shape: ['heart', 'star', 'circle', 'rect', 'rect'][Math.random() * 5 | 0], color: CONF_COLORS[Math.random() * CONF_COLORS.length | 0],
      life: 0, ttl: 170 + Math.random() * 80, wob: Math.random() * 6 });
  }
  if (!confRaf) {
    if (cvs.width !== Math.round(innerWidth * DPR)) sizeCanvas();
    cvs.style.visibility = 'visible'; confLast = performance.now();
    confRaf = requestAnimationFrame(confLoop);
  }
}
const confettiCannons = () => { burst(0, innerHeight, 70, -Math.PI / 3, .7, 19); burst(innerWidth, innerHeight, 70, -Math.PI * 2 / 3, .7, 19); };
const confettiPop = (x = innerWidth / 2, y = innerHeight / 3) => burst(x, y, 60, -Math.PI / 2, Math.PI * 2, 9);
function drawShape(p) {
  ctx.fillStyle = p.color; const s = p.size;
  if (p.shape === 'heart') {
    ctx.beginPath(); ctx.moveTo(0, s * .3);
    ctx.bezierCurveTo(-s * .9, -s * .35, -s * .35, -s * .95, 0, -s * .35);
    ctx.bezierCurveTo(s * .35, -s * .95, s * .9, -s * .35, 0, s * .3); ctx.fill();
  } else if (p.shape === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? s * .25 : s * .6, a = i * Math.PI / 5 - Math.PI / 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.fill();
  } else if (p.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, s * .35, 0, Math.PI * 2); ctx.fill(); }
  else ctx.fillRect(-s * .4, -s * .22, s * .8, s * .44);
}
function confLoop(now) {
  const f = clamp((now - confLast) / FRAME, .25, 3); confLast = now;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  parts = parts.filter(p => p.life < p.ttl && p.y < innerHeight + 40);
  const drag = Math.pow(.985, f);
  for (const p of parts) {
    p.vx *= drag; p.vy = p.vy * drag + p.g * f;
    p.x += (p.vx + Math.sin(p.life * .09 + p.wob) * .7) * f; p.y += p.vy * f; p.rot += p.vr * f; p.life += f;
    // one setTransform per particle (rotation + paper flutter) instead of save/translate/rotate/restore
    const c = Math.cos(p.rot) * DPR, s = Math.sin(p.rot) * DPR, sy = p.shape === 'rect' ? Math.cos(p.life * .18 + p.wob) : 1;
    ctx.setTransform(c, s, -s * sy, c * sy, p.x * DPR, p.y * DPR);
    ctx.globalAlpha = clamp((p.ttl - p.life) / 40, 0, 1);
    drawShape(p);
  }
  ctx.globalAlpha = 1;
  confRaf = parts.length ? requestAnimationFrame(confLoop) : 0;
  if (!confRaf) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cvs.width, cvs.height); cvs.style.visibility = 'hidden'; }
}

/* ---------------- Toast ---------------- */
function toast(msg, type = 'ok') {
  const box = $('#toasts');
  while (box.children.length > 2) box.firstChild.remove();
  const t = document.createElement('div');
  t.className = `toast ${type}`; t.innerHTML = msg; box.appendChild(t); springIn(t);
  setTimeout(() => {
    const a = t.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(12px) scale(.9)' }], { duration: 220, fill: 'forwards' });
    a.onfinish = () => t.remove();
    setTimeout(() => t.remove(), 400);
  }, 2800);
}

/* ---------------- Modal system ---------------- */
const modalStack = [];
function modal({ title, icon = '🌸', body = '', actions = [], wide = false, onOpen, onClose }) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><span class="m-ico">${icon}</span><h3>${title}</h3><button class="m-x" aria-label="Đóng">✕</button></div>
    <div class="modal-body">${body}</div>${actions.length ? '<div class="modal-foot"></div>' : ''}</div>`;
  const box = $('.modal', wrap), foot = $('.modal-foot', wrap);
  let closed = false, downOnBg = false;
  const api = { el: wrap, box, close };
  function close() {
    if (closed) return; closed = true;
    modalStack.splice(modalStack.indexOf(api), 1);
    onClose?.();
    wrap.classList.add('closing');
    const a = box.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(18px) scale(.92)', opacity: 0 }], { duration: 180, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    a.onfinish = () => wrap.remove();
    setTimeout(() => wrap.remove(), 400);
  }
  actions.forEach(a => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = `btn ${a.cls || ''}`; b.innerHTML = a.label;
    if (a.id) b.id = a.id;
    if (a.left) b.style.marginRight = 'auto';
    b.addEventListener('click', async () => { const r = a.onClick ? await a.onClick(api) : undefined; if (r !== false) close(); });
    foot.appendChild(b);
  });
  $('.m-x', wrap).onclick = close;
  wrap.addEventListener('pointerdown', e => { downOnBg = e.target === wrap; });
  wrap.addEventListener('click', e => { if (e.target === wrap && downOnBg) close(); });
  bindFormBits(wrap);
  document.body.appendChild(wrap);
  modalStack.push(api);
  springIn(box);
  onOpen?.(api);
  setTimeout(() => $('[autofocus]', wrap)?.focus(), 80);
  return api;
}
function bindFormBits(root) {
  root.addEventListener('click', e => {
    const chip = e.target.closest('.chips .chip');
    if (chip) {
      const g = chip.parentElement;
      if (g.hasAttribute('data-multi')) chip.classList.toggle('on');
      else $$('.chip', g).forEach(x => x.classList.toggle('on', x === chip));
      jelly(chip);
      g.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    const sb = e.target.closest('.stepper button');
    if (sb) {
      const inp = $('input', sb.parentElement);
      const v = clamp((parseInt(inp.value, 10) || 0) + Number(sb.dataset.d), +inp.min, +inp.max);
      if (v !== +inp.value) { inp.value = v; bump(inp); sfx.tick(); inp.dispatchEvent(new Event('input', { bubbles: true })); }
      else shake(sb.parentElement);
    }
  });
}
const chipVal = g => $('.chip.on', g)?.dataset.v ?? '';
const chipVals = g => g ? $$('.chip.on', g).map(x => x.dataset.v) : [];
const stepper = (id, val, min, max) => `<div class="stepper"><button type="button" data-d="-1">−</button><input type="number" id="${id}" value="${val}" min="${min}" max="${max}"><button type="button" data-d="1">+</button></div>`;

function confirmDlg(title, msg, okLabel = 'Đồng ý', danger = false, icon = '🤔') {
  return new Promise(res => {
    let v = false;
    modal({ title, icon, body: `<p>${msg}</p>`, onClose: () => res(v),
      actions: [{ label: 'Thôi', cls: 'ghost' }, { label: okLabel, cls: danger ? 'danger' : 'primary', onClick: () => { v = true; } }] });
  });
}
function askText(title, label, value = '', icon = '✏️') {
  return new Promise(res => {
    let v = null;
    const m = modal({ title, icon, body: `<div class="field"><label>${label}</label><input class="inp" id="askIn" value="${esc(value)}" autofocus></div>`,
      onClose: () => res(v),
      actions: [{ label: 'Hủy', cls: 'ghost' }, { label: 'Lưu', cls: 'primary', onClick: api => {
        const t = $('#askIn', api.el).value.trim(); if (!t) { shake($('#askIn', api.el)); return false; } v = t;
      } }] });
    $('#askIn', m.el).addEventListener('keydown', e => { if (e.key === 'Enter') $('.modal-foot .primary', m.el).click(); });
  });
}

/* ---------------- Student modal ---------------- */
function openStudent(id) {
  const c = cls(), isNew = !id;
  const s = isNew ? mkStudent({ name: '' }) : c.students.find(x => x.id === id);
  if (!s) return;
  const seatK = isNew ? null : seatOfId(c, s.id);
  const others = c.students.filter(x => x.id !== s.id).sort(viCmp);
  let photo = photoOf(s, c);
  const chips = (items, cur) => items.map(([v, l]) => `<button type="button" class="chip${cur === v ? ' on' : ''}" data-v="${v}">${l}</button>`).join('');
  const body = `
    <div class="stu-hero">
      <label class="ava-edit" id="avaDrop" title="Bấm để chọn ảnh, hoặc kéo thả ảnh vào đây">
        <input type="file" accept="image/*" id="fPhoto" hidden>
        <span class="ava big" id="heroAva" style="--av:${avatarColor(s)};--avt:${avatarInk(s)}"></span><span class="ava-cam">📷</span>
      </label>
      <div class="hero-side">
        ${seatK ? `<span class="pill">🪑 ${seatLabel(seatK)}</span>` : `<span class="pill muted">${isNew ? '🌱 Học sinh mới' : '⏳ Chưa có chỗ'}</span>`}
        <div class="photo-btns"><button type="button" class="btn sm" id="pPick">📷 <span id="pPickTxt">Thêm ảnh</span></button><button type="button" class="btn sm ghost" id="pDel">🗑 Xóa ảnh</button></div>
      </div>
    </div>
    <div class="field"><label>Họ và tên</label><input id="fName" class="inp" value="${esc(s.name)}" placeholder="VD: Nguyễn Minh Anh" autofocus></div>
    <div class="grid2">
      <div class="field"><label>Giới tính</label><div class="chips" id="fGender">${chips([['F', '🎀 Nữ'], ['M', '🧢 Nam'], ['', '🤍 Chưa rõ']], s.gender)}</div></div>
      <div class="field"><label>Chiều cao (cm)</label><input id="fHeight" class="inp" type="number" min="60" max="210" value="${esc(s.height)}" placeholder="VD: 125"></div>
    </div>
    <div class="field"><label>Học lực</label><div class="chips" id="fLevel">${chips([['G', '🌟 Giỏi / Tốt'], ['K', '🌼 Khá'], ['T', '🍀 TB / Đạt'], ['Y', '🌱 Cần cố gắng'], ['', '— Chưa có']], s.level)}</div></div>
    <label class="switch"><input type="checkbox" id="fPrio" ${s.priority ? 'checked' : ''}><span></span>👓 Ưu tiên ngồi bàn đầu <small>(mắt kém, thấp bé, cần chú ý…)</small></label>
    <div class="field"><label>Ghi chú</label><input id="fNote" class="inp" value="${esc(s.note)}" placeholder="VD: Cận thị, hay nói chuyện…"></div>
    ${others.length ? `<div class="field"><label>🙅 Không nên ngồi gần <small>— khi xếp tự động sẽ tách ra</small></label>
      ${others.length > 12 ? '<input class="inp sm" id="fAvoidQ" placeholder="Lọc tên…">' : ''}
      <div class="chips avoid-box" data-multi id="fAvoid">${others.map(o => `<button type="button" class="chip${s.avoid.includes(o.id) ? ' on' : ''}" data-v="${o.id}" data-n="${esc(norm(o.name))}">${esc(o.name)}</button>`).join('')}</div></div>` : ''}
    ${seatK ? `<div class="seat-actions"><button type="button" class="btn sm" id="sLock">${c.locked.includes(seatK) ? '🔓 Mở khóa chỗ' : '🔒 Khóa chỗ này'}</button><button type="button" class="btn sm" id="sOut">↩️ Đưa về danh sách</button></div>` : ''}`;

  const saveFrom = api => {
    const el = api.el, name = $('#fName', el).value.trim().replace(/\s+/g, ' ');
    if (!name) { shake($('#fName', el)); $('#fName', el).focus(); toast('Cô nhập tên học sinh nhé 🌷', 'warn'); return false; }
    const data = { name, gender: chipVal($('#fGender', el)), level: chipVal($('#fLevel', el)),
      height: parseInt($('#fHeight', el).value, 10) || '', priority: $('#fPrio', el).checked, note: $('#fNote', el).value.trim() };
    const avoid = $('#fAvoid', el) ? chipVals($('#fAvoid', el)) : s.avoid;
    withFlip(() => {
      commit();
      Object.assign(s, data);
      if (photo) c.photos[s.id] = photo; else delete c.photos[s.id];
      c.students.forEach(o => {
        if (o.id === s.id) return;
        const want = avoid.includes(o.id), has = o.avoid.includes(s.id);
        if (want && !has) o.avoid.push(s.id);
        if (!want && has) o.avoid = o.avoid.filter(x => x !== s.id);
      });
      s.avoid = avoid;
      if (isNew) c.students.push(s);
    });
    sfx.pop();
    if (isNew) toast(`Chào mừng <b>${esc(given(name))}</b> đến với lớp! 🎈`);
    return true;
  };
  const actions = isNew
    ? [{ label: 'Hủy', cls: 'ghost' },
       { label: 'Lưu & thêm bạn khác', cls: 'lav', onClick: api => { if (!saveFrom(api)) return false; setTimeout(() => openStudent(null), 230); } },
       { label: '💕 Thêm vào lớp', cls: 'primary', onClick: saveFrom }]
    : [{ label: '🗑 Xóa', cls: 'danger', left: true, onClick: async () => {
          const ok = await confirmDlg('Xóa học sinh?', `Xóa <b>${esc(s.name)}</b> khỏi lớp? (Có thể bấm ↶ để hoàn tác)`, 'Xóa', true, '🗑');
          if (!ok) return false;
          withFlip(() => {
            commit();
            c.students = c.students.filter(x => x.id !== s.id);
            c.students.forEach(o => { o.avoid = o.avoid.filter(x => x !== s.id); });
          });
          toast(`Đã xóa ${esc(s.name)}`, 'info');
        } },
       { label: 'Hủy', cls: 'ghost' },
       { label: '💾 Lưu', cls: 'primary', onClick: saveFrom }];

  const m = modal({ title: isNew ? 'Thêm học sinh' : 'Thông tin học sinh', icon: isNew ? '🐣' : '🎒', body, actions });
  const el = m.el;
  function drawHero() {
    const a = $('#heroAva', el), t = $('#fName', el).value.trim();
    a.classList.toggle('photo', !!photo);
    a.style.backgroundImage = photo ? `url(${photo})` : '';
    a.textContent = photo ? '' : t ? (given(t)[0] || '?').toUpperCase() : '?';
    $('#pDel', el).hidden = !photo;
    $('#pPickTxt', el).textContent = photo ? 'Đổi ảnh' : 'Thêm ảnh';
  }
  async function takePhoto(file) {
    if (!file) return;
    try { photo = await resizePhoto(file); drawHero(); jelly($('#heroAva', el)); sfx.pop(); }
    catch (e) { toast('Không đọc được ảnh này 😢 — thử ảnh JPG / PNG khác nhé', 'warn'); }
  }
  drawHero();
  $('#fPhoto', el).addEventListener('change', e => { takePhoto(e.target.files[0]); e.target.value = ''; });
  $('#pPick', el).addEventListener('click', () => $('#fPhoto', el).click());
  $('#pDel', el).addEventListener('click', () => { photo = ''; drawHero(); jelly($('#heroAva', el)); });
  const drop = $('#avaDrop', el);
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => takePhoto(e.dataTransfer.files[0]));
  $('#fName', el).addEventListener('input', e => {
    const t = e.target.value.trim(); if (!photo) $('#heroAva', el).textContent = t ? (given(t)[0] || '?').toUpperCase() : '?';
    if (isNew && !chipVal($('#fGender', el)).length) {
      const g = guessGender(t);
      if (g) $$('#fGender .chip', el).forEach(x => x.classList.toggle('on', x.dataset.v === g));
    }
  });
  $('#fName', el).addEventListener('keydown', e => { if (e.key === 'Enter') $('.modal-foot .primary', el).click(); });
  $('#fGender', el).addEventListener('change', () => {
    const g = chipVal($('#fGender', el)), h = (g === 'F' ? 338 : g === 'M' ? 205 : 268) + hash(s.id) % 30 - 15;
    const a = $('#heroAva', el); a.style.setProperty('--av', `hsl(${h} 92% 84%)`); a.style.setProperty('--avt', `hsl(${h} 45% 34%)`); jelly(a);
  });
  $('#fAvoidQ', el)?.addEventListener('input', e => {
    const q = norm(e.target.value);
    $$('#fAvoid .chip', el).forEach(ch => { ch.hidden = q && !ch.dataset.n.includes(q); });
  });
  $('#sLock', el)?.addEventListener('click', () => { m.close(); toggleLock(seatK); });
  $('#sOut', el)?.addEventListener('click', () => { m.close(); unseat(seatK); });
}

/* ---------------- Class list modal ---------------- */
function openList() {
  const c = cls(), seatMap = new Map(Object.entries(c.seats).map(([k, id]) => [id, k]));
  const list = [...c.students].sort(viCmp);
  const body = list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Họ và tên</th><th>GT</th><th>Học lực</th><th>Cao</th><th>Chỗ ngồi</th></tr></thead><tbody>
    ${list.map((s, i) => `<tr data-id="${s.id}"><td>${i + 1}</td><td><span class="tbl-ava" style="--av:${avatarColor(s)};--avt:${avatarInk(s)}">${avaHTML(s, photoOf(s, c))}</span><b>${esc(s.name)}</b> ${s.priority ? '👓' : ''}${s.avoid.length ? ' 🙅' : ''}</td><td>${s.gender === 'F' ? '🎀 Nữ' : s.gender === 'M' ? '🧢 Nam' : '—'}</td>
    <td>${LEVEL_SHORT[s.level] || '—'}</td><td>${s.height ? s.height + ' cm' : '—'}</td><td>${seatMap.has(s.id) ? seatLabel(seatMap.get(s.id)) : '<span class="hint">Chưa có chỗ</span>'}</td></tr>`).join('')}
    </tbody></table></div><p class="hint">💡 Bấm vào một dòng để sửa thông tin học sinh.</p>`
    : `<div class="empty"><div class="empty-ico">🐣</div><b>Lớp chưa có học sinh</b></div>`;
  const m = modal({ title: `Danh sách ${esc(c.name)} · ${list.length} học sinh`, icon: '📋', wide: true, body,
    actions: [
      ...(list.length ? [{ label: '🗑 Xóa cả danh sách', cls: 'danger', left: true, onClick: async () => {
        const ok = await confirmDlg('Xóa toàn bộ học sinh?', `Toàn bộ <b>${list.length}</b> học sinh của ${esc(c.name)} sẽ bị xóa. Có thể bấm ↶ để hoàn tác.`, 'Xóa hết', true, '⚠️');
        if (!ok) return false;
        withFlip(() => { commit(); c.students = []; c.seats = {}; c.locked = []; });
      } }] : []),
      ...(list.length ? [{ label: '📷 Ảnh hàng loạt', cls: 'lav', onClick: () => { bulkPhotos(); } }] : []),
      { label: '＋ Thêm học sinh', cls: 'mint', onClick: () => { setTimeout(() => openStudent(null), 200); } },
      { label: 'Đóng', cls: 'primary' }] });
  $$('tr[data-id]', m.el).forEach(tr => tr.addEventListener('click', () => { m.close(); setTimeout(() => openStudent(tr.dataset.id), 200); }));
}

/* ---------------- Bulk photos: match image file names to student names ---------------- */
function bulkPhotos() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
  inp.onchange = async () => {
    const c = cls(), files = [...inp.files];
    if (!files.length) return;
    toast(`⏳ Đang xử lý ${files.length} ảnh…`, 'info');
    const key = t => norm(t).replace(/[^a-z0-9]/g, '');
    const byFull = new Map(c.students.map(s => [key(s.name), s]));
    const givenCount = new Map();
    c.students.forEach(s => { const g = key(given(s.name)); givenCount.set(g, (givenCount.get(g) || 0) + 1); });
    const byGiven = new Map(c.students.filter(s => givenCount.get(key(given(s.name))) === 1).map(s => [key(given(s.name)), s]));
    const done = [], miss = [];
    for (const f of files) {
      const k = key(f.name.replace(/\.[^.]+$/, '').replace(/^\s*\d+[\s._-]+/, ''));
      const s = byFull.get(k) || byGiven.get(k);
      if (!s) { miss.push(f.name); continue; }
      try { done.push([s, await resizePhoto(f)]); } catch (e) { miss.push(f.name); }
    }
    if (done.length) {
      done.forEach(([s, p]) => { c.photos[s.id] = p; });
      save(); render(); sfx.success(); confettiPop();
      done.forEach(([s]) => { const el = cardEl(s.id); if (el) jelly(el); });
    }
    toast(done.length
      ? `📷 Đã gắn ảnh cho ${done.length} bạn${miss.length ? ` · ${miss.length} ảnh không khớp tên (VD: ${esc(miss[0])})` : ''}`
      : 'Không ảnh nào khớp tên học sinh 🤔 — đặt tên file theo họ tên, VD: “Nguyen Minh Anh.jpg”', done.length ? 'ok' : 'warn');
  };
  inp.click();
}

/* ---------------- Quick gender editor ---------------- */
function openGender(onlyUnknown = true) {
  const c = cls();
  if (!c.students.length) return toast('Lớp chưa có học sinh nào 🥺', 'info');
  const draft = new Map(c.students.map(s => [s.id, s.gender]));
  const guessed = new Set();
  let showAll = !onlyUnknown || c.students.every(s => s.gender);
  const body = `
    <p class="hint">Bấm <b>🎀 Nữ</b> hoặc <b>🧢 Nam</b> cho từng bạn (bấm lại để bỏ chọn). Giới tính dùng cho thống kê và kiểu xếp <b>xen kẽ nam – nữ</b>.</p>
    <div class="g-tools">
      <div class="chips" id="gScope"><button type="button" class="chip${showAll ? '' : ' on'}" data-v="unknown">🤍 Chỉ bạn chưa rõ</button><button type="button" class="chip${showAll ? ' on' : ''}" data-v="all">👥 Cả lớp</button></div>
      <button type="button" class="btn sm lav" id="gGuess">🪄 Đoán theo tên</button>
    </div>
    <div class="g-sum" id="gSum"></div>
    <div class="g-list" id="gList"></div>`;
  const m = modal({ title: 'Cập nhật giới tính', icon: '🎀', wide: true, body,
    actions: [{ label: 'Hủy', cls: 'ghost' }, { label: '💾 Lưu', cls: 'primary', onClick: () => {
      const changed = c.students.filter(s => draft.get(s.id) !== s.gender).length;
      if (!changed) return;
      commit();
      c.students.forEach(s => { s.gender = draft.get(s.id); });
      save(); render(); sfx.success();
      toast(`Đã cập nhật giới tính cho ${changed} bạn 🎀`);
    } }] });
  const el = m.el;
  function sum() {
    const v = [...draft.values()], f = v.filter(g => g === 'F').length, mm = v.filter(g => g === 'M').length;
    $('#gSum', el).innerHTML = `<span class="pill" style="background:#ffe6ef;color:#c4457a">🎀 ${f} nữ</span><span class="pill" style="background:#e3f2ff;color:#3a78b5">🧢 ${mm} nam</span>${v.length - f - mm ? `<span class="pill muted">🤍 ${v.length - f - mm} chưa rõ</span>` : '<span class="pill">✅ Đủ cả lớp</span>'}`;
  }
  function draw() {
    const list = [...c.students].sort(viCmp).filter(s => showAll || !s.gender || guessed.has(s.id) || draft.get(s.id) !== s.gender);
    $('#gList', el).innerHTML = list.length ? list.map((s, i) => {
      const g = draft.get(s.id);
      return `<div class="g-row${guessed.has(s.id) ? ' guess' : ''}" data-id="${s.id}" style="animation-delay:${Math.min(i * 15, 400)}ms">
        <span class="g-name">${esc(s.name)}${guessed.has(s.id) ? '<em>đoán</em>' : ''}</span>
        <button type="button" class="chip${g === 'F' ? ' on f' : ''}" data-g="F">🎀 Nữ</button><button type="button" class="chip${g === 'M' ? ' on m' : ''}" data-g="M">🧢 Nam</button></div>`;
    }).join('') : `<div class="empty"><div class="empty-ico">🎉</div><b>Bạn nào cũng có giới tính rồi!</b></div>`;
    sum();
  }
  $('#gList', el).addEventListener('click', e => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    const row = b.closest('.g-row'), id = row.dataset.id;
    draft.set(id, draft.get(id) === b.dataset.g ? '' : b.dataset.g);
    guessed.delete(id);
    row.classList.remove('guess'); $('em', row)?.remove();
    $$('[data-g]', row).forEach(x => { const on = x.dataset.g === draft.get(id); x.classList.toggle('on', on); x.classList.toggle('f', on && x.dataset.g === 'F'); x.classList.toggle('m', on && x.dataset.g === 'M'); });
    jelly(b); sfx.tick(); sum();
  });
  $('#gScope', el).addEventListener('change', () => { showAll = chipVal($('#gScope', el)) === 'all'; draw(); });
  $('#gGuess', el).addEventListener('click', () => {
    let n = 0;
    c.students.forEach(s => { if (draft.get(s.id)) return; const g = guessGender(s.name); if (g) { draft.set(s.id, g); guessed.add(s.id); n++; } });
    draw();
    const left = [...draft.values()].filter(g => !g).length;
    toast(n ? `🪄 Đã đoán ${n} bạn — cô xem lại các dòng “đoán” nhé${left ? ` · còn ${left} bạn cần chọn tay` : ''}` : 'Không đoán thêm được bạn nào — cô chọn tay giúp mình nhé 🙏', n ? 'ok' : 'info');
  });
  draw();
}

/* ---------------- Import ---------------- */
const scriptCache = {};
function loadScript(url) {
  return scriptCache[url] ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = url; s.onload = res;
    s.onerror = () => { delete scriptCache[url]; rej(new Error('load')); };
    document.head.appendChild(s);
  });
}
function splitLine(l, d) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (q) { if (ch === '"') { if (l[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === d) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur); return out;
}
function parseDelimited(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  const sample = lines.slice(0, 15).join('\n');
  const count = d => sample.split(d).length - 1;
  const delim = ['\t', ';', ','].sort((a, b) => count(b) - count(a))[0];
  if (!count(delim)) return lines.map(l => [l]);
  return lines.map(l => splitLine(l, delim));
}
async function readFileRows(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (['xlsx', 'xls', 'ods', 'xlsm'].includes(ext)) {
    try { await loadScript(XLSX_URL); } catch (e) { throw new Error('Không tải được bộ đọc Excel (cần Internet). Cô có thể lưu file dạng CSV rồi nhập lại nhé.'); }
    const wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array' });
    let best = [];
    for (const name of wb.SheetNames) {
      const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false });
      if (rowsToStudents(rows).length > rowsToStudents(best).length) best = rows;
    }
    return best;
  }
  const buf = await file.arrayBuffer();
  let text = new TextDecoder('utf-8').decode(buf);
  if (text.includes('�')) { try { text = new TextDecoder('windows-1258').decode(buf); } catch (e) { /* keep utf-8 */ } }
  return parseDelimited(text);
}
function parseGender(v) {
  const n = norm(v); if (!n) return '';
  if (/^(nu|f|female|gai|girl|be gai)$/.test(n) || n.startsWith('nu ')) return 'F';
  if (/^(nam|m|male|trai|boy|be trai)$/.test(n) || n.startsWith('nam ')) return 'M';
  return '';
}
function parseLevel(v) {
  const n = norm(v); if (!n) return '';
  if (/^(chua dat|chua hoan thanh|yeu|kem|can co gang|cht|y)$/.test(n)) return 'Y';
  if (/^(gioi|tot|xuat sac|hoan thanh tot|htt|g|xs|t)$/.test(n)) return 'G';
  if (/^(kha|k)$/.test(n)) return 'K';
  if (/^(trung binh|tb|dat|hoan thanh|ht|d)$/.test(n)) return 'T';
  return '';
}
// Common Vietnamese given names (without diacritics). Ambiguous ones (Anh, Thanh, Khánh, Minh, Dung/Dũng…) are left out on purpose.
const F_GIVEN = new Set(('lan hoa mai linh trang huong thao ngoc nhi vy vi tram ha my hang nga yen chi chau han nhu quynh uyen thu diep ngan phuong ' +
  'thuy huyen duyen loan nhung oanh trinh tuyet van hien hanh hong ly nguyet tham thoa truc diem dao hue lien nhien suong xuyen kieu ' +
  'giao thy tuyen dieu cuc ngoan thom tra').split(' '));
const M_GIVEN = new Set(('hung tuan nam huy khoa khoi bao phuc quan dat thang kiet long hai son tung cuong duc hieu hoang khang lam loc nghia phong ' +
  'quang tai thinh toan trung viet vinh vu hao duy danh dong hiep hau kien luc manh nhat phat quy tri trong vuong thien thuan tin sang thai ' +
  'huan khai luan lap bach thach dang cong doan phu nguyen truong quoc tho hoan chien hoc dinh ky khiem lanh').split(' '));
const F_MID = new Set('thi dieu thuy quynh phuong kieu tuyet nguyet ngoc thu mai tram'.split(' '));
const M_MID = new Set('van duc huu cong quoc dinh trong manh quang tien tuan'.split(' '));
function guessGender(name) {
  const w = norm(name).split(' ');
  if (w.length < 2) return '';
  const mid = w.slice(1, -1), g = w[w.length - 1];
  if (mid.includes('thi')) return 'F';
  if (mid.includes('van')) return 'M';
  if (F_GIVEN.has(g)) return 'F';
  if (M_GIVEN.has(g)) return 'M';
  if (mid.some(x => F_MID.has(x))) return 'F';
  if (mid.some(x => M_MID.has(x))) return 'M';
  return '';
}
const cleanName = s => String(s || '').replace(/^\s*\d+\s*[.)\-:/]\s*/, '').replace(/\s+/g, ' ').trim();
const JUNK = /^(danh sach|lop \d|lop hoc|truong (th|thcs|thpt|tieu hoc|mam non|trung hoc)|giao vien|gvcn|tong (cong|so)|si so|nam hoc|stt$|ho va ten|ho ten$|hoc ky|ngay \d|nguoi lap|xac nhan|ky ten)/;
function rowsToStudents(rows) {
  rows = (rows || []).map(r => (Array.isArray(r) ? r : [r]).map(x => String(x ?? '').trim())).filter(r => r.some(Boolean));
  if (!rows.length) return [];
  let hi = -1, col = {};
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const c = {};
    rows[i].map(norm).forEach((t, j) => {
      if (c.name == null && /^(ho (va )?ten( hoc sinh| hs| hoc vien)?|ten hoc sinh|hoc sinh|ten hs|full ?name|name|student|hoten|ho & ten)$/.test(t)) c.name = j;
      else if (c.last == null && /^(ho( va)?( ten)? dem|ho dem|ho|ho lot)$/.test(t)) c.last = j;
      else if (c.first == null && /^ten$/.test(t)) c.first = j;
      else if (c.gender == null && /^(gioi tinh|gt|phai|gender|sex|gioi)$/.test(t)) c.gender = j;
      else if (c.female == null && /^nu$/.test(t)) c.female = j;
      else if (c.level == null && /(hoc luc|xep loai|danh gia|nang luc|ket qua|level)/.test(t)) c.level = j;
      else if (c.height == null && /(chieu cao|^cao|height)/.test(t)) c.height = j;
      else if (c.note == null && /(ghi chu|note|luu y)/.test(t)) c.note = j;
      else if (c.prio == null && /(uu tien|can thi|mat kem)/.test(t)) c.prio = j;
    });
    if (c.name != null || c.first != null) { hi = i; col = c; break; }
  }
  const body = rows.slice(hi + 1);
  if (hi < 0) {
    const width = Math.max(...rows.map(r => r.length));
    let best = 0, bs = -1;
    for (let j = 0; j < width; j++) {
      const sc = rows.reduce((a, r) => { const v = r[j] || ''; return a + (/\p{L}{2,}/u.test(v) && !parseGender(v) && !parseLevel(v) ? (v.split(/\s+/).length >= 2 ? 2 : 1) : 0); }, 0);
      if (sc > bs) { bs = sc; best = j; }
    }
    col.name = best;
    for (let j = 0; j < width; j++) {
      if (j === best) continue;
      if (col.gender == null && rows.filter(r => parseGender(r[j])).length >= rows.length * .5) col.gender = j;
      else if (col.level == null && rows.filter(r => parseLevel(r[j])).length >= rows.length * .5) col.level = j;
      else if (col.height == null && rows.filter(r => /^\d{2,3}$/.test(r[j] || '') && +r[j] > 80 && +r[j] < 210).length >= rows.length * .5) col.height = j;
    }
  } else if (col.name != null && col.first == null) {
    // "Họ và tên" merged over two columns: [Nguyễn Văn][An]
    const j = col.name + 1, head = rows[hi][j] || '';
    if (!head && body.filter(r => /^\p{L}+$/u.test(r[j] || '')).length >= body.length * .6) col.first = j;
  }
  const out = [];
  for (const r of body) {
    let name = col.name != null ? r[col.name] || '' : '';
    if (col.first != null && col.first !== col.name) name = col.name != null ? `${name} ${r[col.first] || ''}` : `${r[col.last] || ''} ${r[col.first] || ''}`;
    name = cleanName(name);
    if (!name || !/\p{L}/u.test(name) || JUNK.test(norm(name)) || name.split(' ').length > 7) continue;
    const pv = col.prio != null ? norm(r[col.prio]) : '';
    out.push({
      name,
      gender: col.gender != null ? parseGender(r[col.gender]) || guessGender(name) : col.female != null ? (r[col.female] ? 'F' : 'M') : guessGender(name),
      level: col.level != null ? parseLevel(r[col.level]) : '',
      height: col.height != null ? parseInt(r[col.height], 10) || '' : '',
      note: col.note != null ? r[col.note] || '' : '',
      priority: !!pv && !/^(0|khong|no|false)$/.test(pv),
    });
  }
  return out;
}
function downloadTemplate() {
  const csv = '﻿STT,Họ và tên,Giới tính,Học lực,Chiều cao,Ưu tiên,Ghi chú\n1,Nguyễn Minh Anh,Nữ,Giỏi,125,x,Cận thị\n2,Trần Gia Bảo,Nam,Khá,130,,\n3,Lê Ngọc Châu,Nữ,Trung bình,122,,\n';
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'mau-danh-sach-hoc-sinh.csv');
}
function openImport(preset = 'append') {
  let parsed = [];
  const c = cls();
  const body = `
    <div class="tabs"><button type="button" class="tab on" data-tab="file">📄 Từ file Excel / CSV</button><button type="button" class="tab" data-tab="paste">✍️ Dán danh sách</button></div>
    <div data-pane="file">
      <label class="dropzone" id="dz"><input type="file" id="fileIn" accept=".xlsx,.xls,.xlsm,.ods,.csv,.txt,.json" hidden>
        <div class="dz-ico">📂</div><b>Kéo thả file vào đây</b><span>hoặc bấm để chọn file · .xlsx, .xls, .csv, .txt · hoặc file sơ đồ được chia sẻ (.json)</span></label>
      <p class="hint" style="margin-top:8px">💡 Chỉ cần có cột <b>Họ và tên</b>. Có thể thêm <b>Giới tính</b>, <b>Học lực</b>, <b>Chiều cao</b>, <b>Ưu tiên</b>, <b>Ghi chú</b> — web tự nhận diện. <a id="dlTpl">Tải file mẫu</a></p>
    </div>
    <div data-pane="paste" hidden>
      <textarea id="pasteIn" placeholder="Mỗi dòng một học sinh, ví dụ:&#10;Nguyễn Minh Anh, Nữ&#10;Trần Gia Bảo, Nam&#10;&#10;Hoặc copy thẳng các cột từ Excel rồi dán vào đây 💕"></textarea>
    </div>
    <div class="preview" id="pv" hidden></div>
    <div class="field" id="imMode" hidden><label>Nhập vào đâu?</label>
      <div class="chips" id="modeChips">
        <button type="button" class="chip${preset === 'append' ? ' on' : ''}" data-v="append">➕ Thêm vào ${esc(c.name)}</button>
        <button type="button" class="chip${preset === 'replace' ? ' on' : ''}" data-v="replace">🔄 Thay cả danh sách ${esc(c.name)}</button>
        <button type="button" class="chip${preset === 'new' ? ' on' : ''}" data-v="new">🏫 Tạo lớp mới</button>
      </div>
      <input class="inp" id="newName" placeholder="Tên lớp mới, VD: Lớp 4B" ${preset === 'new' ? '' : 'hidden'}>
    </div>`;
  const m = modal({ title: 'Nhập danh sách học sinh', icon: '📥', wide: true, body,
    actions: [{ label: 'Hủy', cls: 'ghost' }, { label: '✨ Nhập vào lớp', cls: 'primary', onClick: api => {
      const list = parsed.filter(s => !s.skip);
      if (!list.length) { toast('Chưa có học sinh nào để nhập 🥺', 'warn'); shake($('#dz', api.el)); return false; }
      const mode = chipVal($('#modeChips', api.el));
      doImport(list, mode, $('#newName', api.el).value.trim());
    } }] });
  const el = m.el;
  const existing = () => chipVal($('#modeChips', el)) === 'append' ? new Set(cls().students.map(s => norm(s.name))) : new Set();
  function drawPreview() {
    const pv = $('#pv', el);
    $('#imMode', el).hidden = pv.hidden = !parsed.length;
    if (!parsed.length) return;
    const ex = existing(), seen = new Set();
    parsed.forEach(s => { const n = norm(s.name); s.skip = ex.has(n) || seen.has(n); seen.add(n); });
    const ok = parsed.filter(s => !s.skip), f = ok.filter(s => s.gender === 'F').length, mm = ok.filter(s => s.gender === 'M').length;
    pv.innerHTML = `<div class="pv-head"><b>🎉 Tìm thấy ${ok.length} học sinh</b><span class="pill">🎀 ${f} nữ</span><span class="pill" style="background:#e3f2ff;color:#3a78b5">🧢 ${mm} nam</span>
      ${ok.length - f - mm ? `<span class="pill muted">🤍 ${ok.length - f - mm} chưa rõ</span>` : ''}${parsed.length - ok.length ? `<span class="pill muted">${parsed.length - ok.length} bị trùng — bỏ qua</span>` : ''}</div>
      <div class="pv-list">${parsed.map((s, i) => `<span class="pv-chip ${s.gender}${s.skip ? ' dup' : ''}" data-i="${i}" title="Bấm để đổi giới tính" style="animation-delay:${Math.min(i * 12, 500)}ms">${s.gender === 'F' ? '🎀' : s.gender === 'M' ? '🧢' : '🤍'} ${esc(s.name)}<button type="button" data-x="${i}" title="Bỏ bạn này">✕</button></span>`).join('')}</div>
      <p class="hint">💡 Bấm vào tên để đổi giới tính · bấm ✕ để bỏ.</p>`;
  }
  async function handleFile(file) {
    if (!file) return;
    if (/\.json$/i.test(file.name)) { m.close(); setTimeout(() => openJsonFile(file), 200); return; }
    const dz = $('#dz', el);
    $('b', dz).textContent = `⏳ Đang đọc “${file.name}”…`;
    try {
      parsed = rowsToStudents(await readFileRows(file));
      $('b', dz).textContent = `✅ ${file.name}`;
      if (!parsed.length) toast('Không tìm thấy tên học sinh trong file 🤔 — thử tải file mẫu xem cấu trúc nhé', 'warn');
      else { sfx.pop(); confettiPop(innerWidth / 2, innerHeight / 2); }
    } catch (err) {
      parsed = []; $('b', dz).textContent = 'Kéo thả file vào đây';
      toast(err.message || 'Không đọc được file này 😢', 'warn');
    }
    drawPreview();
  }
  $$('.tab', el).forEach(t => t.addEventListener('click', () => {
    $$('.tab', el).forEach(x => x.classList.toggle('on', x === t));
    $$('[data-pane]', el).forEach(p => { p.hidden = p.dataset.pane !== t.dataset.tab; });
    if (t.dataset.tab === 'paste') $('#pasteIn', el).focus();
  }));
  $('#fileIn', el).addEventListener('change', e => handleFile(e.target.files[0]));
  const dz = $('#dz', el);
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
  dz.addEventListener('drop', e => handleFile(e.dataTransfer.files[0]));
  $('#dlTpl', el).addEventListener('click', e => { e.preventDefault(); downloadTemplate(); });
  let pt;
  $('#pasteIn', el).addEventListener('input', e => { clearTimeout(pt); pt = setTimeout(() => { parsed = rowsToStudents(parseDelimited(e.target.value)); drawPreview(); }, 250); });
  $('#modeChips', el).addEventListener('change', () => { $('#newName', el).hidden = chipVal($('#modeChips', el)) !== 'new'; drawPreview(); });
  $('#pv', el).addEventListener('click', e => {
    const x = e.target.closest('[data-x]');
    if (x) { parsed.splice(+x.dataset.x, 1); drawPreview(); return; }
    const chip = e.target.closest('.pv-chip');
    if (chip) { const s = parsed[+chip.dataset.i]; s.gender = s.gender === 'F' ? 'M' : s.gender === 'M' ? '' : 'F'; drawPreview(); }
  });
}
function doImport(list, mode, newName) {
  let added = 0;
  if (mode === 'new') {
    const c = newClass(newName || `Lớp mới ${db.classes.length + 1}`);
    c.students = list.map(mkStudent); added = list.length;
    withFlip(() => { db.classes.push(c); db.current = c.id; }, { stagger: 14 });
  } else {
    const c = cls();
    withFlip(() => {
      commit();
      if (mode === 'replace') { c.students = []; c.seats = {}; c.locked = []; }
      list.forEach(s => { c.students.push(mkStudent(s)); added++; });
    }, { stagger: 14 });
  }
  sfx.success(); confettiCannons();
  toast(`Đã nhập ${added} học sinh vào <b>${esc(cls().name)}</b> 🎉 — bấm ✨ Xếp tự động hoặc kéo thả nhé!`);
}

/* ---------------- Arrange modal ---------------- */
function openArrange() {
  const c = cls(), o = { ...db.settings.arrange };
  const hasLevel = c.students.some(s => s.level), hasHeight = c.students.some(s => s.height);
  const prioN = c.students.filter(s => s.priority).length;
  const pairN = c.students.reduce((a, s) => a + s.avoid.length, 0) / 2;
  const lockN = c.locked.length;
  const modes = [
    ['random', '🎲', 'Ngẫu nhiên', 'Trộn đều cả lớp, mỗi lần một kiểu mới'],
    ['alt', '👫', 'Xen kẽ nam – nữ', 'Nam ngồi cạnh nữ, xếp kiểu bàn cờ'],
    ['pair', '🤝', 'Đôi bạn cùng tiến', 'Ghép bạn học tốt với bạn cần hỗ trợ', !hasLevel && 'Chưa nhập học lực'],
    ['height', '📏', 'Thấp trước, cao sau', 'Bạn thấp ngồi trên, bạn cao ngồi dưới', !hasHeight && 'Chưa nhập chiều cao'],
    ['abc', '🔤', 'Theo ABC', 'Theo tên, từ bàn đầu đến bàn cuối'],
  ];
  const body = `
    <div class="mode-grid" id="modes">${modes.map(m => `<button type="button" class="mode${o.mode === m[0] ? ' on' : ''}" data-v="${m[0]}"><span class="mode-e">${m[1]}</span><b>${m[2]}</b><small>${m[3]}</small>${m[4] ? `<em>⚠️ ${m[4]}</em>` : ''}</button>`).join('')}</div>
    <div class="opt-list">
      <div class="field"><label>Phạm vi</label><div class="chips" id="scope">
        <button type="button" class="chip${o.scope === 'all' ? ' on' : ''}" data-v="all">🔄 Xếp lại cả lớp</button>
        <button type="button" class="chip${o.scope === 'empty' ? ' on' : ''}" data-v="empty">➕ Chỉ xếp bạn chưa có chỗ</button></div></div>
      <label class="switch"><input type="checkbox" id="oPrio" ${o.priority ? 'checked' : ''}><span></span>👓 Bạn <b>ưu tiên</b> ngồi bàn đầu <small>(${prioN} bạn)</small></label>
      <label class="switch"><input type="checkbox" id="oAvoid" ${o.avoid ? 'checked' : ''}><span></span>🙅 Tách các bạn <b>không nên ngồi gần</b> <small>(${pairN} cặp)</small></label>
      <p class="hint">🔒 ${lockN ? `${lockN} chỗ đã khóa sẽ được giữ nguyên.` : 'Mẹo: khóa chỗ một bạn (bấm 🔓 trên thẻ) để giữ nguyên bạn đó khi xếp.'}</p>
    </div>`;
  const m = modal({ title: 'Xếp chỗ tự động', icon: '✨', wide: true, body,
    actions: [{ label: 'Hủy', cls: 'ghost' }, { label: '✨ Xếp ngay!', cls: 'primary', onClick: api => {
      const el = api.el;
      const opts = { mode: $('#modes .mode.on', el)?.dataset.v || 'random', scope: chipVal($('#scope', el)) || 'all', priority: $('#oPrio', el).checked, avoid: $('#oAvoid', el).checked };
      db.settings.arrange = opts; save();
      setTimeout(() => runArrange(opts), 220);
    } }] });
  $('#modes', m.el).addEventListener('click', e => {
    const b = e.target.closest('.mode'); if (!b) return;
    $$('#modes .mode', m.el).forEach(x => x.classList.toggle('on', x === b)); jelly(b); sfx.tick();
  });
}

/* ---------------- Layout modal ---------------- */
function openLayout() {
  const c = cls(), L = c.layout;
  const presets = [[5, 4, 2], [6, 4, 2], [5, 3, 3], [4, 4, 2], [6, 3, 2], [4, 3, 4]];
  const body = `
    <div class="layout-grid">
      <div class="lay-fields">
        <div class="field"><label>Số bàn mỗi dãy (hàng ngang)</label>${stepper('lRows', L.rows, 1, 12)}</div>
        <div class="field"><label>Số dãy bàn</label>${stepper('lCols', L.cols, 1, 8)}</div>
        <div class="field"><label>Số chỗ mỗi bàn</label>${stepper('lSpd', L.spd, 1, 4)}</div>
      </div>
      <div class="mini-wrap"><div class="mini-board"></div><div class="mini-rows" id="mini"></div><div class="mini-info" id="miniInfo"></div></div>
    </div>
    <div class="field"><label>Mẫu có sẵn</label><div class="chips" id="presets">${presets.map(p => `<button type="button" class="chip" data-v="${p.join(',')}">${p[0]}×${p[1]} · ${p[2]} chỗ = ${p[0] * p[1] * p[2]}</button>`).join('')}</div></div>
    <p class="hint">💡 Muốn bỏ bớt bàn (cột, góc lớp…)? Dùng nút <b>✏️ Sửa bàn</b> trên sơ đồ rồi bấm vào bàn để tắt / bật. Học sinh ở chỗ bị bỏ sẽ quay về danh sách.</p>`;
  const m = modal({ title: 'Bố trí bàn ghế', icon: '🪑', wide: true, body,
    actions: [{ label: 'Hủy', cls: 'ghost' }, { label: '💕 Áp dụng', cls: 'primary', onClick: api => {
      const v = read(api.el);
      if (v.rows === L.rows && v.cols === L.cols && v.spd === L.spd) return;
      withFlip(() => {
        commit();
        c.layout = { ...v, disabled: L.disabled.filter(d => { const [r, x] = d.split('-').map(Number); return r < v.rows && x < v.cols; }) };
      }, { arc: true, stagger: 6 });
      sfx.pop();
      toast(`Đã đổi sơ đồ: ${v.rows * v.cols * v.spd} chỗ ngồi 🪑`, 'info');
    } }] });
  const el = m.el;
  function read(root) { return { rows: +$('#lRows', root).value || 1, cols: +$('#lCols', root).value || 1, spd: +$('#lSpd', root).value || 1 }; }
  function draw() {
    const v = read(el), total = v.rows * v.cols * v.spd, n = c.students.length;
    $('#mini', el).innerHTML = Array.from({ length: v.rows }, (_, r) => `<div class="mini-row">${Array.from({ length: v.cols }, (_, x) => `<span class="mini-desk" style="animation-delay:${(r * v.cols + x) * 12}ms">${'<i></i>'.repeat(v.spd)}</span>`).join('')}</div>`).join('');
    $('#miniInfo', el).innerHTML = `<b>${total}</b> chỗ ngồi · lớp có <b>${n}</b> bạn<br>${total >= n ? `Còn dư ${total - n} chỗ 💺` : `⚠️ Thiếu ${n - total} chỗ`}`;
  }
  ['lRows', 'lCols', 'lSpd'].forEach(id => $('#' + id, el).addEventListener('input', draw));
  $('#presets', el).addEventListener('change', () => {
    const [r, x, s] = chipVal($('#presets', el)).split(',');
    $('#lRows', el).value = r; $('#lCols', el).value = x; $('#lSpd', el).value = s;
    ['lRows', 'lCols', 'lSpd'].forEach(id => bump($('#' + id, el))); draw();
  });
  draw();
}

/* ---------------- Saved arrangements ---------------- */
function openSaved() {
  const c = cls();
  const body = `
    <div class="save-row"><input class="inp" id="svName" placeholder="Tên sơ đồ, VD: Tuần 1 – Tháng 9" value="Sơ đồ ngày ${new Date().toLocaleDateString('vi-VN')}"><button type="button" class="btn primary" id="svBtn">💾 Lưu</button></div>
    <div class="sv-list" id="svList"></div>`;
  const m = modal({ title: `Sơ đồ đã lưu · ${esc(c.name)}`, icon: '💾', body, actions: [{ label: 'Đóng', cls: 'ghost' }] });
  const el = m.el;
  function draw() {
    const list = $('#svList', el);
    if (!c.saved.length) { list.innerHTML = `<div class="empty"><div class="empty-ico">🗂️</div><b>Chưa có sơ đồ nào</b><span>Lưu lại để dùng lại cho tuần sau, học kỳ sau nhé!</span></div>`; return; }
    list.innerHTML = c.saved.map(s => `<div class="sv-item" data-id="${s.id}"><span class="cls-e">📌</span><div><b>${esc(s.name)}</b><small>${new Date(s.at).toLocaleString('vi-VN')} · ${Object.keys(s.seats).length} bạn · ${s.layout.rows}×${s.layout.cols}</small></div>
      <button type="button" class="btn sm" data-a="open">Mở lại</button><button type="button" class="btn icon sm" data-a="del" title="Xóa">🗑</button></div>`).join('');
  }
  $('#svBtn', el).addEventListener('click', () => {
    const name = $('#svName', el).value.trim() || `Sơ đồ ${c.saved.length + 1}`;
    if (!Object.keys(c.seats).length) { toast('Sơ đồ đang trống, xếp chỗ trước rồi lưu nhé 🙂', 'warn'); return; }
    c.saved.unshift({ id: uid(), name, at: Date.now(), seats: { ...c.seats }, locked: [...c.locked], layout: clone(c.layout) });
    save(); draw(); sfx.success(); confettiPop(innerWidth / 2, innerHeight / 2.5);
    const first = $('.sv-item', el); if (first) popIn(first);
    toast(`Đã lưu “${esc(name)}” 💾`);
  });
  $('#svList', el).addEventListener('click', async e => {
    const b = e.target.closest('[data-a]'), item = e.target.closest('.sv-item'); if (!item) return;
    const s = c.saved.find(x => x.id === item.dataset.id); if (!s) return;
    if (b?.dataset.a === 'del') {
      if (!await confirmDlg('Xóa sơ đồ đã lưu?', `Xóa “${esc(s.name)}”?`, 'Xóa', true, '🗑')) return;
      c.saved = c.saved.filter(x => x !== s); save(); draw(); return;
    }
    m.close();
    setTimeout(() => {
      withFlip(() => { commit(); c.layout = clone(s.layout); c.seats = { ...s.seats }; c.locked = [...s.locked]; }, { arc: true, stagger: 14 });
      sfx.whoosh(); toast(`Đã mở lại “${esc(s.name)}” ✨`);
    }, 200);
  });
  draw();
}

/* ---------------- Classes ---------------- */
function switchClass(id) {
  if (id === db.current) return;
  withFlip(() => { db.current = id; query = ''; $('#search').value = ''; $('#searchBox').classList.remove('has'); }, { stagger: 10 });
  sfx.whoosh();
}
function openClasses() {
  const m = modal({ title: 'Lớp học của cô', icon: '🏫',
    body: `<div class="cls-list" id="clsList"></div><div class="row-btns"><button type="button" class="btn mint" id="clsAdd">＋ Tạo lớp mới</button><button type="button" class="btn" id="clsDup">📑 Nhân bản lớp hiện tại</button></div>`,
    actions: [{ label: 'Đóng', cls: 'ghost' }] });
  const el = m.el;
  function draw() {
    $('#clsList', el).innerHTML = db.classes.map((c, i) => `<div class="cls-item${c.id === db.current ? ' cur' : ''}" data-id="${c.id}"><span class="cls-e">${['🌷', '🌼', '🍓', '🌈', '🐰', '🧁', '🍀', '🦄'][i % 8]}</span>
      <div><b>${esc(c.name)}</b><small>${c.students.length} học sinh · ${c.layout.rows}×${c.layout.cols} bàn${c.id === db.current ? ' · đang mở' : ''}</small></div>
      <button type="button" class="btn icon sm" data-a="ren" title="Đổi tên">✏️</button><button type="button" class="btn icon sm" data-a="del" title="Xóa lớp">🗑</button></div>`).join('');
  }
  $('#clsList', el).addEventListener('click', async e => {
    const item = e.target.closest('.cls-item'); if (!item) return;
    const c = db.classes.find(x => x.id === item.dataset.id), a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'ren') {
      const name = await askText('Đổi tên lớp', 'Tên lớp', c.name);
      if (name) { c.name = name; save(); render(); draw(); }
    } else if (a === 'del') {
      if (db.classes.length === 1) { toast('Cần giữ lại ít nhất 1 lớp nhé 🙂', 'warn'); return; }
      if (!await confirmDlg('Xóa lớp?', `Xóa <b>${esc(c.name)}</b> cùng ${c.students.length} học sinh và các sơ đồ đã lưu? Việc này không hoàn tác được.`, 'Xóa lớp', true, '⚠️')) return;
      db.classes = db.classes.filter(x => x !== c);
      if (db.current === c.id) switchClass(db.classes[0].id); else { save(); render(); }
      draw();
    } else { m.close(); switchClass(c.id); }
  });
  $('#clsAdd', el).addEventListener('click', async () => {
    const name = await askText('Tạo lớp mới', 'Tên lớp', `Lớp ${db.classes.length + 1}A`, '🏫');
    if (!name) return;
    const c = newClass(name);
    db.classes.push(c); m.close(); switchClass(c.id);
    toast(`Đã tạo ${esc(name)} 🎈 — nhập danh sách học sinh nhé!`);
    setTimeout(() => openImport('append'), 450);
  });
  $('#clsDup', el).addEventListener('click', () => {
    const src = cls(), c = clone(src);
    c.id = uid(); c.name = `${src.name} (bản sao)`; c.saved = [];
    db.classes.push(c); save(); draw(); sfx.pop(); toast('Đã nhân bản lớp 📑');
  });
  draw();
}

/* ---------------- Export ---------------- */
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
const safeName = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lop';
function seatingGrid(c) {
  const { rows, cols, spd } = c.layout, S = new Map(c.students.map(s => [s.id, s]));
  const head = [''];
  for (let x = 0; x < cols; x++) for (let s = 0; s < spd; s++) head.push(`Dãy ${x + 1}` + (spd > 1 ? ` - Chỗ ${s + 1}` : ''));
  const aoa = [[`SƠ ĐỒ CHỖ NGỒI ${c.name.toUpperCase()}`], [`(Bảng ở phía trên · ${new Date().toLocaleDateString('vi-VN')})`], [], head];
  for (let r = 0; r < rows; r++) {
    const row = [`Bàn ${r + 1}`];
    for (let x = 0; x < cols; x++) for (let s = 0; s < spd; s++) row.push(deskOff(c, r, x) ? '—' : S.get(c.seats[K(r, x, s)])?.name || '');
    aoa.push(row);
  }
  return aoa;
}
function studentRows(c) {
  const seatMap = new Map(Object.entries(c.seats).map(([k, id]) => [id, k]));
  return [['STT', 'Họ và tên', 'Giới tính', 'Học lực', 'Chiều cao', 'Dãy', 'Bàn', 'Chỗ', 'Ưu tiên', 'Ghi chú'],
    ...[...c.students].sort(viCmp).map((s, i) => {
      const k = seatMap.get(s.id), p = k ? parseK(k) : null;
      return [i + 1, s.name, s.gender === 'F' ? 'Nữ' : s.gender === 'M' ? 'Nam' : '', LEVEL_SHORT[s.level] || '', s.height || '', p ? p[1] + 1 : '', p ? p[0] + 1 : '', p ? p[2] + 1 : '', s.priority ? 'x' : '', s.note];
    })];
}
const toCSV = aoa => '﻿' + aoa.map(r => r.map(v => { const t = String(v ?? ''); return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; }).join(',')).join('\r\n');
async function exportExcel() {
  const c = cls();
  try { await loadScript(XLSX_URL); } catch (e) { toast('Không tải được thư viện Excel (cần Internet) — đã xuất CSV thay thế', 'warn'); return exportCSV(); }
  const X = window.XLSX, wb = X.utils.book_new();
  const g = X.utils.aoa_to_sheet(seatingGrid(c));
  g['!cols'] = [{ wch: 8 }, ...Array(c.layout.cols * c.layout.spd).fill({ wch: 22 })];
  X.utils.book_append_sheet(wb, g, 'Sơ đồ');
  const l = X.utils.aoa_to_sheet(studentRows(c));
  l['!cols'] = [{ wch: 5 }, { wch: 26 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 8 }, { wch: 24 }];
  X.utils.book_append_sheet(wb, l, 'Danh sách');
  X.writeFile(wb, `so-do-${safeName(c.name)}.xlsx`);
  toast('Đã xuất file Excel 📊');
}
function exportCSV() {
  const c = cls();
  download(new Blob([toCSV(seatingGrid(c))], { type: 'text/csv;charset=utf-8' }), `so-do-${safeName(c.name)}.csv`);
  toast('Đã xuất file CSV 📄');
}
function exportStudentsCSV() {
  const c = cls();
  download(new Blob([toCSV(studentRows(c))], { type: 'text/csv;charset=utf-8' }), `danh-sach-${safeName(c.name)}.csv`);
  toast('Đã xuất danh sách học sinh 📄');
}
async function exportPNG() {
  const c = cls();
  toast('⏳ Đang chụp sơ đồ…', 'info');
  try { await loadScript(H2C_URL); } catch (e) { toast('Không tải được công cụ chụp ảnh (cần Internet) 😢 — cô dùng “In” rồi chọn “Lưu PDF” nhé', 'warn'); return; }
  const wasEditing = editDesks, oldQuery = query;
  editDesks = false; query = ''; render();
  try {
    const canvas = await window.html2canvas(room, { backgroundColor: '#fff8fb', scale: 2, logging: false });
    canvas.toBlob(b => { download(b, `so-do-${safeName(c.name)}.png`); toast('Đã tải ảnh sơ đồ 🖼️'); });
  } catch (e) { toast('Chụp ảnh không thành công 😢', 'warn'); }
  editDesks = wasEditing; query = oldQuery; render();
}
function doPrint() {
  const c = cls();
  $('#printTitle').textContent = `Sơ đồ chỗ ngồi · ${c.name}`;
  $('#printDate').textContent = `Sĩ số: ${c.students.length} · Ngày ${new Date().toLocaleDateString('vi-VN')}`;
  setTimeout(() => window.print(), 50);
}
let printScale = null;
addEventListener('beforeprint', () => {
  printScale = db.settings.scale;
  const w = room.offsetWidth / printScale, h = room.offsetHeight / printScale;
  document.documentElement.classList.remove('compact');
  document.documentElement.style.setProperty('--scale', Math.min(1.25, 1000 / w, 640 / h).toFixed(3));
});
addEventListener('afterprint', () => { if (printScale != null) applyScale(printScale); printScale = null; });
function backup() {
  download(new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' }), `lop-minh-xinh-sao-luu-${new Date().toISOString().slice(0, 10)}.json`);
  toast('Đã sao lưu toàn bộ dữ liệu 💾');
}
function pickFile(accept, cb) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = accept;
  inp.onchange = () => { if (inp.files[0]) cb(inp.files[0]); };
  inp.click();
}
const isShare = d => d && d.kind === 'class' && d.class && Array.isArray(d.class.students);
// Any .json from this app: a shared class goes to the receive dialog, a full backup to restore.
async function openJsonFile(f) {
  let d;
  try { d = JSON.parse(await f.text()); } catch (e) { toast('Không đọc được file 😢 — cần file .json xuất từ Lớp Mình Xinh', 'warn'); return; }
  if (isShare(d)) return openReceive(d);
  if (d && Array.isArray(d.classes) && d.classes.length) {
    if (!await confirmDlg('Khôi phục dữ liệu?', `Đây là file <b>sao lưu</b> có ${d.classes.length} lớp. Toàn bộ dữ liệu hiện tại sẽ được thay thế.<br><span class="hint">Nếu chỉ muốn nhận sơ đồ một lớp, người gửi hãy dùng “🎁 Chia sẻ sơ đồ lớp”.</span>`, 'Khôi phục', false, '♻️')) return;
    withFlip(() => { db = normalizeDb(d); db.settings.welcomed = true; hists.clear(); }, { stagger: 10 });
    return toast('Đã khôi phục dữ liệu ✨');
  }
  toast('File này không phải sơ đồ của Lớp Mình Xinh 🤔', 'warn');
}
const restoreBackup = () => pickFile('.json,application/json', openJsonFile);

/* ---------------- Share one class ---------------- */
function exportShare() {
  const c = cls();
  if (!c.students.length) return toast('Lớp chưa có học sinh để chia sẻ 🥺', 'warn');
  const data = { app: 'lop-minh-xinh', kind: 'class', version: 1, exportedAt: new Date().toISOString(),
    class: { name: c.name, students: c.students, layout: c.layout, seats: c.seats, locked: c.locked, saved: c.saved, photos: c.photos } };
  download(new Blob([JSON.stringify(data)], { type: 'application/json' }), `so-do-${safeName(c.name)}.lopxinh.json`);
  sfx.pop();
  toast(`🎁 Đã xuất file sơ đồ ${esc(c.name)} — gửi file này cho người nhận nhé`);
}
// Copy a shared class with fresh ids so it never collides with classes already on this device.
function remapClass(src) {
  const c = newClass(String(src.name || 'Lớp được chia sẻ')), ids = new Map();
  const list = src.students.filter(s => s && String(s.name || '').trim());
  c.students = list.map(s => { const n = mkStudent(s); ids.set(s.id, n.id); return n; });
  c.students.forEach((n, i) => { n.avoid = (list[i].avoid || []).map(x => ids.get(x)).filter(Boolean); });
  const L = Object.assign({ rows: 5, cols: 4, spd: 2, disabled: [] }, src.layout || {});
  c.layout = { rows: clamp(+L.rows || 5, 1, 12), cols: clamp(+L.cols || 4, 1, 8), spd: clamp(+L.spd || 2, 1, 4), disabled: Array.isArray(L.disabled) ? [...L.disabled] : [] };
  const mapSeats = o => { const r = {}; for (const [k, id] of Object.entries(o || {})) if (ids.has(id)) r[k] = ids.get(id); return r; };
  c.seats = mapSeats(src.seats);
  c.locked = (src.locked || []).filter(k => c.seats[k]);
  for (const [id, p] of Object.entries(src.photos || {})) if (ids.has(id) && okPhoto(p)) c.photos[ids.get(id)] = p;
  c.saved = (src.saved || []).filter(s => s && s.layout).map(s => {
    const seats = mapSeats(s.seats);
    return { id: uid(), name: s.name || 'Sơ đồ', at: s.at || Date.now(), layout: clone(s.layout), seats, locked: (s.locked || []).filter(k => seats[k]) };
  });
  cleanSeats(c);
  return c;
}
function openReceive(d) {
  const n = remapClass(d.class), cur = cls(), L = n.layout;
  const total = n.students.length, seated = Object.keys(n.seats).length;
  const f = n.students.filter(s => s.gender === 'F').length, m = n.students.filter(s => s.gender === 'M').length;
  const taken = new Set(db.classes.map(c => c.name));
  const defName = taken.has(n.name) ? `${n.name} (nhận)` : n.name;
  const G = new Map(n.students.map(s => [s.id, s.gender || 'U']));
  const mini = Array.from({ length: L.rows }, (_, r) => `<div class="mini-row">${Array.from({ length: L.cols }, (_, x) =>
    `<span class="mini-desk${deskOff(n, r, x) ? ' off' : ''}" style="animation-delay:${(r * L.cols + x) * 14}ms">${Array.from({ length: L.spd }, (_, s) => { const id = n.seats[K(r, x, s)]; return `<i class="${id ? G.get(id) : ''}"></i>`; }).join('')}</span>`).join('')}</div>`).join('');
  const sent = d.exportedAt ? new Date(d.exportedAt).toLocaleString('vi-VN') : '';
  const body = `
    <div class="recv-card"><span class="recv-e">🎁</span><div><b>${esc(n.name)}</b><small>${sent ? `Xuất lúc ${sent}` : 'Sơ đồ lớp được chia sẻ'}</small></div></div>
    <div class="g-sum"><span class="pill">👥 ${total} học sinh</span><span class="pill" style="background:#efe9ff;color:#7656d6">🪑 ${seated} bạn đã có chỗ</span>
      <span class="pill" style="background:#ffe6ef;color:#c4457a">🎀 ${f} nữ</span><span class="pill" style="background:#e3f2ff;color:#3a78b5">🧢 ${m} nam</span>
      <span class="pill muted">${L.rows} bàn × ${L.cols} dãy × ${L.spd} chỗ</span>${n.saved.length ? `<span class="pill muted">💾 ${n.saved.length} sơ đồ đã lưu</span>` : ''}</div>
    <div class="mini-wrap recv-mini"><div class="mini-board"></div><div class="mini-rows">${mini}</div><div class="mini-info">Xem trước sơ đồ · <span style="color:#c4457a">●</span> nữ <span style="color:#3a78b5">●</span> nam</div></div>
    <div class="field"><label>Nhận vào đâu?</label>
      <div class="chips" id="rvMode"><button type="button" class="chip on" data-v="new">🏫 Thêm thành lớp mới</button><button type="button" class="chip" data-v="replace">🔄 Thay vào ${esc(cur.name)}</button></div>
      <input class="inp" id="rvName" value="${esc(defName)}" placeholder="Tên lớp">
      <p class="hint" id="rvHint">Các lớp đang có của cô sẽ được giữ nguyên.</p></div>`;
  const md = modal({ title: 'Nhận sơ đồ lớp', icon: '📨', wide: true, body,
    actions: [{ label: 'Hủy', cls: 'ghost' }, { label: '✨ Nhận sơ đồ', cls: 'primary', onClick: api => {
      const mode = chipVal($('#rvMode', api.el));
      if (mode === 'replace') {
        withFlip(() => {
          commit();
          const c = cls();
          Object.assign(c, { students: n.students, layout: n.layout, seats: n.seats, locked: n.locked, saved: [...n.saved, ...c.saved], photos: { ...c.photos, ...n.photos } });
        }, { arc: true, stagger: 14 });
      } else {
        n.name = $('#rvName', api.el).value.trim() || defName;
        withFlip(() => { db.classes.push(n); db.current = n.id; query = ''; $('#search').value = ''; $('#searchBox').classList.remove('has'); }, { stagger: 14 });
      }
      sfx.success(); confettiCannons();
      toast(`Đã nhận sơ đồ <b>${esc(cls().name)}</b> — ${seated} bạn đã vào đúng chỗ ✨`);
    } }] });
  $('#rvMode', md.el).addEventListener('change', () => {
    const rep = chipVal($('#rvMode', md.el)) === 'replace';
    $('#rvName', md.el).hidden = rep;
    $('#rvHint', md.el).innerHTML = rep
      ? `⚠️ Danh sách và sơ đồ hiện tại của <b>${esc(cur.name)}</b> sẽ được thay bằng file này (có thể bấm ↶ để hoàn tác).`
      : 'Các lớp đang có của cô sẽ được giữ nguyên.';
  });
}
// Dropping a shared .json anywhere on the page opens it.
document.addEventListener('dragover', e => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
document.addEventListener('drop', e => {
  if (e.defaultPrevented) return;
  const f = e.dataTransfer?.files?.[0]; if (!f) return;
  e.preventDefault();
  if (/\.json$/i.test(f.name)) openJsonFile(f);
  else toast('Để nhập danh sách, cô bấm “📥 Nhập DS” rồi thả file vào đó nhé', 'info');
});
function openExport() {
  const tiles = [
    ['share', '🎁', 'Chia sẻ sơ đồ lớp', 'Gửi file cho người khác nhập vào đúng chỗ'],
    ['receive', '📨', 'Nhận sơ đồ', 'Mở file sơ đồ người khác gửi'],
    ['print', '🖨️', 'In sơ đồ', 'Khổ A4 ngang, có thể lưu PDF'],
    ['png', '🖼️', 'Tải ảnh PNG', 'Gửi Zalo cho phụ huynh'],
    ['xlsx', '📊', 'Xuất Excel', 'Sơ đồ + danh sách (2 trang)'],
    ['csv', '📄', 'Xuất CSV sơ đồ', 'Mở bằng Excel / Google Sheets'],
    ['list', '🧾', 'Xuất danh sách HS', 'Kèm vị trí chỗ ngồi'],
    ['backup', '💾', 'Sao lưu dữ liệu', 'Tất cả các lớp ra 1 file'],
    ['restore', '♻️', 'Khôi phục', 'Từ file sao lưu .json'],
  ];
  const m = modal({ title: 'Xuất & In', icon: '📤', wide: true,
    body: `<div class="export-grid">${tiles.map(t => `<button type="button" class="tile" data-t="${t[0]}"><span class="te">${t[1]}</span><b>${t[2]}</b><small>${t[3]}</small></button>`).join('')}</div>
      <p class="hint">💡 Dữ liệu được lưu tự động trong trình duyệt này. Thỉnh thoảng cô nhớ <b>Sao lưu</b> ra file để không bị mất khi đổi máy hoặc xóa lịch sử duyệt web nhé.</p>`,
    actions: [{ label: 'Đóng', cls: 'ghost' }] });
  $('.export-grid', m.el).addEventListener('click', e => {
    const t = e.target.closest('.tile')?.dataset.t; if (!t) return;
    m.close();
    setTimeout(() => ({ share: exportShare, receive: () => pickFile('.json,application/json', openJsonFile), print: doPrint, png: exportPNG, xlsx: exportExcel, csv: exportCSV, list: exportStudentsCSV, backup, restore: restoreBackup })[t](), 220);
  });
}

/* ---------------- Help & welcome ---------------- */
function openHelp() {
  modal({ title: 'Hướng dẫn sử dụng', icon: '💡', wide: true, body: `<ul class="help-list">
    <li><span>📥</span><div><b>Nhập danh sách</b> — từ file Excel/CSV hoặc dán chữ. Chỉ cần cột “Họ và tên”, web tự nhận diện giới tính, học lực, chiều cao…</div></li>
    <li><span>🖐️</span><div><b>Kéo thả</b> thẻ học sinh vào chỗ ngồi. Thả vào chỗ đã có bạn → <b>hai bạn đổi chỗ</b>. Kéo về khung danh sách để bỏ chỗ.</div></li>
    <li><span>📱</span><div><b>Trên điện thoại / máy tính bảng</b>: <b>chạm</b> một bạn rồi <b>chạm vào chỗ ngồi</b> để xếp hoặc đổi chỗ; hoặc <b>giữ ngón tay</b> trên thẻ một chút rồi kéo. Vuốt bình thường để cuộn sơ đồ. Kéo thanh nhỏ ở khay dưới để mở rộng danh sách.</div></li>
    <li><span>📷</span><div><b>Ảnh học sinh</b>: mở thông tin học sinh, bấm vào hình tròn để chọn hoặc chụp ảnh. Muốn thêm nhiều ảnh cùng lúc: <b>📋 → 📷 Ảnh hàng loạt</b>, đặt tên file theo họ tên (VD “Nguyen Minh Anh.jpg”).</div></li>
    <li><span>✨</span><div><b>Xếp tự động</b>: ngẫu nhiên, xen kẽ nam nữ, đôi bạn cùng tiến, thấp trước cao sau, theo ABC — có ưu tiên bàn đầu và tách các bạn hay nói chuyện.</div></li>
    <li><span>🔒</span><div><b>Khóa chỗ</b>: rê chuột lên thẻ, bấm 🔓. Bạn bị khóa sẽ không bị di chuyển khi xếp tự động.</div></li>
    <li><span>↔️</span><div><b>Đổi dãy / Đổi bàn</b>: xoay vòng chỗ ngồi hằng tuần chỉ với 1 cú bấm.</div></li>
    <li><span>✏️</span><div><b>Sửa bàn</b>: bấm vào từng bàn để tắt / bật (lớp có cột, bàn hỏng…). <b>🪑 Bố trí lớp</b> để đổi số bàn, số dãy, số chỗ.</div></li>
    <li><span>👩‍🏫</span><div><b>Góc nhìn</b>: “Nhìn từ học sinh” (bảng ở trên) hoặc “Nhìn từ bục giảng” (như cô đứng trên bục nhìn xuống).</div></li>
    <li><span>🎁</span><div><b>Chia sẻ sơ đồ</b>: <b>📤 Xuất &amp; In → 🎁 Chia sẻ sơ đồ lớp</b> tạo file gửi qua Zalo / email. Người nhận kéo thả file đó vào trang (hoặc <b>📨 Nhận sơ đồ</b>) là có đúng lớp, đúng chỗ ngồi.</div></li>
    <li><span>💾</span><div><b>Sơ đồ đã lưu</b>: lưu nhiều phương án (tuần 1, học kỳ 2…) và mở lại bất cứ lúc nào.</div></li>
    <li><span>⌨️</span><div><kbd>Ctrl</kbd>+<kbd>Z</kbd> hoàn tác · <kbd>Ctrl</kbd>+<kbd>Y</kbd> làm lại · <kbd>/</kbd> tìm học sinh · <kbd>Esc</kbd> đóng hộp thoại.</div></li>
  </ul>
  <div class="opt-list">
    <label class="switch"><input type="checkbox" id="liteSw" ${LITE ? 'checked' : ''}><span></span>⚡ <b>Chế độ nhẹ</b> <small>— bớt hiệu ứng trang trí cho máy yếu, các chuyển động chính vẫn giữ</small></label>
    <p class="hint" id="liteHint">${db.settings.lite == null ? (LITE ? '🤖 Web đã tự bật vì máy đang chạy chưa mượt.' : '🤖 Đang ở chế độ tự động: web sẽ tự bật nếu thấy máy bị giật.') : '✋ Cô đã tự chọn — web sẽ không tự đổi nữa.'}</p>
  </div>`, actions: [{ label: 'Đã hiểu 💕', cls: 'primary' }],
  onOpen: m => $('#liteSw', m.el).addEventListener('change', e => {
    setLite(e.target.checked); sizeCanvas();
    $('#liteHint', m.el).textContent = '✋ Cô đã tự chọn — web sẽ không tự đổi nữa.';
    toast(e.target.checked ? '⚡ Đã bật chế độ nhẹ' : '✨ Đã bật đầy đủ hiệu ứng', 'info');
  }) });
}
function openWelcome() {
  modal({ title: 'Chào cô giáo xinh đẹp! 🌷', icon: '👋', body: `
    <div class="welcome-hero">🏫</div>
    <p style="text-align:center">Đây là trợ lý xếp chỗ ngồi nhỏ xinh của cô. Mình đã chuẩn bị sẵn <b>một lớp mẫu 24 bạn</b> để cô bấm thử: kéo thả thẻ, bấm <b>✨ Xếp tự động</b>, đổi chỗ…</p>
    <p class="hint" style="text-align:center">Mọi thứ được tự động lưu trong trình duyệt này.</p>`,
    onClose: () => { db.settings.welcomed = true; save(); },
    actions: [
      { label: '📥 Nhập lớp của mình', cls: 'lav', onClick: () => { setTimeout(() => openImport('new'), 220); } },
      { label: '🎀 Xem thử lớp mẫu', cls: 'primary', onClick: () => { setTimeout(() => runArrange(db.settings.arrange), 300); } }] });
}

/* ---------------- Zoom ---------------- */
// Scale is only a CSS variable, so zooming never needs a re-render.
function applyScale(s) {
  db.settings.scale = s;
  document.documentElement.style.setProperty('--scale', s);
  document.documentElement.classList.toggle('compact', s < .8);
  $('#zoom').value = Math.round(s * 100);
}
function setScale(v) { db.settings.autoFit = false; applyScale(clamp(Math.round(v * 100) / 100, .5, 1.4)); save(); }
function fitScale() {
  const s = db.settings.scale, cs = getComputedStyle(stageScroll);
  const aw = stageScroll.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const ah = stageScroll.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  if (aw <= 0 || !room.offsetWidth) return s;
  const fit = Math.min(aw / (room.offsetWidth / s), Math.max(ah / (room.offsetHeight / s), .8), 1.2);
  // on phones the room stays readable and scrolls sideways instead of shrinking to dots
  return clamp(Math.floor(fit * 100) / 100, innerWidth <= 640 ? .62 : .5, 1.2);
}
function autoFit() {
  if (!db.settings.autoFit) return;
  for (let i = 0; i < 3; i++) { const ns = fitScale(); if (Math.abs(ns - db.settings.scale) < .01) break; applyScale(ns); }
}
function fitZoom() { db.settings.autoFit = true; autoFit(); save(); toast('⤢ Sơ đồ sẽ tự co giãn vừa màn hình', 'info'); }
new ResizeObserver(() => { autoFit(); positionSeg(); }).observe(stageScroll);
// Bottom-sheet height drives the bottom padding of the room and the toast position on small screens.
new ResizeObserver(() => {
  document.documentElement.style.setProperty('--sheet-h', SHEET_MQ.matches ? sidebar.offsetHeight + 'px' : '0px');
}).observe(sidebar);
function toggleSheet(open = !document.body.classList.contains('sheet-open')) {
  if (!SHEET_MQ.matches) return;
  document.body.classList.toggle('sheet-open', open);
  jelly(sidebar); sfx.tick();
}
$('#sheetToggle').addEventListener('click', () => toggleSheet());
$('.pool-head').addEventListener('click', e => { if (!e.target.closest('.link')) toggleSheet(); });
SHEET_MQ.addEventListener?.('change', () => document.body.classList.remove('sheet-open'));

/* ---------------- Wiring ---------------- */
const on = (id, fn) => $('#' + id).addEventListener('click', fn);
on('btnArrange', openArrange);
on('btnUndo', undo);
on('btnRedo', redo);
on('btnLayout', openLayout);
on('btnSaved', openSaved);
on('btnExport', openExport);
on('btnHelp', openHelp);
on('btnClass', openClasses);
on('btnAdd', () => openStudent(null));
on('btnImport', () => openImport(cls().students.length ? 'append' : 'replace'));
on('btnList', openList);
on('btnQuickFill', () => {
  const c = cls(), seated = new Set(Object.values(c.seats));
  if (!c.students.some(s => !seated.has(s.id))) return toast('Bạn nào cũng có chỗ rồi 🎉', 'info');
  runArrange({ ...db.settings.arrange, mode: 'random', scope: 'empty' });
});
on('btnClear', async () => {
  const c = cls();
  if (!Object.keys(c.seats).length) return toast('Sơ đồ đang trống rồi 🙂', 'info');
  const keep = c.locked.length;
  if (!await confirmDlg('Xóa sơ đồ?', `Đưa tất cả học sinh về danh sách${keep ? ` (giữ lại ${keep} chỗ đã khóa)` : ''}? Có thể bấm ↶ để hoàn tác.`, '🧹 Xóa sơ đồ', true, '🧹')) return;
  withFlip(() => { commit(); const next = {}; c.locked.forEach(k => { next[k] = c.seats[k]; }); c.seats = next; }, { arc: true, stagger: 12 });
  sfx.whoosh();
});
on('btnSound', () => { db.settings.sound = !db.settings.sound; save(); render(); if (db.settings.sound) sfx.pop(); });
on('btnEditDesks', () => {
  editDesks = !editDesks; render(); sfx.pop();
  if (editDesks) toast('Bấm vào bàn để tắt / bật · bấm “✅ Xong” khi hoàn tất', 'info');
});
on('btnRotCols', () => rotateSeats('cols'));
on('btnRotRows', () => rotateSeats('rows'));
on('zoomIn', () => setScale(db.settings.scale + .1));
on('zoomOut', () => setScale(db.settings.scale - .1));
on('zoomFit', fitZoom);
// The slider fires many input events per frame; apply at most one zoom per frame.
let zoomRaf = 0;
$('#zoom').addEventListener('input', e => {
  const v = e.target.value / 100;
  cancelAnimationFrame(zoomRaf);
  zoomRaf = requestAnimationFrame(() => setScale(v));
});
$('#viewSeg').addEventListener('click', e => {
  const b = e.target.closest('button[data-view]');
  if (!b || b.dataset.view === db.settings.view) return;
  withFlip(() => { db.settings.view = b.dataset.view; }, { arc: true, stagger: 6 });
  positionSeg();
  sfx.whoosh();
});
let searchT;
$('#search').addEventListener('input', e => {
  $('#searchBox').classList.toggle('has', !!e.target.value);
  clearTimeout(searchT);
  searchT = setTimeout(() => {
    query = norm(e.target.value); render();
    const hit = query && $('#rows .card.match');
    if (hit) hit.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, 120);
});
on('searchClear', () => { $('#search').value = ''; query = ''; $('#searchBox').classList.remove('has'); render(); $('#search').focus(); });

document.addEventListener('click', e => { const b = e.target.closest('.btn'); if (b && !b.disabled) jelly(b); }, true);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (modalStack.length) { modalStack[modalStack.length - 1].close(); return; }
    if (selected) { clearSelection(); return; }
    if (document.body.classList.contains('sheet-open')) { toggleSheet(false); return; }
    if (editDesks) { editDesks = false; render(); return; }
    if (query) { $('#searchClear').click(); return; }
  }
  if (modalStack.length) return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); }
  else if (e.key === '/' && !typing) { e.preventDefault(); $('#search').focus(); }
});

/* ---------------- Boot ---------------- */
render();
const startup = () => {
  positionSeg();
  autoFit();
  if (!db.settings.welcomed) setTimeout(openWelcome, 350);
  else if (!db.settings.swipeHint && room.offsetWidth > stageScroll.clientWidth + 8) {
    db.settings.swipeHint = true; save();
    setTimeout(() => toast('👉 Vuốt ngang để xem các dãy khác · chạm một bạn rồi chạm chỗ ngồi để xếp', 'info'), 900);
  }
  if (!reduceMotion) $$('#app .card, #rows .desk').forEach((el, i) => popIn(el, Math.min(i * 14, 700)));
};
if (document.fonts?.ready) document.fonts.ready.then(startup); else startup();
})();
