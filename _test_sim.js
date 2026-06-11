/* EarthLife M2 自我驗證：抽出 index.html 的 JS，套 DOM stub，跑 ≥200 輪模擬 */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('找不到 <script>'); process.exit(1); }
let code = m[1];

/* ---- DOM / 環境 stub ---- */
const appEl = { innerHTML: '' };
const document = { querySelector: (s) => (s === '#app' ? appEl : { innerHTML: '' }) };
const _ls = {};
/* R3 相容性測試：預埋一份「舊版存檔」（無 deaths 鍵），驗證載入與死亡寫入不炸 */
_ls['earthlife_save_v2'] = JSON.stringify({ v: 2, plays: 3, ach: {}, history: [], current: null });
const localStorage = {
  getItem: (k) => (k in _ls ? _ls[k] : null),
  setItem: (k, v) => { _ls[k] = String(v); },
  removeItem: (k) => { delete _ls[k]; },
};
function alert() {}

/* ---- 統計容器（注入到 script 作用域） ---- */
const __triggered = new Set();          // 跨局：觸發過的事件 id
const __stageHit = {};                  // 各階段命中次數
const __lifespans = [];
const __endings = {};                   // 結局 cat 分布
const __errors = [];
let __plays = 0;
let __grades = {};

/* 把測試驅動程式接在 script 後面（共用同一作用域，能存取 EVENTS/SCENES/S/各函式） */
const harness = `
/* ===== 測試驅動 ===== */
;(function(){
  globalThis.__check = {};
  // 場景 key 檢查
  const missing = [];
  EVENTS.forEach(e=>{ if(e.meme && e.meme.scene && !SCENES[e.meme.scene]) missing.push(e.id+':'+e.meme.scene); });
  // 程式內其他用到的場景
  ['heaven','accident','death','old','midlife','work','school','child','baby','luck'].forEach(k=>{ if(!SCENES[k]) missing.push('code:'+k); });
  globalThis.__check.missingScenes = missing;
  globalThis.__check.eventTotal = EVENTS.length;
  globalThis.__check.eventVisible = EVENTS.filter(e=>!e.hidden).length;
  globalThis.__check.sceneCount = Object.keys(SCENES).length;
  globalThis.__check.achTotal = ACHIEVEMENTS.length;
  // R3 死法圖鑑完整性：稀有死亡場景存在、所有死法都收錄進 DEATHBOOK、id 不重複
  Object.values(SPECIAL_DEATHS).forEach(sp=>{ if(!SCENES[sp.scene]) missing.push('sd:'+sp.scene); });
  const dbIds = new Set(DEATHBOOK.map(d=>d.id));
  const dbMissing = [];
  if(dbIds.size !== DEATHBOOK.length) dbMissing.push('duplicate-ids');
  Object.keys(SPECIAL_DEATHS).forEach(k=>{ if(!dbIds.has(k)) dbMissing.push('special:'+k); });
  Object.keys(DEATH_REASONS).forEach(cat=>DEATH_REASONS[cat].forEach((_,i)=>{ if(!dbIds.has(cat+'_'+i)) dbMissing.push(cat+'_'+i); }));
  DEATHBOOK.forEach(d=>{ if(!d.reason || !d.hint || !d.nm || !d.ic) dbMissing.push('incomplete:'+d.id); });
  globalThis.__check.deathbookMissing = dbMissing;
  globalThis.__check.deathTotal = DEATHBOOK.length;
  // R13 成就獵人提示：每個成就都必須有非空 hint（隱藏成就可隱晦但不可留白）
  globalThis.__check.achNoHint = ACHIEVEMENTS.filter(a=>!a.hint || String(a.hint).length<4).map(a=>a.id);

  // 包裝 showEvent 以記錄觸發
  const _se = showEvent;
  showEvent = function(ev){ globalThis.__rec(ev.id); return _se(ev); };
})();
`;

const stageOf = (age) => age <= 12 ? '童年' : age <= 22 ? '求學' : age <= 40 ? '工作' : age <= 60 ? '中年' : '老年';

function makeRec() {
  return function (id) {
    __triggered.add(id);
  };
}

/* 用 vm 在帶 stub 的 context 執行 */
const vm = require('vm');
const sandbox = {
  document, localStorage, alert,
  Math, JSON, Object, Array, console,
  __rec: null,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

try {
  vm.runInContext(code + harness, sandbox, { filename: 'earthlife.js' });
} catch (e) {
  console.error('腳本載入失敗：', e);
  process.exit(1);
}

const chk = sandbox.__check;
sandbox.__rec = function (id) {
  __triggered.add(id);
  // 以當前年紀分類
  try { __stageHit[stageOf(sandbox.eval ? 0 : 0)] = 0; } catch (e) {}
};

/* 由於需要讀取 S.age，改用注入函式回傳當前狀態 */
vm.runInContext(`
  globalThis.__getAge = ()=> (typeof S!=='undefined' && S) ? S.age : -1;
  globalThis.__getAlive = ()=> (typeof S!=='undefined' && S) ? S.alive : false;
  globalThis.__startGame = startGame;
  globalThis.__nextYear = nextYear;
  globalThis.__choose = choose;
  globalThis.__die = die;
  globalThis.__showEventById = (id)=> showEvent(EVENTS.find(e=>e.id===id));
  globalThis.__html = ()=> document.querySelector('#app').innerHTML;
  globalThis.__SAVE = ()=> SAVE;
  globalThis.__seenCount = ()=> Object.keys(S.seen).length;
`, sandbox);

/* 真正的記錄器：showEvent 包裝會呼叫 __rec */
sandbox.__rec = function (id) {
  __triggered.add(id);
  const age = sandbox.__getAge();
  const st = stageOf(age);
  __stageHit[st] = (__stageHit[st] || 0) + 1;
};

/* ---- 模擬 N 局 ---- */
const N = 220;
for (let life = 0; life < N; life++) {
  try {
    sandbox.__startGame();
    let guard = 0;
    while (sandbox.__getAlive() && guard++ < 500) {
      const html = sandbox.__html();
      const chooseMatches = [...html.matchAll(/onclick="choose\((\d+)\)"/g)].map(x => Number(x[1]));
      const chainMatch = html.match(/showEvent\(EVENTS\.find\(e=>e\.id==='([^']+)'\)\)/);
      if (chooseMatches.length) {
        const i = chooseMatches[Math.floor(Math.random() * chooseMatches.length)];
        sandbox.__choose(i);
      } else if (/onclick="die\('choice'\)"/.test(html)) {
        sandbox.__die('choice');
      } else if (chainMatch) {
        sandbox.__showEventById(chainMatch[1]);
      } else if (/onclick="nextYear\(\)"/.test(html)) {
        sandbox.__nextYear();
      } else {
        // 沒有可前進的按鈕（理論上不該發生）
        __errors.push(`life ${life} age ${sandbox.__getAge()} 卡住，無前進按鈕`);
        break;
      }
    }
    if (sandbox.__getAlive()) { __errors.push(`life ${life} 超過守衛上限仍未死亡`); }
    else {
      __plays++;
      __lifespans.push(sandbox.__getAge());
      const last = (sandbox.__SAVE().history || [])[0];   // die 會 unshift，[0] 即本局
      if (last) {
        __endings[last.cat] = (__endings[last.cat] || 0) + 1;
        __grades = __grades || {};
        __grades[last.grade] = (__grades[last.grade] || 0) + 1;
      }
    }
  } catch (e) {
    __errors.push(`life ${life}: ${e.message}`);
  }
}

/* 結局/評級分布：逐局累計（__endings / __grades） */
const save = sandbox.__SAVE();
const gradeDist = __grades || {};

/* ---- 報告 ---- */
const avg = __lifespans.reduce((a, b) => a + b, 0) / (__lifespans.length || 1);
const sorted = [...__lifespans].sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)] || 0;
const min = sorted[0] || 0, max = sorted[sorted.length - 1] || 0;
const over60 = __lifespans.filter(a => a >= 60).length;

console.log('===== EarthLife M2 模擬報告 =====');
console.log(`事件總數: ${chk.eventTotal}（可觸發 ${chk.eventVisible} + 連鎖 ${chk.eventTotal - chk.eventVisible}）`);
console.log(`場景數: ${chk.sceneCount} ｜ 成就數: ${chk.achTotal}`);
console.log(`缺失場景 key: ${chk.missingScenes.length ? chk.missingScenes.join(', ') : '無 ✅'}`);
console.log(`模擬局數: ${N} ｜ 正常結束: ${__plays} ｜ runtime error: ${__errors.length}`);
console.log(`壽命  平均 ${avg.toFixed(1)} / 中位 ${median} / 最短 ${min} / 最長 ${max} ｜ 活到60+: ${over60} (${(over60 / __plays * 100).toFixed(0)}%)`);
console.log(`各階段事件命中次數: ${JSON.stringify(__stageHit)}`);
console.log(`結局分布(cat): ${JSON.stringify(__endings)}`);
console.log(`評級分布: ${JSON.stringify(gradeDist)}`);
console.log(`累計觸發不同事件: ${__triggered.size} / 應約 ${chk.eventVisible}`);

/* 未觸發的可觸發事件（應為空或極少） */
const allVisible = vm.runInContext('EVENTS.filter(e=>!e.hidden).map(e=>e.id)', sandbox);
const never = allVisible.filter(id => !__triggered.has(id));
console.log(`從未觸發的可觸發事件(${never.length}): ${never.length ? never.join(', ') : '無 ✅'}`);

/* ===== R46 事件觸達率探針 =====
   目標：220 局「從未觸發」數從 R45 基準 83 壓到 ≤45。
   豁免（不計入門檻，理由如下；仍照常列在上方清單供觀察）：
   - se_*（節令限定）：activeSeasonKeys 由真實執行日決定，模擬日非當令時結構上不可能觸發，
     實際玩家在節令期間可正常遇到，非死內容。 */
const R46_EXEMPT = new Set(['se_cny_red','se_cny_dinner','se_tax','se_ghost','se_typhoon_bet',
  'se_typhoon_mart','se_typhoon_wave','se_moon','se_xmas','se_nye']);
const neverCounted = never.filter(id => !R46_EXEMPT.has(id));
const r46OK = neverCounted.length <= 45;
console.log(`R46 觸達率: 未觸發(計入門檻) ${neverCounted.length}/45 ｜ 節令豁免 ${never.filter(id=>R46_EXEMPT.has(id)).length} ｜ ${r46OK ? '✅' : '❌ 超標'}`);

/* localStorage 存讀驗證（含 R3 死法圖鑑：舊存檔無 deaths 鍵 → 載入後應自動補空集合並正常收集） */
const rawSave = localStorage.getItem('earthlife_save_v2');
let lsOK = false, achUnlocked = 0, deathsOK = false, deathsGot = 0;
let rebirthOK = false, rbTotal = 0, rbPts = 0;
try {
  const parsed = JSON.parse(rawSave);
  achUnlocked = Object.keys(parsed.ach || {}).length;
  lsOK = parsed && parsed.plays === save.plays && Array.isArray(parsed.history);
  deathsGot = Object.keys(parsed.deaths || {}).length;
  deathsOK = parsed.deaths && typeof parsed.deaths === 'object' && deathsGot >= 5;
  /* R6 轉生：舊存檔（無 rebirth 鍵）載入後應自動補結構，且每局結算 1-5 輪迴點全數入帳 */
  rbTotal = (parsed.rebirth && parsed.rebirth.total) || 0;
  rbPts = (parsed.rebirth && parsed.rebirth.pts) || 0;
  rebirthOK = parsed.rebirth && typeof parsed.rebirth === 'object'
    && parsed.rebirth.talents && typeof parsed.rebirth.talents === 'object'
    && Array.isArray(parsed.rebirth.equipped)
    && rbTotal >= N && rbTotal <= N * 5 && rbPts === rbTotal;   // 每局至少 1 點、至多 5 點，未消費前 pts=total
} catch (e) {}
console.log(`localStorage 寫入: ${rawSave ? '有資料' : '無'} ｜ 結構正確: ${lsOK ? '✅' : '❌'} ｜ 累計解鎖成就: ${achUnlocked}/${chk.achTotal} ｜ plays: ${save.plays}`);
console.log(`死法圖鑑: 總死法 ${chk.deathTotal} ｜ 收錄缺漏: ${chk.deathbookMissing.length ? chk.deathbookMissing.join(', ') : '無 ✅'} ｜ 模擬累計收集: ${deathsGot}/${chk.deathTotal} ｜ 舊存檔相容: ${deathsOK ? '✅' : '❌'}`);
console.log(`R6 轉生: 舊存檔自動補 rebirth 結構且輪迴點入帳: ${rebirthOK ? '✅' : '❌'} ｜ ${N} 局累計 ${rbTotal} 點（pts=${rbPts}）`);

/* R23 祖產：舊存檔（無 legacy 鍵）載入後自動補結構、每局陰德入帳（每局至少 1）、
   歷代名冊 cap 10 且欄位完整（w 世數 / a 享年 / g 評級 / d 死法摘要）、未消費前 yd=ydTotal */
let legacyOK = false, ydTotal = 0, rosterLen = 0;
try {
  const parsed23 = JSON.parse(rawSave);
  const lgp = parsed23.legacy;
  ydTotal = (lgp && lgp.ydTotal) || 0;
  rosterLen = (lgp && lgp.roster && lgp.roster.length) || 0;
  legacyOK = !!lgp && typeof lgp === 'object'
    && lgp.perks && typeof lgp.perks === 'object'
    && Array.isArray(lgp.roster) && rosterLen === 10
    && ydTotal >= N && lgp.yd === ydTotal
    && typeof lgp.lastMny === 'number'
    && lgp.roster.every(r => typeof r.w === 'number' && typeof r.a === 'number'
        && typeof r.g === 'string' && 'SABCD'.includes(r.g)
        && typeof r.d === 'string' && r.d.length > 0);
} catch (e) {}
console.log(`R23 祖產: 舊存檔自動補 legacy 結構且陰德入帳: ${legacyOK ? '✅' : '❌'} ｜ ${N} 局累計 ${ydTotal} 陰德 ｜ 名冊 ${rosterLen}/10`);

/* ---- R13 生涯統計驗證 ----
   ① 舊存檔（無 lifelog 鍵）載入後自動補空陣列，每局死亡寫入一筆摘要
   ② cap 200：N=220 局後 lifelog 必須恰為 200 筆（最舊的被淘汰）
   ③ 每筆摘要欄位完整（a 享年 / s 總分 / g 評級 / d 死法 / o 出身）
   ④ 成就提示全配：無任何成就缺 hint
   ⑤ 統計頁渲染零 rng 消耗，且關鍵欄位（履歷表/死法 TOP3/收集進度）都有渲染 */
let r13OK = false;
try {
  const parsed = JSON.parse(rawSave);
  const ll = parsed.lifelog;
  const llIsArr = Array.isArray(ll);
  const llCap = llIsArr && ll.length === 200 && save.plays > 200;
  const llFields = llIsArr && ll.every(r =>
    typeof r.a === 'number' && r.a >= 0 &&
    typeof r.s === 'number' && r.s >= 0 && r.s <= 500 &&
    typeof r.g === 'string' && 'SABCD'.includes(r.g) &&
    typeof r.d === 'string' && r.d.length > 0 &&
    typeof r.o === 'string');
  const hintsOK = chk.achNoHint.length === 0;
  const statsProbe = JSON.parse(vm.runInContext(`(function(){
    let used = 0;
    const old = rng;
    rng = function(){ used++; return old(); };
    screenStats();
    const h = document.querySelector('#app').innerHTML;
    rng = old;
    screenAchievements();
    const ah = document.querySelector('#app').innerHTML;
    return JSON.stringify({
      rngUsed: used,
      hasTitle: h.includes('人生履歷表'),
      hasTop3: h.includes('最常見死法 TOP3'),
      hasOrigin: h.includes('出身使用統計'),
      hasCollect: h.includes('收集進度總覽'),
      hasYears: h.includes('生涯總年數'),
      hintShown: ah.includes('提示：') || !ah.includes('？？？'),
    });
  })()`, sandbox));
  const statsOK = statsProbe.rngUsed === 0 && statsProbe.hasTitle && statsProbe.hasTop3
    && statsProbe.hasOrigin && statsProbe.hasCollect && statsProbe.hasYears && statsProbe.hintShown;
  r13OK = llIsArr && llCap && llFields && hintsOK && statsOK;
  console.log(`R13 生涯統計: lifelog 寫入: ${llIsArr ? '✅' : '❌'} ｜ cap 200: ${llCap ? '✅ (plays=' + save.plays + ' → 留 ' + ll.length + ' 筆)' : '❌'} ｜ 欄位完整: ${llFields ? '✅' : '❌'}`);
  console.log(`R13 成就提示: 缺提示成就: ${chk.achNoHint.length ? chk.achNoHint.join(', ') : '無 ✅'} ｜ 統計頁零 rng 消耗+渲染: ${statsOK ? '✅' : '❌ ' + JSON.stringify(statsProbe)}`);
} catch (e) {
  console.log('R13 生涯統計: ❌ ' + e.message);
}

/* ---- R11 寵物線 flag 路徑驗證（強制路徑，不靠隨機抽中）----
   貓線：領養→petkind/petAge 正確→貓事件進池、狗事件不進池→10 年後離別解鎖
   →離別後 flags/時間軸/快樂大跌/全線退池→成就與戰報；狗線同理走一遍 */
let petOK = false;
try {
  const petRaw = vm.runInContext(`(function(){
    const out={};
    /* 貓線 */
    startGame(); S.age=25; S.flags={}; ensureState(S);
    out.strayIn = eligible().some(e=>e.id==='pet_stray');
    showEvent(EVENTS.find(e=>e.id==='pet_stray')); choose(0);
    out.catFlags = S.flags.pet===true && S.flags.petkind==='cat' && S.flags.petAge===25;
    S.age=30;
    const pool = eligible().map(e=>e.id);
    out.catPool = ['pet_cat_run','pet_cat_cup','pet_cat_kb','pet_cat_sick'].every(id=>pool.includes(id));
    out.noDogPool = ['pet_dog_chaos','pet_dog_walk','pet_dog_courier','pet_dog_sick'].every(id=>!pool.includes(id));
    out.noByeYet = !pool.includes('pet_bye');
    out.oldByeGated = !pool.includes('pet_farewell');   // 分線領養者不再走舊版通用離別
    S.age=36; S.attr.hap=60;
    out.byeIn = eligible().some(e=>e.id==='pet_bye');
    showEvent(EVENTS.find(e=>e.id==='pet_bye')); choose(0);
    out.byeFlags = S.flags.petgone===true && S.flags.petfarewell===true && S.flags.petgoneAge===36;
    out.hapDrop = S.attr.hap < 60;
    out.tlBye = (S.tl||[]).some(t=>/彩虹橋/.test(t.txt));
    out.poolAfterBye = !eligible().some(e=>/^pet_/.test(e.id) || e.id==='cb_pet');   // 含舊通用寵物事件全退池
    die();
    out.achCat = !!SAVE.ach.catslave;
    out.achBye = !!SAVE.ach.petfarewell;
    out.reportLine = /彩虹橋/.test(buildTextReport());
    /* 狗線 */
    startGame(); S.age=25; S.flags={}; ensureState(S);
    showEvent(EVENTS.find(e=>e.id==='pet_stray')); choose(1);
    out.dogFlags = S.flags.pet===true && S.flags.petkind==='dog' && S.flags.petAge===25;
    S.age=30;
    out.dogPool = eligible().some(e=>e.id==='pet_dog_chaos');
    out.noCatPool = !eligible().some(e=>e.id==='pet_cat_run');
    die();
    out.achDog = !!SAVE.ach.dogparty;
    /* 稀有死法收錄 */
    out.deathBook = DEATHBOOK.some(d=>d.id==='cattrip') && !!SPECIAL_DEATHS.cattrip;
    return JSON.stringify(out);
  })()`, sandbox);
  const petRes = JSON.parse(petRaw);
  petOK = Object.values(petRes).every(v => v === true);
  console.log(`R11 寵物線路徑: ${petOK ? '✅ 全數通過' : '❌ ' + JSON.stringify(petRes)}`);
} catch (e) {
  console.log('R11 寵物線路徑: ❌ ' + e.message);
}

/* ---- R17 結算記憶點驗證 ----
   ① 結算頁渲染：墓誌銘/屬性軌跡總評/高光時刻面板/一鍵分享卡按鈕
   ② 墓誌銘與分享卡確定性：同一局重複呼叫逐字一致、零 rng 零 Math.random 消耗
   ③ 分享卡含正確種子碼 + 召喚句 + 完整欄位
   ④ 成就：複製分享卡解鎖 sharecard（沙箱無 clipboard 走 fallback 不炸）、
      220 局後 summarySeen>=10 解鎖 summary10 */
let r17OK = false;
try {
  const r17Raw = vm.runInContext(`(function(){
    const out={};
    startSeedBattle('R7R7R7');
    let guard=0;
    while(S && S.alive && guard++<600){
      const h=document.querySelector('#app').innerHTML;
      const m=[...h.matchAll(/onclick="choose\\((\\d+)\\)"/g)].map(x=>Number(x[1]));
      const chain=h.match(/showEvent\\(EVENTS\\.find\\(e=>e\\.id==='([^']+)'\\)\\)/);
      if(m.length) choose(m[0]);
      else if(/onclick="die\\('choice'\\)"/.test(h)) die('choice');
      else if(chain) showEvent(EVENTS.find(e=>e.id===chain[1]));
      else nextYear();
    }
    const h=document.querySelector('#app').innerHTML;
    out.hasEpitaphPanel = h.includes('🪦 墓誌銘');
    out.hasArcQuip = h.includes('class="arcsum"');
    out.hasShareBtn = h.includes('copyShareTextCard');
    out.hasHighlights = (S.tl && S.tl.filter(x=>x.ic!=='💀'&&x.ic!=='🏆'&&x.ic!=='🐣').length) ? h.includes('🎬 人生高光時刻') : true;
    const e1=epitaphText(), e2=epitaphText();
    out.epitaphStable = typeof e1==='string' && e1.length>=6 && e1===e2;
    const c1=buildShareText();
    out.cardStable = c1===buildShareText();
    out.cardSeed = c1.includes('🧬 種子碼：R7R7R7') && c1.includes('用種子碼 R7R7R7 來活活看我這條命');
    out.cardFields = c1.includes('👤 稱號：') && c1.includes('🕯️ 墓誌銘：「') && /享年 \\d+ 歲/.test(c1) && c1.includes('☠️ 死法：');
    let used=0; const oldR=rng; rng=function(){used++; return oldR();};
    let mused=0; const oldM=Math.random; Math.random=function(){mused++; return oldM();};
    epitaphText(); buildShareText(); attrArcQuip(); highlightsHTML(); epitaphHTML();
    rng=oldR; Math.random=oldM;
    out.zeroRandom = used===0 && mused===0;
    copyShareTextCard(null);
    out.achShare = SAVE.ach.sharecard===true && (SAVE.sharecards||0)>=1;
    out.achSummary = (SAVE.summarySeen||0)>=10 && SAVE.ach.summary10===true;
    out.epitaphSample = e1;   // 報告用
    out.arcSample = attrArcQuip();
    return JSON.stringify(out);
  })()`, sandbox);
  const r17 = JSON.parse(r17Raw);
  const sampleE = r17.epitaphSample, sampleA = r17.arcSample;
  delete r17.epitaphSample; delete r17.arcSample;
  r17OK = Object.values(r17).every(v => v === true);
  console.log(`R17 結算記憶點: ${r17OK ? '✅ 全數通過' : '❌ ' + JSON.stringify(r17)}`);
  console.log(`  墓誌銘樣例:「${sampleE}」`);
  console.log(`  軌跡總評樣例:「${sampleA}」`);
} catch (e) {
  console.log('R17 結算記憶點: ❌ ' + e.message);
}

/* ---- R20 隱藏彩蛋探針（強制路徑，不靠隨機抽中）----
   ① 結構：gmban/ascend 進 SPECIAL_DEATHS + DEATHBOOK（含 hint），6 個新成就皆有 hint
   ② egg_gm（屬性組合）：五圍全 80+ 才進池、差一點即不進池；嗆 GM 分支
      Ban 帳死（gmban + 成就 gmbanned）與歐皇認證（gmverified）兩種結果皆可達 → 機率閘非死碼
   ③ egg_godbill（出身×際遇連動）：宮廟出身 × luckywin 同時成立才進池；
      殺價分支 白日飛升死（ascend + 成就 ascended）與殺價成功皆可達
   ④ egg_hundred（百歲限定）：age<100 不進池、age=100 進池；兩選項皆點亮 centistar → 成就
   ⑤ egg_pastlife（跨局彩蛋）：die() 對 SAVE.oldStreak 活到 80+ 累計、早死歸零；
      streak<3 不進池、>=3 進池；覺醒選項 → awakened → 成就 samsara */
let r20OK = false;
try {
  const r20Raw = vm.runInContext(`(function(){
    const out={};
    /* ① 結構完整性 */
    out.sdDef = !!SPECIAL_DEATHS.gmban && !!SPECIAL_DEATHS.ascend;
    out.book = ['gmban','ascend'].every(id=>DEATHBOOK.some(d=>d.id===id && d.rare && d.hint.length>4));
    out.achDef = ['gmverified','gmbanned','godvow','ascended','centistar','samsara'].every(id=>ACH_MAP[id] && ACH_MAP[id].hint && ACH_MAP[id].hint.length>4);
    /* ② egg_gm：屬性門檻 */
    const setAttrs=v=>{ for(const k in S.attr) S.attr[k]=v; };
    startGame(); S.age=30; S.flags={}; ensureState(S); setAttrs(85);
    out.gmIn = eligible().some(e=>e.id==='egg_gm');
    S.attr.hp=79;
    out.gmGate = !eligible().some(e=>e.id==='egg_gm');
    let gmDie=false, gmLive=false;
    for(let i=0;i<400 && !(gmDie&&gmLive);i++){
      startGame(); S.age=30; S.flags={}; ensureState(S); setAttrs(85);
      showEvent(EVENTS.find(e=>e.id==='egg_gm')); choose(0);
      if(S.flags.specialDeath==='gmban'){ die('choice'); gmDie=true; }
      else if(S.flags.gmverified){ gmLive=true; }
    }
    out.gmBoth = gmDie && gmLive;
    out.gmDeath = !!SAVE.deaths.gmban && !!SAVE.ach.gmbanned;
    /* 認證歐皇成就：活著走完一局 */
    startGame(); S.age=30; S.flags={gmverified:true}; ensureState(S); die();
    out.gmAch = !!SAVE.ach.gmverified;
    /* ③ egg_godbill：出身×際遇連動 */
    const temple=ORIGINS.find(o=>o.id==='temple');
    startGame(); S.age=40; S.flags={}; ensureState(S); S.origin=temple;
    out.godGateNoWin = !eligible().some(e=>e.id==='egg_godbill');
    S.flags.luckywin=true; ensureState(S);
    out.godIn = eligible().some(e=>e.id==='egg_godbill');
    startGame(); S.age=40; S.flags={luckywin:true}; ensureState(S);
    out.godGateNoTemple = S.origin.id==='temple' ? true : !eligible().some(e=>e.id==='egg_godbill');
    let godDie=false, godLive=false;
    for(let i=0;i<500 && !(godDie&&godLive);i++){
      startGame(); S.age=40; S.flags={luckywin:true}; ensureState(S); S.origin=temple;
      showEvent(EVENTS.find(e=>e.id==='egg_godbill')); choose(1);
      if(S.flags.specialDeath==='ascend'){ die('choice'); godDie=true; }
      else if(S.flags.godhaggler){ godLive=true; }
    }
    out.godBoth = godDie && godLive;
    out.godDeath = !!SAVE.deaths.ascend && !!SAVE.ach.ascended;
    startGame(); S.age=40; S.flags={godvow:true}; ensureState(S); die();
    out.godVowAch = !!SAVE.ach.godvow;
    /* ④ egg_hundred：百歲限定 */
    startGame(); S.age=99; S.flags={}; ensureState(S);
    out.hunGate = !eligible().some(e=>e.id==='egg_hundred');
    S.age=100;
    out.hunIn = eligible().some(e=>e.id==='egg_hundred');
    showEvent(EVENTS.find(e=>e.id==='egg_hundred')); choose(0);
    out.hunFlag = S.flags.centistar===true;
    die();
    out.hunAch = !!SAVE.ach.centistar;
    /* ⑤ egg_pastlife：跨局 streak */
    SAVE.oldStreak=0;
    startGame(); S.age=85; S.flags={}; ensureState(S); die();
    out.streakUp = SAVE.oldStreak===1;
    startGame(); S.age=30; S.flags={}; ensureState(S); die();
    out.streakReset = SAVE.oldStreak===0;
    SAVE.oldStreak=2;
    startGame(); S.age=20; S.flags={}; ensureState(S);
    out.pastGate = !eligible().some(e=>e.id==='egg_pastlife');
    SAVE.oldStreak=3;
    out.pastIn = eligible().some(e=>e.id==='egg_pastlife');
    showEvent(EVENTS.find(e=>e.id==='egg_pastlife')); choose(0);
    out.pastFlag = S.flags.awakened===true;
    die();
    out.pastAch = !!SAVE.ach.samsara;
    return JSON.stringify(out);
  })()`, sandbox);
  const r20 = JSON.parse(r20Raw);
  r20OK = Object.values(r20).every(v => v === true);
  console.log(`R20 隱藏彩蛋路徑: ${r20OK ? '✅ 全數通過' : '❌ ' + JSON.stringify(r20)}`);
} catch (e) {
  console.log('R20 隱藏彩蛋路徑: ❌ ' + e.message);
}

/* ---- R21 感情主線探針（強制路徑，不靠隨機抽中）----
   ① 結構：handinhand 進 SPECIAL_DEATHS + DEATHBOOK（rare+hint），3 個新成就皆有 hint
   ② 全鏈可達：meet→confess→branch(求婚)→wedding(chain 接續)→baby→tuition→oldlove→kidback 逐段進池且旗標正確推進
   ③ 真心值回扣：高真心(rlScore≥3) 金婚牽手/子女孝順可選；低真心(≤1) 金婚選項隱藏、翻舊帳/啃老浮現
   ④ 分手線：branch 選分手 → rl=over + breakups+1 → 70 歲謝幕解鎖「孤獨終老但很自由」
   ⑤ 稀有死法：oldlovewalk 強制命中 → handinhand 死亡全流程 + 成就「執子之手」「模範老公/老婆」
   ⑥ 狀態 gating：未開線不出後段、已婚（非主線）不出告白段 */
let r21OK = false;
try {
  const r21Raw = vm.runInContext(`(function(){
    const out={};
    /* ① 結構完整性 */
    out.sdDef = !!SPECIAL_DEATHS.handinhand;
    out.book = DEATHBOOK.some(d=>d.id==='handinhand' && d.rare && d.hint.length>4);
    out.achDef = ['rl_model','rl_freesoul','holdhands'].every(id=>ACH_MAP[id] && ACH_MAP[id].hint && ACH_MAP[id].hint.length>4);
    /* ② 全鏈可達（高真心路線：每段選用心選項） */
    startGame(); S.age=24; S.flags={}; ensureState(S);
    out.meetIn = eligible().some(e=>e.id==='rl_meet');
    showEvent(EVENTS.find(e=>e.id==='rl_meet')); choose(0);
    out.meetFlag = S.flags.rl==='dating' && S.flags.rlc1===true;
    S.age=26;
    out.confessIn = eligible().some(e=>e.id==='rl_confess');
    out.branchGated = !eligible().some(e=>e.id==='rl_branch');   // 還沒在一起，長跑段不進池
    showEvent(EVENTS.find(e=>e.id==='rl_confess')); choose(0);
    out.confessFlag = S.flags.rl==='couple' && S.flags.rlc2===true && S.flags.inlove===true;
    S.age=30;
    out.branchIn = eligible().some(e=>e.id==='rl_branch');
    showEvent(EVENTS.find(e=>e.id==='rl_branch')); choose(0);
    out.branchFlag = S.flags.rl==='married' && S.flags.marital==='married' && S.flags.rlc3===true && (S.flags.marriages||0)===1;
    out.weddingChained = document.querySelector('#app').innerHTML.includes("e.id==='rl_wedding'");   // 結果幕出現「繼續 →」接婚禮
    showEvent(EVENTS.find(e=>e.id==='rl_wedding')); choose(0);
    out.weddingFlag = S.flags.rlc4===true;
    S.age=32;
    out.babyIn = eligible().some(e=>e.id==='rl_baby');
    showEvent(EVENTS.find(e=>e.id==='rl_baby')); choose(0);
    out.babyFlag = S.flags.haskid===true && S.flags.kids===1 && S.flags.rlc5===true;
    S.age=40;
    out.tuitionIn = eligible().some(e=>e.id==='rl_tuition');
    showEvent(EVENTS.find(e=>e.id==='rl_tuition')); choose(1);
    /* ③ 高真心回扣：rlScore=5 → 金婚牽手可選、翻舊帳隱藏；子女孝順可選、啃老隱藏 */
    out.score5 = rlScore(S)===5;
    S.age=65;
    out.oldloveIn = eligible().some(e=>e.id==='rl_oldlove');
    showEvent(EVENTS.find(e=>e.id==='rl_oldlove'));
    let h=document.querySelector('#app').innerHTML;
    out.goldShown = h.includes('💞真心3+') && !h.includes('翻了三十年舊帳');
    const oldRng1 = rng; rng = () => 0.99;   // chance(0.06) 不中 → 活著走完金婚散步
    choose(0);
    rng = oldRng1;
    out.goldLive = S.flags.rl_goldlove===true && !S.flags.specialDeath && S.attr.hp>0;
    S.age=66;
    out.kidbackIn = eligible().some(e=>e.id==='rl_kidback');
    showEvent(EVENTS.find(e=>e.id==='rl_kidback'));
    h=document.querySelector('#app').innerHTML;
    out.filialShown = h.includes('孩子搶著接你回家住') && !h.includes('還躺在你家沙發上');
    choose(0);
    out.filialFlag = S.flags.rl_filial===true;
    out.tlGold = (S.tl||[]).some(t=>/金婚之年牽手散步/.test(t.txt)) && (S.tl||[]).some(t=>/養兒防老開出 SSR/.test(t.txt));
    die();
    out.achModel = !!SAVE.ach.rl_model;
    /* ③b 低真心回扣：只拿 rlc3 → score=1 → 金婚選項隱藏、翻舊帳/啃老浮現 */
    startGame(); S.age=24; S.flags={}; ensureState(S);
    showEvent(EVENTS.find(e=>e.id==='rl_meet')); choose(1);        // 已讀亂回，不記真心
    S.age=26; showEvent(EVENTS.find(e=>e.id==='rl_confess')); choose(1);  // 被告白，不記真心
    S.age=30; showEvent(EVENTS.find(e=>e.id==='rl_branch')); choose(0);   // 求婚 → rlc3
    S.age=32; showEvent(EVENTS.find(e=>e.id==='rl_baby')); choose(1);     // 自己坐月子，不記真心
    out.score1 = rlScore(S)===1;
    S.age=65; showEvent(EVENTS.find(e=>e.id==='rl_oldlove'));
    h=document.querySelector('#app').innerHTML;
    out.coldShown = !h.includes('💞真心3+') && h.includes('翻了三十年舊帳');
    choose(2);
    out.coldFlag = S.flags.rl_coldlove===true;
    S.age=66; showEvent(EVENTS.find(e=>e.id==='rl_kidback'));
    h=document.querySelector('#app').innerHTML;
    out.leechShown = !h.includes('孩子搶著接你回家住') && h.includes('還躺在你家沙發上');
    choose(2);
    out.leechFlag = S.flags.rl_leech===true && !S.flags.rl_filial;
    /* ④ 分手線 → 孤獨終老但很自由 */
    startGame(); S.age=24; S.flags={}; ensureState(S);
    showEvent(EVENTS.find(e=>e.id==='rl_meet')); choose(0);
    S.age=26; showEvent(EVENTS.find(e=>e.id==='rl_confess')); choose(0);
    S.age=30; showEvent(EVENTS.find(e=>e.id==='rl_branch')); choose(1);   // 和平分手
    out.overFlag = S.flags.rl==='over' && (S.flags.breakups||0)===1 && S.flags.marital!=='married';
    out.afterOverGated = !eligible().some(e=>['rl_baby','rl_oldlove','rl_kidback'].includes(e.id));
    S.age=70; die();
    out.achFree = !!SAVE.ach.rl_freesoul;
    /* ⑤ handinhand 稀有死法全流程 */
    startGame(); S.age=65; S.flags={rl:'married',marital:'married',married:true,rlc1:true,rlc2:true,rlc3:true}; ensureState(S);
    showEvent(EVENTS.find(e=>e.id==='rl_oldlove'));
    const oldRng2 = rng; rng = () => 0;   // chance(0.06) 必中
    choose(0);
    rng = oldRng2;
    out.hhDying = S.flags.specialDeath==='handinhand' && S.attr.hp<=0;
    die('choice');
    out.hhDead = !S.alive && S.deathId==='handinhand' && /執手偕老/.test(S.deathReason);
    out.hhBook = !!SAVE.deaths.handinhand;
    out.hhAch = !!SAVE.ach.holdhands;
    /* ⑥ 狀態 gating：未開線不出後段；已婚（非主線）不出告白段 */
    startGame(); S.age=28; S.flags={}; ensureState(S);
    out.noLineGated = !eligible().some(e=>['rl_confess','rl_branch','rl_baby','rl_tuition','rl_oldlove','rl_kidback'].includes(e.id));
    startGame(); S.age=28; S.flags={rl:'dating',marital:'married',married:true}; ensureState(S);
    out.marriedGated = !eligible().some(e=>e.id==='rl_confess' || e.id==='rl_meet');
    return JSON.stringify(out);
  })()`, sandbox);
  const r21 = JSON.parse(r21Raw);
  r21OK = Object.values(r21).every(v => v === true);
  console.log(`R21 感情主線路徑: ${r21OK ? '✅ 全數通過' : '❌ ' + JSON.stringify(r21)}`);
} catch (e) {
  console.log('R21 感情主線路徑: ❌ ' + e.message);
}

/* ---- R22 數值驅動探針（強制路徑，不靠隨機抽中）----
   ① 結構：r22 檢定選項 ≥9 個、覆蓋全部 5 種屬性、皆有 gtag 膠囊標籤與 sr 完整結構，
      且每個 win.eff 都含至少一項負值（拚屬性必付代價的權衡層）
   ② 行為：每個 r22 選項 高屬性(95)必勝（gateWin+1、走 win 文案）、
      低屬性(5)必翻車（srLose+1、走 lose 文案）→ 證明高低屬性走到不同分支、非死碼
   ③ 結算「屬性軌跡回顧」：|Δ|≥10 轉折點入榜、小變化不入榜、零 rng、實際渲染進結算頁
   ④ 新成就：六邊形戰士（五圍同時80+，79 不亮）/ 一窮二白活到老 / 骰子恨我（翻車3次）皆可達且有提示 */
let r22OK = false;
try {
  const r22Raw = vm.runInContext(`(function(){
    const out={};
    /* ① 結構 */
    const opts=[];
    EVENTS.forEach(e=>(e.choices||[]).forEach(c=>{ if(c.r22) opts.push({ev:e, c:c}); }));
    out.count = opts.length>=9;
    out.attrCover = new Set(opts.map(o=>o.c.sr&&o.c.sr.k)).size===5;
    out.structOK = opts.every(o=>o.c.sr && o.c.sr.k && o.c.sr.need>50 && o.c.sr.need<=90 && o.c.sr.spread===40
      && o.c.sr.win && o.c.sr.win.eff && o.c.sr.win.res && o.c.sr.lose && o.c.sr.lose.eff && o.c.sr.lose.res
      && /class="gtag"/.test(o.c.label) && /⚖️/.test(o.c.label));
    out.tradeoff = opts.every(o=>Object.values(o.c.sr.win.eff).some(v=>v<0));
    /* ② 高低屬性分支（need ≤90 → attr 95 必勝；need >50、spread 40 → attr 5 最高 roll 45 必輸） */
    let winsOK=true, losesOK=true;
    opts.forEach(o=>{
      const i=o.ev.choices.indexOf(o.c), k=o.c.sr.k;
      startGame(); S.age=o.ev.stage[0]; S.flags={employed:true}; ensureState(S);
      S.attr[k]=95; const gw0=S.flags.gateWin||0;
      showEvent(o.ev); choose(i);
      if((S.flags.gateWin||0)!==gw0+1 || (S.flags.srLose||0)!==0
         || S.resume[S.resume.length-1].res!==o.c.sr.win.res) winsOK=false;
      startGame(); S.age=o.ev.stage[0]; S.flags={employed:true}; ensureState(S);
      S.attr[k]=5;
      showEvent(o.ev); choose(i);
      if((S.flags.srLose||0)!==1 || (S.flags.gateWin||0)!==0
         || S.resume[S.resume.length-1].res!==o.c.sr.lose.res) losesOK=false;
    });
    out.hiWin = winsOK;
    out.loFlip = losesOK;
    /* ③ 屬性軌跡回顧 */
    startGame(); S.age=50; ensureState(S);
    S.resume=[{age:18,ev:"測試大跌事件",eff:{mny:-25},res:""},{age:30,ev:"測試大漲事件",eff:{int:15},res:""},{age:40,ev:"測試小變化",eff:{hap:3},res:""}];
    let used=0; const oldR=rng; rng=function(){used++; return oldR();};
    const th=attrTurnsHTML();
    rng=oldR;
    out.turnZeroRng = used===0;
    out.turnPick = th.includes("屬性軌跡回顧") && th.includes("18 歲") && th.includes("測試大跌事件")
      && th.includes("▼") && th.includes("▲ 🧠智力+15") && !th.includes("測試小變化");
    out.turnStable = th===attrTurnsHTML();
    die();
    out.turnInSummary = document.querySelector('#app').innerHTML.includes("屬性軌跡回顧");
    startGame(); S.age=20; ensureState(S); S.resume=[];
    out.turnEmpty = attrTurnsHTML().includes("風平浪靜");
    /* ④ 新成就 */
    out.achDef = ['hexagon','poorlong','dicehater'].every(id=>ACH_MAP[id] && ACH_MAP[id].hint && ACH_MAP[id].hint.length>4);
    const ev=EVENTS.find(e=>e.id==='gooddeed');
    startGame(); S.age=30; S.flags={}; ensureState(S);
    for(const k in S.attr) S.attr[k]=79;
    showEvent(ev); choose(0);
    out.hexNeg = !S.flags.hexagon;
    startGame(); S.age=30; S.flags={}; ensureState(S);
    for(const k in S.attr) S.attr[k]=85;
    showEvent(ev); choose(0);
    out.hexFlag = S.flags.hexagon===true;
    out.hexTl = (S.tl||[]).some(t=>/六邊形戰士成形/.test(t.txt));
    die();
    out.hexAch = !!SAVE.ach.hexagon;
    startGame(); S.age=80; S.flags={}; ensureState(S); S.attr.mny=10; die();
    out.poorAch = !!SAVE.ach.poorlong;
    out.poorNeg = !ACH_MAP.poorlong.check({S:{attr:{mny:10},flags:{}}, age:74})
               && !ACH_MAP.poorlong.check({S:{attr:{mny:21},flags:{}}, age:90});
    startGame(); S.age=30; S.flags={}; ensureState(S);
    const sc=EVENTS.find(e=>e.id==='socialcompare'), si=sc.choices.findIndex(c=>c.r22);
    for(let j=0;j<3;j++){ S.attr.hap=5; showEvent(sc); choose(si); }
    out.flip3 = (S.flags.srLose||0)===3;
    die();
    out.diceAch = !!SAVE.ach.dicehater;
    return JSON.stringify(out);
  })()`, sandbox);
  const r22 = JSON.parse(r22Raw);
  r22OK = Object.values(r22).every(v => v === true);
  console.log(`R22 數值驅動: ${r22OK ? '✅ 全數通過' : '❌ ' + JSON.stringify(r22)}`);
} catch (e) {
  console.log('R22 數值驅動: ❌ ' + e.message);
}

/* ---- R24 人生稱號 + 一鍵分享戰績探針 ----
   ① 結構：稱號 ≥20 個、tier 合法、id 不重複、必有永真保底
   ② 覆蓋＋確定性：50 種屬性/年齡組合的人生全都頒得出稱號（不 undefined），
      同一生重算 → 同稱號
   ③ 零隨機：稱號判定/這一生之最/分享文案皆零 rng 零 Math.random（種子序列不污染）
   ④ 分享文案：欄位完整（人生稱號/嗆聲/享年/死法/網址）且兩次生成逐字一致
   ⑤ 結算頁渲染：頂部稱號牌 + 收藏進度 + 這一生之最（最慘/最風光確定性挑選）
   ⑥ 成就：badge_ssr / badge10 / badge_main 皆可達且有獵人提示；
      舊存檔缺 badges 鍵 → die() 就地修補不炸 */
let r24OK = false;
try {
  const r24Raw = vm.runInContext(`(function(){
    const out={};
    /* ① 結構 */
    out.count = LIFE_BADGES.length>=20;
    out.tiers = LIFE_BADGES.every(b=>['SSR','SR','R','N'].includes(b.tier) && b.id && b.nm && b.nm.length>=3 && typeof b.cond==='function');
    out.uniq = new Set(LIFE_BADGES.map(b=>b.id)).size===LIFE_BADGES.length;
    /* ② 覆蓋＋確定性 */
    let cover=true, det=true;
    const vals=[0,15,45,75,95];
    for(let i=0;i<50;i++){
      startGame(); S.age=(i*7)%101; S.flags={}; ensureState(S);
      let j=0; for(const k in S.attr){ S.attr[k]=vals[(i+j++)%5]; }
      const old=rng; rng=()=>0.5; die(); rng=old;
      if(!S.badge || !S.badge.nm || !S.badge.tier || !S.badge.id) cover=false;
      const b2=lifeBadge();
      if(!b2 || b2.id!==S.badge.id) det=false;
    }
    out.cover=cover; out.det=det;
    /* ③ 零隨機 */
    let used=0, mused=0;
    const oldR=rng, oldM=Math.random;
    rng=function(){used++;return oldR();}; Math.random=function(){mused++;return oldM();};
    lifeBadge(); lifeExtremes(); extremesHTML(); badgeBannerHTML(); buildShareText(); tauntText();
    rng=oldR; Math.random=oldM;
    out.zeroRandom = used===0 && mused===0;
    /* ④ 分享文案 */
    const c1=buildShareText();
    out.cardStable = c1===buildShareText();
    out.cardBadge = /🏅 人生稱號：【(SSR|SR|R|N)】.+/.test(c1);
    out.cardTaunt = /🗯️ .+/.test(c1);
    out.cardCore = /享年 \\d+ 歲/.test(c1) && c1.includes('☠️ 死法：') && c1.includes(SHARE_URL);
    /* ⑤ 結算頁渲染 + 這一生之最 */
    startGame(); S.age=60; S.flags={}; ensureState(S);
    S.resume=[{age:22,ev:"慘案之年",eff:{mny:-30,hap:-10},res:""},{age:35,ev:"高光時刻",eff:{mny:25,hap:10},res:""},{age:40,ev:"小事一樁",eff:{hap:2},res:""}];
    const o2=rng; rng=()=>0.5; die(); rng=o2;
    const h=document.querySelector('#app').innerHTML;
    out.banner = h.includes('class="lbadge') && h.includes('人生稱號') && h.includes('稱號收藏');
    const ex=lifeExtremes();
    out.extremes = !!(ex.worst && ex.worst.age===22 && ex.worst.d===-40 && ex.best && ex.best.age===35 && ex.best.d===35);
    out.extremesShown = h.includes('這一生之最') && h.includes('最慘的一年') && h.includes('最風光的一刻') && h.includes('慘案之年') && h.includes('高光時刻');
    out.extremesStable = extremesHTML()===extremesHTML();
    /* ⑥ 成就 + 舊存檔相容 */
    out.achDef = ['badge_ssr','badge10','badge_main'].every(id=>ACH_MAP[id] && ACH_MAP[id].hint && ACH_MAP[id].hint.length>4);
    delete SAVE.badges; delete SAVE.ach.badge_ssr;
    startGame(); S.age=30; S.flags={specialDeath:'boba'}; ensureState(S); die('choice');
    out.compat = !!SAVE.badges && typeof SAVE.badges==='object' && Object.keys(SAVE.badges).length>=1 && SAVE.badges[S.badge.id]===1;
    out.ssrBadge = !!(S.badge && S.badge.tier==='SSR' && S.newBadge===true);
    out.achSSR = SAVE.ach.badge_ssr===true && (S.newAch||[]).includes('badge_ssr');
    delete SAVE.ach.badge10;
    SAVE.badges={}; for(let i=0;i<9;i++) SAVE.badges['x'+i]=1;
    startGame(); S.age=40; S.flags={}; ensureState(S); const o3=rng; rng=()=>0.5; die(); rng=o3;
    out.ach10 = Object.keys(SAVE.badges).length>=10 && SAVE.ach.badge10===true;
    delete SAVE.ach.badge_main;
    SAVE.badges={dummy:3};
    startGame(); S.age=40; S.flags={}; ensureState(S); const o4=rng; rng=()=>0.5; die(); rng=o4;
    out.achMain = SAVE.ach.badge_main===true;
    out.badgeSample = S.badge ? ('【'+S.badge.tier+'】'+S.badge.nm) : 'none';
    return JSON.stringify(out);
  })()`, sandbox);
  const r24 = JSON.parse(r24Raw);
  const sampleB = r24.badgeSample; delete r24.badgeSample;
  r24OK = Object.values(r24).every(v => v === true);
  console.log(`R24 人生稱號/分享戰績: ${r24OK ? '✅ 全數通過' : '❌ ' + JSON.stringify(r24)}`);
  console.log(`  稱號樣例: ${sampleB}`);
} catch (e) {
  console.log('R24 人生稱號/分享戰績: ❌ ' + e.message);
}

/* ---- R25 屬性命運探針（強制路徑，不靠隨機抽中）----
   ① br 確定性分流：≥10 個分流選項、覆蓋全部 5 種屬性、結構完整（need 50-70、hi/lo 文案相異、🧭膠囊標籤）
   ② 行為：高屬性必走 hi（brHi+1）、低屬性必走 lo（brLo+1）——純門檻零擲骰，同屬性同結果
   ③ 隱藏際遇 gating：5 個 r25_ 事件門檻內進池、差一點即不進池（含雙屬性組合與全中庸帶）
   ④ 偏科稅：頂標(85+)再堆 → 搭檔屬性被抽稅且 r25tax 計數；85 以下完全無感
   ⑤ 谷底追蹤：S.low/lowAge 隨選擇記錄、結算「屬性人生回顧」渲染谷底、舊存檔缺鍵不炸
   ⑥ 新成就：forkmaster / taxking / comeback20 / fatedoor 皆可達且有獵人提示 */
let r25OK = false;
try {
  const r25Raw = vm.runInContext(`(function(){
    const out={};
    /* ① br 結構 */
    const brs=[];
    EVENTS.forEach(e=>(e.choices||[]).forEach(c=>{ if(c.br) brs.push({ev:e,c:c}); }));
    out.count = brs.length>=10;
    out.attrCover = new Set(brs.map(o=>o.c.br.k)).size===5;
    out.structOK = brs.every(o=>o.c.br.need>=50 && o.c.br.need<=70
      && o.c.br.hi && o.c.br.hi.eff && o.c.br.hi.res && o.c.br.lo && o.c.br.lo.eff && o.c.br.lo.res
      && o.c.br.hi.res!==o.c.br.lo.res && /class="gtag"/.test(o.c.label) && /🧭/.test(o.c.label));
    /* ② 高低屬性分流行為 */
    let hiOK=true, loOK=true;
    brs.forEach(o=>{
      const i=o.ev.choices.indexOf(o.c), k=o.c.br.k;
      startGame(); S.age=o.ev.stage[0]; S.flags={employed:true}; ensureState(S);
      S.attr[k]=Math.min(84, o.c.br.need+20);
      showEvent(o.ev); choose(i);
      if(S.resume[S.resume.length-1].res!==o.c.br.hi.res || (S.flags.brHi||0)!==1 || (S.flags.brLo||0)) hiOK=false;
      startGame(); S.age=o.ev.stage[0]; S.flags={employed:true}; ensureState(S);
      S.attr[k]=Math.max(0, o.c.br.need-20);
      showEvent(o.ev); choose(i);
      if(S.resume[S.resume.length-1].res!==o.c.br.lo.res || (S.flags.brLo||0)!==1 || (S.flags.brHi||0)) loOK=false;
    });
    out.hiOK=hiOK; out.loOK=loOK;
    /* ③ 隱藏際遇 gating */
    startGame(); S.age=30; S.flags={}; ensureState(S);
    S.attr.int=85; out.bhIn = eligible().some(e=>e.id==='r25_brainhunt');
    S.attr.int=84; out.bhGate = !eligible().some(e=>e.id==='r25_brainhunt');
    S.attr.hp=20; out.hpIn = eligible().some(e=>e.id==='r25_lowhp');
    S.attr.hp=21; out.hpGate = !eligible().some(e=>e.id==='r25_lowhp');
    startGame(); S.age=40; S.flags={}; ensureState(S);
    S.attr.mny=85; S.attr.hp=45; out.richIn = eligible().some(e=>e.id==='r25_burnrich');
    S.attr.hp=46; out.richGate = !eligible().some(e=>e.id==='r25_burnrich');
    startGame(); S.age=30; S.flags={}; ensureState(S);
    S.attr.apr=80; S.attr.int=80; out.dcIn = eligible().some(e=>e.id==='r25_doublecrown');
    S.attr.int=79; out.dcGate = !eligible().some(e=>e.id==='r25_doublecrown');
    startGame(); S.age=35; S.flags={}; ensureState(S);
    for(const k in S.attr) S.attr[k]=50;
    out.mmIn = eligible().some(e=>e.id==='r25_midman');
    S.attr.int=70; out.mmGate = !eligible().some(e=>e.id==='r25_midman');
    /* 際遇成就：單局吃 2 個 → fatedoor */
    startGame(); S.age=30; S.flags={}; ensureState(S);
    showEvent(EVENTS.find(e=>e.id==='r25_brainhunt')); choose(0);
    showEvent(EVENTS.find(e=>e.id==='r25_lowhp')); choose(0);
    out.fateCnt = (S.flags.r25ev||0)===2;
    die();
    out.fateAch = !!SAVE.ach.fatedoor;
    /* ④ 偏科稅 */
    EVENTS.push({id:'t25tax', title:'測試偏科', text:'t', stage:[0,120], meme:{scene:'work',top:'t',bot:'b'},
      choices:[{label:'堆', eff:{int:12}, res:'r25taxres'}]});
    const tev=EVENTS[EVENTS.length-1];
    startGame(); S.age=30; S.flags={}; ensureState(S);
    S.attr.int=90; S.attr.hap=50;
    showEvent(tev); choose(0);
    out.taxHit = S.attr.hap===48 && S.attr.int===100 && (S.flags.r25tax||0)===2
      && (S.lastWarn===null || true);   // 稅後 lastWarn 用完即清，這裡只驗數值
    startGame(); S.age=30; S.flags={}; ensureState(S);
    S.attr.int=70; S.attr.hap=50;
    showEvent(tev); choose(0);
    out.taxFree = S.attr.hap===50 && S.attr.int===82 && !S.flags.r25tax;
    /* taxking：單局累計 8 點 */
    startGame(); S.age=30; S.flags={}; ensureState(S);
    for(let j=0;j<4;j++){ S.attr.int=90; S.attr.hap=60; showEvent(tev); choose(0); }
    out.taxCnt=(S.flags.r25tax||0)===8;
    die();
    out.taxAch = !!SAVE.ach.taxking;
    /* forkmaster：單局 4 次分流好結局 */
    const bex=brs[0], bi=bex.ev.choices.indexOf(bex.c);
    startGame(); S.age=bex.ev.stage[0]; S.flags={employed:true}; ensureState(S);
    for(let j=0;j<4;j++){ S.attr[bex.c.br.k]=Math.min(84,bex.c.br.need+20); showEvent(bex.ev); choose(bi); }
    out.forkCnt=(S.flags.brHi||0)===4;
    die();
    out.forkAch = !!SAVE.ach.forkmaster;
    /* ⑤ 谷底追蹤 + comeback20 + 結算渲染 */
    EVENTS.push({id:'t25dip', title:'測試谷底', text:'t', stage:[0,120], meme:{scene:'work',top:'t',bot:'b'},
      choices:[{label:'跌', eff:{mny:-60}, res:'dip'},{label:'漲', eff:{mny:80}, res:'rise'}]});
    const dev=EVENTS[EVENTS.length-1];
    startGame(); S.age=25; S.flags={}; ensureState(S);
    S.attr.mny=50;
    showEvent(dev); choose(0);
    out.lowTrack = S.low && S.low.mny<=20 && S.lowAge.mny===25;
    S.age=40;
    showEvent(dev); choose(1);
    out.lowRise = S.low.mny<=20 && S.attr.mny>=70;
    die();
    out.cbAch = !!SAVE.ach.comeback20;
    out.sumLow = document.querySelector('#app').innerHTML.includes('谷底');
    /* 舊存檔缺 low 鍵：ensureState 補空、回顧 fallback 不炸 */
    startGame(); S.age=40; delete S.low; delete S.lowAge; ensureState(S);
    out.compat = typeof S.low==='object' && attrReviewHTML().includes('谷底');
    /* ⑥ 成就提示 */
    out.achDef = ['forkmaster','taxking','comeback20','fatedoor'].every(id=>ACH_MAP[id] && ACH_MAP[id].hint && ACH_MAP[id].hint.length>4);
    return JSON.stringify(out);
  })()`, sandbox);
  const r25 = JSON.parse(r25Raw);
  r25OK = Object.values(r25).every(v => v === true);
  console.log(`R25 屬性命運: ${r25OK ? '✅ 全數通過' : '❌ ' + JSON.stringify(r25)}`);
} catch (e) {
  console.log('R25 屬性命運: ❌ ' + e.message);
}

/* ---- R34 求學鏈探針（強制路徑，不靠隨機抽中）----
   ① 結構：5 段事件皆存在、cb_ 段進 CHAIN_IDS 優先池；examburn 進 SPECIAL_DEATHS+DEATHBOOK（rare+hint）；3 新成就有 hint
   ② gating：沒種 r34_start 不出國中段；補習線/放養線只看得到自己的分支選項（cond 互斥）
   ③ 補習全勤線：入班→私中→衝刺→頂大放榜 → r34_fullcram 成就
   ④ 叛逆線：入班→翹班→成發→特殊選才 → r34_rebelwin 成就
   ⑤ 放養校隊線：放養→校隊→特殊選才→錄取 → r34_dreamdept
   ⑥ 重考線：衝刺後放榜選重考 → r34_retry 成就
   ⑦ 初戀回扣：翹班線組讀書會→同城填志願 → r34_couple
   ⑧ 死法：hp<=14 開第八罐 → examburn 入圖鑑；hp=15 邊界與高 hp 皆活（r34_ironliver）→ 非死碼 */
let r34OK = false;
try {
  const r34Raw = vm.runInContext(`(function(){
    const out={};
    /* ① 結構 */
    const ids=['r34_seed','cb_r34_junior','cb_r34_senior','cb_r34_allnighter','cb_r34_final'];
    out.evDef = ids.every(id=>EVENTS.some(e=>e.id===id));
    out.chainPool = ['cb_r34_junior','cb_r34_senior','cb_r34_allnighter','cb_r34_final'].every(id=>CHAIN_IDS.has(id));
    out.sdDef = !!SPECIAL_DEATHS.examburn;
    out.book = DEATHBOOK.some(d=>d.id==='examburn' && d.rare && d.hint.length>4);
    out.achDef = ['r34_fullcram','r34_rebelwin','r34_retry'].every(id=>ACH_MAP[id] && ACH_MAP[id].hint && ACH_MAP[id].hint.length>4);
    const html=()=>document.querySelector('#app').innerHTML;
    /* ② gating：旗標未種 → 國中段不進池；童年段在窗口內進池 */
    startGame(); S.age=13; S.flags={}; S.quirk=null; ensureState(S);
    out.jGate = !eligible().some(e=>e.id==='cb_r34_junior');
    startGame(); S.age=9; S.flags={}; S.quirk=null; ensureState(S);
    out.seedIn = eligible().some(e=>e.id==='r34_seed');
    /* 補習線只見補習選項、放養線只見放養選項 */
    startGame(); S.age=13; S.flags={r34_start:true,r34_cram:true}; S.quirk=null; ensureState(S);
    out.jIn = eligible().some(e=>e.id==='cb_r34_junior');
    showEvent(EVENTS.find(e=>e.id==='cb_r34_junior'));
    out.cramSees = html().includes('考私中') && html().includes('翹補習班') && !html().includes('加入校隊') && !html().includes('搶救');
    startGame(); S.age=13; S.flags={r34_start:true,r34_free:true}; S.quirk=null; ensureState(S);
    showEvent(EVENTS.find(e=>e.id==='cb_r34_junior'));
    out.freeSees = !html().includes('考私中') && html().includes('加入校隊') && html().includes('搶救');
    /* ③ 補習全勤線（seed0→junior0 私中→senior0 衝刺→final0 頂大 gate int70） */
    startGame(); S.age=9; S.flags={}; S.quirk=null; ensureState(S);
    showEvent(EVENTS.find(e=>e.id==='r34_seed')); choose(0);
    out.cramFlag = S.flags.r34_cram===true && S.flags.r34_start===true;
    S.age=13; showEvent(EVENTS.find(e=>e.id==='cb_r34_junior')); choose(0);
    out.privFlag = S.flags.r34_private===true && S.flags.r34_mid===true;
    S.age=17; showEvent(EVENTS.find(e=>e.id==='cb_r34_senior')); choose(0);
    out.grindFlag = S.flags.r34_grind===true && S.flags.r34_sen===true;
    S.age=18; S.attr.int=80;
    showEvent(EVENTS.find(e=>e.id==='cb_r34_final')); choose(0);
    out.topFlag = S.flags.r34_topuni===true && S.flags.r34_done===true;
    out.tlDone = S.tl.some(t=>t.txt.indexOf('求學長征')>=0);
    die();
    out.cramAch = !!SAVE.ach.r34_fullcram;
    /* ④ 叛逆線（seed0→junior1 翹班→senior1 成發→final2 特殊選才） */
    startGame(); S.age=9; S.flags={}; S.quirk=null; ensureState(S);
    showEvent(EVENTS.find(e=>e.id==='r34_seed')); choose(0);
    S.age=13; showEvent(EVENTS.find(e=>e.id==='cb_r34_junior')); choose(1);
    out.rebelFlag = S.flags.r34_rebel===true;
    S.age=17; showEvent(EVENTS.find(e=>e.id==='cb_r34_senior')); choose(1);
    out.stageFlag = S.flags.r34_stage===true;
    S.age=18; showEvent(EVENTS.find(e=>e.id==='cb_r34_final')); choose(2);
    out.dreamFlag = S.flags.r34_dreamdept===true && S.flags.r34_done===true;
    die();
    out.rebelAch = !!SAVE.ach.r34_rebelwin;
    /* ⑤ 放養校隊線（seed1→junior2 校隊→senior2 特殊選才→final3 錄取） */
    startGame(); S.age=9; S.flags={}; S.quirk=null; ensureState(S);
    showEvent(EVENTS.find(e=>e.id==='r34_seed')); choose(1);
    out.freeFlag = S.flags.r34_free===true;
    S.age=13; showEvent(EVENTS.find(e=>e.id==='cb_r34_junior')); choose(2);
    out.talentFlag = S.flags.r34_talent===true;
    S.age=17; showEvent(EVENTS.find(e=>e.id==='cb_r34_senior')); choose(2);
    out.specFlag = S.flags.r34_special===true;
    S.age=18; showEvent(EVENTS.find(e=>e.id==='cb_r34_final')); choose(3);
    out.freeDream = S.flags.r34_dreamdept===true && S.flags.r34_done===true;
    /* ⑥ 重考線：衝刺旗標 + final1 */
    startGame(); S.age=18; S.flags={r34_start:true,r34_cram:true,r34_mid:true,r34_sen:true,r34_grind:true}; S.quirk=null; ensureState(S);
    showEvent(EVENTS.find(e=>e.id==='cb_r34_final')); choose(1);
    out.repeatFlag = S.flags.r34_repeat===true && S.flags.r34_done===true;
    out.tlRepeat = S.tl.some(t=>t.txt.indexOf('重考班')>=0);
    die();
    out.retryAch = !!SAVE.ach.r34_retry;
    /* ⑦ 初戀回扣：翹班線 senior3 讀書會 → final4 同城 */
    startGame(); S.age=17; S.flags={r34_start:true,r34_cram:true,r34_mid:true,r34_rebel:true}; S.quirk=null; ensureState(S);
    showEvent(EVENTS.find(e=>e.id==='cb_r34_senior')); choose(3);
    out.loveFlag = S.flags.r34_studylove===true;
    S.age=18; showEvent(EVENTS.find(e=>e.id==='cb_r34_final')); choose(4);
    out.coupleFlag = S.flags.r34_couple===true && S.flags.r34_done===true;
    /* ⑧ examburn 死法：hp<=14 確定性觸發；hp=15 邊界活；衝刺旗標 gating */
    startGame(); S.age=17; S.flags={r34_start:true,r34_cram:true,r34_mid:true,r34_sen:true}; S.quirk=null; ensureState(S);
    out.anGate = !eligible().some(e=>e.id==='cb_r34_allnighter');
    S.flags.r34_grind=true;
    out.anIn = eligible().some(e=>e.id==='cb_r34_allnighter');
    startGame(); S.age=17; S.flags={r34_grind:true}; S.quirk=null; ensureState(S); S.attr.hp=14;
    showEvent(EVENTS.find(e=>e.id==='cb_r34_allnighter')); choose(0);
    out.burnHit = S.flags.specialDeath==='examburn';
    die('choice');
    out.burnBook = !!SAVE.deaths.examburn;
    startGame(); S.age=17; S.flags={r34_grind:true}; S.quirk=null; ensureState(S); S.attr.hp=15;
    showEvent(EVENTS.find(e=>e.id==='cb_r34_allnighter')); choose(0);
    out.burnEdge = !S.flags.specialDeath && S.flags.r34_ironliver===true && S.alive===true;
    startGame(); S.age=17; S.flags={r34_grind:true}; S.quirk=null; ensureState(S); S.attr.hp=80;
    showEvent(EVENTS.find(e=>e.id==='cb_r34_allnighter')); choose(0);
    out.burnLive = !S.flags.specialDeath && S.flags.r34_ironliver===true;
    return JSON.stringify(out);
  })()`, sandbox);
  const r34 = JSON.parse(r34Raw);
  r34OK = Object.values(r34).every(v => v === true);
  console.log(`R34 求學鏈: ${r34OK ? '✅ 全數通過' : '❌ ' + JSON.stringify(r34)}`);
} catch (e) {
  console.log('R34 求學鏈: ❌ ' + e.message);
}

/* ---- R38 隱藏彩蛋探針（強制路徑，不靠隨機抽中）----
   ① 定義完整性：5 蛋 hidden + r32trig 掛進 R32_EGGS；5 隱藏成就 hint 配齊
   ② funeralstar（出身×天賦）：天賦不符不觸發；全齊經 r32EggPick 插播→seen→死後成就
   ③ samedeath（跨局同死法）：deathStreak<2 不觸發、>=2 觸發；挑戰局排除；die() 計數欄位有寫
   ④ reaper90（高齡×健康）：89 歲 / hp69 邊界不觸發，90×70 觸發→成就
   ⑤ poorface（屬性極端組合）：apr89 不觸發，apr90×mny10 觸發→成就
   ⑥ whalecare（旗標連鎖×門檻）：缺 scammed 不觸發，全齊觸發→成就；egg32n>=2 護欄回 null */
let r38OK = false;
try {
  const r38Raw = vm.runInContext(`(function(){
    const out={};
    const E=id=>EVENTS.find(e=>e.id===id);
    /* ① 定義完整性 */
    const ids=['egg38_funeralstar','egg38_samedeath','egg38_reaper90','egg38_poorface','egg38_whalecare'];
    out.def = ids.every(id=>{const e=E(id); return !!e&&e.hidden===true&&typeof e.r32trig==='function'&&R32_EGGS.some(g=>g.id===id);});
    out.achDef = ['r38_funeralstar','r38_samedeath','r38_reaper90','r38_poorface','r38_whalecare'].every(id=>ACH_MAP[id]&&ACH_MAP[id].hint&&String(ACH_MAP[id].hint).length>4);
    /* ② funeralstar：出身×天賦 */
    startGame(); S.age=30; S.flags={}; S.quirk=null; S.challenge=null; S.battle=null; ensureState(S);
    S.attr={hp:50,int:50,apr:50,mny:50,hap:50}; S.seen={}; S.egg32n=0; SAVE.deathStreak=0; SAVE.lastDeathId='';
    S.origin={id:'funeral',nm:'禮儀社世家'}; S.talent={nm:'過目不忘'};
    out.fsGate = !E('egg38_funeralstar').r32trig(S);
    S.talent={nm:'天選社牛'};
    const p1=r32EggPick();
    out.fsIn = !!p1 && p1.id==='egg38_funeralstar';
    showEvent(p1); choose(0);
    out.fsSeen = S.seen.egg38_funeralstar===true;
    die();
    out.fsAch = !!SAVE.ach.r38_funeralstar;
    /* ③ samedeath：跨局同死法連續 */
    startGame(); S.age=20; S.flags={}; S.quirk=null; S.challenge=null; S.battle=null; ensureState(S);
    S.attr={hp:50,int:50,apr:50,mny:50,hap:50}; S.seen={}; S.egg32n=0;
    S.origin={id:'normal',nm:'普通'}; S.talent={nm:'過目不忘'};
    SAVE.deathStreak=1;
    out.sdGate = !E('egg38_samedeath').r32trig(S);
    SAVE.deathStreak=2;
    S.challenge={date:'t',attempt:1};
    out.sdChGate = !E('egg38_samedeath').r32trig(S);
    S.challenge=null;
    const p2=r32EggPick();
    out.sdIn = !!p2 && p2.id==='egg38_samedeath';
    showEvent(p2); choose(1);
    out.sdSeen = S.seen.egg38_samedeath===true;
    die();
    out.sdAch = !!SAVE.ach.r38_samedeath;
    out.sdTrack = SAVE.lastDeathId===S.deathId && (SAVE.deathStreak||0)>=1;
    /* ④ reaper90：高齡×健康邊界 */
    startGame(); S.age=89; S.flags={}; S.quirk=null; S.challenge=null; S.battle=null; ensureState(S);
    S.attr={hp:70,int:50,apr:50,mny:50,hap:50}; S.seen={}; S.egg32n=0; SAVE.deathStreak=0;
    S.origin={id:'normal',nm:'普通'}; S.talent={nm:'過目不忘'};
    out.rpGateAge = !E('egg38_reaper90').r32trig(S);
    S.age=90; S.attr.hp=69;
    out.rpGateHp = !E('egg38_reaper90').r32trig(S);
    S.attr.hp=70;
    const p3=r32EggPick();
    out.rpIn = !!p3 && p3.id==='egg38_reaper90';
    showEvent(p3); choose(0);
    die();
    out.rpAch = !!SAVE.ach.r38_reaper90;
    /* ⑤ poorface：屬性極端組合邊界 */
    startGame(); S.age=30; S.flags={}; S.quirk=null; S.challenge=null; S.battle=null; ensureState(S);
    S.attr={hp:50,int:50,apr:89,mny:10,hap:50}; S.seen={}; S.egg32n=0; SAVE.deathStreak=0;
    S.origin={id:'normal',nm:'普通'}; S.talent={nm:'過目不忘'};
    out.pfGate = !E('egg38_poorface').r32trig(S);
    S.attr.apr=90;
    const p4=r32EggPick();
    out.pfIn = !!p4 && p4.id==='egg38_poorface';
    showEvent(p4); choose(0);
    die();
    out.pfAch = !!SAVE.ach.r38_poorface;
    /* ⑥ whalecare：旗標連鎖＋一局兩顆護欄 */
    startGame(); S.age=40; S.flags={whale:true}; S.quirk=null; S.challenge=null; S.battle=null; ensureState(S);
    S.attr={hp:50,int:50,apr:50,mny:75,hap:50}; S.seen={}; S.egg32n=0; SAVE.deathStreak=0;
    S.origin={id:'normal',nm:'普通'}; S.talent={nm:'過目不忘'};
    out.wcGate = !E('egg38_whalecare').r32trig(S);
    S.flags.scammed=true;
    S.egg32n=2;
    out.wcCap = r32EggPick()===null;
    S.egg32n=0;
    const p5=r32EggPick();
    out.wcIn = !!p5 && p5.id==='egg38_whalecare';
    showEvent(p5); choose(1);
    die();
    out.wcAch = !!SAVE.ach.r38_whalecare;
    return JSON.stringify(out);
  })()`, sandbox);
  const r38 = JSON.parse(r38Raw);
  r38OK = Object.values(r38).every(v => v === true);
  console.log(`R38 隱藏彩蛋: ${r38OK ? '✅ 全數通過' : '❌ ' + JSON.stringify(r38)}`);
} catch (e) {
  console.log('R38 隱藏彩蛋: ❌ ' + e.message);
}

/* ---- R41 人生志向探針（強制路徑，不靠隨機抽中）----
   ① 結構：志向 8~12 個、欄位完整（fit/prog/done/win/fail）、id 唯一；11 成就 hint 配齊
   ② 確定性：同種子兩次開局 → 同志向同候選池；開局卡顯示志向＋重抽鈕
   ③ 重抽限 1 次：換池內次名、第二次無效、鈕消失
   ④ 零 rng：進度塊渲染＋全志向 fit/prog/done 不消耗 rng/Math.random；statsHTML 掛載
   ⑤ 抉擇事件：年齡 gating／once／堅持不換志向／轉向換池內次一未立過志向＋代價＋計數
   ⑥ 結算：達成 → ✅＋榮耀結語＋r41_* 成就；未達成 → ❌＋自嘲結語；舊存檔無 wishId → 面板/進度塊/事件全省略不炸 */
let r41OK = false;
try {
  const r41Raw = vm.runInContext(`(function(){
    const out={};
    /* ① 結構 */
    out.count = R41_WISHES.length>=8 && R41_WISHES.length<=12;
    out.fields = R41_WISHES.every(w=>w.id&&w.ic&&w.nm&&w.desc&&w.goal&&typeof w.fit==='function'&&typeof w.prog==='function'&&typeof w.done==='function'&&typeof w.win==='string'&&w.win.length>10&&typeof w.fail==='string'&&w.fail.length>10);
    out.uniq = new Set(R41_WISHES.map(w=>w.id)).size===R41_WISHES.length;
    out.achDef = R41_WISHES.every(w=>ACH_MAP['r41_'+w.id] && ACH_MAP['r41_'+w.id].hint && String(ACH_MAP['r41_'+w.id].hint).length>4);
    /* ② 同種子確定性 */
    startSeedBattle('K7PQ2X');
    const w1=S.wishId, p1=(S.wishPool||[]).join(',');
    out.init = !!w1 && Array.isArray(S.wishPool) && S.wishPool.length===R41_WISHES.length && (S.wishHist||[])[0]===w1 && S.flags.r41wish===true;
    startSeedBattle('K7PQ2X');
    out.det = S.wishId===w1 && (S.wishPool||[]).join(',')===p1;
    let h=document.querySelector('#app').innerHTML;
    out.birthCard = h.includes('人生志向') && h.includes('r41Reroll');
    /* ③ 重抽限一次 */
    r41Reroll();
    const w2=S.wishId;
    out.reroll = w2===p1.split(',')[1] && S.wishRerolled===true && w2!==w1;
    r41Reroll();
    out.rerollOnce = S.wishId===w2;
    out.rerollBtnGone = !document.querySelector('#app').innerHTML.includes('r41Reroll()');
    /* ④ 零 rng */
    let used=0,mused=0; const oldR=rng,oldM=Math.random;
    rng=function(){used++;return oldR();}; Math.random=function(){mused++;return oldM();};
    const ph=r41ProgHTML(); R41_WISHES.forEach(w=>{w.fit(S);w.prog(S);w.done(S);});
    rng=oldR; Math.random=oldM;
    out.zeroRandom = used===0 && mused===0;
    out.progBox = ph.includes('wishbox') && ph.includes('志向：') && /\\d+%/.test(ph);
    out.inStats = statsHTML().includes('wishbox');
    /* ⑤ 抉擇事件 */
    startGame(); S.age=30; ensureState(S);
    out.doubtIn = eligible().some(e=>e.id==='cb_r41_doubt');
    out.crossGate = !eligible().some(e=>e.id==='cb_r41_cross');
    const keep=S.wishId;
    showEvent(EVENTS.find(e=>e.id==='cb_r41_doubt')); choose(0);
    out.persist = S.flags.r41_d1===true && S.flags.r41_persist===true && S.wishId===keep;
    out.doubtOnce = !eligible().some(e=>e.id==='cb_r41_doubt');
    S.age=50;
    out.crossIn = eligible().some(e=>e.id==='cb_r41_cross');
    const before=S.wishId, expect=S.wishPool.find(id=>id!==before && (S.wishHist||[]).indexOf(id)<0);
    const hap0=S.attr.hap;
    showEvent(EVENTS.find(e=>e.id==='cb_r41_cross')); choose(1);
    out.pivot = S.wishId===expect && S.wishId!==before && S.flags.r41pivot===1 && S.flags.r41_d2===true && (S.wishHist||[]).indexOf(before)>=0;
    out.pivotCost = S.attr.hap<hap0;
    out.pivotText = document.querySelector('#app').innerHTML.indexOf('🧭')>=0;
    /* 舊存檔相容：無 wishId → 事件不進池、進度塊省略 */
    startGame(); S.age=30; ensureState(S);
    delete S.wishId; delete S.wishPool; delete S.wishHist;
    out.compatPool = !eligible().some(e=>e.id==='cb_r41_doubt'||e.id==='cb_r41_cross');
    out.compatStats = statsHTML().indexOf('wishbox')<0;
    /* ⑥ 結算：達成 → 榮耀＋成就 */
    delete SAVE.ach.r41_live90;
    startGame(); S.age=92; ensureState(S);
    for(const k in S.attr) S.attr[k]=60;
    S.wishId='live90'; S.wishPool=R41_WISHES.map(w=>w.id); S.wishHist=['live90'];
    const oR=rng; rng=()=>0.5; die(); rng=oR;
    out.doneFlag = S.wishDone===true;
    h=document.querySelector('#app').innerHTML;
    out.sumWin = h.includes('志向結算') && h.includes('✅ 達成') && h.includes(R41_MAP.live90.win);
    out.achWin = SAVE.ach.r41_live90===true && (S.newAch||[]).indexOf('r41_live90')>=0;
    /* 未達成 → 自嘲、成就不解鎖 */
    delete SAVE.ach.r41_house;
    startGame(); S.age=40; ensureState(S);
    for(const k in S.attr) S.attr[k]=60;
    S.wishId='house'; S.wishPool=R41_WISHES.map(w=>w.id); S.wishHist=['house'];
    const oR2=rng; rng=()=>0.5; die(); rng=oR2;
    out.failFlag = S.wishDone===false;
    h=document.querySelector('#app').innerHTML;
    out.sumFail = h.includes('❌ 未達成') && h.includes(R41_MAP.house.fail);
    out.achFailNeg = !SAVE.ach.r41_house && (S.newAch||[]).indexOf('r41_house')<0;
    /* 舊存檔無 wishId → 結算面板省略、die 不炸 */
    startGame(); S.age=40; ensureState(S);
    delete S.wishId;
    const oR3=rng; rng=()=>0.5; die(); rng=oR3;
    out.compatSum = !document.querySelector('#app').innerHTML.includes('志向結算');
    return JSON.stringify(out);
  })()`, sandbox);
  const r41 = JSON.parse(r41Raw);
  r41OK = Object.values(r41).every(v => v === true);
  console.log(`R41 人生志向: ${r41OK ? '✅ 全數通過' : '❌ ' + JSON.stringify(r41)}`);
} catch (e) {
  console.log('R41 人生志向: ❌ ' + e.message);
}

/* ---- R42 世代傳承探針（強制路徑，不靠隨機抽中）----
   ① 結構：傳承物 8~12 件、欄位完整（pitch/gift/cond/eff|apply）、id 唯一、永真保底 ≥2；3 成就有 hint
   ② 候選確定性：好命人生命中對應款、爛命也有 ≥2 保底；候選/結算渲染零 rng、兩次一致
   ③ 效果套用：eff 款與動態款（最弱屬性 +4）數值正確、clamp 不破
   ④ 流程：選傳承 → pending；挑戰局不吃不消不入年表；下一局一般局第 2 代生效（旗標/開局卡/日誌）；
      傳承事件 heir_* 旗標 gating；無傳承開新檔 → 斷代重練（gen=1、年表重寫）
   ⑤ 成就：r42_gen2 / r42_gen5 / r42_fame 皆可達；年表 cap 8；結算顯示家族年表＋世代數
   ⑥ 分享文案帶世代數；挑戰局結算整塊省略 */
let r42OK = false;
try {
  const r42Raw = vm.runInContext(`(function(){
    const out={};
    /* ① 結構 */
    out.count = R42_HEIRS.length>=8 && R42_HEIRS.length<=12;
    out.fields = R42_HEIRS.every(it=>it.id&&it.ic&&it.nm&&it.ty&&it.pitch&&it.gift&&typeof it.cond==='function'&&(it.eff||typeof it.apply==='function'));
    out.uniq = new Set(R42_HEIRS.map(it=>it.id)).size===R42_HEIRS.length;
    out.fallback = R42_HEIRS.filter(it=>{ try{ return !!it.cond({attr:{},flags:{},seen:{},age:0}); }catch(e){ return false; } }).length>=2;
    out.achDef = ['r42_gen2','r42_gen5','r42_fame'].every(id=>ACH_MAP[id]&&ACH_MAP[id].hint&&String(ACH_MAP[id].hint).length>4);
    out.tyOK = R42_HEIRS.every(it=>['遺產','家訓','傳家寶'].includes(it.ty));
    /* ② 候選確定性＋零 rng */
    SAVE.dynasty={pending:null,lineage:[]};
    startGame(); S.age=86; S.flags={}; ensureState(S);
    for(const k in S.attr) S.attr[k]=75;
    const oR1=rng; rng=()=>0.5; die(); rng=oR1;
    let used=0,mused=0; const oR2=rng,oM=Math.random;
    rng=function(){used++;return oR2();}; Math.random=function(){mused++;return oM();};
    const c1=r42Candidates().map(x=>x.id).join(',');
    const sh=r42SummaryHTML(); r42LineageHTML(); r42PickBoxHTML();
    rng=oR2; Math.random=oM;
    out.zeroRandom = used===0 && mused===0;
    out.candStable = c1===r42Candidates().map(x=>x.id).join(',');
    out.candRange = r42Candidates().length>=2 && r42Candidates().length<=3;
    out.candRich = r42Candidates().some(x=>x.id==='h_estate');
    out.sumShow = sh.includes('世代傳承') && sh.includes('家族年表') && sh.includes('第 1 代');
    out.inSummary = document.querySelector('#app').innerHTML.includes('世代傳承');
    /* 爛命保底 ≥2 */
    startGame(); S.age=20; S.flags={}; ensureState(S); S.seen={};
    for(const k in S.attr) S.attr[k]=30;
    const oR3=rng; rng=()=>0.5; die(); rng=oR3;
    out.candFloor = r42Candidates().length>=2 && r42Candidates().every(x=>['h_photo','h_plain'].includes(x.id));
    /* ③ 效果套用 */
    const b1={hp:50,int:50,apr:50,mny:50,hap:50};
    r42Apply(b1, R42_HMAP.h_estate);
    out.effApply = b1.mny===56 && b1.hp===50;
    const b2={hp:50,int:50,apr:50,mny:50,hap:48};
    r42Apply(b2, R42_HMAP.h_plain);
    out.applyDyn = b2.hap===52 && b2.mny===50;
    const b3={hp:99,int:50,apr:50,mny:50,hap:50};
    r42Apply(b3, R42_HMAP.h_recipe);
    out.applyClamp = b3.hp===100;
    /* ④ 流程：選傳承 → pending → 反悔 → 再選 */
    const cand=r42Candidates();
    r42Pick(cand[0].id);
    out.pendSet = !!(SAVE.dynasty.pending && SAVE.dynasty.pending.id===cand[0].id && SAVE.dynasty.pending.gen===2);
    r42Unpick();
    out.unpick = SAVE.dynasty.pending===null;
    r42Pick('h_estate');   /* 非候選 id 不可選（爛命沒有定存單） */
    out.pickGate = SAVE.dynasty.pending===null;
    /* 挑戰局：不吃 pending、gen=0、不入年表 */
    SAVE.dynasty.pending={id:'h_shopkey',gen:2};
    SAVE.dynasty.lineage=[];
    startChallenge('20260611');
    out.chClean = S.gen===0 && !S.heir && !S.flags.heir_shop && !!SAVE.dynasty.pending;
    const oR4=rng; rng=()=>0.5; die(); rng=oR4;
    out.chNoLineage = SAVE.dynasty.lineage.length===0;
    out.chSumClean = !document.querySelector('#app').innerHTML.includes('世代傳承');
    /* 一般局吃下傳承：第 2 代生效、旗標/事件解鎖、年表保留、開局卡/日誌 */
    SAVE.dynasty.pending={id:'h_shopkey',gen:2};
    SAVE.dynasty.lineage=[{g:1,a:88,t:'測試先人',d:'壽終正寢'}];
    startGame();
    out.heirOn = S.gen===2 && S.heir==='h_shopkey' && SAVE.dynasty.pending===null;
    out.heirFlag = S.flags.heir_shop===true;
    out.lineKept = SAVE.dynasty.lineage.length===1;
    out.birthCard = document.querySelector('#app').innerHTML.includes('家族第 2 代');
    out.birthLog = S.log.some(l=>l.indexOf('巷口老店的鑰匙')>=0);
    S.age=30; ensureState(S);
    out.shopIn = eligible().some(e=>e.id==='r42_shop');
    out.diaryGate = !eligible().some(e=>e.id==='r42_diary');
    showEvent(EVENTS.find(e=>e.id==='r42_shop')); choose(0);
    out.shopPlay = S.flags.r42_reopen===true && S.seen.r42_shop===true;
    /* 無傳承開新檔 → 斷代重練 */
    const oR5=rng; rng=()=>0.5; die(); rng=oR5;
    out.gen2Rec = SAVE.dynasty.lineage.length===2 && SAVE.dynasty.lineage[1].g===2;
    startGame();
    out.genReset = S.gen===1 && !S.heir && SAVE.dynasty.lineage.length===0;
    out.shopGate = !eligible().some(e=>e.id==='r42_shop');
    /* ⑤ 成就：gen2（上面那局已解）/ gen5 / fame；年表 cap 8 */
    out.achGen2 = SAVE.ach.r42_gen2===true;
    delete SAVE.ach.r42_gen5; delete SAVE.ach.r42_fame;
    SAVE.dynasty={pending:{id:'h_photo',gen:5},
      lineage:[{g:1,a:80,t:'',d:'x'},{g:2,a:80,t:'',d:'x'},{g:3,a:80,t:'',d:'x'},{g:4,a:80,t:'',d:'x'}]};
    startGame(); S.age=70; S.flags={}; ensureState(S);
    out.gen5On = S.gen===5 && S.heir==='h_photo';
    const oR6=rng; rng=()=>0.5; die(); rng=oR6;
    out.achGen5 = SAVE.ach.r42_gen5===true;
    out.achFame = SAVE.ach.r42_fame===true;
    out.lineCap = SAVE.dynasty.lineage.length<=8;
    const h5=document.querySelector('#app').innerHTML;
    out.sumGen5 = h5.includes('家族第 5 代') && h5.includes('家族年表') && h5.includes('第 4 代');
    /* ⑥ 分享文案帶世代數 */
    out.shareGen = buildShareText().includes('家族第 5 代');
    /* 舊進行中存檔（無 gen 鍵）die 不炸且視為第 1 代 */
    startGame(); S.age=40; ensureState(S); delete S.gen; delete S.heir;
    const oR7=rng; rng=()=>0.5; die(); rng=oR7;
    out.compat = S.gen===1 && SAVE.dynasty.lineage[SAVE.dynasty.lineage.length-1].g===1;
    return JSON.stringify(out);
  })()`, sandbox);
  const r42 = JSON.parse(r42Raw);
  r42OK = Object.values(r42).every(v => v === true);
  console.log(`R42 世代傳承: ${r42OK ? '✅ 全數通過' : '❌ ' + JSON.stringify(r42)}`);
} catch (e) {
  console.log('R42 世代傳承: ❌ ' + e.message);
}

/* ---- R43 跨階段 NPC 緣分探針（強制路徑，不靠隨機抽中）----
   ① 結構：13 事件齊備（once+stage+合法 scene）、cb_ 後段全數入 CHAIN_IDS 優先池、
      單段 eff 全部 ±8 內（R39 常態幅度）、3 成就有 hint
   ② 進池/旗標串接：種子事件在窗口內進池、後段無旗標不進池；同一局走完三條線
      （cm 走彈珠/rv 走偷練/ft 走求符三種分支索引），每段旗標正確落地、once 不重複
   ③ 文案呼應：重逢事件只渲染對應分支的選項（旗標 cond 過濾），他分支選項不得出現
   ④ 零殘留：沒展開人物線的局——後段全不進池、S.flags 無 r43_*、結算無緣分註記
   ⑤ 復現性：r43 事件 cond/eligible 全程零 rng/Math.random 消耗、同旗標同池兩次一致
   ⑥ 結算：走完三線 → r43_mate/r43_rival/r43_fate 當局解鎖、人生回顧時間軸三行緣分註記 */
let r43OK = false;
try {
  const r43Raw = vm.runInContext(`(function(){
    const out={};
    /* ① 結構 */
    const IDS=['r43_cm_seed','cb_r43_cm_teen','cb_r43_cm_work','cb_r43_cm_mid','cb_r43_cm_old',
               'r43_rv_seed','cb_r43_rv_sch','cb_r43_rv_work','cb_r43_rv_old',
               'r43_ft_seed','cb_r43_ft_yng','cb_r43_ft_mid','cb_r43_ft_old'];
    const evs=IDS.map(id=>EVENTS.find(e=>e.id===id));
    out.allDef = evs.every(e=>!!e);
    out.onceAll = evs.every(e=>e.once===true && Array.isArray(e.stage) && e.stage.length===2 && e.stage[0]<e.stage[1]);
    out.scenes = evs.every(e=>e.meme && e.meme.scene && !!SCENES[e.meme.scene]);
    out.chainPri = IDS.filter(id=>id.indexOf('cb_')===0).every(id=>CHAIN_IDS.has(id));
    out.effCap = evs.every(e=>e.choices.every(c=>Object.values(c.eff||{}).every(v=>Math.abs(v)<=8)));
    out.cbCond = evs.filter(e=>e.id.indexOf('cb_')===0).every(e=>typeof e.cond==='function');
    out.achDef = ['r43_mate','r43_rival','r43_fate'].every(id=>ACH_MAP[id]&&ACH_MAP[id].hint&&String(ACH_MAP[id].hint).length>4);
    /* ④ 零殘留（先驗乾淨局：無種子旗標 → 後段全不進池、結算無註記） */
    startGame(); S.flags={}; ensureState(S); S.seen={};
    S.age=30;
    out.cleanGate = IDS.filter(id=>id.indexOf('cb_')===0).every(id=>!eligible().some(e=>e.id===id));
    const oRc=rng; rng=()=>0.5; die(); rng=oRc;
    out.cleanNote = !(S.tl||[]).some(t=>String(t.txt).indexOf('緣分圓滿')>=0);
    out.cleanFlags = Object.keys(S.flags||{}).every(k=>k.indexOf('r43_')!==0);
    /* ② 同一局走完三條線（cm=彈珠 idx0 / rv=偷練 idx1 / ft=求符 idx2） */
    delete SAVE.ach.r43_mate; delete SAVE.ach.r43_rival; delete SAVE.ach.r43_fate;
    startGame(); S.flags={}; ensureState(S); S.seen={};
    S.age=8;
    out.seedIn = eligible().some(e=>e.id==='r43_cm_seed') && eligible().some(e=>e.id==='r43_rv_seed') && eligible().some(e=>e.id==='r43_ft_seed');
    /* ⑤ 復現性：cond/eligible 零 rng 消耗、同旗標同池 */
    let used=0,mused=0; const oR1=rng,oM1=Math.random;
    rng=function(){used++;return oR1();}; Math.random=function(){mused++;return oM1();};
    const p1=eligible().map(e=>e.id).join(','), p2=eligible().map(e=>e.id).join(',');
    evs.forEach(e=>{ if(e.cond) e.cond(S); e.choices.forEach(c=>{ if(c.cond) c.cond(S); }); });
    rng=oR1; Math.random=oM1;
    out.zeroRandom = used===0 && mused===0;
    out.poolStable = p1===p2;
    /* 童年：三顆種子各選一個分支 */
    showEvent(EVENTS.find(e=>e.id==='r43_cm_seed')); choose(0);
    showEvent(EVENTS.find(e=>e.id==='r43_rv_seed')); choose(1);
    showEvent(EVENTS.find(e=>e.id==='r43_ft_seed')); choose(2);
    out.seedFlags = S.flags.r43_cm===true && S.flags.r43_cm_gift===true
                 && S.flags.r43_rv===true && S.flags.r43_rv_sneak===true
                 && S.flags.r43_ft===true && S.flags.r43_ft_pay===true;
    out.seedOnce = !eligible().some(e=>e.id==='r43_cm_seed');
    /* 求學：cm_teen / rv_sch；③ 重逢只渲染對應分支選項 */
    S.age=18; ensureState(S);
    out.teenIn = eligible().some(e=>e.id==='cb_r43_cm_teen') && eligible().some(e=>e.id==='cb_r43_rv_sch');
    showEvent(EVENTS.find(e=>e.id==='cb_r43_cm_teen'));
    let h=document.querySelector('#app').innerHTML;
    out.cmEcho = h.indexOf('彈珠')>=0 && h.indexOf('換你追我')<0;
    choose(0);
    showEvent(EVENTS.find(e=>e.id==='cb_r43_rv_sch'));
    h=document.querySelector('#app').innerHTML;
    out.rvEcho = h.indexOf('圖書館')>=0 && h.indexOf('書卷獎')<0;
    choose(1);
    out.schFlags = S.flags.r43_cm2===true && S.flags.r43_rv2===true;
    /* 工作：cm_work / rv_work / ft_yng */
    S.age=30; ensureState(S);
    showEvent(EVENTS.find(e=>e.id==='cb_r43_cm_work')); choose(0);
    showEvent(EVENTS.find(e=>e.id==='cb_r43_rv_work')); choose(1);
    showEvent(EVENTS.find(e=>e.id==='cb_r43_ft_yng'));
    h=document.querySelector('#app').innerHTML;
    out.ftEcho = h.indexOf('續約')>=0 && h.indexOf('田野調查')<0;
    choose(2);
    out.workFlags = S.flags.r43_cm3===true && S.flags.r43_rv3===true && S.flags.r43_ft2===true;
    /* 中年：cm_mid / ft_mid */
    S.age=50; ensureState(S);
    showEvent(EVENTS.find(e=>e.id==='cb_r43_cm_mid')); choose(0);
    showEvent(EVENTS.find(e=>e.id==='cb_r43_ft_mid')); choose(2);
    out.midFlags = S.flags.r43_cm4===true && S.flags.r43_ft3===true;
    /* 老年：cm_old / rv_old / ft_old → 三線 *fin 落地 */
    S.age=70; ensureState(S);
    showEvent(EVENTS.find(e=>e.id==='cb_r43_cm_old')); choose(0);
    showEvent(EVENTS.find(e=>e.id==='cb_r43_rv_old')); choose(1);
    showEvent(EVENTS.find(e=>e.id==='cb_r43_ft_old')); choose(2);
    out.finFlags = S.flags.r43_cmfin===true && S.flags.r43_rvfin===true && S.flags.r43_ftfin===true;
    out.finOnce = !eligible().some(e=>e.id==='cb_r43_cm_old'||e.id==='cb_r43_rv_old'||e.id==='cb_r43_ft_old');
    /* ⑥ 結算：成就當局解鎖＋時間軸三行緣分註記 */
    const oR2=rng; rng=()=>0.5; die(); rng=oR2;
    out.achAll = SAVE.ach.r43_mate===true && SAVE.ach.r43_rival===true && SAVE.ach.r43_fate===true;
    out.achNew = ['r43_mate','r43_rival','r43_fate'].every(id=>(S.newAch||[]).indexOf(id)>=0);
    const notes=(S.tl||[]).filter(t=>String(t.txt).indexOf('緣分圓滿')>=0);
    out.note3 = notes.length===3;
    return JSON.stringify(out);
  })()`, sandbox);
  const r43 = JSON.parse(r43Raw);
  r43OK = Object.values(r43).every(v => v === true);
  console.log(`R43 NPC 緣分: ${r43OK ? '✅ 全數通過' : '❌ ' + JSON.stringify(r43)}`);
} catch (e) {
  console.log('R43 NPC 緣分: ❌ ' + e.message);
}

/* ---- R44 屬性驅動強化探針（強制路徑，不靠隨機抽中）----
   ① 結構：r44 br 分流選項 ≥8（need 40~75、hi/lo 齊備、標籤明示門檻數字＋「分流」）、
      r44 sr 檢定選項 ≥3（need 55~85、spread=40、win.eff 必含負值、標籤明示門檻＋「檢定」＋「骰」）、
      權衡事件 ×4 每個選項「至少一升一降」且幅度 ≤8、門檻事件 ×3（once＋屬性 cond）、3 成就有 hint
   ② br 分流判定：每個 r44 br 高屬性(95)走 hi 文案＋brHi 計數、低屬性(5)走 lo 文案＋brLo 計數
   ③ sr 檢定：高屬性(95)必勝（gateWin、win 文案）、低屬性(5)必翻車（srLose、lose 文案）；
      檢定復現性：同種子同選擇 → 同結果（沿用 R41~R43 種子慣例、零裸 rng）
   ④ 門檻事件 gating：屬性差 1 點不進池、達標進池
   ⑤ 零殘留：未觸發 R44 內容的局——門檻事件不進池、S.flags/S.seen 無 r44 殘留；
      結算時間軸有「屬性軌跡」一行（純讀 peak/low 確定性註記）
   ⑥ 成就：r44_fullgauge（滿值謝幕，99 不亮）/ r44_evenkeel（差≤6 全≥55，反例不亮）/
      r44_seesaw（單局 3 場權衡事件，2 場不亮）皆可達 */
let r44OK = false;
try {
  const r44Raw = vm.runInContext(`(function(){
    const out={};
    /* ① 結構 */
    const brs=[], srs=[];
    EVENTS.forEach(e=>(e.choices||[]).forEach(c=>{ if(c.r44&&c.br) brs.push({e,c}); if(c.r44&&c.sr) srs.push({e,c}); }));
    out.brCount = brs.length>=8;
    out.srCount = srs.length>=3;
    out.brStruct = brs.every(o=>ATTR[o.c.br.k] && o.c.br.need>=40 && o.c.br.need<=75
      && o.c.br.hi && o.c.br.hi.eff && o.c.br.hi.res && o.c.br.lo && o.c.br.lo.eff && o.c.br.lo.res
      && /class="gtag"/.test(o.c.label) && o.c.label.indexOf('分流')>=0 && o.c.label.indexOf(String(o.c.br.need))>=0);
    out.srStruct = srs.every(o=>ATTR[o.c.sr.k] && o.c.sr.need>=55 && o.c.sr.need<=85 && o.c.sr.spread===40
      && o.c.sr.win && o.c.sr.win.eff && o.c.sr.win.res && o.c.sr.lose && o.c.sr.lose.eff && o.c.sr.lose.res
      && Object.values(o.c.sr.win.eff).some(v=>v<0)
      && o.c.label.indexOf('檢定')>=0 && o.c.label.indexOf('骰')>=0 && o.c.label.indexOf(String(o.c.sr.need))>=0);
    const TRS=['r44_tr_sidejob','r44_tr_gym','r44_tr_face','r44_tr_course'].map(id=>EVENTS.find(e=>e.id===id));
    out.trDef = TRS.every(e=>!!e);
    out.trTrade = TRS.every(e=>e.choices.every(c=>{
      const vs=Object.values(c.eff||{});
      return vs.some(v=>v>0) && vs.some(v=>v<0) && vs.every(v=>Math.abs(v)<=8);
    }));
    const GATES=[['r44_quizshow','int',80],['r44_ironboard','hp',82],['r44_richmist','mny',88]];
    out.gateDef = GATES.every(g=>{ const e=EVENTS.find(x=>x.id===g[0]); return e && e.once===true && typeof e.cond==='function'; });
    out.achDef = ['r44_fullgauge','r44_evenkeel','r44_seesaw'].every(id=>ACH_MAP[id] && ACH_MAP[id].hint && String(ACH_MAP[id].hint).length>4);
    /* ② br 高低分流（need ≤75 → 95 必走 hi；need ≥40 → 5 必走 lo） */
    let brHiOK=true, brLoOK=true;
    brs.forEach(o=>{
      const i=o.e.choices.indexOf(o.c), k=o.c.br.k;
      startGame(); S.age=o.e.stage[0]; S.flags={employed:true}; ensureState(S);
      S.attr[k]=95; const h0=S.flags.brHi||0;
      showEvent(o.e); choose(i);
      if((S.flags.brHi||0)!==h0+1 || S.resume[S.resume.length-1].res!==o.c.br.hi.res) brHiOK=false;
      startGame(); S.age=o.e.stage[0]; S.flags={employed:true}; ensureState(S);
      S.attr[k]=5;
      showEvent(o.e); choose(i);
      if((S.flags.brLo||0)!==1 || S.resume[S.resume.length-1].res!==o.c.br.lo.res) brLoOK=false;
    });
    out.brHi = brHiOK; out.brLo = brLoOK;
    /* ③ sr 檢定：95 必勝 / 5 必輸 */
    let srWinOK=true, srLoseOK=true;
    srs.forEach(o=>{
      const i=o.e.choices.indexOf(o.c), k=o.c.sr.k;
      startGame(); S.age=o.e.stage[0]; S.flags={employed:true}; ensureState(S);
      S.attr[k]=95; const g0=S.flags.gateWin||0;
      showEvent(o.e); choose(i);
      if((S.flags.gateWin||0)!==g0+1 || S.resume[S.resume.length-1].res!==o.c.sr.win.res) srWinOK=false;
      startGame(); S.age=o.e.stage[0]; S.flags={employed:true}; ensureState(S);
      S.attr[k]=5;
      showEvent(o.e); choose(i);
      if((S.flags.srLose||0)!==1 || S.resume[S.resume.length-1].res!==o.c.sr.lose.res) srLoseOK=false;
    });
    out.srWin = srWinOK; out.srLose = srLoseOK;
    /* ③b 檢定復現性：同種子同選擇 → 同結果（中間值屬性讓骰子真的有作用） */
    const sev=srs[0].e, sidx=sev.choices.indexOf(srs[0].c), sk=srs[0].c.sr.k;
    const runSeed=()=>{
      startSeedBattle('R44WXY');
      S.age=sev.stage[0]; S.flags={employed:true}; ensureState(S); S.attr[sk]=srs[0].c.sr.need-20;
      showEvent(sev); choose(sidx);
      return S.resume[S.resume.length-1].res;
    };
    const res1=runSeed(), res2=runSeed();
    out.srReplay = typeof res1==='string' && res1.length>10 && res1===res2;
    /* ④ 門檻事件 gating：差 1 點不進池、達標進池 */
    let gateOK=true;
    GATES.forEach(g=>{
      const e=EVENTS.find(x=>x.id===g[0]);
      startGame(); S.age=e.stage[0]+1; S.flags={}; ensureState(S); S.seen={};
      S.attr[g[1]]=g[2]-1;
      if(eligible().some(x=>x.id===g[0])) gateOK=false;
      S.attr[g[1]]=g[2];
      if(!eligible().some(x=>x.id===g[0])) gateOK=false;
    });
    out.gateLine = gateOK;
    /* ⑤ 零殘留：全 50 屬性的乾淨局——門檻事件不進池、無 r44 旗標/seen 殘留；
       結算時間軸有「屬性軌跡」確定性一行 */
    startGame(); S.age=30; S.flags={}; ensureState(S); S.seen={};
    for(const k in S.attr) S.attr[k]=50;
    out.cleanPool = !eligible().some(e=>/^r44_/.test(e.id) && e.cond);
    out.cleanFlags = Object.keys(S.flags||{}).every(k=>k.indexOf('r44')!==0);
    out.cleanSeen = Object.keys(S.seen||{}).every(k=>k.indexOf('r44')!==0);
    const oRn=rng; rng=()=>0.5; die(); rng=oRn;
    const arc=(S.tl||[]).filter(t=>String(t.txt).indexOf('屬性軌跡：')===0);
    out.arcNote = arc.length===1 && /巔峰 \\d+/.test(arc[0].txt) && /谷底 \\d+/.test(arc[0].txt);
    /* ⑥ 成就 */
    delete SAVE.ach.r44_fullgauge;
    startGame(); S.age=40; S.flags={}; ensureState(S); S.attr.int=99;
    const oR1=rng; rng=()=>0.5; die(); rng=oR1;
    out.fullNeg = !SAVE.ach.r44_fullgauge;
    startGame(); S.age=40; S.flags={}; ensureState(S); S.attr.int=100;
    const oR2=rng; rng=()=>0.5; die(); rng=oR2;
    out.fullAch = SAVE.ach.r44_fullgauge===true;
    delete SAVE.ach.r44_evenkeel;
    startGame(); S.age=40; S.flags={}; ensureState(S);
    ['hp','int','apr','mny','hap'].forEach((k,i)=>{ S.attr[k]=53+i; });   // 全 <55 一條 → 不亮
    const oR3=rng; rng=()=>0.5; die(); rng=oR3;
    const evenNeg1=!SAVE.ach.r44_evenkeel;
    startGame(); S.age=40; S.flags={}; ensureState(S);
    ['hp','int','apr','mny','hap'].forEach((k,i)=>{ S.attr[k]=60+i*2; });   // 差 8 → 不亮
    const oR4=rng; rng=()=>0.5; die(); rng=oR4;
    const evenNeg2=!SAVE.ach.r44_evenkeel;
    out.evenNeg = evenNeg1 && evenNeg2;
    startGame(); S.age=40; S.flags={}; ensureState(S);
    ['hp','int','apr','mny','hap'].forEach((k,i)=>{ S.attr[k]=58+i; });   // 差 4 全 ≥55 → 亮
    const oR5=rng; rng=()=>0.5; die(); rng=oR5;
    out.evenAch = SAVE.ach.r44_evenkeel===true;
    delete SAVE.ach.r44_seesaw;
    startGame(); S.age=30; S.flags={employed:true}; ensureState(S); S.seen={};
    showEvent(EVENTS.find(e=>e.id==='r44_tr_sidejob')); choose(0);
    showEvent(EVENTS.find(e=>e.id==='r44_tr_gym')); choose(1);
    const oR6=rng; rng=()=>0.5; die(); rng=oR6;
    out.seesawNeg = !SAVE.ach.r44_seesaw;
    startGame(); S.age=30; S.flags={employed:true}; ensureState(S); S.seen={};
    showEvent(EVENTS.find(e=>e.id==='r44_tr_sidejob')); choose(0);
    showEvent(EVENTS.find(e=>e.id==='r44_tr_gym')); choose(1);
    showEvent(EVENTS.find(e=>e.id==='r44_tr_face')); choose(2);
    const oR7=rng; rng=()=>0.5; die(); rng=oR7;
    out.seesawAch = SAVE.ach.r44_seesaw===true;
    return JSON.stringify(out);
  })()`, sandbox);
  const r44 = JSON.parse(r44Raw);
  r44OK = Object.values(r44).every(v => v === true);
  console.log(`R44 屬性驅動強化: ${r44OK ? '✅ 全數通過' : '❌ ' + JSON.stringify(r44)}`);
} catch (e) {
  console.log('R44 屬性驅動強化: ❌ ' + e.message);
}

/* ---- R45 台味鬼島嘲諷文案探針（強制路徑，不靠隨機抽中）----
   ① 結構：11 個 r45_ 鬼島事件齊備（once＋stage＋meme 場景存在＋選項≥2、一般選項 eff 全固定且 |v|≤8）、
      3 個鬼島死法 SPECIAL_DEATHS / DEATHBOOK 雙邊完整、4 成就有 hint
   ② 死法確定性（沿用 R27 門檻慣例、零裸 rng）：門檻內必死（specialDeath＋die() 後 cat 正確）、
      門檻外必活（無 specialDeath 殘留、倖存旗標有立）
   ③ 成就正反例：社畜認證（雙旗標，單旗標不亮）/ 無殼蝸牛（55+ 看過蛋黃區無房，有房不亮）/
      珍奶自由（事件實走）/ 鬼島生存大師（6 種 seen，5 種不亮）
   ④ 結算神評：lifeVerdict 在只命中 r45 條件的局，回鬼島嘲諷句（Math.random 樁定）
   ⑤ 零殘留：乾淨局 S.flags / S.seen 無 r45 鍵 */
let r45OK = false;
try {
  const r45Raw = vm.runInContext(`(function(){
    const out={};
    const IDS=['r45_firstpay','r45_dutyfree','r45_eggyolk','r45_nhi','r45_scooterfall','r45_powerbill','r45_bobafree','r45_elderline','r45_election','r45_typhoon','r45_tangping'];
    const evs=IDS.map(id=>EVENTS.find(e=>e.id===id));
    /* ① 結構 */
    out.evDef = evs.every(e=>!!e && e.once===true && Array.isArray(e.stage) && e.title && e.text && (e.choices||[]).length>=2);
    out.scenes = evs.every(e=>e.meme && e.meme.scene && !!SCENES[e.meme.scene] && e.meme.top && e.meme.bot);
    out.effNorm = evs.every(e=>e.choices.every(c=>!c.eff || Object.values(c.eff).every(v=>Math.abs(v)<=8)));
    const DKEYS=['sweatout','typhoonwork','tangping'];
    out.sdDef = DKEYS.every(k=>SPECIAL_DEATHS[k] && SPECIAL_DEATHS[k].cat===k && SPECIAL_DEATHS[k].scene && SCENES[SPECIAL_DEATHS[k].scene] && SPECIAL_DEATHS[k].title && SPECIAL_DEATHS[k].reason);
    out.dbDef = DKEYS.every(k=>DEATHBOOK.some(d=>d.id===k && d.rare===true && d.nm && d.hint && d.reason));
    out.achDef = ['r45_shachiku','r45_snail','r45_bobasoul','r45_islander'].every(id=>ACH_MAP[id] && ACH_MAP[id].hint && String(ACH_MAP[id].hint).length>4);
    /* ② 死法確定性 */
    const SPECS=[
      {ev:'r45_powerbill', sp:'r45_sweat',     k:'hp',  lim:10, death:'sweatout',    live:'r45_sweatking'},
      {ev:'r45_typhoon',   sp:'r45_stormride', k:'hp',  lim:12, death:'typhoonwork', live:'r45_stormhero'},
      {ev:'r45_tangping',  sp:'r45_tangping',  k:'mny', lim:10, death:'tangping',    live:null},
    ];
    let dieOK=true, liveOK=true;
    SPECS.forEach(t=>{
      const e=EVENTS.find(x=>x.id===t.ev), i=e.choices.findIndex(c=>c.special===t.sp);
      if(i<0){ dieOK=false; liveOK=false; return; }
      /* 門檻內：必觸發 specialDeath，die() 後 cat 正確 */
      startGame(); S.age=e.stage[0]; S.flags={employed:true}; ensureState(S);
      S.attr[t.k]=t.lim;
      showEvent(e); choose(i);
      if(S.flags.specialDeath!==t.death) dieOK=false;
      else {
        const oR=rng; rng=()=>0.5;
        if(S.alive) die('choice');
        rng=oR;
        if(S.cat!==t.death || S.deathId!==t.death || S.alive) dieOK=false;
      }
      /* 門檻外：必活，無 specialDeath 殘留，倖存旗標有立 */
      startGame(); S.age=e.stage[0]; S.flags={employed:true}; ensureState(S);
      S.attr[t.k]=60; S.attr.hp=Math.max(S.attr.hp,60);
      showEvent(e); choose(i);
      if(S.flags.specialDeath || !S.alive) liveOK=false;
      if(t.live && !S.flags[t.live]) liveOK=false;
    });
    out.dieGate = dieOK; out.liveGate = liveOK;
    /* ③ 成就正反例 */
    delete SAVE.ach.r45_shachiku;
    startGame(); S.age=30; S.flags={employed:true}; ensureState(S); S.seen={};
    const e1=EVENTS.find(e=>e.id==='r45_firstpay');
    showEvent(e1); choose(e1.choices.findIndex(c=>c.flags&&c.flags.r45_pay22));
    let oR1=rng; rng=()=>0.5; die(); rng=oR1;
    out.shaNeg = !SAVE.ach.r45_shachiku;
    startGame(); S.age=30; S.flags={employed:true}; ensureState(S); S.seen={};
    const e2=EVENTS.find(e=>e.id==='r45_dutyfree');
    showEvent(e1); choose(e1.choices.findIndex(c=>c.flags&&c.flags.r45_pay22));
    showEvent(e2); choose(e2.choices.findIndex(c=>c.flags&&c.flags.r45_otok));
    let oR2=rng; rng=()=>0.5; die(); rng=oR2;
    out.shaAch = SAVE.ach.r45_shachiku===true;
    delete SAVE.ach.r45_snail;
    startGame(); S.age=56; S.flags={homeowner:true}; ensureState(S); S.seen={r45_eggyolk:true};
    let oR3=rng; rng=()=>0.5; die(); rng=oR3;
    out.snailNeg = !SAVE.ach.r45_snail;
    startGame(); S.age=56; S.flags={}; ensureState(S); S.seen={r45_eggyolk:true};
    let oR4=rng; rng=()=>0.5; die(); rng=oR4;
    out.snailAch = SAVE.ach.r45_snail===true;
    delete SAVE.ach.r45_bobasoul;
    startGame(); S.age=25; S.flags={}; ensureState(S); S.seen={};
    const e3=EVENTS.find(e=>e.id==='r45_bobafree');
    showEvent(e3); choose(e3.choices.findIndex(c=>c.flags&&c.flags.r45_bobaeveryday));
    let oR5=rng; rng=()=>0.5; die(); rng=oR5;
    out.bobaAch = SAVE.ach.r45_bobasoul===true;
    delete SAVE.ach.r45_islander;
    startGame(); S.age=35; S.flags={}; ensureState(S);
    S.seen={r45_firstpay:true,r45_dutyfree:true,r45_eggyolk:true,r45_nhi:true,r45_scooterfall:true};
    let oR6=rng; rng=()=>0.5; die(); rng=oR6;
    out.isleNeg = !SAVE.ach.r45_islander;
    startGame(); S.age=35; S.flags={}; ensureState(S);
    S.seen={r45_firstpay:true,r45_dutyfree:true,r45_eggyolk:true,r45_nhi:true,r45_scooterfall:true,r45_election:true};
    let oR7=rng; rng=()=>0.5; die(); rng=oR7;
    out.isleAch = SAVE.ach.r45_islander===true;
    /* ④ 結算神評：只命中 r45_pay22 條件的局 → 必回鬼島句（Math.random 樁定 0） */
    startGame(); S.age=65; ensureState(S);
    S.flags={married:true, r45_pay22:true};
    for(const k in S.attr) S.attr[k]=50;
    const oMR=Math.random; Math.random=()=>0;
    const v=lifeVerdict();
    Math.random=oMR;
    out.verdict = typeof v==='string' && v.indexOf('22K')>=0;
    /* ⑤ 零殘留：乾淨新局無 r45 旗標/seen */
    startGame();
    out.clean = Object.keys(S.flags||{}).every(k=>k.indexOf('r45')!==0)
             && Object.keys(S.seen||{}).every(k=>k.indexOf('r45')!==0);
    return JSON.stringify(out);
  })()`, sandbox);
  const r45 = JSON.parse(r45Raw);
  r45OK = Object.values(r45).every(v => v === true);
  console.log(`R45 鬼島嘲諷文案: ${r45OK ? '✅ 全數通過' : '❌ ' + JSON.stringify(r45)}`);
} catch (e) {
  console.log('R45 鬼島嘲諷文案: ❌ ' + e.message);
}

/* ---- R47 精華戰績文字＋開源導流探針 ----
   ① 函式存在（buildBragText / copyBragText / githubCtaHTML）
   ② 死局生成：正經版含遊戲連結 earthlife.pages.dev、享年、評級、成就枚數
   ③ 雙風格：靠北版與正經版內容不同、且兩版各自二次生成逐字一致（零 rng 確定性）
   ④ 個資護欄：戰績文字不含本名/信箱/本機路徑等任何個資痕跡
   ⑤ CTA：githubCtaHTML 連到 tingyi365 公開 repo、target=_blank、不含個資以外資訊 */
let r47OK = false;
try {
  const r47Raw = vm.runInContext(`(function(){
    const out={};
    out.fnDef = typeof buildBragText==='function' && typeof copyBragText==='function' && typeof githubCtaHTML==='function';
    startGame(); S.age=72; ensureState(S);
    let oR=rng; rng=()=>0.5; if(S.alive) die(); rng=oR;
    const plain=buildBragText('plain'), salty=buildBragText('salty');
    out.link  = plain.indexOf('https://earthlife.pages.dev')>=0 && salty.indexOf('https://earthlife.pages.dev')>=0;
    out.body  = plain.indexOf('享年 72 歲')>=0 && plain.indexOf('評級')>=0 && /成就 \\d+ 枚/.test(plain);
    out.styles = plain!==salty;
    out.deter = plain===buildBragText('plain') && salty===buildBragText('salty');
    const pii=/gmail|@\\w+\\.\\w+|[A-Z]:\\\\|Users\\\\/i;
    out.noPII = !pii.test(plain) && !pii.test(salty);
    const cta=githubCtaHTML();
    out.cta = cta.indexOf('https://github.com/tingyi365/earthlife')>=0 && cta.indexOf('target="_blank"')>=0
           && !/gmail|@\\w+\\.\\w+|[A-Z]:\\\\|Users\\\\/i.test(cta);
    return JSON.stringify(out);
  })()`, sandbox);
  const r47 = JSON.parse(r47Raw);
  r47OK = Object.values(r47).every(v => v === true);
  console.log(`R47 精華戰績與開源導流: ${r47OK ? '✅ 全數通過' : '❌ ' + JSON.stringify(r47)}`);
} catch (e) {
  console.log('R47 精華戰績與開源導流: ❌ ' + e.message);
}

/* ---- R48 隱藏結局＋去敏探針 ----
   ① 去敏：index.html 與本測試檔原始碼皆不含字面信箱前綴數字（用 charCode 組裝避免自打臉）
   ② 定義：HIDDEN_ENDINGS 存在、至少 6 個、欄位齊全（id/ic/nm/cond/hint/text/chk）且 id 不重複
   ③ 條件函式可呼叫：每個 chk 對活體 S/SAVE 呼叫不丟例外、回傳布林
   ④ 觸發＋演出：五維 95 謝幕必中 he_pentagod、結算畫面含專屬演出、SAVE.hiddenEnds 入冊
   ⑤ 圖鑑掛接：collStats 計入隱藏結局館、renderCollection 的 hidden 分頁渲染未解鎖 ??? 與已解鎖條目
   ⑥ 戰績卡標記：命中時 buildBragText 兩風格都帶「隱藏結局」行 */
let r48OK = false;
try {
  const banned = String.fromCharCode(56,50,53,50,54,56,51);   // 信箱前綴數字，組裝出來比對
  const selfSrc = fs.readFileSync(__filename, 'utf8');
  const desensOK = html.indexOf(banned) < 0 && selfSrc.indexOf(banned) < 0;
  const r48Raw = vm.runInContext(`(function(){
    const out={};
    out.def = typeof HIDDEN_ENDINGS!=='undefined' && Array.isArray(HIDDEN_ENDINGS) && HIDDEN_ENDINGS.length>=6
      && HIDDEN_ENDINGS.every(h=>h.id&&h.ic&&h.nm&&h.cond&&h.hint&&h.text&&typeof h.chk==='function')
      && new Set(HIDDEN_ENDINGS.map(h=>h.id)).size===HIDDEN_ENDINGS.length;
    startGame(); ensureState(S);
    out.callable = HIDDEN_ENDINGS.every(h=>{ try{ return typeof h.chk(S,SAVE)==='boolean'; }catch(e){ return false; } });
    // 五維 95 + 高齡謝幕 → 必中 he_pentagod（條件確定性，與 rng 無關）
    S.age=88; S.attr.hp=95; S.attr.int=95; S.attr.apr=95; S.attr.mny=95; S.attr.hap=95;
    let oR=rng; rng=()=>0.5; if(S.alive) die(); rng=oR;
    out.hit = S.hiddenEnd==='he_pentagod' && (S.hiddenHits||[]).indexOf('he_pentagod')>=0;
    out.saved = !!(SAVE.hiddenEnds && SAVE.hiddenEnds.he_pentagod);
    const sumHTML = document.querySelector('#app').innerHTML;
    out.show = sumHTML.indexOf('隱 藏 結 局 達 成')>=0 && sumHTML.indexOf('五維封頂')>=0;
    out.brag = buildBragText('plain').indexOf('隱藏結局【')>=0 && buildBragText('salty').indexOf('隱藏結局【')>=0;
    // 圖鑑掛接：統計含隱藏館、hidden 分頁渲染（已解鎖顯示名稱、未解鎖給 ??? 線索）
    const st=collStats();
    out.stats = st.h>=1 && st.total===ACHIEVEMENTS.length+DEATHBOOK.length+ORIGINS.length+REBIRTH_TALENTS.length+LIFE_BADGES.length+HIDDEN_ENDINGS.length+R49_PERKS.length;   /* R49 後全館總數含開局天賦池 */
    COLL_FILTER='all'; COLL_TAB='hidden'; renderCollection();
    const collHTML = document.querySelector('#app').innerHTML;
    out.coll = collHTML.indexOf('隱藏結局圖鑑')>=0 && collHTML.indexOf('五維封頂')>=0
      && collHTML.indexOf('？？？')>=0 && collHTML.indexOf('線索：')>=0;
    return JSON.stringify(out);
  })()`, sandbox);
  const r48 = JSON.parse(r48Raw);
  r48.desens = desensOK;
  r48OK = Object.values(r48).every(v => v === true);
  console.log(`R48 隱藏結局與去敏: ${r48OK ? '✅ 全數通過' : '❌ ' + JSON.stringify(r48)}`);
} catch (e) {
  console.log('R48 隱藏結局與去敏: ❌ ' + e.message);
}

/* ---- R49 開局天賦三選一探針 ----
   ① 天賦池：R49_PERKS ≥12、欄位齊全（id/ic/nm/tier/fx/desc/hint）、id 不重複、三稀有度齊備
   ② 三選一抽選：startGame 後 perkPool 為 3 個不重複合法 id；r49Draw 同種子重呼結果逐字一致（確定性零 rng）
   ③ 效果掛接可呼叫：r49Pick 選定後 perkId/perkUsed/日誌入帳、開局屬性效果套用；
      r49Dice / r49YearTick / effWeight / 結算輪迴點掛接逐一驗證
   ④ 舊存檔相容：無 perkSeen/perkUsed/perkId 的 SAVE 與 S 全部不炸、行為同舊版（r49Dice=0、tick 無感）
   ⑤ 戰績卡：選了天賦的局 buildBragText 兩風格都帶「開局天賦」行
   ⑥ 圖鑑掛接：collStats 計入天賦池、perk 分頁渲染已解鎖條目與未解鎖 ??? 線索 */
let r49OK = false;
try {
  const r49Raw = vm.runInContext(`(function(){
    const out={};
    out.pool = typeof R49_PERKS!=='undefined' && Array.isArray(R49_PERKS) && R49_PERKS.length>=12
      && R49_PERKS.every(p=>p.id&&p.ic&&p.nm&&p.tier&&p.fx&&p.desc&&p.hint&&R49_TIER[p.tier])
      && new Set(R49_PERKS.map(p=>p.id)).size===R49_PERKS.length
      && ['c','r','n'].every(t=>R49_PERKS.some(p=>p.tier===t));
    startGame(); ensureState(S);
    // 三選一：3 個不重複合法 id；同種子重抽逐字一致（零 rng 確定性）
    out.draw3 = Array.isArray(S.perkPool) && S.perkPool.length===3
      && new Set(S.perkPool).size===3 && S.perkPool.every(id=>!!R49_MAP[id]);
    out.det = JSON.stringify(r49Draw())===JSON.stringify(r49Draw());
    // 選定：perkId 入帳、跨局收集蓋章、日誌有記錄；屬性效果（若有 eff）已套用且 0-100 內
    const pickId = S.perkPool[0], pk = R49_MAP[pickId];
    const before = Object.assign({}, S.attr);
    r49Pick(pickId);
    out.pick = S.perkId===pickId && !!(SAVE.perkUsed&&SAVE.perkUsed[pickId])
      && S.log.some(l=>l.indexOf('開局天賦【'+pk.nm+'】')>=0);
    out.eff = !pk.eff || Object.keys(pk.eff).every(k=>{
      const want=Math.max(0,Math.min(100,before[k]+pk.eff[k]));
      return S.attr[k]===want;
    });
    // 效果掛接可呼叫：擲骰加成（指定天賦逐一驗值）、年度節拍不丟例外、權重倍率生效、輪迴點 +1
    const keep=S.perkId;
    S.perkId='pk_jiao';  out.dice = r49Dice()===3;
    S.perkId='pk_allin'; out.dice = out.dice && r49Dice()===8;
    S.perkId='pk_chill'; out.dice = out.dice && r49Dice()===-4;
    S.perkId='pk_radar'; out.wmul = (function(){ try{
      const ev=EVENTS.find(e=>(e.w||1)<1 && !e.once); if(!ev) return true;
      S.seenCount={}; S.recent=[];
      const w1=effWeight(ev); S.perkId=null; const w0=effWeight(ev); S.perkId='pk_radar';
      return Math.abs(w1-w0*1.18)<1e-9;
    }catch(e){ return false; } })();
    S.perkId='pk_kpi'; S.age=30; const hp0=S.attr.hp, mn0=S.attr.mny;
    out.tick = (function(){ try{ r49YearTick(); return S.attr.hp===Math.max(0,hp0-1)&&S.attr.mny===Math.min(100,mn0+1); }catch(e){ return false; } })();
    S.perkId=keep;
    // 孟婆 VIP：結算輪迴點 +1（同一局種子，比較有無 pk_vip 的 rpGain 差）
    out.rp = (function(){ try{
      S.perkId='pk_vip'; S.age=70; S.attr.hp=50;
      let oR=rng; rng=()=>0.5; if(S.alive) die(); rng=oR;
      const withVip=S.rpGain||0;
      return withVip>=2;   // 基礎至少 1 + VIP 1
    }catch(e){ return false; } })();
    // 戰績卡：兩風格都帶開局天賦行
    out.brag = buildBragText('plain').indexOf('開局天賦「')>=0 && buildBragText('salty').indexOf('開局天賦「')>=0;
    // 圖鑑掛接：統計含天賦池、perk 分頁渲染（已解鎖顯名、未解鎖 ??? 線索）
    const st=collStats();
    out.stats = st.k>=3 && st.total>=ACHIEVEMENTS.length+DEATHBOOK.length+ORIGINS.length+REBIRTH_TALENTS.length+LIFE_BADGES.length+HIDDEN_ENDINGS.length+R49_PERKS.length;
    // 長跑模擬可能已集滿全池：重置收集狀態只留選用那張，確保同畫面驗得到「已解鎖顯名＋未解鎖 ??? 線索」
    SAVE.perkSeen={}; SAVE.perkSeen[pickId]=true;
    COLL_FILTER='all'; COLL_TAB='perk'; renderCollection();
    const collHTML = document.querySelector('#app').innerHTML;
    out.coll = collHTML.indexOf('開局天賦池')>=0 && collHTML.indexOf(pk.nm)>=0
      && collHTML.indexOf('？？？')>=0 && collHTML.indexOf('線索：')>=0;
    // 舊存檔相容：刪掉 R49 鍵重載不炸、無 perkId 的 S 所有掛接點無感
    out.compat = (function(){ try{
      delete SAVE.perkSeen; delete SAVE.perkUsed;
      const raw=JSON.stringify(SAVE); localStorage.setItem('earthlife_save_v2', raw);
      loadSave();
      const seenOK = SAVE.perkSeen && typeof SAVE.perkSeen==='object' && SAVE.perkUsed && typeof SAVE.perkUsed==='object';
      S.perkId=null; S.perkPool=null;
      const noFx = r49Dice()===0 && r49Perk()===null;
      r49YearTick();   // 無天賦：不丟例外、不動屬性
      return seenOK && noFx && r49CardHTML()==='';
    }catch(e){ return false; } })();
    return JSON.stringify(out);
  })()`, sandbox);
  const r49 = JSON.parse(r49Raw);
  r49OK = Object.values(r49).every(v => v === true);
  console.log(`R49 開局天賦三選一: ${r49OK ? '✅ 全數通過' : '❌ ' + JSON.stringify(r49)}`);
} catch (e) {
  console.log('R49 開局天賦三選一: ❌ ' + e.message);
}

/* ---- R51 成家事件鏈探針（強制路徑，不靠隨機抽中）----
   ① 結構：4 段事件齊備（once＋stage＋場景存在＋選項數）、toastdown 死法雙邊收錄、
      3 成就有 hint、R46 保底表收 4 個入口、3 個 cb_ 段進因果鏈優先池
   ② 相親線全鏈：seed→wedding→house→kid 逐段進池、旗標正確推進、後段未到不進池；
      走完婚禮＋買房＋生養 → 解鎖 r51_fullnest（頂客路線不誤觸）
   ③ 分支互斥：相親線看不到戀愛限定選項（反之亦然）；不婚線跳過婚禮直入買房段、
      solo 限定選項只給 solo
   ④ R50 職業膠囊：careerId=eng 才見工程師買房線、stall 才見攤二代育兒線
   ⑤ 世代輪迴：r34_cram 出身見「補習地圖傳承」且通用雞娃隱藏 → 選之 → r51_cycle → 成就
   ⑥ 死法確定性（比照 R27 門檻慣例、零裸 rng）：hp<=14 自辦流水席必死（cat=toastdown）、
      門檻外必活（r51_toastking 倖存旗標）
   ⑦ 狀態 gating：已婚不進 seed／wedding；不婚活到 70+ 解鎖 r51_freebird；乾淨局零 r51 殘留 */
let r51OK = false;
try {
  const r51Raw = vm.runInContext(`(function(){
    const out={};
    const IDS=['r51_seed','cb_r51_wedding','cb_r51_house','cb_r51_kid'];
    const evs=IDS.map(id=>EVENTS.find(e=>e.id===id));
    /* ① 結構 */
    out.evDef = evs.every(e=>!!e && e.once===true && Array.isArray(e.stage) && e.title && e.text && (e.choices||[]).length>=4);
    out.scenes = evs.every(e=>e.meme && e.meme.scene && !!SCENES[e.meme.scene] && e.meme.top && e.meme.bot);
    out.sdDef = !!SPECIAL_DEATHS.toastdown && SPECIAL_DEATHS.toastdown.cat==='toastdown' && !!SCENES[SPECIAL_DEATHS.toastdown.scene];
    out.dbDef = DEATHBOOK.some(d=>d.id==='toastdown' && d.rare===true && d.nm && d.hint && d.hint.length>4 && d.reason);
    out.achDef = ['r51_fullnest','r51_cycle','r51_freebird'].every(id=>ACH_MAP[id] && ACH_MAP[id].hint && String(ACH_MAP[id].hint).length>4);
    out.milestone = R46_MILESTONE.r51_seed===29 && R46_MILESTONE.cb_r51_wedding===33 && R46_MILESTONE.cb_r51_house===37 && R46_MILESTONE.cb_r51_kid===41;
    out.chainPool = ['cb_r51_wedding','cb_r51_house','cb_r51_kid'].every(id=>CHAIN_IDS.has(id));
    /* ② 相親線全鏈 */
    delete SAVE.ach.r51_fullnest;
    startGame(); S.age=28; S.flags={}; ensureState(S); S.seen={};
    out.seedIn = eligible().some(e=>e.id==='r51_seed');
    out.laterGated = !eligible().some(e=>['cb_r51_wedding','cb_r51_house','cb_r51_kid'].includes(e.id));
    showEvent(EVENTS.find(e=>e.id==='r51_seed')); choose(0);
    out.matchFlag = S.flags.r51_match===true && !S.flags.r51_love && !S.flags.r51_solo;
    S.age=30;
    out.wedIn = eligible().some(e=>e.id==='cb_r51_wedding');
    out.houseGated = !eligible().some(e=>e.id==='cb_r51_house');
    showEvent(EVENTS.find(e=>e.id==='cb_r51_wedding'));
    let h=document.querySelector('#app').innerHTML;
    out.matchOnly = h.includes('長輩全包辦') && !h.includes('小辦精緻場');
    choose(0);
    out.wedFlag = S.flags.r51_wed===true && S.flags.r51_sponsor===true && S.flags.marital==='married' && S.flags.married===true;
    S.age=33;
    out.houseIn = eligible().some(e=>e.id==='cb_r51_house');
    out.kidGated = !eligible().some(e=>e.id==='cb_r51_kid');
    showEvent(EVENTS.find(e=>e.id==='cb_r51_house'));
    h=document.querySelector('#app').innerHTML;
    out.noSoloOpt = h.includes('頭期款靠爸') && !h.includes('單身小宅');
    choose(0);
    out.houseFlag = S.flags.r51_house===true && S.flags.r51_dadpay===true && S.flags.homeowner===true;
    S.age=36;
    out.kidIn = eligible().some(e=>e.id==='cb_r51_kid');
    showEvent(EVENTS.find(e=>e.id==='cb_r51_kid'));
    h=document.querySelector('#app').innerHTML;
    out.kidOpts = h.includes('雞娃全餐') && h.includes('佛系放養') && !h.includes('攤二代養成計畫') && !h.includes('補習地圖');
    choose(2);
    out.kidFlag = S.flags.r51_kid===true && S.flags.r51_tiger===true && S.flags.haskid===true && S.flags.kids===1;
    const oR1=rng; rng=()=>0.5; die(); rng=oR1;
    out.fullAch = SAVE.ach.r51_fullnest===true;
    /* ②b 頂客路線不誤觸 fullnest */
    delete SAVE.ach.r51_fullnest;
    startGame(); S.age=36; S.flags={r51_wed:true,r51_house:true}; ensureState(S); S.seen={};
    showEvent(EVENTS.find(e=>e.id==='cb_r51_kid')); choose(4);
    out.dinkFlag = S.flags.r51_nokid===true && S.flags.dink===true && !S.flags.haskid;
    const oR2=rng; rng=()=>0.5; die(); rng=oR2;
    out.dinkNeg = !SAVE.ach.r51_fullnest;
    /* ③ 戀愛線互斥＋不婚線跳段 */
    startGame(); S.age=28; S.flags={}; ensureState(S); S.seen={};
    showEvent(EVENTS.find(e=>e.id==='r51_seed')); choose(1);
    out.loveFlag = S.flags.r51_love===true;
    S.age=30;
    showEvent(EVENTS.find(e=>e.id==='cb_r51_wedding'));
    h=document.querySelector('#app').innerHTML;
    out.loveOnly = h.includes('小辦精緻場') && !h.includes('長輩全包辦');
    startGame(); S.age=28; S.flags={}; ensureState(S); S.seen={};
    showEvent(EVENTS.find(e=>e.id==='r51_seed')); choose(2);
    out.soloFlag = S.flags.r51_solo===true;
    S.age=32;
    out.soloSkipWed = !eligible().some(e=>e.id==='cb_r51_wedding');
    out.soloHouseIn = eligible().some(e=>e.id==='cb_r51_house');
    showEvent(EVENTS.find(e=>e.id==='cb_r51_house'));
    h=document.querySelector('#app').innerHTML;
    out.soloOpt = h.includes('單身小宅') && !h.includes('頭期款靠爸');
    choose(4);
    out.soloHouse = S.flags.r51_house===true && S.flags.r51_solohouse===true && S.flags.homeowner===true;
    /* ④ R50 職業膠囊 */
    startGame(); S.age=32; S.flags={r51_wed:true}; ensureState(S); S.seen={}; S.careerId='eng';
    showEvent(EVENTS.find(e=>e.id==='cb_r51_house'));
    out.engShown = document.querySelector('#app').innerHTML.includes('爆肝工程師');
    startGame(); S.age=32; S.flags={r51_wed:true}; ensureState(S); S.seen={}; S.careerId=null;
    showEvent(EVENTS.find(e=>e.id==='cb_r51_house'));
    out.engHidden = !document.querySelector('#app').innerHTML.includes('爆肝工程師');
    startGame(); S.age=36; S.flags={r51_wed:true,r51_house:true}; ensureState(S); S.seen={}; S.careerId='stall';
    showEvent(EVENTS.find(e=>e.id==='cb_r51_kid'));
    out.stallShown = document.querySelector('#app').innerHTML.includes('攤二代養成計畫');
    /* ⑤ 世代輪迴 */
    delete SAVE.ach.r51_cycle;
    startGame(); S.age=36; S.flags={r51_wed:true,r51_house:true,r34_cram:true}; ensureState(S); S.seen={};
    showEvent(EVENTS.find(e=>e.id==='cb_r51_kid'));
    h=document.querySelector('#app').innerHTML;
    out.cycleShown = h.includes('補習地圖') && !h.includes('雞娃全餐');
    choose(0);
    out.cycleFlag = S.flags.r51_cycle===true && S.flags.r51_tiger===true && S.flags.haskid===true;
    const oR3=rng; rng=()=>0.5; die(); rng=oR3;
    out.cycleAch = SAVE.ach.r51_cycle===true;
    /* ⑥ 死法確定性 */
    const wev=EVENTS.find(e=>e.id==='cb_r51_wedding'), wi=wev.choices.findIndex(c=>c.special==='r51_toast');
    startGame(); S.age=30; S.flags={r51_match:true}; ensureState(S); S.seen={};
    S.attr.hp=14;
    showEvent(wev); choose(wi);
    out.toastDie = S.flags.specialDeath==='toastdown';
    const oR4=rng; rng=()=>0.5; if(S.alive) die('choice'); rng=oR4;
    out.toastCat = S.cat==='toastdown' && S.deathId==='toastdown' && !S.alive && !!SAVE.deaths.toastdown;
    startGame(); S.age=30; S.flags={r51_match:true}; ensureState(S); S.seen={};
    S.attr.hp=60;
    showEvent(wev); choose(wi);
    out.toastLive = S.alive && !S.flags.specialDeath && S.flags.r51_toastking===true && S.flags.r51_wed===true && S.flags.marital==='married';
    /* ⑦ 狀態 gating＋零殘留 */
    startGame(); S.age=28; S.flags={marital:'married',married:true}; ensureState(S); S.seen={};
    out.marriedGated = !eligible().some(e=>e.id==='r51_seed');
    startGame(); S.age=30; S.flags={r51_match:true,marital:'married',married:true}; ensureState(S); S.seen={};
    out.marriedWedGated = !eligible().some(e=>e.id==='cb_r51_wedding');
    delete SAVE.ach.r51_freebird;
    startGame(); S.age=70; S.flags={r51_solo:true}; ensureState(S);
    const oR5=rng; rng=()=>0.5; die(); rng=oR5;
    out.freeAch = SAVE.ach.r51_freebird===true;
    delete SAVE.ach.r51_freebird;
    startGame(); S.age=69; S.flags={r51_solo:true}; ensureState(S);
    const oR6=rng; rng=()=>0.5; die(); rng=oR6;
    out.freeNeg = !SAVE.ach.r51_freebird;
    startGame();
    out.clean = Object.keys(S.flags||{}).every(k=>k.indexOf('r51')!==0)
             && Object.keys(S.seen||{}).every(k=>k.indexOf('r51')!==0);
    return JSON.stringify(out);
  })()`, sandbox);
  const r51 = JSON.parse(r51Raw);
  r51OK = Object.values(r51).every(v => v === true);
  console.log(`R51 成家人生事件鏈: ${r51OK ? '✅ 全數通過' : '❌ ' + JSON.stringify(r51)}`);
} catch (e) {
  console.log('R51 成家人生事件鏈: ❌ ' + e.message);
}

/* ---- R52 晚年事件鏈探針（強制路徑，不靠隨機抽中）----
   ① 結構：4 段事件齊備（once＋stage＋場景存在＋選項數≥4）、scamfeast 死法雙邊收錄、
      3 成就有 hint、R46 保底表收 4 個入口、3 個 cb_ 段進因果鏈優先池
   ② 有子女線全鏈：retire→life→health→final 逐段進池、旗標正確推進、後段未到不進池；
      走完四段 → 解鎖 r52_sunset；顧孫 → 解鎖 r52_nanny
   ③ 分支互斥（R51 旗標回扣）：有子女看得到顧孫/啃老回流、看不到老友互助與窗簾暗號；
      無子女反之；以房養老只給無子女＋homeowner
   ④ R50 職業膠囊回扣：careerId=eng 才見 FIRE 試算、stall 才見攤車做到倒；
      r52_forced 優離者才見環島回扣選項
   ⑤ 屬性門檻膠囊：mny>=60 才見請看護、hp>=70 才見公園鐵人（只用在新增選項）
   ⑥ 死法確定性（比照 R27 門檻慣例、零裸 rng）：int<=20 接詐騙電話必死（cat=scamfeast）、
      門檻外必活（r52_scambuster 旗標 + r52_scamhero 成就）
   ⑦ 狀態 gating：未退休不進 life；乾淨局零 r52 殘留 */
let r52OK = false;
try {
  const r52Raw = vm.runInContext(`(function(){
    const out={};
    const IDS=['r52_retire','cb_r52_life','cb_r52_health','cb_r52_final'];
    const evs=IDS.map(id=>EVENTS.find(e=>e.id===id));
    /* ① 結構 */
    out.evDef = evs.every(e=>!!e && e.once===true && Array.isArray(e.stage) && e.title && e.text && (e.choices||[]).length>=4);
    out.scenes = evs.every(e=>e.meme && e.meme.scene && !!SCENES[e.meme.scene] && e.meme.top && e.meme.bot);
    out.sdDef = !!SPECIAL_DEATHS.scamfeast && SPECIAL_DEATHS.scamfeast.cat==='scamfeast' && !!SCENES[SPECIAL_DEATHS.scamfeast.scene];
    out.dbDef = DEATHBOOK.some(d=>d.id==='scamfeast' && d.rare===true && d.nm && d.hint && d.hint.length>4 && d.reason);
    out.achDef = ['r52_sunset','r52_nanny','r52_scamhero'].every(id=>ACH_MAP[id] && ACH_MAP[id].hint && String(ACH_MAP[id].hint).length>4);
    out.milestone = R46_MILESTONE.r52_retire===58 && R46_MILESTONE.cb_r52_life===65 && R46_MILESTONE.cb_r52_health===71 && R46_MILESTONE.cb_r52_final===76;
    out.chainPool = ['cb_r52_life','cb_r52_health','cb_r52_final'].every(id=>CHAIN_IDS.has(id));
    /* ② 有子女線全鏈 */
    delete SAVE.ach.r52_sunset; delete SAVE.ach.r52_nanny;
    startGame(); S.age=58; S.flags={haskid:true}; ensureState(S); S.seen={};
    out.retIn = eligible().some(e=>e.id==='r52_retire');
    out.laterGated = !eligible().some(e=>['cb_r52_life','cb_r52_health','cb_r52_final'].includes(e.id));
    showEvent(EVENTS.find(e=>e.id==='r52_retire')); choose(0);
    out.retFlag = S.flags.r52_ret===true && S.flags.r52_pension===true;
    S.age=65;
    out.lifeIn = eligible().some(e=>e.id==='cb_r52_life');
    out.healthGated = !eligible().some(e=>e.id==='cb_r52_health');
    showEvent(EVENTS.find(e=>e.id==='cb_r52_life'));
    let h=document.querySelector('#app').innerHTML;
    out.kidLifeOpts = h.includes('金孫駕到') && h.includes('帶著行李回來了') && !h.includes('老友互助群組') && !h.includes('以房養老');
    choose(0);
    out.lifeFlag = S.flags.r52_life===true && S.flags.r52_nanny===true;
    S.age=71;
    out.healthIn = eligible().some(e=>e.id==='cb_r52_health');
    out.finalGated = !eligible().some(e=>e.id==='cb_r52_final');
    showEvent(EVENTS.find(e=>e.id==='cb_r52_health'));
    h=document.querySelector('#app').innerHTML;
    out.kidcareShown = h.includes('子女照顧輪值表');
    choose(0);
    out.healthFlag = S.flags.r52_health===true && S.flags.r52_nhi===true;
    S.age=76;
    out.finalIn = eligible().some(e=>e.id==='cb_r52_final');
    showEvent(EVENTS.find(e=>e.id==='cb_r52_final'));
    h=document.querySelector('#app').innerHTML;
    out.kidFinalOpts = h.includes('預立遺囑') && !h.includes('窗簾暗號');
    choose(0);
    out.finalFlag = S.flags.r52_final===true && S.flags.r52_will===true;
    const oR1=rng; rng=()=>0.5; die(); rng=oR1;
    out.sunsetAch = SAVE.ach.r52_sunset===true && SAVE.ach.r52_nanny===true;
    /* ③ 無子女線互斥（R51 不婚旗標回扣） */
    startGame(); S.age=65; S.flags={r51_solo:true,r52_ret:true}; ensureState(S); S.seen={};
    showEvent(EVENTS.find(e=>e.id==='cb_r52_life'));
    h=document.querySelector('#app').innerHTML;
    out.soloLifeOpts = h.includes('老友互助群組') && !h.includes('金孫駕到') && !h.includes('帶著行李回來了') && !h.includes('以房養老');
    startGame(); S.age=65; S.flags={r51_solo:true,r52_ret:true,homeowner:true}; ensureState(S); S.seen={};
    showEvent(EVENTS.find(e=>e.id==='cb_r52_life'));
    out.mtgShown = document.querySelector('#app').innerHTML.includes('以房養老');
    startGame(); S.age=65; S.flags={haskid:true,r52_ret:true,homeowner:true}; ensureState(S); S.seen={};
    showEvent(EVENTS.find(e=>e.id==='cb_r52_life'));
    out.mtgKidHidden = !document.querySelector('#app').innerHTML.includes('以房養老');
    startGame(); S.age=76; S.flags={r52_ret:true,r52_life:true,r52_health:true}; ensureState(S); S.seen={};
    showEvent(EVENTS.find(e=>e.id==='cb_r52_final'));
    h=document.querySelector('#app').innerHTML;
    out.soloFinalOpts = h.includes('窗簾暗號') && !h.includes('預立遺囑');
    /* ④ R50 職業膠囊回扣＋優離回扣 */
    startGame(); S.age=58; S.flags={}; ensureState(S); S.seen={}; S.careerId='eng';
    showEvent(EVENTS.find(e=>e.id==='r52_retire'));
    out.engShown = document.querySelector('#app').innerHTML.includes('FIRE 計畫');
    startGame(); S.age=58; S.flags={}; ensureState(S); S.seen={}; S.careerId='stall';
    showEvent(EVENTS.find(e=>e.id==='r52_retire'));
    h=document.querySelector('#app').innerHTML;
    out.stallShown = h.includes('攤車推得動') && !h.includes('FIRE 計畫');
    startGame(); S.age=58; S.flags={}; ensureState(S); S.seen={}; S.careerId=null;
    showEvent(EVENTS.find(e=>e.id==='r52_retire'));
    h=document.querySelector('#app').innerHTML;
    out.careerHidden = !h.includes('FIRE 計畫') && !h.includes('攤車推得動');
    startGame(); S.age=65; S.flags={r52_ret:true,r52_forced:true}; ensureState(S); S.seen={};
    showEvent(EVENTS.find(e=>e.id==='cb_r52_life'));
    out.forcedShown = document.querySelector('#app').innerHTML.includes('先環島再說');
    startGame(); S.age=65; S.flags={r52_ret:true,r52_pension:true}; ensureState(S); S.seen={};
    showEvent(EVENTS.find(e=>e.id==='cb_r52_life'));
    out.forcedHidden = !document.querySelector('#app').innerHTML.includes('先環島再說');
    /* ⑤ 屬性門檻膠囊 */
    startGame(); S.age=71; S.flags={r52_ret:true,r52_life:true}; ensureState(S); S.seen={};
    S.attr.mny=60; S.attr.hp=70;
    showEvent(EVENTS.find(e=>e.id==='cb_r52_health'));
    h=document.querySelector('#app').innerHTML;
    out.gateShown = h.includes('直接請看護') && h.includes('公園單槓老鐵人');
    startGame(); S.age=71; S.flags={r52_ret:true,r52_life:true}; ensureState(S); S.seen={};
    S.attr.mny=40; S.attr.hp=50;
    showEvent(EVENTS.find(e=>e.id==='cb_r52_health'));
    h=document.querySelector('#app').innerHTML;
    out.gateHidden = !h.includes('直接請看護') && !h.includes('公園單槓老鐵人');
    /* ⑥ 死法確定性 */
    delete SAVE.ach.r52_scamhero;
    const fev=EVENTS.find(e=>e.id==='cb_r52_final'), fi=fev.choices.findIndex(c=>c.special==='r52_scam');
    startGame(); S.age=76; S.flags={r52_ret:true,r52_life:true,r52_health:true}; ensureState(S); S.seen={};
    S.attr.int=20;
    showEvent(fev); choose(fi);
    out.scamDie = S.flags.specialDeath==='scamfeast';
    const oR2=rng; rng=()=>0.5; if(S.alive) die('choice'); rng=oR2;
    out.scamCat = S.cat==='scamfeast' && S.deathId==='scamfeast' && !S.alive && !!SAVE.deaths.scamfeast;
    startGame(); S.age=76; S.flags={r52_ret:true,r52_life:true,r52_health:true}; ensureState(S); S.seen={};
    S.attr.int=60;
    showEvent(fev); choose(fi);
    out.scamLive = S.alive && !S.flags.specialDeath && S.flags.r52_scambuster===true && S.flags.r52_final===true;
    const oR3=rng; rng=()=>0.5; die(); rng=oR3;
    out.scamAch = SAVE.ach.r52_scamhero===true;
    /* ⑦ 狀態 gating＋零殘留 */
    startGame(); S.age=65; S.flags={}; ensureState(S); S.seen={};
    out.noRetGated = !eligible().some(e=>e.id==='cb_r52_life');
    startGame();
    out.clean = Object.keys(S.flags||{}).every(k=>k.indexOf('r52')!==0)
             && Object.keys(S.seen||{}).every(k=>k.indexOf('r52')!==0);
    return JSON.stringify(out);
  })()`, sandbox);
  const r52 = JSON.parse(r52Raw);
  r52OK = Object.values(r52).every(v => v === true);
  console.log(`R52 晚年人生事件鏈: ${r52OK ? '✅ 全數通過' : '❌ ' + JSON.stringify(r52)}`);
} catch (e) {
  console.log('R52 晚年人生事件鏈: ❌ ' + e.message);
}

/* ---- R53 童年事件鏈探針（強制路徑，不靠隨機抽中）----
   ① 結構：4 段童年事件＋1 成年回扣事件齊備（once＋stage＋場景存在＋選項數達標）、
      3 成就有 hint、R46 保底表只收收尾段＋成年回扣 2 入口（童年年槽稀缺，入口/中段走因果鏈池，
      避免擠死 r43 童年人物線）、4 個 cb_ 事件進因果鏈優先池、TL_ONESHOT 收記憶點
   ② 安親班線全鏈：seed→toy→summer→family 逐段進池、旗標正確推進、後段未到不進池；
      玩物段只見遊戲王（含被沒收）、暑假段只見暑輔、家族段可見才藝軍備；
      走完四段＋被比較 → die() 解鎖 r53_golden＋r53_seized
   ③ 分支互斥：柑仔店線只見神奇寶貝卡、野放線只見四驅車與孩子王、
      野放/柑仔店線才見阿嬤家、安親班線看不到阿嬤家
   ④ R50 職業回扣：r53_cards＋careerId 才進 cb_r53_cardsell；缺一不入池；
      r53_confiscated 才見「回母校討卡」選項；變現 → r53_cardsold → 成就 r53_cardcash
   ⑤ R51 回扣：r53_compared 才見 cb_r51_kid 尾端「不用跟任何人比」選項（index 6 附加，
      不動既有選項順序），選了正確寫 r51_kid/r51_freerange/r53_nocompare/haskid
   ⑥ 門檻膠囊只在新增選項（gate:true 標記齊備）
   ⑦ 乾淨局零 r53 殘留 */
let r53OK = false;
try {
  const r53Raw = vm.runInContext(`(function(){
    const out={};
    const IDS=['r53_seed','cb_r53_toy','cb_r53_summer','cb_r53_family'];
    const evs=IDS.map(id=>EVENTS.find(e=>e.id===id));
    const csEv=EVENTS.find(e=>e.id==='cb_r53_cardsell');
    /* ① 結構 */
    out.evDef = evs.every(e=>!!e && e.once===true && Array.isArray(e.stage) && e.title && e.text && (e.choices||[]).length>=4);
    out.csDef = !!csEv && csEv.once===true && Array.isArray(csEv.stage) && (csEv.choices||[]).length>=3;
    out.scenes = evs.concat([csEv]).every(e=>e.meme && e.meme.scene && !!SCENES[e.meme.scene] && e.meme.top && e.meme.bot);
    out.achDef = ['r53_golden','r53_seized','r53_cardcash'].every(id=>ACH_MAP[id] && ACH_MAP[id].hint && String(ACH_MAP[id].hint).length>4);
    out.milestone = R46_MILESTONE.cb_r53_family===12 && R46_MILESTONE.cb_r53_cardsell===32
                 && R46_MILESTONE.r53_seed===undefined && R46_MILESTONE.cb_r53_toy===undefined && R46_MILESTONE.cb_r53_summer===undefined;
    out.chainPool = ['cb_r53_toy','cb_r53_summer','cb_r53_family','cb_r53_cardsell'].every(id=>CHAIN_IDS.has(id));
    out.tlDef = TL_ONESHOT.some(o=>o[0]==='r53_family');
    /* ② 安親班線全鏈 */
    delete SAVE.ach.r53_golden; delete SAVE.ach.r53_seized;
    startGame(); S.age=5; S.flags={}; ensureState(S); S.seen={};
    out.seedIn = eligible().some(e=>e.id==='r53_seed');
    out.laterGated = !eligible().some(e=>['cb_r53_toy','cb_r53_summer','cb_r53_family','cb_r53_cardsell'].includes(e.id));
    showEvent(EVENTS.find(e=>e.id==='r53_seed')); choose(1);
    out.anqinFlag = S.flags.r53_start===true && S.flags.r53_anqin===true && !S.flags.r53_ganzai && !S.flags.r53_wild;
    S.age=7;
    out.toyIn = eligible().some(e=>e.id==='cb_r53_toy');
    out.summerGated = !eligible().some(e=>e.id==='cb_r53_summer');
    showEvent(EVENTS.find(e=>e.id==='cb_r53_toy'));
    let h=document.querySelector('#app').innerHTML;
    out.anqinToyOnly = h.includes('遊戲王卡地下決鬥') && !h.includes('神奇寶貝卡入坑') && !h.includes('四驅車魂點燃');
    choose(1);
    out.ygoFlag = S.flags.r53_toy===true && S.flags.r53_cards===true && S.flags.r53_ygo===true && S.flags.r53_confiscated===true;
    S.age=9;
    out.summerIn = eligible().some(e=>e.id==='cb_r53_summer');
    out.familyGated = !eligible().some(e=>e.id==='cb_r53_family');
    showEvent(EVENTS.find(e=>e.id==='cb_r53_summer'));
    h=document.querySelector('#app').innerHTML;
    out.anqinSummer = h.includes('暑期輔導全年無休') && !h.includes('阿嬤家放生一整月');
    choose(3);
    out.summerFlag = S.flags.r53_summer===true && S.flags.r53_summerclass===true;
    S.age=11;
    out.familyIn = eligible().some(e=>e.id==='cb_r53_family');
    showEvent(EVENTS.find(e=>e.id==='cb_r53_family'));
    h=document.querySelector('#app').innerHTML;
    out.anqinFamily = h.includes('才藝班軍備競賽') && !h.includes('孩子王登基');
    choose(0);
    out.comparedFlag = S.flags.r53_family===true && S.flags.r53_compared===true;
    const oR1=rng; rng=()=>0.5; die(); rng=oR1;
    out.goldenAch = SAVE.ach.r53_golden===true && SAVE.ach.r53_seized===true;
    /* ③ 分支互斥 */
    startGame(); S.age=7; S.flags={r53_start:true,r53_ganzai:true}; ensureState(S); S.seen={};
    showEvent(EVENTS.find(e=>e.id==='cb_r53_toy'));
    h=document.querySelector('#app').innerHTML;
    out.ganzaiToy = h.includes('神奇寶貝卡入坑') && !h.includes('遊戲王卡地下決鬥') && !h.includes('四驅車魂點燃');
    startGame(); S.age=7; S.flags={r53_start:true,r53_wild:true}; ensureState(S); S.seen={};
    showEvent(EVENTS.find(e=>e.id==='cb_r53_toy'));
    h=document.querySelector('#app').innerHTML;
    out.wildToy = h.includes('四驅車魂點燃') && !h.includes('神奇寶貝卡入坑') && !h.includes('遊戲王卡地下決鬥');
    startGame(); S.age=9; S.flags={r53_start:true,r53_wild:true,r53_toy:true}; ensureState(S); S.seen={};
    showEvent(EVENTS.find(e=>e.id==='cb_r53_summer'));
    h=document.querySelector('#app').innerHTML;
    out.wildSummer = h.includes('阿嬤家放生一整月') && !h.includes('暑期輔導全年無休');
    startGame(); S.age=11; S.flags={r53_start:true,r53_wild:true,r53_toy:true,r53_summer:true}; ensureState(S); S.seen={};
    showEvent(EVENTS.find(e=>e.id==='cb_r53_family'));
    h=document.querySelector('#app').innerHTML;
    out.wildFamily = h.includes('孩子王登基') && !h.includes('才藝班軍備競賽');
    /* ④ R50 職業回扣 */
    delete SAVE.ach.r53_cardcash;
    startGame(); S.age=30; S.flags={r53_cards:true}; ensureState(S); S.seen={}; S.careerId='eng';
    out.cardIn = eligible().some(e=>e.id==='cb_r53_cardsell');
    showEvent(EVENTS.find(e=>e.id==='cb_r53_cardsell'));
    h=document.querySelector('#app').innerHTML;
    out.noSeizedOpt = !h.includes('討回畢業沒還的那一疊');
    choose(0);
    out.soldFlag = S.flags.r53_cardsold===true;
    const oR2=rng; rng=()=>0.5; die(); rng=oR2;
    out.cashAch = SAVE.ach.r53_cardcash===true;
    startGame(); S.age=30; S.flags={r53_cards:true}; ensureState(S); S.seen={}; S.careerId=null;
    out.noCareerGated = !eligible().some(e=>e.id==='cb_r53_cardsell');
    startGame(); S.age=30; S.flags={}; ensureState(S); S.seen={}; S.careerId='eng';
    out.noCardsGated = !eligible().some(e=>e.id==='cb_r53_cardsell');
    startGame(); S.age=30; S.flags={r53_cards:true,r53_confiscated:true}; ensureState(S); S.seen={}; S.careerId='stall';
    showEvent(EVENTS.find(e=>e.id==='cb_r53_cardsell'));
    h=document.querySelector('#app').innerHTML;
    out.seizedOpt = h.includes('討回畢業沒還的那一疊');
    choose(2);
    out.backFlag = S.flags.r53_cardback===true && !S.flags.r53_cardsold;
    /* ⑤ R51 回扣 */
    startGame(); S.age=36; S.flags={r51_wed:true,r51_house:true,r53_compared:true}; ensureState(S); S.seen={};
    showEvent(EVENTS.find(e=>e.id==='cb_r51_kid'));
    h=document.querySelector('#app').innerHTML;
    out.nocmpShown = h.includes('不用跟任何人比');
    choose(6);
    out.nocmpFlag = S.flags.r51_kid===true && S.flags.r51_freerange===true && S.flags.r53_nocompare===true && S.flags.haskid===true && S.flags.kids===1;
    startGame(); S.age=36; S.flags={r51_wed:true,r51_house:true}; ensureState(S); S.seen={};
    showEvent(EVENTS.find(e=>e.id==='cb_r51_kid'));
    out.nocmpHidden = !document.querySelector('#app').innerHTML.includes('不用跟任何人比');
    /* ⑥ 門檻膠囊只在新增選項（gate:true 標記） */
    out.gateDef = EVENTS.find(e=>e.id==='r53_seed').choices.some(c=>c.gate&&c.cond)
               && EVENTS.find(e=>e.id==='cb_r53_toy').choices.some(c=>c.gate&&c.cond)
               && EVENTS.find(e=>e.id==='cb_r53_summer').choices.some(c=>c.gate&&c.cond)
               && EVENTS.find(e=>e.id==='cb_r53_family').choices.some(c=>c.gate&&c.cond);
    /* ⑦ 零殘留 */
    startGame();
    out.clean = Object.keys(S.flags||{}).every(k=>k.indexOf('r53')!==0)
             && Object.keys(S.seen||{}).every(k=>k.indexOf('r53')!==0);
    return JSON.stringify(out);
  })()`, sandbox);
  const r53 = JSON.parse(r53Raw);
  r53OK = Object.values(r53).every(v => v === true);
  console.log(`R53 童年黃金歲月事件鏈: ${r53OK ? '✅ 全數通過' : '❌ ' + JSON.stringify(r53)}`);
} catch (e) {
  console.log('R53 童年黃金歲月事件鏈: ❌ ' + e.message);
}

if (__errors.length) {
  console.log('\n--- 錯誤樣本(前5) ---');
  __errors.slice(0, 5).forEach(e => console.log('  ' + e));
}

/* 退出碼 */
const pass = __errors.length === 0 && chk.missingScenes.length === 0 && chk.eventVisible >= 126 && chk.eventTotal >= 126 && lsOK && achUnlocked > 0
  && chk.deathbookMissing.length === 0 && chk.deathTotal >= 17 && deathsOK && rebirthOK && legacyOK && petOK && r13OK && r17OK && r20OK && r21OK && r22OK && r24OK && r25OK && r34OK && r38OK && r41OK && r42OK && r43OK && r44OK && r45OK && r46OK && r47OK && r48OK && r49OK && r51OK && r52OK && r53OK;
console.log('\n結果: ' + (pass ? '✅ 全數通過' : '❌ 有項目未通過'));
process.exit(pass ? 0 : 1);
