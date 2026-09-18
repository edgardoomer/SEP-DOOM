
// ───────────────────────── Partículas: gas, petróleo y agua ─────────────────────────
const parts = [], MAXP = 2000;
const rnd = (a, b) => a + Math.random() * (b - a);
let emitAcc = 0, emitAccG = 0;
const surfY = x => x < G.xW ? ySurf1(x) : ySurf2(x);
const intY = x => x < G.xW ? yInt1(x) : yInt2(x);
function spawn(ph) {
  if (parts.length >= MAXP) parts.splice(0, 60);
  parts.push({ x: 58, y: G.inletY + rnd(-3.5, 3.5), vx: 170, vy: 0, ph, state: 'in', tTurb: 0, settled: false, falling: false, px: 58, r: ph === 'g' ? rnd(1.7, 2.8) : rnd(1.5, 2.3) });
}
function emit(dt) {
  const wc = st.flows.wc ?? feed.wc / 100;
  emitAcc += (reduceMotion ? 16 : 34) * qf * dt;
  emitAccG += (reduceMotion ? 8 : 20) * clamp((st.flows.Qg_in || 0) / (2880 / 3600), 0, 3) * dt;
  while (emitAcc >= 1) { emitAcc--; spawn(Math.random() < wc ? 'w' : 'o'); }
  while (emitAccG >= 1) { emitAccG--; spawn('g'); }
}
const F = { u: 0, v: 0, ti: 0, z: 'o' };
function sink(p, nx, ny, rad, k) { const dx = nx - p.x, dy = ny - p.y, d = Math.hypot(dx, dy) || 1; if (d < rad && k > 0.3) { const w = k * (1 - d / rad); F.u += dx / d * w; F.v += dy / d * w; } }
function fieldAt(p) {
  const x = p.x, y = p.y, zs = surfY(x), zi = intY(x);
  const z = y < zs ? 'g' : (y < zi ? 'o' : 'w');
  let u = 0, v = 0, ti = 0;
  F.u = 0; F.v = 0;
  if (z === 'g') {
    const dx = G.gasX - x, s = 26 * qg;
    u = s * Math.sign(dx) * Math.min(1, Math.abs(dx) / 60); v = -5 * qg - 2;
    if (Math.abs(dx) < 40 && y < G.yTop + 70) v -= 45 * qg;
    if (qpsv > 0.05) { const dp = G.psvX - x; u += 30 * qpsv * Math.sign(dp) * Math.min(1, Math.abs(dp) / 60); if (Math.abs(dp) < 40 && y < G.yTop + 70) v -= 55 * qpsv; }
    ti = 24;
  } else if (x < G.xW) {
    if (x < G.xB) {   // cámara de entrada: remolino tras el deflector
      const cx = G.xB - 46, cy = G.yc + 12, dx = x - cx, dy = y - cy, r2 = dx * dx + dy * dy + 900, gam = -900 * qf;
      u = 28 * qf - gam * dy / r2; v = gam * dx / r2; ti = 320 * qf;
    } else if (z === 'o') {
      u = 22 * qf; if (G.xW - x < 80 && y < G.yCrest + 50) { u += 42 * Math.min(1.5, qover); v -= 14 * Math.min(1.5, qover); }
      ti = 10;
    } else {
      const dx = G.waterX - x; u = 16 * qf * (dx > 0 ? 1 : -0.35); v = 2; ti = 8;
      sink(p, G.waterX, G.yBot - 4, 75, 70 * qw);
    }
  } else {
    if (z === 'o') {
      const cx = G.xW + 44, cy = L.s2 + 44, dx = x - cx, dy = y - cy, r2 = dx * dx + dy * dy + 700, gam = -900 * Math.min(1.5, qover);
      u = -gam * dy / r2 + 12 * qo; v = gam * dx / r2;
      ti = 12 + 520 * Math.min(1, qover) * Math.exp(-((x - G.xW - 24) ** 2) / 1800 - ((y - L.s2) ** 2) / 2500);
    } else { u = 6 * qo; v = 3; ti = 8; }
    sink(p, G.oilX, G.yBot - 4, 75, 70 * qo);
  }
  // estela turbulenta aguas abajo del bafle perforado (todas las fases)
  if (x >= G.xB && x < G.xB + 280) {
    const dxb = x - G.xB;
    let uj = 0; for (const h of holes) { const dy = y - h; uj += Math.exp(-dy * dy / 50); }
    u += 120 * qf * Math.exp(-dxb / 45) * uj;
    const w = wt();
    for (let k = 0; k < 8; k++) {
      const xc = G.xB + 12 + ((k * 41 + w * (30 + 30 * qf)) % 270);
      const yk = G.yTop + 24 + ((k * 53) % (2 * G.R - 48)) + 9 * Math.sin(w * 1.6 + k);
      const dx = x - xc, dy = y - yk, r2 = dx * dx + dy * dy + 120, gam = (k & 1 ? 1 : -1) * 700 * qf * Math.exp(-(xc - G.xB) / 120);
      u += -gam * dy / r2; v += gam * dx / r2;
    }
    ti += 600 * qf * Math.exp(-dxb / 110);
  }
  F.u += u; F.v += v; F.ti = ti; F.z = z;
}
function updateParticles(dt) {
  emit(dt);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (p.state === 'in') {
      p.px = p.x; p.x += 170 * dt;
      if (p.x >= G.deflX - 2) {
        p.state = 'jet'; p.tTurb = 1.3;
        if (p.ph === 'g' || Math.random() < 0.2) { p.vy = -rnd(50, 120); p.vx = rnd(-30, 30); } else { p.vy = rnd(70, 160); p.vx = rnd(-40, 40); }
      }
      continue;
    }
    if (p.falling) {
      p.vy += 420 * dt; p.vx += (24 - p.vx) * dt;
      p.px = p.x; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y >= ySurf2(p.x)) { p.falling = false; p.tTurb = 0.7; p.vy *= 0.3; }
      continue;
    }
    fieldAt(p);
    let ti = F.ti; if (p.tTurb > 0) { ti += 900 * qf; p.tTurb -= dt; }
    const z = F.z; let by = 0;
    if (p.ph === 'g') by = z !== 'g' ? -110 : -4;
    else if (p.ph === 'o') by = z === 'w' ? -28 : (z === 'g' ? 150 : 0);
    else by = z === 'o' ? 30 : (z === 'g' ? 170 : 0);
    const k = (z === 'g' ? 1.6 : 3.0) * dt;
    p.vx += (F.u - p.vx) * k + (Math.random() - 0.5) * ti * dt;
    p.vy += (F.v + by - p.vy) * k + (Math.random() - 0.5) * ti * dt;
    p.px = p.x; p.x += p.vx * dt; p.y += p.vy * dt;
    // paredes del recipiente
    if (p.x < G.xL + 6) p.x = G.xL + 6; if (p.x > G.xR - 6) p.x = G.xR - 6;
    const hh = halfH(p.x), top = G.yc - hh + 3, bot = G.yc + hh - 3;
    if (p.y < top) { p.y = top; p.vy = Math.abs(p.vy) * 0.3; } if (p.y > bot) { p.y = bot; p.vy = -Math.abs(p.vy) * 0.3; }
    // vertedero: bloquea por debajo de la cresta; por encima el petróleo pasa y cae al compartimento
    if (p.ph !== 'g') {
      const overCrest = p.y <= G.yCrest + 8 && qover > 0.02;
      if (p.px < G.xW && p.x >= G.xW - 2) { if (overCrest) { p.x = G.xW + 3; p.falling = true; p.vx = 30; p.vy = 10; continue; } p.x = G.xW - 2; p.vx = -Math.abs(p.vx) * 0.4; }
      else if (p.px > G.xW && p.x <= G.xW + 2) { p.x = G.xW + 2; p.vx = Math.abs(p.vx) * 0.4; }
    }
    // bafle perforado: solo se cruza por los orificios
    if ((p.px < G.xB) !== (p.x < G.xB) && p.y > G.yTop + 28) {
      let best = 1e9, hy = 0; for (const h of holes) { const d = Math.abs(p.y - h); if (d < best) { best = d; hy = h; } }
      if (best < 13) p.y = hy + rnd(-3, 3); else { p.x = p.px < G.xB ? G.xB - 2 : G.xB + 2; p.vx = -p.vx * 0.5; }
    }
    // confinamiento por fase una vez asentada
    const zs = surfY(p.x), zi = intY(p.x);
    if (p.ph === 'w') { if (p.y >= zi) p.settled = true; if (p.settled && p.y < zi + 2) { p.y = zi + 2; p.vy = Math.abs(p.vy) * 0.2; } }
    else if (p.ph === 'o') {
      if (p.y <= zi && p.y >= zs) p.settled = true;
      if (p.settled) { if (p.y > zi - 2) { p.y = zi - 2; p.vy = -Math.abs(p.vy) * 0.2; } if (p.y < zs + 1) { p.y = zs + 1; p.vy = Math.abs(p.vy) * 0.2; } }
    } else { if (p.y <= zs) p.settled = true; if (p.settled && p.y > zs - 2) { p.y = zs - 2; p.vy = -Math.abs(p.vy) * 0.2; } }
    // salidas: solo con caudal por la válvula correspondiente
    if (qw > 0.05 && Math.hypot(p.x - G.waterX, p.y - (G.yBot - 4)) < 10) { parts.splice(i, 1); continue; }
    if (qo > 0.05 && Math.hypot(p.x - G.oilX, p.y - (G.yBot - 4)) < 10) { parts.splice(i, 1); continue; }
    if (p.ph === 'g' && p.y < G.yTop + 9 && ((qg > 0.05 && Math.abs(p.x - G.gasX) < 12) || (qpsv > 0.05 && Math.abs(p.x - G.psvX) < 12))) { parts.splice(i, 1); continue; }
  }
}
function withA(hex, a) { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
function drawParticles() {
  const colO = withA(T.oilHi, .85), colOd = T.oil, colW = withA(T.waterHi, .95), colWs = withA(T.waterHi, .6), colG = withA(T.gasDot, .5);
  for (const p of parts) {
    const inPipe = p.state === 'in';
    if (p.ph === 'g') {
      if (!p.settled || inPipe) { c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.29); c.fillStyle = 'rgba(255,255,255,.88)'; c.fill(); c.lineWidth = .8; c.strokeStyle = T.gasDot; c.stroke(); }
      else { c.fillStyle = colG; c.beginPath(); c.arc(p.x, p.y, 1.6, 0, 6.29); c.fill(); }
    } else if (p.ph === 'o') {
      const inWater = !p.settled && !inPipe && p.y > intY(p.x);
      c.fillStyle = inWater ? colOd : colO; c.beginPath(); c.arc(p.x, p.y, inWater ? 2.4 : p.r, 0, 6.29); c.fill();
    } else {
      const inOil = !p.settled || inPipe; c.fillStyle = inOil ? colW : colWs; c.beginPath(); c.arc(p.x, p.y, inOil ? 2.3 : 1.6, 0, 6.29); c.fill();
    }
  }
}

// ───────────────────────── Tendencias ─────────────────────────
const tc = document.getElementById('trend'), tctx = tc.getContext('2d');
let hoverX = null;
tc.addEventListener('mousemove', e => { const r = tc.getBoundingClientRect(); hoverX = (e.clientX - r.left); });
tc.addEventListener('mouseleave', () => { hoverX = null; });
function niceRange(vals) { let lo = Math.min(...vals), hi = Math.max(...vals); if (hi - lo < 1e-6) { lo -= 0.5; hi += 0.5; } const pad = (hi - lo) * 0.25; lo -= pad; hi += pad; return [lo, hi]; }
function drawTrend() {
  const W = tc.clientWidth, H = 232, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (tc.width !== W * dpr) { tc.width = W * dpr; tc.height = H * dpr; }
  tctx.setTransform(dpr, 0, 0, dpr, 0, 0); tctx.clearRect(0, 0, W, H);
  const padL = 150, padR = 74, x0 = padL, x1 = W - padR, laneH = 58, gapY = 10, top = 8;
  const lanes = [
    { key: 'P', sp: 'spP', col: T.gasDot, name: 'PIC-100', unit: uP(), cv: vP, f: v => v.toFixed(UN.imp ? 1 : 2) },
    { key: 'hw', sp: 'spW', col: T.water, name: 'LIC-101', unit: uL(), cv: vL, f: v => v.toFixed(2) },
    { key: 'ho', sp: 'spO', col: T.oilHi, name: 'LIC-103', unit: uL(), cv: vL, f: v => v.toFixed(2) },
  ];
  const tNow = st.t, tMin = tNow - 600; const xOf = t => x0 + (t - tMin) / 600 * (x1 - x0);
  const data = trend.length ? trend : [{ t: tNow, P: st.P, hw: st.lv.hw1, ho: st.lv.hl2, spP: st.pic.sp, spW: st.lic1.sp, spO: st.lic2.sp }];
  let hi = null; if (hoverX !== null && hoverX >= x0 && hoverX <= x1) { const th = tMin + (hoverX - x0) / (x1 - x0) * 600; let best = 1e9; for (let i = 0; i < data.length; i++) { const d = Math.abs(data[i].t - th); if (d < best) { best = d; hi = i; } } }
  tctx.font = '12.5px ' + FM; tctx.textBaseline = 'middle';
  lanes.forEach((ln, li) => {
    const yT = top + li * (laneH + gapY), yB = yT + laneH;
    const vals = data.map(d => ln.cv(d[ln.key])).concat(data.map(d => ln.cv(d[ln.sp])));
    const [lo, hiV] = niceRange(vals); const yOf = v => yB - (clamp(v, lo, hiV) - lo) / (hiV - lo) * laneH;
    tctx.strokeStyle = T.drawSoft; tctx.globalAlpha = .35; tctx.lineWidth = 1; tctx.beginPath(); tctx.moveTo(x0, yB + .5); tctx.lineTo(x1, yB + .5); tctx.moveTo(x0, yT + laneH / 2 + .5); tctx.lineTo(x1, yT + laneH / 2 + .5); tctx.stroke(); tctx.globalAlpha = 1;
    tctx.fillStyle = T.ink; tctx.textAlign = 'left'; tctx.font = '600 15px ' + FC; tctx.fillText(ln.name, 8, yT + 12); tctx.font = '12.5px ' + FM; tctx.fillStyle = T.muted; tctx.fillText(ln.unit, 8, yT + 29);
    tctx.textAlign = 'right'; tctx.fillText(ln.f(hiV), x0 - 8, yT + 6); tctx.fillText(ln.f(lo), x0 - 8, yB - 4);
    // set point
    tctx.setLineDash([4, 3]); tctx.strokeStyle = T.muted; tctx.lineWidth = 1; tctx.beginPath(); data.forEach((d, i) => { const x = xOf(d.t), y = yOf(ln.cv(d[ln.sp])); i ? tctx.lineTo(x, y) : tctx.moveTo(x, y); }); tctx.stroke(); tctx.setLineDash([]);
    // PV: relleno de área + línea
    tctx.beginPath(); data.forEach((d, i) => { const x = xOf(d.t), y = yOf(ln.cv(d[ln.key])); i ? tctx.lineTo(x, y) : tctx.moveTo(x, y); });
    tctx.strokeStyle = ln.col; tctx.lineWidth = 2; tctx.lineJoin = 'round'; tctx.stroke();
    tctx.lineTo(xOf(data[data.length - 1].t), yB); tctx.lineTo(xOf(data[0].t), yB); tctx.closePath(); tctx.fillStyle = withA(ln.col, .10); tctx.fill();
    const last = data[data.length - 1], lx = xOf(last.t), ly = yOf(ln.cv(last[ln.key]));
    tctx.beginPath(); tctx.arc(lx, ly, 3.5, 0, 6.29); tctx.fillStyle = ln.col; tctx.fill(); tctx.lineWidth = 1.5; tctx.strokeStyle = T.panel; tctx.stroke();
    tctx.textAlign = 'left'; tctx.fillStyle = T.ink; tctx.font = '500 14px ' + FM; tctx.fillText(ln.f(ln.cv(last[ln.key])), x1 + 8, ly);
    if (hi !== null) { const d = data[hi], hx = xOf(d.t), hy = yOf(ln.cv(d[ln.key])); tctx.beginPath(); tctx.arc(hx, hy, 3.5, 0, 6.29); tctx.fillStyle = T.panel; tctx.fill(); tctx.lineWidth = 2; tctx.strokeStyle = ln.col; tctx.stroke(); }
  });
  // eje de tiempo
  tctx.font = '12px ' + FM; tctx.fillStyle = T.muted; tctx.textAlign = 'center';
  const stepM = (x1 - x0) > 620 ? 2 : 5; for (let m = -10; m <= 0; m += stepM) { const x = xOf(tNow + m * 60); tctx.fillText(m === 0 ? 'ahora' : m + ' min', x, H - 8); }
  if (hi !== null) {
    const d = data[hi], hx = xOf(d.t);
    tctx.strokeStyle = T.muted; tctx.setLineDash([3, 3]); tctx.lineWidth = 1; tctx.beginPath(); tctx.moveTo(hx, top); tctx.lineTo(hx, H - 20); tctx.stroke(); tctx.setLineDash([]);
    const rows = [fmtT(d.t), 'P   ' + fP(d.P), 'Int ' + fL(d.hw), 'Pet ' + fL(d.ho)];
    tctx.font = '12.5px ' + FM; const bw = 140, bh = 14 * rows.length + 10; let bx = hx + 10; if (bx + bw > W) bx = hx - bw - 10;
    tctx.fillStyle = T.panel; tctx.strokeStyle = T.drawSoft; tctx.lineWidth = 1; tctx.beginPath(); tctx.rect(bx, top + 4, bw, bh); tctx.fill(); tctx.stroke();
    tctx.textAlign = 'left'; rows.forEach((r, i) => { tctx.fillStyle = i ? T.ink : T.muted; tctx.fillText(r, bx + 8, top + 4 + 12 + i * 14); });
  }
}

