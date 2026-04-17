export const RUNNER_MAX_TIME = 120;

export const defaultRunnerConfig = {
  gravity: 1400,
  jumpV: -560,
  jumpBufferMs: 110,
  speedStart: 260,
  speedMax: 520,
  obstacleEveryMin: 0.9,
  obstacleEveryMax: 1.5,
  sparkEveryMin: 0.35,
  sparkEveryMax: 0.65,
  platformEveryMin: 1.15,
  platformEveryMax: 1.9,
  floorPad: 68,
  hero: { w: 34, h: 38 },
  heroRender: {
    bodyXMul: 0.52,
    bodyYMul: 0.5,
    headR: 10.5,
    torsoW: 14,
    torsoH: 21,
    wheelR: 11,
    wheelBottomPad: 1.5,
    hipGap: 0.5
  }
};

export const createRunnerEngine = (cfgInput) => {
  const cfg = {
    ...defaultRunnerConfig,
    ...(cfgInput || {}),
    hero: { ...defaultRunnerConfig.hero, ...(cfgInput?.hero || {}) },
    heroRender: { ...defaultRunnerConfig.heroRender, ...(cfgInput?.heroRender || {}) }
  };
  const baseFloorPad = cfg.floorPad;
  const rand = (a, b) => a + Math.random() * (b - a);
  const rectHit = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

  let width = 360;
  let height = 640;
  let camX = 0;
  let timeLeft = RUNNER_MAX_TIME;
  let level = 1;
  let score = 0;
  let sparks = 0;
  let speed = cfg.speedStart;
  let nextObstacleAt = 0;
  let nextSparkAt = 0;
  let nextPlatformAt = 0;
  let hit = false;
  let lastSec = 0;
  let jumpBufferedUntil = 0;

  const heroScreenX = 90;
  const hero = { x: heroScreenX, y: 0, vx: 0, vy: 0, w: cfg.hero.w, h: cfg.hero.h, grounded: true, runT: 0, airJumpsUsed: 0 };
  let platforms = [];
  let obstacles = [];
  let items = [];

  const getFloorY = () => height - cfg.floorPad;

  const resetSize = (w, h) => {
    width = Math.max(320, Number(w) || 0);
    height = Math.max(520, Number(h) || 0);
    cfg.floorPad = width < 700 ? Math.max(baseFloorPad, 96) : baseFloorPad;
    if (width < 700) {
      cfg.heroRender = { ...cfg.heroRender, bodyXMul: 0.5, headR: 10, torsoW: 13, torsoH: 20, wheelR: 10, wheelBottomPad: 1.3, hipGap: 0.35 };
    } else if (width < 1024) {
      cfg.heroRender = { ...cfg.heroRender, bodyXMul: 0.52, headR: 10.5, torsoW: 14, torsoH: 21, wheelR: 11, wheelBottomPad: 1.5, hipGap: 0.5 };
    } else {
      cfg.heroRender = { ...cfg.heroRender, bodyXMul: 0.54, headR: 11, torsoW: 15, torsoH: 22, wheelR: 12, wheelBottomPad: 1.7, hipGap: 0.65 };
    }
    const floorY = getFloorY();
    if (!Number.isFinite(hero.y) || hero.y <= 0) hero.y = floorY - hero.h;
  };

  const resetWorld = (secNow) => {
    const floorY = getFloorY();
    camX = 0;
    timeLeft = RUNNER_MAX_TIME;
    level = 1;
    score = 0;
    sparks = 0;
    speed = cfg.speedStart;
    nextObstacleAt = secNow + rand(cfg.obstacleEveryMin, cfg.obstacleEveryMax);
    nextSparkAt = secNow + rand(cfg.sparkEveryMin, cfg.sparkEveryMax);
    nextPlatformAt = secNow + rand(cfg.platformEveryMin, cfg.platformEveryMax);
    hit = false;

    hero.x = camX + heroScreenX;
    hero.y = floorY - hero.h;
    hero.vx = 0;
    hero.vy = 0;
    hero.grounded = true;
    hero.runT = 0;
    hero.airJumpsUsed = 0;

    platforms = [{ x: 0, y: floorY, w: width * 1.6, h: 18, kind: 'floor' }];
    obstacles = [];
    items = [];
  };

  const doJump = () => {
    if (hero.grounded) {
      hero.vy = cfg.jumpV;
      hero.grounded = false;
      return true;
    }
    if ((Number(hero.airJumpsUsed) || 0) < 1) {
      hero.vy = cfg.jumpV * 0.9;
      hero.airJumpsUsed = (Number(hero.airJumpsUsed) || 0) + 1;
      return true;
    }
    return false;
  };
  
  const jump = (secNow) => {
    const sec = Number.isFinite(secNow) ? secNow : lastSec;
    const ok = doJump();
    if (ok) return true;
    const windowSec = Math.max(0, (Number(cfg.jumpBufferMs) || 0) / 1000);
    if (windowSec > 0) jumpBufferedUntil = Math.max(jumpBufferedUntil, sec + windowSec);
    return false;
  };

  const spawnPlatform = (sec) => {
    const floorY = getFloorY();
    const x = camX + width + rand(60, 220);
    const w = rand(140, 260);
    const y = floorY - rand(110, 210);
    platforms.push({ x, y, w, h: 14, kind: 'ledge' });

    const obstacleChance = Math.min(0.45, 0.18 + (level - 1) * 0.06);
    if (Math.random() < obstacleChance) {
      const ox = x + rand(20, w - 28);
      obstacles.push({ x: ox, y: y - 18, w: 18, h: 18, kind: 'spike' });
    }

    const sparkChance = Math.min(0.9, 0.55 + (level - 1) * 0.06);
    if (Math.random() < sparkChance) {
      const ix = x + rand(18, w - 18);
      const iy = y - rand(34, 70);
      const spawnCount = Math.random() < 0.38 ? 2 : 1;
      for (let k = 0; k < spawnCount; k++) {
        const value = 2 + (Math.random() < 0.22 ? 1 : 0);
        const ox = ix + (k === 0 ? 0 : rand(-22, 22));
        const oy = iy + (k === 0 ? 0 : rand(-10, 10));
        items.push({ x: ox, y: oy, r: 9, kind: 'spark', value, pulse: rand(0, Math.PI * 2) });
      }
    }

    const trimBefore = camX - 220;
    platforms = platforms.filter(p => p.x + p.w > trimBefore);
    obstacles = obstacles.filter(o => o.x + o.w > trimBefore);
    items = items.filter(i => i.x + i.r > trimBefore);

    nextPlatformAt = sec + rand(cfg.platformEveryMin, cfg.platformEveryMax) * (speed / cfg.speedStart > 1.3 ? 0.9 : 1);
  };

  const spawnObstacle = (sec) => {
    const floorY = getFloorY();
    const x = camX + width + rand(90, 220);
    const oh = rand(16, 26);
    const ow = rand(18, 26);
    const kind = Math.random() < 0.5 ? 'spike' : 'block';
    obstacles.push({ x, y: floorY - oh, w: ow, h: oh, kind });
    nextObstacleAt = sec + rand(cfg.obstacleEveryMin, cfg.obstacleEveryMax) * (speed / cfg.speedStart > 1.4 ? 0.85 : 1);
  };

  const spawnSpark = (sec) => {
    const floorY = getFloorY();
    const x = camX + width + rand(80, 220);
    const y = floorY - rand(90, 210);
    const value = 2 + (Math.random() < 0.22 ? 1 : 0);
    items.push({ x, y, r: 9, kind: 'spark', value, pulse: rand(0, Math.PI * 2) });
    nextSparkAt = sec + rand(cfg.sparkEveryMin, cfg.sparkEveryMax);
  };

  const step = (dt, sec) => {
    if (!Number.isFinite(dt) || dt <= 0) return null;
    lastSec = sec;
    const floorY = getFloorY();
    const elapsed = RUNNER_MAX_TIME - timeLeft;
    level = Math.max(1, Math.min(10, 1 + Math.floor(elapsed / 20)));
    speed = Math.min(cfg.speedMax, cfg.speedStart + (level - 1) * 42);

    if (sec >= nextPlatformAt) spawnPlatform(sec);
    if (sec >= nextObstacleAt) spawnObstacle(sec);
    if (sec >= nextSparkAt) spawnSpark(sec);

    const skin = 0.75;
    const prevY = hero.y;
    const prevVy = hero.vy;

    hero.runT += dt * (1.2 + (speed - cfg.speedStart) / 380);
    hero.vy += cfg.gravity * dt;
    hero.y += hero.vy * dt;
    camX += speed * dt;
    hero.x = camX + heroScreenX;

    hero.grounded = false;
    for (const p of platforms) {
      if (!rectHit(hero.x, hero.y, hero.w, hero.h, p.x, p.y, p.w, p.h)) continue;
      const wasAbove = prevY + hero.h <= p.y + skin;
      const wasBelow = prevY >= p.y + p.h - skin;
      if (wasAbove && hero.vy >= 0) {
        hero.y = p.y - hero.h - skin;
        hero.vy = 0;
        hero.grounded = true;
        hero.airJumpsUsed = 0;
        break;
      }
      if (wasBelow && hero.vy <= 0) {
        hero.y = p.y + p.h + skin;
        hero.vy = 0;
        break;
      }
    }

    if (hero.y + hero.h > floorY) {
      hero.y = floorY - hero.h - skin;
      hero.vy = 0;
      hero.grounded = true;
      hero.airJumpsUsed = 0;
    }

    if (hero.grounded && jumpBufferedUntil > 0 && sec <= jumpBufferedUntil) {
      jumpBufferedUntil = 0;
      doJump();
    } else if (jumpBufferedUntil > 0 && sec > jumpBufferedUntil) {
      jumpBufferedUntil = 0;
    }

    for (const o of obstacles) {
      if (rectHit(hero.x, hero.y, hero.w, hero.h, o.x, o.y, o.w, o.h)) {
        hit = true;
        return 'hit';
      }
    }

    for (const it of items) {
      if (it.kind !== 'spark') continue;
      const near = rectHit(hero.x, hero.y, hero.w, hero.h, it.x - it.r, it.y - it.r, it.r * 2, it.r * 2);
      if (!near) continue;
      it.collected = true;
      sparks += Math.max(0, Number(it.value) || 1);
    }
    items = items.filter(i => !i.collected);

    score += dt * (10 + level * 6);
    timeLeft = Math.max(0, timeLeft - dt);
    return timeLeft <= 0 ? 'timeout' : null;
  };

  const snapshot = () => ({
    width,
    height,
    camX,
    timeLeft,
    level,
    score,
    sparks,
    speed,
    hero: { ...hero },
    platforms: platforms.slice(),
    obstacles: obstacles.slice(),
    items: items.slice(),
    hit
  });

  return { cfg, resetSize, resetWorld, jump, step, snapshot };
};
