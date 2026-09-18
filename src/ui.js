// ───────────────────────── Interfaz ─────────────────────────
const $ = id => document.getElementById(id);
const fpc = $('faceplates');
function setMode(ctrl, m, quiet) {
  const cc = st[ctrl]; if (cc.mode === m) return;
  const pv = ctrl === 'pic' ? st.P : ctrl === 'lic1' ? st.lv.hw1 : st.lv.hl2;
  if (m === 'AUTO') { cc.I = cc.pos - cc.Kp * (pv - cc.sp) * cc.dir; } else { cc.man = cc.pos; }
  cc.mode = m; if (!quiet) logEvent(cc.tag + ' pasa a ' + m + (m === 'MAN' ? ' — la barra OP regula la válvula de control' : ''), 'g');
  syncFPInputs();
}
function setBlock(line, closed, quiet) {
  if (st.block[line] === closed) return; st.block[line] = closed;
  const name = { W: 'agua', O: 'petróleo', G: 'gas' }[line];
  if (!quiet) logEvent('Válvulas de línea principal de ' + name + (closed ? ' CERRADAS — solo pasa el bypass' : ' abiertas'), closed ? 'a' : 'g');
  syncFPInputs();
}
function setDrains(open, quiet) {
  if (st.drainOpen === open) return; st.drainOpen = open;
  if (!quiet) logEvent('Drenajes de fondo ' + (open ? 'ABIERTOS — sale agua y arena por los fondos' : 'cerrados'), open ? 'a' : 'g');
  $('drainSeg').querySelectorAll('button').forEach(b => b.classList.toggle('on', (b.dataset.d === 'open') === open));
}
function buildFP(getC, o) {
  const el = document.createElement('div'); el.className = 'card fp';
  el.innerHTML = `<div class="head"><span class="tag">${o.tag}</span><span class="desc">${o.desc}</span><span class="chip on mode">AUTO</span></div>
    <div class="pvline"><span class="k">PV</span><span class="pv">–</span><span class="unit">–</span><span class="k" style="margin-left:auto">SP</span><span class="sp val" style="font-family:'IBM Plex Mono',monospace;font-size:13px">–</span></div>
    <div class="row"><label>Set point</label><input type="range" class="spr"><span class="val spv">–</span></div>
    <div class="row"><label>OP → ${o.valve}</label><div class="opwrap"><div class="bar"><i></i></div><input type="range" class="opr" min="0" max="100" step="1" hidden></div><span class="val opv">–</span></div>
    <div class="row modes"><label>Modo</label><div class="seg modeseg"><button class="on" data-m="AUTO">AUTO</button><button data-m="MAN">MAN</button></div></div>
    <div class="row"><label>Apertura bypass</label><input type="range" class="byp" min="0" max="100" step="1"><span class="val bypv">–</span></div>
    <div class="row modes"><label>Línea principal</label><div class="seg blockseg"><button class="on" data-b="open">ABIERTA</button><button data-b="closed">CERRADA</button></div></div>
    <div class="alarms">${o.alarms.map(a => `<span class="chip" data-a="${a}">${a}</span>`).join('')}</div>
    <div class="alset"></div>`;
  fpc.appendChild(el);
  const r = { el, pv: el.querySelector('.pv'), unit: el.querySelector('.unit'), spr: el.querySelector('.spr'), spv: el.querySelector('.spv'), sp2: el.querySelector('.sp'), bar: el.querySelector('.bar i'), barEl: el.querySelector('.bar'), opr: el.querySelector('.opr'), opv: el.querySelector('.opv'), byp: el.querySelector('.byp'), bypv: el.querySelector('.bypv'), mode: el.querySelector('.mode'), chips: [...el.querySelectorAll('[data-a]')], alset: el.querySelector('.alset'), o, getC };
  r.spr.addEventListener('input', () => { getC().sp = o.fromDisp(+r.spr.value); });
  r.opr.addEventListener('input', () => { getC().man = +r.opr.value; });
  r.byp.addEventListener('input', () => { getC().byp = +r.byp.value; });
  r.byp.addEventListener('change', () => { logEvent('Bypass de ' + o.valve + ' al ' + Math.round(getC().byp) + ' %', 'a'); });
  el.querySelectorAll('.modeseg button').forEach(b => b.addEventListener('click', () => setMode(o.ctrl, b.dataset.m)));
  el.querySelectorAll('.blockseg button').forEach(b => b.addEventListener('click', () => setBlock(o.line, b.dataset.b === 'closed')));
  return r;
}
const FPS = [
  buildFP(() => st.pic, { tag: 'PIC-100', ctrl: 'pic', line: 'G', desc: 'Presión de gas → PCV-100', valve: 'PCV-100', alarms: ['PAHH-100', 'PAH-100', 'PAL-100', 'PALL-100'], pv: () => st.P, al: AL.P, alf: v => vP(v).toFixed(UN.imp ? 0 : 2),
    unit: uP, toDisp: vP, fromDisp: v => UN.imp ? v / K.psi : v, fmt: v => fP(v), slider: () => UN.imp ? [10, 65, 1] : [0.7, 4.5, 0.1] }),
  buildFP(() => st.lic1, { tag: 'LIC-101', ctrl: 'lic1', line: 'W', desc: 'Interfase agua/petróleo → LCV-101', valve: 'LCV-101', alarms: ['LAHH-101', 'LAH-101', 'LAL-101', 'LALL-101'], pv: () => st.lv.hw1, al: AL.W, alf: v => vL(v).toFixed(UN.imp ? 1 : 2),
    unit: uL, toDisp: vL, fromDisp: v => UN.imp ? v / K.ft : v, fmt: v => fL(v), slider: () => UN.imp ? [1, 5.9, 0.1] : [0.3, 1.8, 0.05] }),
  buildFP(() => st.lic2, { tag: 'LIC-103', ctrl: 'lic2', line: 'O', desc: 'Nivel de petróleo → LCV-103', valve: 'LCV-103', alarms: ['LAHH-103', 'LAH-103', 'LAL-103', 'LALL-103'], pv: () => st.lv.hl2, al: AL.O, alf: v => vL(v).toFixed(UN.imp ? 1 : 2),
    unit: uL, toDisp: vL, fromDisp: v => UN.imp ? v / K.ft : v, fmt: v => fL(v), slider: () => UN.imp ? [1.3, 5.9, 0.1] : [0.4, 1.8, 0.05] }),
];
function syncFPInputs() {
  for (const r of FPS) {
    const cc = r.getC(), [mn, mx, stp] = r.o.slider(); r.spr.min = mn; r.spr.max = mx; r.spr.step = stp; r.spr.value = r.o.toDisp(cc.sp); r.unit.textContent = r.o.unit();
    r.opr.value = Math.round(cc.man); r.byp.value = Math.round(cc.byp); r.barEl.hidden = cc.mode === 'MAN'; r.opr.hidden = cc.mode !== 'MAN';
    r.el.querySelectorAll('.modeseg button').forEach(x => x.classList.toggle('on', x.dataset.m === cc.mode));
    r.el.querySelectorAll('.blockseg button').forEach(x => x.classList.toggle('on', (x.dataset.b === 'closed') === st.block[r.o.line]));
  }
}
const faultTxt = f => !f ? '' : f.type === 'closed' ? 'NO ABRE' : f.type === 'open' ? 'NO CIERRA' : 'TAPONADA';
function updateFPs() {
  for (const r of FPS) {
    const cc = r.getC(), pv = r.o.pv(), inAlarm = r.o.alarms.some(a => st.alarms[a]), f = st.fault[r.o.line];
    r.pv.textContent = r.o.fmt(pv).split(' ')[0]; r.pv.classList.toggle('alarm', inAlarm);
    r.spv.textContent = r.o.fmt(cc.sp); r.sp2.textContent = r.o.fmt(cc.sp).split(' ')[0];
    r.bar.style.width = cc.pos.toFixed(1) + '%'; r.opv.textContent = cc.pos.toFixed(1) + ' %';
    r.bypv.textContent = Math.round(cc.byp) + ' %'; if (document.activeElement !== r.byp) r.byp.value = Math.round(cc.byp);
    r.mode.textContent = cc.mode + (f ? ' · ' + faultTxt(f) : ''); r.mode.className = 'chip ' + (f ? 'alarm' : 'on') + ' mode';
    r.chips.forEach(ch => ch.classList.toggle('alarm', !!st.alarms[ch.dataset.a]));
    const A = r.o.al, fmt = r.o.alf; r.alset.textContent = 'HH ' + fmt(A.HH) + ' · H ' + fmt(A.H) + ' · L ' + fmt(A.L) + ' · LL ' + fmt(A.LL) + ' ' + r.o.unit();
  }
}
// alimentación
function syncFeedSliders() {   // rangos y valores de los deslizadores en el sistema de unidades activo
  const q = $('qliq'), g = $('gor');
  if (UN.imp) { q.min = 0; q.max = 25000; q.step = 100; q.value = Math.round(vQ(feed.Q)); g.min = 0; g.max = 1100; g.step = 10; g.value = Math.round(vGOR(feed.gor)); }
  else { q.min = 0; q.max = 170; q.step = 1; q.value = Math.round(feed.Q); g.min = 0; g.max = 200; g.step = 1; g.value = Math.round(feed.gor); }
  syncFeed();
}
function syncFeed() {
  $('qliqV').textContent = fQ(feed.Q, 0); $('wcV').textContent = feed.wc + ' %'; $('gorV').textContent = Math.round(vGOR(feed.gor)) + ' ' + uGOR();
  const qo = feed.Q * (1 - feed.wc / 100), qg = qo * feed.gor;
  $('dW').textContent = fQ(feed.Q * feed.wc / 100, 0); $('dO').textContent = fQ(qo, 0); $('dG').textContent = fG(qg);
  $('dCap').textContent = Math.round(100 * feed.Q / M.capLiq) + ' % líq · ' + Math.round(100 * qg / M.capGas) + ' % gas';
}
$('qliq').addEventListener('input', e => { feed.Q = UN.imp ? +e.target.value / K.bpd : +e.target.value; syncFeed(); });
$('wc').addEventListener('input', e => { feed.wc = +e.target.value; syncFeed(); });
$('gor').addEventListener('input', e => { feed.gor = UN.imp ? +e.target.value / K.scfbbl : +e.target.value; syncFeed(); });
// ── sistema de unidades ──
function setUnits(imp, quiet) {
  UN.imp = imp;
  document.querySelectorAll('.units button').forEach(b => b.classList.toggle('on', (b.dataset.u === 'imp') === imp));
  syncFeedSliders(); syncFPInputs(); updateFPs(); updateHUD();
  try { localStorage.setItem('sepdoom-units', imp ? 'imp' : 'si'); } catch (e) { }
  if (!quiet) logEvent('Unidades ' + (imp ? 'inglesas: psig · ft · bbl/día · MMSCFD' : 'SI: barg · m · m³/h · Sm³/h'), 'g');
}
document.querySelectorAll('.units button').forEach(b => b.addEventListener('click', () => { if ((b.dataset.u === 'imp') !== UN.imp) setUnits(b.dataset.u === 'imp'); }));
let speed = 20, paused = false;
function setSpeed(v) { speed = v; $('speed').value = v; $('speedV').textContent = '×' + v; }
$('speed').addEventListener('input', e => setSpeed(+e.target.value));
$('pause').addEventListener('click', () => { paused = !paused; $('pause').textContent = paused ? 'Reanudar' : 'Pausar'; $('pause').classList.toggle('primary', paused); });
$('reset').addEventListener('click', () => { cancelEvent(true); resetState(); syncFPInputs(); setDrains(false, true); logEl.innerHTML = ''; logEvent('Reinicio a régimen estable', 'g'); renderEvents(true); });
$('drainSeg').querySelectorAll('button').forEach(b => b.addEventListener('click', () => setDrains(b.dataset.d === 'open')));
document.addEventListener('keydown', e => { if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); $('pause').click(); } });
// ── panel de créditos (desde la derecha) ──
const crDrawer = $('crDrawer'), crBackdrop = $('crBackdrop');
function openCredits(open) {
  crDrawer.classList.toggle('open', open); crBackdrop.classList.toggle('show', open);
  crDrawer.inert = !open; crDrawer.setAttribute('aria-hidden', String(!open)); document.body.style.overflow = open ? 'hidden' : '';
  if (open) setTimeout(() => $('crClose').focus(), 60); else $('creditsBtn').focus();
}
$('creditsBtn').addEventListener('click', () => openCredits(true));
$('crClose').addEventListener('click', () => openCredits(false));
crBackdrop.addEventListener('click', () => openCredits(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && crDrawer.classList.contains('open')) openCredits(false); });
function updateHUD() {
  $('tsim').textContent = fmtT(st.t); $('hP').textContent = fP(st.P); $('hI').textContent = fL(st.lv.hw1); $('hO').textContent = fL(st.lv.hl2);
  const anyAlarm = Object.values(st.alarms).some(Boolean), doom = st.ruptured || st.psvOpen || st.carry > 0 || alarmDefs.some(a => a[3] && st.alarms[a[0]]);
  const ch = $('stateChip'); ch.textContent = st.ruptured ? '¡DOOM! ESTALLIDO' : doom ? '¡DOOM!' : anyAlarm ? 'Alarma' : 'Estable'; ch.className = 'chip ' + (doom || anyAlarm ? 'alarm' : 'ok');
}

// ───────────────────────── Eventos del flujograma causa-efecto ─────────────────────────
// Cada evento: falla inyectada → efecto → alarma esperada → pasos del ramal "SÍ se maneja" → retorno; si no, consecuencia del ramal "NO".
const MNT = {   // tareas de mantenimiento (minutos simulados) del flujograma
  standpipe: { label: 'LIMPIEZA DE STAND PIPE', dur: 180 },
  solvent: { label: 'LIMPIEZA CON SOLVENTES DE HIDROCARBURO', dur: 180, after: 'standpipe', repair: true },
  airline: { label: 'REVISIÓN DE LÍNEA DE AIRE', dur: 120 },
  drainline: { label: 'DRENAJE DE LÍQUIDO EN LÍNEA O TAPONAMIENTOS', dur: 120, after: 'airline', repair: true },
};
const mnt = id => Object.assign({ k: 'mnt', id }, MNT[id]);
const valveSteps = (ctrl, first) => [first, { k: 'man', ctrl, label: 'SEPARADOR MODO MANUAL' }, mnt('standpipe'), mnt('solvent'), mnt('airline'), mnt('drainline')];
const EV = [
  { id: 'W_NA', btn: 'Válvula de agua no abre', title: 'MAL FUNCIONAMIENTO EN VÁLVULA DE AGUA – NO ABRE', gas: false, loops: ['lic1'], lines: ['W'],
    fixed: 'LCV-101 vuelve a responder', inject: () => { st.fault.W = { type: 'closed' }; }, effect: 'AUMENTO DE NIVEL TOTAL', alarm: 'ALARMA DE NIVEL DE INTERFASE H Y HH', alarmTags: ['LAH-101', 'LAHH-101'],
    steps: valveSteps('lic1', { k: 'byp', ctrl: 'lic1', label: 'SE ABRE VÁLVULA BYPASS DE AGUA' }),
    bad: { label: 'CARRY OVER – ARRASTRE DE LÍQUIDO EN LÍNEA DE GAS', test: () => st.alarms['ARRASTRE'] || st.alarms['AGUA→PETRÓLEO'] }, good: 'RETORNO A NIVELES NORMALES' },
  { id: 'W_NC', btn: 'Válvula de agua no cierra', title: 'MAL FUNCIONAMIENTO EN VÁLVULA DE AGUA – NO CIERRA', gas: false, loops: ['lic1'], lines: ['W'],
    fixed: 'LCV-101 vuelve a responder', inject: () => { st.fault.W = { type: 'open' }; }, effect: 'PÉRDIDA DE COLCHÓN DE AGUA', alarm: 'ALARMA DE NIVEL DE INTERFASE L Y LL', alarmTags: ['LAL-101', 'LALL-101'],
    steps: valveSteps('lic1', { k: 'block', line: 'W', label: 'SE CIERRAN VÁLVULAS DE LÍNEA PRINCIPAL DE AGUA' }),
    bad: { label: 'PETRÓLEO EN TANQUES DE AGUA', test: () => st.alarms['PETRÓLEO→AGUA'] }, good: 'RETORNO A NIVELES NORMALES' },
  { id: 'O_NC', btn: 'Válvula de petróleo no cierra', title: 'MAL FUNCIONAMIENTO EN VÁLVULA DE PETRÓLEO – NO CIERRA', gas: false, loops: ['lic2'], lines: ['O'],
    fixed: 'LCV-103 vuelve a responder', inject: () => { st.fault.O = { type: 'open' }; }, effect: 'PÉRDIDA DE NIVEL DE PETRÓLEO', alarm: 'ALARMA DE NIVEL DE PETRÓLEO L Y LL', alarmTags: ['LAL-103', 'LALL-103'],
    steps: valveSteps('lic2', { k: 'block', line: 'O', label: 'SE CIERRAN VÁLVULAS DE LÍNEA PRINCIPAL DE PETRÓLEO' }),
    bad: { label: 'ARRASTRE DE GAS HACIA TANQUES DE ALMACENAMIENTO – BURBUJEO', test: () => st.alarms['GAS→PETRÓLEO'] }, good: 'RETORNO A NIVELES NORMALES' },
  { id: 'O_NA', btn: 'Válvula de petróleo no abre', title: 'MAL FUNCIONAMIENTO EN VÁLVULA DE PETRÓLEO – NO ABRE', gas: false, loops: ['lic2'], lines: ['O'],
    fixed: 'LCV-103 vuelve a responder', inject: () => { st.fault.O = { type: 'closed' }; }, effect: 'AUMENTO DE NIVEL TOTAL', alarm: 'ALARMA DE NIVEL DE PETRÓLEO H Y HH', alarmTags: ['LAH-103', 'LAHH-103'],
    steps: valveSteps('lic2', { k: 'byp', ctrl: 'lic2', label: 'SE ABRE VÁLVULA DE BYPASS DE PETRÓLEO' }),
    bad: { label: 'CARRY OVER – ARRASTRE DE LÍQUIDO EN LÍNEA DE GAS', test: () => st.alarms['ARRASTRE'] }, good: 'RETORNO A NIVELES NORMALES' },
  { id: 'RO', btn: 'Placa orificio muy pequeña', title: 'PLACA ORIFICIO MAL DIMENSIONADA – MUY PEQUEÑA', gas: true, loops: ['pic'], lines: [],
    fixed: 'placa orificio reemplazada — la línea de gas recupera su capacidad', inject: () => { st.fault.RO = { qmax: 0.85 * (st.flows.Qg_in || feed.Q / 3600 * (1 - feed.wc / 100) * feed.gor) }; }, effect: 'AUMENTO DE PRESIÓN EN SEPARADOR', alarm: 'ALARMA DE PRESIÓN H Y HH', alarmTags: ['PAH-100', 'PAHH-100'],
    steps: [{ k: 'mnt', id: 'plate', label: 'SE CAMBIA PLACA ORIFICIO', dur: 120, repair: true }, { k: 'mnt', id: 'platecheck', label: 'REVISIÓN DE CORRECTA INSTALACIÓN DE PLACA ORIFICIO', dur: 60, after: 'plate' }],
    bad: { label: 'APERTURA DE PSV – PÉRDIDA DE PRESIÓN – AUMENTO DE NIVEL TOTAL', test: () => st.psvOpen }, good: 'RETORNO A NIVELES NORMALES' },
  { id: 'G_NA', btn: 'PCV de gas no abre', title: 'MAL FUNCIONAMIENTO EN VÁLVULA DE GAS PCV – NO ABRE', gas: true, loops: ['pic'], lines: ['G'],
    fixed: 'PCV-100 vuelve a responder', inject: () => { st.fault.G = { type: 'closed' }; }, effect: 'AUMENTO DE PRESIÓN EN SEPARADOR', alarm: 'ALARMA DE PRESIÓN H Y HH', alarmTags: ['PAH-100', 'PAHH-100'],
    steps: [{ k: 'byp', ctrl: 'pic', label: 'SE ABRE VÁLVULA BYPASS DE GAS' }, { k: 'man', ctrl: 'pic', label: 'SEPARADOR EN MODO MANUAL' }, { k: 'mnt', id: 'tit', label: 'CAMBIO DE TIT', dur: 180, repair: true }],
    bad: { label: 'APERTURA DE PSV – PÉRDIDA DE PRESIÓN – AUMENTO DE NIVEL TOTAL – ESTALLIDO DE VASIJA POR SOBREPRESIÓN', test: () => st.psvOpen || st.ruptured, note: 'la PSV-100 alivia a antorcha; el estallido solo ocurriría si P alcanzara la presión de diseño (120 psi)' }, good: 'RETORNO A NIVELES NORMALES' },
  { id: 'G_NC', btn: 'PCV de gas no cierra', title: 'MAL FUNCIONAMIENTO EN VÁLVULA DE GAS – NO CIERRA', gas: true, loops: ['pic'], lines: ['G'],
    fixed: 'PCV-100 vuelve a responder', inject: () => { st.fault.G = { type: 'open' }; }, effect: 'DISMINUCIÓN DE PRESIÓN DE SEPARADOR – AUMENTO DE NIVEL TOTAL DE FLUIDO', alarm: 'ALARMA DE PRESIÓN L Y LL', alarmTags: ['PAL-100', 'PALL-100', 'LAH-103', 'LAH-101'],
    steps: [{ k: 'block', line: 'G', label: 'CIERRE DE VÁLVULAS DE LÍNEA PRINCIPAL DE GAS' }, { k: 'man', ctrl: 'pic', label: 'SEPARADOR EN MODO MANUAL' }, { k: 'mnt', id: 'tit', label: 'CAMBIO DE TIT', dur: 180, repair: true }],
    bad: { label: 'CARRY OVER – IMPLOSIÓN DE SEPARADOR', test: () => st.alarms['ARRASTRE'] || st.alarms['PALL-100'] }, good: 'RETORNO A NIVELES NORMALES' },
  { id: 'SLUG', btn: 'Bache de gas', title: 'BACHE DE GAS', gas: true, loops: ['pic'], lines: [],
    inject: () => { st.slug = { t: 0 }; }, effect: 'AUMENTO REPENTINO DE PRESIÓN', alarm: 'ALARMA DE PRESIÓN H', alarmTags: ['PAH-100', 'PAHH-100'],
    steps: [{ k: 'byp', ctrl: 'pic', label: 'APERTURA DE VÁLVULA BYPASS DE GAS' }], regulate: true,
    repaired: () => !st.slug, restoreWhen: () => !st.slug && st.P < st.pic.sp + 0.15,
    bad: { label: 'ARRASTRE DE GAS HACIA TANQUES DE ALMACENAMIENTO – BURBUJEO', test: () => st.alarms['PAHH-100'] }, good: 'RETORNO A PRESIÓN NORMAL DE SEPARADOR' },
  { id: 'SOL', btn: 'Exceso de sólidos', title: 'EXCESO DE SÓLIDOS', gas: false, loops: ['lic1', 'lic2'], lines: [],
    fixed: 'separador limpio — LCV-101 y LCV-103 con carrera completa', inject: () => { st.fault.solids = true; }, effect: 'TAPONAMIENTO DE LÍNEAS – CIERRE O APERTURA INCOMPLETA', alarm: 'TAPONAMIENTO DETECTADO — carrera de LCV-101 limitada', alarmTags: ['LAH-101', 'LAHH-101', 'LAL-101', 'LAH-103', 'LAL-103'],
    trigger: () => st.hSand > 0.15,
    steps: [{ k: 'drain', label: 'DRENAJE DE ARENA POR FONDOS', note: 'mitigación — no está en el flujograma' },
      { k: 'note', id: 'clean', label: 'LIMPIEZA INTERIOR DE SEPARADOR – INSTALACIÓN DE DESARENADORES', text: 'requiere parada de planta, no se simula: se registra la limpieza y el equipo se restablece limpio', ready: () => st.hSand < 0.1, repair: true }],
    bad: { label: 'CARRY OVER – SÓLIDOS EN TANQUES DE ALMACENAMIENTO', test: () => st.alarms['SÓLIDOS→TANQUES'] }, good: 'RETORNO A OPERACIÓN NORMAL DE SEPARADOR' },
];
const EVMODE = { auto: true };
const SC = { a: null };
const bandOK = ctrl => ctrl === 'pic' ? (st.P > AL.P.L && st.P < AL.P.H && Math.abs(st.P - st.pic.sp) < 0.35) : ctrl === 'lic1' ? (st.lv.hw1 > AL.W.L && st.lv.hw1 < AL.W.H && Math.abs(st.lv.hw1 - st.lic1.sp) < 0.15) : (st.lv.hl2 > AL.O.L && st.lv.hl2 < AL.O.H && Math.abs(st.lv.hl2 - st.lic2.sp) < 0.15);
const pvOf = ctrl => ctrl === 'pic' ? st.P : ctrl === 'lic1' ? st.lv.hw1 : st.lv.hl2;
function faultCleared(ev) {
  if (ev.repaired) return ev.repaired();
  if (ev.id === 'RO') return !st.fault.RO; if (ev.id === 'SOL') return !st.fault.solids && st.hSand < 0.005;
  return ev.lines.every(l => !st.fault[l]);
}
function clearFault(ev) {
  if (ev.id === 'RO') st.fault.RO = null;
  else if (ev.id === 'SOL') { st.fault.solids = false; st.hSand = 0; st.fault.W = null; st.fault.O = null; }
  else for (const l of ev.lines) st.fault[l] = null;
}
// apertura de bypass que iguala el caudal de entrada en las condiciones actuales
function initialBypass(ctrl) {
  const f = st.flows, P = st.P; let x;
  if (ctrl === 'lic1') x = f.Qw_in / (M.bypW.qmax * Math.sqrt(Math.max(0.05, (P - M.lcvW.pdown) + 1000 * 9.81 * st.lv.hl1 / 1e5) / M.bypW.dpn));
  else if (ctrl === 'lic2') x = f.Qo_in / (M.bypO.qmax * Math.sqrt(Math.max(0.05, (P - M.lcvO.pdown) + 850 * 9.81 * st.lv.hl2 / 1e5) / M.bypO.dpn));
  else x = f.Qg_in / (M.bypG.qmax * gasG(Math.max(P, M.bypG.pdown + 0.2), M.bypG) / gasG(M.bypG.pnom, M.bypG));
  return clamp(Math.round(100 * x), 5, 100);
}
function startEvent(ev) {
  if (SC.a) cancelEvent(true);
  SC.a = { ev, t0: st.t, steps: ev.steps.map(s => Object.assign({ done: false, running: false, tEnd: 0, tDone: 0 }, s)), alarmSeen: false, tAlarm: 0, bad: null, nextAct: 0, restored: false, okSince: null, ended: false, opAcc: {} };
  ev.inject();
  logEvent('EVENTO · ' + ev.title + ' → efecto esperado: ' + ev.effect, 'a');
  setSpeed(EVMODE.auto ? 20 : (ev.gas ? 1 : 10));
  logEvent(EVMODE.auto ? 'Modo automático: el operador simulado ejecuta el ramal «SÍ se maneja» del flujograma (velocidad ×20)' : 'Modo práctica: actúa tú desde los faceplates y el panel de pasos (×' + speed + ' hasta la alarma; luego ×' + (ev.gas ? 1 : 3) + ')', 'g');
  renderEvents(true);
}
function cancelEvent(quiet) {
  const A = SC.a; if (!A) return;
  clearFault(A.ev); st.fault = { W: null, O: null, G: null, RO: null, solids: false }; st.slug = null; st.hSand = 0;
  for (const l of ['W', 'O', 'G']) setBlock(l, false, true); setDrains(false, true);
  for (const c of ['pic', 'lic1', 'lic2']) { st[c].byp = 0; setMode(c, 'AUTO', true); }
  if (!quiet && !A.ended) logEvent('Evento cancelado — fallas retiradas, bypass cerrados, lazos en AUTO', 'g');
  SC.a = null; renderEvents(true);
}
function doStep(A, s) {
  const ev = A.ev, who = EVMODE.auto ? 'Operador simulado: ' : 'Operador: ';
  switch (s.k) {
    case 'byp': { const c = st[s.ctrl]; c.byp = initialBypass(s.ctrl); logEvent(who + s.label + ' (' + c.byp + ' %)', 'g'); break; }
    case 'man': { const c = st[s.ctrl]; setMode(s.ctrl, 'MAN', true); if (c.byp < 3 && (st.block[CKEY[s.ctrl]] || st.fault[CKEY[s.ctrl]])) c.byp = initialBypass(s.ctrl); logEvent(who + s.label + ' — ' + c.tag + ' en MAN; el nivel/presión se regula con el bypass', 'g'); break; }
    case 'block': setBlock(s.line, true, true); logEvent(who + s.label, 'g'); break;
    case 'drain': setDrains(true, true); logEvent(who + s.label + (s.note ? ' (' + s.note + ')' : ''), 'g'); break;
    case 'mnt': s.running = true; s.tEnd = st.t + s.dur; logEvent('Mantenimiento: ' + s.label + ' · ' + Math.round(s.dur / 60) + ' min', 'g'); break;
    case 'note': s.done = true; s.tDone = st.t; logEvent(s.label + ' — ' + s.text, 'g'); if (s.repair) clearFault(ev); break;
  }
  renderEvents(true);
}
const depsOk = (A, s) => (!s.after || A.steps.find(x => x.id === s.after)?.done) && (!s.ready || s.ready());
function operatorRegulate(A, ctrl, dt) {
  const c = st[ctrl], period = ctrl === 'pic' ? 10 : 30;
  A.opAcc[ctrl] = (A.opAcc[ctrl] || 0) + dt; if (A.opAcc[ctrl] < period) return; A.opAcc[ctrl] = 0;
  const gain = ctrl === 'pic' ? 30 : 80, lim = ctrl === 'pic' ? 20 : 15;
  c.byp = clamp(c.byp + clamp(gain * (pvOf(ctrl) - c.sp), -lim, lim), 0, 100);
}
function scenarioTick(dt) {
  const A = SC.a; if (!A || A.ended) return;
  const ev = A.ev;
  if (!A.alarmSeen && ev.alarmTags.some(t => st.alarms[t])) { A.alarmSeen = true; A.tAlarm = st.t; logEvent('⚑ ' + ev.alarm + ' — ¿se maneja?', 'a'); }
  if (!A.triggered && (A.alarmSeen || (ev.trigger && ev.trigger()))) { A.triggered = true; if (!A.alarmSeen) logEvent('⚑ ' + ev.alarm + ' — ¿se maneja?', 'a'); if (!EVMODE.auto) { setSpeed(ev.gas ? 1 : 3); logEvent('Velocidad ×' + speed + ' para que puedas actuar', 'g'); } }
  if (!A.bad && ev.bad.test()) { A.bad = st.t; const why = Object.keys(st.alarms).filter(k => st.alarms[k]).join(', '); logEvent('NO SE MANEJÓ A TIEMPO → ' + ev.bad.label + (why ? ' (' + why + ')' : '') + (ev.bad.note ? ' — ' + ev.bad.note : ''), 'a'); }
  // detección de pasos (acciones del usuario en práctica o del operador simulado)
  for (const s of A.steps) {
    if (s.done) continue;
    let ok = false;
    if (s.k === 'byp') ok = st[s.ctrl].byp >= 5; else if (s.k === 'man') ok = st[s.ctrl].mode === 'MAN';
    else if (s.k === 'block') ok = st.block[s.line]; else if (s.k === 'drain') ok = st.drainOpen;
    else if (s.k === 'mnt' && s.running && st.t >= s.tEnd) { s.running = false; ok = true; logEvent('Completado: ' + s.label, 'g'); }
    if (ok) { s.done = true; s.tDone = st.t; if (s.repair && A.steps.filter(x => x.repair).every(x => x.done)) { clearFault(ev); logEvent('Falla corregida — ' + ev.fixed, 'g'); } renderEvents(true); }
  }
  const repaired = faultCleared(ev);
  if (EVMODE.auto) {
    if (A.triggered) {
      if (!A.nextAct) A.nextAct = st.t + (ev.gas ? 10 : 30);      // tiempo de reacción del operador
      const busy = A.steps.some(s => s.running);
      if (st.t >= A.nextAct && !busy) {
        const s = A.steps.find(s => !s.done && !s.running && depsOk(A, s));
        if (s) { doStep(A, s); A.nextAct = st.t + (s.k === 'mnt' ? 0 : 15); }
        else if (repaired && !A.restored && (!ev.restoreWhen || ev.restoreWhen())) {
          for (const c of ev.loops) { setMode(c, 'AUTO', true); st[c].byp = 0; }
          for (const l of ev.lines) setBlock(l, false, true); setDrains(false, true);
          A.restored = true; logEvent('Operador simulado: restablece la operación — lazo en AUTO, bypass cerrado, línea principal abierta', 'g'); renderEvents(true);
        }
      }
      if (!A.restored) for (const c of ev.loops) if (st[c].mode === 'MAN' || (ev.regulate && A.steps.some(s => s.k === 'byp' && s.done))) operatorRegulate(A, c, dt);
      if (ev.id === 'SOL' && st.drainOpen && st.hSand <= 0.001) setDrains(false, true);
    }
  }
  // ¿retorno a niveles normales? — falla corregida, equipo restablecido y variable dentro de banda durante 45 s
  const restoredNow = repaired && ev.loops.every(c => st[c].mode === 'AUTO' && st[c].byp < 3) && !ev.lines.some(l => st.block[l]) && !st.drainOpen && !st.slug;
  if (restoredNow && ev.loops.every(bandOK)) {
    if (A.okSince === null) A.okSince = st.t;
    if (st.t - A.okSince >= 45) { A.ended = true; A.tEnd = st.t; logEvent('✔ ' + ev.good + (A.bad ? ' (tras la consecuencia del ramal NO)' : '') + ' — FIN del evento', 'g'); renderEvents(true); }
  } else A.okSince = null;
}
// ── panel de eventos ──
const evList = $('evList'), evPanel = $('evPanel');
for (const ev of EV) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = ev.btn; b.dataset.ev = ev.id; b.addEventListener('click', () => startEvent(ev)); evList.appendChild(b); }
$('evModeSeg').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
  const auto = b.dataset.em === 'auto'; if (EVMODE.auto === auto) return; EVMODE.auto = auto;
  $('evModeSeg').querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.em === b.dataset.em));
  if (SC.a && !SC.a.ended) { SC.a.nextAct = auto ? st.t + 5 : 0; setSpeed(auto ? 20 : (SC.a.ev.gas ? 1 : (SC.a.triggered ? 3 : 10))); }
  logEvent('Modo de eventos: ' + (auto ? 'AUTOMÁTICO — el operador simulado ejecuta el flujograma' : 'PRÁCTICA — el usuario ejecuta las acciones'), 'g'); renderEvents(true);
}));
const hintOf = s => s.k === 'byp' ? '→ ' + st[s.ctrl].tag + ' · Apertura bypass' : s.k === 'man' ? '→ ' + st[s.ctrl].tag + ' · Modo MAN' : s.k === 'block' ? '→ ' + { W: 'LIC-101', O: 'LIC-103', G: 'PIC-100' }[s.line] + ' · Línea principal CERRADA' : s.k === 'drain' ? '→ Simulación · Drenajes de fondo ABIERTOS' : '';
let evSig = '';
function renderEvents(force) {
  const A = SC.a;
  evList.querySelectorAll('button').forEach(b => b.classList.toggle('on', !!A && b.dataset.ev === A.ev.id && !A.ended));
  if (!A) { if (evSig !== '') { evPanel.hidden = true; evPanel.innerHTML = ''; evSig = ''; } return; }
  const ev = A.ev, restoredNow = faultCleared(ev) && ev.loops.every(c => st[c].mode === 'AUTO' && st[c].byp < 3) && !ev.lines.some(l => st.block[l]) && !st.drainOpen && !st.slug;
  const sig = [ev.id, A.alarmSeen, !!A.triggered, !!A.bad, A.ended, EVMODE.auto, restoredNow, faultCleared(ev), A.steps.map(s => (s.done ? 'D' : s.running ? 'R' + Math.floor((s.tEnd - st.t) / 5) : depsOk(A, s) ? 'P' : 'W')).join('')].join('|');
  if (!force && sig === evSig) return; evSig = sig;
  const li = A.steps.map((s, i) => {
    const cls = s.done ? 'done' : s.running ? 'run' : '';
    let right = '';
    if (s.done) right = '<span class="when">' + fmtT(s.tDone) + '</span>';
    else if (s.running) right = '<span class="when">en curso · ' + fmtT(Math.max(0, s.tEnd - st.t)).slice(3) + '</span>';
    else if (EVMODE.auto) right = '<span class="when">operador simulado</span>';
    else if (s.k === 'mnt') right = '<button class="btn mini" data-step="' + i + '"' + (depsOk(A, s) ? '' : ' disabled') + '>Ejecutar · ' + Math.round(s.dur / 60) + ' min</button>';
    else if (s.k === 'note') right = '<button class="btn mini" data-step="' + i + '">Registrar (parada de planta)</button>';
    else right = '<span class="hint">' + hintOf(s) + '</span>';
    return '<li class="' + cls + '"><span class="lbl">' + s.label + (s.note ? ' <small>(' + s.note + ')</small>' : '') + '</span>' + right + '</li>';
  }).join('');
  const restoreLi = '<li class="' + (A.ended ? 'done' : restoredNow ? 'run' : '') + '"><span class="lbl">RESTABLECER: lazo en AUTO · bypass 0 % · línea principal abierta · drenajes cerrados</span>' + (A.ended ? '<span class="when">' + fmtT(A.tEnd) + '</span>' : EVMODE.auto ? '<span class="when">operador simulado</span>' : '<span class="hint">' + (faultCleared(ev) ? 'falla corregida — restablece' : 'primero corrige la falla') + '</span>') + '</li>';
  const state = A.ended ? '<span class="chip ok">FIN · ' + ev.good + '</span>' : A.bad ? '<span class="chip alarm">NO SE MANEJÓ · ' + ev.bad.label + '</span>' : (A.alarmSeen || A.triggered) ? '<span class="chip alarm">' + ev.alarm + '</span>' : '<span class="chip on">falla inyectada · esperando alarma</span>';
  evPanel.innerHTML = '<div class="evtitle">' + ev.title + '</div><div class="evmeta">Efecto: ' + ev.effect + '</div><div class="evstate">' + state + '</div>' +
    '<div class="evq">¿SE MANEJA? · SÍ →</div><ol class="steps">' + li + restoreLi + '</ol>' +
    '<div class="evq">NO → <span class="bad">' + ev.bad.label + '</span></div>' +
    '<div class="btns"><button class="btn" id="evCancel">' + (A.ended ? 'Cerrar' : 'Cancelar evento') + '</button></div>';
  evPanel.hidden = false;
  evPanel.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => { const s = A.steps[+b.dataset.step]; if (!s.done && !s.running) doStep(A, s); }));
  $('evCancel').addEventListener('click', () => cancelEvent(false));
}

// ───────────────────────── Bucle principal ─────────────────────────
let DPR = 1;
function setupCanvas() { DPR = Math.min(2, window.devicePixelRatio || 1); cv.width = 1400 * DPR; cv.height = 580 * DPR; c.setTransform(DPR, 0, 0, DPR, 0, 0); }
function render() {
  if (Math.min(2, window.devicePixelRatio || 1) !== DPR) setupCanvas();   // cambio de monitor / zoom
  c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, 1400, 580);
  drawFluids(); drawInternals(); drawParticles(); drawVessel(); drawPiping();
}
let last = performance.now(), acc = 0, frameN = 0;
function frame(now) {
  const rdt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!paused) {
    acc += rdt * speed; const DT = 0.05; let n = 0;
    while (acc >= DT && n < 400) { step(DT); acc -= DT; n++; }
    if (n >= 400) acc = 0;
    tv += rdt; updVisualState(); updateParticles(rdt);
  }
  render();
  if (frameN++ % 4 === 0) { drawTrend(); updateFPs(); updateHUD(); renderEvents(false); }
  requestAnimationFrame(frame);
}
setupCanvas(); resetState(); updVisualState();
let savedUnits = 'si'; try { savedUnits = localStorage.getItem('sepdoom-units') || 'si'; } catch (e) { }
setUnits(savedUnits === 'imp', true);
logEvent('SEP-DOOM en línea · V-100 (7 ft × 32 ft, 20 000 BFPD, 3 MMSCFD) en régimen estable: P ' + fP(st.pic.sp, UN.imp ? 0 : 2) + ' · interfase ' + fL(st.lic1.sp) + ' · petróleo ' + fL(st.lic2.sp), 'g');
// precarga visual: 6 s de partículas para que la primera imagen ya muestre flujo
for (let i = 0; i < 360; i++) updateParticles(1 / 60);
document.fonts && document.fonts.ready.then(() => render());
requestAnimationFrame(frame);
</script>
