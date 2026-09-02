(() => {
  "use strict";
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const W = 860, H = 640;
  const COLORS = {
    ink:"#0c0a10", // dark outline for bag/gloves/doodle — not the HUD text color
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

  // ---------- scene background: shifts hue with the stress gauge ----------
  // calm (empty gauge) → hot (full gauge), like the room heating up as you punch
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

    // overhead spotlight — glows hotter as the gauge fills
    const spot = ctx.createRadialGradient(W/2,H*0.4,20,W/2,H*0.4,H*0.75);
    spot.addColorStop(0, `rgba(255,61,120,${(0.14+t*0.24).toFixed(3)})`);
    spot.addColorStop(0.4, `rgba(52,231,200,${(0.05+t*0.02).toFixed(3)})`);
    spot.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = spot;
    ctx.fillRect(0,0,W,H);

    // faint floor grid, receding toward the bag
    ctx.strokeStyle = "rgba(255,255,255,.035)";
    ctx.lineWidth = 1;
    for (let x=-200; x<=W+200; x+=60){
      ctx.beginPath();
      ctx.moveTo(W/2 + (x-W/2)*0.25, H-80);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    // floor — blended softly into the background, no hard seam/box
    const floorY = H-80;
    const blend = ctx.createLinearGradient(0, floorY-36, 0, floorY);
    blend.addColorStop(0, "rgba(0,0,0,0)");
    blend.addColorStop(1, rgbStr(floor));
    ctx.fillStyle = blend;
    ctx.fillRect(0, floorY-36, W, 36);
    ctx.fillStyle = rgbStr(floor);
    ctx.fillRect(0, floorY, W, H-floorY);

    // ceiling beam
    ctx.fillStyle = rgbStr(beam);
    ctx.fillRect(W/2-70, 18, 140, 14);
  }

  // ---------- pendulum bag ----------
  const PIVOT = { x: W/2, y: 40 };
  const BAG_LEN = 240; // pivot to bag center
  const BAG_W = 96, BAG_H = 190;
  let angle = 0, angleVel = 0;
  let hitFlash = 0; // face reaction timer

  function stepBag(dt){
    const springK = 15, damping = 3.4;
    const acc = -springK*angle - damping*angleVel;
    angleVel += acc*dt;
    angle += angleVel*dt;
    if (angle > 1.15){ angle = 1.15; if (angleVel>0) angleVel = 0; }
    if (angle < -1.15){ angle = -1.15; if (angleVel<0) angleVel = 0; }
    if (hitFlash > 0) hitFlash -= dt;
  }

  function bagCenter(){
    return { x: PIVOT.x + Math.sin(angle)*BAG_LEN, y: PIVOT.y + Math.cos(angle)*BAG_LEN };
  }

  function drawBag(){
    const c = bagCenter();
    // rope
    ctx.strokeStyle = COLORS.rope;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(PIVOT.x, PIVOT.y+7);
    ctx.lineTo(PIVOT.x + Math.sin(angle)*(BAG_LEN-BAG_H*0.42), PIVOT.y + Math.cos(angle)*(BAG_LEN-BAG_H*0.42));
    ctx.stroke();

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(angle);

    // shadow beneath — soft-blurred so the bag reads as lifted off the floor
    ctx.save();
    ctx.rotate(-angle);
    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.ellipse(0, BAG_H*0.62, BAG_W*0.5, 14, 0, 0, Math.PI*2);
    ctx.fillStyle = "rgba(0,0,0,.5)";
    ctx.fill();
    ctx.restore();

    // capsule body — multi-stop gradient with an off-centre highlight band,
    // like a glossy vinyl toy lit from the upper left
    const r = BAG_W/2;
    roundedCapsule(ctx, -BAG_W/2, -BAG_H/2, BAG_W, BAG_H, r);
    const grad = ctx.createLinearGradient(-BAG_W/2,0,BAG_W/2,0);
    grad.addColorStop(0, COLORS.bagShade);
    grad.addColorStop(0.22, COLORS.bagDark);
    grad.addColorStop(0.48, COLORS.bagHi);
    grad.addColorStop(0.62, COLORS.bag);
    grad.addColorStop(1, COLORS.bagDark);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.5)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLORS.ink;
    ctx.stroke();

    // thin white headband — a line wrapped around the head
    const bandBottom = -BAG_H/2 + r*1.0;
    const bandTop = bandBottom - 25;
    ctx.save();
    roundedCapsule(ctx, -BAG_W/2, -BAG_H/2, BAG_W, BAG_H, r);
    ctx.clip();
    const bandGrad = ctx.createLinearGradient(-BAG_W/2,0,BAG_W/2,0);
    bandGrad.addColorStop(0, "#b9b9c1");
    bandGrad.addColorStop(0.22, "#e2e2ea");
    bandGrad.addColorStop(0.48, "#ffffff");
    bandGrad.addColorStop(0.62, "#eceaf0");
    bandGrad.addColorStop(1, "#a9a9b2");
    ctx.fillStyle = bandGrad;
    ctx.fillRect(-BAG_W/2-4, bandTop, BAG_W+8, bandBottom-bandTop);
    ctx.restore();
    // crisp ink edges top and bottom of the stripe
    ctx.beginPath();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2.5;
    ctx.moveTo(-BAG_W/2, bandTop); ctx.lineTo(BAG_W/2, bandTop);
    ctx.moveTo(-BAG_W/2, bandBottom); ctx.lineTo(BAG_W/2, bandBottom);
    ctx.stroke();

    // glossy specular streak — the "3D" highlight that sells the volume
    ctx.save();
    roundedCapsule(ctx, -BAG_W/2, -BAG_H/2, BAG_W, BAG_H, r);
    ctx.clip();
    const shine = ctx.createLinearGradient(-BAG_W*0.05,-BAG_H/2,BAG_W*0.18,BAG_H*0.1);
    shine.addColorStop(0, "rgba(255,255,255,.55)");
    shine.addColorStop(0.5, "rgba(255,255,255,.12)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.ellipse(-BAG_W*0.16, -BAG_H*0.22, BAG_W*0.22, BAG_H*0.32, -0.35, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // seams — start below the wrap band so they don't cut through the cloth
    ctx.strokeStyle = "rgba(20,4,4,.45)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-BAG_W/2+6, bandBottom+6); ctx.lineTo(-BAG_W/2+6, BAG_H/2-r*0.6);
    ctx.moveTo(BAG_W/2-6, bandBottom+6); ctx.lineTo(BAG_W/2-6, BAG_H/2-r*0.6);
    ctx.stroke();

    // doodle face
    const wince = hitFlash > 0;
    ctx.fillStyle = COLORS.ink;
    const eyeY = -18;
    if (wince){
      drawX(ctx, -22, eyeY, 8);
      drawX(ctx, 22, eyeY, 8);
      ctx.beginPath();
      ctx.arc(0, 14, 12, 0.15*Math.PI, 0.85*Math.PI);
      ctx.lineWidth = 3.5; ctx.strokeStyle = COLORS.ink; ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(-22, eyeY, 5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(22, eyeY, 5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 6, 14, 0.1*Math.PI, 0.9*Math.PI);
      ctx.lineWidth = 3.5; ctx.strokeStyle = COLORS.ink; ctx.stroke();
    }
    ctx.restore();
  }

  function drawX(c,x,y,s){
    c.save();
    c.strokeStyle = COLORS.ink; c.lineWidth = 3;
    c.beginPath(); c.moveTo(x-s/2,y-s/2); c.lineTo(x+s/2,y+s/2);
    c.moveTo(x+s/2,y-s/2); c.lineTo(x-s/2,y+s/2);
    c.stroke();
    c.restore();
  }

  function roundedCapsule(c,x,y,w,h,r){
    c.beginPath();
    c.moveTo(x+r,y);
    c.arcTo(x+w,y,x+w,y+h,r);
    c.arcTo(x+w,y+h,x,y+h,r);
    c.arcTo(x,y+h,x,y,r);
    c.arcTo(x,y,x+w,y,r);
    c.closePath();
  }

  // ---------- gloves ----------
  const GLOVE_IDLE_X = 250, GLOVE_Y = 40; // relative to pivot
  let gloves = {
    left:  { active:false, t:0 },
    right: { active:false, t:0 }
  };
  function glovePos(side){
    const g = gloves[side];
    const idleX = side==="left" ? PIVOT.x - GLOVE_IDLE_X : PIVOT.x + GLOVE_IDLE_X;
    const y = PIVOT.y + BAG_LEN - GLOVE_Y;
    if (!g.active) return { x:idleX, y };
    const dur = 0.26;
    const p = Math.min(g.t/dur, 1);
    const curve = p < 0.4 ? easeOutCubic(p/0.4) : 1 - easeInCubic((p-0.4)/0.6);
    const travel = (side==="left" ? 1 : -1) * (GLOVE_IDLE_X - 70) * curve;
    return { x: idleX + travel, y };
  }
  function easeOutCubic(t){ return 1-Math.pow(1-t,3); }
  function easeInCubic(t){ return t*t*t; }

  // fills the current path with a black→highlight gradient, then rims it
  // with a soft neon glow plus a crisp bright edge — black rubber with neon
  // piping, lit like a glossy 3D figure
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

  function drawGlove(side){
    const p = glovePos(side);
    ctx.save();
    ctx.translate(p.x, p.y);

    // thumb (drawn first so the main fist overlaps its base)
    const tx = side==="left" ? 20 : -20;
    ctx.beginPath();
    ctx.ellipse(tx, -18, 12, 16, 0, 0, Math.PI*2);
    fillGlossyNeon(tx, -18, 13);

    // main fist
    ctx.beginPath();
    ctx.arc(0,0,34,0,Math.PI*2);
    fillGlossyNeon(0, 0, 34);
    // crisp dark outline on top so the shape reads clean under the glow
    ctx.lineWidth = 2.5; ctx.strokeStyle = COLORS.ink; ctx.stroke();

    // glossy specular highlight
    ctx.save();
    ctx.beginPath();
    ctx.arc(0,0,34,0,Math.PI*2);
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(-11,-13,14,10,-0.4,0,Math.PI*2);
    ctx.fillStyle = "rgba(255,255,255,.22)";
    ctx.fill();
    ctx.restore();

    // cuff
    const cx = side==="left" ? 28 : -28;
    ctx.beginPath();
    ctx.ellipse(cx, 6, 14, 24, 0, 0, Math.PI*2);
    fillGlossyNeon(cx, 6, 16);
    ctx.lineWidth = 2.5; ctx.strokeStyle = COLORS.ink; ctx.stroke();

    // neon stitch detail
    ctx.save();
    ctx.shadowColor = COLORS.gloveNeon;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = COLORS.gloveNeon;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx-6,-2); ctx.lineTo(cx+6,2); ctx.moveTo(cx-6,10); ctx.lineTo(cx+6,14); ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  // ---------- punch queue / impact particles ----------
  let punchQueue = []; // {side, t, contactAt, applied}
  let particles = []; // onomatopoeia bursts {x,y,t,text,spin}
  let nextSide = "left";
  const ONOMATOPOEIA = ["퍽!","퍽퍽!","빡!","카악!","텅!","훅!","슉!"];

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
    hitFlash = 0.32;
    const c = bagCenter();
    const px = c.x + (side==="left" ? -BAG_W*0.4 : BAG_W*0.4);
    const py = c.y - 10 + Math.random()*20;
    particles.push({
      x: px, y: py, t: 0,
      text: ONOMATOPOEIA[Math.floor(Math.random()*ONOMATOPOEIA.length)],
      spin: (Math.random()-0.5)*0.5
    });
    // little dust puff at the contact point — tactile "stress knocked loose" feel
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
      // burst shape
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

  // ---------- steam / smoke: the stress visibly "blowing off" the bag ----------
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

    // ambient wisps rise off the bag as the stress gauge fills — more, and
    // faster, the closer you get to a full release
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

  // ---------- combo / gauge state ----------
  let combo = 0, comboTimer = 0;
  let stress = 0;
  let celebrated = false;

  function onPunchLanded(){
    combo += 1;
    comboTimer = 1.3;
    totalPunches += 1;
    unsyncedPunches += 1;
    if (combo > bestCombo){ bestCombo = combo; }
    stress = Math.min(100, stress + 4.5);
    if (stress >= 100 && !celebrated){
      celebrated = true;
      releaseBurst();
    }
    saveStats();
    updateHud();
  }

  // the moment — a burst of steam blowing off the bag
  // plus a satisfying screen shake, instead of a text popup
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

  // ---------- global stats ----------
  // punches are batched locally and flushed periodically so mashing keys
  // doesn't fire a network request per punch
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
    await flushGlobalStats(); // push anything pending first so this feels current
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
    ctx.restore();
  }
  function loop(ts){
    const dt = Math.min((ts-lastTs)/1000, 1/30);
    lastTs = ts;
    stepBag(dt);
    stepPunches(dt);
    stepSmoke(dt);
    stepMeta(dt);
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
