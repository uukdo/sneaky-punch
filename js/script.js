(() => {
  "use strict";
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const W = 860, H = 640;
  const COLORS = {
    ink:"#0c0a10", // 테두리 색
    bag:"#e8382f", bagDark:"#9c1a17", bagShade:"#5c0d0e", bagHi:"#ff8a72",
    glove:"#131318", gloveDark:"#020203", gloveHi:"#3a3a44", gloveNeon:"#ff3d78",
    rope:"#3a3f4e"
  };

  // ---------- dom ----------
  const stage = document.getElementById("sbStage");
  const canvas = document.getElementById("sbCanvas");
  const ctx = canvas.getContext("2d");
  const comboN = document.getElementById("sbComboN");
  const gaugeN = document.getElementById("sbGaugeN");
  const gaugeFill = document.getElementById("sbGaugeFill");
  const intro = document.getElementById("sbIntro");
  const startBtn = document.getElementById("sbStartBtn");
  const totalIntro = document.getElementById("sbTotalIntro");
  const bestIntro = document.getElementById("sbBestIntro");
  const rankBtn = document.getElementById("sbRankBtn");
  const rankOverlay = document.getElementById("sbRankOverlay");
  const rankStatus = document.getElementById("sbRankStatus");
  const rankCloseBtn = document.getElementById("sbRankCloseBtn");
  const globalPunchesEl = document.getElementById("sbGlobalPunches");
  const globalComboEl = document.getElementById("sbGlobalCombo");
  const challengeBtn = document.getElementById("sbChallengeBtn");
  const challengeOverlay = document.getElementById("sbChallengeOverlay");
  const challengeIdle = document.getElementById("sbChallengeIdle");
  const challengeList = document.getElementById("sbChallengeList");
  const challengeStartBtn = document.getElementById("sbChallengeStartBtn");
  const sideListYesterday = document.getElementById("sbSideListYesterday");
  const sideListToday = document.getElementById("sbSideListToday");
  const nicknameEditBtn = document.getElementById("sbNicknameEditBtn");
  const nicknameEditForm = document.getElementById("sbNicknameEditForm");
  const nicknameEditInput = document.getElementById("sbNicknameEditInput");
  const nicknameEditStatus = document.getElementById("sbNicknameEditStatus");
  const challengeResult = document.getElementById("sbChallengeResult");
  const challengeResultValue = document.getElementById("sbChallengeResultValue");
  const challengeForm = document.getElementById("sbChallengeForm");
  const challengeNameInput = document.getElementById("sbChallengeName");
  const challengeStatus = document.getElementById("sbChallengeStatus");
  const challengeCloseBtn = document.getElementById("sbChallengeCloseBtn");

  // ---------- persistence ----------
  let totalPunches = 0, bestCombo = 0;
  try { totalPunches = parseInt(localStorage.getItem("sbTotalPunches")||"0",10) || 0; } catch(e){}
  try { bestCombo = parseInt(localStorage.getItem("sbBestCombo")||"0",10) || 0; } catch(e){}
  function saveStats(){
    try {
      localStorage.setItem("sbTotalPunches", String(totalPunches));
      localStorage.setItem("sbBestCombo", String(bestCombo));
    } catch(e){}
  }
  totalIntro.textContent = totalPunches;
  bestIntro.textContent = bestCombo;

  // ---------- 배경 (게이지가 찰수록 뜨거운 색으로) ----------
  const BG_CALM = [11,13,18], BG_HOT = [42,9,22];
  const FLOOR_CALM = [23,26,36], FLOOR_HOT = [58,14,30];
  const BEAM_CALM = [32,36,47], BEAM_HOT = [58,20,34];

  function lerpRGB(a, b, t){
    return [
      Math.round(a[0] + (b[0]-a[0])*t),
      Math.round(a[1] + (b[1]-a[1])*t),
      Math.round(a[2] + (b[2]-a[2])*t)
    ];
  }
  function rgbStr(c, a){ return a===undefined ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

  function drawScene(){
    const t = stress/100;
    const bg = lerpRGB(BG_CALM, BG_HOT, t);
    const floor = lerpRGB(FLOOR_CALM, FLOOR_HOT, t);
    const beam = lerpRGB(BEAM_CALM, BEAM_HOT, t);

    ctx.fillStyle = rgbStr(bg);
    ctx.fillRect(0,0,W,H);

    // 조명 (게이지 높을수록 밝아짐)
    const spot = ctx.createRadialGradient(W/2,H*0.4,20,W/2,H*0.4,H*0.75);
    spot.addColorStop(0, `rgba(255,61,120,${(0.14+t*0.24).toFixed(3)})`);
    spot.addColorStop(0.4, `rgba(52,231,200,${(0.05+t*0.02).toFixed(3)})`);
    spot.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = spot;
    ctx.fillRect(0,0,W,H);

    // 바닥 격자무늬
    ctx.strokeStyle = "rgba(255,255,255,.035)";
    ctx.lineWidth = 1;
    for (let x=-200; x<=W+200; x+=60){
      ctx.beginPath();
      ctx.moveTo(W/2 + (x-W/2)*0.25, H-80);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    // 바닥면
    const floorY = H-80;
    const blend = ctx.createLinearGradient(0, floorY-36, 0, floorY);
    blend.addColorStop(0, "rgba(0,0,0,0)");
    blend.addColorStop(1, rgbStr(floor));
    ctx.fillStyle = blend;
    ctx.fillRect(0, floorY-36, W, 36);
    ctx.fillStyle = rgbStr(floor);
    ctx.fillRect(0, floorY, W, H-floorY);

    // 천장 빔
    ctx.fillStyle = rgbStr(beam);
    ctx.fillRect(W/2-70, 18, 140, 14);
  }

  // ---------- pendulum bag ----------
  const PIVOT = { x: W/2, y: 40 };
  const BAG_LEN = 240; // 중심축 ~ 샌드백 거리
  const BAG_W = 200, BAG_H = 275; // 샌드백 이미지 표시 크기 (원본 비율 유지)
  let angle = 0, angleVel = 0;

  const bagImage = new Image();
  let bagImageReady = false;
  bagImage.onload = () => { bagImageReady = true; };
  bagImage.src = "assets/sandbagrumae.png";

  function stepBag(dt){
    const springK = 15, damping = 3.4;
    const acc = -springK*angle - damping*angleVel;
    angleVel += acc*dt;
    angle += angleVel*dt;
    if (angle > 1.15){ angle = 1.15; if (angleVel>0) angleVel = 0; }
    if (angle < -1.15){ angle = -1.15; if (angleVel<0) angleVel = 0; }
  }

  function bagCenter(){
    return { x: PIVOT.x + Math.sin(angle)*BAG_LEN, y: PIVOT.y + Math.cos(angle)*BAG_LEN };
  }

  function drawBag(){
    const c = bagCenter();
    // 로프
    ctx.strokeStyle = COLORS.rope;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(PIVOT.x, PIVOT.y+7);
    ctx.lineTo(PIVOT.x + Math.sin(angle)*(BAG_LEN-BAG_H*0.42), PIVOT.y + Math.cos(angle)*(BAG_LEN-BAG_H*0.42));
    ctx.stroke();

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(angle);

    // 접지 그림자
    ctx.save();
    ctx.rotate(-angle);
    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.ellipse(0, BAG_H*0.62, BAG_W*0.3, 8, 0, 0, Math.PI*2);
    ctx.fillStyle = "rgba(0,0,0,.5)";
    ctx.fill();
    ctx.restore();

    // 샌드백 이미지
    if (bagImageReady){
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.4)";
      ctx.shadowBlur = 13;
      ctx.shadowOffsetY = 6;
      ctx.drawImage(bagImage, -BAG_W/2, -BAG_H/2, BAG_W, BAG_H);
      ctx.restore();
    }

    ctx.restore();
  }

  // ---------- gloves ----------
  const GLOVE_IDLE_X = 250, GLOVE_Y = 40; // 중심축 기준 위치
  let gloves = {
    left:  { active:false, t:0 },
    right: { active:false, t:0 }
  };
  // 좌우 글러브가 각자 다르게 흔들리도록 하는 파라미터 (생동감용)
  const GLOVE_STYLE = {
    left:  { yOffset:-16, tilt: 0.75, bobAmp:5, bobSpeed:1.6, bobPhase:0.0, swayAmp:0.05, swaySpeed:1.1 },
    right: { yOffset: 10, tilt: -0.55, bobAmp:7, bobSpeed:1.3, bobPhase:1.7, swayAmp:0.07, swaySpeed:0.9 },
  };
  function glovePos(side){
    const g = gloves[side];
    const style = GLOVE_STYLE[side];
    const t = performance.now() / 1000;
    const idleX = side==="left" ? PIVOT.x - GLOVE_IDLE_X : PIVOT.x + GLOVE_IDLE_X;
    const bob = Math.sin(t*style.bobSpeed + style.bobPhase) * style.bobAmp;
    const y = PIVOT.y + BAG_LEN - GLOVE_Y + style.yOffset + bob;
    const sway = Math.sin(t*style.swaySpeed + style.bobPhase) * style.swayAmp;
    if (!g.active) return { x:idleX, y, angle: style.tilt + sway };
    const dur = 0.26;
    const p = Math.min(g.t/dur, 1);
    const curve = p < 0.4 ? easeOutCubic(p/0.4) : 1 - easeInCubic((p-0.4)/0.6);
    const travel = (side==="left" ? 1 : -1) * (GLOVE_IDLE_X - 70) * curve;
    // 팔이 뻗을 때 살짝 더 돌아가는 펀치 킥
    const punchKick = (side==="left" ? -1 : 1) * curve * 0.22;
    return { x: idleX + travel, y, angle: style.tilt + punchKick };
  }
  function easeOutCubic(t){ return 1-Math.pow(1-t,3); }
  function easeInCubic(t){ return t*t*t; }

  // 그라데이션 채우기 + 네온 테두리
  function fillGlossyNeon(cx, cy, rx){
    const g = ctx.createRadialGradient(cx-rx*0.35, cy-rx*0.4, rx*0.15, cx, cy, rx*1.4);
    g.addColorStop(0, COLORS.gloveHi);
    g.addColorStop(0.45, COLORS.glove);
    g.addColorStop(1, COLORS.gloveDark);
    ctx.fillStyle = g;
    ctx.fill();

    ctx.save();
    ctx.shadowColor = COLORS.gloveNeon;
    ctx.shadowBlur = 16;
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.gloveNeon;
    ctx.stroke();
    ctx.stroke(); // double pass — brighter halo
    ctx.restore();

    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,.5)";
    ctx.stroke();
  }

  // 알약 모양 경로 (손목 커프용)
  function roundedCapsule(c,x,y,w,h,r){
    c.beginPath();
    c.moveTo(x+r,y);
    c.arcTo(x+w,y,x+w,y+h,r);
    c.arcTo(x+w,y+h,x,y+h,r);
    c.arcTo(x,y+h,x,y,r);
    c.arcTo(x,y,x+w,y,r);
    c.closePath();
  }

  // 글러브 손등 외곽선
  function traceGloveBody(){
    ctx.beginPath();
    ctx.moveTo(-31, 25);
    ctx.bezierCurveTo(-40, 10, -43, -18, -36, -36);
    ctx.bezierCurveTo(-30, -51, -17, -57, 1, -57);
    ctx.bezierCurveTo(20, -57, 33, -51, 38, -37);
    ctx.bezierCurveTo(44, -19, 41, 8, 31, 25);
    ctx.lineTo(22, 34);
    ctx.lineTo(-23, 34);
    ctx.closePath();
  }

  function drawGlove(side){
    const p = glovePos(side);
    // 각 글러브의 엄지가 화면 중앙을 향하게 한다.
    const inward = side === "left" ? 1 : -1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle || 0);

    // 엄지 (손등보다 먼저 그림)
    ctx.save();
    ctx.scale(inward, 1);
    ctx.beginPath();
    ctx.moveTo(24, 23);
    ctx.bezierCurveTo(38, 17, 48, 2, 51, -16);
    ctx.bezierCurveTo(54, -31, 48, -42, 39, -44);
    ctx.bezierCurveTo(28, -46, 20, -37, 19, -24);
    ctx.bezierCurveTo(18, -7, 23, 9, 24, 23);
    ctx.closePath();
    fillGlossyNeon(35, -15, 25);
    ctx.restore();

    // 넓고 둥근 손등(주먹) 본체
    traceGloveBody();
    fillGlossyNeon(-8, -22, 46);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = COLORS.ink;
    ctx.stroke();

    // 광택 (실루엣 안쪽에만)
    ctx.save();
    traceGloveBody();
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(-13, -30, 17, 10, -0.35, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,.22)";
    ctx.fill();
    ctx.restore();

    // 손목을 감싸는 낮고 넓은 커프
    roundedCapsule(ctx, -34, 27, 68, 30, 10);
    fillGlossyNeon(-7, 37, 38);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = COLORS.ink;
    ctx.stroke();

    // 커프의 네온 스티치
    ctx.save();
    ctx.shadowColor = COLORS.gloveNeon;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = COLORS.gloveNeon;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-25, 33);
    ctx.lineTo(25, 33);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  // ---------- 펀치 큐 / 임팩트 파티클 ----------
  let punchQueue = []; // {side, t, contactAt, applied}
  let particles = []; // onomatopoeia bursts {x,y,t,text,spin}
  let nextSide = "left";
  const ONOMATOPOEIA = ["풉!","푸핫!","꺄핳!","종강!","하!","낄낄!"];

  function triggerPunch(){
    const side = nextSide;
    nextSide = nextSide === "left" ? "right" : "left";
    gloves[side].active = true;
    gloves[side].t = 0;
    punchQueue.push({ side, t:0, contactAt:0.09, applied:false });
    onPunchLanded();
  }

  function stepPunches(dt){
    for (const side of ["left","right"]){
      const g = gloves[side];
      if (g.active){
        g.t += dt;
        if (g.t > 0.26){ g.active = false; g.t = 0; }
      }
    }
    for (const p of punchQueue){
      p.t += dt;
      if (!p.applied && p.t >= p.contactAt){
        p.applied = true;
        applyImpact(p.side);
      }
    }
    punchQueue = punchQueue.filter(p => p.t < 0.3);
    for (const pt of particles) pt.t += dt;
    particles = particles.filter(pt => pt.t < 0.55);
  }

  function applyImpact(side){
    const impulse = 1.0 + Math.random()*0.35;
    angleVel += (side === "left" ? impulse : -impulse);
    const c = bagCenter();
    const px = c.x + (side==="left" ? -BAG_W*0.4 : BAG_W*0.4);
    const py = c.y - 10 + Math.random()*20;
    particles.push({
      x: px, y: py, t: 0,
      text: ONOMATOPOEIA[Math.floor(Math.random()*ONOMATOPOEIA.length)],
      spin: (Math.random()-0.5)*0.5
    });

    for (let i=0;i<4;i++){
      const a = Math.random()*Math.PI*2;
      const spd = 30+Math.random()*50;
      spawnSmoke(px, py, {
        life:0.35+Math.random()*0.2, size:6+Math.random()*6,
        alpha:0.45, grow:1.1,
        vx: Math.cos(a)*spd, vy: Math.sin(a)*spd - 20
      });
    }
  }

  function drawParticles(){
    for (const p of particles){
      const a = 1 - p.t/0.55;
      const scale = 1 + p.t*1.4;
      ctx.save();
      ctx.globalAlpha = Math.max(a,0);
      ctx.translate(p.x, p.y - p.t*46);
      ctx.rotate(p.spin);
      ctx.scale(scale, scale);
      // 별모양 파편
      ctx.beginPath();
      const spikes = 8, rOuter = 20, rInner = 9;
      for (let i=0;i<spikes*2;i++){
        const rr = i%2===0 ? rOuter : rInner;
        const a2 = (i/(spikes*2))*Math.PI*2;
        ctx.lineTo(Math.cos(a2)*rr, Math.sin(a2)*rr);
      }
      ctx.closePath();
      ctx.fillStyle = "#ffc23c";
      ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = COLORS.ink; ctx.stroke();
      ctx.font = "900 20px 'Black Han Sans', sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = COLORS.ink;
      ctx.fillText(p.text, 1, 1);
      ctx.fillStyle = "#ff3d78";
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
  }

  // ---------- 스모크 파티클 ----------
  let smokeParticles = []; // {x,y,t,life,vx,vy,size,alpha,grow}
  let ambientSmokeTimer = 0;

  function spawnSmoke(x, y, opts){
    opts = opts || {};
    smokeParticles.push({
      x, y, t:0,
      life: opts.life || (0.9 + Math.random()*0.6),
      vx: opts.vx !== undefined ? opts.vx : (Math.random()-0.5)*22,
      vy: opts.vy !== undefined ? opts.vy : -(28 + Math.random()*22),
      size: opts.size || (10 + Math.random()*10),
      alpha: opts.alpha !== undefined ? opts.alpha : 0.45,
      grow: opts.grow !== undefined ? opts.grow : 1.6
    });
  }

  function stepSmoke(dt){
    for (const s of smokeParticles){
      s.t += dt;
      s.x += s.vx*dt;
      s.y += s.vy*dt;
      s.vx *= 0.97;
      s.vy *= 0.99;
    }
    smokeParticles = smokeParticles.filter(s => s.t < s.life);

    // 게이지 높을수록 더 자주 발생
    if (!reduceMotion){
      ambientSmokeTimer -= dt;
      if (stress > 12 && ambientSmokeTimer <= 0){
        const c = bagCenter();
        spawnSmoke(c.x + (Math.random()-0.5)*26, c.y - BAG_H*0.46, {
          size: 7 + stress*0.06,
          alpha: 0.18 + stress*0.0022,
          life: 1.0 + Math.random()*0.5
        });
        ambientSmokeTimer = Math.max(0.1, 0.55 - stress*0.0045);
      }
    }
  }

  function drawSmoke(){
    for (const s of smokeParticles){
      const p = s.t / s.life;
      const r = s.size * (1 + p*s.grow);
      const a = s.alpha * (1-p);
      if (a <= 0) continue;
      ctx.save();
      ctx.globalAlpha = a;
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
      g.addColorStop(0, "rgba(255,255,255,.95)");
      g.addColorStop(0.55, "rgba(180,235,225,.5)");
      g.addColorStop(1, "rgba(180,235,225,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ---------- screen shake ----------
  let shakeTime = 0, shakeMag = 0;
  function triggerShake(duration, magnitude){
    if (reduceMotion) return;
    shakeTime = duration;
    shakeMag = magnitude;
  }

  // ---------- state ----------
  let combo = 0, comboTimer = 0;
  let stress = 0;
  let celebrated = false;

  function onPunchLanded(){
    combo += 1;
    comboTimer = 1.3;
    totalPunches += 1;
    unsyncedPunches += 1;
    if (challengeActive) challengePunches += 1;
    if (combo > bestCombo){ bestCombo = combo; }
    stress = Math.min(100, stress + 4.5);
    if (stress >= 100 && !celebrated){
      celebrated = true;
      releaseBurst();
    }
    saveStats();
    updateHud();
  }

  // 게이지 100% 도달 시 스팀 버스트 + 화면 흔들림
  function releaseBurst(){
    triggerShake(0.35, 15);
    const c = bagCenter();
    const puffs = reduceMotion ? 6 : 20;
    for (let i=0;i<puffs;i++){
      const a = Math.random()*Math.PI*2;
      const spd = 55 + Math.random()*95;
      spawnSmoke(c.x, c.y - BAG_H*0.3, {
        life: 0.9 + Math.random()*0.6,
        size: 14 + Math.random()*16,
        alpha: 0.5,
        grow: 2.1,
        vx: Math.cos(a)*spd,
        vy: Math.sin(a)*spd - 55
      });
    }
  }

  function stepMeta(dt){
    if (comboTimer > 0){
      comboTimer -= dt;
      if (comboTimer <= 0){ combo = 0; updateHud(); }
    }
    if (stress > 0){
      stress = Math.max(0, stress - 6*dt);
      if (stress < 100) celebrated = false;
      updateHud();
    }
    if (shakeTime > 0){
      shakeTime = Math.max(0, shakeTime - dt);
    }
  }

  function updateHud(){
    comboN.textContent = combo;
    gaugeN.textContent = Math.round(stress) + "%";
    gaugeFill.style.width = stress + "%";
  }

  // ---------- input ----------
  const IGNORED_KEYS = new Set([
    "Tab","Shift","Control","Alt","Meta","CapsLock","Escape",
    "ArrowUp","ArrowDown","ArrowLeft","ArrowRight",
    "F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12",
    "PageUp","PageDown","Home","End","Insert","Delete",
    "ContextMenu","PrintScreen","ScrollLock","Pause",
    "AudioVolumeUp","AudioVolumeDown","AudioVolumeMute"
  ]);

  let introVisible = true;

  window.addEventListener("keydown", (e) => {
    if (introVisible) return;
    if (IGNORED_KEYS.has(e.key)) return;
    if (e.repeat) return;
    if (e.key === " ") e.preventDefault();
    triggerPunch();
  });

  canvas.addEventListener("pointerdown", () => {
    if (introVisible) return;
    triggerPunch();
  });

  // ---------- intro ----------
  startBtn.addEventListener("click", () => {
    introVisible = false;
    intro.hidden = true;
  });

  // ---------- 글로벌 통계 (펀치를 모았다가 주기적으로 전송) ----------
  let unsyncedPunches = 0;
  let syncingStats = false;

  async function flushGlobalStats(){
    if (syncingStats) return;
    if (!window.Leaderboard || !window.Leaderboard.configured()) return;
    const toSend = unsyncedPunches;
    if (toSend <= 0) return;
    syncingStats = true;
    const res = await window.Leaderboard.reportProgress(toSend, bestCombo);
    syncingStats = false;
    if (res.ok) unsyncedPunches -= toSend; 
  }

  setInterval(flushGlobalStats, 5000);
  document.addEventListener("visibilitychange", () => { if (document.hidden) flushGlobalStats(); });
  window.addEventListener("pagehide", flushGlobalStats);

  async function loadGlobalStats(){
    globalPunchesEl.textContent = "…";
    globalComboEl.textContent = "…";
    rankStatus.textContent = "";
    await flushGlobalStats(); 
    if (!window.Leaderboard || !window.Leaderboard.configured()){
      globalPunchesEl.textContent = "–";
      globalComboEl.textContent = "–";
      rankStatus.textContent = "아직 설정되지 않았어요.";
      return;
    }
    const res = await window.Leaderboard.fetchGlobal();
    if (!res.ok){
      globalPunchesEl.textContent = "–";
      globalComboEl.textContent = "–";
      rankStatus.textContent = "불러오지 못했어요. 잠시 후 다시 시도해주세요.";
      return;
    }
    globalPunchesEl.textContent = res.total.toLocaleString();
    globalComboEl.textContent = res.best + "x";
  }

  function openRank(){
    rankOverlay.hidden = false;
    loadGlobalStats();
  }
  function closeRank(){ rankOverlay.hidden = true; }

  rankBtn.addEventListener("click", openRank);
  rankCloseBtn.addEventListener("click", closeRank);
  rankOverlay.addEventListener("click", (e) => { if (e.target === rankOverlay) closeRank(); });

  // ---------- 60초 챌린지 ----------
  let challengeActive = false;
  let challengeTimeLeft = 0;
  let challengePunches = 0;
  let lastChallengeScore = null;   // 직전 챌린지 점수
  let lastChallengeSubmitted = false;
  let challengeTickPulse = 0;      // 초마다 반짝이는 펄스 (0~1)
  const CHALLENGE_DURATION = 60;

  try { challengeNameInput.value = localStorage.getItem("sbChallengeName") || ""; } catch(e){}

  function updateChallengeButton(){
    if (challengeActive){
      const secs = Math.ceil(challengeTimeLeft);
      challengeBtn.textContent = `⏱ 0:${String(secs).padStart(2,"0")}`;
      challengeBtn.disabled = true;
    } else {
      challengeBtn.textContent = "⏱ CHALLENGE";
      challengeBtn.disabled = false;
    }
  }

  function stepChallenge(dt){
    if (challengeTickPulse > 0) challengeTickPulse = Math.max(0, challengeTickPulse - dt*4.5);
    if (!challengeActive) return;
    const prevSec = Math.ceil(challengeTimeLeft);
    challengeTimeLeft -= dt;
    const curSec = Math.ceil(Math.max(challengeTimeLeft, 0));
    if (curSec !== prevSec){
      updateChallengeButton();
      challengeTickPulse = 1;
      // 마지막 5초는 매초 살짝 흔들림
      if (curSec <= 5 && curSec > 0){
        const dir = curSec % 2 === 0 ? 1 : -1;
        angleVel += dir * 0.26;
      }
    }
    if (challengeTimeLeft <= 0){
      challengeActive = false;
      challengeTimeLeft = 0;
      lastChallengeScore = challengePunches;
      lastChallengeSubmitted = false;
      updateChallengeButton();
      showChallengeResult();
      challengeOverlay.hidden = false;
    }
  }

  function renderChallengeRows(listEl, rows){
    listEl.innerHTML = "";
    if (!rows.length){
      const li = document.createElement("li");
      li.className = "sb-rank-empty";
      li.textContent = "아직 등록된 기록이 없어요 — 첫 번째가 되어보세요!";
      listEl.appendChild(li);
      return;
    }
    rows.forEach((row, i) => {
      const li = document.createElement("li");
      if (i < 3) li.classList.add(`sb-rank-top-${i + 1}`);
      const pos = document.createElement("span");
      pos.className = "sb-rank-pos";
      pos.textContent = "#" + (i+1);
      const name = document.createElement("span");
      name.className = "sb-rank-name";
      name.textContent = row.name;
      const score = document.createElement("span");
      score.className = "sb-rank-score";
      score.textContent = row.punches;
      li.append(pos, name, score);
      listEl.appendChild(li);
    });
  }

  async function loadChallengeList(){
    challengeList.innerHTML = '<li class="sb-rank-empty">Loading…</li>';
    if (!window.Leaderboard || !window.Leaderboard.configured()){
      challengeList.innerHTML = '<li class="sb-rank-empty">아직 설정되지 않았어요 (README.md 참고)</li>';
      return;
    }
    const res = await window.Leaderboard.fetchChallengeTop(10, window.Leaderboard.kstDateStr(0));
    if (!res.ok){
      challengeList.innerHTML = '<li class="sb-rank-empty">불러오지 못했어요. 잠시 후 다시 시도해주세요.</li>';
      return;
    }
    renderChallengeRows(challengeList, res.rows);
  }

  async function loadSideLists(){
    if (!sideListYesterday || !sideListToday) return;
    if (!window.Leaderboard || !window.Leaderboard.configured()){
      sideListYesterday.innerHTML = '<li class="sb-rank-empty">–</li>';
      sideListToday.innerHTML = '<li class="sb-rank-empty">–</li>';
      return;
    }
    const [resY, resT] = await Promise.all([
      window.Leaderboard.fetchChallengeTop(6, window.Leaderboard.kstDateStr(-1)),
      window.Leaderboard.fetchChallengeTop(6, window.Leaderboard.kstDateStr(0))
    ]);
    if (resY.ok) renderChallengeRows(sideListYesterday, resY.rows);
    else sideListYesterday.innerHTML = '<li class="sb-rank-empty">–</li>';
    if (resT.ok) renderChallengeRows(sideListToday, resT.rows);
    else sideListToday.innerHTML = '<li class="sb-rank-empty">–</li>';
  }

  function showChallengeIdle(){
    challengeIdle.hidden = false;
    challengeResult.hidden = true;
    challengeStatus.textContent = "";
    loadChallengeList();
  }

  function showChallengeResult(){
    challengeIdle.hidden = true;
    challengeResult.hidden = false;
    challengeStatus.textContent = "";
    challengeResultValue.textContent = lastChallengeScore;
  }

  function openChallenge(){
    challengeOverlay.hidden = false;
    if (lastChallengeScore !== null && !lastChallengeSubmitted){
      showChallengeResult();
    } else {
      showChallengeIdle();
    }
  }
  function closeChallenge(){ challengeOverlay.hidden = true; }

  function startChallenge(){
    challengeActive = true;
    challengeTimeLeft = CHALLENGE_DURATION;
    challengePunches = 0;
    lastChallengeScore = null;
    updateChallengeButton();
    challengeOverlay.hidden = true;
  }

  challengeBtn.addEventListener("click", openChallenge);
  challengeCloseBtn.addEventListener("click", closeChallenge);
  challengeOverlay.addEventListener("click", (e) => { if (e.target === challengeOverlay) closeChallenge(); });
  challengeStartBtn.addEventListener("click", startChallenge);

  challengeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!window.Leaderboard || !window.Leaderboard.configured()){
      challengeStatus.textContent = "아직 설정되지 않았어요 (README.md 참고)";
      return;
    }
    const name = challengeNameInput.value.trim();
    if (!name){
      challengeStatus.textContent = "닉네임을 입력해주세요.";
      return;
    }
    try { localStorage.setItem("sbChallengeName", name); } catch(err){}
    challengeStatus.textContent = "등록 중…";
    const res = await window.Leaderboard.submitChallengeScore(name, lastChallengeScore);
    if (!res.ok){
      challengeStatus.textContent = "등록에 실패했어요. 잠시 후 다시 시도해주세요.";
      return;
    }
    lastChallengeSubmitted = true;
    showChallengeIdle();
    loadSideLists();
  });

  nicknameEditBtn.addEventListener("click", () => {
    nicknameEditForm.hidden = !nicknameEditForm.hidden;
    nicknameEditStatus.textContent = "";
    if (!nicknameEditForm.hidden){
      let stored = "";
      try { stored = localStorage.getItem("sbChallengeName") || ""; } catch(err){}
      nicknameEditInput.value = stored;
      nicknameEditInput.focus();
    }
  });

  nicknameEditForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    let oldName = "";
    try { oldName = localStorage.getItem("sbChallengeName") || ""; } catch(err){}
    const newName = nicknameEditInput.value.trim();
    if (!oldName){
      nicknameEditStatus.textContent = "오늘 등록된 기록이 없어요.";
      return;
    }
    if (!newName){
      nicknameEditStatus.textContent = "새 닉네임을 입력해주세요.";
      return;
    }
    if (!window.Leaderboard || !window.Leaderboard.configured()){
      nicknameEditStatus.textContent = "아직 설정되지 않았어요.";
      return;
    }
    nicknameEditStatus.textContent = "변경 중…";
    const res = await window.Leaderboard.renameChallengeScore(oldName, newName);
    if (!res.ok){
      nicknameEditStatus.textContent = "변경에 실패했어요. 오늘 등록한 기록이 맞는지 확인해주세요.";
      return;
    }
    try { localStorage.setItem("sbChallengeName", newName); } catch(err){}
    challengeNameInput.value = newName;
    nicknameEditForm.hidden = true;
    loadSideLists();
    loadChallengeList();
  });

  loadSideLists();
  setInterval(loadSideLists, 20000);

  // 챌린지 카운트다운 (10초 이하면 빨강, 5초 이하면 확대)
  function drawChallengeCountdown(){
    if (!challengeActive) return;
    const secs = Math.max(0, Math.ceil(challengeTimeLeft));
    const urgent = secs <= 10;
    const critical = secs <= 5;

    let scale = 1;
    if (critical){
      const t = 1 - (secs / 5); // 5초 남았을 때 0, 0초일 때 1
      scale = 1 + t * 0.85;
    }
    const pop = 1 + challengeTickPulse * 0.4;
    const size = Math.round(44 * scale * pop);

    const glowRGB = urgent ? "255,45,60" : "255,255,255";
    const fill = urgent ? "#ff2d3c" : "#eef1f7";

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${size}px 'Press Start 2P', monospace`;
    ctx.shadowColor = `rgba(${glowRGB},.95)`;
    ctx.shadowBlur = 20 + challengeTickPulse * 22;
    ctx.fillStyle = fill;
    ctx.fillText(String(secs), W/2, 112);
    // 번짐 효과용 2차 렌더
    ctx.shadowBlur = 42 + challengeTickPulse * 30;
    ctx.globalAlpha = 0.55;
    ctx.fillText(String(secs), W/2, 112);
    ctx.restore();
  }

  // ---------- sizing ----------
  function fitCanvas(){
    const rect = stage.getBoundingClientRect();
    const scale = Math.min(rect.width / W, rect.height / H);
    const cssW = W*scale, cssH = H*scale;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW*dpr);
    canvas.height = Math.round(cssH*dpr);
    ctx.setTransform(dpr*scale, 0, 0, dpr*scale, 0, 0);
  }
  window.addEventListener("resize", fitCanvas);
  if (window.ResizeObserver) new ResizeObserver(fitCanvas).observe(stage);

  // ---------- loop ----------
  let lastTs = 0;
  function render(){
    ctx.clearRect(0,0,W,H);
    ctx.save();
    if (shakeTime > 0){
      ctx.translate((Math.random()-0.5)*shakeMag, (Math.random()-0.5)*shakeMag);
    }
    drawScene();
    drawBag();
    drawGlove("left");
    drawGlove("right");
    drawSmoke();
    drawParticles();
    drawChallengeCountdown();
    ctx.restore();
  }
  function loop(ts){
    const dt = Math.min((ts-lastTs)/1000, 1/30);
    lastTs = ts;
    stepBag(dt);
    stepPunches(dt);
    stepSmoke(dt);
    stepMeta(dt);
    stepChallenge(dt);
    render();
    requestAnimationFrame(loop);
  }

  function boot(){
    fitCanvas();
    updateHud();
    lastTs = performance.now();
    requestAnimationFrame(loop);
  }

  if (document.fonts && document.fonts.ready){
    document.fonts.load("20px 'Black Han Sans'");
    document.fonts.ready.then(boot).catch(boot);
  } else {
    boot();
  }
})();
