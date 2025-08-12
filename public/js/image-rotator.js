// =========================
// DOM refs
// =========================
const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('fileElem');
const previewContainer = document.querySelector('.image-preview-con .image-previews');

const rotateBtn = document.getElementById('compress-btn'); // keeping existing id in HTML
const rotationSlider = document.getElementById('rotation-slider');
const rotationValue  = document.getElementById('rotation-value');

const quickButtons = document.querySelectorAll('.rotation-buttons button'); // Left 90°, Right 90°, 180°, Reset

const addMoreIcon = document.getElementById('add-more-icon');

const redownloadBtn = document.querySelector('.completion-download-button');

const percentEl = document.querySelector('.loading-percentage');
const progressEl = document.querySelector('.loading-progress');
const progressStateEl = document.querySelector('.progress-state');

let imagePercent = document.querySelector('.size-reduction-percent'); // optional badge

// =========================
// State
// =========================
let uploadedFiles = [];              // only VALID, decodable images are stored here
let lastResultBlob = null;
let lastResultFilename = null;
let progressSource = null;

// =========================
// Allowed types (must match backend)
// =========================
const ALLOWED_EXTS  = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.bmp', '.avif']);
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/bmp', 'image/avif']);

// Optional: front-end size cap (adjust if desired; keep consistent in your UI copy)
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// =========================
// Helpers
// =========================
function getExt(filename) {
  const m = (filename || '').toLowerCase().match(/\.[^.]+$/);
  return m ? m[0] : '';
}

function isAllowedFile(file) {
  const ext  = getExt(file.name);
  const mime = (file.type || '').toLowerCase();
  const extOk  = ALLOWED_EXTS.has(ext);
  // Some browsers leave MIME blank; allow it if ext is valid
  const mimeOk = !mime || ALLOWED_MIMES.has(mime);
  return extOk && mimeOk;
}

function reasonForRejection(file) {
  if (!isAllowedFile(file)) {
    const ext  = getExt(file.name) || '(no ext)';
    const mime = (file.type || 'unknown').toLowerCase();
    return `Unsupported type (${ext} / ${mime}). Allowed: ${[...ALLOWED_EXTS].join(', ')}`;
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `Larger than ${(MAX_SIZE_BYTES/1024/1024).toFixed(0)}MB`;
  }
  return null;
}

/** Insert soft break points in long filenames so they wrap nicely.
 *  - Keeps the extension intact
 *  - Adds zero‑width spaces after delimiters and every N chars as fallback
 */
function softBreakFilename(filename, chunk = 12) {
  const dot = filename.lastIndexOf('.');
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const ext  = dot > 0 ? filename.slice(dot)    : '';

  const ZWSP = '\u200B';
  const withDelims = base.replace(/([_\-.])/g, `$1${ZWSP}`);
  const withChunks = withDelims.replace(new RegExp(`(.{${chunk}})`, 'g'), `$1${ZWSP}`);

  return withChunks + ext; // don’t break the extension
}

/** Decode a file as an image in the browser to ensure it is not corrupted. */
function decodeImage(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(true);  };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
    img.src = url;
  });
}

// =========================
// Degree slider + rotation sync
// =========================
function getCurrentDegrees() {
  const v = rotationSlider ? parseInt(rotationSlider.value, 10) : 0;
  return Number.isFinite(v) ? v : 0;
}

// Ensure slider is degree-based
if (rotationSlider) {
  rotationSlider.min = "-180";
  rotationSlider.max = "180";
  rotationSlider.step = "1";
  if (!rotationSlider.value) rotationSlider.value = "0";
}

function applyRotationToPreviews(deg) {
  const imgs = previewContainer?.querySelectorAll('img');
  if (!imgs) return;
  imgs.forEach(img => {
    img.style.transform = `rotate(${deg}deg)`;
    img.style.transformOrigin = '50% 50%';
    img.style.transition = 'transform 120ms ease-out';
  });
}

function setRotation(deg) {
  const clamped = Math.max(-180, Math.min(180, Math.round(deg)));
  if (rotationSlider) rotationSlider.value = String(clamped);
  if (rotationValue)  rotationValue.textContent = `${clamped}°`;
  applyRotationToPreviews(clamped);
}

function clearQuickActive() {
  quickButtons.forEach(b => b.classList.remove('active'));
}

// Slider: update degrees and clear active state on quick buttons
rotationSlider?.addEventListener('input', () => {
  setRotation(getCurrentDegrees());
  clearQuickActive();
});

// Quick buttons: Left 90°, Right 90°, Down 180°, Reset
quickButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const label = (btn.textContent || '').toLowerCase();

    // Reset: set 0°, clear actives, do not set active on reset button
    if (label.includes('reset')) {
      setRotation(0);
      clearQuickActive();
      return;
    }

    let deg = 0;
    if (label.includes('left'))  deg = -90;
    else if (label.includes('right')) deg = 90;
    else if (label.includes('180') || label.includes('down')) deg = 180;

    setRotation(deg);
    clearQuickActive();
    btn.classList.add('active');
  });
});

// Initialize once on load
setRotation(getCurrentDegrees());

// =========================
// Progress helpers
// =========================
function renderPct(pct) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  if (percentEl) percentEl.textContent = `${clamped}%`;
  if (progressEl) progressEl.style.width = `${clamped}%`;
}

function setState(txt) {
  if (progressStateEl) progressStateEl.textContent = txt || '';
}

// =========================
// Core UI bindings
// =========================
addMoreIcon?.addEventListener('click', () => fileInput?.click());

['dragenter', 'dragover'].forEach(eventName => {
  dropArea?.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropArea.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach(eventName => {
  dropArea?.addEventListener(eventName, () => {
    dropArea.classList.remove('dragover');
  });
});

dropArea?.addEventListener('drop', async (e) => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files);
  await acceptFiles(files);
});

fileInput?.addEventListener('change', async () => {
  const files = Array.from(fileInput.files);
  await acceptFiles(files);
  fileInput.value = '';
});

// Central intake for files from either drop or input
async function acceptFiles(files) {
  const totalImages = uploadedFiles.length + files.length;
  if (totalImages > 10) {
    alert('You can only upload up to 10 images.');
    return;
  }

  for (const file of files) {
    const rejectReason = reasonForRejection(file);
    if (rejectReason) {
      console.warn(`Rejected ${file.name}: ${rejectReason}`);
      alert(`"${file.name}" was rejected: ${rejectReason}`);
      continue;
    }

    // Decode guard – skip broken files
    const ok = await decodeImage(file);
    if (!ok) {
      console.warn(`Skipped broken image: ${file.name}`);
      alert(`"${file.name}" is broken or corrupted and cannot be used.`);
      continue;
    }

    uploadedFiles.push(file);
    await buildPreview(file);
  }

  if (uploadedFiles.length > 0) {
    // Hide intro, show previews
    const rotatorIntro = document.querySelector('.image-rotator');
    if (rotatorIntro) rotatorIntro.style.display = 'none';
    const previewCon = document.querySelector('.image-preview-con');
    if (previewCon) previewCon.style.display = 'flex';

    // apply current rotation to newly added previews
    applyRotationToPreviews(getCurrentDegrees());
  }
}

// =========================
/** Previews (with soft-wrapped captions) */
function buildPreview(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      const container = document.createElement('div');
      container.classList.add('image-preview-item');
      container.style.minWidth = '0'; // help flex layouts prevent overflow

      const buttonWrapper = document.createElement('div');
      buttonWrapper.className = 'image-preview-buttons';

      const sizeKB = (file.size / 1024).toFixed(1);
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      const sizeDisplay = document.createElement('span');
      sizeDisplay.textContent = file.size >= 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-button';
      removeBtn.textContent = 'X';
      removeBtn.addEventListener('click', removeUncompressedImage);

      buttonWrapper.appendChild(sizeDisplay);
      buttonWrapper.appendChild(removeBtn);

      const img = document.createElement('img');
      const isTiff = file.type === 'image/tiff' || file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff');
      img.src = isTiff ? '/images/tiff-placeholder.png' : e.target.result;
      if (isTiff) img.style.boxShadow = 'none';

      // initial rotation for this preview
      const deg = getCurrentDegrees();
      img.style.transform = `rotate(${deg}deg)`;
      img.style.transformOrigin = '50% 50%';
      img.style.transition = 'transform 120ms ease-out';

      const caption = document.createElement('p');
      caption.className = 'image-caption';
      caption.style.whiteSpace   = 'normal';
      caption.style.wordBreak    = 'break-word';
      caption.style.overflowWrap = 'anywhere';
      caption.style.maxWidth     = '100%';
      caption.style.display      = 'block';
      caption.textContent = softBreakFilename(file.name, 12);
      caption.title = file.name;

      container.setAttribute('data-filename', file.name);
      container.appendChild(buttonWrapper);
      container.appendChild(img);
      container.appendChild(caption);

      previewContainer.appendChild(container);
      resolve();
    };
    reader.readAsDataURL(file);
  });
}

function removeUncompressedImage(event) {
  const container = event.target.closest('.image-preview-item');
  const filename = container.getAttribute('data-filename');

  if (container) {
    container.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    container.style.opacity = '0';
    container.style.transform = 'scale(0.95)';
    setTimeout(() => container.remove(), 300);
  }

  const index = uploadedFiles.findIndex(f => f.name === filename);
  if (index !== -1) uploadedFiles.splice(index, 1);

  const remaining = document.querySelectorAll('.image-preview-item').length - 1;
  if (remaining <= 0) {
    // Show intro again when no files left
    const rotatorIntro = document.querySelector('.image-rotator');
    if (rotatorIntro) {
      rotatorIntro.style.display = 'flex';
      rotatorIntro.style.flexDirection = 'column';
    }
    document.querySelector('.image-preview-con').style.display = 'none';
  }
}

// =========================
// Start "rotation" (still using /compress until /rotate exists)
// =========================
rotateBtn?.addEventListener('click', rotateImages);

function rotateImages() {
  if (uploadedFiles.length === 0) {
    alert('No images to process.');
    return;
  }

  const degrees = getCurrentDegrees();

  // Initial upload size (sum of VALID images only)
  const initialSizeBytes = uploadedFiles.reduce((sum, file) => sum + file.size, 0);
  const initialSizeMB = (initialSizeBytes / (1024 * 1024)).toFixed(2);
  console.log(`Initial upload size: ${initialSizeMB} MB`);
  console.log(`Requested rotation: ${degrees}°`);

  document.querySelector('.loading-con').style.display = "flex";
  document.querySelector('.image-preview-con').style.display = "none";
  document.querySelector('.image-rotator-header')?.style.setProperty('display', 'none');
  document.querySelector('.image-rotator-copy')?.style.setProperty('display', 'none');
  setState("Uploading");
  renderPct(0);

  // Generate jobId & open SSE before upload
  const jobId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
  startProgressStream(jobId);

  const formData = new FormData();
  uploadedFiles.forEach(file => formData.append('images', file));
  // send degrees so your future /rotate endpoint can consume it
  formData.append('degrees', String(degrees));
  formData.append('jobId', jobId);

  const xhr = new XMLHttpRequest();
  // Keep using /compress for now to avoid breaking flow.
  // Later: change this to /rotate and handle accordingly.
  xhr.open('POST', 'https://online-tool-backend.onrender.com/compress', true);

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = (e.loaded / e.total) * 100;
      console.log(`Uploading: ${pct.toFixed(1)}%`);
      renderPct(pct);
      setState("Uploading");
    }
  };

  xhr.responseType = 'blob';
  xhr.onload = function () {
    try { if (progressSource) progressSource.close(); } catch {}
    progressSource = null;

    if (xhr.status < 200 || xhr.status >= 300) {
      console.error('Processing failed:', xhr.status);
      document.querySelector('.loading-con').style.display = "none";
      alert('Something went wrong while processing the images.');
      return;
    }

    console.log('Upload complete, download starting...');

    const blob = xhr.response;

    // Result size logs (kept for your UI comparison)
    const resultSizeMB = (blob.size / (1024 * 1024)).toFixed(2);
    console.log(`Result size: ${resultSizeMB} MB`);

    if (initialSizeBytes > 0) {
      const reductionPctNum = 100 - (blob.size / initialSizeBytes) * 100;
      const reductionPct = reductionPctNum.toFixed(2);
      console.log(`Size change: ${reductionPct}%`);
      if (imagePercent) {
        if (reductionPctNum > 0) {
          imagePercent.style.display = 'inline';
          imagePercent.textContent = `${Math.abs(reductionPct)}%`;
        } else {
          imagePercent.style.display = 'none';
        }
      }
    }

    const cd = xhr.getResponseHeader('Content-Disposition') || '';
    let filename = 'processed';
    const match = cd.match(/filename="?([^"]+)"?/);
    if (match && match[1]) filename = match[1].trim();

    lastResultBlob = blob;
    lastResultFilename = filename;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    renderPct(100);
    setState('Rotating');
    document.querySelector('.loading-con').style.display = "none";
    document.querySelector('.completion-con').style.display = "flex";
  };

  xhr.onerror = function () {
    console.error('Something went wrong while processing the images.');
    try { if (progressSource) progressSource.close(); } catch {}
    progressSource = null;
    document.querySelector('.loading-con').style.display = "none";
    alert('Something went wrong while processing the images.');
  };

  xhr.send(formData);
}

// =========================
// Redownload last result
// =========================
redownloadBtn?.addEventListener('click', () => {
  if (!lastResultBlob || !lastResultFilename) {
    alert('No processed images to download. Please run the tool first.');
    return;
  }

  const url = window.URL.createObjectURL(lastResultBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = lastResultFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
});

// =========================
// SSE progress stream
// =========================
function startProgressStream(jobId) {
  if (progressSource) { try { progressSource.close(); } catch {} progressSource = null; }
  progressSource = new EventSource(`https://online-tool-backend.onrender.com/progress/${jobId}`);

  progressSource.onmessage = (evt) => {
    try {
      const { total, processed, mode } = JSON.parse(evt.data);
      const pct = total ? (processed / total) * 100 : 0;
      console.log(`Progress: ${Math.round(pct)}% [${mode}] (${processed}/${total})`);
      renderPct(pct);
      setState(mode === 'zip' ? 'Packaging' : 'Rotating');
    } catch {
      // ignore heartbeat/comments
    }
  };

  progressSource.addEventListener('end', () => {
    console.log('Progress: 100% [done]');
    renderPct(100);
    setState('Rotating');
    try { progressSource.close(); } catch {}
    progressSource = null;
  });

  progressSource.onerror = () => {
    // optional warn
  };
}
