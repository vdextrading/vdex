const roundRectPath = (ctx, x, y, w, h, r) => {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
};

export const drawRunner = (ctx, state, cfg) => {
  const num = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const w = state.width;
  const h = state.height;
  const floorY = h - cfg.floorPad;

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#020617');
  bg.addColorStop(0.55, '#0b1224');
  bg.addColorStop(1, '#0f172a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = '#1f2a44';
  ctx.lineWidth = 1;
  const step = 34;
  const off = (state.camX * 0.35) % step;
  for (let x = -off; x < w + step; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = 'rgba(59,130,246,0.12)';
  ctx.fillRect(0, floorY, w, cfg.floorPad);

  for (const p of state.platforms) {
    const x = p.x - state.camX;
    if (x + p.w < -80 || x > w + 80) continue;
    ctx.fillStyle = p.kind === 'floor' ? 'rgba(148,163,184,0.20)' : 'rgba(148,163,184,0.14)';
    ctx.fillRect(x, p.y, p.w, p.h);
    ctx.fillStyle = 'rgba(59,130,246,0.16)';
    ctx.fillRect(x, p.y, p.w, 2);
  }

  for (const o of state.obstacles) {
    const x = o.x - state.camX;
    if (x + o.w < -80 || x > w + 80) continue;
    if (o.kind === 'spike') {
      ctx.fillStyle = 'rgba(244,63,94,0.95)';
      ctx.beginPath();
      ctx.moveTo(x, o.y + o.h);
      ctx.lineTo(x + o.w / 2, o.y);
      ctx.lineTo(x + o.w, o.y + o.h);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(239,68,68,0.85)';
      ctx.fillRect(x, o.y, o.w, o.h);
    }
  }

  for (const it of state.items) {
    const x = it.x - state.camX;
    if (x + it.r < -80 || x - it.r > w + 80) continue;
    it.pulse = (Number(it.pulse) || 0) + 0.08;
    const glow = 6 + Math.sin(it.pulse) * 2.2;
    ctx.save();
    ctx.shadowColor = 'rgba(250,204,21,0.75)';
    ctx.shadowBlur = glow;
    ctx.fillStyle = 'rgba(250,204,21,0.95)';
    ctx.beginPath();
    ctx.arc(x, it.y, it.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(x - 3, it.y - 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const hero = state.hero;
  const hx = hero.x - state.camX;
  const hy = hero.y;
  const tRun = hero.runT;
  const hr = cfg?.heroRender || {};
  const swingGroundFreq = num(hr.swingGroundFreq, 4.8);
  const swingAirFreq = num(hr.swingAirFreq, 2.6);
  const swingAirAmp = num(hr.swingAirAmp, 0.32);
  const swingIntensity = num(hr.swingIntensity, 1);
  const armSwingMul = num(hr.armSwingMul, 0.95);
  const swingBase = hero.grounded ? Math.sin(tRun * swingGroundFreq) : Math.sin(tRun * swingAirFreq) * swingAirAmp;
  const swing = swingBase * swingIntensity;

  const bodyX = hx + hero.w * num(hr.bodyXMul, 0.52);
  const bodyY = hy + hero.h * num(hr.bodyYMul, 0.5);
  const headR = num(hr.headR, 10.5);
  const torsoW = num(hr.torsoW, 14);
  const torsoH = num(hr.torsoH, 21);
  const wheelR = num(hr.wheelR, Math.max(9, Math.min(12, hero.h * 0.24)));
  const wheelCX = bodyX;
  const wheelCY = hy + hero.h - wheelR - num(hr.wheelBottomPad, 1.5);
  const wheelSpin = tRun * num(hr.wheelSpinMul, 10.5) + (hero.grounded ? 0 : num(hr.wheelAirSpinOffset, 0.65));
  const torsoLean = num(hr.torsoLeanBase, 0.16) + Math.abs(swing) * num(hr.torsoLeanSwingMul, 0.04);

  const outline = 'rgba(2,6,23,0.65)';
  const primary = '#0ea5e9';
  const primarySoft = 'rgba(14,165,233,0.92)';
  const accent = 'rgba(56,189,248,0.85)';

  ctx.fillStyle = 'rgba(15,23,42,0.55)';
  ctx.beginPath();
  const shadowY = hero.grounded ? (hy + hero.h + 8) : (floorY + 8);
  ctx.ellipse(bodyX + 2, shadowY, 20, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.shadowColor = 'rgba(56,189,248,0.45)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = outline;
  ctx.beginPath();
  ctx.arc(wheelCX, wheelCY, wheelR + 1.5, 0, Math.PI * 2);
  ctx.fill();

  const wheelGrad = ctx.createRadialGradient(wheelCX - 2, wheelCY - 3, 2, wheelCX, wheelCY, wheelR + 1);
  wheelGrad.addColorStop(0, 'rgba(186,230,253,0.55)');
  wheelGrad.addColorStop(0.4, primarySoft);
  wheelGrad.addColorStop(1, 'rgba(2,6,23,0.88)');
  ctx.fillStyle = wheelGrad;
  ctx.beginPath();
  ctx.arc(wheelCX, wheelCY, wheelR, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = 'rgba(186,230,253,0.82)';
  ctx.lineWidth = 1.8;
  for (let i = 0; i < 4; i++) {
    const a = wheelSpin + i * (Math.PI / 2);
    const ex = wheelCX + Math.cos(a) * (wheelR - 2);
    const ey = wheelCY + Math.sin(a) * (wheelR - 2);
    ctx.beginPath();
    ctx.moveTo(wheelCX, wheelCY);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(2,6,23,0.9)';
  ctx.beginPath();
  ctx.arc(wheelCX, wheelCY, 2.3, 0, Math.PI * 2);
  ctx.fill();

  // Rastro curto para aumentar percepção de giro da roda.
  ctx.strokeStyle = 'rgba(186,230,253,0.45)';
  ctx.lineWidth = 1.2;
  const wheelTrailCount = Math.max(0, Math.floor(num(hr.wheelTrailCount, 3)));
  const wheelTrailStep = num(hr.wheelTrailStep, 0.9);
  const wheelTrailOffsetMul = num(hr.wheelTrailOffsetMul, 0.62);
  const wheelTrailRadiusMul = num(hr.wheelTrailRadiusMul, 0.36);
  const wheelTrailArcStart = num(hr.wheelTrailArcStart, 0.6);
  const wheelTrailArcSpan = num(hr.wheelTrailArcSpan, 0.8);
  for (let i = 0; i < wheelTrailCount; i++) {
    const a = wheelSpin + i * wheelTrailStep;
    const px = wheelCX - Math.cos(a) * (wheelR * wheelTrailOffsetMul);
    const py = wheelCY - Math.sin(a) * (wheelR * wheelTrailOffsetMul);
    ctx.beginPath();
    ctx.arc(px, py, wheelR * wheelTrailRadiusMul, a + wheelTrailArcStart, a + wheelTrailArcStart + wheelTrailArcSpan);
    ctx.stroke();
  }
  ctx.restore();

  const hipX = bodyX;
  const hipY = wheelCY - wheelR - num(hr.hipGap, 0.5);

  // Tronco em perfil levemente inclinado para frente (corrida para direita).
  ctx.save();
  const torsoPivotX = hipX;
  const torsoPivotY = bodyY + 8;
  ctx.translate(torsoPivotX, torsoPivotY);
  ctx.rotate(torsoLean);
  ctx.fillStyle = outline;
  roundRectPath(ctx, -torsoW / 2 - 1, -torsoH / 2 - 3, torsoW + 2, torsoH + 2, 7);
  ctx.fill();

  const torsoGrad = ctx.createLinearGradient(0, -torsoH / 2 - 6, 0, torsoH / 2 + 6);
  torsoGrad.addColorStop(0, 'rgba(255,255,255,0.14)');
  torsoGrad.addColorStop(0.32, primarySoft);
  torsoGrad.addColorStop(1, 'rgba(2,6,23,0.22)');
  ctx.fillStyle = torsoGrad;
  roundRectPath(ctx, -torsoW / 2, -torsoH / 2 - 2, torsoW, torsoH, 6);
  ctx.fill();
  ctx.restore();

  // Cintura em perfil conectando tronco e roda
  ctx.fillStyle = 'rgba(250,204,21,0.88)';
  roundRectPath(ctx, hipX - 5, hipY - 2.5, 10, 5, 2);
  ctx.fill();

  // Cabeça em perfil para direita, alinhada com inclinação do tronco.
  const neckX = hipX + 1.5;
  const neckY = bodyY - torsoH * 0.27;
  const headCX = neckX + 4.5;
  const headCY = hy + headR + 2.4;
  ctx.save();
  ctx.shadowColor = 'rgba(59,130,246,0.35)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = outline;
  ctx.beginPath();
  ctx.ellipse(headCX, headCY, headR + 1.2, headR - 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  const headGrad = ctx.createRadialGradient(headCX + 3.4, headCY - 3.4, 2.3, headCX, headCY + 1.8, headR + 2);
  headGrad.addColorStop(0, 'rgba(255,255,255,0.2)');
  headGrad.addColorStop(0.38, primary);
  headGrad.addColorStop(1, 'rgba(2,6,23,0.22)');
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.ellipse(headCX, headCY, headR, headR - 0.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pescoço
  ctx.fillStyle = 'rgba(186,230,253,0.85)';
  roundRectPath(ctx, neckX, neckY, 4.2, 6.2, 1.4);
  ctx.fill();

  // Face lateral: olho, pupila e nariz.
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.arc(headCX + 3.7, headCY - 0.25, 1.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(2,6,23,0.86)';
  ctx.beginPath();
  ctx.arc(headCX + 3.85, headCY - 0.2, 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(226,232,240,0.72)';
  roundRectPath(ctx, headCX + headR - 0.3, headCY - 0.7, 3.1, 1.5, 0.7);
  ctx.fill();
  ctx.restore();

  const armLen = 14;
  const shoulderX = hipX + 2;
  const shoulderY = bodyY + 2;
  const armSwing = swing * armSwingMul;

  const drawArm = (sx, sy, len, upperAng, foreAng, color, width = 4.2, handR = 2.9, alpha = 1) => {
    const elbowX = sx + Math.cos(upperAng) * (len * 0.56);
    const elbowY = sy + Math.sin(upperAng) * (len * 0.56);
    const ex = elbowX + Math.cos(foreAng) * (len * 0.48);
    const ey = elbowY + Math.sin(foreAng) * (len * 0.48);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(elbowX, elbowY);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    ctx.fillStyle = 'rgba(226,232,240,0.92)';
    ctx.beginPath();
    ctx.arc(ex, ey, handR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Braço traseiro e braço principal em postura de corrida (perfil direita).
  drawArm(
    shoulderX - 4,
    shoulderY + 1,
    armLen - 1,
    Math.PI + 0.62 + armSwing * 0.45,
    Math.PI + 0.28 + armSwing * 0.2,
    'rgba(56,189,248,0.55)',
    3.3,
    2.5,
    0.58
  );
  drawArm(
    shoulderX + 1,
    shoulderY,
    armLen,
    -0.25 - armSwing,
    0.12 - armSwing * 0.58,
    accent,
    4.4,
    2.95,
    1
  );

  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = 'rgba(2,6,23,0.65)';
  ctx.fillRect(0, 0, w, 54);
  ctx.restore();
};
