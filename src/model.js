
<script>
'use strict';
// ───────────────────────── Unidades (el modelo trabaja en SI; solo cambia la presentación) ─────────────────────────
const UN = { imp: false };
const K = { psi: 14.5037738, ft: 3.28084, bpd: 150.955, scfbbl: 5.61458, mmscfd: 8.4755e-4 };   // por bar, m, m³/h, Sm³/m³, Sm³/h
const uP = () => UN.imp ? 'psig' : 'barg', vP = b => UN.imp ? b * K.psi : b;
const uL = () => UN.imp ? 'ft' : 'm', vL = m => UN.imp ? m * K.ft : m;
const uQ = () => UN.imp ? 'bbl/día' : 'm³/h', vQ = q => UN.imp ? q * K.bpd : q;
const uG = () => UN.imp ? 'MMSCFD' : 'Sm³/h', vG = g => UN.imp ? g * K.mmscfd : g;
const uGOR = () => UN.imp ? 'scf/bbl' : 'Sm³/m³', vGOR = r => UN.imp ? r * K.scfbbl : r;
const esN = n => n.toLocaleString('en-US').replace(/,/g, ' ');   // miles con espacio fino: 12 076
function fP(b, d) { return vP(b).toFixed(d ?? (UN.imp ? 1 : 2)) + ' ' + uP(); }
function fL(m, d) { return vL(m).toFixed(d ?? 2) + ' ' + uL(); }
function fQ(q, d) { return UN.imp ? esN(Math.round(vQ(q))) + ' bbl/día' : q.toFixed(d ?? 1) + ' m³/h'; }   // q en m³/h
function fG(g) { return UN.imp ? vG(g).toFixed(2) + ' MMSCFD' : esN(Math.round(g)) + ' Sm³/h'; }         // g en Sm³/h

// ───────────────────────── Modelo físico (SI) — hoja de datos del separador ─────────────────────────
// Capacidad 20 000 BFPD · gas 3 MMSCFD · ID 7 ft · Lss 32 ft · P oper. 38 psig · T oper. 140 °F · P diseño 120 psi · PSV ≈ 70 psig
const M = {
  D: 7 / K.ft, R: 3.5 / K.ft,          // 2,134 m
  Lss: 32 / K.ft,                       // 9,754 m costura a costura
  hWeir: 5.2 / K.ft,                    // vertedero a 5,2 ft
  T: (140 - 32) * 5 / 9 + 273.15, Tstd: 288.71, Pstd: 1.01325,
  capLiq: 20000 / K.bpd, capGas: 3 / K.mmscfd,          // m³/h · Sm³/h
  Pdesign: 120 / K.psi,                                 // estallido si P ≥ diseño
  psvSet: 70 / K.psi, psvReseat: 0.93, psvCap: 7500 / 3600,   // Sm³/s a 10 % de sobrepresión
  // válvulas de líquido: caudal con apertura 100 % a la ΔP nominal (aguas abajo: tratamiento de agua / tanques, barg)
  lcvW: { qmax: 60 / 3600, dpn: 2.2, pdown: 0.6 },
  lcvO: { qmax: 90 / 3600, dpn: 2.0, pdown: 0.7 },
  // válvula de gas: caudal estándar con apertura 100 % a la presión nominal; aguas abajo compresión/antorcha a 5 psig
  pcv:  { qmax: 8000 / 3600, pnom: 38 / K.psi, pdown: 0.35 },
  // bypass manuales (globo) en paralelo con cada válvula de control
  bypW: { qmax: 50 / 3600, dpn: 2.2 },
  bypO: { qmax: 75 / 3600, dpn: 2.0 },
  bypG: { qmax: 6000 / 3600, pnom: 38 / K.psi, pdown: 0.35 },
  qDrain: 12 / 3600,          // drenajes de fondo abiertos (agua)
  tauV: 2.0, rateV: 25,       // s, %/s
  driftV: 0.5,                // %/s: deriva de una válvula que "no abre" / "no cierra"
  Cw: 1.84                    // coeficiente de Francis
};
M.headEq = M.D / 6;                                    // longitud equivalente de un cabezal 2:1
M.L1 = 0.74 * M.Lss + M.headEq; M.L2 = 0.26 * M.Lss + M.headEq;
M.Tr = M.T / M.Tstd;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function segArea(h, R) { h = clamp(h, 0, 2 * R); return R * R * Math.acos((R - h) / R) - (R - h) * Math.sqrt(Math.max(0, 2 * R * h - h * h)); }
const NT = 600, tabH = new Float64Array(NT + 1), tabA = new Float64Array(NT + 1);
for (let i = 0; i <= NT; i++) { tabH[i] = i * M.D / NT; tabA[i] = segArea(tabH[i], M.R); }
function hFromArea(a) {
  if (a <= 0) return 0; if (a >= tabA[NT]) return M.D;
  let lo = 0, hi = NT; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tabA[mid] <= a) lo = mid; else hi = mid; }
  const f = (a - tabA[lo]) / (tabA[hi] - tabA[lo] || 1); return tabH[lo] + f * (tabH[hi] - tabH[lo]);
}
const Afull = segArea(M.D, M.R), V1full = Afull * M.L1, V2full = Afull * M.L2;
const lvl1 = V => hFromArea(V / M.L1), lvl2 = V => hFromArea(V / M.L2);
const vol1 = h => segArea(h, M.R) * M.L1, vol2 = h => segArea(h, M.R) * M.L2;
const chord = h => 2 * Math.sqrt(Math.max(0, 2 * M.R * h - h * h));
const bWeir = chord(M.hWeir);

// ───────────────────────── Estado ─────────────────────────
const feed = { Q: 80, wc: 40, gor: 60 };      // 12 076 bbl/d · 40 % · 337 scf/bbl → 2,44 MMSCFD
const st = {};
function mkCtrl(tag, sp, Kp, Ti, dir) { return { tag, sp, Kp, Ti, dir, mode: 'AUTO', man: 30, op: 30, pos: 30, I: 30, byp: 0 }; }
function valveFlow(v, pos, dp) { return pos / 100 * v.qmax * Math.sqrt(Math.max(0, dp) / v.dpn); }
// gas: el caudal másico crece con la presión absoluta aguas arriba y se ahoga a partir de ΔP/P₁ = 0,5
function gasG(P, v) { const Pabs = P + M.Pstd; return Pabs * Math.sqrt(Math.min(0.5, Math.max(0, P - v.pdown) / Pabs)); }
function gasValveFlow(v, pos, P) { return pos / 100 * v.qmax * gasG(P, v) / gasG(v.pnom, v); }
// umbrales de alarma (SI) tomados de la pantalla del operador: presión en psi, niveles en ft
const AL = {
  P: { HH: 60 / K.psi, H: 40 / K.psi, L: 15 / K.psi, LL: 10 / K.psi },
  W: { HH: 5.7 / K.ft, H: 5.0 / K.ft, L: 1.0 / K.ft, LL: 1.0 / K.ft },
  O: { HH: 5.7 / K.ft, H: 5.2 / K.ft, L: 1.4 / K.ft, LL: 1.0 / K.ft },
};
const CKEY = { lic1: 'W', lic2: 'O', pic: 'G' };     // controlador → línea

function resetState() {
  st.t = 0;
  st.pic = mkCtrl('PIC-100', 38 / K.psi, 60, 40, 1);   // 38 psig
  st.lic1 = mkCtrl('LIC-101', 0.87, 400, 800, 1);      // interfase 2,85 ft
  st.lic2 = mkCtrl('LIC-103', 0.76, 150, 600, 1);      // petróleo 2,5 ft
  st.psvOpen = false; st.psvLift = 0; st.ruptured = false;
  st.fault = { W: null, O: null, G: null, RO: null, solids: false };
  st.block = { W: false, O: false, G: false }; st.drainOpen = false;
  st.slug = null; st.hSand = 0;
  st.alarms = {}; st.carry = 0;
  // régimen estable: interfase en SP, petróleo sobre el vertedero con la carga de Francis del caudal
  const Qo = feed.Q * (1 - feed.wc / 100) / 3600, Qw = feed.Q * feed.wc / 100 / 3600;
  const H0 = Math.pow(Qo / (M.Cw * bWeir), 2 / 3);
  st.Vw1 = vol1(st.lic1.sp); st.Vo1 = vol1(M.hWeir + H0) - st.Vw1;
  st.Vw2 = 0; st.Vo2 = vol2(st.lic2.sp);
  const Vg = V1full + V2full - (st.Vw1 + st.Vo1 + st.Vw2 + st.Vo2);
  st.P = st.pic.sp; st.Vstd = (st.P + M.Pstd) * Vg / (M.Pstd * M.Tr);
  // aperturas de equilibrio
  const dpw = (st.P - M.lcvW.pdown) + 1000 * 9.81 * (M.hWeir + H0) / 1e5;
  const dpo = (st.P - M.lcvO.pdown) + 850 * 9.81 * st.lic2.sp / 1e5;
  const Qg = Qo * feed.gor;
  const opW = clamp(100 * Qw / (M.lcvW.qmax * Math.sqrt(dpw / M.lcvW.dpn)), 0, 100);
  const opO = clamp(100 * Qo / (M.lcvO.qmax * Math.sqrt(dpo / M.lcvO.dpn)), 0, 100);
  const opG = clamp(100 * Qg / (M.pcv.qmax * gasG(st.P, M.pcv) / gasG(M.pcv.pnom, M.pcv)), 0, 100);
  for (const [c, op] of [[st.lic1, opW], [st.lic2, opO], [st.pic, opG]]) { c.op = c.pos = c.I = c.man = op; }
  st.flows = {}; st.lv = {}; computeLevels();
  trend.length = 0; trendAcc = 0;
}
function computeLevels() {
  const lv = st.lv, Vs = vol1(st.hSand);
  lv.hw1 = lvl1(st.Vw1 + Vs); lv.hl1 = lvl1(st.Vw1 + st.Vo1 + Vs);
  lv.hw2 = lvl2(st.Vw2); lv.hl2 = lvl2(st.Vw2 + st.Vo2);
  const Vg = Math.max(0.5, V1full + V2full - (st.Vw1 + st.Vo1 + st.Vw2 + st.Vo2 + Vs));
  lv.Vg = Vg; st.P = clamp(st.Vstd * M.Pstd * M.Tr / Vg - M.Pstd, -0.9, 25);
}
function pid(c, pv, dt) {
  if (c.mode === 'MAN') { c.op = c.man; c.I = c.man; return; }
  const e = (pv - c.sp) * c.dir;
  c.I += c.Kp / c.Ti * e * dt;
  let op = c.Kp * e + c.I;
  if (op > 100) { op = 100; c.I = 100 - c.Kp * e; } else if (op < 0) { op = 0; c.I = -c.Kp * e; }
  c.op = op;
}
// mueve la válvula hacia OP; una válvula con falla deriva a cierre/apertura o queda con carrera limitada (taponamiento)
function moveValve(c, dt, key) {
  const f = st.fault[key];
  if (f && f.type === 'closed') { c.pos = Math.max(0, c.pos - M.driftV * dt); return; }
  if (f && f.type === 'open') { c.pos = Math.min(100, c.pos + M.driftV * dt); return; }
  const d = (c.op - c.pos) * dt / M.tauV, lim = M.rateV * dt;
  c.pos = clamp(c.pos + clamp(d, -lim, lim), 0, 100);
  if (f && f.type === 'limit') c.pos = clamp(c.pos, f.min, f.max);
}
function slugMult(t) { return t < 120 ? 1 + 3.5 * t / 120 : t < 180 ? 4.5 : t < 210 ? 1 + 3.5 * (210 - t) / 30 : 1; }   // bache de gas: rampa 2 min, meseta ×4,5, bajada

function step(dt) {
  if (st.ruptured) return;
  const Q = feed.Q / 3600, wc = feed.wc / 100;
  const Qw_in = Q * wc, Qo_in = Q * (1 - wc);
  let mult = 1;
  if (st.slug) { mult = slugMult(st.slug.t); st.slug.t += dt; if (st.slug.t >= 210) { st.slug = null; logEvent('Bache de gas finalizó — GOR de nuevo en su valor', 'g'); } }
  const Qg_in = Qo_in * feed.gor * mult;
  // exceso de sólidos: la arena se acumula en el fondo y tapona parcialmente las válvulas de líquido
  if (st.fault.solids) st.hSand = Math.min(0.5, st.hSand + 0.04 / 60 * dt);
  if (st.drainOpen && st.hSand > 0) st.hSand = Math.max(0, st.hSand - 0.06 / 60 * dt);
  if (st.fault.solids || (st.fault.W && st.fault.W.type === 'limit')) {
    const h = st.hSand;
    st.fault.W = h > 0.005 ? { type: 'limit', min: 30 * h, max: 100 - 200 * h } : null;
    st.fault.O = h > 0.005 ? { type: 'limit', min: 0, max: 100 - 100 * h } : null;
  }
  const lv = st.lv, P = st.P;
  // vertedero (Francis) — petróleo y, si la interfase lo supera, también agua
  const Hl = Math.max(0, lv.hl1 - M.hWeir), Hw = Math.max(0, lv.hw1 - M.hWeir);
  const Qover = M.Cw * bWeir * Math.pow(Hl, 1.5);
  const Qover_w = Math.min(Qover, M.Cw * bWeir * Math.pow(Hw, 1.5));
  const Qover_o = Qover - Qover_w;
  // retorno si el compartimento de petróleo rebosa el vertedero
  const Hb = Math.max(0, lv.hl2 - M.hWeir); const Qback = M.Cw * bWeir * Math.pow(Hb, 1.5);
  // estaciones de control: línea principal (bloqueos + válvula de control) en paralelo con el bypass de globo
  const dpw = (P - M.lcvW.pdown) + 1000 * 9.81 * lv.hl1 / 1e5;
  const QwMain = st.block.W ? 0 : valveFlow(M.lcvW, st.lic1.pos, dpw);
  const QwV = QwMain + valveFlow(M.bypW, st.lic1.byp, dpw);
  const fw1 = clamp(lv.hw1 / 0.12, 0, 1);            // si la interfase cae, la salida de agua arrastra petróleo
  const Qw_out_w = QwV * fw1, Qw_out_o = QwV * (1 - fw1);
  const dpo = (P - M.lcvO.pdown) + 850 * 9.81 * lv.hl2 / 1e5;
  const QoMain = st.block.O ? 0 : valveFlow(M.lcvO, st.lic2.pos, dpo);
  const QoV = QoMain + valveFlow(M.bypO, st.lic2.byp, dpo);
  const fw2 = clamp(lv.hw2 / 0.12, 0, 1);            // agua decantada en el compartimento sale primero
  const Qo_out_w = QoV * fw2, Qo_out_o = QoV * (1 - fw2);
  const QgMain = st.block.G ? 0 : gasValveFlow(M.pcv, st.pic.pos, P);
  let Qg_out = QgMain + gasValveFlow(M.bypG, st.pic.byp, P);
  if (st.fault.RO) Qg_out = Math.min(Qg_out, st.fault.RO.qmax);   // placa orificio en el colector: limita PCV + bypass
  const Qdr = st.drainOpen && lv.hw1 > 0.05 ? M.qDrain : 0;
  // PSV con histéresis; el alivio crece con la presión absoluta
  if (!st.psvOpen && P >= M.psvSet) { st.psvOpen = true; logEvent('PSV-100 abre — sobrepresión ' + fP(P), 'a'); }
  if (st.psvOpen && P <= M.psvSet * M.psvReseat) { st.psvOpen = false; logEvent('PSV-100 reasienta a ' + fP(P), 'g'); }
  st.psvLift = st.psvOpen ? clamp((P - M.psvSet * M.psvReseat) / (M.psvSet * 0.1), 0.15, 1) : 0;
  const Qpsv = st.psvLift * M.psvCap * (P + M.Pstd) / (1.1 * M.psvSet + M.Pstd);
  // integración explícita
  st.Vw1 += (Qw_in - Qw_out_w - Qover_w - Qdr) * dt;
  st.Vo1 += (Qo_in - Qw_out_o - Qover_o + Qback) * dt;
  st.Vw2 += (Qover_w - Qo_out_w) * dt;
  st.Vo2 += (Qover_o - Qo_out_o - Qback) * dt;
  st.Vstd += (Qg_in - Qg_out - Qpsv) * dt;
  st.Vw1 = Math.max(0, st.Vw1); st.Vo1 = Math.max(0, st.Vo1); st.Vw2 = Math.max(0, st.Vw2); st.Vo2 = Math.max(0, st.Vo2);
  st.Vstd = Math.max(1, st.Vstd);
  // recipiente lleno: el líquido excedente se arrastra por la línea de gas
  let carry = 0;
  const cap1 = V1full * 0.985 - vol1(st.hSand), cap2 = V2full * 0.985;
  if (st.Vw1 + st.Vo1 > cap1) { carry += st.Vw1 + st.Vo1 - cap1; st.Vo1 = Math.max(0, cap1 - st.Vw1); st.Vw1 = Math.min(st.Vw1, cap1); }
  if (st.Vw2 + st.Vo2 > cap2) { carry += st.Vw2 + st.Vo2 - cap2; st.Vo2 = Math.max(0, cap2 - st.Vw2); st.Vw2 = Math.min(st.Vw2, cap2); }
  st.carry = carry / dt;
  computeLevels();
  if (st.P >= M.Pdesign) { st.ruptured = true; logEvent('¡ESTALLIDO DE VASIJA POR SOBREPRESIÓN! P = ' + fP(st.P) + ' ≥ presión de diseño ' + fP(M.Pdesign, 0) + ' — simulación detenida', 'a'); }
  // lazos de control (acción directa: PV sube → válvula abre)
  pid(st.pic, st.P, dt); pid(st.lic1, st.lv.hw1, dt); pid(st.lic2, st.lv.hl2, dt);
  moveValve(st.pic, dt, 'G'); moveValve(st.lic1, dt, 'W'); moveValve(st.lic2, dt, 'O');
  st.t += dt;
  Object.assign(st.flows, { Qw_in, Qo_in, Qg_in, Qover, Qover_o, Qover_w, QwV, QoV, Qo_out_w, Qg_out, QwMain, QoMain, QgMain, Qpsv, Qback, Qdr, wc, mult });
  // tendencias: una muestra por segundo simulado
  trendAcc += dt; if (trendAcc >= 1) { trendAcc -= 1; trend.push({ t: st.t, P: st.P, hw: lv.hw1, ho: lv.hl2, spP: st.pic.sp, spW: st.lic1.sp, spO: st.lic2.sp }); if (trend.length > 600) trend.shift(); }
  checkAlarms();
  scenarioTick(dt);
}
const trend = []; let trendAcc = 0;

// ───────────────────────── Alarmas y registro ─────────────────────────
// [tag, condición, texto, crítica (HH/LL → estado ¡DOOM!)]
const alarmDefs = [
  ['PAHH-100', () => st.P > AL.P.HH, 'Presión muy alta', true],
  ['PAH-100', () => st.P > AL.P.H, 'Presión alta'],
  ['PAL-100', () => st.P < AL.P.L, 'Presión baja'],
  ['PALL-100', () => st.P < AL.P.LL, 'Presión muy baja', true],
  ['LAHH-101', () => st.lv.hw1 > AL.W.HH, 'Interfase muy alta', true],
  ['LAH-101', () => st.lv.hw1 > AL.W.H, 'Interfase alta'],
  ['LAL-101', () => st.lv.hw1 < AL.W.L, 'Interfase baja'],
  ['LALL-101', () => st.lv.hw1 < AL.W.LL, 'Interfase muy baja', true],
  ['LAHH-103', () => st.lv.hl2 > AL.O.HH, 'Nivel de petróleo muy alto', true],
  ['LAH-103', () => st.lv.hl2 > AL.O.H, 'Nivel de petróleo alto'],
  ['LAL-103', () => st.lv.hl2 < AL.O.L, 'Nivel de petróleo bajo'],
  ['LALL-103', () => st.lv.hl2 < AL.O.LL, 'Nivel de petróleo muy bajo', true],
  ['ARRASTRE', () => st.lv.hl1 > 0.88 * M.D || st.carry > 0, 'Carry over — arrastre de líquido en la línea de gas', true],
  ['AGUA→PETRÓLEO', () => st.lv.hw2 > 0.1 || ((st.flows.Qo_out_w || 0) > 0.0005 && st.flows.Qo_out_w > 0.15 * st.flows.QoV), 'Agua sobre el vertedero — sale por la línea de petróleo a tanques', true],
  ['PETRÓLEO→AGUA', () => st.lv.hw1 < 0.12 && (st.flows.QwV || 0) > 0.0005, 'Petróleo por la salida de agua (a tanques de agua)', true],
  ['GAS→PETRÓLEO', () => st.lv.hl2 < 0.10 && (st.flows.QoV || 0) > 0.0005, 'Arrastre de gas hacia tanques — burbujeo', true],
  ['SÓLIDOS→TANQUES', () => st.hSand >= 0.3, 'Sólidos en tanques de almacenamiento', true],
];
function checkAlarms() {
  for (const [tag, fn, txt] of alarmDefs) {
    const on = fn(); const was = !!st.alarms[tag];
    if (on && !was) logEvent(tag + ' ' + txt, 'a');
    if (!on && was) logEvent(tag + ' normalizada', 'g');
    st.alarms[tag] = on;
  }
}
const logEl = document.getElementById('log');
function fmtT(t) { t = Math.floor(t); const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60; return [h, m, s].map(v => String(v).padStart(2, '0')).join(':'); }
function logEvent(msg, cls) {
  const div = document.createElement('div'); div.innerHTML = '<span class="t">' + fmtT(st.t || 0) + '</span><span class="' + (cls || '') + '">' + msg + '</span>';
  logEl.prepend(div); while (logEl.children.length > 80) logEl.lastChild.remove();
}
