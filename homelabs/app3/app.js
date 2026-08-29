// ============================================================
// app.js - Con parser DQL real y todas las correcciones
// ============================================================

console.log('🚀 app.js cargado (versión corregida + Kill Chain con captura y autocompletado + Contexto SOC real + Click to Pivot + Glosario + Veredicto)');

// Variables globales
let casos = [];
let currentChallenge = null;
let currentCaseData = null;
let currentLogs = [];
let currentCaseLogs = [];
let TURN_STARTED = false;
let solved = new Set();
let expandedId = null;
let questionStates = {};
let selectedFields = ['timestamp', 'agent.name', 'rule.description', 'rule.level'];
let openFields = new Set();
let scratchpadNotes = {}; // { [caso.id]: texto }, se conserva mientras dure la sesión
let highlightTerms = [];
let selectedDifficulty = 'facil';
let sortState = { field: null, dir: 1 };

// ====== Kill Chain ======
let killChainData = null;
let killChainState = {};
let activePanel = null; // 'questions' | 'killchain' | 'context' | null
let capturedLogs = [];  // array de log.id capturados con checkbox, en orden de captura

// ====== Contexto SOC (NUEVO) ======
let activosDB = null;
let usuariosDB = null;
let threatIntelDB = null;
let indiceIpDB = null;
let herramientasDB = null; // NUEVO: catálogo de herramientas internas autorizadas

// ====== Glosarios (NUEVO) ======
let glosarioEventosDB = null;
let glosarioPuertosDB = null;
let glosarioLogonTypeDB = null;

let contextCacheByCase = {}; // { caseId: { valor: resultado } }
let contextHistoryByCase = {}; // { caseId: [ { valor, tipo, resultado } ] }

// Funciones auxiliares para detectar formato (fallback decorativo)
function looksLikeIp(value) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(value);
}
function looksLikeHash(value) {
  return /^[a-fA-F0-9]{32,64}$/.test(value);
}
function looksLikeDomain(value) {
  return /^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/.test(value) && !looksLikeIp(value);
}

// Normaliza dificultad: "Fácil"/"facil"/"FÁCIL" -> "facil"
function normDiff(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// ============================================================
// ESTADO DEL STREAM
// ============================================================
const streamState = {
  active: false,
  paused: false,
  queue: [],
  delivered: [],
  timer: null,
  speed: 4000,
  totalLogs: 0,
  deliveredCount: 0,
  isComplete: false,
};

const STREAM_SPEED = {
  'Fácil': { min: 4000, max: 6000 },
  'facil': { min: 4000, max: 6000 },
  'Medio': { min: 2500, max: 4500 },
  'medio': { min: 2500, max: 4500 },
  'Dificil': { min: 1500, max: 3000 },
  'dificil': { min: 1500, max: 3000 },
};

function getRandomSpeed() {
  const diff = currentChallenge?.difficulty || 'Fácil';
  const config = STREAM_SPEED[diff] || STREAM_SPEED['Fácil'];
  const min = config?.min || 4000;
  const max = config?.max || 6000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============================================================
// CARGA DE BASES DE DATOS DE CONTEXTO Y GLOSARIOS (UNA SOLA VEZ)
// ============================================================
async function loadContextDBs() {
  try {
    const [activosRes, usuariosRes, threatRes, eventosRes, puertosRes, logonTypeRes, herramientasRes] = await Promise.all([
      fetch('data/universo/activos-empresa.json'),
      fetch('data/universo/usuarios-empresa.json'),
      fetch('data/universo/threat-intel.json'),
      fetch('data/universo/glosario-eventos.json'),
      fetch('data/universo/glosario-puertos.json'),
      fetch('data/universo/glosario-logontype.json'),
      fetch('data/universo/herramientas-internas-autorizadas.json') // NUEVO
    ]);
    if (!activosRes.ok || !usuariosRes.ok || !threatRes.ok || !eventosRes.ok || !puertosRes.ok || !logonTypeRes.ok || !herramientasRes.ok) {
      throw new Error('Error al cargar los archivos de contexto o glosario');
    }
    const activos = await activosRes.json();
    const usuarios = await usuariosRes.json();
    const threat = await threatRes.json();
    const eventos = await eventosRes.json();
    const puertos = await puertosRes.json();
    const logonType = await logonTypeRes.json();
    const herramientas = await herramientasRes.json(); // NUEVO

    // Extraer _indice_ip y guardar el resto en activosDB
    const { _indice_ip, ...activosSinIndice } = activos;
    activosDB = activosSinIndice;
    indiceIpDB = _indice_ip || {};
    usuariosDB = usuarios;
    threatIntelDB = threat;
    glosarioEventosDB = eventos;
    glosarioPuertosDB = puertos;
    glosarioLogonTypeDB = logonType;
    herramientasDB = herramientas; // NUEVO

    console.log('✅ Bases de datos de contexto y glosarios cargadas correctamente');
  } catch (e) {
    console.error('❌ Error cargando bases de datos:', e);
    // Fallback: objetos vacíos para que la app no se rompa
    activosDB = {};
    usuariosDB = {};
    threatIntelDB = {};
    indiceIpDB = {};
    glosarioEventosDB = {};
    glosarioPuertosDB = {};
    glosarioLogonTypeDB = {};
    herramientasDB = {}; // NUEVO
  }
}

// ============================================================
// CARGA DEL ÍNDICE
// ============================================================
async function loadIndex() {
  try {
    // Cargar bases de contexto (una sola vez)
    await loadContextDBs();

    const res = await fetch('data/index.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    casos = data.casos;
    casos.forEach(c => {
      const num = parseInt(c.id.replace('caso-', ''));
      c.number = num;
      if (!c.target) c.target = [];
    });
    const first = casos.find(c => normDiff(c.difficulty) === 'facil');
    if (first) {
      await selectCase(first);
    }
    renderChallenges();
  } catch (e) {
    console.error('Error cargando índice:', e);
    document.getElementById('queryError').textContent = '⚠️ Error al cargar index.json';
    document.getElementById('queryError').classList.add('show');
  }
}

// ============================================================
// SELECCIÓN DE CASO
// ============================================================
async function selectCase(caso) {
  try {
    // Detener stream anterior
    stopLogStream();

    // RESETEAR selectedFields al cambiar de caso
    selectedFields = ['timestamp', 'agent.name', 'rule.description', 'rule.level'];
    openFields = new Set();
    capturedLogs = [];

    // NUEVO: reiniciar estado de contexto para este caso
    clearContextState(caso.id);

    const ruta = `data/${caso.difficulty}/${caso.id}.json`;
    const res = await fetch(ruta);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    
    currentChallenge = caso;
    currentCaseData = data;
    currentLogs = [];
    currentCaseLogs = [];
    TURN_STARTED = false;
    expandedId = null;
    
    document.getElementById('queryInput').placeholder = 'Escribe tu query DQL...';
    
    renderTable([]);
    renderFilters([]);
    renderSelectedFieldsList();
    showStartShiftOverlay();
    
    renderChallenges();
    renderQuestions();
    
    // Resetear stream
    streamState.queue = [];
    streamState.delivered = [];
    streamState.deliveredCount = 0;
    streamState.totalLogs = 0;
    streamState.isComplete = false;
    streamState.active = false;
    streamState.paused = false;
    if (streamState.timer) {
      clearTimeout(streamState.timer);
      streamState.timer = null;
    }
    showStreamControls(false);
    updateStreamUI();
    
    // ====== Cargar Kill Chain (solo para casos Fácil) ======
    const isFacil = normDiff(caso.difficulty) === 'facil';
    if (isFacil) {
      try {
        const postRoute = `data/${caso.difficulty}/postMorte-${caso.id}.json`;
        const postRes = await fetch(postRoute);
        if (postRes.ok) {
          killChainData = await postRes.json();
        } else {
          killChainData = null;
        }
      } catch (e) {
        killChainData = null;
      }
    } else {
      killChainData = null;
    }

    if (!killChainState[caso.id]) {
      const fases = killChainData?.fases || [];
      killChainState[caso.id] = fases.map(() => ({ verified: false, correct: false, userValue: '' }));
    }
    // Autocompletar fases sin log (solo si hay datos)
    if (killChainData && killChainData.fases) {
      checkNullPhases(caso.id);
    }
    // Actualizar el estado del botón Kill Chain
    updateKillChainButtonState();
    // Si no es fácil y el panel de Kill Chain estaba abierto, cerrarlo
    if (!isFacil && activePanel === 'killchain') {
      togglePanel('killchain');
    }
    renderScenario();

    // Cerrar paneles (excepto el de Kill Chain que ya se cerró si correspondía)
    document.getElementById('questionsPanelWrapper').style.display = 'none';
    document.getElementById('killChainPanelWrapper').style.display = 'none';
    document.getElementById('contextPanelWrapper').style.display = 'none';
    document.getElementById('appShell').classList.remove('with-questions', 'with-killchain', 'with-context');
    activePanel = null;
    document.querySelectorAll('.panel-toggle-btn').forEach(b => b.classList.remove('active'));

    // Cargar el bloc de notas del caso (independiente por caso)
    loadScratchpadForCase(caso.id);

    showFeedback(`📋 Caso cargado. Presiona "Iniciar turno" para comenzar.`, 'help');
    
  } catch (e) {
    console.error('Error cargando caso:', e);
    showFeedback(`⚠️ Error: ${e.message}`, 'wrong');
  }
}

// ============================================================
// PANELES EXCLUYENTES (GENERALIZADO para 3 paneles)
// ============================================================
function togglePanel(panelId) {
  const shell = document.getElementById('appShell');
  const wrappers = {
    questions: document.getElementById('questionsPanelWrapper'),
    killchain: document.getElementById('killChainPanelWrapper'),
    context: document.getElementById('contextPanelWrapper')
  };
  const classes = {
    questions: 'with-questions',
    killchain: 'with-killchain',
    context: 'with-context'
  };

  // Si el panel ya está activo, lo cerramos
  if (activePanel === panelId) {
    Object.values(wrappers).forEach(w => w.style.display = 'none');
    shell.classList.remove(classes.questions, classes.killchain, classes.context);
    activePanel = null;
    document.querySelectorAll('.panel-toggle-btn').forEach(b => b.classList.remove('active'));
    return;
  }

  // Cerrar todos los paneles
  Object.values(wrappers).forEach(w => w.style.display = 'none');
  shell.classList.remove(classes.questions, classes.killchain, classes.context);

  // Abrir el seleccionado
  wrappers[panelId].style.display = 'block';
  shell.classList.add(classes[panelId]);

  // Si se abre el panel de preguntas, refrescar
  if (panelId === 'questions') renderQuestions();
  if (panelId === 'killchain') renderKillChain();

  activePanel = panelId;
  document.querySelectorAll('.panel-toggle-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.panel === panelId);
  });
}

// ============================================================
// ACTUALIZAR ESTADO DEL BOTÓN KILL CHAIN
// ============================================================
function updateKillChainButtonState() {
  const killBtn = document.getElementById('killChainToggleBtn');
  const badge = document.getElementById('killChainBadge');
  if (!currentChallenge) {
    killBtn.style.display = 'none';
    return;
  }
  const isFacil = normDiff(currentChallenge.difficulty) === 'facil';
  const hasData = killChainData && killChainData.fases && killChainData.fases.length > 0;

  if (isFacil && hasData) {
    killBtn.style.display = '';
    killBtn.disabled = false;
    killBtn.style.opacity = '1';
    killBtn.style.cursor = 'pointer';
    killBtn.title = 'Ver cadena de hechos (Kill Chain)';
    badge.style.display = '';
    // Actualizar progreso
    updateKillChainProgress();
  } else if (isFacil && !hasData) {
    killBtn.style.display = 'none';
    badge.style.display = 'none';
  } else {
    // Medio o difícil
    killBtn.style.display = '';
    killBtn.disabled = true;
    killBtn.style.opacity = '0.5';
    killBtn.style.cursor = 'not-allowed';
    killBtn.title = 'No disponible en este nivel — el cierre del caso se resuelve con el panel de Contexto SOC';
    badge.style.display = 'none';
    // Si el panel estaba abierto, cerrarlo (se maneja en selectCase, pero por si acaso)
    if (activePanel === 'killchain') {
      togglePanel('killchain');
    }
  }
}

// ============================================================
// INICIAR TURNO (stream)
// ============================================================
function startShift() {
  if (!currentChallenge || !currentCaseData) {
    showFeedback('💡 Selecciona un caso primero.', 'help');
    return;
  }
  if (streamState.active && !streamState.paused) {
    showFeedback('⏳ El stream ya está en ejecución.', 'help');
    return;
  }
  if (streamState.paused) {
    resumeLogStream();
    return;
  }
  if (streamState.isComplete) {
    showFeedback('✅ El stream ya se completó. Selecciona otro caso.', 'help');
    return;
  }
  
  const allLogs = currentCaseData.logs || [];
  const targetIds = currentChallenge.target.map(id => String(id));
  const chainLogs = allLogs.filter(log => targetIds.includes(String(log.id)));

  // Contraer el panel superior para dejar más espacio a la tabla
  document.getElementById('topbar').classList.add('collapsed');
  const noiseLogs = allLogs.filter(log => !targetIds.includes(String(log.id)));
  
  chainLogs.sort((a, b) => a.id - b.id);
  const shuffledNoise = shuffleArray(noiseLogs);
  
  const totalChain = chainLogs.length;
  const totalNoise = shuffledNoise.length;
  const totalLogs = totalChain + totalNoise;
  const queue = [];
  
  if (totalLogs === 0) {
    showFeedback('⚠️ No hay logs para este caso.', 'wrong');
    return;
  }
  
  if (totalNoise === 0) {
    queue.push(...chainLogs);
  } else if (totalChain === 0) {
    queue.push(...shuffledNoise);
  } else {
    const chainPositions = [];
    for (let i = 0; i < totalChain; i++) {
      let pos;
      let attempts = 0;
      do {
        pos = Math.floor(Math.random() * totalLogs);
        attempts++;
      } while (chainPositions.includes(pos) && attempts < 100);
      chainPositions.push(pos);
    }
    chainPositions.sort((a, b) => a - b);
    let ci = 0, ni = 0;
    for (let i = 0; i < totalLogs; i++) {
      if (ci < chainPositions.length && i === chainPositions[ci]) {
        queue.push(chainLogs[ci]);
        ci++;
      } else {
        queue.push(shuffledNoise[ni] || null);
        ni++;
      }
    }
  }
  
  const finalQueue = queue.filter(log => log !== null);
  
  streamState.queue = finalQueue;
  streamState.totalLogs = finalQueue.length;
  streamState.deliveredCount = 0;
  streamState.delivered = [];
  streamState.active = true;
  streamState.paused = false;
  streamState.isComplete = false;
  
  currentCaseLogs = [];
  currentLogs = [];
  TURN_STARTED = true;
  
  hideStartShiftOverlay();
  showStreamControls(true);
  updateStreamUI();
  showFeedback(`🟢 Stream iniciado — ${finalQueue.length} logs en cola.`, 'correct');
  
  const shell = document.getElementById('appShell');
  shell.classList.add('collapsed');
  const toggleBtn = document.getElementById('sidebarToggle');
  toggleBtn.textContent = '▶';
  
  deliverNextLog();
}

// ============================================================
// ENTREGA DE LOGS
// ============================================================
function deliverNextLog() {
  if (!streamState.active || streamState.paused) return;
  if (streamState.queue.length === 0) {
    stopLogStream();
    return;
  }
  
  const nextLog = streamState.queue.shift();
  streamState.delivered.push(nextLog);
  streamState.deliveredCount++;
  currentCaseLogs.push(nextLog);
  
  runQuery();
  renderSelectedFieldsList();
  updateStreamUI();
  
  if (currentChallenge) {
    checkCaseSolved();
  }
  
  const speed = getRandomSpeed();
  streamState.timer = setTimeout(() => {
    deliverNextLog();
  }, speed);
}

function pauseLogStream() {
  if (!streamState.active || streamState.paused) return;
  streamState.paused = true;
  if (streamState.timer) {
    clearTimeout(streamState.timer);
    streamState.timer = null;
  }
  const pauseBtn = document.querySelector('.stream-btn.pause');
  const resumeBtn = document.querySelector('.stream-btn.resume');
  if (pauseBtn) pauseBtn.style.display = 'none';
  if (resumeBtn) resumeBtn.style.display = 'inline-block';
  updateStreamUI();
  showFeedback('⏸️ Stream pausado. Presiona "Reanudar" para continuar.', 'help');
}

function resumeLogStream() {
  if (!streamState.active || !streamState.paused) return;
  streamState.paused = false;
  const pauseBtn = document.querySelector('.stream-btn.pause');
  const resumeBtn = document.querySelector('.stream-btn.resume');
  if (pauseBtn) pauseBtn.style.display = 'inline-block';
  if (resumeBtn) resumeBtn.style.display = 'none';
  updateStreamUI();
  showFeedback('▶️ Stream reanudado.', 'help');
  deliverNextLog();
}

function stopLogStream() {
  streamState.active = false;
  streamState.paused = false;
  if (streamState.timer) {
    clearTimeout(streamState.timer);
    streamState.timer = null;
  }
  streamState.isComplete = true;
  showStreamControls(false);
  updateStreamUI();
  showFeedback(`✅ Stream completado — ${streamState.deliveredCount} logs entregados.`, 'correct');
}

function updateStreamUI() {
  const delivered = streamState.deliveredCount;
  const total = streamState.totalLogs;
  const pending = total - delivered;
  const statEl = document.getElementById('streamStats');
  if (statEl) {
    if (streamState.isComplete) {
      statEl.textContent = `✅ ${delivered}/${total} logs entregados`;
    } else if (streamState.active && !streamState.paused) {
      statEl.textContent = `🟢 ${delivered}/${total} | ${pending} pendientes`;
    } else if (streamState.paused) {
      statEl.textContent = `⏸️ ${delivered}/${total} | ${pending} pendientes (PAUSADO)`;
    } else {
      statEl.textContent = `📋 ${total} logs en cola`;
    }
  }
}

function showStreamControls(show) {
  const controls = document.getElementById('streamControls');
  if (controls) {
    controls.style.display = show ? 'flex' : 'none';
  }
  if (show) {
    const pauseBtn = document.querySelector('.stream-btn.pause');
    const resumeBtn = document.querySelector('.stream-btn.resume');
    if (pauseBtn) pauseBtn.style.display = 'inline-block';
    if (resumeBtn) resumeBtn.style.display = 'none';
  }
}

// ============================================================
// UTILIDADES
// ============================================================
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getNested(obj, path) {
  return path.split('.').reduce((o, p) => o?.[p], obj);
}

function flattenObject(obj, prefix = '') {
  const result = {};
  if (!obj || typeof obj !== 'object') return result;
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === 'object' && !Array.isArray(val) && val !== null) {
      Object.assign(result, flattenObject(val, newKey));
    } else {
      result[newKey] = val;
    }
  });
  return result;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] || m));
}

// ============================================================
// ORDEN DE CAMPOS PARA DETALLE EXPANDIDO (NUEVO)
// ============================================================
function compareLogKeys(a, b) {
  // Asignar prioridad según grupos definidos
  const getPriority = (key) => {
    if (key === 'timestamp') return 0;
    if (key.startsWith('rule.')) return 1;
    if (key.startsWith('agent.')) return 2;
    if (key.startsWith('data.')) return 3;
    if (key === 'full_log') return 5;
    return 4; // otros
  };
  const pa = getPriority(a);
  const pb = getPriority(b);
  if (pa !== pb) return pa - pb;
  return a.localeCompare(b);
}

// ============================================================
// PARSER DQL REAL
// ============================================================
function normalizeOperatorsOutsideQuotes(text) {
  let result = '';
  let inQuotes = false;
  let quoteChar = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      if (!inQuotes) { inQuotes = true; quoteChar = ch; }
      else if (ch === quoteChar) inQuotes = false;
      result += ch;
      i++;
      continue;
    }
    if (inQuotes) { result += ch; i++; continue; }
    const atWordStart = (i === 0 || /[\s(]/.test(text[i - 1]));
    const m = atWordStart ? text.slice(i).match(/^(AND|OR|NOT)\b/i) : null;
    if (m) {
      result += m[1].toUpperCase();
      i += m[1].length;
      continue;
    }
    result += ch;
    i++;
  }
  return result;
}

function extractHighlightTerms(query) {
  const terms = [];
  if (!query) return terms;
  const tokens = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  for (let i = 0; i < query.length; i++) {
    const ch = query[i];
    if (ch === '"' || ch === "'") {
      if (!inQuotes) { inQuotes = true; quoteChar = ch; current += ch; }
      else if (ch === quoteChar) { inQuotes = false; current += ch; }
      else current += ch;
      continue;
    }
    if (!inQuotes && (ch === ' ' || ch === '(' || ch === ')')) {
      if (current) tokens.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);

  // Un término que viene inmediatamente después de NOT está excluido de los
  // resultados, así que no debe resaltarse como si fuera una coincidencia.
  let negateNext = false;
  tokens.forEach(tok => {
    const upper = tok.toUpperCase();
    if (upper === 'AND' || upper === 'OR') return;
    if (upper === 'NOT') { negateNext = true; return; }
    if (negateNext) { negateNext = false; return; }
    const m = tok.match(/^([a-zA-Z_.]+):(.+)$/);
    if (m) {
      const field = m[1];
      let val = m[2];
      if (/^[<>]=?/.test(val)) return;
      val = val.replace(/^["']|["']$/g, '');
      val = val.replace(/\*/g, '');
      if (!val) return;
      terms.push({ field, value: val });
    } else {
      const val = tok.replace(/^["']|["']$/g, '');
      if (val) terms.push({ field: null, value: val });
    }
  });
  return terms;
}

function highlightText(text, field) {
  const str = String(text);
  const applicable = highlightTerms.filter(t => (t.field === null || t.field === field) && t.value);
  if (applicable.length === 0) return escapeHtml(str);
  const values = [...new Set(applicable.map(t => t.value))]
    .sort((a, b) => b.length - a.length)
    .map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (values.length === 0) return escapeHtml(str);
  const regex = new RegExp('(' + values.join('|') + ')', 'gi');
  let result = '';
  let lastIndex = 0;
  let m;
  while ((m = regex.exec(str)) !== null) {
    result += escapeHtml(str.slice(lastIndex, m.index));
    result += `<mark class="log-highlight">${escapeHtml(m[0])}</mark>`;
    lastIndex = m.index + m[0].length;
    if (m[0].length === 0) regex.lastIndex++;
  }
  result += escapeHtml(str.slice(lastIndex));
  return result;
}

function parseDQL(query, logs) {
  if (!query || !query.trim()) {
    highlightTerms = [];
    return logs.slice();
  }
  
  const errorEl = document.getElementById('queryError');
  errorEl.classList.remove('show');
  
  try {
    const cleanQuery = normalizeOperatorsOutsideQuotes(query.trim());
    const filtered = logs.filter(log => evaluateDQL(cleanQuery, log));
    highlightTerms = extractHighlightTerms(cleanQuery);
    return filtered;
  } catch (e) {
    errorEl.textContent = `⚠️ Error de sintaxis DQL: ${e.message}`;
    errorEl.classList.add('show');
    highlightTerms = [];
    return logs.slice();
  }
}

function evaluateDQL(query, log) {
  let q = query;
  
  let openParen = findParenOutsideQuotes(q, '(');
  while (openParen !== -1) {
    let depth = 1;
    let closeParen = openParen + 1;
    while (closeParen < q.length && depth > 0) {
      if (q[closeParen] === '"' || q[closeParen] === "'") {
        const quoteChar = q[closeParen];
        closeParen++;
        while (closeParen < q.length && q[closeParen] !== quoteChar) {
          closeParen++;
        }
        closeParen++;
        continue;
      }
      if (q[closeParen] === '(') depth++;
      else if (q[closeParen] === ')') depth--;
      closeParen++;
    }
    if (depth > 0) throw new Error('Paréntesis sin cerrar');
    closeParen--;
    
    const inner = q.substring(openParen + 1, closeParen);
    const result = evaluateDQL(inner, log);
    const before = q.substring(0, openParen);
    const after = q.substring(closeParen + 1);
    q = before + (result ? 'true' : 'false') + after;
    openParen = findParenOutsideQuotes(q, '(');
  }
  
  q = q.replace(/\btrue\b/g, 'TRUE').replace(/\bfalse\b/g, 'FALSE');
  
  const orParts = splitOutsideQuotes(q, ' OR ');
  if (orParts.length > 1) {
    return orParts.some(part => evaluateDQL(part, log));
  }
  
  const andParts = splitOutsideQuotes(q, ' AND ');
  if (andParts.length > 1) {
    return andParts.every(part => evaluateDQL(part, log));
  }
  
  return evaluateWazuhCondition(q, log);
}

function findParenOutsideQuotes(text, char) {
  let inQuotes = false;
  let quoteChar = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      if (!inQuotes) { inQuotes = true; quoteChar = ch; }
      else if (ch === quoteChar) inQuotes = false;
      continue;
    }
    if (!inQuotes && ch === char) {
      return i;
    }
  }
  return -1;
}

function splitOutsideQuotes(text, separator) {
  const parts = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  let parenDepth = 0;
  
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    
    if (ch === '"' || ch === "'") {
      if (!inQuotes) { inQuotes = true; quoteChar = ch; }
      else if (ch === quoteChar) inQuotes = false;
      current += ch;
      continue;
    }
    
    if (inQuotes) {
      current += ch;
      continue;
    }
    
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth--;
    
    if (parenDepth === 0 && text.substring(i, i + separator.length) === separator) {
      parts.push(current.trim());
      current = '';
      i += separator.length - 1;
      continue;
    }
    
    current += ch;
  }
  
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function evaluateWazuhCondition(condition, log) {
  let c = condition.trim();
  
  if (c === 'true' || c === 'TRUE') return true;
  if (c === 'false' || c === 'FALSE') return false;
  
  if (c.startsWith('NOT ')) {
    const sub = c.substring(4).trim();
    if (!sub) throw new Error('NOT requiere una condición');
    return !evaluateWazuhCondition(sub, log);
  }
  
  let m = c.match(/^([a-zA-Z_.]+)\s*:>=\s*(\d+)$/);
  if (m) {
    const val = getNested(log, m[1]);
    if (val === undefined) return false;
    if (isNaN(Number(val))) return false;
    return Number(val) >= Number(m[2]);
  }
  m = c.match(/^([a-zA-Z_.]+)\s*:<=\s*(\d+)$/);
  if (m) {
    const val = getNested(log, m[1]);
    if (val === undefined) return false;
    if (isNaN(Number(val))) return false;
    return Number(val) <= Number(m[2]);
  }
  m = c.match(/^([a-zA-Z_.]+)\s*:>\s*(\d+)$/);
  if (m) {
    const val = getNested(log, m[1]);
    if (val === undefined) return false;
    if (isNaN(Number(val))) return false;
    return Number(val) > Number(m[2]);
  }
  m = c.match(/^([a-zA-Z_.]+)\s*:<\s*(\d+)$/);
  if (m) {
    const val = getNested(log, m[1]);
    if (val === undefined) return false;
    if (isNaN(Number(val))) return false;
    return Number(val) < Number(m[2]);
  }
  
  m = c.match(/^([a-zA-Z_.]+)\s*:\s*"([^"]+)"$/);
  if (!m) m = c.match(/^([a-zA-Z_.]+)\s*:\s*'([^']+)'$/);
  if (m) {
    const val = getNested(log, m[1]);
    if (val === undefined) return false;
    const searchValue = m[2];
    return String(val).toLowerCase().includes(searchValue.toLowerCase());
  }
  
  m = c.match(/^([a-zA-Z_.]+)\s*:\s*\*([^*]+)\*$/);
  if (m) {
    const val = getNested(log, m[1]);
    if (val === undefined) return false;
    const searchValue = m[2];
    return String(val).toLowerCase().includes(searchValue.toLowerCase());
  }
  
  m = c.match(/^([a-zA-Z_.]+)\s*:\s*\*$/);
  if (m) {
    const val = getNested(log, m[1]);
    if (val === undefined) return false;
    return true;
  }
  
  m = c.match(/^([a-zA-Z_.]+)\s*:\s*([^\s]+)$/);
  if (m) {
    const val = getNested(log, m[1]);
    if (val === undefined) return false;
    if (!isNaN(m[2]) && !isNaN(val)) return Number(val) === Number(m[2]);
    return String(val).toLowerCase().includes(m[2].toLowerCase());
  }
  
  if (c.includes(':')) {
    throw new Error(`Sintaxis inválida: "${c}" — formato esperado: campo:"valor" o campo:valor`);
  }

  const freeVal = c.replace(/^["']|["']$/g, '').trim();
  if (!freeVal) {
    throw new Error(`Sintaxis inválida: "${c}" — Debes especificar un campo (ej: agent.name:"FIN-DESK-22")`);
  }
  const flat = flattenObject(log);
  return Object.values(flat).some(v =>
    v !== undefined && v !== null && String(v).toLowerCase().includes(freeVal.toLowerCase())
  );
}

// ============================================================
// CAMPOS (Acordeón y selección)
// ============================================================
function getAggregations(logs) {
  const agg = {};
  logs.forEach(log => {
    const flat = flattenObject(log);
    Object.keys(flat).forEach(k => {
      if (!agg[k]) agg[k] = {};
      const val = flat[k];
      if (val !== undefined && val !== null && val !== '') {
        const key = String(val);
        agg[k][key] = (agg[k][key] || 0) + 1;
      }
    });
  });
  return agg;
}

function getFullAggregations(logs) {
  const agg = getAggregations(logs);
  if (!agg['timestamp']) {
    agg['timestamp'] = {};
    logs.forEach(log => {
      if (log.timestamp) {
        const key = String(log.timestamp);
        agg['timestamp'][key] = (agg['timestamp'][key] || 0) + 1;
      }
    });
  }
  return agg;
}

function insertFieldQuery(field, key, operator) {
  const input = document.getElementById('queryInput');
  const current = input.value.trim();
  const isNumeric = /^\d+$/.test(key);
  const newPart = isNumeric ? `${field}:${key}` : `${field}:"${key}"`;
  input.value = current ? `${current} ${operator} ${newPart}` : newPart;
  runQuery();
}

function hideSyntaxPopover() {
  const p = document.querySelector('.syntax-popover');
  if (p) p.remove();
  document.removeEventListener('click', syntaxOutsideClickHandler);
}

function syntaxOutsideClickHandler(e) {
  const p = document.querySelector('.syntax-popover');
  if (p && !p.contains(e.target)) hideSyntaxPopover();
}

function showSyntaxPopover(targetEl, field, key) {
  hideSyntaxPopover();
  const popover = document.createElement('div');
  popover.className = 'syntax-popover';
  popover.innerHTML = `
    <div class="syntax-popover-title">Agregar con:</div>
    <div class="syntax-popover-actions">
      <button data-op="AND">AND</button>
      <button data-op="OR">OR</button>
      <button data-op="AND NOT">AND NOT</button>
    </div>
  `;
  const rect = targetEl.getBoundingClientRect();
  popover.style.left = rect.left + 'px';
  popover.style.top = (rect.bottom + 4) + 'px';
  document.body.appendChild(popover);
  popover.querySelectorAll('button[data-op]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      insertFieldQuery(field, key, btn.dataset.op);
      hideSyntaxPopover();
    });
  });
  setTimeout(() => document.addEventListener('click', syntaxOutsideClickHandler), 0);
}

function toggleField(field, add) {
  if (add) {
    if (!selectedFields.includes(field)) {
      selectedFields.push(field);
    }
  } else {
    selectedFields = selectedFields.filter(f => f !== field);
  }
  renderFilters(currentLogs);
  renderSelectedFieldsList();
  renderTable(currentLogs);
}

function createFieldBlock(field, vals, isSelected) {
  const keys = Object.keys(vals).sort((a, b) => vals[b] - vals[a]);
  const block = document.createElement('div');
  block.className = 'field-block' + (isSelected ? ' selected' : '');
  block.dataset.field = field;
  const head = document.createElement('button');
  head.className = 'field-head';
  const fchev = document.createElement('span');
  fchev.className = 'fchev';
  fchev.textContent = '▸';
  const nameSpan = document.createElement('span');
  nameSpan.style.cssText = 'flex:1; text-align:left;';
  nameSpan.textContent = field;
  const toggleBtn = document.createElement('span');
  toggleBtn.className = 'field-toggle';
  toggleBtn.textContent = isSelected ? '−' : '+';
  toggleBtn.title = isSelected ? 'Quitar de seleccionados' : 'Agregar a la tabla';
  head.appendChild(fchev);
  head.appendChild(nameSpan);
  head.appendChild(toggleBtn);
  head.onclick = (e) => {
    if (e.target === toggleBtn) return;
    block.classList.toggle('open');
    if (block.classList.contains('open')) openFields.add(field);
    else openFields.delete(field);
  };
  if (openFields.has(field)) block.classList.add('open');
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleField(field, !isSelected);
  });
  block.appendChild(head);
  const valuesBox = document.createElement('div');
  valuesBox.className = 'field-values';
  keys.forEach(key => {
    const el = document.createElement('div');
    el.className = 'field-val';
    const displayKey = key.length > 50 ? key.slice(0, 47) + '...' : key;
    const span = document.createElement('span');
    span.textContent = displayKey;
    span.title = key;
    const countSpan = document.createElement('span');
    countSpan.className = 'count';
    countSpan.textContent = vals[key];
    const syntaxBtn = document.createElement('button');
    syntaxBtn.type = 'button';
    syntaxBtn.className = 'syntax-btn';
    syntaxBtn.textContent = '⋯';
    syntaxBtn.title = 'Elegir cómo agregar (AND / OR / AND NOT)';
    syntaxBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showSyntaxPopover(syntaxBtn, field, key);
    });
    el.appendChild(span);
    el.appendChild(syntaxBtn);
    el.appendChild(countSpan);
    el.addEventListener('click', (e) => {
      if (e.target === syntaxBtn) return;
      insertFieldQuery(field, key, 'AND');
    });
    valuesBox.appendChild(el);
  });
  block.appendChild(valuesBox);
  // Texto buscable (nombre del campo + sus valores) para el buscador del panel
  block.dataset.searchText = (field + ' ' + keys.join(' ')).toLowerCase();
  return block;
}

function renderSelectedFieldsList() {
  const selectedList = document.getElementById('selectedFieldsList');
  if (!TURN_STARTED || currentLogs.length === 0) {
    selectedList.innerHTML = `<div style="color:var(--muted-2);font-size:9.5px;padding:3px 4px;font-family:monospace;">Selecciona un caso y presiona "Iniciar turno"</div>`;
    return;
  }
  const agg = getFullAggregations(currentLogs);
  selectedList.innerHTML = '';
  selectedFields.forEach(field => {
    const vals = agg[field];
    if (!vals && field !== 'timestamp') return;
    const block = createFieldBlock(field, vals || {}, true);
    selectedList.appendChild(block);
  });
  if (selectedFields.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--muted-2);font-size:9.5px;padding:3px 4px;font-family:monospace;';
    empty.textContent = 'Ningún campo seleccionado';
    selectedList.appendChild(empty);
  }
  applyFieldSearchFilter();
}

function renderFilters(logs) {
  const container = document.getElementById('fieldsContainer');
  container.innerHTML = '';
  if (!TURN_STARTED || logs.length === 0) {
    container.innerHTML = `<div style="color:var(--muted-2);font-size:9.5px;padding:3px 4px;font-family:monospace;">Selecciona un caso y presiona "Iniciar turno"</div>`;
    return;
  }
  const agg = getFullAggregations(logs);
  const priorityFields = ['timestamp', 'agent.name', 'data.win.system.eventID', 'data.win.eventdata.image', 'rule.level', 'rule.description'];
  const sortedFields = Object.keys(agg).sort((a, b) => {
    const aPriority = priorityFields.includes(a) ? 0 : 1;
    const bPriority = priorityFields.includes(b) ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.localeCompare(b);
  });
  sortedFields.forEach(field => {
    const vals = agg[field] || {};
    if (Object.keys(vals).length === 0) return;
    if (selectedFields.includes(field)) return;
    const block = createFieldBlock(field, vals, false);
    container.appendChild(block);
  });
  if (container.children.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--muted-2);font-size:9.5px;padding:8px 6px;font-family:monospace;text-align:center;';
    empty.textContent = 'Todos los campos están seleccionados';
    container.appendChild(empty);
  }
  applyFieldSearchFilter();
}

// ============================================================
// BUSCADOR DEL PANEL DE CAMPOS (solo filtra esta columna, no los logs)
// ============================================================
function applyFieldSearchFilter() {
  const input = document.getElementById('fieldSearchInput');
  const clearBtn = document.getElementById('fieldSearchClear');
  if (!input) return;
  const term = input.value.trim().toLowerCase();
  if (clearBtn) clearBtn.style.display = term ? 'inline-block' : 'none';
  document.querySelectorAll('#panelContent .field-block').forEach(block => {
    const matches = !term || (block.dataset.searchText || '').includes(term);
    block.classList.toggle('search-hidden', !matches);
  });
}

// ============================================================
// ORDENAMIENTO DE COLUMNAS
// ============================================================
function sortBy(field) {
  if (sortState.field === field) {
    if (sortState.dir === 1) sortState.dir = -1;
    else { sortState.field = null; sortState.dir = 1; }
  } else {
    sortState.field = field;
    sortState.dir = 1;
  }
  renderTable(currentLogs);
}

function compareValues(a, b) {
  if (a === undefined || a === null) return 1;
  if (b === undefined || b === null) return -1;
  if (typeof a === 'object') a = JSON.stringify(a);
  if (typeof b === 'object') b = JSON.stringify(b);
  const na = Number(a), nb = Number(b);
  if (!isNaN(na) && !isNaN(nb) && String(a).trim() !== '' && String(b).trim() !== '') return na - nb;
  return String(a).localeCompare(String(b));
}

function applySort(logs) {
  if (!sortState.field) return logs;
  const field = sortState.field;
  return logs.slice().sort((x, y) => sortState.dir * compareValues(getNested(x, field), getNested(y, field)));
}

// ============================================================
// FUNCIONES DE GLOSARIO (NUEVO)
// ============================================================
function getGlossaryEntry(value, type) {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  if (type === 'event') {
    const numeric = str.replace(/^\D+/, '');
    if (!numeric) return null;
    return glosarioEventosDB && glosarioEventosDB[numeric] ? { ...glosarioEventosDB[numeric], key: numeric } : null;
  } else if (type === 'port') {
    const numeric = str.replace(/^\D+/, '');
    if (!numeric) return null;
    return glosarioPuertosDB && glosarioPuertosDB[numeric] ? { ...glosarioPuertosDB[numeric], key: numeric } : null;
  } else if (type === 'logontype') {
    const numeric = str.replace(/^\D+/, '');
    if (!numeric) return null;
    return glosarioLogonTypeDB && glosarioLogonTypeDB[numeric] ? { ...glosarioLogonTypeDB[numeric], key: numeric } : null;
  }
  return null;
}

function showGlossaryPopup(entry, type, targetElement) {
  // Cerrar popup existente
  hideGlossaryPopup();

  if (!entry) return;
  const popup = document.createElement('div');
  popup.className = 'glossary-popup';
  let title, body;
  if (type === 'event') {
    title = `${entry.sistema} — ${entry.nombre} (${entry.key})`;
    body = entry.descripcion;
  } else if (type === 'port') {
    title = `Puerto ${entry.key} — ${entry.servicio}`;
    body = entry.descripcion;
  } else if (type === 'logontype') {
    title = `LogonType ${entry.key} — ${entry.nombre}`;
    body = entry.descripcion;
  } else {
    return;
  }
  popup.innerHTML = `
    <div class="glossary-popup-title">${escapeHtml(title)}</div>
    <div class="glossary-popup-body">${escapeHtml(body)}</div>
  `;
  document.body.appendChild(popup);

  // Posicionar cerca del target
  const rect = targetElement.getBoundingClientRect();
  const popupRect = popup.getBoundingClientRect();
  let left = rect.left + window.scrollX;
  let top = rect.bottom + window.scrollY + 4;

  // Ajustar para que no se salga de la pantalla
  if (left + popupRect.width > window.innerWidth - 8) {
    left = window.innerWidth - popupRect.width - 8;
  }
  if (top + popupRect.height > window.innerHeight + window.scrollY - 8) {
    top = rect.top + window.scrollY - popupRect.height - 4;
  }
  if (top < window.scrollY + 8) {
    top = window.scrollY + 8;
  }
  popup.style.left = left + 'px';
  popup.style.top = top + 'px';

  // Click fuera cierra
  setTimeout(() => {
    document.addEventListener('click', outsidePopupHandler);
  }, 0);
  window._glossaryPopup = popup;
}

function hideGlossaryPopup() {
  if (window._glossaryPopup) {
    window._glossaryPopup.remove();
    window._glossaryPopup = null;
    document.removeEventListener('click', outsidePopupHandler);
  }
}

function outsidePopupHandler(e) {
  const popup = window._glossaryPopup;
  if (popup && !popup.contains(e.target)) {
    hideGlossaryPopup();
  }
}

// ============================================================
// RENDER TABLA (con columna de captura) - MODIFICADO PARA GLOSARIO
// ============================================================
function renderTable(logs) {
  const thead = document.getElementById('tableHead');
  const tbody = document.getElementById('tableBody');
  
  if (!TURN_STARTED) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Presiona "Iniciar turno" para ver los logs</td></tr>';
    document.getElementById('statTotal').textContent = '0';
    document.getElementById('statMatch').textContent = '0';
    document.getElementById('statNoise').textContent = '0';
    return;
  }
  
  const columns = selectedFields.slice();
  
  let headerHtml = '<tr><th style="width:22px;"></th><th style="width:26px;"></th>';
  columns.forEach(col => {
    const display = col === 'timestamp' ? 'Time' : col;
    const arrow = sortState.field === col ? (sortState.dir === 1 ? ' ▲' : ' ▼') : '';
    headerHtml += `<th class="sortable" data-field="${escapeHtml(col)}" title="Click para ordenar">${escapeHtml(display)}${arrow}</th>`;
  });
  headerHtml += '</tr>';
  thead.innerHTML = headerHtml;
  thead.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => sortBy(th.dataset.field));
  });
  
  const sortedLogs = applySort(logs);
  tbody.innerHTML = '';
  if (sortedLogs.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td class="no-results" colspan="${columns.length + 2}">🔍 No se encontraron resultados para esta búsqueda</td></tr>`;
  }
  sortedLogs.forEach(log => {
    const tr = document.createElement('tr');
    tr.className = 'log-row' + (expandedId === log.id ? ' expanded' : '');
    const isCaptured = capturedLogs.includes(log.id);
    let rowHtml = `<td><span class="chev">▸</span></td>`;
    rowHtml += `<td class="capture-cell"><input type="checkbox" class="capture-checkbox" data-logid="${log.id}" ${isCaptured ? 'checked' : ''}></td>`;
    columns.forEach(col => {
      let val = getNested(log, col);
      if (val === undefined || val === null) val = '-';
      if (typeof val === 'object') val = JSON.stringify(val);
      if (col === 'timestamp') {
        val = String(val).replace('T', ' ').slice(0, 19);
      }
      const fullVal = String(val);
      const displayVal = fullVal.slice(0, 60);
      
      // ====== Determinar si la celda es pivoteable ======
      let tdClass = '';
      let isPivot = false;
      if (fullVal !== '-' && fullVal !== '' && fullVal !== 'null' && fullVal !== 'undefined') {
        const lowerCol = col.toLowerCase();
        if (lowerCol === 'agent.name' || lowerCol.includes('ip') || lowerCol.includes('user') || lowerCol.includes('hash') || lowerCol.includes('image')) {
          isPivot = true;
          tdClass = 'class="pivotable"';
        }
      }
      
      // ====== Determinar si muestra ícono de glosario ======
      let glossaryIconHtml = '';
      if (fullVal !== '-' && fullVal !== '' && fullVal !== 'null' && fullVal !== 'undefined') {
        const lowerCol = col.toLowerCase();
        // rule.id o EventID/EventCode exactos o terminados en .eventid/.eventcode
        if (lowerCol === 'rule.id' || lowerCol.endsWith('.eventid') || lowerCol === 'eventid' || lowerCol.endsWith('.eventcode') || lowerCol === 'eventcode') {
          const entry = getGlossaryEntry(fullVal, 'event');
          if (entry) {
            glossaryIconHtml = `<span class="glossary-icon" data-type="event" data-value="${escapeHtml(fullVal)}" data-key="${escapeHtml(entry.key)}">ℹ️</span>`;
          }
        } else if (lowerCol.includes('port')) {
          const entry = getGlossaryEntry(fullVal, 'port');
          if (entry) {
            glossaryIconHtml = `<span class="glossary-icon" data-type="port" data-value="${escapeHtml(fullVal)}" data-key="${escapeHtml(entry.key)}">ℹ️</span>`;
          }
        } else if (lowerCol.includes('logontype') || lowerCol.includes('logon_type')) {
          const entry = getGlossaryEntry(fullVal, 'logontype');
          if (entry) {
            glossaryIconHtml = `<span class="glossary-icon" data-type="logontype" data-value="${escapeHtml(fullVal)}" data-key="${escapeHtml(entry.key)}">ℹ️</span>`;
          }
        }
      }
      
      let contentHtml = highlightText(displayVal, col);
      // Agregar ícono de pivot si corresponde
      if (isPivot) {
        contentHtml = `<span class="pivot-text">${contentHtml}</span><span class="pivot-icon" data-value="${escapeHtml(fullVal)}">🔍</span>`;
      }
      // Agregar ícono de glosario si existe
      if (glossaryIconHtml) {
        contentHtml += glossaryIconHtml;
      }
      
      rowHtml += `<td ${tdClass} title="${escapeHtml(fullVal)}">${contentHtml}</td>`;
    });
    tr.innerHTML = rowHtml;
    tr.onclick = () => { expandedId = (expandedId === log.id) ? null : log.id; renderTable(currentLogs); };
    tbody.appendChild(tr);
    
    if (expandedId === log.id) {
      const dtr = document.createElement('tr');
      dtr.className = 'detail-row';
      const flat = flattenObject(log);
      
      // ====== Orden personalizado de campos según prioridad (NUEVO) ======
      const sortedKeys = Object.keys(flat).sort(compareLogKeys);
      
      // ====== Construir detailHtml con pivote y glosario en los valores ======
      let detailHtml = '';
      sortedKeys.forEach(k => {
        const rawVal = flat[k];
        let displayVal = rawVal !== undefined && rawVal !== null ? String(rawVal) : '-';
        const fullVal = displayVal;
        displayVal = escapeHtml(displayVal);
        
        // Determinar si el valor es pivoteable (usando el nombre del campo k)
        let isPivot = false;
        if (fullVal !== '-' && fullVal !== '' && fullVal !== 'null' && fullVal !== 'undefined') {
          const lowerKey = k.toLowerCase();
          if (lowerKey === 'agent.name' || lowerKey.includes('ip') || lowerKey.includes('user') || lowerKey.includes('hash') || lowerKey.includes('image')) {
            isPivot = true;
          }
        }
        
        // Determinar si muestra ícono de glosario
        let glossaryIconHtml = '';
        if (fullVal !== '-' && fullVal !== '' && fullVal !== 'null' && fullVal !== 'undefined') {
          const lowerKey = k.toLowerCase();
          // rule.id o EventID/EventCode exactos o terminados en .eventid/.eventcode
          if (lowerKey === 'rule.id' || lowerKey.endsWith('.eventid') || lowerKey === 'eventid' || lowerKey.endsWith('.eventcode') || lowerKey === 'eventcode') {
            const entry = getGlossaryEntry(fullVal, 'event');
            if (entry) {
              glossaryIconHtml = `<span class="glossary-icon" data-type="event" data-value="${escapeHtml(fullVal)}" data-key="${escapeHtml(entry.key)}">ℹ️</span>`;
            }
          } else if (lowerKey.includes('port')) {
            const entry = getGlossaryEntry(fullVal, 'port');
            if (entry) {
              glossaryIconHtml = `<span class="glossary-icon" data-type="port" data-value="${escapeHtml(fullVal)}" data-key="${escapeHtml(entry.key)}">ℹ️</span>`;
            }
          } else if (lowerKey.includes('logontype') || lowerKey.includes('logon_type')) {
            const entry = getGlossaryEntry(fullVal, 'logontype');
            if (entry) {
              glossaryIconHtml = `<span class="glossary-icon" data-type="logontype" data-value="${escapeHtml(fullVal)}" data-key="${escapeHtml(entry.key)}">ℹ️</span>`;
            }
          }
        }
        
        let valueHtml = displayVal;
        if (isPivot) {
          valueHtml = `<span class="pivot-text">${displayVal}</span><span class="pivot-icon" data-value="${escapeHtml(fullVal)}">🔍</span>`;
          // Envolver en un span con clase pivotable para que el hover funcione
          valueHtml = `<span class="pivotable">${valueHtml}</span>`;
        }
        // Si no es pivoteable, se muestra el texto sin span adicional
        // Agregar ícono de glosario si existe (puede coexistir con pivot)
        if (glossaryIconHtml) {
          valueHtml += glossaryIconHtml;
        }
        
        detailHtml += `<div><span class="detail-key">${escapeHtml(k)}</span>: ${valueHtml}</div>`;
      });
      
      dtr.innerHTML = `<td colspan="${columns.length+2}">
        <div class="detail-inner"><div class="detail-fields">${detailHtml}</div></div>
      </td>`;
      tbody.appendChild(dtr);
      
      // ====== Asignar listeners a los íconos pivoteables dentro del detalle ======
      dtr.querySelectorAll('.pivot-icon').forEach(icon => {
        icon.addEventListener('click', function(e) {
          e.stopPropagation();
          const val = this.getAttribute('data-value');
          if (val && val !== '-' && val !== '' && val !== 'null' && val !== 'undefined') {
            searchContextValue(val);
          }
        });
      });
      
      // ====== Asignar listeners a los íconos de glosario dentro del detalle ======
      dtr.querySelectorAll('.glossary-icon').forEach(icon => {
        icon.addEventListener('click', function(e) {
          e.stopPropagation();
          const type = this.getAttribute('data-type');
          const value = this.getAttribute('data-value');
          const key = this.getAttribute('data-key');
          let entry = null;
          if (type === 'event') {
            entry = glosarioEventosDB && glosarioEventosDB[key] ? { ...glosarioEventosDB[key], key: key } : null;
          } else if (type === 'port') {
            entry = glosarioPuertosDB && glosarioPuertosDB[key] ? { ...glosarioPuertosDB[key], key: key } : null;
          } else if (type === 'logontype') {
            entry = glosarioLogonTypeDB && glosarioLogonTypeDB[key] ? { ...glosarioLogonTypeDB[key], key: key } : null;
          }
          if (entry) {
            showGlossaryPopup(entry, type, this);
          }
        });
      });
    }
  });
  
  // ====== Asignar listeners a los íconos pivoteables dentro de la tabla ======
  tbody.querySelectorAll('td.pivotable .pivot-icon').forEach(icon => {
    icon.addEventListener('click', function(e) {
      e.stopPropagation();
      const val = this.getAttribute('data-value');
      if (val && val !== '-' && val !== '' && val !== 'null' && val !== 'undefined') {
        searchContextValue(val);
      }
    });
  });
  
  // ====== Asignar listeners a los íconos de glosario dentro de la tabla ======
  tbody.querySelectorAll('.glossary-icon').forEach(icon => {
    icon.addEventListener('click', function(e) {
      e.stopPropagation();
      const type = this.getAttribute('data-type');
      const value = this.getAttribute('data-value');
      const key = this.getAttribute('data-key');
      let entry = null;
      if (type === 'event') {
        entry = glosarioEventosDB && glosarioEventosDB[key] ? { ...glosarioEventosDB[key], key: key } : null;
      } else if (type === 'port') {
        entry = glosarioPuertosDB && glosarioPuertosDB[key] ? { ...glosarioPuertosDB[key], key: key } : null;
      } else if (type === 'logontype') {
        entry = glosarioLogonTypeDB && glosarioLogonTypeDB[key] ? { ...glosarioLogonTypeDB[key], key: key } : null;
      }
      if (entry) {
        showGlossaryPopup(entry, type, this);
      }
    });
  });
  
  // Listeners de checkboxes
  tbody.querySelectorAll('.capture-checkbox').forEach(cb => {
    cb.addEventListener('click', e => e.stopPropagation());
    cb.addEventListener('change', function() {
      const logId = parseInt(this.dataset.logid);
      if (this.checked) {
        if (!capturedLogs.includes(logId)) capturedLogs.push(logId);
      } else {
        capturedLogs = capturedLogs.filter(id => id !== logId);
      }
      renderKillChain(); // refresca selects del panel
    });
  });
  
  document.getElementById('statTotal').textContent = String(currentCaseLogs.length);
  document.getElementById('statMatch').textContent = String(logs.length);
  document.getElementById('statNoise').textContent = String(currentCaseLogs.length - logs.length);
}

// ============================================================
// QUERY DQL
// ============================================================
function runQuery() {
  const q = document.getElementById('queryInput').value.trim();
  const errorEl = document.getElementById('queryError');
  errorEl.classList.remove('show');
  
  if (!q) {
    highlightTerms = [];
    currentLogs = currentCaseLogs.slice();
    renderTable(currentLogs);
    renderFilters(currentLogs);
    return;
  }
  
  const filtered = parseDQL(q, currentCaseLogs);
  currentLogs = filtered;
  renderTable(currentLogs);
  renderFilters(currentLogs);
}

// ============================================================
// UI: OVERLAY, ESCENARIO, PREGUNTAS, ETC.
// ============================================================
function showStartShiftOverlay() {
  const overlay = document.getElementById('startShiftOverlay');
  const table = document.getElementById('logTable');
  overlay.style.display = 'flex';
  table.style.display = 'none';
}

function hideStartShiftOverlay() {
  const overlay = document.getElementById('startShiftOverlay');
  const table = document.getElementById('logTable');
  overlay.style.display = 'none';
  table.style.display = 'table';
}

function showFeedback(msg, type) {
  const fb = document.getElementById('feedback');
  fb.className = `feedback show ${type}`;
  fb.textContent = msg;
}

function renderScenario() {
  if (!currentChallenge) return;
  const idx = casos.indexOf(currentChallenge) + 1;
  const caseTag = `Caso ${String(idx).padStart(2,'0')}`;
  document.getElementById('scenarioEyebrow').textContent = caseTag;
  document.getElementById('scenarioTitle').textContent = currentChallenge.title;
  const topbarLabel = document.getElementById('topbarCaseLabel');
  if (topbarLabel) topbarLabel.textContent = `${caseTag} — ${currentChallenge.title}`;
  document.getElementById('contextText').textContent = currentChallenge.context || '';
  document.getElementById('scenarioText').textContent = currentChallenge.text || '';
  document.getElementById('hintBadge').textContent = currentChallenge.hint || '💡 Usa filtros DQL';
  
  // El estado del botón Kill Chain se maneja en updateKillChainButtonState()
  // así que no necesitamos modificar display aquí.
  const killBtn = document.getElementById('killChainToggleBtn');
  // Asegurar que el botón se actualice al renderizar (por si acaso)
  updateKillChainButtonState();
}

// ============================================================
// RENDER DE LISTA DE CASOS (filtra por dificultad)
// ============================================================
function renderChallenges() {
  const box = document.getElementById('challengeList');
  box.innerHTML = '';
  
  const filtered = casos.filter(c => normDiff(c.difficulty) === normDiff(selectedDifficulty));
  
  filtered.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'challenge-btn' + (c.id === currentChallenge?.id ? ' active' : '') + (solved.has(c.id) ? ' solved' : '');
    btn.innerHTML = `<span class="cnum">${c.id}</span> ${c.title}`;
    btn.onclick = (e) => handleCaseClick(c, e);
    box.appendChild(btn);
  });
  
  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--muted-2);padding:12px;text-align:center;';
    empty.textContent = 'No hay casos en esta dificultad.';
    box.appendChild(empty);
  }
  
  const totalAll = casos.length;
  const solvedAll = solved.size;
  document.getElementById('progressLine').textContent = `${solvedAll} / ${totalAll} resueltos`;
}

// ============================================================
// MANEJADOR DE CLICK EN CASO (con confirmación si hay turno activo)
// ============================================================
let pendingCaseSwitch = null;

function handleCaseClick(caso, event) {
  // El turno sigue "en curso" (y debe confirmarse el cambio) mientras el
  // stream esté activo O el caso ya cargó logs pero aún no se resolvió,
  // sin importar si ya terminó de entregar todos los logs.
  const unfinishedTurn = currentChallenge && TURN_STARTED && !solved.has(currentChallenge.id);
  if (unfinishedTurn && currentChallenge.id !== caso.id) {
    showConfirmPopover(event.target, caso);
  } else {
    if (currentChallenge && currentChallenge.id !== caso.id) {
      selectCase(caso);
    } else if (!currentChallenge) {
      selectCase(caso);
    }
  }
}

// ============================================================
// POPOVER DE CONFIRMACIÓN
// ============================================================
function showConfirmPopover(targetEl, caso) {
  hideConfirmPopover();
  
  const popover = document.createElement('div');
  popover.className = 'confirm-popover';
  popover.innerHTML = `
    <div>Estás en medio de un turno. ¿Finalizar caso actual y cargar "${caso.title}"?</div>
    <div class="popover-actions">
      <button class="confirm-btn">Finalizar caso en turno</button>
      <button class="cancel-btn">Cancelar</button>
    </div>
  `;
  
  const rect = targetEl.getBoundingClientRect();
  document.body.appendChild(popover);

  const popRect = popover.getBoundingClientRect();
  let left = rect.left;
  let top = rect.bottom + 6;
  if (left + popRect.width > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - popRect.width - 8);
  }
  if (top + popRect.height > window.innerHeight - 8) {
    top = Math.max(8, rect.top - popRect.height - 6);
  }
  popover.style.left = left + 'px';
  popover.style.top = top + 'px';
  
  popover.querySelector('.confirm-btn').addEventListener('click', () => {
    if (streamState.active) stopLogStream();
    streamState.active = false;
    streamState.paused = false;
    streamState.isComplete = false;
    selectCase(caso);
    hideConfirmPopover();
  });
  
  popover.querySelector('.cancel-btn').addEventListener('click', hideConfirmPopover);
  
  setTimeout(() => {
    document.addEventListener('click', outsideClickHandler);
  }, 0);
  
  window._confirmPopover = popover;
  window._confirmPopoverCase = caso;
}

function hideConfirmPopover() {
  if (window._confirmPopover) {
    window._confirmPopover.remove();
    window._confirmPopover = null;
    window._confirmPopoverCase = null;
    document.removeEventListener('click', outsideClickHandler);
  }
}

function outsideClickHandler(e) {
  const popover = window._confirmPopover;
  if (popover && !popover.contains(e.target)) {
    hideConfirmPopover();
  }
}

// ============================================================
// CONFIGURAR SELECTOR DE DIFICULTAD
// ============================================================
function setupDifficultySelector() {
  const buttons = document.querySelectorAll('.diff-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', function() {
      buttons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      selectedDifficulty = this.dataset.diff;
      renderChallenges();
    });
  });
}

// ============================================================
// PREGUNTAS (con hint oculto y botón toggle) - MODIFICADO PARA VEREDICTO
// ============================================================
function renderQuestions() {
  const container = document.getElementById('questionsContainer');
  const progress = document.getElementById('questionsProgress');
  const badge = document.getElementById('questionsBadge');
  const caseQuestions = currentChallenge?.questions || currentCaseData?.questions;
  if (!caseQuestions || caseQuestions.length === 0) {
    container.innerHTML = '<p style="color:var(--muted-2);">Este caso no tiene preguntas.</p>';
    progress.textContent = 'Progreso: 0/0';
    badge.textContent = '0';
    return;
  }
  const questions = caseQuestions;
  const caseId = currentChallenge.id;
  const caseNum = currentChallenge.number;
  if (!questionStates[caseId]) {
    questionStates[caseId] = questions.map(() => ({ answered: false, correct: false }));
  }
  let correctCount = 0;
  let html = '';
  questions.forEach((q, idx) => {
    const state = questionStates[caseId][idx] || { answered: false, correct: false };
    if (state.correct) correctCount++;
    const statusIcon = state.correct ? '✅' : (state.answered ? '❌' : '⬜');
    const inputDisabled = state.correct ? 'disabled' : '';
    const inputClass = state.correct ? 'correct' : (state.answered ? 'wrong' : '');
    const feedbackText = state.correct ? '✅ Correcto!' : (state.answered ? '❌ Incorrecto' : '');
    const feedbackClass = state.correct ? 'correct' : (state.answered ? 'wrong' : '');
    const key = `${caseNum}-${idx}`;
    const validation = window.VALIDATION_CONFIG?.[key];
    const correctAnswer = validation?.answer || q.answer;
    const acceptable = validation?.acceptable || q.acceptable || [];
    const maskedAccepted = [correctAnswer, ...acceptable].map(a => a.replace(/[a-zA-Z0-9]/g, '*')).join(' o ');
    const hintText = q.hint || '';
    const hintVisible = state.correct ? 'block' : 'none';
    const hintToggleLabel = state.correct ? '💡 Ocultar pista' : '💡 Ver pista';

    // Determinar si es pregunta de veredicto
    const isVeredicto = q.tipoPregunta === 'veredicto';

    html += `<div class="question-item" data-qidx="${idx}">`;
    html += `<div class="q-text">${q.text} <span class="q-status ${state.correct ? 'correct' : (state.answered ? 'wrong' : '')}">${statusIcon}</span></div>`;

    if (isVeredicto) {
      // Renderizar selector de dos opciones
      html += `<div class="q-input-row ${inputClass}">`;
      html += `<select id="qselect_${caseId}_${idx}" ${inputDisabled}>`;
      html += `<option value="Falso Positivo" ${state.userValue === 'Falso Positivo' ? 'selected' : ''}>Falso Positivo</option>`;
      html += `<option value="Verdadero Positivo" ${state.userValue === 'Verdadero Positivo' ? 'selected' : ''}>Verdadero Positivo</option>`;
      html += `</select>`;
      html += `<button class="verify-btn" data-case="${caseNum}" data-qidx="${idx}" ${inputDisabled}>Verificar</button>`;
      html += `</div>`;
      // No mostrar hint ni pista de longitud para veredicto
    } else {
      // Renderizar input de texto con pista enmascarada y hint toggle
      html += `<div class="q-input-row ${inputClass}">`;
      html += `<input type="text" id="qinput_${caseId}_${idx}" placeholder="${escapeHtml(maskedAccepted)}" value="${escapeHtml(state.userValue || '')}" ${inputDisabled}>`;
      html += `<button class="verify-btn" data-case="${caseNum}" data-qidx="${idx}" ${inputDisabled}>Verificar</button>`;
      html += `</div>`;
      html += `<button class="hint-toggle-btn" data-qidx="${idx}" style="${state.correct ? 'display:none;' : ''}">${hintToggleLabel}</button>`;
      html += `<div class="q-hint-content" style="display:${hintVisible};">${hintText}</div>`;
    }

    html += `<div class="input-error" id="qerror_${caseId}_${idx}"></div>`;
    html += `</div>`;
  });
  container.innerHTML = html;
  progress.textContent = `Progreso: ${correctCount}/${questions.length}`;
  badge.textContent = `${correctCount}/${questions.length}`;
  
  container.querySelectorAll('.verify-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const caseNum = parseInt(this.dataset.case);
      const qidx = parseInt(this.dataset.qidx);
      verifyAnswer(caseNum, qidx);
    });
  });

  // Para inputs de texto (no veredicto), mantener el Enter
  container.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const parent = e.target.closest('.question-item');
        const btn = parent?.querySelector('.verify-btn');
        if (btn && !btn.disabled) btn.click();
      }
    });
  });
  
  // Para selects de veredicto, también Enter debería verificar
  container.querySelectorAll('select').forEach(sel => {
    sel.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const parent = e.target.closest('.question-item');
        const btn = parent?.querySelector('.verify-btn');
        if (btn && !btn.disabled) btn.click();
      }
    });
  });
  
  container.querySelectorAll('.hint-toggle-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const parent = this.closest('.question-item');
      const hintContent = parent.querySelector('.q-hint-content');
      if (hintContent) {
        const isHidden = hintContent.style.display === 'none';
        hintContent.style.display = isHidden ? 'block' : 'none';
        this.textContent = isHidden ? '💡 Ocultar pista' : '💡 Ver pista';
      }
    });
  });
}

function verifyAnswer(caseNum, qidx) {
  if (!currentChallenge || !currentCaseData) return;
  const questions = currentCaseData.questions;
  if (qidx >= questions.length) return;
  const q = questions[qidx];
  const isVeredicto = q.tipoPregunta === 'veredicto';
  
  let userValue;
  let errorElId = `qerror_${currentChallenge.id}_${qidx}`;
  
  if (isVeredicto) {
    const select = document.getElementById(`qselect_${currentChallenge.id}_${qidx}`);
    if (!select) return;
    userValue = select.value;
  } else {
    const input = document.getElementById(`qinput_${currentChallenge.id}_${qidx}`);
    if (!input || input.disabled) return;
    userValue = input.value.trim();
  }
  
  const errorEl = document.getElementById(errorElId);
  if (userValue === '' && !isVeredicto) {
    if (errorEl) {
      errorEl.textContent = '⚠️ Introduce un valor.';
      errorEl.classList.add('show');
    }
    return;
  }
  if (errorEl) errorEl.classList.remove('show');
  
  const key = `${caseNum}-${qidx}`;
  const validation = window.VALIDATION_CONFIG?.[key];
  const correctAnswer = validation?.answer || q.answer;
  const acceptable = validation?.acceptable || q.acceptable || [];
  const allValid = [correctAnswer, ...acceptable].map(a => a.trim().toLowerCase());
  const userAns = userValue.trim().toLowerCase();
  
  const isCorrect = allValid.includes(userAns);
  
  if (!questionStates[currentChallenge.id]) {
    questionStates[currentChallenge.id] = questions.map(() => ({ answered: false, correct: false }));
  }
  const state = questionStates[currentChallenge.id][qidx];
  state.answered = true;
  state.correct = isCorrect;
  state.userValue = userValue;
  
  const row = isVeredicto 
    ? document.getElementById(`qselect_${currentChallenge.id}_${qidx}`)?.closest('.q-input-row')
    : document.getElementById(`qinput_${currentChallenge.id}_${qidx}`)?.closest('.q-input-row');
  
  if (row) {
    if (isCorrect) {
      row.classList.add('correct');
      row.classList.remove('wrong');
      const selectOrInput = isVeredicto 
        ? document.getElementById(`qselect_${currentChallenge.id}_${qidx}`)
        : document.getElementById(`qinput_${currentChallenge.id}_${qidx}`);
      if (selectOrInput) selectOrInput.disabled = true;
      const btn = row.querySelector('.verify-btn');
      if (btn) btn.disabled = true;
    } else {
      row.classList.add('wrong');
      row.classList.remove('correct');
    }
  }
  
  renderQuestions();
  checkCaseSolved();
}

// ============================================================
// CHECK CASE SOLVED (usa currentCaseLogs)
// ============================================================
function checkCaseSolved() {
  if (!currentChallenge || !currentCaseData) return;
  const questions = currentChallenge.questions || currentCaseData.questions;
  if (!questions || questions.length === 0) return;
  const states = questionStates[currentChallenge.id] || [];
  const allCorrect = questions.every((_, idx) => states[idx]?.correct === true);
  if (!allCorrect) return;
  const targetIds = currentChallenge.target.map(id => String(id));
  const allTargetsFound = targetIds.every(id => currentCaseLogs.some(log => String(log.id) === id));
  if (allTargetsFound) {
    solved.add(currentChallenge.id);
    renderChallenges();
    showFeedback('🎉 ¡Caso completado!', 'correct');
  }
}

// ============================================================
// NUEVA FUNCIÓN: Autocompletar fases sin log
// ============================================================
function checkNullPhases(caseId) {
  if (!killChainData || !killChainData.fases) return;
  const state = killChainState[caseId];
  if (!state) return;

  const realPhaseIndexes = [];
  killChainData.fases.forEach((fase, idx) => {
    if (fase.logId !== null) realPhaseIndexes.push(idx);
  });
  const allRealCorrect = realPhaseIndexes.every(idx => state[idx]?.correct === true);

  killChainData.fases.forEach((fase, idx) => {
    if (fase.logId === null) {
      state[idx].verified = true;
      state[idx].correct = allRealCorrect;
    }
  });
}

// ============================================================
// KILL CHAIN FUNCIONES (con captura de logs y autocompletado)
// ============================================================
function renderKillChain() {
  const container = document.getElementById('killChainContent');
  if (!killChainData || !killChainData.fases || killChainData.fases.length === 0) {
    container.innerHTML = '<p style="color:var(--muted-2);">No hay información de Kill Chain para este caso.</p>';
    return;
  }
  const caseId = currentChallenge.id;
  const state = killChainState[caseId] || [];
  let html = '';

  if (capturedLogs.length === 0 && killChainData.fases.some(f => f.logId !== null)) {
    html = `<p style="color:var(--muted-2); font-size:12px;">Marca logs con el checkbox en la tabla para poder asignarlos aquí.</p>`;
    container.innerHTML = html;
    return;
  }

  killChainData.fases.forEach((fase, idx) => {
    const st = state[idx] || { verified: false, correct: false, userValue: '' };
    const statusIcon = st.correct ? '✅' : (st.verified ? '❌' : '⬜');

    // ====== FASE SIN LOG (autocompletada) ======
    if (fase.logId === null) {
      html += `
        <div class="killchain-phase" data-phaseidx="${idx}">
          <div class="phase-header">
            <span class="phase-name">${fase.nombre}</span>
            <span class="phase-status ${st.correct ? 'correct' : ''}">${st.correct ? '✅' : '⏳'}</span>
          </div>
          <div class="phase-desc">${fase.descripcion}</div>
          <div class="phase-auto-note">
            ${st.correct ? '✅ Completada automáticamente.' : '⏳ Se completa al identificar el resto de las fases.'}
          </div>
        </div>
      `;
      return;
    }

    // ====== FASE CON LOG NORMAL ======
    const disabled = st.correct ? 'disabled' : '';
    const selectClass = st.correct ? 'correct' : (st.verified ? 'wrong' : '');
    const hintText = fase.pista || 'Sin pista';
    const hintVisible = st.verified ? 'block' : 'none';
    const hintToggleLabel = st.verified ? '💡 Ocultar pista' : '💡 Ver pista';

    let optionsHtml = `<option value="">— Selecciona un log capturado —</option>`;
    capturedLogs.forEach(logId => {
      const log = currentCaseLogs.find(l => l.id === logId);
      const desc = log?.rule?.description || 'sin descripción';
      const shortDesc = desc.length > 45 ? desc.slice(0, 45) + '…' : desc;
      const selected = (st.userValue && parseInt(st.userValue) === logId) ? 'selected' : '';
      optionsHtml += `<option value="${logId}" ${selected}>ID ${logId} — ${escapeHtml(shortDesc)}</option>`;
    });

    html += `
      <div class="killchain-phase" data-phaseidx="${idx}">
        <div class="phase-header">
          <span class="phase-name">${fase.nombre}</span>
          <span class="phase-status ${st.correct ? 'correct' : (st.verified ? 'wrong' : '')}">${statusIcon}</span>
        </div>
        <div class="phase-desc">${fase.descripcion}</div>
        <div class="phase-input-row ${selectClass}">
          <select id="kcselect_${caseId}_${idx}" ${disabled}>
            ${optionsHtml}
          </select>
          <button class="verify-btn" data-case="${caseId}" data-phaseidx="${idx}" ${disabled}>Verificar</button>
        </div>
        <button class="hint-toggle-btn" data-phaseidx="${idx}">${hintToggleLabel}</button>
        <div class="phase-hint-content" style="display:${hintVisible};">${hintText}</div>
        <div class="input-error" id="kcerror_${caseId}_${idx}"></div>
      </div>
    `;
  });
  container.innerHTML = html;

  // Eventos de verificación
  container.querySelectorAll('.verify-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const caseId = this.dataset.case;
      const phaseIdx = parseInt(this.dataset.phaseidx);
      verifyKillChainPhase(caseId, phaseIdx);
    });
  });

  container.querySelectorAll('select').forEach(sel => {
    sel.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const parent = e.target.closest('.killchain-phase');
        const btn = parent?.querySelector('.verify-btn');
        if (btn && !btn.disabled) btn.click();
      }
    });
  });

  container.querySelectorAll('.hint-toggle-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const parent = this.closest('.killchain-phase');
      const hintContent = parent.querySelector('.phase-hint-content');
      if (hintContent) {
        const isHidden = hintContent.style.display === 'none';
        hintContent.style.display = isHidden ? 'block' : 'none';
        this.textContent = isHidden ? '💡 Ocultar pista' : '💡 Ver pista';
      }
    });
  });
}

function verifyKillChainPhase(caseId, phaseIdx) {
  if (!killChainData || !killChainData.fases || phaseIdx >= killChainData.fases.length) return;
  const fase = killChainData.fases[phaseIdx];
  // Si la fase es null, no se verifica (ya se autocompleta)
  if (fase.logId === null) return;
  
  const select = document.getElementById(`kcselect_${caseId}_${phaseIdx}`);
  const errorEl = document.getElementById(`kcerror_${caseId}_${phaseIdx}`);
  if (!select || select.disabled) return;
  const userValue = select.value;
  if (userValue === '') {
    if (errorEl) {
      errorEl.textContent = '⚠️ Selecciona un log capturado.';
      errorEl.classList.add('show');
    }
    return;
  }
  if (errorEl) errorEl.classList.remove('show');
  
  const expected = fase.logId;
  const isCorrect = (expected !== null && parseInt(userValue) === expected);
  
  if (!killChainState[caseId]) {
    killChainState[caseId] = killChainData.fases.map(() => ({ verified: false, correct: false, userValue: '' }));
  }
  const st = killChainState[caseId][phaseIdx];
  st.verified = true;
  st.correct = isCorrect;
  st.userValue = userValue;

  const row = select.closest('.phase-input-row');
  if (isCorrect) {
    select.disabled = true;
    row.classList.add('correct');
    row.classList.remove('wrong');
    const btn = row.querySelector('.verify-btn');
    if (btn) btn.disabled = true;
  } else {
    row.classList.add('wrong');
    row.classList.remove('correct');
  }
  
  // Autocompletar fases null
  checkNullPhases(caseId);
  updateKillChainProgress();
  renderKillChain();
}

function updateKillChainProgress() {
  const caseId = currentChallenge?.id;
  // Si no hay caso, ocultar badge
  if (!caseId) {
    const badge = document.getElementById('killChainBadge');
    if (badge) {
      badge.textContent = '0/0';
      badge.style.display = 'none';
    }
    const progress = document.getElementById('killChainProgress');
    if (progress) progress.textContent = 'Progreso: 0/0';
    return;
  }
  // Si no es fácil o no hay datos, ocultar badge
  if (normDiff(currentChallenge.difficulty) !== 'facil' || !killChainData || !killChainData.fases || killChainData.fases.length === 0) {
    const badge = document.getElementById('killChainBadge');
    if (badge) badge.style.display = 'none';
    const progress = document.getElementById('killChainProgress');
    if (progress) progress.textContent = 'Progreso: 0/0';
    return;
  }
  // Caso fácil con datos
  const state = killChainState[caseId] || [];
  const total = state.length;
  const correct = state.filter(s => s.correct).length;
  const badge = document.getElementById('killChainBadge');
  if (badge) {
    badge.textContent = `${correct}/${total}`;
    badge.style.display = '';
  }
  const progress = document.getElementById('killChainProgress');
  if (progress) progress.textContent = `Progreso: ${correct}/${total}`;
}

// ============================================================
// CONTEXTO SOC (NUEVO)
// ============================================================
function clearContextState(caseId) {
  contextCacheByCase[caseId] = {};
  contextHistoryByCase[caseId] = [];
  // Limpiar UI
  document.getElementById('contextResult').style.display = 'none';
  document.getElementById('contextResult').innerHTML = '';
  renderContextHistory();
}

function classifyValue(val, caseId) {
  const normalized = val.trim().toLowerCase();
  // Verificar caché
  const cache = contextCacheByCase[caseId] || {};
  if (cache[normalized] !== undefined) {
    return cache[normalized];
  }

  let tipo = 'unknown';
  let resultado = { type: 'unknown', message: 'Sin registro.' };

  // 1. Buscar en índice IP → activo
  let hostname = null;
  if (indiceIpDB && indiceIpDB[normalized]) {
    hostname = indiceIpDB[normalized];
  }
  if (hostname) {
    const activoKey = Object.keys(activosDB).find(k => k.toLowerCase() === hostname.toLowerCase());
    if (activoKey) {
      const activo = activosDB[activoKey];
      tipo = 'internal';
      resultado = { type: 'internal', subtype: 'activo', ...activo, hostname: activoKey };
      cache[normalized] = { tipo, resultado };
      contextCacheByCase[caseId] = cache;
      return { tipo, resultado };
    }
  }

  // 2. Buscar en activosDB directamente (por hostname)
  const activoKeyDirect = Object.keys(activosDB).find(k => k.toLowerCase() === normalized);
  if (activoKeyDirect) {
    const activo = activosDB[activoKeyDirect];
    tipo = 'internal';
    resultado = { type: 'internal', subtype: 'activo', ...activo, hostname: activoKeyDirect };
    cache[normalized] = { tipo, resultado };
    contextCacheByCase[caseId] = cache;
    return { tipo, resultado };
  }

  // 3. Buscar en usuariosDB (por username o correo)
  const usuarioKeyDirect = Object.keys(usuariosDB).find(k => k.toLowerCase() === normalized);
  if (usuarioKeyDirect) {
    const usuario = usuariosDB[usuarioKeyDirect];
    tipo = 'internal';
    resultado = { type: 'internal', subtype: 'usuario', ...usuario, username: usuarioKeyDirect };
    cache[normalized] = { tipo, resultado };
    contextCacheByCase[caseId] = cache;
    return { tipo, resultado };
  }
  // Buscar por correo
  const usuarioPorCorreo = Object.values(usuariosDB).find(u => u.correo && u.correo.toLowerCase() === normalized);
  if (usuarioPorCorreo) {
    const usernameKey = Object.keys(usuariosDB).find(k => usuariosDB[k] === usuarioPorCorreo);
    tipo = 'internal';
    resultado = { type: 'internal', subtype: 'usuario', ...usuarioPorCorreo, username: usernameKey };
    cache[normalized] = { tipo, resultado };
    contextCacheByCase[caseId] = cache;
    return { tipo, resultado };
  }

  // 4. Buscar en threatIntelDB
  const threatKey = Object.keys(threatIntelDB).find(k => k.toLowerCase() === normalized);
  if (threatKey) {
    const threat = threatIntelDB[threatKey];
    if (threat.tipo === 'malicious') {
      tipo = 'malicious';
      resultado = { type: 'malicious', ...threat };
    } else {
      tipo = 'unknown';
      resultado = { type: 'unknown', message: 'Sin registro.' };
    }
    cache[normalized] = { tipo, resultado };
    contextCacheByCase[caseId] = cache;
    return { tipo, resultado };
  }

  // ====== NUEVO: 5. Buscar en herramientasDB ======
  if (herramientasDB) {
    const toolKey = Object.keys(herramientasDB).find(k => k.toLowerCase() === normalized);
    if (toolKey) {
      const tool = herramientasDB[toolKey];
      tipo = 'internal';
      resultado = { type: 'internal', subtype: 'herramienta', ...tool, ruta: toolKey };
      cache[normalized] = { tipo, resultado };
      contextCacheByCase[caseId] = cache;
      return { tipo, resultado };
    }
  }

  // 6. Fallback decorativo (solo si parece IP, hash o dominio)
  let parece = null;
  if (looksLikeIp(normalized)) parece = 'ip';
  else if (looksLikeHash(normalized)) parece = 'hash';
  else if (looksLikeDomain(normalized)) parece = 'domain';

  if (parece) {
    const seed = hashString(normalized);
    const isMalicious = seed > 0.5; // 50% probabilidad
    if (isMalicious) {
      const detections = Math.floor(seed * 90) + 1;
      const categories = ['Phishing', 'C2', 'Malware dropper', 'Exploit', 'Recon'];
      const category = categories[Math.floor(seed * categories.length) % categories.length];
      const firstSeen = Math.floor(seed * 30) + 1;
      tipo = 'malicious';
      resultado = {
        type: 'malicious',
        detections: `${detections}/90`,
        category: category,
        firstSeen: `hace ${firstSeen} días`,
        message: `⚠️ Posible amenaza (${category}) con ${detections}/90 detecciones.`
      };
    } else {
      tipo = 'unknown';
      resultado = { type: 'unknown', message: 'Sin registro.' };
    }
  } else {
    tipo = 'unknown';
    resultado = { type: 'unknown', message: 'Sin registro.' };
  }

  cache[normalized] = { tipo, resultado };
  contextCacheByCase[caseId] = cache;
  return { tipo, resultado };
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir a 32-bit int
  }
  // Normalizar a valor entre 0 y 1
  return (hash >>> 0) / 4294967295;
}

// ====== NUEVA FUNCIÓN: Búsqueda de contexto con valor directo (para click to pivot) ======
function searchContextValue(val) {
  const caseId = currentChallenge?.id;
  if (!caseId) {
    showContextResult(null, 'Selecciona un caso primero.');
    return;
  }
  const trimmed = val.trim();
  if (!trimmed || trimmed === '-' || trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
    return;
  }
  const { tipo, resultado } = classifyValue(trimmed, caseId);
  showContextResult({ tipo, resultado });
  // Guardar en historial
  if (!contextHistoryByCase[caseId]) contextHistoryByCase[caseId] = [];
  contextHistoryByCase[caseId].push({ valor: trimmed, tipo, resultado });
  renderContextHistory();
  // Abrir panel si no está abierto
  if (activePanel !== 'context') {
    togglePanel('context');
  }
}

function performContextSearch() {
  const input = document.getElementById('contextSearchInput');
  const value = input.value.trim();
  if (!value) {
    showContextResult(null, 'Introduce un valor para buscar.');
    return;
  }
  searchContextValue(value);
}

function showContextResult(data, errorMsg) {
  const container = document.getElementById('contextResult');
  if (errorMsg) {
    container.style.display = 'block';
    container.innerHTML = `<div style="color:var(--muted);">${escapeHtml(errorMsg)}</div>`;
    return;
  }
  if (!data) {
    container.style.display = 'none';
    return;
  }
  const { tipo, resultado } = data;
  let html = '';

  if (tipo === 'internal' && resultado.subtype === 'activo') {
    html = `
      <div><span class="result-type internal">🟢 Interno</span> Activo</div>
      <div class="result-detail">
        Hostname: <span>${escapeHtml(resultado.hostname)}</span><br>
        FQDN: <span>${escapeHtml(resultado.fqdn)}</span><br>
        IP: <span>${escapeHtml(resultado.ip)}</span><br>
        Rol: <span>${escapeHtml(resultado.rol)}</span><br>
        Departamento: <span>${escapeHtml(resultado.departamento)}</span><br>
        Criticidad: <span>${escapeHtml(resultado.criticidad)}</span><br>
        ${resultado.usuarioPrincipal ? `Usuario principal: <span>${escapeHtml(resultado.usuarioPrincipal)}</span><br>` : ''}
        SO: <span>${escapeHtml(resultado.so)}</span>
      </div>
    `;
  } else if (tipo === 'internal' && resultado.subtype === 'usuario') {
    html = `
      <div><span class="result-type internal">🟢 Interno</span> Usuario</div>
      <div class="result-detail">
        Nombre: <span>${escapeHtml(resultado.nombre)}</span><br>
        Username: <span>${escapeHtml(resultado.username)}</span><br>
        Correo: <span>${escapeHtml(resultado.correo)}</span><br>
        Departamento: <span>${escapeHtml(resultado.departamento)}</span><br>
        Cargo: <span>${escapeHtml(resultado.cargo)}</span><br>
        Host principal: <span>${escapeHtml(resultado.hostPrincipal)}</span><br>
        Privilegios: <span>${escapeHtml(resultado.privilegios)}</span>
      </div>
    `;
  } else if (tipo === 'malicious') {
    const actor = resultado.actor ? `Actor: <span>${escapeHtml(resultado.actor)}</span><br>` : '';
    html = `
      <div><span class="result-type malicious">🔴 Malicioso</span></div>
      <div class="result-detail">
        Categoría: <span>${escapeHtml(resultado.categoria || '')}</span><br>
        ${actor}
        Detecciones: <span>${escapeHtml(resultado.detecciones)}</span><br>
        Primera vez visto: <span>${escapeHtml(resultado.primeraVezVisto)}</span>
        ${resultado.message ? `<br><span style="color:var(--muted);">${escapeHtml(resultado.message)}</span>` : ''}
      </div>
    `;
  } else if (tipo === 'internal' && resultado.subtype === 'herramienta') {
    // ====== NUEVO: distinción entre herramienta_interna y saas_autorizado ======
    const isInterna = resultado.tipo === 'herramienta_interna';
    const label = isInterna ? 'Interno' : 'Autorizado';
    let detailHtml = '';
    if (isInterna) {
      detailHtml = `
        Nombre: <span>${escapeHtml(resultado.nombre)}</span><br>
        Ruta: <span>${escapeHtml(resultado.ruta)}</span><br>
        Departamento: <span>${escapeHtml(resultado.departamento)}</span><br>
        Descripción: <span>${escapeHtml(resultado.descripcion)}</span><br>
        ${resultado.scriptAsociado ? `Script asociado: <span>${escapeHtml(resultado.scriptAsociado)}</span><br>` : ''}
        Firmado: <span>${resultado.firmado ? '✅ Sí' : '❌ No'}</span><br>
        Responsable: <span>${escapeHtml(resultado.responsable)}</span>
      `;
    } else { // saas_autorizado
      detailHtml = `
        Nombre: <span>${escapeHtml(resultado.nombre)}</span><br>
        Categoría: <span>${escapeHtml(resultado.categoria)}</span><br>
        Descripción: <span>${escapeHtml(resultado.descripcion)}</span><br>
        Departamento responsable: <span>${escapeHtml(resultado.departamentoResponsable)}</span>
      `;
    }
    html = `
      <div><span class="result-type internal">🟢 ${label}</span> Herramienta</div>
      <div class="result-detail">
        ${detailHtml}
      </div>
    `;
  } else {
    html = `
      <div><span class="result-type unknown">⚪ Desconocido</span> ${resultado.message || 'Sin registro.'}</div>
    `;
  }
  container.style.display = 'block';
  container.innerHTML = html;
}

function renderContextHistory() {
  const caseId = currentChallenge?.id;
  const container = document.getElementById('contextHistory');
  if (!caseId || !contextHistoryByCase[caseId] || contextHistoryByCase[caseId].length === 0) {
    container.innerHTML = '<p style="color:var(--muted-2);font-size:11px;">Sin búsquedas todavía en este caso.</p>';
    return;
  }
  const history = contextHistoryByCase[caseId];
  let html = '';
  history.forEach((item, idx) => {
    const tipo = item.tipo;
    const typeLabel = tipo.charAt(0).toUpperCase() + tipo.slice(1);
    html += `
      <div class="history-item" data-idx="${idx}">
        <span class="h-value" title="${escapeHtml(item.valor)}">${escapeHtml(item.valor)}</span>
        <span class="h-type ${tipo}">${typeLabel}</span>
      </div>
    `;
  });
  container.innerHTML = html;

  // Click en historial para volver a mostrar resultado
  container.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', function() {
      const idx = parseInt(this.dataset.idx);
      const entry = history[idx];
      if (entry) {
        showContextResult({ tipo: entry.tipo, resultado: entry.resultado });
        // Opcional: poner el valor en el input
        document.getElementById('contextSearchInput').value = entry.valor;
      }
    });
  });
}

// ============================================================
// EVENT LISTENERS
// ============================================================
document.getElementById('startShiftBtn').addEventListener('click', startShift);
document.getElementById('runBtn').addEventListener('click', runQuery);
document.getElementById('clearBtn').addEventListener('click', () => {
  document.getElementById('queryInput').value = '';
  runQuery();
});
document.getElementById('queryInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') runQuery();
});
document.querySelectorAll('.query-hint .clickable').forEach(el => {
  el.onclick = () => {
    document.getElementById('queryInput').value = el.dataset.query;
    runQuery();
  };
});

// Toggle de paneles (excluyentes)
document.getElementById('questionsToggleBtn').addEventListener('click', function() {
  togglePanel('questions');
});
document.getElementById('killChainToggleBtn').addEventListener('click', function() {
  // Verificar si el botón está deshabilitado (por atributo o por clase)
  if (this.disabled) return;
  togglePanel('killchain');
});
document.getElementById('contextToggleBtn').addEventListener('click', function() { // NUEVO
  togglePanel('context');
});
document.getElementById('questionsCloseBtn').addEventListener('click', function() {
  togglePanel('questions');
});
document.getElementById('killChainCloseBtn').addEventListener('click', function() {
  // Verificar si el botón está deshabilitado (por si acaso)
  const killBtn = document.getElementById('killChainToggleBtn');
  if (killBtn && killBtn.disabled) return;
  togglePanel('killchain');
});
document.getElementById('contextCloseBtn').addEventListener('click', function() { // NUEVO
  togglePanel('context');
});

// Sidebar toggle
const toggleBtn = document.getElementById('sidebarToggle');
toggleBtn.addEventListener('click', () => {
  document.getElementById('appShell').classList.toggle('collapsed');
  toggleBtn.textContent = document.getElementById('appShell').classList.contains('collapsed') ? '▶' : '◀';
});

// Buscador del panel de campos (solo filtra esa columna, no los logs)
document.getElementById('fieldSearchInput').addEventListener('input', applyFieldSearchFilter);
document.getElementById('fieldSearchClear').addEventListener('click', () => {
  const input = document.getElementById('fieldSearchInput');
  input.value = '';
  input.focus();
  applyFieldSearchFilter();
});

// Topbar del caso: colapsar/expandir (deja una franja con caso + título)
document.getElementById('scenarioToggleBtn').addEventListener('click', () => {
  document.getElementById('topbar').classList.toggle('collapsed');
});

// ====== BLOC DE NOTAS FLOTANTE (SCRATCHPAD) ======
function loadScratchpadForCase(caseId) {
  const textarea = document.getElementById('scratchpadTextarea');
  if (!textarea) return;
  textarea.value = scratchpadNotes[caseId] || '';
}

function toggleScratchpad() {
  const panel = document.getElementById('scratchpadPanel');
  const fab = document.getElementById('scratchpadFab');
  const isOpen = panel.classList.toggle('open');
  fab.classList.toggle('active', isOpen);
  if (isOpen) {
    document.getElementById('scratchpadTextarea').focus();
  }
}

document.getElementById('scratchpadFab').addEventListener('click', toggleScratchpad);
document.getElementById('scratchpadCloseBtn').addEventListener('click', toggleScratchpad);
document.getElementById('scratchpadTextarea').addEventListener('input', function() {
  if (!currentChallenge) return;
  scratchpadNotes[currentChallenge.id] = this.value;
});

// ====== Cerrar scratchpad al hacer clic fuera (NUEVO) ======
document.addEventListener('click', function(e) {
  const panel = document.getElementById('scratchpadPanel');
  const fab = document.getElementById('scratchpadFab');
  if (panel && panel.classList.contains('open')) {
    // Si el clic no fue dentro del panel ni del botón, cerrar
    if (!e.target.closest('#scratchpadPanel') && !e.target.closest('#scratchpadFab')) {
      toggleScratchpad();
    }
  }
});

// ====== CONTEXTO SOC: Event listeners (NUEVO) ======
document.getElementById('contextSearchBtn').addEventListener('click', performContextSearch);
document.getElementById('contextSearchInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    performContextSearch();
  }
});

// ====== Cerrar popup de glosario al hacer scroll o redimensionar (opcional) ======
window.addEventListener('scroll', hideGlossaryPopup);
window.addEventListener('resize', hideGlossaryPopup);

window.pauseLogStream = pauseLogStream;
window.resumeLogStream = resumeLogStream;

// ============================================================
// INICIALIZACIÓN
// ============================================================
setupDifficultySelector();
loadIndex();