'use strict';

const VERSION = '1.5';

/* ================= 設定與資料 ================= */
const STORAGE_KEY = 'workout-log-v1';
const BACKUP_KEY = 'workout-last-backup';
const SNOOZE_KEY = 'workout-backup-snooze';

// 運動項目：cat 類別（cardio 有氧／strength 肌力／flex 伸展），parts 主要使用的部位，kinds 在「健身＋馬拉松」計畫中算哪一種課表
// 新增項目一律加在後面或中間都可以，但 id 不能改（舊紀錄靠 id 對應）
const TYPES = [
  { id: 'easy_run', name: '輕鬆跑', emoji: '🏃', cat: 'cardio', parts: ['lower'], run: true },
  { id: 'tempo', name: '節奏／間歇跑', emoji: '⚡', cat: 'cardio', parts: ['lower'], run: true },
  { id: 'long_run', name: '長距離跑', emoji: '🛣️', cat: 'cardio', parts: ['lower'], run: true },
  { id: 'push', name: '胸＋肩', emoji: '💪', cat: 'strength', parts: ['chest', 'shoulder'] },
  { id: 'pull', name: '背＋後肩', emoji: '🧗', cat: 'strength', parts: ['back'] },
  { id: 'pullup', name: '引體向上', emoji: '🙌', cat: 'strength', parts: ['back'] },
  { id: 'lower', name: '腿部重訓', emoji: '🦵', cat: 'strength', parts: ['lower'] },
  { id: 'core', name: '腹肌／核心', emoji: '🧱', cat: 'strength', parts: ['core'] },
  { id: 'upper', name: '上半身重訓', emoji: '🙆', cat: 'strength', parts: ['chest', 'shoulder', 'back'] },
  { id: 'full', name: '全身重訓', emoji: '🏋️', cat: 'strength', parts: ['chest', 'shoulder', 'back', 'lower', 'core'] },
  { id: 'run', name: '跑步', emoji: '👟', cat: 'cardio', parts: ['lower'], run: true },
  { id: 'walk', name: '快走', emoji: '🚶', cat: 'cardio', parts: [] },
  { id: 'bike', name: '騎車', emoji: '🚴', cat: 'cardio', parts: ['lower'] },
  { id: 'swim', name: '游泳', emoji: '🏊', cat: 'cardio', parts: ['shoulder', 'back'] },
  { id: 'hiit', name: 'HIIT', emoji: '🔥', cat: 'cardio', parts: ['lower', 'core'] },
  { id: 'hike', name: '登山', emoji: '⛰️', cat: 'cardio', parts: ['lower'] },
  { id: 'ball', name: '球類', emoji: '🏀', cat: 'cardio', parts: ['lower'] },
  { id: 'yoga', name: '瑜伽', emoji: '🧘', cat: 'flex', parts: [] },
  { id: 'stretch', name: '伸展', emoji: '🤸', cat: 'flex', parts: [] },
  { id: 'other', name: '其他', emoji: '✨', cat: 'cardio', parts: [] },
];
const TYPE = Object.fromEntries(TYPES.map((t) => [t.id, t]));
const CATS = { cardio: '有氧', strength: '肌力', flex: '伸展' };
const PARTS = { chest: '胸', shoulder: '肩', back: '背', lower: '腿', core: '核心' };
// v1.0 的痠痛部位「上半身」→ 胸、肩、背
const LEGACY_PART = { upper: ['chest', 'shoulder', 'back'] };
const normParts = (arr) => [...new Set((arr || []).flatMap((p) => LEGACY_PART[p] || [p]).filter((p) => PARTS[p]))];
// 每個部位至少休息幾天才再練（48 小時；核心 24 小時）
const PART_REST = { chest: 2, shoulder: 2, back: 2, lower: 2, core: 1 };
const RPE = [
  { v: 1, label: '輕鬆', hint: '可以輕鬆聊天，幾乎不喘' },
  { v: 2, label: '中等', hint: '會喘、流汗，但還能說完整句子' },
  { v: 3, label: '吃力', hint: '很喘，只能說幾個字；重訓：最後 1–3 下很難完成' },
];
const FEELS = [
  { v: 1, emoji: '🤒', label: '不舒服' },
  { v: 2, emoji: '😮‍💨', label: '很累' },
  { v: 3, emoji: '🙂', label: '普通' },
  { v: 4, emoji: '😊', label: '不錯' },
  { v: 5, emoji: '🤩', label: '精神好' },
];
// 運動目標：每週有氧（中等強度換算分鐘）、肌力次數、伸展次數、最多連續運動天數
// hybrid 另有每種課表的每週次數（weekly），由 recommendHybrid() 使用
const GOALS = {
  hybrid: {
    name: '健身＋馬拉松', cardio: 200, strength: 4, flex: 2, streak: 6,
    weekly: { push: 2, pull: 2, legs: 1, core: 3, easy: 3, quality: 1, long: 1, pullup: 3 },
    desc: '胸肩每週 2 次（每部位 10–20 組）、背 2 次、腿 1 次、腹肌 3 次；跑步 80% 輕鬆跑＋1 次強度課＋週末長跑。建議每週運動 5–6 天',
  },
  health: { name: '健康', cardio: 150, strength: 2, flex: 2, streak: 3, desc: '每週 150 分鐘中等有氧＋2 次肌力（世界衛生組織建議）' },
  lose: { name: '減重', cardio: 250, strength: 2, flex: 1, streak: 5, desc: '有氧量較多（每週約 250 分鐘），搭配 2 次肌力維持肌肉' },
  muscle: { name: '增肌', cardio: 90, strength: 4, flex: 2, streak: 4, desc: '每週 3–4 次肌力，同一部位間隔 48 小時；有氧少量即可' },
  endurance: { name: '耐力', cardio: 240, strength: 2, flex: 2, streak: 5, desc: '以有氧為主，逐步拉長時間，每週穿插一次較吃力的訓練' },
};
// 重訓動作庫：sets 組數、reps 次數、rest 組間休息、load 是否記重量（0 = 徒手）
// 組間休息：大重量複合動作 2–3 分、其他複合 90–120 秒、單關節 60–90 秒、腹肌 45–60 秒
// （Singer 2024 統合分析：超過 60 秒較有利增肌，90 秒以上差異不大；大重量需要較長休息）
const X = (n, sets, reps, rest, load = true) => ({ n, sets, reps, rest, load });
const EX = {
  push: [X('臥推', 4, '6–10', '2–3 分'), X('上斜 30° 啞鈴臥推', 3, '8–12', '90–120 秒'), X('坐姿啞鈴肩推', 3, '8–12', '90–120 秒'),
    X('側平舉', 4, '12–20', '60–90 秒'), X('繩索飛鳥', 3, '12–15', '60–90 秒'), X('三頭下壓', 2, '10–15', '60–90 秒')],
  pull: [X('滑輪下拉', 4, '6–12', '2 分'), X('單臂啞鈴划船', 3, '8–12', '90–120 秒'), X('臉拉', 3, '12–20', '60–90 秒'),
    X('側平舉', 3, '12–20', '60–90 秒'), X('啞鈴彎舉', 2, '10–15', '60–90 秒')],
  lower: [X('深蹲', 4, '4–6', '3 分'), X('羅馬尼亞硬舉', 3, '6–8', '2–3 分'), X('保加利亞分腿蹲', 3, '8–10', '90–120 秒'), X('站姿提踵', 3, '12–15', '60 秒')],
  core: [X('懸吊抬腿', 3, '10–15', '45–60 秒'), X('健腹輪', 3, '8–12', '60 秒', false), X('負重繩索捲腹', 3, '10–15', '45–60 秒')],
  upper: [X('臥推', 3, '6–10', '2–3 分'), X('槓鈴划船', 3, '8–12', '90–120 秒'), X('坐姿啞鈴肩推', 3, '8–12', '90–120 秒'), X('側平舉', 3, '12–20', '60–90 秒')],
  full: [X('深蹲', 3, '5–8', '2–3 分'), X('臥推', 3, '6–10', '2–3 分'), X('槓鈴划船', 3, '8–12', '90–120 秒'), X('側平舉', 3, '12–20', '60–90 秒')],
};
// 第一次做某個動作時的起始重量（kg，之後自動帶入上次）；0 = 徒手
const W0 = { 臥推: 40, '上斜 30° 啞鈴臥推': 14, 坐姿啞鈴肩推: 12, 側平舉: 6, 繩索飛鳥: 10, 三頭下壓: 20, 滑輪下拉: 40, 單臂啞鈴划船: 20,
  臉拉: 15, 啞鈴彎舉: 10, 深蹲: 50, 羅馬尼亞硬舉: 50, 保加利亞分腿蹲: 10, 站姿提踵: 40, 負重繩索捲腹: 30, 槓鈴划船: 40, 負重引體向上: 5 };
const exFor = (type) => (EX[type] || []).map((o) => ({ ...o }));
// 有氧與伸展的說明文字
const DETAIL = {
  easy_run: ['能講完整句子的配速（約最大心率 65–75%）', '寧可太慢，不要太快'],
  run: ['能講完整句子的配速（約最大心率 65–75%）'],
  tempo: ['暖身慢跑 15 分', '節奏跑 20–25 分（稍吃力，約半馬配速）或 6×800 公尺間歇', '緩和慢跑 10 分'],
  long_run: ['全程輕鬆配速，練習補水與補給', '體力好時，最後 15 分鐘可加到馬拉松配速'],
  stretch: ['小腿、大腿後側、髖屈肌、胸椎，各 1–2 分鐘'],
  yoga: ['著重髖部與胸椎的活動度'],
};
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const blank = () => ({ entries: {}, goal: 'hybrid', days: 6, pullGoal: 20, raceDate: '', ver: 2 });

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (d && typeof d.entries === 'object') {
      Object.values(d.entries).forEach((e) => { if (e && e.sore) e.sore = normParts(e.sore); });
      const o = { entries: d.entries, goal: GOALS[d.goal] ? d.goal : 'hybrid', days: d.days >= 2 && d.days <= 7 ? d.days : 6, pullGoal: d.pullGoal >= 1 && d.pullGoal <= 100 ? d.pullGoal : 20, raceDate: /^\d{4}-\d{2}-\d{2}$/.test(d.raceDate || '') ? d.raceDate : '', ver: 2 };
      // v1.0 的預設是「健康、每週 4 天」；使用者主要做健身＋跑馬拉松，沒改過預設的就換成新目標
      if (!d.ver && d.goal === 'health' && d.days === 4) { o.goal = 'hybrid'; o.days = 6; }
      return o;
    }
  } catch (e) { /* 資料損毀或無法讀取時從空白開始 */ }
  return blank();
}

// 清理一筆紀錄（匯入時使用）
function cleanEntry(e) {
  const o = {
    sessions: (Array.isArray(e.sessions) ? e.sessions : [])
      .filter((s) => TYPE[s.type] && s.min > 0)
      .map((s) => {
        const x = { id: String(s.id || uid()), type: s.type, min: Math.min(600, Math.round(s.min)), rpe: [1, 2, 3].includes(s.rpe) ? s.rpe : 2, note: String(s.note || '').slice(0, 60) };
        if (s.km > 0 && s.km <= 300) x.km = Math.round(s.km * 100) / 100;
        if (Array.isArray(s.ex)) {
          x.ex = s.ex.filter((o) => o && o.n).slice(0, 20).map((o) => ({ n: String(o.n).slice(0, 30), sets: Math.min(20, Math.max(1, Math.round(o.sets) || 1)),
            reps: String(o.reps || '').slice(0, 20), rest: String(o.rest || '').slice(0, 20), load: !!o.load,
            w: Math.min(500, Math.max(0, +o.w || 0)), r: Math.min(200, Math.max(0, Math.round(o.r) || 0)), done: Math.min(20, Math.max(0, Math.round(o.done) || 0)) }));
        }
        return x;
      }),
    sore: normParts(Array.isArray(e.sore) ? e.sore : []),
    t: Number(e.t) || Date.now(),
  };
  if (e.feel >= 1 && e.feel <= 5) o.feel = Math.round(e.feel);
  if (e.pullMax >= 0 && e.pullMax <= 100) o.pullMax = Math.round(e.pullMax);
  if (e.sleep >= 0 && e.sleep <= 14) o.sleep = Math.round(e.sleep);
  if (e.rhr >= 30 && e.rhr <= 120) o.rhr = Math.round(e.rhr);
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
// 恢復性質的運動（伸展、瑜伽、輕鬆散步）不算訓練日，才不會讓「連續運動天數」一直累積
const isLight = (s) => TYPE[s.type].cat === 'flex' || (s.type === 'walk' && s.rpe === 1);
const isTraining = (k) => sessionsOf(k).some((s) => !isLight(s));
// 配速（分'秒"／公里）
const pace = (s) => { if (!(s.km > 0)) return ''; const p = s.min / s.km; return `${Math.floor(p)}'${pad(Math.round((p % 1) * 60) % 60)}"/km`; };
// 換算成「中等強度分鐘」：輕鬆 ×0.5、中等 ×1、吃力 ×2（世界衛生組織：1 分鐘激烈 ≈ 2 分鐘中等）
const eqMin = (s) => s.min * [0, .5, 1, 2][s.rpe];
// 訓練負荷：時間 × 強度
const loadOf = (s) => s.min * [0, 1, 2, 3.5][s.rpe];
// 這筆運動在「健身＋馬拉松」計畫中算哪幾種課表
function kindsOf(s) {
  switch (s.type) {
    case 'push': return ['push'];
    case 'pull': return ['pull', 'pullup'];
    case 'pullup': return ['pullup'];
    case 'lower': return ['legs'];
    case 'core': return ['core'];
    case 'upper': return ['push', 'pull', 'pullup'];
    case 'full': return ['push', 'pull', 'legs', 'core'];
    case 'easy_run': return ['easy'];
    case 'tempo': return ['quality'];
    case 'long_run': return ['long'];
    case 'run': return s.min >= 90 || s.km >= 18 ? ['long'] : s.rpe === 3 ? ['quality'] : ['easy'];
    default: return [];
  }
}
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
let editing = null;   // 正在編輯的運動 { id?, type, min, rpe, note, km? }

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
 * 共同：不舒服 → 休息；很累、連續運動太多天、近 3 天負荷暴增、本週天數已達標 → 輕鬆恢復
 * 健身＋馬拉松：recommendHybrid()（週末長跑、平日一次強度課、其餘輕鬆跑；胸肩 2 次、背 2 次、腿 1 次、腹肌 3 次）
 * 其他目標：比較本週有氧與肌力的缺口，選缺比較多的當主項
 */
function recentStats(target) {
  const last = addDays(target, -1);
  const s = { last, cardio: 0, strength: 0, flex: 0, active: 0, active28: 0, load3: 0, load7: 0, load28: 0, hard: false,
    partDays: {}, typeCount: {}, kindDays: {}, kindCnt: {}, runKm: 0, lastLong: null };
  for (let i = 0; i < 28; i++) {
    const k = addDays(last, -i);
    const ss = sessionsOf(k);
    ss.forEach((x) => {
      const t = TYPE[x.type];
      s.load28 += loadOf(x);
      if (i < 3) s.load3 += loadOf(x);
      if (i < 7) s.load7 += loadOf(x);
      if (i < 7) {
        if (t.cat === 'cardio') s.cardio += eqMin(x);
        if (t.cat === 'strength') s.strength++;
        if (t.cat === 'flex') s.flex++;
        if (t.run && x.km) s.runKm += x.km;
      }
      if (i === 0 && (x.rpe === 3 || loadOf(x) >= 120)) s.hard = true;
      // 部位：肌力訓練，或吃力的有氧，才算有練到
      if (t.cat === 'strength' || x.rpe === 3 || x.type === 'long_run') t.parts.forEach((p) => { if (s.partDays[p] == null) s.partDays[p] = i + 1; });
      kindsOf(x).forEach((kd) => {
        if (s.kindDays[kd] == null) s.kindDays[kd] = i + 1;
        if (i < 7) s.kindCnt[kd] = (s.kindCnt[kd] || 0) + 1;
        if (kd === 'long' && !s.lastLong) s.lastLong = x;
      });
      s.typeCount[x.type] = (s.typeCount[x.type] || 0) + 1;
    });
    if (i < 7 && isTraining(k)) s.active++;
    if (isTraining(k)) s.active28++;
  }
  let streak = 0;
  while (isTraining(addDays(last, -streak)) && streak < 60) streak++;
  s.streak = streak;
  // 急慢性負荷比（ACWR）：近 7 天平均 ÷ 近 28 天平均；只用開始記錄以後的天數當分母，避免剛開始用時被低估
  const first = Object.keys(data.entries).filter(isTraining).sort()[0];
  s.hist = first && first <= last ? Math.min(28, Math.round((parseKey(last) - parseKey(first)) / 864e5) + 1) : 0;
  s.ratio = s.hist >= 14 && s.load28 > 0 ? (s.load7 / 7) / (s.load28 / s.hist) : 0;
  const e = data.entries[last];
  s.feel = e && e.feel;
  s.sore = new Set(normParts(e && e.sore));
  s.any = Object.keys(data.entries).some((k) => k <= last && isActive(k));
  // 睡眠、安靜心跳：目標日早上若已記錄就用它（早上打開 App，今天的建議會跟著更新），否則用前一天的
  const am = data.entries[target] || {};
  s.sleep = am.sleep != null ? am.sleep : e && e.sleep;
  s.rhr = am.rhr != null ? am.rhr : e && e.rhr;
  const rhrs = [];
  for (let i = 1; i <= 28; i++) { const x = data.entries[addDays(last, -i)]; if (x && x.rhr) rhrs.push(x.rhr); }
  rhrs.sort((a, b) => a - b);
  s.rhrBase = rhrs.length >= 5 ? rhrs[Math.floor(rhrs.length / 2)] : null;   // 近 4 週的中位數當基準
  s.lowFeel7 = 0;
  for (let i = 0; i < 7; i++) { const x = data.entries[addDays(last, -i)]; if (x && x.feel && x.feel <= 2) s.lowFeel7++; }
  // 週期：從第一筆訓練起算第幾週；每 4 週的最後一週是減量週
  s.week = first ? Math.floor((parseKey(target) - parseKey(first)) / 864e5 / 7) : 0;
  s.deload = s.week >= 3 && s.week % 4 === 3;
  // 近 8 週最長的長跑（賽前減量用）
  s.peakLong = 0;
  for (let i = 0; i < 56; i++) sessionsOf(addDays(last, -i)).forEach((x) => { if (kindsOf(x).includes('long')) s.peakLong = Math.max(s.peakLong, x.min); });
  s.raceDays = data.raceDate ? Math.round((parseKey(data.raceDate) - parseKey(target)) / 864e5) : null;
  return s;
}

// 準備度：0 良好、1 普通（減量、不做高強度）、2 偏低（恢復日）
// 睡眠 6 小時以下表現明顯下降（Craven 2022 統合分析）；安靜心跳比平常高很多常代表還沒恢復
function readiness(s) {
  const notes = [];
  let lv = 0;
  const up = (n, msg) => { lv = Math.max(lv, n); notes.push(msg); };
  if (s.sleep != null && s.sleep < 5) up(2, `只睡 ${s.sleep} 小時，睡眠不足時肌力和耐力表現都會明顯下降`);
  else if (s.sleep != null && s.sleep <= 6) up(1, `睡 ${s.sleep} 小時（6 小時以下），表現會打折：減量、不做高強度`);
  if (s.rhr && s.rhrBase) {
    const d = s.rhr - s.rhrBase;
    if (d >= 10) up(2, `安靜心跳 ${s.rhr}，比平常（${s.rhrBase}）高 ${d} 下，可能還沒恢復或快生病`);
    else if (d >= 7) up(1, `安靜心跳比平常高 ${d} 下，強度先放低`);
  }
  if (s.feel === 3 && s.sore.size >= 2) up(1, '好幾個部位痠痛，整體減量');
  if (s.lowFeel7 >= 3) up(1, '這週有 3 天以上覺得很累，提前減量');
  const great = lv === 0 && s.feel === 5 && (s.sleep == null || s.sleep >= 7) && !s.sore.size;
  return { lv, notes, great };
}
const partNames = (arr) => arr.map((p) => PARTS[p]).join('、');

function recommend(target) {
  const g = GOALS[data.goal];
  const s = recentStats(target);
  const fav = (cands) => cands.sort((a, b) => (s.typeCount[b] || 0) - (s.typeCount[a] || 0))[0];
  const flexItem = (min) => ({ type: fav(['stretch', 'yoga']), min, rpe: 1 });

  if (!s.any) {
    if (data.goal === 'hybrid') {
      return { kind: 'start', badge: '🌱', title: '先跑一次輕鬆跑', reasons: ['還沒有運動紀錄，先用輕鬆跑建立基礎，之後建議會依紀錄調整'],
        items: [{ type: 'easy_run', min: 30, rpe: 1 }, { type: 'core', min: 15, rpe: 2 }] };
    }
    return { kind: 'start', badge: '🌱', title: '從輕鬆的開始', reasons: ['還沒有運動紀錄，先養成習慣最重要'],
      items: [{ type: 'walk', min: 20, rpe: 2 }, { type: 'stretch', min: 10, rpe: 1 }] };
  }
  if (s.feel === 1) {
    return { kind: 'rest', badge: '🛌', title: '好好休息', items: [],
      reasons: ['前一天身體不舒服，先休息、睡飽、補充水分', '恢復後再從輕鬆的運動開始；症狀持續請就醫'] };
  }

  // 比賽日與賽後恢復週
  if (s.raceDays === 0) {
    return { kind: 'race', badge: '🏅', title: '馬拉松比賽日！加油！', items: [], tag: '比賽日',
      reasons: ['前半程比目標配速稍慢，後半程再加速（負分段）', '照練習時的方式補水、補給，不嘗試新東西', '賽前 2–3 小時吃熟悉的早餐'] };
  }
  if (s.raceDays != null && s.raceDays < 0 && s.raceDays >= -7) {
    const early = s.raceDays >= -3;
    return { kind: 'recover', badge: '🛀', title: '賽後恢復週', tag: `賽後第 ${-s.raceDays} 天`,
      items: early ? [{ type: 'walk', min: 20, rpe: 1 }, flexItem(15)] : [{ type: 'easy_run', min: 25, rpe: 1 }, flexItem(10)],
      reasons: ['跑完全馬，肌肉和免疫力需要 1–2 週恢復', early ? '前 3 天只散步和伸展' : '可以開始很輕鬆的慢跑；重訓下週再恢復'] };
  }
  const r = readiness(s);

  // 是否該恢復
  let recover = '';
  if (s.feel === 2) recover = '前一天覺得很累';
  else if (r.lv === 2) recover = r.notes[0];
  else if (s.streak >= g.streak) recover = `已經連續運動 ${s.streak} 天`;
  // 紀錄滿 14 天才判斷；近 7 天負荷超過平常的 1.5 倍，受傷風險明顯增加
  else if (s.ratio > 1.5) recover = '這週的運動量比過去 4 週平均多 50% 以上';
  else if (s.active >= data.days && s.streak >= 1) recover = `近 7 天已運動 ${s.active} 天，達到每週 ${data.days} 天的目標`;
  if (recover) {
    const why = [recover + '，讓身體恢復一下'];
    if (s.sore.size) why.push(`${partNames([...s.sore])}痠痛，伸展時放輕鬆`);
    why.push('想完全休息也可以，肌肉是在休息時長出來的');
    const lowerSore = s.sore.has('lower');
    return { kind: 'recover', badge: '🌿', title: '輕鬆恢復日', reasons: why, tag: r.lv === 2 ? '狀態偏低' : '',
      items: [{ type: lowerSore ? 'walk' : fav(['walk', 'bike', 'swim']), min: 20, rpe: 1 }, flexItem(15)] };
  }
  return data.goal === 'hybrid' ? recommendHybrid(target, s, flexItem, r) : recommendGeneral(s, g, fav, flexItem, r);
}

/* ----- 引體向上 ----- */
// 目標日之前最近一次的最大次數測驗 { k, v }
function lastPullTest(before) {
  const k = Object.keys(data.entries).filter((x) => x < before && data.entries[x].pullMax != null).sort().pop();
  return k ? { k, v: data.entries[k].pullMax } : null;
}
function bestPull() {
  return Object.values(data.entries).reduce((m, e) => (e.pullMax != null && e.pullMax > m ? e.pullMax : m), -1);
}
// 依目前最大次數 M 排引體向上課表：多組、不力竭的次最大量累積總次數；做不到 1 下先練離心；十幾下以後加負重
function pullupEx(M, test, onPullDay) {
  const goal = data.pullGoal || 20;
  const L = [];
  if (test) L.push(X('引體向上測驗', 1, '到力竭', '3 分', false));
  if (M == null) return L.length ? L : [X('引體向上', 4, '能做幾下做幾下', '2 分', false)];
  if (M === 0) L.push(X('離心引體（5 秒放下）', 5, '3', '90 秒', false), X('懸吊', 3, '20–30 秒', '60 秒', false), X('彈力帶輔助引體', 2, '6–8', '90 秒', false));
  else if (M < 5) L.push(X('引體向上', 8, String(Math.max(1, Math.ceil(M / 2))), '90 秒', false), X('離心引體（5 秒放下）', 3, '3', '90 秒', false));
  else if (M < 12) L.push(X('引體向上', 6, String(Math.round(M * .6)), '90–120 秒', false));
  else if (M < goal) {
    if (onPullDay) L.push(X('負重引體向上', 4, '5', '2–3 分'), X('引體向上', 2, String(Math.round(M * .6)), '2 分', false));
    else L.push(X('引體向上', 5, String(Math.round(M * .7)), '90 秒', false));
  } else L.push(X('負重引體向上', 4, '5', '2–3 分'));
  return L;
}

/* ----- 健身＋馬拉松 ----- */
function recommendHybrid(target, s, flexItem, r) {
  const W = GOALS.hybrid.weekly;
  const wd = parseKey(target).getDay();
  const weekend = wd === 0 || wd === 6;
  const ld = s.kindDays;
  const cnt = (k) => s.kindCnt[k] || 0;
  const since = (k, n) => ld[k] == null || ld[k] >= n;   // 距離上次至少 n 天
  const free = (parts) => parts.every((p) => !s.sore.has(p));
  const lowerOk = free(['lower']);
  const items = [];
  const why = [];
  // 今天的狀態與訓練週期：決定明天要不要減量
  const rd = s.raceDays;
  const taper = rd != null && rd >= 1 && rd <= 21;      // 賽前 3 週減量
  const raceWeek = taper && rd <= 7;
  const easyDay = r.lv === 1;                           // 狀態普通
  const lighter = easyDay || s.deload || taper;
  let tag = '';
  if (taper) { tag = `賽前減量 · 剩 ${rd} 天`; why.push(`距離比賽 ${rd} 天：賽前 2–3 週減少跑量與重訓量、保留一點強度，讓身體在比賽日最新鮮`); }
  else if (s.deload) { tag = '減量週'; why.push('每 4 週安排 1 週減量（量減半、頻率不變），讓身體吸收前 3 週的訓練，長期才不會累積疲勞或受傷'); }
  if (easyDay) { tag = tag || '狀態普通 · 已減量'; r.notes.forEach((n) => why.push(n)); }
  else if (r.great && !lighter) tag = '狀態很好';

  // 1. 跑步：週末長跑 → 平日一次強度課 → 其餘輕鬆跑
  let run = null;
  const longDue = since('long', 6);
  if (weekend && longDue && lowerOk && ld.legs !== 1 && ld.quality !== 1 && !raceWeek) run = 'long';
  else if (!weekend && cnt('quality') < W.quality && lowerOk && since('legs', 3) && since('quality', 3) && since('long', 2) && !s.hard) run = 'quality';
  else if (lowerOk && cnt('easy') < W.easy && ld.long !== 1) run = 'easy';
  if (!run && taper && lowerOk && ld.long !== 1) run = 'easy';   // 減量期間降低跑量，但維持跑步頻率
  if (run === 'quality' && (easyDay || (raceWeek && !(rd >= 3 && rd <= 5)))) {
    run = 'easy';
    if (easyDay) why.push('原本該排強度課，今天狀態普通先改成輕鬆跑，強度課延後');
  }

  if (run === 'long') {
    const L = s.lastLong;
    let min = L ? Math.min(180, round5(L.min * 1.1)) : 75;
    let note = L ? `週末長跑：上次 ${L.min} 分鐘${L.km ? `（${L.km} km）` : ''}，這次多約 10%` : '週末長跑：馬拉松最重要的課表，每週一次';
    if (taper) { min = round5(Math.min(rd > 14 ? 150 : 110, (s.peakLong || 90) * (rd > 14 ? .75 : .6))); note = `賽前長跑縮短為最長一次的 ${rd > 14 ? '75' : '60'}%`; }
    else if (s.deload && L) { min = round5(L.min * .7); note = '減量週：長跑縮短約 30%'; }
    else if (easyDay && L) { min = L.min; note = '狀態普通：長跑維持上次的長度，不加長'; }
    const item = { type: 'long_run', min, rpe: 1 };
    if (L && L.km) item.km = Math.min(32, Math.round(L.km * min / L.min));
    items.push(item);
    why.push(note);
    why.push('長跑大約 32–35 km 以上效益遞減、受傷風險增加，不用再拉長');
  } else if (run === 'quality') {
    if (raceWeek) {
      items.push({ type: 'tempo', min: 35, rpe: 2, det: ['暖身 15 分', '馬拉松配速 3 km（找比賽的節奏感）', '緩和 10 分'] });
      why.push('比賽週只保留一次短的馬拉松配速跑，維持節奏感');
    } else {
      // 強度課輪替：節奏跑與 4×4 分鐘間歇（提升最大攝氧量，也是長期健康最重要的體能指標之一）
      const vo2 = s.week % 2 === 1;
      items.push({ type: 'tempo', min: s.deload ? 40 : 50, rpe: 3,
        det: vo2 ? ['暖身慢跑 15 分', '4 × 4 分鐘快跑（很喘、約最大心率 90%），每趟間慢跑 3 分鐘', '緩和慢跑 10 分'] : DETAIL.tempo });
      why.push(vo2 ? '本週強度課：4×4 分鐘間歇，提升最大攝氧量（和長壽、馬拉松成績都有關）' : '本週還沒有強度課；80/20 原則：約 20% 的跑量是節奏跑或間歇');
    }
  } else if (run === 'easy') {
    items.push({ type: 'easy_run', min: raceWeek ? 25 : taper ? 30 : cnt('easy') === 0 && !since('long', 3) ? 30 : 40, rpe: 1 });
    why.push(`近 7 天輕鬆跑 ${cnt('easy')} 次；約 80% 的跑量應該是輕鬆配速，跑量主要靠它增加`);
  } else if (!lowerOk) {
    why.push('腿還在痠痛，今天不跑步');
  }

  // 2. 重訓：胸肩（第一優先）→ 腿（離長跑與強度課遠一點）→ 背
  let lift = null;
  if (run !== 'long') {
    // 腿：不和強度跑同天、不在長跑前一天、不在長跑隔天；超過 8 天沒練就放寬「強度跑隔天」的限制
    const legsOverdue = since('legs', 8);
    const legsDayOk = run !== 'quality' && !(longDue && (wd === 5 || wd === 6)) && ld.long !== 1 && (ld.quality !== 1 || legsOverdue) && !(rd != null && rd >= 0 && rd <= 10);
    if (cnt('push') < W.push && free(['chest', 'shoulder']) && since('push', 2)) lift = 'push';
    else if (cnt('legs') < W.legs && lowerOk && since('legs', 3) && legsDayOk) lift = 'lower';
    else if (cnt('pull') < W.pull && free(['back']) && since('pullup', 2)) lift = 'pull';   // pullup 包含背日，確保背部休息 48 小時
  }
  const liftRpe = s.hard || lighter ? 2 : 3;
  if (lift === 'push') {
    items.unshift({ type: 'push', min: 60, rpe: liftRpe });
    why.push(`大胸肌、寬肩：胸和肩每週練 2 次、每部位 10–20 組（近 7 天 ${cnt('push')} 次）`);
    why.push('上胸用 30° 上斜；肩膀寬度主要靠側三角肌，側平舉要做足量');
  } else if (lift === 'lower') {
    items.unshift({ type: 'lower', min: 50, rpe: liftRpe });
    why.push('腿部大重量（約 80% 1RM 以上）能改善跑步經濟性；已避開長跑和強度課的前後一天');
  } else if (lift === 'pull') {
    items.unshift({ type: 'pull', min: 55, rpe: liftRpe });
    why.push(`背和後三角讓肩膀看起來更寬，也平衡胸推的姿勢（近 7 天 ${cnt('pull')} 次）`);
  }

  // 引體向上：每週 3 次（背日算在內），每 2 週測一次最大次數
  const goal = data.pullGoal || 20;
  const pt = lastPullTest(target);
  const M = pt ? pt.v : null;
  const testDue = (!pt || Math.round((parseKey(target) - parseKey(pt.k)) / 864e5) >= 14) && !easyDay && !taper;
  const pullItem = items.find((i) => i.type === 'pull');
  let pullupAdded = false;
  if (pullItem) {
    pullItem.ex = [...pullupEx(M, testDue, true), ...exFor('pull').slice(1)];
    pullupAdded = true;
  } else if ((M == null || M < goal) && run !== 'long' && cnt('pullup') < W.pullup && free(['back']) && since('pullup', 2)) {
    items.push({ type: 'pullup', min: 15, rpe: lighter ? 2 : 3, ex: pullupEx(M, testDue, false) });
    pullupAdded = true;
  }
  if (pullupAdded) {
    why.push(M == null ? `引體向上 ${goal} 下：先測一次最大次數，課表才能依程度安排`
      : M >= goal ? `引體向上已達 ${goal} 下目標，維持即可` : `引體向上 ${goal} 下：目前 ${M} 下，還差 ${goal - M} 下；每週練 3 次（背日算在內）`);
    if (M != null && M < goal) why.push(M === 0 ? '還拉不起來時，離心引體（慢慢放下）比彈力帶輔助更有效' : '多組、不力竭的次數累積，比每次拚到力竭更能增加最大次數');
    else if (testDue && M != null) why.push('距離上次測驗已 2 週，先測最大次數');
  }
  if (run && lift) why.push('同一天跑步＋重訓：最好間隔 6 小時以上（例：早上輕鬆跑、晚上重訓）');
  if (s.hard && lift) why.push('前一天比較吃力，重訓強度先放中等');

  // 3. 腹肌：每週 3 次、間隔 48 小時，要負重漸進
  if (cnt('core') < W.core && free(['core']) && since('core', 2)) {
    items.push({ type: 'core', min: 15, rpe: 2 });
    why.push(`冰塊腹肌：腹肌每週 3 次、要負重漸進（近 7 天 ${cnt('core')} 次）；但要看得到，體脂約需 10–12%，飲食更關鍵`);
  }
  const sore = [...s.sore];
  if (sore.length) why.push(`${partNames(sore)}痠痛，相關訓練先避開`);

  // 一天最多 3 個主項目，太多就把腹肌移到之後
  if (items.length > 3 && items.some((i) => i.type === 'core')) {
    items.splice(items.findIndex((i) => i.type === 'core'), 1);
    const ci = why.findIndex((w) => w.startsWith('冰塊腹肌'));
    if (ci >= 0) why.splice(ci, 1);
    why.push('今天項目已經夠多，腹肌移到之後');
  }
  // 依狀態調整重訓內容
  // 依狀態調整重訓：組數直接改好（減量週／賽前減半、狀態普通每個動作少 1 組）
  const note = taper ? '賽前減量：組數已減半，不做到力竭' : s.deload ? '減量週：組數已減半，重量不變' : easyDay ? '狀態普通：每個動作已少 1 組，重量不變'
    : r.great ? '狀態很好：主項可以加一點重量' : '';
  const half = s.deload || taper;
  items.forEach((i) => {
    if (TYPE[i.type].cat !== 'strength') return;
    i.ex = (i.ex || exFor(i.type)).map((o) => (o.reps === '到力竭' ? o : { ...o, sets: half ? Math.ceil(o.sets / 2) : easyDay ? Math.max(1, o.sets - 1) : o.sets }));
    if (note) i.note = note;
    if (half || easyDay) i.min = round5(i.min * (half ? .6 : .75));
  });

  if (!items.length) {
    return { kind: 'recover', badge: '🌿', title: '輕鬆恢復日', items: [{ type: 'walk', min: 30, rpe: 1 }, flexItem(15)],
      reasons: ['本週的課表大致都完成了，或相關部位還在恢復', '散步＋伸展就好，讓身體吸收訓練'], tag };
  }
  if (run === 'long' || run === 'quality' || lift === 'lower') items.push(flexItem(10));
  const main = items.filter((i) => TYPE[i.type].cat !== 'flex');
  return { kind: 'train', badge: TYPE[main[0].type].emoji, title: main.map((i) => TYPE[i.type].name).join(' ＋ '), items, reasons: why, tag };
}

/* ----- 其他目標（健康／減重／增肌／耐力） ----- */
const GROUPS = { upper: ['chest', 'shoulder', 'back'], lower: ['lower'], core: ['core'] };
const GROUP_NAME = { upper: '上半身', lower: '腿', core: '核心' };
function recommendGeneral(s, g, fav, flexItem, r) {
  const why = [];
  const items = [];
  const gDays = (k) => { const v = GROUPS[k].map((p) => s.partDays[p]).filter((x) => x != null); return v.length ? Math.min(...v) : null; };
  const gSore = (k) => GROUPS[k].some((p) => s.sore.has(p));
  const rest = { upper: 2, lower: 2, core: 1 };
  const ready = Object.keys(GROUPS).filter((k) => !gSore(k) && (gDays(k) == null || gDays(k) >= rest[k]));
  const cardioGap = Math.max(0, g.cardio - s.cardio) / g.cardio;   // 0–1
  const strengthGap = Math.max(0, g.strength - s.strength) / g.strength;
  const bigReady = ready.filter((p) => p !== 'core');
  const intensity = s.hard || r.lv ? 2 : (s.feel >= 4 ? 3 : 2);
  r.notes.forEach((n) => why.push(n));

  let main;
  if (strengthGap > 0 && bigReady.length && strengthGap >= cardioGap) main = 'strength';
  else if (cardioGap > 0) main = 'cardio';
  else if (strengthGap > 0 && bigReady.length) main = 'strength';
  else main = 'light';

  if (main === 'strength') {
    let type;
    if (bigReady.length === 2 && data.goal !== 'muscle' && (gDays('upper') || 9) >= 3 && (gDays('lower') || 9) >= 3) type = 'full';
    else type = bigReady.sort((a, b) => (gDays(b) || 99) - (gDays(a) || 99))[0];
    items.push({ type, min: data.goal === 'muscle' ? 45 : 35, rpe: intensity });
    why.push(`近 7 天肌力訓練 ${s.strength} 次，目標每週 ${g.strength} 次`);
    const p = type === 'full' ? '上半身與腿' : GROUP_NAME[type];
    const d = type === 'full' ? Math.min(gDays('upper') || 99, gDays('lower') || 99) : gDays(type);
    why.push(d && d < 99 ? `${p}已休息 ${d} 天，可以再練` : `最近 4 週沒練過${p}`);
    if (type !== 'full' && ready.includes('core')) items.push({ type: 'core', min: 10, rpe: 2 });
    if (cardioGap > .3) items.push({ type: fav(['walk', 'bike', 'easy_run']), min: 15, rpe: 1 });
  } else if (main === 'cardio') {
    const lowerOk = ready.includes('lower');
    let cands = lowerOk ? ['easy_run', 'run', 'bike', 'walk', 'swim', 'hike', 'ball', 'hiit'] : ['swim', 'walk'];
    if (s.hard) cands = cands.filter((c) => c !== 'hiit');
    const type = fav(cands);
    const remainDays = Math.max(1, data.days - s.active);
    const need = (g.cardio - s.cardio) / remainDays / (intensity === 3 ? 2 : 1);
    const cap = type === 'hiit' ? 25 : ['lose', 'endurance'].includes(data.goal) ? 60 : 45;
    const min = Math.min(cap, Math.max(20, round5(need)));
    items.push({ type, min, rpe: type === 'walk' ? 2 : intensity });
    why.push(`近 7 天有氧約 ${Math.round(s.cardio)} 分鐘（中等強度換算），目標每週 ${g.cardio} 分鐘`);
    if (!lowerOk) why.push('腿還在恢復，選對腳負擔小的項目');
    if (strengthGap > 0 && !bigReady.length) why.push('肌力部位都還在恢復，今天先做有氧');
    if (ready.includes('core') && strengthGap > 0) items.push({ type: 'core', min: 10, rpe: 2 });
  } else {
    why.push('本週的有氧和肌力目標都達成了，做點喜歡的輕鬆運動就好');
    items.push({ type: fav(['walk', 'bike', 'swim', 'ball']), min: 30, rpe: 1 });
  }
  if (s.hard && main !== 'light') why.push('前一天練得比較吃力，強度以中等為主');
  else if (intensity === 3 && main !== 'light') why.push('前一天精神很好，可以挑戰吃力一點');
  if (s.sore.size) why.push(`${partNames([...s.sore])}痠痛，先避開`);
  if (s.flex < g.flex || s.hard || items.some((i) => TYPE[i.type].cat === 'strength')) items.push(flexItem(10));

  const titles = items.filter((i) => TYPE[i.type].cat !== 'flex').map((i) => TYPE[i.type].name);
  return { kind: 'train', badge: TYPE[items[0].type].emoji, title: titles.join(' ＋ '), items, reasons: why };
}

// 動作表格：名稱｜組數×次數｜組間休息
function exTable(ex) {
  return `<div class="ext">${ex.map((o) => `<span class="n">${esc(o.n)}</span><span class="sr">${o.sets}×${esc(o.reps)}</span><span class="rt">⏱ ${esc(o.rest)}</span>`).join('')}</div>`;
}
// full：明天建議卡片顯示動作內容
function planItemsHtml(p, full) {
  return p.items.map((i) => {
    const t = TYPE[i.type];
    let body = '';
    if (full) {
      const ex = t.cat === 'strength' ? (i.ex || exFor(i.type)) : null;
      const det = ex ? [] : [...(i.det || DETAIL[i.type] || [])];
      if (i.km) det.unshift(`目標約 ${i.km} km`);
      body = (i.note ? `<div class="pnote">${esc(i.note)}</div>` : '') + (ex && ex.length ? exTable(ex) : '')
        + (det.length ? `<ul class="det">${det.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : '');
    }
    return `<div class="plan-item${body ? ' has-det' : ''}"><span class="em">${t.emoji}</span>
      <span class="name">${t.name}<small>${CATS[t.cat]} · ${RPE[i.rpe - 1].label}</small></span>
      <span class="min">${i.min} 分</span>${body ? `<div class="pbody">${body}</div>` : ''}</div>`;
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
  if (e && !e.sessions.length && !e.feel && !(e.sore && e.sore.length) && e.pullMax == null && e.sleep == null && !e.rhr) delete data.entries[k];
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
  $$('#sleep .chip').forEach((b) => b.classList.toggle('on', !!e && e.sleep === +b.dataset.h));
  $('#rhrVal').textContent = e && e.rhr ? e.rhr : '未填';
  // 準備度：今天的狀態會用來排明天
  const rs = recentStats(addDays(curDate, 1));
  const rv = readiness(rs);
  const lvl = rs.feel === 1 || rs.feel === 2 || rv.lv === 2 ? 2 : rv.lv;
  const RL = [['良好', 'var(--c-flex)', '明天照計畫'], ['普通', 'var(--f4)', '明天減量'], ['偏低', 'var(--c-cardio)', '明天恢復']];
  $('#ready').innerHTML = `<span class="tag" style="--c:${RL[lvl][1]}">${rv.great ? '很好' : RL[lvl][0]} · ${rv.great ? '明天可加量' : RL[lvl][2]}</span>`;

  const ss = sessionsOf(curDate);
  $('#sessions').innerHTML = ss.length ? ss.map((s) => {
    const t = TYPE[s.type];
    return `<button class="sess" data-id="${s.id}" style="--c:${catColor(t.cat)}">
      <span class="em">${t.emoji}</span>
      <span class="body"><span class="name">${t.name}</span>
        <span class="meta">${s.km ? `${s.km} km · ${pace(s)}` : s.ex && s.ex.length ? exSummary(s.ex) : CATS[t.cat]} · ${RPE[s.rpe - 1].label}${s.note ? ' · ' + esc(s.note) : ''}</span></span>
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
      <div><div class="k">${next === addDays(todayKey(), 1) ? '明天' : next === todayKey() ? '今天' : shortDate(next) + ' '}建議${p.tag ? ` <span class="plan-tag">${esc(p.tag)}</span>` : ''}</div>
      <div class="t">${esc(p.title)}</div></div></div>
    <div class="plan-items">${planItemsHtml(p, true)}</div>
    <details class="plan-why-d"><summary>為什麼這樣排</summary><ul class="plan-why">${p.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></details>`;

  $('#saveStatus').textContent = e ? `已儲存 · ${fmtTime(e.t)}` : '運動完記下來，建議會自動更新';
  $('#deleteEntry').hidden = !e;
  renderPullCard(e);
  renderBackupTip();
}

/* ----- 引體向上測驗 ----- */
function renderPullCard(e) {
  const goal = data.pullGoal || 20;
  const best = bestPull();
  $('#pullVal').textContent = e && e.pullMax != null ? e.pullMax : '未填';
  $('#pullGoalLbl').textContent = goal;
  $('#pullBest').textContent = best >= 0 ? `${best} 下` : '尚未測驗';
  $('#pullBar').style.width = `${Math.min(100, Math.max(0, best) / goal * 100)}%`;
  const pt = lastPullTest(addDays(curDate, 1));
  const days = pt ? Math.round((parseKey(curDate) - parseKey(pt.k)) / 864e5) : null;
  $('#pullHint').textContent = best >= goal ? `已達成 ${goal} 下！🎉 每 2 週測一次維持`
    : pt == null ? '充分暖身後，標準動作（手臂伸直、下巴過槓）做 1 組到力竭，記下次數'
    : days >= 14 ? `上次測驗是 ${days} 天前，該再測一次了` : `上次測驗：${shortDate(pt.k)}，${pt.v} 下；建議每 2 週測一次`;
}
// ＋／－ 調整數值：第一次按從上一次的值開始，長按不用
function stepper(sel, get, set, start, lo, hi) {
  $(sel).addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    const cur = get();
    if (b.dataset.a === 'x') set(null);
    else set(cur == null ? start() : Math.min(hi, Math.max(lo, cur + (b.dataset.a === '+' ? 1 : -1))));
    touch();
  });
}
stepper('#pullStp', () => { const e = data.entries[curDate]; return e && e.pullMax != null ? e.pullMax : null; }, (v) => {
  const e = ensureEntry();
  if (v == null) { delete e.pullMax; return; }
  const prev = Math.max(-1, ...Object.entries(data.entries).filter(([k]) => k !== curDate).map(([, x]) => (x.pullMax != null ? x.pullMax : -1)));
  e.pullMax = v;
  if (v > prev && prev >= 0) toast(`新紀錄！${v} 下 💪`);
}, () => { const pt = lastPullTest(curDate); return pt ? pt.v : 0; }, 0, 100);

$('#feels').addEventListener('click', (ev) => {
  const b = ev.target.closest('.feel');
  if (!b) return;
  const e = ensureEntry();
  const v = +b.dataset.v;
  if (e.feel === v) delete e.feel; else e.feel = v;
  touch();
});
$('#sleep').innerHTML = [4, 5, 6, 7, 8, 9].map((h) => `<button class="chip" data-h="${h}">${h === 4 ? '≤4' : h === 9 ? '9+' : h}</button>`).join('');
$('#sleep').addEventListener('click', (ev) => {
  const b = ev.target.closest('.chip');
  if (!b) return;
  const e = ensureEntry();
  if (e.sleep === +b.dataset.h) delete e.sleep; else e.sleep = +b.dataset.h;
  touch();
});
stepper('#rhrStp', () => { const e = data.entries[curDate]; return e && e.rhr ? e.rhr : null; }, (v) => {
  const e = ensureEntry();
  if (v == null) delete e.rhr; else e.rhr = v;
}, () => { const k = Object.keys(data.entries).filter((x) => x < curDate && data.entries[x].rhr).sort().pop(); return k ? data.entries[k].rhr : 60; }, 30, 120);
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
  p.items.forEach((i) => {
    const s = { id: uid(), type: i.type, min: i.min, rpe: i.rpe, note: '', ...(i.km ? { km: i.km } : {}) };
    if (TYPE[i.type].cat === 'strength') s.ex = fillEx(i.ex || exFor(i.type)).map((o) => ({ ...o, done: o.sets }));
    e.sessions.push(s);
  });
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

// 上一次做這個動作的重量與次數（自動帶入，不用手打）
function lastEx(n) {
  const keys = Object.keys(data.entries).filter((k) => k <= curDate).sort().reverse();
  for (const k of keys) {
    for (const s of sessionsOf(k)) {
      const o = (s.ex || []).find((x) => x.n === n && x.done > 0);
      if (o && !(k === curDate && editing && s.id === editing.id)) return o;
    }
  }
  return null;
}
const wStep = (w) => (w >= 20 ? 2.5 : 1);
const hiRep = (reps) => { const m = String(reps).match(/(\d+)\D*$/); return m ? +m[1] : 0; };
// 帶入上次的重量與次數；上次每組都完成、次數達到上限 → 自動加重（漸進超負荷）
function fillEx(list) {
  return list.map((o) => {
    const l = lastEx(o.n);
    const x = { ...o, w: l ? l.w || 0 : (o.load ? W0[o.n] || 0 : 0), r: l ? l.r : parseInt(o.reps, 10) || 0, done: 0 };
    if (o.reps === '到力竭') { const pt = lastPullTest(addDays(curDate, 1)); x.r = pt ? pt.v : 0; }
    if (l && o.load && l.w > 0 && l.done >= l.sets && l.r >= hiRep(o.reps)) { x.w = l.w + wStep(l.w); x.r = parseInt(o.reps, 10) || x.r; x.up = true; }
    return x;
  });
}
function exSummary(ex) {
  const done = ex.reduce((a, o) => a + Math.min(o.done || 0, o.sets), 0);
  const tot = ex.reduce((a, o) => a + o.sets, 0);
  const top = ex.find((o) => o.load && o.w > 0);
  return `${done}/${tot} 組${top ? ` · ${top.n} ${top.w}kg×${top.r}` : ''}`;
}
// 這天的建議裡如果有同一種重訓，用它的動作（含引體向上程度、減量後的組數）
function planEx(type) {
  const p = recommend(curDate);
  const it = p.items.find((i) => i.type === type);
  return it ? { ex: it.ex || exFor(type), min: it.min } : { ex: exFor(type), min: null };
}

function openSheet(s) {
  // 新增時預設用最常做的項目
  const last = Object.keys(data.entries).sort().reverse().map(mainSession).find(Boolean);
  editing = s ? JSON.parse(JSON.stringify(s)) : { type: last ? last.type : 'walk', min: last ? last.min : 30, rpe: 2, note: '' };
  if (!s) prepEx(true);
  $('#sheetTitle').textContent = s ? '編輯運動' : '新增運動';
  $('#sheetDelete').hidden = !s;
  $('#sMin').value = editing.min || '';
  $('#sNote').value = editing.note || '';
  $('#sKm').value = editing.km || '';
  renderSheet();
  $('#sheet').hidden = false;
}
// 選了重訓項目時準備動作清單
function prepEx(setMin) {
  if (TYPE[editing.type].cat !== 'strength') { delete editing.ex; return; }
  const pe = planEx(editing.type);
  editing.ex = fillEx(pe.ex);
  if (setMin) { editing.min = pe.min || 45; $('#sMin').value = editing.min; }
}
function renderEx() {
  const ex = editing.ex || [];
  $('#exBox').hidden = !ex.length;
  $('#exList').innerHTML = ex.map((o, i) => `<div class="exr" data-i="${i}">
    <div class="exr-top"><b>${esc(o.n)}</b>${o.up ? '<span class="up">⬆ 加重</span>' : ''}<span class="rt">${o.sets}×${esc(o.reps)} · ⏱ ${esc(o.rest)}</span></div>
    <div class="exr-ctl">
      ${o.load ? `<span class="stp"><button data-a="w-">−</button><b>${o.w ? o.w + ' kg' : '徒手'}</b><button data-a="w+">＋</button></span>` : ''}
      <span class="stp"><button data-a="r-">−</button><b>${o.r} ${/秒/.test(o.reps) ? '秒' : '下'}</b><button data-a="r+">＋</button></span>
      <span class="sets">${Array.from({ length: o.sets }, (_, k) => `<button class="set${k < (o.done || 0) ? ' on' : ''}" data-s="${k}">${k + 1}</button>`).join('')}</span>
    </div></div>`).join('');
}
function renderSheet() {
  renderEx();
  $$('#typeGrid .type').forEach((b) => b.classList.toggle('on', b.dataset.t === editing.type));
  $$('#rpeSeg button').forEach((b) => b.classList.toggle('on', +b.dataset.v === editing.rpe));
  $('#rpeHint').textContent = RPE[editing.rpe - 1].hint;
  $('#kmRow').hidden = !TYPE[editing.type].run;
}
const closeSheet = () => { $('#sheet').hidden = true; editing = null; };
$('#typeGrid').addEventListener('click', (ev) => { const b = ev.target.closest('.type'); if (b && b.dataset.t !== editing.type) { editing.type = b.dataset.t; prepEx(true); renderSheet(); } });
$('#exList').addEventListener('click', (ev) => {
  const b = ev.target.closest('button');
  const row = ev.target.closest('.exr');
  if (!b || !row) return;
  const o = editing.ex[+row.dataset.i];
  const a = b.dataset.a;
  if (a === 'w+') o.w = Math.round((o.w + wStep(o.w)) * 10) / 10;
  else if (a === 'w-') o.w = Math.max(0, Math.round((o.w - wStep(o.w - 0.01)) * 10) / 10);
  else if (a === 'r+') o.r = Math.min(200, o.r + 1);
  else if (a === 'r-') o.r = Math.max(0, o.r - 1);
  else if (b.dataset.s != null) { const k = +b.dataset.s; o.done = (o.done || 0) === k + 1 ? k : k + 1; }   // 點第幾組＝完成到第幾組；再點一次取消
  if (a === 'w+' || a === 'w-') delete o.up;
  renderEx();
});
$('#rpeSeg').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) { editing.rpe = +b.dataset.v; renderSheet(); } });
$('#minQuick').addEventListener('click', (ev) => { const b = ev.target.closest('.chip'); if (b) $('#sMin').value = b.dataset.m; });
$('#sheetCancel').addEventListener('click', closeSheet);
$('#sheet').addEventListener('click', (ev) => { if (ev.target.id === 'sheet') closeSheet(); });
$('#sheetSave').addEventListener('click', () => {
  const min = Math.round(+$('#sMin').value);
  if (!(min > 0 && min <= 600)) { toast('請輸入 1–600 分鐘'); $('#sMin').focus(); return; }
  const e = ensureEntry();
  const s = { id: editing.id || uid(), type: editing.type, min, rpe: editing.rpe, note: $('#sNote').value.trim().slice(0, 60) };
  const km = Math.round(+$('#sKm').value * 100) / 100;
  if (TYPE[s.type].run && km > 0 && km <= 300) s.km = km;
  if (editing.ex && editing.ex.length) {
    s.ex = editing.ex.map(({ up, ...o }) => o);
    // 引體向上測驗做完 → 自動記成這天的最大次數
    const t = s.ex.find((o) => o.reps === '到力竭' && o.done > 0);
    if (t) { e.pullMax = t.r; }
  }
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
  const kc = (k) => s.kindCnt[k] || 0;
  if (data.goal === 'hybrid') {
    const W = g.weekly;
    $('#weekGoal').innerHTML = row('天數', s.active, data.days, '天', 'var(--accent)')
      + row('胸＋肩', kc('push'), W.push, '次', catColor('strength'))
      + row('背', kc('pull'), W.pull, '次', catColor('strength'))
      + row('腿', kc('legs'), W.legs, '次', catColor('strength'))
      + row('腹肌', kc('core'), W.core, '次', catColor('strength'))
      + row('輕鬆跑', kc('easy'), W.easy, '次', catColor('cardio'))
      + row('強度跑', kc('quality'), W.quality, '次', catColor('cardio'))
      + row('長跑', kc('long'), W.long, '次', catColor('cardio'))
      + `<div class="hint">目標：${g.name}。近 7 天跑量 <b>${Math.round(s.runKm * 10) / 10} km</b>（有填公里數的跑步才會計入）</div>`;
  } else $('#weekGoal').innerHTML = row('天數', s.active, data.days, '天', 'var(--accent)')
    + row('有氧', s.cardio, g.cardio, '分', catColor('cardio'))
    + row('肌力', s.strength, g.strength, '次', catColor('strength'))
    + row('伸展', s.flex, g.flex, '次', catColor('flex'))
    + `<div class="hint">目標：${g.name}。有氧以中等強度換算（吃力 1 分鐘 ＝ 2 分鐘，輕鬆 1 分鐘 ＝ 0.5 分鐘）</div>`;

  // 部位恢復
  const rest = PART_REST;
  $('#recovery').innerHTML = Object.entries(PARTS).map(([p, n]) => {
    const d = s.partDays[p];
    const sore = s.sore.has(p);
    const ok = !sore && (d == null || d >= rest[p]);
    return `<div class="rec-row"><span class="name">${n}</span>
      <span class="meta">${d == null ? '4 週內沒練' : d === 1 ? '今天練過' : `${d - 1} 天前練過`}${sore ? '・痠痛' : ''}</span>
      <span class="tag" style="--c:${ok ? 'var(--c-flex)' : 'var(--c-cardio)'}">${ok ? '可以練' : '恢復中'}</span></div>`;
  }).join('');

  // 引體向上紀錄（全部測驗，最近 8 次）
  const goal = data.pullGoal || 20;
  const tests = Object.keys(data.entries).filter((k) => data.entries[k].pullMax != null).sort().slice(-8);
  $('#pullStats').innerHTML = tests.length ? tests.map((k) => {
    const v = data.entries[k].pullMax;
    return `<div class="goal-row"><span>${shortDate(k)}</span>
      <div class="bar"><i style="width:${Math.min(100, v / goal * 100)}%;--c:${catColor('strength')}"></i></div>
      <span class="cnt">${v} / ${goal} 下</span></div>`;
  }).join('') : '<div class="empty">還沒有測驗紀錄，到「今天」頁記下最多能拉幾下</div>';

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
$('#goalSeg').innerHTML = Object.entries(GOALS).map(([k, g]) => `<button class="chip" data-g="${k}">${g.name}</button>`).join('');
$('#daysSeg').innerHTML = [2, 3, 4, 5, 6].map((d) => `<button data-d="${d}">${d} 天</button>`).join('');
function renderSettings() {
  if (document.activeElement !== $('#pullGoalInput')) $('#pullGoalInput').value = data.pullGoal || 20;
  $('#raceDate').value = data.raceDate || '';
  $('#raceClear').hidden = !data.raceDate;
  const rd = data.raceDate ? Math.round((parseKey(data.raceDate) - parseKey(todayKey())) / 864e5) : null;
  $('#raceHint').textContent = rd == null ? '設定後，賽前 3 週會自動減量，賽後 1 週安排恢復'
    : rd > 0 ? `距離比賽還有 ${rd} 天${rd <= 21 ? '，已進入賽前減量' : ''}` : rd === 0 ? '今天比賽，加油！' : '比賽已結束；有下一場時再設定新日期';
  $$('#goalSeg button').forEach((b) => b.classList.toggle('on', b.dataset.g === data.goal));
  $('#goalDesc').textContent = GOALS[data.goal].desc;
  $$('#daysSeg button').forEach((b) => b.classList.toggle('on', +b.dataset.d === data.days));
  const n = Object.keys(data.entries).filter(isActive).length;
  $('#statsLine').textContent = `共 ${n} 天運動紀錄 · 版本 ${VERSION}`;
  const lb = lastBackup();
  $('#exportSub').textContent = lb ? `上次備份：${daysAgo(lb)}` : '尚未備份過';
}
$('#goalSeg').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) { data.goal = b.dataset.g; persist(); renderSettings(); toast('已更新，建議會依新目標計算'); } });
$('#raceDate').addEventListener('change', () => {
  const v = $('#raceDate').value;
  data.raceDate = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
  persist();
  renderSettings();
  toast(data.raceDate ? '已設定比賽日期' : '已清除比賽日期');
});
$('#raceClear').addEventListener('click', () => {
  data.raceDate = '';
  persist();
  renderSettings();
  toast('已清除比賽日期');
});
$('#pullGoalInput').addEventListener('change', () => {
  const v = Math.round(+$('#pullGoalInput').value);
  if (v >= 1 && v <= 100) { data.pullGoal = v; persist(); toast(`引體向上目標：${v} 下`); }
  renderSettings();
});
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
    if (d.pullGoal >= 1 && d.pullGoal <= 100) data.pullGoal = d.pullGoal;
    if (/^\d{4}-\d{2}-\d{2}$/.test(d.raceDate || '')) data.raceDate = d.raceDate;
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
const RENDER = { today: renderToday, calendar: renderCalendar, stats: renderStats, guide: () => {}, settings: renderSettings };
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

/* ================= 安裝引導 ================= */
// iPhone 不允許網頁自己加入主畫面，只能把步驟放在畫面上教；預覽用：網址加 ?guide=safari／safari26／line／chrome
const SHARE_SVG = '<svg viewBox="0 0 24 24"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2"/></svg>';
const MENU_SVG = '<svg viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h9"/></svg>';
const APP_URL = 'https://roychensc.github.io/Fitness/';

function initInstallGuide() {
  const ua = navigator.userAgent;
  const params = new URLSearchParams(location.search);
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const ios = /iPhone|iPod/.test(ua);
  const isLine = /\bLine\//.test(ua);
  const inApp = isLine || /FBAN|FBAV|Instagram|MicroMessenger/.test(ua);
  const ver = Number((ua.match(/Version\/(\d+)/) || [])[1]) || 0;
  let mode = params.get('guide');
  if (!mode) {
    if (standalone || !ios) return;
    let later = false;
    try { later = sessionStorage.getItem('workout-guide-later') === '1'; } catch (e) { /* 略過 */ }
    if (later) return;
    mode = inApp ? 'line' : /CriOS|EdgiOS|FxiOS/.test(ua) ? 'chrome' : ver >= 26 ? 'safari26' : 'safari';
  }

  // LINE：自動改用 Safari 開（LINE 看到 openExternalBrowser=1 會用外部瀏覽器），只試一次避免一直重新整理
  if (mode === 'line' && isLine && !params.has('openExternalBrowser')) {
    let tried = false;
    try { tried = sessionStorage.getItem('workout-ext-tried') === '1'; sessionStorage.setItem('workout-ext-tried', '1'); } catch (e) { tried = true; }
    if (!tried) { location.replace(APP_URL + '?openExternalBrowser=1'); return; }
  }

  const STEPS = {
    line: ['點畫面<b>右上角或右下角的「⋯」</b>', '選<b>「用 Safari 開啟」</b>或<b>「以瀏覽器開啟」</b>', '打開後，照畫面的說明加到桌面'],
    // Chrome／Edge／Firefox（iOS 16.4 起也能加入主畫面）
    chrome: [`點網址旁邊的${SHARE_SVG}<b>「分享」</b>`, '往上滑，點<b>「加入主畫面」</b>', '點右上角<b>「新增」</b>或<b>「加入」</b>'],
    safari: [`點最下面中間的${SHARE_SVG}<b>「分享」</b>`, '往上滑，點<b>「加入主畫面」</b>', '點右上角<b>「新增」</b>'],
    // Safari 26：網址列左邊的「☰」是選單（有些設定是右下角的「⋯」）
    safari26: [`點下面網址<b>左邊的${MENU_SVG}</b><small>沒有的話，點右下角「⋯」</small>`, `點${SHARE_SVG}<b>「分享」</b>`, '往上滑，點<b>「加入主畫面」</b>', '點右上角<b>「新增」</b>或<b>「加入」</b>'],
  };
  if (!STEPS[mode]) return;
  const notSafari = mode === 'line' || mode === 'chrome';
  $('#igTitle').innerHTML = notSafari ? '請改用 Safari 打開' : '把運動日記<br>放到手機桌面';
  $('#igSteps').innerHTML = STEPS[mode].map((t) => `<li><span>${t}</span></li>`).join('');
  $('#igSafari').hidden = !notSafari;
  $('#igLead').hidden = !notSafari;
  const arrow = $('#igArrow');
  arrow.setAttribute('class', 'ig-arrow ' + (mode === 'safari' ? 'center' : 'menu'));   // SVG 不能用 className
  arrow.toggleAttribute('hidden', notSafari);   // LINE、Chrome 的按鈕位置不固定，不畫箭頭
  $('#installGuide').hidden = false;

  $('#igLater').addEventListener('click', () => {
    $('#installGuide').hidden = true;
    try { sessionStorage.setItem('workout-guide-later', '1'); } catch (e) { /* 略過 */ }
  });
}

renderToday();
initInstallGuide();
// 請瀏覽器盡量不要自動清除本機資料
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
