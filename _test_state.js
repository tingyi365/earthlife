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

console.log(fails ? `\n結果: ❌ ${fails} 項未通過` : '\n結果: ✅ 狀態機全數正確');
process.exit(fails ? 1 : 0);
