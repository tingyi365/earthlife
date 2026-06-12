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

console.log(fails ? `\n結果: ❌ ${fails} 項未通過` : '\n結果: ✅ 狀態機全數正確');
process.exit(fails ? 1 : 0);
