
// ───────────────────────── Geometría en pantalla (px) ─────────────────────────
const S = 100;   // px por metro
const G = {
  x0: 220, x1: 220 + Math.round(M.Lss * 100), yc: 290, R: M.R * 100, hA: M.D / 4 * 100,
  xB: 300, xW: 220 + Math.round(0.74 * M.Lss * 100),
  inletY: 215, inletX: 182, deflX: 230,
  gasX: 440, gasRunY: 80, pcvX: 540, roX: 660,
  psvX: 905, flareY: 92, piX: 1020,
  lg1X: 600, lg2X: 1010,
  waterX: 730, oilX: 1130, outRunY: 548,
  drains: [260, 330, 400], stubs: [340, 680, 800, 1150],
};
G.yTop = G.yc - G.R; G.yBot = G.yc + G.R; G.xL = G.x0 - G.hA; G.xR = G.x1 + G.hA;
G.yCrest = G.yBot - M.hWeir * S;
const holes = []; for (let y = G.yTop + 22; y < G.yBot - 12; y += 26) holes.push(y);
function halfH(x) {
  if (x < G.x0) { const r = (G.x0 - x) / G.hA; return r >= 1 ? 0 : G.R * Math.sqrt(1 - r * r); }
  if (x > G.x1) { const r = (x - G.x1) / G.hA; return r >= 1 ? 0 : G.R * Math.sqrt(1 - r * r); }
  return G.R;
}
const L = {};      // niveles en px
let tv = 0;        // tiempo visual (s)
let qf = 1, qo = 1, qw = 1, qg = 1, qover = 1, qpsv = 0;   // flujos normalizados para el dibujo
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function updVisualState() {
  const lv = st.lv, f = st.flows;
  L.s1 = G.yBot - lv.hl1 * S; L.i1 = G.yBot - lv.hw1 * S; L.s2 = G.yBot - lv.hl2 * S; L.i2 = G.yBot - lv.hw2 * S;
  qf = clamp(feed.Q / 80, 0, 2.5);
  qw = clamp((f.QwV || 0) / (32 / 3600), 0, 4); qo = clamp((f.QoV || 0) / (48 / 3600), 0, 4);
  qg = clamp(((f.Qg_out || 0)) / (2880 / 3600), 0, 4); qpsv = clamp((f.Qpsv || 0) / (2880 / 3600), 0, 6);
  qover = clamp((f.Qover || 0) / (48 / 3600), 0, 4);
}
const wt = () => reduceMotion ? 0 : tv;
function ySurf1(x) { const amp = (0.8 + 2.2 * qf) * (0.3 + 0.7 * Math.exp(-(x - G.xB) / 420)); return L.s1 + amp * (0.6 * Math.sin(x * 0.045 - wt() * 3.1) + 0.4 * Math.sin(x * 0.09 + wt() * 2.3)); }
function yInt1(x) { const amp = (0.5 + 1.0 * qf) * (0.3 + 0.7 * Math.exp(-(x - G.xB) / 300)); return L.i1 + amp * Math.sin(x * 0.03 - wt() * 1.4); }
function ySurf2(x) { const amp = 0.5 + 2.2 * Math.min(1, qover) * Math.exp(-(x - G.xW) / 70); return L.s2 + amp * (0.7 * Math.sin(x * 0.08 - wt() * 4) + 0.3 * Math.sin(x * 0.05 + wt() * 2.5)); }
function yInt2(x) { return L.i2; }

// ───────────────────────── Tokens de color ─────────────────────────
const T = {};
function readTokens() {
  const cs = getComputedStyle(document.documentElement); const g = n => cs.getPropertyValue(n).trim();
  T.draw = g('--draw'); T.drawSoft = g('--draw-soft'); T.drawBg = g('--draw-bg'); T.ink = g('--ink'); T.muted = g('--muted');
  T.accent = g('--accent'); T.ok = g('--ok'); T.alarm = g('--alarm'); T.panel = g('--panel');
  T.water = g('--water'); T.waterHi = g('--water-hi'); T.oil = g('--oil'); T.oilHi = g('--oil-hi'); T.gas = g('--gas'); T.gasDot = g('--gas-dot');
  T.glass = g('--glass'); T.nappe = g('--nappe'); T.sand = g('--sand');
}
readTokens();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTokens);
new MutationObserver(readTokens).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// ───────────────────────── Primitivas de dibujo ─────────────────────────
const cv = document.getElementById('sim'), c = cv.getContext('2d');
const FM = "'IBM Plex Mono', ui-monospace, Consolas, monospace", FC = "'Barlow Condensed', 'Arial Narrow', sans-serif", FS = "'IBM Plex Sans', system-ui, sans-serif";
function line(x1, y1, x2, y2, w, col) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineWidth = w || 2; c.strokeStyle = col || T.draw; c.stroke(); }
function poly(pts, w, col, dash) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.setLineDash(dash || []); c.lineWidth = w; c.strokeStyle = col; c.stroke(); c.setLineDash([]); }
const pipe = pts => poly(pts, 2.5, T.draw);
const signal = pts => poly(pts, 1.3, T.accent, [4, 3]);
function txt(x, y, s, size, font, col, align, base) { c.font = size + 'px ' + font; c.fillStyle = col || T.draw; c.textAlign = align || 'left'; c.textBaseline = base || 'middle'; c.fillText(s, x, y); }
function flange(x, y, vert) { if (vert) { line(x - 6, y - 2, x + 6, y - 2, 2); line(x - 6, y + 2, x + 6, y + 2, 2); } else { line(x - 2, y - 6, x - 2, y + 6, 2); line(x + 2, y - 6, x + 2, y + 6, 2); } }
function bowtie(x, y, vert, s) {
  c.beginPath();
  if (vert) { c.moveTo(x - s, y - s); c.lineTo(x + s, y - s); c.lineTo(x - s, y + s); c.lineTo(x + s, y + s); }
  else { c.moveTo(x - s, y - s); c.lineTo(x - s, y + s); c.lineTo(x + s, y - s); c.lineTo(x + s, y + s); }
  c.closePath(); c.fillStyle = T.drawBg; c.fill(); c.lineWidth = 1.8; c.strokeStyle = T.draw; c.stroke();
}
function gate(x, y, vert, closed) { bowtie(x, y, vert, 7); if (closed) { c.fillStyle = T.draw; c.fill(); } if (vert) { line(x, y, x + 12, y, 1.5); line(x + 12, y - 5, x + 12, y + 5, 1.5); } else { line(x, y, x, y - 12, 1.5); line(x - 5, y - 12, x + 5, y - 12, 1.5); } }
function globe(x, y, vert) { gate(x, y, vert); c.beginPath(); c.arc(x, y, 2.5, 0, 6.29); c.fillStyle = T.draw; c.fill(); }
function checkv(x, y) { c.beginPath(); c.moveTo(x - 7, y - 6); c.lineTo(x + 6, y); c.lineTo(x - 7, y + 6); c.closePath(); c.fillStyle = T.drawBg; c.fill(); c.lineWidth = 1.8; c.strokeStyle = T.draw; c.stroke(); line(x + 7, y - 7, x + 7, y + 7, 2); }
// bypass manual alrededor de una válvula de control en tubería vertical: bifurca en y1 (aguas arriba) y reincorpora en y2
function bypass(x, y1, y2, pct) {
  const xb = x + 42, yc = (y1 + y2) / 2; pipe([x, y1, xb, y1, xb, y2, x, y2]); globe(xb, yc, true);
  txt(xb + 20, yc - 24, 'bypass', 12.5, FS, T.drawSoft, 'left'); opBar(xb + 20, yc - 14, pct, T.drawSoft, T.draw);
}
// placa orificio (FE) en el colector de gas: bridas con la placa entre ellas
function orifice(x, y, bad) {
  const col = bad ? T.alarm : T.draw;
  line(x - 9, y - 8, x - 9, y + 8, 2, col); line(x + 9, y - 8, x + 9, y + 8, 2, col); line(x, y - 12, x, y + 12, bad ? 4 : 3, col);
  txt(x, y + 22, 'FE-100', 12.5, FC, col, 'center'); if (bad) txt(x, y - 20, 'PLACA MUY PEQUEÑA', 12.5, FC, T.alarm, 'center');
}
// bypass en tramo horizontal (lazo por debajo de la línea)
function bypassH(x1, x2, y, yb, pct) {
  const xg = (x1 + x2) / 2; pipe([x1, y, x1, yb, x2, yb, x2, y]); globe(xg, yb, false);
  txt(xg + 16, yb - 10, 'bypass', 12.5, FS, T.drawSoft, 'left'); opBar(xg + 16, yb + 1, pct, T.drawSoft, T.draw);
}
function arrow(x, y, dir, len) { const dx = dir === 'r' ? 1 : dir === 'l' ? -1 : 0, dy = dir === 'd' ? 1 : dir === 'u' ? -1 : 0; const x2 = x + dx * len, y2 = y + dy * len; line(x, y, x2, y2, 2.5); c.beginPath(); c.moveTo(x2, y2); c.lineTo(x2 - dx * 9 - dy * 5, y2 - dy * 9 - dx * 5); c.lineTo(x2 - dx * 9 + dy * 5, y2 - dy * 9 + dx * 5); c.closePath(); c.fillStyle = T.draw; c.fill(); }
// válvula de control con actuador de diafragma; vert: tubería vertical, actuador a la izquierda
function cvalve(x, y, vert, pos, tag, alarm) {
  bowtie(x, y, vert, 7);
  if (vert) {
    line(x - 7, y, x - 19, y, 1.5); line(x - 19, y - 11, x - 19, y + 11, 1.8);
    c.beginPath(); c.arc(x - 19, y, 11, Math.PI / 2, 3 * Math.PI / 2); c.closePath(); c.fillStyle = T.drawBg; c.fill(); c.lineWidth = 1.8; c.strokeStyle = T.draw; c.stroke();
    opBar(x - 58, y - 48, pos); txt(x - 9, y + 23, tag, 14, FC, alarm ? T.alarm : T.draw, 'right');
  } else {
    line(x, y - 7, x, y - 19, 1.5); line(x - 11, y - 19, x + 11, y - 19, 1.8);
    c.beginPath(); c.arc(x, y - 19, 11, Math.PI, 2 * Math.PI); c.closePath(); c.fillStyle = T.drawBg; c.fill(); c.lineWidth = 1.8; c.strokeStyle = T.draw; c.stroke();
    opBar(x + 16, y - 30, pos); txt(x - 12, y + 17, tag, 14, FC, alarm ? T.alarm : T.draw, 'right');
  }
}
function opBar(x, y, pos, fill, ink) {   // indicador de apertura 0–100 %
  const h = 24, f = clamp(pos, 0, 100) / 100 * h;
  c.fillStyle = T.panel; c.fillRect(x, y, 5, h); c.fillStyle = fill || T.accent; c.fillRect(x, y + h - f, 5, f);
  c.lineWidth = 1; c.strokeStyle = T.drawSoft; c.strokeRect(x + 0.5, y + 0.5, 5, h);
  txt(x + 9, y + h / 2, Math.round(pos) + ' %', 13, FM, ink || T.accent, 'left');
}
const BR = 15;   // radio de las burbujas ISA
function bubble(x, y, l1, l2, panelLine, alarm) {
  c.beginPath(); c.arc(x, y, BR, 0, 6.29); c.fillStyle = T.drawBg; c.fill(); c.lineWidth = alarm ? 2.2 : 1.6; c.strokeStyle = alarm ? T.alarm : T.draw; c.stroke();
  if (panelLine) line(x - BR, y, x + BR, y, 1.2, alarm ? T.alarm : T.draw);
  txt(x, y - 6.5, l1, 12.5, FC, alarm ? T.alarm : T.draw, 'center'); txt(x, y + 7, l2, 12, FM, alarm ? T.alarm : T.draw, 'center');
}
function vesselPath() {
  c.beginPath(); c.moveTo(G.x0, G.yTop); c.lineTo(G.x1, G.yTop);
  c.ellipse(G.x1, G.yc, G.hA, G.R, 0, -Math.PI / 2, Math.PI / 2); c.lineTo(G.x0, G.yBot);
  c.ellipse(G.x0, G.yc, G.hA, G.R, 0, Math.PI / 2, 3 * Math.PI / 2); c.closePath();
}
function fillBelow(xa, xb, fn, color) {
  c.beginPath(); c.moveTo(xa, fn(xa)); for (let x = xa + 4; x < xb; x += 4) c.lineTo(x, fn(x)); c.lineTo(xb, fn(xb));
  c.lineTo(xb, G.yBot + 4); c.lineTo(xa, G.yBot + 4); c.closePath(); c.fillStyle = color; c.fill();
}
function strokeCurve(xa, xb, fn, color, w, alpha) {
  c.beginPath(); c.moveTo(xa, fn(xa)); for (let x = xa + 4; x < xb; x += 4) c.lineTo(x, fn(x)); c.lineTo(xb, fn(xb));
  c.globalAlpha = alpha; c.lineWidth = w; c.strokeStyle = color; c.stroke(); c.globalAlpha = 1;
}

// ───────────────────────── Capas del dibujo ─────────────────────────
function drawFluids() {
  c.save(); vesselPath(); c.clip();
  c.fillStyle = T.gas; c.fillRect(G.xL, G.yTop, G.xR - G.xL, G.R * 2);
  fillBelow(G.xL, G.xW, ySurf1, T.oil); fillBelow(G.xL, G.xW, yInt1, T.water);
  fillBelow(G.xW, G.xR, ySurf2, T.oil); if (st.lv.hw2 > 0.004) fillBelow(G.xW, G.xR, yInt2, T.water);
  if (st.hSand > 0.004) { const ys = G.yBot - st.hSand * S; fillBelow(G.xL, G.xW, x => ys + 1.5 * Math.sin(x * 0.07), T.sand); }
  strokeCurve(G.xL, G.xW, ySurf1, T.oilHi, 1.6, .55); strokeCurve(G.xL, G.xW, yInt1, T.waterHi, 1.4, .45);
  strokeCurve(G.xW + 1, G.xR, ySurf2, T.oilHi, 1.6, .55);
  // lámina vertiente sobre el vertedero
  if (qover > 0.02) {
    const y0 = ySurf1(G.xW - 2), th = 2 + 9 * Math.min(1, qover), xe = G.xW + 22 + 8 * Math.min(1, qover), y1 = ySurf2(xe);
    c.beginPath(); c.moveTo(G.xW - 3, y0); c.quadraticCurveTo(G.xW + 14, y0 + 3, xe, y1 + 5);
    c.lineCap = 'round'; c.lineWidth = th; c.strokeStyle = T.nappe; c.stroke();
    c.globalAlpha = .55; c.lineWidth = Math.max(1, th * .35); c.strokeStyle = T.oilHi; c.stroke(); c.globalAlpha = 1; c.lineCap = 'butt';
  }
  c.restore();
}
function drawInternals() {
  // deflector de entrada (media caña) y tramo interno de la boquilla
  line(G.inletX - 4, G.inletY, G.deflX + 4, G.inletY, 5);
  c.beginPath(); c.arc(G.deflX + 8, G.inletY, 20, -Math.PI / 2 + .1, Math.PI / 2 - .1); c.lineWidth = 4.5; c.strokeStyle = T.draw; c.stroke();
  // bafle perforado (deja paso libre al gas por encima)
  let y = G.yTop + 28; for (const h of holes) { if (h - 6 > y) line(G.xB, y, G.xB, h - 6, 3.5); y = h + 6; } line(G.xB, y, G.xB, G.yBot - 2, 3.5);
  // vertedero con placa ajustable
  line(G.xW, G.yBot, G.xW, G.yCrest + 24, 4.5);
  line(G.xW + 2.5, G.yCrest + 46, G.xW + 2.5, G.yCrest, 3); line(G.xW - 2.5, G.yCrest + 46, G.xW - 2.5, G.yCrest + 24, 3);
  line(G.xW - 8, G.yCrest, G.xW + 8, G.yCrest, 2.5);
  // rompevórtices en las salidas de agua y petróleo
  for (const x of [G.waterX, G.oilX]) { line(x - 14, G.yBot - 12, x + 14, G.yBot - 12, 3); line(x, G.yBot - 12, x, G.yBot - 2, 3); }
  // bandeja de arena / lavado en el drenaje 3
  const xs = G.drains[2]; c.beginPath(); c.moveTo(xs - 26, G.yBot - 16); c.lineTo(xs + 26, G.yBot - 16); c.lineTo(xs + 12, G.yBot - 2); c.lineTo(xs - 12, G.yBot - 2); c.closePath(); c.lineWidth = 2; c.strokeStyle = T.draw; c.stroke();
  for (let i = -1; i <= 1; i++) line(xs + i * 14, G.yBot - 16, xs + i * 14, G.yBot - 30, 2);
}
function drawVessel() {
  vesselPath(); c.lineWidth = 3.5; c.strokeStyle = T.draw; c.stroke();
  // líneas de tangencia
  line(G.x0, G.yTop - 6, G.x0, G.yTop + 6, 1, T.drawSoft); line(G.x0, G.yBot - 6, G.x0, G.yBot + 6, 1, T.drawSoft);
  line(G.x1, G.yTop - 6, G.x1, G.yTop + 6, 1, T.drawSoft); line(G.x1, G.yBot - 6, G.x1, G.yBot + 6, 1, T.drawSoft);
  // entrada-hombre en el cabezal derecho
  line(G.xR - 2, G.yc, G.xR + 22, G.yc, 5); flange(G.xR + 22, G.yc, false); line(G.xR + 27, G.yc - 8, G.xR + 27, G.yc + 8, 3);
  // boquillas de reserva en el domo
  for (const x of G.stubs) { line(x, G.yTop, x, G.yTop - 14, 3); flange(x, G.yTop - 14, true); }
}
function drawPiping() {
  const a = st.alarms;
  // ── entrada de crudo
  txt(30, G.inletY - 40, 'ENTRADA DE CRUDO', 15, FC, T.draw, 'left');
  txt(30, G.inletY - 25, fQ(feed.Q, 0) + ' · WC ' + Math.round(st.flows.wc * 100) + ' %', 13, FM, T.muted, 'left');
  arrow(20, G.inletY, 'r', 34); pipe([54, G.inletY, G.inletX, G.inletY]); gate(78, G.inletY, false); gate(140, G.inletY, false); flange(G.inletX - 8, G.inletY, false);
  pipe([106, G.inletY, 106, 300]); gate(106, 262, true); line(100, 300, 112, 300, 2.5);
  // ── gas: boquilla → subida → tramo horizontal con PCV
  pipe([G.gasX, G.yTop, G.gasX, G.gasRunY, 690, G.gasRunY]); flange(G.gasX, G.yTop - 10, true);
  bypassH(462, 622, G.gasRunY, G.gasRunY + 40, st.pic.byp);
  gate(485, G.gasRunY, false, st.block.G); cvalve(G.pcvX, G.gasRunY, false, st.pic.pos, 'PCV-100', !!st.fault.G); gate(600, G.gasRunY, false, st.block.G);
  orifice(G.roX, G.gasRunY, !!st.fault.RO);
  arrow(700, G.gasRunY, 'r', 26); txt(734, G.gasRunY, 'GAS A COMPRESIÓN', 15, FC, T.draw, 'left');
  txt(734, G.gasRunY + 14, fmtSm3(st.flows.Qg_out) , 13, FM, T.muted, 'left');
  if (st.fault.G) txt(G.pcvX - 26, G.gasRunY - 44, faultTxt(st.fault.G), 13, FC, T.alarm, 'right');
  // ── PSV-100 y línea a antorcha
  const px = G.psvX, pb = G.yTop - 12;
  line(px, G.yTop, px, pb, 3); flange(px, pb, true);
  c.beginPath(); c.rect(px - 11, pb - 16, 22, 14); c.fillStyle = T.drawBg; c.fill(); c.lineWidth = 2; c.strokeStyle = T.draw; c.stroke();
  c.beginPath(); c.moveTo(px - 13, pb - 16); c.lineTo(px - 13, pb - 40); c.arc(px, pb - 40, 13, Math.PI, 2 * Math.PI); c.lineTo(px + 13, pb - 16); c.closePath(); c.fillStyle = T.drawBg; c.fill(); c.stroke();
  line(px, pb - 53, px, pb - 62, 2); line(px - 6, pb - 62, px + 6, pb - 62, 2);
  pipe([px + 11, pb - 9, px + 34, pb - 9, px + 34, G.flareY, 1385, G.flareY]); arrow(1360, G.flareY, 'r', 26);
  txt(1240, G.flareY - 12, 'A ANTORCHA', 15, FC, T.draw, 'left');
  const psvOn = st.psvOpen; txt(px - 20, pb - 30, 'PSV-100', 14, FC, psvOn ? T.alarm : T.draw, 'right'); txt(px - 20, pb - 17, psvOn ? 'ABIERTA ' + Math.round(st.psvLift * 100) + ' %' : 'set ' + fP(M.psvSet, UN.imp ? 0 : 1), 12.5, FM, psvOn ? T.alarm : T.muted, 'right');
  if (psvOn) { c.fillStyle = T.alarm; c.globalAlpha = .18; c.beginPath(); c.arc(px, pb - 30, 30 + 6 * Math.sin(tv * 8), 0, 6.29); c.fill(); c.globalAlpha = 1; }
  // ── PI-100 / PT-100 / PIC-100
  line(G.piX, G.yTop, G.piX, G.yTop - 22, 2.5); pipe([G.piX, G.yTop - 12, 1075, G.yTop - 12, 1075, 132 - BR]);
  drawGauge(G.piX, G.yTop - 38, st.P);
  bubble(1075, 132, 'PT', '100', false, false);
  signal([1075, 132 - BR, 1075, 36 + BR]); bubble(1075, 36, 'PIC', '100', true, a['PAH-100'] || a['PAL-100']);
  signal([1075 - BR, 36, G.pcvX, 36, G.pcvX, G.gasRunY - 30]);
  txt(1100, 132, fP(st.P), 14, FM, a['PAH-100'] || a['PAL-100'] ? T.alarm : T.draw, 'left');
  txt(1100, 36, 'SP ' + fP(st.pic.sp, UN.imp ? 0 : 1), 13, FM, T.muted, 'left');
  // ── drenajes de fondo
  for (const x of G.drains) { pipe([x, G.yBot, x, 512]); flange(x, G.yBot + 10, true); gate(x, 450, true, !st.drainOpen); gate(x, 488, true, !st.drainOpen); line(x - 6, 512, x + 6, 512, 2.5); }
  txt(G.drains[1], 532, st.drainOpen ? 'DRENAJES ABIERTOS · ' + fmtM3(st.flows.Qdr) : 'DRENAJES / ARENA', 13, FC, st.drainOpen ? T.accent : T.drawSoft, 'center');
  if (st.drainOpen) for (const x of G.drains) arrow(x, 514, 'd', 18);
  // ── salida de agua (LCV-101)
  pipe([G.waterX, G.yBot, G.waterX, 548, 800, 548]); flange(G.waterX, G.yBot + 8, true); bypass(G.waterX, 428, 536, st.lic1.byp);
  gate(G.waterX, 446, true, st.block.W); cvalve(G.waterX, 484, true, st.lic1.pos, 'LCV-101', !!st.fault.W); gate(G.waterX, 518, true, st.block.W); arrow(800, 548, 'r', 26);
  if (st.fault.W) txt(G.waterX - 9, 470, faultTxt(st.fault.W), 12.5, FC, T.alarm, 'right'); txt(834, 548, 'AGUA A TRATAMIENTO', 15, FC, T.draw, 'left');
  txt(834, 564, fmtM3(st.flows.QwV) + (a['PETRÓLEO→AGUA'] ? '  ⚠ petróleo' : ''), 13, FM, a['PETRÓLEO→AGUA'] ? T.alarm : T.muted, 'left');
  // ── salida de petróleo (LCV-103) con bypass
  pipe([G.oilX, G.yBot, G.oilX, G.outRunY, 1284, G.outRunY]); flange(G.oilX, G.yBot + 8, true); bypass(G.oilX, 428, 536, st.lic2.byp);
  gate(G.oilX, 446, true, st.block.O); cvalve(G.oilX, 484, true, st.lic2.pos, 'LCV-103', !!st.fault.O); gate(G.oilX, 518, true, st.block.O); gate(1205, G.outRunY, false); checkv(1248, G.outRunY);
  if (st.fault.O) txt(G.oilX - 9, 470, faultTxt(st.fault.O), 12.5, FC, T.alarm, 'right');
  arrow(1284, G.outRunY, 'r', 26); txt(1316, G.outRunY - 8, 'PETRÓLEO', 15, FC, T.draw, 'left'); txt(1316, G.outRunY + 6, 'A TANQUES', 15, FC, T.draw, 'left');
  txt(1190, G.outRunY + 22, fmtM3(st.flows.QoV) + (a['AGUA→PETRÓLEO'] ? ' ⚠ agua' : ''), 13, FM, a['AGUA→PETRÓLEO'] ? T.alarm : T.muted, 'left');
  // ── indicadores de nivel y lazos
  drawGlass(G.lg1X, L.s1, L.i1, 'LG-101');
  line(G.lg1X, G.yBot - 6, G.lg1X, 452 - BR, 1.5); bubble(G.lg1X, 452, 'LT', '101', false, false);
  signal([G.lg1X + BR, 452, 650, 452, 650, 500 - BR]); bubble(650, 500, 'LIC', '101', true, a['LAH-101'] || a['LAL-101']);
  signal([650 + BR, 500, 688, 500, 688, 484, 699, 484]);
  txt(G.lg1X - BR - 5, 452, 'interfase ' + fL(st.lv.hw1), 13, FM, a['LAH-101'] || a['LAL-101'] ? T.alarm : T.draw, 'right');
  txt(G.lg1X - BR - 5, 467, 'SP ' + fL(st.lic1.sp), 12.5, FM, T.muted, 'right');
  drawGlass(G.lg2X, L.s2, L.i2, 'LG-103');
  line(G.lg2X, G.yBot - 6, G.lg2X, 452 - BR, 1.5); bubble(G.lg2X, 452, 'LT', '103', false, false);
  signal([G.lg2X + BR, 452, 1040, 452, 1040, 500 - BR]); bubble(1040, 500, 'LIC', '103', true, a['LAH-103'] || a['LAL-103']);
  signal([1040 + BR, 500, 1078, 500, 1078, 484, 1089, 484]);
  txt(G.lg2X - BR - 5, 452, 'petróleo ' + fL(st.lv.hl2), 13, FM, a['LAH-103'] || a['LAL-103'] ? T.alarm : T.draw, 'right');
  txt(G.lg2X - BR - 5, 467, 'SP ' + fL(st.lic2.sp), 12.5, FM, T.muted, 'right');
  // ── rótulos internos
  txt(G.xW - 8, G.yCrest - 10, 'vertedero ' + fL(M.hWeir), 12.5, FM, T.drawSoft, 'right');
  if (qover > 0.02) txt(G.xW - 8, G.yCrest - 22, fmtM3(st.flows.Qover) + ' →', 12.5, FM, T.oilHi, 'right');
  txt(G.xB + 6, G.yTop + 40, 'bafle perforado', 12.5, FM, T.drawSoft, 'left');
  txt(G.deflX + 32, G.inletY - 14, 'deflector', 12.5, FM, T.drawSoft, 'left');
  // ── cajetín
    txt(22, 22, 'V-100 · SEPARADOR TRIFÁSICO HORIZONTAL · ' + (UN.imp ? 'ID 7 ft × Lss 32 ft' : 'ID 2,13 m × Lss 9,75 m'), 16, FC, T.draw, 'left');
  txt(22, 40, (UN.imp ? '20 000 BFPD · 3 MMSCFD · 140 °F' : '132 m³/h · 3 540 Sm³/h · 60 °C') + ' · ' + fP(st.pic.sp, UN.imp ? 0 : 2) + ' · PSV ' + fP(M.psvSet, UN.imp ? 0 : 1) + ' · diseño ' + fP(M.Pdesign, UN.imp ? 0 : 1), 12.5, FM, T.muted, 'left');
  if (st.ruptured) { c.fillStyle = T.alarm; c.globalAlpha = .22; vesselPath(); c.fill(); c.globalAlpha = 1; txt((G.xL + G.xR) / 2, G.yc, 'ESTALLIDO DE VASIJA POR SOBREPRESIÓN', 30, FC, T.alarm, 'center'); }
  if (st.slug) txt(30, G.inletY - 54, 'BACHE DE GAS ×' + slugMult(st.slug.t).toFixed(1), 13, FC, T.alarm, 'left');
  if (st.hSand > 0.02) txt(G.xB + 6, G.yBot - st.hSand * S - 8, 'arena ' + fL(st.hSand), 12.5, FM, T.draw, 'left');
  if (st.carry > 0) txt(G.gasX + 20, G.yTop - 26, '⚠ ARRASTRE DE LÍQUIDO', 14, FC, T.alarm, 'left');
}
function drawGauge(x, y, P) {
  c.beginPath(); c.arc(x, y, 17, 0, 6.29); c.fillStyle = T.drawBg; c.fill(); c.lineWidth = 2; c.strokeStyle = T.draw; c.stroke();
  for (let i = 0; i <= 10; i++) { const a = (-225 + 27 * i) * Math.PI / 180; const r1 = i % 5 ? 13 : 11; line(x + Math.cos(a) * r1, y + Math.sin(a) * r1, x + Math.cos(a) * 15, y + Math.sin(a) * 15, 1, T.draw); }
  const full = UN.imp ? 150 : 10, ang = (-225 + 270 * clamp(vP(P) / full, 0, 1)) * Math.PI / 180;
  line(x, y, x + Math.cos(ang) * 12, y + Math.sin(ang) * 12, 2, T.alarm);
  c.beginPath(); c.arc(x, y, 2, 0, 6.29); c.fillStyle = T.draw; c.fill();
  txt(x, y + 8, 'PI', 10.5, FC, T.draw, 'center'); txt(x - 24, y, '0', 10, FM, T.muted, 'right'); txt(x + 24, y, String(full), 10, FM, T.muted, 'left');
}
function drawGlass(x, ys, yi, label) {
  const top = G.yTop + 16, bot = G.yBot - 8, w = 10;
  c.fillStyle = T.glass; c.fillRect(x - w / 2, top, w, bot - top);
  ys = clamp(ys, top, bot); yi = clamp(yi, top, bot);
  c.fillStyle = T.oilHi; c.fillRect(x - w / 2 + 1, ys, w - 2, yi - ys); c.fillStyle = T.waterHi; c.fillRect(x - w / 2 + 1, yi, w - 2, bot - yi);
  c.lineWidth = 1.5; c.strokeStyle = T.draw; c.strokeRect(x - w / 2, top, w, bot - top);
  if (UN.imp) { for (let f = 1; f * 0.3048 < M.D - 0.05; f++) { const yy = G.yBot - f * 0.3048 * S; line(x + w / 2, yy, x + w / 2 + (f % 2 ? 3 : 4), yy, 1, T.draw); if (f % 2 === 0) txt(x + w / 2 + 6, yy, f + ' ft', 10.5, FM, T.drawSoft, 'left'); } }
  else for (let h = 0.5; h < M.D - 0.05; h += 0.5) { const yy = G.yBot - h * S; line(x + w / 2, yy, x + w / 2 + 4, yy, 1, T.draw); txt(x + w / 2 + 6, yy, h.toFixed(1), 10.5, FM, T.drawSoft, 'left'); }
  c.beginPath(); c.arc(x, top - 4, 3, 0, 6.29); c.fillStyle = T.drawBg; c.fill(); c.lineWidth = 1.5; c.strokeStyle = T.draw; c.stroke();
  c.beginPath(); c.arc(x, bot + 4, 3, 0, 6.29); c.fill(); c.stroke();
  txt(x, G.yTop - 12, label, 12, FC, T.draw, 'center');
}
const fmtM3 = q => fQ((q || 0) * 3600);
const fmtSm3 = q => fG((q || 0) * 3600);
