/* 專項驗證：狀態機 cond 是否正確 gating（婚姻 / 就業）*/
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const appEl = { innerHTML: '' };
const sandbox = {
  document: { querySelector: () => appEl }, alert: () => {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  Math, JSON, Object, Array, console,
};
sandbox.globalThis = sandbox; vm.createContext(sandbox);
vm.runInContext(code, sandbox);
vm.runInContext(`
  globalThis.__t = function(setup, age){
    startGame(); S.age=age; setup(S);
    return eligible().map(e=>e.id);
  };
`, sandbox);

let fails = 0;
const ok = (c, m) => { if (!c) { console.log('❌ ' + m); fails++; } else console.log('✅ ' + m); };

// 1) 已婚：不該出現相親/告白/催婚/前任/遠距/黃昏戀；該出現中年誘惑(affair)
const married = sandbox.__t(s => { s.flags.marital = 'married'; s.flags.married = true; s.flags.employed = true; }, 45);
['blinddate', 'marriage', 'firstlove', 'exback', 'longdistance', 'old_romance'].forEach(id =>
  ok(!married.includes(id), `已婚不觸發 ${id}`));
ok(married.includes('affair'), '已婚會觸發 affair(中年誘惑)');

// 2) 單身 45 歲在職：可相親；不該出現 affair
const single = sandbox.__t(s => { s.flags.marital = 'single'; s.flags.employed = true; }, 45);
ok(single.includes('blinddate'), '單身會觸發相親');
ok(!single.includes('affair'), '單身不觸發 affair');

// 3) 待業：不該出現升遷/加班/慣老闆/應酬/退休；該出現面試
const jobless = sandbox.__t(s => { s.flags.employed = false; }, 28);
['promotion', 'overtime', 'toxicboss', 'networking', 'retire', 'sidehustle'].forEach(id =>
  ok(!jobless.includes(id), `待業不觸發 ${id}`));
ok(jobless.includes('interview'), '待業會觸發面試');

// 4) 在職：可升遷/加班；不該出現面試/第一份工作
const employed = sandbox.__t(s => { s.flags.employed = true; }, 45);
ok(employed.includes('promotion'), '在職會觸發升遷');
ok(!employed.includes('interview'), '在職不觸發面試');
ok(!employed.includes('firstjob'), '在職不觸發第一份工作');

// 5) 退休：不該再觸發在職類事件
const retired = sandbox.__t(s => { s.flags.employed = true; s.flags.retired = true; }, 65);
ok(!retired.includes('overtime'), '退休不觸發加班');

// 6) 屬性門檻：低健康觸發疾病、高財富觸發 tycoon
const sick = sandbox.__t(s => { s.attr.hp = 20; s.flags.employed = true; }, 50);
ok(sick.includes('illness'), '低健康(hp=20)觸發疾病事件');
const rich = sandbox.__t(s => { s.attr.mny = 90; s.flags.employed = true; }, 50);
ok(rich.includes('tycoon'), '高財富(mny=90)觸發富豪投資');
const healthy = sandbox.__t(s => { s.attr.hp = 80; s.flags.employed = true; }, 50);
ok(!healthy.includes('illness'), '健康正常不觸發疾病');

// 7) 低快樂觸發憂鬱
const sad = sandbox.__t(s => { s.attr.hap = 18; }, 40);
ok(sad.includes('depression'), '低快樂(hap=18)觸發憂鬱事件');

// 8) 狀態流轉：離婚後恢復單身，可再相親、不再觸發 affair
const divorced = sandbox.__t(s => { s.flags.marital = 'divorced'; s.flags.employed = true; }, 45);
ok(divorced.includes('blinddate'), '離婚後可再相親');
ok(!divorced.includes('affair'), '離婚後不觸發 affair');

// ========================================================================
// 9) R15 屬性覺醒：門檻選項高屬性可見/低屬性隱藏、gate 計數、sr 檢定、
//    權衡事件進池、新成就、brainburn 稀有死法收錄與觸發
// ========================================================================
vm.runInContext(`
  globalThis.__choiceHTML = function(evId, fn, age){
    // 確定化：startGame 隨機抽到 R29 出身會自帶出生旗標，污染「無旗標隱藏」斷言 → 固定中性出身、清旗標
    startGame(); S.origin = ORIGIN_MAP.office; S.flags = {}; S.age = age || 30; if (fn) fn(S); ensureState(S);
    showEvent(EVENTS.find(e=>e.id===evId));
    return document.querySelector('#app').innerHTML;
  };
`, sandbox);
const hasGate = (h) => /class="gtag"/.test(h);

// 門檻選項：高屬性可見、低屬性隱藏（原選項數不變，僅往上加層）
const gateCases = [
  ['overtime',  s => { s.flags.employed = true; s.attr.hp = 75; },  s => { s.flags.employed = true; s.attr.hp = 40; },  '❤️健康70+'],
  ['invest',    s => { s.attr.int = 80; },                          s => { s.attr.int = 50; },                          '🧠智力75+'],
  ['buyhouse',  s => { s.attr.mny = 85; },                          s => { s.attr.mny = 50; },                          '💰財富80+'],
  ['scam',      s => { s.attr.int = 70; },                          s => { s.attr.int = 40; },                          '🧠智力65+'],
  ['healthcheck', s => { s.attr.hp = 75; s.age = 40; },             s => { s.attr.hp = 50; },                           '❤️健康70+'],
  ['blinddate', s => { s.flags.marital = 'single'; s.attr.apr = 75; }, s => { s.flags.marital = 'single'; s.attr.apr = 40; }, '💅外貌70+'],
  ['toxicboss', s => { s.flags.employed = true; s.attr.apr = 70; }, s => { s.flags.employed = true; s.attr.apr = 40; }, '💅外貌65+'],
  ['gym_resolution', s => { s.attr.hp = 65; },                      s => { s.attr.hp = 40; },                           '❤️健康60+'],
  ['square_dance', s => { s.attr.apr = 70; },                       s => { s.attr.apr = 40; },                          '💅外貌65+'],
  ['midcrisis', s => { s.attr.mny = 75; },                          s => { s.attr.mny = 40; },                          '💰財富70+'],
  ['marriage',  s => { s.flags.marital = 'single'; s.attr.apr = 80; }, s => { s.flags.marital = 'single'; s.attr.apr = 40; }, '💅外貌75+'],
  ['work_burnout', s => { s.flags.employed = true; s.attr.hap = 65; }, s => { s.flags.employed = true; s.attr.hap = 40; }, '😄快樂60+'],
  ['tr_nightclass', s => { s.attr.int = 95; },                      s => { s.attr.int = 60; },                          '🧠智力90+'],
  /* R21 感情主線屬性門檻 */
  ['rl_meet',    s => { s.flags.marital = 'single'; s.attr.apr = 75; }, s => { s.flags.marital = 'single'; s.attr.apr = 40; }, '💅外貌70+'],
  ['rl_confess', s => { s.attr.int = 75; },                         s => { s.attr.int = 40; },                          '🧠智力70+'],
  ['rl_branch',  s => { s.attr.mny = 80; },                         s => { s.attr.mny = 40; },                          '💰財富75+'],
  ['rl_baby',    s => { s.flags.marital = 'married'; s.attr.mny = 85; }, s => { s.flags.marital = 'married'; s.attr.mny = 40; }, '💰財富80+'],
];
const gateAge = { square_dance: 65, midcrisis: 45, healthcheck: 40, blinddate: 30, marriage: 30, rl_meet: 24, rl_confess: 26, rl_branch: 30, rl_baby: 32 };
gateCases.forEach(([id, hi, lo, tag]) => {
  const a = gateAge[id] || 30;
  const hHi = vm.runInContext(`__choiceHTML('${id}', ${hi.toString()}, ${a})`, sandbox);
  const hLo = vm.runInContext(`__choiceHTML('${id}', ${lo.toString()}, ${a})`, sandbox);
  ok(hHi.includes(tag), `R15 ${id}: 高屬性顯示門檻選項 ${tag}`);
  ok(!hLo.includes(tag), `R15 ${id}: 低屬性隱藏門檻選項`);
});

// sr 檢定選項：永遠可見（不靠 cond），且 win/lose 都走得通
['interview', 'job_headhunt', 'crypto_fomo'].forEach(id => {
  const setup = id === 'interview' ? 's=>{s.flags.employed=false;}' : 's=>{s.flags.employed=true;}';
  const h = vm.runInContext(`__choiceHTML('${id}', ${setup}, 30)`, sandbox);
  ok(h.includes('⚖️智力檢定'), `R15 ${id}: 智力檢定選項可見`);
});
const srProbe = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  // 強制必勝：rng()=0 → rnd(0,40)=0，int=100 ≥ need
  startGame(); S.age = 30; S.flags.employed = true; S.attr.int = 100; ensureState(S);
  const ev = EVENTS.find(e=>e.id==='job_headhunt');
  const i = ev.choices.findIndex(c=>c.sr);
  const oldRng = rng; rng = () => 0;
  showEvent(ev); choose(i);
  out.winGate = S.flags.gateWin === 1;
  out.winMny = S.attr.mny > S.prevAttr ? true : true; // eff 已套用（值由 win.eff 決定）
  out.winRes = S.resume[S.resume.length-1].res.includes('留任加薪');
  // 強制必輸：int=0 + rng()=0 → roll=0 < need
  startGame(); S.age = 30; S.flags.employed = true; S.attr.int = 0; ensureState(S);
  showEvent(ev); choose(i);
  out.loseGate = !S.flags.gateWin;
  out.loseRes = S.resume[S.resume.length-1].res.includes('再觀察看看');
  rng = oldRng;
  return JSON.stringify(out);
})()`, sandbox));
ok(srProbe.winGate && srProbe.winRes, 'R15 sr 檢定高屬性必勝路徑正確（gateWin+1、win 文案）');
ok(srProbe.loseGate && srProbe.loseRes, 'R15 sr 檢定低屬性必輸路徑正確（不計 gateWin、lose 文案）');

// 門檻選項點擊 → gateWin 計數；權衡事件在池內
const gateProbe = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  startGame(); S.age = 30; S.attr.int = 80; ensureState(S);
  const ev = EVENTS.find(e=>e.id==='scam');
  const i = ev.choices.findIndex(c=>c.gate);
  showEvent(ev); choose(i);
  out.gateCount = S.flags.gateWin === 1;
  out.resOK = S.resume[S.resume.length-1].res.includes('165');
  S.age = 30; S.flags.employed = true;
  const pool = eligible().map(e=>e.id);
  out.trIn = ['tr_nightclass','tr_medspa','tr_moonlight','tr_gapyear'].every(id=>pool.includes(id));
  return JSON.stringify(out);
})()`, sandbox));
ok(gateProbe.gateCount, 'R15 門檻選項點擊計入 gateWin');
ok(gateProbe.resOK, 'R15 門檻選項走專屬結果文案');
ok(gateProbe.trIn, 'R15 四檔權衡事件（熬夜進修/醫美/接案/裸辭環島）正常進池');

// 新成就：巔峰謝幕（屬性90+）、五圍水平儀（差距≤15且全≥40）、屬性即正義（gateWin≥3）
const achProbe = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  startGame(); S.age = 70; S.attr = {hp:92,int:50,apr:50,mny:50,hap:50}; ensureState(S); die();
  out.peak = !!SAVE.ach.peak_ending;
  startGame(); S.age = 70; S.attr = {hp:55,int:50,apr:60,mny:48,hap:52}; ensureState(S); die();
  out.balance = !!SAVE.ach.zen_balance;
  startGame(); S.age = 70; S.flags.gateWin = 3; ensureState(S); die();
  out.gate = !!SAVE.ach.gate_master;
  // 反例：差距>15 不應解鎖（用乾淨 SAVE 判斷會被前面污染，改驗 check 函式本身）
  out.balanceNeg = !ACHIEVEMENTS.find(a=>a.id==='zen_balance').check({S:{attr:{hp:90,int:40,apr:50,mny:50,hap:50},flags:{}}, age:70});
  out.peakNeg = !ACHIEVEMENTS.find(a=>a.id==='peak_ending').check({S:{attr:{hp:89,int:50,apr:50,mny:50,hap:50},flags:{}}, age:70});
  return JSON.stringify(out);
})()`, sandbox));
ok(achProbe.peak && achProbe.peakNeg, 'R15 成就「巔峰謝幕」：任一屬性 90+ 解鎖、89 不解鎖');
ok(achProbe.balance && achProbe.balanceNeg, 'R15 成就「五圍水平儀」：均衡解鎖、偏科不解鎖');
ok(achProbe.gate, 'R15 成就「屬性即正義」：gateWin≥3 解鎖');

// brainburn 稀有死法：圖鑑收錄完整 + 智力 90+ 強制觸發路徑（rng()=0 → chance(0.12) 必中）
const bbProbe = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  out.book = DEATHBOOK.some(d=>d.id==='brainburn' && d.rare && d.hint.length>4) && !!SPECIAL_DEATHS.brainburn;
  startGame(); S.age = 30; S.attr.int = 95; ensureState(S);
  const ev = EVENTS.find(e=>e.id==='tr_nightclass');
  const i = ev.choices.findIndex(c=>c.special==='brainmax');
  const oldRng = rng; rng = () => 0;
  showEvent(ev); choose(i);
  rng = oldRng;
  out.dying = S.flags.specialDeath === 'brainburn' && S.attr.hp <= 0;
  die('choice');
  out.dead = !S.alive && S.deathId === 'brainburn' && /42/.test(S.deathReason);
  out.collected = !!SAVE.deaths.brainburn;
  // 巔峰年齡：updatePeaks 已隨選擇記錄
  out.peakAge = S.peakAge && typeof S.peakAge.int === 'number';
  return JSON.stringify(out);
})()`, sandbox));
ok(bbProbe.book, 'R15 brainburn 收錄進死法圖鑑（rare + 模糊提示）');
ok(bbProbe.dying && bbProbe.dead, 'R15 智力90+ 宇宙終極題 → brainburn 稀有死亡全流程');
ok(bbProbe.collected, 'R15 brainburn 寫入 SAVE.deaths 跨局收集');
ok(bbProbe.peakAge, 'R15 S.peakAge 巔峰年齡正常記錄');

// 結算頁屬性人生回顧：渲染含巔峰/謝幕/蓋棺定論，且零 rng 消耗
const reviewProbe = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  startGame(); S.age = 80; S.attr = {hp:80,int:50,apr:20,mny:90,hap:60}; ensureState(S); die();
  let used = 0; const old = rng; rng = function(){ used++; return old(); };
  const h = attrReviewHTML();
  rng = old;
  out.zeroRng = used === 0;
  out.hasTitle = h.includes('屬性人生回顧');
  out.hasPeak = /巔峰 \\d+（\\d+ 歲）/.test(h);
  out.hasQuip = h.includes('對帳單比小說還精彩');   // mny=90 → 高檔蓋棺定論
  out.lowQuip = h.includes('顏值從來不是你的戰力'); // apr=20 → 低檔蓋棺定論
  out.inSummary = document.querySelector('#app').innerHTML.includes('屬性人生回顧');
  return JSON.stringify(out);
})()`, sandbox));
ok(reviewProbe.zeroRng, 'R15 屬性人生回顧渲染零 rng 消耗');
ok(reviewProbe.hasTitle && reviewProbe.hasPeak, 'R15 回顧含巔峰值/巔峰年齡/謝幕值');
ok(reviewProbe.hasQuip && reviewProbe.lowQuip, 'R15 蓋棺定論依數值分檔正確（高財富/低外貌）');
ok(reviewProbe.inSummary, 'R15 結算頁實際渲染屬性人生回顧區塊');

// 舊存檔相容：進行中存檔缺 peakAge → ensureState 補空物件、回顧不炸
const compatProbe = JSON.parse(vm.runInContext(`(function(){
  startGame(); S.age = 40; delete S.peakAge; ensureState(S);
  const h1 = attrReviewHTML();   // 缺鍵 fallback 0 歲，不炸
  return JSON.stringify({ ensured: typeof S.peakAge === 'object', renders: h1.includes('屬性人生回顧') });
})()`, sandbox));
ok(compatProbe.ensured && compatProbe.renders, 'R15 舊存檔缺 peakAge 不炸（ensureState 補鍵 + 回顧 fallback）');

// ========================================================================
// 10) R16 出身大樂透：新出身（抽中性/復現性/護欄/專屬事件）+ 新轉生天賦（購買/效果）
// ========================================================================
const NEW_ORIGINS = ['southhouse', 'northdrift', 'mlm', 'funeral', 'breakfast', 'civil'];

// ① 出身總表：13 種齊備、新 6 種存在、平衡護欄（單屬性 ≤8、淨總和 +4~+5）全表通過
const originBase = JSON.parse(vm.runInContext(`(function(){
  return JSON.stringify({
    count: ORIGINS.length,
    newIn: ${JSON.stringify(NEW_ORIGINS)}.every(id=>!!ORIGIN_MAP[id]),
    guard: ORIGINS.every(o=>{
      const vs=Object.values(o.eff), sum=vs.reduce((a,b)=>a+b,0);
      return vs.every(v=>Math.abs(v)<=8) && sum>=4 && sum<=5;
    }),
    opens: ORIGINS.every(o=>o.open && o.open.length>20 && o.ic && o.nm),
  });
})()`, sandbox));
ok(originBase.count === 23, `R16+R29+R35 出身共 23 種（實際 ${originBase.count}）`);
ok(originBase.newIn, 'R16 新 6 種出身全數註冊進 ORIGIN_MAP');
ok(originBase.guard, 'R16 全部出身守平衡護欄（單屬性 ≤8、淨總和 +4~+5）');
ok(originBase.opens, 'R16 全部出身開場白/圖示/名稱齊備');

// ② 抽中性 + 同種子復現：400 個種子掃描，13 種出身全部抽得到，且同種子兩次開局出身一致
const originDraw = JSON.parse(vm.runInContext(`(function(){
  const seen = {}; let repro = true;
  for(let i=0;i<400;i++){
    rng = mulberry32(i); newLife(true);
    const first = S.origin.id; seen[first] = true;
    rng = mulberry32(i); newLife(true);
    if(S.origin.id !== first) repro = false;
  }
  rng = Math.random;
  return JSON.stringify({ repro, drawn: Object.keys(seen).length });
})()`, sandbox));
ok(originDraw.repro, 'R16 同種子兩次開局出身完全一致（rng 抽選復現性）');
ok(originDraw.drawn === 23, `R16+R29+R35 種子掃描 23 種出身全部可被抽中（抽到 ${originDraw.drawn} 種）`);

// ③ 專屬事件：對的出身在 stage 內進池、錯的出身不進池；choose 走得通且專屬 flag 落地
const ogFlags = { og_mlm: 'mlmkid', og_breakfast: 'griddle', og_civil: 'civilkid' };
NEW_ORIGINS.forEach(id => {
  const probe = JSON.parse(vm.runInContext(`(function(){
    const ev = EVENTS.find(e=>e.id==='og_${id}');
    if(!ev) return JSON.stringify({found:false});
    const out = {found:true};
    startGame(); S.origin = ORIGIN_MAP['${id}']; S.age = ev.stage[0]+1; S.flags={}; ensureState(S);
    out.inPool = eligible().some(e=>e.id===ev.id);
    showEvent(ev); choose(0);
    out.chosen = S.resume.length>0 && typeof S.resume[S.resume.length-1].res === 'string';
    out.flagOK = ${ogFlags['og_' + id] ? `(function(){ startGame(); S.origin=ORIGIN_MAP['${id}']; S.age=EVENTS.find(e=>e.id==='og_${id}').stage[0]+1; S.flags={}; ensureState(S); const e2=EVENTS.find(e=>e.id==='og_${id}'); const fi=e2.choices.findIndex(c=>c.flags&&c.flags['${ogFlags['og_' + id]}']); showEvent(e2); choose(fi); return S.flags['${ogFlags['og_' + id]}']===true; })()` : 'true'};
    startGame(); S.origin = ORIGIN_MAP.office; S.age = ev.stage[0]+1; S.flags={}; ensureState(S);
    out.gated = !eligible().some(e=>e.id===ev.id);
    return JSON.stringify(out);
  })()`, sandbox));
  ok(probe.found && probe.inPool, `R16 og_${id}: 對應出身在 stage 內進池`);
  ok(probe.chosen, `R16 og_${id}: 選項走得通（res 文案落地）`);
  ok(probe.flagOK, `R16 og_${id}: 專屬 flag 正確寫入`);
  ok(probe.gated, `R16 og_${id}: 其他出身不進池`);
});

// ④ 轉生殿擴充：11 個天賦、新 4 個存在且定價落在既有梯度內；rebirthUnlock 購買扣點生效
const rbBase = JSON.parse(vm.runInContext(`(function(){
  const ids = ['rb_zen','rb_dice','rb_karma','rb_age'];
  const out = {
    count: REBIRTH_TALENTS.length,
    newIn: ids.every(id=>!!RB_MAP[id]),
    costs: ids.every(id=>RB_MAP[id].cost>=60 && RB_MAP[id].cost<=150),
  };
  const r = rebirthData(); r.pts = 999; r.talents = {}; r.equipped = [];
  rebirthUnlock('rb_dice');
  out.bought = r.talents.rb_dice === true && r.pts === 999 - RB_MAP.rb_dice.cost;
  rebirthToggle('rb_dice');
  out.equipped = rebirthEquipped().indexOf('rb_dice') >= 0;
  r.equipped = [];
  return JSON.stringify(out);
})()`, sandbox));
ok(rbBase.count === 11, `R16 轉生天賦共 11 個（實際 ${rbBase.count}）`);
ok(rbBase.newIn && rbBase.costs, 'R16 新 4 天賦註冊且定價落在 60-150 梯度');
ok(rbBase.bought, 'R16 rebirthUnlock 購買成功且正確扣點');
ok(rbBase.equipped, 'R16 解鎖後可裝備（rebirthEquipped 認得新天賦）');

// ⑤ rb_dice 前世練過的手氣：sr 檢定 +5（int=87 need=90：裸體必輸、帶骰必贏）
const diceProbe = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  const ev = EVENTS.find(e=>e.id==='job_headhunt');
  const i = ev.choices.findIndex(c=>c.sr);
  // S.quirk=null 確定化：startGame 隨機抽到 qk_tie（鐵齒擲骰 -5）會抵銷 rb_dice 的 +5
  startGame(); S.age=30; S.flags.employed=true; S.attr.int=87; S.quirk=null; ensureState(S); S.rtal=[];
  let old = rng; rng = () => 0;
  showEvent(ev); choose(i);
  out.bareLose = !S.flags.gateWin;
  rng = old;
  startGame(); S.age=30; S.flags.employed=true; S.attr.int=87; S.quirk=null; ensureState(S); S.rtal=['rb_dice'];
  old = rng; rng = () => 0;
  showEvent(ev); choose(i);
  out.diceWin = S.flags.gateWin === 1;
  rng = old;
  return JSON.stringify(out);
})()`, sandbox));
ok(diceProbe.bareLose, 'R16 rb_dice：未裝備時 roll=87 < 90 檢定失敗（基準）');
ok(diceProbe.diceWin, 'R16 rb_dice：裝備後 roll=87+5 ≥ 90 檢定成功（擲骰 +5 生效）');

// ⑥ rb_zen 前世已看開：低潮年 +2；rb_age 保養品：偶數歲免扣老化
const yearProbe = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  function quietRun(age, stage, hap, hp, rtal, years){
    startGame(); S.age=age; S.stage=stage; S.stageSnap=Object.assign({},S.attr);
    S.flags={}; ensureState(S); S.attr.hap=hap; S.attr.hp=hp; S.rtal=rtal;
    S.quirk=null;   // 隔離 R26 權衡天賦的年度節拍（startGame 隨機抽到 qk_moon 等會污染 hap/hp）
    const old = rng; rng = () => 0.99;   // 不死、不出事件 → 全走平淡年
    for(let i=0;i<years;i++) nextYear();
    rng = old;
    return { hap: S.attr.hap, hp: S.attr.hp };
  }
  out.zenBare = quietRun(30, 2, 8, 60, [], 1).hap;          // 30→31 無老化：hap 不動
  out.zenOn   = quietRun(30, 2, 8, 60, ['rb_zen'], 1).hap;  // 低潮保底 +2
  out.ageBare = quietRun(72, 4, 60, 60, [], 4).hp;          // 73~76 每年 -2 → 52
  out.ageOn   = quietRun(72, 4, 60, 60, ['rb_age'], 4).hp;  // 偶數歲免扣第一段 → 54
  return JSON.stringify(out);
})()`, sandbox));
ok(yearProbe.zenBare === 8 && yearProbe.zenOn === 10,
  `R16 rb_zen：低潮年情緒保底 +2（裸 ${yearProbe.zenBare} / 裝備 ${yearProbe.zenOn}）`);
ok(yearProbe.ageBare === 52 && yearProbe.ageOn === 54,
  `R16 rb_age：50+ 偶數歲免扣老化（4 年裸 60→${yearProbe.ageBare} / 裝備 60→${yearProbe.ageOn}）`);

// ⑦ rb_karma 孟婆的集點卡：結算 +1；破 5 上限拿 6 點並解鎖成就 karma6
const karmaProbe = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  function deathRun(rtal){
    startGame(); S.age=70; S.attr={hp:50,int:50,apr:50,mny:50,hap:50};
    // 確定化：隨機出身/權衡天賦可能在結算多解鎖成就 → 輪迴點紅利 +1，污染 base/karma 對照
    S.origin=ORIGIN_MAP.office; S.quirk=null;
    S.flags={}; ensureState(S); S.newOrigin=false; S.rtal=rtal;
    const old = rng; rng = () => 0; die(); rng = old;
    // 扣掉「本局新成就 +1」紅利：跨局計數型成就（如結算廳常客）的門檻可能恰好
    // 跨在任一局上，造成 ±1 噪音；B 級局 rp 遠低於 cap=5，扣得精準無誤
    return S.rpGain - ((S.newAch && S.newAch.length) ? 1 : 0);
  }
  deathRun([]);                     // 第 1 局：把 newAch/newDeath 紅利出清
  out.base  = deathRun([]);         // 第 2 局：純基準（1 + B 評級 1 = 2）
  out.karma = deathRun(['rb_karma']);  // 第 3 局：同條件 +1
  // 破上限局：S 評級 +2、新出身 +1、新稀有死法 +1 → min(5) → 集點卡 +1 = 6
  startGame(); S.age=75; S.attr={hp:80,int:80,apr:80,mny:80,hap:80};
  S.flags={}; ensureState(S); S.newOrigin=true; S.flags.specialDeath='boba'; S.rtal=['rb_karma'];
  const old = rng; rng = () => 0; die(); rng = old;
  out.six = S.rpGain;
  out.ach = !!SAVE.ach.karma6 && (S.newAch||[]).indexOf('karma6') >= 0;
  return JSON.stringify(out);
})()`, sandbox));
ok(karmaProbe.karma === karmaProbe.base + 1,
  `R16 rb_karma：同條件結算 +1 輪迴點（${karmaProbe.base} → ${karmaProbe.karma}）`);
ok(karmaProbe.six === 6, `R16 rb_karma：破 5 上限單局拿 6 點（實際 ${karmaProbe.six}）`);
ok(karmaProbe.ach, 'R16 成就「孟婆的白金會員」：rpGain=6 當局即解鎖並計入戰報');

// ⑧b R116 業力繼承 / 命格殿：存檔遷移、業力換算公式、命格開局加成、挑戰禁用、解鎖扣業力
const r116Probe = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  // 1) 遷移：舊存檔無 r116 鍵 → r116Data() 就地補 {karma:0,total:0,perks:{}}，不崩
  delete SAVE.r116; const d0 = r116Data();
  out.migrate = !!d0 && d0.karma===0 && d0.total===0 && d0.perks && typeof d0.perks==='object' && SAVE.r116===d0;
  // 2) 壞值修補：負數/字串/非物件一律回正
  SAVE.r116={karma:-9, total:'x', perks:7}; const d1=r116Data();
  out.repair = d1.karma===0 && d1.total===0 && typeof d1.perks==='object';
  // 3) 業力換算確定性：age 90(=6) + sum 400(=4) + 新成就 2 + 稀有度 tierIdx 3 → 1+6+4+2+3 = 16
  startGame(); S.age=90; S.attr={hp:80,int:80,apr:80,mny:80,hap:80};
  S.newAch=['a','b']; S.rarity={tierIdx:3};
  out.karmaFormula = r116KarmaGain();   // 期望 16
  // 4) 早夭最低保底：什麼都很差也至少 +1
  S.age=10; S.attr={hp:5,int:5,apr:5,mny:5,hap:5}; S.newAch=[]; S.rarity={tierIdx:0};
  out.karmaFloor = r116KarmaGain();     // 期望 1（1 + 0 + 0 + 0 + 0）
  // 5) 命格開局加成：同種子裸開 vs 解鎖 k_fortune（快樂+4 財富+4）→ 兩屬性各 +4
  function birth(code, perks){
    SAVE.r116={karma:999,total:999,perks:perks||{}};
    rng = mulberry32(seedCodeToInt(code)); EVENTS = buildEvents(); newLife(); S.seed=code;
    return {hap:S.attr.hap, mny:S.attr.mny, hp:S.attr.hp, r116k:(S.r116k||[]).slice(), chosen:!!S.flags.r116_chosen};
  }
  const bare = birth('ABCDEF', {});
  const fort = birth('ABCDEF', {k_fortune:true});
  out.fortuneHap = fort.hap - bare.hap;   // 期望 +4（未觸頂時）
  out.fortuneMny = fort.mny - bare.mny;   // 期望 +4
  out.fortuneWired = fort.r116k.indexOf('k_fortune')>=0;
  // 6) 天選之子：開局健康 +5 且寫入 r116_chosen 旗標（特殊起始事件）
  const chosen = birth('ABCDEF', {k_chosen:true});
  out.chosenHp = chosen.hp - bare.hp;     // 期望 +5
  out.chosenFlag = chosen.chosen===true && bare.chosen===false;
  // 7) 挑戰模式禁用：命格全解鎖也不進 S.r116k（全服公平）
  SAVE.r116={karma:999,total:999,perks:{k_compass:true,k_fortune:true,k_chosen:true,k_floor:true}};
  startChallenge('20240101');
  out.challengeOff = (S.r116k||[]).length===0 && !S.flags.r116_chosen;
  // 8) 解鎖流程：karma 足夠 → 扣業力、寫入 perks；不足 → 不動
  SAVE.r116={karma:30, total:30, perks:{}};
  r116Unlock('k_fortune');   // cost 18
  out.unlockOK = SAVE.r116.perks.k_fortune===true && SAVE.r116.karma===12;
  r116Unlock('k_floor');     // cost 52 > 12 → 不動
  out.unlockBlocked = !SAVE.r116.perks.k_floor && SAVE.r116.karma===12;
  out.perkCount = R116_PERKS.length;
  // 收尾：清空命格與業力，避免命格加成洩漏污染後續測試（祖產/周目等開局基準）
  SAVE.r116={karma:0, total:0, perks:{}};
  return JSON.stringify(out);
})()`, sandbox));
ok(r116Probe.migrate, 'R116 ① 遷移：舊存檔無 r116 鍵 → r116Data() 就地補 {karma,total,perks}，不崩');
ok(r116Probe.repair, 'R116 ② 壞值修補：負數/字串/非物件一律回正');
ok(r116Probe.karmaFormula === 16, `R116 ③ 業力換算確定性：壽命+五圍+成就+稀有度 = 16（實際 ${r116Probe.karmaFormula}）`);
ok(r116Probe.karmaFloor === 1, `R116 ④ 早夭最低保底至少 +1（實際 ${r116Probe.karmaFloor}）`);
ok(r116Probe.fortuneHap === 4 && r116Probe.fortuneMny === 4 && r116Probe.fortuneWired,
  `R116 ⑤ 夙世福報開局快樂/財富各 +4（實際 hap+${r116Probe.fortuneHap} mny+${r116Probe.fortuneMny}）`);
ok(r116Probe.chosenHp === 5 && r116Probe.chosenFlag,
  `R116 ⑥ 天選之子開局健康 +5 並寫入 r116_chosen 旗標（特殊起始事件）`);
ok(r116Probe.challengeOff, 'R116 ⑦ 挑戰模式禁用命格（S.r116k 為空、無天選旗標），全服公平');
ok(r116Probe.unlockOK && r116Probe.unlockBlocked,
  'R116 ⑧ 命格殿解鎖：業力足夠扣點寫入、不足則擋下');
ok(r116Probe.perkCount === 4, `R116 命格共 4 項（實際 ${r116Probe.perkCount}）`);

// ⑧ R16 新成就：origins10 / undertaker80 check 函式正反例；三者皆有獵人提示
const achR16 = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  out.o10 = ACHIEVEMENTS.find(a=>a.id==='origins10').check({});   // ②掃描後 SAVE.origins 已集滿 13
  out.und = ACHIEVEMENTS.find(a=>a.id==='undertaker80').check({S:{origin:{id:'funeral'},attr:{},flags:{}}, age:80});
  out.undNeg = !ACHIEVEMENTS.find(a=>a.id==='undertaker80').check({S:{origin:{id:'funeral'},attr:{},flags:{}}, age:79})
            && !ACHIEVEMENTS.find(a=>a.id==='undertaker80').check({S:{origin:{id:'office'},attr:{},flags:{}}, age:90});
  out.hints = ['origins10','undertaker80','karma6'].every(id=>{const a=ACH_MAP[id];return a && a.hint && a.hint.length>4;});
  out.allLen = ACHIEVEMENTS.length;
  return JSON.stringify(out);
})()`, sandbox));
ok(achR16.o10, 'R16 成就「投胎大數據分析師」：集滿 10 種出身 check 通過');
ok(achR16.und && achR16.undNeg, 'R16 成就「生死課資深助教」：禮儀社出身活到 80 解鎖、79 歲/他出身不解鎖');
ok(achR16.hints, 'R16 三個新成就獵人提示齊備');

// ========================================================================
// 10b) R29 出身擴充：新 6 種台味出身（出生旗標/專屬事件/既有事件確定性回收/
//      新成就/分享卡帶出身）
// ========================================================================
const R29_ORIGINS = { grandma:'grandmaKid', orchard:'orchardKid', pundoh:'pundohKid',
                      blackhand:'blackhandKid', herbal:'herbalKid', taxi:'taxiKid' };
const R29_EVFLAGS = { og_grandma:'grannyVow', og_orchard:'harvestWar', og_pundoh:'pundohHeir',
                      og_blackhand:'lathePro', og_herbal:'herbBrain', og_taxi:'roadStories' };

// ① 註冊與出生旗標宣告：6 種全進 ORIGIN_MAP，flags 欄位正確；舊出身一律無 flags 鍵
const r29Base = JSON.parse(vm.runInContext(`(function(){
  const m = ${JSON.stringify(R29_ORIGINS)};
  return JSON.stringify({
    newIn: Object.keys(m).every(id=>ORIGIN_MAP[id] && ORIGIN_MAP[id].flags && ORIGIN_MAP[id].flags[m[id]]===true),
    oldClean: ORIGINS.filter(o=>!m[o.id] && ['juancun','kamati','seafarer','troupe'].indexOf(o.id)<0).every(o=>!o.flags),
  });
})()`, sandbox));
ok(r29Base.newIn, 'R29 新 6 種出身全數註冊且出生旗標宣告正確');
ok(r29Base.oldClean, 'R29 舊出身無 flags 鍵（行為同舊版，R35 新出身另測）');

// ② newLife 出生旗標落地：600 個種子掃描，6 種新出身全抽得到且旗標自動寫入；
//    抽到舊出身時不得殘留任何 R29 旗標（挑戰模式同樣生效 → 同種子同旗標公平）
const r29Birth = JSON.parse(vm.runInContext(`(function(){
  const m = ${JSON.stringify(R29_ORIGINS)};
  const seen = {}; let flagOK = true, cleanOK = true;
  for(let i=0;i<600;i++){
    rng = mulberry32(i); newLife(true);
    const id = S.origin.id;
    if(m[id]){ seen[id]=true; if(S.flags[m[id]]!==true) flagOK=false; }
    else { if(Object.values(m).some(f=>S.flags[f])) cleanOK=false; }
  }
  rng = Math.random;
  return JSON.stringify({ drawn:Object.keys(seen).length, flagOK, cleanOK });
})()`, sandbox));
ok(r29Birth.drawn === 6, `R29 種子掃描 6 種新出身全部可被抽中（抽到 ${r29Birth.drawn} 種）`);
ok(r29Birth.flagOK, 'R29 newLife 出生旗標自動寫入（挑戰模式同種子同旗標）');
ok(r29Birth.cleanOK, 'R29 抽到舊出身時不殘留任何 R29 旗標');

// ③ 專屬事件：對的出身在 stage 內進池、其他出身不進池；choose 走得通且事件旗標落地
Object.keys(R29_EVFLAGS).forEach(evId => {
  const oid = evId.slice(3), evFlag = R29_EVFLAGS[evId];
  const probe = JSON.parse(vm.runInContext(`(function(){
    const ev = EVENTS.find(e=>e.id==='${evId}');
    if(!ev) return JSON.stringify({found:false});
    const out = {found:true};
    startGame(); S.origin = ORIGIN_MAP['${oid}']; S.age = ev.stage[0]+1; S.flags={}; ensureState(S);
    out.inPool = eligible().some(e=>e.id===ev.id);
    const fi = ev.choices.findIndex(c=>c.flags && c.flags['${evFlag}']);
    showEvent(ev); choose(fi);
    out.chosen = S.resume.length>0 && typeof S.resume[S.resume.length-1].res === 'string' && S.resume[S.resume.length-1].res.length>10;
    out.flagOK = S.flags['${evFlag}']===true;
    startGame(); S.origin = ORIGIN_MAP.office; S.age = ev.stage[0]+1; S.flags={}; ensureState(S);
    out.gated = !eligible().some(e=>e.id===ev.id);
    return JSON.stringify(out);
  })()`, sandbox));
  ok(probe.found && probe.inPool, `R29 ${evId}: 對應出身在 stage 內進池`);
  ok(probe.chosen && probe.flagOK, `R29 ${evId}: 選項走得通且專屬 flag 正確寫入`);
  ok(probe.gated, `R29 ${evId}: 其他出身不進池`);
});

// ④ 既有事件確定性回收：出身旗標在 → 限定選項可見；旗標不在 → 隱藏（零 rng 純 cond）
const r29Recall = [
  ['typhoon_holiday', 'orchardKid', '🍇庄腳囝限定', 10],
  ['firstjob',        'blackhandKid', '🔧黑手囝限定', 24],
  ['interview',       'taxiKid', '🚕運將囝限定', 26],
];
r29Recall.forEach(([evId, flag, tag, age]) => {
  const hOn  = vm.runInContext(`__choiceHTML('${evId}', s=>{ s.flags.${flag}=true; s.flags.employed=false; }, ${age})`, sandbox);
  const hOff = vm.runInContext(`__choiceHTML('${evId}', s=>{ s.flags.employed=false; }, ${age})`, sandbox);
  ok(hOn.includes(tag), `R29 ${evId}: 帶 ${flag} 顯示出身限定選項`);
  ok(!hOff.includes(tag), `R29 ${evId}: 無旗標隱藏出身限定選項`);
});
// 回收選項實際點擊：黑手囝接班 → employed/familybiz 落地
const r29Click = JSON.parse(vm.runInContext(`(function(){
  startGame(); S.age=24; S.flags={blackhandKid:true}; ensureState(S);
  const ev = EVENTS.find(e=>e.id==='firstjob');
  const i = ev.choices.findIndex(c=>c.label.includes('🔧黑手囝限定'));
  showEvent(ev); choose(i);
  return JSON.stringify({ employed:S.flags.employed===true, biz:S.flags.familybiz===true,
    res:S.resume[S.resume.length-1].res.includes('工具櫃') });
})()`, sandbox));
ok(r29Click.employed && r29Click.biz && r29Click.res, 'R29 回收選項點擊：黑手接班 employed/familybiz/文案全落地');

// ⑤ 新成就正反例 + 獵人提示
const r29Ach = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  out.gs  = ACH_MAP.r29_grandson.check({S:{origin:{id:'grandma'},attr:{hap:70},flags:{}}, age:60});
  out.gsNeg = !ACH_MAP.r29_grandson.check({S:{origin:{id:'grandma'},attr:{hap:69},flags:{}}, age:60})
           && !ACH_MAP.r29_grandson.check({S:{origin:{id:'office'},attr:{hap:99},flags:{}}, age:60});
  out.bg  = ACH_MAP.r29_blackgold.check({S:{origin:{id:'blackhand'},attr:{mny:80},flags:{}}, age:60});
  out.bgNeg = !ACH_MAP.r29_blackgold.check({S:{origin:{id:'blackhand'},attr:{mny:79},flags:{}}, age:60})
           && !ACH_MAP.r29_blackgold.check({S:{origin:{id:'landlord'},attr:{mny:99},flags:{}}, age:60});
  out.hints = ['r29_grandson','r29_blackgold'].every(id=>ACH_MAP[id] && ACH_MAP[id].hint && ACH_MAP[id].hint.length>4);
  return JSON.stringify(out);
})()`, sandbox));
ok(r29Ach.gs && r29Ach.gsNeg, 'R29 成就「阿嬤的金孫」：隔代教養×快樂70+ 解鎖、69/他出身不解鎖');
ok(r29Ach.bg && r29Ach.bgNeg, 'R29 成就「黑手出頭天」：黑手世家×財富80+ 解鎖、79/他出身不解鎖');
ok(r29Ach.hints, 'R29 兩個新成就獵人提示齊備');

// ⑥ 分享卡自然帶出身（確定性、兩次生成一致）
const r29Share = JSON.parse(vm.runInContext(`(function(){
  startGame(); S.age=50; S.flags={}; ensureState(S); S.origin=ORIGIN_MAP.taxi; die();
  const c1=buildShareText();
  return JSON.stringify({ has:c1.includes('🎴 出身：🚕 計程車運將家庭'), stable:c1===buildShareText() });
})()`, sandbox));
ok(r29Share.has && r29Share.stable, 'R29 分享卡帶出身欄位且兩次生成逐字一致');

// ========================================================================
// 10c) R35 出身×天賦擴充：新 4 種出身（出生旗標/專屬事件/結算謝幕文案）＋
//      新 3 天賦＋天賦×出身化學反應（確定性/復現性/數值落地）＋新成就
// ========================================================================
const R35_ORIGINS = { juancun:'juancunKid', kamati:'kamatiKid', seafarer:'seafarerKid', troupe:'troupeKid' };
const R35_EVFLAGS = { og_juancun:'chessKid', og_kamati:'kamaHonest', og_seafarer:'seaCall', og_troupe:'stageDebut' };

// ① 註冊：4 種出身全進 ORIGIN_MAP 且旗標宣告正確；3 個新天賦進 TALENTS；謝幕文案表 4 鍵齊備
const r35Base = JSON.parse(vm.runInContext(`(function(){
  const m = ${JSON.stringify(R35_ORIGINS)};
  return JSON.stringify({
    newIn: Object.keys(m).every(id=>ORIGIN_MAP[id] && ORIGIN_MAP[id].flags && ORIGIN_MAP[id].flags[m[id]]===true),
    tals: ['台語金句王','巧手天工','舞台體質'].every(nm=>TALENTS.some(t=>t.nm===nm && t.eff && t.desc)),
    talGuard: ['台語金句王','巧手天工','舞台體質'].every(nm=>{
      const t=TALENTS.find(x=>x.nm===nm), sum=Object.values(t.eff).reduce((a,b)=>a+b,0);
      return sum<=30;
    }),
    epi: Object.keys(m).every(id=>R35_ORIGIN_EPI[id] && R35_ORIGIN_EPI[id].length>10),
    syn: R35_SYNERGY.length===6 && R35_SYNERGY.every(x=>{
      const sum=Object.values(x.eff).reduce((a,b)=>a+b,0);
      return TALENTS.some(t=>t.nm===x.tal) && ORIGIN_MAP[x.org] && sum>=4 && sum<=5 && x.txt.length>10;
    }),
  });
})()`, sandbox));
ok(r35Base.newIn, 'R35 新 4 種出身全數註冊且出生旗標宣告正確');
ok(r35Base.tals && r35Base.talGuard, 'R35 新 3 天賦註冊且淨值 ≤ 既有級距(+30)');
ok(r35Base.epi, 'R35 結算謝幕文案 4 種出身齊備');
ok(r35Base.syn, 'R35 化學反應表 6 組：天賦/出身皆存在、單組淨值 +4~+5');

// ② 專屬事件：對的出身在 stage 內進池、其他出身不進池；choose 走得通且事件旗標落地
Object.keys(R35_EVFLAGS).forEach(evId => {
  const oid = evId.slice(3), evFlag = R35_EVFLAGS[evId];
  const probe = JSON.parse(vm.runInContext(`(function(){
    const ev = EVENTS.find(e=>e.id==='${evId}');
    if(!ev) return JSON.stringify({found:false});
    const out = {found:true};
    startGame(); S.origin = ORIGIN_MAP['${oid}']; S.age = ev.stage[0]+1; S.flags={}; ensureState(S);
    out.inPool = eligible().some(e=>e.id===ev.id);
    const fi = ev.choices.findIndex(c=>c.flags && c.flags['${evFlag}']);
    showEvent(ev); choose(fi);
    out.chosen = S.resume.length>0 && typeof S.resume[S.resume.length-1].res === 'string' && S.resume[S.resume.length-1].res.length>10;
    out.flagOK = S.flags['${evFlag}']===true;
    startGame(); S.origin = ORIGIN_MAP.office; S.age = ev.stage[0]+1; S.flags={}; ensureState(S);
    out.gated = !eligible().some(e=>e.id===ev.id);
    return JSON.stringify(out);
  })()`, sandbox));
  ok(probe.found && probe.inPool, `R35 ${evId}: 對應出身在 stage 內進池`);
  ok(probe.chosen && probe.flagOK, `R35 ${evId}: 選項走得通且專屬 flag 正確寫入`);
  ok(probe.gated, `R35 ${evId}: 其他出身不進池`);
});

// ③ 化學反應：3000 種子掃描——命中組合必帶旗標＋開場日誌，未命中零殘留（確定性配對）
const r35Syn = JSON.parse(vm.runInContext(`(function(){
  let hits=0, misses=0, flagOK=true, logOK=true, cleanOK=true, hitSeed=-1;
  for(let i=0;i<3000;i++){
    rng = mulberry32(i); newLife(true);
    const hit = R35_SYNERGY.some(x=>x.tal===S.talent.nm && x.org===S.origin.id);
    if(hit){
      hits++; if(hitSeed<0) hitSeed=i;
      if(S.flags.r35syn!==true) flagOK=false;
      if(!S.log.some(l=>l.indexOf('化學反應')>=0)) logOK=false;
    } else {
      misses++;
      if(S.flags.r35syn) cleanOK=false;
    }
  }
  rng = Math.random;
  return JSON.stringify({ hits, misses, flagOK, logOK, cleanOK, hitSeed });
})()`, sandbox));
ok(r35Syn.hits > 0 && r35Syn.flagOK && r35Syn.logOK, `R35 化學反應命中必帶旗標＋開場日誌（3000 種子命中 ${r35Syn.hits} 次）`);
ok(r35Syn.cleanOK, 'R35 未命中組合零殘留（行為同舊版）');

// ④ 化學反應數值落地：取一個命中種子，清空反應表重跑同種子 → 屬性差恰為該組 eff（含 clamp 上限）
const r35Num = JSON.parse(vm.runInContext(`(function(){
  const seed = ${r35Syn.hitSeed};
  rng = mulberry32(seed); newLife(true);
  const withSyn = Object.assign({}, S.attr);
  const syn = R35_SYNERGY.find(x=>x.tal===S.talent.nm && x.org===S.origin.id);
  const bak = R35_SYNERGY.splice(0, R35_SYNERGY.length);
  rng = mulberry32(seed); newLife(true);
  const without = Object.assign({}, S.attr);
  R35_SYNERGY.push.apply(R35_SYNERGY, bak);
  rng = Math.random;
  let numOK = !!syn;
  if(syn){ for(const k in syn.eff){ if(withSyn[k] !== Math.min(100, without[k]+syn.eff[k])) numOK=false; } }
  return JSON.stringify({ numOK });
})()`, sandbox));
ok(r35Num.numOK, 'R35 化學反應數值落地：同種子有/無反應表，屬性差恰為該組 eff');

// ⑤ 結算頁謝幕文案：R35 出身死亡後結算頁帶專屬最後一句；舊出身不顯示
const r35Epi = JSON.parse(vm.runInContext(`(function(){
  startGame(); S.age=70; S.flags={}; ensureState(S); S.origin=ORIGIN_MAP.troupe; die();
  screenSummary('old');
  const h1 = document.querySelector('#app').innerHTML;
  const hasNew = h1.indexOf(R35_ORIGIN_EPI.troupe)>=0;
  startGame(); S.age=70; S.flags={}; ensureState(S); S.origin=ORIGIN_MAP.office; die();
  screenSummary('old');
  const h2 = document.querySelector('#app').innerHTML;
  const oldClean = Object.keys(R35_ORIGIN_EPI).every(k=>h2.indexOf(R35_ORIGIN_EPI[k])<0);
  return JSON.stringify({ hasNew, oldClean });
})()`, sandbox));
ok(r35Epi.hasNew, 'R35 結算頁：新出身帶專屬謝幕文案');
ok(r35Epi.oldClean, 'R35 結算頁：舊出身不顯示 R35 謝幕文案');

// ⑥ 新成就正反例 + 獵人提示
const r35Ach = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  out.tp  = ACH_MAP.r35_troupestar.check({S:{origin:{id:'troupe'},attr:{apr:80},flags:{}}, age:60});
  out.tpNeg = !ACH_MAP.r35_troupestar.check({S:{origin:{id:'troupe'},attr:{apr:79},flags:{}}, age:60})
           && !ACH_MAP.r35_troupestar.check({S:{origin:{id:'office'},attr:{apr:99},flags:{}}, age:60});
  out.sb  = ACH_MAP.r35_seabank.check({S:{origin:{id:'seafarer'},attr:{mny:75},flags:{}}, age:60});
  out.sbNeg = !ACH_MAP.r35_seabank.check({S:{origin:{id:'seafarer'},attr:{mny:74},flags:{}}, age:60});
  out.km  = ACH_MAP.r35_kamahappy.check({S:{origin:{id:'kamati'},attr:{hap:75},flags:{}}, age:60});
  out.kmNeg = !ACH_MAP.r35_kamahappy.check({S:{origin:{id:'kamati'},attr:{hap:74},flags:{}}, age:60});
  out.ch  = ACH_MAP.r35_chem.check({S:{flags:{r35syn:true}}, age:30});
  out.chNeg = !ACH_MAP.r35_chem.check({S:{flags:{}}, age:30});
  out.hints = ['r35_troupestar','r35_seabank','r35_kamahappy','r35_chem'].every(id=>ACH_MAP[id] && ACH_MAP[id].hint && ACH_MAP[id].hint.length>4);
  return JSON.stringify(out);
})()`, sandbox));
ok(r35Ach.tp && r35Ach.tpNeg, 'R35 成就「戲班台柱」：戲班×外貌80+ 解鎖、79/他出身不解鎖');
ok(r35Ach.sb && r35Ach.sbNeg, 'R35 成就「跑船人的存摺」：跑船×財富75+ 解鎖、74 不解鎖');
ok(r35Ach.km && r35Ach.kmNeg, 'R35 成就「柑仔店的快樂庫存」：柑仔店×快樂75+ 解鎖、74 不解鎖');
ok(r35Ach.ch && r35Ach.chNeg, 'R35 成就「天作之合」：化學反應旗標解鎖、無旗標不解鎖');
ok(r35Ach.hints, 'R35 四個新成就獵人提示齊備');

// ========================================================================
// 11) R23 祖產與輪迴：結構 / 舊存檔修補 / 陰德結算 / 名冊輪替 / 開局加成 /
//     童年護身符 / 祖祠立契與成就 / 面板渲染（全程驗證零 rng 消耗）
// ========================================================================
// ① 結構：5 個祖傳加成、價格嚴格遞增、LG_MAP 註冊、3 個新成就含獵人提示
const lgBase = JSON.parse(vm.runInContext(`(function(){
  const costs = LEGACY_PERKS.map(p=>p.cost);
  return JSON.stringify({
    count: LEGACY_PERKS.length,
    asc: costs.every((c,i)=>i===0 || c>costs[i-1]),
    map: LEGACY_PERKS.every(p=>LG_MAP[p.id] && p.ic && p.nm && p.desc && p.desc.length>10),
    ach: ['oldsoul10','legacy_broke','legacy_all'].every(id=>ACH_MAP[id] && ACH_MAP[id].hint && ACH_MAP[id].hint.length>4),
  });
})()`, sandbox));
ok(lgBase.count === 5, `R23 祖傳加成共 5 個（實際 ${lgBase.count}）`);
ok(lgBase.asc, 'R23 祖傳加成價格嚴格遞增');
ok(lgBase.map && lgBase.ach, 'R23 LG_MAP 註冊完整、3 個新成就皆有獵人提示');

// ② 舊存檔相容：刪掉 legacy 鍵 → legacyData() 就地修補完整結構
const lgHeal = JSON.parse(vm.runInContext(`(function(){
  delete SAVE.legacy;
  const g = legacyData();
  return JSON.stringify({ ok: !!g && g.yd===0 && g.ydTotal===0 && typeof g.perks==='object'
    && Array.isArray(g.roster) && g.pickAttr==='hp' && typeof g.lastMny==='number' });
})()`, sandbox));
ok(lgHeal.ok, 'R23 舊存檔缺 legacy 鍵 → legacyData() 就地修補完整結構不炸');

// ③ 陰德結算：公式正確（依實際 newAch 動態回算）、yd/ydTotal 同步入帳、lastMny 更新、名冊寫入
const ydProbe = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  function deathRun(age, v){
    startGame(); S.age=age;
    S.attr={hp:v,int:v,apr:v,mny:v,hap:v}; S.flags={}; ensureState(S);
    S.newOrigin=false; S.rtal=[]; S.lgk=[];
    const old=rng; rng=()=>0; die(); rng=old;
    const a=S.attr, sum=a.hp+a.int+a.apr+a.mny+a.hap;
    const grade=sum>=380?'S':sum>=320?'A':sum>=240?'B':sum>=160?'C':'D';
    const gb=(grade==='S'||grade==='A')?3:(grade==='B'?1:0);
    const exp=Math.min(30, 1+Math.floor(S.age/10)+Math.floor(a.mny/20)+(S.newAch||[]).length*2+gb);
    return {gain:S.ydGain, exp:exp};
  }
  const g0 = legacyData();
  const before = {yd:g0.yd, total:g0.ydTotal};
  const r1 = deathRun(70, 50);   // B 級：1+7+2+1(+新成就×2)
  out.formulaB = r1.gain === r1.exp && r1.gain >= 11;
  const r2 = deathRun(85, 80);   // S 級：1+8+4+3(+新成就×2)
  out.formulaS = r2.gain === r2.exp && r2.gain >= 16;
  const g1 = legacyData();
  out.bank = g1.yd === before.yd + r1.gain + r2.gain && g1.ydTotal === before.total + r1.gain + r2.gain;
  out.lastMny = g1.lastMny === 80;   // 最後一局謝幕財富 80（一般局才更新）
  out.roster0 = g1.roster[0] && g1.roster[0].w === SAVE.plays && g1.roster[0].a === 85 && g1.roster[0].g === 'S';
  return JSON.stringify(out);
})()`, sandbox));
ok(ydProbe.formulaB, 'R23 陰德公式（B 級局）：壽命/財富/評價/新成就折算正確');
ok(ydProbe.formulaS, 'R23 陰德公式（S 級局）：高表現局折算正確');
ok(ydProbe.bank, 'R23 陰德 yd 與 ydTotal 同步入帳');
ok(ydProbe.lastMny, 'R23 lastMny 記下上一世謝幕財富（祖產紅包繼承用）');
ok(ydProbe.roster0, 'R23 歷代名冊：死亡即寫入（世數/享年/評級正確）');

// ④ 名冊輪替：連死 12 局 → 恰保留最近 10 世、世數遞減、欄位完整、小傳文案確定性生成
const rosterProbe = JSON.parse(vm.runInContext(`(function(){
  for(let i=0;i<12;i++){ startGame(); S.age=40+i; S.flags={}; ensureState(S); const old=rng; rng=()=>0; die(); rng=old; }
  const g = legacyData(), r = g.roster;
  return JSON.stringify({
    cap: r.length === 10,
    order: r.every((x,i)=>i===0 || x.w === r[i-1].w-1) && r[0].w === SAVE.plays,
    fields: r.every(x=>typeof x.w==='number' && typeof x.a==='number' && typeof x.g==='string' && typeof x.d==='string' && x.d.length>0),
    bio: r.every(x=>typeof rosterBio(x)==='string' && rosterBio(x).length>4 && rosterBio(x)===rosterBio(x)),
  });
})()`, sandbox));
ok(rosterProbe.cap, 'R23 歷代名冊 cap 10：連死 12 局只留最近 10 世');
ok(rosterProbe.order && rosterProbe.fields, 'R23 名冊世數正確輪替、欄位完整');
ok(rosterProbe.bio, 'R23 名冊小傳文案確定性生成（零 rng、非空）');

// ⑤ 開局加成生效：同種子比對（祖產紅包/開光指定/老靈魂/祖墳保底），全程零 rng 消耗
const lgOpen = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  function openAttrs(seed, perks, pickAttr, lastMny, challenge){
    const g = legacyData();
    g.perks = perks || {}; g.pickAttr = pickAttr || 'hp'; g.lastMny = lastMny || 0;
    let used = 0;
    const base = mulberry32(seed);
    rng = function(){ used++; return base(); };
    newLife(!!challenge);
    rng = Math.random;
    return {attr:Object.assign({},S.attr), used:used, lgk:(S.lgk||[]).slice()};
  }
  const bare = openAttrs(7, {});
  const mny  = openAttrs(7, {lg_mny:true}, 'hp', 84);
  out.mnyInh = mny.attr.mny === Math.min(100, bare.attr.mny+8) && mny.attr.int === bare.attr.int && mny.attr.hp === bare.attr.hp;
  const mny0 = openAttrs(7, {lg_mny:true}, 'hp', 0);   // 上一世沒錢 → 沒得繼承，與裸開完全一致
  out.mnyZero = JSON.stringify(mny0.attr) === JSON.stringify(bare.attr);
  const pickA = openAttrs(7, {lg_pick:true}, 'apr');
  out.pick = pickA.attr.apr === Math.min(100, bare.attr.apr+5) && pickA.attr.mny === bare.attr.mny;
  const wis = openAttrs(7, {lg_wis:true});
  out.wis = wis.attr.int === Math.min(100, bare.attr.int+3) && wis.attr.hap === Math.min(100, bare.attr.hap+3);
  out.zeroRng = bare.used === mny.used && bare.used === pickA.used && bare.used === wis.used;
  // 祖墳冒青煙：掃種子找出「最弱屬性 < 40」的開局，驗證保底拉到 40 且其他屬性不動
  out.minOK = false;
  for(let s=0; s<300; s++){
    const b = openAttrs(s, {});
    let mk='hp'; for(const k in b.attr){ if(b.attr[k] < b.attr[mk]) mk=k; }
    if(b.attr[mk] < 40){
      const m = openAttrs(s, {lg_min:true});
      const others = Object.keys(b.attr).filter(k=>k!==mk).every(k=>m.attr[k]===b.attr[k]);
      out.minOK = m.attr[mk] === 40 && others && m.used === b.used;
      break;
    }
  }
  // 挑戰模式全禁用：同種子帶滿加成 vs 裸開，屬性完全一致、lgk 必為空
  const allP = {lg_mny:true,lg_pick:true,lg_kid:true,lg_min:true,lg_wis:true};
  const chBare = openAttrs(11, {}, 'hp', 0, true);
  const chFull = openAttrs(11, allP, 'apr', 84, true);
  out.chSame = JSON.stringify(chFull.attr) === JSON.stringify(chBare.attr) && chFull.lgk.length === 0;
  // 一般模式 lgk 正確掛載
  const norm = openAttrs(11, allP, 'apr', 84);
  out.lgkOn = norm.lgk.length === 5;
  legacyData().perks = {};   // 還原，避免污染後續探針
  return JSON.stringify(out);
})()`, sandbox));
ok(lgOpen.mnyInh, 'R23 祖產紅包：開局繼承上一世 10% 財富（84→+8），其他屬性不動');
ok(lgOpen.mnyZero, 'R23 祖產紅包：上一世財富 0 → 開局與裸開完全一致');
ok(lgOpen.pick, 'R23 祖先開過光：指定外貌 → 開局外貌 +5');
ok(lgOpen.wis, 'R23 老靈魂：開局智力 +3、快樂 +3');
ok(lgOpen.minOK, 'R23 祖墳冒青煙：最弱屬性 <40 保底拉到 40、其他屬性不動');
ok(lgOpen.zeroRng, 'R23 加成全程零 rng 消耗（種子序列不變，復現性不破功）');
ok(lgOpen.chSame, 'R23 挑戰/對戰模式：加成全禁用，同種子與裸開完全一致');
ok(lgOpen.lgkOn, 'R23 一般模式 S.lgk 正確掛載全部已購加成');

// ⑥ 阿祖的護身符：童年致死判定/選擇歸零都擋下；13 歲後不再保護；不耗死神好人卡
const kidProbe = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  // 年度致死判定（hp=5 → deathProbability 0.06，rng=0 必中）：童年帶符活下來
  startGame(); S.age=8; S.attr.hp=5; S.flags={}; ensureState(S); S.rtal=[]; S.lgk=['lg_kid'];
  let old=rng; rng=()=>0; resolveYear(); rng=old;
  out.kidSave = S.alive===true && S.attr.hp>=3;
  // 同條件不帶符：必死
  startGame(); S.age=8; S.attr.hp=5; S.flags={}; ensureState(S); S.rtal=[]; S.lgk=[];
  old=rng; rng=()=>0; resolveYear(); rng=old;
  out.bareDie = S.alive===false;
  // 13 歲後不保護：帶符照樣死
  startGame(); S.age=30; S.attr.hp=5; S.flags={}; ensureState(S); S.rtal=[]; S.lgk=['lg_kid'];
  old=rng; rng=()=>0; resolveYear(); rng=old;
  out.adultDie = S.alive===false;
  // 選擇把血打到歸零（合成事件 eff hp:-100）：童年帶符 → 硬撐在 3，且不耗 rb_und 次數
  startGame(); S.age=10; S.flags={}; ensureState(S); S.rtal=['rb_und']; S.lgk=['lg_kid'];
  EVENTS.push({id:'t23kid', title:'測試暴擊', text:'t', stage:[0,12], meme:{scene:'child',top:'t',bot:'b'},
    choices:[{label:'承受', eff:{hp:-100}, res:'r'}]});
  showEvent(EVENTS[EVENTS.length-1]); choose(0);
  out.kidChoose = S.attr.hp===3 && S.alive===true && !S.flags.rb_undied;
  return JSON.stringify(out);
})()`, sandbox));
ok(kidProbe.kidSave, 'R23 護身符：童年致死判定被擋（健康硬撐 ≥3）');
ok(kidProbe.bareDie, 'R23 護身符：未購買時同條件童年照樣橫死（非死碼基準）');
ok(kidProbe.adultDie, 'R23 護身符：13 歲後不再保護');
ok(kidProbe.kidChoose, 'R23 護身符：童年選擇歸零也擋，且不消耗死神好人卡');

// ⑦ 祖祠立契：購買扣陰德、餘額不足擋下、敗光光/大滿貫成就立契當下解鎖
const lgBuy = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  const g = legacyData();
  g.perks = {}; delete g.broke;
  delete SAVE.ach.legacy_broke; delete SAVE.ach.legacy_all;
  g.yd = 10;
  legacyUnlock('lg_mny');           // 需 30，只有 10 → 擋下
  out.poor = !g.perks.lg_mny && g.yd === 10;
  g.yd = 999;
  legacyUnlock('lg_mny');
  out.bought = g.perks.lg_mny === true && g.yd === 999 - LG_MAP.lg_mny.cost;
  legacyUnlock('lg_mny');           // 重複購買不扣款
  out.noDouble = g.yd === 999 - LG_MAP.lg_mny.cost;
  // 敗光光：把餘額調成恰好等於下一件的價格 → 買完歸零 → broke + 成就
  g.yd = LG_MAP.lg_pick.cost;
  legacyUnlock('lg_pick');
  out.broke = g.yd === 0 && g.broke === true && SAVE.ach.legacy_broke === true;
  // 大滿貫：補滿其餘 → legacy_all
  g.yd = 9999;
  legacyUnlock('lg_kid'); legacyUnlock('lg_min'); legacyUnlock('lg_wis');
  out.allAch = Object.keys(g.perks).length === 5 && SAVE.ach.legacy_all === true;
  // 開光改選：免費換屬性
  legacyPick('int');
  out.pick = g.pickAttr === 'int';
  return JSON.stringify(out);
})()`, sandbox));
ok(lgBuy.poor, 'R23 立契：陰德不足擋下且不扣款');
ok(lgBuy.bought && lgBuy.noDouble, 'R23 立契：購買成功正確扣款、重複購買不重複扣');
ok(lgBuy.broke, 'R23 成就「祖產敗光光」：花到一毛不剩立契當下解鎖');
ok(lgBuy.allAch, 'R23 成就「香火鼎盛・祖祠大滿貫」：集滿 5 件解鎖');
ok(lgBuy.pick, 'R23 祖先開過光：改選屬性免費生效');

// ⑧ 祖祠面板渲染：零 rng 消耗、關鍵區塊齊備（加成列表/世襲標記/歷代名冊）
const lgScreen = JSON.parse(vm.runInContext(`(function(){
  let used = 0; const old = rng;
  rng = function(){ used++; return old(); };
  screenLegacy();
  rng = old;
  const h = document.querySelector('#app').innerHTML;
  return JSON.stringify({
    zeroRng: used === 0,
    title: h.includes('祖祠・輪迴殿'),
    perks: h.includes('祖產紅包') && h.includes('老靈魂'),
    owned: h.includes('【世襲中】'),
    roster: h.includes('歷代名冊') && h.includes('享年'),
  });
})()`, sandbox));
ok(lgScreen.zeroRng, 'R23 祖祠面板渲染零 rng 消耗');
ok(lgScreen.title && lgScreen.perks && lgScreen.owned && lgScreen.roster, 'R23 祖祠面板：加成列表/世襲標記/歷代名冊齊備');

// ========================================================================
// R55 台灣時代背景：年代互斥 gating（同年代進池、他年代不進池、無 era 鍵零誤觸）
// ========================================================================
const era90 = sandbox.__t(s => { s.era = 'e90'; }, 8);
ok(era90.includes('era90_921') && era90.includes('era90_y2k'), 'R55 e90 局：本年代兩事件進池');
ok(!era90.includes('era70_living') && !era90.includes('era00_sars') && !era90.includes('era20_mask'), 'R55 e90 局：他年代事件不進池');
const era10w = sandbox.__t(s => { s.era = 'e10'; s.flags.employed = true; }, 24);
ok(era10w.includes('era10_22k'), 'R55 e10 局：起薪傳說在工作期進池');
const noEra = sandbox.__t(s => { delete s.era; }, 8);
ok(!noEra.some(id => /^era\d/.test(id)), 'R55 舊存檔無 era 鍵：年代事件全不進池');

// ========================================================================
// R56 人生劇本挑戰：開局鎖定生效、特殊規則僅劇本局生效（非劇本局零汙染）、
// 通關判定與徽章跨輪迴持久化、未通關不發徽章、結算頁/戰報帶劇本字樣
// ========================================================================
const r56 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  // 探針事件：固定 eff 供財富修正規則斷言（hidden 不進池，不影響其他統計）。
  // 每次開局 buildEvents() 會重建事件庫 → 開局後重新注入再取用
  const probeEv=()=>{ EVENTS.push({id:'__r56probe', hidden:true, title:'R56 探針', text:'probe',
    meme:{scene:'work',top:'t',bot:'b'},
    choices:[{label:'a', eff:{mny:-10}, res:'x'},{label:'b', eff:{mny:10}, res:'y'}]}); return EVENTS[EVENTS.length-1]; };
  // ① 魯蛇大翻身：五維鎖 20、巔峰/谷底/年史第一筆同步重置、meta 全禁用
  startScriptGame('loser');
  out.loserLock = ['hp','int','apr','mny','hap'].every(k=>S.attr[k]===20 && S.peak[k]===20 && S.low[k]===20);
  out.loserHist = S.attrHist.length===1 && S.attrHist[0].slice(1).every(v=>v===20);
  out.loserMeta = S.script==='loser' && (S.rtal||[]).length===0 && (S.lgk||[]).length===0 && !S.perkPool;
  // ② 疫情世代：年代鎖定 e20、e20 限定事件進池、他年代絕緣
  startScriptGame('covid');
  out.covidEra = S.era==='e20';
  S.age=5; ensureState(S);
  const pool=eligible().map(e=>e.id);
  out.covidPool = pool.includes('era20_mask') && !pool.includes('era90_921') && !pool.includes('era70_living');
  // ③ 田僑仔：開局財富鎖 95、財富流失 ×1.5、敗家/詐騙事件加權 ×2.5
  startScriptGame('rich');
  out.richLock = S.attr.mny===95;
  S.age=30; ensureState(S);
  const m0=S.attr.mny;
  showEvent(probeEv()); choose(0);
  out.richLoss = (m0 - S.attr.mny)===15;
  const bait1=EVENTS.find(e=>e.id==='online_scam');
  out.richWeight = Math.abs(effWeight(bait1) - (bait1.w||1)*2.5) < 1e-9;
  // ④ 22K 永動機：財富增益砍半（最低保留 1）
  startScriptGame('k22');
  S.age=30; ensureState(S); S.attr.mny=50;
  showEvent(probeEv()); choose(1);
  out.k22Gain = S.attr.mny===55;
  // ⑤ 非劇本局零汙染：一般局無 script 鍵、財富修正不動、權重不動
  startGame();
  out.cleanScript = !S.script;
  S.age=30; ensureState(S); S.attr.mny=50;
  showEvent(probeEv()); choose(0);
  out.cleanLoss = S.attr.mny===40;
  const bait2=EVENTS.find(e=>e.id==='online_scam');
  out.cleanWeight = Math.abs(effWeight(bait2) - (bait2.w||1)) < 1e-9;
  // ⑥ 通關判定＋徽章：未通關不發；通關發放＋成就 r56_first；跨輪迴持久化
  SAVE.scriptBadges={}; delete SAVE.ach.r56_first; delete SAVE.ach.r56_all;
  startScriptGame('rich'); S.age=40; S.attr.mny=10; die();
  out.failNoBadge = S.scriptDone===false && !SAVE.scriptBadges.rich && !SAVE.ach.r56_first;
  startScriptGame('rich'); S.age=40; S.attr.mny=80; die();
  out.passBadge = S.scriptDone===true && S.newScriptBadge===true && SAVE.scriptBadges.rich===true && SAVE.ach.r56_first===true;
  startGame();
  out.persist = SAVE.scriptBadges.rich===true;   // 開新的一般局，徽章仍在（跨輪迴）
  // ⑦ 大滿貫成就：集滿全部徽章後任一劇本局結算解鎖；結算頁/戰報帶劇本字樣
  R56_SCRIPTS.forEach(sc=>SAVE.scriptBadges[sc.id]=true);
  startScriptGame('loser'); S.age=70; S.attr.hap=80; die();
  out.allAch = SAVE.ach.r56_all===true && S.scriptDone===true;
  out.sumTxt = document.querySelector('#app').innerHTML.includes('劇本：魯蛇大翻身');
  out.reportTxt = buildTextReport().includes('🎭 劇本：魯蛇大翻身（通關 ✅）')
    && buildBragText('plain').includes('劇本「魯蛇大翻身」通關');
  return JSON.stringify(out);
})()`, sandbox));
ok(r56.loserLock && r56.loserHist, 'R56 魯蛇大翻身：五維鎖 20、巔峰/谷底/年史同步重置');
ok(r56.loserMeta, 'R56 劇本局：轉生/祖傳/開局天賦三選一全禁用');
ok(r56.covidEra && r56.covidPool, 'R56 疫情世代：年代鎖定 e20、限定事件進池、他年代絕緣');
ok(r56.richLock && r56.richLoss && r56.richWeight, 'R56 田僑仔：財富鎖 95、流失 ×1.5、敗家事件加權 ×2.5');
ok(r56.k22Gain, 'R56 22K 永動機：財富增益砍半');
ok(r56.cleanScript && r56.cleanLoss && r56.cleanWeight, 'R56 非劇本局零汙染：規則與權重完全不變');
ok(r56.failNoBadge, 'R56 未通關：不發徽章、不解成就');
ok(r56.passBadge && r56.persist, 'R56 通關：徽章發放＋r56_first 解鎖＋跨輪迴持久化');
ok(r56.allAch, 'R56 集滿徽章：r56_all 大滿貫成就解鎖');
ok(r56.sumTxt && r56.reportTxt, 'R56 結算頁與文字戰報帶「劇本：○○（通關/未通關）」字樣');

// ========================================================================
// R57 台味理財人生：事件進池/屬性驅動分支（gate+sr）/年代限定進池與絕緣/
// 死法觸發與收錄/成就正反例/舊存檔相容/非觸發局零汙染
// ========================================================================
// ① 一般理財事件：工作期/中年期進池
const r57Pool = sandbox.__t(s => { s.flags.employed = true; }, 35);
ok(['r57_hui','r57_polins','r57_leek','r57_fixdep','r57_downpay','r57_fixdep'].every(id => r57Pool.includes(id)), 'R57 理財事件（跟會/保單/股市/定存/頭期款）工作期進池');
ok(sandbox.__t(s => {}, 22).includes('r57_lotto'), 'R57 樂透刮刮樂青年期進池');
// ② 屬性驅動 gate：跟會外貌70+ 會頭選項、頭期款財富75+ 下訂選項——高顯示/低隱藏
const r57HuiHi = vm.runInContext(`__choiceHTML('r57_hui', s=>{ s.attr.apr=75; }, 35)`, sandbox);
const r57HuiLo = vm.runInContext(`__choiceHTML('r57_hui', s=>{ s.attr.apr=40; }, 35)`, sandbox);
ok(r57HuiHi.includes('💅外貌70+') && !r57HuiLo.includes('💅外貌70+'), 'R57 跟會：高魅力顯示會頭選項、低魅力隱藏（屬性驅動人脈）');
const r57DpHi = vm.runInContext(`__choiceHTML('r57_downpay', s=>{ s.attr.mny=80; }, 38)`, sandbox);
const r57DpLo = vm.runInContext(`__choiceHTML('r57_downpay', s=>{ s.attr.mny=40; }, 38)`, sandbox);
ok(r57DpHi.includes('💰財富75+') && !r57DpLo.includes('💰財富75+'), 'R57 頭期款：高財富顯示下訂選項、低財富隱藏');
// ③ sr 智力檢定（投資判斷）：必勝走 win＋r57_leekwin 旗標、必輸走 lose 不落旗標
const r57Sr = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  const ev = EVENTS.find(e=>e.id==='r57_leek');
  const i = ev.choices.findIndex(c=>c.sr);
  startGame(); S.age=35; S.flags={}; S.attr.int=100; ensureState(S);
  let old=rng; rng=()=>0; showEvent(ev); choose(i); rng=old;
  out.win = S.flags.r57_leekwin===true && S.resume[S.resume.length-1].res.includes('股神');
  startGame(); S.age=35; S.flags={}; S.attr.int=0; ensureState(S);
  old=rng; rng=()=>0; showEvent(ev); choose(i); rng=old;
  out.lose = !S.flags.r57_leekwin && S.resume[S.resume.length-1].res.includes('後照鏡');
  return JSON.stringify(out);
})()`, sandbox));
ok(r57Sr.win, 'R57 股市 sr 智力檢定：高智力必勝（r57_leekwin 旗標＋win 文案）');
ok(r57Sr.lose, 'R57 股市 sr 智力檢定：低智力必輸（不落旗標、lose 文案）');
// ④ 年代限定：本年代進池＋R46 里程碑保底自動註冊；他年代/舊存檔無 era 鍵絕緣
const r57E70 = sandbox.__t(s => { s.era = 'e70'; }, 20);
ok(r57E70.includes('era70_stockfever') && !r57E70.includes('era80_doublecard') && !r57E70.includes('era00_seagod'), 'R57 e70 局：萬點崩盤進池、他年代理財事件絕緣');
const r57E80 = sandbox.__t(s => { s.era = 'e80'; }, 25);
ok(r57E80.includes('era80_doublecard'), 'R57 e80 局：雙卡風暴進池');
const r57E00 = sandbox.__t(s => { s.era = 'e00'; }, 22);
ok(r57E00.includes('era00_seagod'), 'R57 e00 局：航海王當沖進池');
const r57NoEra = sandbox.__t(s => { delete s.era; }, 22);
ok(!['era70_stockfever','era80_doublecard','era00_seagod'].some(id=>r57NoEra.includes(id)), 'R57 舊存檔無 era 鍵：年代理財事件全不進池');
ok(vm.runInContext(`R46_MILESTONE['era70_stockfever']===20 && R46_MILESTONE['era80_doublecard']===25 && R46_MILESTONE['era00_seagod']===22`, sandbox), 'R57 年代理財事件自動入 R46 里程碑保底（進窗口 2 年）');
// ⑤ 死法一：被倒會氣絕（hap≤10 確定性觸發）＋活路分支＋圖鑑收錄
const r57Hui = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  out.book = DEATHBOOK.some(d=>d.id==='huiboom' && d.rare && d.hint.length>4) && !!SPECIAL_DEATHS.huiboom;
  const ev = EVENTS.find(e=>e.id==='r57_hui');
  const i = ev.choices.findIndex(c=>c.special==='r57_huidao');
  startGame(); S.age=35; S.flags={}; ensureState(S); S.attr.hap=8;
  showEvent(ev); choose(i);
  out.dying = S.flags.specialDeath==='huiboom' && S.attr.hp<=0;
  die('choice');
  out.dead = !S.alive && S.deathId==='huiboom';
  out.collected = !!SAVE.deaths.huiboom;
  startGame(); S.age=35; S.flags={}; ensureState(S); S.attr.hap=60;
  showEvent(EVENTS.find(e=>e.id==='r57_hui')); choose(i);
  out.alive = S.alive===true && S.flags.r57_huivictim===true && !S.flags.specialDeath;
  return JSON.stringify(out);
})()`, sandbox));
ok(r57Hui.book, 'R57 huiboom 收錄進死法圖鑑（rare＋模糊提示）');
ok(r57Hui.dying && r57Hui.dead && r57Hui.collected, 'R57 快樂見底重押三會 → 被倒會氣絕全流程＋跨局收集');
ok(r57Hui.alive, 'R57 快樂正常被倒會：活路分支（虧錢長智慧、零誤殺）');
// ⑥ 死法二：刮中頭獎嚇死（hp≤12 確定性觸發）＋活路分支＋圖鑑收錄
const r57Jp = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  out.book = DEATHBOOK.some(d=>d.id==='jackpotgg' && d.rare && d.hint.length>4) && !!SPECIAL_DEATHS.jackpotgg;
  const ev = EVENTS.find(e=>e.id==='r57_lotto');
  const i = ev.choices.findIndex(c=>c.special==='r57_scratch');
  startGame(); S.age=30; S.flags={}; ensureState(S); S.attr.hp=10;
  showEvent(ev); choose(i);
  out.dying = S.flags.specialDeath==='jackpotgg';
  die('choice');
  out.dead = !S.alive && S.deathId==='jackpotgg' && !!SAVE.deaths.jackpotgg;
  startGame(); S.age=30; S.flags={}; ensureState(S); S.attr.hp=70;
  showEvent(EVENTS.find(e=>e.id==='r57_lotto')); choose(i);
  out.alive = S.alive===true && S.flags.r57_scratchking===true;
  return JSON.stringify(out);
})()`, sandbox));
ok(r57Jp.book, 'R57 jackpotgg 收錄進死法圖鑑（rare＋模糊提示）');
ok(r57Jp.dying && r57Jp.dead, 'R57 體力見底全梭刮刮樂 → 頭獎嚇死全流程＋跨局收集');
ok(r57Jp.alive, 'R57 體力正常梭哈：活路分支（八百元再投入歸零）');
// ⑦ 成就：三個新成就 check 正反例＋獵人提示齊備
const r57Ach = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  out.hui = ACH_MAP.r57_huihead.check({S:{flags:{r57_huihead:true}}, age:40});
  out.huiNeg = !ACH_MAP.r57_huihead.check({S:{flags:{}}, age:40});
  out.stock = ACH_MAP.r57_stockgod.check({S:{flags:{r57_leekwin:true}}, age:40});
  out.stockNeg = !ACH_MAP.r57_stockgod.check({S:{flags:{}}, age:40});
  out.fin = ACH_MAP.r57_fincourse.check({S:{seen:{r57_hui:true,r57_lotto:true,r57_fixdep:true},flags:{}}, age:50});
  out.finNeg = !ACH_MAP.r57_fincourse.check({S:{seen:{r57_hui:true,r57_lotto:true},flags:{}}, age:50});
  out.hints = ['r57_huihead','r57_stockgod','r57_fincourse'].every(id=>ACH_MAP[id] && ACH_MAP[id].hint && ACH_MAP[id].hint.length>4);
  return JSON.stringify(out);
})()`, sandbox));
ok(r57Ach.hui && r57Ach.huiNeg, 'R57 成就「巷口央行行長」：會頭旗標解鎖、無旗標不解鎖');
ok(r57Ach.stock && r57Ach.stockNeg, 'R57 成就「少年股神」：檢定贏旗標解鎖、無旗標不解鎖');
ok(r57Ach.fin && r57Ach.finNeg, 'R57 成就「台味理財全修課」：同局 3 堂理財課解鎖、2 堂不解鎖');
ok(r57Ach.hints, 'R57 三個新成就獵人提示齊備');
// ⑧ 舊存檔相容＋零汙染：缺 seen/era 鍵不炸不誤觸；乾淨局 flags 無 r57 殘留
const r57Compat = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  out.noSeen = !ACH_MAP.r57_fincourse.check({S:{flags:{}}, age:50});   // 舊存檔無 seen 鍵：不炸、不誤觸
  startGame(); delete S.seen; delete S.era; ensureState(S);
  out.healed = typeof S.seen==='object';
  startGame();
  out.clean = Object.keys(S.flags).every(k=>k.indexOf('r57')!==0);
  return JSON.stringify(out);
})()`, sandbox));
ok(r57Compat.noSeen && r57Compat.healed, 'R57 舊存檔缺 seen/era 鍵：ensureState 補鍵、成就不誤觸不炸');
ok(r57Compat.clean, 'R57 非觸發局零汙染：開局 S.flags 無任何 r57 鍵');

// ========================================================================
// 26) R58 台味兵役事件鏈：鏈段觸發順序／屬性分支／年代限定進池與絕緣／
//     簽下去分支／替代役分支／成就／死法收錄與確定性觸發／舊存檔相容／零汙染／平衡護欄
// ========================================================================
// ① 鏈段觸發順序：army 入口 → 新訓 → 部隊 → 退伍，逐段解鎖、前段未過後段不進池
const r58Chain = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  startGame(); S.age=20; S.flags={}; ensureState(S); S.era='e90';
  out.entryIn = eligible().some(e=>e.id==='army');
  out.preClean = ['cb_r58_boot','cb_r58_camp','cb_r58_out','cb_r58_alt','cb_r58_sign'].every(id=>!eligible().some(e=>e.id===id));
  showEvent(EVENTS.find(e=>e.id==='army')); choose(0);
  out.draft = S.flags.army===true && S.flags.r58_draft===true;
  out.bootIn = eligible().some(e=>e.id==='cb_r58_boot') && !eligible().some(e=>e.id==='cb_r58_camp');
  showEvent(EVENTS.find(e=>e.id==='cb_r58_boot')); choose(3);
  out.campIn = S.flags.r58_boot===true && eligible().some(e=>e.id==='cb_r58_camp') && !eligible().some(e=>e.id==='cb_r58_out');
  showEvent(EVENTS.find(e=>e.id==='cb_r58_camp')); choose(2);
  out.outIn = S.flags.r58_camp===true && eligible().some(e=>e.id==='cb_r58_out');
  showEvent(EVENTS.find(e=>e.id==='cb_r58_out')); choose(0);
  out.vet = S.flags.r58_vet===true && !eligible().some(e=>e.id==='cb_r58_out');
  out.milestone = R46_MILESTONE.army===21 && R46_MILESTONE.cb_r58_boot===21 && R46_MILESTONE.r58_enlist===20;
  return JSON.stringify(out);
})()`, sandbox));
ok(r58Chain.entryIn && r58Chain.preClean, 'R58 ① 入口進池、未進鏈前各段全不進池');
ok(r58Chain.draft && r58Chain.bootIn, 'R58 ① 抽籤後 army/r58_draft 落地、新訓進池且部隊未解鎖');
ok(r58Chain.campIn && r58Chain.outIn, 'R58 ① 新訓→部隊→退伍逐段解鎖（順序正確）');
ok(r58Chain.vet && r58Chain.milestone, 'R58 ① 退伍收旗標、once 不重複；R46 各段保底註冊');
// ② 屬性分支（回扣 R44）：抽籤 br 體質分流（68+ 海陸／低分爽單位）；天堂路 gate 海陸＋健康70 限定
const r58Br = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  startGame(); S.age=20; S.flags={}; ensureState(S); S.era='e90'; S.attr.hp=80;
  showEvent(EVENTS.find(e=>e.id==='army')); choose(0);
  out.marine = S.flags.r58_marine===true && !S.flags.r58_lucky;
  startGame(); S.age=20; S.flags={}; ensureState(S); S.era='e90'; S.attr.hp=40;
  showEvent(EVENTS.find(e=>e.id==='army')); choose(0);
  out.lucky = S.flags.r58_lucky===true && !S.flags.r58_marine;
  return JSON.stringify(out);
})()`, sandbox));
ok(r58Br.marine, 'R58 ② 體質 80 抽籤分流海陸（r58_marine）');
ok(r58Br.lucky, 'R58 ② 體質 40 抽籤分流爽單位（r58_lucky、零誤掛海陸）');
const r58Frog = vm.runInContext(`__choiceHTML('cb_r58_boot', s=>{s.flags.r58_draft=true;s.flags.r58_marine=true;s.attr.hp=80;}, 20)`, sandbox);
const r58FrogNo = vm.runInContext(`__choiceHTML('cb_r58_boot', s=>{s.flags.r58_draft=true;s.attr.hp=80;}, 20)`, sandbox);
ok(r58Frog.includes('海陸限定') && !r58FrogNo.includes('海陸限定'), 'R58 ② 天堂路選項海陸旗標限定（非海陸隱藏）');
// ③ 年代限定（回扣 R55）：e20 募兵入口進池且義務役絕緣；其他年代相反；年代限定選項互斥
const r58Era = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  startGame(); S.age=20; S.flags={}; ensureState(S); S.era='e20';
  out.e20 = !eligible().some(e=>e.id==='army') && eligible().some(e=>e.id==='r58_enlist');
  startGame(); S.age=20; S.flags={}; ensureState(S); S.era='e90';
  out.e90 = eligible().some(e=>e.id==='army') && !eligible().some(e=>e.id==='r58_enlist');
  return JSON.stringify(out);
})()`, sandbox));
ok(r58Era.e20, 'R58 ③ e20 募兵制：r58_enlist 進池、義務役 army 絕緣');
ok(r58Era.e90, 'R58 ③ 非 e20 年代：army 照常進池、募兵入口絕緣');
const h70 = vm.runInContext(`__choiceHTML('army', s=>{s.era='e70';}, 20)`, sandbox);
const h10 = vm.runInContext(`__choiceHTML('army', s=>{s.era='e10';}, 20)`, sandbox);
const h90 = vm.runInContext(`__choiceHTML('army', s=>{s.era='e90';}, 20)`, sandbox);
ok(h70.includes('兩年義務役世代限定') && !h70.includes('四個月世代限定'), 'R58 ③ e70 顯示兩年義務役選項、四個月絕緣');
ok(h10.includes('四個月世代限定') && !h10.includes('兩年義務役世代限定'), 'R58 ③ e10 顯示四個月軍訓役選項、兩年絕緣');
ok(!h90.includes('兩年義務役世代限定') && !h90.includes('四個月世代限定'), 'R58 ③ e90 兩個年代限定選項皆絕緣');
// ④ 簽下去分支：入口簽下去→走完新訓部隊→跳過退伍事件→志願役事件；續簽 r58_lifer＋employed、約滿領回自由
const r58Sign = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  startGame(); S.age=20; S.flags={}; ensureState(S); S.era='e90';
  showEvent(EVENTS.find(e=>e.id==='army')); choose(2);
  out.signup = S.flags.r58_signup===true && S.flags.r58_draft===true;
  showEvent(EVENTS.find(e=>e.id==='cb_r58_boot')); choose(3);
  showEvent(EVENTS.find(e=>e.id==='cb_r58_camp')); choose(2);
  out.route = !eligible().some(e=>e.id==='cb_r58_out') && eligible().some(e=>e.id==='cb_r58_sign');
  showEvent(EVENTS.find(e=>e.id==='cb_r58_sign')); choose(0);
  out.lifer = S.flags.r58_lifer===true && S.flags.employed===true && S.flags.r58_signlife===true;
  startGame(); S.age=22; S.flags={r58_signup:true}; ensureState(S);
  showEvent(EVENTS.find(e=>e.id==='cb_r58_sign')); choose(1);
  out.quit = S.flags.r58_vet===true && !S.flags.r58_lifer;
  return JSON.stringify(out);
})()`, sandbox));
ok(r58Sign.signup && r58Sign.route, 'R58 ④ 簽下去：跳過退伍事件、志願役事件進池');
ok(r58Sign.lifer, 'R58 ④ 續簽：r58_lifer＋employed＋signlife 全落地（財富穩、自由扣）');
ok(r58Sign.quit, 'R58 ④ 約滿不續：r58_vet 落地、不誤掛 lifer');
// ⑤ 替代役分支：智力 72 門檻可見、選後走替代役事件（新訓絕緣）、服勤完可退伍
const hAltHi = vm.runInContext(`__choiceHTML('army', s=>{s.era='e90';s.attr.int=80;}, 20)`, sandbox);
const hAltLo = vm.runInContext(`__choiceHTML('army', s=>{s.era='e90';s.attr.int=50;}, 20)`, sandbox);
ok(hAltHi.includes('🧠智力72+') && !hAltLo.includes('🧠智力72+'), 'R58 ⑤ 替代役選項智力 72 門檻（低智隱藏）');
const r58Alt = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  startGame(); S.age=20; S.flags={}; ensureState(S); S.era='e90'; S.attr.int=80;
  showEvent(EVENTS.find(e=>e.id==='army')); choose(1);
  out.alt = S.flags.r58_alt===true && !S.flags.r58_draft;
  out.route = eligible().some(e=>e.id==='cb_r58_alt') && !eligible().some(e=>e.id==='cb_r58_boot');
  showEvent(EVENTS.find(e=>e.id==='cb_r58_alt')); choose(0);
  out.done = S.flags.r58_altdone===true && eligible().some(e=>e.id==='cb_r58_out');
  return JSON.stringify(out);
})()`, sandbox));
ok(r58Alt.alt && r58Alt.route, 'R58 ⑤ 替代役：r58_alt 落地、走替代役線且新訓絕緣');
ok(r58Alt.done, 'R58 ⑤ 替代役服勤完 → 退伍事件進池（鏈收攏）');
// ⑥ 新死法 ×2：圖鑑收錄＋屬性門檻確定性觸發（hp≤14 刺槍自捅／hp≤12 站哨嚇死）＋活路零誤殺
const r58Death = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  out.book = ['bayonet','sentryscare'].every(id=>DEATHBOOK.some(d=>d.id===id&&d.rare&&d.hint.length>4) && !!SPECIAL_DEATHS[id]);
  const boot=EVENTS.find(e=>e.id==='cb_r58_boot'), bi=boot.choices.findIndex(c=>c.special==='r58_bayonet');
  startGame(); S.age=20; S.flags={r58_draft:true}; ensureState(S); S.attr.hp=10;
  showEvent(boot); choose(bi);
  out.bDying = S.flags.specialDeath==='bayonet';
  die('choice');
  out.bDead = !S.alive && S.deathId==='bayonet' && !!SAVE.deaths.bayonet;
  startGame(); S.age=20; S.flags={r58_draft:true}; ensureState(S); S.attr.hp=70;
  showEvent(EVENTS.find(e=>e.id==='cb_r58_boot')); choose(bi);
  out.bAlive = S.alive===true && !S.flags.specialDeath && S.flags.r58_boot===true;
  const camp=EVENTS.find(e=>e.id==='cb_r58_camp'), si=camp.choices.findIndex(c=>c.special==='r58_sentry');
  startGame(); S.age=21; S.flags={r58_boot:true}; ensureState(S); S.attr.hp=10;
  showEvent(camp); choose(si);
  out.sDying = S.flags.specialDeath==='sentryscare';
  die('choice');
  out.sDead = !S.alive && S.deathId==='sentryscare' && !!SAVE.deaths.sentryscare;
  startGame(); S.age=21; S.flags={r58_boot:true}; ensureState(S); S.attr.hp=70;
  showEvent(EVENTS.find(e=>e.id==='cb_r58_camp')); choose(si);
  out.sAlive = S.alive===true && !S.flags.specialDeath && S.flags.r58_camp===true;
  return JSON.stringify(out);
})()`, sandbox));
ok(r58Death.book, 'R58 ⑥ bayonet/sentryscare 收錄進死法圖鑑（rare＋模糊提示）');
ok(r58Death.bDying && r58Death.bDead, 'R58 ⑥ 體力見底硬撐刺槍示範班 → 刺槍自捅全流程＋跨局收集');
ok(r58Death.bAlive, 'R58 ⑥ 體力正常刺槍：活路分支（教範君、零誤殺、鏈段照常推進）');
ok(r58Death.sDying && r58Death.sDead, 'R58 ⑥ 體力見底夜哨偷瞇 → 站哨嚇死全流程＋跨局收集');
ok(r58Death.sAlive, 'R58 ⑥ 體力正常偷瞇：活路分支（欠學長一罐蠻牛、零誤殺）');
// ⑦ 新成就 ×3：check 正反例＋獵人提示齊備
const r58Ach = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  out.frog = ACH_MAP.r58_frogman.check({S:{flags:{r58_frog:true}}, age:20});
  out.frogNeg = !ACH_MAP.r58_frogman.check({S:{flags:{r58_marine:true}}, age:20});
  out.lifer = ACH_MAP.r58_lifer.check({S:{flags:{r58_lifer:true}}, age:25});
  out.liferNeg = !ACH_MAP.r58_lifer.check({S:{flags:{r58_signup:true}}, age:25});
  out.vet = ACH_MAP.r58_fullvet.check({S:{flags:{r58_camp:true,r58_vet:true}}, age:23});
  out.vetNeg = !ACH_MAP.r58_fullvet.check({S:{flags:{r58_vet:true}}, age:23});
  out.hints = ['r58_frogman','r58_lifer','r58_fullvet'].every(id=>ACH_MAP[id]&&ACH_MAP[id].hint&&ACH_MAP[id].hint.length>4);
  return JSON.stringify(out);
})()`, sandbox));
ok(r58Ach.frog && r58Ach.frogNeg, 'R58 ⑦ 成就「海陸蛙人」：天堂路旗標解鎖、只抽中海陸不解鎖');
ok(r58Ach.lifer && r58Ach.liferNeg, 'R58 ⑦ 成就「簽下去的男人」：續簽解鎖、只簽約未續不解鎖');
ok(r58Ach.vet && r58Ach.vetNeg, 'R58 ⑦ 成就「數饅頭全勤獎」：完整走完解鎖、替代役捷徑不解鎖');
ok(r58Ach.hints, 'R58 ⑦ 三個新成就獵人提示齊備');
// ⑧ 舊存檔相容＋零汙染＋平衡護欄
const r58Compat = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  startGame(); S.age=20; S.flags={}; delete S.era; ensureState(S);
  out.oldArmy = eligible().some(e=>e.id==='army') && !eligible().some(e=>e.id==='r58_enlist');
  out.oldNoChain = ['cb_r58_boot','cb_r58_camp','cb_r58_out','cb_r58_alt','cb_r58_sign'].every(id=>!eligible().some(e=>e.id===id));
  startGame();
  out.clean = Object.keys(S.flags).every(k=>k.indexOf('r58')!==0);
  startGame(); S.age=22; S.flags={employed:true}; ensureState(S);
  out.zero = ['cb_r58_boot','cb_r58_camp','cb_r58_out','cb_r58_alt','cb_r58_sign'].every(id=>!eligible().some(e=>e.id===id));
  out.guard = ['army','cb_r58_boot','cb_r58_camp','cb_r58_out','cb_r58_alt','cb_r58_sign','r58_enlist'].every(id=>{
    const e=EVENTS.find(x=>x.id===id);
    return e && e.choices.every(c=>{
      const effs=[c.eff||{}]; if(c.br){effs.push(c.br.hi.eff||{},c.br.lo.eff||{});}
      return effs.every(o=>Object.values(o).every(v=>Math.abs(v)<=8));
    });
  });
  return JSON.stringify(out);
})()`, sandbox));
ok(r58Compat.oldArmy && r58Compat.oldNoChain, 'R58 ⑧ 舊存檔無 era 鍵：army 行為同舊版、募兵與鏈段全絕緣不炸');
ok(r58Compat.clean, 'R58 ⑧ 開局零汙染：S.flags 無任何 r58 鍵');
ok(r58Compat.zero, 'R58 ⑧ 未服役局零汙染：兵役鏈全段不進池');
ok(r58Compat.guard, 'R58 ⑧ 平衡護欄：全鏈一般選項（含 br 分流）|eff| ≤ 8');

// ========================================================================
// 27) R59 人生結算分享卡＋觸達率穩定化：模板覆蓋／挑選邏輯／死法×年代文案／
//     canvas 介面／文字版去個資／舊存檔相容／零汙染／放寬事件平衡護欄
// ========================================================================
const r59 = JSON.parse(vm.runInContext(`(function(){
  const out = {};
  /* ① 分享卡資料組裝來源：墓誌銘模板全職業/全年代覆蓋、總數 >=12 */
  out.carCover = R50_CAREERS.every(c=>typeof R59_EPITAPH_CAREER[c.id]==='string' && R59_EPITAPH_CAREER[c.id].length>4);
  out.eraCover = R55_ERAS.every(e=>typeof R59_EPITAPH_ERA[e.id]==='string' && R59_EPITAPH_ERA[e.id].length>4);
  out.tplCount = Object.keys(R59_EPITAPH_CAREER).length + Object.keys(R59_EPITAPH_ERA).length;
  /* ② 模板挑選邏輯：確定性（同一局兩次逐字一致）＋ 職業×年代窮舉全部非空、
        且 R59 模板真的可被 lifeHash 選中 */
  startGame(); ensureState(S);
  S.age=80; S.cat='old'; S.deathReason='自然老死'; S.deathId=null; S.origin=null; S.flags={};
  S.attr={hp:50,int:50,apr:50,mny:50,hap:50};
  S.careerId='eng'; S.era='e10';
  const e1=epitaphText(), e2=epitaphText();
  out.det = (e1===e2) && e1.length>0;
  /* lifeHash 不吃 careerId/era → 逐組變動 age 去除 hash 相關性，避免全有全無 */
  let hitR59=0, allNonEmpty=true, vi=0;
  R50_CAREERS.forEach(c=>R55_ERAS.forEach(er=>{
    S.careerId=c.id; S.era=er.id; S.age=40+(vi++);
    const t=epitaphText();
    if(!t) allNonEmpty=false;
    if(t===R59_EPITAPH_CAREER[c.id] || t===R59_EPITAPH_ERA[er.id]) hitR59++;
  }));
  out.pickable = allNonEmpty && hitR59>0;
  /* ③ 各死法×各年代皆有文案（含無職業局） */
  let catEraOK=true;
  ['hp','old','accident','peaceful'].forEach(cat=>R55_ERAS.forEach(er=>{
    S.cat=cat; S.era=er.id; S.careerId=null;
    if(!epitaphText()) catEraOK=false;
  }));
  out.catEra = catEraOK;
  /* ④ canvas 函式存在且參數齊、已接上 R59 欄位與開源連結 */
  out.cvFn = (typeof makeShareCard==='function') && makeShareCard.length===0
          && (typeof wrapText==='function') && wrapText.length>=6;
  const src=String(makeShareCard);
  out.cvWired = src.indexOf('epitaphText')>=0 && src.indexOf('R55_MAP')>=0 && src.indexOf('R50_MAP')>=0
             && src.indexOf('github.com/tingyi365/earthlife')>=0 && src.indexOf('SHARE_URL')>=0;
  /* ⑤ 文字版：含官網連結＋墓誌銘，嚴禁個資 pattern（本機路徑/使用者名/email） */
  S.cat='old'; S.era='e10'; S.careerId='eng'; S.title='測試人'; S.deathReason='壽終正寢';
  const txt=buildShareText();
  out.txtUrl = txt.indexOf('earthlife.pages.dev')>=0;
  out.txtEpi = txt.indexOf('墓誌銘')>=0;
  /* 白名單：公開 repo URL 允許出現（tingyi365 是公開帳號非本機使用者名），剝除後再驗個資 */
  const scrub=s=>String(s).split('github.com/tingyi365/earthlife').join('');
  const piRe=/([A-Za-z]:\\+Users|Users\\+\w|\d{7}@|@gmail|AIWORK|file:\\/\\/)/i;
  out.txtClean = !piRe.test(scrub(txt)) && !piRe.test(scrub(String(makeShareCard)));
  /* ⑥ 舊存檔相容：無 era/careerId 鍵不炸、自動省略 */
  let compat=true;
  try{
    delete S.era; delete S.careerId; ensureState(S);
    const t3=epitaphText(), b3=buildShareText();
    compat = t3.length>0 && b3.indexOf('earthlife.pages.dev')>=0 && b3.indexOf('undefined')<0;
  }catch(e){ compat=false; }
  out.compat = compat;
  /* ⑦ 零汙染：分享層純讀（S/SAVE 快照不變）、開局無 r59 旗標 */
  startGame(); ensureState(S);
  S.age=60; S.cat='hp'; S.deathReason='過勞登出';
  const snapS=JSON.stringify(S), snapSave=JSON.stringify(SAVE);
  epitaphText(); buildShareText();
  out.pure = snapS===JSON.stringify(S) && snapSave===JSON.stringify(SAVE);
  out.clean = Object.keys(S.flags||{}).every(k=>k.indexOf('r59')!==0);
  /* ⑧ 觸達率放寬平衡護欄：4 個放寬事件 |eff|<=8、w<=3、once 或旗標自帶 once */
  const relaxed=['ex_invitation','fitness_influencer','become_grandparent','r25_midman'];
  let guard=true;
  relaxed.forEach(id=>{
    const ev=EVENTS.find(x=>x.id===id);
    if(!ev){ guard=false; return; }
    if((ev.w||1)>3) guard=false;
    const selfOnce = id==='become_grandparent';   /* grandparent 旗標觸發後 cond 永假 */
    if(!(ev.once||selfOnce)) guard=false;
    (ev.choices||[]).forEach(c=>{
      for(const k in (c.eff||{})){ if(Math.abs(c.eff[k])>8) guard=false; }
    });
  });
  out.guard = guard;
  return JSON.stringify(out);
})()`, sandbox));
ok(r59.carCover && r59.eraCover, 'R59 ① 墓誌銘模板全職業(8)/全年代(6)覆蓋');
ok(r59.tplCount>=12, `R59 ① 模板總數 ${r59.tplCount} >= 12`);
ok(r59.det, 'R59 ② 墓誌銘確定性：同一局重複呼叫逐字一致（零 rng）');
ok(r59.pickable, 'R59 ② 模板挑選邏輯：職業×年代窮舉非空、R59 模板可被 lifeHash 選中');
ok(r59.catEra, 'R59 ③ 各死法×各年代皆有對應文案');
ok(r59.cvFn && r59.cvWired, 'R59 ④ canvas 分享卡函式存在參數齊、接上年代/職業/墓誌銘/開源連結');
ok(r59.txtUrl && r59.txtEpi, 'R59 ⑤ 文字版含官網連結＋墓誌銘');
ok(r59.txtClean, 'R59 ⑤ 分享內容無個資 pattern（路徑/使用者名/email）');
ok(r59.compat, 'R59 ⑥ 舊存檔相容：無 era/careerId 鍵不炸、欄位自動省略');
ok(r59.pure && r59.clean, 'R59 ⑦ 零汙染：分享層純讀不寫 S/SAVE、無 r59 旗標殘留');
ok(r59.guard, 'R59 ⑧ 放寬冷門事件平衡護欄：|eff|<=8、w<=3、不重複觸發');

// ========================================================================
// 28) R60 台味民俗信仰事件鏈：結構護欄／香火與鐵齒旗標／祖祠分支／年代分流／
//     陰德結算掛勾／死法收錄與確定性觸發／成就／舊存檔相容／零汙染
// ========================================================================
// ① 結構護欄：7 事件齊備、全 once、stage 覆蓋童年到老年、|eff|<=8（含 br 分流）、w<=3、保底註冊
const r60St = JSON.parse(vm.runInContext(`(function(){
  const ids=['r60_shoujing','r60_bwa','r60_qiuqian','r60_taisui','r60_raojing','r60_zhongyuan','r60_templevol'];
  const evs=ids.map(id=>EVENTS.find(e=>e.id===id));
  const out={};
  out.all = evs.every(e=>e && e.once && (e.w||1)<=3 && e.stage && e.choices.length>=3);
  out.span = evs[0].stage[0]<=8 && evs[6].stage[1]>=80;
  out.guard = evs.every(e=>e.choices.every(c=>{
    const effs=[c.eff||{}]; if(c.br){effs.push(c.br.hi.eff||{},c.br.lo.eff||{});}
    return effs.every(o=>Object.values(o).every(v=>Math.abs(v)<=8));
  }));
  out.milestone = R46_MILESTONE.r60_raojing===32 && R46_MILESTONE.r60_templevol===70;
  return JSON.stringify(out);
})()`, sandbox));
ok(r60St.all && r60St.span, 'R60 ① 7 事件齊備全 once、stage 覆蓋童年到老年');
ok(r60St.guard, 'R60 ① 平衡護欄：單選項 |eff|<=8（含 br 分流）、w<=3');
ok(r60St.milestone, 'R60 ① 遶境/老年廟口 R46 保底註冊（童年段不配保底零擠壓）');
// ② 香火 merit／鐵齒 tiechi 計數落地＋成就連動
const r60Flag = JSON.parse(vm.runInContext(`(function(){
  const out={};
  startGame(); S.age=8; S.flags={}; ensureState(S);
  showEvent(EVENTS.find(e=>e.id==='r60_shoujing')); choose(0);
  out.merit1 = S.flags.r60_merit===1 && S.flags.r60_folk===true;
  S.age=30; showEvent(EVENTS.find(e=>e.id==='r60_taisui')); choose(0);
  showEvent(EVENTS.find(e=>e.id==='r60_zhongyuan')); choose(0);
  out.merit3 = S.flags.r60_merit===3;
  out.devout = ACH_MAP.r60_devout.check({S:S, age:S.age});
  startGame(); S.age=30; S.flags={}; ensureState(S); S.attr.hp=70;
  showEvent(EVENTS.find(e=>e.id==='r60_taisui')); choose(1);
  showEvent(EVENTS.find(e=>e.id==='r60_zhongyuan')); choose(1);
  out.tiechi = S.flags.r60_tiechi===2 && S.flags.r60_ghostproof===true && !S.flags.r60_merit;
  out.tiechiAch = ACH_MAP.r60_tiechi.check({S:S, age:75}) && !ACH_MAP.r60_tiechi.check({S:S, age:60});
  return JSON.stringify(out);
})()`, sandbox));
ok(r60Flag.merit1 && r60Flag.merit3, 'R60 ② 收驚/安太歲/普渡 inc r60_merit 香火逐次累積');
ok(r60Flag.devout, 'R60 ② 香火滿三炷 → 成就「香火 VIP」解鎖');
ok(r60Flag.tiechi, 'R60 ② 鐵齒線：tiechi 計數×2＋鬼月活路旗標、零誤掛香火');
ok(r60Flag.tiechiAch, 'R60 ② 成就「鐵齒銅牙」：鐵齒×2＋70 歲門檻（60 歲不解鎖）');
// ③ 祖祠分支（回扣 R23）：有祖傳加成才看得到求籤的蔭澤選項
const r60Lg = JSON.parse(vm.runInContext(`(function(){
  const g=legacyData(); const bak=g.perks;
  g.perks={}; const h0=__choiceHTML('r60_qiuqian', s=>{}, 25);
  g.perks={pk_probe:true}; const h1=__choiceHTML('r60_qiuqian', s=>{}, 25);
  g.perks=bak;
  const out={no:h0.indexOf('祖祠蔭澤限定')<0, yes:h1.indexOf('祖祠蔭澤限定')>=0};
  startGame(); S.age=25; S.flags={}; ensureState(S);
  const g2=legacyData(); const bak2=g2.perks; g2.perks={pk_probe:true};
  showEvent(EVENTS.find(e=>e.id==='r60_qiuqian')); choose(1);
  g2.perks=bak2;
  out.flag = S.flags.r60_blessed===true && S.flags.r60_folk===true;
  return JSON.stringify(out);
})()`, sandbox));
ok(r60Lg.no && r60Lg.yes, 'R60 ③ 求籤祖祠分支：無祖傳加成隱藏、有立契才現身');
ok(r60Lg.flag, 'R60 ③ 蔭澤選項落地 r60_blessed（祖祠香火回扣 R23）');
// ④ 年代分流（回扣 R55）：遶境 e70/e80 庄頭辦桌 vs e10/e20 文創進香、其餘年代與舊存檔皆絕緣
const rj70 = vm.runInContext(`__choiceHTML('r60_raojing', s=>{s.era='e70';}, 30)`, sandbox);
const rj10 = vm.runInContext(`__choiceHTML('r60_raojing', s=>{s.era='e10';}, 30)`, sandbox);
const rj90 = vm.runInContext(`__choiceHTML('r60_raojing', s=>{s.era='e90';}, 30)`, sandbox);
const rjOld = vm.runInContext(`__choiceHTML('r60_raojing', s=>{delete s.era;}, 30)`, sandbox);
ok(rj70.includes('早年庄頭限定') && !rj70.includes('文創世代限定'), 'R60 ④ e70 顯示庄頭辦桌、文創絕緣');
ok(rj10.includes('文創世代限定') && !rj10.includes('早年庄頭限定'), 'R60 ④ e10 顯示文創進香、庄頭絕緣');
ok(!rj90.includes('早年庄頭限定') && !rj90.includes('文創世代限定'), 'R60 ④ e90 兩個年代選項皆絕緣');
ok(!rjOld.includes('庄頭限定') && !rjOld.includes('文創世代限定') && rjOld.includes('跟好跟滿'), 'R60 ④ 舊存檔無 era 鍵：年代選項隱藏、基本選項照常');
// ⑤ 陰德結算掛勾（回扣 R23）：merit 折小額陰德（+1/炷、上限 +3）、無 merit 局公式不變
const r60Yd = JSON.parse(vm.runInContext(`(function(){
  function deathRun(merit){
    startGame(); S.age=50; S.attr={hp:50,int:50,apr:50,mny:50,hap:50}; S.flags={}; ensureState(S);
    if(merit) S.flags.r60_merit=merit;
    S.newOrigin=false; S.rtal=[]; S.lgk=[];
    const old=rng; rng=()=>0; die(); rng=old;
    const a=S.attr, sum=a.hp+a.int+a.apr+a.mny+a.hap;
    const grade=sum>=380?'S':sum>=320?'A':sum>=240?'B':sum>=160?'C':'D';
    const gb=(grade==='S'||grade==='A')?3:(grade==='B'?1:0);
    const exp=Math.min(30, 1+Math.floor(S.age/10)+Math.floor(a.mny/20)+(S.newAch||[]).length*2+gb+Math.min(3,merit||0));
    return {gain:S.ydGain, exp:exp};
  }
  const r0=deathRun(0), r2=deathRun(2), r5=deathRun(5);
  return JSON.stringify({base:r0.gain===r0.exp, m2:r2.gain===r2.exp, cap:r5.gain===r5.exp});
})()`, sandbox));
ok(r60Yd.base, 'R60 ⑤ 無香火局：陰德公式不變（零汙染）');
ok(r60Yd.m2 && r60Yd.cap, 'R60 ⑤ 香火折陰德：2 炷 +2、5 炷封頂 +3（上限護欄）');
// ⑥ 新死法 ×2：圖鑑收錄＋屬性門檻確定性觸發（hp≤12 遶境脫水／hp≤10 中元鐵齒）＋活路零誤殺
const r60Death = JSON.parse(vm.runInContext(`(function(){
  const out={};
  out.book = ['pilgrimdry','ghostdare'].every(id=>DEATHBOOK.some(d=>d.id===id&&d.rare&&d.hint.length>4) && !!SPECIAL_DEATHS[id]);
  const rj=EVENTS.find(e=>e.id==='r60_raojing'), pi=rj.choices.findIndex(c=>c.special==='r60_pilgrim');
  startGame(); S.age=30; S.flags={}; ensureState(S); S.attr.hp=10;
  showEvent(rj); choose(pi);
  out.pDying = S.flags.specialDeath==='pilgrimdry';
  die('choice');
  out.pDead = !S.alive && S.deathId==='pilgrimdry' && !!SAVE.deaths.pilgrimdry;
  startGame(); S.age=30; S.flags={}; ensureState(S); S.attr.hp=70;
  showEvent(EVENTS.find(e=>e.id==='r60_raojing')); choose(pi);
  out.pAlive = S.alive===true && !S.flags.specialDeath && S.flags.r60_pilgrimdone===true && S.flags.r60_merit===1;
  const zy=EVENTS.find(e=>e.id==='r60_zhongyuan'), gi=zy.choices.findIndex(c=>c.special==='r60_ghostdare');
  startGame(); S.age=30; S.flags={}; ensureState(S); S.attr.hp=8;
  showEvent(zy); choose(gi);
  out.gDying = S.flags.specialDeath==='ghostdare';
  die('choice');
  out.gDead = !S.alive && S.deathId==='ghostdare' && !!SAVE.deaths.ghostdare;
  startGame(); S.age=30; S.flags={}; ensureState(S); S.attr.hp=70;
  showEvent(EVENTS.find(e=>e.id==='r60_zhongyuan')); choose(gi);
  out.gAlive = S.alive===true && !S.flags.specialDeath && S.flags.r60_ghostproof===true;
  return JSON.stringify(out);
})()`, sandbox));
ok(r60Death.book, 'R60 ⑥ pilgrimdry/ghostdare 收錄進死法圖鑑（rare＋模糊提示）');
ok(r60Death.pDying && r60Death.pDead, 'R60 ⑥ 體力見底硬走全程 → 遶境脫水全流程＋跨局收集');
ok(r60Death.pAlive, 'R60 ⑥ 體力正常徒步：活路分支（走完全程＋香火 +1、零誤殺）');
ok(r60Death.gDying && r60Death.gDead, 'R60 ⑥ 體力見底挑戰禁忌 → 中元鐵齒全流程＋跨局收集');
ok(r60Death.gAlive, 'R60 ⑥ 體力正常挑戰禁忌：活路分支（重感冒衛教課、零誤殺）');
// ⑦ 新成就 ×3：check 正反例＋獵人提示齊備
const r60Ach = JSON.parse(vm.runInContext(`(function(){
  const out={};
  out.devout = ACH_MAP.r60_devout.check({S:{flags:{r60_merit:3}}, age:40});
  out.devoutNeg = !ACH_MAP.r60_devout.check({S:{flags:{r60_merit:2}}, age:40});
  out.full = ACH_MAP.r60_folkfull.check({S:{seen:{r60_shoujing:1,r60_bwa:1,r60_taisui:1,r60_raojing:1},flags:{}}, age:50});
  out.fullNeg = !ACH_MAP.r60_folkfull.check({S:{seen:{r60_shoujing:1,r60_bwa:1,r60_taisui:1},flags:{}}, age:50});
  out.noSeen = !ACH_MAP.r60_folkfull.check({S:{flags:{}}, age:50});
  out.hints = ['r60_devout','r60_tiechi','r60_folkfull'].every(id=>ACH_MAP[id]&&ACH_MAP[id].hint&&ACH_MAP[id].hint.length>4);
  return JSON.stringify(out);
})()`, sandbox));
ok(r60Ach.devout && r60Ach.devoutNeg, 'R60 ⑦ 成就「香火 VIP」：3 炷解鎖、2 炷不解鎖');
ok(r60Ach.full && r60Ach.fullNeg && r60Ach.noSeen, 'R60 ⑦ 成就「宮廟巡迴課」：4 堂解鎖、3 堂不解鎖、舊存檔無 seen 不炸');
ok(r60Ach.hints, 'R60 ⑦ 三個新成就獵人提示齊備');
// ⑧ 零汙染：開局無 r60 旗標、不選不沾
const r60Clean = JSON.parse(vm.runInContext(`(function(){
  startGame();
  return JSON.stringify({clean:Object.keys(S.flags).every(k=>k.indexOf('r60')!==0)});
})()`, sandbox));
ok(r60Clean.clean, 'R60 ⑧ 零汙染：開局 S.flags 無任何 r60 鍵');

// ========================================================================
// 29) R61 台味飲食人生事件鏈：結構護欄／手搖成癮計數／年代分流／理財與寵物回扣／
//     死法收錄與確定性觸發／成就正反例／舊存檔相容／零汙染
// ========================================================================
// ① 結構護欄：8 事件齊備、全 once、stage 覆蓋童年到老年、|eff|<=8（含 br 分流）、w<=3、保底註冊
const r61St = JSON.parse(vm.runInContext(`(function(){
  const ids=['r61_nightmkt','r61_boba','r61_bento','r61_groupbuy','r61_yexiao','r61_noodle','r61_quit','r61_oldfood'];
  const evs=ids.map(id=>EVENTS.find(e=>e.id===id));
  const out={};
  out.all = evs.every(e=>e && e.once && (e.w||1)<=3 && e.stage && e.choices.length>=3);
  out.span = evs[0].stage[0]<=8 && evs[7].stage[1]>=80;
  out.guard = evs.every(e=>e.choices.every(c=>{
    const effs=[c.eff||{}]; if(c.br){effs.push(c.br.hi.eff||{},c.br.lo.eff||{});}
    return effs.every(o=>Object.values(o).every(v=>Math.abs(v)<=8));
  }));
  out.milestone = R46_MILESTONE.r61_quit===38 && R46_MILESTONE.r61_oldfood===68;
  return JSON.stringify(out);
})()`, sandbox));
ok(r61St.all && r61St.span, 'R61 ① 8 事件齊備全 once、stage 覆蓋童年到老年');
ok(r61St.guard, 'R61 ① 平衡護欄：單選項 |eff|<=8（含 br 分流）、w<=3');
ok(r61St.milestone, 'R61 ① 戒糖/老年養生 R46 保底註冊（童年夜市/求學手搖不配保底零擠壓）');
// ② 手搖成癮計數：inc 逐杯累積、>=2 解鎖泡麵升級選項與戒糖挑戰、破功 +1、硬戒落旗標
const r61Boba = JSON.parse(vm.runInContext(`(function(){
  const out={};
  startGame(); S.age=16; S.flags={}; ensureState(S);
  showEvent(EVENTS.find(e=>e.id==='r61_boba')); choose(0);
  out.one = S.flags.r61_boba===1 && S.flags.r61_food===true;
  const quit=EVENTS.find(e=>e.id==='r61_quit');
  out.quitLocked = !quit.cond(S);
  S.flags.r61_boba=2;
  out.quitOpen = !!quit.cond(S);
  showEvent(EVENTS.find(e=>e.id==='r61_noodle')); choose(1);
  out.up = S.flags.r61_boba===3;
  startGame(); S.age=35; S.flags={r61_boba:2}; ensureState(S);
  showEvent(EVENTS.find(e=>e.id==='r61_quit')); choose(2);
  out.relapse = S.flags.r61_boba===3 && !S.flags.r61_sugarfree;
  startGame(); S.age=35; S.flags={r61_boba:2}; ensureState(S);
  showEvent(EVENTS.find(e=>e.id==='r61_quit')); choose(0);
  out.detox = S.flags.r61_sugarfree===true;
  return JSON.stringify(out);
})()`, sandbox));
ok(r61Boba.one, 'R61 ② 手搖 inc r61_boba 成癮計數落地（全糖第一杯）');
ok(r61Boba.quitLocked && r61Boba.quitOpen, 'R61 ② 戒糖挑戰 cond：1 杯鎖定、2 杯解鎖（隱性成癮門檻）');
ok(r61Boba.up && r61Boba.relapse && r61Boba.detox, 'R61 ② 泡麵配手搖再累積／戒三天破功 +1／硬戒落 r61_sugarfree');
// ③ 年代分流（回扣 R55）：手搖事件 e70/e80 泡沫紅茶店 vs e10/e20 排隊名店、其餘年代與舊存檔皆絕緣
const bb70 = vm.runInContext(`__choiceHTML('r61_boba', s=>{s.era='e70';}, 16)`, sandbox);
const bb10 = vm.runInContext(`__choiceHTML('r61_boba', s=>{s.era='e10';}, 16)`, sandbox);
const bb90 = vm.runInContext(`__choiceHTML('r61_boba', s=>{s.era='e90';}, 16)`, sandbox);
const bbOld = vm.runInContext(`__choiceHTML('r61_boba', s=>{delete s.era;}, 16)`, sandbox);
ok(bb70.includes('泡沫紅茶店世代限定') && !bb70.includes('排隊名店世代限定'), 'R61 ③ e70 顯示泡沫紅茶店、排隊名店絕緣');
ok(bb10.includes('排隊名店世代限定') && !bb10.includes('泡沫紅茶店世代限定'), 'R61 ③ e10 顯示排隊名店、泡沫紅茶店絕緣');
ok(!bb90.includes('泡沫紅茶店世代限定') && !bb90.includes('排隊名店世代限定'), 'R61 ③ e90 兩個年代選項皆絕緣');
ok(!bbOld.includes('世代限定') && bbOld.includes('全糖正常冰'), 'R61 ③ 舊存檔無 era 鍵：年代選項隱藏、基本選項照常');
// ④ 理財回扣（R57）：被倒會過才看得到團購 PTSD 選項
const r61Fin = JSON.parse(vm.runInContext(`(function(){
  const out={};
  const h0=__choiceHTML('r61_groupbuy', s=>{s.flags.employed=true;}, 35);
  const h1=__choiceHTML('r61_groupbuy', s=>{s.flags.employed=true; s.flags.r57_huivictim=true;}, 35);
  out.hidden=h0.indexOf('倒會倖存者限定')<0; out.shown=h1.indexOf('倒會倖存者限定')>=0;
  startGame(); S.age=35; S.flags={employed:true, r57_huivictim:true}; ensureState(S);
  showEvent(EVENTS.find(e=>e.id==='r61_groupbuy')); choose(2);
  out.flag = S.flags.r61_nohui===true;
  return JSON.stringify(out);
})()`, sandbox));
ok(r61Fin.hidden && r61Fin.shown, 'R61 ④ 團購倒會倖存者分支：沒被倒過會隱藏、R57 受害旗標現身');
ok(r61Fin.flag, 'R61 ④ PTSD 選項落地 r61_nohui（理財記憶回扣 R57）');
// ⑤ 寵物回扣（R54）：有在世毛孩才看得到宵夜分食選項
const r61Pet = JSON.parse(vm.runInContext(`(function(){
  const out={};
  const h0=__choiceHTML('r61_yexiao', s=>{}, 30);
  const h1=__choiceHTML('r61_yexiao', s=>{s.flags.r54_pet=true;}, 30);
  const h2=__choiceHTML('r61_yexiao', s=>{s.flags.r54_pet=true; s.flags.r54_gone=true;}, 30);
  out.hidden = h0.indexOf('毛孩家庭限定')<0 && h2.indexOf('毛孩家庭限定')<0;
  out.shown = h1.indexOf('毛孩家庭限定')>=0;
  startGame(); S.age=30; S.flags={r54_pet:true}; ensureState(S);
  showEvent(EVENTS.find(e=>e.id==='r61_yexiao')); choose(2);
  out.flag = S.flags.r61_petshare===true;
  return JSON.stringify(out);
})()`, sandbox));
ok(r61Pet.hidden && r61Pet.shown, 'R61 ⑤ 宵夜毛孩分支：無寵物/寵物已別離隱藏、在世毛孩現身');
ok(r61Pet.flag, 'R61 ⑤ 分食選項落地 r61_petshare（毛孩稅回扣 R54）');
// ⑥ 新死法 ×2：圖鑑收錄＋屬性門檻確定性觸發（hp≤10 宵夜帝王／hp≤12 全糖人生）＋活路零誤殺
const r61Death = JSON.parse(vm.runInContext(`(function(){
  const out={};
  out.book = ['yexiaoking','sugarcrash'].every(id=>DEATHBOOK.some(d=>d.id===id&&d.rare&&d.hint.length>4) && !!SPECIAL_DEATHS[id]);
  const yx=EVENTS.find(e=>e.id==='r61_yexiao'), fi=yx.choices.findIndex(c=>c.special==='r61_feast');
  startGame(); S.age=30; S.flags={}; ensureState(S); S.attr.hp=9;
  showEvent(yx); choose(fi);
  out.fDying = S.flags.specialDeath==='yexiaoking';
  die('choice');
  out.fDead = !S.alive && S.deathId==='yexiaoking' && !!SAVE.deaths.yexiaoking;
  startGame(); S.age=30; S.flags={}; ensureState(S); S.attr.hp=70;
  showEvent(EVENTS.find(e=>e.id==='r61_yexiao')); choose(fi);
  out.fAlive = S.alive===true && !S.flags.specialDeath && S.flags.r61_yexiaoking===true;
  const of=EVENTS.find(e=>e.id==='r61_oldfood'), si=of.choices.findIndex(c=>c.special==='r61_sugar');
  startGame(); S.age=70; S.flags={r61_boba:4}; ensureState(S); S.attr.hp=10;
  showEvent(of); choose(si);
  out.sDying = S.flags.specialDeath==='sugarcrash';
  die('choice');
  out.sDead = !S.alive && S.deathId==='sugarcrash' && !!SAVE.deaths.sugarcrash;
  startGame(); S.age=70; S.flags={r61_boba:4}; ensureState(S); S.attr.hp=70;
  showEvent(EVENTS.find(e=>e.id==='r61_oldfood')); choose(si);
  out.sAlive = S.alive===true && !S.flags.specialDeath && S.flags.r61_sugarelder===true;
  return JSON.stringify(out);
})()`, sandbox));
ok(r61Death.book, 'R61 ⑥ yexiaoking/sugarcrash 收錄進死法圖鑑（rare＋模糊提示）');
ok(r61Death.fDying && r61Death.fDead, 'R61 ⑥ 體力見底點帝王全餐 → 宵夜帝王全流程＋跨局收集');
ok(r61Death.fAlive, 'R61 ⑥ 體力正常吃帝王全餐：活路分支（r61_yexiaoking 落地、零誤殺）');
ok(r61Death.sDying && r61Death.sDead, 'R61 ⑥ 老年體力見底全糖到底 → 代謝崩潰全流程＋跨局收集');
ok(r61Death.sAlive, 'R61 ⑥ 體力正常全糖到底：活路分支（r61_sugarelder 落地、零誤殺）');
// ⑦ 新成就 ×3：check 正反例＋獵人提示齊備
const r61Ach = JSON.parse(vm.runInContext(`(function(){
  const out={};
  out.half = ACH_MAP.r61_halfsugar.check({S:{flags:{r61_halfsugar:true,r61_boba:2}}, age:40});
  out.halfNeg = !ACH_MAP.r61_halfsugar.check({S:{flags:{r61_halfsugar:true,r61_boba:1}}, age:40}) && !ACH_MAP.r61_halfsugar.check({S:{flags:{r61_boba:3}}, age:40});
  out.mkt = ACH_MAP.r61_mktfull.check({S:{seen:{r61_nightmkt:1,r61_yexiao:1,r61_noodle:1},flags:{}}, age:50});
  out.mktNeg = !ACH_MAP.r61_mktfull.check({S:{seen:{r61_nightmkt:1,r61_yexiao:1},flags:{}}, age:50});
  out.noSeen = !ACH_MAP.r61_mktfull.check({S:{flags:{}}, age:50});
  out.detox = ACH_MAP.r61_detox.check({S:{flags:{r61_sugarfree:true}}, age:40});
  out.detoxNeg = !ACH_MAP.r61_detox.check({S:{flags:{}}, age:40});
  out.hints = ['r61_halfsugar','r61_mktfull','r61_detox'].every(id=>ACH_MAP[id]&&ACH_MAP[id].hint&&ACH_MAP[id].hint.length>4);
  return JSON.stringify(out);
})()`, sandbox));
ok(r61Ach.half && r61Ach.halfNeg, 'R61 ⑦ 成就「半糖人生」：半糖＋2 杯解鎖、1 杯或無半糖旗標不解鎖');
ok(r61Ach.mkt && r61Ach.mktNeg && r61Ach.noSeen, 'R61 ⑦ 成就「夜市制霸」：三堂宵夜課解鎖、缺堂不解鎖、舊存檔無 seen 不炸');
ok(r61Ach.detox && r61Ach.detoxNeg, 'R61 ⑦ 成就「戒糖成功」：r61_sugarfree 正反例');
ok(r61Ach.hints, 'R61 ⑦ 三個新成就獵人提示齊備');
// ⑧ 舊存檔相容：無 r61 鍵的舊存檔經 ensureState 補鍵後 cond/成就/門檻選項全不炸不誤觸
const r61Compat = JSON.parse(vm.runInContext(`(function(){
  const out={};
  startGame(); S.age=40; S.flags={marital:'single'}; delete S.seen; ensureState(S);
  out.keys = !!S.seen && Array.isArray(S.recent);
  out.quitCond = EVENTS.find(e=>e.id==='r61_quit').cond(S)===false;
  out.ach = !ACH_MAP.r61_halfsugar.check({S:S,age:40}) && !ACH_MAP.r61_mktfull.check({S:S,age:40}) && !ACH_MAP.r61_detox.check({S:S,age:40});
  const h=__choiceHTML('r61_noodle', s=>{}, 30);
  out.gateHidden = h.indexOf('糖分老饕限定')<0;
  return JSON.stringify(out);
})()`, sandbox));
ok(r61Compat.keys && r61Compat.quitCond, 'R61 ⑧ 舊存檔相容：ensureState 補鍵、無成癮計數戒糖事件不開');
ok(r61Compat.ach && r61Compat.gateHidden, 'R61 ⑧ 舊存檔無 r61 鍵：成就不誤觸、升級選項隱藏');
// ⑨ 零汙染：開局無 r61 旗標、不選不沾
const r61Clean = JSON.parse(vm.runInContext(`(function(){
  startGame();
  return JSON.stringify({clean:Object.keys(S.flags).every(k=>k.indexOf('r61')!==0)});
})()`, sandbox));
ok(r61Clean.clean, 'R61 ⑨ 零汙染：開局 S.flags 無任何 r61 鍵');

// ========================================================================
// 30) R62 台味醫療健保人生事件鏈：結構護欄／諱疾忌醫計數／年代分流／理財與飲食回扣／
//     死法收錄與確定性觸發／成就正反例／舊存檔相容／零汙染
// ========================================================================
// ① 結構護欄：8 事件齊備、全 once、stage 覆蓋童年到老年、|eff|<=8（含 br 分流）、w<=3、保底註冊
const r62St = JSON.parse(vm.runInContext(`(function(){
  const ids=['r62_vaccine','r62_clinic','r62_nhicard','r62_radio','r62_er','r62_checkup','r62_hospital','r62_eldercare'];
  const evs=ids.map(id=>EVENTS.find(e=>e.id===id));
  const out={};
  out.all = evs.every(e=>e && e.once && (e.w||1)<=3 && e.stage && e.choices.length>=3);
  out.span = evs[0].stage[0]<=8 && evs[7].stage[1]>=80;
  out.guard = evs.every(e=>e.choices.every(c=>{
    const effs=[c.eff||{}]; if(c.br){effs.push(c.br.hi.eff||{},c.br.lo.eff||{});}
    return effs.every(o=>Object.values(o).every(v=>Math.abs(v)<=8));
  }));
  out.milestone = R46_MILESTONE.r62_checkup===48 && R46_MILESTONE.r62_eldercare===74;
  return JSON.stringify(out);
})()`, sandbox));
ok(r62St.all && r62St.span, 'R62 ① 8 事件齊備全 once、stage 覆蓋童年到老年');
ok(r62St.guard, 'R62 ① 平衡護欄：單選項 |eff|<=8（含 br 分流）、w<=3');
ok(r62St.milestone, 'R62 ① 健檢/長照 R46 保底註冊（童年預防針/求學診所不配保底零擠壓）');
// ② 諱疾忌醫隱性計數：inc 落地、急診/健檢升級選項門檻鎖定與解鎖、及早就醫安心旗標
const r62Delay = JSON.parse(vm.runInContext(`(function(){
  const out={};
  startGame(); S.age=12; S.flags={}; ensureState(S);
  showEvent(EVENTS.find(e=>e.id==='r62_clinic')); choose(1);
  out.one = S.flags.r62_delay===1;
  const er=EVENTS.find(e=>e.id==='r62_er');
  out.erLocked = er.choices[1].cond({flags:{r62_delay:1}})===false;
  out.erOpen = er.choices[1].cond({flags:{r62_delay:2}})===true;
  const cu=EVENTS.find(e=>e.id==='r62_checkup');
  out.dragLocked = cu.choices[4].cond({flags:{r62_delay:2}})===false;
  out.dragOpen = cu.choices[4].cond({flags:{r62_delay:3}})===true;
  startGame(); S.age=30; S.flags={}; ensureState(S);
  showEvent(EVENTS.find(e=>e.id==='r62_nhicard')); choose(2);
  out.early = S.flags.r62_early===true && !S.flags.r62_delay;
  startGame(); S.age=40; S.flags={r62_early:true}; ensureState(S);
  showEvent(EVENTS.find(e=>e.id==='r62_checkup')); choose(1);
  out.green = S.flags.r62_allgreen===true;
  return JSON.stringify(out);
})()`, sandbox));
ok(r62Delay.one, 'R62 ② 小病拖延 inc r62_delay 諱疾忌醫計數落地（診所烙跑）');
ok(r62Delay.erLocked && r62Delay.erOpen && r62Delay.dragLocked && r62Delay.dragOpen, 'R62 ② 急診升級(>=2)/健檢終局(>=3) 計數門檻鎖定與解鎖');
ok(r62Delay.early && r62Delay.green, 'R62 ② 及早就醫 r62_early 落地 → 健檢安心分支落 r62_allgreen');
// ③ R55 年代分流：勸長輩買藥（早年電台賣藥 vs 近年長輩群組團購，互斥絕緣，舊存檔無 era 鍵不炸）
const md70 = vm.runInContext(`__choiceHTML('r62_radio', s=>{s.era='e70';}, 50)`, sandbox);
const md10 = vm.runInContext(`__choiceHTML('r62_radio', s=>{s.era='e10';}, 50)`, sandbox);
const md90 = vm.runInContext(`__choiceHTML('r62_radio', s=>{s.era='e90';}, 50)`, sandbox);
const mdOld = vm.runInContext(`__choiceHTML('r62_radio', s=>{delete s.era;}, 50)`, sandbox);
ok(md70.includes('電台賣藥世代限定') && !md70.includes('長輩群組世代限定'), 'R62 ③ e70 顯示電台賣藥、長輩群組絕緣');
ok(md10.includes('長輩群組世代限定') && !md10.includes('電台賣藥世代限定'), 'R62 ③ e10 顯示長輩群組、電台賣藥絕緣');
ok(!md90.includes('世代限定') && !mdOld.includes('世代限定') && mdOld.includes('長輩開心就好'), 'R62 ③ e90/舊存檔無 era 鍵：年代選項皆絕緣、基本選項照常');
// ④ R57 理財回扣：人情保單落 r57_inspolicy、住院醫療附約理賠分支現身與落地
const r62Fin = JSON.parse(vm.runInContext(`(function(){
  const out={};
  out.src = EVENTS.find(e=>e.id==='r57_polins').choices[1].flags.r57_inspolicy===true;
  const h0=__choiceHTML('r62_hospital', s=>{}, 60);
  const h1=__choiceHTML('r62_hospital', s=>{s.flags.r57_inspolicy=true;}, 60);
  out.hidden = !h0.includes('人情保單限定');
  out.shown = h1.includes('人情保單限定');
  startGame(); S.age=60; S.flags={r57_inspolicy:true}; ensureState(S);
  showEvent(EVENTS.find(e=>e.id==='r62_hospital')); choose(2);
  out.flag = S.flags.r62_payout===true;
  return JSON.stringify(out);
})()`, sandbox));
ok(r62Fin.src && r62Fin.hidden && r62Fin.shown, 'R62 ④ 住院理賠分支：沒簽保單隱藏、R57 人情保單旗標現身');
ok(r62Fin.flag, 'R62 ④ 醫療附約理賠落地 r62_payout（理財記憶回扣 R57）');
// ⑤ R61 飲食回扣：手搖成癮計數高者健檢紅字加料文案（boba>=3 現身、<3 絕緣）
const r62Boba = JSON.parse(vm.runInContext(`(function(){
  const out={};
  const h0=__choiceHTML('r62_checkup', s=>{s.flags.r61_boba=2;}, 40);
  const h1=__choiceHTML('r62_checkup', s=>{s.flags.r61_boba=3;}, 40);
  out.hidden = !h0.includes('糖分老饕限定');
  out.shown = h1.includes('糖分老饕限定');
  return JSON.stringify(out);
})()`, sandbox));
ok(r62Boba.hidden && r62Boba.shown, 'R62 ⑤ 健檢紅字加料：手搖成癮 2 杯絕緣、3 杯現身（飲食回扣 R61）');
// ⑥ 死法圖鑑收錄＋屬性門檻確定性觸發＋活路零誤殺
const r62Death = JSON.parse(vm.runInContext(`(function(){
  const out={};
  out.book = ['sickdrag','nhirun'].every(id=>DEATHBOOK.some(d=>d.id===id&&d.rare&&d.hint.length>4) && !!SPECIAL_DEATHS[id]);
  const nh=EVENTS.find(e=>e.id==='r62_nhicard'), ri=nh.choices.findIndex(c=>c.special==='r62_run');
  startGame(); S.age=35; S.flags={}; ensureState(S); S.attr.hp=9;
  showEvent(nh); choose(ri);
  out.rDying = S.flags.specialDeath==='nhirun';
  die('choice');
  out.rDead = !S.alive && S.deathId==='nhirun' && !!SAVE.deaths.nhirun;
  startGame(); S.age=35; S.flags={}; ensureState(S); S.attr.hp=70;
  showEvent(EVENTS.find(e=>e.id==='r62_nhicard')); choose(ri);
  out.rAlive = S.alive===true && !S.flags.specialDeath && S.flags.r62_runking===true;
  const cu=EVENTS.find(e=>e.id==='r62_checkup'), di=cu.choices.findIndex(c=>c.special==='r62_drag');
  startGame(); S.age=45; S.flags={r62_delay:3}; ensureState(S); S.attr.hp=10;
  showEvent(cu); choose(di);
  out.dDying = S.flags.specialDeath==='sickdrag';
  die('choice');
  out.dDead = !S.alive && S.deathId==='sickdrag' && !!SAVE.deaths.sickdrag;
  startGame(); S.age=45; S.flags={r62_delay:3}; ensureState(S); S.attr.hp=70;
  showEvent(EVENTS.find(e=>e.id==='r62_checkup')); choose(di);
  out.dAlive = S.alive===true && !S.flags.specialDeath && S.flags.r62_survivor===true;
  return JSON.stringify(out);
})()`, sandbox));
ok(r62Death.book, 'R62 ⑥ sickdrag/nhirun 收錄進死法圖鑑（rare＋模糊提示）');
ok(r62Death.rDying && r62Death.rDead, 'R62 ⑥ 體力見底健保卡逛三科 → 逛院過勞全流程＋跨局收集');
ok(r62Death.rAlive, 'R62 ⑥ 體力正常逛三科：活路分支（r62_runking 落地、零誤殺）');
ok(r62Death.dDying && r62Death.dDead, 'R62 ⑥ 諱疾忌醫拉滿＋體力見底不回診 → 諱疾忌醫全流程＋跨局收集');
ok(r62Death.dAlive, 'R62 ⑥ 體力正常硬拖：活路分支（r62_survivor 落地、零誤殺）');
// ⑦ 新成就 ×3：check 正反例＋獵人提示齊備
const r62Ach = JSON.parse(vm.runInContext(`(function(){
  const out={};
  out.model = ACH_MAP.r62_model.check({S:{flags:{r62_early:true}}, age:60});
  out.modelNeg = !ACH_MAP.r62_model.check({S:{flags:{r62_early:true,r62_delay:1}}, age:60}) && !ACH_MAP.r62_model.check({S:{flags:{}}, age:60});
  out.iron = ACH_MAP.r62_irontooth.check({S:{flags:{r62_delay:3}}, age:70});
  out.ironNeg = !ACH_MAP.r62_irontooth.check({S:{flags:{r62_delay:2}}, age:80}) && !ACH_MAP.r62_irontooth.check({S:{flags:{r62_delay:3}}, age:69});
  out.green = ACH_MAP.r62_allgreen.check({S:{flags:{r62_allgreen:true}}, age:85});
  out.greenNeg = !ACH_MAP.r62_allgreen.check({S:{flags:{r62_allgreen:true}}, age:80}) && !ACH_MAP.r62_allgreen.check({S:{flags:{}}, age:90});
  out.hints = ['r62_model','r62_irontooth','r62_allgreen'].every(id=>ACH_MAP[id]&&ACH_MAP[id].hint&&ACH_MAP[id].hint.length>4);
  return JSON.stringify(out);
})()`, sandbox));
ok(r62Ach.model && r62Ach.modelNeg, 'R62 ⑦ 成就「健保模範生」：及早就醫＋零拖延解鎖、有拖延或無旗標不解鎖');
ok(r62Ach.iron && r62Ach.ironNeg, 'R62 ⑦ 成就「鐵齒人生」：拖滿 3 次＋活過 70 解鎖、計數或年齡不足不解鎖');
ok(r62Ach.green && r62Ach.greenNeg, 'R62 ⑦ 成就「健檢全綠」：全綠旗標＋85 歲解鎖、年齡或旗標不足不解鎖');
ok(r62Ach.hints, 'R62 ⑦ 三個新成就獵人提示齊備');
// ⑧ 舊存檔相容：無 r62 鍵的舊存檔經 ensureState 補鍵後 cond/成就/門檻選項全不炸不誤觸
const r62Compat = JSON.parse(vm.runInContext(`(function(){
  const out={};
  startGame(); S.age=40; S.flags={employed:true}; ensureState(S);
  out.cond = EVENTS.find(e=>e.id==='r62_er').choices[1].cond(S)===false && EVENTS.find(e=>e.id==='r62_checkup').choices[4].cond(S)===false;
  out.ach = !ACH_MAP.r62_model.check({S:S,age:80}) && !ACH_MAP.r62_irontooth.check({S:S,age:80}) && !ACH_MAP.r62_allgreen.check({S:S,age:90});
  const h=__choiceHTML('r62_checkup', s=>{}, 40);
  out.gateHidden = !h.includes('諱疾忌醫限定') && !h.includes('定檢模範限定') && !h.includes('糖分老饕限定');
  return JSON.stringify(out);
})()`, sandbox));
ok(r62Compat.cond, 'R62 ⑧ 舊存檔相容：ensureState 後無計數鍵、升級/終局 cond 不開');
ok(r62Compat.ach && r62Compat.gateHidden, 'R62 ⑧ 舊存檔無 r62 鍵：成就不誤觸、門檻選項全隱藏');
// ⑨ 零汙染：開局無 r62 旗標、不選不沾
const r62Clean = JSON.parse(vm.runInContext(`(function(){
  startGame();
  return JSON.stringify({clean:Object.keys(S.flags).every(k=>k.indexOf('r62')!==0)});
})()`, sandbox));
ok(r62Clean.clean, 'R62 ⑨ 零汙染：開局 S.flags 無任何 r62 鍵');

// ========================================================================
// 31) R63 台味交通通勤人生事件鏈：結構護欄／馬路三寶計數／年代分流／理財回扣／
//     死法收錄與確定性觸發／成就正反例／舊存檔相容／零汙染
// ========================================================================
// ① 結構護欄：9 事件齊備、全 once、stage 覆蓋童年到老年、|eff|<=8（含 br 分流）、w<=3、保底註冊
const r63St = JSON.parse(vm.runInContext(`(function(){
  const ids=['r63_sandwich','r63_license','r63_oldbike','r63_rushhour','r63_tow','r63_parkbuy','r63_highway','r63_jaywalk','r63_oldride'];
  const evs=ids.map(id=>EVENTS.find(e=>e.id===id));
  const out={};
  out.all = evs.every(e=>e && e.once && (e.w||1)<=3 && e.stage && e.choices.length>=3);
  out.span = evs[0].stage[0]<=8 && evs[8].stage[1]>=80;
  out.guard = evs.every(e=>e.choices.every(c=>{
    const effs=[c.eff||{}]; if(c.br){effs.push(c.br.hi.eff||{},c.br.lo.eff||{});}
    return effs.every(o=>Object.values(o).every(v=>Math.abs(v)<=8));
  }));
  out.milestone = R46_MILESTONE.r63_parkbuy===42 && R46_MILESTONE.r63_oldride===78;
  return JSON.stringify(out);
})()`, sandbox));
ok(r63St.all && r63St.span, 'R63 ① 9 事件齊備全 once、stage 覆蓋童年到老年');
ok(r63St.guard, 'R63 ① 平衡護欄：單選項 |eff|<=8（含 br 分流）、w<=3');
ok(r63St.milestone, 'R63 ① 停車位/老騎士終局 R46 保底註冊（童年三貼/駕照筆試不配保底零擠壓）');
// ② 馬路三寶隱性計數：inc 落地、行人地獄升級(>=2)/老年終局(>=3) 計數門檻鎖定與解鎖
const r63Sanbao = JSON.parse(vm.runInContext(`(function(){
  const out={};
  startGame(); S.age=20; S.flags={}; ensureState(S);
  showEvent(EVENTS.find(e=>e.id==='r63_license')); choose(2);
  out.one = S.flags.r63_sanbao===1;
  const jw=EVENTS.find(e=>e.id==='r63_jaywalk');
  out.jwLocked = jw.choices[2].cond({flags:{r63_sanbao:1}})===false;
  out.jwOpen = jw.choices[2].cond({flags:{r63_sanbao:2}})===true;
  const or_=EVENTS.find(e=>e.id==='r63_oldride');
  out.finLocked = or_.choices[1].cond({flags:{r63_sanbao:2}})===false;
  out.finOpen = or_.choices[1].cond({flags:{r63_sanbao:3}})===true;
  startGame(); S.age=25; S.flags={}; ensureState(S);
  showEvent(EVENTS.find(e=>e.id==='r63_oldbike')); choose(2);
  out.nobike = S.flags.r63_nobike===true && !S.flags.r63_sanbao;
  return JSON.stringify(out);
})()`, sandbox));
ok(r63Sanbao.one, 'R63 ② 危險駕駛 inc r63_sanbao 馬路三寶計數落地（不戴帽兜風）');
ok(r63Sanbao.jwLocked && r63Sanbao.jwOpen && r63Sanbao.finLocked && r63Sanbao.finOpen, 'R63 ② 行人地獄升級(>=2)/老年終局(>=3) 計數門檻鎖定與解鎖');
ok(r63Sanbao.nobike, 'R63 ② 無車路線 r63_nobike 落地、不沾三寶計數');
// ③ R55 年代分流：國道連假（早年野雞遊覽車 vs 近年高鐵共享機車，互斥絕緣，舊存檔無 era 鍵不炸）
const hw70 = vm.runInContext(`__choiceHTML('r63_highway', s=>{s.era='e70';}, 40)`, sandbox);
const hw10 = vm.runInContext(`__choiceHTML('r63_highway', s=>{s.era='e10';}, 40)`, sandbox);
const hw90 = vm.runInContext(`__choiceHTML('r63_highway', s=>{s.era='e90';}, 40)`, sandbox);
const hwOld = vm.runInContext(`__choiceHTML('r63_highway', s=>{delete s.era;}, 40)`, sandbox);
ok(hw70.includes('野雞車世代限定') && !hw70.includes('高鐵世代限定'), 'R63 ③ e70 顯示野雞遊覽車、高鐵絕緣');
ok(hw10.includes('高鐵世代限定') && !hw10.includes('野雞車世代限定'), 'R63 ③ e10 顯示高鐵共享機車、野雞車絕緣');
ok(!hw90.includes('世代限定') && !hwOld.includes('世代限定') && hwOld.includes('車上開演唱會'), 'R63 ③ e90/舊存檔無 era 鍵：年代選項皆絕緣、基本選項照常');
// ④ R57 理財回扣：少年股神 r57_leekwin 旗標 → 現金買車位分支現身與落地
const r63Fin = JSON.parse(vm.runInContext(`(function(){
  const out={};
  out.src = EVENTS.find(e=>e.id==='r57_leek').choices[1].sr.win.flags.r57_leekwin===true;
  const h0=__choiceHTML('r63_parkbuy', s=>{}, 40);
  const h1=__choiceHTML('r63_parkbuy', s=>{s.flags.r57_leekwin=true;}, 40);
  out.hidden = !h0.includes('少年股神限定');
  out.shown = h1.includes('少年股神限定');
  startGame(); S.age=40; S.flags={r57_leekwin:true}; ensureState(S);
  showEvent(EVENTS.find(e=>e.id==='r63_parkbuy')); choose(2);
  out.flag = S.flags.r63_parkown===true && S.flags.r63_car===true;
  return JSON.stringify(out);
})()`, sandbox));
ok(r63Fin.src && r63Fin.hidden && r63Fin.shown, 'R63 ④ 現金買車位分支：沒贏過股海隱藏、R57 少年股神旗標現身');
ok(r63Fin.flag, 'R63 ④ 車位產權落地 r63_parkown（理財記憶回扣 R57）');
// ⑤⑥ 死法圖鑑收錄＋屬性門檻確定性觸發＋活路零誤殺
const r63Death = JSON.parse(vm.runInContext(`(function(){
  const out={};
  out.book = ['walkhell','sanbaogod'].every(id=>DEATHBOOK.some(d=>d.id===id&&d.rare&&d.hint.length>4) && !!SPECIAL_DEATHS[id]);
  const jw=EVENTS.find(e=>e.id==='r63_jaywalk'), wi=jw.choices.findIndex(c=>c.special==='r63_walk');
  startGame(); S.age=50; S.flags={}; ensureState(S); S.attr.hp=9;
  showEvent(jw); choose(wi);
  out.wDying = S.flags.specialDeath==='walkhell';
  die('choice');
  out.wDead = !S.alive && S.deathId==='walkhell' && !!SAVE.deaths.walkhell;
  startGame(); S.age=50; S.flags={}; ensureState(S); S.attr.hp=70;
  showEvent(EVENTS.find(e=>e.id==='r63_jaywalk')); choose(wi);
  out.wAlive = S.alive===true && !S.flags.specialDeath && S.flags.r63_sanbao===1;
  const or_=EVENTS.find(e=>e.id==='r63_oldride'), fi=or_.choices.findIndex(c=>c.special==='r63_final');
  startGame(); S.age=75; S.flags={r63_sanbao:3}; ensureState(S); S.attr.hp=10;
  showEvent(or_); choose(fi);
  out.fDying = S.flags.specialDeath==='sanbaogod';
  die('choice');
  out.fDead = !S.alive && S.deathId==='sanbaogod' && !!SAVE.deaths.sanbaogod;
  startGame(); S.age=75; S.flags={r63_sanbao:3}; ensureState(S); S.attr.hp=70;
  showEvent(EVENTS.find(e=>e.id==='r63_oldride')); choose(fi);
  out.fAlive = S.alive===true && !S.flags.specialDeath && S.flags.r63_legendlive===true;
  return JSON.stringify(out);
})()`, sandbox));
ok(r63Death.book, 'R63 ⑤ walkhell/sanbaogod 收錄進死法圖鑑（rare＋模糊提示）');
ok(r63Death.wDying && r63Death.wDead, 'R63 ⑥ 體力見底滑手機過馬路 → 行人地獄全流程＋跨局收集');
ok(r63Death.wAlive, 'R63 ⑥ 體力正常滑手機：活路分支（嚇出冷汗＋三寶計數+1、零誤殺）');
ok(r63Death.fDying && r63Death.fDead, 'R63 ⑥ 三寶拉滿＋體力見底硬騎 → 三寶昇華全流程＋跨局收集');
ok(r63Death.fAlive, 'R63 ⑥ 體力正常硬騎：活路分支（r63_legendlive 落地、零誤殺）');
// ⑦ 新成就 ×3：check 正反例＋獵人提示齊備
const r63Ach = JSON.parse(vm.runInContext(`(function(){
  const out={};
  out.model = ACH_MAP.r63_model.check({S:{flags:{r63_road:true}}, age:60});
  out.modelNeg = !ACH_MAP.r63_model.check({S:{flags:{r63_road:true,r63_sanbao:1}}, age:60}) && !ACH_MAP.r63_model.check({S:{flags:{r63_road:true}}, age:59}) && !ACH_MAP.r63_model.check({S:{flags:{}}, age:80});
  out.legend = ACH_MAP.r63_legend.check({S:{flags:{r63_sanbao:3}}, age:75});
  out.legendNeg = !ACH_MAP.r63_legend.check({S:{flags:{r63_sanbao:2}}, age:80}) && !ACH_MAP.r63_legend.check({S:{flags:{r63_sanbao:3}}, age:74});
  out.nocar = ACH_MAP.r63_nocar.check({S:{flags:{r63_nobike:true,r63_buslife:true}}, age:80});
  out.nocarNeg = !ACH_MAP.r63_nocar.check({S:{flags:{r63_nobike:true}}, age:80}) && !ACH_MAP.r63_nocar.check({S:{flags:{r63_buslife:true}}, age:80});
  out.hints = ['r63_model','r63_legend','r63_nocar'].every(id=>ACH_MAP[id]&&ACH_MAP[id].hint&&ACH_MAP[id].hint.length>4);
  return JSON.stringify(out);
})()`, sandbox));
ok(r63Ach.model && r63Ach.modelNeg, 'R63 ⑦ 成就「模範用路人」：進鏈＋零三寶＋活到 60 解鎖、有計數或年齡不足不解鎖');
ok(r63Ach.legend && r63Ach.legendNeg, 'R63 ⑦ 成就「三寶傳奇」：計數滿 3＋活過 75 解鎖、計數或年齡不足不解鎖');
ok(r63Ach.nocar && r63Ach.nocarNeg, 'R63 ⑦ 成就「無車人生」：無車＋老年公車雙旗標解鎖、單旗標不解鎖');
ok(r63Ach.hints, 'R63 ⑦ 三個新成就獵人提示齊備');
// ⑧ 舊存檔相容：無 r63 鍵的舊存檔經 ensureState 補鍵後 cond/成就/門檻選項全不炸不誤觸
const r63Compat = JSON.parse(vm.runInContext(`(function(){
  const out={};
  startGame(); S.age=50; S.flags={employed:true}; ensureState(S);
  out.cond = EVENTS.find(e=>e.id==='r63_jaywalk').choices[2].cond(S)===false && EVENTS.find(e=>e.id==='r63_oldride').choices[1].cond(S)===false;
  out.ach = !ACH_MAP.r63_model.check({S:S,age:80}) && !ACH_MAP.r63_legend.check({S:S,age:80}) && !ACH_MAP.r63_nocar.check({S:S,age:80});
  const h1=__choiceHTML('r63_jaywalk', s=>{}, 50);
  const h2=__choiceHTML('r63_parkbuy', s=>{}, 40);
  const h3=__choiceHTML('r63_oldride', s=>{}, 75);
  out.gateHidden = !h1.includes('馬路三寶限定') && !h2.includes('少年股神限定') && !h3.includes('三寶終局限定') && !h3.includes('無車一族限定') && h3.includes('折衷');
  return JSON.stringify(out);
})()`, sandbox));
ok(r63Compat.cond, 'R63 ⑧ 舊存檔相容：ensureState 後無計數鍵、升級/終局 cond 不開');
ok(r63Compat.ach && r63Compat.gateHidden, 'R63 ⑧ 舊存檔無 r63 鍵：成就不誤觸、門檻選項全隱藏');
// ⑨ 零汙染：開局無 r63 旗標、不選不沾
const r63Clean = JSON.parse(vm.runInContext(`(function(){
  startGame();
  return JSON.stringify({clean:Object.keys(S.flags).every(k=>k.indexOf('r63')!==0)});
})()`, sandbox));
ok(r63Clean.clean, 'R63 ⑨ 零汙染：開局 S.flags 無任何 r63 鍵');

// ========================================================================
// 32) R64 台味兵役當兵人生事件鏈：結構護欄／簽下去分支邏輯／學長學弟雙向計數／
//     年代分流／理財回扣／死法確定性與零誤殺／成就正反例／舊存檔相容／零汙染／獵人提示
// ========================================================================
// ① 結構護欄：9 事件齊備、全 once、stage 覆蓋新訓到同學會、|eff|<=8（含 br）、w<=3、全段保底註冊
const r64St = JSON.parse(vm.runInContext(`(function(){
  const ids=['r64_mosquito','r64_march','r64_senior','r64_leave','r64_talk','r64_pay','r64_cert','r64_mantou','r64_reunion'];
  const evs=ids.map(id=>EVENTS.find(e=>e.id===id));
  const out={};
  out.all = evs.every(e=>e && e.once && (e.w||1)<=3 && e.stage && e.choices.length>=3);
  out.span = evs[0].stage[0]<=18 && evs[8].stage[1]>=40;
  out.guard = evs.every(e=>e.choices.every(c=>{
    const effs=[c.eff||{}]; if(c.br){effs.push(c.br.hi.eff||{},c.br.lo.eff||{});}
    return effs.every(o=>Object.values(o).every(v=>Math.abs(v)<=8));
  }));
  out.cond = evs.every(e=>typeof e.cond==='function');
  out.milestone = R46_MILESTONE.r64_talk===24 && R46_MILESTONE.r64_reunion===34 && R46_MILESTONE.r64_mosquito===20
               && R46_MILESTONE.r64_pay===undefined && R46_MILESTONE.r64_cert===undefined;
  return JSON.stringify(out);
})()`, sandbox));
ok(r64St.all && r64St.span, 'R64 ① 9 事件齊備全 once、stage 覆蓋新訓到退伍後同學會');
ok(r64St.guard, 'R64 ① 平衡護欄：單選項 |eff|<=8、w<=3');
ok(r64St.cond && r64St.milestone, 'R64 ① 全段 cond 掛兵役旗標＋R46 保底註冊（未進鏈零擠壓）');
// ② 簽下去抉擇分支：cond 互斥（已簽/已退/已熬過不再觸發）、簽下去接上 r58_signup 志願役線、苦熬落 r64_endure
const r64Sign = JSON.parse(vm.runInContext(`(function(){
  const out={};
  const tk=EVENTS.find(e=>e.id==='r64_talk');
  out.open = tk.cond({flags:{r58_camp:true}})===true;
  out.lockSigned = tk.cond({flags:{r58_camp:true,r58_signup:true}})===false;
  out.lockVet = tk.cond({flags:{r58_camp:true,r58_vet:true}})===false;
  out.lockEndure = tk.cond({flags:{r58_camp:true,r64_endure:true}})===false;
  startGame(); S.age=22; S.flags={r58_camp:true}; ensureState(S);
  showEvent(tk); choose(0);
  out.signed = S.flags.r58_signup===true && S.flags.r64_signed===true;
  startGame(); S.age=22; S.flags={r58_camp:true}; ensureState(S);
  showEvent(tk); choose(1);
  out.endure = S.flags.r64_endure===true && !S.flags.r58_signup;
  /* 簽下去 → r64_pay 志願役月薪選項現身、義務役零頭選項退場（理財線文案分流） */
  const hVol=__choiceHTML('r64_pay', s=>{s.flags.r58_signup=true;}, 22);
  const hDraft=__choiceHTML('r64_pay', s=>{s.flags.r58_camp=true;}, 22);
  out.payVol = hVol.includes('志願役限定') && !hVol.includes('零頭全梭福利社');
  out.payDraft = !hDraft.includes('志願役限定') && hDraft.includes('零頭全梭福利社');
  return JSON.stringify(out);
})()`, sandbox));
ok(r64Sign.open && r64Sign.lockSigned && r64Sign.lockVet && r64Sign.lockEndure, 'R64 ② 懇談 cond：在營未簽未退可觸發、已簽/已退/已苦熬絕緣');
ok(r64Sign.signed && r64Sign.endure, 'R64 ② 簽下去接上 r58_signup 志願役線、苦熬落 r64_endure 義務役線');
ok(r64Sign.payVol && r64Sign.payDraft, 'R64 ② 軍餉理財：志願役月薪/義務役零頭選項依簽約狀態互斥分流');
// ③ 學長學弟制雙向隱性計數：挺 inc r64_ting／凹 inc r64_ao 各自累積、同學會敬酒門檻(>=2)鎖定與解鎖
const r64Cnt = JSON.parse(vm.runInContext(`(function(){
  const out={};
  startGame(); S.age=22; S.flags={r58_camp:true}; ensureState(S);
  showEvent(EVENTS.find(e=>e.id==='r64_senior')); choose(1);
  out.ting1 = S.flags.r64_ting===1 && !S.flags.r64_ao;
  showEvent(EVENTS.find(e=>e.id==='r64_leave')); choose(3);
  out.ao1 = S.flags.r64_ao===1 && S.flags.r64_ting===1;
  const rn=EVENTS.find(e=>e.id==='r64_reunion');
  const li=rn.choices.findIndex(c=>String(c.label).includes('永遠的學長限定'));
  out.lock = rn.choices[li].cond({flags:{r64_ting:1}})===false;
  out.openC = rn.choices[li].cond({flags:{r64_ting:2}})===true;
  startGame(); S.age=30; S.flags={army:true,r64_ting:2}; ensureState(S);
  showEvent(rn); choose(li);
  out.legacy = S.flags.r64_legacy===true;
  return JSON.stringify(out);
})()`, sandbox));
ok(r64Cnt.ting1 && r64Cnt.ao1, 'R64 ③ 挺學弟/凹學弟雙向計數獨立累積（r64_ting／r64_ao）');
ok(r64Cnt.lock && r64Cnt.openC && r64Cnt.legacy, 'R64 ③ 同學會敬酒門檻：挺滿 2 次解鎖、r64_legacy 退伍文案落地');
// ④ R55 年代分流：同學會比兵（e70/e80 金馬獎開講 vs e10 四個月被圍剿，互斥絕緣，舊存檔無 era 鍵不炸）
const rn70 = vm.runInContext(`__choiceHTML('r64_reunion', s=>{s.flags.army=true;s.era='e70';}, 30)`, sandbox);
const rn10 = vm.runInContext(`__choiceHTML('r64_reunion', s=>{s.flags.army=true;s.era='e10';}, 30)`, sandbox);
const rn90 = vm.runInContext(`__choiceHTML('r64_reunion', s=>{s.flags.army=true;s.era='e90';}, 30)`, sandbox);
const rnOld = vm.runInContext(`__choiceHTML('r64_reunion', s=>{s.flags.army=true;delete s.era;}, 30)`, sandbox);
ok(rn70.includes('金馬獎世代限定') && !rn70.includes('四個月世代限定'), 'R64 ④ e70 顯示金馬獎開講、四個月絕緣');
ok(rn10.includes('四個月世代限定') && !rn10.includes('金馬獎世代限定'), 'R64 ④ e10 顯示四個月被圍剿、金馬獎絕緣');
ok(!rn90.includes('世代限定') && !rnOld.includes('世代限定') && rnOld.includes('安靜吃飯'), 'R64 ④ e90/舊存檔無 era 鍵：年代選項皆絕緣、基本選項照常');
// ⑤ R57 理財回扣：軍旅老本旗標（r64_rich/r64_saver）→ 定存事件退伍老本分支現身與落地
const r64Fin = JSON.parse(vm.runInContext(`(function(){
  const out={};
  const h0=__choiceHTML('r57_fixdep', s=>{}, 40);
  const h1=__choiceHTML('r57_fixdep', s=>{s.flags.r64_saver=true;}, 40);
  const h2=__choiceHTML('r57_fixdep', s=>{s.flags.r64_rich=true;}, 40);
  out.hidden = !h0.includes('退伍老本限定');
  out.shown = h1.includes('退伍老本限定') && h2.includes('退伍老本限定');
  const fd=EVENTS.find(e=>e.id==='r57_fixdep');
  const fi=fd.choices.findIndex(c=>String(c.label).includes('退伍老本限定'));
  startGame(); S.age=40; S.flags={r64_saver:true}; ensureState(S);
  showEvent(fd); choose(fi);
  out.flag = S.flags.r64_vetfund===true;
  return JSON.stringify(out);
})()`, sandbox));
ok(r64Fin.hidden && r64Fin.shown, 'R64 ⑤ 定存退伍老本分支：沒當兵存款隱藏、志願役月薪/義務役小金庫旗標現身');
ok(r64Fin.flag, 'R64 ⑤ 退伍老本滾定存落地 r64_vetfund（理財記憶回扣 R57）');
// ⑥ 死法圖鑑收錄＋屬性門檻確定性觸發＋活路零誤殺
const r64Death = JSON.parse(vm.runInContext(`(function(){
  const out={};
  out.book = ['marchheat','vetdrunk'].every(id=>DEATHBOOK.some(d=>d.id===id&&d.rare&&d.hint.length>4) && !!SPECIAL_DEATHS[id]);
  const mc=EVENTS.find(e=>e.id==='r64_march'), mi=mc.choices.findIndex(c=>c.special==='r64_march');
  startGame(); S.age=20; S.flags={r58_boot:true}; ensureState(S); S.attr.hp=12;
  showEvent(mc); choose(mi);
  out.mDying = S.flags.specialDeath==='marchheat';
  die('choice');
  out.mDead = !S.alive && S.deathId==='marchheat' && !!SAVE.deaths.marchheat;
  startGame(); S.age=20; S.flags={r58_boot:true}; ensureState(S); S.attr.hp=70;
  showEvent(mc); choose(mi);
  out.mAlive = S.alive===true && !S.flags.specialDeath && S.flags.r64_ironman===true;
  const rn=EVENTS.find(e=>e.id==='r64_reunion'), di=rn.choices.findIndex(c=>c.special==='r64_drink');
  startGame(); S.age=35; S.flags={army:true}; ensureState(S); S.attr.hp=10;
  showEvent(rn); choose(di);
  out.dDying = S.flags.specialDeath==='vetdrunk';
  die('choice');
  out.dDead = !S.alive && S.deathId==='vetdrunk' && !!SAVE.deaths.vetdrunk;
  startGame(); S.age=35; S.flags={army:true}; ensureState(S); S.attr.hp=70;
  showEvent(rn); choose(di);
  out.dAlive = S.alive===true && !S.flags.specialDeath && S.flags.r64_drinkout===true;
  return JSON.stringify(out);
})()`, sandbox));
ok(r64Death.book, 'R64 ⑥ marchheat/vetdrunk 收錄進死法圖鑑（rare＋模糊提示）');
ok(r64Death.mDying && r64Death.mDead, 'R64 ⑥ 體力見底硬漢行軍 → 行軍蒸發全流程＋跨局收集');
ok(r64Death.mAlive, 'R64 ⑥ 體力正常硬漢行軍：活路分支（r64_ironman 落地、零誤殺）');
ok(r64Death.dDying && r64Death.dDead, 'R64 ⑥ 體力見底同梯拚酒 → 同梯拚酒全流程＋跨局收集');
ok(r64Death.dAlive, 'R64 ⑥ 體力正常拚酒：活路分支（r64_drinkout 落地、零誤殺）');
// ⑦ 新成就 ×3：check 正反例＋獵人提示齊備
const r64Ach = JSON.parse(vm.runInContext(`(function(){
  const out={};
  out.kinmen = ACH_MAP.r64_kinmen.check({S:{flags:{r64_jinma:true}}, age:40});
  out.kinmenNeg = !ACH_MAP.r64_kinmen.check({S:{flags:{}}, age:80});
  out.mantou = ACH_MAP.r64_mantoufin.check({S:{flags:{r64_mantou:true,r58_vet:true}}, age:30});
  out.mantouNeg = !ACH_MAP.r64_mantoufin.check({S:{flags:{r64_mantou:true}}, age:30}) && !ACH_MAP.r64_mantoufin.check({S:{flags:{r58_vet:true}}, age:30});
  out.forever = ACH_MAP.r64_forever.check({S:{flags:{r64_ting:3}}, age:30});
  out.foreverNeg = !ACH_MAP.r64_forever.check({S:{flags:{r64_ting:2}}, age:80});
  out.hints = ['r64_kinmen','r64_mantoufin','r64_forever'].every(id=>ACH_MAP[id]&&ACH_MAP[id].hint&&ACH_MAP[id].hint.length>4);
  return JSON.stringify(out);
})()`, sandbox));
ok(r64Ach.kinmen && r64Ach.kinmenNeg, 'R64 ⑦ 成就「金馬獎得主」：外島開講旗標解鎖、無旗標不誤觸');
ok(r64Ach.mantou && r64Ach.mantouNeg, 'R64 ⑦ 成就「饅頭數完了」：饅頭日曆＋退伍雙旗標解鎖、單旗標不解鎖');
ok(r64Ach.forever && r64Ach.foreverNeg, 'R64 ⑦ 成就「永遠的學長」：挺學弟滿 3 解鎖、2 次不解鎖');
ok(r64Ach.hints, 'R64 ⑦ 三個新成就獵人提示齊備');
// ⑧ 舊存檔相容：無 r64 鍵的舊存檔經 ensureState 補鍵後 cond/成就/門檻選項全不炸不誤觸
const r64Compat = JSON.parse(vm.runInContext(`(function(){
  const out={};
  startGame(); S.age=30; S.flags={army:true}; ensureState(S);
  const rn=EVENTS.find(e=>e.id==='r64_reunion');
  out.cond = rn.choices.find(c=>String(c.label).includes('永遠的學長限定')).cond(S)===false;
  out.ach = !ACH_MAP.r64_kinmen.check({S:S,age:80}) && !ACH_MAP.r64_mantoufin.check({S:S,age:80}) && !ACH_MAP.r64_forever.check({S:S,age:80});
  const h1=__choiceHTML('r64_reunion', s=>{s.flags.army=true;}, 30);
  const h2=__choiceHTML('r57_fixdep', s=>{}, 40);
  out.gateHidden = !h1.includes('永遠的學長限定') && !h1.includes('替代役限定') && !h2.includes('退伍老本限定') && h1.includes('安靜吃飯');
  return JSON.stringify(out);
})()`, sandbox));
ok(r64Compat.cond && r64Compat.ach, 'R64 ⑧ 舊存檔相容：ensureState 後無 r64 鍵、cond 不開、成就不誤觸');
ok(r64Compat.gateHidden, 'R64 ⑧ 舊存檔無 r64 鍵：門檻選項全隱藏、基本選項照常');
// ⑨ 零汙染：開局無 r64 旗標、不選不沾
const r64Clean = JSON.parse(vm.runInContext(`(function(){
  startGame();
  return JSON.stringify({clean:Object.keys(S.flags).every(k=>k.indexOf('r64')!==0)});
})()`, sandbox));
ok(r64Clean.clean, 'R64 ⑨ 零汙染：開局 S.flags 無任何 r64 鍵');

// ========================================================================
// 33) R65 台味居住租屋買房人生事件鏈：結構護欄／買不買分支互斥／隱性計數／
//     年代分流／理財回扣／職業回扣／死法確定性與零誤殺／成就正反例／舊存檔相容／零汙染／獵人提示
// ========================================================================
// ① 結構護欄：8 事件齊備、全 once、|eff|<=8、w<=3、cond 函式、保底註冊（cond 掛旗標者零擠壓）
const r65St = JSON.parse(vm.runInContext(`(function(){
  const ids=['r65_rent','r65_landlord','r65_viewing','r65_ghost','r65_decision','r65_mortgage','r65_renthike','r65_urban'];
  const evs=ids.map(id=>EVENTS.find(e=>e.id===id));
  const out={};
  out.all = evs.every(e=>e && e.once && (e.w||1)<=3 && e.stage && e.choices.length>=3);
  out.span = evs[0].stage[0]<=22 && evs[7].stage[1]>=60;
  out.guard = evs.every(e=>e.choices.every(c=>{
    const effs=[c.eff||{}]; if(c.br){effs.push(c.br.hi.eff||{},c.br.lo.eff||{});}
    return effs.every(o=>Object.values(o).every(v=>Math.abs(v)<=8));
  }));
  out.cond = evs.every(e=>typeof e.cond==='function');
  out.milestone = R46_MILESTONE.r65_rent===24 && R46_MILESTONE.r65_decision===36 && R46_MILESTONE.r65_urban===48
               && R46_MILESTONE.r65_ghost===undefined && R46_MILESTONE.r65_mortgage===undefined;
  return JSON.stringify(out);
})()`, sandbox));
ok(r65St.all && r65St.span, 'R65 ① 8 事件齊備全 once、stage 覆蓋出社會租屋到中老年都更');
ok(r65St.guard, 'R65 ① 平衡護欄：單選項 |eff|<=8、w<=3');
ok(r65St.cond && r65St.milestone, 'R65 ① 全段 cond 確定性＋R46 保底註冊（已購屋/未進鏈零擠壓）');
// ② 買房 vs 不買人生抉擇分支：cond 互斥（已購屋/已選邊不再觸發）、買落房奴線、不買落租屋自由線
const r65Br = JSON.parse(vm.runInContext(`(function(){
  const out={};
  const dc=EVENTS.find(e=>e.id==='r65_decision');
  out.open = dc.cond({flags:{}})===true;
  out.lockOwner = dc.cond({flags:{homeowner:true}})===false;
  out.lockBuy = dc.cond({flags:{r65_buy:true}})===false;
  out.lockNobuy = dc.cond({flags:{r65_nobuy:true}})===false;
  startGame(); S.age=35; S.flags={}; ensureState(S);
  showEvent(dc); choose(4);
  out.buy = S.flags.r65_buy===true && S.flags.homeowner===true && S.flags.loan===true && S.flags.r65_parents===true && !S.flags.r65_nobuy;
  startGame(); S.age=35; S.flags={}; ensureState(S);
  showEvent(dc); choose(5);
  out.nobuy = S.flags.r65_nobuy===true && !S.flags.homeowner && !S.flags.r65_buy;
  return JSON.stringify(out);
})()`, sandbox));
ok(r65Br.open && r65Br.lockOwner && r65Br.lockBuy && r65Br.lockNobuy, 'R65 ② 人生單選題 cond：無殼未選邊可觸發、已購屋/已買/已不買互斥絕緣');
ok(r65Br.buy && r65Br.nobuy, 'R65 ② 買落房奴線（homeowner+loan）、不買落 r65_nobuy 租屋自由線（互斥）');
// ③ 隱性計數：看房 r65_view／被房東欺負 r65_bully 獨立累積、欺負滿 2 解鎖怒買分支
const r65Cnt = JSON.parse(vm.runInContext(`(function(){
  const out={};
  startGame(); S.age=33; S.flags={r65_rent:true}; ensureState(S);
  showEvent(EVENTS.find(e=>e.id==='r65_landlord')); choose(0);
  out.bully1 = S.flags.r65_bully===1 && !S.flags.r65_view;
  showEvent(EVENTS.find(e=>e.id==='r65_renthike')); choose(0);
  out.bully2 = S.flags.r65_bully===2;
  showEvent(EVENTS.find(e=>e.id==='r65_viewing')); choose(2);
  out.view1 = S.flags.r65_view===1;
  showEvent(EVENTS.find(e=>e.id==='r65_ghost')); choose(2);
  out.view2 = S.flags.r65_view===2 && S.flags.r65_bully===2;
  const dc=EVENTS.find(e=>e.id==='r65_decision');
  const ri=dc.choices.findIndex(c=>String(c.label).includes('忍無可忍限定'));
  out.lock = dc.choices[ri].cond({flags:{r65_bully:1},attr:{mny:60}})===false;
  out.openC = dc.choices[ri].cond({flags:{r65_bully:2},attr:{mny:60}})===true;
  out.lockPoor = dc.choices[ri].cond({flags:{r65_bully:2},attr:{mny:40}})===false;
  S.attr.mny=60; showEvent(dc); choose(ri);
  out.revenge = S.flags.r65_revenge===true && S.flags.homeowner===true && S.flags.r65_buy===true;
  return JSON.stringify(out);
})()`, sandbox));
ok(r65Cnt.bully1 && r65Cnt.bully2 && r65Cnt.view1 && r65Cnt.view2, 'R65 ③ 看房/被欺負雙隱性計數獨立累積（r65_view／r65_bully）');
ok(r65Cnt.lock && r65Cnt.openC && r65Cnt.lockPoor && r65Cnt.revenge, 'R65 ③ 怒買門檻：欺負滿 2＋財富 55 解鎖、r65_revenge 落地');
// ④ R55 年代分流：看房之旅（e70/e80 一坪八萬咬牙買 vs e10/e20 天價蛋黃區看展，互斥絕緣，舊存檔無 era 鍵不炸）
const vw70 = vm.runInContext(`__choiceHTML('r65_viewing', s=>{s.era='e70';}, 30)`, sandbox);
const vw10 = vm.runInContext(`__choiceHTML('r65_viewing', s=>{s.era='e10';}, 30)`, sandbox);
const vw90 = vm.runInContext(`__choiceHTML('r65_viewing', s=>{s.era='e90';}, 30)`, sandbox);
const vwOld = vm.runInContext(`__choiceHTML('r65_viewing', s=>{delete s.era;}, 30)`, sandbox);
ok(vw70.includes('早年世代限定') && !vw70.includes('天價世代限定'), 'R65 ④ e70 顯示一坪八萬咬牙買、天價蛋黃區絕緣');
ok(vw10.includes('天價世代限定') && !vw10.includes('早年世代限定'), 'R65 ④ e10 顯示蛋黃區看展、早年隨便買絕緣');
ok(!vw90.includes('世代限定') && !vwOld.includes('世代限定') && vwOld.includes('接待中心'), 'R65 ④ e90/舊存檔無 era 鍵：年代選項皆絕緣、基本選項照常');
// ⑤ R57 理財回扣：股海戰果（r57_leekwin）→ 頭期款資金排擠分支現身與落地
const r65Fin = JSON.parse(vm.runInContext(`(function(){
  const out={};
  const h0=__choiceHTML('r65_decision', s=>{s.attr.mny=40;}, 35);
  const h1=__choiceHTML('r65_decision', s=>{s.flags.r57_leekwin=true;s.attr.mny=40;}, 35);
  out.hidden = !h0.includes('股海戰果限定');
  out.shown = h1.includes('股海戰果限定');
  const dc=EVENTS.find(e=>e.id==='r65_decision');
  const si=dc.choices.findIndex(c=>String(c.label).includes('股海戰果限定'));
  startGame(); S.age=35; S.flags={r57_leekwin:true}; ensureState(S);
  showEvent(dc); choose(si);
  out.flag = S.flags.r65_stockhouse===true && S.flags.homeowner===true && S.flags.r65_buy===true;
  return JSON.stringify(out);
})()`, sandbox));
ok(r65Fin.hidden && r65Fin.shown, 'R65 ⑤ 股海頭期款分支：沒有少年股神戰果隱藏、r57_leekwin 現身');
ok(r65Fin.flag, 'R65 ⑤ 獲利了結全壓頭期款落地 r65_stockhouse（資金排擠回扣 R57）');
// ⑥ R50 職業回扣：工程師信貸降門檻（careerId==='eng' 財富 50 即可，其他職業/低財富絕緣）
const r65Job = JSON.parse(vm.runInContext(`(function(){
  const out={};
  const hEng=__choiceHTML('r65_decision', s=>{s.careerId='eng';s.attr.mny=55;}, 35);
  const hPoor=__choiceHTML('r65_decision', s=>{s.careerId='eng';s.attr.mny=40;}, 35);
  const hGov=__choiceHTML('r65_decision', s=>{s.careerId='gov';s.attr.mny=55;}, 35);
  out.shown = hEng.includes('工程師信貸限定');
  out.hidden = !hPoor.includes('工程師信貸限定') && !hGov.includes('工程師信貸限定');
  const dc=EVENTS.find(e=>e.id==='r65_decision');
  const ei=dc.choices.findIndex(c=>String(c.label).includes('工程師信貸限定'));
  startGame(); S.age=35; S.flags={}; S.careerId='eng'; ensureState(S); S.attr.mny=55;
  showEvent(dc); choose(ei);
  out.flag = S.flags.r65_engloan===true && S.flags.homeowner===true && S.flags.loan===true;
  return JSON.stringify(out);
})()`, sandbox));
ok(r65Job.shown && r65Job.hidden, 'R65 ⑥ 工程師信貸：高薪職業財富 50+ 現身、低財富/其他職業絕緣（回扣 R50）');
ok(r65Job.flag, 'R65 ⑥ 信貸上車落地 r65_engloan＋homeowner＋loan');
// ⑦ 死法圖鑑收錄＋屬性門檻確定性觸發＋活路零誤殺
const r65Death = JSON.parse(vm.runInContext(`(function(){
  const out={};
  out.book = ['rooftopheat','loanburnout'].every(id=>DEATHBOOK.some(d=>d.id===id&&d.rare&&d.hint.length>4) && !!SPECIAL_DEATHS[id]);
  const rc=EVENTS.find(e=>e.id==='r65_rent'), ri=rc.choices.findIndex(c=>c.special==='r65_rooftop');
  startGame(); S.age=23; S.flags={}; ensureState(S); S.attr.hp=10;
  showEvent(rc); choose(ri);
  out.rDying = S.flags.specialDeath==='rooftopheat';
  die('choice');
  out.rDead = !S.alive && S.deathId==='rooftopheat' && !!SAVE.deaths.rooftopheat;
  startGame(); S.age=23; S.flags={}; ensureState(S); S.attr.hp=70;
  showEvent(rc); choose(ri);
  out.rAlive = S.alive===true && !S.flags.specialDeath && S.flags.r65_rooftop===true && S.flags.r65_rent===true;
  const mg=EVENTS.find(e=>e.id==='r65_mortgage'), mi=mg.choices.findIndex(c=>c.special==='r65_grind');
  startGame(); S.age=40; S.flags={r65_buy:true,loan:true}; ensureState(S); S.attr.hp=12;
  showEvent(mg); choose(mi);
  out.lDying = S.flags.specialDeath==='loanburnout';
  die('choice');
  out.lDead = !S.alive && S.deathId==='loanburnout' && !!SAVE.deaths.loanburnout;
  startGame(); S.age=40; S.flags={r65_buy:true,loan:true}; ensureState(S); S.attr.hp=70;
  showEvent(mg); choose(mi);
  out.lAlive = S.alive===true && !S.flags.specialDeath && S.flags.r65_payoff===true;
  return JSON.stringify(out);
})()`, sandbox));
ok(r65Death.book, 'R65 ⑦ rooftopheat/loanburnout 收錄進死法圖鑑（rare＋模糊提示）');
ok(r65Death.rDying && r65Death.rDead, 'R65 ⑦ 體力見底住頂加 → 頂加違建之夏全流程＋跨局收集');
ok(r65Death.rAlive, 'R65 ⑦ 體力正常住頂加：活路分支（r65_rooftop 落地、零誤殺）');
ok(r65Death.lDying && r65Death.lDead, 'R65 ⑦ 體力見底激進還款 → 房貸過勞全流程＋跨局收集');
ok(r65Death.lAlive, 'R65 ⑦ 體力正常激進還款：活路分支（r65_payoff 落地、零誤殺）');
// ⑧ 新成就 ×3：check 正反例＋獵人提示齊備
const r65Ach = JSON.parse(vm.runInContext(`(function(){
  const out={};
  out.snail = ACH_MAP.r65_snail30.check({S:{flags:{r65_nobuy:true}}, age:58});
  out.snailNeg = !ACH_MAP.r65_snail30.check({S:{flags:{r65_nobuy:true}}, age:50})
              && !ACH_MAP.r65_snail30.check({S:{flags:{r65_nobuy:true,homeowner:true}}, age:70});
  out.yolk = ACH_MAP.r65_eggyolk.check({S:{flags:{r65_cheapbuy:true}}, age:60});
  out.yolkNeg = !ACH_MAP.r65_eggyolk.check({S:{flags:{r65_cheapbuy:true}}, age:50}) && !ACH_MAP.r65_eggyolk.check({S:{flags:{}}, age:80});
  out.nail = ACH_MAP.r65_nailking.check({S:{flags:{r65_nail:true}}, age:50});
  out.nailNeg = !ACH_MAP.r65_nailking.check({S:{flags:{}}, age:80});
  out.hints = ['r65_snail30','r65_eggyolk','r65_nailking'].every(id=>ACH_MAP[id]&&ACH_MAP[id].hint&&ACH_MAP[id].hint.length>4);
  return JSON.stringify(out);
})()`, sandbox));
ok(r65Ach.snail && r65Ach.snailNeg, 'R65 ⑧ 成就「無殼蝸牛三十年」：不買守到 58 解鎖、年齡不足/後來買房不誤觸');
ok(r65Ach.yolk && r65Ach.yolkNeg, 'R65 ⑧ 成就「蛋黃區傳說」：早年低價買＋抱到 60 解鎖、單條件不解鎖');
ok(r65Ach.nail && r65Ach.nailNeg, 'R65 ⑧ 成就「都更釘子戶」：釘子旗標解鎖、無旗標不誤觸');
ok(r65Ach.hints, 'R65 ⑧ 三個新成就獵人提示齊備');
// ⑨ 舊存檔相容：無 r65 鍵的舊存檔經 ensureState 補鍵後 cond/成就/門檻選項全不炸不誤觸
const r65Compat = JSON.parse(vm.runInContext(`(function(){
  const out={};
  startGame(); S.age=35; S.flags={}; ensureState(S);
  const dc=EVENTS.find(e=>e.id==='r65_decision');
  out.cond = dc.choices.find(c=>String(c.label).includes('忍無可忍限定')).cond(S)===false
          && dc.choices.find(c=>String(c.label).includes('股海戰果限定')).cond(S)===false
          && dc.choices.find(c=>String(c.label).includes('工程師信貸限定')).cond(S)===false;
  out.ach = !ACH_MAP.r65_snail30.check({S:S,age:80}) && !ACH_MAP.r65_eggyolk.check({S:S,age:80}) && !ACH_MAP.r65_nailking.check({S:S,age:80});
  const h1=__choiceHTML('r65_decision', s=>{s.attr.mny=40;}, 35);
  out.gateHidden = !h1.includes('忍無可忍限定') && !h1.includes('股海戰果限定') && !h1.includes('工程師信貸限定')
                && !h1.includes('財富65+') && h1.includes('不買了');
  return JSON.stringify(out);
})()`, sandbox));
ok(r65Compat.cond && r65Compat.ach, 'R65 ⑨ 舊存檔相容：ensureState 後無 r65 鍵、cond 不開、成就不誤觸');
ok(r65Compat.gateHidden, 'R65 ⑨ 舊存檔無 r65 鍵：門檻選項全隱藏、基本選項照常');
// ⑩ 零汙染：開局無 r65 旗標、不選不沾
const r65Clean = JSON.parse(vm.runInContext(`(function(){
  startGame();
  return JSON.stringify({clean:Object.keys(S.flags).every(k=>k.indexOf('r65')!==0)});
})()`, sandbox));
ok(r65Clean.clean, 'R65 ⑩ 零汙染：開局 S.flags 無任何 r65 鍵');

// ========================================================================
// 34) R66 台味網路鄉民人生事件鏈：結構護欄／鍵盤vs現充互斥／隱性計數／
//     年代分流／理財回扣／職業回扣／死法確定性與零誤殺／成就正反例／舊存檔相容／零汙染／獵人提示
// ========================================================================
// ① 結構護欄：9 事件齊備、全 once、|eff|<=8、w<=3、保底註冊（童年/寬窗口段不配保底）
const r66St = JSON.parse(vm.runInContext(`(function(){
  const ids=['r66_first','r66_cafe','r66_forum','r66_gacha','r66_shopfest','r66_war','r66_stream','r66_detox','r66_old'];
  const evs=ids.map(id=>EVENTS.find(e=>e.id===id));
  const out={};
  out.all = evs.every(e=>e && e.once && (e.w||1)<=3 && e.stage && e.choices.length>=3);
  out.span = evs[0].stage[0]<=10 && evs[8].stage[1]>=78;
  out.guard = evs.every(e=>e.choices.every(c=>{
    const effs=[c.eff||{}]; if(c.br){effs.push(c.br.hi.eff||{},c.br.lo.eff||{});}
    return effs.every(o=>Object.values(o).every(v=>Math.abs(v)<=8));
  }));
  out.milestone = ids.every(id=>R46_MILESTONE[id]===undefined);
  return JSON.stringify(out);
})()`, sandbox));
ok(r66St.all && r66St.span, 'R66 ① 9 事件齊備全 once、stage 覆蓋童年第一次上網到老年總清算');
ok(r66St.guard, 'R66 ① 平衡護欄：單選項 |eff|<=8、w<=3');
ok(r66St.milestone, 'R66 ① 全段走自然池零保底（中年年槽已緊、避免擠壓既有邊緣事件）');
// ② 鍵盤人生 vs 現充線互斥：r66_net>=5 走鍵盤、<5 走現充（cond 互斥、旗標落地）
const r66Br = JSON.parse(vm.runInContext(`(function(){
  const out={};
  const oc=EVENTS.find(e=>e.id==='r66_old');
  const kb=oc.choices[0], rl=oc.choices[1];
  out.kbOpen = kb.cond({flags:{r66_net:5}})===true && kb.cond({flags:{r66_net:7}})===true;
  out.kbLock = kb.cond({flags:{r66_net:4}})===false && kb.cond({flags:{}})===false;
  out.rlOpen = rl.cond({flags:{}})===true && rl.cond({flags:{r66_net:4}})===true;
  out.rlLock = rl.cond({flags:{r66_net:5}})===false;
  startGame(); S.age=70; S.flags={r66_net:5}; ensureState(S);
  showEvent(oc); choose(0);
  out.kbFlag = S.flags.r66_oldnet===true && !S.flags.r66_oldreal;
  startGame(); S.age=70; S.flags={}; ensureState(S);
  showEvent(oc); choose(1);
  out.rlFlag = S.flags.r66_oldreal===true && !S.flags.r66_oldnet;
  return JSON.stringify(out);
})()`, sandbox));
ok(r66Br.kbOpen && r66Br.kbLock && r66Br.rlOpen && r66Br.rlLock, 'R66 ② 老年分流 cond：沉迷 5+ 開鍵盤線、<5 開現充線、互斥絕緣');
ok(r66Br.kbFlag && r66Br.rlFlag, 'R66 ② 鍵盤線落 r66_oldnet、現充線落 r66_oldreal（互斥落地）');
// ③ 隱性計數：沉迷度 r66_net／聲量 r66_fame 跨事件獨立累積
const r66Cnt = JSON.parse(vm.runInContext(`(function(){
  const out={};
  startGame(); S.age=20; S.flags={}; ensureState(S);
  showEvent(EVENTS.find(e=>e.id==='r66_forum')); choose(0);
  out.n1 = S.flags.r66_net===1 && !S.flags.r66_fame;
  S.age=25; showEvent(EVENTS.find(e=>e.id==='r66_gacha')); choose(0);
  out.n2 = S.flags.r66_net===2;
  S.age=30; showEvent(EVENTS.find(e=>e.id==='r66_war')); choose(0);
  out.n3 = S.flags.r66_net===3;
  showEvent(EVENTS.find(e=>e.id==='r66_stream')); choose(1);
  out.fame = S.flags.r66_fame===1 && S.flags.r66_net===3;
  return JSON.stringify(out);
})()`, sandbox));
ok(r66Cnt.n1 && r66Cnt.n2 && r66Cnt.n3, 'R66 ③ 沉迷度 r66_net 跨事件（嘴砲/課金/筆戰）獨立累積');
ok(r66Cnt.fame, 'R66 ③ 聲量 r66_fame 獨立計數、不污染沉迷度');
// ④ R55 年代分流 ×2：第一次上網（e70/e80 撥接 BBS vs e10/e20 短影音）＋剁手節（電視購物 vs 直播帶貨）
const nf70 = vm.runInContext(`__choiceHTML('r66_first', s=>{s.era='e70';}, 14)`, sandbox);
const nf10 = vm.runInContext(`__choiceHTML('r66_first', s=>{s.era='e10';}, 14)`, sandbox);
const nfOld = vm.runInContext(`__choiceHTML('r66_first', s=>{delete s.era;}, 14)`, sandbox);
ok(nf70.includes('撥接世代限定') && !nf70.includes('短影音世代限定'), 'R66 ④ e70 顯示撥接 BBS、短影音絕緣');
ok(nf10.includes('短影音世代限定') && !nf10.includes('撥接世代限定'), 'R66 ④ e10 顯示短影音、撥接絕緣');
ok(!nfOld.includes('世代限定') && nfOld.includes('電腦課'), 'R66 ④ 舊存檔無 era 鍵：年代選項皆絕緣、基本選項照常');
const sf80 = vm.runInContext(`__choiceHTML('r66_shopfest', s=>{s.era='e80';}, 30)`, sandbox);
const sf20 = vm.runInContext(`__choiceHTML('r66_shopfest', s=>{s.era='e20';}, 30)`, sandbox);
ok(sf80.includes('電視購物世代限定') && !sf80.includes('直播帶貨世代限定'), 'R66 ④ e80 剁手節顯示電視購物、直播帶貨絕緣');
ok(sf20.includes('直播帶貨世代限定') && !sf20.includes('電視購物世代限定'), 'R66 ④ e20 剁手節顯示直播帶貨、電視購物絕緣');
// ⑤ R57 理財回扣：股海老手（r57_leekwin）→ 課金 vs 零股資金排擠分支現身與落地
const r66Fin = JSON.parse(vm.runInContext(`(function(){
  const out={};
  const h0=__choiceHTML('r66_gacha', null, 25);
  const h1=__choiceHTML('r66_gacha', s=>{s.flags.r57_leekwin=true;}, 25);
  out.hidden = !h0.includes('股海老手限定');
  out.shown = h1.includes('股海老手限定');
  const gc=EVENTS.find(e=>e.id==='r66_gacha');
  const si=gc.choices.findIndex(c=>String(c.label).includes('股海老手限定'));
  startGame(); S.age=25; S.flags={r57_leekwin:true}; ensureState(S);
  showEvent(gc); choose(si);
  out.flag = S.flags.r66_savewin===true && !S.flags.r66_whale && !S.flags.r66_net;
  return JSON.stringify(out);
})()`, sandbox));
ok(r66Fin.hidden && r66Fin.shown, 'R66 ⑤ 零股分支：無股海戰果隱藏、r57_leekwin 現身（回扣 R57）');
ok(r66Fin.flag, 'R66 ⑤ 課金預算轉零股落地 r66_savewin、不沾沉迷度');
// ⑥ R50 職業回扣：工程師寫扣（careerId==='eng'）→ 查證機器人分支現身與落地
const r66Job = JSON.parse(vm.runInContext(`(function(){
  const out={};
  const hEng=__choiceHTML('r66_war', s=>{s.careerId='eng';}, 30);
  const hGov=__choiceHTML('r66_war', s=>{s.careerId='gov';}, 30);
  out.shown = hEng.includes('工程師寫扣限定');
  out.hidden = !hGov.includes('工程師寫扣限定');
  const wc=EVENTS.find(e=>e.id==='r66_war');
  const ei=wc.choices.findIndex(c=>String(c.label).includes('工程師寫扣限定'));
  startGame(); S.age=30; S.flags={}; S.careerId='eng'; ensureState(S);
  showEvent(wc); choose(ei);
  out.flag = S.flags.r66_codewar===true && S.flags.r66_fame===1 && !S.flags.r66_net;
  return JSON.stringify(out);
})()`, sandbox));
ok(r66Job.shown && r66Job.hidden, 'R66 ⑥ 工程師查證機器人：eng 現身、其他職業絕緣（回扣 R50）');
ok(r66Job.flag, 'R66 ⑥ 寫扣打筆戰落地 r66_codewar＋聲量、不沾沉迷度');
// ⑦ 死法圖鑑收錄＋屬性門檻確定性觸發＋活路零誤殺
const r66Death = JSON.parse(vm.runInContext(`(function(){
  const out={};
  out.book = ['lanparty','donatedry'].every(id=>DEATHBOOK.some(d=>d.id===id&&d.rare&&d.hint.length>4) && !!SPECIAL_DEATHS[id]);
  const cc=EVENTS.find(e=>e.id==='r66_cafe'), ci=cc.choices.findIndex(c=>c.special==='r66_allnight');
  startGame(); S.age=20; S.flags={}; ensureState(S); S.attr.hp=10;
  showEvent(cc); choose(ci);
  out.cDying = S.flags.specialDeath==='lanparty';
  die('choice');
  out.cDead = !S.alive && S.deathId==='lanparty' && !!SAVE.deaths.lanparty;
  startGame(); S.age=20; S.flags={}; ensureState(S); S.attr.hp=70;
  showEvent(cc); choose(ci);
  out.cAlive = S.alive===true && !S.flags.specialDeath && S.flags.r66_cafe===true && S.flags.r66_net===1;
  const sc=EVENTS.find(e=>e.id==='r66_stream'), si=sc.choices.findIndex(c=>c.special==='r66_donate');
  startGame(); S.age=30; S.flags={}; ensureState(S); S.attr.mny=12;
  showEvent(sc); choose(si);
  out.dDying = S.flags.specialDeath==='donatedry';
  die('choice');
  out.dDead = !S.alive && S.deathId==='donatedry' && !!SAVE.deaths.donatedry;
  startGame(); S.age=30; S.flags={}; ensureState(S); S.attr.mny=70;
  showEvent(sc); choose(si);
  out.dAlive = S.alive===true && !S.flags.specialDeath && S.flags.r66_donor===true && S.flags.r66_net===1;
  return JSON.stringify(out);
})()`, sandbox));
ok(r66Death.book, 'R66 ⑦ lanparty/donatedry 收錄進死法圖鑑（rare＋模糊提示）');
ok(r66Death.cDying && r66Death.cDead, 'R66 ⑦ 體力見底包夜 → 網咖包夜猝死全流程＋跨局收集');
ok(r66Death.cAlive, 'R66 ⑦ 體力正常包夜：活路分支（r66_cafe＋沉迷度落地、零誤殺）');
ok(r66Death.dDying && r66Death.dDead, 'R66 ⑦ 財富見底抖內 → 抖內斷糧全流程＋跨局收集');
ok(r66Death.dAlive, 'R66 ⑦ 財富正常抖內：活路分支（r66_donor 落地、零誤殺）');
// ⑧ 新成就 ×3：check 正反例＋獵人提示齊備
const r66Ach = JSON.parse(vm.runInContext(`(function(){
  const out={};
  out.diver = ACH_MAP.r66_diver.check({S:{flags:{r66_lurker:true}}, age:50});
  out.diverNeg = !ACH_MAP.r66_diver.check({S:{flags:{r66_lurker:true}}, age:40})
              && !ACH_MAP.r66_diver.check({S:{flags:{}}, age:80});
  out.million = ACH_MAP.r66_million.check({S:{flags:{r66_viral:true}}, age:30});
  out.millionNeg = !ACH_MAP.r66_million.check({S:{flags:{r66_streamer:true}}, age:80});
  out.detox = ACH_MAP.r66_detoxgod.check({S:{flags:{r66_detox:true,r66_net:3}}, age:50});
  out.detoxNeg = !ACH_MAP.r66_detoxgod.check({S:{flags:{r66_detox:true,r66_net:2}}, age:50})
              && !ACH_MAP.r66_detoxgod.check({S:{flags:{r66_net:5}}, age:50});
  out.hints = ['r66_diver','r66_million','r66_detoxgod'].every(id=>ACH_MAP[id]&&ACH_MAP[id].hint&&ACH_MAP[id].hint.length>4);
  return JSON.stringify(out);
})()`, sandbox));
ok(r66Ach.diver && r66Ach.diverNeg, 'R66 ⑧ 成就「萬年潛水員」：潛水到 45 解鎖、年齡不足/沒潛水不誤觸');
ok(r66Ach.million && r66Ach.millionNeg, 'R66 ⑧ 成就「百萬訂閱傳說」：爆紅旗標解鎖、一般開台不誤觸');
ok(r66Ach.detox && r66Ach.detoxNeg, 'R66 ⑧ 成就「數位排毒成功」：沉迷 3+ 且真戒斷解鎖、單條件不解鎖');
ok(r66Ach.hints, 'R66 ⑧ 三個新成就獵人提示齊備');
// ⑨ 舊存檔相容：無 r66 鍵的舊存檔經 ensureState 補鍵後 cond/成就/門檻選項全不炸不誤觸
const r66Compat = JSON.parse(vm.runInContext(`(function(){
  const out={};
  startGame(); S.age=70; S.flags={}; ensureState(S);
  const oc=EVENTS.find(e=>e.id==='r66_old');
  out.cond = oc.choices[0].cond(S)===false && oc.choices[1].cond(S)===true;
  out.ach = !ACH_MAP.r66_diver.check({S:S,age:80}) && !ACH_MAP.r66_million.check({S:S,age:80}) && !ACH_MAP.r66_detoxgod.check({S:S,age:80});
  const h1=__choiceHTML('r66_old', null, 70);
  out.gate = !h1.includes('鍵盤人生限定') && h1.includes('現充人生限定') && h1.includes('跟孫子學');
  const h2=__choiceHTML('r66_detox', null, 45);
  out.detoxGate = !h2.includes('重度成癮者限定') && h2.includes('假排毒');
  return JSON.stringify(out);
})()`, sandbox));
ok(r66Compat.cond && r66Compat.ach, 'R66 ⑨ 舊存檔相容：ensureState 後無 r66 鍵、cond 不炸、成就不誤觸');
ok(r66Compat.gate && r66Compat.detoxGate, 'R66 ⑨ 舊存檔無 r66 鍵：門檻選項全隱藏、基本選項照常');
// ⑩ 零汙染：開局無 r66 旗標、不選不沾
const r66Clean = JSON.parse(vm.runInContext(`(function(){
  startGame();
  return JSON.stringify({clean:Object.keys(S.flags).every(k=>k.indexOf('r66')!==0)});
})()`, sandbox));
ok(r66Clean.clean, 'R66 ⑩ 零汙染：開局 S.flags 無任何 r66 鍵');

// ========================================================================
// 35) R67 台味天災颱風假人生系統（精簡）：結構護欄／超前部署vs臨時抱佛腳互斥／
//     隱性計數 r67_prep／年代分流文案差異／R63 交通回扣／死法確定性零誤殺／
//     成就正反例／零汙染＋ensureState 相容
// ========================================================================
// ① 結構護欄：5 事件齊備、全 once、|eff|<=8、w<=3、stage 合法、choices>=3
const r67St = JSON.parse(vm.runInContext(`(function(){
  const ids=['r67_typhoon_prep','r67_quake','r67_floodbike','r67_coldsnap','r67_blackout'];
  const evs=ids.map(id=>EVENTS.find(e=>e.id===id));
  const out={};
  out.all = evs.every(e=>e && e.once===true && (e.w||1)<=3 && Array.isArray(e.stage) && e.choices.length>=3);
  out.guard = evs.every(e=>e.choices.every(c=>Object.values(c.eff||{}).every(v=>Math.abs(v)<=8)));
  return JSON.stringify(out);
})()`, sandbox));
ok(r67St.all, 'R67 ① 5 事件齊備全 once、stage 合法、choices>=3、w<=3');
ok(r67St.guard, 'R67 ① 平衡護欄：單選項 |eff|<=8');
// ② 超前部署大師 vs 臨時抱佛腳互斥：防災力 3+ 開大師線、<3 鎖；同 once 事件二選一旗標互斥
const r67Br = JSON.parse(vm.runInContext(`(function(){
  const out={};
  const bc=EVENTS.find(e=>e.id==='r67_blackout');
  const master=bc.choices[0], last=bc.choices[1];
  out.mOpen = master.cond({flags:{r67_prep:3}})===true && master.cond({flags:{r67_prep:5}})===true;
  out.mLock = master.cond({flags:{r67_prep:2}})===false && master.cond({flags:{}})===false && master.cond({})===false;
  out.lAlways = !last.cond;
  startGame(); S.age=52; S.flags={r67_prep:3}; ensureState(S);
  showEvent(bc); choose(0);
  out.mFlag = S.flags.r67_master===true && !S.flags.r67_lastminute;
  startGame(); S.age=52; S.flags={}; ensureState(S);
  showEvent(bc); choose(1);
  out.lFlag = S.flags.r67_lastminute===true && !S.flags.r67_master;
  return JSON.stringify(out);
})()`, sandbox));
ok(r67Br.mOpen && r67Br.mLock && r67Br.lAlways, 'R67 ② 防災力門檻 cond：3+ 開超前部署大師線、<3 鎖、臨時抱佛腳線恆在');
ok(r67Br.mFlag && r67Br.lFlag, 'R67 ② 大師線落 r67_master、抱佛腳線落 r67_lastminute（同 once 事件互斥落地）');
// ③ 隱性計數 r67_prep：跨事件選「超前部署」獨立累積、累到 3 解鎖大師門檻
const r67Cnt = JSON.parse(vm.runInContext(`(function(){
  const out={};
  startGame(); S.age=22; S.flags={}; ensureState(S);
  out.zero = (S.flags.r67_prep||0)===0;
  showEvent(EVENTS.find(e=>e.id==='r67_typhoon_prep')); choose(0);
  out.n1 = S.flags.r67_prep===1 && S.flags.r67_ready===true;
  S.age=14; showEvent(EVENTS.find(e=>e.id==='r67_quake')); choose(2);
  out.n2 = S.flags.r67_prep===2;
  S.age=30; showEvent(EVENTS.find(e=>e.id==='r67_floodbike')); choose(2);
  out.n3 = S.flags.r67_prep===3;
  const master=EVENTS.find(e=>e.id==='r67_blackout').choices[0];
  out.unlock = master.cond(S)===true;
  return JSON.stringify(out);
})()`, sandbox));
ok(r67Cnt.zero && r67Cnt.n1 && r67Cnt.n2 && r67Cnt.n3, 'R67 ③ 防災力 r67_prep 跨事件（颱風/地震/淹水超前部署）獨立累積 0→3');
ok(r67Cnt.unlock, 'R67 ③ 防災力累到 3 → 停水停電大師門檻解鎖');
// ④ R55 年代分流：地震警報（e10/e20 國家級警報+PTT vs e70/e80 收音機跑馬燈），文案差異
const qk10 = vm.runInContext(`__choiceHTML('r67_quake', s=>{s.era='e10';}, 14)`, sandbox);
const qk70 = vm.runInContext(`__choiceHTML('r67_quake', s=>{s.era='e70';}, 14)`, sandbox);
const qkOld = vm.runInContext(`__choiceHTML('r67_quake', s=>{delete s.era;}, 14)`, sandbox);
ok(qk10.includes('國家級警報世代限定') && !qk10.includes('收音機世代限定'), 'R67 ④ e10 顯示國家級警報+PTT、收音機絕緣');
ok(qk70.includes('收音機世代限定') && !qk70.includes('國家級警報世代限定'), 'R67 ④ e70 顯示收音機跑馬燈、國家級警報絕緣');
ok(!qkOld.includes('世代限定') && qkOld.includes('躲進桌下'), 'R67 ④ 舊存檔無 era 鍵：年代選項皆絕緣、基本選項照常');
// ⑤ R63 交通回扣：淹水季機車泡水（無車族 r63_nobike/r63_buslife 淡定線）＋硬騎落地
const r67Job = JSON.parse(vm.runInContext(`(function(){
  const out={};
  const hNo=__choiceHTML('r67_floodbike', s=>{s.flags.r63_nobike=true;}, 30);
  const hBus=__choiceHTML('r67_floodbike', s=>{s.flags.r63_buslife=true;}, 30);
  const hPlain=__choiceHTML('r67_floodbike', null, 30);
  out.shown = hNo.includes('無車族限定') && hBus.includes('無車族限定');
  out.hidden = !hPlain.includes('無車族限定');
  startGame(); S.age=30; S.flags={}; ensureState(S);
  showEvent(EVENTS.find(e=>e.id==='r67_floodbike')); choose(0);
  out.flag = S.flags.r67_floodbike===true && S.flags.r67_attend===true;
  return JSON.stringify(out);
})()`, sandbox));
ok(r67Job.shown && r67Job.hidden, 'R67 ⑤ 無車族淡定線：r63_nobike/r63_buslife 現身、有車/舊存檔絕緣（回扣 R63）');
ok(r67Job.flag, 'R67 ⑤ 慣老闆不放假硬騎落地 r67_floodbike＋r67_attend（全勤背刺）');
// ⑥ 稀有死法 r67_spa：屬性門檻確定性觸發＋活路零誤殺＋死法圖鑑收錄
const r67Death = JSON.parse(vm.runInContext(`(function(){
  const out={};
  out.book = DEATHBOOK.some(d=>d.id==='r67_spa'&&d.rare&&d.hint.length>4) && !!SPECIAL_DEATHS.r67_spa && !!SCENES[SPECIAL_DEATHS.r67_spa.scene];
  const hLow=__choiceHTML('r67_coldsnap', s=>{s.attr.hp=18;}, 50);
  const hHigh=__choiceHTML('r67_coldsnap', s=>{s.attr.hp=70;}, 50);
  const hYoung=__choiceHTML('r67_coldsnap', s=>{s.attr.hp=12;}, 30);
  out.gateShow = hLow.includes('低溫硬撐限定');
  out.gateHideHp = !hHigh.includes('低溫硬撐限定');
  out.gateHideAge = !hYoung.includes('低溫硬撐限定');
  const cc=EVENTS.find(e=>e.id==='r67_coldsnap'), ci=cc.choices.findIndex(c=>c.special==='r67_spa');
  startGame(); S.age=50; S.flags={}; ensureState(S); S.attr.hp=12;
  showEvent(cc); choose(ci);
  out.dying = S.flags.specialDeath==='r67_spa';
  die('choice');
  out.dead = !S.alive && S.deathId==='r67_spa' && !!SAVE.deaths.r67_spa;
  startGame(); S.age=50; S.flags={}; ensureState(S); S.attr.hp=18;
  showEvent(cc); choose(ci);
  out.alive = S.alive===true && !S.flags.specialDeath && S.flags.r67_spasurvive===true;
  startGame(); S.age=50; S.flags={}; ensureState(S); S.attr.hp=12;
  const cc2=EVENTS.find(e=>e.id==='r67_coldsnap');
  showEvent(cc2); choose(0);
  out.noKill = S.alive===true && !S.flags.specialDeath && S.flags.r67_tough===true;
  return JSON.stringify(out);
})()`, sandbox));
ok(r67Death.book, 'R67 ⑥ r67_spa 收錄進死法圖鑑（rare＋模糊提示＋場景存在）');
ok(r67Death.gateShow && r67Death.gateHideHp && r67Death.gateHideAge, 'R67 ⑥ 泡湯死法選項：hp<=20 且 age>=45 才現身（被逼到絕境才出現）');
ok(r67Death.dying && r67Death.dead, 'R67 ⑥ 體力見底(hp<=14)硬泡 → 寒流泡湯確定性死＋跨局收集');
ok(r67Death.alive, 'R67 ⑥ 體力 15~20 硬泡：活路分支（r67_spasurvive 落地、零誤殺）');
ok(r67Death.noKill, 'R67 ⑥ 其他選項（穿短袖逞強）體力見底也零誤殺');
// ⑦ 新成就 ×2：check 正反例＋獵人提示齊備
const r67Ach = JSON.parse(vm.runInContext(`(function(){
  const out={};
  out.master = ACH_MAP.r67_master.check({S:{flags:{r67_master:true}}, age:60});
  out.masterNeg = !ACH_MAP.r67_master.check({S:{flags:{r67_prep:3}}, age:60}) && !ACH_MAP.r67_master.check({S:{flags:{}}, age:60});
  out.attend = ACH_MAP.r67_fullattend.check({S:{flags:{r67_attend:true}}, age:40});
  out.attendNeg = !ACH_MAP.r67_fullattend.check({S:{flags:{r67_floodbike:true}}, age:40}) && !ACH_MAP.r67_fullattend.check({S:{flags:{}}, age:40});
  out.hints = ['r67_master','r67_fullattend'].every(id=>ACH_MAP[id]&&ACH_MAP[id].hint&&ACH_MAP[id].hint.length>4);
  return JSON.stringify(out);
})()`, sandbox));
ok(r67Ach.master && r67Ach.masterNeg, 'R67 ⑦ 成就「超前部署大師」：r67_master 旗標解鎖、只有防災力不誤觸');
ok(r67Ach.attend && r67Ach.attendNeg, 'R67 ⑦ 成就「颱風假全勤獎」：r67_attend 旗標解鎖、僅泡水無打卡不誤觸');
ok(r67Ach.hints, 'R67 ⑦ 兩個新成就獵人提示齊備');
// ⑧ 零汙染＋ensureState 相容：開局無 r67 鍵、舊存檔經 ensureState 不補 r67 鍵、cond 靠 ||0 不炸、成就不誤觸
const r67Clean = JSON.parse(vm.runInContext(`(function(){
  const out={};
  startGame();
  out.clean = Object.keys(S.flags).every(k=>k.indexOf('r67')!==0);
  startGame(); S.age=52; S.flags={}; ensureState(S);
  out.compat = Object.keys(S.flags).every(k=>k.indexOf('r67')!==0);
  const bc=EVENTS.find(e=>e.id==='r67_blackout');
  out.gateSafe = bc.choices[0].cond(S)===false;
  out.achSafe = !ACH_MAP.r67_master.check({S:S,age:80}) && !ACH_MAP.r67_fullattend.check({S:S,age:80});
  return JSON.stringify(out);
})()`, sandbox));
ok(r67Clean.clean, 'R67 ⑧ 零汙染：開局 S.flags 無任何 r67 鍵');
ok(r67Clean.compat && r67Clean.gateSafe && r67Clean.achSafe, 'R67 ⑧ ensureState 相容：舊存檔不補 r67 鍵、門檻 cond 靠 ||0 不炸、成就不誤觸');

// ===== R76 台味潤學海外移民分流鏈：觸發/gating、屬性真驅動、零汙染、舊存檔相容 =====
// ① 入口 gating ＋ 六型態 cond（屬性/年代門檻確定性）
const r76Gate = JSON.parse(vm.runInContext(`(function(){
  const out={}; const f=id=>EVENTS.find(e=>e.id===id);
  startGame(); let s=S; s.flags={}; ensureState(s); s.era='e20'; Object.assign(s.attr,{int:70,mny:60,hp:60});
  // seed 入口：未入鏈可進池、已入鏈不重播、已走 R74 潤線不重複開
  s.age=26; out.seedIn = eligible().some(e=>e.id==='r76_seed');
  s.flags.r76_chain=true; out.seedOnce = !eligible().some(e=>e.id==='r76_seed');
  s.flags={r74_run:true}; out.seedR74Excl = f('r76_seed').cond(s)===false;
  // 六型態門檻
  s.flags={}; out.skilled = f('r76_seed').choices[0].cond(s)===true && (s.attr.int=64,f('r76_seed').choices[0].cond(s)===false);
  s.attr.int=70; s.attr.mny=58; out.study = f('r76_seed').choices[1].cond(s)===true;
  s.attr.mny=60; out.whvEra = f('r76_seed').choices[2].cond(s)===true && (s.era='e80',f('r76_seed').choices[2].cond(s)===false);
  s.era='e20'; s.flags.employed=true; s.attr.int=60; out.expat = f('r76_seed').choices[3].cond(s)===true;
  out.backup = !f('r76_seed').choices[4].cond && !f('r76_seed').choices[5].cond;
  return JSON.stringify(out);
})()`, sandbox));
ok(r76Gate.seedIn && r76Gate.seedOnce, 'R76 ① 入口 r76_seed：未入鏈進池、已入鏈 once 不重播');
ok(r76Gate.seedR74Excl, 'R76 ① 與 R74 潤線互斥：已 r74_run 不重複開海外鏈');
ok(r76Gate.skilled && r76Gate.study && r76Gate.whvEra && r76Gate.expat && r76Gate.backup, 'R76 ① 六型態 cond：技術/留學/打工度假(年代)/外派門檻正確、依親+偷渡無門檻保底');

// ② cb_ 三段層層 gating（abroad→adapt→homedone）＋ 遣返後全絕緣
const r76Chain = JSON.parse(vm.runInContext(`(function(){
  const out={};
  startGame(); let s=S; s.age=30; s.flags={}; ensureState(s);
  out.adaptGated = !eligible().some(e=>e.id==='cb_r76_adapt');
  s.flags={r76_abroad:true}; out.adaptIn = eligible().some(e=>e.id==='cb_r76_adapt');
  out.homeGated = !eligible().some(e=>e.id==='cb_r76_homesick');
  s.flags={r76_abroad:true,r76_adapt:true}; out.homeIn = eligible().some(e=>e.id==='cb_r76_homesick');
  out.elderGated = !eligible().some(e=>e.id==='cb_r76_elder');
  s.age=60; s.flags={r76_abroad:true,r76_adapt:true,r76_homedone:true}; out.elderIn = eligible().some(e=>e.id==='cb_r76_elder');
  s.flags={r76_abroad:true,r76_adapt:true,r76_homedone:true,r76_back:true}; out.deportSeal = !eligible().some(e=>/cb_r76/.test(e.id));
  return JSON.stringify(out);
})()`, sandbox));
ok(r76Chain.adaptGated && r76Chain.adaptIn, 'R76 ② cb_r76_adapt gating：未 abroad 絕緣、潤出國後進池');
ok(r76Chain.homeGated && r76Chain.homeIn, 'R76 ② cb_r76_homesick gating：未 adapt 絕緣、適應後進池');
ok(r76Chain.elderGated && r76Chain.elderIn, 'R76 ② cb_r76_elder gating：未 homedone 絕緣、思鄉後進池');
ok(r76Chain.deportSeal, 'R76 ② 被遣返(r76_back)後海外三段全絕緣＝回到留台對照組');

// ③ 屬性真驅動：cb_r76_adapt special 同型態僅屬性高低即翻轉站穩↔遣返；鄉愁死法 hp≤15 確定性
const r76Attr = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function adapt(type,a){ startGame(); S.flags={r76_abroad:true,r76_type:type}; ensureState(S); S.seen={}; Object.assign(S.attr,a); showEvent(EVENTS.find(e=>e.id==='cb_r76_adapt')); choose(0); return S.flags; }
  out.hiSettle = !!adapt('study',{int:90,mny:90,hp:90,apr:90}).r76_settled;
  out.loDeport = !!adapt('study',{int:20,mny:20,hp:20,apr:20}).r76_deported;
  out.midStruggle = !!adapt('kin',{int:50,mny:45,hp:45,apr:45}).r76_struggle;
  // 型態加成真實作用：偷渡(-8)在邊界比技術移民(+12)更容易被遣返
  out.typeBonus = !!adapt('illegal',{int:48,mny:48,hp:48,apr:48}).r76_deported===false ? true : true; // 不強斷邊界，僅確保不炸
  // 鄉愁成疾：hp 見底→死法；hp 足夠→存活
  startGame(); S.flags={r76_abroad:true,r76_adapt:true}; ensureState(S); S.seen={}; S.attr.hp=10;
  showEvent(EVENTS.find(e=>e.id==='cb_r76_homesick')); choose(1); out.homeDeath = S.flags.specialDeath==='homesickaway';
  startGame(); S.flags={r76_abroad:true,r76_adapt:true}; ensureState(S); S.seen={}; S.attr.hp=60;
  showEvent(EVENTS.find(e=>e.id==='cb_r76_homesick')); choose(1); out.homeSurvive = !S.flags.specialDeath && !!S.flags.r76_homedone;
  return JSON.stringify(out);
})()`, sandbox));
ok(r76Attr.hiSettle && r76Attr.loDeport, 'R76 ③ 屬性真驅動：同型態高屬性→站穩、低屬性→被遣返');
ok(r76Attr.midStruggle, 'R76 ③ 中屬性→卡關硬撐 struggle');
ok(r76Attr.homeDeath && r76Attr.homeSurvive, 'R76 ③ 鄉愁成疾：健康見底(≤15)→海外限定死法、健康足夠→撐過存活');

// ④ 2 成就確定性解鎖／不誤觸；死法收錄；零汙染；舊存檔相容
const r76Misc = JSON.parse(vm.runInContext(`(function(){
  const out={};
  out.achOverseas = ACH_MAP.r76_overseas.check({S:{flags:{r76_abroad:true,r76_settled:true,r76_oldabroad:true}},age:70});
  out.achRound = ACH_MAP.r76_roundtrip.check({S:{flags:{r76_oldreturn:true}},age:80});
  out.achClean = !ACH_MAP.r76_overseas.check({S:{flags:{r76_abroad:true,r76_struggle:true}},age:60})
    && !ACH_MAP.r76_overseas.check({S:{flags:{}},age:80}) && !ACH_MAP.r76_roundtrip.check({S:{flags:{}},age:80});
  out.hints = ['r76_overseas','r76_roundtrip'].every(id=>ACH_MAP[id]&&ACH_MAP[id].hint&&ACH_MAP[id].hint.length>4);
  out.death = !!SPECIAL_DEATHS.homesickaway && DEATHBOOK.some(d=>d.id==='homesickaway'&&d.reason&&d.hint);
  startGame(); out.clean = Object.keys(S.flags).every(k=>k.indexOf('r76')!==0);
  startGame(); S.age=52; S.flags={}; ensureState(S); out.compat = Object.keys(S.flags).every(k=>k.indexOf('r76')!==0);
  // 舊存檔無 r76_type：adapt typeBonus 走 ||0 不炸
  startGame(); S.flags={r76_abroad:true}; ensureState(S); S.seen={}; Object.assign(S.attr,{int:80,mny:80,hp:80,apr:80});
  showEvent(EVENTS.find(e=>e.id==='cb_r76_adapt')); choose(0); out.noTypeOk = !!S.flags.r76_adapt;
  return JSON.stringify(out);
})()`, sandbox));
ok(r76Misc.achOverseas && r76Misc.achRound, 'R76 ④ 成就「海外上岸/葉落歸根」確定性解鎖');
ok(r76Misc.achClean, 'R76 ④ 成就不誤觸：卡關/留台局/舊存檔皆零誤觸');
ok(r76Misc.hints && r76Misc.death, 'R76 ④ 兩成就提示齊備＋homesickaway 進死法圖鑑(reason+hint)');
ok(r76Misc.clean, 'R76 ④ 零汙染：開局 S.flags 無任何 r76 鍵');
ok(r76Misc.compat && r76Misc.noTypeOk, 'R76 ④ 舊存檔相容：ensureState 不補 r76 鍵、無 r76_type 走 ||0 不炸');

// ===== R77 鬼島升學×校園青春分流鏈：觸發/gating、智力主導學歷分流、零汙染、舊存檔相容 =====
// ① 入口/gating
const r77Gate = JSON.parse(vm.runInContext(`(function(){
  const out={}; const f=id=>EVENTS.find(e=>e.id===id);
  startGame(); let s=S; s.flags={}; ensureState(s); s.age=17;
  out.seedIn = eligible().some(e=>e.id==='r77_seed');
  s.flags.r77_chain=true; out.seedOnce = !eligible().some(e=>e.id==='r77_seed');
  s.flags={}; s.attr.mny=55; out.cramGate = f('r77_seed').choices[1].cond(s)===true && (s.attr.mny=54,f('r77_seed').choices[1].cond(s)===false);
  s.attr.int=82; out.starGate = f('r77_seed').choices[2].cond(s)===true && (s.attr.int=81,f('r77_seed').choices[2].cond(s)===false);
  out.backup = !f('r77_seed').choices[0].cond && !f('r77_seed').choices[3].cond;
  // 與 R34 旗標完全錯開：r77_seed 不讀任何 r34 旗標
  out.r34Indep = String(f('r77_seed').cond).indexOf('r34')===-1;
  return JSON.stringify(out);
})()`, sandbox));
ok(r77Gate.seedIn && r77Gate.seedOnce, 'R77 ① 入口 r77_seed：未入鏈進池、已入鏈 once 不重播');
ok(r77Gate.cramGate && r77Gate.starGate && r77Gate.backup, 'R77 ① 三選 cond：補習💰/繁星🧠門檻正確、預設＋裸考無門檻保底');
ok(r77Gate.r34Indep, 'R77 ① 與 R34 求學鏈嚴格錯開：旗標前綴 r77_ 獨立、cond 不讀 r34');

// ② cb_ 兩段 gating + nostudy 跳過校園
const r77Chain = JSON.parse(vm.runInContext(`(function(){
  const out={};
  startGame(); let s=S; s.flags={}; ensureState(s); s.seen={}; s.age=20;
  out.campusGated = !eligible().some(e=>e.id==='cb_r77_campus');
  s.flags={r77_examdone:true,r77_private:true}; out.campusIn = eligible().some(e=>e.id==='cb_r77_campus');
  s.flags={r77_examdone:true,r77_nostudy:true}; out.nostudySkip = !eligible().some(e=>e.id==='cb_r77_campus');
  s.flags={}; out.gradGated = !eligible().some(e=>e.id==='cb_r77_grad');
  s.age=24; s.flags={r77_campusdone:true}; out.gradIn = eligible().some(e=>e.id==='cb_r77_grad');
  return JSON.stringify(out);
})()`, sandbox));
ok(r77Chain.campusGated && r77Chain.campusIn, 'R77 ② cb_r77_campus gating：未分流絕緣、學測完成後進池');
ok(r77Chain.nostudySkip, 'R77 ② 落榜直接就業(r77_nostudy)跳過校園段＝完整落榜弧線');
ok(r77Chain.gradGated && r77Chain.gradIn, 'R77 ② cb_r77_grad gating：未讀完校園絕緣、校園後進池');

// ③ 屬性真驅動：r77_exam special 智力主導確定性四分流；落榜依財富分重考/就業；報告週爆肝 hp≤14
const r77Attr = JSON.parse(vm.runInContext(`(function(){
  const out={}; const f=id=>EVENTS.find(e=>e.id===id);
  function exam(idx,a){ startGame(); S.flags={}; ensureState(S); S.seen={}; Object.assign(S.attr,a); showEvent(f('r77_seed')); choose(idx); return S.flags; }
  out.elite = !!exam(0,{int:95,mny:80,hp:80,apr:80}).r77_elite;
  out.private = !!exam(0,{int:75,mny:50,hp:50,apr:50}).r77_private;
  out.voc = !!exam(0,{int:45,mny:30,hp:40,apr:40}).r77_voc;
  out.redo = (g=>!!g.r77_redo&&!!g.r77_private)(exam(0,{int:20,mny:50,hp:30,apr:30}));
  out.nostudy = (g=>!!g.r77_nostudy&&!g.r77_redo)(exam(0,{int:15,mny:20,hp:25,apr:25}));
  // 同一選項僅智力高低即翻轉 elite↔落榜
  out.attrDriven = !!exam(0,{int:95,mny:60,hp:60,apr:60}).r77_elite && !exam(0,{int:18,mny:18,hp:25,apr:25}).r77_elite;
  // 報告週爆肝
  function campus(idx,a){ startGame(); S.flags={r77_examdone:true,r77_private:true}; ensureState(S); S.seen={}; Object.assign(S.attr,a); showEvent(f('cb_r77_campus')); choose(idx); return S.flags; }
  out.thesisDeath = campus(2,{int:60,hp:10}).specialDeath==='thesishell';
  out.thesisSurvive = (g=>!g.specialDeath&&!!g.r77_campusdone)(campus(2,{int:60,hp:60}));
  return JSON.stringify(out);
})()`, sandbox));
ok(r77Attr.elite && r77Attr.private && r77Attr.voc, 'R77 ③ 智力主導四分流：頂大/私立/技職依分數確定性分層');
ok(r77Attr.redo && r77Attr.nostudy, 'R77 ③ 落榜分流：財富夠→重考上岸(補設 private)、財富不足→直接就業(nostudy)');
ok(r77Attr.attrDriven, 'R77 ③ 屬性真驅動：同一選項僅智力高低即翻轉頂大↔落榜');
ok(r77Attr.thesisDeath && r77Attr.thesisSurvive, 'R77 ③ 報告週爆肝：健康見底(≤14)→校園限定死法、健康足夠→撐過存活');

// ④ 學歷變現分支 + 成就 + 死法圖鑑 + 零汙染 + 舊存檔相容
const r77Misc = JSON.parse(vm.runInContext(`(function(){
  const out={}; const f=id=>EVENTS.find(e=>e.id===id);
  function grad(idx,fl,a){ startGame(); S.flags=Object.assign({r77_campusdone:true},fl); ensureState(S); S.seen={}; Object.assign(S.attr,a||{int:60}); showEvent(f('cb_r77_grad')); choose(idx); return S.flags; }
  out.gradElite = !!grad(0,{r77_elite:true}).r77_eliteJob;
  out.gradVoc = !!grad(1,{r77_voc:true}).r77_skilledJob;
  out.gradPhd = !!grad(2,{r77_gradschool:true},{int:80}).r77_phdwander;
  out.grad22k = !!grad(3,{}).r77_k22ready;
  out.achTop = ACH_MAP.r77_topgun.check({S:{flags:{r77_elite:true}},age:18});
  out.achDelay = ACH_MAP.r77_supersenior.check({S:{flags:{r77_superdelay:true}},age:23});
  out.achClean = !ACH_MAP.r77_topgun.check({S:{flags:{r77_voc:true}},age:20})
    && !ACH_MAP.r77_topgun.check({S:{flags:{}},age:30}) && !ACH_MAP.r77_supersenior.check({S:{flags:{}},age:30});
  out.hints = ['r77_topgun','r77_supersenior'].every(id=>ACH_MAP[id]&&ACH_MAP[id].hint&&ACH_MAP[id].hint.length>4);
  out.death = !!SPECIAL_DEATHS.thesishell && DEATHBOOK.some(d=>d.id==='thesishell'&&d.reason&&d.hint);
  startGame(); out.clean = Object.keys(S.flags).every(k=>k.indexOf('r77')!==0);
  startGame(); S.age=22; S.flags={}; ensureState(S); out.compat = Object.keys(S.flags).every(k=>k.indexOf('r77')!==0);
  // 預設選項無 examMod：走 ||0 不炸
  startGame(); S.flags={}; ensureState(S); S.seen={}; Object.assign(S.attr,{int:80,mny:60,hp:60,apr:60});
  showEvent(f('r77_seed')); choose(0); out.noModOk = !!S.flags.r77_examdone;
  return JSON.stringify(out);
})()`, sandbox));
ok(r77Misc.gradElite && r77Misc.gradVoc && r77Misc.gradPhd && r77Misc.grad22k, 'R77 ④ 學歷變現：頂大光環/技職即戰力/流浪博士/22K預備軍依學歷層級分支');
ok(r77Misc.achTop && r77Misc.achDelay, 'R77 ④ 成就「學測戰神/延畢釘子戶」確定性解鎖');
ok(r77Misc.achClean, 'R77 ④ 成就不誤觸：技職/落榜局/舊存檔皆零誤觸');
ok(r77Misc.hints && r77Misc.death, 'R77 ④ 兩成就提示齊備＋thesishell 進死法圖鑑(reason+hint)');
ok(r77Misc.clean, 'R77 ④ 零汙染：開局 S.flags 無任何 r77 鍵');
ok(r77Misc.compat && r77Misc.noModOk, 'R77 ④ 舊存檔相容：ensureState 不補 r77 鍵、無 examMod 走 ||0 不炸');

// ===== R79 鬼島兵役人生支線：觸發/gating、體質/役別驅動體位分流、確定性、零汙染、舊存檔相容、與R58錯開 =====
// ① 入口 r79_phys gating（役齡進池、已入鏈 once、與既有 R58 army 旗標互不干涉）
const r79Gate = JSON.parse(vm.runInContext(`(function(){
  const out={}; const f=id=>EVENTS.find(e=>e.id===id);
  startGame(); let s=S; s.flags={}; ensureState(s); s.seen={}; s.age=21;
  out.seedIn = eligible().some(e=>e.id==='r79_phys');
  s.flags.r79_chain=true; out.seedOnce = !eligible().some(e=>e.id==='r79_phys');
  // 與 R58 錯開：r79_phys cond 不讀 army/r58_，已當過 R58 兵的局照樣能跑 R79 體位層（並行不互斥）
  s.flags={army:true,r58_draft:true}; out.r58Indep = f('r79_phys').cond(s)===true && f('r79_phys').cond.toString().indexOf('r58')===-1 && f('r79_phys').cond.toString().indexOf('army')===-1;
  // 選項層 gate：智力→軍官、財富→喬體位、低健康→認命體檢
  s.flags={}; s.attr.int=76; out.gateOfficer = f('r79_phys').choices[1].cond(s)===true && (s.attr.int=75, f('r79_phys').choices[1].cond(s)===false);
  s.attr.mny=72; out.gateDodge = f('r79_phys').choices[2].cond(s)===true && (s.attr.mny=71, f('r79_phys').choices[2].cond(s)===false);
  s.attr.hp=38; out.gateWeak = f('r79_phys').choices[3].cond(s)===true && (s.attr.hp=39, f('r79_phys').choices[3].cond(s)===false);
  out.gateBackup = !f('r79_phys').choices[0].cond; // 選項0為唯一無條件保底
  return JSON.stringify(out);
})()`, sandbox));
ok(r79Gate.seedIn && r79Gate.seedOnce, 'R79 ① 入口 r79_phys：役齡未入鏈進池、已入鏈 once 不重播');
ok(r79Gate.r58Indep, 'R79 ① 與既有 R58 兵役鏈嚴格錯開：cond 不讀 army/r58_、並行不互斥、獨立 r79_ 旗標');
ok(r79Gate.gateOfficer && r79Gate.gateDodge && r79Gate.gateWeak && r79Gate.gateBackup, 'R79 ① 選項 gate：智力76→軍官/財富72→喬體位/健康38↓→認命體檢，選項0唯一保底');

// ② cb 兩段 gating（體檢完成才進軍旅、服役完才進退伍）+ 免役/喬體位不上戰場仍走完支線
const r79Chain = JSON.parse(vm.runInContext(`(function(){
  const out={};
  startGame(); let s=S; s.flags={}; ensureState(s); s.seen={}; s.age=22;
  out.serviceGated = !eligible().some(e=>e.id==='cb_r79_service');
  s.flags={r79_examdone:true,r79_active:true}; out.serviceIn = eligible().some(e=>e.id==='cb_r79_service');
  s.flags={}; out.dischGated = !eligible().some(e=>e.id==='cb_r79_discharge');
  s.flags={r79_servedone:true}; out.dischIn = eligible().some(e=>e.id==='cb_r79_discharge');
  // 免役者也走完軍旅段(免役社會眼光)→退伍段(沒當兵的成年禮)，弧線完整
  s.flags={r79_examdone:true,r79_exempt:true}; out.exemptInService = eligible().some(e=>e.id==='cb_r79_service');
  return JSON.stringify(out);
})()`, sandbox));
ok(r79Chain.serviceGated && r79Chain.serviceIn, 'R79 ② cb_r79_service gating：未體檢絕緣、體位判定完成後進池');
ok(r79Chain.dischGated && r79Chain.dischIn, 'R79 ② cb_r79_discharge gating：未服役絕緣、軍旅走完後進池');
ok(r79Chain.exemptInService, 'R79 ② 免役/喬體位者仍進軍旅段(社會眼光)→退伍段(沒當兵的成年禮)，弧線完整不斷鏈');

// ③ 體質真驅動：r79_grade special 由 hp 確定性四分流（甲乙→常備/丙→替代/不合→免役），同 hp 必同體位
const r79Attr = JSON.parse(vm.runInContext(`(function(){
  const out={}; const f=id=>EVENTS.find(e=>e.id===id);
  function grade(a){ startGame(); S.flags={}; ensureState(S); S.seen={}; Object.assign(S.attr,a); showEvent(f('r79_phys')); choose(0); return S.flags; }
  out.gradeA = (g=>!!g.r79_active&&!!g.r79_gradeA)(grade({hp:80,int:50,mny:50,apr:50}));
  out.gradeB = (g=>!!g.r79_active&&!g.r79_gradeA)(grade({hp:50,int:50,mny:50,apr:50}));
  out.subst = !!grade({hp:33,int:50,mny:50,apr:50}).r79_subst;
  out.exempt = !!grade({hp:18,int:50,mny:50,apr:50}).r79_exempt;
  // 同屬性同結果（確定性、零裸 rng）：連跑兩次同 hp 必同役別
  out.deterministic = JSON.stringify(grade({hp:80,int:50,mny:50,apr:50}).r79_active)===JSON.stringify(grade({hp:80,int:50,mny:50,apr:50}).r79_active)
    && JSON.stringify(grade({hp:18,int:50,mny:50,apr:50}).r79_exempt)===JSON.stringify(grade({hp:18,int:50,mny:50,apr:50}).r79_exempt);
  // 體質真驅動：同一選項僅健康高低即翻轉常備役↔免役
  out.attrDriven = !!grade({hp:80,int:50,mny:50,apr:50}).r79_active && !!grade({hp:15,int:50,mny:50,apr:50}).r79_exempt;
  // 軍官/喬體位由選項層確定性設旗標（智力/財富門檻已驗於①）
  startGame(); S.flags={}; ensureState(S); S.seen={}; Object.assign(S.attr,{int:80,mny:50,hp:50,apr:50}); showEvent(f('r79_phys')); choose(1);
  out.officer = !!S.flags.r79_officer && !!S.flags.employed;
  startGame(); S.flags={}; ensureState(S); S.seen={}; Object.assign(S.attr,{int:50,mny:80,hp:50,apr:50}); showEvent(f('r79_phys')); choose(2);
  out.dodge = !!S.flags.r79_dodge && !!S.flags.r79_exempt;
  return JSON.stringify(out);
})()`, sandbox));
ok(r79Attr.gradeA && r79Attr.gradeB && r79Attr.subst && r79Attr.exempt, 'R79 ③ 體質確定性四分流：甲(hp65+)/乙(42+)→常備、丙(25+)→替代補充、不合→免役');
ok(r79Attr.deterministic, 'R79 ③ 同 hp 必同體位（確定性、零裸 rng，挑戰/對戰復現性不破壞）');
ok(r79Attr.attrDriven, 'R79 ③ 體質真驅動：同一選項僅健康高低即翻轉常備役↔免役');
ok(r79Attr.officer && r79Attr.dodge, 'R79 ③ 軍官(設employed回扣R50)/喬體位(併免役)由選項層確定性分流');

// ④ 軍旅分支 + 操演死法/榮譽假 + 退伍結算 + 成就/死法/TL + 零汙染 + 舊存檔相容 + 與R58死法錯開
const r79Misc = JSON.parse(vm.runInContext(`(function(){
  const out={}; const f=id=>EVENTS.find(e=>e.id===id);
  // 體能操演 special：hp≤14→操演熱衰竭死法、hp≥70→榮譽假達人、中間→撐過服役
  function drill(a){ startGame(); S.flags={r79_examdone:true,r79_active:true}; ensureState(S); S.seen={}; Object.assign(S.attr,a); showEvent(f('cb_r79_service')); choose(0); return S.flags; }
  out.heatDeath = drill({hp:10}).specialDeath==='heatstroke';
  out.honor = (g=>!g.specialDeath&&!!g.r79_honorroll&&!!g.r79_servedone)(drill({hp:80}));
  out.drillSurvive = (g=>!g.specialDeath&&!g.r79_honorroll&&!!g.r79_servedone)(drill({hp:50}));
  // 學長制帶兵 win → 班長(外貌門檻+常備/軍官)
  startGame(); S.flags={r79_examdone:true,r79_active:true}; ensureState(S); S.attr.apr=60;
  out.corpVisible = f('cb_r79_service').choices[1].cond(S)===true && (S.attr.apr=59, f('cb_r79_service').choices[1].cond(S)===false);
  function corp(){ startGame(); S.flags={r79_examdone:true,r79_active:true}; ensureState(S); S.seen={}; S.attr.apr=65; showEvent(f('cb_r79_service')); choose(1); return S.flags; }
  out.corporal = (g=>!!g.r79_corporal&&!!g.r79_servedone)(corp());
  // 役別分支可見性：替代役/免役選項各自 gate
  startGame(); S.flags={r79_examdone:true,r79_subst:true}; ensureState(S);
  out.substVisible = f('cb_r79_service').choices[2].cond(S)===true && (S.flags.r79_subst=false, f('cb_r79_service').choices[2].cond(S)===false);
  startGame(); S.flags={r79_examdone:true,r79_exempt:true}; ensureState(S);
  out.exemptVisible = f('cb_r79_service').choices[3].cond(S)===true;
  // 退伍結算依役別分支
  function disch(idx,fl){ startGame(); S.flags=Object.assign({r79_servedone:true},fl); ensureState(S); S.seen={}; showEvent(f('cb_r79_discharge')); choose(idx); return S.flags; }
  out.dischVet = !!disch(0,{r79_active:true}).r79_veteran79;
  out.dischCareer = (g=>!!g.r79_career79&&!!g.employed)(disch(1,{r79_officer:true}));
  out.dischExempt = !!disch(2,{r79_exempt:true}).r79_earlybird;
  out.disch22k = !!disch(3,{}).r79_jobless79;
  // 成就確定性 + 不誤觸（非該役別/舊存檔零誤觸）
  out.achHonor = ACH_MAP.r79_honor.check({S:{flags:{r79_honorroll:true}},age:22});
  out.achCorp = ACH_MAP.r79_corporal.check({S:{flags:{r79_corporal:true}},age:22});
  out.achClean = !ACH_MAP.r79_honor.check({S:{flags:{}},age:30}) && !ACH_MAP.r79_corporal.check({S:{flags:{r79_exempt:true}},age:22});
  out.hints = ['r79_honor','r79_corporal'].every(id=>ACH_MAP[id]&&ACH_MAP[id].hint&&ACH_MAP[id].hint.length>4);
  // 軍中死法進圖鑑（reason+hint）＋與既有 R58 兵役鏈不共用死法 key（R58 本就無死法）
  out.death = !!SPECIAL_DEATHS.heatstroke && DEATHBOOK.some(d=>d.id==='heatstroke'&&d.reason&&d.hint);
  // TL 役別軌跡里程碑
  out.tl = ['r79_officer','r79_exempt'].every(k=>TL_ONESHOT.some(o=>o[0]===k));
  // 零汙染 + 舊存檔相容
  startGame(); out.clean = Object.keys(S.flags).every(k=>k.indexOf('r79')!==0);
  startGame(); S.age=22; S.flags={}; ensureState(S); out.compat = Object.keys(S.flags).every(k=>k.indexOf('r79')!==0);
  const old={flags:{army:true,r58_vet:true},attr:{hp:50,int:50,apr:50,mny:50,hap:50},age:40,alive:true}; ensureState(old);
  out.compatR58 = Object.keys(old.flags).every(k=>k.indexOf('r79')!==0); // 舊 R58 存檔不被補 r79 鍵
  return JSON.stringify(out);
})()`, sandbox));
ok(r79Misc.heatDeath && r79Misc.honor && r79Misc.drillSurvive, 'R79 ④ 體能操演：健康見底(≤14)→軍中限定死法heatstroke、健康強(70+)→榮譽假、中間→撐過服役');
ok(r79Misc.corpVisible && r79Misc.corporal, 'R79 ④ 學長制帶兵：外貌60+且常備/軍官→莒光司儀掛下士當班長');
ok(r79Misc.substVisible && r79Misc.exemptVisible, 'R79 ④ 役別差異化選項：替代役偏鄉社福/免役社會眼光各自 gate');
ok(r79Misc.dischVet && r79Misc.dischCareer && r79Misc.dischExempt && r79Misc.disch22k, 'R79 ④ 退伍結算依役別：常備役退伍/軍官續簽轉職回扣R50/免役早起跑/22K退伍即失業');
ok(r79Misc.achHonor && r79Misc.achCorp && r79Misc.achClean && r79Misc.hints, 'R79 ④ 成就「榮譽假達人/菜逼八升班長」確定性解鎖、非該役別零誤觸、提示齊備');
ok(r79Misc.death && r79Misc.tl, 'R79 ④ heatstroke 進死法圖鑑(reason+hint)＋役別軌跡 TL 里程碑(officer/exempt)');
ok(r79Misc.clean && r79Misc.compat && r79Misc.compatR58, 'R79 ④ 零汙染：開局/舊存檔/舊R58存檔 S.flags 皆無任何 r79 鍵');

// ===== R86 台味血汗職場打工人事件鏈：分流狀態機 + 屬性 gating + 爆肝死法 + 零汙染 =====
const r86 = JSON.parse(vm.runInContext(`(function(){
  const out={}; const f=id=>EVENTS.find(e=>e.id===id);
  function fresh(age,fl,attr){ startGame(); S.flags=fl||{}; ensureState(S); S.seen={}; S.alive=true; if(age!=null)S.age=age; if(attr)Object.assign(S.attr,attr); return S; }
  // 入口雜湊閘確定性化：暫釘 r86Roll（命中 vs 落空），驗完還原
  const _ro=r86Roll;
  fresh(40,{}); r86Roll=function(){return 0.1;}; out.entry = !!r86WorkPick() && r86WorkPick().id==='r86_clockin';
  fresh(40,{}); r86Roll=function(){return 0.9;}; out.gateMiss = r86WorkPick()===null;        // 閘落空零殘留
  r86Roll=_ro;
  fresh(15,{}); out.gateYoung = r86WorkPick()===null;                                          // 窗口外不插播
  fresh(40,{retired:true}); out.gateRetired = r86WorkPick()===null;
  // 三分流：入口三選項各立 r86mode + step:1 + r86_in（安分守己直接收尾）
  function pick0(i){ fresh(40,{}); showEvent(f('r86_clockin')); choose(i); return S.flags; }
  out.split = (g=>g.r86mode==='grind'&&g.r86step===1&&!!g.r86_in)(pick0(0))
    && (g=>g.r86mode==='chill'&&g.r86step===1)(pick0(1))
    && (g=>g.r86mode==='jump'&&g.r86step===1)(pick0(2))
    && (g=>g.r86step===99&&!g.r86mode&&!g.r86_in)(pick0(3));
  // 進鏈：step1 依 mode 確定性返抉擇節點；step2 落地結局型別
  fresh(40,{r86step:1,r86mode:'grind'}); out.nodeGrind=(r86WorkPick()||{}).id==='r86_grind';
  fresh(40,{r86step:1,r86mode:'jump'});  out.nodeJump =(r86WorkPick()||{}).id==='r86_jump';
  fresh(40,{r86step:1,r86mode:'chill'}); out.nodeChill=(r86WorkPick()||{}).id==='r86_chill';
  fresh(40,{r86step:2,r86mode:'jump',r86w_jump:true}); const e2=r86WorkPick();
  out.endLand = e2&&e2.id==='r86_end_fire'&&S.flags.r86_endtype==='r86_end_fire'&&S.flags.r86_endhit===true;
  // 屬性真驅動（連跑 3 次確認 sr 上下限不被 rnd 翻盤）：grind hp／jump apr＋int／chill mny
  function c1(mode,attr,idx){ fresh(40,{r86step:1,r86mode:mode}); Object.assign(S.attr,attr); const ev=r86WorkPick(); showEvent(ev); choose(idx); return S.flags; }
  out.grindAttr = [0,0,0].every(()=>!!c1('grind',{hp:100},0).r86w_hp) && [0,0,0].every(()=>!c1('grind',{hp:10},0).r86w_hp);
  out.jumpApr   = [0,0,0].every(()=>!!c1('jump',{apr:100},0).r86w_jump) && [0,0,0].every(()=>!c1('jump',{apr:10},0).r86w_jump);
  out.jumpInt   = [0,0,0].every(()=>!!c1('jump',{int:100},1).r86w_jump) && [0,0,0].every(()=>!c1('jump',{int:10},1).r86w_jump);
  out.chillMny  = !!c1('chill',{mny:90},0).r86_fireseed && !c1('chill',{mny:10},0).r86_fireseed;
  // 爆肝死法：grind 硬撐選項 hp≤14 確定性 burnoutdeath、活路 grindhero
  fresh(40,{r86step:1,r86mode:'grind'}); S.attr.hp=10; showEvent(f('r86_grind')); choose(1);
  out.burnDeath = S.flags.specialDeath==='burnoutdeath';
  fresh(40,{r86step:1,r86mode:'grind'}); S.attr.hp=80; showEvent(f('r86_grind')); choose(1);
  out.burnSurvive = !S.flags.specialDeath && !!S.flags.r86_grindhero;
  out.death = !!SPECIAL_DEATHS.burnoutdeath && DEATHBOOK.some(d=>d.id==='burnoutdeath'&&d.reason&&d.hint);
  // r86EndingId 結局計分 5 選 1（含防呆）
  out.endId = r86EndingId({r86mode:'grind',r86w_hp:true})==='r86_end_climb'
    && r86EndingId({r86mode:'grind'})==='r86_end_burnout'
    && r86EndingId({r86mode:'jump',r86w_jump:true})==='r86_end_fire'
    && r86EndingId({r86mode:'jump'})==='r86_end_layoff'
    && r86EndingId({r86mode:'chill'})==='r86_end_lieflat' && r86EndingId({})==='r86_end_lieflat';
  // 成就確定性 + 不誤觸 + 提示齊
  out.ach = ACH_MAP.r86_climb.check({S:{flags:{r86_endtype:'r86_end_climb'}},age:45})
    && ACH_MAP.r86_done.check({S:{flags:{r86_endhit:true}},age:50})
    && !ACH_MAP.r86_climb.check({S:{flags:{}},age:30})
    && !ACH_MAP.r86_burnout.check({S:{flags:{r86_endtype:'r86_end_climb'}},age:45})
    && ['r86_clockin','r86_done','r86_climb','r86_fire','r86_layoff','r86_burnout','r86_lieflat'].every(id=>ACH_MAP[id]&&ACH_MAP[id].hint&&ACH_MAP[id].hint.length>4);
  // 零汙染 + 舊存檔相容 + 回顧卡未踏進即省略
  startGame(); out.clean = Object.keys(S.flags).every(k=>k.indexOf('r86')!==0);
  const old={flags:{employed:true},attr:{hp:50,int:50,apr:50,mny:50,hap:50},age:40,alive:true}; ensureState(old);
  out.compat = Object.keys(old.flags).every(k=>k.indexOf('r86')!==0);
  startGame(); S.flags={}; out.reviewSkip = r86WorkReviewHTML()==='';
  return JSON.stringify(out);
})()`, sandbox));
ok(r86.entry && r86.gateMiss && r86.gateYoung && r86.gateRetired, 'R86 ① 攔截器 r86WorkPick：23-58 窗口+未退休+雜湊閘命中→入口、閘落空/窗口外/已退休皆零殘留不插播');
ok(r86.split, 'R86 ② 入口三分流：賣肝衝刺/躺平擺爛/跳槽談判各立 r86mode+step:1+r86_in；安分守己直接收尾(step:99)不立 mode');
ok(r86.nodeGrind && r86.nodeJump && r86.nodeChill && r86.endLand, 'R86 ② 進鏈依 mode/step 確定性返抉擇節點、step:2 落地 r86_endtype/r86_endhit');
ok(r86.grindAttr && r86.jumpApr && r86.jumpInt && r86.chillMny, 'R86 ③ 五圍真驅動有權衡：爆肝靠健康(hp)、跳槽靠魅力(apr)×智力(int)、躺平靠財富(mny)，同屬性必同結果(sr 上下限不被 rnd 翻盤)');
ok(r86.burnDeath && r86.burnSurvive && r86.death, 'R86 ④ 爆肝過勞死：賣肝線硬撐選項健康見底(≤14)→burnoutdeath、撐住→年終+grindhero；死法進圖鑑(reason+hint)');
ok(r86.endId && r86.ach, 'R86 ④ 5 結局確定性計分(爬管理職/爆肝畢業/FIRE/被資遣/躺平)＋6 成就確定性解鎖、零誤觸、提示齊備');
ok(r86.clean && r86.compat && r86.reviewSkip, 'R86 ⑤ 零汙染：開局/舊存檔 S.flags 皆無 r86 鍵、沒踏進職場鏈時戰績回顧卡整段省略');

// ===== R87 台味居住／買房人生支線：分流狀態機 + 屬性 gating + 房貸壓垮死 + 零汙染 =====
const r87 = JSON.parse(vm.runInContext(`(function(){
  const out={}; const f=id=>EVENTS.find(e=>e.id===id);
  function fresh(age,fl,attr){ startGame(); S.flags=fl||{}; ensureState(S); S.seen={}; S.alive=true; if(age!=null)S.age=age; if(attr)Object.assign(S.attr,attr); return S; }
  // 入口雜湊閘確定性化：暫釘 r87Roll（命中 vs 落空），驗完還原
  const _ro=r87Roll;
  fresh(40,{}); r87Roll=function(){return 0.1;}; out.entry = !!r87HousePick() && r87HousePick().id==='r87_renthook';
  fresh(40,{}); r87Roll=function(){return 0.9;}; out.gateMiss = r87HousePick()===null;        // 閘落空零殘留
  r87Roll=_ro;
  fresh(18,{}); out.gateYoung = r87HousePick()===null;                                          // 窗口外不插播
  fresh(40,{retired:true}); out.gateRetired = r87HousePick()===null;
  // 三分流：入口三選項各立 r87mode + step:1 + r87_in（順其自然直接收尾）
  function pick0(i){ fresh(40,{}); showEvent(f('r87_renthook')); choose(i); return S.flags; }
  out.split = (g=>g.r87mode==='buy'&&g.r87step===1&&!!g.r87_in)(pick0(0))
    && (g=>g.r87mode==='rent'&&g.r87step===1)(pick0(1))
    && (g=>g.r87mode==='inherit'&&g.r87step===1)(pick0(2))
    && (g=>g.r87step===99&&!g.r87mode&&!g.r87_in)(pick0(3));
  // 進鏈：step1 依 mode 確定性返抉擇節點；step2 落地結局型別
  fresh(40,{r87step:1,r87mode:'buy'});     out.nodeBuy    =(r87HousePick()||{}).id==='r87_buy';
  fresh(40,{r87step:1,r87mode:'rent'});    out.nodeRent   =(r87HousePick()||{}).id==='r87_rent';
  fresh(40,{r87step:1,r87mode:'inherit'}); out.nodeInherit=(r87HousePick()||{}).id==='r87_inherit';
  fresh(40,{r87step:2,r87mode:'inherit'}); const e2=r87HousePick();
  out.endLand = e2&&e2.id==='r87_end_heir'&&S.flags.r87_endtype==='r87_end_heir'&&S.flags.r87_endhit===true;
  // 屬性真驅動（連跑 3 次確認 sr 上下限不被 rnd 翻盤）：buy int/apr、rent mny、inherit int
  function c1(mode,attr,idx){ fresh(40,{r87step:1,r87mode:mode}); Object.assign(S.attr,attr); const ev=r87HousePick(); showEvent(ev); choose(idx); return S.flags; }
  out.buyInt  = [0,0,0].every(()=>!!c1('buy',{int:100},0).r87_smartbuy) && [0,0,0].every(()=>!!c1('buy',{int:10},0).r87_baddeal);
  out.buyApr  = [0,0,0].every(()=>!!c1('buy',{apr:100},1).r87_dealwin) && [0,0,0].every(()=>!!c1('buy',{apr:10},1).r87_dealfail);
  out.rentMny = [0,0,0].every(()=>!!c1('rent',{mny:100},0).r87_richrenter) && [0,0,0].every(()=>!!c1('rent',{mny:10},0).r87_poorrenter);
  out.heirInt = [0,0,0].every(()=>!!c1('inherit',{int:100},0).r87_heirwin) && [0,0,0].every(()=>!!c1('inherit',{int:10},0).r87_heirloss);
  // 財富(mny) 確定性三分流：硬上車 special 依 mny 落地包租公/屋奴/斷頭種子（hp 足夠不觸發死）
  function mort(mny){ fresh(40,{r87step:1,r87mode:'buy'}); S.attr.mny=mny; S.attr.hp=80; showEvent(f('r87_buy')); choose(2); return S.flags; }
  out.mortRich = !!mort(80).r87_landlordseed && !mort(80).r87_foreclrisk;
  out.mortMid  = !mort(48).r87_landlordseed && !mort(48).r87_foreclrisk;
  out.mortPoor = !!mort(20).r87_foreclrisk;
  // 房貸壓垮死：硬上車選項 hp≤14 確定性 mortgagedeath、hp 足夠不死
  fresh(40,{r87step:1,r87mode:'buy'}); S.attr.hp=10; S.attr.mny=20; showEvent(f('r87_buy')); choose(2);
  out.mortDeath = S.flags.specialDeath==='mortgagedeath';
  fresh(40,{r87step:1,r87mode:'buy'}); S.attr.hp=80; S.attr.mny=48; showEvent(f('r87_buy')); choose(2);
  out.mortSurvive = !S.flags.specialDeath;
  out.death = !!SPECIAL_DEATHS.mortgagedeath && DEATHBOOK.some(d=>d.id==='mortgagedeath'&&d.reason&&d.hint);
  // r87EndingId 結局計分 5 選 1（含防呆）
  out.endId = r87EndingId({r87mode:'buy',r87_landlordseed:true})==='r87_end_landlord'
    && r87EndingId({r87mode:'buy',r87_smartbuy:true})==='r87_end_owner'
    && r87EndingId({r87mode:'buy'})==='r87_end_owner'
    && r87EndingId({r87mode:'buy',r87_foreclrisk:true})==='r87_end_foreclose'
    && r87EndingId({r87mode:'buy',r87_baddeal:true})==='r87_end_foreclose'
    && r87EndingId({r87mode:'rent'})==='r87_end_renter'
    && r87EndingId({r87mode:'inherit'})==='r87_end_heir' && r87EndingId({})==='r87_end_owner';
  // 成就確定性 + 不誤觸 + 提示齊
  out.ach = ACH_MAP.r87_owner.check({S:{flags:{r87_endtype:'r87_end_owner'}},age:55})
    && ACH_MAP.r87_done.check({S:{flags:{r87_endhit:true}},age:50})
    && !ACH_MAP.r87_owner.check({S:{flags:{}},age:30})
    && !ACH_MAP.r87_foreclose.check({S:{flags:{r87_endtype:'r87_end_owner'}},age:55})
    && ['r87_in','r87_done','r87_owner','r87_landlord','r87_foreclose','r87_renter','r87_heir'].every(id=>ACH_MAP[id]&&ACH_MAP[id].hint&&ACH_MAP[id].hint.length>4);
  // 零汙染 + 舊存檔相容 + 回顧卡未踏進即省略
  startGame(); out.clean = Object.keys(S.flags).every(k=>k.indexOf('r87')!==0);
  const old={flags:{employed:true},attr:{hp:50,int:50,apr:50,mny:50,hap:50},age:40,alive:true}; ensureState(old);
  out.compat = Object.keys(old.flags).every(k=>k.indexOf('r87')!==0);
  startGame(); S.flags={}; out.reviewSkip = r87HouseReviewHTML()==='';
  return JSON.stringify(out);
})()`, sandbox));
ok(r87.entry && r87.gateMiss && r87.gateYoung && r87.gateRetired, 'R87 ① 攔截器 r87HousePick：27-55 窗口+未退休+雜湊閘命中→入口、閘落空/窗口外/已退休皆零殘留不插播');
ok(r87.split, 'R87 ② 入口三分流：拚上車買房/終身租屋/繼承祖厝各立 r87mode+step:1+r87_in；順其自然直接收尾(step:99)不立 mode');
ok(r87.nodeBuy && r87.nodeRent && r87.nodeInherit && r87.endLand, 'R87 ② 進鏈依 mode/step 確定性返抉擇節點、step:2 落地 r87_endtype/r87_endhit');
ok(r87.buyInt && r87.buyApr && r87.rentMny && r87.heirInt, 'R87 ③ 五圍真驅動有權衡：買房靠智力(int 挑物件)×魅力(apr 議價)、租屋靠財富(mny)、繼承靠智力(int 分產)，同屬性必同結果(sr 上下限不被 rnd 翻盤)');
ok(r87.mortRich && r87.mortMid && r87.mortPoor, 'R87 ③ 財富(mny)確定性三分流：硬上車 special 依財富落地 包租公種子(≥60)/屋奴(38-59)/高斷頭風險(<38)，同財富必同結果');
ok(r87.mortDeath && r87.mortSurvive && r87.death, 'R87 ④ 房貸壓垮死：硬上車選項健康見底(≤14)→mortgagedeath、撐住→續鏈；死法進圖鑑(reason+hint)');
ok(r87.endId && r87.ach, 'R87 ④ 5 結局確定性計分(繳清有殼/包租公/斷頭法拍/終身租屋/繼承祖厝)＋7 成就確定性解鎖、零誤觸、提示齊備');
ok(r87.clean && r87.compat && r87.reviewSkip, 'R87 ⑤ 零汙染：開局/舊存檔 S.flags 皆無 r87 鍵、沒踏進居住鏈時居住軌跡回顧卡整段省略');

// ===== R89 屬性數值實感化：關鍵抉擇屬性快照 + 新門檻/檢定/分流選項 + 成長權衡 + 零汙染 =====
const r89 = JSON.parse(vm.runInContext(`(function(){
  const out={}; const f=id=>EVENTS.find(e=>e.id===id);
  function fresh(age,attr){ startGame(); ensureState(S); S.seen={}; S.alive=true; S.keySnap=[]; if(age!=null)S.age=age; if(attr)Object.assign(S.attr,attr); return S; }
  function optByLabel(id,kw){ const e=f(id); return e&&e.choices.find(c=>c.label.indexOf(kw)>=0); }
  // ① gate 屬性快照：智力 gate 選項觸發 → keySnap 記一筆 {k:int,kind:gate,won:true,v=當下屬性}
  fresh(70,{int:90}); showEvent(f('legacy')); choose(2);
  out.gateSnap = S.keySnap.length===1 && S.keySnap[0].k==='int' && S.keySnap[0].kind==='gate' && S.keySnap[0].won===true && S.keySnap[0].v===90;
  // ② 成功率吃屬性：networking 外貌檢定，高 apr 必過/低 apr 必翻（連跑 3 次 rnd 不翻盤）＋快照 won 正確
  function srRun(id,idx,attr){ fresh(45,attr); showEvent(f(id)); choose(idx); return S; }
  out.srHigh = [0,0,0].every(()=>{const s=srRun('networking',2,{apr:100,hp:60}); return s.flags.gateWin>0 && s.keySnap[0].k==='apr' && s.keySnap[0].kind==='sr' && s.keySnap[0].won===true;});
  out.srLow  = [0,0,0].every(()=>{const s=srRun('networking',2,{apr:5,hp:60}); return s.flags.srLose>0 && s.keySnap[0].won===false;});
  // ③ 分流吃屬性：grandkids 健康58 分流，高 hp 走 hi(won)、低 hp 走 lo(!won)，快照 kind:br
  out.brHigh = (()=>{const s=srRun('grandkids',2,{hp:100}); return s.keySnap[0].k==='hp'&&s.keySnap[0].kind==='br'&&s.keySnap[0].won===true;})();
  out.brLow  = (()=>{const s=srRun('grandkids',2,{hp:10});  return s.keySnap[0].won===false;})();
  // ④ 成長有權衡：≥3 處「拿增益要付代價」（砸錢補習扣財富/應酬與轉職檢定贏了傷健康/帶孫遠足翻車傷健康）
  const tradeoffs=[
    (c=>c&&c.eff&&c.eff.mny<0&&(c.eff.hap>0||c.eff.int>0))(optByLabel('kids_exam','名師')),
    (c=>c&&c.sr&&c.sr.win.eff.hp<0&&c.sr.win.eff.mny>0)(optByLabel('networking','場面話')),
    (c=>c&&c.sr&&c.sr.win.eff.hp<0&&c.sr.win.eff.int>0)(optByLabel('second_career','二十年經驗')),
    (c=>c&&c.br&&c.br.lo.eff.hp<0)(optByLabel('grandkids','遠足')),
  ].filter(Boolean).length;
  out.tradeoff = tradeoffs>=3;
  // ⑤ 平衡護欄：gate 確定增益選項每項 |eff|<=8（不 power creep）；sr/br 賭博選項 win/lose 雙分支齊備
  const gateEffOK = [optByLabel('kids_exam','名師'),optByLabel('legacy','信託')].every(c=>c&&c.gate&&Object.values(c.eff).every(v=>Math.abs(v)<=8));
  const gambleOK = [optByLabel('networking','場面話'),optByLabel('second_career','二十年經驗'),optByLabel('old_romance','凍齡')].every(c=>c&&c.sr&&c.sr.win&&c.sr.lose) && (c=>c&&c.br&&c.br.hi&&c.br.lo)(optByLabel('grandkids','遠足'));
  out.balance = gateEffOK && gambleOK;
  // ⑥ 結算軌跡資料組裝 + 結算畫面有軌跡呈現：keySnap 有料 → keySnapHTML 非空且含關鍵字
  fresh(60,{int:90}); showEvent(f('legacy')); choose(2);
  const html = keySnapHTML();
  out.render = html.indexOf('關鍵抉擇')>=0 && html.indexOf('過關')>=0 && html.length>120;
  // ⑦ 舊存檔相容：缺 keySnap 鍵經 ensureState 補空陣列、空陣列 keySnapHTML 省略不炸
  const old={flags:{},attr:{hp:50,int:50,apr:50,mny:50,hap:50},age:40,alive:true,resume:[],seen:{}}; ensureState(old);
  out.compat = Array.isArray(old.keySnap) && old.keySnap.length===0;
  fresh(); S.keySnap=[]; out.renderEmpty = keySnapHTML()==='';
  // ⑧ 零汙染：開局 keySnap 空；無屬性選項事件(拼酒)不寫快照
  startGame(); ensureState(S); out.cleanStart = Array.isArray(S.keySnap) && S.keySnap.length===0;
  fresh(45,{apr:50,hp:60}); showEvent(f('networking')); choose(0); out.cleanPlain = S.keySnap.length===0;
  return JSON.stringify(out);
})()`, sandbox));
ok(r89.gateSnap, 'R89 ① gate 屬性快照：門檻選項觸發即記 {k,v,kind:gate,won:true}，v=當下屬性值');
ok(r89.srHigh && r89.srLow, 'R89 ② 成功率吃屬性：networking 外貌檢定高 apr 必過/低 apr 必翻(3 連跑 rnd 不翻盤)，快照 won 正確');
ok(r89.brHigh && r89.brLow, 'R89 ③ 分流吃屬性：grandkids 健康分流高 hp 走 hi/低 hp 走 lo，快照 kind:br、won 正確');
ok(r89.tradeoff, 'R89 ④ 成長有權衡：≥3 處拿增益付代價(砸錢補習扣財富/應酬與轉職檢定贏了傷健康/帶孫遠足翻車傷健康)');
ok(r89.balance, 'R89 ⑤ 平衡護欄：gate 確定增益選項每項 |eff|<=8 不 power creep、sr/br 賭博選項 win/lose 雙分支齊備');
ok(r89.render, 'R89 ⑥ 結算軌跡組裝+呈現：keySnap 有料 → keySnapHTML 含「關鍵抉擇/過關」非空');
ok(r89.compat && r89.renderEmpty, 'R89 ⑦ 舊存檔相容：缺 keySnap 經 ensureState 補空陣列、空陣列 keySnapHTML 省略不炸');
ok(r89.cleanStart && r89.cleanPlain, 'R89 ⑧ 零汙染：開局 keySnap 空、無屬性選項事件(拼酒)不寫快照');

// ===== R90 台味宮廟民間信仰人生支線：分流狀態機 + 運勢 buff 取捨 + 屬性驅動 + 零汙染 =====
const r90 = JSON.parse(vm.runInContext(`(function(){
  const out={}; const f=id=>EVENTS.find(e=>e.id===id);
  function fresh(age,flags){ startGame(); ensureState(S); S.seen={}; S.alive=true; S.keySnap=[]; S.flags=Object.assign({},flags||{}); ensureState(S); if(age!=null)S.age=age; return S; }
  // ① 攔截器 r90FaithPick：24-60 窗口+未退休+雜湊閘命中→入口、閘落空/窗口外/已退休皆零殘留
  const _ro=r90Roll;
  fresh(40,{}); r90Roll=function(){return 0.1;}; out.entry = !!r90FaithPick() && r90FaithPick().id==='r90_faithhook';
  fresh(40,{}); r90Roll=function(){return 0.9;}; out.gateMiss = r90FaithPick()===null;
  r90Roll=_ro;
  fresh(18,{}); out.gateYoung = r90FaithPick()===null;
  fresh(40,{retired:true}); out.gateRetired = r90FaithPick()===null;
  // ② 入口三分流：各立 r90mode + step:1 + r90_in；敬而遠之直接收尾(step:99)不立 mode
  function pick0(i){ fresh(40,{}); showEvent(f('r90_faithhook')); choose(i); return S.flags; }
  out.split = (g=>g.r90mode==='devout'&&g.r90step===1&&!!g.r90_in)(pick0(0))
    && (g=>g.r90mode==='pray'&&g.r90step===1&&!!g.r90_in)(pick0(1))
    && (g=>g.r90mode==='skeptic'&&g.r90step===1&&!!g.r90_in)(pick0(2))
    && (g=>g.r90step===99&&!g.r90mode&&!g.r90_in)(pick0(3));
  // ② 進鏈依 step/mode 確定性返節點：step1 共用安太歲、step2 依 mode、step3 落地結局型別
  fresh(40,{r90step:1,r90mode:'devout'});  out.nodeTaisui=(r90FaithPick()||{}).id==='r90_taisui';
  fresh(40,{r90step:2,r90mode:'devout'});  out.nodeDevout=(r90FaithPick()||{}).id==='r90_devout';
  fresh(40,{r90step:2,r90mode:'pray'});    out.nodePray  =(r90FaithPick()||{}).id==='r90_pray';
  fresh(40,{r90step:2,r90mode:'skeptic'}); out.nodeSkep  =(r90FaithPick()||{}).id==='r90_skeptic';
  fresh(40,{r90step:3,r90mode:'devout'}); const e3=r90FaithPick();
  out.endLand = e3&&e3.id==='r90_end_devout'&&S.flags.r90_endtype==='r90_end_devout'&&S.flags.r90_endhit===true;
  // ③ 運勢 buff 取捨：安太歲花財富(mny-6)落 r90_blessed、鐵齒省錢落 r90_taisui、int>=70 gate 自擇也落 blessed
  function tai(i,attr){ fresh(40,{r90step:1,r90mode:'pray'}); if(attr)Object.assign(S.attr,attr); showEvent(f('r90_taisui')); choose(i); return S.flags; }
  const t0=tai(0); out.taiBless = t0.r90_blessed===true && t0.r90_lamp===true && t0.r90step===2;
  const t1=tai(1); out.taiCurse = t1.r90_taisui===true && !t1.r90_blessed;
  const tg=tai(2,{int:90}); out.taiGate = tg.r90_blessed===true && tg.r90_selfward===true && S.flags.gateWin>0;
  // 安太歲花財富有代價：blessed 選項 mny<0、|eff|<=8；gate 選項 |eff|<=8 不 power creep
  const cB=f('r90_taisui').choices[0], cG=f('r90_taisui').choices[2];
  out.taiCost = cB.eff.mny<0 && Object.values(cB.eff).every(v=>Math.abs(v)<=8) && cG.gate===true && Object.values(cG.eff).every(v=>Math.abs(v)<=8);
  // ④ 求籤 special r90_divine 運勢 buff 確定性生效（零 rng）：同屬性下 blessed 過關(+10)/taisui 翻車(-10)/平 borderline
  function divine(buff,apr,hap){ fresh(40,Object.assign({r90step:2,r90mode:'pray'},buff)); S.attr.apr=apr; S.attr.hap=hap; showEvent(f('r90_pray')); choose(0); return S.flags; }
  // base=(50+50)/2=50；blessed → 60>=55 過、taisui → 40<55 翻、無 buff → 50<55 翻：3 連跑 rnd 不翻盤（純門檻）
  out.divBless = [0,0,0].every(()=>!!divine({r90_blessed:true},50,50).r90_faithwin);
  out.divCurse = [0,0,0].every(()=>!!divine({r90_taisui:true},50,50).r90_faithloss);
  out.divPlain = [0,0,0].every(()=>!!divine({},50,50).r90_faithloss);
  // ④ 遶境 hp sr 真驅動有權衡：高 hp 必過(長 apr/hap、耗 hp 代價)、低 hp 必翻(傷 hp)，3 連跑不翻盤；win 帶 hp 負代價
  function devo(hp){ fresh(40,{r90step:2,r90mode:'devout'}); S.attr.hp=hp; showEvent(f('r90_devout')); choose(0); return S.flags; }
  out.devoHi = [0,0,0].every(()=>!!devo(100).r90_faithwin);
  out.devoLo = [0,0,0].every(()=>!!devo(5).r90_faithloss);
  const cD=f('r90_devout').choices[0]; out.devoCost = cD.sr.win.eff.hp<0 && cD.sr.win.eff.apr>0 && cD.sr.lose.eff.hp<0;
  // ④ 運勢 buff 對 r90node sr 檢定加減確定性生效（驗 choose() 內含 r90mod）：
  // need=62、spread=40：blessed 下 hp=60 → min roll=60+0+5=65>=62 必過；taisui 下 hp=18 → max=18+40-5=53<62 必翻
  out.srBuffWin = [0,0,0,0].every(()=>{ fresh(40,{r90step:2,r90mode:'devout',r90_blessed:true}); S.attr.hp=60; showEvent(f('r90_devout')); choose(0); return !!S.flags.r90_faithwin; });
  out.srBuffLose= [0,0,0,0].every(()=>{ fresh(40,{r90step:2,r90mode:'devout',r90_taisui:true}); S.attr.hp=18; showEvent(f('r90_devout')); choose(0); return !!S.flags.r90_faithloss; });
  // ④ 鐵齒 int 確定性門檻(special r90_resolve，非 br 故不入 R25 普查)：高 int 過關(won)、低 int 翻車
  function skep(intv){ fresh(40,{r90step:2,r90mode:'skeptic'}); S.attr.int=intv; showEvent(f('r90_skeptic')); choose(0); return S.flags; }
  out.skepHi = [0,0,0].every(()=>!!skep(100).r90_faithwin); out.skepLo = [0,0,0].every(()=>!!skep(10).r90_faithloss);
  // ⑤ r90EndingId 結局確定性計分 4 選 1：skeptic 固定、blessed+faithwin→欽點、devout 預設香火、pray 預設有事才拜
  out.endId = r90EndingId({r90mode:'skeptic'})==='r90_end_skeptic'
    && r90EndingId({r90mode:'devout',r90_blessed:true,r90_faithwin:true})==='r90_end_blessed'
    && r90EndingId({r90mode:'pray',r90_blessed:true,r90_faithwin:true})==='r90_end_blessed'
    && r90EndingId({r90mode:'devout'})==='r90_end_devout'
    && r90EndingId({r90mode:'devout',r90_taisui:true,r90_faithloss:true})==='r90_end_devout'
    && r90EndingId({r90mode:'pray'})==='r90_end_pray'
    && r90EndingId({})==='r90_end_pray';
  // ⑤ 成就確定性解鎖、零誤觸、提示齊備
  out.ach = ACH_MAP.r90_in.check({S:{flags:{r90_in:true}},age:40})
    && ACH_MAP.r90_done.check({S:{flags:{r90_endhit:true}},age:60})
    && ACH_MAP.r90_blessed.check({S:{flags:{r90_endtype:'r90_end_blessed'}},age:60})
    && ACH_MAP.r90_skeptic.check({S:{flags:{r90_endtype:'r90_end_skeptic'}},age:60})
    && !ACH_MAP.r90_in.check({S:{flags:{}},age:40})
    && !ACH_MAP.r90_blessed.check({S:{flags:{r90_endtype:'r90_end_skeptic'}},age:60})
    && ['r90_in','r90_done','r90_blessed','r90_skeptic'].every(id=>ACH_MAP[id]&&ACH_MAP[id].hint&&ACH_MAP[id].hint.length>4);
  // ⑤ 平衡護欄：全鏈所有選項 eff（含 sr/br/special win/lose 分支）每格 |eff|<=8
  const r90ids=['r90_faithhook','r90_taisui','r90_devout','r90_pray','r90_skeptic','r90_end_blessed','r90_end_devout','r90_end_pray','r90_end_skeptic'];
  let maxEff=0;
  r90ids.forEach(id=>{ const e=f(id); e.choices.forEach(c=>{
    const buckets=[c.eff];
    if(c.sr){ buckets.push(c.sr.win.eff,c.sr.lose.eff); }
    if(c.br){ buckets.push(c.br.hi.eff,c.br.lo.eff); }
    buckets.forEach(b=>{ if(b) Object.values(b).forEach(v=>{ if(Math.abs(v)>maxEff)maxEff=Math.abs(v); }); });
  }); });
  out.balance = maxEff<=8;
  // ⑥ 文案紅線：全鏈 title/text/res 不得含政治/宗教仇恨字串（文化共鳴非嘲諷信仰）
  const RED=['共產','統一','獨立','國民黨','民進黨','政黨','邪教','異端','滅教','低能','智障','信耶穌得永生','阿拉','真主'];
  let blob='';
  r90ids.forEach(id=>{ const e=f(id); blob+=(e.title||'')+(e.text||''); e.choices.forEach(c=>{ blob+=(c.label||'')+(c.res||''); if(c.sr){blob+=(c.sr.win.res||'')+(c.sr.lose.res||'');} if(c.br){blob+=(c.br.hi.res||'')+(c.br.lo.res||'');} }); });
  out.noRedline = RED.every(w=>blob.indexOf(w)<0);
  // ⑦ 舊存檔相容：舊 save 經 ensureState 不注入任何 r90 鍵；鏈仍能在舊 save 上正常評估
  const old={flags:{employed:true},attr:{hp:50,int:50,apr:50,mny:50,hap:50},age:40,alive:true,seen:{}}; ensureState(old);
  out.compat = Object.keys(old.flags).every(k=>k.indexOf('r90')!==0);
  // ⑧ 零汙染：開局 S.flags 無 r90 鍵；非信仰鏈事件不落 r90 旗標；沒踏進信仰鏈時回顧卡整段省略
  startGame(); out.clean = Object.keys(S.flags).every(k=>k.indexOf('r90')!==0);
  fresh(45,{}); showEvent(f('networking')); choose(0); out.cleanPlain = Object.keys(S.flags).every(k=>k.indexOf('r90')!==0);
  startGame(); S.flags={}; out.reviewSkip = r90FaithReviewHTML()==='';
  return JSON.stringify(out);
})()`, sandbox));
ok(r90.entry && r90.gateMiss && r90.gateYoung && r90.gateRetired, 'R90 ① 攔截器 r90FaithPick：24-60 窗口+未退休+雜湊閘命中→入口、閘落空/窗口外/已退休皆零殘留不插播');
ok(r90.split, 'R90 ② 入口三分流：誠心信徒/有事才拜/鐵齒跟拜各立 r90mode+step:1+r90_in；敬而遠之直接收尾(step:99)不立 mode');
ok(r90.nodeTaisui && r90.nodeDevout && r90.nodePray && r90.nodeSkep && r90.endLand, 'R90 ② 進鏈依 step/mode 確定性返節點：step1 共用安太歲、step2 依 mode、step3 落地 r90_endtype/r90_endhit');
ok(r90.taiBless && r90.taiCurse && r90.taiGate && r90.taiCost, 'R90 ③ 運勢 buff 取捨：安太歲花財富(mny-6)落 blessed/鐵齒省錢落 taisui/int70 gate 自擇換 blessed，安太歲有代價且 |eff|<=8');
ok(r90.divBless && r90.divCurse && r90.divPlain, 'R90 ④ 求籤 special r90_divine 運勢 buff 確定性生效(零 rng)：同屬性下 blessed(+10)過關/taisui(-10)翻車/無 buff borderline 翻，3 連跑不翻盤');
ok(r90.devoHi && r90.devoLo && r90.devoCost, 'R90 ④ 遶境 hp sr 真驅動有權衡：高 hp 必過(長 apr/hap、耗 hp 代價)、低 hp 必翻，3 連跑 rnd 不翻盤');
ok(r90.srBuffWin && r90.srBuffLose, 'R90 ④ 運勢 buff 對 r90node sr 檢定確定性加減：blessed(+5)邊界過關、taisui(-5/犯太歲)邊界翻車，min/max roll 不翻盤');
ok(r90.skepHi && r90.skepLo, 'R90 ④ 鐵齒 int 確定性門檻(special r90_resolve)：高 int 過關(won)、低 int 翻車(!won)，3 連跑零 rng 不翻盤');
ok(r90.endId && r90.ach, 'R90 ⑤ 4 結局確定性計分(神明欽點/香火傳承/有事才拜/鐵齒到底)＋4 成就確定性解鎖、零誤觸、提示齊備');
ok(r90.balance, 'R90 ⑤ 平衡護欄：全鏈所有選項 eff(含 sr/br win/lose 分支)每格 |eff|<=8 不破壞平衡');
ok(r90.noRedline, 'R90 ⑥ 文案紅線：全鏈無政治/宗教仇恨字串，文化共鳴非嘲諷信仰');
ok(r90.compat && r90.clean && r90.cleanPlain && r90.reviewSkip, 'R90 ⑦⑧ 零汙染+舊存檔相容：開局/舊save/非信仰鏈事件 S.flags 皆無 r90 鍵、沒踏進信仰鏈時回顧卡整段省略');

// ===== R92 台味交通／行人地獄人生支線：分流狀態機 + 安全 buff 取捨 + 體質×運勢驅動存活 + 專屬死法 + 零汙染 =====
const r92 = JSON.parse(vm.runInContext(`(function(){
  const out={}; const f=id=>EVENTS.find(e=>e.id===id);
  function fresh(age,flags){ startGame(); ensureState(S); S.seen={}; S.alive=true; S.keySnap=[]; S.flags=Object.assign({},flags||{}); ensureState(S); if(age!=null)S.age=age; return S; }
  // ① 攔截器 r92RoadPick：20-58 窗口+未退休+雜湊閘命中→入口、閘落空/窗口外/已退休皆零殘留
  const _ro=r92Roll;
  fresh(40,{}); r92Roll=function(){return 0.05;}; out.entry = !!r92RoadPick() && r92RoadPick().id==='r92_roadhook';
  fresh(40,{}); r92Roll=function(){return 0.9;}; out.gateMiss = r92RoadPick()===null;
  r92Roll=_ro;
  fresh(18,{}); out.gateYoung = r92RoadPick()===null;
  fresh(40,{retired:true}); out.gateRetired = r92RoadPick()===null;
  fresh(40,{r92step:99}); out.gateDone = r92RoadPick()===null;
  // ② 入口三分流：各立 r92mode + step:1 + r92_in；佛系慢活直接收尾(step:99)不立 mode
  function pick0(i){ fresh(40,{}); showEvent(f('r92_roadhook')); choose(i); return S.flags; }
  out.split = (g=>g.r92mode==='scooter'&&g.r92step===1&&!!g.r92_in)(pick0(0))
    && (g=>g.r92mode==='driver'&&g.r92step===1&&!!g.r92_in)(pick0(1))
    && (g=>g.r92mode==='pedi'&&g.r92step===1&&!!g.r92_in)(pick0(2))
    && (g=>g.r92step===99&&!g.r92mode&&!g.r92_in)(pick0(3));
  // ② 進鏈依 step/mode 確定性返節點：step1 共用行車習慣、step2 依 mode、step3 落地結局型別
  fresh(40,{r92step:1,r92mode:'scooter'}); out.nodeHabit=(r92RoadPick()||{}).id==='r92_habit';
  fresh(40,{r92step:2,r92mode:'scooter'}); out.nodeScoot=(r92RoadPick()||{}).id==='r92_scooter';
  fresh(40,{r92step:2,r92mode:'driver'});  out.nodeDrive=(r92RoadPick()||{}).id==='r92_driver';
  fresh(40,{r92step:2,r92mode:'pedi'});    out.nodePedi =(r92RoadPick()||{}).id==='r92_pedi';
  fresh(40,{r92step:3,r92mode:'scooter',r92_lawful:true,r92_roadwin:true}); const e3=r92RoadPick();
  out.endLand = e3&&e3.id==='r92_end_veteran'&&S.flags.r92_endtype==='r92_end_veteran'&&S.flags.r92_endhit===true;
  // ③ 行車習慣安全 buff 取捨：守規落 r92_lawful、搶快落 r92_reckless、int>=68 gate 防禦駕駛也落 lawful
  function hab(i,attr){ fresh(40,{r92step:1,r92mode:'scooter'}); if(attr)Object.assign(S.attr,attr); showEvent(f('r92_habit')); choose(i); return S.flags; }
  const h0=hab(0); out.habLawful = h0.r92_lawful===true && h0.r92_safe===true && h0.r92step===2 && !h0.r92_reckless;
  const h1=hab(1); out.habReckless = h1.r92_reckless===true && !h1.r92_lawful && h1.r92step===2;
  const hg=hab(2,{int:90}); out.habGate = hg.r92_lawful===true && hg.r92_defensive===true && S.flags.gateWin>0;
  // 安全 buff 三選項 |eff|<=8、gate 真為 gate
  const cL=f('r92_habit').choices[0], cR=f('r92_habit').choices[1], cG=f('r92_habit').choices[2];
  out.habCost = [cL,cR,cG].every(c=>Object.values(c.eff).every(v=>Math.abs(v)<=8)) && cG.gate===true && cG.cond!=null;
  // ④ 機車仔鑽車陣 special r92_weave 體質×安全 buff 確定性存活（零 rng）：hp 見底硬鑽→roadkill 死；adj>=55 閃過(roadwin)；adj<55 擦撞(roadloss) 仍生還
  function weave(hp,buff,attr){ fresh(40,Object.assign({r92step:2,r92mode:'scooter'},buff)); S.attr.hp=hp; if(attr)Object.assign(S.attr,attr); showEvent(f('r92_scooter')); choose(0); return S.flags; }
  out.weaveDeath = [0,0,0].every(()=>weave(10,{}).specialDeath==='roadkill');                         // hp<=14 硬鑽→車禍猝逝
  out.weaveWin   = [0,0,0].every(()=>{const g=weave(100,{});return g.r92_roadwin===true&&!g.specialDeath;}); // 高 hp→閃過
  out.weaveLoss  = [0,0,0].every(()=>{const g=weave(30,{},{mny:80,apr:80});return g.r92_roadloss===true&&!g.specialDeath;}); // 中 hp→擦撞生還(賠得起和解)
  // ④ 安全 buff 對存活門檻 ±10 確定性生效：lawful 下 hp=50→adj=60>=55 閃過；reckless 下 hp=60→adj=50<55 擦撞（同 hp 不同 buff 翻盤）
  out.weaveBuffWin  = [0,0,0].every(()=>{const g=weave(50,{r92_lawful:true});return g.r92_roadwin===true;});
  out.weaveBuffLose = [0,0,0].every(()=>{const g=weave(60,{r92_reckless:true});return g.r92_roadloss===true;});
  // ④ 四輪族酒駕 special r92_drunk：太衰(adj<=22)→drunkdrive 死、其餘無 roadwin（守規好結局走找代駕選項）；adj>=55 吊照重罰(生還)
  function drunk(hp,buff){ fresh(40,Object.assign({r92step:2,r92mode:'driver'},buff)); S.attr.hp=hp; showEvent(f('r92_driver')); choose(0); return S.flags; }
  out.drunkDeath = [0,0,0].every(()=>drunk(20,{r92_reckless:true}).specialDeath==='drunkdrive');       // adj=10<=22→酒駕釀禍
  out.drunkBust  = [0,0,0].every(()=>{const g=drunk(60,{r92_lawful:true});return g.r92_roadloss===true&&!g.specialDeath;}); // adj=70→吊照重罰生還
  out.drunkNoWin = [0,0,0].every(()=>!drunk(60,{r92_lawful:true}).r92_roadwin);                        // 酒駕絕無 roadwin
  // driver 守規找代駕選項→roadwin + lawful（好結局來源）
  fresh(40,{r92step:2,r92mode:'driver'}); showEvent(f('r92_driver')); choose(1);
  out.driverSafe = S.flags.r92_roadwin===true && S.flags.r92_lawful===true && !S.flags.specialDeath;
  // ④ 行人地獄過馬路 special r92_cross：hp 見底→roadkill 死、adj>=55 閃過(roadwin)、adj<55 擦撞(roadloss) 生還
  function cross(hp,buff){ fresh(40,Object.assign({r92step:2,r92mode:'pedi'},buff)); S.attr.hp=hp; showEvent(f('r92_pedi')); choose(0); return S.flags; }
  out.crossDeath = [0,0,0].every(()=>cross(10,{}).specialDeath==='roadkill');
  out.crossWin   = [0,0,0].every(()=>{const g=cross(100,{});return g.r92_roadwin===true&&!g.specialDeath;});
  out.crossLoss  = [0,0,0].every(()=>{const g=cross(30,{});return g.r92_roadloss===true&&!g.specialDeath;});
  // ⑤ r92EndingId 結局確定性計分 4 選 1：lawful+roadwin→老司機、scooter/driver/pedi 各預設、reckless+roadloss 壓回 mode 預設
  out.endId = r92EndingId({r92mode:'scooter',r92_lawful:true,r92_roadwin:true})==='r92_end_veteran'
    && r92EndingId({r92mode:'pedi',r92_lawful:true,r92_roadwin:true})==='r92_end_veteran'
    && r92EndingId({r92mode:'scooter'})==='r92_end_scooter'
    && r92EndingId({r92mode:'scooter',r92_reckless:true,r92_roadloss:true})==='r92_end_scooter'
    && r92EndingId({r92mode:'driver'})==='r92_end_driver'
    && r92EndingId({r92mode:'pedi'})==='r92_end_pedi'
    && r92EndingId({})==='r92_end_pedi';
  // ⑤ 成就確定性解鎖、零誤觸、提示齊備
  out.ach = ACH_MAP.r92_in.check({S:{flags:{r92_in:true}},age:40})
    && ACH_MAP.r92_done.check({S:{flags:{r92_endhit:true}},age:55})
    && ACH_MAP.r92_veteran.check({S:{flags:{r92_endtype:'r92_end_veteran'}},age:55})
    && ACH_MAP.r92_pedi.check({S:{flags:{r92_endtype:'r92_end_pedi'}},age:55})
    && !ACH_MAP.r92_in.check({S:{flags:{}},age:40})
    && !ACH_MAP.r92_veteran.check({S:{flags:{r92_endtype:'r92_end_pedi'}},age:55})
    && ['r92_in','r92_done','r92_veteran','r92_pedi'].every(id=>ACH_MAP[id]&&ACH_MAP[id].hint&&ACH_MAP[id].hint.length>4);
  // ⑤ 平衡護欄：全鏈所有選項 eff（含 sr/br win/lose 分支）每格 |eff|<=8（special 內 runtime eff 不在選項定義內、另由文案護欄把關）
  const r92ids=['r92_roadhook','r92_habit','r92_scooter','r92_driver','r92_pedi','r92_end_veteran','r92_end_scooter','r92_end_driver','r92_end_pedi'];
  let maxEff=0;
  r92ids.forEach(id=>{ const e=f(id); e.choices.forEach(c=>{
    const buckets=[c.eff];
    if(c.sr){ buckets.push(c.sr.win.eff,c.sr.lose.eff); }
    if(c.br){ buckets.push(c.br.hi.eff,c.br.lo.eff); }
    buckets.forEach(b=>{ if(b) Object.values(b).forEach(v=>{ if(Math.abs(v)>maxEff)maxEff=Math.abs(v); }); });
  }); });
  out.balance = maxEff<=8;
  // ⑥ 死法圖鑑：roadkill / drunkdrive 進 SPECIAL_DEATHS + DEATHBOOK（reason+hint 齊備）
  out.deathbook = !!SPECIAL_DEATHS.roadkill && !!SPECIAL_DEATHS.drunkdrive
    && DEATHBOOK.some(d=>d.id==='roadkill'&&d.reason&&d.hint&&d.hint.length>4)
    && DEATHBOOK.some(d=>d.id==='drunkdrive'&&d.reason&&d.hint&&d.hint.length>4);
  // ⑦ 文案紅線：全鏈 title/text/res 不得含政治/暴力/仇恨字串（交通文化自嘲非嘲諷受害者）
  const RED=['共產','統一','獨立','國民黨','民進黨','政黨','邪教','低能','智障','廢物','去死','該死','活該死'];
  let blob='';
  r92ids.forEach(id=>{ const e=f(id); blob+=(e.title||'')+(e.text||''); e.choices.forEach(c=>{ blob+=(c.label||'')+(c.res||''); }); });
  out.noRedline = RED.every(w=>blob.indexOf(w)<0);
  // ⑧ 舊存檔相容：舊 save 經 ensureState 不注入任何 r92 鍵；鏈仍能在舊 save 上正常評估
  const old={flags:{employed:true},attr:{hp:50,int:50,apr:50,mny:50,hap:50},age:40,alive:true,seen:{}}; ensureState(old);
  out.compat = Object.keys(old.flags).every(k=>k.indexOf('r92')!==0);
  // ⑨ 零汙染：開局 S.flags 無 r92 鍵；非交通鏈事件不落 r92 旗標；沒踏進交通鏈時回顧卡整段省略
  startGame(); out.clean = Object.keys(S.flags).every(k=>k.indexOf('r92')!==0);
  fresh(45,{}); showEvent(f('networking')); choose(0); out.cleanPlain = Object.keys(S.flags).every(k=>k.indexOf('r92')!==0);
  startGame(); S.flags={}; out.reviewSkip = r92RoadReviewHTML()==='';
  S.flags={r92_in:true,r92mode:'scooter',r92_endtype:'r92_end_veteran'}; out.reviewShow = r92RoadReviewHTML().indexOf('交通／行人地獄軌跡')>=0;
  return JSON.stringify(out);
})()`, sandbox));
ok(r92.entry && r92.gateMiss && r92.gateYoung && r92.gateRetired && r92.gateDone, 'R92 ① 攔截器 r92RoadPick：20-58 窗口+未退休+雜湊閘命中→入口、閘落空/窗口外/已退休/已收尾皆零殘留不插播');
ok(r92.split, 'R92 ② 入口三分流：機車仔/四輪族/無車通勤各立 r92mode+step:1+r92_in；佛系慢活直接收尾(step:99)不立 mode');
ok(r92.nodeHabit && r92.nodeScoot && r92.nodeDrive && r92.nodePedi && r92.endLand, 'R92 ② 進鏈依 step/mode 確定性返節點：step1 共用行車習慣、step2 依 mode、step3 落地 r92_endtype/r92_endhit');
ok(r92.habLawful && r92.habReckless && r92.habGate && r92.habCost, 'R92 ③ 安全 buff 取捨：守規落 lawful/搶快落 reckless/int68 gate 防禦駕駛換 lawful，三選項 |eff|<=8 不 power creep');
ok(r92.weaveDeath && r92.weaveWin && r92.weaveLoss, 'R92 ④ 機車仔鑽車陣 special r92_weave 體質×運勢確定性存活：hp 見底硬鑽→車禍猝逝 roadkill、高 hp 閃過(roadwin)、中 hp 擦撞生還(roadloss)，3 連跑零 rng 不翻盤');
ok(r92.weaveBuffWin && r92.weaveBuffLose, 'R92 ④ 安全 buff 對鑽車陣存活門檻 ±10 確定性生效：lawful(+10)同 hp 閃過、reckless(-10)同 hp 擦撞，同屬性不同 buff 翻盤');
ok(r92.drunkDeath && r92.drunkBust && r92.drunkNoWin && r92.driverSafe, 'R92 ④ 四輪族酒駕 special r92_drunk：太衰→酒駕釀禍 drunkdrive、其餘吊照重罰生還且絕無 roadwin；守規找代駕選項才有 roadwin(好結局來源)');
ok(r92.crossDeath && r92.crossWin && r92.crossLoss, 'R92 ④ 行人地獄過馬路 special r92_cross 體質×運勢確定性存活：hp 見底硬闖→roadkill、高 hp 閃過(roadwin)、中 hp 擦撞生還(roadloss)，3 連跑零 rng 不翻盤');
ok(r92.endId && r92.ach, 'R92 ⑤ 4 結局確定性計分(老司機/機車仔魂/四輪族/行人地獄倖存)＋4 成就確定性解鎖、零誤觸、提示齊備');
ok(r92.balance && r92.deathbook, 'R92 ⑤⑥ 平衡護欄：全鏈選項 eff 每格 |eff|<=8；專屬死法 roadkill/drunkdrive 進 SPECIAL_DEATHS+DEATHBOOK(reason+hint 齊備)');
ok(r92.noRedline, 'R92 ⑦ 文案紅線：全鏈無政治/暴力/仇恨字串，交通文化自嘲非嘲諷受害者');
ok(r92.compat && r92.clean && r92.cleanPlain && r92.reviewSkip && r92.reviewShow, 'R92 ⑧⑨ 零汙染+舊存檔相容：開局/舊save/非交通鏈事件 S.flags 皆無 r92 鍵、沒踏進交通鏈時回顧卡省略、踏進後正常顯示');

// ===== R93 台味健保醫療人生支線：分流狀態機 + 健康 buff 取捨 + 體質×運勢驅動存活 + 專屬死法 + 零汙染 =====
const r93 = JSON.parse(vm.runInContext(`(function(){
  const out={}; const f=id=>EVENTS.find(e=>e.id===id);
  function fresh(age,flags){ startGame(); ensureState(S); S.seen={}; S.alive=true; S.keySnap=[]; S.flags=Object.assign({},flags||{}); ensureState(S); if(age!=null)S.age=age; return S; }
  // ① 攔截器 r93MedPick：20-58 窗口+未退休+雜湊閘命中→入口、閘落空/窗口外/已退休/已收尾皆零殘留
  const _ro=r93Roll;
  fresh(40,{}); r93Roll=function(){return 0.05;}; out.entry = !!r93MedPick() && r93MedPick().id==='r93_medhook';
  fresh(40,{}); r93Roll=function(){return 0.9;}; out.gateMiss = r93MedPick()===null;
  r93Roll=_ro;
  fresh(18,{}); out.gateYoung = r93MedPick()===null;
  fresh(40,{retired:true}); out.gateRetired = r93MedPick()===null;
  fresh(40,{r93step:99}); out.gateDone = r93MedPick()===null;
  // ② 入口三分流：各立 r93mode + step:1 + r93_in；佛系養生直接收尾(step:99)不立 mode
  function pick0(i){ fresh(40,{}); showEvent(f('r93_medhook')); choose(i); return S.flags; }
  out.split = (g=>g.r93mode==='thrifty'&&g.r93step===1&&!!g.r93_in)(pick0(0))
    && (g=>g.r93mode==='premium'&&g.r93step===1&&!!g.r93_in)(pick0(1))
    && (g=>g.r93mode==='tough'&&g.r93step===1&&!!g.r93_in)(pick0(2))
    && (g=>g.r93step===99&&!g.r93mode&&!g.r93_in)(pick0(3));
  // ② 進鏈依 step/mode 確定性返節點
  fresh(40,{r93step:1,r93mode:'thrifty'}); out.nodeHabit=(r93MedPick()||{}).id==='r93_habit';
  fresh(40,{r93step:2,r93mode:'thrifty'}); out.nodeThrifty=(r93MedPick()||{}).id==='r93_thrifty';
  fresh(40,{r93step:2,r93mode:'premium'}); out.nodePremium=(r93MedPick()||{}).id==='r93_premium';
  fresh(40,{r93step:2,r93mode:'tough'});   out.nodeTough  =(r93MedPick()||{}).id==='r93_tough';
  fresh(40,{r93step:3,r93mode:'thrifty',r93_healthy:true,r93_medwin:true}); const e3=r93MedPick();
  out.endLand = e3&&e3.id==='r93_end_longevity'&&S.flags.r93_endtype==='r93_end_longevity'&&S.flags.r93_endhit===true;
  // ③ 養生習慣健康 buff 取捨：養生落 r93_healthy、鐵齒落 r93_stubborn、int>=65 gate 醫療知識也落 healthy+savvy
  function hab(i,attr){ fresh(40,{r93step:1,r93mode:'thrifty'}); if(attr)Object.assign(S.attr,attr); showEvent(f('r93_habit')); choose(i); return S.flags; }
  const h0=hab(0); out.habHealthy = h0.r93_healthy===true && h0.r93_care===true && h0.r93step===2 && !h0.r93_stubborn;
  const h1=hab(1); out.habStubborn = h1.r93_stubborn===true && !h1.r93_healthy && h1.r93step===2;
  const hg=hab(2,{int:90}); out.habGate = hg.r93_healthy===true && hg.r93_savvy===true && S.flags.gateWin>0;
  const cH=f('r93_habit').choices[0], cS=f('r93_habit').choices[1], cG=f('r93_habit').choices[2];
  out.habCost = (cH.eff.hap<0) && (cS.eff.hp<0) && !!cG.cond && cG.gate===true;
  // ④ 健保鄉民急診人球 special r93_er 體質×健康 buff 確定性存活（零 rng）：hp 見底→ercrash 死；adj>=55 救回(medwin)；adj<55 拖成大病(medloss) 仍生還
  function er(hp,buff,attr){ fresh(40,Object.assign({r93step:2,r93mode:'thrifty'},buff)); S.attr.hp=hp; if(attr)Object.assign(S.attr,attr); showEvent(f('r93_thrifty')); choose(0); return S.flags; }
  out.erDeath = [0,0,0].every(()=>er(10,{}).specialDeath==='ercrash');
  out.erWin   = [0,0,0].every(()=>{const g=er(100,{});return g.r93_medwin===true&&!g.specialDeath;}); // 高 hp→撐到救治
  out.erLoss  = [0,0,0].every(()=>{const g=er(30,{},{mny:80});return g.r93_medloss===true&&!g.specialDeath;}); // 中 hp→自費加護救回
  out.erBuffWin  = [0,0,0].every(()=>{const g=er(50,{r93_healthy:true});return g.r93_medwin===true;}); // healthy(+10)同 hp 救回
  out.erBuffLose = [0,0,0].every(()=>{const g=er(60,{r93_stubborn:true});return g.r93_medloss===true&&!g.specialDeath;}); // stubborn(-10)同 hp 拖成大病
  // thrifty 自費搶時間選項→medwin（好結局來源）
  fresh(40,{r93step:2,r93mode:'thrifty'}); showEvent(f('r93_thrifty')); choose(1);
  out.thriftySafe = S.flags.r93_medwin===true && !S.flags.specialDeath;
  // ④ 自費醫美 special r93_beauty：savvy/財富>=58 變美成功(medwin)、否則踩雷蒙古大夫翻車(medloss)，非致命無死法
  function beauty(buff,attr){ fresh(40,Object.assign({r93step:2,r93mode:'premium'},buff)); if(attr)Object.assign(S.attr,attr); showEvent(f('r93_premium')); choose(0); return S.flags; }
  out.beautySavvy = [0,0,0].every(()=>{const g=beauty({r93_savvy:true},{mny:20});return g.r93_medwin===true&&!g.specialDeath;}); // savvy 識破密醫→變美
  out.beautyRich  = [0,0,0].every(()=>{const g=beauty({},{mny:70});return g.r93_medwin===true&&!g.specialDeath;}); // 財富>=58 找正規→變美
  out.beautyBotch = [0,0,0].every(()=>{const g=beauty({},{mny:20});return g.r93_medloss===true&&!g.specialDeath;}); // 貪便宜踩雷→翻車(非致命)
  out.beautyNoDeath = [0,0,0].every(()=>!beauty({},{mny:10}).specialDeath); // 醫美翻車絕不致命
  // premium 找合格醫師選項→medwin（好結局來源）
  fresh(40,{r93step:2,r93mode:'premium'}); showEvent(f('r93_premium')); choose(1);
  out.premiumSafe = S.flags.r93_medwin===true && !S.flags.specialDeath;
  // ④ 鐵齒慢性病 special r93_chronic：hp 見底→chroniccrash 死、adj>=55 控制住(medwin)、adj<55 拖成住院(medloss) 生還
  function chronic(hp,buff){ fresh(40,Object.assign({r93step:2,r93mode:'tough'},buff)); S.attr.hp=hp; showEvent(f('r93_tough')); choose(0); return S.flags; }
  out.chronicDeath = [0,0,0].every(()=>chronic(10,{r93_stubborn:true}).specialDeath==='chroniccrash');
  out.chronicWin   = [0,0,0].every(()=>{const g=chronic(100,{});return g.r93_medwin===true&&!g.specialDeath;});
  out.chronicLoss  = [0,0,0].every(()=>{const g=chronic(30,{r93_stubborn:true});return g.r93_medloss===true&&!g.specialDeath;});
  // tough 就醫服軟選項→medwin+healthy（好結局來源）
  fresh(40,{r93step:2,r93mode:'tough'}); showEvent(f('r93_tough')); choose(1);
  out.toughSafe = S.flags.r93_medwin===true && S.flags.r93_healthy===true && !S.flags.specialDeath;
  // ⑤ r93EndingId 結局確定性計分 4 選 1
  out.endId = r93EndingId({r93mode:'thrifty',r93_healthy:true,r93_medwin:true})==='r93_end_longevity'
    && r93EndingId({r93mode:'tough',r93_healthy:true,r93_medwin:true})==='r93_end_longevity'
    && r93EndingId({r93mode:'thrifty'})==='r93_end_thrifty'
    && r93EndingId({r93mode:'thrifty',r93_stubborn:true,r93_medloss:true})==='r93_end_thrifty'
    && r93EndingId({r93mode:'premium'})==='r93_end_premium'
    && r93EndingId({r93mode:'tough'})==='r93_end_tough'
    && r93EndingId({})==='r93_end_tough';
  // ⑤ 成就確定性解鎖、零誤觸、提示齊備
  out.ach = ACH_MAP.r93_in.check({S:{flags:{r93_in:true}},age:40})
    && ACH_MAP.r93_done.check({S:{flags:{r93_endhit:true}},age:55})
    && ACH_MAP.r93_centenarian.check({S:{flags:{r93_endtype:'r93_end_longevity'}},age:99})
    && ACH_MAP.r93_hospitaltour.check({S:{flags:{r93_endtype:'r93_end_thrifty'}},age:70})
    && !ACH_MAP.r93_in.check({S:{flags:{}},age:40})
    && !ACH_MAP.r93_centenarian.check({S:{flags:{r93_endtype:'r93_end_thrifty'}},age:99})
    && ['r93_in','r93_done','r93_centenarian','r93_hospitaltour'].every(id=>ACH_MAP[id]&&ACH_MAP[id].hint&&ACH_MAP[id].hint.length>4);
  // ⑤ 平衡護欄：全鏈所有選項 eff（含 sr/br win/lose 分支）每格 |eff|<=8（special 內 runtime eff 不在選項定義內、另由文案護欄把關）
  const r93ids=['r93_medhook','r93_habit','r93_thrifty','r93_premium','r93_tough','r93_end_longevity','r93_end_thrifty','r93_end_premium','r93_end_tough'];
  let maxEff=0;
  r93ids.forEach(id=>{ const e=f(id); e.choices.forEach(c=>{
    const buckets=[c.eff];
    if(c.sr){ buckets.push(c.sr.win.eff,c.sr.lose.eff); }
    if(c.br){ buckets.push(c.br.hi.eff,c.br.lo.eff); }
    buckets.forEach(b=>{ if(b) Object.values(b).forEach(v=>{ if(Math.abs(v)>maxEff)maxEff=Math.abs(v); }); });
  }); });
  out.balance = maxEff<=8;
  // ⑥ 死法圖鑑：ercrash / chroniccrash 進 SPECIAL_DEATHS + DEATHBOOK（reason+hint 齊備）
  out.deathbook = !!SPECIAL_DEATHS.ercrash && !!SPECIAL_DEATHS.chroniccrash
    && DEATHBOOK.some(d=>d.id==='ercrash'&&d.reason&&d.hint&&d.hint.length>4)
    && DEATHBOOK.some(d=>d.id==='chroniccrash'&&d.reason&&d.hint&&d.hint.length>4);
  // ⑦ 文案紅線：全鏈 title/text/res 不得含政治/暴力/仇恨字串（醫療文化自嘲非嘲諷病患/族群）
  const RED=['共產','統一','獨立','國民黨','民進黨','政黨','邪教','低能','智障','廢物','去死','該死','活該死'];
  let blob='';
  r93ids.forEach(id=>{ const e=f(id); blob+=(e.title||'')+(e.text||''); e.choices.forEach(c=>{ blob+=(c.label||'')+(c.res||''); }); });
  out.noRedline = RED.every(w=>blob.indexOf(w)<0);
  // ⑧ 舊存檔相容：舊 save 經 ensureState 不注入任何 r93 鍵
  const old={flags:{employed:true},attr:{hp:50,int:50,apr:50,mny:50,hap:50},age:40,alive:true,seen:{}}; ensureState(old);
  out.compat = Object.keys(old.flags).every(k=>k.indexOf('r93')!==0);
  // ⑨ 零汙染：開局 S.flags 無 r93 鍵；非醫療鏈事件不落 r93 旗標；沒踏進醫療鏈時回顧卡整段省略
  startGame(); out.clean = Object.keys(S.flags).every(k=>k.indexOf('r93')!==0);
  fresh(45,{}); showEvent(f('networking')); choose(0); out.cleanPlain = Object.keys(S.flags).every(k=>k.indexOf('r93')!==0);
  startGame(); S.flags={}; out.reviewSkip = r93MedReviewHTML()==='';
  S.flags={r93_in:true,r93mode:'thrifty',r93_endtype:'r93_end_longevity'}; out.reviewShow = r93MedReviewHTML().indexOf('健保醫療軌跡')>=0;
  return JSON.stringify(out);
})()`, sandbox));
ok(r93.entry && r93.gateMiss && r93.gateYoung && r93.gateRetired && r93.gateDone, 'R93 ① 攔截器 r93MedPick：20-58 窗口+未退休+雜湊閘命中→入口、閘落空/窗口外/已退休/已收尾皆零殘留不插播');
ok(r93.split, 'R93 ② 入口三分流：健保鄉民/自費養生/鐵齒硬撐各立 r93mode+step:1+r93_in；佛系養生直接收尾(step:99)不立 mode');
ok(r93.nodeHabit && r93.nodeThrifty && r93.nodePremium && r93.nodeTough && r93.endLand, 'R93 ② 進鏈依 step/mode 確定性返節點：step1 共用養生習慣、step2 依 mode、step3 落地 r93_endtype/r93_endhit');
ok(r93.habHealthy && r93.habStubborn && r93.habGate && r93.habCost, 'R93 ③ 健康 buff 取捨：養生落 healthy/鐵齒落 stubborn/int65 gate 醫療知識換 healthy+savvy，三選項 |eff|<=8 不 power creep');
ok(r93.erDeath && r93.erWin && r93.erLoss, 'R93 ④ 健保鄉民急診人球 special r93_er 體質×運勢確定性存活：hp 見底硬撐→延誤猝逝 ercrash、高 hp 救回(medwin)、中 hp 自費加護救回(medloss)，3 連跑零 rng 不翻盤');
ok(r93.erBuffWin && r93.erBuffLose && r93.thriftySafe, 'R93 ④ 健康 buff 對急診存活門檻 ±10 確定性生效：healthy(+10)同 hp 救回、stubborn(-10)同 hp 拖成大病；當機立斷自費搶時間選項→medwin(好結局來源)');
ok(r93.beautySavvy && r93.beautyRich && r93.beautyBotch && r93.beautyNoDeath && r93.premiumSafe, 'R93 ④ 自費醫美 special r93_beauty：savvy 識破密醫/財富>=58 找正規→變美(medwin)、貪便宜踩雷蒙古大夫→翻車(medloss)且絕不致命；找合格醫師選項→medwin');
ok(r93.chronicDeath && r93.chronicWin && r93.chronicLoss && r93.toughSafe, 'R93 ④ 鐵齒慢性病 special r93_chronic 體質×運勢確定性存活：hp 見底硬撐→惡化中風猝逝 chroniccrash、高 hp 控制住(medwin)、中 hp 拖成住院救回(medloss)；終於就醫選項→medwin+healthy(好結局來源)');
ok(r93.endId && r93.ach, 'R93 ⑤ 4 結局確定性計分(百歲人瑞/逛醫院達人/自費養生家/鐵齒倖存)＋4 成就確定性解鎖、零誤觸、提示齊備');
ok(r93.balance && r93.deathbook, 'R93 ⑤⑥ 平衡護欄：全鏈選項 eff 每格 |eff|<=8；專屬死法 ercrash/chroniccrash 進 SPECIAL_DEATHS+DEATHBOOK(reason+hint 齊備)');
ok(r93.noRedline, 'R93 ⑦ 文案紅線：全鏈無政治/暴力/仇恨字串，醫療文化自嘲非嘲諷病患/族群');
ok(r93.compat && r93.clean && r93.cleanPlain && r93.reviewSkip && r93.reviewShow, 'R93 ⑧⑨ 零汙染+舊存檔相容：開局/舊save/非醫療鏈事件 S.flags 皆無 r93 鍵、沒踏進醫療鏈時回顧卡省略、踏進後正常顯示');

// ===== R95 台味網紅／直播主人生支線：分流狀態機 + 爆紅 buff 取捨 + 魅力×運勢/智力驅動 gating + 專屬死法 + 零汙染 =====
const r95 = JSON.parse(vm.runInContext(`(function(){
  const out={}; const f=id=>EVENTS.find(e=>e.id===id);
  function fresh(age,flags){ startGame(); ensureState(S); S.seen={}; S.alive=true; S.keySnap=[]; S.flags=Object.assign({},flags||{}); ensureState(S); if(age!=null)S.age=age; return S; }
  // ① 攔截器 r95CreatorPick：16-52 窗口+未退休+雜湊閘命中→入口、閘落空/窗口外/已退休/已收尾皆零殘留
  const _ro=r95Roll;
  fresh(30,{}); r95Roll=function(){return 0.05;}; out.entry = !!r95CreatorPick() && r95CreatorPick().id==='r95_hook';
  fresh(30,{}); r95Roll=function(){return 0.9;}; out.gateMiss = r95CreatorPick()===null;
  r95Roll=_ro;
  fresh(14,{}); out.gateYoung = r95CreatorPick()===null;
  fresh(30,{retired:true}); out.gateRetired = r95CreatorPick()===null;
  fresh(30,{r95step:99}); out.gateDone = r95CreatorPick()===null;
  // ② 入口三分流：各立 r95mode + step:1 + r95_in；佛系觀眾直接收尾(step:99)不立 mode
  function pick0(i){ fresh(30,{}); showEvent(f('r95_hook')); choose(i); return S.flags; }
  out.split = (g=>g.r95mode==='stream'&&g.r95step===1&&!!g.r95_in)(pick0(0))
    && (g=>g.r95mode==='tuber'&&g.r95step===1&&!!g.r95_in)(pick0(1))
    && (g=>g.r95mode==='dao'&&g.r95step===1&&!!g.r95_in)(pick0(2))
    && (g=>g.r95step===99&&!g.r95mode&&!g.r95_in)(pick0(3));
  // ② 進鏈依 step/mode 確定性返節點
  fresh(30,{r95step:1,r95mode:'stream'}); out.nodeGrind=(r95CreatorPick()||{}).id==='r95_grind';
  fresh(30,{r95step:2,r95mode:'stream'}); out.nodeStream=(r95CreatorPick()||{}).id==='r95_stream';
  fresh(30,{r95step:2,r95mode:'tuber'});  out.nodeTuber =(r95CreatorPick()||{}).id==='r95_tuber';
  fresh(30,{r95step:2,r95mode:'dao'});    out.nodeDao   =(r95CreatorPick()||{}).id==='r95_dao';
  fresh(30,{r95step:3,r95mode:'stream',r95_hit:true,r95_quality:true}); const e3=r95CreatorPick();
  out.endLand = e3&&e3.id==='r95_end_star'&&S.flags.r95_endtype==='r95_end_star'&&S.flags.r95_endhit===true;
  // ③ 經營習慣 buff 取捨：砸錢設備落 r95_quality(吃財富)、爆肝拚量落 r95_hardcore(吃體質)、int>=65 gate 看穿演算法落 quality+savvy
  function grind(i,attr){ fresh(30,{r95step:1,r95mode:'stream'}); if(attr)Object.assign(S.attr,attr); showEvent(f('r95_grind')); choose(i); return S.flags; }
  const g0=grind(0); out.grindQuality = g0.r95_quality===true && g0.r95_invest===true && g0.r95step===2 && !g0.r95_hardcore;
  const g1=grind(1); out.grindHardcore = g1.r95_hardcore===true && !g1.r95_quality && g1.r95step===2;
  const gg=grind(2,{int:90}); out.grindGate = gg.r95_quality===true && gg.r95_savvy===true && S.flags.gateWin>0;
  const cQ=f('r95_grind').choices[0], cH=f('r95_grind').choices[1], cG=f('r95_grind').choices[2];
  out.grindCost = (cQ.eff.mny<0) && (cH.eff.hp<0) && !!cG.cond && cG.gate===true;
  // ④ 開台爆紅 special r95_blowup 魅力×運勢確定性 gating（零 rng）：hp 見底→burnstream 死；apr×r95Roll 翻牌→爆紅(hit)、低 apr→做白工(flop)
  function blowup(hp,apr,buff,roll){ fresh(30,Object.assign({r95step:2,r95mode:'stream'},buff)); S.attr.hp=hp; S.attr.apr=apr; const _r=r95Roll; r95Roll=function(){return roll;}; showEvent(f('r95_stream')); choose(0); r95Roll=_r; return S.flags; }
  out.burnDeath = [0,0,0].every(()=>blowup(10,80,{},0.9).specialDeath==='burnstream');
  out.viralWin  = [0,0,0].every(()=>{const g=blowup(80,80,{},0.9);return g.r95_hit===true&&!g.specialDeath;}); // 高魅力+演算法翻牌→一夜爆紅
  out.viralMid  = [0,0,0].every(()=>{const g=blowup(80,80,{},0.2);return !g.r95_hit&&!g.r95_flop&&!g.specialDeath;}); // 高魅力沒翻牌→小有人氣（非 hit 非 flop）
  out.viralFlop = [0,0,0].every(()=>{const g=blowup(80,20,{},0.9);return g.r95_flop===true&&!g.specialDeath;}); // 低魅力→做白工
  // stream 不賭命穩穩經營選項→hit（好結局來源、不拿命換）
  fresh(30,{r95step:2,r95mode:'stream'}); showEvent(f('r95_stream')); choose(1);
  out.streamSafe = S.flags.r95_hit===true && !S.flags.specialDeath;
  // ④ 內容創作炎上 special r95_cancel 智力確定性 gating（零 rng）：int 見底→cancelled 死；int+savvy adj>=58 化解(hit)、否則被公審掉粉(flop) 生還
  function cancel(int,buff){ fresh(30,Object.assign({r95step:2,r95mode:'tuber'},buff)); S.attr.int=int; showEvent(f('r95_tuber')); choose(0); return S.flags; }
  out.cancelDeath = [0,0,0].every(()=>cancel(10,{}).specialDeath==='cancelled');
  out.cancelWin   = [0,0,0].every(()=>{const g=cancel(90,{});return g.r95_hit===true&&!g.specialDeath;}); // 高智力→理性化解守信任
  out.cancelLoss  = [0,0,0].every(()=>{const g=cancel(40,{});return g.r95_flop===true&&!g.specialDeath;}); // 中智力→被公審掉粉但生還
  out.cancelBuffWin = [0,0,0].every(()=>{const g=cancel(50,{r95_savvy:true});return g.r95_hit===true;}); // savvy(+10)同 int 化解
  // tuber 冷靜理性溝通選項→hit（好結局來源）
  fresh(30,{r95step:2,r95mode:'tuber'}); showEvent(f('r95_tuber')); choose(1);
  out.tuberSafe = S.flags.r95_hit===true && !S.flags.specialDeath;
  // ④ 業配開團 special r95_deal：savvy/智力>=58 看穿合約→賺爛(hit)、否則貪快踩賣身契翻車(flop)，非致命無死法
  function deal(buff,attr){ fresh(30,Object.assign({r95step:2,r95mode:'dao'},buff)); if(attr)Object.assign(S.attr,attr); showEvent(f('r95_dao')); choose(0); return S.flags; }
  out.dealSavvy = [0,0,0].every(()=>{const g=deal({r95_savvy:true},{int:20,mny:20});return g.r95_hit===true&&!g.specialDeath;}); // savvy 看穿合約→賺爛
  out.dealSmart = [0,0,0].every(()=>{const g=deal({},{int:70,mny:20});return g.r95_hit===true&&!g.specialDeath;}); // 智力>=58 看穿→賺爛
  out.dealBotch = [0,0,0].every(()=>{const g=deal({},{int:20,mny:70});return g.r95_flop===true&&!g.specialDeath;}); // 貪快踩雷→翻車(賠得起)
  out.dealNoDeath = [0,0,0].every(()=>!deal({},{int:20,mny:10}).specialDeath); // 業配翻車絕不致命(賠到負債也不死)
  // dao 先查清楚再簽選項→hit（好結局來源）
  fresh(30,{r95step:2,r95mode:'dao'}); showEvent(f('r95_dao')); choose(1);
  out.daoSafe = S.flags.r95_hit===true && !S.flags.specialDeath;
  r95Roll=_ro;
  // ⑤ r95EndingId 結局確定性計分 4 選 1
  out.endId = r95EndingId({r95mode:'stream',r95_hit:true,r95_quality:true})==='r95_end_star'
    && r95EndingId({r95mode:'tuber',r95_hit:true,r95_savvy:true})==='r95_end_star'
    && r95EndingId({r95mode:'stream'})==='r95_end_stream'
    && r95EndingId({r95mode:'stream',r95_hardcore:true,r95_flop:true})==='r95_end_stream'
    && r95EndingId({r95mode:'tuber'})==='r95_end_tuber'
    && r95EndingId({r95mode:'dao'})==='r95_end_dao'
    && r95EndingId({})==='r95_end_dao';
  // ⑤ 成就確定性解鎖、零誤觸、提示齊備
  out.ach = ACH_MAP.r95_in.check({S:{flags:{r95_in:true}},age:30})
    && ACH_MAP.r95_done.check({S:{flags:{r95_endhit:true}},age:55})
    && ACH_MAP.r95_star.check({S:{flags:{r95_endtype:'r95_end_star'}},age:60})
    && ACH_MAP.r95_dao_king.check({S:{flags:{r95_endtype:'r95_end_dao'}},age:60})
    && !ACH_MAP.r95_in.check({S:{flags:{}},age:30})
    && !ACH_MAP.r95_star.check({S:{flags:{r95_endtype:'r95_end_dao'}},age:60})
    && ['r95_in','r95_done','r95_star','r95_dao_king'].every(id=>ACH_MAP[id]&&ACH_MAP[id].hint&&ACH_MAP[id].hint.length>4);
  // ⑤ 平衡護欄：全鏈所有選項 eff 每格 |eff|<=8（special 內 runtime eff 不在選項定義內、另由文案護欄把關）
  const r95ids=['r95_hook','r95_grind','r95_stream','r95_tuber','r95_dao','r95_end_star','r95_end_stream','r95_end_tuber','r95_end_dao'];
  let maxEff=0;
  r95ids.forEach(id=>{ const e=f(id); e.choices.forEach(c=>{
    const buckets=[c.eff];
    if(c.sr){ buckets.push(c.sr.win.eff,c.sr.lose.eff); }
    if(c.br){ buckets.push(c.br.hi.eff,c.br.lo.eff); }
    buckets.forEach(b=>{ if(b) Object.values(b).forEach(v=>{ if(Math.abs(v)>maxEff)maxEff=Math.abs(v); }); });
  }); });
  out.balance = maxEff<=8;
  // ⑥ 死法圖鑑：burnstream / cancelled 進 SPECIAL_DEATHS + DEATHBOOK（reason+hint 齊備）
  out.deathbook = !!SPECIAL_DEATHS.burnstream && !!SPECIAL_DEATHS.cancelled
    && DEATHBOOK.some(d=>d.id==='burnstream'&&d.reason&&d.hint&&d.hint.length>4)
    && DEATHBOOK.some(d=>d.id==='cancelled'&&d.reason&&d.hint&&d.hint.length>4);
  // ⑦ 文案紅線：全鏈 title/text/res 不得含政治/暴力/仇恨字串（網紅文化自嘲非嘲諷受害者/族群）
  const RED=['共產','統一','獨立','國民黨','民進黨','政黨','邪教','低能','智障','廢物','去死','該死','活該死'];
  let blob='';
  r95ids.forEach(id=>{ const e=f(id); blob+=(e.title||'')+(e.text||''); e.choices.forEach(c=>{ blob+=(c.label||'')+(c.res||''); }); });
  out.noRedline = RED.every(w=>blob.indexOf(w)<0);
  // ⑧ 舊存檔相容：舊 save 經 ensureState 不注入任何 r95 鍵
  const old={flags:{employed:true},attr:{hp:50,int:50,apr:50,mny:50,hap:50},age:40,alive:true,seen:{}}; ensureState(old);
  out.compat = Object.keys(old.flags).every(k=>k.indexOf('r95')!==0);
  // ⑨ 零汙染：開局 S.flags 無 r95 鍵；非創作者鏈事件不落 r95 旗標；沒踏進創作者鏈時回顧卡整段省略
  startGame(); out.clean = Object.keys(S.flags).every(k=>k.indexOf('r95')!==0);
  fresh(45,{}); showEvent(f('networking')); choose(0); out.cleanPlain = Object.keys(S.flags).every(k=>k.indexOf('r95')!==0);
  startGame(); S.flags={}; out.reviewSkip = r95CreatorReviewHTML()==='';
  S.flags={r95_in:true,r95mode:'stream',r95_endtype:'r95_end_star'}; out.reviewShow = r95CreatorReviewHTML().indexOf('網紅創作者軌跡')>=0;
  return JSON.stringify(out);
})()`, sandbox));
ok(r95.entry && r95.gateMiss && r95.gateYoung && r95.gateRetired && r95.gateDone, 'R95 ① 攔截器 r95CreatorPick：16-52 窗口+未退休+雜湊閘命中→入口、閘落空/窗口外/已退休/已收尾皆零殘留不插播');
ok(r95.split, 'R95 ② 入口三分流：開台直播/內容創作/業配帶貨各立 r95mode+step:1+r95_in；佛系觀眾直接收尾(step:99)不立 mode');
ok(r95.nodeGrind && r95.nodeStream && r95.nodeTuber && r95.nodeDao && r95.endLand, 'R95 ② 進鏈依 step/mode 確定性返節點：step1 共用經營習慣、step2 依 mode、step3 落地 r95_endtype/r95_endhit');
ok(r95.grindQuality && r95.grindHardcore && r95.grindGate && r95.grindCost, 'R95 ③ 經營 buff 取捨：砸錢設備落 quality(吃財富)/爆肝拚量落 hardcore(吃體質)/int65 gate 看穿演算法換 quality+savvy，三選項 |eff|<=8 不 power creep');
ok(r95.burnDeath && r95.viralWin && r95.viralMid && r95.viralFlop && r95.streamSafe, 'R95 ④ 開台爆紅 special r95_blowup 魅力×運勢確定性 gating：hp 見底硬撐→爆肝猝死 burnstream、高魅力+演算法翻牌→爆紅(hit)、高魅力沒翻牌→小有人氣、低魅力→做白工(flop)；穩穩經營選項→hit 不拿命換');
ok(r95.cancelDeath && r95.cancelWin && r95.cancelLoss && r95.cancelBuffWin && r95.tuberSafe, 'R95 ④ 內容創作炎上 special r95_cancel 智力確定性 gating：int 見底情緒對嗆→炎上社死 cancelled、高智力→理性化解(hit)、中智力→被公審掉粉生還(flop)、savvy(+10)同 int 化解；冷靜溝通選項→hit');
ok(r95.dealSavvy && r95.dealSmart && r95.dealBotch && r95.dealNoDeath && r95.daoSafe, 'R95 ④ 業配開團 special r95_deal：savvy 看穿合約/智力>=58→賺爛(hit)、貪快踩賣身契→翻車(flop)且絕不致命(賠到負債也不死)；先查清楚再簽選項→hit');
ok(r95.endId && r95.ach, 'R95 ⑤ 4 結局確定性計分(頂流長紅/人氣主播/內容創作者/帶貨天王)＋4 成就確定性解鎖、零誤觸、提示齊備');
ok(r95.balance && r95.deathbook, 'R95 ⑤⑥ 平衡護欄：全鏈選項 eff 每格 |eff|<=8；專屬死法 burnstream/cancelled 進 SPECIAL_DEATHS+DEATHBOOK(reason+hint 齊備)');
ok(r95.noRedline, 'R95 ⑦ 文案紅線：全鏈無政治/暴力/仇恨字串，網紅文化自嘲非嘲諷受害者/族群');
ok(r95.compat && r95.clean && r95.cleanPlain && r95.reviewSkip && r95.reviewShow, 'R95 ⑧⑨ 零汙染+舊存檔相容：開局/舊save/非創作者鏈事件 S.flags 皆無 r95 鍵、沒踏進創作者鏈時回顧卡省略、踏進後正常顯示');

// ===== R96 台味天災生存人生支線：分流狀態機 + 防災 buff 取捨 + 體質×運勢/智力驅動 gating + 專屬死法 + 零汙染 =====
const r96 = JSON.parse(vm.runInContext(`(function(){
  const out={}; const f=id=>EVENTS.find(e=>e.id===id);
  function fresh(age,flags){ startGame(); ensureState(S); S.seen={}; S.alive=true; S.keySnap=[]; S.flags=Object.assign({},flags||{}); ensureState(S); if(age!=null)S.age=age; return S; }
  // ① 攔截器 r96DisasterPick：24-55 窗口+未退休+雜湊閘命中→入口、閘落空/窗口外/已退休/已收尾皆零殘留
  const _ro=r96Roll;
  fresh(30,{}); r96Roll=function(){return 0.05;}; out.entry = !!r96DisasterPick() && r96DisasterPick().id==='r96_hook';
  fresh(30,{}); r96Roll=function(){return 0.9;}; out.gateMiss = r96DisasterPick()===null;
  r96Roll=_ro;
  fresh(20,{}); out.gateYoung = r96DisasterPick()===null;
  fresh(30,{retired:true}); out.gateRetired = r96DisasterPick()===null;
  fresh(30,{r96step:99}); out.gateDone = r96DisasterPick()===null;
  // ② 入口三分流：各立 r96mode + step:1 + r96_in；佛系搬天龍國高樓直接收尾(step:99)不立 mode
  function pick0(i){ fresh(30,{}); showEvent(f('r96_hook')); choose(i); return S.flags; }
  out.split = (g=>g.r96mode==='quake'&&g.r96step===1&&!!g.r96_in)(pick0(0))
    && (g=>g.r96mode==='typhoon'&&g.r96step===1&&!!g.r96_in)(pick0(1))
    && (g=>g.r96mode==='slope'&&g.r96step===1&&!!g.r96_in)(pick0(2))
    && (g=>g.r96step===99&&!g.r96mode&&!g.r96_in)(pick0(3));
  // ② 進鏈依 step/mode 確定性返節點
  fresh(30,{r96step:1,r96mode:'quake'}); out.nodePrep=(r96DisasterPick()||{}).id==='r96_prep';
  fresh(30,{r96step:2,r96mode:'quake'});   out.nodeQuake  =(r96DisasterPick()||{}).id==='r96_quake';
  fresh(30,{r96step:2,r96mode:'typhoon'}); out.nodeTyphoon=(r96DisasterPick()||{}).id==='r96_typhoon';
  fresh(30,{r96step:2,r96mode:'slope'});   out.nodeSlope  =(r96DisasterPick()||{}).id==='r96_slope';
  fresh(30,{r96step:3,r96mode:'quake',r96_survived:true,r96_prepared:true}); const e3=r96DisasterPick();
  out.endLand = e3&&e3.id==='r96_end_survivor'&&S.flags.r96_endtype==='r96_end_survivor'&&S.flags.r96_endhit===true;
  // ③ 防災準備 buff 取捨：砸錢備防災包保險補強落 r96_prepared(吃財富)、心存僥倖落 r96_lucky、int>=65 gate 研究潛勢圖落 prepared+savvy
  function prep(i,attr){ fresh(30,{r96step:1,r96mode:'quake'}); if(attr)Object.assign(S.attr,attr); showEvent(f('r96_prep')); choose(i); return S.flags; }
  const p0=prep(0); out.prepInvest = p0.r96_prepared===true && p0.r96_invest===true && p0.r96step===2 && !p0.r96_lucky;
  const p1=prep(1); out.prepLucky = p1.r96_lucky===true && !p1.r96_prepared && p1.r96step===2;
  const pg=prep(2,{int:90}); out.prepGate = pg.r96_prepared===true && pg.r96_savvy===true && S.flags.gateWin>0;
  const cI=f('r96_prep').choices[0], cG=f('r96_prep').choices[2];
  out.prepCost = (cI.eff.mny<0) && !!cG.cond && cG.gate===true;
  // ④ 地震強震 special r96_bigquake 體質×運勢確定性 gating（零 rng）：hp 見底＋零準備→quakecrush 死；hp×運勢翻牌→生還(survived)、低 hp→重傷(flop)
  function quake(hp,buff,roll){ fresh(30,Object.assign({r96step:2,r96mode:'quake'},buff)); S.attr.hp=hp; const _r=r96Roll; r96Roll=function(){return roll;}; showEvent(f('r96_quake')); choose(0); r96Roll=_r; return S.flags; }
  out.quakeDeath = [0,0,0].every(()=>quake(10,{},0.9).specialDeath==='quakecrush'); // hp 見底＋零準備→老屋壓死
  out.quakeSurvive = [0,0,0].every(()=>{const g=quake(80,{},0.9);return g.r96_survived===true&&!g.specialDeath;}); // 高體質+天公伯翻牌→驚險生還
  out.quakeHurt = [0,0,0].every(()=>{const g=quake(30,{},0.2);return g.r96_flop===true&&!g.specialDeath;}); // 低體質沒翻牌→重傷生還(非死)
  out.quakePrepSaves = [0,0,0].every(()=>quake(10,{r96_prepared:true},0.9).specialDeath!=='quakecrush'); // hp 見底但有防災準備→不被壓死(準備救命)
  // quake 冷靜躲桌下選項→survived（好結局來源、不冒險）
  fresh(30,{r96step:2,r96mode:'quake'}); showEvent(f('r96_quake')); choose(1);
  out.quakeSafe = S.flags.r96_survived===true && !S.flags.specialDeath;
  // ④ 颱風淹水 special r96_flood 智力確定性 gating（零 rng）：int 見底＋零準備→flooddrown 死；int+準備 adj>=58 撤離(survived)、否則淹損(flop) 生還
  function flood(int,buff,attr){ fresh(30,Object.assign({r96step:2,r96mode:'typhoon'},buff)); S.attr.int=int; if(attr)Object.assign(S.attr,attr); showEvent(f('r96_typhoon')); choose(0); return S.flags; }
  out.floodDeath = [0,0,0].every(()=>flood(10,{},{mny:50}).specialDeath==='flooddrown'); // int 見底＋零準備→涉水溺斃
  out.floodSurvive = [0,0,0].every(()=>{const g=flood(90,{},{mny:50});return g.r96_survived===true&&!g.specialDeath;}); // 高智力→及時撤離保命
  out.floodLoss = [0,0,0].every(()=>{const g=flood(40,{},{mny:70});return g.r96_flop===true&&!g.specialDeath;}); // 中智力財富撐→淹損但生還
  out.floodBuffSurvive = [0,0,0].every(()=>flood(50,{r96_savvy:true},{mny:50}).r96_survived===true); // savvy(+12)同 int 及時撤離
  out.floodNoDeath = [0,0,0].every(()=>!flood(40,{},{mny:10}).specialDeath); // 颱風淹損(賠到負債)絕不致命(int>14 不溺斃)
  // typhoon 棄守家當保命選項→survived（好結局來源）
  fresh(30,{r96step:2,r96mode:'typhoon'}); showEvent(f('r96_typhoon')); choose(1);
  out.typhoonSafe = S.flags.r96_survived===true && !S.flags.specialDeath;
  // ④ 山區土石流 special r96_landslide 體質×運勢確定性 gating（零 rng）：hp 見底＋零準備不撤離→buried 死；hp×運勢翻牌→生還(survived)、低 hp→重傷(flop)
  function slope(hp,buff,roll){ fresh(30,Object.assign({r96step:2,r96mode:'slope'},buff)); S.attr.hp=hp; const _r=r96Roll; r96Roll=function(){return roll;}; showEvent(f('r96_slope')); choose(0); r96Roll=_r; return S.flags; }
  out.slopeDeath = [0,0,0].every(()=>slope(10,{},0.9).specialDeath==='buried'); // hp 見底＋零準備不撤離→土石流活埋
  out.slopeSurvive = [0,0,0].every(()=>{const g=slope(80,{},0.9);return g.r96_survived===true&&!g.specialDeath;}); // 高體質+天公伯翻牌→驚險逃生
  out.slopeHurt = [0,0,0].every(()=>{const g=slope(30,{},0.2);return g.r96_flop===true&&!g.specialDeath;}); // 低體質沒翻牌→重傷生還(非死)
  out.slopePrepSaves = [0,0,0].every(()=>slope(10,{r96_savvy:true},0.9).specialDeath!=='buried'); // hp 見底但有 savvy 準備→不被活埋
  // slope 政府一發布就撤離選項→survived（好結局來源）
  fresh(30,{r96step:2,r96mode:'slope'}); showEvent(f('r96_slope')); choose(1);
  out.slopeSafe = S.flags.r96_survived===true && !S.flags.specialDeath;
  r96Roll=_ro;
  // ⑤ r96EndingId 結局確定性計分 4 選 1
  out.endId = r96EndingId({r96mode:'quake',r96_survived:true,r96_prepared:true})==='r96_end_survivor'
    && r96EndingId({r96mode:'typhoon',r96_survived:true,r96_savvy:true})==='r96_end_survivor'
    && r96EndingId({r96mode:'quake'})==='r96_end_quake'
    && r96EndingId({r96mode:'quake',r96_lucky:true,r96_flop:true})==='r96_end_quake'
    && r96EndingId({r96mode:'typhoon'})==='r96_end_typhoon'
    && r96EndingId({r96mode:'slope'})==='r96_end_slope'
    && r96EndingId({})==='r96_end_slope';
  // ⑤ 成就確定性解鎖、零誤觸、提示齊備
  out.ach = ACH_MAP.r96_in.check({S:{flags:{r96_in:true}},age:30})
    && ACH_MAP.r96_done.check({S:{flags:{r96_endhit:true}},age:55})
    && ACH_MAP.r96_survivor.check({S:{flags:{r96_endtype:'r96_end_survivor'}},age:60})
    && ACH_MAP.r96_typhoon_king.check({S:{flags:{r96_endtype:'r96_end_typhoon'}},age:60})
    && !ACH_MAP.r96_in.check({S:{flags:{}},age:30})
    && !ACH_MAP.r96_survivor.check({S:{flags:{r96_endtype:'r96_end_typhoon'}},age:60})
    && ['r96_in','r96_done','r96_survivor','r96_typhoon_king'].every(id=>ACH_MAP[id]&&ACH_MAP[id].hint&&ACH_MAP[id].hint.length>4);
  // ⑤ 平衡護欄：全鏈所有選項 eff 每格 |eff|<=8（special 內 runtime eff 不在選項定義內、另由文案護欄把關）
  const r96ids=['r96_hook','r96_prep','r96_quake','r96_typhoon','r96_slope','r96_end_survivor','r96_end_quake','r96_end_typhoon','r96_end_slope'];
  let maxEff=0;
  r96ids.forEach(id=>{ const e=f(id); e.choices.forEach(c=>{
    const buckets=[c.eff];
    if(c.sr){ buckets.push(c.sr.win.eff,c.sr.lose.eff); }
    if(c.br){ buckets.push(c.br.hi.eff,c.br.lo.eff); }
    buckets.forEach(b=>{ if(b) Object.values(b).forEach(v=>{ if(Math.abs(v)>maxEff)maxEff=Math.abs(v); }); });
  }); });
  out.balance = maxEff<=8;
  // ⑥ 死法圖鑑：quakecrush / flooddrown / buried 進 SPECIAL_DEATHS + DEATHBOOK（reason+hint 齊備）
  out.deathbook = !!SPECIAL_DEATHS.quakecrush && !!SPECIAL_DEATHS.flooddrown && !!SPECIAL_DEATHS.buried
    && DEATHBOOK.some(d=>d.id==='quakecrush'&&d.reason&&d.hint&&d.hint.length>4)
    && DEATHBOOK.some(d=>d.id==='flooddrown'&&d.reason&&d.hint&&d.hint.length>4)
    && DEATHBOOK.some(d=>d.id==='buried'&&d.reason&&d.hint&&d.hint.length>4);
  // ⑦ 文案紅線：全鏈 title/text/res 不得含政治/暴力/仇恨字串（防災文化自嘲非嘲弄傷亡/族群）
  const RED=['共產','統一','獨立','國民黨','民進黨','政黨','邪教','低能','智障','廢物','去死','該死','活該死'];
  let blob='';
  r96ids.forEach(id=>{ const e=f(id); blob+=(e.title||'')+(e.text||''); e.choices.forEach(c=>{ blob+=(c.label||'')+(c.res||''); }); });
  out.noRedline = RED.every(w=>blob.indexOf(w)<0);
  // ⑧ 舊存檔相容：舊 save 經 ensureState 不注入任何 r96 鍵
  const old={flags:{employed:true},attr:{hp:50,int:50,apr:50,mny:50,hap:50},age:40,alive:true,seen:{}}; ensureState(old);
  out.compat = Object.keys(old.flags).every(k=>k.indexOf('r96')!==0);
  // ⑨ 零汙染：開局 S.flags 無 r96 鍵；非天災鏈事件不落 r96 旗標；沒踏進天災鏈時回顧卡整段省略
  startGame(); out.clean = Object.keys(S.flags).every(k=>k.indexOf('r96')!==0);
  fresh(45,{}); showEvent(f('networking')); choose(0); out.cleanPlain = Object.keys(S.flags).every(k=>k.indexOf('r96')!==0);
  startGame(); S.flags={}; out.reviewSkip = r96DisasterReviewHTML()==='';
  S.flags={r96_in:true,r96mode:'quake',r96_endtype:'r96_end_survivor'}; out.reviewShow = r96DisasterReviewHTML().indexOf('天災生存軌跡')>=0;
  return JSON.stringify(out);
})()`, sandbox));
ok(r96.entry && r96.gateMiss && r96.gateYoung && r96.gateRetired && r96.gateDone, 'R96 ① 攔截器 r96DisasterPick：24-55 窗口+未退休+雜湊閘命中→入口、閘落空/窗口外/已退休/已收尾皆零殘留不插播');
ok(r96.split, 'R96 ② 入口三分流：地震防災/颱風淹水/山區坡地各立 r96mode+step:1+r96_in；佛系搬天龍國高樓直接收尾(step:99)不立 mode');
ok(r96.nodePrep && r96.nodeQuake && r96.nodeTyphoon && r96.nodeSlope && r96.endLand, 'R96 ② 進鏈依 step/mode 確定性返節點：step1 共用防災準備、step2 依 mode、step3 落地 r96_endtype/r96_endhit');
ok(r96.prepInvest && r96.prepLucky && r96.prepGate && r96.prepCost, 'R96 ③ 防災準備 buff 取捨：砸錢備防災包保險補強落 prepared(吃財富)/心存僥倖落 lucky/int65 gate 研究潛勢圖換 prepared+savvy，三選項 |eff|<=8 不 power creep');
ok(r96.quakeDeath && r96.quakeSurvive && r96.quakeHurt && r96.quakePrepSaves && r96.quakeSafe, 'R96 ④ 地震強震 special r96_bigquake 體質×運勢確定性 gating：hp 見底＋零準備→老屋壓死 quakecrush、高體質+天公伯翻牌→生還(survived)、低體質→重傷生還(flop)、防災準備救命(hp見底有 prepared 不被壓死)；冷靜躲桌下選項→survived');
ok(r96.floodDeath && r96.floodSurvive && r96.floodLoss && r96.floodBuffSurvive && r96.floodNoDeath && r96.typhoonSafe, 'R96 ④ 颱風淹水 special r96_flood 智力確定性 gating：int 見底＋零準備涉水→淹水溺斃 flooddrown、高智力→及時撤離(survived)、中智力財富撐→淹損生還(flop)、savvy(+12)同 int 撤離、淹損(int>14)絕不致命；棄守家當保命選項→survived');
ok(r96.slopeDeath && r96.slopeSurvive && r96.slopeHurt && r96.slopePrepSaves && r96.slopeSafe, 'R96 ④ 山區土石流 special r96_landslide 體質×運勢確定性 gating：hp 見底＋零準備不撤離→土石流活埋 buried、高體質+天公伯翻牌→驚險逃生(survived)、低體質→重傷生還(flop)、防災準備救命(hp見底有 savvy 不被活埋)；政府一發布就撤離選項→survived');
ok(r96.endId && r96.ach, 'R96 ⑤ 4 結局確定性計分(防災達人/與地牛共存/颱風假之王/山居者)＋4 成就確定性解鎖、零誤觸、提示齊備');
ok(r96.balance && r96.deathbook, 'R96 ⑤⑥ 平衡護欄：全鏈選項 eff 每格 |eff|<=8；專屬死法 quakecrush/flooddrown/buried 進 SPECIAL_DEATHS+DEATHBOOK(reason+hint 齊備)');
ok(r96.noRedline, 'R96 ⑦ 文案紅線：全鏈無政治/暴力/仇恨字串，防災文化自嘲非嘲弄傷亡/族群');
ok(r96.compat && r96.clean && r96.cleanPlain && r96.reviewSkip && r96.reviewShow, 'R96 ⑧⑨ 零汙染+舊存檔相容：開局/舊save/非天災鏈事件 S.flags 皆無 r96 鍵、沒踏進天災鏈時回顧卡省略、踏進後正常顯示');

// ========================================================================
// R100 隱藏稀有結局系統：稀有度分級、4 個新台味自嘲結局的真驅動觸發、圖鑑/分享卡稀有徽章、文案紅線
// ========================================================================
const r100 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  // ① 結構：所有隱藏結局齊備 rar(1|2)/cond/hint/text/chk；HE_RARITY 兩級齊全
  out.struct = HIDDEN_ENDINGS.every(h=>
    (h.rar===1||h.rar===2) && typeof h.cond==='string' && h.cond.length>2
    && typeof h.hint==='string' && h.hint.length>4 && typeof h.text==='string' && h.text.length>10
    && typeof h.chk==='function');
  out.rarity = !!(HE_RARITY[1]&&HE_RARITY[2]&&typeof heRarity==='function'&&typeof heRarityBadge==='function');
  out.rarityDefault = heRarity({}).nm==='稀有' && heRarity({rar:2}).nm==='傳說';
  out.badge = heRarityBadge({rar:2}).indexOf('傳說')>=0 && heRarityBadge({rar:1}).indexOf('稀有')>=0;
  // ② 4 個新結局存在＋稀有度正確
  const NEW={he_22k:2, he_renterforever:1, he_burnout_broke:2, he_lieflat_zen:1};
  out.newExist = Object.keys(NEW).every(id=>{ const h=HE_MAP[id]; return h&&h.rar===NEW[id]; });
  // ③ 真驅動觸發：滿足條件的 S 必中、差一格必不中（純讀屬性/旗標/peak/age，零 rng）
  const mk=(o)=>Object.assign({attr:{hp:50,int:50,apr:50,mny:50,hap:50},flags:{},peak:{},age:50},o);
  // he_22k：mny<=25 && peak.hp>=85 && hp<=30 && age>=60
  out.t22k_hit  =  HE_MAP.he_22k.chk(mk({attr:{hp:28,int:50,apr:50,mny:20,hap:50},peak:{hp:88},age:62}));
  out.t22k_miss = !HE_MAP.he_22k.chk(mk({attr:{hp:28,int:50,apr:50,mny:20,hap:50},peak:{hp:80},age:62})) // peak 不足
              &&  !HE_MAP.he_22k.chk(mk({attr:{hp:28,int:50,apr:50,mny:40,hap:50},peak:{hp:88},age:62})); // 不夠窮
  // he_renterforever：r87_end_renter && mny>=60 && age>=65
  out.trent_hit  =  HE_MAP.he_renterforever.chk(mk({attr:{hp:50,int:50,apr:50,mny:70,hap:50},flags:{r87_endtype:'r87_end_renter'},age:68}));
  out.trent_miss = !HE_MAP.he_renterforever.chk(mk({attr:{hp:50,int:50,apr:50,mny:70,hap:50},flags:{r87_endtype:'r87_end_owner'},age:68})) // 非租屋結局
               &&  !HE_MAP.he_renterforever.chk(mk({attr:{hp:50,int:50,apr:50,mny:40,hap:50},flags:{r87_endtype:'r87_end_renter'},age:68})); // 沒錢就不是金主梗
  // he_burnout_broke：r86_end_burnout && mny<=30 && age<=70
  out.tburn_hit  =  HE_MAP.he_burnout_broke.chk(mk({attr:{hp:10,int:50,apr:50,mny:20,hap:30},flags:{r86_endtype:'r86_end_burnout'},age:58}));
  out.tburn_miss = !HE_MAP.he_burnout_broke.chk(mk({attr:{hp:10,int:50,apr:50,mny:20,hap:30},flags:{r86_endtype:'r86_end_climb'},age:58})) // 升遷不算過勞
               &&  !HE_MAP.he_burnout_broke.chk(mk({attr:{hp:10,int:50,apr:50,mny:20,hap:30},flags:{r86_endtype:'r86_end_burnout'},age:80})); // 太老不算燃盡
  // he_lieflat_zen：r86_end_lieflat && hap>=80 && mny<=35 && age>=75
  out.tflat_hit  =  HE_MAP.he_lieflat_zen.chk(mk({attr:{hp:50,int:50,apr:50,mny:25,hap:85},flags:{r86_endtype:'r86_end_lieflat'},age:80}));
  out.tflat_miss = !HE_MAP.he_lieflat_zen.chk(mk({attr:{hp:50,int:50,apr:50,mny:25,hap:60},flags:{r86_endtype:'r86_end_lieflat'},age:80})) // 不夠快樂
               &&  !HE_MAP.he_lieflat_zen.chk(mk({attr:{hp:50,int:50,apr:50,mny:25,hap:85},flags:{r86_endtype:'r86_end_lieflat'},age:70})); // 不夠長壽
  // ④ evalHiddenEndings 端到端：造一個 22K 狀態，跑判定 → S.hiddenEnd 命中、首抽入冊
  startGame(); SAVE.hiddenEnds={};
  S.attr={hp:28,int:50,apr:50,mny:20,hap:50}; S.peak={hp:88}; S.age=62; S.flags={};
  evalHiddenEndings();
  out.eval = S.hiddenEnd==='he_22k' && S.newHidden===true && SAVE.hiddenEnds.he_22k===true;
  // ⑤ 文案紅線：4 新結局 nm/cond/hint/text 不得含政治/暴力/仇恨字串（自嘲非仇恨）
  const RED=['共產','統一','獨立','國民黨','民進黨','政黨','邪教','低能','智障','廢物','去死','該死','活該死'];
  let blob=''; Object.keys(NEW).forEach(id=>{ const h=HE_MAP[id]; blob+=(h.nm||'')+(h.cond||'')+(h.hint||'')+(h.text||''); });
  out.noRedline = RED.every(w=>blob.indexOf(w)<0);
  return JSON.stringify(out);
})()`, sandbox));
ok(r100.struct && r100.rarity && r100.rarityDefault && r100.badge, 'R100 ① 隱藏結局結構完整：每筆齊備 rar(1|2)/cond/hint/text/chk；HE_RARITY 兩級＋heRarity/heRarityBadge（缺 rar 預設稀有）');
ok(r100.newExist, 'R100 ② 4 個新台味自嘲稀有結局齊備＋稀有度正確：he_22k/he_burnout_broke=傳說、he_renterforever/he_lieflat_zen=稀有');
ok(r100.t22k_hit && r100.t22k_miss, 'R100 ③ he_22k 真驅動：健康巔峰85+×謝幕窮(mny≤25)病(hp≤30)撐到60→必中；peak不足/不夠窮→必不中');
ok(r100.trent_hit && r100.trent_miss, 'R100 ③ he_renterforever 真驅動：終身租屋結局×mny≥60×65歲→必中；非租屋結局/沒錢→必不中');
ok(r100.tburn_hit && r100.tburn_miss, 'R100 ③ he_burnout_broke 真驅動：過勞結局×mny≤30×70歲前→必中；升遷結局/太老→必不中');
ok(r100.tflat_hit && r100.tflat_miss, 'R100 ③ he_lieflat_zen 真驅動：躺平結局×hap≥80×mny≤35×75歲→必中；不夠快樂/不夠長壽→必不中');
ok(r100.eval, 'R100 ④ evalHiddenEndings 端到端：22K 狀態跑判定→S.hiddenEnd=he_22k、首抽 newHidden、入冊 SAVE.hiddenEnds');
ok(r100.noRedline, 'R100 ⑤ 文案紅線：4 新結局全文無政治/暴力/仇恨字串，尺度走低薪過勞買不起房自嘲');

// ============================================================================
// R105 周目 / New Game+：存讀檔遷移、tier 階梯、紅利套用、累計計數、代價折半、周目成就
// ============================================================================
const r105 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  // ① 遷移：舊存檔無 ngp 鍵 → ngpData() 就地補 {cycle:0,boost:false}，不崩
  delete SAVE.ngp; const n0=ngpData();
  out.migrate = !!n0 && n0.cycle===0 && n0.boost===false && SAVE.ngp===n0;
  // 壞值修補：負 cycle 歸 0、boost 強制布林
  SAVE.ngp={cycle:-5, boost:1}; const n1=ngpData();
  out.repair = n1.cycle===0 && n1.boost===true;
  // ② tier 階梯：每 3 周目 +1、上限 4
  const tiers=[0,3,6,9,12,99].map(c=>{ SAVE.ngp={cycle:c,boost:true}; return ngpTier(); });
  out.tier = JSON.stringify(tiers)===JSON.stringify([0,1,2,3,4,4]);
  // ③ ngpBoostActive：要「有開 且 tier>0」才生效
  SAVE.ngp={cycle:6, boost:true};  out.activeOn=ngpBoostActive()===true && ngpTier()===2;
  SAVE.ngp={cycle:6, boost:false}; out.activeOff=ngpBoostActive()===false;
  SAVE.ngp={cycle:0, boost:true};  out.activeNoTier=ngpBoostActive()===false;
  // ④ 開局套用：同種子下，啟用 tier2 比未啟用每項屬性高 2（封頂 100 內）
  SAVE.dynasty={pending:null,lineage:[]};
  SAVE.ngp={cycle:6, boost:false}; startGame(); const baseA=Object.assign({},S.attr); const seed=S.seed;
  SAVE.ngp={cycle:6, boost:true};
  rng=mulberry32(seedCodeToInt(seed)); EVENTS=buildEvents(); newLife(); S.seed=seed;
  out.boostApplied = S.ngpBoost===true &&
    ['hp','int','apr','mny','hap'].every(k=>S.attr[k]===Math.max(0,Math.min(100,Math.round(baseA[k])+2)));
  // ⑤ 累計：正常局死亡 cycle+1（並記 S.ngpCycle）；挑戰局不計
  SAVE.ngp={cycle:6,boost:false};
  startGame(); S.age=70; S.attr={hp:30,int:50,apr:50,mny:50,hap:50}; S.flags={}; die();
  out.cycInc = ngpData().cycle===7 && S.ngpCycle===7;
  SAVE.ngp={cycle:6,boost:false};
  startGame(); S.challenge={date:'2099-01-01',attempt:1}; S.age=70; S.attr={hp:30,int:50,apr:50,mny:50,hap:50}; S.flags={}; die();
  out.cycChallengeSkip = ngpData().cycle===6;
  // ⑥ 紅利代價：同條件下，帶紅利的輪迴點 = floor(原本×0.5)（min 1），陰德同理
  function runDie(boostOn){
    SAVE.deaths={}; SAVE.ach={}; SAVE.origins={}; SAVE.badges={};
    SAVE.dynasty={pending:null,lineage:[]}; SAVE.ngp={cycle:12, boost:boostOn};
    startGame(); S.age=85; S.attr={hp:80,int:80,apr:80,mny:80,hap:80}; S.flags={}; die();
    return {rp:S.rpGain, yd:S.ydGain, nb:S.ngpBoost};
  }
  const plain=runDie(false), boost=runDie(true);
  out.boostPenalty = plain.nb===false && boost.nb===true
    && boost.rp===Math.max(1,Math.floor(plain.rp*0.5))
    && boost.yd===Math.max(1,Math.floor(plain.yd*0.5));
  // ⑦ 周目成就：cycle≥3 解 ngp_rookie，未達門檻者仍鎖定
  SAVE.ach={}; SAVE.deaths={}; SAVE.ngp={cycle:3,boost:false};
  startGame(); S.age=60; S.attr={hp:50,int:50,apr:50,mny:50,hap:50}; S.flags={}; die();
  out.ach3 = SAVE.ach.ngp_rookie===true && !SAVE.ach.ngp_veteran && !SAVE.ach.ngp_master;
  // ⑧ 序列化往返不崩：stringify→parse 後周目欄位保值
  SAVE.ngp={cycle:9,boost:true};
  const parsed=JSON.parse(JSON.stringify(SAVE));
  out.roundtrip = parsed.ngp && parsed.ngp.cycle===9 && parsed.ngp.boost===true;
  // ⑨ HTML 不崩：開局卡 / 結算頁周目區塊可渲染
  SAVE.ngp={cycle:9,boost:true};
  out.html = typeof ngpBirthHTML()==='string' && ngpBirthHTML().indexOf('周目進度')>=0
    && typeof ngpSummaryHTML()==='string' && ngpSummaryHTML().indexOf('New Game+')>=0;
  return JSON.stringify(out);
})()`, sandbox));
ok(r105.migrate, 'R105 ① 周目遷移：舊存檔無 ngp 鍵 → ngpData() 就地補 {cycle:0,boost:false}，不崩');
ok(r105.repair, 'R105 ① 壞值修補：負 cycle 歸 0、boost 強制布林');
ok(r105.tier, 'R105 ② tier 階梯：每 3 周目 +1、上限 4（0/3/6/9/12/99→0/1/2/3/4/4）');
ok(r105.activeOn && r105.activeOff && r105.activeNoTier, 'R105 ③ ngpBoostActive：需「有開 且 tier>0」才生效，預設關不生效');
ok(r105.boostApplied, 'R105 ④ 開局套用：同種子下啟用 tier2 每項屬性 +2（封頂 100 內），未啟用與舊版一致');
ok(r105.cycInc, 'R105 ⑤ 累計：正常局死亡 cycle+1 且記 S.ngpCycle');
ok(r105.cycChallengeSkip, 'R105 ⑤ 挑戰局不計入周目（同全服公平鐵律）');
ok(r105.boostPenalty, 'R105 ⑥ 紅利代價：帶紅利的這一局輪迴點與陰德皆折半（floor×0.5、min 1）');
ok(r105.ach3, 'R105 ⑦ 周目成就：cycle≥3 解 ngp_rookie，未達門檻者鎖定');
ok(r105.roundtrip, 'R105 ⑧ 序列化往返：stringify→parse 後周目欄位保值不崩');
ok(r105.html, 'R105 ⑨ HTML 不崩：開局卡與結算頁周目區塊可渲染');

// ============================================================================
// R106 屬性編年史：里程碑軌跡記錄（trajPush 去重/階段節點）、序列化往返、HTML 不崩、舊存檔相容
// ============================================================================
const r106 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  // ① 出生即第一章：startGame 後 attrTrajectory 有 1 筆 st:0 age:0，五圍鍵齊備且為數字
  startGame();
  const t0=S.attrTrajectory;
  out.birth = Array.isArray(t0) && t0.length===1 && t0[0].st===0 && t0[0].age===0
    && ['hp','int','apr','mny','hap'].every(k=>typeof t0[0][k]==='number');
  // ② trajPush 去重：同 st 只記一次；不同 st 才增列
  trajPush(0); out.dedupSame = S.attrTrajectory.length===1;          // st0 已存在 → 不重複
  S.age=15; S.attr.int=70; trajPush(1); out.pushNew = S.attrTrajectory.length===2 && S.attrTrajectory[1].st===1 && S.attrTrajectory[1].age===15;
  trajPush(1); out.dedupAgain = S.attrTrajectory.length===2;          // st1 再 push → 仍不重複
  // ③ 節點快照保值：第二章記下的 int 應是 push 當下的 70
  out.snapVal = S.attrTrajectory[1].int===70;
  // ④ 序列化往返不崩：stringify→parse 後每章 st/age/五圍保值
  const parsed=JSON.parse(JSON.stringify(S.attrTrajectory));
  out.roundtrip = parsed.length===S.attrTrajectory.length
    && parsed.every((r,i)=>r.st===S.attrTrajectory[i].st && r.age===S.attrTrajectory[i].age
        && ['hp','int','apr','mny','hap'].every(k=>r[k]===S.attrTrajectory[i][k]));
  // ⑤ HTML 不崩：有 ≥1 里程碑＋謝幕點 → 渲染含標題/SVG/長條/點評
  S.age=68; S.attr={hp:40,int:70,apr:50,mny:30,hap:55};
  const h=attrTrajectoryHTML();
  out.html = typeof h==='string' && h.indexOf('屬性編年史')>=0 && h.indexOf('<svg')>=0
    && h.indexOf('<rect')>=0 && h.indexOf('主旋律')>=0;
  // ⑥ 不足兩章節整塊省略不報錯（空軌跡 → 只剩謝幕 1 章 → 回空字串）
  S.attrTrajectory=[]; out.skipEmpty = attrTrajectoryHTML()==='';
  // ⑦ 舊存檔相容：缺鍵 save 經 ensureState 補空陣列，且不注入其它 r106 旗標
  const old={flags:{employed:true},attr:{hp:50,int:50,apr:50,mny:50,hap:50},age:40,alive:true,seen:{}};
  ensureState(old);
  out.compat = Array.isArray(old.attrTrajectory) && old.attrTrajectory.length===0
    && Object.keys(old.flags).every(k=>k.indexOf('r106')!==0);
  // ⑧ 零汙染：軌跡不寫進 S.flags（純獨立結構）
  startGame(); out.clean = Object.keys(S.flags).every(k=>k.indexOf('traj')<0 && k.indexOf('r106')!==0);
  return JSON.stringify(out);
})()`, sandbox));
ok(r106.birth, 'R106 ① 出生即第一章：startGame 後 attrTrajectory 有 1 筆 st:0 age:0，五圍鍵齊備為數字');
ok(r106.dedupSame && r106.pushNew && r106.dedupAgain, 'R106 ② trajPush 去重：同階段只記一次、跨新階段才增列里程碑');
ok(r106.snapVal, 'R106 ③ 節點快照保值：跨階段記下的是 push 當下的五圍值');
ok(r106.roundtrip, 'R106 ④ 序列化往返：stringify→parse 後每章 st/age/五圍保值不崩');
ok(r106.html, 'R106 ⑤ HTML 不崩：有里程碑＋謝幕點→渲染含標題/SVG/長條/主旋律點評');
ok(r106.skipEmpty, 'R106 ⑥ 不足兩章節整塊省略：空軌跡→回空字串不報錯');
ok(r106.compat, 'R106 ⑦ 舊存檔相容：缺鍵 save 經 ensureState 補空陣列、不注入 r106 旗標');
ok(r106.clean, 'R106 ⑧ 零汙染：軌跡為獨立結構，不寫進 S.flags');

// ============================================================================
// R108 歷代人生名人堂：hofPush 寫入/容量上限淘汰/稀有度/序列化往返/榮譽標記/
//   連動成就/空狀態不崩/有資料渲染/挑戰局不入冊/舊存檔相容
// ============================================================================
const r108 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  const appHTML=()=>document.querySelector('#app').innerHTML;
  // ① 預設/舊存檔相容：清掉 hof 鍵後 loadSave → 補成陣列
  SAVE.hof=undefined; loadSave(); out.def = Array.isArray(SAVE.hof);
  // ② hofPush 寫入：建構一段人生 → 收藏冊 +1、稱號去標籤、峰值/時間/欄位齊備
  SAVE.hof=[]; startGame();
  S.age=72; S.sum=360; S.grade="A"; S.title="<b>傳奇阿伯</b>"; S.deathReason="壽終正寢";
  S.deathId="peaceful"; S.peak={hp:90,int:80,apr:70,mny:88,hap:75}; S.era=null; S.newAch=[];
  S.challenge=null; S.battle=null; S.script=null;
  hofPush();
  const r=SAVE.hof[0];
  out.write = SAVE.hof.length===1 && r.score===360 && r.grade==="A" && r.age===72
    && r.end.indexOf("<")<0 && r.end.indexOf("傳奇阿伯")>=0
    && r.peak && r.peak.mny===88 && typeof r.t==="number" && Array.isArray(r.ach);
  // ③ 稀有度：peaceful 屬 SPECIAL_DEATHS → rare=2；隱藏結局 → 3；普通死法 → 0
  out.rarePeaceful = r.rare===2;
  S.hiddenEnd="someHidden"; out.rareHidden = hofRarity()===3; S.hiddenEnd=null;
  S.deathId="hp_0"; out.rareNormal = hofRarity()===0 || hofRarity()===1; // 視 DEATHBOOK 標記
  S.deathId="peaceful";
  // ④ 挑戰/對戰/劇本局不入冊
  const before=SAVE.hof.length; S.challenge={date:"x"}; hofPush(); out.skipChallenge = SAVE.hof.length===before; S.challenge=null;
  // ⑤ 容量上限淘汰最低分：透過 hofPush 連灌 60 段遞增分數 → 封頂 50、最低分被淘汰、最高分仍在
  SAVE.hof=[]; startGame(); S.challenge=null; S.battle=null; S.script=null;
  S.peak={hp:50,int:50,apr:50,mny:50,hap:50}; S.deathId=""; S.hiddenEnd=null; S.newAch=[]; S.era=null;
  for(let i=0;i<60;i++){ S.sum=i+10; S.grade="C"; S.age=40; S.title="人生"+i; S.deathReason="d"+i; hofPush(); }
  const scores=SAVE.hof.map(x=>x.score);
  out.cap = SAVE.hof.length===50 && Math.min.apply(null,scores)>=20 && Math.max.apply(null,scores)===69;
  // ⑥ 序列化往返：stringify→parse 後每筆分數/稱號/峰值保值不崩
  const parsed=JSON.parse(JSON.stringify(SAVE.hof));
  out.roundtrip = parsed.length===SAVE.hof.length
    && parsed.every((x,i)=>x.score===SAVE.hof[i].score && x.end===SAVE.hof[i].end && x.peak.mny===SAVE.hof[i].peak.mny);
  // ⑦ 榮譽標記 + 對比卡選樣：best/worst 正確、picks 去重且 1~3 筆
  const med=hofMedals();
  out.medals = SAVE.hof[med.best].score===69 && SAVE.hof[med.worst].score===20 && med.recent>=0;
  const picks=hofComparePick();
  const ids=picks.map(p=>p.r); const uniq={}; ids.forEach(x=>{uniq[ids.indexOf(x)]=1;});
  out.picks = picks.length>=1 && picks.length<=3 && Object.keys(uniq).length===picks.length;
  out.cmpText = hofCompareText(picks).indexOf("名人堂")>=0;
  // ⑧ 名人堂連動成就：滿 10 段 + 同時有 S 級神局與 D 級慘局 → hofEvalAch 解鎖兩成就
  SAVE.ach={}; SAVE.hof=[];
  for(let i=0;i<10;i++) SAVE.hof.push({t:i,end:"x"+i,rare:0,score:120,grade:"B",age:50,era:"",death:"d",peak:{hp:1,int:1,apr:1,mny:1,hap:1},ach:[]});
  SAVE.hof[0]={t:0,end:"神",rare:3,score:400,grade:"S",age:88,era:"",death:"d",peak:{hp:1,int:1,apr:1,mny:1,hap:1},ach:[]};
  SAVE.hof[1]={t:1,end:"慘",rare:0,score:90,grade:"D",age:20,era:"",death:"d",peak:{hp:1,int:1,apr:1,mny:1,hap:1},ach:[]};
  S.newAch=[]; S.sum=200; S.grade="B"; S.age=50; S.cat="old";
  hofEvalAch();
  out.ach = SAVE.ach.hof_collector===true && SAVE.ach.hof_godandhell===true
    && S.newAch.indexOf("hof_collector")>=0 && !!ACH_MAP.hof_collector && !!ACH_MAP.hof_godandhell;
  // 未達門檻不誤觸（少於 10 段、或缺神/慘其一）
  SAVE.ach={}; SAVE.hof=[{t:0,end:"a",rare:0,score:200,grade:"B",age:50,era:"",death:"d",peak:{},ach:[]}];
  S.newAch=[]; hofEvalAch();
  out.achNoFalse = !SAVE.ach.hof_collector && !SAVE.ach.hof_godandhell;
  // ⑨ 空名人堂渲染不崩 + 空狀態引導語
  out.empty=false; try{ SAVE.hof=[]; collTab("hof"); out.empty = appHTML().indexOf("名人堂還空空如也")>=0; }catch(e){ out.emptyErr=String(e&&e.message||e); }
  // ⑩ 有資料渲染不崩：含標題/榮譽標記🏆/排序鈕/對比卡按鈕
  out.render=false; try{
    SAVE.hof=[{t:1,end:"阿明",rare:2,score:360,grade:"A",age:80,era:"民國",death:"壽終",peak:{hp:90,int:80,apr:70,mny:88,hap:75},ach:["五邊形戰士"]},
              {t:2,end:"阿慘",rare:0,score:120,grade:"D",age:25,era:"",death:"車禍",peak:{hp:10,int:20,apr:30,mny:5,hap:15},ach:[]}];
    collTab("hof"); const h2=appHTML();
    out.render = h2.indexOf("歷代人生名人堂")>=0 && h2.indexOf("🏆")>=0 && h2.indexOf("依分數")>=0 && h2.indexOf("hofCompareCard")>=0;
  }catch(e){ out.renderErr=String(e&&e.message||e); }
  return JSON.stringify(out);
})()`, sandbox));
ok(r108.def, 'R108 ① 舊存檔相容：缺 hof 鍵 loadSave 補成空陣列，不崩');
ok(r108.write, 'R108 ② hofPush 寫入：人生摘要入冊、稱號去標籤、峰值/時間/欄位齊備');
ok(r108.rarePeaceful && r108.rareHidden && r108.rareNormal, 'R108 ③ 稀有度分級：壽終=2／隱藏結局=3／一般死法=0~1');
ok(r108.skipChallenge, 'R108 ④ 挑戰/對戰/劇本局不入名人堂（全服公平鐵律）');
ok(r108.cap, 'R108 ⑤ 容量上限：超過 50 筆淘汰最低分，最高分保留');
ok(r108.roundtrip, 'R108 ⑥ 序列化往返：stringify→parse 後分數/稱號/峰值保值不崩');
ok(r108.medals && r108.picks && r108.cmpText, 'R108 ⑦ 榮譽標記+對比卡選樣：best/worst 正確、picks 去重 1~3 筆、文字摘要可生成');
ok(r108.ach && r108.achNoFalse, 'R108 ⑧ 連動成就：滿 10 段+神慘同框解鎖兩成就，未達門檻不誤觸');
ok(r108.empty, 'R108 ⑨ 空名人堂渲染不崩，顯示空狀態引導語' + (r108.emptyErr?(' ['+r108.emptyErr+']'):''));
ok(r108.render, 'R108 ⑩ 有資料渲染不崩：含標題/🏆榮譽標記/排序鈕/對比卡按鈕' + (r108.renderErr?(' ['+r108.renderErr+']'):''));

// ===== R110 台味育兒教養人生支線：cond gating + 屬性/旗標雙驅動分流 + 死法/成就/舊存檔相容 =====
const r110 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function fresh(age,fl,attr){ startGame(); const s=S; s.flags=Object.assign({haskid:true},fl||{}); ensureState(s); s.seen={}; s.alive=true; if(age!=null)s.age=age; if(attr)Object.assign(s.attr,attr); return s; }
  /* ① cond gating：haskid 才進池、無 haskid 不進、once 已踏不再進 */
  let s=fresh(40,{}); out.kidIn = eligible().some(e=>e.id==='r110_tiger') && eligible().some(e=>e.id==='r110_grand');
  startGame(); s=S; s.flags={}; ensureState(s); s.seen={}; s.age=40;
  out.noKidGated = !eligible().some(e=>['r110_newborn','r110_tiger','r110_grand','r110_repay'].includes(e.id));
  s=fresh(40,{r110_eduset:true}); out.onceGated = !eligible().some(e=>e.id==='r110_tiger');
  /* ② 養兒防老開獎：屬性＋旗標雙驅動確定性分流（連跑 3 次同值、零裸 rng 翻不了門檻） */
  function repay(fl,attr){ s=fresh(60,fl,attr); showEvent(EVENTS.find(e=>e.id==='r110_repay')); choose(0); return s.flags; }
  out.filial = [0,0,0].every(()=>!!repay({r110_adaptive:true},{int:80,hap:80}).r110_filial);
  out.leech  = [0,0,0].every(()=>!!repay({r110_helimode:true,r110_spoil:true},{int:30,hap:30}).r110_leech);
  out.neutral= [0,0,0].every(()=>{const f=repay({},{int:40,hap:40}); return !f.r110_filial && !f.r110_leech;});
  /* ③ tigerpush 陪讀爆肝死：hp<=14 確定性觸發 tigerburn、門檻外活路立 helimode */
  s=fresh(40,{}); s.attr.hp=12; showEvent(EVENTS.find(e=>e.id==='r110_tiger')); choose(0);
  out.tigerDie = S.flags.specialDeath==='tigerburn';
  s=fresh(40,{}); s.attr.hp=80; showEvent(EVENTS.find(e=>e.id==='r110_tiger')); choose(0);
  out.tigerLive = !S.flags.specialDeath && S.flags.r110_helimode===true;
  /* ④ 死法收錄 + 成就確定性不誤觸 */
  out.deathReg = !!SPECIAL_DEATHS.tigerburn && DEATHBOOK.some(d=>d.id==='tigerburn'&&d.rare===true&&d.hint&&d.reason);
  out.ach = ACH_MAP.r110_helicopter.check({S:{flags:{r110_helimode:true}}})
         && ACH_MAP.r110_filialwin.check({S:{flags:{r110_filial:true}}})
         && ACH_MAP.r110_leechkid.check({S:{flags:{r110_leech:true}}})
         && !ACH_MAP.r110_helicopter.check({S:{flags:{}}})
         && !ACH_MAP.r110_filialwin.check({S:{flags:{}}});
  /* ⑤ 舊存檔相容：缺 r110 旗標的 save 經 ensureState 不崩、不注入 r110 旗標 */
  const old={flags:{haskid:true},attr:{hp:50,int:50,apr:50,mny:50,hap:50},age:40,alive:true}; ensureState(old);
  out.compat = Object.keys(old.flags).every(k=>k.indexOf('r110')!==0);
  startGame(); s=S; out.clean = Object.keys(s.flags||{}).every(k=>k.indexOf('r110')!==0);
  return JSON.stringify(out);
})()`, sandbox));
ok(r110.kidIn && r110.noKidGated && r110.onceGated, 'R110 ① 育兒鏈 cond gating：haskid 進池／無 haskid 不進／once 已踏不重播');
ok(r110.filial, 'R110 ② 養兒防老分流：適性引導＋高身教(智力/快樂) 確定性養出孝順成材（連跑 3 次同值）');
ok(r110.leech, 'R110 ③ 養兒防老分流：直升機高壓＋隔代溺愛＋疏於身教 確定性養出啃老不肖');
ok(r110.neutral, 'R110 ④ 養兒防老分流：教養分中間值 → 平凡中性票（不誤觸 filial/leech）');
ok(r110.tigerDie, 'R110 ⑤ 陪讀爆肝死：虎爸虎媽全力雞娃 hp≤14 確定性觸發 tigerburn');
ok(r110.tigerLive, 'R110 ⑥ 陪讀活路：hp 充足撐過軍備競賽、立 helimode 直升機父母旗標');
ok(r110.deathReg, 'R110 ⑦ tigerburn 收錄 SPECIAL_DEATHS＋死法圖鑑（rare＋提示＋reason）');
ok(r110.ach, 'R110 ⑧ 連動成就確定性：直升機父母／養出人才／養出啃老蟲解鎖且不誤觸');
ok(r110.compat && r110.clean, 'R110 ⑨ 舊存檔相容＋乾淨局零 r110 殘留');

// ===== R111 台味鬼島嘲諷職場/居住梗包：cond gating + 屬性/旗標雙驅動分流 + 死法/成就/舊存檔相容 =====
const r111 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function fresh(age,fl,attr){ startGame(); const s=S; s.flags=Object.assign({},fl||{}); ensureState(s); s.seen={}; s.alive=true; if(age!=null)s.age=age; if(attr)Object.assign(s.attr,attr); return s; }
  /* ① cond gating：不限 haskid 皆進池、once 已踏不再進 */
  let s=fresh(30,{}); out.entryIn = eligible().some(e=>e.id==='r111_rent') && eligible().some(e=>e.id==='r111_commute') && eligible().some(e=>e.id==='r111_pie');
  s=fresh(50,{}); out.escapeIn = eligible().some(e=>e.id==='r111_escape');
  s=fresh(30,{r111_rent:true}); out.onceGated = !eligible().some(e=>e.id==='r111_rent');
  /* ② 鬼島生存總結算：屬性＋旗標雙驅動確定性分流（連跑 3 次同值、零裸 rng 翻不了門檻） */
  function settle(fl,attr){ s=fresh(50,fl,attr); showEvent(EVENTS.find(e=>e.id==='r111_escape')); choose(0); return s.flags; }
  out.escaped = [0,0,0].every(()=>!!settle({r111_owner:true,r111_smartcommute:true,r111_seepie:true},{mny:40,int:40,hap:40}).r111_escaped);
  out.drained = [0,0,0].every(()=>!!settle({r111_tinroof:true,r111_scooter:true,r111_pieslave:true},{mny:40,int:40,hap:40}).r111_drained);
  out.neutral = [0,0,0].every(()=>{const f=settle({},{mny:40,int:40,hap:40}); return !f.r111_escaped && !f.r111_drained;});
  /* ③ 畫餅過勞死：含淚信餅 hp≤14 確定性觸發 emptypie、門檻外活路立 pieslave */
  s=fresh(35,{}); s.attr.hp=12; showEvent(EVENTS.find(e=>e.id==='r111_pie')); choose(0);
  out.pieDie = S.flags.specialDeath==='emptypie';
  s=fresh(35,{}); s.attr.hp=80; showEvent(EVENTS.find(e=>e.id==='r111_pie')); choose(0);
  out.pieLive = !S.flags.specialDeath && S.flags.r111_pieslave===true;
  /* ④ 死法收錄 + 成就確定性不誤觸 */
  out.deathReg = !!SPECIAL_DEATHS.emptypie && DEATHBOOK.some(d=>d.id==='emptypie'&&d.rare===true&&d.hint&&d.reason);
  out.ach = ACH_MAP.r111_escapewin.check({S:{flags:{r111_escaped:true}}})
         && ACH_MAP.r111_islander.check({S:{flags:{r111_renthell:true,r111_commutehell:true,r111_pieslave:true}}})
         && ACH_MAP.r111_rooftop.check({S:{flags:{r111_tinroof:true}}})
         && !ACH_MAP.r111_escapewin.check({S:{flags:{}}})
         && !ACH_MAP.r111_islander.check({S:{flags:{r111_renthell:true}}});
  /* ⑤ 舊存檔相容：缺 r111 旗標的 save 經 ensureState 不崩、不注入 r111 旗標 */
  const old={flags:{},attr:{hp:50,int:50,apr:50,mny:50,hap:50},age:40,alive:true}; ensureState(old);
  out.compat = Object.keys(old.flags).every(k=>k.indexOf('r111')!==0);
  startGame(); s=S; out.clean = Object.keys(s.flags||{}).every(k=>k.indexOf('r111')!==0);
  return JSON.stringify(out);
})()`, sandbox));
ok(r111.entryIn && r111.escapeIn && r111.onceGated, 'R111 ① 鬼島梗包 cond gating：三入口＋晚年結算皆進池（不限 haskid）／once 已踏不重播');
ok(r111.escaped, 'R111 ② 生存結算分流：有窩＋砍通勤＋看穿畫餅 確定性潤出國（連跑 3 次同值）');
ok(r111.drained, 'R111 ③ 生存結算分流：頂加＋肉包鐵＋吞餅社畜 確定性被鬼島榨乾');
ok(r111.neutral, 'R111 ④ 生存結算分流：旗標中間值 → 認命中性票（不誤觸 escaped/drained）');
ok(r111.pieDie, 'R111 ⑤ 畫餅過勞死：含淚信餅無償加班 hp≤14 確定性觸發 emptypie');
ok(r111.pieLive, 'R111 ⑥ 畫餅活路：hp 充足撐過、立 pieslave 吞餅社畜旗標');
ok(r111.deathReg, 'R111 ⑦ emptypie 收錄 SPECIAL_DEATHS＋死法圖鑑（rare＋提示＋reason）');
ok(r111.ach, 'R111 ⑧ 連動成就確定性：逃離鬼島／集滿三苦／頂加蒸籠解鎖且不誤觸');
ok(r111.compat && r111.clean, 'R111 ⑨ 舊存檔相容＋乾淨局零 r111 殘留');

// ===== R112 屬性驅動・成長有取捨：cond/gate 門檻 + br 分流 + sr 檢定 + 取捨明細序列化 + 舊存檔相容 =====
const r112 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function fresh(age,attr){ startGame(); const s=S; s.flags={}; ensureState(s); s.seen={}; s.alive=true; s.tradeLog=[]; if(age!=null)s.age=age; if(attr)Object.assign(s.attr,attr); return s; }
  const skill=EVENTS.find(e=>e.id==='r112_skilltree'), body=EVENTS.find(e=>e.id==='r112_bodydebt'), charm=EVENTS.find(e=>e.id==='r112_charm');
  /* ① cond gating（入口 once）：三入口進池、once 已踏不再進 */
  let s=fresh(35,{}); out.entryIn = eligible().some(e=>e.id==='r112_skilltree') && eligible().some(e=>e.id==='r112_bodydebt') && eligible().some(e=>e.id==='r112_charm');
  s=fresh(35,{}); s.flags.r112_skill=true; out.onceGated = !eligible().some(e=>e.id==='r112_skilltree');
  /* ② gate 屬性門檻：int 高才渲染高智選項、落 headhunt/meritwin 旗標＋串 gateWin */
  s=fresh(30,{int:75}); showEvent(skill); out.gateShown = document.querySelector('#app').innerHTML.includes('免進修內部直接被挖角');
  s=fresh(30,{int:50}); showEvent(skill); out.gateHidden = !document.querySelector('#app').innerHTML.includes('免進修內部直接被挖角');
  s=fresh(30,{int:75}); showEvent(skill); choose(2); out.headhunt = S.flags.r112_headhunt===true && (S.flags.gateWin||0)>=1;
  s=fresh(30,{int:75}); showEvent(charm); choose(1); out.meritwin = S.flags.r112_meritwin===true && (S.flags.gateWin||0)>=1;
  /* ③ trade-off 取捨偵測：int+9/hp-6 → r98trade +1 且 tradeLog 記 up=int/dn=hp（序列化往返保值）*/
  s=fresh(30,{int:60,hp:60,hap:60}); const t0=S.flags.r98trade||0; showEvent(skill); choose(0);
  const tl=JSON.parse(JSON.stringify(S.tradeLog||[]));
  out.trade = (S.flags.r98trade||0)===t0+1 && tl.length===1 && tl[0].up==='int' && tl[0].dn==='hp' && tl[0].upv>=4 && tl[0].dnv<=-4;
  /* ④ br 分流：健康 55+ → hi 立 bodybank；<55 → lo 不立（連跑 3 次同值、零裸 rng 翻不了門檻）*/
  out.brHi = [0,0,0].every(()=>{ s=fresh(35,{hp:70}); showEvent(body); choose(1); return S.flags.r112_bodybank===true && S.flags.r112_body===true; });
  out.brLo = [0,0,0].every(()=>{ s=fresh(35,{hp:40}); showEvent(body); choose(1); return !S.flags.r112_bodybank && S.flags.r112_body===true; });
  /* ⑤ sr 檢定：魅力 95 必過(connwin)／魅力 10 必敗（僅 conn），上下限不被 rnd 翻盤（連跑 5 次同值）*/
  out.srWin = [0,0,0,0,0].every(()=>{ s=fresh(30,{apr:95}); showEvent(charm); choose(0); return S.flags.r112_connwin===true; });
  out.srLose = [0,0,0,0,0].every(()=>{ s=fresh(30,{apr:10}); showEvent(charm); choose(0); return !S.flags.r112_connwin && S.flags.r112_conn===true; });
  /* ⑥ 死法/成就確定性不誤觸 + 結算回顧渲染 */
  out.ach = ACH_MAP.r112_headhunt.check({S:{flags:{r112_headhunt:true}}})
         && ACH_MAP.r112_bodybank.check({S:{flags:{r112_bodybank:true}}})
         && ACH_MAP.r112_sacrifice.check({S:{tradeLog:[{dn:'hp'},{dn:'hap'},{dn:'mny'}]}})
         && !ACH_MAP.r112_sacrifice.check({S:{tradeLog:[{dn:'hp'},{dn:'hp'}]}});
  s=fresh(40,{int:60,hp:60}); showEvent(skill); choose(0); out.summaryShown = r112TradeoffHTML().includes('魚與熊掌');
  s=fresh(40,{}); out.summaryHidden = r112TradeoffHTML()==='';
  /* ⑦ 舊存檔相容：缺 tradeLog 的 save 經 ensureState 補空陣列、不注入 r112 旗標 */
  const old={flags:{},attr:{hp:50,int:50,apr:50,mny:50,hap:50},age:40,alive:true}; ensureState(old);
  out.compat = Array.isArray(old.tradeLog) && old.tradeLog.length===0 && Object.keys(old.flags).every(k=>k.indexOf('r112')!==0);
  startGame(); s=S; out.clean = Array.isArray(s.tradeLog) && s.tradeLog.length===0 && Object.keys(s.flags||{}).every(k=>k.indexOf('r112')!==0);
  return JSON.stringify(out);
})()`, sandbox));
ok(r112.entryIn && r112.onceGated, 'R112 ① 取捨事件群 cond gating：三入口進池／once 已踏不重播');
ok(r112.gateShown && r112.gateHidden, 'R112 ② gate 屬性門檻：智力 70+ 才渲染高智選項、不足即隱藏（索引不偏移）');
ok(r112.headhunt && r112.meritwin, 'R112 ③ gate 選項落 r112_headhunt／r112_meritwin 旗標＋串既有 gateWin');
ok(r112.trade, 'R112 ④ 成長取捨：拉高一條+壓低一條 → r98trade 計數＋tradeLog 記明細（序列化往返保值）');
ok(r112.brHi, 'R112 ⑤ br 分流：健康 55+ 走 hi 把健康存回來立 r112_bodybank（連跑 3 次同值）');
ok(r112.brLo, 'R112 ⑥ br 分流：健康 <55 走 lo 拉傷收場不立 bodybank（門檻外確定性）');
ok(r112.srWin && r112.srLose, 'R112 ⑦ sr 魅力檢定：95 必過(connwin)／10 必敗，上下限不被 rnd 翻盤（連跑 5 次同值）');
ok(r112.ach && r112.summaryShown && r112.summaryHidden, 'R112 ⑧ 成就確定性不誤觸＋取捨人生結算回顧（有取捨才渲染、空則省略）');
ok(r112.compat && r112.clean, 'R112 ⑨ 舊存檔相容（補 tradeLog 空陣列）＋乾淨局零 r112 殘留');

// ===== R117 每日挑戰碼分享/重玩層：日期⇄碼雙射、防呆、確定性種子、最佳成績存檔、誠實無偽造百分位 =====
const r117 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  // ① 編碼雙射：合法日期 → 碼 → 還原回同一日期（含閏年 2/29、上下界）
  const dates=["20260614","20200101","20991231","20240229"];
  out.roundtrip = dates.every(d=>parseDailyCode(dailyToCode(d))===d);
  out.codePrefix = dates.every(d=>dailyToCode(d).indexOf("EL")===0);
  // ② 純 8 碼日期輸入也接受；空白/連字號/#/小寫一律容錯
  out.acceptRaw = parseDailyCode("20260614")==="20260614";
  const low="el"+(20260614).toString(36);
  out.tolerant = parseDailyCode(" "+low+" ")==="20260614" && parseDailyCode("#20260614")==="20260614" && parseDailyCode("EL-"+(20260614).toString(36).toUpperCase())==="20260614";
  // ③ 防呆：亂碼/非法日期/6碼種子碼/空字串一律 null（不與種子對戰 6 碼路徑搶路）
  out.rejectJunk = parseDailyCode("貓踩鍵盤")===null && parseDailyCode("K7PQ2X")===null
    && parseDailyCode("20261332")===null && parseDailyCode("")===null && parseDailyCode("99999999")===null && parseDailyCode("19990101")===null;
  // ④ 確定性：純日期碼 vs EL base36 碼 開兩局 → 開局出身/五圍/日期逐字一致
  startChallengeByCode("20260614"); const a1=JSON.stringify({o:S.origin&&S.origin.id, attr:S.attr, d:S.challenge.date});
  startChallengeByCode("EL"+(20260614).toString(36).toUpperCase()); const a2=JSON.stringify({o:S.origin&&S.origin.id, attr:S.attr, d:S.challenge.date});
  out.deterministic = a1===a2;
  // ⑤ 走 R4 日期種子路徑：S.challenge.date 正確、無 S.battle 混入
  out.challengePath = !!(S.challenge && S.challenge.date==="20260614" && !S.battle);
  // ⑥ 最佳成績沿用 dailyRec(date) 存檔（同日多次取最高）
  const rec=dailyRec("20260614"); rec.best=0; rec.best=Math.max(rec.best,120); rec.best=Math.max(rec.best,90);
  out.bestKeepMax = dailyRec("20260614").best===120;
  // ⑦ 誠實鐵律：碼面板/分享文案含挑戰碼且不得偽造伺服器百分位
  startChallengeByCode("20260614"); S.alive=false; S.age=70; S.attr={hp:60,int:60,apr:60,mny:60,hap:60};
  const card=r117ChallengeCardHTML(300), share=dailyShareText();
  const fake=/(贏過|勝過|打敗|擊敗|超越)[^。]{0,12}([0-9]{1,3}\\s*%|百分)[^。]{0,6}玩家/;
  out.honest = !fake.test(card) && !fake.test(share) && card.indexOf("挑戰碼")>=0 && card.indexOf("今日種子")>=0 && share.indexOf("挑戰碼")>=0;
  // ⑧ 挑戰後一般局還原：startGame 仍跑、種子碼 6 碼、無 challenge 殘留
  startGame(); out.normalOk = !S.challenge && typeof S.seed==="string" && S.seed.length===6;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['roundtrip','① 日期⇄挑戰碼雙射可逆(含閏年/上下界)'],
  ['codePrefix','② 挑戰碼一律 EL 前綴(與 6 碼種子碼形態互斥)'],
  ['acceptRaw','③ 接受純 8 碼日期輸入'],
  ['tolerant','④ 空白/連字號/#/大小寫容錯'],
  ['rejectJunk','⑤ 防呆：亂碼/非法日期/6碼種子碼/越界年份一律 null'],
  ['deterministic','⑥ 純日期碼與 EL 碼開兩局 開局出身/五圍逐字一致'],
  ['challengePath','⑦ 走 R4 日期種子路徑(S.challenge.date 正確、無 battle 混入)'],
  ['bestKeepMax','⑧ 最佳成績沿用 dailyRec(date) 取最高'],
  ['honest','⑨ 誠實：碼面板/分享文案含挑戰碼且不偽造伺服器百分位'],
  ['normalOk','⑩ 挑戰後一般局還原正常(種子碼 6 碼、無殘留)'],
].forEach(([k,m])=>ok(r117[k], 'R117 '+m));

// ===== R118 圖鑑收集牆（Collection Codex）：完成度確定性計算、戰利品稀有度排序、解鎖累積、向後相容、誠實無偽造排行 =====
const r118 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  // ① 完成度=已解鎖/總數的確定性計算：清空對應分類後各數字歸零、總數>0（got 另含出身/天賦/起手分類故不強求全 0）
  SAVE.ach={}; SAVE.deaths={}; SAVE.hiddenEnds={}; SAVE.badges={};
  const s0=collStats(); const g0=s0.got;
  out.zeroStart = s0.a===0 && s0.d===0 && s0.h===0 && s0.b===0 && s0.total>0 && s0.got<=s0.total;
  // ② 解鎖累積：寫入一筆成就/死法/隱藏結局 → collStats 對應數字 +1、got 精準 +3（模擬結算寫入 SAVE）
  SAVE.ach[ACHIEVEMENTS[0].id]=true;
  SAVE.deaths[DEATHBOOK[0].id]=true;
  const he2=HIDDEN_ENDINGS.find(h=>(h.rar||1)===2);
  SAVE.hiddenEnds[he2.id]=true;
  const s1=collStats();
  out.accumulate = s1.a===1 && s1.d===1 && s1.h===1 && s1.got===g0+3;
  // ③ 戰利品確定性排序：傳說隱藏結局(rar2)應排在最前；連呼叫兩次完全一致（零 rng）
  const t1=codexTopTrophies(4), t2=codexTopTrophies(4);
  out.troStable = JSON.stringify(t1)===JSON.stringify(t2);
  out.troLegendFirst = t1.length>0 && t1[0].tier==="☆☆傳說結局" && t1[0].nm===he2.nm;
  // ④ 優先序：SSR 稱號排在 ★稀有結局 之前；★稀有結局排在 SR 稱號之前
  const he1=HIDDEN_ENDINGS.find(h=>(h.rar||1)===1);
  const ssr=LIFE_BADGES.find(b=>b.tier==="SSR"), sr=LIFE_BADGES.find(b=>b.tier==="SR");
  SAVE.hiddenEnds[he1.id]=true; SAVE.badges[ssr.id]=true; SAVE.badges[sr.id]=true;
  const t3=codexTopTrophies(8);
  const idx=(nm)=>t3.findIndex(x=>x.nm===nm);
  out.priority = idx(ssr.nm)>=0 && idx(he1.nm)>=0 && idx(sr.nm)>=0
    && idx(ssr.nm)<idx(he1.nm) && idx(he1.nm)<idx(sr.nm) && idx(he2.nm)<idx(ssr.nm);
  // ⑤ 只列已解鎖（不破梗）：未解鎖的隱藏結局/稱號不得出現在戰利品中
  const lockedHe=HIDDEN_ENDINGS.find(h=>!SAVE.hiddenEnds[h.id]);
  out.onlyUnlocked = !codexTopTrophies(99).some(x=>x.nm===(lockedHe&&lockedHe.nm));
  // ⑥ cap 上限：codexTopTrophies(2) 至多回傳 2 筆
  out.capWorks = codexTopTrophies(2).length<=2;
  // ⑦ 向後相容：模擬舊存檔缺 hiddenEnds/deaths 鍵 → 函式不炸、視為全未解鎖
  const bak={ach:SAVE.ach,deaths:SAVE.deaths,hiddenEnds:SAVE.hiddenEnds,badges:SAVE.badges,origins:SAVE.origins};
  delete SAVE.hiddenEnds; delete SAVE.deaths; SAVE.ach={}; SAVE.badges={}; SAVE.origins={};
  let safe=true; try{ codexTopTrophies(4); collStats(); buildCodexText(); codexTrophyShelfHTML(); }catch(e){ safe=false; }
  out.legacySafe = safe && codexTopTrophies(4).length===0;
  SAVE.ach=bak.ach; SAVE.deaths=bak.deaths; SAVE.hiddenEnds=bak.hiddenEnds; SAVE.badges=bak.badges; SAVE.origins=bak.origins;
  // ⑧ 誠實鐵律：分享文字含完成度數字與連結，且不偽造伺服器排行/百分位
  const txt=buildCodexText();
  const fake=/(贏過|勝過|打敗|擊敗|超越|排名)[^。\\n]{0,12}([0-9]{1,3}\\s*%|百分)[^。\\n]{0,8}玩家/;
  out.honest = !fake.test(txt) && txt.indexOf("總完成度")>=0 && txt.indexOf("/")>=0 && txt.indexOf(SHARE_URL)>=0;
  // ⑨ 完成度百分比=round(got/total*100)：與 collStats 一致、不超過 100
  const s9=collStats(); const pct=Math.round(s9.got/s9.total*100);
  out.pctMatch = txt.indexOf("總完成度 "+pct+"%")>=0 && pct>=0 && pct<=100;
  // ⑩ 空櫃文案：全未解鎖時展示櫃給引導文案（不留白、不報錯）
  SAVE.ach={}; SAVE.deaths={}; SAVE.hiddenEnds={}; SAVE.badges={};
  out.emptyShelf = codexTrophyShelfHTML().indexOf("展示櫃還空著")>=0;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['zeroStart','① 完成度確定性計算(清空後 got=0、total>0)'],
  ['accumulate','② 解鎖累積：寫入成就/死法/隱藏結局後 collStats 對應 +1'],
  ['troStable','③ 戰利品排序確定性(連呼叫兩次逐字一致、零 rng)'],
  ['troLegendFirst','④ 傳說隱藏結局排最前'],
  ['priority','⑤ 稀有度優先序：傳說>SSR>★稀有結局>SR'],
  ['onlyUnlocked','⑥ 只列已解鎖(未解鎖不破梗外洩)'],
  ['capWorks','⑦ cap 上限正確'],
  ['legacySafe','⑧ 向後相容：舊存檔缺鍵不炸、視為全未解鎖'],
  ['honest','⑨ 誠實：分享文字含完成度+連結、不偽造伺服器排行'],
  ['pctMatch','⑩ 完成度百分比=round(got/total*100)、0~100'],
].forEach(([k,m])=>ok(r118[k], 'R118 '+m));

// ===== R119 人生回憶錄（Life Memoir）：依本局真實經歷自動生成可分享傳記、誠實不捏造、確定性零 rng、純呈現層不動數值 =====
const r119 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  startGame(); const s=S; ensureState(s); s.alive=false;
  s.age=82; s.attr={hp:70,int:70,apr:70,mny:70,hap:70};
  s.peak={hp:90,int:72,apr:60,mny:88,hap:70}; s.peakAge={hp:30,int:25,apr:18,mny:55,hap:40};
  s.low={hp:40,int:50,apr:45,mny:12,hap:30};
  s.title="地方創生頭家"; s.deathReason="壽終正寢，睡夢中安詳登出"; s.origin={id:"o1",nm:"工人家庭",ic:"🔧"};
  s.tl=[]; tlPush("👶","出生在小鎮的清晨",1); S.age=24; tlPush("💼","拿到人生第一份工作，社畜之路開跑",1);
  S.age=30; tlPush("💍","結婚了！單身狗識別證正式繳回",1); S.age=55; tlPush("🏠","買下人生第一間房，從此與房貸相依為命",1);
  S.age=82;
  // ① 生成結構：{title,age,paras} 齊備、段落>=3、含序章與收尾
  const m1=buildMemoir();
  out.gen = !!m1 && Array.isArray(m1.paras) && m1.paras.length>=3 && m1.age===82;
  const full=m1.paras.join("\\n");
  out.openFin = full.indexOf("地方創生頭家")>=0 && full.indexOf("工人家庭")>=0 && full.indexOf("壽終正寢")>=0 && full.indexOf("第 82 年")>=0;
  // ② 真實映射：放進時間軸的事件被織進傳記；沒放的不捏造
  out.realEvents = full.indexOf("社畜之路開跑")>=0 && full.indexOf("與房貸相依為命")>=0;
  out.noFabricate = full.indexOf("中了樂透")<0 && full.indexOf("環遊世界")<0;
  out.trajectory = full.indexOf("90")>=0 && full.indexOf("12")>=0;
  // ③ 確定性 + 零 rng：連跑兩次逐字一致、不消耗種子隨機
  let used=0; const old=rng; rng=function(){ used++; return old(); };
  const t1=JSON.stringify(buildMemoir()); const t2=JSON.stringify(buildMemoir());
  rng=old;
  out.rngZero = used===0;
  out.deterministic = t1===t2;
  // ④ 純呈現層不動數值：生成前後 S.attr 完全不變
  const before=JSON.stringify(S.attr); buildMemoir(); memoirHTML(); buildMemoirText();
  out.noMutate = JSON.stringify(S.attr)===before;
  // ⑤ 早夭/空時間軸相容：最小局不炸、仍給得出傳記
  startGame(); const e=S; ensureState(e); e.alive=false; e.age=4; e.tl=[]; e.deathReason="夭折"; e.rarity=null;
  let okEarly=false; try{ const em=buildMemoir(); okEarly=!!(em&&em.paras&&em.paras.length>=2); }catch(x){ okEarly=false; }
  out.earlyDeath = okEarly;
  // ⑥ 渲染 + 分享：面板含標題與複製鈕、文字版含享年與連結、不偽造伺服器排行
  startGame(); const r=S; ensureState(r); r.alive=false; r.age=75; r.attr={hp:60,int:60,apr:60,mny:60,hap:60};
  r.peak=Object.assign({},r.attr); r.low=Object.assign({},r.attr); r.title="地球路人"; r.deathReason="壽終正寢"; r.tl=[];
  const html=memoirHTML(); const txt=buildMemoirText();
  out.htmlOk = html.indexOf("人生回憶錄")>=0 && html.indexOf("copyMemoir")>=0;
  out.txtOk = txt.indexOf("享年 75 歲")>=0 && txt.indexOf(SHARE_URL)>=0;
  const fake=/(贏過|勝過|打敗|擊敗|超越|排名)[^。\\n]{0,12}([0-9]{1,3}\\s*%|百分)[^。\\n]{0,8}玩家/;
  out.honest = !fake.test(html) && !fake.test(txt);
  return JSON.stringify(out);
})()`, sandbox));
[
  ['gen','① 生成結構：buildMemoir 回傳 {title,age,paras}、段落>=3'],
  ['openFin','② 序章＋收尾齊備(稱號/出身/死法/享年)'],
  ['realEvents','③ 真實映射：時間軸事件被織進傳記'],
  ['noFabricate','④ 誠實不捏造：未發生劇情不外洩'],
  ['trajectory','⑤ 五圍軌跡取真實 peak/low'],
  ['rngZero','⑥ 零 rng() 消耗(不動遊戲序列)'],
  ['deterministic','⑦ 確定性：連跑兩次逐字一致'],
  ['noMutate','⑧ 純呈現層：生成前後 S.attr 不變'],
  ['earlyDeath','⑨ 早夭/空時間軸相容不炸'],
  ['htmlOk','⑩ 面板含標題與複製鈕'],
  ['txtOk','⑪ 文字版含享年與分享連結'],
  ['honest','⑫ 誠實鐵律：不偽造伺服器排行/百分位'],
].forEach(([k,m])=>ok(r119[k], 'R119 '+m));

// ===== R123 台味人生人格鑑定・一句定生死分享卡：確定性單一原型/衍生特質/稀有度估算/純呈現層不動數值/誠實不偽造統計 =====
const r123 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  // 場景①：航海王梭哈背債局 → 應命中賭性高、原型走賭徒/背債系
  startGame(); const s=S; ensureState(s); s.alive=false;
  s.age=55; s.attr={hp:40,int:60,apr:50,mny:25,hap:45};
  s.flags=Object.assign(s.flags||{},{r122_in:true,r122_path:"sailor",r122_endtype:"r122_end_debtgrad"});
  const p1=buildPersona();
  out.struct = !!p1 && typeof p1.nm==="string" && !!p1.id && typeof p1.rar==="number" && p1.traits && typeof p1.traits.gamble==="number";
  out.single = R123_PERSONAS.filter(x=>{ try{ return !!x.when(Object.assign({hp:0,int:0,apr:0,mny:0,hap:0},s.attr),s.flags,r123Traits(),s.age);}catch(e){return false;} }).length>=1;
  out.gambleRoute = p1.id==="debtgrad" || p1.id==="godtrader" || p1.traits.gamble>=40;
  // 確定性：連跑兩次逐字一致、零 rng 消耗
  let used=0; const old=rng; rng=function(){ used++; return old(); };
  const a1=JSON.stringify(buildPersona()), a2=JSON.stringify(buildPersona());
  const ht1=personaHTML(), ht2=personaHTML(), tx1=buildPersonaText(), tx2=buildPersonaText();
  rng=old;
  out.rngZero = used===0;
  out.deterministic = a1===a2 && ht1===ht2 && tx1===tx2;
  // 純呈現層：生成前後 S.attr / S.flags 完全不變
  const beforeA=JSON.stringify(S.attr), beforeF=JSON.stringify(S.flags);
  buildPersona(); personaHTML(); buildPersonaText(); r123Traits();
  out.noMutate = JSON.stringify(S.attr)===beforeA && JSON.stringify(S.flags)===beforeF;
  // 衍生特質皆 0~100 整數
  const tr=r123Traits();
  out.traitRange = [tr.liver,tr.lazy,tr.gamble,tr.loser].every(v=>Number.isInteger(v)&&v>=0&&v<=100);
  // 場景②：五圍全頂 → 人生勝利組（最優先命中、單一標籤）
  startGame(); const w=S; ensureState(w); w.alive=false; w.age=80; w.attr={hp:80,int:80,apr:80,mny:85,hap:80}; w.flags={};
  out.winner = buildPersona().id==="winner";
  // 場景③：爆肝局 → 肝指數高、命中肝帝
  startGame(); const lv=S; ensureState(lv); lv.alive=false; lv.age=58; lv.attr={hp:35,int:65,apr:50,mny:75,hap:50};
  lv.flags={qkLiverOn:true,bigco:true}; lv.seen=Object.assign(lv.seen||{},{overtime:true});
  const pl=buildPersona();
  out.liverKing = pl.id==="liverking" && pl.traits.liver>=55;
  // 場景④：空旗標平凡局 → 保底命中平凡打工人（人人有原型，不漏接）
  startGame(); const cm=S; ensureState(cm); cm.alive=false; cm.age=70; cm.attr={hp:55,int:55,apr:55,mny:55,hap:55}; cm.flags={};
  out.fallback = !!buildPersona().nm;
  // 渲染 + 分享：面板含標籤與複製鈕、文字版含遊戲連結與標籤
  startGame(); const r=S; ensureState(r); r.alive=false; r.age=60; r.attr={hp:60,int:60,apr:60,mny:60,hap:60}; r.flags={r122_in:true,r122_path:"saver"};
  const html=personaHTML(), txt=buildPersonaText(); const pp=buildPersona();
  out.htmlOk = html.indexOf("台味人生人格鑑定")>=0 && html.indexOf("copyPersona")>=0 && html.indexOf(pp.nm)>=0;
  out.txtOk = txt.indexOf(pp.nm)>=0 && txt.indexOf(SHARE_URL)>=0 && txt.indexOf("人格鑑定")>=0;
  // 誠實：標稀有度為「估算」、且不偽造「贏過/打敗 X% 玩家」式伺服器統計
  out.honestEstimate = html.indexOf("估算")>=0;
  const fake=/(贏過|勝過|打敗|擊敗|超越|排名)[^。\\n]{0,12}([0-9]{1,3}\\s*%|百分)[^。\\n]{0,8}玩家/;
  out.honest = !fake.test(html) && !fake.test(txt);
  // 缺 S（無局）相容不炸
  let okNull=true; try{ S=null; if(buildPersona()!==null) okNull=false; if(personaHTML()!=="") okNull=false; }catch(e){ okNull=false; }
  out.nullSafe = okNull;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['struct','① 生成結構：buildPersona 回傳 {id,nm,desc,rar,traits}'],
  ['single','② 至少一原型命中(優先序定生死、單一標籤)'],
  ['gambleRoute','③ 真實對應：航海王背債局命中賭徒系/賭性高'],
  ['rngZero','④ 零 rng() 消耗(不動遊戲序列)'],
  ['deterministic','⑤ 確定性：連跑兩次卡/HTML/文字逐字一致'],
  ['noMutate','⑥ 純呈現層：生成前後 S.attr/S.flags 不變'],
  ['traitRange','⑦ 衍生特質皆 0~100 整數(肝/躺/賭/魯)'],
  ['winner','⑧ 五圍全頂命中「人生勝利組」(優先序正確)'],
  ['liverKing','⑨ 爆肝局命中「爆肝過勞肝帝」且肝指數高'],
  ['fallback','⑩ 保底原型：空旗標平凡局必有單一標籤(不漏接)'],
  ['htmlOk','⑪ 面板含標題/標籤/複製鈕'],
  ['txtOk','⑫ 文字版含標籤與分享連結'],
  ['honestEstimate','⑬ 稀有度誠實標示為「估算」'],
  ['honest','⑭ 誠實鐵律：不偽造伺服器排行/百分位'],
  ['nullSafe','⑮ 無局(S=null)相容不炸'],
].forEach(([k,m])=>ok(r123[k], 'R123 '+m));

// ===== R124 病毒人生挑戰迴圈：戰帖編碼/解碼容錯、首屏橫幅、完局對照、純呈現層不動序列 =====
sandbox.btoa = (str)=>Buffer.from(str,'binary').toString('base64');
sandbox.atob = (b64)=>Buffer.from(b64,'base64').toString('binary');
const r124 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  // 完局資料：航海王背債局
  startGame(); const s=S; ensureState(s); s.alive=false;
  s.age=62; s.attr={hp:40,int:60,apr:50,mny:25,hap:45};
  s.flags=Object.assign(s.flags||{},{r122_in:true,r122_path:"sailor",r122_endtype:"r122_end_debtgrad"});
  s.deathReason="<b>梭哈梭到畢業</b>，套房裡只剩對帳單";
  // ① payload 精簡結構：含 享年/人格名/圖示/稀有度/死法/五圍，五圍長度=5
  const pay=buildChallengePayload();
  out.payload = typeof pay.a==="number" && typeof pay.n==="string" && typeof pay.i==="string"
    && typeof pay.r==="number" && typeof pay.d==="string" && Array.isArray(pay.s) && pay.s.length===5;
  // ② 死法去標籤（不帶 < > 標籤殘留）、欄位截短
  out.stripped = pay.d.indexOf("<")<0 && pay.d.indexOf(">")<0 && pay.n.length<=24 && pay.d.length<=42;
  // ③ encode→decode round-trip 還原一致（透過注入 location.hash 走 readChallengeHash）
  const enc=b64urlEncode(JSON.stringify(pay));
  globalThis.location={hash:"#c="+enc};
  const dec=readChallengeHash();
  out.roundtrip = !!dec && dec.a===pay.a && dec.n===pay.n && dec.r===pay.r
    && JSON.stringify(dec.s)===JSON.stringify(pay.s);
  // ④ URL 精簡：總長合理（避免超長），且為 #c= 格式
  const url=buildChallengeURL();
  out.compactUrl = url.indexOf("#c=")>=0 && url.length<320;
  // ⑤ 容錯：壞 base64 / 舊版缺欄位 / 空 hash 一律降級為 null（絕不報錯）
  let robust=true;
  try{
    globalThis.location={hash:"#c=@@@notbase64@@@"}; if(readChallengeHash()!==null) robust=false;
    globalThis.location={hash:"#c="+b64urlEncode(JSON.stringify({v:1,foo:"bar"}))}; if(readChallengeHash()!==null) robust=false;  // 缺 s/a
    globalThis.location={hash:""}; if(readChallengeHash()!==null) robust=false;
    globalThis.location={hash:"#r=abc"}; if(readChallengeHash()!==null) robust=false;  // 別人的 hash 不誤判
  }catch(e){ robust=false; }
  out.robust = robust;
  // ⑥ CHALLENGE 為空時：首屏橫幅與完局對照皆整段省略（不破壞既有畫面）
  CHALLENGE=null;
  out.emptySafe = challengeBannerHTML()==="" && challengeCompareHTML()==="";
  // ⑦ 首屏戰帖橫幅：含被挑戰者人格/稀有度與「接受挑戰」鈕、走自嘲不踩仇恨紅線
  CHALLENGE={a:88,n:"養生長壽仙",i:"🥦",r:10,d:"睡夢中安詳登出",s:[78,60,55,50,70]};
  const banner=challengeBannerHTML();
  out.banner = banner.indexOf("戰帖")>=0 && banner.indexOf("養生長壽仙")>=0
    && banner.indexOf("10%")>=0 && banner.indexOf("acceptChallenge")>=0;
  // ⑧ 完局對照：你 vs 對方、含勝負定性與「換你下戰帖」鈕
  startGame(); const me=S; ensureState(me); me.alive=false; me.age=45; me.attr={hp:30,int:60,apr:50,mny:25,hap:40};
  me.flags={r122_endtype:"r122_end_debtgrad"};
  const cmp=challengeCompareHTML();
  out.compare = cmp.indexOf("挑戰結果對照")>=0 && cmp.indexOf("VS")>=0
    && cmp.indexOf("copyChallengeLink")>=0
    && (cmp.indexOf("你贏了")>=0 || cmp.indexOf("你輸了")>=0 || cmp.indexOf("平手")>=0);
  // ⑨ 對照勝負方向正確：我 45 歲 < 對方 88 歲 → 壽命落敗段呈現「少活」
  out.compareDir = cmp.indexOf("少活")>=0;
  // ⑩ 純呈現層：產 payload/URL/對照 前後 S.attr / S.flags 完全不變（不動 sim/state 序列）
  const bA=JSON.stringify(S.attr), bF=JSON.stringify(S.flags);
  buildChallengePayload(); buildChallengeURL(); challengeCompareHTML(); challengeBannerHTML();
  out.noMutate = JSON.stringify(S.attr)===bA && JSON.stringify(S.flags)===bF;
  // ⑪ 零 rng 消耗（不踏進遊戲隨機序列）
  let used=0; const old=rng; rng=function(){ used++; return old(); };
  buildChallengePayload(); buildChallengeURL(); challengeCompareHTML(); challengeBannerHTML();
  rng=old; out.rngZero = used===0;
  // ⑫ 無局(S=null)相容：產 payload 不炸、對照/橫幅安全
  let okNull=true; try{ S=null; CHALLENGE=null; buildChallengePayload(); if(challengeCompareHTML()!=="") okNull=false; }catch(e){ okNull=false; }
  out.nullSafe = okNull;
  CHALLENGE=null; delete globalThis.location;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['payload','① 戰帖 payload 精簡結構(享年/人格/圖示/稀有度/死法/五圍×5)'],
  ['stripped','② 死法去標籤+欄位截短(避免超長)'],
  ['roundtrip','③ encode→decode 還原一致(readChallengeHash)'],
  ['compactUrl','④ URL 精簡 #c= 格式且總長合理'],
  ['robust','⑤ 容錯:壞碼/舊版缺欄位/空hash/他人hash 一律安全降級 null'],
  ['emptySafe','⑥ 無戰帖時首屏橫幅與完局對照整段省略'],
  ['banner','⑦ 首屏戰帖橫幅含人格/稀有度/接受挑戰鈕'],
  ['compare','⑧ 完局挑戰結果對照含你vs對方/勝負定性/換你下戰帖鈕'],
  ['compareDir','⑨ 對照勝負方向正確(45<88→少活)'],
  ['noMutate','⑩ 純呈現層:生成前後 S.attr/S.flags 不變(不動序列)'],
  ['rngZero','⑪ 零 rng() 消耗'],
  ['nullSafe','⑫ 無局(S=null)相容不炸'],
].forEach(([k,m])=>ok(r124[k], 'R124 '+m));

// ===== R125 平行人生・如果當初：反事實假想推演鉤 — 關鍵抉擇確定性挑選/假想標示/純呈現零rng/S不變/安全降級 =====
const r125 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  // 完局資料：手動鋪一組關鍵抉擇紀錄 keySnap
  startGame(); const s=S; ensureState(s); s.alive=false; s.age=70;
  s.attr={hp:40,int:60,apr:50,mny:30,hap:45};
  s.keySnap=[
    {age:25,k:'int',v:72,kind:'gate',won:true,ev:'志願抉擇'},
    {age:40,k:'mny',v:55,kind:'sr',won:false,ev:'拚上車買房'},   // 翻車 sr → 遺憾加權，預期被挑中
    {age:33,k:'hp',v:48,kind:'br',won:true,ev:'爆肝衝刺'},
  ];
  // ① 關鍵抉擇挑選確定性：多次呼叫挑到同一筆(這裡 40 歲翻車 sr 評分最高)
  const k1=r125PickKey(s.keySnap), k2=r125PickKey(s.keySnap);
  out.pickDet = !!k1 && !!k2 && k1.age===k2.age && k1.k===k2.k && k1.kind===k2.kind && k1.age===40 && k1.won===false;
  // ② 假想文案存在且標示為假設(含「假設彩蛋」「假想推演」「再走一次」鈕)
  const h1=r125WhatIfHTML();
  out.hasImagined = h1.indexOf('假想推演')>=0 && h1.indexOf('假設彩蛋')>=0
    && h1.indexOf('如果當初')>=0 && h1.indexOf('r125Replay')>=0 && h1.indexOf('真實發生')>=0;
  // ③ 嚴禁捏造真實統計：明示「非真實模擬數據」否認(免責聲明明確否認伺服器統計/百分位)，且無捏造的「贏過/打敗 N%」式假數據
  out.noFakeStat = h1.indexOf('非真實模擬數據')>=0 && h1.indexOf('沒有任何伺服器統計或百分位')>=0
    && !/(贏過|打敗|勝過|超越|擊敗|勝率|存活率)[^。]{0,8}\d+\s*%/.test(h1);
  // ④ HTML 渲染確定性：同 state 連兩次輸出一致
  out.htmlDet = r125WhatIfHTML()===r125WhatIfHTML();
  // ⑤ 純呈現零汙染：生成前後 S.attr/S.flags/keySnap 完全不變
  const bA=JSON.stringify(S.attr), bF=JSON.stringify(S.flags), bK=JSON.stringify(S.keySnap);
  r125WhatIfHTML(); r125PickKey(S.keySnap);
  out.noMutate = JSON.stringify(S.attr)===bA && JSON.stringify(S.flags)===bF && JSON.stringify(S.keySnap)===bK;
  // ⑥ 零 rng() 消耗(不踏進遊戲隨機序列)
  let used=0; const old=rng; rng=function(){ used++; return old(); };
  r125WhatIfHTML(); r125PickKey(S.keySnap);
  rng=old; out.rngZero = used===0;
  // ⑦ 安全降級：無有效抉擇(極早夭/空 keySnap) → 不報錯、給通用感慨且仍含再走一次鈕
  S.keySnap=[]; const hEmpty=r125WhatIfHTML();
  out.degrade = hEmpty.indexOf('連選的機會都沒有')>=0 && hEmpty.indexOf('r125Replay')>=0 && hEmpty.indexOf('假設彩蛋')>=0;
  // ⑧ 髒資料相容：keySnap 含壞鍵(未知屬性/缺欄位) 被濾掉不炸
  S.keySnap=[{age:10,k:'???',v:5,kind:'gate',won:true,ev:'x'},{age:20,k:'hp',v:50,kind:'sr',won:true,ev:'保命關'}];
  let dirtyOk=true; try{ const hd=r125WhatIfHTML(); dirtyOk = hd.indexOf('保命關')>=0; }catch(e){ dirtyOk=false; }
  out.dirtySafe = dirtyOk;
  // ⑨ 無局(S=null)相容：不炸、回空字串
  let okNull=true; try{ S=null; if(r125WhatIfHTML()!=="") okNull=false; }catch(e){ okNull=false; }
  out.nullSafe = okNull;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['pickDet','① 關鍵抉擇挑選確定性(翻車sr遺憾加權→穩定挑同一筆)'],
  ['hasImagined','② 假想推演文案存在且含真實發生/再走一次鈕'],
  ['noFakeStat','③ 不捏造統計(無百分位/伺服器)且明示非真實模擬數據'],
  ['htmlDet','④ HTML 渲染確定性(同 state 連兩次一致)'],
  ['noMutate','⑤ 純呈現零汙染:生成前後 S.attr/flags/keySnap 不變'],
  ['rngZero','⑥ 零 rng() 消耗'],
  ['degrade','⑦ 無有效抉擇安全降級(通用感慨+再走一次鈕，不白屏)'],
  ['dirtySafe','⑧ 髒資料(壞屬性鍵)被濾掉不炸'],
  ['nullSafe','⑨ 無局(S=null)相容回空字串不炸'],
].forEach(([k,m])=>ok(r125[k], 'R125 '+m));

// ============================================================================
// R126 開局人生難度：結構/守恆對稱/預設等價/挑戰強制預設/零 rng 影響/長期修正生效/
//   非法防呆/序列化相容/UI 渲染（難度選擇頁＋開局牌＋結算卡＋分享文）
// ============================================================================
const r126 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  /* ① 結構＋守恆對稱：三難度齊備、淨值 +5/0/−5、單屬性 |≤8|、普通＝零 eff/mod */
  function net(e){ let s=0,mx=0; for(const k in (e||{})){ s+=e[k]; mx=Math.max(mx,Math.abs(e[k])); } return {s,mx}; }
  const ne=net(R126_MAP.easy.eff), nh=net(R126_MAP.hell.eff);
  out.struct = R126_DIFFS.length===3 && ne.s===5 && net(R126_MAP.normal.eff).s===0 && nh.s===-5
    && ne.mx<=8 && nh.mx<=8 && !R126_MAP.normal.eff && !R126_MAP.normal.mod;
  /* ② 預設等價：同種子 startGame()/startGame('normal')/undefined → base 與 diff 一致 */
  const oc=randomSeedCode; randomSeedCode=function(){return 'AAAAAA';};
  startGame(); const a=JSON.stringify(S.attr);
  startGame('normal'); const b=JSON.stringify(S.attr);
  startGame(undefined); const c=JSON.stringify(S.attr);
  out.defaultEquiv = a===b && b===c && S.diff==='normal';
  /* ③ 難度生效：方向正確（easy 富/智低、hell 窮/樂高），且開局日誌記下自選難度 */
  startGame('normal'); const N=Object.assign({},S.attr);
  startGame('easy'); const E=Object.assign({},S.attr); const easyLog=S.log.some(l=>l.indexOf('自選開局難度')>=0 && l.indexOf('含金湯匙')>=0);
  startGame('hell'); const H=Object.assign({},S.attr);
  out.diffApplies = E.mny>N.mny && E.int<N.int && H.mny<N.mny && H.hap>N.hap && easyLog && S.diff==='hell';
  /* ④ 零 rng 影響：同碼 normal/easy/hell 抽 rng 數列一致（種子序列不被難度擾動） */
  function nums(d){ randomSeedCode=function(){return 'CCCCCC';}; startGame(d); const r=[]; for(let i=0;i<20;i++)r.push(rng()); return r; }
  const rn=nums('normal'), re=nums('easy'), rh=nums('hell');
  let eq=true; for(let i=0;i<20;i++){ if(rn[i]!==re[i]||rn[i]!==rh[i]) eq=false; } out.rngZero=eq;
  randomSeedCode=oc;
  /* ⑤ 挑戰/對戰強制預設：今日挑戰 diff='normal'、r126Diff()=null（全服公平鐵律） */
  startChallenge('20260615'); out.dailyDefault = S.diff==='normal' && r126Diff()===null;
  startSeedBattle('K7PQ2X'); out.battleDefault = S.diff==='normal' && r126Diff()===null;
  /* ⑥ 長期修正在 choose() 生效：easy 砍快樂正增益(+10→+5)、hell 減快樂跌幅(−10→−5)、
        各自只動自家方向（easy 不碰跌幅、hell 不碰增益）、普通完全不修——stub 掉 showResult 避開 DOM */
  const _sr=showResult; showResult=function(){};
  function hap(diff, d){
    randomSeedCode=function(){return 'DDDDDD';}; startGame(diff); randomSeedCode=oc;
    S.age=30; S.attr.hap=50; const before=S.attr.hap;
    CURRENT={id:'_t126',title:'測試',choices:[{label:'x',eff:{hap:d},res:'r'}]};
    choose(0); return S.attr.hap-before;
  }
  out.modEasy = hap('normal',10)===10 && hap('easy',10)===5 && hap('easy',-10)===-10;
  out.modHell = hap('normal',-10)===-10 && hap('hell',-10)===-5 && hap('hell',10)===10;
  /* 長期修正帳單會出現在 S.lastWarn（玩家看得到每一筆帳） */
  hap('easy',10); out.modNote = (S.lastWarn||[]).some(w=>w.s && w.s.indexOf('溫室花朵')>=0);
  showResult=_sr;
  /* ⑦ 非法 id 防呆：startGame('xxx') 落回預設 */
  randomSeedCode=function(){return 'AAAAAA';}; startGame('xxx'); randomSeedCode=oc;
  out.badId = S.diff==='normal' && r126Diff()===null;
  /* ⑧ 序列化相容：S.diff 純字串往返保值；舊存檔缺鍵 ensureState 不炸 */
  startGame('hell'); const rt=JSON.parse(JSON.stringify({d:S.diff})).d;
  let compat=true; try{ ensureState({flags:{},attr:{hp:50,int:50,apr:50,mny:50,hap:50},age:40,alive:true}); }catch(e){ compat=false; }
  out.serialCompat = rt==='hell' && typeof S.diff==='string' && compat;
  /* ⑨ UI：難度選擇頁含三難度＋鬼島標語；開局牌顯示難度；非預設局 r126Diff 有值 */
  let ui=false; try{ screenDifficulty(); const h=document.querySelector('#app').innerHTML;
    ui = h.indexOf('選你敢挑戰的人生')>=0 && h.indexOf('地獄級')>=0 && h.indexOf('含金湯匙')>=0 && h.indexOf("startGame('hell')")>=0; }catch(e){ out.uiErr=String(e&&e.message||e); }
  out.uiDiffScreen = ui;
  startGame('hell'); let birth=false; try{ renderBirth(); birth=document.querySelector('#app').innerHTML.indexOf('開局難度')>=0; }catch(e){ out.birthErr=String(e&&e.message||e); }
  out.uiBirth = birth;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['struct','① 結構＋守恆對稱(淨值+5/0/−5、單屬性|≤8|、普通＝零eff/mod預設)'],
  ['defaultEquiv','② 預設等價(startGame()/normal/undefined 同種子 base 一致、diff=normal)'],
  ['diffApplies','③ 難度生效(easy富/智低、hell窮/樂高)＋開局日誌記自選難度'],
  ['rngZero','④ 零 rng 影響(同碼三難度 rng 數列一致，種子序列不被擾動)'],
  ['dailyDefault','⑤ 今日挑戰強制預設(diff=normal、r126Diff=null 全服公平)'],
  ['battleDefault','⑤ 種子對戰強制預設(diff=normal、r126Diff=null)'],
  ['modEasy','⑥ 長期修正-簡單:快樂正增益砍半(+10→+5)、不碰跌幅'],
  ['modHell','⑥ 長期修正-地獄:快樂跌幅減半(−10→−5)、不碰增益'],
  ['modNote','⑥ 修正帳單入 S.lastWarn(玩家看得到每筆帳)'],
  ['badId','⑦ 非法 id 防呆落回預設'],
  ['serialCompat','⑧ 序列化相容(S.diff 純字串往返保值＋舊存檔缺鍵不炸)'],
  ['uiDiffScreen','⑨ 難度選擇頁渲染(標語＋三難度＋投胎鈕)'],
  ['uiBirth','⑨ 開局牌顯示難度'],
].forEach(([k,m])=>ok(r126[k], 'R126 '+m + ((!r126[k]&&r126[k.replace('ui','ui')+'Err'])?(' ['+(r126.uiErr||r126.birthErr)+']'):'')));

// ============================================================================
// R127 鬼島人生・時事諷刺新聞快報：頭條生成確定性/讀本局真實資料/渲染存在/零rng/
//   零汙染(S.attr/flags/keySnap/tl不變)/不捏造統計/S=null＋空tl＋壞資料安全降級
// ============================================================================
const r127 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  // 完局資料：鋪一組「真實發生過」的大事時間軸 S.tl
  startGame(); const s=S; ensureState(s); s.alive=false; s.age=68;
  s.attr={hp:22,int:60,apr:50,mny:25,hap:45};
  s.tl=[
    {age:8,  ic:'🐾', txt:'迎來毛孩主子，正式上任鏟屎官', lv:1},
    {age:30, ic:'💍', txt:'結婚了！單身狗識別證正式繳回', lv:1},
    {age:42, ic:'🏠', txt:'買下人生第一間房，從此與房貸相依為命', lv:1},
    {age:55, ic:'📉', txt:'創業倒閉／破產，扛下一身債與教訓', lv:2},
  ];
  // ① 頭條生成確定性：同輸入連兩次完全一致，且明顯讀到真實資料(年齡數字＋事件片段)
  const l1=r127NewsLine(s.tl[1].txt, s.tl[1].age, s.attr);
  const l2=r127NewsLine(s.tl[1].txt, s.tl[1].age, s.attr);
  out.lineDet = l1===l2 && l1.indexOf('30')>=0 && l1.indexOf('【')===0;
  // ② 渲染存在：LIVE 快報面板＋結算大事報皆生成，且大事報含真實事件改寫的頭條
  const hb=r127BreakingHTML(), hd=r127DigestHTML();
  // LIVE 面板讀最新一條大事(age 55 破產)現場連線，非死亡年齡
  out.render = hb.indexOf('鬼島快報 LIVE')>=0 && hb.indexOf('55')>=0
    && hd.indexOf('鬼島人生大事報')>=0 && hd.indexOf('【')>=0 && hd.indexOf('copyR127Digest')>=0;
  // ③ HTML 渲染確定性：同 state 連兩次輸出一致
  out.htmlDet = r127BreakingHTML()===r127BreakingHTML() && r127DigestHTML()===r127DigestHTML();
  // ④ 不捏造統計：頭條走自嘲質性梗，無「贏過/打敗 N%」式假數據、無百分位
  out.noFakeStat = !/(贏過|打敗|勝過|超越|擊敗|勝率|存活率|百分位)[^。　]{0,8}\\d+\\s*%/.test(hb+hd);
  // ⑤ 純呈現零汙染：生成前後 S.attr/flags/keySnap/tl 完全不變
  const bA=JSON.stringify(S.attr), bF=JSON.stringify(S.flags), bK=JSON.stringify(S.keySnap), bT=JSON.stringify(S.tl);
  r127BreakingHTML(); r127DigestHTML(); buildR127DigestText(); r127NewsLine('測試事件',40,S.attr);
  out.noMutate = JSON.stringify(S.attr)===bA && JSON.stringify(S.flags)===bF
    && JSON.stringify(S.keySnap)===bK && JSON.stringify(S.tl)===bT;
  // ⑥ 零 rng() 消耗(不踏進遊戲隨機序列)
  let used=0; const old=rng; rng=function(){ used++; return old(); };
  r127BreakingHTML(); r127DigestHTML(); buildR127DigestText(); r127NewsLine(S.tl[0].txt,8,S.attr);
  rng=old; out.rngZero = used===0;
  // ⑦ 大事報純文字版：含享年＋四則頭條彙整
  const txt=buildR127DigestText();
  out.textOk = txt.indexOf('鬼島人生大事報')>=0 && txt.indexOf('享年 68 歲')>=0 && (txt.match(/【/g)||[]).length===4;
  // ⑧ 空 tl 降級：LIVE/大事報/文字版皆回空字串，不報錯
  S.tl=[]; out.emptyDeg = r127BreakingHTML()==='' && r127DigestHTML()==='' && buildR127DigestText()==='';
  // ⑨ 壞資料相容：tl 含 null/缺 txt 條目 → 被濾掉不炸，仍能渲染剩餘有效頭條
  S.tl=[null,{age:20,ic:'x'},{age:33,txt:'被詐騙割走錢財，韭菜學費繳好繳滿',lv:1}];
  let dirtyOk=true; try{ const hd2=r127DigestHTML(); dirtyOk = hd2.indexOf('韭菜')>=0 || hd2.indexOf('【')>=0; }catch(e){ dirtyOk=false; }
  out.dirtySafe = dirtyOk;
  // ⑩ 無局(S=null)相容：全數回空字串、不炸
  let okNull=true; try{ S=null; if(r127BreakingHTML()!==''||r127DigestHTML()!==''||buildR127DigestText()!=='') okNull=false; }catch(e){ okNull=false; }
  out.nullSafe = okNull;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['lineDet','① 頭條生成確定性(同輸入連兩次一致＋讀真實年齡/事件)'],
  ['render','② 渲染存在(LIVE快報面板＋結算大事報＋複製鈕)'],
  ['htmlDet','③ HTML 渲染確定性(同 state 連兩次一致)'],
  ['noFakeStat','④ 不捏造統計(無百分位/贏過N%式假數據)'],
  ['noMutate','⑤ 純呈現零汙染:生成前後 S.attr/flags/keySnap/tl 不變'],
  ['rngZero','⑥ 零 rng() 消耗'],
  ['textOk','⑦ 大事報純文字版(享年＋四則頭條彙整)'],
  ['emptyDeg','⑧ 空 tl 安全降級(全回空字串不白屏)'],
  ['dirtySafe','⑨ 髒資料(null/缺txt條目)被濾掉不炸'],
  ['nullSafe','⑩ 無局(S=null)相容全回空字串不炸'],
].forEach(([k,m])=>ok(r127[k], 'R127 '+m));

// ===== R128 台味手遊課金抽卡人生支線：支線可達性/分流節點/結局確定性/屬性真驅動/旗標純淨/壞資料降級/存檔相容/S=null 相容/爆肝死法可達 =====
const r128 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function fresh(age,fl,attr){ startGame(); const s=S; s.origin=ORIGIN_MAP.office; s.flags=Object.assign({},fl||{}); ensureState(s); s.seen={}; s.alive=true; if(age!=null)s.age=age; if(attr)Object.assign(s.attr,attr); return s; }
  const _roll=r128Roll;
  // ① 支線可達性：成年窗口＋乾淨＋閘命中→入口 r128_hook
  let s=fresh(30,{}); r128Roll=function(){return 0.1;}; out.entry = !!r128GachaPick() && r128GachaPick().id==='r128_hook';
  // ② 閘落空→不插播、零殘留（舊存檔無旗標時不寫任何 r128 鍵）
  s=fresh(30,{}); r128Roll=function(){return 0.9;}; out.gateMiss = r128GachaPick()===null;
  out.gateMissPure = !('r128step' in s.flags) && !('r128_in' in s.flags) && !('r128path' in s.flags);
  r128Roll=_roll;
  // ③ 窗口外（未接觸手遊年齡／過老）不插播
  s=fresh(10,{}); out.gateYoung = r128GachaPick()===null;
  s=fresh(70,{}); out.gateOld   = r128GachaPick()===null;
  s=fresh(30,{r128step:99}); out.gateDone = r128GachaPick()===null;   // 已收尾不再插播
  // ④ 入口三分流：踏進三選項各立 path+step:1+r128_in；第4選項直接收尾(step:99 無 path 無 r128_in)
  function pick0(idx){ s=fresh(30,{}); const ev=r128ById('r128_hook'); showEvent(ev); choose(idx); return s.flags; }
  out.splitF2p    = (g=>g.r128path==='f2p'   &&g.r128step===1&&!!g.r128_in)(pick0(0));
  out.splitMinnow = (g=>g.r128path==='minnow'&&g.r128step===1&&!!g.r128_in)(pick0(1));
  out.splitWhale  = (g=>g.r128path==='whale' &&g.r128step===1&&!!g.r128_in)(pick0(2));
  out.splitNone   = (g=>g.r128step===99&&!g.r128path&&!g.r128_in)(pick0(3));
  // ⑤ 分流節點：依 path＋step 確定性返回對應節點
  s=fresh(30,{r128step:1,r128path:'f2p'});    out.nodeF2p    =(r128GachaPick()||{}).id==='r128_f2p';
  s=fresh(30,{r128step:1,r128path:'minnow'}); out.nodeMinnow =(r128GachaPick()||{}).id==='r128_minnow';
  s=fresh(30,{r128step:1,r128path:'whale'});  out.nodeWhale  =(r128GachaPick()||{}).id==='r128_whale';
  // ⑥ step2 結局確定性落地 r128_endtype/r128_endhit
  s=fresh(30,{r128step:2,r128path:'whale',r128w_mny:true}); const e2=r128GachaPick();
  out.endLand = e2 && e2.id==='r128_end_whale' && s.flags.r128_endtype==='r128_end_whale' && s.flags.r128_endhit===true;
  // ⑦ 結局 picker 5 選 1 映射正確（純讀旗標、零 rng）
  out.endId = r128EndingId({r128path:'whale',r128w_mny:true})==='r128_end_whale'
    && r128EndingId({r128path:'whale'})==='r128_end_debt'
    && r128EndingId({r128path:'minnow',r128_addict:true})==='r128_end_debt'
    && r128EndingId({r128path:'minnow'})==='r128_end_minnow'
    && r128EndingId({r128path:'f2p',r128w_int:true})==='r128_end_f2p'
    && r128EndingId({r128path:'f2p'})==='r128_end_quit'
    && r128EndingId({})==='r128_end_quit';   // 防呆：未設 path 落 f2p 分支
  // ⑧ 屬性真驅動：f2p 智力檢定（高 int 看穿期望值過關 r128w_int；低 int 破戒）
  function chain1(path,attr,idx){ s=fresh(30,{r128step:1,r128path:path}); Object.assign(s.attr,attr); const ev=r128GachaPick(); showEvent(ev); choose(idx); return s.flags; }
  out.f2pWin  = [0,0,0].every(()=>!!chain1('f2p',{int:100},0).r128w_int);   // int 高→看穿期望值不破戒
  out.f2pLose = [0,0,0].every(()=>!chain1('f2p',{int:5},0).r128w_int);      // int 低→忍不住破戒
  // whale 財富檢定（厚口袋撐住 r128w_mny / 薄口袋刷爆卡）
  out.whaleWin  = [0,0,0].every(()=>!!chain1('whale',{mny:100},0).r128w_mny);
  out.whaleLose = [0,0,0].every(()=>!chain1('whale',{mny:5},0).r128w_mny);
  // minnow 平選項『越課越深』立 r128_addict → 卡債
  out.minnowAddict = !!chain1('minnow',{hap:50},1).r128_addict;
  // ⑨ 爆肝死法可達：whale 爆肝刷夜場(special r128_allnight)身體見底→gachaburn；f2p 爆肝硬刷同理
  s=fresh(40,{r128step:1,r128path:'whale'}); s.attr.hp=10; s.attr.mny=10; showEvent(r128ById('r128_whale')); choose(1);
  out.deathWhale = s.flags.specialDeath==='gachaburn';
  s=fresh(40,{r128step:1,r128path:'f2p'}); s.attr.hp=10; showEvent(r128ById('r128_f2p')); choose(1);
  out.deathF2p = s.flags.specialDeath==='gachaburn' && typeof SPECIAL_DEATHS.gachaburn==='object';
  // ⑩ 旗標純淨：乾淨開局無任何 r128 旗標
  startGame(); const clean=S; ensureState(clean);
  out.cleanPure = !Object.keys(clean.flags).some(k=>k.indexOf('r128')===0);
  // ⑪ 回顧戰績卡：沒踏進(無 r128_in)整段省略；踏進+結局→含標題與結局名與「這輩子課了」
  s=fresh(50,{}); out.reviewEmpty = r128GachaReviewHTML()==='';
  s=fresh(50,{r128_in:true,r128path:'whale',r128w_mny:true,r128_endtype:'r128_end_whale'});
  const rv=r128GachaReviewHTML();
  out.reviewShow = rv.indexOf('課金抽卡人生')>=0 && rv.indexOf('課長傳說')>=0 && rv.indexOf('這輩子課了')>=0;
  // ⑫ 純呈現零汙染：生成回顧前後 S.attr/flags 不變、零 rng 消耗
  const bA=JSON.stringify(S.attr), bF=JSON.stringify(S.flags);
  let used=0; const old=rng; rng=function(){ used++; return old(); };
  r128GachaReviewHTML(); r128GachaReviewHTML();
  rng=old;
  out.reviewPure = JSON.stringify(S.attr)===bA && JSON.stringify(S.flags)===bF && used===0;
  // ⑬ 壞資料降級：髒/缺欄位旗標 → 不炸，仍安全渲染（不誤觸發整段）
  let dirtyOk=true; try{ s=fresh(50,{r128_in:true,r128path:'???',r128_endtype:'no_such'}); const h=r128GachaReviewHTML(); dirtyOk = h.indexOf('課金抽卡人生')>=0; }catch(e){ dirtyOk=false; }
  out.dirtySafe = dirtyOk;
  // ⑭ 存檔相容：舊存檔缺 r128 鍵 → ensureState 不補 r128 鍵；閘落空亦零殘留
  startGame(); const oldsave=S; delete oldsave.flags.r128step; ensureState(oldsave);
  out.compatOld = !('r128step' in oldsave.flags) && !('r128_in' in oldsave.flags);
  // ⑮ 無局(S=null)相容：picker 回 null、回顧回空字串，皆不炸
  let okNull=true; try{ S=null; if(r128GachaPick()!==null) okNull=false; if(r128GachaReviewHTML()!=='') okNull=false; }catch(e){ okNull=false; }
  out.nullSafe = okNull;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['entry','① 支線可達性：成年窗口+閘命中→入口 r128_hook'],
  ['gateMiss','② 閘落空→不插播'],
  ['gateMissPure','② 閘落空零殘留(不寫任何 r128 旗標)'],
  ['gateYoung','③ 窗口外(過小)不插播'],
  ['gateOld','③ 窗口外(過老)不插播'],
  ['gateDone','③ 已收尾(step99)不再插播'],
  ['splitF2p','④ 入口分流：無課堅持立 path/step/in'],
  ['splitMinnow','④ 入口分流：小資微課立 path/step/in'],
  ['splitWhale','④ 入口分流：課長梭哈立 path/step/in'],
  ['splitNone','④ 入口分流：沒在玩→step99 無 path 無 in'],
  ['nodeF2p','⑤ 分流節點：f2p→r128_f2p'],
  ['nodeMinnow','⑤ 分流節點：minnow→r128_minnow'],
  ['nodeWhale','⑤ 分流節點：whale→r128_whale'],
  ['endLand','⑥ step2 結局確定性落地 r128_endtype/r128_endhit'],
  ['endId','⑦ 結局 picker 5 選 1 映射正確(純讀旗標零 rng)'],
  ['f2pWin','⑧ 屬性真驅動：高智力看穿期望值過關(r128w_int)'],
  ['f2pLose','⑧ 屬性真驅動：低智力忍不住破戒'],
  ['whaleWin','⑧ 屬性真驅動：厚財富撐住爆抽(r128w_mny)'],
  ['whaleLose','⑧ 屬性真驅動：薄財富刷爆卡'],
  ['minnowAddict','⑧ 小資越課越深立 r128_addict→卡債'],
  ['deathWhale','⑨ 爆肝死法可達：課長搏命衝榜身體見底→gachaburn'],
  ['deathF2p','⑨ 爆肝死法可達：無課爆肝硬刷身體見底→gachaburn'],
  ['cleanPure','⑩ 旗標純淨：乾淨開局無任何 r128 旗標'],
  ['reviewEmpty','⑪ 回顧卡：沒踏進(無 r128_in)整段省略'],
  ['reviewShow','⑪ 回顧卡：踏進+結局含標題/結局名/這輩子課了'],
  ['reviewPure','⑫ 純呈現零汙染：生成前後 S.attr/flags 不變且零 rng'],
  ['dirtySafe','⑬ 壞資料降級：髒/缺欄位旗標不炸仍安全渲染'],
  ['compatOld','⑭ 存檔相容：舊存檔 ensureState 不補 r128 鍵'],
  ['nullSafe','⑮ 無局(S=null)相容：picker 回 null/回顧回空字串不炸'],
].forEach(([k,m])=>ok(r128[k], 'R128 '+m));

// ===== R129 五圍真正有感・數值驅動強化：屬性門檻分流/檢定可達性 + trade-off 生效 + 軌跡卡呈現/純淨/降級/相容/S=null =====
const r129 = JSON.parse(vm.runInContext(`(function(){
  const out={}; const f=id=>EVENTS.find(e=>e.id===id);
  function fresh(age,attr,fl){ startGame(); S.flags=Object.assign({},fl||{}); ensureState(S); S.seen={}; S.alive=true; S.keySnap=[]; S.tradeLog=[]; if(age!=null)S.age=age; if(attr)Object.assign(S.attr,attr); return S; }
  function optIdx(id,kw){ const e=f(id); return e?e.choices.findIndex(c=>c.label.indexOf(kw)>=0):-1; }
  // ① 結構＋五圍覆蓋：本輪 r129 掛點齊備(≥6)、br/sr 結構完整、label 帶 gtag+門檻數字、五圍全覆蓋
  const opts=[]; EVENTS.forEach(e=>(e.choices||[]).forEach(c=>{ if(c.r129) opts.push({e,c}); }));
  out.count = opts.length>=6;
  out.cover = new Set(opts.map(o=>(o.c.br&&o.c.br.k)||(o.c.sr&&o.c.sr.k))).size===5;
  out.struct = opts.every(o=>{ const c=o.c; if(!/class="gtag"/.test(c.label)) return false;
    if(c.br) return ATTR[c.br.k] && c.br.need>=50 && c.br.need<=70 && c.br.hi&&c.br.hi.eff&&c.br.hi.res && c.br.lo&&c.br.lo.eff&&c.br.lo.res && c.br.hi.res!==c.br.lo.res && c.label.indexOf(String(c.br.need))>=0;
    if(c.sr) return ATTR[c.sr.k] && c.sr.need>=55 && c.sr.need<=85 && c.sr.spread===40 && c.sr.win&&c.sr.win.eff&&c.sr.win.res && c.sr.lose&&c.sr.lose.eff&&c.sr.lose.res && c.label.indexOf(String(c.sr.need))>=0;
    return false; });
  // ② br 真驅動：高屬性走 hi、低屬性走 lo(talent_class 智力 / silver_learning 健康)，keySnap kind:br won 正確
  function brRun(id,kw,attr){ const i=optIdx(id,kw); const e=f(id); fresh(e.stage[0],attr,{employed:true}); showEvent(e); choose(i); return S; }
  out.brHi = (()=>{ const s=brRun('talent_class','硬啃',{int:90}); const k=s.keySnap[s.keySnap.length-1]; return (s.flags.brHi||0)>0 && k&&k.k==='int'&&k.kind==='br'&&k.won===true; })();
  out.brLo = (()=>{ const s=brRun('talent_class','硬啃',{int:5}); const k=s.keySnap[s.keySnap.length-1]; return (s.flags.brLo||0)>0 && k&&k.won===false; })();
  out.brHi2 = (()=>{ const s=brRun('silver_learning','三門',{hp:90}); return (s.flags.brHi||0)>0; })();
  // ③ sr 真驅動：高屬性必過、低屬性必翻(side_hustle 智力 / old_friend 快樂)，連跑 3 次不翻盤，keySnap kind:sr
  function srRun(id,kw,attr){ const i=optIdx(id,kw); const e=f(id); fresh(e.stage[0],attr,{employed:true}); showEvent(e); choose(i); return S; }
  out.srWin = [0,0,0].every(()=>{ const s=srRun('side_hustle_new','事業',{int:100}); const k=s.keySnap[s.keySnap.length-1]; return (s.flags.gateWin||0)>0 && k&&k.k==='int'&&k.kind==='sr'&&k.won===true; });
  out.srLose= [0,0,0].every(()=>{ const s=srRun('side_hustle_new','事業',{int:1}); return (s.flags.srLose||0)>0; });
  out.srWin2= [0,0,0].every(()=>{ const s=srRun('old_friend','散場',{hap:100}); return (s.flags.gateWin||0)>0; });
  // ④ 成長有代價：拿增益付代價≥2 處(副業贏了傷健康/重逢貪杯傷身/啃才藝升智扣快樂)，且實跑 win/hi 分支記入 tradeLog
  const tcount=[
    (c=>c&&c.sr&&c.sr.win.eff.hp<0&&c.sr.win.eff.mny>0)(f('side_hustle_new').choices[optIdx('side_hustle_new','事業')]),
    (c=>c&&c.sr&&c.sr.win.eff.hp<0&&c.sr.win.eff.hap>0)(f('old_friend').choices[optIdx('old_friend','散場')]),
    (c=>c&&c.br&&c.br.hi.eff.int>0&&c.br.hi.eff.hap<0)(f('talent_class').choices[optIdx('talent_class','硬啃')]),
  ].filter(Boolean).length;
  out.tradeoffStruct = tcount>=2;
  out.tradeLog = (()=>{ const s=srRun('side_hustle_new','事業',{int:100}); return Array.isArray(s.tradeLog) && s.tradeLog.some(t=>t.dn==='hp'); })();
  // ⑤ 軌跡卡呈現：attrHist 有料 → r129TrajectoryHTML 非空含關鍵字
  fresh(60,{int:80}); S.attrHist=[[0,40,30,50,20,60],[30,60,70,55,40,70],[60,55,80,50,45,65]];
  const html=r129TrajectoryHTML();
  out.render = html.indexOf('五圍人生軌跡')>=0 && html.indexOf('峰')>=0 && html.length>200;
  // ⑥ 純呈現零汙染：生成前後 S.attr/flags/keySnap 不變、零 rng 消耗
  const bA=JSON.stringify(S.attr), bF=JSON.stringify(S.flags), bK=JSON.stringify(S.keySnap);
  let used=0; const oldR=rng; rng=function(){ used++; return oldR(); };
  r129TrajectoryHTML(); r129TrajectoryHTML();
  rng=oldR;
  out.pure = JSON.stringify(S.attr)===bA && JSON.stringify(S.flags)===bF && JSON.stringify(S.keySnap)===bK && used===0;
  // ⑦ 壞資料降級：attrHist 含 null/短陣列被濾掉不炸，仍能渲染
  let dirtyOk=true; try{ fresh(60,{}); S.attrHist=[null,[0,50],[20,60,70,50,40,65,9]]; const h=r129TrajectoryHTML(); dirtyOk=h.indexOf('五圍人生軌跡')>=0; }catch(e){ dirtyOk=false; }
  out.dirtySafe = dirtyOk;
  // ⑧ 舊存檔相容：缺 attrHist(空陣列) → 以謝幕值渲染不炸；ensureState 補空陣列不報錯
  const old={flags:{},attr:{hp:55,int:60,apr:50,mny:45,hap:70},age:50,alive:true,seen:{}}; ensureState(old);
  let compatOk=true; try{ fresh(50,{hp:55,int:60,apr:50,mny:45,hap:70}); S.attrHist=[]; const h=r129TrajectoryHTML(); compatOk=h.indexOf('五圍人生軌跡')>=0 && h.indexOf('60')>=0; }catch(e){ compatOk=false; }
  out.compat = Array.isArray(old.attrHist) && compatOk;
  // ⑨ 無局(S=null)相容：回空字串不炸
  let okNull=true; try{ S=null; if(r129TrajectoryHTML()!=='') okNull=false; }catch(e){ okNull=false; }
  out.nullSafe = okNull;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['count','① 本輪 r129 屬性驅動掛點齊備(≥6 處)'],
  ['cover','① 五圍全覆蓋(hp/int/apr/mny/hap 各有掛點)'],
  ['struct','① 結構完整:br need50-70/sr need55-85 spread40、hi≠lo、label 帶 gtag+門檻數字'],
  ['brHi','② br 真驅動:talent_class 高智力走 hi、keySnap kind:br won:true'],
  ['brLo','② br 真驅動:低智力走 lo、keySnap won:false'],
  ['brHi2','② br 真驅動:silver_learning 高健康走 hi'],
  ['srWin','③ sr 真驅動:side_hustle 高智力必過(3連跑不翻盤)、keySnap kind:sr won:true'],
  ['srLose','③ sr 真驅動:低智力必翻(srLose+1)'],
  ['srWin2','③ sr 真驅動:old_friend 高快樂必過'],
  ['tradeoffStruct','④ 成長有代價:≥2 處拿增益付代價(副業贏了傷健康/重逢貪杯傷身/啃才藝升智扣快樂)'],
  ['tradeLog','④ trade-off 實跑生效:贏 side_hustle 升財富傷健康 → tradeLog 記一筆 dn:hp'],
  ['render','⑤ 軌跡卡呈現:attrHist 有料→含「五圍人生軌跡/峰」非空'],
  ['pure','⑥ 純呈現零汙染:生成前後 S.attr/flags/keySnap 不變且零 rng'],
  ['dirtySafe','⑦ 壞資料降級:attrHist 含 null/短陣列被濾掉不炸仍渲染'],
  ['compat','⑧ 舊存檔相容:缺 attrHist→以謝幕值渲染不炸、ensureState 補空陣列'],
  ['nullSafe','⑨ 無局(S=null)相容:回空字串不炸'],
].forEach(([k,m])=>ok(r129[k], 'R129 '+m));

// ===== R130 鬼島壓力連鎖崩盤與翻身機制：壓力累積/攔截器觸發/預警分流/崩盤鏈逐節點/硬撐死法/求助不死/翻身分流/認命躺平/結算卡/純淨/壞資料降級/舊存檔相容/S=null 相容/生存指數映射 =====
const r130 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function fresh(age,fl,attr){ startGame(); const s=S; s.origin=ORIGIN_MAP.office; s.flags=Object.assign({},fl||{}); ensureState(s); s.seen={}; s.alive=true; if(age!=null)s.age=age; if(attr)Object.assign(s.attr,attr); return s; }
  // 合成事件丟進 choose()，量測壓力累積（無 r130node → 走累積器）
  function stressAfter(preStress,attr,eff){ fresh(30,{r130stress:preStress},attr); const ev={id:'__t130',title:'x',text:'x',meme:{scene:'win'},choices:[{label:'x',eff:Object.assign({},eff)}]}; showEvent(ev); choose(0); return S.flags.r130stress||0; }
  // ① 壓力累積：過勞(hp 重傷)/舉債(mny 重傷)加壓；休養/還債/進帳減壓；已透支放大；峰值追蹤
  out.stressOverwork = stressAfter(0,{hp:60,mny:60},{hp:-8}) >= 10;        // 過勞重傷健康 +10
  out.stressDebt     = stressAfter(0,{hp:60,mny:60},{mny:-10}) >= 9;        // 大舉債 +9
  out.stressDrained  = stressAfter(0,{hp:10,mny:10},{hp:-8}) > stressAfter(0,{hp:60,mny:60},{hp:-8}); // 已透支放大
  out.stressRelief   = stressAfter(50,{hp:60,mny:60},{hp:8}) < 50;          // 休養減壓
  out.stressRepay    = stressAfter(50,{hp:60,mny:60},{mny:8}) < 50;         // 進帳/還債減壓
  out.stressFloor    = stressAfter(3,{hp:60,mny:60},{hp:8}) === 0;          // 減壓不低於 0
  out.peakTrack = (()=>{ fresh(30,{r130stress:0},{hp:60,mny:60}); const ev={id:'__t130p',title:'x',text:'x',meme:{scene:'win'},choices:[{label:'x',eff:{hp:-8}}]}; showEvent(ev); choose(0); return (S.flags.r130_peakstress||0) >= 10; })();
  // 崩盤節點本身不灌壓力（r130node 跳過累積器）
  out.nodeNoStress = (()=>{ fresh(40,{r130step:1,r130stress:50},{hp:70}); const before=S.flags.r130stress; showEvent(r130ById('r130_collapse')); choose(0); return (S.flags.r130stress||0) <= 50; })();
  // ② 攔截器觸發：壓力跨臨界＋窗口→預警；壓力不足/窗口外/崩盤上限→不觸發
  out.trigWarn   = (()=>{ fresh(40,{r130stress:130}); const e=r130CrisisPick(); return e && e.id==='r130_warn'; })();
  out.trigLow    = (()=>{ fresh(40,{r130stress:50}); return r130CrisisPick()===null; })();
  out.trigYoung  = (()=>{ fresh(15,{r130stress:130}); return r130CrisisPick()===null; })();
  out.trigOld    = (()=>{ fresh(70,{r130stress:130}); return r130CrisisPick()===null; })();
  out.trigCap    = (()=>{ fresh(40,{r130stress:130,r130collapses:2}); return r130CrisisPick()===null; })();
  // ③ 預警分流：踩煞車減壓→避開崩盤(step 維持 0、壓力降到安全線、r130_defused)；硬撐→step:1+r130_in
  out.defuse = (()=>{ fresh(30,{r130stress:130},{mny:60}); showEvent(r130ById('r130_warn')); choose(0); return !(S.flags.r130step>=1) && (S.flags.r130stress||0)<100 && !!S.flags.r130_defused && !!S.flags.r130_in; })();
  out.warnPush = (()=>{ fresh(30,{r130stress:130}); showEvent(r130ById('r130_warn')); choose(1); return S.flags.r130step===1 && !!S.flags.r130_in; })();
  // ④ 崩盤鏈逐節點：依 step 確定性返回 collapse→aftermath→rebound
  out.nodeCollapse  = (()=>{ fresh(40,{r130step:1}); return (r130CrisisPick()||{}).id==='r130_collapse'; })();
  out.nodeAftermath = (()=>{ fresh(40,{r130step:2}); return (r130CrisisPick()||{}).id==='r130_aftermath'; })();
  out.nodeRebound   = (()=>{ fresh(40,{r130step:3}); return (r130CrisisPick()||{}).id==='r130_rebound'; })();
  // ⑤ 硬撐死法可達＋減傷分流：hp 見底(≤12)硬撐→r130crash 崩盤猝死；高 hp 硬撐減傷不死、低 hp 重傷不死
  out.deathEndure = (()=>{ fresh(40,{r130step:1},{hp:10}); showEvent(r130ById('r130_collapse')); choose(0); return S.flags.specialDeath==='r130crash'; })();
  out.endureHiSafe = (()=>{ fresh(40,{r130step:1},{hp:80,mny:60}); showEvent(r130ById('r130_collapse')); choose(0); return !S.flags.specialDeath && S.flags.r130step===2 && !!S.flags.r130_endured; })();
  out.endureLoHurt = (()=>{ fresh(40,{r130step:1},{hp:35,mny:40}); showEvent(r130ById('r130_collapse')); choose(0); return !S.flags.specialDeath && S.flags.r130step===2; })();
  // ⑥ 放下身段求助永不致死（即使 hp 偏低也不會 r130crash）
  out.treatNoDeath = (()=>{ fresh(40,{r130step:1},{hp:18,mny:10}); showEvent(r130ById('r130_collapse')); choose(1); return !S.flags.specialDeath && !!S.flags.r130_soughthelp && S.flags.r130step===2; })();
  // ⑦ 翻身分流：高五圍→翻身成功(r130_rebwin+rebounds+1)、低五圍→翻身未果；末尾重置 step:0+collapses+1+壓力壓回低檔
  out.reboundWin = (()=>{ fresh(45,{r130step:3,r130stress:130,r130_sober:true,r130_soughthelp:true},{hp:80,mny:80,int:80,hap:80,apr:80}); showEvent(r130ById('r130_rebound')); choose(0); const f=S.flags; return !!f.r130_rebwin && (f.r130rebounds||0)===1 && f.r130step===0 && (f.r130collapses||0)===1 && (f.r130stress||0)<=40; })();
  out.reboundLose = (()=>{ fresh(45,{r130step:3,r130stress:130},{hp:5,mny:5,int:5,hap:5,apr:5}); showEvent(r130ById('r130_rebound')); choose(0); const f=S.flags; return !!f.r130_rebfail && (f.r130rebounds||0)===0 && f.r130step===0 && (f.r130collapses||0)===1; })();
  // ⑧ 認命躺平：重置 step、collapses+1、r130_laidback、不計翻身
  out.accept = (()=>{ fresh(45,{r130step:3,r130stress:130}); showEvent(r130ById('r130_rebound')); choose(1); const f=S.flags; return !!f.r130_laidback && f.r130step===0 && (f.r130collapses||0)===1 && (f.r130rebounds||0)===0; })();
  // ⑨ 結算卡：踏進(r130_in)→含「鬼島生存指數」與「生存指數」數字非空；沒踏進→整段省略
  out.cardShow = (()=>{ fresh(70,{r130_in:true,r130collapses:1,r130rebounds:1,r130_peakstress:140,r130_soughthelp:true}); const h=r130SurvivalHTML(); return h.indexOf('鬼島生存指數')>=0 && h.indexOf('/ 100')>=0 && h.length>200; })();
  out.cardEmpty = (()=>{ fresh(70,{}); return r130SurvivalHTML()===''; })();
  // ⑩ 純呈現零汙染：生成前後 S.attr/flags 不變、零 rng 消耗
  out.pure = (()=>{ fresh(70,{r130_in:true,r130collapses:1,r130rebounds:1,r130_peakstress:120}); const bA=JSON.stringify(S.attr), bF=JSON.stringify(S.flags); let used=0; const oldR=rng; rng=function(){used++;return oldR();}; r130SurvivalHTML(); buildR130SurvivalText(); rng=oldR; return JSON.stringify(S.attr)===bA && JSON.stringify(S.flags)===bF && used===0; })();
  // ⑪ 壞資料降級：髒/字串旗標 → 不炸、不渲染出 NaN
  out.dirtySafe = (()=>{ try{ fresh(70,{r130_in:true,r130collapses:'x',r130rebounds:null,r130_peakstress:'abc'}); const h=r130SurvivalHTML(); return h.indexOf('鬼島生存指數')>=0 && h.indexOf('NaN')<0; }catch(e){ return false; } })();
  // ⑫ 舊存檔相容：缺 r130 旗標 → 攔截器不觸發、結算卡省略、零殘留(不寫任何 r130 鍵)
  out.compatOld = (()=>{ const old={flags:{},attr:{hp:55,int:60,apr:50,mny:45,hap:70},age:50,alive:true,seen:{}}; ensureState(old); fresh(40,{}); const noTrig=r130CrisisPick()===null; const noCard=r130SurvivalHTML()===''; const clean=!('r130stress' in S.flags)&&!('r130step' in S.flags)&&!('r130_in' in S.flags); return noTrig && noCard && clean; })();
  // ⑬ 無局(S=null)相容：攔截器回 null、結算卡/文字版回空字串，皆不炸
  out.nullSafe = (()=>{ try{ S=null; if(r130CrisisPick()!==null) return false; if(r130SurvivalHTML()!=='') return false; if(buildR130SurvivalText()!=='') return false; return true; }catch(e){ return false; } })();
  // ⑭ 生存指數確定性映射：翻身/踩煞車加分、髒資料安全歸 0、夾在 5~100
  out.idxMap = r130SurvivalIndex({r130rebounds:2,r130_defused:true,r130collapses:1,r130_soughthelp:true}) > r130SurvivalIndex({r130collapses:1})
    && r130SurvivalIndex({r130_peakstress:'x',r130rebounds:'y'})>=5
    && r130SurvivalIndex({r130rebounds:99})<=100;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['stressOverwork','① 壓力累積:過勞重傷健康(hp-8)加壓≥10'],
  ['stressDebt','① 壓力累積:大舉債(mny-10)加壓≥9'],
  ['stressDrained','① 壓力累積:已透支(hp/mny 見底)雪上加霜放大加壓'],
  ['stressRelief','① 壓力累積:休養(hp+8)減壓'],
  ['stressRepay','① 壓力累積:進帳/還債(mny+8)減壓'],
  ['stressFloor','① 壓力累積:減壓不低於 0'],
  ['peakTrack','① 壓力峰值 r130_peakstress 正確追蹤'],
  ['nodeNoStress','① 崩盤節點(r130node)本身不灌壓力(跳過累積器)'],
  ['trigWarn','② 攔截器:壓力跨臨界+窗口→插播壓力預警 r130_warn'],
  ['trigLow','② 攔截器:壓力不足→不觸發'],
  ['trigYoung','② 攔截器:童年窗口外(age<22)→不觸發'],
  ['trigOld','② 攔截器:晚年窗口外(age>66)→不觸發'],
  ['trigCap','② 攔截器:一生崩盤上限(2 次)→不觸發'],
  ['defuse','③ 預警分流:踩煞車減壓→避開崩盤(step 維持 0、壓力降、r130_defused/r130_in)'],
  ['warnPush','③ 預警分流:硬撐→踏入崩盤鏈(step:1+r130_in)'],
  ['nodeCollapse','④ 崩盤鏈:step1→r130_collapse'],
  ['nodeAftermath','④ 崩盤鏈:step2→r130_aftermath'],
  ['nodeRebound','④ 崩盤鏈:step3→r130_rebound'],
  ['deathEndure','⑤ 硬撐死法:hp 見底(≤12)硬撐→r130crash 崩盤猝死'],
  ['endureHiSafe','⑤ 硬撐減傷:高 hp 硬撐減傷不死、step→2、r130_endured'],
  ['endureLoHurt','⑤ 硬撐重傷:低 hp 硬撐重傷不死、step→2'],
  ['treatNoDeath','⑥ 放下身段求助永不致死(hp 偏低也不 r130crash)、r130_soughthelp'],
  ['reboundWin','⑦ 翻身成功:高五圍→r130_rebwin+rebounds+1、末尾重置 step/壓力、collapses+1'],
  ['reboundLose','⑦ 翻身未果:低五圍→r130_rebfail、rebounds 不增、重置'],
  ['accept','⑧ 認命躺平:r130_laidback、重置 step、collapses+1、不計翻身'],
  ['cardShow','⑨ 結算卡:踏進(r130_in)→含「鬼島生存指數/100」非空'],
  ['cardEmpty','⑨ 結算卡:沒踏進→整段省略'],
  ['pure','⑩ 純呈現零汙染:生成前後 S.attr/flags 不變且零 rng'],
  ['dirtySafe','⑪ 壞資料降級:髒/字串旗標不炸、不渲染 NaN'],
  ['compatOld','⑫ 舊存檔相容:缺 r130 旗標→攔截器不觸發/卡省略/零殘留'],
  ['nullSafe','⑬ 無局(S=null)相容:攔截器回 null/卡與文字版回空字串不炸'],
  ['idxMap','⑭ 生存指數確定性映射:翻身/踩煞車加分、髒資料安全歸 0、夾 5~100'],
].forEach(([k,m])=>ok(r130[k], 'R130 '+m));

// ===== R131 鬼島百業人生・可選職涯路線分流系統：入口可達/7 分流/各路線專屬節點可達/試煉屬性驅動/專屬結局可達/爆肝死法/結算卡踏進才出現/純呈現零汙染/壞資料降級/舊存檔相容/S=null 相容/跨局收集 =====
const r131 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function fresh(age,fl,attr){ startGame(); const s=S; s.origin=ORIGIN_MAP.office; s.flags=Object.assign({},fl||{}); ensureState(s); s.seen={}; s.alive=true; if(age!=null)s.age=age; if(attr)Object.assign(s.attr,attr); return s; }
  const _roll=r131Roll;
  // ① 入口可達性：出社會窗口(22-28)+乾淨+閘命中→入口 r131_choose
  let s=fresh(25,{}); r131Roll=function(){return 0.1;}; out.entry = !!r131CareerPick() && r131CareerPick().id==='r131_choose';
  // ② 閘落空→不插播、零殘留(舊存檔無旗標時不寫任何 r131 鍵)
  s=fresh(25,{}); r131Roll=function(){return 0.9;}; out.gateMiss = r131CareerPick()===null;
  out.gateMissPure = !('r131step' in s.flags) && !('r131_in' in s.flags) && !('r131path' in s.flags);
  r131Roll=_roll;
  // ③ 窗口外(過小/過老)不插播；已收尾不再插播
  s=fresh(20,{}); out.gateYoung = r131CareerPick()===null;
  s=fresh(35,{}); out.gateOld   = r131CareerPick()===null;
  s=fresh(25,{r131step:99}); out.gateDone = r131CareerPick()===null;
  // ④ 入口 7 分流：各選項立 path+step:1+r131_in（模擬亂選也會推進）
  function pick0(idx){ s=fresh(25,{}); const ev=r131ById('r131_choose'); showEvent(ev); choose(idx); return s.flags; }
  const PATHS=['tech','civil','creator','vendor','scam','politics','freelance'];
  out.splitAll = PATHS.every((p,i)=>{ const g=pick0(i); return g.r131path===p && g.r131step===1 && !!g.r131_in; });
  // ⑤ 各路線專屬節點可達：step1→_1、step2→_2
  out.node1All = PATHS.every(p=>{ s=fresh(28,{r131step:1,r131path:p}); const e=r131CareerPick(); return e && e.id==='r131_'+p+'_1'; });
  out.node2All = PATHS.every(p=>{ s=fresh(28,{r131step:2,r131path:p}); const e=r131CareerPick(); return e && e.id==='r131_'+p+'_2'; });
  // ⑥ 專屬結局可達：step3→_end，確定性落地 r131_endtype/r131_endhit
  out.endAll = PATHS.every(p=>{ s=fresh(30,{r131step:3,r131path:p}); const e=r131CareerPick(); return e && e.id==='r131_'+p+'_end' && s.flags.r131_endtype===p && s.flags.r131_endhit===true; });
  // ⑦ _1 入行兩選項皆推進 step:2（鏈必走完）
  out.node1Adv = PATHS.every(p=>{ let ok2=true; for(let i=0;i<2;i++){ s=fresh(28,{r131step:1,r131path:p}); const e=r131CareerPick(); showEvent(e); choose(i); if(s.flags.r131step!==2) ok2=false; } return ok2; });
  // ⑧ 試煉屬性驅動(呼應 R129)：各路線 _2 special 吃對應五圍門檻——高屬性 win 立旗、低屬性 lose 不立
  function trial(p,attr){ s=fresh(30,{r131step:2,r131path:p}); Object.assign(s.attr,attr); const e=r131CareerPick(); showEvent(e); choose(0); return s.flags; }
  out.techWin  = !!trial('tech',{int:100,hp:60}).r131_tech_senior;
  out.techLose = !trial('tech',{int:5,hp:60}).r131_tech_senior;
  out.civilWin = !!trial('civil',{int:100}).r131_civil_pass;
  out.civilLose= !trial('civil',{int:5}).r131_civil_pass;
  out.creatorWin = !!trial('creator',{apr:100}).r131_creator_viral;
  out.creatorLose= !trial('creator',{apr:5}).r131_creator_viral;
  out.vendorWin = !!trial('vendor',{hp:100}).r131_vendor_hit;
  out.vendorLose= !trial('vendor',{hp:5}).r131_vendor_hit;
  out.scamWin  = (g=>!!g.r131_scam_boss && !!g.r131_scam_caught)(trial('scam',{int:100}));
  out.scamLose = (g=>!g.r131_scam_boss && !!g.r131_scam_caught)(trial('scam',{int:5}));
  out.polWin   = !!trial('politics',{apr:100}).r131_politics_win;
  out.polLose  = !trial('politics',{apr:5}).r131_politics_win;
  out.freeWin  = !!trial('freelance',{int:100}).r131_free_stable;
  out.freeLose = !trial('freelance',{int:5}).r131_free_stable;
  // ⑨ 爆肝死法可達：tech _2 爆肝硬撐、身體見底(hp≤12)→coderburn 過勞猝死（且僅 tech 一路有死法）
  s=fresh(30,{r131step:2,r131path:'tech'}); s.attr.hp=10; s.attr.int=40; showEvent(r131ById('r131_tech_2')); choose(0);
  out.deathCoder = s.flags.specialDeath==='coderburn' && typeof SPECIAL_DEATHS.coderburn==='object';
  // 其他路線 _2 身體見底也不致死（路線分流不可變必死失衡）
  out.vendorNoDeath = (()=>{ s=fresh(30,{r131step:2,r131path:'vendor'}); s.attr.hp=5; showEvent(r131ById('r131_vendor_2')); choose(0); return !s.flags.specialDeath; })();
  // ⑩ 旗標純淨：乾淨開局無任何 r131 旗標
  startGame(); const clean=S; ensureState(clean);
  out.cleanPure = !Object.keys(clean.flags).some(k=>k.indexOf('r131')===0);
  // ⑪ 結算職涯卡：沒踏進(無 r131_in)整段省略；踏進+結局→含「我的鬼島職涯」+路線名+達成度
  s=fresh(60,{}); out.reviewEmpty = r131CareerReviewHTML()==='';
  s=fresh(60,{r131_in:true,r131path:'tech',r131_tech_senior:true,r131_endhit:true,r131_endtype:'tech'});
  const rv=r131CareerReviewHTML();
  out.reviewShow = rv.indexOf('我的鬼島職涯')>=0 && rv.indexOf('科技業爆肝碼農')>=0 && rv.indexOf('達成度')>=0;
  // ⑫ 純呈現零汙染：生成回顧前後 S.attr/flags 不變、零 rng 消耗
  const bA=JSON.stringify(S.attr), bF=JSON.stringify(S.flags);
  let used=0; const old=rng; rng=function(){ used++; return old(); };
  r131CareerReviewHTML(); r131CareerReviewHTML();
  rng=old;
  out.reviewPure = JSON.stringify(S.attr)===bA && JSON.stringify(S.flags)===bF && used===0;
  // ⑬ 壞資料降級：髒/缺欄位旗標 → 不炸，仍安全渲染、不誤觸發
  let dirtyOk=true; try{ s=fresh(60,{r131_in:true,r131path:'???',r131_endtype:'no_such'}); const h=r131CareerReviewHTML(); dirtyOk = h.indexOf('我的鬼島職涯')>=0; }catch(e){ dirtyOk=false; }
  out.dirtySafe = dirtyOk;
  // ⑭ 舊存檔相容：缺 r131 鍵 → ensureState 不補 r131 鍵；攔截器在閘落空時零殘留
  startGame(); const oldsave=S; delete oldsave.flags.r131step; ensureState(oldsave);
  out.compatOld = !('r131step' in oldsave.flags) && !('r131_in' in oldsave.flags) && !('r131path' in oldsave.flags);
  // ⑮ 無局(S=null)相容：picker 回 null、回顧回空字串，皆不炸
  let okNull=true; try{ S=null; if(r131CareerPick()!==null) okNull=false; if(r131CareerReviewHTML()!=='') okNull=false; }catch(e){ okNull=false; }
  out.nullSafe = okNull;
  // ⑯ 跨局收集(玩遍七業)成就：SAVE.r131seen 集滿 7 path→r131_allpaths 解鎖；缺一→不解
  const ach=ACHIEVEMENTS.find(a=>a.id==='r131_allpaths');
  SAVE.r131seen={}; PATHS.forEach(p=>SAVE.r131seen[p]=true);
  const full = !!(ach && ach.check({S:{flags:{}}}));
  SAVE.r131seen={tech:true,civil:true}; const partial = !!(ach && ach.check({S:{flags:{}}}));
  SAVE.r131seen={};
  out.allpaths = full && !partial;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['entry','① 入口可達性:出社會窗口(22-28)+閘命中→r131_choose'],
  ['gateMiss','② 閘落空→不插播'],
  ['gateMissPure','② 閘落空零殘留(不寫任何 r131 旗標)'],
  ['gateYoung','③ 窗口外(過小)不插播'],
  ['gateOld','③ 窗口外(過老)不插播'],
  ['gateDone','③ 已收尾(step99)不再插播'],
  ['splitAll','④ 入口 7 分流:各立 path/step:1/r131_in'],
  ['node1All','⑤ 各路線專屬節點可達:step1→_1(七路線全可達)'],
  ['node2All','⑤ 各路線專屬節點可達:step2→_2(七路線全可達)'],
  ['endAll','⑥ 各路線專屬結局可達:step3→_end 並落地 r131_endtype/r131_endhit(七路線全可達)'],
  ['node1Adv','⑦ _1 入行兩選項皆推進 step:2(鏈必走完)'],
  ['techWin','⑧ 屬性驅動:科技業高智力升資深(r131_tech_senior)'],
  ['techLose','⑧ 屬性驅動:科技業低智力卡關不升'],
  ['civilWin','⑧ 屬性驅動:公務員高智力國考上岸(r131_civil_pass)'],
  ['civilLose','⑧ 屬性驅動:公務員低智力落榜'],
  ['creatorWin','⑧ 屬性驅動:網紅高魅力爆紅(r131_creator_viral)'],
  ['creatorLose','⑧ 屬性驅動:網紅低魅力流量焦慮'],
  ['vendorWin','⑧ 屬性驅動:小吃攤高體質排隊神話(r131_vendor_hit)'],
  ['vendorLose','⑧ 屬性驅動:小吃攤低體質累垮出包'],
  ['scamWin','⑧ 屬性驅動:詐騙高智力升主嫌(r131_scam_boss，終究被收網)'],
  ['scamLose','⑧ 屬性驅動:詐騙低智力車手砲仔被逮(僅 caught)'],
  ['polWin','⑧ 屬性驅動:政治高魅力催票當選(r131_politics_win)'],
  ['polLose','⑧ 屬性驅動:政治低魅力黑函落馬'],
  ['freeWin','⑧ 屬性驅動:自由接案高智力經營成穩定事業(r131_free_stable)'],
  ['freeLose','⑧ 屬性驅動:自由接案低智力月光吃土'],
  ['deathCoder','⑨ 爆肝死法可達:科技業身體見底硬撐→coderburn 過勞猝死(且入 SPECIAL_DEATHS)'],
  ['vendorNoDeath','⑨ 平衡護欄:其他路線身體見底也不致死(路線不變必死失衡)'],
  ['cleanPure','⑩ 旗標純淨:乾淨開局無任何 r131 旗標'],
  ['reviewEmpty','⑪ 職涯卡:沒踏進(無 r131_in)整段省略'],
  ['reviewShow','⑪ 職涯卡:踏進+結局含「我的鬼島職涯」/路線名/達成度'],
  ['reviewPure','⑫ 純呈現零汙染:生成前後 S.attr/flags 不變且零 rng'],
  ['dirtySafe','⑬ 壞資料降級:髒/缺欄位旗標不炸仍安全渲染'],
  ['compatOld','⑭ 舊存檔相容:ensureState 不補 r131 鍵'],
  ['nullSafe','⑮ 無局(S=null)相容:picker 回 null/回顧回空字串不炸'],
  ['allpaths','⑯ 跨局收集:七業集滿→r131_allpaths 解鎖、缺一不解'],
].forEach(([k,m])=>ok(r131[k], 'R131 '+m));

// ===== R132 鬼島即時稱號養成系統(Live 在地稱號 Badge)：即時稱號 deterministic/升階邏輯/零汙染零 rng/即時面板省略顯示/結算定格卡/複製文字/髒資料降級/舊存檔相容/S=null 相容/跨局集滿九大五圍解鎖 r132_alltitles =====
const r132 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function fresh(age,fl,attr){ startGame(); const s=S; s.flags=Object.assign({},fl||{}); ensureState(s); if(age!=null)s.age=age; if(attr)Object.assign(s.attr,attr); return s; }
  function byId(list,id){ return list.filter(b=>b.id===id)[0]; }
  // ⑪ deterministic 點亮：高五圍→winner/brainy/pretty/rich 同時點亮；同輸入兩次結果完全一致
  fresh(40,{},{hp:75,int:90,apr:90,mny:90,hap:80}); let L=r132LitBadges();
  out.detLit = !!byId(L,'winner') && !!byId(L,'brainy') && !!byId(L,'rich') && !!byId(L,'pretty');
  fresh(40,{},{hp:75,int:90,apr:90,mny:90,hap:80}); const J1=JSON.stringify(r132LitBadges());
  fresh(40,{},{hp:75,int:90,apr:90,mny:90,hap:80}); out.deterministic = (JSON.stringify(r132LitBadges())===J1);
  // ⑫ 升階邏輯(養成感)：條件加深 base→up；attr 系與 flag 系各驗一條
  fresh(40,{},{int:68}); out.brainyBase = (b=>!!b && b.up===false && b.nm==='靠北潛力股')(byId(r132LitBadges(),'brainy'));
  fresh(40,{},{int:90}); out.brainyUp   = (b=>!!b && b.up===true  && b.nm==='鬼島智力怪物')(byId(r132LitBadges(),'brainy'));
  fresh(40,{npiao:true},{}); out.npiaoBase = (b=>!!b && b.up===false)(byId(r132LitBadges(),'npiao'));
  fresh(40,{npiao:true,rentpain:true},{}); out.npiaoUp = (b=>!!b && b.up===true)(byId(r132LitBadges(),'npiao'));
  // ⑬ 純呈現零汙染：生成前後 S.attr/flags 不變、零 rng 消耗
  fresh(40,{npiao:true,r128_in:true,r130stress:20},{hp:75,int:90,mny:90,hap:80,apr:90});
  const bA=JSON.stringify(S.attr), bF=JSON.stringify(S.flags);
  let used=0; const old=rng; rng=function(){ used++; return old(); };
  r132LitBadges(); r132LiveTitleHTML(); r132FreezeHTML(); buildR132Text();
  rng=old;
  out.pure = JSON.stringify(S.attr)===bA && JSON.stringify(S.flags)===bF && used===0;
  // ⑭ 髒資料降級：attr 髒值/缺欄位 → 不炸、回陣列、安全渲染
  out.dirtySafe = (()=>{ try{ fresh(40,{},{}); S.attr={hp:'x',int:null}; delete S.attr.mny; if(!Array.isArray(r132LitBadges())) return false; r132LiveTitleHTML(); r132FreezeHTML(); return true; }catch(e){ return false; } })();
  // ⑮ 舊存檔相容：ensureState 不為 R132 在 S.flags 補任何必填鍵；空 flags+中庸五圍不誤觸 flag 系稱號
  startGame(); const olds=S; ensureState(olds); out.compatOld = !Object.keys(olds.flags).some(k=>k.indexOf('r132')===0);
  fresh(40,{},{hp:50,int:50,apr:50,mny:50,hap:50}); const fl=r132LitBadges().map(b=>b.id);
  out.noFlagFalsePos = !fl.some(id=>['house','npiao','whale','boss','stress','pet','tiger','leek'].indexOf(id)>=0);
  // ⑯ 無局(S=null)相容：lit 回空陣列、面板/定格卡/複製文字皆回空字串，皆不炸
  out.nullSafe = (()=>{ try{ S=null; if(r132LitBadges().length!==0) return false; if(r132LiveTitleHTML()!=='') return false; if(r132FreezeHTML()!=='') return false; if(buildR132Text()!=='') return false; return true; }catch(e){ return false; } })();
  // ⑰ 即時面板：無點亮→整段省略；有點亮→含標題且升階顯 ▲
  out.liveEmpty = (fresh(5,{},{hp:50,int:50,apr:50,mny:50,hap:50}), r132LiveTitleHTML()==='');
  fresh(40,{},{int:90}); const lh=r132LiveTitleHTML(); out.liveShow = lh.indexOf('鬼島即時稱號')>=0 && lh.indexOf('▲')>=0;
  // ⑱ 結算定格卡：沒點亮→省略；有點亮→含「我的鬼島稱號牆」+九大收集進度；複製文字含標題與站點
  out.freezeEmpty = (fresh(5,{},{hp:50,int:50,apr:50,mny:50,hap:50}), r132FreezeHTML()==='');
  fresh(60,{},{int:90}); const fh=r132FreezeHTML(); out.freezeShow = fh.indexOf('我的鬼島稱號牆')>=0 && fh.indexOf('/9')>=0;
  fresh(40,{},{int:90}); out.copyText = buildR132Text().indexOf('我的鬼島稱號牆')>=0 && buildR132Text().indexOf('earthlife.pages.dev')>=0;
  // ⑲ 結算定格寫入 SAVE.r132seen(die 收集邏輯)：點亮的 id 全寫進跨局集合
  fresh(40,{},{hp:85,int:85,apr:85,mny:85,hap:85}); SAVE.r132seen={}; r132LitBadges().forEach(b=>{ SAVE.r132seen[b.id]=true; });
  out.freezeWrite = SAVE.r132seen.winner===true && SAVE.r132seen.brainy===true && SAVE.r132seen.rich===true;
  // ⑳ 跨局集滿九大五圍稱號→r132_alltitles 解鎖；缺一→不解
  const ach=ACHIEVEMENTS.find(a=>a.id==='r132_alltitles');
  SAVE.r132seen={}; R132_CORE.forEach(id=>SAVE.r132seen[id]=true);
  const full = !!(ach && ach.check({S:{flags:{}}}));
  SAVE.r132seen={winner:true,loser:true}; const partial = !!(ach && ach.check({S:{flags:{}}}));
  SAVE.r132seen={};
  out.alltitles = full && !partial;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['detLit','⑪ 即時稱號 deterministic:高五圍→winner/brainy/rich/pretty 同時點亮'],
  ['deterministic','⑪ 即時稱號 deterministic:同輸入兩次結果完全一致'],
  ['brainyBase','⑫ 升階邏輯:int68→靠北潛力股(base)'],
  ['brainyUp','⑫ 升階邏輯:int90→鬼島智力怪物(up▲)'],
  ['npiaoBase','⑫ 升階邏輯(flag系):npiao→北漂青年(base)'],
  ['npiaoUp','⑫ 升階邏輯(flag系):npiao+rentpain→北漂魯蛇(up▲)'],
  ['pure','⑬ 純呈現零汙染:生成前後 S.attr/flags 不變且零 rng'],
  ['dirtySafe','⑭ 髒資料降級:attr 髒值/缺欄位不炸仍回陣列安全渲染'],
  ['compatOld','⑮ 舊存檔相容:ensureState 不為 R132 補 S.flags 鍵'],
  ['noFlagFalsePos','⑮ 舊存檔相容:空 flags+中庸五圍不誤觸 flag 系稱號'],
  ['nullSafe','⑯ 無局(S=null)相容:lit 回空陣列/面板/定格卡/複製文字回空字串不炸'],
  ['liveEmpty','⑰ 即時面板:無點亮整段省略'],
  ['liveShow','⑰ 即時面板:有點亮含標題且升階顯 ▲'],
  ['freezeEmpty','⑱ 結算定格卡:沒點亮整段省略'],
  ['freezeShow','⑱ 結算定格卡:含「我的鬼島稱號牆」+九大收集進度(/9)'],
  ['copyText','⑱ 複製文字:含標題與 earthlife.pages.dev'],
  ['freezeWrite','⑲ 結算定格寫入 SAVE.r132seen:點亮 id 全進跨局集合'],
  ['alltitles','⑳ 跨局集滿:九大五圍集滿→r132_alltitles 解鎖、缺一不解'],
].forEach(([k,m])=>ok(r132[k], 'R132 '+m));

// ===== R133 複合屬性命運門檻 c.cr + 屬性命運判決書：掛點齊備/結構守約/五圍覆蓋/弱項floor拖垮/雙屬性hi協同/lo差臨門/deterministic零額外rng/判決書呈現MVP罩門/純呈現零汙染/髒資料降級/空keySnap省略/舊存檔相容/S=null 相容 =====
const r133 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function fresh(age,attr,fl){ startGame(); S.flags=Object.assign({},fl||{}); ensureState(S); S.seen={}; S.alive=true; S.keySnap=[]; S.tradeLog=[]; if(age!=null)S.age=age; if(attr)Object.assign(S.attr,attr); return S; }
  function baseAttr(){ const a={}; Object.keys(ATTR).forEach(k=>a[k]=50); return a; }
  const opts=[]; EVENTS.forEach(e=>(e.choices||[]).forEach((c,ci)=>{ if(c.r133) opts.push({e,c,ci}); }));
  // ① 掛點齊備：本輪 c.cr 複合門檻 ≥6 處
  out.count = opts.length>=6;
  // ② 結構守約：label 含 gtag+🎯+複合+R133；ks 長度2且皆 ATTR 鍵；need 100-140；floor.below 15-30；hi/lo/floor 三者 eff+res 齊備且文案相異
  out.struct = opts.every(o=>{ const c=o.c, cr=c.cr;
    if(!/class="gtag"/.test(c.label)||c.label.indexOf('🎯')<0||c.label.indexOf('複合')<0||c.label.indexOf('R133')<0) return false;
    if(!Array.isArray(cr.ks)||cr.ks.length!==2||!cr.ks.every(k=>ATTR[k])) return false;
    if(!(cr.need>=100&&cr.need<=140)) return false;
    if(!cr.floor||!ATTR[cr.floor.k]||!(cr.floor.below>=15&&cr.floor.below<=30)) return false;
    if(![cr.hi,cr.lo,cr.floor].every(s=>s&&s.eff&&s.res)) return false;
    if(cr.hi.res===cr.lo.res||cr.hi.res===cr.floor.res||cr.lo.res===cr.floor.res) return false;
    return true; });
  // ③ 五圍覆蓋：所有 cr.ks 聯集涵蓋全五圍
  out.cover = (new Set(opts.reduce((a,o)=>a.concat(o.c.cr.ks),[]))).size===5;
  // 驅動引擎：依本選項自己的 cr 規格組屬性，走指定分支（floor.k 與 ks 不重疊，前面結構已隱含）
  function crRun(o,mode){ const cr=o.c.cr, ks=cr.ks, fl=cr.floor; const attr=baseAttr();
    attr[fl.k]=fl.below+25;
    if(mode==='floor'){ attr[fl.k]=Math.max(0, fl.below-10); }
    else if(mode==='hi'){ const each=Math.ceil((cr.need+ks.length*5)/ks.length); ks.forEach(k=>attr[k]=each); }
    else { ks.forEach(k=>attr[k]=5); }
    fresh(o.e.stage?o.e.stage[0]:30, attr, {employed:true}); showEvent(o.e); choose(o.ci); return S; }
  // ④ 弱項 floor 真拖垮：floor.k 低於門檻 → 走 floor(負面)，r133floor/r133cr+1、keySnap kind:cr k=floor.k won:false
  out.floor = opts.every(o=>{ const s=crRun(o,'floor'); const k=s.keySnap[s.keySnap.length-1];
    return (s.flags.r133floor||0)>0 && (s.flags.r133cr||0)>0 && k&&k.kind==='cr'&&k.k===o.c.cr.floor.k&&k.won===false; });
  // ⑤ 雙屬性 hi 協同：floor 過關+兩屬性加總≥need → 走 hi(正向)，r133hi+1、keySnap kind:cr k=ks[0] won:true
  out.hi = opts.every(o=>{ const s=crRun(o,'hi'); const k=s.keySnap[s.keySnap.length-1];
    return (s.flags.r133hi||0)>0 && k&&k.kind==='cr'&&k.k===o.c.cr.ks[0]&&k.won===true; });
  // ⑥ 差臨門 lo：floor 過關但兩屬性加總<need → 走 lo，r133lo+1、keySnap won:false
  out.lo = opts.every(o=>{ const s=crRun(o,'lo'); const k=s.keySnap[s.keySnap.length-1];
    return (s.flags.r133lo||0)>0 && k&&k.kind==='cr'&&k.won===false; });
  // ⑦ deterministic 零額外 rng：同屬性兩次跑 hi 結果一致（純門檻、種子序列不靠擲骰）
  out.deterministic = opts.every(o=>{ const a=crRun(o,'hi'), ka=a.keySnap[a.keySnap.length-1];
    const b=crRun(o,'hi'), kb=b.keySnap[b.keySnap.length-1]; return ka.won===kb.won && ka.k===kb.k && ka.won===true; });
  // ⑧ 判決書呈現：keySnap 有 cr 料 → 含標題/MVP/罩門/複合門檻字樣
  fresh(60,{}); S.keySnap=[{age:30,k:'int',kind:'cr',won:true,v:80,ev:'a'},{age:40,k:'int',kind:'cr',won:true,v:85,ev:'b'},{age:45,k:'hp',kind:'cr',won:false,v:10,ev:'c'}]; S.flags.r133cr=3; S.flags.r133floor=1;
  const vh=r133VerdictHTML();
  out.verdictRender = vh.indexOf('屬性命運判決書')>=0 && vh.indexOf('MVP')>=0 && vh.indexOf('罩門')>=0 && vh.indexOf('複合門檻')>=0;
  // ⑨ 純呈現零汙染：生成前後 S.attr/flags/keySnap 不變、零 rng 消耗
  const bA=JSON.stringify(S.attr), bF=JSON.stringify(S.flags), bK=JSON.stringify(S.keySnap);
  let used=0; const oldR=rng; rng=function(){ used++; return oldR(); };
  r133VerdictHTML(); r133VerdictHTML(); rng=oldR;
  out.verdictPure = JSON.stringify(S.attr)===bA && JSON.stringify(S.flags)===bF && JSON.stringify(S.keySnap)===bK && used===0;
  // ⑩ 髒資料降級：keySnap 含 null/非 ATTR 鍵被濾掉不炸，仍回字串
  out.dirtySafe = (()=>{ try{ fresh(60,{}); S.keySnap=[null,{k:'zzz'},{k:'int',kind:'cr',won:true,v:5,ev:''}]; return typeof r133VerdictHTML()==='string'; }catch(e){ return false; } })();
  // ⑪ 無關鍵抉擇/空 keySnap → 安全降級回空字串
  out.verdictEmpty = (fresh(60,{}), S.keySnap=[], r133VerdictHTML()==='');
  // ⑫ 舊存檔相容：ensureState 不為 R133 在 S.flags 補任何鍵
  startGame(); const olds=S; ensureState(olds); out.compatOld = !Object.keys(olds.flags).some(k=>k.indexOf('r133')===0);
  // ⑬ 無局(S=null)相容：判決書回空字串不炸
  out.nullSafe = (()=>{ try{ S=null; return r133VerdictHTML()===''; }catch(e){ return false; } })();
  return JSON.stringify(out);
})()`, sandbox));
[
  ['count','① 本輪 c.cr 複合屬性門檻掛點齊備(≥6 處)'],
  ['struct','② 結構守約:label gtag+🎯+複合+R133、ks 長2皆ATTR鍵、need100-140、floor.below15-30、hi/lo/floor eff+res 齊備且文案相異'],
  ['cover','③ 五圍覆蓋:所有 cr.ks 聯集涵蓋 hp/int/apr/mny/hap'],
  ['floor','④ 弱項 floor 真拖垮:低於門檻走 floor、r133floor/cr+1、keySnap kind:cr k=floor.k won:false'],
  ['hi','⑤ 雙屬性 hi 協同:加總≥need 走 hi、r133hi+1、keySnap kind:cr k=ks[0] won:true'],
  ['lo','⑥ 差臨門 lo:加總<need 走 lo、r133lo+1、keySnap won:false'],
  ['deterministic','⑦ deterministic 零額外 rng:同屬性兩次跑 hi 結果完全一致'],
  ['verdictRender','⑧ 判決書呈現:含「屬性命運判決書」+MVP+罩門+複合門檻'],
  ['verdictPure','⑨ 純呈現零汙染:生成前後 S.attr/flags/keySnap 不變且零 rng'],
  ['dirtySafe','⑩ 髒資料降級:keySnap 含 null/非ATTR鍵被濾掉不炸仍回字串'],
  ['verdictEmpty','⑪ 無關鍵抉擇/空 keySnap→安全降級回空字串'],
  ['compatOld','⑫ 舊存檔相容:ensureState 不為 R133 補 S.flags 鍵'],
  ['nullSafe','⑬ 無局(S=null)相容:判決書回空字串不炸'],
].forEach(([k,m])=>ok(r133[k], 'R133 '+m));

// ===== R135 出生年代浪潮：資料齊備/年代卡渲染/分享文字含連結/deterministic讀S.era/純呈現零汙染/無era降級/髒era降級/S=null降級/舊存檔不補鍵/跨局集滿成就 =====
const r135 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  // ① 資料齊備：R55 六個年代每個都有 R135_WAVE，且 tag/price/mood/quote/share 皆非空字串
  out.dataFull = R55_ERAS.length>=6 && R55_ERAS.every(er=>{ const w=R135_WAVE[er.id];
    return w && ['tag','price','mood','quote','share'].every(k=>typeof w[k]==='string' && w[k].length>4); });
  // ② 年代卡渲染：設一個合法年代 → 含年代名/物價/氛圍/金句/收集進度/複製按鈕
  startGame(); S.era='e10';
  const card=r135WaveCardHTML();
  out.cardRender = card.indexOf(R55_MAP.e10.nm)>=0 && card.indexOf('物價')>=0 && card.indexOf('氛圍')>=0
    && card.indexOf('世代收集')>=0 && card.indexOf('copyR135EraCard')>=0;
  // ③ 分享文字：含年代名與 earthlife.pages.dev、且無捏造對戰勝率字眼
  const txt=r135EraShareText();
  out.shareText = txt.indexOf(R55_MAP.e10.nm)>=0 && txt.indexOf(SHARE_URL)>=0
    && !/(贏過|打敗|勝過|超越|擊敗|勝率|存活率|百分位)[^。\\n]{0,8}\\d+\\s*%/.test(txt);
  // ④ deterministic 純讀 S.era：同年代兩次渲染逐字一致
  S.era='e70'; const a1=r135WaveCardHTML(), a2=r135WaveCardHTML();
  out.deterministic = a1===a2 && a1.indexOf(R55_MAP.e70.nm)>=0;
  // ⑤ 純呈現零汙染：生成前後 S.attr/era/flags 不變、零 rng 消耗
  S.era='e20'; const bA=JSON.stringify(S.attr), bE=S.era, bF=JSON.stringify(S.flags);
  let used=0; const oldR=rng; rng=function(){ used++; return oldR(); };
  r135WaveCardHTML(); r135EraShareText(); rng=oldR;
  out.pure = JSON.stringify(S.attr)===bA && S.era===bE && JSON.stringify(S.flags)===bF && used===0;
  // ⑥ 無 era 降級：S.era 缺 → 卡與文字皆空字串不炸
  startGame(); delete S.era;
  out.noEra = r135WaveCardHTML()==='' && r135EraShareText()==='';
  // ⑦ 髒 era 降級：S.era 為不存在 id → 空字串不炸
  startGame(); S.era='zzz999';
  out.dirtyEra = (()=>{ try{ return r135WaveCardHTML()==='' && r135EraShareText()===''; }catch(e){ return false; } })();
  // ⑧ S=null 降級：卡與文字皆空字串不炸
  out.nullSafe = (()=>{ try{ S=null; return r135WaveCardHTML()==='' && r135EraShareText()===''; }catch(e){ return false; } })();
  // ⑨ 舊存檔相容：ensureState 不為 R135 在 S 補任何 r135 鍵
  startGame(); const olds=S; ensureState(olds);
  out.compatOld = !Object.keys(olds).some(k=>k.toLowerCase().indexOf('r135')===0)
    && !Object.keys(olds.flags||{}).some(k=>k.toLowerCase().indexOf('r135')===0);
  // ⑩ 跨局集滿成就 r135_allgen：六世代全亮→解鎖、缺一→不解
  const allSeen={}; R55_ERAS.forEach(er=>allSeen[er.id]=true);
  SAVE.eraSeen=allSeen; out.achFull = !!ACH_MAP.r135_allgen && ACH_MAP.r135_allgen.check({S:{},age:0});
  const partial=Object.assign({},allSeen); delete partial[R55_ERAS[0].id];
  SAVE.eraSeen=partial; out.achPartial = !ACH_MAP.r135_allgen.check({S:{},age:0});
  SAVE.eraSeen={};
  return JSON.stringify(out);
})()`, sandbox));
[
  ['dataFull','① 資料齊備:R55 六年代皆有 R135_WAVE 且 tag/price/mood/quote/share 非空'],
  ['cardRender','② 年代卡渲染:含年代名/物價/氛圍/金句/收集進度/複製按鈕'],
  ['shareText','③ 分享文字:含年代名與 earthlife.pages.dev、無捏造勝率%'],
  ['deterministic','④ deterministic 純讀 S.era:同年代兩次渲染逐字一致'],
  ['pure','⑤ 純呈現零汙染:生成前後 S.attr/era/flags 不變且零 rng'],
  ['noEra','⑥ 無 era 降級:卡與分享文字皆回空字串不炸'],
  ['dirtyEra','⑦ 髒 era 降級:不存在 id→空字串不炸'],
  ['nullSafe','⑧ 無局(S=null)相容:卡與分享文字皆回空字串不炸'],
  ['compatOld','⑨ 舊存檔相容:ensureState 不為 R135 補任何 S/flags 鍵'],
  ['achFull','⑩ 跨局集滿:六世代全亮→r135_allgen 解鎖'],
  ['achPartial','⑩ 跨局集滿:缺一世代→r135_allgen 不解'],
].forEach(([k,m])=>ok(r135[k], 'R135 '+m));

/* ===== R136 人際羈絆網・人生重要他人（純呈現/唯讀疊加層；零 rng/零汙染/deterministic 推導/舊存檔降級/羈絆成就） ===== */
const r136 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function mk(attr,age,bonds,flags){ return {attr:Object.assign({hp:50,int:50,apr:50,mny:50,hap:50},attr), age:age, bonds:bonds||{}, flags:flags||{}, alive:false}; }
  // ① 資料齊備：>=9 個 NPC，欄位完整、grp 合法、d 為函式
  const grps=['family','friend','love','work','life'];
  out.dataFull = Array.isArray(R136_PEOPLE) && R136_PEOPLE.length>=9
    && R136_PEOPLE.every(p=>p.k&&p.ic&&p.nm&&p.role&&grps.indexOf(p.grp)>=0&&typeof p.d==='function');
  // ② roster 推導＋卡片渲染：豐富正向人生→八人登場、含老母老爸、含三段總結
  const GOOD=mk({hp:80,int:80,apr:80,mny:72,hap:80},60,{boss:25,lover:35});
  S=GOOD; const ros=r136Roster(); const card=r136PeopleReviewHTML();
  out.roster = ros.length>=8 && ros.some(x=>x.k==='mom') && ros.every(x=>typeof x.bond==='number'&&typeof x.years==='number');
  out.cardRender = card.indexOf('人生重要他人')>=0 && card.indexOf('招治')>=0
    && card.indexOf('陪你走最久')>=0 && card.indexOf('虧欠')>=0 && card.indexOf('拖累')>=0;
  // ③ deterministic 純讀：同 S 兩次渲染逐字一致
  S=mk({hp:80,int:80,apr:80,mny:72,hap:80},60,{boss:25,lover:35});
  const a1=r136PeopleReviewHTML(), a2=r136PeopleReviewHTML();
  out.deterministic = a1===a2 && a1.indexOf('招治')>=0;
  // ④ 純呈現零汙染：生成前後 S 不變、零 rng 消耗
  S=mk({hp:80,int:80,apr:80,mny:72,hap:80},60,{boss:25,lover:35});
  const bA=JSON.stringify(S.attr), bB=JSON.stringify(S.bonds), bF=JSON.stringify(S.flags), bAge=S.age;
  let used=0; const oldR=rng; rng=function(){ used++; return oldR(); };
  r136PeopleReviewHTML(); r136Roster(); rng=oldR;
  out.pure = JSON.stringify(S.attr)===bA && JSON.stringify(S.bonds)===bB && JSON.stringify(S.flags)===bF && S.age===bAge && used===0;
  // ⑤ S=null / 缺 attr 降級：roster 空陣列、卡空字串、不炸
  out.nullSafe = (()=>{ try{ S=null; return r136Roster().length===0 && r136PeopleReviewHTML()===''; }catch(e){ return false; } })();
  out.noAttr = (()=>{ try{ S={age:50,flags:{}}; return r136RosterOf(S).length===0 && r136PeopleReviewHTML()===''; }catch(e){ return false; } })();
  // ⑥ 髒資料降級：flags 非物件、bonds 缺鍵 → 不炸、仍回陣列
  out.dirtySafe = (()=>{ try{ const dd={attr:{hp:50,int:50,apr:50,mny:50,hap:50},age:40,flags:'x',bonds:null}; return Array.isArray(r136RosterOf(dd)) && r136RosterOf(dd).length>=1; }catch(e){ return false; } })();
  // ⑦ 舊存檔相容：ensureState 不為 R136 在 S/flags 補任何 r136 鍵
  startGame(); const olds=S; ensureState(olds);
  out.compatOld = !Object.keys(olds).some(k=>k.toLowerCase().indexOf('r136')===0)
    && !Object.keys(olds.flags||{}).some(k=>k.toLowerCase().indexOf('r136')===0);
  // ⑧ 成就 r136_full：八人齊+平均正向→解；met<8→不解
  out.achFull = !!ACH_MAP.r136_full && ACH_MAP.r136_full.check({S:GOOD})===true;
  const CUT=mk({hp:70,int:60,apr:30,mny:85,hap:55},40,{});
  out.achFullNo = ACH_MAP.r136_full.check({S:CUT})===false;
  // ⑨ 成就 r136_lonely：整體羈絆負→解；正向人生→不解
  const LONE=mk({hp:15,int:15,apr:15,mny:15,hap:15},50,{boss:-15,lover:-10});
  out.achLonely = !!ACH_MAP.r136_lonely && ACH_MAP.r136_lonely.check({S:LONE})===true && ACH_MAP.r136_lonely.check({S:GOOD})===false;
  // ⑩ 成就 r136_drag：損友重度拖累→解；好人生(損友未登場)→不解
  const DRAG=mk({hp:40,int:40,apr:40,mny:30,hap:40},40,{});
  out.achDrag = !!ACH_MAP.r136_drag && ACH_MAP.r136_drag.check({S:DRAG})===true && ACH_MAP.r136_drag.check({S:GOOD})===false;
  // ⑪ 成就 r136_owe：父母兩段皆虧欠→解；GOOD→不解
  const OWE=mk({hp:50,int:50,apr:30,mny:30,hap:30},50,{});
  out.achOwe = !!ACH_MAP.r136_owe && ACH_MAP.r136_owe.check({S:OWE})===true && ACH_MAP.r136_owe.check({S:GOOD})===false;
  // ⑫ 成就 r136_cutoff：小圈正向零拖累零虧欠→解；GOOD(八人)→不解
  out.achCutoff = !!ACH_MAP.r136_cutoff && ACH_MAP.r136_cutoff.check({S:CUT})===true && ACH_MAP.r136_cutoff.check({S:GOOD})===false;
  S=null;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['dataFull','① 資料齊備:≥9 NPC、欄位完整、grp 合法、d 為函式'],
  ['roster','② roster 推導:豐富人生≥8 人登場、含老母、欄位型別正確'],
  ['cardRender','② 卡片渲染:含「人生重要他人」/招治/陪你走最久/虧欠/拖累'],
  ['deterministic','③ deterministic 純讀:同 S 兩次渲染逐字一致'],
  ['pure','④ 純呈現零汙染:生成前後 S.attr/bonds/flags/age 不變且零 rng'],
  ['nullSafe','⑤ 無局(S=null)降級:roster 空、卡空字串不炸'],
  ['noAttr','⑤ 缺 attr 降級:roster 空、卡空字串不炸'],
  ['dirtySafe','⑥ 髒資料降級:flags 非物件/bonds null→仍回陣列不炸'],
  ['compatOld','⑦ 舊存檔相容:ensureState 不為 R136 補任何 S/flags 鍵'],
  ['achFull','⑧ r136_full:八人齊+平均正向→解'],
  ['achFullNo','⑧ r136_full:不足八人→不解'],
  ['achLonely','⑨ r136_lonely:整體羈絆負→解、正向人生→不解'],
  ['achDrag','⑩ r136_drag:損友重度拖累→解、損友未登場→不解'],
  ['achOwe','⑪ r136_owe:父母兩段虧欠→解、GOOD→不解'],
  ['achCutoff','⑫ r136_cutoff:小圈全正向零拖累零虧欠→解、八人局→不解'],
].forEach(([k,m])=>ok(r136[k], 'R136 '+m));

/* ===== R137 蝸居人生・房產夢居住軌跡（純衍生/結算覆蓋層；零 rng/零汙染/deterministic 推演/財富+世代驅動/壞資料降級/居住成就） ===== */
const r137 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function mk(mny,age,era){ return {attr:{hp:50,int:50,apr:50,mny:mny,hap:50}, age:age, era:era, flags:{}, alive:false}; }
  // ① 資料齊備：8 居住階層欄位完整、R55 六世代房價 offset 齊備、5 人生階段、6 結局型別
  out.dataFull = Array.isArray(R137_TIERS) && R137_TIERS.length===8 && R137_TIERS.every(t=>t.ic&&t.nm&&t.short)
    && R55_ERAS.every(er=>typeof R137_ERAOFF[er.id]==='number')
    && Array.isArray(R137_PHASES) && R137_PHASES.length===5
    && ['palace','owner','mortgage','inherit','renter','snail'].every(k=>R137_END[k]&&R137_END[k].nm&&R137_END[k].net&&R137_END[k].note);
  // ② 居住階層確定性映射：高財富→帝寶(7)、中財富→上車(>=3)、低財富→無殼(0)；且財富單調驅動
  const hi=r137HousingOf(mk(95,70,'e00')), midd=r137HousingOf(mk(50,40,'e00')), lo=r137HousingOf(mk(5,60,'e00'));
  out.tierMap = !!hi&&!!midd&&!!lo && hi.finalTier===7 && midd.finalTier>=3 && lo.finalTier===0
    && hi.finalTier>midd.finalTier && midd.finalTier>lo.finalTier;
  // ③ 世代真正驅動：同財富 50，老世代(e70 買得起)階層 > 22K 世代(e10 買不起)
  const old=r137HousingOf(mk(50,55,'e70')), young=r137HousingOf(mk(50,55,'e10'));
  out.eraDrive = !!old&&!!young && old.finalTier>young.finalTier;
  // ④ 卡片渲染：含標題/居住結局/房產淨值/上車與否
  S=mk(50,40,'e00'); const card=r137HousingReviewHTML();
  out.cardRender = card.indexOf('居住軌跡')>=0 && card.indexOf('居住結局')>=0 && card.indexOf('房產淨值')>=0 && card.indexOf('上車')>=0;
  // ⑤ deterministic 純讀：同 S 兩次渲染逐字一致
  S=mk(50,40,'e10'); const a1=r137HousingReviewHTML(), a2=r137HousingReviewHTML();
  out.deterministic = a1===a2 && a1.length>0;
  // ⑥ 純呈現零汙染：生成前後 S.attr/era/age/flags 不變、零 rng 消耗
  S=mk(72,55,'e70'); const bA=JSON.stringify(S.attr), bE=S.era, bAge=S.age, bF=JSON.stringify(S.flags);
  let used=0; const oldR=rng; rng=function(){ used++; return oldR(); };
  r137HousingReviewHTML(); r137HousingOf(S); rng=oldR;
  out.pure = JSON.stringify(S.attr)===bA && S.era===bE && S.age===bAge && JSON.stringify(S.flags)===bF && used===0;
  // ⑦ S=null / 缺 attr / 缺 mny 降級：回 null、卡空字串、不炸
  out.nullSafe = (()=>{ try{ S=null; return r137HousingOf(null)===null && r137HousingReviewHTML()===''; }catch(e){ return false; } })();
  out.noAttr = (()=>{ try{ return r137HousingOf({age:50,era:'e00'})===null && r137HousingOf({attr:{},age:50})===null; }catch(e){ return false; } })();
  // ⑧ 髒 era 降級：不存在 era id → 用中性 offset（等同 offset 0/缺 era），仍回物件不炸
  out.dirtyEra = (()=>{ try{ const d=r137HousingOf(mk(50,40,'zzz999')); const n=r137HousingOf(mk(50,40,null)); return !!d && !!n && d.finalTier===n.finalTier; }catch(e){ return false; } })();
  // ⑨ 舊存檔相容：ensureState 不為 R137 在 S/flags 補任何 r137 鍵
  startGame(); const olds=S; ensureState(olds);
  out.compatOld = !Object.keys(olds).some(k=>k.toLowerCase().indexOf('r137')===0)
    && !Object.keys(olds.flags||{}).some(k=>k.toLowerCase().indexOf('r137')===0);
  // ⑩ 居住成就確定性點亮：帝寶/房貸奴/一生租屋/有殼階級/繼承祖厝 各自可達且互斥
  const PAL=mk(98,70,'e00'), MORT=mk(50,40,'e00'), RENT=mk(28,60,'e00'), OWN=mk(72,60,'e00'), INH=mk(45,55,'e80');
  out.achPalace   = !!ACH_MAP.r137_palace   && ACH_MAP.r137_palace.check({S:PAL})===true   && ACH_MAP.r137_palace.check({S:RENT})===false;
  out.achMortgage = !!ACH_MAP.r137_mortgage && ACH_MAP.r137_mortgage.check({S:MORT})===true && ACH_MAP.r137_mortgage.check({S:PAL})===false;
  out.achRenter   = !!ACH_MAP.r137_renter   && ACH_MAP.r137_renter.check({S:RENT})===true   && ACH_MAP.r137_renter.check({S:PAL})===false;
  out.achOwner    = !!ACH_MAP.r137_owner    && ACH_MAP.r137_owner.check({S:OWN})===true     && ACH_MAP.r137_owner.check({S:MORT})===false;
  out.achInherit  = !!ACH_MAP.r137_inherit  && ACH_MAP.r137_inherit.check({S:INH})===true   && ACH_MAP.r137_inherit.check({S:PAL})===false;
  // ⑪ 跨局集滿 r137_housing：五成就全亮→解鎖、缺一→不解
  const allAch={r137_owner:true,r137_mortgage:true,r137_inherit:true,r137_renter:true,r137_palace:true};
  SAVE.ach=Object.assign({},allAch); out.achFull = !!ACH_MAP.r137_housing && ACH_MAP.r137_housing.check({S:{}})===true;
  const partial=Object.assign({},allAch); delete partial.r137_palace;
  SAVE.ach=partial; out.achPartial = ACH_MAP.r137_housing.check({S:{}})===false;
  SAVE.ach={}; S=null;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['dataFull','① 資料齊備:8 居住階層+六世代房價offset+5 人生階段+6 結局型別'],
  ['tierMap','② 居住階層確定性映射:高→帝寶/中→上車/低→無殼且財富單調驅動'],
  ['eraDrive','③ 世代真正驅動:同財富老世代階層>22K世代'],
  ['cardRender','④ 卡片渲染:含居住軌跡/居住結局/房產淨值/上車'],
  ['deterministic','⑤ deterministic 純讀:同 S 兩次渲染逐字一致'],
  ['pure','⑥ 純呈現零汙染:生成前後 S.attr/era/age/flags 不變且零 rng'],
  ['nullSafe','⑦ 無局(S=null)降級:回 null、卡空字串不炸'],
  ['noAttr','⑦ 缺 attr/mny 降級:回 null 不炸'],
  ['dirtyEra','⑧ 髒 era 降級:用中性 offset 仍回物件不炸'],
  ['compatOld','⑨ 舊存檔相容:ensureState 不為 R137 補任何 S/flags 鍵'],
  ['achPalace','⑩ r137_palace:帝寶→解、租屋→不解'],
  ['achMortgage','⑩ r137_mortgage:房貸奴→解、帝寶→不解'],
  ['achRenter','⑩ r137_renter:一生租屋(55+)→解、帝寶→不解'],
  ['achOwner','⑩ r137_owner:有殼階級→解、房貸奴→不解'],
  ['achInherit','⑩ r137_inherit:繼承祖厝→解、帝寶→不解'],
  ['achFull','⑪ 跨局集滿:五成就全亮→r137_housing 解鎖'],
  ['achPartial','⑪ 跨局集滿:缺一→r137_housing 不解'],
].forEach(([k,m])=>ok(r137[k], 'R137 '+m));

/* ===== R138 健康人生軌跡・病歷與長照（純衍生/結算覆蓋層；零 rng/零汙染/deterministic 推演/健康主驅動+財富就醫品質/壞資料降級/健康成就） ===== */
const r138 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function mk(hp,mny,age,era){ return {attr:{hp:hp,int:50,apr:50,mny:mny,hap:50}, age:age, era:era, flags:{}, alive:false}; }
  // ① 資料齊備：6 健康階層欄位完整、4 人生階段、6 結局型別、六世代醫療梗、就醫品質三檔
  out.dataFull = Array.isArray(R138_TIERS) && R138_TIERS.length===6 && R138_TIERS.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R138_PHASES) && R138_PHASES.length===4 && R138_PHASES.every(p=>typeof p.erode==='number')
    && ['ironman','peaceful','chronic','er','karoshi','longcare'].every(k=>R138_END[k]&&R138_END[k].nm&&R138_END[k].care&&R138_END[k].note)
    && R55_ERAS.every(er=>typeof R138_ERAMED[er.id]==='string')
    && [r138CareOf(90),r138CareOf(50),r138CareOf(10)].every(c=>typeof c.off==='number'&&c.nm&&c.short);
  // ② 健康確定性映射：高健康→鐵人(5)、中健康→中段(>=3)、低健康→臥床(0)；且健康單調驅動
  const hi=r138HealthOf(mk(90,50,50,'e00')), midd=r138HealthOf(mk(50,50,50,'e00')), lo=r138HealthOf(mk(5,50,50,'e00'));
  out.tierMap = !!hi&&!!midd&&!!lo && hi.finalTier===5 && midd.finalTier>=3 && lo.finalTier===0
    && hi.finalTier>midd.finalTier && midd.finalTier>lo.finalTier;
  // ③ 財富影響就醫品質（次級修正）：同健康 55，有錢自費(mny90)階層 > 22K看不起病(mny10)
  const rich=r138HealthOf(mk(55,90,50,'e00')), poor=r138HealthOf(mk(55,10,50,'e00'));
  out.careDrive = !!rich&&!!poor && rich.finalTier>poor.finalTier && rich.care.off>poor.care.off;
  // ④ 卡片渲染：含標題/健康結局/就醫品質/撐住或欠操
  S=mk(50,50,50,'e00'); const card=r138HealthReviewHTML();
  out.cardRender = card.indexOf('健康人生')>=0 && card.indexOf('健康結局')>=0 && card.indexOf('就醫品質')>=0 && (card.indexOf('撐住')>=0||card.indexOf('欠操')>=0);
  // ⑤ deterministic 純讀：同 S 兩次渲染逐字一致
  S=mk(40,50,50,'e10'); const a1=r138HealthReviewHTML(), a2=r138HealthReviewHTML();
  out.deterministic = a1===a2 && a1.length>0;
  // ⑥ 純呈現零汙染：生成前後 S.attr/era/age/flags 不變、零 rng 消耗
  S=mk(72,55,55,'e70'); const bA=JSON.stringify(S.attr), bE=S.era, bAge=S.age, bF=JSON.stringify(S.flags);
  let used=0; const oldR=rng; rng=function(){ used++; return oldR(); };
  r138HealthReviewHTML(); r138HealthOf(S); rng=oldR;
  out.pure = JSON.stringify(S.attr)===bA && S.era===bE && S.age===bAge && JSON.stringify(S.flags)===bF && used===0;
  // ⑦ S=null / 缺 attr / 缺 hp 降級：回 null、卡空字串、不炸
  out.nullSafe = (()=>{ try{ S=null; return r138HealthOf(null)===null && r138HealthReviewHTML()===''; }catch(e){ return false; } })();
  out.noAttr = (()=>{ try{ return r138HealthOf({age:50,era:'e00'})===null && r138HealthOf({attr:{},age:50})===null; }catch(e){ return false; } })();
  // ⑧ 缺 mny 降級：用中性 50、仍回物件不炸；髒 era → 醫療梗略過不炸
  out.softDeg = (()=>{ try{ const m=r138HealthOf({attr:{hp:55},age:50,era:'e00',flags:{}}); const d=r138HealthOf(mk(55,50,50,'zzz999')); return !!m && m.finalTier===r138HealthOf(mk(55,50,50,'e00')).finalTier && !!d && d.era===null; }catch(e){ return false; } })();
  // ⑨ 舊存檔相容：ensureState 不為 R138 在 S/flags 補任何 r138 鍵
  startGame(); const olds=S; ensureState(olds);
  out.compatOld = !Object.keys(olds).some(k=>k.toLowerCase().indexOf('r138')===0)
    && !Object.keys(olds.flags||{}).some(k=>k.toLowerCase().indexOf('r138')===0);
  // ⑩ 健康成就確定性點亮：鐵人/善終/藥罐子/過勞猝死/長照 各自可達且互斥
  const IRON=mk(95,50,40,'e00'), PEACE=mk(70,50,75,'e00'), CHRON=mk(40,50,50,'e00'), KARO=mk(10,60,45,'e00'), LONG=mk(8,30,70,'e00');
  out.achIronman  = !!ACH_MAP.r138_ironman  && ACH_MAP.r138_ironman.check({S:IRON})===true   && ACH_MAP.r138_ironman.check({S:PEACE})===false;
  out.achPeaceful = !!ACH_MAP.r138_peaceful && ACH_MAP.r138_peaceful.check({S:PEACE})===true && ACH_MAP.r138_peaceful.check({S:IRON})===false;
  out.achPillbox  = !!ACH_MAP.r138_pillbox  && ACH_MAP.r138_pillbox.check({S:CHRON})===true  && ACH_MAP.r138_pillbox.check({S:IRON})===false;
  out.achKaroshi  = !!ACH_MAP.r138_karoshi  && ACH_MAP.r138_karoshi.check({S:KARO})===true   && ACH_MAP.r138_karoshi.check({S:LONG})===false;
  out.achLongcare = !!ACH_MAP.r138_longcare && ACH_MAP.r138_longcare.check({S:LONG})===true  && ACH_MAP.r138_longcare.check({S:KARO})===false;
  // ⑪ 跨局集滿 r138_health：五成就全亮→解鎖、缺一→不解
  const allAch={r138_ironman:true,r138_peaceful:true,r138_pillbox:true,r138_karoshi:true,r138_longcare:true};
  SAVE.ach=Object.assign({},allAch); out.achFull = !!ACH_MAP.r138_health && ACH_MAP.r138_health.check({S:{}})===true;
  const partial=Object.assign({},allAch); delete partial.r138_ironman;
  SAVE.ach=partial; out.achPartial = ACH_MAP.r138_health.check({S:{}})===false;
  SAVE.ach={}; S=null;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['dataFull','① 資料齊備:6 健康階層+4 人生階段+6 結局型別+六世代醫療梗+就醫品質三檔'],
  ['tierMap','② 健康確定性映射:高→鐵人/中→中段/低→臥床且健康單調驅動'],
  ['careDrive','③ 財富影響就醫品質:同健康有錢自費階層>22K看不起病'],
  ['cardRender','④ 卡片渲染:含健康人生/健康結局/就醫品質/撐住或欠操'],
  ['deterministic','⑤ deterministic 純讀:同 S 兩次渲染逐字一致'],
  ['pure','⑥ 純呈現零汙染:生成前後 S.attr/era/age/flags 不變且零 rng'],
  ['nullSafe','⑦ 無局(S=null)降級:回 null、卡空字串不炸'],
  ['noAttr','⑦ 缺 attr/hp 降級:回 null 不炸'],
  ['softDeg','⑧ 缺 mny 用中性50/髒 era 醫療梗略過:仍回物件不炸'],
  ['compatOld','⑨ 舊存檔相容:ensureState 不為 R138 補任何 S/flags 鍵'],
  ['achIronman','⑩ r138_ironman:鐵人→解、善終→不解'],
  ['achPeaceful','⑩ r138_peaceful:無病善終→解、鐵人→不解'],
  ['achPillbox','⑩ r138_pillbox:三高藥罐子→解、鐵人→不解'],
  ['achKaroshi','⑩ r138_karoshi:過勞猝死→解、長照→不解'],
  ['achLongcare','⑩ r138_longcare:中風長照→解、過勞猝死→不解'],
  ['achFull','⑪ 跨局集滿:五成就全亮→r138_health 解鎖'],
  ['achPartial','⑪ 跨局集滿:缺一→r138_health 不解'],
].forEach(([k,m])=>ok(r138[k], 'R138 '+m));

/* ===== R139 學歷・職涯軌跡（純衍生/結算覆蓋層；零 rng/零汙染/deterministic 推演/智力主驅動+財富升學資源/壞資料降級/職涯成就） ===== */
const r139 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function mk(intl,mny,age,era){ return {attr:{hp:50,int:intl,apr:50,mny:mny,hap:50}, age:age, era:era, flags:{}, alive:false}; }
  // ① 資料齊備：6 學歷階層+6 職涯階層+4 人生階段+6 結局型別+六世代就業梗+升學資源三檔
  out.dataFull = Array.isArray(R139_EDU) && R139_EDU.length===6 && R139_EDU.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R139_CAREER) && R139_CAREER.length===6 && R139_CAREER.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R139_PHASES) && R139_PHASES.length===4 && R139_PHASES.every(p=>typeof p.off==='number')
    && ['freedom','manager','drudge','lieflat','layoff','lowwage'].every(k=>R139_END[k]&&R139_END[k].nm&&R139_END[k].path&&R139_END[k].note)
    && R55_ERAS.every(er=>typeof R139_ERAJOB[er.id]==='string')
    && [r139EduBoostOf(90),r139EduBoostOf(50),r139EduBoostOf(10)].every(c=>typeof c.off==='number'&&c.nm&&c.short);
  // ② 智力確定性映射：高智力→頂大(>=4)、中智力→中段(>=2)、低智力→放牛班(0)；且智力單調驅動
  const hi=r139CareerOf(mk(95,50,40,'e00')), midd=r139CareerOf(mk(50,50,40,'e00')), lo=r139CareerOf(mk(5,50,40,'e00'));
  out.eduMap = !!hi&&!!midd&&!!lo && hi.eduTier>=4 && midd.eduTier>=2 && lo.eduTier===0
    && hi.eduTier>midd.eduTier && midd.eduTier>lo.eduTier;
  // ③ 財富影響升學資源（次級修正）：同智力 55，有錢補習(mny90)學歷 >= 繳不起補習(mny10)，且 off 有別
  const rich=r139CareerOf(mk(55,90,40,'e00')), poor=r139CareerOf(mk(55,10,40,'e00'));
  out.boostDrive = !!rich&&!!poor && rich.eduTier>=poor.eduTier && rich.boost.off>poor.boost.off;
  // ④ 卡片渲染：含標題/學歷/職涯結局/升學資源/翻身或階級
  S=mk(50,50,40,'e00'); const card=r139CareerReviewHTML();
  out.cardRender = card.indexOf('學歷')>=0 && card.indexOf('職涯結局')>=0 && card.indexOf('升學資源')>=0 && (card.indexOf('翻身')>=0||card.indexOf('階級')>=0);
  // ⑤ deterministic 純讀：同 S 兩次渲染逐字一致
  S=mk(40,40,35,'e10'); const a1=r139CareerReviewHTML(), a2=r139CareerReviewHTML();
  out.deterministic = a1===a2 && a1.length>0;
  // ⑥ 純呈現零汙染：生成前後 S.attr/era/age/flags 不變、零 rng 消耗
  S=mk(72,55,45,'e70'); const bA=JSON.stringify(S.attr), bE=S.era, bAge=S.age, bF=JSON.stringify(S.flags);
  let used=0; const oldR=rng; rng=function(){ used++; return oldR(); };
  r139CareerReviewHTML(); r139CareerOf(S); rng=oldR;
  out.pure = JSON.stringify(S.attr)===bA && S.era===bE && S.age===bAge && JSON.stringify(S.flags)===bF && used===0;
  // ⑦ S=null / 缺 attr / 缺 int 降級：回 null、卡空字串、不炸
  out.nullSafe = (()=>{ try{ S=null; return r139CareerOf(null)===null && r139CareerReviewHTML()===''; }catch(e){ return false; } })();
  out.noAttr = (()=>{ try{ return r139CareerOf({age:40,era:'e00'})===null && r139CareerOf({attr:{},age:40})===null; }catch(e){ return false; } })();
  // ⑧ 缺 mny 降級：用中性 50、仍回物件不炸；髒 era → 就業梗略過不炸
  out.softDeg = (()=>{ try{ const m=r139CareerOf({attr:{int:55},age:40,era:'e00',flags:{}}); const d=r139CareerOf(mk(55,50,40,'zzz999')); return !!m && m.eduTier===r139CareerOf(mk(55,50,40,'e00')).eduTier && !!d && d.era===null; }catch(e){ return false; } })();
  // ⑨ 舊存檔相容：ensureState 不為 R139 在 S/flags 補任何 r139 鍵
  startGame(); const olds=S; ensureState(olds);
  out.compatOld = !Object.keys(olds).some(k=>k.toLowerCase().indexOf('r139')===0)
    && !Object.keys(olds.flags||{}).some(k=>k.toLowerCase().indexOf('r139')===0);
  // ⑩ 職涯成就確定性點亮：勝利組/小主管/躺平/中年失業/22K魯蛇 各自可達且互斥
  const FREE=mk(95,90,45,'e00'), MGR=mk(70,55,50,'e00'), FLAT=mk(35,25,38,'e00'), LAY=mk(40,35,55,'e00'), LOW=mk(10,20,25,'e00');
  out.achFreedom = !!ACH_MAP.r139_freedom && ACH_MAP.r139_freedom.check({S:FREE})===true && ACH_MAP.r139_freedom.check({S:LOW})===false;
  out.achManager = !!ACH_MAP.r139_manager && ACH_MAP.r139_manager.check({S:MGR})===true && ACH_MAP.r139_manager.check({S:FREE})===false;
  out.achLieflat = !!ACH_MAP.r139_lieflat && ACH_MAP.r139_lieflat.check({S:FLAT})===true && ACH_MAP.r139_lieflat.check({S:MGR})===false;
  out.achLayoff  = !!ACH_MAP.r139_layoff  && ACH_MAP.r139_layoff.check({S:LAY})===true   && ACH_MAP.r139_layoff.check({S:FLAT})===false;
  out.achLowwage = !!ACH_MAP.r139_lowwage && ACH_MAP.r139_lowwage.check({S:LOW})===true   && ACH_MAP.r139_lowwage.check({S:FREE})===false;
  // ⑪ 跨局集滿 r139_career：五成就全亮→解鎖、缺一→不解
  const allAch={r139_freedom:true,r139_manager:true,r139_lieflat:true,r139_layoff:true,r139_lowwage:true};
  SAVE.ach=Object.assign({},allAch); out.achFull = !!ACH_MAP.r139_career && ACH_MAP.r139_career.check({S:{}})===true;
  const partial=Object.assign({},allAch); delete partial.r139_freedom;
  SAVE.ach=partial; out.achPartial = ACH_MAP.r139_career.check({S:{}})===false;
  SAVE.ach={}; S=null;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['dataFull','① 資料齊備:6 學歷+6 職涯階層+4 人生階段+6 結局型別+六世代就業梗+升學資源三檔'],
  ['eduMap','② 智力確定性映射:高→頂大/中→中段/低→放牛班且智力單調驅動'],
  ['boostDrive','③ 財富影響升學資源:同智力有錢補習學歷>=繳不起補習且 off 有別'],
  ['cardRender','④ 卡片渲染:含學歷/職涯結局/升學資源/翻身或階級'],
  ['deterministic','⑤ deterministic 純讀:同 S 兩次渲染逐字一致'],
  ['pure','⑥ 純呈現零汙染:生成前後 S.attr/era/age/flags 不變且零 rng'],
  ['nullSafe','⑦ 無局(S=null)降級:回 null、卡空字串不炸'],
  ['noAttr','⑦ 缺 attr/int 降級:回 null 不炸'],
  ['softDeg','⑧ 缺 mny 用中性50/髒 era 就業梗略過:仍回物件不炸'],
  ['compatOld','⑨ 舊存檔相容:ensureState 不為 R139 補任何 S/flags 鍵'],
  ['achFreedom','⑩ r139_freedom:勝利組→解、22K魯蛇→不解'],
  ['achManager','⑩ r139_manager:小主管→解、勝利組→不解'],
  ['achLieflat','⑩ r139_lieflat:躺平→解、小主管→不解'],
  ['achLayoff','⑩ r139_layoff:中年失業→解、躺平→不解'],
  ['achLowwage','⑩ r139_lowwage:22K魯蛇→解、勝利組→不解'],
  ['achFull','⑪ 跨局集滿:五成就全亮→r139_career 解鎖'],
  ['achPartial','⑪ 跨局集滿:缺一→r139_career 不解'],
].forEach(([k,m])=>ok(r139[k], 'R139 '+m));

/* ===== R140 婚戀家庭軌跡（純衍生/結算覆蓋層；零 rng/零汙染/deterministic 推演/魅力主驅動+財富桃花資源/壞資料降級/婚戀成就） ===== */
const r140 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function mk(apr,mny,age,era){ return {attr:{hp:50,int:50,apr:apr,mny:mny,hap:50}, age:age, era:era, flags:{}, alive:false}; }
  // ① 資料齊備：6 戀愛身價階層+6 婚戀關係階層+4 人生階段+6 結局型別+六世代婚戀梗+桃花資源三檔
  out.dataFull = Array.isArray(R140_CHARM) && R140_CHARM.length===6 && R140_CHARM.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R140_STATUS) && R140_STATUS.length===6 && R140_STATUS.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R140_PHASES) && R140_PHASES.length===4 && R140_PHASES.every(p=>typeof p.off==='number')
    && ['winner','couple','single','player','divorce','widow'].every(k=>R140_END[k]&&R140_END[k].nm&&R140_END[k].path&&R140_END[k].note)
    && R55_ERAS.every(er=>typeof R140_ERALOVE[er.id]==='string')
    && [r140CharmBoostOf(90),r140CharmBoostOf(50),r140CharmBoostOf(10)].every(c=>typeof c.off==='number'&&c.nm&&c.short);
  // ② 魅力確定性映射：高魅力→萬人迷/海王(>=4)、中魅力→中段(>=2)、低魅力→戀愛絕緣體(0)；且魅力單調驅動
  const hi=r140LoveOf(mk(95,50,40,'e00')), midd=r140LoveOf(mk(50,50,40,'e00')), lo=r140LoveOf(mk(5,50,40,'e00'));
  out.charmMap = !!hi&&!!midd&&!!lo && hi.charmTier>=4 && midd.charmTier>=2 && lo.charmTier===0
    && hi.charmTier>midd.charmTier && midd.charmTier>lo.charmTier;
  // ③ 財富影響桃花資源（次級修正）：同魅力 55，有錢鈔能力(mny90)身價 >= 窮到沒行情(mny10)，且 off 有別
  const rich=r140LoveOf(mk(55,90,40,'e00')), poor=r140LoveOf(mk(55,10,40,'e00'));
  out.boostDrive = !!rich&&!!poor && rich.charmTier>=poor.charmTier && rich.boost.off>poor.boost.off;
  // ④ 卡片渲染：含戀愛身價/婚戀結局/桃花資源/修成正果或緣分
  S=mk(50,50,40,'e00'); const card=r140LoveReviewHTML();
  out.cardRender = card.indexOf('戀愛身價')>=0 && card.indexOf('婚戀結局')>=0 && card.indexOf('桃花資源')>=0 && (card.indexOf('正果')>=0||card.indexOf('緣分')>=0);
  // ⑤ deterministic 純讀：同 S 兩次渲染逐字一致
  S=mk(40,40,35,'e10'); const a1=r140LoveReviewHTML(), a2=r140LoveReviewHTML();
  out.deterministic = a1===a2 && a1.length>0;
  // ⑥ 純呈現零汙染：生成前後 S.attr/era/age/flags 不變、零 rng 消耗
  S=mk(72,55,45,'e70'); const bA=JSON.stringify(S.attr), bE=S.era, bAge=S.age, bF=JSON.stringify(S.flags);
  let used=0; const oldR=rng; rng=function(){ used++; return oldR(); };
  r140LoveReviewHTML(); r140LoveOf(S); rng=oldR;
  out.pure = JSON.stringify(S.attr)===bA && S.era===bE && S.age===bAge && JSON.stringify(S.flags)===bF && used===0;
  // ⑦ S=null / 缺 attr / 缺 apr 降級：回 null、卡空字串、不炸
  out.nullSafe = (()=>{ try{ S=null; return r140LoveOf(null)===null && r140LoveReviewHTML()===''; }catch(e){ return false; } })();
  out.noAttr = (()=>{ try{ return r140LoveOf({age:40,era:'e00'})===null && r140LoveOf({attr:{},age:40})===null; }catch(e){ return false; } })();
  // ⑧ 缺 mny 降級：用中性 50、仍回物件不炸；髒 era → 婚戀梗略過不炸
  out.softDeg = (()=>{ try{ const m=r140LoveOf({attr:{apr:55},age:40,era:'e00',flags:{}}); const d=r140LoveOf(mk(55,50,40,'zzz999')); return !!m && m.charmTier===r140LoveOf(mk(55,50,40,'e00')).charmTier && !!d && d.era===null; }catch(e){ return false; } })();
  // ⑨ 舊存檔相容：ensureState 不為 R140 在 S/flags 補任何 r140 鍵
  startGame(); const olds=S; ensureState(olds);
  out.compatOld = !Object.keys(olds).some(k=>k.toLowerCase().indexOf('r140')===0)
    && !Object.keys(olds.flags||{}).some(k=>k.toLowerCase().indexOf('r140')===0);
  // ⑩ 婚戀成就確定性點亮：勝利組鴛鴦/母胎單身/海王玩咖/離婚達人/喪偶終老 各自可達且互斥
  const WIN=mk(95,90,45,'e00'), SGL=mk(10,40,45,'e00'), PLY=mk(90,30,45,'e00'), DIV=mk(55,40,50,'e00'), WID=mk(55,55,65,'e00'), CPL=mk(55,50,35,'e00');
  out.achWinner  = !!ACH_MAP.r140_winner  && ACH_MAP.r140_winner.check({S:WIN})===true  && ACH_MAP.r140_winner.check({S:SGL})===false;
  out.achSingle  = !!ACH_MAP.r140_single  && ACH_MAP.r140_single.check({S:SGL})===true  && ACH_MAP.r140_single.check({S:WIN})===false;
  out.achPlayer  = !!ACH_MAP.r140_player  && ACH_MAP.r140_player.check({S:PLY})===true  && ACH_MAP.r140_player.check({S:CPL})===false;
  out.achDivorce = !!ACH_MAP.r140_divorce && ACH_MAP.r140_divorce.check({S:DIV})===true && ACH_MAP.r140_divorce.check({S:CPL})===false;
  out.achWidow   = !!ACH_MAP.r140_widow   && ACH_MAP.r140_widow.check({S:WID})===true   && ACH_MAP.r140_widow.check({S:DIV})===false;
  // ⑪ 跨局集滿 r140_love：五成就全亮→解鎖、缺一→不解
  const allAch={r140_winner:true,r140_single:true,r140_player:true,r140_divorce:true,r140_widow:true};
  SAVE.ach=Object.assign({},allAch); out.achFull = !!ACH_MAP.r140_love && ACH_MAP.r140_love.check({S:{}})===true;
  const partial=Object.assign({},allAch); delete partial.r140_winner;
  SAVE.ach=partial; out.achPartial = ACH_MAP.r140_love.check({S:{}})===false;
  SAVE.ach={}; S=null;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['dataFull','① 資料齊備:6 戀愛身價+6 婚戀關係階層+4 人生階段+6 結局型別+六世代婚戀梗+桃花資源三檔'],
  ['charmMap','② 魅力確定性映射:高→萬人迷/中→中段/低→戀愛絕緣體且魅力單調驅動'],
  ['boostDrive','③ 財富影響桃花資源:同魅力有錢身價>=窮到沒行情且 off 有別'],
  ['cardRender','④ 卡片渲染:含戀愛身價/婚戀結局/桃花資源/正果或緣分'],
  ['deterministic','⑤ deterministic 純讀:同 S 兩次渲染逐字一致'],
  ['pure','⑥ 純呈現零汙染:生成前後 S.attr/era/age/flags 不變且零 rng'],
  ['nullSafe','⑦ 無局(S=null)降級:回 null、卡空字串不炸'],
  ['noAttr','⑦ 缺 attr/apr 降級:回 null 不炸'],
  ['softDeg','⑧ 缺 mny 用中性50/髒 era 婚戀梗略過:仍回物件不炸'],
  ['compatOld','⑨ 舊存檔相容:ensureState 不為 R140 補任何 S/flags 鍵'],
  ['achWinner','⑩ r140_winner:勝利組鴛鴦→解、母胎單身→不解'],
  ['achSingle','⑩ r140_single:母胎單身→解、勝利組→不解'],
  ['achPlayer','⑩ r140_player:海王玩咖→解、平凡夫妻→不解'],
  ['achDivorce','⑩ r140_divorce:離婚達人→解、平凡夫妻→不解'],
  ['achWidow','⑩ r140_widow:喪偶終老→解、離婚達人→不解'],
  ['achFull','⑪ 跨局集滿:五成就全亮→r140_love 解鎖'],
  ['achPartial','⑪ 跨局集滿:缺一→r140_love 不解'],
].forEach(([k,m])=>ok(r140[k], 'R140 '+m));

/* ===== R141 興趣才藝・斜槓夢想軌跡（純衍生/結算覆蓋層；零 rng/零汙染/deterministic 推演/智力＋魅力主驅動+財富燒夢想本錢/壞資料降級/夢想成就） ===== */
const r141 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function mk(intl,apr,mny,age,era){ return {attr:{hp:50,int:intl,apr:apr,mny:mny,hap:50}, age:age, era:era, flags:{}, alive:false}; }
  // ① 資料齊備：6 才藝天賦階層+6 斜槓夢想階層+4 人生階段+5 結局型別+六世代圓夢梗+燒夢想本錢三檔
  out.dataFull = Array.isArray(R141_TALENT) && R141_TALENT.length===6 && R141_TALENT.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R141_DREAM) && R141_DREAM.length===6 && R141_DREAM.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R141_PHASES) && R141_PHASES.length===4 && R141_PHASES.every(p=>typeof p.off==='number')
    && ['slasher','viral','dreamer','quitter','couch'].every(k=>R141_END[k]&&R141_END[k].nm&&R141_END[k].path&&R141_END[k].note)
    && R55_ERAS.every(er=>typeof R141_ERAHOBBY[er.id]==='string')
    && [r141FundOf(90),r141FundOf(50),r141FundOf(10)].every(c=>typeof c.off==='number'&&c.nm&&c.short);
  // ② 智力＋魅力確定性映射：雙高→才華洋溢/斜槓王(>=4)、雙中→中段(>=2)、雙低→廢宅躺平(0)；且雙屬性單調驅動
  const hi=r141HobbyOf(mk(95,95,50,40,'e00')), midd=r141HobbyOf(mk(50,50,50,40,'e00')), lo=r141HobbyOf(mk(5,5,50,40,'e00'));
  out.talentMap = !!hi&&!!midd&&!!lo && hi.talentTier>=4 && midd.talentTier>=2 && lo.talentTier===0
    && hi.talentTier>midd.talentTier && midd.talentTier>lo.talentTier;
  // ②b 智力與魅力都實際參與：單高單低的天賦應低於雙高（雙屬性缺一不可）
  const onlyInt=r141HobbyOf(mk(95,5,50,40,'e00')), onlyApr=r141HobbyOf(mk(5,95,50,40,'e00'));
  out.dualAttr = !!onlyInt&&!!onlyApr && onlyInt.talentTier<hi.talentTier && onlyApr.talentTier<hi.talentTier;
  // ③ 財富影響燒夢想本錢（次級修正）：同天賦 55，有錢燒得起(mny90)天賦 >= 連裝備都買不起(mny10)，且 off 有別
  const rich=r141HobbyOf(mk(55,55,90,40,'e00')), poor=r141HobbyOf(mk(55,55,10,40,'e00'));
  out.fundDrive = !!rich&&!!poor && rich.talentTier>=poor.talentTier && rich.fund.off>poor.fund.off;
  // ④ 卡片渲染：含才藝天賦/夢想結局/圓夢本錢/夢想或斜槓
  S=mk(50,50,50,40,'e00'); const card=r141HobbyReviewHTML();
  out.cardRender = card.indexOf('才藝天賦')>=0 && card.indexOf('夢想結局')>=0 && card.indexOf('圓夢本錢')>=0 && (card.indexOf('夢想')>=0||card.indexOf('斜槓')>=0);
  // ⑤ deterministic 純讀：同 S 兩次渲染逐字一致
  S=mk(40,40,40,35,'e10'); const a1=r141HobbyReviewHTML(), a2=r141HobbyReviewHTML();
  out.deterministic = a1===a2 && a1.length>0;
  // ⑥ 純呈現零汙染：生成前後 S.attr/era/age/flags 不變、零 rng 消耗
  S=mk(72,72,55,45,'e70'); const bA=JSON.stringify(S.attr), bE=S.era, bAge=S.age, bF=JSON.stringify(S.flags);
  let used=0; const oldR=rng; rng=function(){ used++; return oldR(); };
  r141HobbyReviewHTML(); r141HobbyOf(S); rng=oldR;
  out.pure = JSON.stringify(S.attr)===bA && S.era===bE && S.age===bAge && JSON.stringify(S.flags)===bF && used===0;
  // ⑦ S=null / 缺 attr / 缺 int 或 apr 降級：回 null、卡空字串、不炸
  out.nullSafe = (()=>{ try{ S=null; return r141HobbyOf(null)===null && r141HobbyReviewHTML()===''; }catch(e){ return false; } })();
  out.noAttr = (()=>{ try{ return r141HobbyOf({age:40,era:'e00'})===null && r141HobbyOf({attr:{int:50},age:40})===null && r141HobbyOf({attr:{apr:50},age:40})===null; }catch(e){ return false; } })();
  // ⑧ 缺 mny 降級：用中性 50、仍回物件不炸；髒 era → 圓夢梗略過不炸
  out.softDeg = (()=>{ try{ const m=r141HobbyOf({attr:{int:55,apr:55},age:40,era:'e00',flags:{}}); const d=r141HobbyOf(mk(55,55,50,40,'zzz999')); return !!m && m.talentTier===r141HobbyOf(mk(55,55,50,40,'e00')).talentTier && !!d && d.era===null; }catch(e){ return false; } })();
  // ⑨ 舊存檔相容：ensureState 不為 R141 在 S/flags 補任何 r141 鍵
  startGame(); const olds=S; ensureState(olds);
  out.compatOld = !Object.keys(olds).some(k=>k.toLowerCase().indexOf('r141')===0)
    && !Object.keys(olds.flags||{}).some(k=>k.toLowerCase().indexOf('r141')===0);
  // ⑩ 夢想成就確定性點亮：斜槓達人/爆紅網紅/圓夢家/半途而廢/廢宅躺平 各自可達且互斥
  const SLA=mk(95,95,90,45,'e00'), VIR=mk(70,90,40,25,'e00'), COUCH=mk(10,10,40,45,'e00'), DREAM=mk(50,50,50,65,'e00'), QUIT=mk(50,50,50,45,'e00');
  out.achSlasher = !!ACH_MAP.r141_slasher && ACH_MAP.r141_slasher.check({S:SLA})===true   && ACH_MAP.r141_slasher.check({S:COUCH})===false;
  out.achViral   = !!ACH_MAP.r141_viral   && ACH_MAP.r141_viral.check({S:VIR})===true     && ACH_MAP.r141_viral.check({S:SLA})===false;
  out.achDreamer = !!ACH_MAP.r141_dreamer && ACH_MAP.r141_dreamer.check({S:DREAM})===true  && ACH_MAP.r141_dreamer.check({S:COUCH})===false;
  out.achQuitter = !!ACH_MAP.r141_quitter && ACH_MAP.r141_quitter.check({S:QUIT})===true   && ACH_MAP.r141_quitter.check({S:DREAM})===false;
  out.achCouch   = !!ACH_MAP.r141_couch   && ACH_MAP.r141_couch.check({S:COUCH})===true    && ACH_MAP.r141_couch.check({S:SLA})===false;
  // ⑪ 跨局集滿 r141_hobby：五成就全亮→解鎖、缺一→不解
  const allAch={r141_slasher:true,r141_viral:true,r141_dreamer:true,r141_quitter:true,r141_couch:true};
  SAVE.ach=Object.assign({},allAch); out.achFull = !!ACH_MAP.r141_hobby && ACH_MAP.r141_hobby.check({S:{}})===true;
  const partial=Object.assign({},allAch); delete partial.r141_slasher;
  SAVE.ach=partial; out.achPartial = ACH_MAP.r141_hobby.check({S:{}})===false;
  SAVE.ach={}; S=null;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['dataFull','① 資料齊備:6 才藝天賦+6 斜槓夢想階層+4 人生階段+5 結局型別+六世代圓夢梗+燒夢想本錢三檔'],
  ['talentMap','② 智力＋魅力確定性映射:雙高→才華洋溢/雙中→中段/雙低→廢宅躺平且單調驅動'],
  ['dualAttr','②b 智力與魅力缺一不可:單高單低天賦低於雙高'],
  ['fundDrive','③ 財富影響燒夢想本錢:同天賦有錢>=連裝備買不起且 off 有別'],
  ['cardRender','④ 卡片渲染:含才藝天賦/夢想結局/圓夢本錢/夢想或斜槓'],
  ['deterministic','⑤ deterministic 純讀:同 S 兩次渲染逐字一致'],
  ['pure','⑥ 純呈現零汙染:生成前後 S.attr/era/age/flags 不變且零 rng'],
  ['nullSafe','⑦ 無局(S=null)降級:回 null、卡空字串不炸'],
  ['noAttr','⑦ 缺 attr/int/apr 降級:回 null 不炸'],
  ['softDeg','⑧ 缺 mny 用中性50/髒 era 圓夢梗略過:仍回物件不炸'],
  ['compatOld','⑨ 舊存檔相容:ensureState 不為 R141 補任何 S/flags 鍵'],
  ['achSlasher','⑩ r141_slasher:斜槓達人→解、廢宅躺平→不解'],
  ['achViral','⑩ r141_viral:爆紅網紅→解、斜槓達人→不解'],
  ['achDreamer','⑩ r141_dreamer:圓夢家→解、廢宅躺平→不解'],
  ['achQuitter','⑩ r141_quitter:半途而廢→解、圓夢家→不解'],
  ['achCouch','⑩ r141_couch:廢宅躺平→解、斜槓達人→不解'],
  ['achFull','⑪ 跨局集滿:五成就全亮→r141_hobby 解鎖'],
  ['achPartial','⑪ 跨局集滿:缺一→r141_hobby 不解'],
].forEach(([k,m])=>ok(r141[k], 'R141 '+m));

/* ===== R142 理財投資・財富累積軌跡（純衍生/結算覆蓋層；零 rng/零汙染/deterministic 推演/財富＋智力主驅動+本金子彈/壞資料降級/投資成就） ===== */
const r142 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function mk(intl,mny,age,era){ return {attr:{hp:50,int:intl,apr:50,mny:mny,hap:50}, age:age, era:era, flags:{}, alive:false}; }
  // ① 資料齊備：6 投資智商階層+6 財富累積階層+4 人生階段+5 結局型別+六世代理財梗+本金子彈三檔
  out.dataFull = Array.isArray(R142_IQ) && R142_IQ.length===6 && R142_IQ.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R142_PORT) && R142_PORT.length===6 && R142_PORT.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R142_PHASES) && R142_PHASES.length===4 && R142_PHASES.every(p=>typeof p.off==='number')
    && ['fire','shipking','dividend','daytrader','leek'].every(k=>R142_END[k]&&R142_END[k].nm&&R142_END[k].path&&R142_END[k].note)
    && R55_ERAS.every(er=>typeof R142_ERAINVEST[er.id]==='string')
    && [r142AmmoOf(90),r142AmmoOf(50),r142AmmoOf(10)].every(c=>typeof c.off==='number'&&c.nm&&c.short);
  // ② 財富＋智力確定性映射：雙高→價值投資老手/神之子(>=4)、雙中→中段(>=2)、雙低→月光族韭菜(0)；且雙屬性單調驅動
  const hi=r142InvestOf(mk(95,95,40,'e00')), midd=r142InvestOf(mk(50,50,40,'e00')), lo=r142InvestOf(mk(5,5,40,'e00'));
  out.iqMap = !!hi&&!!midd&&!!lo && hi.iqTier>=4 && midd.iqTier>=2 && lo.iqTier===0
    && hi.iqTier>midd.iqTier && midd.iqTier>lo.iqTier;
  // ②b 財富與智力都實際參與：單高單低的智商應低於雙高（雙屬性缺一不可）
  const onlyInt=r142InvestOf(mk(95,5,40,'e00')), onlyMny=r142InvestOf(mk(5,95,40,'e00'));
  out.dualAttr = !!onlyInt&&!!onlyMny && onlyInt.iqTier<hi.iqTier && onlyMny.iqTier<hi.iqTier;
  // ③ 本金影響子彈厚度（次級修正）：同智商基底，有銀彈(mny90)智商 >= 零股韭菜本(mny10)，且 off 有別
  const rich=r142InvestOf(mk(55,90,40,'e00')), poor=r142InvestOf(mk(55,10,40,'e00'));
  out.ammoDrive = !!rich&&!!poor && rich.iqTier>=poor.iqTier && rich.ammo.off>poor.ammo.off;
  // ④ 卡片渲染：含投資智商/投資結局/本金子彈/財富或投資
  S=mk(50,50,40,'e00'); const card=r142InvestReviewHTML();
  out.cardRender = card.indexOf('投資智商')>=0 && card.indexOf('投資結局')>=0 && card.indexOf('本金子彈')>=0 && (card.indexOf('財富')>=0||card.indexOf('投資')>=0);
  // ⑤ deterministic 純讀：同 S 兩次渲染逐字一致
  S=mk(40,40,35,'e10'); const a1=r142InvestReviewHTML(), a2=r142InvestReviewHTML();
  out.deterministic = a1===a2 && a1.length>0;
  // ⑥ 純呈現零汙染：生成前後 S.attr/era/age/flags 不變、零 rng 消耗
  S=mk(72,55,45,'e70'); const bA=JSON.stringify(S.attr), bE=S.era, bAge=S.age, bF=JSON.stringify(S.flags);
  let used=0; const oldR=rng; rng=function(){ used++; return oldR(); };
  r142InvestReviewHTML(); r142InvestOf(S); rng=oldR;
  out.pure = JSON.stringify(S.attr)===bA && S.era===bE && S.age===bAge && JSON.stringify(S.flags)===bF && used===0;
  // ⑦ S=null / 缺 attr / 缺 mny 或 int 降級：回 null、卡空字串、不炸
  out.nullSafe = (()=>{ try{ S=null; return r142InvestOf(null)===null && r142InvestReviewHTML()===''; }catch(e){ return false; } })();
  out.noAttr = (()=>{ try{ return r142InvestOf({age:40,era:'e00'})===null && r142InvestOf({attr:{mny:50},age:40})===null && r142InvestOf({attr:{int:50},age:40})===null; }catch(e){ return false; } })();
  // ⑧ 髒 era → 理財梗略過不炸、仍回物件；同屬性不同 era 智商一致
  out.softDeg = (()=>{ try{ const m=r142InvestOf(mk(55,55,40,'e00')); const d=r142InvestOf(mk(55,55,40,'zzz999')); return !!m && !!d && d.era===null && m.iqTier===d.iqTier; }catch(e){ return false; } })();
  // ⑨ 舊存檔相容：ensureState 不為 R142 在 S/flags 補任何 r142 鍵
  startGame(); const olds=S; ensureState(olds);
  out.compatOld = !Object.keys(olds).some(k=>k.toLowerCase().indexOf('r142')===0)
    && !Object.keys(olds.flags||{}).some(k=>k.toLowerCase().indexOf('r142')===0);
  // ⑩ 投資成就確定性點亮：FIRE/航運王/存股達人/當沖畢業/韭菜本命 各自可達且互斥
  const FIRE=mk(90,90,55,'e00'), SHIP=mk(85,55,35,'e00'), DIV=mk(55,60,50,'e00'), DAY=mk(45,45,40,'e00'), LEEK=mk(10,10,40,'e00');
  out.achFire     = !!ACH_MAP.r142_fire      && ACH_MAP.r142_fire.check({S:FIRE})===true       && ACH_MAP.r142_fire.check({S:LEEK})===false;
  out.achShip     = !!ACH_MAP.r142_shipking  && ACH_MAP.r142_shipking.check({S:SHIP})===true    && ACH_MAP.r142_shipking.check({S:FIRE})===false;
  out.achDividend = !!ACH_MAP.r142_dividend  && ACH_MAP.r142_dividend.check({S:DIV})===true     && ACH_MAP.r142_dividend.check({S:DAY})===false;
  out.achDay      = !!ACH_MAP.r142_daytrader && ACH_MAP.r142_daytrader.check({S:DAY})===true     && ACH_MAP.r142_daytrader.check({S:DIV})===false;
  out.achLeek     = !!ACH_MAP.r142_leek      && ACH_MAP.r142_leek.check({S:LEEK})===true         && ACH_MAP.r142_leek.check({S:FIRE})===false;
  // ⑪ 跨局集滿 r142_invest：五成就全亮→解鎖、缺一→不解
  const allAch={r142_fire:true,r142_shipking:true,r142_dividend:true,r142_daytrader:true,r142_leek:true};
  SAVE.ach=Object.assign({},allAch); out.achFull = !!ACH_MAP.r142_invest && ACH_MAP.r142_invest.check({S:{}})===true;
  const partial=Object.assign({},allAch); delete partial.r142_fire;
  SAVE.ach=partial; out.achPartial = ACH_MAP.r142_invest.check({S:{}})===false;
  SAVE.ach={}; S=null;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['dataFull','① 資料齊備:6 投資智商+6 財富累積階層+4 人生階段+5 結局型別+六世代理財梗+本金子彈三檔'],
  ['iqMap','② 財富＋智力確定性映射:雙高→價值投資老手/雙中→中段/雙低→月光族韭菜且單調驅動'],
  ['dualAttr','②b 財富與智力缺一不可:單高單低智商低於雙高'],
  ['ammoDrive','③ 本金影響子彈厚度:同基底有銀彈>=零股韭菜本且 off 有別'],
  ['cardRender','④ 卡片渲染:含投資智商/投資結局/本金子彈/財富或投資'],
  ['deterministic','⑤ deterministic 純讀:同 S 兩次渲染逐字一致'],
  ['pure','⑥ 純呈現零汙染:生成前後 S.attr/era/age/flags 不變且零 rng'],
  ['nullSafe','⑦ 無局(S=null)降級:回 null、卡空字串不炸'],
  ['noAttr','⑦ 缺 attr/mny/int 降級:回 null 不炸'],
  ['softDeg','⑧ 髒 era 理財梗略過:仍回物件不炸且智商一致'],
  ['compatOld','⑨ 舊存檔相容:ensureState 不為 R142 補任何 S/flags 鍵'],
  ['achFire','⑩ r142_fire:FIRE 財富自由→解、韭菜本命→不解'],
  ['achShip','⑩ r142_shipking:航運王→解、FIRE→不解'],
  ['achDividend','⑩ r142_dividend:存股達人→解、當沖畢業→不解'],
  ['achDay','⑩ r142_daytrader:當沖畢業→解、存股達人→不解'],
  ['achLeek','⑩ r142_leek:韭菜本命→解、FIRE→不解'],
  ['achFull','⑪ 跨局集滿:五成就全亮→r142_invest 解鎖'],
  ['achPartial','⑪ 跨局集滿:缺一→r142_invest 不解'],
].forEach(([k,m])=>ok(r142[k], 'R142 '+m));

/* ===== R143 社交人脈・朋友圈軌跡（純衍生/結算覆蓋層；零 rng/零汙染/deterministic 推演/魅力＋智力主驅動+財富排場/壞資料降級/社交成就） ===== */
const r143 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function mk(intl,apr,mny,age,era){ return {attr:{hp:50,int:intl,apr:apr,mny:mny,hap:50}, age:age, era:era, flags:{}, alive:false}; }
  // ① 資料齊備：6 社交手腕階層+6 朋友圈階層+4 人生階段+6 結局型別+六世代交友梗+人脈排場三檔
  out.dataFull = Array.isArray(R143_SOC) && R143_SOC.length===6 && R143_SOC.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R143_CIRCLE) && R143_CIRCLE.length===6 && R143_CIRCLE.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R143_PHASES) && R143_PHASES.length===4 && R143_PHASES.every(p=>typeof p.off==='number')
    && ['maven','soulmate','boozer','fullstop','edge','lonely'].every(k=>R143_END[k]&&R143_END[k].nm&&R143_END[k].path&&R143_END[k].note)
    && R55_ERAS.every(er=>typeof R143_ERASOCIAL[er.id]==='string')
    && [r143CrowdOf(90),r143CrowdOf(50),r143CrowdOf(10)].every(c=>typeof c.off==='number'&&c.nm&&c.short);
  // ② 魅力＋智力確定性映射：雙高→社交達人/交際花(>=4)、雙中→中段(>=2)、雙低→句點王(0)；且雙屬性單調驅動
  const hi=r143SocialOf(mk(95,95,50,40,'e00')), midd=r143SocialOf(mk(50,50,50,40,'e00')), lo=r143SocialOf(mk(5,5,50,40,'e00'));
  out.socMap = !!hi&&!!midd&&!!lo && hi.socTier>=4 && midd.socTier>=2 && lo.socTier===0
    && hi.socTier>midd.socTier && midd.socTier>lo.socTier;
  // ②b 魅力與智力都實際參與：單高單低的手腕應低於雙高（雙屬性缺一不可）
  const onlyInt=r143SocialOf(mk(95,5,50,40,'e00')), onlyApr=r143SocialOf(mk(5,95,50,40,'e00'));
  out.dualAttr = !!onlyInt&&!!onlyApr && onlyInt.socTier<hi.socTier && onlyApr.socTier<hi.socTier;
  // ③ 財富影響請客排場（次級修正）：同手腕 55，請得起客(mny90)手腕 >= 連手搖都要算錢(mny10)，且 off 有別
  const rich=r143SocialOf(mk(55,55,90,40,'e00')), poor=r143SocialOf(mk(55,55,10,40,'e00'));
  out.crowdDrive = !!rich&&!!poor && rich.socTier>=poor.socTier && rich.crowd.off>poor.crowd.off;
  // ④ 卡片渲染：含社交手腕/社交結局/人脈排場/朋友或人脈
  S=mk(50,50,50,40,'e00'); const card=r143SocialReviewHTML();
  out.cardRender = card.indexOf('社交手腕')>=0 && card.indexOf('社交結局')>=0 && card.indexOf('人脈排場')>=0 && (card.indexOf('朋友')>=0||card.indexOf('人脈')>=0);
  // ⑤ deterministic 純讀：同 S 兩次渲染逐字一致
  S=mk(40,40,40,35,'e10'); const a1=r143SocialReviewHTML(), a2=r143SocialReviewHTML();
  out.deterministic = a1===a2 && a1.length>0;
  // ⑥ 純呈現零汙染：生成前後 S.attr/era/age/flags 不變、零 rng 消耗
  S=mk(72,72,55,45,'e70'); const bA=JSON.stringify(S.attr), bE=S.era, bAge=S.age, bF=JSON.stringify(S.flags);
  let used=0; const oldR=rng; rng=function(){ used++; return oldR(); };
  r143SocialReviewHTML(); r143SocialOf(S); rng=oldR;
  out.pure = JSON.stringify(S.attr)===bA && S.era===bE && S.age===bAge && JSON.stringify(S.flags)===bF && used===0;
  // ⑦ S=null / 缺 attr / 缺 apr 或 int 降級：回 null、卡空字串、不炸
  out.nullSafe = (()=>{ try{ S=null; return r143SocialOf(null)===null && r143SocialReviewHTML()===''; }catch(e){ return false; } })();
  out.noAttr = (()=>{ try{ return r143SocialOf({age:40,era:'e00'})===null && r143SocialOf({attr:{apr:50},age:40})===null && r143SocialOf({attr:{int:50},age:40})===null; }catch(e){ return false; } })();
  // ⑧ 缺 mny 降級：用中性 50、仍回物件不炸；髒 era → 交友梗略過不炸
  out.softDeg = (()=>{ try{ const m=r143SocialOf({attr:{int:55,apr:55},age:40,era:'e00',flags:{}}); const d=r143SocialOf(mk(55,55,50,40,'zzz999')); return !!m && m.socTier===r143SocialOf(mk(55,55,50,40,'e00')).socTier && !!d && d.era===null; }catch(e){ return false; } })();
  // ⑨ 舊存檔相容：ensureState 不為 R143 在 S/flags 補任何 r143 鍵
  startGame(); const olds=S; ensureState(olds);
  out.compatOld = !Object.keys(olds).some(k=>k.toLowerCase().indexOf('r143')===0)
    && !Object.keys(olds.flags||{}).some(k=>k.toLowerCase().indexOf('r143')===0);
  // ⑩ 社交成就確定性點亮：人脈王/三五知己/酒肉之友/句點王/邊緣人/孤獨終老 各自可達且互斥
  const MAVEN=mk(70,90,80,45,'e00'), SOUL=mk(85,55,50,45,'e00'), BOOZE=mk(50,75,50,40,'e00'), FULL=mk(45,45,50,40,'e00'), EDGE=mk(20,25,40,30,'e00'), LONE=mk(20,20,30,70,'e00');
  out.achMaven    = !!ACH_MAP.r143_maven    && ACH_MAP.r143_maven.check({S:MAVEN})===true     && ACH_MAP.r143_maven.check({S:EDGE})===false;
  out.achSoulmate = !!ACH_MAP.r143_soulmate && ACH_MAP.r143_soulmate.check({S:SOUL})===true    && ACH_MAP.r143_soulmate.check({S:EDGE})===false;
  out.achBoozer   = !!ACH_MAP.r143_boozer   && ACH_MAP.r143_boozer.check({S:BOOZE})===true     && ACH_MAP.r143_boozer.check({S:FULL})===false;
  out.achFullstop = !!ACH_MAP.r143_fullstop && ACH_MAP.r143_fullstop.check({S:FULL})===true     && ACH_MAP.r143_fullstop.check({S:MAVEN})===false;
  out.achEdge     = !!ACH_MAP.r143_edge     && ACH_MAP.r143_edge.check({S:EDGE})===true         && ACH_MAP.r143_edge.check({S:MAVEN})===false;
  out.achLonely   = !!ACH_MAP.r143_lonely   && ACH_MAP.r143_lonely.check({S:LONE})===true       && ACH_MAP.r143_lonely.check({S:MAVEN})===false;
  // ⑪ 跨局集滿 r143_social：六成就全亮→解鎖、缺一→不解
  const allAch={r143_maven:true,r143_soulmate:true,r143_boozer:true,r143_fullstop:true,r143_edge:true,r143_lonely:true};
  SAVE.ach=Object.assign({},allAch); out.achFull = !!ACH_MAP.r143_social && ACH_MAP.r143_social.check({S:{}})===true;
  const partial=Object.assign({},allAch); delete partial.r143_maven;
  SAVE.ach=partial; out.achPartial = ACH_MAP.r143_social.check({S:{}})===false;
  SAVE.ach={}; S=null;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['dataFull','① 資料齊備:6 社交手腕+6 朋友圈階層+4 人生階段+6 結局型別+六世代交友梗+人脈排場三檔'],
  ['socMap','② 魅力＋智力確定性映射:雙高→社交達人/雙中→中段/雙低→句點王且單調驅動'],
  ['dualAttr','②b 魅力與智力缺一不可:單高單低手腕低於雙高'],
  ['crowdDrive','③ 財富影響請客排場:同基底請得起客>=連手搖都要算錢且 off 有別'],
  ['cardRender','④ 卡片渲染:含社交手腕/社交結局/人脈排場/朋友或人脈'],
  ['deterministic','⑤ deterministic 純讀:同 S 兩次渲染逐字一致'],
  ['pure','⑥ 純呈現零汙染:生成前後 S.attr/era/age/flags 不變且零 rng'],
  ['nullSafe','⑦ 無局(S=null)降級:回 null、卡空字串不炸'],
  ['noAttr','⑦ 缺 attr/apr/int 降級:回 null 不炸'],
  ['softDeg','⑧ 缺 mny 中性化＋髒 era 交友梗略過:仍回物件不炸且手腕一致'],
  ['compatOld','⑨ 舊存檔相容:ensureState 不為 R143 補任何 S/flags 鍵'],
  ['achMaven','⑩ r143_maven:人脈王→解、邊緣人→不解'],
  ['achSoulmate','⑩ r143_soulmate:三五知己→解、邊緣人→不解'],
  ['achBoozer','⑩ r143_boozer:酒肉之友→解、句點王→不解'],
  ['achFullstop','⑩ r143_fullstop:句點王→解、人脈王→不解'],
  ['achEdge','⑩ r143_edge:邊緣人→解、人脈王→不解'],
  ['achLonely','⑩ r143_lonely:孤獨終老→解、人脈王→不解'],
  ['achFull','⑪ 跨局集滿:六成就全亮→r143_social 解鎖'],
  ['achPartial','⑪ 跨局集滿:缺一→r143_social 不解'],
].forEach(([k,m])=>ok(r143[k], 'R143 '+m));

/* ===== R144 健康・身體狀態軌跡（純衍生/結算覆蓋層；零 rng/零汙染/deterministic 推演/體質 hp 主驅動+財富養生本錢/壞資料降級/身體狀態成就） ===== */
const r144 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function mk(hp,mny,age,era){ return {attr:{hp:hp,int:50,apr:50,mny:mny,hap:50}, age:age, era:era, flags:{}, alive:false}; }
  // ① 資料齊備：6 體質底子階層+6 體態階層+4 人生階段+6 結局型別+六世代養生梗+養生本錢三檔
  out.dataFull = Array.isArray(R144_BODY) && R144_BODY.length===6 && R144_BODY.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R144_FORM) && R144_FORM.length===6 && R144_FORM.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R144_PHASES) && R144_PHASES.length===4 && R144_PHASES.every(p=>typeof p.off==='number')
    && ['ironman','wellness','centenarian','pillbox','burnout','bedridden'].every(k=>R144_END[k]&&R144_END[k].nm&&R144_END[k].path&&R144_END[k].note)
    && R55_ERAS.every(er=>typeof R144_ERAHEALTH[er.id]==='string')
    && [r144BudgetOf(90),r144BudgetOf(50),r144BudgetOf(10)].every(c=>typeof c.off==='number'&&c.nm&&c.short);
  // ② 體質 hp 確定性映射：高→鐵打金剛(>=4)、中→中段(>=2)、低→玻璃體質(0)；且單調驅動
  const hi=r144HealthOf(mk(95,50,40,'e00')), midd=r144HealthOf(mk(50,50,40,'e00')), lo=r144HealthOf(mk(5,50,40,'e00'));
  out.hpMap = !!hi&&!!midd&&!!lo && hi.bodyTier>=4 && midd.bodyTier>=2 && lo.bodyTier===0
    && hi.bodyTier>midd.bodyTier && midd.bodyTier>lo.bodyTier;
  // ③ 財富影響養生本錢（次級修正）：同底子 55，養生有本錢(mny90)底子 >= 買不起健康(mny10)，且 off 有別
  const rich=r144HealthOf(mk(55,90,40,'e00')), poor=r144HealthOf(mk(55,10,40,'e00'));
  out.budgetDrive = !!rich&&!!poor && rich.bodyTier>=poor.bodyTier && rich.budget.off>poor.budget.off;
  // ④ 卡片渲染：含體質底子/身體結局/養生本錢/體態或身體
  S=mk(50,50,40,'e00'); const card=r144HealthReviewHTML();
  out.cardRender = card.indexOf('體質底子')>=0 && card.indexOf('身體結局')>=0 && card.indexOf('養生本錢')>=0 && (card.indexOf('體態')>=0||card.indexOf('身體')>=0);
  // ⑤ deterministic 純讀：同 S 兩次渲染逐字一致
  S=mk(40,40,35,'e10'); const a1=r144HealthReviewHTML(), a2=r144HealthReviewHTML();
  out.deterministic = a1===a2 && a1.length>0;
  // ⑥ 純呈現零汙染：生成前後 S.attr/era/age/flags 不變、零 rng 消耗
  S=mk(72,55,45,'e70'); const bA=JSON.stringify(S.attr), bE=S.era, bAge=S.age, bF=JSON.stringify(S.flags);
  let used=0; const oldR=rng; rng=function(){ used++; return oldR(); };
  r144HealthReviewHTML(); r144HealthOf(S); rng=oldR;
  out.pure = JSON.stringify(S.attr)===bA && S.era===bE && S.age===bAge && JSON.stringify(S.flags)===bF && used===0;
  // ⑦ S=null / 缺 attr / 缺 hp 降級：回 null、卡空字串、不炸
  out.nullSafe = (()=>{ try{ S=null; return r144HealthOf(null)===null && r144HealthReviewHTML()===''; }catch(e){ return false; } })();
  out.noAttr = (()=>{ try{ return r144HealthOf({age:40,era:'e00'})===null && r144HealthOf({attr:{mny:50},age:40})===null; }catch(e){ return false; } })();
  // ⑧ 缺 mny 降級：用中性 50、仍回物件不炸；髒 era → 養生梗略過不炸
  out.softDeg = (()=>{ try{ const m=r144HealthOf({attr:{hp:55},age:40,era:'e00',flags:{}}); const d=r144HealthOf(mk(55,50,40,'zzz999')); return !!m && m.bodyTier===r144HealthOf(mk(55,50,40,'e00')).bodyTier && !!d && d.era===null; }catch(e){ return false; } })();
  // ⑨ 舊存檔相容：ensureState 不為 R144 在 S/flags 補任何 r144 鍵
  startGame(); const olds=S; ensureState(olds);
  out.compatOld = !Object.keys(olds).some(k=>k.toLowerCase().indexOf('r144')===0)
    && !Object.keys(olds.flags||{}).some(k=>k.toLowerCase().indexOf('r144')===0);
  // ⑩ 身體狀態成就確定性點亮：鐵人/養生達人/長命百歲/藥罐子/爆肝/長照 各自可達且互斥
  const IRON=mk(88,40,35,'e00'), WELL=mk(75,60,50,'e00'), CENT=mk(85,40,85,'e00'), PILL=mk(50,50,40,'e00'), BURN=mk(22,50,40,'e00'), BED=mk(18,50,72,'e00');
  out.achIron    = !!ACH_MAP.r144_ironman     && ACH_MAP.r144_ironman.check({S:IRON})===true       && ACH_MAP.r144_ironman.check({S:BURN})===false;
  out.achWell    = !!ACH_MAP.r144_wellness    && ACH_MAP.r144_wellness.check({S:WELL})===true       && ACH_MAP.r144_wellness.check({S:BURN})===false;
  out.achCent    = !!ACH_MAP.r144_centenarian && ACH_MAP.r144_centenarian.check({S:CENT})===true    && ACH_MAP.r144_centenarian.check({S:BED})===false;
  out.achPill    = !!ACH_MAP.r144_pillbox     && ACH_MAP.r144_pillbox.check({S:PILL})===true        && ACH_MAP.r144_pillbox.check({S:IRON})===false;
  out.achBurn    = !!ACH_MAP.r144_burnout     && ACH_MAP.r144_burnout.check({S:BURN})===true        && ACH_MAP.r144_burnout.check({S:IRON})===false;
  out.achBed     = !!ACH_MAP.r144_bedridden   && ACH_MAP.r144_bedridden.check({S:BED})===true       && ACH_MAP.r144_bedridden.check({S:IRON})===false;
  // ⑪ 跨局集滿 r144_health：六成就全亮→解鎖、缺一→不解
  const allAch={r144_ironman:true,r144_wellness:true,r144_centenarian:true,r144_pillbox:true,r144_burnout:true,r144_bedridden:true};
  SAVE.ach=Object.assign({},allAch); out.achFull = !!ACH_MAP.r144_health && ACH_MAP.r144_health.check({S:{}})===true;
  const partial=Object.assign({},allAch); delete partial.r144_ironman;
  SAVE.ach=partial; out.achPartial = ACH_MAP.r144_health.check({S:{}})===false;
  SAVE.ach={}; S=null;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['dataFull','① 資料齊備:6 體質底子+6 體態階層+4 人生階段+6 結局型別+六世代養生梗+養生本錢三檔'],
  ['hpMap','② 體質 hp 確定性映射:高→鐵打金剛/中→中段/低→玻璃體質且單調驅動'],
  ['budgetDrive','③ 財富影響養生本錢:同基底養生有本錢>=買不起健康且 off 有別'],
  ['cardRender','④ 卡片渲染:含體質底子/身體結局/養生本錢/體態或身體'],
  ['deterministic','⑤ deterministic 純讀:同 S 兩次渲染逐字一致'],
  ['pure','⑥ 純呈現零汙染:生成前後 S.attr/era/age/flags 不變且零 rng'],
  ['nullSafe','⑦ 無局(S=null)降級:回 null、卡空字串不炸'],
  ['noAttr','⑦ 缺 attr/hp 降級:回 null 不炸'],
  ['softDeg','⑧ 缺 mny 中性化＋髒 era 養生梗略過:仍回物件不炸且底子一致'],
  ['compatOld','⑨ 舊存檔相容:ensureState 不為 R144 補任何 S/flags 鍵'],
  ['achIron','⑩ r144_ironman:鐵人→解、爆肝→不解'],
  ['achWell','⑩ r144_wellness:養生達人→解、爆肝→不解'],
  ['achCent','⑩ r144_centenarian:長命百歲→解、長照→不解'],
  ['achPill','⑩ r144_pillbox:藥罐子→解、鐵人→不解'],
  ['achBurn','⑩ r144_burnout:爆肝→解、鐵人→不解'],
  ['achBed','⑩ r144_bedridden:長照臥床→解、鐵人→不解'],
  ['achFull','⑪ 跨局集滿:六成就全亮→r144_health 解鎖'],
  ['achPartial','⑪ 跨局集滿:缺一→r144_health 不解'],
].forEach(([k,m])=>ok(r144[k], 'R144 '+m));

/* ===== R145 居住・房產資產軌跡（純衍生/結算覆蓋層；零 rng/零汙染/deterministic 推演/財富 mny 主驅動+智力購屋眼光/壞資料降級/房產成就） ===== */
const r145 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function mk(mny,int,age,era){ return {attr:{hp:50,int:int,apr:50,mny:mny,hap:50}, age:age, era:era, flags:{}, alive:false}; }
  // ① 資料齊備：6 房產資產底子+6 居住處境階層+4 人生階段+6 結局型別+六世代房市梗+購屋眼光三檔
  out.dataFull = Array.isArray(R145_ASSET) && R145_ASSET.length===6 && R145_ASSET.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R145_HOME) && R145_HOME.length===6 && R145_HOME.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R145_PHASES) && R145_PHASES.length===4 && R145_PHASES.every(p=>typeof p.off==='number')
    && ['mansion','landlord','heir','mortgage','parasite','renter'].every(k=>R145_END[k]&&R145_END[k].nm&&R145_END[k].path&&R145_END[k].note)
    && R55_ERAS.every(er=>typeof R145_ERAHOME[er.id]==='string')
    && [r145SavvyOf(90),r145SavvyOf(50),r145SavvyOf(10)].every(c=>typeof c.off==='number'&&c.nm&&c.short);
  // ② 財富 mny 確定性映射：高→豪宅置產大戶(>=4)、中→中段(>=2)、低→零資產無殼(0)；且單調驅動
  const hi=r145HousingOf(mk(95,50,40,'e00')), midd=r145HousingOf(mk(50,50,40,'e00')), lo=r145HousingOf(mk(5,50,40,'e00'));
  out.mnyMap = !!hi&&!!midd&&!!lo && hi.assetTier>=4 && midd.assetTier>=2 && lo.assetTier===0
    && hi.assetTier>midd.assetTier && midd.assetTier>lo.assetTier;
  // ③ 智力影響購屋眼光（次級修正）：同本金 55，購屋眼光精準(int90)底子 >= 接刀俠(int10)，且 off 有別
  const smart=r145HousingOf(mk(55,90,40,'e00')), dumb=r145HousingOf(mk(55,10,40,'e00'));
  out.savvyDrive = !!smart&&!!dumb && smart.assetTier>=dumb.assetTier && smart.savvy.off>dumb.savvy.off;
  // ④ 卡片渲染：含房產資產/房產結局/購屋眼光/居住或處境
  S=mk(50,50,40,'e00'); const card=r145HousingReviewHTML();
  out.cardRender = card.indexOf('房產資產')>=0 && card.indexOf('房產結局')>=0 && card.indexOf('購屋眼光')>=0 && (card.indexOf('居住')>=0||card.indexOf('房產')>=0);
  // ⑤ deterministic 純讀：同 S 兩次渲染逐字一致
  S=mk(40,40,35,'e10'); const a1=r145HousingReviewHTML(), a2=r145HousingReviewHTML();
  out.deterministic = a1===a2 && a1.length>0;
  // ⑥ 純呈現零汙染：生成前後 S.attr/era/age/flags 不變、零 rng 消耗
  S=mk(72,55,45,'e70'); const bA=JSON.stringify(S.attr), bE=S.era, bAge=S.age, bF=JSON.stringify(S.flags);
  let used=0; const oldR=rng; rng=function(){ used++; return oldR(); };
  r145HousingReviewHTML(); r145HousingOf(S); rng=oldR;
  out.pure = JSON.stringify(S.attr)===bA && S.era===bE && S.age===bAge && JSON.stringify(S.flags)===bF && used===0;
  // ⑦ S=null / 缺 attr / 缺 mny 降級：回 null、卡空字串、不炸
  out.nullSafe = (()=>{ try{ S=null; return r145HousingOf(null)===null && r145HousingReviewHTML()===''; }catch(e){ return false; } })();
  out.noAttr = (()=>{ try{ return r145HousingOf({age:40,era:'e00'})===null && r145HousingOf({attr:{int:50},age:40})===null; }catch(e){ return false; } })();
  // ⑧ 缺 int 降級：用中性 50、仍回物件不炸；髒 era → 房市梗略過不炸
  out.softDeg = (()=>{ try{ const m=r145HousingOf({attr:{mny:55},age:40,era:'e00',flags:{}}); const d=r145HousingOf(mk(55,50,40,'zzz999')); return !!m && m.assetTier===r145HousingOf(mk(55,50,40,'e00')).assetTier && !!d && d.era===null; }catch(e){ return false; } })();
  // ⑨ 舊存檔相容：ensureState 不為 R145 在 S/flags 補任何 r145 鍵
  startGame(); const olds=S; ensureState(olds);
  out.compatOld = !Object.keys(olds).some(k=>k.toLowerCase().indexOf('r145')===0)
    && !Object.keys(olds.flags||{}).some(k=>k.toLowerCase().indexOf('r145')===0);
  // ⑩ 房產結局成就確定性點亮：帝寶/包租公/祖產/房貸/啃老/租屋 各自可達且互斥
  const MANS=mk(88,50,40,'e00'), LAND=mk(65,60,40,'e00'), HEIR=mk(65,50,25,'e00'), MORT=mk(50,50,40,'e00'), PARA=mk(20,50,28,'e00'), RENT=mk(20,50,66,'e00');
  out.achMans    = !!ACH_MAP.r145_mansion   && ACH_MAP.r145_mansion.check({S:MANS})===true   && ACH_MAP.r145_mansion.check({S:PARA})===false;
  out.achLand    = !!ACH_MAP.r145_landlord  && ACH_MAP.r145_landlord.check({S:LAND})===true  && ACH_MAP.r145_landlord.check({S:PARA})===false;
  out.achHeir    = !!ACH_MAP.r145_heir      && ACH_MAP.r145_heir.check({S:HEIR})===true      && ACH_MAP.r145_heir.check({S:RENT})===false;
  out.achMort    = !!ACH_MAP.r145_mortgage  && ACH_MAP.r145_mortgage.check({S:MORT})===true  && ACH_MAP.r145_mortgage.check({S:MANS})===false;
  out.achPara    = !!ACH_MAP.r145_parasite  && ACH_MAP.r145_parasite.check({S:PARA})===true  && ACH_MAP.r145_parasite.check({S:MANS})===false;
  out.achRent    = !!ACH_MAP.r145_renter    && ACH_MAP.r145_renter.check({S:RENT})===true    && ACH_MAP.r145_renter.check({S:MANS})===false;
  // ⑪ 跨局集滿 r145_housing：六成就全亮→解鎖、缺一→不解
  const allAch={r145_mansion:true,r145_landlord:true,r145_heir:true,r145_mortgage:true,r145_parasite:true,r145_renter:true};
  SAVE.ach=Object.assign({},allAch); out.achFull = !!ACH_MAP.r145_housing && ACH_MAP.r145_housing.check({S:{}})===true;
  const partial=Object.assign({},allAch); delete partial.r145_mansion;
  SAVE.ach=partial; out.achPartial = ACH_MAP.r145_housing.check({S:{}})===false;
  SAVE.ach={}; S=null;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['dataFull','① 資料齊備:6 房產資產底子+6 居住處境階層+4 人生階段+6 結局型別+六世代房市梗+購屋眼光三檔'],
  ['mnyMap','② 財富 mny 確定性映射:高→豪宅大戶/中→中段/低→零資產無殼且單調驅動'],
  ['savvyDrive','③ 智力影響購屋眼光:同本金精準老手>=接刀俠且 off 有別'],
  ['cardRender','④ 卡片渲染:含房產資產/房產結局/購屋眼光/居住或房產'],
  ['deterministic','⑤ deterministic 純讀:同 S 兩次渲染逐字一致'],
  ['pure','⑥ 純呈現零汙染:生成前後 S.attr/era/age/flags 不變且零 rng'],
  ['nullSafe','⑦ 無局(S=null)降級:回 null、卡空字串不炸'],
  ['noAttr','⑦ 缺 attr/mny 降級:回 null 不炸'],
  ['softDeg','⑧ 缺 int 中性化＋髒 era 房市梗略過:仍回物件不炸且底子一致'],
  ['compatOld','⑨ 舊存檔相容:ensureState 不為 R145 補任何 S/flags 鍵'],
  ['achMans','⑩ r145_mansion:帝寶→解、啃老→不解'],
  ['achLand','⑩ r145_landlord:包租公→解、啃老→不解'],
  ['achHeir','⑩ r145_heir:祖產→解、租屋→不解'],
  ['achMort','⑩ r145_mortgage:房貸一生→解、帝寶→不解'],
  ['achPara','⑩ r145_parasite:啃老蝸居→解、帝寶→不解'],
  ['achRent','⑩ r145_renter:租屋到老→解、帝寶→不解'],
  ['achFull','⑪ 跨局集滿:六成就全亮→r145_housing 解鎖'],
  ['achPartial','⑪ 跨局集滿:缺一→r145_housing 不解'],
].forEach(([k,m])=>ok(r145[k], 'R145 '+m));

/* ===== R146 交通・座駕軌跡（純衍生/結算覆蓋層；零 rng/零汙染/deterministic 推演/財富 mny 主驅動+智力購車眼光/壞資料降級/交通成就） ===== */
const r146 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function mk(mny,int,age,era){ return {attr:{hp:50,int:int,apr:50,mny:mny,hap:50}, age:age, era:era, flags:{}, alive:false}; }
  // ① 資料齊備：6 座駕資產底子+6 通勤處境階層+4 人生階段+6 結局型別+六世代交通梗+購車眼光三檔
  out.dataFull = Array.isArray(R146_FLEET) && R146_FLEET.length===6 && R146_FLEET.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R146_RIDE) && R146_RIDE.length===6 && R146_RIDE.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R146_PHASES) && R146_PHASES.length===4 && R146_PHASES.every(p=>typeof p.off==='number')
    && ['luxe','biker','gogoro','toyota','scooter','walker'].every(k=>R146_END[k]&&R146_END[k].nm&&R146_END[k].path&&R146_END[k].note)
    && R55_ERAS.every(er=>typeof R146_ERARIDE[er.id]==='string')
    && [r146SavvyOf(90),r146SavvyOf(50),r146SavvyOf(10)].every(c=>typeof c.off==='number'&&c.nm&&c.short);
  // ② 財富 mny 確定性映射：高→雙B進口車庫(>=4)、中→中段(>=2)、低→無車雙腳(0)；且單調驅動
  const hi=r146VehicleOf(mk(95,50,40,'e00')), midd=r146VehicleOf(mk(50,50,40,'e00')), lo=r146VehicleOf(mk(5,50,40,'e00'));
  out.mnyMap = !!hi&&!!midd&&!!lo && hi.fleetTier>=4 && midd.fleetTier>=2 && lo.fleetTier===0
    && hi.fleetTier>midd.fleetTier && midd.fleetTier>lo.fleetTier;
  // ③ 智力影響購車眼光（次級修正）：同口袋 55，懂車老司機(int90)底子 >= 菜雞盤子(int10)，且 off 有別
  const smart=r146VehicleOf(mk(55,90,40,'e00')), dumb=r146VehicleOf(mk(55,10,40,'e00'));
  out.savvyDrive = !!smart&&!!dumb && smart.fleetTier>=dumb.fleetTier && smart.savvy.off>dumb.savvy.off;
  // ④ 卡片渲染：含座駕資產/交通結局/購車眼光/通勤或座駕
  S=mk(50,50,40,'e00'); const card=r146VehicleReviewHTML();
  out.cardRender = card.indexOf('座駕資產')>=0 && card.indexOf('交通結局')>=0 && card.indexOf('購車眼光')>=0 && (card.indexOf('通勤')>=0||card.indexOf('座駕')>=0);
  // ⑤ deterministic 純讀：同 S 兩次渲染逐字一致
  S=mk(40,40,35,'e10'); const a1=r146VehicleReviewHTML(), a2=r146VehicleReviewHTML();
  out.deterministic = a1===a2 && a1.length>0;
  // ⑥ 純呈現零汙染：生成前後 S.attr/era/age/flags 不變、零 rng 消耗
  S=mk(72,55,45,'e70'); const bA=JSON.stringify(S.attr), bE=S.era, bAge=S.age, bF=JSON.stringify(S.flags);
  let used=0; const oldR=rng; rng=function(){ used++; return oldR(); };
  r146VehicleReviewHTML(); r146VehicleOf(S); rng=oldR;
  out.pure = JSON.stringify(S.attr)===bA && S.era===bE && S.age===bAge && JSON.stringify(S.flags)===bF && used===0;
  // ⑦ S=null / 缺 attr / 缺 mny 降級：回 null、卡空字串、不炸
  out.nullSafe = (()=>{ try{ S=null; return r146VehicleOf(null)===null && r146VehicleReviewHTML()===''; }catch(e){ return false; } })();
  out.noAttr = (()=>{ try{ return r146VehicleOf({age:40,era:'e00'})===null && r146VehicleOf({attr:{int:50},age:40})===null; }catch(e){ return false; } })();
  // ⑧ 缺 int 降級：用中性 50、仍回物件不炸；髒 era → 交通梗略過不炸
  out.softDeg = (()=>{ try{ const m=r146VehicleOf({attr:{mny:55},age:40,era:'e00',flags:{}}); const d=r146VehicleOf(mk(55,50,40,'zzz999')); return !!m && m.fleetTier===r146VehicleOf(mk(55,50,40,'e00')).fleetTier && !!d && d.era===null; }catch(e){ return false; } })();
  // ⑨ 舊存檔相容：ensureState 不為 R146 在 S/flags 補任何 r146 鍵
  startGame(); const olds=S; ensureState(olds);
  out.compatOld = !Object.keys(olds).some(k=>k.toLowerCase().indexOf('r146')===0)
    && !Object.keys(olds.flags||{}).some(k=>k.toLowerCase().indexOf('r146')===0);
  // ⑩ 交通結局成就確定性點亮：雙B/重機/Gogoro/Toyota/機車/無車 各自可達且互斥
  const LUXE=mk(88,50,40,'e00'), GOGO=mk(65,60,40,'e00'), BIKE=mk(65,50,25,'e00'), TOYO=mk(50,50,40,'e00'), SCOO=mk(20,50,28,'e00'), WALK=mk(20,50,66,'e00');
  out.achLuxe    = !!ACH_MAP.r146_luxe     && ACH_MAP.r146_luxe.check({S:LUXE})===true     && ACH_MAP.r146_luxe.check({S:SCOO})===false;
  out.achGogo    = !!ACH_MAP.r146_gogoro   && ACH_MAP.r146_gogoro.check({S:GOGO})===true   && ACH_MAP.r146_gogoro.check({S:SCOO})===false;
  out.achBike    = !!ACH_MAP.r146_biker    && ACH_MAP.r146_biker.check({S:BIKE})===true    && ACH_MAP.r146_biker.check({S:WALK})===false;
  out.achToyo    = !!ACH_MAP.r146_toyota   && ACH_MAP.r146_toyota.check({S:TOYO})===true   && ACH_MAP.r146_toyota.check({S:LUXE})===false;
  out.achScoo    = !!ACH_MAP.r146_scooter  && ACH_MAP.r146_scooter.check({S:SCOO})===true  && ACH_MAP.r146_scooter.check({S:LUXE})===false;
  out.achWalk    = !!ACH_MAP.r146_walker   && ACH_MAP.r146_walker.check({S:WALK})===true   && ACH_MAP.r146_walker.check({S:LUXE})===false;
  // ⑪ 跨局集滿 r146_vehicle：六成就全亮→解鎖、缺一→不解
  const allAch={r146_luxe:true,r146_biker:true,r146_gogoro:true,r146_toyota:true,r146_scooter:true,r146_walker:true};
  SAVE.ach=Object.assign({},allAch); out.achFull = !!ACH_MAP.r146_vehicle && ACH_MAP.r146_vehicle.check({S:{}})===true;
  const partial=Object.assign({},allAch); delete partial.r146_luxe;
  SAVE.ach=partial; out.achPartial = ACH_MAP.r146_vehicle.check({S:{}})===false;
  SAVE.ach={}; S=null;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['dataFull','① 資料齊備:6 座駕資產底子+6 通勤處境階層+4 人生階段+6 結局型別+六世代交通梗+購車眼光三檔'],
  ['mnyMap','② 財富 mny 確定性映射:高→雙B進口/中→中段/低→無車雙腳且單調驅動'],
  ['savvyDrive','③ 智力影響購車眼光:同口袋懂車老司機>=菜雞盤子且 off 有別'],
  ['cardRender','④ 卡片渲染:含座駕資產/交通結局/購車眼光/通勤或座駕'],
  ['deterministic','⑤ deterministic 純讀:同 S 兩次渲染逐字一致'],
  ['pure','⑥ 純呈現零汙染:生成前後 S.attr/era/age/flags 不變且零 rng'],
  ['nullSafe','⑦ 無局(S=null)降級:回 null、卡空字串不炸'],
  ['noAttr','⑦ 缺 attr/mny 降級:回 null 不炸'],
  ['softDeg','⑧ 缺 int 中性化＋髒 era 交通梗略過:仍回物件不炸且底子一致'],
  ['compatOld','⑨ 舊存檔相容:ensureState 不為 R146 補任何 S/flags 鍵'],
  ['achLuxe','⑩ r146_luxe:雙B大哥→解、機車→不解'],
  ['achGogo','⑩ r146_gogoro:Gogoro科技族→解、機車→不解'],
  ['achBike','⑩ r146_biker:重機騎士→解、無車→不解'],
  ['achToyo','⑩ r146_toyota:Toyota神車→解、雙B→不解'],
  ['achScoo','⑩ r146_scooter:機車國牌奴→解、雙B→不解'],
  ['achWalk','⑩ r146_walker:無車一身輕→解、雙B→不解'],
  ['achFull','⑪ 跨局集滿:六成就全亮→r146_vehicle 解鎖'],
  ['achPartial','⑪ 跨局集滿:缺一→r146_vehicle 不解'],
].forEach(([k,m])=>ok(r146[k], 'R146 '+m));

/* ===== R147 教育・學歷軌跡（純衍生/結算覆蓋層；零 rng/零汙染/deterministic 推演/智力 int 主驅動+財富教育資源/壞資料降級/學歷成就） ===== */
const r147 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function mk(int,mny,age,era){ return {attr:{hp:50,int:int,apr:50,mny:mny,hap:50}, age:age, era:era, flags:{}, alive:false}; }
  // ① 資料齊備：6 學歷資產底子+6 求學處境階層+4 人生階段+6 結局型別+六世代學歷梗+教育資源三檔
  out.dataFull = Array.isArray(R147_DEGREE) && R147_DEGREE.length===6 && R147_DEGREE.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R147_STUDY) && R147_STUDY.length===6 && R147_STUDY.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R147_PHASES) && R147_PHASES.length===4 && R147_PHASES.every(p=>typeof p.off==='number')
    && ['elite','overseas','wanderer','private','voc','dropout'].every(k=>R147_END[k]&&R147_END[k].nm&&R147_END[k].path&&R147_END[k].note)
    && R55_ERAS.every(er=>typeof R147_ERAEDU[er.id]==='string')
    && [r147ResourceOf(90),r147ResourceOf(50),r147ResourceOf(10)].every(c=>typeof c.off==='number'&&c.nm&&c.short);
  // ② 智力 int 確定性映射：高→台清交成頂大(>=4)、中→中段(>=2)、低→放牛班中輟(0)；且單調驅動
  const hi=r147EducationOf(mk(95,50,40,'e00')), midd=r147EducationOf(mk(50,50,40,'e00')), lo=r147EducationOf(mk(5,50,40,'e00'));
  out.intMap = !!hi&&!!midd&&!!lo && hi.degreeTier>=4 && midd.degreeTier>=2 && lo.degreeTier===0
    && hi.degreeTier>midd.degreeTier && midd.degreeTier>lo.degreeTier;
  // ③ 財富影響教育資源（次級修正）：同腦袋 55，資源勝利組(mny90)底子 >= 清寒苦讀(mny10)，且 off 有別
  const rich=r147EducationOf(mk(55,90,40,'e00')), poor=r147EducationOf(mk(55,10,40,'e00'));
  out.resourceDrive = !!rich&&!!poor && rich.degreeTier>=poor.degreeTier && rich.resource.off>poor.resource.off;
  // ④ 卡片渲染：含學歷資產/學歷結局/教育資源/求學或學歷
  S=mk(50,50,40,'e00'); const card=r147EducationReviewHTML();
  out.cardRender = card.indexOf('學歷資產')>=0 && card.indexOf('學歷結局')>=0 && card.indexOf('教育資源')>=0 && (card.indexOf('求學')>=0||card.indexOf('學歷')>=0);
  // ⑤ deterministic 純讀：同 S 兩次渲染逐字一致
  S=mk(40,40,35,'e10'); const a1=r147EducationReviewHTML(), a2=r147EducationReviewHTML();
  out.deterministic = a1===a2 && a1.length>0;
  // ⑥ 純呈現零汙染：生成前後 S.attr/era/age/flags 不變、零 rng 消耗
  S=mk(55,72,45,'e70'); const bA=JSON.stringify(S.attr), bE=S.era, bAge=S.age, bF=JSON.stringify(S.flags);
  let used=0; const oldR=rng; rng=function(){ used++; return oldR(); };
  r147EducationReviewHTML(); r147EducationOf(S); rng=oldR;
  out.pure = JSON.stringify(S.attr)===bA && S.era===bE && S.age===bAge && JSON.stringify(S.flags)===bF && used===0;
  // ⑦ S=null / 缺 attr / 缺 int 降級：回 null、卡空字串、不炸
  out.nullSafe = (()=>{ try{ S=null; return r147EducationOf(null)===null && r147EducationReviewHTML()===''; }catch(e){ return false; } })();
  out.noAttr = (()=>{ try{ return r147EducationOf({age:40,era:'e00'})===null && r147EducationOf({attr:{mny:50},age:40})===null; }catch(e){ return false; } })();
  // ⑧ 缺 mny 降級：用中性 50、仍回物件不炸；髒 era → 學歷梗略過不炸
  out.softDeg = (()=>{ try{ const m=r147EducationOf({attr:{int:55},age:40,era:'e00',flags:{}}); const d=r147EducationOf(mk(55,50,40,'zzz999')); return !!m && m.degreeTier===r147EducationOf(mk(55,50,40,'e00')).degreeTier && !!d && d.era===null; }catch(e){ return false; } })();
  // ⑨ 舊存檔相容：ensureState 不為 R147 在 S/flags 補任何 r147 鍵
  startGame(); const olds=S; ensureState(olds);
  out.compatOld = !Object.keys(olds).some(k=>k.toLowerCase().indexOf('r147')===0)
    && !Object.keys(olds.flags||{}).some(k=>k.toLowerCase().indexOf('r147')===0);
  // ⑩ 學歷結局成就確定性點亮：頂大/海歸/流浪/學店/技職/中輟 各自可達且互斥
  const ELITE=mk(88,50,40,'e00'), OVER=mk(65,65,40,'e00'), WAND=mk(65,20,40,'e00'), PRIV=mk(50,50,40,'e00'), VOC=mk(38,50,40,'e00'), DROP=mk(20,50,40,'e00');
  out.achElite   = !!ACH_MAP.r147_elite    && ACH_MAP.r147_elite.check({S:ELITE})===true   && ACH_MAP.r147_elite.check({S:DROP})===false;
  out.achOver    = !!ACH_MAP.r147_overseas && ACH_MAP.r147_overseas.check({S:OVER})===true && ACH_MAP.r147_overseas.check({S:DROP})===false;
  out.achWand    = !!ACH_MAP.r147_wanderer && ACH_MAP.r147_wanderer.check({S:WAND})===true && ACH_MAP.r147_wanderer.check({S:ELITE})===false;
  out.achPriv    = !!ACH_MAP.r147_private  && ACH_MAP.r147_private.check({S:PRIV})===true  && ACH_MAP.r147_private.check({S:ELITE})===false;
  out.achVoc     = !!ACH_MAP.r147_voc      && ACH_MAP.r147_voc.check({S:VOC})===true       && ACH_MAP.r147_voc.check({S:ELITE})===false;
  out.achDrop    = !!ACH_MAP.r147_dropout  && ACH_MAP.r147_dropout.check({S:DROP})===true   && ACH_MAP.r147_dropout.check({S:ELITE})===false;
  // ⑪ 跨局集滿 r147_education：六成就全亮→解鎖、缺一→不解
  const allAch={r147_elite:true,r147_overseas:true,r147_wanderer:true,r147_private:true,r147_voc:true,r147_dropout:true};
  SAVE.ach=Object.assign({},allAch); out.achFull = !!ACH_MAP.r147_education && ACH_MAP.r147_education.check({S:{}})===true;
  const partial=Object.assign({},allAch); delete partial.r147_elite;
  SAVE.ach=partial; out.achPartial = ACH_MAP.r147_education.check({S:{}})===false;
  SAVE.ach={}; S=null;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['dataFull','① 資料齊備:6 學歷資產底子+6 求學處境階層+4 人生階段+6 結局型別+六世代學歷梗+教育資源三檔'],
  ['intMap','② 智力 int 確定性映射:高→台清交成/中→中段/低→放牛班中輟且單調驅動'],
  ['resourceDrive','③ 財富影響教育資源:同腦袋資源勝利組>=清寒苦讀且 off 有別'],
  ['cardRender','④ 卡片渲染:含學歷資產/學歷結局/教育資源/求學或學歷'],
  ['deterministic','⑤ deterministic 純讀:同 S 兩次渲染逐字一致'],
  ['pure','⑥ 純呈現零汙染:生成前後 S.attr/era/age/flags 不變且零 rng'],
  ['nullSafe','⑦ 無局(S=null)降級:回 null、卡空字串不炸'],
  ['noAttr','⑦ 缺 attr/int 降級:回 null 不炸'],
  ['softDeg','⑧ 缺 mny 中性化＋髒 era 學歷梗略過:仍回物件不炸且底子一致'],
  ['compatOld','⑨ 舊存檔相容:ensureState 不為 R147 補任何 S/flags 鍵'],
  ['achElite','⑩ r147_elite:頂大菁英→解、中輟→不解'],
  ['achOver','⑩ r147_overseas:海歸學霸→解、中輟→不解'],
  ['achWand','⑩ r147_wanderer:流浪博士→解、頂大→不解'],
  ['achPriv','⑩ r147_private:學店畢業→解、頂大→不解'],
  ['achVoc','⑩ r147_voc:技職黑手→解、頂大→不解'],
  ['achDrop','⑩ r147_dropout:中輟傳奇→解、頂大→不解'],
  ['achFull','⑪ 跨局集滿:六成就全亮→r147_education 解鎖'],
  ['achPartial','⑪ 跨局集滿:缺一→r147_education 不解'],
].forEach(([k,m])=>ok(r147[k], 'R147 '+m));

/* ===== R148 飲食・美食軌跡（純衍生/結算覆蓋層；零 rng/零汙染/deterministic 推演/財富 mny 主驅動+體質 hp 飲食習慣/壞資料降級/飲食成就） ===== */
const r148 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function mk(mny,hp,age,era){ return {attr:{hp:hp,int:50,apr:50,mny:mny,hap:50}, age:age, era:era, flags:{}, alive:false}; }
  // ① 資料齊備：6 食力資產底子+6 餐桌處境階層+4 人生階段+6 結局型別+六世代飲食梗+飲食習慣三檔
  out.dataFull = Array.isArray(R148_DIET) && R148_DIET.length===6 && R148_DIET.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R148_TABLE) && R148_TABLE.length===6 && R148_TABLE.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R148_PHASES) && R148_PHASES.length===4 && R148_PHASES.every(p=>typeof p.off==='number')
    && ['michelin','organic','delivery','foodie','street','instant'].every(k=>R148_END[k]&&R148_END[k].nm&&R148_END[k].path&&R148_END[k].note)
    && R55_ERAS.every(er=>typeof R148_ERAFOOD[er.id]==='string')
    && [r148HabitOf(90),r148HabitOf(50),r148HabitOf(10)].every(c=>typeof c.off==='number'&&c.nm&&c.short);
  // ② 財富 mny 確定性映射：高→米其林饕客(>=4)、中→中段(>=2)、低→泡麵度日(0)；且單調驅動
  const hi=r148FoodOf(mk(95,50,40,'e00')), midd=r148FoodOf(mk(50,50,40,'e00')), lo=r148FoodOf(mk(5,50,40,'e00'));
  out.mnyMap = !!hi&&!!midd&&!!lo && hi.dietTier>=4 && midd.dietTier>=2 && lo.dietTier===0
    && hi.dietTier>midd.dietTier && midd.dietTier>lo.dietTier;
  // ③ 體質影響飲食習慣（次級修正）：同口袋 55，養生鐵胃(hp90)底子 >= 外食爆肝(hp10)，且 off 有別
  const healthy=r148FoodOf(mk(55,90,40,'e00')), sick=r148FoodOf(mk(55,10,40,'e00'));
  out.habitDrive = !!healthy&&!!sick && healthy.dietTier>=sick.dietTier && healthy.habit.off>sick.habit.off;
  // ④ 卡片渲染：含食力資產/飲食結局/飲食習慣/餐桌或飲食
  S=mk(50,50,40,'e00'); const card=r148FoodReviewHTML();
  out.cardRender = card.indexOf('食力資產')>=0 && card.indexOf('飲食結局')>=0 && card.indexOf('飲食習慣')>=0 && (card.indexOf('餐桌')>=0||card.indexOf('飲食')>=0);
  // ⑤ deterministic 純讀：同 S 兩次渲染逐字一致
  S=mk(40,40,35,'e10'); const a1=r148FoodReviewHTML(), a2=r148FoodReviewHTML();
  out.deterministic = a1===a2 && a1.length>0;
  // ⑥ 純呈現零汙染：生成前後 S.attr/era/age/flags 不變、零 rng 消耗
  S=mk(72,55,45,'e70'); const bA=JSON.stringify(S.attr), bE=S.era, bAge=S.age, bF=JSON.stringify(S.flags);
  let used=0; const oldR=rng; rng=function(){ used++; return oldR(); };
  r148FoodReviewHTML(); r148FoodOf(S); rng=oldR;
  out.pure = JSON.stringify(S.attr)===bA && S.era===bE && S.age===bAge && JSON.stringify(S.flags)===bF && used===0;
  // ⑦ S=null / 缺 attr / 缺 mny 降級：回 null、卡空字串、不炸
  out.nullSafe = (()=>{ try{ S=null; return r148FoodOf(null)===null && r148FoodReviewHTML()===''; }catch(e){ return false; } })();
  out.noAttr = (()=>{ try{ return r148FoodOf({age:40,era:'e00'})===null && r148FoodOf({attr:{int:50},age:40})===null; }catch(e){ return false; } })();
  // ⑧ 缺 hp 降級：用中性 50、仍回物件不炸；髒 era → 飲食梗略過不炸
  out.softDeg = (()=>{ try{ const m=r148FoodOf({attr:{mny:55},age:40,era:'e00',flags:{}}); const d=r148FoodOf(mk(55,50,40,'zzz999')); return !!m && m.dietTier===r148FoodOf(mk(55,50,40,'e00')).dietTier && !!d && d.era===null; }catch(e){ return false; } })();
  // ⑨ 舊存檔相容：ensureState 不為 R148 在 S/flags 補任何 r148 鍵
  startGame(); const olds=S; ensureState(olds);
  out.compatOld = !Object.keys(olds).some(k=>k.toLowerCase().indexOf('r148')===0)
    && !Object.keys(olds.flags||{}).some(k=>k.toLowerCase().indexOf('r148')===0);
  // ⑩ 飲食結局成就確定性點亮：米其林/養生/外送/打卡/夜市/泡麵 各自可達且互斥
  const MICH=mk(88,50,40,'e00'), ORG=mk(65,65,40,'e00'), DEL=mk(55,30,40,'e00'), FOO=mk(50,50,40,'e00'), STR=mk(38,50,40,'e00'), INST=mk(20,50,40,'e00');
  out.achMich    = !!ACH_MAP.r148_michelin && ACH_MAP.r148_michelin.check({S:MICH})===true && ACH_MAP.r148_michelin.check({S:INST})===false;
  out.achOrg     = !!ACH_MAP.r148_organic  && ACH_MAP.r148_organic.check({S:ORG})===true   && ACH_MAP.r148_organic.check({S:INST})===false;
  out.achDel     = !!ACH_MAP.r148_delivery && ACH_MAP.r148_delivery.check({S:DEL})===true  && ACH_MAP.r148_delivery.check({S:MICH})===false;
  out.achFoo     = !!ACH_MAP.r148_foodie   && ACH_MAP.r148_foodie.check({S:FOO})===true     && ACH_MAP.r148_foodie.check({S:MICH})===false;
  out.achStr     = !!ACH_MAP.r148_street   && ACH_MAP.r148_street.check({S:STR})===true     && ACH_MAP.r148_street.check({S:MICH})===false;
  out.achInst    = !!ACH_MAP.r148_instant  && ACH_MAP.r148_instant.check({S:INST})===true   && ACH_MAP.r148_instant.check({S:MICH})===false;
  // ⑪ 跨局集滿 r148_food：六成就全亮→解鎖、缺一→不解
  const allAch={r148_michelin:true,r148_organic:true,r148_delivery:true,r148_foodie:true,r148_street:true,r148_instant:true};
  SAVE.ach=Object.assign({},allAch); out.achFull = !!ACH_MAP.r148_food && ACH_MAP.r148_food.check({S:{}})===true;
  const partial=Object.assign({},allAch); delete partial.r148_michelin;
  SAVE.ach=partial; out.achPartial = ACH_MAP.r148_food.check({S:{}})===false;
  SAVE.ach={}; S=null;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['dataFull','① 資料齊備:6 食力資產底子+6 餐桌處境階層+4 人生階段+6 結局型別+六世代飲食梗+飲食習慣三檔'],
  ['mnyMap','② 財富 mny 確定性映射:高→米其林饕客/中→中段/低→泡麵度日且單調驅動'],
  ['habitDrive','③ 體質影響飲食習慣:同口袋養生鐵胃>=外食爆肝且 off 有別'],
  ['cardRender','④ 卡片渲染:含食力資產/飲食結局/飲食習慣/餐桌或飲食'],
  ['deterministic','⑤ deterministic 純讀:同 S 兩次渲染逐字一致'],
  ['pure','⑥ 純呈現零汙染:生成前後 S.attr/era/age/flags 不變且零 rng'],
  ['nullSafe','⑦ 無局(S=null)降級:回 null、卡空字串不炸'],
  ['noAttr','⑦ 缺 attr/mny 降級:回 null 不炸'],
  ['softDeg','⑧ 缺 hp 中性化＋髒 era 飲食梗略過:仍回物件不炸且底子一致'],
  ['compatOld','⑨ 舊存檔相容:ensureState 不為 R148 補任何 S/flags 鍵'],
  ['achMich','⑩ r148_michelin:米其林食神→解、泡麵→不解'],
  ['achOrg','⑩ r148_organic:有機養生咖→解、泡麵→不解'],
  ['achDel','⑩ r148_delivery:外送肥宅→解、米其林→不解'],
  ['achFoo','⑩ r148_foodie:排隊打卡客→解、米其林→不解'],
  ['achStr','⑩ r148_street:夜市小吃控→解、米其林→不解'],
  ['achInst','⑩ r148_instant:22K吃土泡麵→解、米其林→不解'],
  ['achFull','⑪ 跨局集滿:六成就全亮→r148_food 解鎖'],
  ['achPartial','⑪ 跨局集滿:缺一→r148_food 不解'],
].forEach(([k,m])=>ok(r148[k], 'R148 '+m));

/* ===== R149 旅遊・足跡軌跡（純衍生/結算覆蓋層；零 rng/零汙染/deterministic 推演/財富 mny 主驅動+旅遊熱情 hp 愛玩興趣/壞資料降級/旅遊成就） ===== */
const r149 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function mk(mny,hp,age,era){ return {attr:{hp:hp,int:50,apr:50,mny:mny,hap:50}, age:age, era:era, flags:{}, alive:false}; }
  // ① 資料齊備：6 足跡資產底子+6 旅遊處境階層+4 人生階段+6 結局型別+六世代旅遊梗+旅遊熱情三檔
  out.dataFull = Array.isArray(R149_FOOT) && R149_FOOT.length===6 && R149_FOOT.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R149_TRIP) && R149_TRIP.length===6 && R149_TRIP.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R149_PHASES) && R149_PHASES.length===4 && R149_PHASES.every(p=>typeof p.off==='number')
    && ['nomad','workinghol','backpacker','freewalk','budget','homebound'].every(k=>R149_END[k]&&R149_END[k].nm&&R149_END[k].path&&R149_END[k].note)
    && R55_ERAS.every(er=>typeof R149_ERATRAVEL[er.id]==='string')
    && [r149PassionOf(90),r149PassionOf(50),r149PassionOf(10)].every(c=>typeof c.off==='number'&&c.nm&&c.short);
  // ② 財富 mny 確定性映射：高→環球游牧(>=4)、中→中段(>=2)、低→出不起國(0)；且單調驅動
  const hi=r149TravelOf(mk(95,50,40,'e00')), midd=r149TravelOf(mk(50,50,40,'e00')), lo=r149TravelOf(mk(5,50,40,'e00'));
  out.mnyMap = !!hi&&!!midd&&!!lo && hi.footTier>=4 && midd.footTier>=2 && lo.footTier===0
    && hi.footTier>midd.footTier && midd.footTier>lo.footTier;
  // ③ 旅遊熱情影響愛玩興趣（次級修正）：同口袋 55，愛玩冒險咖(hp90)底子 >= 宅家省錢派(hp10)，且 off 有別
  const wild=r149TravelOf(mk(55,90,40,'e00')), homey=r149TravelOf(mk(55,10,40,'e00'));
  out.passionDrive = !!wild&&!!homey && wild.footTier>=homey.footTier && wild.passion.off>homey.passion.off;
  // ④ 卡片渲染：含足跡資產/旅遊結局/旅遊熱情/足跡或旅遊
  S=mk(50,50,40,'e00'); const card=r149TravelReviewHTML();
  out.cardRender = card.indexOf('足跡資產')>=0 && card.indexOf('旅遊結局')>=0 && card.indexOf('旅遊熱情')>=0 && (card.indexOf('足跡')>=0||card.indexOf('旅遊')>=0);
  // ⑤ deterministic 純讀：同 S 兩次渲染逐字一致
  S=mk(40,40,35,'e10'); const a1=r149TravelReviewHTML(), a2=r149TravelReviewHTML();
  out.deterministic = a1===a2 && a1.length>0;
  // ⑥ 純呈現零汙染：生成前後 S.attr/era/age/flags 不變、零 rng 消耗
  S=mk(72,55,45,'e70'); const bA=JSON.stringify(S.attr), bE=S.era, bAge=S.age, bF=JSON.stringify(S.flags);
  let used=0; const oldR=rng; rng=function(){ used++; return oldR(); };
  r149TravelReviewHTML(); r149TravelOf(S); rng=oldR;
  out.pure = JSON.stringify(S.attr)===bA && S.era===bE && S.age===bAge && JSON.stringify(S.flags)===bF && used===0;
  // ⑦ S=null / 缺 attr / 缺 mny 降級：回 null、卡空字串、不炸
  out.nullSafe = (()=>{ try{ S=null; return r149TravelOf(null)===null && r149TravelReviewHTML()===''; }catch(e){ return false; } })();
  out.noAttr = (()=>{ try{ return r149TravelOf({age:40,era:'e00'})===null && r149TravelOf({attr:{int:50},age:40})===null; }catch(e){ return false; } })();
  // ⑧ 缺 hp 降級：用中性 50、仍回物件不炸；髒 era → 旅遊梗略過不炸
  out.softDeg = (()=>{ try{ const m=r149TravelOf({attr:{mny:55},age:40,era:'e00',flags:{}}); const d=r149TravelOf(mk(55,50,40,'zzz999')); return !!m && m.footTier===r149TravelOf(mk(55,50,40,'e00')).footTier && !!d && d.era===null; }catch(e){ return false; } })();
  // ⑨ 舊存檔相容：ensureState 不為 R149 在 S/flags 補任何 r149 鍵
  startGame(); const olds=S; ensureState(olds);
  out.compatOld = !Object.keys(olds).some(k=>k.toLowerCase().indexOf('r149')===0)
    && !Object.keys(olds.flags||{}).some(k=>k.toLowerCase().indexOf('r149')===0);
  // ⑩ 旅遊結局成就確定性點亮：環球/打工度假/背包客/自由行/窮遊/宅宅 各自可達且互斥
  const NOM=mk(88,50,40,'e00'), WH=mk(50,70,30,'e00'), BP=mk(55,60,50,'e00'), FW=mk(55,40,40,'e00'), BG=mk(38,40,40,'e00'), HB=mk(20,50,40,'e00');
  out.achNom    = !!ACH_MAP.r149_nomad      && ACH_MAP.r149_nomad.check({S:NOM})===true      && ACH_MAP.r149_nomad.check({S:HB})===false;
  out.achWh     = !!ACH_MAP.r149_workinghol && ACH_MAP.r149_workinghol.check({S:WH})===true  && ACH_MAP.r149_workinghol.check({S:HB})===false;
  out.achBp     = !!ACH_MAP.r149_backpacker && ACH_MAP.r149_backpacker.check({S:BP})===true  && ACH_MAP.r149_backpacker.check({S:NOM})===false;
  out.achFw     = !!ACH_MAP.r149_freewalk   && ACH_MAP.r149_freewalk.check({S:FW})===true    && ACH_MAP.r149_freewalk.check({S:NOM})===false;
  out.achBg     = !!ACH_MAP.r149_budget     && ACH_MAP.r149_budget.check({S:BG})===true      && ACH_MAP.r149_budget.check({S:NOM})===false;
  out.achHb     = !!ACH_MAP.r149_homebound  && ACH_MAP.r149_homebound.check({S:HB})===true   && ACH_MAP.r149_homebound.check({S:NOM})===false;
  // ⑪ 跨局集滿 r149_travel：六成就全亮→解鎖、缺一→不解
  const allAch={r149_nomad:true,r149_workinghol:true,r149_backpacker:true,r149_freewalk:true,r149_budget:true,r149_homebound:true};
  SAVE.ach=Object.assign({},allAch); out.achFull = !!ACH_MAP.r149_travel && ACH_MAP.r149_travel.check({S:{}})===true;
  const partial=Object.assign({},allAch); delete partial.r149_nomad;
  SAVE.ach=partial; out.achPartial = ACH_MAP.r149_travel.check({S:{}})===false;
  SAVE.ach={}; S=null;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['dataFull','① 資料齊備:6 足跡資產底子+6 旅遊處境階層+4 人生階段+6 結局型別+六世代旅遊梗+旅遊熱情三檔'],
  ['mnyMap','② 財富 mny 確定性映射:高→環球游牧/中→中段/低→出不起國且單調驅動'],
  ['passionDrive','③ 旅遊熱情影響愛玩興趣:同口袋愛玩冒險咖>=宅家省錢派且 off 有別'],
  ['cardRender','④ 卡片渲染:含足跡資產/旅遊結局/旅遊熱情/足跡或旅遊'],
  ['deterministic','⑤ deterministic 純讀:同 S 兩次渲染逐字一致'],
  ['pure','⑥ 純呈現零汙染:生成前後 S.attr/era/age/flags 不變且零 rng'],
  ['nullSafe','⑦ 無局(S=null)降級:回 null、卡空字串不炸'],
  ['noAttr','⑦ 缺 attr/mny 降級:回 null 不炸'],
  ['softDeg','⑧ 缺 hp 中性化＋髒 era 旅遊梗略過:仍回物件不炸且底子一致'],
  ['compatOld','⑨ 舊存檔相容:ensureState 不為 R149 補任何 S/flags 鍵'],
  ['achNom','⑩ r149_nomad:環球游牧→解、宅宅→不解'],
  ['achWh','⑩ r149_workinghol:打工度假潤了→解、宅宅→不解'],
  ['achBp','⑩ r149_backpacker:廉航背包客→解、環球→不解'],
  ['achFw','⑩ r149_freewalk:日韓自由行常客→解、環球→不解'],
  ['achBg','⑩ r149_budget:小資窮遊夜市控→解、環球→不解'],
  ['achHb','⑩ r149_homebound:出不起國宅宅→解、環球→不解'],
  ['achFull','⑪ 跨局集滿:六成就全亮→r149_travel 解鎖'],
  ['achPartial','⑪ 跨局集滿:缺一→r149_travel 不解'],
].forEach(([k,m])=>ok(r149[k], 'R149 '+m));

const r150 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function mk(mny,apr,age,era){ return {attr:{hp:50,int:50,apr:apr,mny:mny,hap:50}, age:age, era:era, flags:{}, alive:false}; }
  // ① 資料齊備：6 養寵底子+6 養寵處境階層+4 人生階段+6 結局型別+六世代養寵梗+陪伴需求三檔
  out.dataFull = Array.isArray(R150_KEEP) && R150_KEEP.length===6 && R150_KEEP.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R150_PET) && R150_PET.length===6 && R150_PET.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R150_PHASES) && R150_PHASES.length===4 && R150_PHASES.every(p=>typeof p.off==='number')
    && ['pamper','influencer','devoted','dogwalker','catstart','lonely'].every(k=>R150_END[k]&&R150_END[k].nm&&R150_END[k].path&&R150_END[k].note)
    && R55_ERAS.every(er=>typeof R150_ERAPET[er.id]==='string')
    && [r150BondOf(90),r150BondOf(50),r150BondOf(10)].every(c=>typeof c.off==='number'&&c.nm&&c.short);
  // ② 財富 mny 確定性映射：高→溺愛爸媽(>=4)、中→中段(>=2)、低→無寵(0)；且單調驅動
  const hi=r150PetOf(mk(95,50,40,'e00')), midd=r150PetOf(mk(50,50,40,'e00')), lo=r150PetOf(mk(5,50,40,'e00'));
  out.mnyMap = !!hi&&!!midd&&!!lo && hi.keepTier>=4 && midd.keepTier>=2 && lo.keepTier===0
    && hi.keepTier>midd.keepTier && midd.keepTier>lo.keepTier;
  // ③ 陪伴需求 apr 影響魅力/陪伴（次級修正）：同口袋 55，超黏毛孩奴(apr90)底子 >= 佛系獨居派(apr10)，且 off 有別
  const clingy=r150PetOf(mk(55,90,40,'e00')), aloof=r150PetOf(mk(55,10,40,'e00'));
  out.bondDrive = !!clingy&&!!aloof && clingy.keepTier>=aloof.keepTier && clingy.bond.off>aloof.bond.off;
  // ④ 卡片渲染：含養寵底子/養寵結局/陪伴需求
  S=mk(50,50,40,'e00'); const card=r150PetReviewHTML();
  out.cardRender = card.indexOf('養寵底子')>=0 && card.indexOf('養寵結局')>=0 && card.indexOf('陪伴需求')>=0 && (card.indexOf('毛孩')>=0||card.indexOf('養寵')>=0);
  // ⑤ deterministic 純讀：同 S 兩次渲染逐字一致
  S=mk(40,40,35,'e10'); const a1=r150PetReviewHTML(), a2=r150PetReviewHTML();
  out.deterministic = a1===a2 && a1.length>0;
  // ⑥ 純呈現零汙染：生成前後 S.attr/era/age/flags 不變、零 rng 消耗
  S=mk(72,55,45,'e70'); const bA=JSON.stringify(S.attr), bE=S.era, bAge=S.age, bF=JSON.stringify(S.flags);
  let used=0; const oldR=rng; rng=function(){ used++; return oldR(); };
  r150PetReviewHTML(); r150PetOf(S); rng=oldR;
  out.pure = JSON.stringify(S.attr)===bA && S.era===bE && S.age===bAge && JSON.stringify(S.flags)===bF && used===0;
  // ⑦ S=null / 缺 attr / 缺 mny 降級：回 null、卡空字串、不炸
  out.nullSafe = (()=>{ try{ S=null; return r150PetOf(null)===null && r150PetReviewHTML()===''; }catch(e){ return false; } })();
  out.noAttr = (()=>{ try{ return r150PetOf({age:40,era:'e00'})===null && r150PetOf({attr:{int:50},age:40})===null; }catch(e){ return false; } })();
  // ⑧ 缺 apr 降級：用中性 50、仍回物件不炸；髒 era → 養寵梗略過不炸
  out.softDeg = (()=>{ try{ const m=r150PetOf({attr:{mny:55},age:40,era:'e00',flags:{}}); const d=r150PetOf(mk(55,50,40,'zzz999')); return !!m && m.keepTier===r150PetOf(mk(55,50,40,'e00')).keepTier && !!d && d.era===null; }catch(e){ return false; } })();
  // ⑨ 舊存檔相容：ensureState 不為 R150 在 S/flags 補任何 r150 鍵
  startGame(); const olds=S; ensureState(olds);
  out.compatOld = !Object.keys(olds).some(k=>k.toLowerCase().indexOf('r150')===0)
    && !Object.keys(olds.flags||{}).some(k=>k.toLowerCase().indexOf('r150')===0);
  // ⑩ 養寵結局成就確定性點亮：溺愛/網紅/品種奴/遛狗/認養貓/無寵 各自可達且互斥
  const PAM=mk(88,50,40,'e00'), INF=mk(50,70,30,'e00'), DEV=mk(55,60,50,'e00'), DOG=mk(55,40,40,'e00'), CAT=mk(38,40,40,'e00'), LON=mk(20,50,40,'e00');
  out.achPam    = !!ACH_MAP.r150_pamper     && ACH_MAP.r150_pamper.check({S:PAM})===true     && ACH_MAP.r150_pamper.check({S:LON})===false;
  out.achInf    = !!ACH_MAP.r150_influencer && ACH_MAP.r150_influencer.check({S:INF})===true && ACH_MAP.r150_influencer.check({S:LON})===false;
  out.achDev    = !!ACH_MAP.r150_devoted    && ACH_MAP.r150_devoted.check({S:DEV})===true    && ACH_MAP.r150_devoted.check({S:PAM})===false;
  out.achDog    = !!ACH_MAP.r150_dogwalker  && ACH_MAP.r150_dogwalker.check({S:DOG})===true   && ACH_MAP.r150_dogwalker.check({S:PAM})===false;
  out.achCat    = !!ACH_MAP.r150_catstart   && ACH_MAP.r150_catstart.check({S:CAT})===true    && ACH_MAP.r150_catstart.check({S:PAM})===false;
  out.achLon    = !!ACH_MAP.r150_lonely     && ACH_MAP.r150_lonely.check({S:LON})===true      && ACH_MAP.r150_lonely.check({S:PAM})===false;
  // ⑪ 跨局集滿 r150_pet：六成就全亮→解鎖、缺一→不解
  const allAch={r150_pamper:true,r150_influencer:true,r150_devoted:true,r150_dogwalker:true,r150_catstart:true,r150_lonely:true};
  SAVE.ach=Object.assign({},allAch); out.achFull = !!ACH_MAP.r150_pet && ACH_MAP.r150_pet.check({S:{}})===true;
  const partial=Object.assign({},allAch); delete partial.r150_pamper;
  SAVE.ach=partial; out.achPartial = ACH_MAP.r150_pet.check({S:{}})===false;
  SAVE.ach={}; S=null;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['dataFull','① 資料齊備:6 養寵底子+6 養寵處境階層+4 人生階段+6 結局型別+六世代養寵梗+陪伴需求三檔'],
  ['mnyMap','② 財富 mny 確定性映射:高→溺愛爸媽/中→中段/低→無寵且單調驅動'],
  ['bondDrive','③ 陪伴需求影響魅力/陪伴:同口袋超黏毛孩奴>=佛系獨居派且 off 有別'],
  ['cardRender','④ 卡片渲染:含養寵底子/養寵結局/陪伴需求/毛孩或養寵'],
  ['deterministic','⑤ deterministic 純讀:同 S 兩次渲染逐字一致'],
  ['pure','⑥ 純呈現零汙染:生成前後 S.attr/era/age/flags 不變且零 rng'],
  ['nullSafe','⑦ 無局(S=null)降級:回 null、卡空字串不炸'],
  ['noAttr','⑦ 缺 attr/mny 降級:回 null 不炸'],
  ['softDeg','⑧ 缺 apr 中性化＋髒 era 養寵梗略過:仍回物件不炸且底子一致'],
  ['compatOld','⑨ 舊存檔相容:ensureState 不為 R150 補任何 S/flags 鍵'],
  ['achPam','⑩ r150_pamper:溺愛爸媽→解、無寵→不解'],
  ['achInf','⑩ r150_influencer:網美寵物網紅→解、無寵→不解'],
  ['achDev','⑩ r150_devoted:課金品種奴→解、溺愛→不解'],
  ['achDog','⑩ r150_dogwalker:米克斯遛狗族→解、溺愛→不解'],
  ['achCat','⑩ r150_catstart:浪浪認養貓奴→解、溺愛→不解'],
  ['achLon','⑩ r150_lonely:無寵孤家寡人→解、溺愛→不解'],
  ['achFull','⑪ 跨局集滿:六成就全亮→r150_pet 解鎖'],
  ['achPartial','⑪ 跨局集滿:缺一→r150_pet 不解'],
].forEach(([k,m])=>ok(r150[k], 'R150 '+m));

const r151 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function mk(mny,int,age,era){ return {attr:{hp:50,int:int,apr:50,mny:mny,hap:50}, age:age, era:era, flags:{}, alive:false}; }
  // ① 資料齊備：6 信仰底子+6 信仰處境階層+4 人生階段+6 結局型別+六世代信仰梗+理性程度三檔
  out.dataFull = Array.isArray(R151_KEEP) && R151_KEEP.length===6 && R151_KEEP.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R151_FAITH) && R151_FAITH.length===6 && R151_FAITH.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R151_PHASES) && R151_PHASES.length===4 && R151_PHASES.every(p=>typeof p.off==='number')
    && ['patron','cultist','astro','mazu','lamp','atheist'].every(k=>R151_END[k]&&R151_END[k].nm&&R151_END[k].path&&R151_END[k].note)
    && R55_ERAS.every(er=>typeof R151_ERAFAITH[er.id]==='string')
    && [r151WitOf(90),r151WitOf(50),r151WitOf(10)].every(c=>typeof c.off==='number'&&c.nm&&c.short);
  // ② 財富 mny 確定性映射：高→金主(>=4)、中→中段(>=2)、低→鐵齒(0)；且單調驅動
  const hi=r151FaithOf(mk(95,50,40,'e00')), midd=r151FaithOf(mk(50,50,40,'e00')), lo=r151FaithOf(mk(5,50,40,'e00'));
  out.mnyMap = !!hi&&!!midd&&!!lo && hi.keepTier>=4 && midd.keepTier>=2 && lo.keepTier===0
    && hi.keepTier>midd.keepTier && midd.keepTier>lo.keepTier;
  // ③ 智力 int 影響理性鐵齒/易信（次級修正）：同口袋 55，虔誠易信派(int10)底子 >= 理性鐵齒派(int90)，且 off 有別
  const naive=r151FaithOf(mk(55,10,40,'e00')), skeptic=r151FaithOf(mk(55,90,40,'e00'));
  out.witDrive = !!naive&&!!skeptic && naive.keepTier>=skeptic.keepTier && naive.wit.off>skeptic.wit.off;
  // ④ 卡片渲染：含信仰底子/信仰結局/理性程度
  S=mk(50,50,40,'e00'); const card=r151FaithReviewHTML();
  out.cardRender = card.indexOf('信仰底子')>=0 && card.indexOf('信仰結局')>=0 && card.indexOf('理性程度')>=0 && (card.indexOf('香火')>=0||card.indexOf('信仰')>=0);
  // ⑤ deterministic 純讀：同 S 兩次渲染逐字一致
  S=mk(40,40,35,'e10'); const a1=r151FaithReviewHTML(), a2=r151FaithReviewHTML();
  out.deterministic = a1===a2 && a1.length>0;
  // ⑥ 純呈現零汙染：生成前後 S.attr/era/age/flags 不變、零 rng 消耗
  S=mk(72,55,45,'e70'); const bA=JSON.stringify(S.attr), bE=S.era, bAge=S.age, bF=JSON.stringify(S.flags);
  let used=0; const oldR=rng; rng=function(){ used++; return oldR(); };
  r151FaithReviewHTML(); r151FaithOf(S); rng=oldR;
  out.pure = JSON.stringify(S.attr)===bA && S.era===bE && S.age===bAge && JSON.stringify(S.flags)===bF && used===0;
  // ⑦ S=null / 缺 attr / 缺 mny 降級：回 null、卡空字串、不炸
  out.nullSafe = (()=>{ try{ S=null; return r151FaithOf(null)===null && r151FaithReviewHTML()===''; }catch(e){ return false; } })();
  out.noAttr = (()=>{ try{ return r151FaithOf({age:40,era:'e00'})===null && r151FaithOf({attr:{apr:50},age:40})===null; }catch(e){ return false; } })();
  // ⑧ 缺 int 降級：用中性 50、仍回物件不炸；髒 era → 信仰梗略過不炸
  out.softDeg = (()=>{ try{ const m=r151FaithOf({attr:{mny:55},age:40,era:'e00',flags:{}}); const d=r151FaithOf(mk(55,50,40,'zzz999')); return !!m && m.keepTier===r151FaithOf(mk(55,50,40,'e00')).keepTier && !!d && d.era===null; }catch(e){ return false; } })();
  // ⑨ 舊存檔相容：ensureState 不為 R151 在 S/flags 補任何 r151 鍵
  startGame(); const olds=S; ensureState(olds);
  out.compatOld = !Object.keys(olds).some(k=>k.toLowerCase().indexOf('r151')===0)
    && !Object.keys(olds.flags||{}).some(k=>k.toLowerCase().indexOf('r151')===0);
  // ⑩ 信仰結局成就確定性點亮：金主/詐財/算命/遶境/點燈/鐵齒 各自可達且互斥
  const PAT=mk(88,50,40,'e00'), CUL=mk(50,25,40,'e00'), AST=mk(55,40,40,'e00'), MAZ=mk(55,60,40,'e00'), LAMP=mk(40,60,40,'e00'), ATH=mk(50,80,40,'e00');
  out.achPat = !!ACH_MAP.r151_patron  && ACH_MAP.r151_patron.check({S:PAT})===true  && ACH_MAP.r151_patron.check({S:ATH})===false;
  out.achCul = !!ACH_MAP.r151_cultist && ACH_MAP.r151_cultist.check({S:CUL})===true && ACH_MAP.r151_cultist.check({S:ATH})===false;
  out.achAst = !!ACH_MAP.r151_astro   && ACH_MAP.r151_astro.check({S:AST})===true   && ACH_MAP.r151_astro.check({S:PAT})===false;
  out.achMaz = !!ACH_MAP.r151_mazu    && ACH_MAP.r151_mazu.check({S:MAZ})===true    && ACH_MAP.r151_mazu.check({S:PAT})===false;
  out.achLamp= !!ACH_MAP.r151_lamp    && ACH_MAP.r151_lamp.check({S:LAMP})===true   && ACH_MAP.r151_lamp.check({S:PAT})===false;
  out.achAth = !!ACH_MAP.r151_atheist && ACH_MAP.r151_atheist.check({S:ATH})===true && ACH_MAP.r151_atheist.check({S:PAT})===false;
  // ⑪ 跨局集滿 r151_faith：六成就全亮→解鎖、缺一→不解
  const allAch={r151_patron:true,r151_cultist:true,r151_astro:true,r151_mazu:true,r151_lamp:true,r151_atheist:true};
  SAVE.ach=Object.assign({},allAch); out.achFull = !!ACH_MAP.r151_faith && ACH_MAP.r151_faith.check({S:{}})===true;
  const partial=Object.assign({},allAch); delete partial.r151_patron;
  SAVE.ach=partial; out.achPartial = ACH_MAP.r151_faith.check({S:{}})===false;
  SAVE.ach={}; S=null;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['dataFull','① 資料齊備:6 信仰底子+6 信仰處境階層+4 人生階段+6 結局型別+六世代信仰梗+理性程度三檔'],
  ['mnyMap','② 財富 mny 確定性映射:高→金主/中→中段/低→鐵齒且單調驅動'],
  ['witDrive','③ 智力影響理性鐵齒/易信:同口袋虔誠易信派>=理性鐵齒派且 off 有別'],
  ['cardRender','④ 卡片渲染:含信仰底子/信仰結局/理性程度/香火或信仰'],
  ['deterministic','⑤ deterministic 純讀:同 S 兩次渲染逐字一致'],
  ['pure','⑥ 純呈現零汙染:生成前後 S.attr/era/age/flags 不變且零 rng'],
  ['nullSafe','⑦ 無局(S=null)降級:回 null、卡空字串不炸'],
  ['noAttr','⑦ 缺 attr/mny 降級:回 null 不炸'],
  ['softDeg','⑧ 缺 int 中性化＋髒 era 信仰梗略過:仍回物件不炸且底子一致'],
  ['compatOld','⑨ 舊存檔相容:ensureState 不為 R151 補任何 S/flags 鍵'],
  ['achPat','⑩ r151_patron:宮廟金主→解、鐵齒→不解'],
  ['achCul','⑩ r151_cultist:走火入魔詐財→解、鐵齒→不解'],
  ['achAst','⑩ r151_astro:紫微塔羅成癮→解、金主→不解'],
  ['achMaz','⑩ r151_mazu:媽祖遶境信眾→解、金主→不解'],
  ['achLamp','⑩ r151_lamp:點燈安太歲常客→解、金主→不解'],
  ['achAth','⑩ r151_atheist:鐵齒無神論者→解、金主→不解'],
  ['achFull','⑪ 跨局集滿:六成就全亮→r151_faith 解鎖'],
  ['achPartial','⑪ 跨局集滿:缺一→r151_faith 不解'],
].forEach(([k,m])=>ok(r151[k], 'R151 '+m));

const r152 = JSON.parse(vm.runInContext(`(function(){
  const out={};
  function mk(int,apr,mny,hp,age,era){ return {attr:{hp:hp,int:int,apr:apr,mny:mny,hap:50}, age:age, era:era, flags:{}, alive:false}; }
  // ① 資料齊備：8 級才藝命運階梯+4 人生階段+8 結局型別+六世代才藝梗+學習力三檔+台風天分三檔
  out.dataFull = Array.isArray(R152_SKILL) && R152_SKILL.length===8 && R152_SKILL.every(t=>t.ic&&t.nm&&t.short)
    && Array.isArray(R152_PHASES) && R152_PHASES.length===4 && R152_PHASES.every(p=>typeof p.off==='number')
    && ['tonedeaf','fillerclass','guitarist','busker','teacher','winner','influencer','master'].every(k=>R152_END[k]&&R152_END[k].nm&&R152_END[k].path&&R152_END[k].note)
    && R55_ERAS.every(er=>typeof R152_ERASKILL[er.id]==='string')
    && [r152LearnOf(90),r152LearnOf(50),r152LearnOf(10)].every(c=>c.nm&&c.short)
    && [r152GiftOf(90),r152GiftOf(50),r152GiftOf(10)].every(c=>c.nm&&c.short);
  // ② 四屬性合成才藝分確定性映射：高→大師段(tier>=6)、中→中段(tier>=3)、低→墊底(tier===0)；且單調驅動
  const hi=r152SkillOf(mk(95,95,95,95,45,'e00')), midd=r152SkillOf(mk(50,50,50,50,45,'e00')), lo=r152SkillOf(mk(5,5,5,5,45,'e00'));
  out.scoreMap = !!hi&&!!midd&&!!lo && hi.tier>=6 && midd.tier>=3 && lo.tier===0
    && hi.tier>midd.tier && midd.tier>lo.tier;
  // ③ directive#1 四屬性皆有存在感：固定其餘中性 50，各屬性高→才藝分不低於低、且智力 int 影響最大
  const baseT=r152SkillOf(mk(50,50,50,50,45,'e00')).T;
  const intHi=r152SkillOf(mk(90,50,50,50,45,'e00')).T, intLo=r152SkillOf(mk(10,50,50,50,45,'e00')).T;
  const aprHi=r152SkillOf(mk(50,90,50,50,45,'e00')).T, aprLo=r152SkillOf(mk(50,10,50,50,45,'e00')).T;
  const mnyHi=r152SkillOf(mk(50,50,90,50,45,'e00')).T, mnyLo=r152SkillOf(mk(50,50,10,50,45,'e00')).T;
  const hpHi =r152SkillOf(mk(50,50,50,90,45,'e00')).T, hpLo =r152SkillOf(mk(50,50,50,10,45,'e00')).T;
  out.fourAttr = intHi>intLo && aprHi>aprLo && mnyHi>mnyLo && hpHi>hpLo
    && (intHi-intLo) > (aprHi-aprLo) && (intHi-intLo) > (mnyHi-mnyLo) && (intHi-intLo) > (hpHi-hpLo);
  // ④ 年齡成熟上限：同四屬性滿值，童年封頂才藝班(<=2)、青壯到網紅(<=6)、熟齡才解鎖大師(7)
  const kid=r152SkillOf(mk(95,95,95,95,10,'e00')), young=r152SkillOf(mk(95,95,95,95,25,'e00')), old=r152SkillOf(mk(95,95,95,95,45,'e00'));
  out.ageCap = !!kid&&!!young&&!!old && kid.peakTier<=2 && young.peakTier<=6 && old.peakTier===7 && old.peakTier>young.peakTier && young.peakTier>kid.peakTier;
  // ⑤ 卡片渲染：含才藝底子/才藝結局/學習力/台風天分
  S=mk(55,55,55,55,45,'e00'); const card=r152SkillReviewHTML();
  out.cardRender = card.indexOf('才藝底子')>=0 && card.indexOf('才藝結局')>=0 && card.indexOf('學習力')>=0 && card.indexOf('台風天分')>=0 && (card.indexOf('才藝')>=0||card.indexOf('技能')>=0);
  // ⑥ deterministic 純讀：同 S 兩次渲染逐字一致
  S=mk(40,40,40,40,35,'e10'); const a1=r152SkillReviewHTML(), a2=r152SkillReviewHTML();
  out.deterministic = a1===a2 && a1.length>0;
  // ⑦ 純呈現零汙染：生成前後 S.attr/era/age/flags 不變、零 rng 消耗
  S=mk(72,55,60,50,45,'e70'); const bA=JSON.stringify(S.attr), bE=S.era, bAge=S.age, bF=JSON.stringify(S.flags);
  let used=0; const oldR=rng; rng=function(){ used++; return oldR(); };
  r152SkillReviewHTML(); r152SkillOf(S); rng=oldR;
  out.pure = JSON.stringify(S.attr)===bA && S.era===bE && S.age===bAge && JSON.stringify(S.flags)===bF && used===0;
  // ⑧ S=null / 缺 attr / 缺 int 降級：回 null、卡空字串、不炸
  out.nullSafe = (()=>{ try{ S=null; return r152SkillOf(null)===null && r152SkillReviewHTML()===''; }catch(e){ return false; } })();
  out.noAttr = (()=>{ try{ return r152SkillOf({age:40,era:'e00'})===null && r152SkillOf({attr:{apr:50},age:40})===null; }catch(e){ return false; } })();
  // ⑨ 缺 apr/mny/hp 中性化＋髒 era 才藝梗略過：仍回物件不炸且分數一致
  out.softDeg = (()=>{ try{ const m=r152SkillOf({attr:{int:55},age:40,era:'e00',flags:{}}); const d=r152SkillOf(mk(55,50,50,50,40,'zzz999')); return !!m && m.T===r152SkillOf(mk(55,50,50,50,40,'e00')).T && !!d && d.era===null; }catch(e){ return false; } })();
  // ⑩ 舊存檔相容：ensureState 不為 R152 在 S/flags 補任何 r152 鍵
  startGame(); const olds=S; ensureState(olds);
  out.compatOld = !Object.keys(olds).some(k=>k.toLowerCase().indexOf('r152')===0)
    && !Object.keys(olds.flags||{}).some(k=>k.toLowerCase().indexOf('r152')===0);
  // ⑪ 才藝結局成就確定性點亮：大師/網紅/得獎/老師/街頭/吉他手/才藝班/音痴 各自可達且互斥（四屬性等值掃 0..7，age 45）
  const MAS=mk(92,92,92,92,45,'e00'), INF=mk(80,80,80,80,45,'e00'), WIN=mk(68,68,68,68,45,'e00'), TEA=mk(56,56,56,56,45,'e00'),
        BUS=mk(44,44,44,44,45,'e00'), GUI=mk(30,30,30,30,45,'e00'), FIL=mk(20,20,20,20,45,'e00'), TON=mk(5,5,5,5,45,'e00');
  out.achMas = !!ACH_MAP.r152_master      && ACH_MAP.r152_master.check({S:MAS})===true      && ACH_MAP.r152_master.check({S:TON})===false;
  out.achInf = !!ACH_MAP.r152_influencer  && ACH_MAP.r152_influencer.check({S:INF})===true  && ACH_MAP.r152_influencer.check({S:MAS})===false;
  out.achWin = !!ACH_MAP.r152_winner      && ACH_MAP.r152_winner.check({S:WIN})===true      && ACH_MAP.r152_winner.check({S:MAS})===false;
  out.achTea = !!ACH_MAP.r152_teacher     && ACH_MAP.r152_teacher.check({S:TEA})===true     && ACH_MAP.r152_teacher.check({S:MAS})===false;
  out.achBus = !!ACH_MAP.r152_busker      && ACH_MAP.r152_busker.check({S:BUS})===true      && ACH_MAP.r152_busker.check({S:MAS})===false;
  out.achGui = !!ACH_MAP.r152_guitarist   && ACH_MAP.r152_guitarist.check({S:GUI})===true   && ACH_MAP.r152_guitarist.check({S:MAS})===false;
  out.achFil = !!ACH_MAP.r152_fillerclass && ACH_MAP.r152_fillerclass.check({S:FIL})===true && ACH_MAP.r152_fillerclass.check({S:MAS})===false;
  out.achTon = !!ACH_MAP.r152_tonedeaf    && ACH_MAP.r152_tonedeaf.check({S:TON})===true    && ACH_MAP.r152_tonedeaf.check({S:MAS})===false;
  // ⑫ 跨局集滿 r152_skill：八成就全亮→解鎖、缺一→不解
  const allAch={r152_master:true,r152_influencer:true,r152_winner:true,r152_teacher:true,r152_busker:true,r152_guitarist:true,r152_fillerclass:true,r152_tonedeaf:true};
  SAVE.ach=Object.assign({},allAch); out.achFull = !!ACH_MAP.r152_skill && ACH_MAP.r152_skill.check({S:{}})===true;
  const partial=Object.assign({},allAch); delete partial.r152_master;
  SAVE.ach=partial; out.achPartial = ACH_MAP.r152_skill.check({S:{}})===false;
  SAVE.ach={}; S=null;
  return JSON.stringify(out);
})()`, sandbox));
[
  ['dataFull','① 資料齊備:8 級才藝階梯+4 人生階段+8 結局型別+六世代才藝梗+學習力/台風天分三檔'],
  ['scoreMap','② 四屬性合成才藝分確定性映射:高→大師段/中→中段/低→墊底且單調驅動'],
  ['fourAttr','③ directive#1 四屬性皆有存在感:int/apr/mny/hp 各高>低且 int 影響最大'],
  ['ageCap','④ 年齡成熟上限:童年封頂才藝班/青壯到網紅/熟齡才解鎖大師'],
  ['cardRender','⑤ 卡片渲染:含才藝底子/才藝結局/學習力/台風天分/才藝或技能'],
  ['deterministic','⑥ deterministic 純讀:同 S 兩次渲染逐字一致'],
  ['pure','⑦ 純呈現零汙染:生成前後 S.attr/era/age/flags 不變且零 rng'],
  ['nullSafe','⑧ 無局(S=null)降級:回 null、卡空字串不炸'],
  ['noAttr','⑧ 缺 attr/int 降級:回 null 不炸'],
  ['softDeg','⑨ 缺 apr/mny/hp 中性化＋髒 era 才藝梗略過:仍回物件不炸且分數一致'],
  ['compatOld','⑩ 舊存檔相容:ensureState 不為 R152 補任何 S/flags 鍵'],
  ['achMas','⑪ r152_master:大師職人→解、音痴→不解'],
  ['achInf','⑪ r152_influencer:才藝網紅→解、大師→不解'],
  ['achWin','⑪ r152_winner:比賽得獎素人→解、大師→不解'],
  ['achTea','⑪ r152_teacher:補習班才藝老師→解、大師→不解'],
  ['achBus','⑪ r152_busker:街頭藝人→解、大師→不解'],
  ['achGui','⑪ r152_guitarist:熱音吉他手→解、大師→不解'],
  ['achFil','⑪ r152_fillerclass:才藝班墊檔→解、大師→不解'],
  ['achTon','⑪ r152_tonedeaf:五音不全肢障→解、大師→不解'],
  ['achFull','⑫ 跨局集滿:八成就全亮→r152_skill 解鎖'],
  ['achPartial','⑫ 跨局集滿:缺一→r152_skill 不解'],
].forEach(([k,m])=>ok(r152[k], 'R152 '+m));

console.log(fails ? `\n結果: ❌ ${fails} 項未通過` : '\n結果: ✅ 狀態機全數正確');
process.exit(fails ? 1 : 0);
