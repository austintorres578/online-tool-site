// =========================
// DOM refs (core)
// =========================
const dropArea          = document.getElementById('drop-area');
const fileInput         = document.getElementById('fileElem');
const previewContainer  = document.querySelector('.image-preview-con .image-previews');
const previewCon        = document.querySelector('.image-preview-con');
const compressorEl      = document.querySelector('.image-watermarker');   // hero/intro
const addMoreIcon       = document.getElementById('add-more-icon');

const addImgButton      = document.querySelector('.add-image-button');
const addTextButton     = document.querySelector('.add-text-button');

const wmSelect          = document.querySelector('.watermark-selection');
const btnUp             = document.getElementById('wmMoveUp');
const btnDown           = document.getElementById('wmMoveDown');
const btnRemoveOne      = document.getElementById('wmRemoveOne');
const btnRemoveAll      = document.getElementById('wmRemoveAll');

const stylePanel        = document.querySelector('.layer-styles');
const imgStyles         = document.querySelector('.layer-styles .image-styles');
const textStyles        = document.querySelector('.layer-styles .text-styles');

// Optional progress bits (kept for parity; not required for watermarker)
const loadingCon        = document.querySelector('.preview-loading-con');
const percentEl         = document.querySelector('.loading-percentage');
const progressEl        = document.querySelector('.loading-progress');
const progressStateEl   = document.querySelector('.progress-state');

// =========================
// API base + helpers (Render-safe)
// =========================

// Hardcode your Render backend (can be overridden by <meta name="backend-url" content="https://...">)
const PROD_BACKEND = 'https://online-tool-backend.onrender.com';

// Local dev default
const DEFAULT_BACKEND = 'http://localhost:3000';

// Allow override via meta tag
const META_BACKEND = document.querySelector('meta[name="backend-url"]')?.content?.trim();

// Heuristic: if page is served from localhost/127.*, use local backend, else use Render
const isLocalPage = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(window.location.origin);
const API_BASE = (META_BACKEND || (isLocalPage ? DEFAULT_BACKEND : PROD_BACKEND)).replace(/\/+$/, '');

const apiUrl = (p) => `${API_BASE}/${p.replace(/^\/+/, '')}`;

console.log('[watermarker] API_BASE =', API_BASE);

async function apiFetch(path, { retries = 1, ...init } = {}) {
  const url = apiUrl(path);
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const xdiag = res.headers.get('X-Diag');
        const allow = res.headers.get('Allow');
        let hint = '';
        if (res.status === 405 && allow) hint = ` (Allow: ${allow})`;
        if (xdiag) hint += `\nX-Diag: ${xdiag}`;
        throw new Error(`HTTP ${res.status} ${res.statusText}${hint}\n${text}`.trim());
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      throw lastErr;
    }
  }
}

// =========================
/** Scope control (Apply-to-all) */
// =========================
const applyAllCheckbox  = document.getElementById('apply-all');
// Stores detached live layer nodes per image when "apply to all" is OFF.
// Key: image filename; Value: DocumentFragment of .wm nodes (listeners preserved)
const layersByImage = new Map();

// =========================
// State
// =========================
let uploadedFiles = [];
let wmCounter = 0;

// =========================
/** Feature support */
// =========================
const SUPPORTS_TEXT_STROKE =
  (typeof CSS !== 'undefined' && (CSS.supports?.('-webkit-text-stroke: 1px #000') || CSS.supports?.('text-stroke: 1px #000')));

// =========================
/** Allowed types */
// =========================
const ALLOWED_EXTS  = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.bmp', '.avif']);
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/bmp', 'image/avif']);
const MAX_SIZE_BYTES = 50 * 1024 * 1024;

// =========================
/** Helpers */
// =========================

// --- Coachmark helper (fix for "showCoachmarkOnce is not defined") ---
if (typeof window.showCoachmarkOnce !== 'function') {
  window.showCoachmarkOnce = (() => {
    let shown = false;
    return function showCoachmarkOnce() {
      if (shown) return;
      shown = true;
      // Minimal unobtrusive tip (safe to remove if you want a pure no-op)
      const tip = document.createElement('div');
      tip.textContent = 'Tip: drag, resize, or click layers to edit.';
      Object.assign(tip.style, {
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        padding: '10px 12px',
        background: 'rgba(0,0,0,0.75)',
        color: '#fff',
        borderRadius: '8px',
        font: '13px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        zIndex: 99999,
        pointerEvents: 'none',
        boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
      });
      document.body.appendChild(tip);
      setTimeout(() => tip.remove(), 2200);
    };
  })();
}

function getExt(filename) {
  const m = (filename || '').toLowerCase().match(/\.[^.]+$/);
  return m ? m[0] : '';
}

function decodeImage(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(true); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
    img.src = url;
  });
}

function isBrowserRenderable(file) {
  const name = (file.name || '').toLowerCase();
  const isTiff =
    name.endsWith('.tif') ||
    name.endsWith('.tiff') ||
    file.type === 'image/tiff' ||
    file.type === 'image/x-tiff';
  return !isTiff;
}

function isAllowedFile(file) {
  const ext  = getExt(file.name);
  const mime = (file.type || '').toLowerCase();
  const extOk  = ALLOWED_EXTS.has(ext);
  const isTiffByExt = ext === '.tif' || ext === '.tiff';
  const mimeOk = !mime || ALLOWED_MIMES.has(mime) || isTiffByExt;
  return extOk && mimeOk;
}

function reasonForRejection(file) {
  if (!isAllowedFile(file)) {
    const ext  = getExt(file.name) || '(no ext)';
    const mime = (file.type || 'unknown').toLowerCase();
    return `Unsupported type (${ext} / ${mime}). Allowed: ${[...ALLOWED_EXTS].join(', ')}`;
  }
  if (MAX_SIZE_BYTES && file.size > MAX_SIZE_BYTES) {
    return `Larger than ${(MAX_SIZE_BYTES/1024/1024).toFixed(0)}MB`;
  }
  return null;
}

function softBreakFilename(filename, chunk = 12) {
  const dot  = filename.lastIndexOf('.');
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const ext  = dot > 0 ? filename.slice(dot)    : '';
  const ZWSP = '\u200B';
  const withDelims = base.replace(/([_\-.])/g, `$1${ZWSP}`);
  const withChunks = withDelims.replace(new RegExp(`(.{${chunk}})`, 'g'), `$1${ZWSP}`);
  return withChunks + ext;
}

function nextId(prefix) {
  wmCounter += 1;
  return `${prefix}-${wmCounter}`;
}

function renderPct(pct) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  if (percentEl) percentEl.textContent = `${clamped}%`;
  if (progressEl) progressEl.style.width = `${clamped}%`;
}
function setState(txt) { if (progressStateEl) progressStateEl.textContent = txt || ''; }

// =========================
// Canvas / preview helpers
// =========================
function canvasEl()    { return document.querySelector('.canvas'); }
function baseImgEl()   { return document.querySelector('.canvas .base-image'); }
function activePreviewItem() { return previewContainer?.querySelector('.image-preview-item.active') || null; }
function activeImageKey() {
  const act = activePreviewItem();
  if (act) return act.getAttribute('data-filename') || '';
  const b = baseImgEl();
  return (b?.dataset?.key) || '';
}

// Move current live .wm nodes out into a fragment (preserve listeners)
function detachAllLayersToFragment() {
  const cv = canvasEl(); if (!cv) return null;
  const frag = document.createDocumentFragment();
  [...cv.querySelectorAll('.wm')].forEach(n => frag.appendChild(n)); // moves nodes
  return frag;
}

// Attach a fragment (of .wm nodes) back into the canvas
function attachLayersFromFragment(frag) {
  const cv = canvasEl(); if (!cv || !frag) return;
  cv.appendChild(frag); // moves nodes back
}

// Rebuild the <select> from the current canvas layers
function rebuildSelectFromCanvas() {
  if (!wmSelect) return;
  while (wmSelect.options.length) wmSelect.remove(0);
  const layers = canvasEl()?.querySelectorAll('.wm') || [];
  layers.forEach((el) => {
    const fallback = el.classList.contains('text-water')
      ? `Text ${el.id.split('-')[1] || ''}`.trim()
      : `Image ${el.id.split('-')[1] || ''}`.trim();
    upsertOptionForLayer(el, fallback);
  });
  updateSelectSize();
  updateStylePanelForSelection();

  // ensure selected visual matches select
  const selEl = document.getElementById(wmSelect.value);
  if (selEl) {
    document.querySelectorAll('.canvas .wm.is-selected').forEach(n => n.classList.remove('is-selected'));
    selEl.classList.add('is-selected');
  }
}

// =========================
// Layers list helpers
// =========================
function findOptionByValue(select, value) {
  return Array.from(select.options).find(o => o.value === value) || null;
}

function getLayerLabel(el, fallback) {
  if (el.classList.contains('text-water')) {
    const txt = (el.innerText || '').trim();
    const ph  = (el.dataset && el.dataset.placeholder) || '';
    return (txt && txt !== ph) ? txt : fallback;
  }
  if (el.classList.contains('image-water')) {
    return el.dataset?.filename || fallback;
  }
  return fallback;
}

function updateSelectSize() {
  if (!wmSelect) return;
  const count = wmSelect.options.length;
  wmSelect.size = Math.min(8, Math.max(1, count || 0));
}

function syncZIndexFromSelect() {
  const BASE_Z = 100;
  for (let i = 0; i < wmSelect.options.length; i++) {
    const opt = wmSelect.options[i];
    const el = document.getElementById(opt.value);
    if (el) el.style.zIndex = String(BASE_Z + i);
  }
}

function upsertOptionForLayer(el, fallbackLabel) {
  if (!wmSelect || !el?.id) return;
  const label = getLayerLabel(el, fallbackLabel);
  let opt = findOptionByValue(wmSelect, el.id);
  if (!opt) {
    opt = document.createElement('option');
    opt.value = el.id;
    wmSelect.add(opt);
  }
  opt.textContent = label;
  wmSelect.value = el.id;
  syncZIndexFromSelect();
  updateSelectSize();
  updateStylePanelForSelection();
}

// ---------- Visual affordances ----------
function ensureHandles(wm) {
  if (!wm) return;
  if (wm.querySelector('.wm-handle')) return; // already added
  const mk = (cls) => { const h = document.createElement('i'); h.className = `wm-handle ${cls}`; return h; };
  wm.append(mk('tl'), mk('tr'), mk('bl'), mk('br'), mk('tm'), mk('bm'), mk('ml'), mk('mr'));
}

function selectLayer(el) {
  if (!wmSelect || !el?.id) return;
  for (let i = 0; i < wmSelect.options.length; i++) {
    if (wmSelect.options[i].value === el.id) {
      wmSelect.selectedIndex = i;
      break;
    }
  }
  // visible selection state + handles
  document.querySelectorAll('.canvas .wm.is-selected').forEach(n => n.classList.remove('is-selected'));
  el.classList.add('is-selected');
  ensureHandles(el);

  // subtle pulse if you add CSS for it
  el.classList.add('wm-pulse');
  setTimeout(() => el.classList.remove('wm-pulse'), 400);

  updateStylePanelForSelection();
}

wmSelect?.addEventListener('change', () => {
  const el = document.getElementById(wmSelect.value);
  if (el) selectLayer(el);
  syncZIndexFromSelect();
  updateStylePanelForSelection();
});

btnUp?.addEventListener('click', () => {
  const i = wmSelect.selectedIndex;
  if (i > 0) {
    const opt = wmSelect.options[i];
    wmSelect.remove(i);
    wmSelect.add(opt, i - 1);
    wmSelect.selectedIndex = i - 1;
    syncZIndexFromSelect();
    updateStylePanelForSelection();
  }
});

btnDown?.addEventListener('click', () => {
  const i = wmSelect.selectedIndex;
  if (i >= 0 && i < wmSelect.options.length - 1) {
    const opt = wmSelect.options[i];
    wmSelect.remove(i);
    wmSelect.add(opt, i + 1);
    wmSelect.selectedIndex = i + 1;
    syncZIndexFromSelect();
    updateStylePanelForSelection();
  }
});

btnRemoveOne?.addEventListener('click', () => removeSelectedLayer());
btnRemoveAll?.addEventListener('click', () => removeAllLayersOnly());

wmSelect?.addEventListener('keydown', (e) => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    removeSelectedLayer({ confirmPrompt: false });
  }
});

function removeSelectedLayer({ confirmPrompt = true } = {}) {
  if (!wmSelect) return;
  const idx = wmSelect.selectedIndex;
  if (idx < 0) return;
  const opt = wmSelect.options[idx];
  const label = opt.textContent || opt.value;
  if (confirmPrompt && !window.confirm(`Remove layer "${label}"?`)) return;

  const node = document.getElementById(opt.value);
  node?.remove();
  wmSelect.remove(idx);
  if (wmSelect.options.length > 0) {
    wmSelect.selectedIndex = Math.min(idx, wmSelect.options.length - 1);
    const el = document.getElementById(wmSelect.value);
    if (el) selectLayer(el);
  } else {
    document.querySelectorAll('.canvas .wm.is-selected').forEach(n => n.classList.remove('is-selected'));
  }
  syncZIndexFromSelect();
  updateSelectSize();
  updateStylePanelForSelection();
}

function removeAllLayersOnly({ confirmPrompt = true } = {}) {
  const canvas = canvasEl();
  if (!wmSelect || !canvas) return;
  if (confirmPrompt && !window.confirm('Remove ALL watermark layers?')) return;
  canvas.querySelectorAll('.wm').forEach(el => el.remove());
  while (wmSelect.options.length > 0) wmSelect.remove(0);
  document.querySelectorAll('.canvas .wm.is-selected').forEach(n => n.classList.remove('is-selected'));
  syncZIndexFromSelect();
  updateSelectSize();
  updateStylePanelForSelection();
}

// =========================
// Style Controls (Refs)
// =========================
const I = {
  op:       document.getElementById('is-opacity'),
  opVal:    document.getElementById('is-opacity-val'),
  blend:    document.getElementById('is-blend'),
  bright:   document.getElementById('is-brightness'),
  brightVal:document.getElementById('is-brightness-val'),
  contrast: document.getElementById('is-contrast'),
  contrastVal:document.getElementById('is-contrast-val'),
  saturate: document.getElementById('is-saturate'),
  saturateVal:document.getElementById('is-saturate-val'),
  gray:     document.getElementById('is-grayscale'),
  grayVal:  document.getElementById('is-grayscale-val'),
  blur:     document.getElementById('is-blur'),
  blurVal:  document.getElementById('is-blur-val'),
  radius:   document.getElementById('is-radius'),
  radiusVal:document.getElementById('is-radius-val'),
  borderOn: document.getElementById('is-border-on'),
  borderW:  document.getElementById('is-border-width'),
  borderWVal:document.getElementById('is-border-width-val'),
  borderC:  document.getElementById('is-border-color')
};

const T = {
  fam:     document.getElementById('ts-font-family'),
  wgt:     document.getElementById('ts-font-weight'),
  ita:     document.getElementById('ts-italic'),
  let:     document.getElementById('ts-letter'),
  word:    document.getElementById('ts-word'),
  lh:      document.getElementById('ts-lineheight'),
  lock:    document.getElementById('ts-lockbox'),
  size:    document.getElementById('ts-fontsize'),
  color:   document.getElementById('ts-color'),
  op:      document.getElementById('ts-opacity'),
  opVal:   document.getElementById('ts-opacity-val'),
  blend:   document.getElementById('ts-blend'),
  strokeOn:document.getElementById('ts-stroke-enabled'),
  strokeW: document.getElementById('ts-stroke-width'),
  strokeWVal:document.getElementById('ts-stroke-width-val'),
  strokeC: document.getElementById('ts-stroke-color')
};

// =========================
// Base Defaults + Reset
// =========================
const TEXT_BASE = {
  fam: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  wgt: "400",
  ita: false,
  letter: 0,
  word: 0,
  lineHeight: 1.1,
  lock: true,
  size: 32,
  color: "#000000",
  opacity: 100,
  blend: "normal",
  strokeOn: false,
  strokeW: 2,
  strokeC: "#ffffff",
};

const IMAGE_BASE = {
  opacity: 100,
  blend: "normal",
  brightness: 100,
  contrast: 100,
  saturate: 100,
  grayscale: 0,
  blur: 0,
  radius: 0,
  borderOn: false,
  borderW: 0,
  borderC: "#ffffff",
};

function resetTextControlsToBase() {
  if (!T.fam) return;
  T.fam.value = TEXT_BASE.fam;
  T.wgt.value = TEXT_BASE.wgt;
  T.ita.checked = TEXT_BASE.ita;
  T.let.value = TEXT_BASE.letter;
  T.word.value = TEXT_BASE.word;
  T.lh.value = TEXT_BASE.lineHeight;
  T.lock.checked = TEXT_BASE.lock;
  T.size.value = TEXT_BASE.size;
  T.size.disabled = TEXT_BASE.lock;
  T.color.value = TEXT_BASE.color;
  T.op.value = TEXT_BASE.opacity; T.opVal.textContent = TEXT_BASE.opacity;
  T.blend.value = TEXT_BASE.blend;
  T.strokeOn.checked = TEXT_BASE.strokeOn;
  T.strokeW.value = TEXT_BASE.strokeW; T.strokeWVal.textContent = TEXT_BASE.strokeW;
  T.strokeC.value = TEXT_BASE.strokeC;
}

function resetImageControlsToBase() {
  if (!I.op) return;
  I.op.value = IMAGE_BASE.opacity; I.opVal.textContent = IMAGE_BASE.opacity;
  I.blend.value = IMAGE_BASE.blend;

  I.bright.value = IMAGE_BASE.brightness; I.brightVal.textContent = IMAGE_BASE.brightness;
  I.contrast.value = IMAGE_BASE.contrast; I.contrastVal.textContent = IMAGE_BASE.contrast;
  I.saturate.value = IMAGE_BASE.saturate; I.saturateVal.textContent = IMAGE_BASE.saturate;
  I.gray.value = IMAGE_BASE.grayscale; I.grayVal.textContent = IMAGE_BASE.grayscale;
  I.blur.value = IMAGE_BASE.blur; I.blurVal.textContent = IMAGE_BASE.blur;

  I.radius.value = IMAGE_BASE.radius; I.radiusVal.textContent = IMAGE_BASE.radius;

  I.borderOn.checked = IMAGE_BASE.borderOn;
  I.borderW.value = IMAGE_BASE.borderW; I.borderWVal.textContent = IMAGE_BASE.borderW;
  I.borderC.value = IMAGE_BASE.borderC;
}

// =========================
/** Measuring helper to keep size stable across font-family changes */
// =========================
let _measureNode;
function ensureMeasureNode() {
  if (_measureNode) return _measureNode;
  _measureNode = document.createElement('span');
  _measureNode.style.position = 'absolute';
  _measureNode.style.left = '-99999px';
  _measureNode.style.top = '0';
  _measureNode.style.whiteSpace = 'nowrap';
  _measureNode.style.pointerEvents = 'none';
  _measureNode.style.visibility = 'hidden';
  document.body.appendChild(_measureNode);
  return _measureNode;
}

function measureTextWidthSample({
  text,
  fontFamily,
  fontWeight,
  fontStyle,
  fontSize,
  letterSpacing = 0,
  wordSpacing = 0,
}) {
  const node = ensureMeasureNode();
  node.textContent = text || '';
  node.style.fontFamily = fontFamily || TEXT_BASE.fam;
  node.style.fontWeight = fontWeight || TEXT_BASE.wgt;
  node.style.fontStyle  = fontStyle  || (TEXT_BASE.ita ? 'italic' : 'normal');
  node.style.fontSize   = `${Math.max(1, fontSize || 12)}px`;
  node.style.letterSpacing = `${Number(letterSpacing || 0)}em`;
  node.style.wordSpacing   = `${Number(wordSpacing || 0)}em`;
  const rect = node.getBoundingClientRect();
  return rect.width || 0;
}

// Quick overflow ratio helper (>1 means overflow)
function overflowRatio(el) {
  if (!el) return 1;
  const wRatio = el.scrollWidth  / Math.max(1, el.clientWidth);
  const hRatio = el.scrollHeight / Math.max(1, el.clientHeight);
  return Math.max(wRatio, hRatio);
}

// =========================
// Seed a sane font size when (re)enabling auto-fit
// =========================
function seedFontSizeForLock(layer, { min = 12, max = 128 } = {}) {
  const boxH = layer.clientHeight || 60;
  const seedPx = Math.max(min, Math.min(max, Math.round(boxH * 0.6)));
  const cs = getComputedStyle(layer);
  const currentPx = parseFloat(cs.fontSize) || seedPx;
  const px = Math.max(min, Math.min(max, Math.max(seedPx, currentPx)));
  layer.style.fontSize = px + 'px';
}

// =========================
// Text sizing helper for lock-to-box (default min raised to 18)
// =========================
function fitTextToBox(el, { min = 18, max = 96 } = {}) {
  const boxW = el.clientWidth, boxH = el.clientHeight;
  if (!boxW || !boxH) return;

  const cs = getComputedStyle(el);
  const currentPx = parseFloat(cs.fontSize) || 32;

  const prevWhiteSpace = el.style.whiteSpace;
  const prevOverflow = el.style.overflow;
  const prevTextOverflow = el.style.textOverflow;
  el.style.whiteSpace = 'nowrap';
  el.style.overflow = 'hidden';
  el.style.textOverflow = 'ellipsis';

  const overflowsAt = (px) => {
    el.style.fontSize = px + 'px';
    // Force layout
    // eslint-disable-next-line no-unused-expressions
    el.offsetWidth;
    return (el.scrollWidth > boxW) || (el.scrollHeight > boxH);
  };

  let lo, hi, best;

  if (!overflowsAt(currentPx)) {
    lo = Math.max(min, currentPx);
    hi = Math.max(lo, max);
    best = lo;
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2;
      if (overflowsAt(mid)) {
        hi = mid - 0.5;
      } else {
        best = mid;
        lo = mid + 0.5;
      }
    }
  } else {
    lo = Math.max(min, 6);
    hi = Math.min(max, currentPx);
    best = lo;
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2;
      if (overflowsAt(mid)) {
        hi = mid - 0.5;
      } else {
        best = mid;
        lo = mid + 0.5;
      }
    }
  }

  el.style.fontSize = Math.max(min, Math.min(max, best)) + 'px';

  el.style.whiteSpace = prevWhiteSpace;
  el.style.overflow = prevOverflow;
  el.style.textOverflow = prevTextOverflow;

  el.style.lineHeight = '1.1';
}

// =========================
// APPLY: Text styles (NEVER-SHRINK on family change)
// =========================
function applyTextStylesTo(layer) {
  if (!layer || !layer.classList.contains('text-water')) return;

  const cs = getComputedStyle(layer);
  const beforeFam = layer.dataset.lastFam || cs.fontFamily || T.fam.value;

  const targetFam   = T.fam.value;
  const targetWgt   = T.wgt.value;
  const targetStyle = T.ita.checked ? 'italic' : 'normal';

  // Prevent faux bold/italic when a weight/style isn’t available
  layer.style.fontSynthesis = 'none';

  const familyChanged = (beforeFam.trim() !== targetFam.trim());
  let didPreScale = false;

  if (T.lock.checked && familyChanged) {
    const text = (layer.innerText || '').trim();
    if (text) {
      const currentPx = parseFloat(cs.fontSize) || 32;

      const wOld = measureTextWidthSample({
        text, fontFamily: beforeFam, fontWeight: targetWgt, fontStyle: targetStyle,
        fontSize: currentPx, letterSpacing: Number(T.let.value || 0), wordSpacing: Number(T.word.value || 0),
      });
      const wNew = measureTextWidthSample({
        text, fontFamily: targetFam, fontWeight: targetWgt, fontStyle: targetStyle,
        fontSize: currentPx, letterSpacing: Number(T.let.value || 0), wordSpacing: Number(T.word.value || 0),
      });

      if (wOld > 0 && wNew > 0) {
        const strokeOn = !!T.strokeOn.checked;
        const sw = Number(T.strokeW.value || 0);
        const strokePad = strokeOn && sw > 0 ? sw * 2 : 0;
        const ratio = (wOld + strokePad) / (wNew + strokePad);

        let scaledPx = ratio > 1 ? currentPx * ratio : currentPx; // never shrink
        scaledPx = Math.max(6, Math.min(512, scaledPx));

        layer.style.fontFamily = targetFam;
        layer.style.fontWeight = targetWgt;
        layer.style.fontStyle  = targetStyle;
        layer.style.fontSize   = `${scaledPx}px`;
        didPreScale = true;
      }
    }
  }

  // Apply common text styles
  layer.style.fontFamily    = targetFam;
  layer.style.fontWeight    = targetWgt;
  layer.style.fontStyle     = targetStyle;
  layer.style.letterSpacing = `${Number(T.let.value || 0)}em`;
  layer.style.wordSpacing   = `${Number(T.word.value || 0)}em`;
  layer.style.lineHeight    = String(Number(T.lh.value || 1.1));

  const fill = T.color.value || '#000000';
  layer.style.color = fill;
  layer.style.webkitTextFillColor = fill;

  layer.style.opacity       = String((Number(T.op.value || 100))/100);
  layer.style.mixBlendMode  = T.blend.value || 'normal';

  const strokeOn = !!T.strokeOn.checked;
  const sw = Number(T.strokeW.value || 0);
  const sc = T.strokeC.value || '#ffffff';

  if (strokeOn && sw > 0) {
    if (SUPPORTS_TEXT_STROKE) {
      layer.style.webkitTextStroke = `${sw}px ${sc}`;
      layer.style.textShadow = 'none';
    } else {
      layer.style.webkitTextStroke = '0px transparent';
      const s = sw;
      layer.style.textShadow =
        `-${s}px 0 0 ${sc}, ${s}px 0 0 ${sc}, 0 -${s}px 0 ${sc}, 0 ${s}px 0 ${sc}, ` +
        `-${s}px -${s}px 0 ${sc}, ${s}px -${s}px 0 ${sc}, -${s}px ${s}px 0 ${sc}, ${s}px ${s}px 0 ${sc}`;
    }
  } else {
    layer.style.webkitTextStroke = '0px transparent';
    layer.style.textShadow = 'none';
  }

  if (T.lock.checked) {
    layer.dataset.locked = '1';
    if (didPreScale) {
      if (overflowRatio(layer) > 1.2) fitTextToBox(layer);
    } else {
      fitTextToBox(layer);
    }
  } else {
    layer.dataset.locked = '0';
    const px = Math.max(6, Math.min(512, Number(T.size.value || 32)));
    layer.style.fontSize = `${px}px`;
  }

  layer.dataset.lastFam = targetFam;
}

// =========================
/** APPLY: Image styles */
// =========================
function imageFilterString() {
  const b = Number(I.bright?.value ?? IMAGE_BASE.brightness);
  const c = Number(I.contrast?.value ?? IMAGE_BASE.contrast);
  const s = Number(I.saturate?.value ?? IMAGE_BASE.saturate);
  const g = Number(I.gray?.value ?? IMAGE_BASE.grayscale);
  const bl = Number(I.blur?.value ?? IMAGE_BASE.blur);

  const isBase = (b === IMAGE_BASE.brightness) &&
                 (c === IMAGE_BASE.contrast)   &&
                 (s === IMAGE_BASE.saturate)   &&
                 (g === IMAGE_BASE.grayscale)  &&
                 (bl === IMAGE_BASE.blur);

  if (isBase) return 'none';
  return `brightness(${b}%) contrast(${c}%) saturate(${s}%) grayscale(${g}%) blur(${bl}px)`;
}

function applyImageStylesTo(layerDiv){
  if(!layerDiv || !layerDiv.classList.contains('image-water')) return;
  const img = layerDiv.querySelector('img'); if(!img) return;

  // Apply blend + opacity to the wrapper
  const op = Number(I.op?.value ?? IMAGE_BASE.opacity);
  layerDiv.style.mixBlendMode = I.blend?.value || IMAGE_BASE.blend;
  layerDiv.style.opacity      = op/100;

  // Filters/border/rounding on the bitmap
  img.style.filter = imageFilterString();

  const radius = Number(I.radius?.value ?? IMAGE_BASE.radius);
  img.style.borderRadius = `${radius}%`;

  const borderOn = !!I.borderOn?.checked;
  const borderW  = Number(I.borderW?.value ?? IMAGE_BASE.borderW);
  const borderC  = I.borderC?.value || IMAGE_BASE.borderC;
  img.style.boxShadow = (borderOn && borderW > 0) ? `0 0 0 ${borderW}px ${borderC}` : 'none';
}

function populateImageControlsFrom(layerDiv){
  const img = layerDiv.querySelector('img'); if(!img) return;

  // Read blend/opacity from the wrapper (.wm)
  const csLayer = getComputedStyle(layerDiv);
  I.op.value = Math.round((parseFloat(csLayer.opacity)||1)*100);
  I.opVal.textContent=I.op.value;
  I.blend.value = layerDiv.style.mixBlendMode || csLayer.mixBlendMode || IMAGE_BASE.blend;

  // Read/parse filters etc from the inner <img>
  const cs = getComputedStyle(img);
  const f = (img.style.filter || cs.filter || 'none').trim();

  if (f === 'none' || f === '') {
    I.bright.value = IMAGE_BASE.brightness; I.brightVal.textContent = I.bright.value;
    I.contrast.value = IMAGE_BASE.contrast; I.contrastVal.textContent = I.contrast.value;
    I.saturate.value = IMAGE_BASE.saturate; I.saturateVal.textContent = I.saturate.value;
    I.gray.value = IMAGE_BASE.grayscale; I.grayVal.textContent = I.gray.value;
    I.blur.value = IMAGE_BASE.blur; I.blurVal.textContent = I.blur.value;
  } else {
    const get = (name, def) => {
      const m = f.match(new RegExp(`${name}\\(([^)]+)\\)`, 'i'));
      if(!m) return def;
      const num = parseFloat(m[1]);
      return Number.isNaN(num) ? def : Math.round(num);
    };
    I.bright.value   = get('brightness', IMAGE_BASE.brightness);
    I.contrast.value = get('contrast',   IMAGE_BASE.contrast);
    I.saturate.value = get('saturate',   IMAGE_BASE.saturate);
    I.gray.value     = get('grayscale',  IMAGE_BASE.grayscale);
    const blurMatch  = f.match(/blur\(([^)]+)\)/i);
    I.blur.value     = blurMatch ? Math.round(parseFloat(blurMatch[1])) : IMAGE_BASE.blur;

    I.brightVal.textContent=I.bright.value;
    I.contrastVal.textContent=I.contrast.value;
    I.saturateVal.textContent=I.saturate.value;
    I.grayVal.textContent=I.gray.value;
    I.blurVal.textContent=I.blur.value;
  }

  const br = parseInt(cs.borderRadius) || 0;
  I.radius.value = br; I.radiusVal.textContent = br;

  if(img.style.boxShadow && img.style.boxShadow !== 'none'){
    const widthMatch = img.style.boxShadow.match(/0 0 0 (\d+)px/i);
    const colorMatch = img.style.boxShadow.match(/(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})$/);
    I.borderOn.checked = true;
    I.borderW.value = widthMatch ? parseInt(widthMatch[1]) : IMAGE_BASE.borderW;
    I.borderC.value = colorMatch ? colorMatch[1] : IMAGE_BASE.borderC;
  } else {
    I.borderOn.checked=false; I.borderW.value=IMAGE_BASE.borderW; I.borderC.value=IMAGE_BASE.borderC;
  }
  I.borderWVal.textContent = I.borderW.value;
}

// =========================
// Toggle style panel by selection type
// =========================
function updateStylePanelForSelection() {
  if (!stylePanel) return;
  const id = wmSelect?.value;
  const el = id ? document.getElementById(id) : null;

  if (!el) {
    stylePanel.style.display = 'none';
    return;
  }

  stylePanel.style.display = '';
  if (el.classList.contains('text-water')) {
    textStyles.style.display = '';
    imgStyles.style.display = 'none';
    if (typeof populateTextControlsFrom === 'function') {
      populateTextControlsFrom(el);
    }
  } else if (el.classList.contains('image-water')) {
    imgStyles.style.display = '';
    textStyles.style.display = 'none';
    populateImageControlsFrom(el);
  } else {
    stylePanel.style.display = 'none';
  }
}

// =========================
/** Scope switching (Apply-to-all) */
// =========================
function setActivePreview(newItem) {
  if (!newItem) return;
  const was = activePreviewItem();
  if (was === newItem) return;

  const keyPrev = activeImageKey(); // from current active
  // Save current layers if scoped per-image
  if (!applyAllCheckbox?.checked && keyPrev) {
    const frag = detachAllLayersToFragment();
    layersByImage.set(keyPrev, frag || document.createDocumentFragment());
  }

  // Switch active class
  was?.classList.remove('active');
  newItem.classList.add('active');

  // Update base image src + key
  const img = newItem.querySelector('img');
  const b = baseImgEl();
  if (img && b) {
    b.src = img.src;
    b.dataset.key = newItem.getAttribute('data-filename') || '';
  }

  // Restore layers for the new image if scoped per-image
  if (!applyAllCheckbox?.checked) {
    const keyNew = activeImageKey();
    const storedFrag = layersByImage.get(keyNew);
    if (storedFrag) {
      attachLayersFromFragment(storedFrag);
    }
    rebuildSelectFromCanvas();
  } else {
    updateStylePanelForSelection();
  }
}

applyAllCheckbox?.addEventListener('change', () => {
  const checked = !!applyAllCheckbox.checked;
  if (checked) {
    layersByImage.clear();
  } else {
    const key = activeImageKey();
    if (key && !layersByImage.has(key)) {
      const frag = detachAllLayersToFragment();
      if (frag) {
        layersByImage.set(key, frag);
        attachLayersFromFragment(frag);
      } else {
        layersByImage.set(key, document.createDocumentFragment());
      }
    }
  }
  rebuildSelectFromCanvas();
});

// =========================
// Create layers (Text / Image)
// =========================
function addTextToBaseImg() {
  const canvas = canvasEl();
  if (!canvas) return;

  const wm = document.createElement('div');
  wm.classList.add('wm', 'text-water');
  wm.id = nextId('text');

  // Start in edit mode + focus immediately so the user can type right away
  wm.contentEditable = 'true';
  wm.spellcheck = false;

  wm.textContent = 'Type text…';
  wm.dataset.placeholder = 'Type text…';
  wm.dataset.lastFam = T.fam?.value || TEXT_BASE.fam; // seed for first change
  wm.style.position = 'absolute';
  wm.style.top = '50%'; wm.style.left = '50%';
  wm.style.transform = 'translate(-50%,-50%)';
  wm.style.width = '200px';
  wm.style.height = '40px'; // smaller initial box

  wm.style.display = 'flex'; wm.style.alignItems = 'center'; wm.style.justifyContent = 'center';
  wm.style.userSelect = 'none';

  canvas.appendChild(wm);

  function refreshOptionLabel() {
    const opt = findOptionByValue(wmSelect, wm.id);
    if (!opt) return;
    const txt = (wm.innerText || '').trim();
    const ph  = wm.dataset.placeholder || '';
    opt.textContent = (txt && txt !== ph) ? txt : `Text ${wm.id.split('-')[1] || ''}`.trim();
  }

  wm.addEventListener('input', refreshOptionLabel);
  wm.addEventListener('blur', () => {
    if ((wm.innerText || '').trim() === '') wm.innerText = wm.dataset.placeholder || 'Type text…';
  });

  upsertOptionForLayer(wm, `Text ${wm.id.split('-')[1] || ''}`.trim());
  resetTextControlsToBase();
  applyTextStylesTo(wm);

  ensureHandles(wm);
  selectLayer(wm);
  showCoachmarkOnce?.();
}

function addImageToBaseImg() {
  const canvas = canvasEl();
  if (!canvas) return;

  const picker = document.createElement('input');
  picker.type = 'file'; picker.accept = 'image/*';

  picker.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const wm = document.createElement('div');
      wm.classList.add('wm', 'image-water');
      wm.id = nextId('image');
      wm.style.position = 'absolute';
      wm.style.top = '50%'; wm.style.left = '50%';
      wm.style.transform = 'translate(-50%,-50%)';
      wm.style.width = '200px'; wm.style.height = '120px';
      wm.style.userSelect = 'none';

      const img = document.createElement('img');
      img.src = ev.target.result;
      img.alt = 'Watermark';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';

      wm.appendChild(img);
      canvas.appendChild(wm);

      wm.dataset.filename = (file.name || '').split(/[/\\]/).pop();
      upsertOptionForLayer(wm, `Image ${wm.id.split('-')[1]}`);

      resetImageControlsToBase();
      applyImageStylesTo(wm);

      ensureHandles(wm);
      selectLayer(wm);
      showCoachmarkOnce?.();
    };
    reader.readAsDataURL(file);
  });

  picker.click();
}

// =========================
// Click on canvas to select
// =========================
document.querySelector('.canvas')?.addEventListener('click', (e) => {
  const wm = e.target.closest('.wm');
  if (wm) selectLayer(wm);
});

// =========================
// Interact.js (drag + resize) + cursor fixes
// =========================
let rafFitId = null;

// DRAGGABLE
interact('.wm').draggable({
  ignoreFrom: '[contenteditable="true"]:focus',
  inertia: true,
  listeners: {
    start(event){
      selectLayer(event.target);
      event.target.classList.add('is-selected');
      document.documentElement.style.cursor = 'grabbing';
    },
    move(event){
      const target = event.target;
      const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
      const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
      target.style.transform = `translate(${x}px, ${y}px)`;
      target.setAttribute('data-x', x);
      target.setAttribute('data-y', y);
      selectLayer(target);
    },
    end(){
      document.documentElement.style.cursor = '';
    }
  },
  modifiers: [
    interact.modifiers.restrictRect({ restriction: '.canvas', endOnly: false })
  ]
})
.styleCursor(true);

// RESIZABLE
interact('.wm').resizable({
  edges: { left: true, right: true, top: true, bottom: true },
  margin: 12,
  inertia: true,
  listeners: {
    start(ev){
      selectLayer(ev.target);
      document.documentElement.style.cursor = 'nwse-resize';
    },
    move (event) {
      const t = event.target;
      const { width, height } = event.rect;
      t.style.width  = width + 'px';
      t.style.height = height + 'px';
      t.setAttribute('data-w', width);
      t.setAttribute('data-h', height);

      if (t.classList.contains('text-water') && (T.lock?.checked)) {
        if (!rafFitId) {
          rafFitId = requestAnimationFrame(() => {
            rafFitId = null;
            fitTextToBox(t, { min: 18, max: 512 });
          });
        }
      }
    },
    end(ev){
      document.documentElement.style.cursor = '';
      const t = ev.target;
      // Fit once when resize ends (locked text only), and skip tiny boxes
      if (t.classList.contains('text-water') && (T.lock?.checked)) {
        if ((t.clientHeight || 0) >= 24) {
          fitTextToBox(t, { min: 18, max: 512 });
        }
      }
    }
  },
  modifiers: [
    interact.modifiers.restrictEdges({ outer: '.canvas' }),
    interact.modifiers.restrictSize({ min: { width: 60, height: 30 } })
  ]
})
.styleCursor(true);

window.addEventListener('pointerup', () => { document.documentElement.style.cursor = ''; });

// =========================
// Upload / previews
// =========================
addMoreIcon?.addEventListener('click', () => fileInput?.click());

['dragenter', 'dragover'].forEach(evtName => {
  dropArea?.addEventListener(evtName, (e) => {
    e.preventDefault();
    dropArea.classList.add('dragover');
  });
});
['dragleave', 'drop'].forEach(evtName => {
  dropArea?.addEventListener(evtName, () => dropArea.classList.remove('dragover'));
});

dropArea?.addEventListener('drop', async (e) => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files || []);
  await acceptFiles(files);
});
fileInput?.addEventListener('change', async () => {
  const files = Array.from(fileInput.files || []);
  await acceptFiles(files);
  fileInput.value = '';
});

async function acceptFiles(files) {
  if (loadingCon) loadingCon.style.display = 'flex';
  if (previewCon) previewCon.style.display = 'none';
  if (compressorEl) compressorEl.style.display = 'none';

  const batch = Array.from(files || []);
  let acceptedAny = false;

  for (const file of batch) {
    const rejectReason = reasonForRejection(file);
    if (rejectReason) { alert(`"${file.name}" was rejected: ${rejectReason}`); continue; }

    let ok = true;
    if (isBrowserRenderable(file)) ok = await decodeImage(file);
    if (!ok) { alert(`"${file.name}" is broken or corrupted and cannot be used.`); continue; }

    uploadedFiles.push(file);
    await buildPreview(file);
    acceptedAny = true;
  }

  if (loadingCon) loadingCon.style.display = 'none';
  if (acceptedAny) {
    if (compressorEl) compressorEl.style.display = 'none';
    if (previewCon) previewCon.style.display = 'flex';
  } else {
    resetWatermarkerUI();
  }
}

function buildPreview(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const container = document.createElement('div');
      container.classList.add('image-preview-item');
      container.setAttribute('data-filename', file.name);

      const buttons = document.createElement('div');
      buttons.className = 'image-preview-buttons';

      const sizeKB = (file.size / 1024).toFixed(1);
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      const sizeDisplay = document.createElement('span');
      sizeDisplay.textContent = file.size >= 1024 * 1024 ?
        `${sizeMB} MB` : `${sizeKB} KB`;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-button';
      removeBtn.textContent = 'X';
      removeBtn.addEventListener('click', removeUncompressedImage);

      buttons.appendChild(sizeDisplay);
      buttons.appendChild(removeBtn);

      const img = document.createElement('img');
      const isTiff = file.type === 'image/tiff' ||
                     file.type === 'image/x-tiff' ||
                     file.name.toLowerCase().endsWith('.tif') ||
                     file.name.toLowerCase().endsWith('.tiff');
      img.src = isTiff ? '/images/tiff-placeholder.png' : e.target.result;
      if (isTiff) img.style.boxShadow = 'none';

      const caption = document.createElement('p');
      caption.className = 'image-caption';
      caption.style.whiteSpace = 'normal';
      caption.style.wordBreak = 'break-word';
      caption.style.overflowWrap = 'anywhere';
      caption.textContent = softBreakFilename(file.name, 12);
      caption.title = file.name;

      container.appendChild(buttons);
      container.appendChild(img);
      container.appendChild(caption);
      previewContainer.appendChild(container);

      // First preview becomes base image + mark active
      const baseImg = baseImgEl();
      const firstItem = previewContainer.querySelector('.image-preview-item');
      if (firstItem && !activePreviewItem()) {
        firstItem.classList.add('active');
        if (baseImg) {
          const firstImg = firstItem.querySelector('img');
          if (firstImg) baseImg.src = firstImg.src;
          baseImg.dataset.key = firstItem.getAttribute('data-filename') || '';
        }
        showCoachmarkOnce?.();
      }

      // Clicking a preview changes active image (and swaps layers in per-image mode)
      img.addEventListener('click', () => {
        setActivePreview(container);
      });

      resolve();
    };
    reader.readAsDataURL(file);
  });
}

function removeUncompressedImage(event) {
  const container = event.target.closest('.image-preview-item');
  const filename = container.getAttribute('data-filename');
  const wasActive = container.classList.contains('active');

  if (container) {
    container.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    container.style.opacity = '0';
    container.style.transform = 'scale(0.95)';
    setTimeout(() => {
      container.remove();

      // Clean up stored layers for this image key
      layersByImage.delete(filename);

      const idx = uploadedFiles.findIndex(f => f.name === filename);
      if (idx !== -1) uploadedFiles.splice(idx, 1);

      if (wasActive) {
        const next = previewContainer.querySelector('.image-preview-item');
        if (next) {
          setActivePreview(next);
        } else {
          resetWatermarkerUI();
        }
      }

      const remaining = document.querySelectorAll('.image-preview-item').length;
      if (remaining === 0) resetWatermarkerUI();
    }, 300);
  }
}

function resetWatermarkerUI() {
  compressorEl?.style.setProperty('display', 'flex');
  compressorEl?.style.setProperty('flex-direction', 'column');
  previewCon?.style.setProperty('display', 'none');

  // Clear canvas layers
  const cv = canvasEl();
  if (cv) {
    [...cv.children].forEach(child => {
      if (!child.classList.contains('base-image')) child.remove();
    });
  }
  if (wmSelect) while (wmSelect.firstChild) wmSelect.removeChild(wmSelect.firstChild);
  wmCounter = 0;
  layersByImage.clear();
  updateSelectSize();
  updateStylePanelForSelection();
  document.querySelectorAll('.canvas .wm.is-selected').forEach(n => n.classList.remove('is-selected'));
}

// =========================
// Hook up style controls to selected layer
// =========================
function currentSelectedLayer() {
  const id = wmSelect?.value;
  return id ? document.getElementById(id) : null;
}

// Image inputs
['input', 'change'].forEach(evt => {
  I.op?.addEventListener(evt, () => { I.opVal.textContent = I.op.value; const el = currentSelectedLayer(); if (el) applyImageStylesTo(el); });
  I.blend?.addEventListener(evt, () => { const el = currentSelectedLayer(); if (el) applyImageStylesTo(el); });

  I.bright?.addEventListener(evt, () => { I.brightVal.textContent = I.bright.value; const el = currentSelectedLayer(); if (el) applyImageStylesTo(el); });
  I.contrast?.addEventListener(evt, () => { I.contrastVal.textContent = I.contrast.value; const el = currentSelectedLayer(); if (el) applyImageStylesTo(el); });
  I.saturate?.addEventListener(evt, () => { I.saturateVal.textContent = I.saturate.value; const el = currentSelectedLayer(); if (el) applyImageStylesTo(el); });
  I.gray?.addEventListener(evt, () => { I.grayVal.textContent = I.gray.value; const el = currentSelectedLayer(); if (el) applyImageStylesTo(el); });
  I.blur?.addEventListener(evt, () => { I.blurVal.textContent = I.blur.value; const el = currentSelectedLayer(); if (el) applyImageStylesTo(el); });

  I.radius?.addEventListener(evt, () => { I.radiusVal.textContent = I.radius.value; const el = currentSelectedLayer(); if (el) applyImageStylesTo(el); });

  I.borderOn?.addEventListener(evt, () => { const el = currentSelectedLayer(); if (el) applyImageStylesTo(el); });
  I.borderW?.addEventListener(evt, () => { I.borderWVal.textContent = I.borderW.value; const el = currentSelectedLayer(); if (el) applyImageStylesTo(el); });
  I.borderC?.addEventListener(evt, () => { const el = currentSelectedLayer(); if (el) applyImageStylesTo(el); });
});

// Text inputs
['input', 'change'].forEach(evt => {
  T.fam?.addEventListener(evt, () => { const el = currentSelectedLayer(); if (el) applyTextStylesTo(el); });
  T.wgt?.addEventListener(evt, () => { const el = currentSelectedLayer(); if (el) applyTextStylesTo(el); });
  T.ita?.addEventListener(evt, () => { const el = currentSelectedLayer(); if (el) applyTextStylesTo(el); });

  T.let?.addEventListener(evt, () => { const el = currentSelectedLayer(); if (el) applyTextStylesTo(el); });
  T.word?.addEventListener(evt, () => { const el = currentSelectedLayer(); if (el) applyTextStylesTo(el); });
  T.lh?.addEventListener(evt, () => { const el = currentSelectedLayer(); if (el) applyTextStylesTo(el); });

  T.lock?.addEventListener(evt, () => { const el = currentSelectedLayer(); if (el) {
    if (T.lock.checked) seedFontSizeForLock(el, { min: 18, max: 512 });
    applyTextStylesTo(el);
  } });

  T.size?.addEventListener(evt, () => { const el = currentSelectedLayer(); if (el && !T.lock.checked) applyTextStylesTo(el); });

  T.color?.addEventListener(evt, () => { const el = currentSelectedLayer(); if (el) applyTextStylesTo(el); });
  T.op?.addEventListener(evt, () => { T.opVal.textContent = T.op.value; const el = currentSelectedLayer(); if (el) applyTextStylesTo(el); });
  T.blend?.addEventListener(evt, () => { const el = currentSelectedLayer(); if (el) applyTextStylesTo(el); });

  T.strokeOn?.addEventListener(evt, () => { const el = currentSelectedLayer(); if (el) applyTextStylesTo(el); });
  T.strokeW?.addEventListener(evt, () => { T.strokeWVal.textContent = T.strokeW.value; const el = currentSelectedLayer(); if (el) applyTextStylesTo(el); });
  T.strokeC?.addEventListener(evt, () => { const el = currentSelectedLayer(); if (el) applyTextStylesTo(el); });
});

// =========================
// Add-buttons
// =========================
addTextButton?.addEventListener('click', addTextToBaseImg);
addImgButton?.addEventListener('click', addImageToBaseImg);

// =========================
// BACKEND EXPORT: serialize layers and POST to /api/watermark
// =========================

function parseCssColorToHex(colorString) {
  // returns hex color or original string if already hex
  const s = (colorString || '').trim();
  if (s.startsWith('#')) return s;
  // try canvas to normalize
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.fillStyle = s;
  const computed = ctx.fillStyle; // in rgb(a) or hex
  if (computed.startsWith('#')) return computed;
  const m = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return '#000000';
  const r = (+m[1]).toString(16).padStart(2,'0');
  const g = (+m[2]).toString(16).padStart(2,'0');
  const b = (+m[3]).toString(16).padStart(2,'0');
  return `#${r}${g}${b}`;
}

function extractImageFilters(imgEl) {
  const f = (imgEl.style.filter || getComputedStyle(imgEl).filter || 'none');
  const getNum = (name, def, pct = true) => {
    const m = f.match(new RegExp(`${name}\\(([^)]+)\\)`, 'i'));
    if (!m) return def;
    const raw = m[1].trim();
    return pct && raw.endsWith('%') ? parseFloat(raw) : parseFloat(raw);
  };
  const brightness = getNum('brightness', 100);
  const contrast   = getNum('contrast',   100);
  const saturate   = getNum('saturate',   100);
  const grayscale  = getNum('grayscale',  0);
  const blur       = getNum('blur', 0, false); // px
  // Map grayscale to saturation for backend (0..100 -> 100..0)
  const mappedSaturation = grayscale > 0 ? 0 : saturate;
  return { brightness, contrast, saturation: mappedSaturation, blur };
}

function elementBoxInCanvasPixels(el, cv, natW, natH) {
  const rEl = el.getBoundingClientRect();
  const rCv = cv.getBoundingClientRect();
  const dispW = rCv.width || 1;
  const dispH = rCv.height || 1;
  const sx = natW / dispW;
  const sy = natH / dispH;
  const x = (rEl.left - rCv.left) * sx;
  const y = (rEl.top  - rCv.top ) * sy;
  const w = rEl.width  * sx;
  const h = rEl.height * sy;
  return { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) };
}

function buildLayersPayload(cv, natW, natH) {
  const layers = [];
  cv.querySelectorAll('.wm').forEach((layer) => {
    const cs = getComputedStyle(layer);
    const { x, y, width, height } = elementBoxInCanvasPixels(layer, cv, natW, natH);
    const opacity = Math.max(0, Math.min(1, parseFloat(cs.opacity) || 1));
    const blend = (layer.style.mixBlendMode || cs.mixBlendMode || 'normal').toLowerCase();

    if (layer.classList.contains('image-water')) {
      const img = layer.querySelector('img');
      if (!img) return;
      const dataUrl = img.src;
      layers.push({
        type: 'image',
        dataUrl,
        x, y, width, height,
        opacity,
        blend,
        rotation: 0,
        filters: extractImageFilters(img)
      });
    } else if (layer.classList.contains('text-water')) {
      const txt = (layer.innerText || '').trim();
      if (!txt) return;
      const tcs = getComputedStyle(layer);
      const fontFamily = tcs.fontFamily;
      const fontSizePx = parseFloat(tcs.fontSize) || 32;
      const fontWeight = tcs.fontWeight || '400';
      const color = parseCssColorToHex(tcs.color || '#000000');
      layers.push({
        type: 'text',
        text: txt,
        x, y, width, height,
        fontFamily,
        fontSize: Math.round(fontSizePx),
        color,
        align: 'center',
        weight: String(fontWeight),
        rotation: 0,
        opacity
      });
    }
  });
  return layers;
}

async function exportViaBackend({ outType = 'png', quality = 92 } = {}) {
  const cv = canvasEl();
  const base = baseImgEl();
  if (!cv || !base) { alert('Nothing to export yet.'); return; }

  // make sure base has natural size
  if (!base.complete || !base.naturalWidth) {
    await new Promise(res => base.addEventListener('load', res, { once: true }));
  }
  const natW = base.naturalWidth || base.clientWidth || 1;
  const natH = base.naturalHeight || base.clientHeight || 1;

  // baseImage must be a data URL (your previews are created from FileReader -> dataURL)
  const baseImage = base.src;
  if (!/^data:image\//i.test(baseImage)) {
    alert('Base image must be a data URL (local uploads are supported).');
    return;
  }

  const layers = buildLayersPayload(cv, natW, natH);
  const filenameBase = (activeImageKey() || 'watermarked').replace(/\.[^.]+$/, '');
  const filename = `${filenameBase}-watermarked`;

  const payload = { baseImage, natW, natH, layers, outType, quality, filename };

  setState?.('Rendering…'); renderPct?.(5);
  try {
    const res = await apiFetch('/api/watermark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      retries: 2
    });

    const cd = res.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename="([^"]+)"/i);
    const fname = m ? m[1] : `${filename}.${outType === 'jpeg' ? 'jpg' : outType}`;
    const blob = await res.blob();

    const a = document.createElement('a');
    a.download = fname;
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
    renderPct?.(100); setState?.('Done');
  } catch (err) {
    console.error(err);
    alert(`Failed to export: ${err.message}`);
    setState?.('Error');
  } finally {
    setTimeout(()=> { renderPct?.(0); setState?.(''); }, 600);
  }
}

// =========================
// (Optional) Client-side export remains available, but we’ll use backend by default
// =========================
async function exportCanvasToImage(opts = {}) {
  const { type = 'image/png', quality = 0.92, filename = (activeImageKey() ? activeImageKey().replace(/\.[^.]+$/, '') + (type === 'image/jpeg' ? '.jpg' : type === 'image/webp' ? '.webp' : '.png') : 'watermarked.png') } = opts;

  const cv = canvasEl();
  const base = baseImgEl();
  if (!cv || !base) { alert('Nothing to export yet.'); return; }

  if (!base.complete || !base.naturalWidth) {
    await new Promise(res => { base.addEventListener('load', res, { once: true }); });
  }

  const width  = base.naturalWidth  || base.clientWidth  || 1;
  const height = base.naturalHeight || base.clientHeight || 1;

  const clone = cv.cloneNode(true);
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';
  clone.style.border = 'none';
  clone.style.width  = width  + 'px';
  clone.style.height = height + 'px';
  clone.querySelectorAll('.wm').forEach(el => {
    el.classList.remove('is-selected', 'wm-pulse');
    el.querySelectorAll('.wm-handle').forEach(h => h.remove());
  });

  const xmlns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(xmlns, 'svg');
  svg.setAttribute('xmlns', xmlns);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));

  const fo = document.createElementNS(xmlns, 'foreignObject');
  fo.setAttribute('x', '0'); fo.setAttribute('y', '0');
  fo.setAttribute('width', String(width));
  fo.setAttribute('height', String(height));

  const wrapper = document.createElement('div');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrapper.style.width = width + 'px';
  wrapper.style.height = height + 'px';
  wrapper.style.overflow = 'hidden';
  wrapper.appendChild(clone);
  fo.appendChild(wrapper);
  svg.appendChild(fo);

  const svgString = new XMLSerializer().serializeToString(svg);
  const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);

  const out = document.createElement('canvas');
  out.width = width; out.height = height;
  const ctx = out.getContext('2d');

  await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { ctx.drawImage(img, 0, 0); resolve(); };
    img.onerror = () => reject(new Error('Failed to render SVG to canvas.'));
    img.src = svgDataUrl;
  });

  const a = document.createElement('a');
  a.download = filename;
  a.href = type === 'image/png' ? out.toDataURL('image/png') : out.toDataURL(type, quality);
  a.click();
}

// =========================
 // Hook export button -> backend watermark
// =========================
document.getElementById('compress-btn')?.addEventListener('click', () => {
  // Use backend (Sharp) by default
  exportViaBackend({ outType: 'png', quality: 92 });
  // If you want to fall back to client-only rendering, call:
  // exportCanvasToImage({ type: 'image/png' });
});

// =========================
// (Optional) init
// =========================
function init() {
  resetTextControlsToBase();
  resetImageControlsToBase();
  addImgButton?.addEventListener('click', addImageToBaseImg);
  addTextButton?.addEventListener('click', addTextToBaseImg);
  updateSelectSize();
  updateStylePanelForSelection();
}
init();
