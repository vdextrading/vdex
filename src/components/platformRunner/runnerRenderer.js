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
  const swing = hero.grounded ? Math.sin(tRun * 4.2) : Math.sin(tRun * 2.3) * 0.25;

  const hr = cfg?.heroRender || {};
  const bodyX = hx + hero.w * (Number(hr.bodyXMul) || 0.52);
  const bodyY = hy + hero.h * (Number(hr.bodyYMul) || 0.5);
  const headR = Number(hr.headR) || 10.5;
  const torsoW = Number(hr.torsoW) || 14;
  const torsoH = Number(hr.torsoH) || 21;
  const wheelR = Number(hr.wheelR) || Math.max(9, Math.min(12, hero.h * 0.24));
  const wheelCX = bodyX;
  const wheelCY = hy + hero.h - wheelR - (Number(hr.wheelBottomPad) || 1.5);
  const wheelSpin = tRun * (Number(hr.wheelSpinMul) || 10.5) + (hero.grounded ? 0 : (Number(hr.wheelAirSpinOffset) || 0.65));

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
  ctx.restore();

  const hipX = bodyX;
  const hipY = wheelCY - wheelR - (Number(hr.hipGap) || 0.5);

  ctx.fillStyle = outline;
  roundRectPath(ctx, hipX - torsoW / 2 - 1, bodyY - torsoH / 2 + 5, torsoW + 2, torsoH + 2, 7);
  ctx.fill();

  const torsoGrad = ctx.createLinearGradient(0, bodyY - 10, 0, bodyY + 24);
  torsoGrad.addColorStop(0, 'rgba(255,255,255,0.12)');
  torsoGrad.addColorStop(0.3, primarySoft);
  torsoGrad.addColorStop(1, 'rgba(2,6,23,0.18)');
  ctx.fillStyle = torsoGrad;
  roundRectPath(ctx, hipX - torsoW / 2, bodyY - torsoH / 2 + 6, torsoW, torsoH, 6);
  ctx.fill();

  // Cintura em perfil conectando tronco e roda
  ctx.fillStyle = 'rgba(250,204,21,0.88)';
  roundRectPath(ctx, hipX - 5, hipY - 2.5, 10, 5, 2);
  ctx.fill();

  ctx.save();
  ctx.shadowColor = 'rgba(59,130,246,0.35)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = outline;
  ctx.beginPath();
  ctx.ellipse(hipX + 1.5, hy + headR + 1.5, headR + 1.2, headR - 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  const headGrad = ctx.createRadialGradient(hipX + 4.5, hy + headR - 2, 2.5, hipX + 1, hy + headR + 2, headR + 2);
  headGrad.addColorStop(0, 'rgba(255,255,255,0.20)');
  headGrad.addColorStop(0.35, primary);
  headGrad.addColorStop(1, 'rgba(2,6,23,0.20)');
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.ellipse(hipX + 1.5, hy + headR + 1.8, headR, headR - 0.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Perfil voltado para direita: um olho principal e "nariz" discreto
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(hipX + 5.2, hy + headR + 1.3, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(2,6,23,0.8)';
  ctx.beginPath();
  ctx.arc(hipX + 5.3, hy + headR + 1.4, 0.78, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(226,232,240,0.65)';
  roundRectPath(ctx, hipX + 7.2, hy + headR + 1.2, 2.8, 1.4, 0.7);
  ctx.fill();
  ctx.restore();

  const armLen = 14;
  const armY = bodyY + 8;
  const armSwing = swing * 0.8;

  const drawLimb = (sx, sy, len, ang, color, width = 4.2, handR = 2.9, alpha = 1) => {
    const ex = sx + Math.cos(ang) * len;
    const ey = sy + Math.sin(ang) * len;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    ctx.fillStyle = 'rgba(226,232,240,0.92)';
    ctx.beginPath();
    ctx.arc(ex, ey, handR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Braço de trás (mais suave) + braço principal em perfil
  drawLimb(hipX - 2, armY, armLen - 1, Math.PI + 0.4 + armSwing * 0.5, 'rgba(56,189,248,0.55)', 3.4, 2.6, 0.55);
  drawLimb(hipX + 3, armY, armLen, -0.2 - armSwing, accent, 4.4, 2.9, 1);

  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = 'rgba(2,6,23,0.65)';
  ctx.fillRect(0, 0, w, 54);
  ctx.restore();
};
