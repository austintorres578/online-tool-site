const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('fileElem');
const previewContainer = document.querySelector('.image-preview-con .image-previews');
const compressBtn = document.getElementById('compress-btn');
const compressionSlider = document.getElementById('compression-slider');
const compressionValue = document.getElementById('compression-value');
const addMoreIcon = document.getElementById('add-more-icon');
const redownloadBtn = document.querySelector('.completion-download-button');
const percentEl = document.querySelector('.loading-percentage');
const progressEl = document.querySelector('.loading-progress');
const progressStateEl = document.querySelector('.progress-state');

let imagePercent = document.querySelector('.size-reduction-percent');

let imageTypeButtonCon = document.querySelector('.conversion-options');
let allTypeButtons = imageTypeButtonCon ? imageTypeButtonCon.querySelectorAll('button') : [];
let uploadedFiles = [];
let lastCompressedBlob = null;
let lastCompressedFilename = null;
let progressSource = null;

function selectImageType(event) {
  for (let i = 0; i < allTypeButtons.length; i++) {
    allTypeButtons[i].classList.toggle('active', allTypeButtons[i] === event.target);
  }
}

/* ---------- filename soft-wrap helpers ---------- */
/** Insert soft breaks in long filenames (keeps extension intact). */
function softBreakFilename(filename, chunk = 12) {
  const dot = filename.lastIndexOf('.');
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const ext  = dot > 0 ? filename.slice(dot)    : '';

  const ZWSP = '\u200B';
  // break after common delimiters
  const withDelims = base.replace(/([_\-.])/g, `$1${ZWSP}`);
  // fallback: every N chars
  const withChunks = withDelims.replace(new RegExp(`(.{${chunk}})`, 'g'), `$1${ZWSP}`);
  return withChunks + ext;
}

function renderPct(pct) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  if (percentEl) percentEl.textContent = `${clamped}%`;
  if (progressEl) progressEl.style.width = `${clamped}%`; // keep % for CSS width
}

allTypeButtons.forEach(button => button.addEventListener('click', selectImageType));

if (addMoreIcon) {
  addMoreIcon.addEventListener('click', () => fileInput && fileInput.click());
}

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

/* ---------- helpers for validation ---------- */
const COMMON_IMAGE_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif', '.avif', '.tif', '.tiff'
]);

function getExt(file) {
  const name = (file.name || '');
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

/** Treat TIFF as valid even if browser leaves MIME blank or uses image/x-tiff */
function isTiff(file) {
  const ext = getExt(file);
  const type = (file.type || '').toLowerCase();
  return ext === '.tif' || ext === '.tiff' || type === 'image/tiff' || type === 'image/x-tiff';
}

/** Option 2 core: skip decode for formats the browser can’t render in <img> (e.g., TIFF) */
function isBrowserRenderable(file) {
  // Extend this if you add other non-renderables later
  return !isTiff(file);
}

function isValidFile(file, acceptTypes) {
  const fileExt = getExt(file);
  const mimeType = (file.type || '').toLowerCase();

  // if accept is empty, allow common images
  if (!acceptTypes || acceptTypes.length === 0 || (acceptTypes.length === 1 && acceptTypes[0] === '')) {
    return mimeType.startsWith('image/') || COMMON_IMAGE_EXTS.has(fileExt);
  }

  // If accept includes image/*, allow images by MIME OR by common image extension
  if (acceptTypes.includes('image/*')) {
    if (mimeType.startsWith('image/')) return true;
    // Handle blank/unknown MIME but known image extension (incl. .tif/.tiff)
    if (COMMON_IMAGE_EXTS.has(fileExt)) return true;
  }

  // Direct matches for extension or MIME (incl. legacy image/x-tiff)
  if (acceptTypes.includes(fileExt)) return true;
  if (acceptTypes.includes(mimeType)) return true;
  if (isTiff(file) && (acceptTypes.includes('.tif') || acceptTypes.includes('.tiff') || acceptTypes.includes('image/tiff') || acceptTypes.includes('image/x-tiff'))) {
    return true;
  }

  return false;
}

function validateFiles(files, acceptTypes) {
  return files.filter(file => !isValidFile(file, acceptTypes));
}

/* ---------- decode guard: detect broken/corrupt images on the client ---------- */
function decodeImage(file, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    let settled = false;

    const clean = () => {
      URL.revokeObjectURL(url);
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
    };

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        clean();
        resolve(false);
      }
    }, timeoutMs);

    img.onload = () => {
      if (!settled) {
        settled = true;
        clean();
        resolve(true);
      }
    };
    img.onerror = () => {
      if (!settled) {
        settled = true;
        clean();
        resolve(false);
      }
    };

    img.src = url;
  });
}

/* ---------- build preview for a valid, decodable file ---------- */
async function buildPreview(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      const container = document.createElement('div');
      container.classList.add('image-preview-item');
      container.style.minWidth = '0'; // ensure flex items can shrink without overflow

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
      const tiff = isTiff(file);

      img.src = tiff ? '/images/tiff-placeholder.png' : e.target.result;
      if (tiff) img.style.boxShadow = 'none';

      const caption = document.createElement('p');
      caption.className = 'image-caption';
      // robust wrapping
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

/* ---------- accept & process a batch (validates + decodes + alerts on broken) ---------- */
async function acceptFiles(files) {
  const totalImages = uploadedFiles.length + files.length;
  if (totalImages > 10) {
    alert('You can only upload up to 10 images.');
    return;
  }

  // respect <input accept="..."> but be robust for TIFF
  const acceptAttr = (fileInput && fileInput.accept ? fileInput.accept : '').trim();
  const acceptTypes = acceptAttr ? acceptAttr.split(',').map(t => t.trim().toLowerCase()) : [];

  const invalid = validateFiles(files, acceptTypes);
  if (invalid.length > 0) {
    const reasons = invalid.map(file => `❌ ${file.name}: Not an accepted image type`).join('\n');
    alert(`Some files were rejected:\n${reasons}`);
    // continue with the rest (only valid ones)
    files = files.filter(f => !invalid.includes(f));
  }

  for (const file of files) {
    // Option 2: only decode if browser can render this type; skip for TIFF
    let ok = true;
    if (isBrowserRenderable(file)) {
      ok = await decodeImage(file);
    }

    if (!ok) {
      console.warn(`Skipped broken image: ${file.name}`);
      alert(`"${file.name}" is broken or corrupted and cannot be used.`);
      continue;
    }

    // store & preview only good ones
    uploadedFiles.push(file);
    await buildPreview(file);
  }

  if (uploadedFiles.length > 0) {
    const converter = document.querySelector('.image-converter');
    if (converter) converter.style.display = 'none';
    const previewCon = document.querySelector('.image-preview-con');
    if (previewCon) previewCon.style.display = 'flex';
  }
}

/* ---------- drag & input handlers use acceptFiles ---------- */
if (dropArea) {
  dropArea.addEventListener('drop', async (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    await acceptFiles(files);
  });
}

if (fileInput) {
  fileInput.addEventListener('change', async () => {
    const files = Array.from(fileInput.files);
    await acceptFiles(files);
    // keep selection open; clear only if you want to allow re-selecting same files
    // fileInput.value = '';
  });
}

if (compressionSlider) {
  compressionSlider.addEventListener('input', () => {
    if (compressionValue) {
      compressionValue.textContent = `${compressionSlider.value}%`;
    }
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
    const converter = document.querySelector('.image-converter');
    if (converter) {
      converter.style.display = 'flex';
      converter.style.flexDirection = 'column';
    }
    const previewCon = document.querySelector('.image-preview-con');
    if (previewCon) previewCon.style.display = 'none';
  }
}

/* ---------- SSE progress ---------- */
function startProgressStream(jobId) {
  if (progressSource) { try { progressSource.close(); } catch {} progressSource = null; }
  progressSource = new EventSource(`https://online-tool-backend.onrender.com/progress/${jobId}`);

  progressSource.onmessage = (evt) => {
    try {
      const { total, processed, mode } = JSON.parse(evt.data);
      const pct = total ? (processed / total) * 100 : 0;
      console.log(`Conversion: ${Math.round(pct)}% [${mode}] (${processed}/${total})`);
      renderPct(pct);
      if (progressStateEl) progressStateEl.textContent = "Converting";
    } catch {}
  };

  progressSource.addEventListener('end', () => {
    console.log('Conversion: 100% [done]');
    renderPct(100);
    if (progressStateEl) progressStateEl.textContent = "Converting";
    try { progressSource.close(); } catch {}
    progressSource = null;
  });

  progressSource.onerror = (err) => {
    console.warn('SSE error', err);
  };
}

/* ---------- convert flow (unchanged, with size logging + percent badge rules) ---------- */
if (compressBtn) {
  compressBtn.addEventListener('click', convertImages);
}

function convertImages() {
  if (uploadedFiles.length === 0) {
    alert('No images to convert.');
    return;
  }

  const activeTypeButton = document.querySelector('.conversion-options button.active');
  if (!activeTypeButton) {
    alert('Please select an image type to convert to.');
    return;
  }

  const formatText = activeTypeButton.textContent.toLowerCase();
  const format = formatText === 'jpg' ? 'jpeg' : formatText;
  const quality = compressionSlider.value;

  // initial size log
  const initialSizeBytes = uploadedFiles.reduce((sum, f) => sum + f.size, 0);
  const initialMB = (initialSizeBytes / (1024 * 1024)).toFixed(2);
  console.log(`Initial upload size: ${initialMB} MB`);

  document.querySelector('.loading-con').style.display = "flex";
  document.querySelector('.image-preview-con').style.display = "none";
  const header = document.querySelector('.image-converter-header');
  const copy = document.querySelector('.image-converter-copy');
  if (header) header.style.display = "none";
  if (copy) copy.style.display = "none";
  if (progressStateEl) progressStateEl.textContent = "Uploading";

  const jobId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
  startProgressStream(jobId);

  const formData = new FormData();
  uploadedFiles.forEach(file => formData.append('images', file));
  formData.append('format', format);
  formData.append('quality', quality);
  formData.append('jobId', jobId);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', 'https://online-tool-backend.onrender.com/convert', true);

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = (e.loaded / e.total) * 100;
      console.log(`Uploading: ${pct.toFixed(1)}%`);
      renderPct(pct);
      if (progressStateEl) progressStateEl.textContent = "Uploading";
    }
  };

  xhr.responseType = 'blob';
  xhr.onload = function () {
    try { if (progressSource) progressSource.close(); } catch {}
    progressSource = null;

    if (xhr.status < 200 || xhr.status >= 300) {
      console.error('Conversion failed:', xhr.status);
      document.querySelector('.loading-con').style.display = "none";
      alert('Something went wrong while converting the images.');
      return;
    }

    console.log('Upload complete, download starting...');
    const blob = xhr.response;

    // final size + change
    const outMB = (blob.size / (1024 * 1024)).toFixed(2);
    console.log(`Converted download size: ${outMB} MB`);

    if (initialSizeBytes > 0) {
      const delta = ((blob.size - initialSizeBytes) / initialSizeBytes) * 100;
      const deltaPct = Number(delta.toFixed(2));
      const sign = deltaPct > 0 ? '+' : '';
      console.log(`Size change vs. original: ${sign}${deltaPct}%`);

      if (deltaPct < 0 && imagePercent) {
        imagePercent.style.display = 'inline';
        imagePercent.textContent = `${Math.abs(deltaPct)}%`; // no leading minus
      } else if (imagePercent) {
        imagePercent.style.display = 'none';
      }
    }

    const cd = xhr.getResponseHeader('Content-Disposition') || '';
    let filename = 'converted';
    const match = cd.match(/filename="?([^"]+)"?/);
    if (match && match[1]) filename = match[1].trim();

    lastCompressedBlob = blob;
    lastCompressedFilename = filename;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    renderPct(100);
    document.querySelector('.loading-con').style.display = "none";
    document.querySelector('.completion-con').style.display = "flex";
  };

  xhr.onerror = function () {
    console.error('Something went wrong while converting the images.');
    try { if (progressSource) progressSource.close(); } catch {}
    progressSource = null;
    document.querySelector('.loading-con').style.display = "none";
    alert('Something went wrong while converting the images.');
  };

  xhr.send(formData);
}

if (redownloadBtn) {
  redownloadBtn.addEventListener('click', () => {
    if (!lastCompressedBlob || !lastCompressedFilename) {
      alert('No converted images to download. Please convert images first.');
      return;
    }

    const url = window.URL.createObjectURL(lastCompressedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = lastCompressedFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  });
}
