'use strict';

const VERSION = '1.0';

/* ================= 設定與資料 ================= */
const STORAGE_KEY = 'workout-log-v1';
const BACKUP_KEY = 'workout-last-backup';
const SNOOZE_KEY = 'workout-backup-snooze';

// 運動項目：cat 類別（cardio 有氧／strength 肌力／flex 伸展），parts 主要使用的部位
const TYPES = [
  { id: 'run', name: '跑步', emoji: '🏃', cat: 'cardio', parts: ['lower'] },
  { id: 'walk', name: '快走', emoji: '🚶', cat: 'cardio', parts: [] },
  { id: 'bike', name: '騎車', emoji: '🚴', cat: 'cardio', parts: ['lower'] },
  { id: 'swim', name: '游泳', emoji: '🏊', cat: 'cardio', parts: ['upper'] },
  { id: 'hiit', name: 'HIIT', emoji: '🔥', cat: 'cardio', parts: ['upper', 'lower', 'core'] },
  { id: 'hike', name: '登山', emoji: '⛰️', cat: 'cardio', parts: ['lower'] },
  { id: 'ball', name: '球類', emoji: '🏀', cat: 'cardio', parts: ['lower'] },
  { id: 'upper', name: '上半身重訓', emoji: '💪', cat: 'strength', parts: ['upper'] },
  { id: 'lower', name: '下半身重訓', emoji: '🦵', cat: 'strength', parts: ['lower'] },
  { id: 'core', name: '核心訓練', emoji: '🧱', cat: 'strength', parts: ['core'] },
  { id: 'full', name: '全身重訓', emoji: '🏋️', cat: 'strength', parts: ['upper', 'lower', 'core'] },
  { id: 'yoga', name: '瑜伽', emoji: '🧘', cat: 'flex', parts: [] },
  { id: 'stretch', name: '伸展', emoji: '🤸', cat: 'flex', parts: [] },
  { id: 'other', name: '其他', emoji: '✨', cat: 'cardio', parts: [] },
];
const TYPE = Object.fromEntries(TYPES.map((t) => [t.id, t]));
const CATS = { cardio: '有氧', strength: '肌力', flex: '伸展' };
const PARTS = { upper: '上半身', lower: '下半身', core: '核心' };
const RPE = [
  { v: 1, label: '輕鬆', hint: '可以輕鬆聊天，幾乎不喘' },
  { v: 2, label: '中等', hint: '會喘、流汗，但還能說完整句子' },
  { v: 3, label: '吃力', hint: '很喘，只能說幾個字' },
];
const FEELS = [
  { v: 1, emoji: '🤒', label: '不舒服' },
  { v: 2, emoji: '😮‍💨', label: '很累' },
  { v: 3, emoji: '🙂', label: '普通' },
  { v: 4, emoji: '😊', label: '不錯' },
  { v: 5, emoji: '🤩', label: '精神好' },
];
// 運動目標：每週有氧（中等強度換算分鐘）、肌力次數、伸展次數、最多連續運動天數
const GOALS = {
  health: { name: '健康', cardio: 150, strength: 2, flex: 2, streak: 3, desc: '每週 150 分鐘中等有氧＋2 次肌力（世界衛生組織建議）' },
  lose: { name: '減重', cardio: 250, strength: 2, flex: 1, streak: 5, desc: '有氧量較多（每週約 250 分鐘），搭配 2 次肌力維持肌肉' },
  muscle: { name: '增肌', cardio: 90, strength: 4, flex: 2, streak: 4, desc: '每週 3–4 次肌力，同一部位間隔 48 小時；有氧少量即可' },
  endurance: { name: '耐力', cardio: 240, strength: 2, flex: 2, streak: 5, desc: '以有氧為主，逐步拉長時間，每週穿插一次較吃力的訓練' },
};
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const blank = () => ({ entries: {}, goal: 'health', days: 4 });

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (d && typeof d.entries === 'object') {
      return { entries: d.entries, goal: GOALS[d.goal] ? d.goal : 'health', days: d.days >= 2 && d.days <= 7 ? d.days : 4 };
    }
  } catch (e) { /* 資料損毀或無法讀取時從空白開始 */ }
  return blank();
}

// 清理一筆紀錄（匯入時使用）
function cleanEntry(e) {
  const o = {
    sessions: (Array.isArray(e.sessions) ? e.sessions : [])
      .filter((s) => TYPE[s.type] && s.min > 0)
      .map((s) => ({ id: String(s.id || uid()), type: s.type, min: Math.min(600, Math.round(s.min)), rpe: [1, 2, 3].includes(s.rpe) ? s.rpe : 2, note: String(s.note || '').slice(0, 60) })),
    sore: Array.isArray(e.sore) ? e.sore.filter((p) => PARTS[p]) : [],
    t: Number(e.t) || Date.now(),
  };
  if (e.feel >= 1 && e.feel <= 5) o.feel = Math.round(e.feel);
  return o;
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; }
  catch (e) { toast('儲存失敗，請檢查儲存空間'); return false; }
}

/* ================= 工具函式 ================= */
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const todayKey = () => keyOf(new Date());
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
const diffDays = (a, b) => Math.round((parseKey(a) - parseKey(b)) / 864e5);
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtTime = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const shortDate = (k) => { const d = parseKey(k); return `${d.getMonth() + 1}/${d.getDate()}`; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const round5 = (n) => Math.max(5, Math.round(n / 5) * 5);
const catColor = (c) => `var(--c-${c})`;
const sessionsOf = (k) => (data.entries[k] && data.entries[k].sessions) || [];
const totalMin = (k) => sessionsOf(k).reduce((a, s) => a + s.min, 0);
const isActive = (k) => sessionsOf(k).length > 0;
// 換算成「中等強度分鐘」：輕鬆 ×0.5、中等 ×1、吃力 ×2（世界衛生組織：1 分鐘激烈 ≈ 2 分鐘中等）
const eqMin = (s) => s.min * [0, .5, 1, 2][s.rpe];
// 訓練負荷：時間 × 強度
const loadOf = (s) => s.min * [0, 1, 2, 3.5][s.rpe];
// 這天的主要類別（時間最多的）
function mainCat(k) {
  const m = {};
  sessionsOf(k).forEach((s) => { const c = TYPE[s.type].cat; m[c] = (m[c] || 0) + s.min; });
  return Object.keys(m).sort((a, b) => m[b] - m[a])[0];
}
function mainSession(k) { return [...sessionsOf(k)].sort((a, b) => b.min - a.min)[0]; }

/* ================= 狀態 ================= */
let data = load();
let curDate = todayKey();
let lastToday = curDate;
let calMonth = startOfMonth(new Date());
let range = 30;
let currentTab = 'today';
let editing = null;   // 正在編輯的運動 { id?, type, min, rpe, note }

function relLabel(k) {
  const t = todayKey();
  if (k === t) return '今天';
  if (k === addDays(t, -1)) return '昨天';
  if (k === addDays(t, -2)) return '前天';
  return `星期${WEEK[parseKey(k).getDay()]}`;
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

/* ================= 建議引擎 =================
 * 依「目標日前一天為止」的紀錄計算目標日要做什麼。全部是固定規則，畫面上會列出理由。
 * 1. 不舒服 → 休息；很累、連續運動太多天、近 3 天負荷暴增、本週天數已達標 → 輕鬆恢復
 * 2. 否則比較本週有氧與肌力的缺口，選缺比較多的當主項
 *    - 肌力：同一部位至少休息 48 小時（核心 24 小時），痠痛的部位不練，挑最久沒練的
 *    - 有氧：優先選你最常做的項目；下半身痠痛時改成游泳／快走；前一天很吃力就降為中等
 * 3. 再視情況加上輕鬆有氧、核心或伸展
 */
function recentStats(target) {
  const last = addDays(target, -1);
  const s = { last, cardio: 0, strength: 0, flex: 0, active: 0, active28: 0, load3: 0, load28: 0, hard: false, partDays: {}, typeCount: {} };
  for (let i = 0; i < 28; i++) {
    const k = addDays(last, -i);
    const ss = sessionsOf(k);
    ss.forEach((x) => {
      const t = TYPE[x.type];
      s.load28 += loadOf(x);
      if (i < 3) s.load3 += loadOf(x);
      if (i < 7) {
        if (t.cat === 'cardio') s.cardio += eqMin(x);
        if (t.cat === 'strength') s.strength++;
        if (t.cat === 'flex') s.flex++;
      }
      if (i === 0 && (x.rpe === 3 || loadOf(x) >= 120)) s.hard = true;
      // 部位：肌力訓練，或吃力的有氧，才算有練到
      if (t.cat === 'strength' || x.rpe === 3) t.parts.forEach((p) => { if (s.partDays[p] == null) s.partDays[p] = i + 1; });
      s.typeCount[x.type] = (s.typeCount[x.type] || 0) + 1;
    });
    if (i < 7 && ss.length) s.active++;
    if (ss.length) s.active28++;
  }
  let streak = 0;
  while (isActive(addDays(last, -streak)) && streak < 60) streak++;
  s.streak = streak;
  s.ratio = s.load28 > 0 ? s.load3 / (s.load28 / 28 * 3) : 0;
  const e = data.entries[last];
  s.feel = e && e.feel;
  s.sore = new Set(e && e.sore ? e.sore : []);
  s.any = Object.keys(data.entries).some((k) => k <= last && isActive(k));
  return s;
}

function recommend(target) {
  const g = GOALS[data.goal];
  const s = recentStats(target);
  const why = [];
  const items = [];
  const fav = (cands) => cands.sort((a, b) => (s.typeCount[b] || 0) - (s.typeCount[a] || 0))[0];
  const flexItem = (min) => ({ type: fav(['stretch', 'yoga']), min, rpe: 1 });

  if (!s.any) {
    return { kind: 'start', badge: '🌱', title: '從輕鬆的開始', reasons: ['還沒有運動紀錄，先養成習慣最重要'],
      items: [{ type: 'walk', min: 20, rpe: 2 }, { type: 'stretch', min: 10, rpe: 1 }] };
  }
  if (s.feel === 1) {
    return { kind: 'rest', badge: '🛌', title: '好好休息', items: [],
      reasons: ['前一天身體不舒服，先休息、睡飽、補充水分', '恢復後再從輕鬆的運動開始；症狀持續請就醫'] };
  }

  // 是否該恢復
  let recover = '';
  if (s.feel === 2) recover = '前一天覺得很累';
  else if (s.streak >= g.streak) recover = `已經連續運動 ${s.streak} 天`;
  // 至少有 8 天紀錄才比較「近 3 天 vs 平常」，紀錄太少時比例沒有意義
  else if (s.active28 >= 8 && s.ratio > 1.8 && s.load3 > 200) recover = '最近 3 天的運動量比平常多很多';
  else if (s.active >= data.days && s.streak >= 1) recover = `近 7 天已運動 ${s.active} 天，達到每週 ${data.days} 天的目標`;
  if (recover) {
    why.push(recover + '，讓身體恢復一下');
    if (s.sore.size) why.push(`${[...s.sore].map((p) => PARTS[p]).join('、')}痠痛，伸展時放輕鬆`);
    why.push('想完全休息也可以，休息也是訓練的一部分');
    return { kind: 'recover', badge: '🌿', title: '輕鬆恢復日', reasons: why,
      items: [{ type: s.sore.has('lower') ? 'walk' : fav(['walk', 'bike', 'swim']), min: 20, rpe: 1 }, flexItem(15)] };
  }

  // 可以訓練的部位
  const rest = { upper: 2, lower: 2, core: 1 };
  const ready = Object.keys(PARTS).filter((p) => !s.sore.has(p) && (s.partDays[p] == null || s.partDays[p] >= rest[p]));
  const blocked = Object.keys(PARTS).filter((p) => !ready.includes(p));
  const cardioGap = Math.max(0, g.cardio - s.cardio) / g.cardio;   // 0–1
  const strengthGap = Math.max(0, g.strength - s.strength) / g.strength;
  const bigReady = ready.filter((p) => p !== 'core');
  const intensity = s.hard ? 2 : (s.feel >= 4 ? 3 : 2);

  let main;
  if (strengthGap > 0 && bigReady.length && strengthGap >= cardioGap) main = 'strength';
  else if (cardioGap > 0) main = 'cardio';
  else if (strengthGap > 0 && bigReady.length) main = 'strength';
  else main = 'light';

  if (main === 'strength') {
    let type;
    if (bigReady.length === 2 && data.goal !== 'muscle' && (s.partDays.upper || 9) >= 3 && (s.partDays.lower || 9) >= 3) type = 'full';
    else type = bigReady.sort((a, b) => (s.partDays[b] || 99) - (s.partDays[a] || 99))[0];
    items.push({ type, min: data.goal === 'muscle' ? 45 : 35, rpe: intensity });
    why.push(`近 7 天肌力訓練 ${s.strength} 次，目標每週 ${g.strength} 次`);
    const p = type === 'full' ? '上、下半身' : PARTS[type];
    const d = type === 'full' ? Math.min(s.partDays.upper || 99, s.partDays.lower || 99) : s.partDays[type];
    why.push(d && d < 99 ? `${p}已休息 ${d} 天，可以再練` : `最近 4 週沒練過${p}`);
    if (type !== 'full' && ready.includes('core')) items.push({ type: 'core', min: 10, rpe: 2 });
    if (cardioGap > .3) items.push({ type: fav(['walk', 'bike', 'run']), min: 15, rpe: 1 });
  } else if (main === 'cardio') {
    const lowerOk = ready.includes('lower');
    let cands = lowerOk ? ['run', 'bike', 'walk', 'swim', 'hike', 'ball', 'hiit'] : ['swim', 'walk'];
    if (s.hard) cands = cands.filter((c) => c !== 'hiit');
    const type = fav(cands);
    const remainDays = Math.max(1, data.days - s.active);
    const need = (g.cardio - s.cardio) / remainDays / (intensity === 3 ? 2 : 1);
    const cap = type === 'hiit' ? 25 : ['lose', 'endurance'].includes(data.goal) ? 60 : 45;
    const min = Math.min(cap, Math.max(20, round5(need)));
    items.push({ type, min, rpe: type === 'walk' ? 2 : intensity });
    why.push(`近 7 天有氧約 ${Math.round(s.cardio)} 分鐘（中等強度換算），目標每週 ${g.cardio} 分鐘`);
    if (!lowerOk) why.push('下半身還在恢復，選對腳負擔小的項目');
    if (strengthGap > 0 && !bigReady.length) why.push('肌力部位都還在恢復，今天先做有氧');
    if (ready.includes('core') && strengthGap > 0) items.push({ type: 'core', min: 10, rpe: 2 });
  } else {
    why.push('本週的有氧和肌力目標都達成了，做點喜歡的輕鬆運動就好');
    items.push({ type: fav(['walk', 'bike', 'swim', 'ball']), min: 30, rpe: 1 });
  }
  if (s.hard && main !== 'light') why.push('前一天練得比較吃力，強度以中等為主');
  else if (intensity === 3 && main !== 'light') why.push('前一天精神很好，可以挑戰吃力一點');
  if (blocked.some((p) => s.sore.has(p))) why.push(`${blocked.filter((p) => s.sore.has(p)).map((p) => PARTS[p]).join('、')}痠痛，先避開`);
  if (s.flex < g.flex || s.hard || items.some((i) => TYPE[i.type].cat === 'strength')) items.push(flexItem(10));

  const titles = items.filter((i) => TYPE[i.type].cat !== 'flex').map((i) => TYPE[i.type].name);
  return { kind: 'train', badge: TYPE[items[0].type].emoji, title: titles.join(' ＋ '), items, reasons: why };
}

function planItemsHtml(p) {
  return p.items.map((i) => {
    const t = TYPE[i.type];
    return `<div class="plan-item"><span class="em">${t.emoji}</span>
      <span class="name">${t.name}<small>${CATS[t.cat]} · ${RPE[i.rpe - 1].label}</small></span>
      <span class="min">${i.min} 分</span></div>`;
  }).join('');
}

/* ================= 今天 ================= */
$('#feels').innerHTML = FEELS.map((f) => `
  <button class="feel" data-v="${f.v}" style="--c:var(--f${f.v})" aria-pressed="false">
    <span class="face">${f.emoji}</span><span class="lbl">${f.label}</span>
  </button>`).join('');
$('#sore').innerHTML = Object.entries(PARTS).map(([k, v]) => `<button class="chip" data-p="${k}">${v}</button>`).join('');

function ensureEntry() {
  if (!data.entries[curDate]) data.entries[curDate] = { sessions: [], sore: [], t: Date.now() };
  return data.entries[curDate];
}
// 這天沒有任何內容時刪掉，避免留下空紀錄
function tidy(k) {
  const e = data.entries[k];
  if (e && !e.sessions.length && !e.feel && !(e.sore && e.sore.length)) delete data.entries[k];
}
function touch() {
  const e = data.entries[curDate];
  if (e) e.t = Date.now();
  tidy(curDate);
  persist();
  renderToday();
}

function renderToday() {
  const e = data.entries[curDate];
  const d = parseKey(curDate);
  const isToday = curDate === todayKey();
  $('#dayLabel').textContent = relLabel(curDate);
  $('#dateLabel').textContent = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 星期${WEEK[d.getDay()]}`;
  $('#nextDay').disabled = curDate >= todayKey();
  $('#sessTitle').textContent = isToday ? '今天做了什麼' : '那天做了什麼';

  $$('#feels .feel').forEach((b) => {
    const on = !!e && e.feel === +b.dataset.v;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on);
  });
  const sore = new Set(e && e.sore ? e.sore : []);
  $$('#sore .chip').forEach((b) => b.classList.toggle('on', sore.has(b.dataset.p)));

  const ss = sessionsOf(curDate);
  $('#sessions').innerHTML = ss.length ? ss.map((s) => {
    const t = TYPE[s.type];
    return `<button class="sess" data-id="${s.id}" style="--c:${catColor(t.cat)}">
      <span class="em">${t.emoji}</span>
      <span class="body"><span class="name">${t.name}</span>
        <span class="meta">${CATS[t.cat]} · ${RPE[s.rpe - 1].label}${s.note ? ' · ' + esc(s.note) : ''}</span></span>
      <span class="min">${s.min}<small>分</small></span></button>`;
  }).join('') : `<div class="empty">${isToday ? '今天還沒有運動紀錄' : '這天沒有運動紀錄'}</div>`;

  // 這天還沒運動：顯示這天的建議，可一鍵記錄
  const tp = $('#todayPlan');
  if (!ss.length) {
    const p = recommend(curDate);
    tp.hidden = false;
    tp.innerHTML = `<span class="plan-badge">${p.badge}</span>
      <span class="txt">${isToday ? '今天' : '這天'}的建議<b>${esc(p.title)}</b></span>
      ${p.items.length ? '<button class="pill-btn" id="usePlan">照做，記錄</button>' : ''}`;
  } else tp.hidden = true;

  // 下一天的建議
  const next = addDays(curDate, 1);
  const p = recommend(next);
  $('#nextPlan').innerHTML = `
    <div class="plan-head"><span class="plan-badge">${p.badge}</span>
      <div><div class="k">${next === addDays(todayKey(), 1) ? '明天' : next === todayKey() ? '今天' : shortDate(next) + ' '}建議</div>
      <div class="t">${esc(p.title)}</div></div></div>
    <div class="plan-items">${planItemsHtml(p)}</div>
    <ul class="plan-why">${p.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`;

  $('#saveStatus').textContent = e ? `已儲存 · ${fmtTime(e.t)}` : '運動完記下來，建議會自動更新';
  $('#deleteEntry').hidden = !e;
  renderBackupTip();
}

$('#feels').addEventListener('click', (ev) => {
  const b = ev.target.closest('.feel');
  if (!b) return;
  const e = ensureEntry();
  const v = +b.dataset.v;
  if (e.feel === v) delete e.feel; else e.feel = v;
  touch();
});
$('#sore').addEventListener('click', (ev) => {
  const b = ev.target.closest('.chip');
  if (!b) return;
  const e = ensureEntry();
  const set = new Set(e.sore || []);
  set.has(b.dataset.p) ? set.delete(b.dataset.p) : set.add(b.dataset.p);
  e.sore = [...set];
  touch();
});
$('#sessions').addEventListener('click', (ev) => {
  const b = ev.target.closest('.sess');
  if (!b) return;
  const s = sessionsOf(curDate).find((x) => x.id === b.dataset.id);
  if (s) openSheet({ ...s });
});
$('#addSession').addEventListener('click', () => openSheet(null));
$('#todayPlan').addEventListener('click', (ev) => {
  if (!ev.target.closest('#usePlan')) return;
  const p = recommend(curDate);
  const e = ensureEntry();
  p.items.forEach((i) => e.sessions.push({ id: uid(), type: i.type, min: i.min, rpe: i.rpe, note: '' }));
  touch();
  toast(`已記錄 ${p.items.length} 項運動，可點一下修改`);
});
$('#prevDay').addEventListener('click', () => { curDate = addDays(curDate, -1); renderToday(); });
$('#nextDay').addEventListener('click', () => { if (curDate < todayKey()) { curDate = addDays(curDate, 1); renderToday(); } });
$('#deleteEntry').addEventListener('click', () => {
  if (!confirm(`確定要清除 ${shortDate(curDate)} 的所有紀錄嗎？`)) return;
  delete data.entries[curDate];
  persist();
  renderToday();
  toast('已清除');
});

/* ----- 新增／編輯運動 ----- */
$('#typeGrid').innerHTML = TYPES.map((t) =>
  `<button class="type" data-t="${t.id}" style="--c:${catColor(t.cat)}"><span class="em">${t.emoji}</span>${t.name}</button>`).join('');
$('#minQuick').innerHTML = [10, 20, 30, 45, 60].map((m) => `<button class="chip" data-m="${m}">${m}</button>`).join('');
$('#rpeSeg').innerHTML = RPE.map((r) => `<button data-v="${r.v}">${r.label}</button>`).join('');

function openSheet(s) {
  // 新增時預設用最常做的項目
  const last = Object.keys(data.entries).sort().reverse().map(mainSession).find(Boolean);
  editing = s || { type: last ? last.type : 'walk', min: last ? last.min : 30, rpe: 2, note: '' };
  $('#sheetTitle').textContent = s ? '編輯運動' : '新增運動';
  $('#sheetDelete').hidden = !s;
  $('#sMin').value = editing.min || '';
  $('#sNote').value = editing.note || '';
  renderSheet();
  $('#sheet').hidden = false;
}
function renderSheet() {
  $$('#typeGrid .type').forEach((b) => b.classList.toggle('on', b.dataset.t === editing.type));
  $$('#rpeSeg button').forEach((b) => b.classList.toggle('on', +b.dataset.v === editing.rpe));
  $('#rpeHint').textContent = RPE[editing.rpe - 1].hint;
}
const closeSheet = () => { $('#sheet').hidden = true; editing = null; };
$('#typeGrid').addEventListener('click', (ev) => { const b = ev.target.closest('.type'); if (b) { editing.type = b.dataset.t; renderSheet(); } });
$('#rpeSeg').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) { editing.rpe = +b.dataset.v; renderSheet(); } });
$('#minQuick').addEventListener('click', (ev) => { const b = ev.target.closest('.chip'); if (b) $('#sMin').value = b.dataset.m; });
$('#sheetCancel').addEventListener('click', closeSheet);
$('#sheet').addEventListener('click', (ev) => { if (ev.target.id === 'sheet') closeSheet(); });
$('#sheetSave').addEventListener('click', () => {
  const min = Math.round(+$('#sMin').value);
  if (!(min > 0 && min <= 600)) { toast('請輸入 1–600 分鐘'); $('#sMin').focus(); return; }
  const e = ensureEntry();
  const s = { id: editing.id || uid(), type: editing.type, min, rpe: editing.rpe, note: $('#sNote').value.trim().slice(0, 60) };
  const i = e.sessions.findIndex((x) => x.id === s.id);
  if (i >= 0) e.sessions[i] = s; else e.sessions.push(s);
  closeSheet();
  touch();
  toast('已儲存');
});
$('#sheetDelete').addEventListener('click', () => {
  const e = data.entries[curDate];
  if (e) e.sessions = e.sessions.filter((x) => x.id !== editing.id);
  closeSheet();
  touch();
  toast('已刪除');
});

/* ================= 日曆 ================= */
function renderCalendar() {
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  $('#calTitle').textContent = `${y} 年 ${m + 1} 月`;
  const now = new Date();
  $('#calNext').disabled = y > now.getFullYear() || (y === now.getFullYear() && m >= now.getMonth());
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const t = todayKey();
  let html = WEEK.map((w) => `<div class="wd">${w}</div>`).join('');
  for (let i = 0; i < first; i++) html += '<div></div>';
  for (let d = 1; d <= days; d++) {
    const k = keyOf(new Date(y, m, d));
    const s = mainSession(k);
    const cls = ['day', s ? 'has' : '', k === t ? 'today' : ''].join(' ');
    html += s
      ? `<button class="${cls}" data-k="${k}" style="--c:${catColor(mainCat(k))}"><span class="n">${d}</span><span class="e">${TYPE[s.type].emoji}</span><span class="m">${totalMin(k)}′</span></button>`
      : `<button class="${cls}" data-k="${k}" ${k > t ? 'disabled' : ''}><span class="n">${d}</span></button>`;
  }
  $('#calGrid').innerHTML = html;
  $('#calLegend').innerHTML = Object.entries(CATS).map(([c, n]) => `<span><i style="background:${catColor(c)}"></i>${n}</span>`).join('');

  const keys = Object.keys(data.entries).filter((k) => k.startsWith(`${y}-${pad(m + 1)}`) && isActive(k)).sort().reverse();
  const tot = keys.reduce((a, k) => a + totalMin(k), 0);
  $('#monthSum').textContent = keys.length ? `本月運動 ${keys.length} 天，共 ${tot} 分鐘` : '';
  $('#monthList').innerHTML = keys.length ? keys.map((k) => `
    <button class="entry" data-k="${k}">
      <span class="date">${shortDate(k)}<small>星期${WEEK[parseKey(k).getDay()]}</small></span>
      <span class="body">${sessionsOf(k).map((s) => `<span>${TYPE[s.type].emoji} ${TYPE[s.type].name} ${s.min}′</span>`).join('')}</span>
      <span class="tot">${totalMin(k)}′</span>
    </button>`).join('') : '<div class="empty">這個月還沒有運動紀錄</div>';
}
function openDay(k) { curDate = k; switchTab('today'); }
$('#calGrid').addEventListener('click', (ev) => { const b = ev.target.closest('.day'); if (b && !b.disabled) openDay(b.dataset.k); });
$('#monthList').addEventListener('click', (ev) => { const b = ev.target.closest('.entry'); if (b) openDay(b.dataset.k); });
$('#calPrev').addEventListener('click', () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderCalendar(); });
$('#calNext').addEventListener('click', () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderCalendar(); });

/* ================= 統計 ================= */
function renderStats() {
  const t = todayKey();
  const keys = Array.from({ length: range }, (_, i) => addDays(t, i - range + 1));
  const act = keys.filter(isActive);
  const tot = act.reduce((a, k) => a + totalMin(k), 0);
  let streak = 0;
  let k0 = isActive(t) ? t : addDays(t, -1);
  while (isActive(k0)) { streak++; k0 = addDays(k0, -1); }
  $('#kpis').innerHTML = `
    <div class="kpi"><div class="v">${act.length}<small>天</small></div><div class="k">運動天數</div></div>
    <div class="kpi"><div class="v">${tot >= 600 ? (tot / 60).toFixed(1) + '<small>小時</small>' : tot + '<small>分</small>'}</div><div class="k">總時間</div></div>
    <div class="kpi"><div class="v">${streak}<small>天</small></div><div class="k">連續運動</div></div>`;

  // 長條圖：每天各類別分鐘數堆疊
  const W = 340, H = 150, L = 26, B = 18, top = 8;
  const max = Math.max(30, ...keys.map(totalMin));
  const yMax = Math.ceil(max / 30) * 30;
  const bw = (W - L) / keys.length;
  const y = (v) => top + (H - top - B) * (1 - v / yMax);
  let svg = '';
  [0, yMax / 2, yMax].forEach((v) => { svg += `<line class="grid" x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L - 4}" y="${y(v) + 3}" text-anchor="end">${v}</text>`; });
  keys.forEach((k, i) => {
    let acc = 0;
    ['strength', 'cardio', 'flex'].forEach((c) => {
      const m = sessionsOf(k).filter((s) => TYPE[s.type].cat === c).reduce((a, s) => a + s.min, 0);
      if (!m) return;
      svg += `<rect x="${L + i * bw + bw * .15}" y="${y(acc + m)}" width="${Math.max(1.5, bw * .7)}" height="${y(acc) - y(acc + m)}" rx="${Math.min(3, bw * .25)}" style="fill:${catColor(c)}"/>`;
      acc += m;
    });
  });
  const step = range === 7 ? 1 : range === 30 ? 7 : 30;
  keys.forEach((k, i) => { if ((keys.length - 1 - i) % step === 0) svg += `<text class="axis" x="${L + i * bw + bw / 2}" y="${H - 4}" text-anchor="middle">${shortDate(k)}</text>`; });
  $('#chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}">${svg}</svg>`;
  $('#chartLegend').innerHTML = Object.entries(CATS).map(([c, n]) => `<span><i style="background:${catColor(c)}"></i>${n}</span>`).join('');

  // 近 7 天進度（含今天）
  const s = recentStats(addDays(t, 1));
  const g = GOALS[data.goal];
  const row = (name, v, goal, unit, c) => `<div class="goal-row"><span>${name}</span>
    <div class="bar"><i style="width:${Math.min(100, v / goal * 100)}%;--c:${c}"></i></div>
    <span class="cnt">${Math.round(v)} / ${goal} ${unit}</span></div>`;
  $('#weekGoal').innerHTML = row('天數', s.active, data.days, '天', 'var(--accent)')
    + row('有氧', s.cardio, g.cardio, '分', catColor('cardio'))
    + row('肌力', s.strength, g.strength, '次', catColor('strength'))
    + row('伸展', s.flex, g.flex, '次', catColor('flex'))
    + `<div class="hint">目標：${g.name}。有氧以中等強度換算（吃力 1 分鐘 ＝ 2 分鐘，輕鬆 1 分鐘 ＝ 0.5 分鐘）</div>`;

  // 部位恢復
  const rest = { upper: 2, lower: 2, core: 1 };
  $('#recovery').innerHTML = Object.entries(PARTS).map(([p, n]) => {
    const d = s.partDays[p];
    const sore = s.sore.has(p);
    const ok = !sore && (d == null || d >= rest[p]);
    return `<div class="rec-row"><span class="name">${n}</span>
      <span class="meta">${d == null ? '4 週內沒練' : d === 1 ? '今天練過' : `${d - 1} 天前練過`}${sore ? '・痠痛' : ''}</span>
      <span class="tag" style="--c:${ok ? 'var(--c-flex)' : 'var(--c-cardio)'}">${ok ? '可以練' : '恢復中'}</span></div>`;
  }).join('');

  // 項目統計
  const m = {};
  keys.forEach((k) => sessionsOf(k).forEach((x) => { m[x.type] = m[x.type] || { n: 0, min: 0 }; m[x.type].n++; m[x.type].min += x.min; }));
  const list = Object.entries(m).sort((a, b) => b[1].min - a[1].min);
  $('#typeStats').innerHTML = list.length ? list.map(([id, v]) => `<div class="type-row">
    <span>${TYPE[id].emoji}</span><span class="name">${TYPE[id].name}</span>
    <span class="meta">${v.n} 次 · ${v.min} 分</span></div>`).join('') : '<div class="empty">這段期間還沒有紀錄</div>';
}
$('#rangeSeg').addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  if (!b) return;
  range = +b.dataset.r;
  $$('#rangeSeg button').forEach((x) => x.classList.toggle('on', x === b));
  renderStats();
});

/* ================= 設定 ================= */
$('#goalSeg').innerHTML = Object.entries(GOALS).map(([k, g]) => `<button data-g="${k}">${g.name}</button>`).join('');
$('#daysSeg').innerHTML = [2, 3, 4, 5, 6].map((d) => `<button data-d="${d}">${d} 天</button>`).join('');
function renderSettings() {
  $$('#goalSeg button').forEach((b) => b.classList.toggle('on', b.dataset.g === data.goal));
  $('#goalDesc').textContent = GOALS[data.goal].desc;
  $$('#daysSeg button').forEach((b) => b.classList.toggle('on', +b.dataset.d === data.days));
  const n = Object.keys(data.entries).filter(isActive).length;
  $('#statsLine').textContent = `共 ${n} 天運動紀錄 · 版本 ${VERSION}`;
  const lb = lastBackup();
  $('#exportSub').textContent = lb ? `上次備份：${daysAgo(lb)}` : '尚未備份過';
}
$('#goalSeg').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) { data.goal = b.dataset.g; persist(); renderSettings(); toast('已更新，建議會依新目標計算'); } });
$('#daysSeg').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) { data.days = +b.dataset.d; persist(); renderSettings(); } });

/* ----- 備份 ----- */
function lastBackup() { try { return Number(localStorage.getItem(BACKUP_KEY)) || 0; } catch (e) { return 0; } }
function daysAgo(t) { const d = Math.floor((Date.now() - t) / 864e5); return d <= 0 ? '今天' : `${d} 天前`; }
function renderBackupTip() {
  const keys = Object.keys(data.entries).sort();
  let snooze = 0;
  try { snooze = Number(localStorage.getItem(SNOOZE_KEY)) || 0; } catch (e) { /* 忽略 */ }
  const since = lastBackup() || (keys.length ? parseKey(keys[0]).getTime() : Date.now());
  const days = Math.floor((Date.now() - since) / 864e5);
  const show = keys.length > 0 && days >= 30 && Date.now() > snooze && curDate === todayKey();
  $('#backupTip').hidden = !show;
  if (show) $('#backupTipText').textContent = lastBackup() ? `已經 ${days} 天沒備份了` : '還沒備份過紀錄';
}
async function exportData() {
  const json = JSON.stringify({ app: 'workout-log', version: 1, exported: new Date().toISOString(), ...data }, null, 2);
  const name = `運動日記備份-${todayKey()}.json`;
  const file = new File([json], name, { type: 'application/json' });
  const done = () => { try { localStorage.setItem(BACKUP_KEY, String(Date.now())); } catch (e) { /* 忽略 */ } renderSettings(); renderBackupTip(); };
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); done(); toast('已匯出'); }
    catch (e) { if (e.name !== 'AbortError') toast('匯出失敗'); }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  done();
  toast('已下載備份檔');
}
$('#btnExport').addEventListener('click', exportData);
$('#tipBackup').addEventListener('click', exportData);
$('#tipLater').addEventListener('click', () => { try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + 7 * 864e5)); } catch (e) { /* 忽略 */ } renderBackupTip(); });
$('#btnImport').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async (ev) => {
  const f = ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!d || typeof d.entries !== 'object') throw new Error('格式錯誤');
    let n = 0;
    Object.entries(d.entries).forEach(([k, e]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !e) return;
      const c = cleanEntry(e);
      const cur = data.entries[k];
      if (cur) {
        // 合併：同一筆（id 相同）不重複加入
        const ids = new Set(cur.sessions.map((s) => s.id));
        c.sessions.forEach((s) => { if (!ids.has(s.id)) cur.sessions.push(s); });
        if (c.feel && !cur.feel) cur.feel = c.feel;
        cur.sore = [...new Set([...(cur.sore || []), ...c.sore])];
      } else data.entries[k] = c;
      n++;
    });
    if (GOALS[d.goal]) data.goal = d.goal;
    if (d.days >= 2 && d.days <= 7) data.days = d.days;
    persist();
    renderAll();
    toast(`已匯入 ${n} 天的紀錄`);
  } catch (e) { toast('無法讀取這個檔案'); }
});
$('#btnClear').addEventListener('click', () => {
  if (!confirm('確定要清除所有運動紀錄嗎？此動作無法復原，建議先匯出備份。')) return;
  data = blank();
  persist();
  renderAll();
  toast('已清除所有資料');
});

/* ================= 分頁 ================= */
const RENDER = { today: renderToday, calendar: renderCalendar, stats: renderStats, settings: renderSettings };
function switchTab(tab) {
  currentTab = tab;
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${tab}`));
  if (tab === 'calendar') calMonth = startOfMonth(parseKey(curDate));
  RENDER[tab]();
  window.scrollTo(0, 0);
}
function renderAll() { RENDER[currentTab](); }
$$('.tab').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

// 跨日後重新開啟 App：自動回到新的今天
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const t = todayKey();
  if (t !== lastToday) { if (curDate === lastToday) curDate = t; lastToday = t; renderAll(); }
});

renderToday();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
