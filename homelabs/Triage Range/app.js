// ============================================================
// app.js - Con parser DQL real y todas las correcciones
// ============================================================

console.log('🚀 app.js cargado (versión corregida)');

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
let selectedDifficulty = 'facil';

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
// CARGA DEL ÍNDICE
// ============================================================
async function loadIndex() {
  try {
    const res = await fetch('data/index.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    casos = data.casos;
    casos.forEach(c => {
      const num = parseInt(c.id.replace('caso-', ''));
      c.number = num;
      if (!c.target) c.target = [];
    });
    const first = casos.find(c => c.difficulty === 'Fácil' || c.difficulty === 'facil');
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
    
    // Placeholder genérico
    document.getElementById('queryInput').placeholder = 'Escribe tu query DQL...';
    
    // Limpiar tabla y filtros
    renderTable([]);
    renderFilters([]);
    renderSelectedFieldsList();
    showStartShiftOverlay();
    
    // Actualizar UI
    renderScenario();
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
    
    showFeedback(`📋 Caso cargado. Presiona "Iniciar turno" para comenzar.`, 'help');
    
  } catch (e) {
    console.error('Error cargando caso:', e);
    showFeedback(`⚠️ Error: ${e.message}`, 'wrong');
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
  currentLogs = currentCaseLogs.slice();
  
  renderFilters(currentLogs);
  renderSelectedFieldsList();
  renderTable(currentLogs);
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
// PARSER DQL REAL
// ============================================================
function parseDQL(query, logs) {
  if (!query || !query.trim()) return logs.slice();
  
  const errorEl = document.getElementById('queryError');
  errorEl.classList.remove('show');
  
  try {
    const cleanQuery = query.trim();
    const filtered = logs.filter(log => evaluateDQL(cleanQuery, log));
    return filtered;
  } catch (e) {
    errorEl.textContent = `⚠️ Error de sintaxis DQL: ${e.message}`;
    errorEl.classList.add('show');
    return logs.slice();
  }
}

function evaluateDQL(query, log) {
  let q = query;
  
  // Procesar paréntesis
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
  
  // OR
  const orParts = splitOutsideQuotes(q, ' OR ');
  if (orParts.length > 1) {
    return orParts.some(part => evaluateDQL(part, log));
  }
  
  // AND
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
  
  // NOT / negación con prefijo
  if (c.startsWith('NOT ')) {
    const sub = c.substring(4).trim();
    if (!sub) throw new Error('NOT requiere una condición');
    return !evaluateWazuhCondition(sub, log);
  }
  if (c.startsWith('-')) {
    const sub = c.substring(1).trim();
    if (!sub) throw new Error('"-" requiere una condición');
    return !evaluateWazuhCondition(sub, log);
  }
  
  // Comparadores numéricos
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
  
  // Valor exacto entre comillas
  m = c.match(/^([a-zA-Z_.]+)\s*:\s*"([^"]+)"$/);
  if (!m) m = c.match(/^([a-zA-Z_.]+)\s*:\s*'([^']+)'$/);
  if (m) {
    const val = getNested(log, m[1]);
    if (val === undefined) return false;
    const searchValue = m[2];
    return String(val).toLowerCase().includes(searchValue.toLowerCase());
  }
  
  // Wildcard *valor*
  m = c.match(/^([a-zA-Z_.]+)\s*:\s*\*([^*]+)\*$/);
  if (m) {
    const val = getNested(log, m[1]);
    if (val === undefined) return false;
    const searchValue = m[2];
    return String(val).toLowerCase().includes(searchValue.toLowerCase());
  }
  
  // Wildcard simple * (cualquier valor)
  m = c.match(/^([a-zA-Z_.]+)\s*:\s*\*$/);
  if (m) {
    const val = getNested(log, m[1]);
    if (val === undefined) return false;
    return true; // el campo existe
  }
  
  // Valor sin comillas (coincidencia parcial)
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
  throw new Error(`Sintaxis inválida: "${c}" — Debes especificar un campo (ej: agent.name:"FIN-DESK-22")`);
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

function renderSelectedFieldsList() {
  const selectedList = document.getElementById('selectedFieldsList');
  if (!TURN_STARTED || currentLogs.length === 0) {
    selectedList.innerHTML = `<div style="color:var(--muted-2);font-size:9.5px;padding:3px 4px;font-family:monospace;">Selecciona un caso y presiona "Iniciar turno"</div>`;
    return;
  }
  const allFields = Object.keys(getAggregations(currentLogs));
  selectedList.innerHTML = '';
  selectedFields.forEach(field => {
    if (!allFields.includes(field) && field !== 'timestamp') return;
    const div = document.createElement('div');
    div.className = 'field-item selected-field';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'field-name';
    nameSpan.textContent = field;
    const actionsSpan = document.createElement('span');
    actionsSpan.className = 'field-actions';
    const btn = document.createElement('button');
    btn.className = 'remove-btn';
    btn.textContent = '−';
    btn.title = 'Quitar de seleccionados';
    btn.addEventListener('click', () => toggleField(field, false));
    actionsSpan.appendChild(btn);
    div.appendChild(nameSpan);
    div.appendChild(actionsSpan);
    selectedList.appendChild(div);
  });
  if (selectedFields.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--muted-2);font-size:9.5px;padding:3px 4px;font-family:monospace;';
    empty.textContent = 'Ningún campo seleccionado';
    selectedList.appendChild(empty);
  }
}

function renderFilters(logs) {
  const container = document.getElementById('fieldsContainer');
  container.innerHTML = '';
  if (!TURN_STARTED || logs.length === 0) {
    container.innerHTML = `<div style="color:var(--muted-2);font-size:9.5px;padding:3px 4px;font-family:monospace;">Selecciona un caso y presiona "Iniciar turno"</div>`;
    return;
  }
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
  const priorityFields = ['timestamp', 'agent.name', 'data.win.system.eventID', 'data.win.eventdata.image', 'rule.level', 'rule.description'];
  const sortedFields = Object.keys(agg).sort((a, b) => {
    const aPriority = priorityFields.includes(a) ? 0 : 1;
    const bPriority = priorityFields.includes(b) ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.localeCompare(b);
  });
  sortedFields.forEach(field => {
    const vals = agg[field] || {};
    const keys = Object.keys(vals).sort((a, b) => vals[b] - vals[a]);
    if (keys.length === 0) return;
    if (selectedFields.includes(field)) return;
    const block = document.createElement('div');
    block.className = 'field-block';
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
    toggleBtn.style.cssText = 'color:var(--muted-2); font-size:12px; font-weight:bold; padding:0 6px; cursor:pointer;';
    toggleBtn.textContent = '+';
    toggleBtn.title = 'Agregar a la tabla';
    head.appendChild(fchev);
    head.appendChild(nameSpan);
    head.appendChild(toggleBtn);
    head.onclick = (e) => {
      if (e.target === toggleBtn) return;
      block.classList.toggle('open');
    };
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleField(field, true);
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
      el.appendChild(span);
      el.appendChild(countSpan);
      el.addEventListener('click', () => {
        const input = document.getElementById('queryInput');
        const current = input.value.trim();
        const isNumeric = /^\d+$/.test(key);
        const newPart = isNumeric ? `${field}:${key}` : `${field}:"${key}"`;
        input.value = current ? `${current} AND ${newPart}` : newPart;
        runQuery();
      });
      valuesBox.appendChild(el);
    });
    block.appendChild(valuesBox);
    container.appendChild(block);
  });
  if (container.children.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:var(--muted-2);font-size:9.5px;padding:8px 6px;font-family:monospace;text-align:center;';
    empty.textContent = 'Todos los campos están seleccionados';
    container.appendChild(empty);
  }
}

// ============================================================
// RENDER TABLA
// ============================================================
function renderTable(logs) {
  const thead = document.getElementById('tableHead');
  const tbody = document.getElementById('tableBody');
  
  if (!TURN_STARTED || logs.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Presiona "Iniciar turno" para ver los logs</td></tr>';
    document.getElementById('statTotal').textContent = '0';
    document.getElementById('statMatch').textContent = '0';
    document.getElementById('statNoise').textContent = '0';
    return;
  }
  
  const columns = selectedFields;
  let headerHtml = '<tr><th style="width:22px;"></th>';
  columns.forEach(col => {
    const display = col === 'timestamp' ? 'Time' : col;
    headerHtml += `<th>${display}</th>`;
  });
  headerHtml += '</tr>';
  thead.innerHTML = headerHtml;
  
  tbody.innerHTML = '';
  logs.forEach(log => {
    const tr = document.createElement('tr');
    tr.className = 'log-row' + (expandedId === log.id ? ' expanded' : '');
    let rowHtml = `<td><span class="chev">▸</span></td>`;
    columns.forEach(col => {
      let val = getNested(log, col);
      if (val === undefined || val === null) val = '-';
      if (typeof val === 'object') val = JSON.stringify(val);
      if (col === 'timestamp') {
        val = String(val).replace('T', ' ').slice(0, 19);
      }
      rowHtml += `<td title="${escapeHtml(String(val))}">${escapeHtml(String(val).slice(0, 60))}</td>`;
    });
    tr.innerHTML = rowHtml;
    tr.onclick = () => { expandedId = (expandedId === log.id) ? null : log.id; renderTable(currentLogs); };
    tbody.appendChild(tr);
    
    if (expandedId === log.id) {
      const dtr = document.createElement('tr');
      dtr.className = 'detail-row';
      const flat = flattenObject(log);
      let detailHtml = Object.keys(flat).sort().map(k => 
        `<div><span style="color:var(--muted-2);">${escapeHtml(k)}</span>: ${escapeHtml(String(flat[k]).slice(0, 80))}</div>`
      ).join('');
      dtr.innerHTML = `<td colspan="${columns.length+1}">
        <div class="detail-inner"><div class="detail-fields">${detailHtml}</div></div>
      </td>`;
      tbody.appendChild(dtr);
    }
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
  document.getElementById('scenarioEyebrow').textContent = `Caso ${String(idx).padStart(2,'0')}`;
  document.getElementById('scenarioTitle').textContent = currentChallenge.title;
  document.getElementById('contextText').textContent = currentChallenge.context || '';
  document.getElementById('scenarioText').textContent = currentChallenge.text || '';
  document.getElementById('hintBadge').textContent = currentChallenge.hint || '💡 Usa filtros DQL';
}

// ============================================================
// RENDER DE LISTA DE CASOS (filtra por dificultad)
// ============================================================
function renderChallenges() {
  const box = document.getElementById('challengeList');
  box.innerHTML = '';
  
  const filtered = casos.filter(c => c.difficulty.toLowerCase() === selectedDifficulty.toLowerCase());
  
  filtered.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'challenge-btn' + (c.id === currentChallenge?.id ? ' active' : '') + (solved.has(c.id) ? ' solved' : '');
    btn.innerHTML = `<span class="cnum">${c.id}</span> ${c.title}`;
    btn.onclick = () => selectCase(c);
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
// PREGUNTAS
// ============================================================
function renderQuestions() {
  const container = document.getElementById('questionsContainer');
  const progress = document.getElementById('questionsProgress');
  const badge = document.getElementById('questionsBadge');
  if (!currentCaseData || !currentCaseData.questions || currentCaseData.questions.length === 0) {
    container.innerHTML = '<p style="color:var(--muted-2);">Este caso no tiene preguntas.</p>';
    progress.textContent = 'Progreso: 0/0';
    badge.textContent = '0';
    return;
  }
  const questions = currentCaseData.questions;
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
    html += `
      <div class="question-item" data-qidx="${idx}">
        <div class="q-text">
          ${q.text}
          <span class="q-status ${state.correct ? 'correct' : (state.answered ? 'wrong' : '')}">${statusIcon}</span>
        </div>
        <div class="q-input-row">
          <input type="text" id="qinput_${caseId}_${idx}" placeholder="Escribe tu respuesta..." class="${inputClass}" ${inputDisabled}>
          <button class="verify-btn" data-case="${caseNum}" data-qidx="${idx}" ${inputDisabled}>Verificar</button>
        </div>
        <div class="q-hint">Formato: ${maskedAccepted}</div>
        <div class="q-feedback ${feedbackClass}">${feedbackText}</div>
      </div>
    `;
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
  container.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const parent = e.target.closest('.question-item');
        const btn = parent?.querySelector('.verify-btn');
        if (btn && !btn.disabled) btn.click();
      }
    });
  });
}

function verifyAnswer(caseNum, qidx) {
  if (!currentChallenge || !currentCaseData) return;
  const questions = currentCaseData.questions;
  if (qidx >= questions.length) return;
  const q = questions[qidx];
  const input = document.getElementById(`qinput_${currentChallenge.id}_${qidx}`);
  if (!input || input.disabled) return;
  const key = `${caseNum}-${qidx}`;
  const validation = window.VALIDATION_CONFIG?.[key];
  const correctAnswer = validation?.answer || q.answer;
  const acceptable = validation?.acceptable || q.acceptable || [];
  const allValid = [correctAnswer, ...acceptable].map(a => a.trim().toLowerCase());
  const userAns = input.value.trim().toLowerCase();
  const isCorrect = allValid.includes(userAns);
  if (!questionStates[currentChallenge.id]) {
    questionStates[currentChallenge.id] = questions.map(() => ({ answered: false, correct: false }));
  }
  const state = questionStates[currentChallenge.id][qidx];
  state.answered = true;
  state.correct = isCorrect;
  if (isCorrect) {
    input.disabled = true;
    input.classList.add('correct');
    const btn = input.closest('.q-input-row').querySelector('.verify-btn');
    if (btn) btn.disabled = true;
    const feedback = input.closest('.question-item').querySelector('.q-feedback');
    if (feedback) { feedback.textContent = '✅ Correcto!'; feedback.className = 'q-feedback correct'; }
  } else {
    input.classList.add('wrong');
    const feedback = input.closest('.question-item').querySelector('.q-feedback');
    if (feedback) { feedback.textContent = '❌ Incorrecto. Intenta de nuevo.'; feedback.className = 'q-feedback wrong'; }
  }
  renderQuestions();
  checkCaseSolved();
}

// ============================================================
// CHECK CASE SOLVED (usa currentCaseLogs)
// ============================================================
function checkCaseSolved() {
  if (!currentChallenge || !currentCaseData) return;
  const questions = currentCaseData.questions;
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
// PANEL DE PREGUNTAS (toggle con clases)
// ============================================================
function toggleQuestionsPanel(open) {
  const shell = document.getElementById('appShell');
  const btn = document.getElementById('questionsToggleBtn');
  if (open) {
    shell.classList.add('with-questions');
    btn.classList.add('active');
  } else {
    shell.classList.remove('with-questions');
    btn.classList.remove('active');
  }
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

// Toggle preguntas
document.getElementById('questionsToggleBtn').addEventListener('click', function() {
  const isOpen = document.getElementById('appShell').classList.contains('with-questions');
  toggleQuestionsPanel(!isOpen);
});
document.getElementById('questionsCloseBtn').addEventListener('click', function() {
  toggleQuestionsPanel(false);
});

// Sidebar toggle
const toggleBtn = document.getElementById('sidebarToggle');
toggleBtn.addEventListener('click', () => {
  document.getElementById('appShell').classList.toggle('collapsed');
  toggleBtn.textContent = document.getElementById('appShell').classList.contains('collapsed') ? '▶' : '◀';
});

// Exponer funciones para los botones de stream (onclick en HTML)
window.pauseLogStream = pauseLogStream;
window.resumeLogStream = resumeLogStream;

// ============================================================
// INICIALIZACIÓN
// ============================================================
setupDifficultySelector();
loadIndex();