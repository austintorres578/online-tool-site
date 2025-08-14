// =========================
// DOM grabs
// =========================
const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('fileElem');
const previewContainer = document.querySelector('.image-preview-con .image-previews');
const compressBtn = document.getElementById('compress-btn');
const compressionSlider = document.getElementById('compression-slider');
const compressionValue = document.getElementById('compression-value');
const addMoreIcon = document.getElementById('add-more-icon');
const redownloadBtn = document.querySelector('.completion-download-button');

// Progress UI
const percentEl = document.querySelector('.loading-percentage');
const progressEl = document.querySelector('.loading-progress');
const progressStateEl = document.querySelector('.progress-state');

// Quick preview loader + hero/preview refs
const loadingCon = document.querySelector('.preview-loading-con'); // spinner while building previews
const previewCon = document.querySelector('.image-preview-con');   // previews section
const resizerEl  = document.querySelector('.image-resizer');       // hero/intro

// Resize controls
let sizeOptions = document.querySelector('.by-size-options');
let percentOptions = document.querySelector('.by-percent-options');
let socialsOptions = document.querySelector('.by-socials-options');
let allResizeOptionTabs = document.querySelector('.image-option-tabs')?.children || [];
let allResizeFitButtons = document.querySelector('.fit-type-buttons-con')?.children || [];
let resizeFitDesc = document.querySelector('.fit-type-desc-con')?.children?.[0] || null;
let lockAspectCheck = document.querySelectorAll('.aspect-checkbox input');
let backgroundFillCheck = document.querySelector('.background-fill input');
let backgroundColorInput = document.querySelector('.background-color input');
let socialSelect = document.querySelector('.socials-list-con')?.children?.[0] || null;
let sizeHeightInput = document.querySelector('.by-size-height');
let sizeWidthInput  = document.querySelector('.by-size-width');
let allNewDimensionsCon;

let currentSocial;
let allSocialSizeButtons = document.querySelectorAll('.social-option');
let resizeMode = "By Size";
let bySizeFit = "Cover";

const percentSlider = document.querySelector('.resize-percent-input');
const percentDisplay = document.querySelector('.resize-percent');

// =========================
// State
// =========================
let uploadedFiles = [];
let lastCompressedBlob = null;
let lastCompressedFilename = null;
let progressSource = null;

// =========================
// Filename soft-wrap helpers
// =========================
function softBreakFilename(filename, chunk = 12) {
  const dot = filename.lastIndexOf('.');
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const ext  = dot > 0 ? filename.slice(dot)    : '';

  const ZWSP = '\u200B';
  const withDelims = base.replace(/([_\-.])/g, `$1${ZWSP}`);
  const withChunks = withDelims.replace(new RegExp(`(.{${chunk}})`, 'g'), `$1${ZWSP}`);
  return withChunks + ext;
}

// =========================
/** Type helpers & validation */
// =========================
const COMMON_IMAGE_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif', '.avif', '.tif', '.tiff'
]);
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB cap

function getExtFromName(name) {
  const n = (name || '');
  const dot = n.lastIndexOf('.');
  return dot >= 0 ? n.slice(dot).toLowerCase() : '';
}
function getExt(file) {
  return getExtFromName(file?.name || '');
}

/** Treat TIFF as valid even if browser leaves MIME blank or uses image/x-tiff */
function isTiff(file) {
  const ext = getExt(file);
  const type = (file?.type || '').toLowerCase();
  return ext === '.tif' || ext === '.tiff' || type === 'image/tiff' || type === 'image/x-tiff';
}

/** Skip decode for formats the browser can’t render in <img> (e.g., TIFF) */
function isBrowserRenderable(file) {
  return !isTiff(file);
}

/** Respect <input accept="..."> but be robust for TIFF & blank MIME */
function isValidFileByAccept(file) {
  const acceptAttr = (fileInput && fileInput.accept ? fileInput.accept : '').trim();
  const acceptTypes = acceptAttr ? acceptAttr.split(',').map(t => t.trim().toLowerCase()) : [];
  const fileExt = getExt(file);
  const mimeType = (file.type || '').toLowerCase();

  if (!acceptTypes.length || (acceptTypes.length === 1 && acceptTypes[0] === '')) {
    return mimeType.startsWith('image/') || COMMON_IMAGE_EXTS.has(fileExt);
  }

  if (acceptTypes.includes('image/*')) {
    if (mimeType.startsWith('image/')) return true;
    if (COMMON_IMAGE_EXTS.has(fileExt)) return true;
  }

  if (acceptTypes.includes(fileExt)) return true;
  if (acceptTypes.includes(mimeType)) return true;

  if (isTiff(file) && (
    acceptTypes.includes('.tif') || acceptTypes.includes('.tiff') ||
    acceptTypes.includes('image/tiff') || acceptTypes.includes('image/x-tiff')
  )) return true;

  return false;
}

function reasonForRejection(file) {
  if (file.size > MAX_SIZE_BYTES) {
    return `Larger than ${(MAX_SIZE_BYTES/1024/1024).toFixed(0)}MB`;
  }
  if (!isValidFileByAccept(file)) {
    const ext  = getExt(file) || '(no ext)';
    const mime = (file.type || 'unknown').toLowerCase();
    return `Unsupported type (${ext} / ${mime})`;
  }
  return null;
}

// =========================
// Progress helpers
// =========================
function renderPct(pct) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  if (percentEl)  percentEl.textContent = `${clamped}%`;
  if (progressEl) progressEl.style.width = `${clamped}%`;
}
function setState(txt) {
  if (progressStateEl) progressStateEl.textContent = txt || '';
}

// =========================
// SSE progress
// =========================
function startProgressStream(jobId) {
  if (progressSource) { try { progressSource.close(); } catch {} progressSource = null; }
  progressSource = new EventSource(`https://online-tool-backend.onrender.com/progress/${jobId}`);

  const labelMap = { resize: 'Resizing', process: 'Processing', zip: 'Packaging' };
  setState('Resizing');

  progressSource.onmessage = (evt) => {
    try {
      const { total, processed, mode, error, message } = JSON.parse(evt.data);
      if (error) {
        console.error('Resize error:', message);
        setState('Error');
        renderPct(0);
        try { progressSource.close(); } catch {}
        progressSource = null;
        return;
      }
      const pct = total ? (processed / total) * 100 : 0;
      setState(labelMap[mode] || 'Resizing');
      renderPct(pct);
    } catch {/* ignore heartbeats */ }
  };

  progressSource.addEventListener('end', () => {
    setState('Done');
    renderPct(100);
    try { progressSource.close(); } catch {}
    progressSource = null;
  });

  progressSource.onerror = () => {
    // optional warn
  };
}

// =========================
// UI helpers for preview & options
// =========================
function applyAspectRatioToPreviews(ratioElement) {
  const allNewSizeEls = document.querySelectorAll('.new-size');
  const allOriginalSize = document.querySelectorAll('.original-size');
  const aspectRatioStr = ratioElement.children[0].dataset.aspect; // "4:5" etc.
  const [aspectW, aspectH] = aspectRatioStr.split(':').map(Number);
  const targetRatio = aspectW / aspectH;

  for (let i = 0; i < allNewSizeEls.length; i++) {
    const preview = allOriginalSize[i];
    const widthEl = preview.children[0];
    const heightEl = preview.children[2];

    let newWidth  = allNewSizeEls[i].children[0];
    let newHeight = allNewSizeEls[i].children[2];

    let width  = parseInt(widthEl.innerText);
    let height = parseInt(heightEl.innerText);

    if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
      const currentRatio = width / height;
      if (currentRatio > targetRatio) width = Math.round(height * targetRatio);
      else height = Math.round(width / targetRatio);

      newWidth.innerText  = width;
      newHeight.innerText = height;
      allNewSizeEls[i].style.opacity = "1";
    } else {
      allNewSizeEls[i].style.opacity = "0";
    }
  }
}

function updateResizePercentDisplay(event) {
  const percent = parseInt(event.target.value);
  if (percentDisplay) percentDisplay.textContent = `${percent}%`;

  const allNewSizeEls = document.querySelectorAll('.new-size');
  const allOriginalSizeEls = document.querySelectorAll('.original-size');

  allNewSizeEls.forEach((newSizeEl, index) => {
    const originalSizeEl = allOriginalSizeEls[index];
    const originalWidth  = parseInt(originalSizeEl.children[0].textContent.trim());
    const originalHeight = parseInt(originalSizeEl.children[2].textContent.trim());

    if (isNaN(originalWidth) || isNaN(originalHeight) || originalWidth === 0 || originalHeight === 0) {
      newSizeEl.style.opacity = '0';
      newSizeEl.children[0].textContent = '0';
      newSizeEl.children[2].textContent = '0';
      return;
    }

    const newWidth  = Math.round(originalWidth  * (percent / 100));
    const newHeight = Math.round(originalHeight * (percent / 100));

    newSizeEl.children[0].textContent = isNaN(newWidth)  ? '0' : newWidth;
    newSizeEl.children[2].textContent = isNaN(newHeight) ? '0' : newHeight;
    newSizeEl.style.opacity = '1';
  });
}
if (percentSlider) percentSlider.addEventListener('input', updateResizePercentDisplay);

function bySizeDimChange() {
  if (!allNewDimensionsCon || !allNewDimensionsCon.length) return;

  if (sizeWidthInput.value.length  > 4) sizeWidthInput.value  = sizeWidthInput.value.slice(0, 4);
  if (sizeHeightInput.value.length > 4) sizeHeightInput.value = sizeHeightInput.value.slice(0, 4);

  let height = sizeHeightInput.value.trim();
  let width  = sizeWidthInput.value.trim();

  const firstWidthText  = allNewDimensionsCon[0].children[0].innerText;
  const firstHeightText = allNewDimensionsCon[0].children[2].innerText;
  const isWidthBlankOrZero  = firstWidthText  === '0' || firstWidthText  === '';
  const isHeightBlankOrZero = firstHeightText === '0' || firstHeightText === '';

  document.querySelectorAll('.new-size').forEach((el, index) => {
    el.style.opacity = (isWidthBlankOrZero && isHeightBlankOrZero) ? '0' : '1';
    allNewDimensionsCon[index].children[0].innerText = width;
    allNewDimensionsCon[index].children[2].innerText = height;
  });
}
if (sizeHeightInput) sizeHeightInput.addEventListener('input', bySizeDimChange);
if (sizeWidthInput)  sizeWidthInput.addEventListener('input', bySizeDimChange);

function selectSocialSize(event) {
  const target = event?.target;
  if (!target) return;

  for (let i = 0; i < allSocialSizeButtons.length; i++) {
    if (target === allSocialSizeButtons[i]) allSocialSizeButtons[i].classList.add('active');
    else allSocialSizeButtons[i].classList.remove('active');
  }
  applyAspectRatioToPreviews(target);
}
allSocialSizeButtons.forEach(button => button.addEventListener('click', selectSocialSize));

function changeSocialsTab(event) {
  if (!event || !event.target) return;
  if (event.target.value === "Instagram") currentSocial = "instagram-list";
  else if (event.target.value === "Facebook") currentSocial = "facebook-list";
  else if (event.target.value === "X") currentSocial = "x-list";
  else if (event.target.value === "Youtube") currentSocial = "youtube-list";
  else if (event.target.value === "LinkedIn") currentSocial = "linkedin-list";

  const lists = document.querySelectorAll('.social-options-con');
  lists.forEach(el => el.style.display = (el.classList[0] === currentSocial ? "flex" : "none"));

  document.querySelectorAll('.new-size').forEach(el => {
    el.style.opacity = '0';
    el.children[0].innerText = "0";
    el.children[2].innerText = "0";
  });
}
if (socialSelect) socialSelect.addEventListener('change', changeSocialsTab);

function revealAspectLockOptions(event) {
  const parent = event.target.parentNode;
  const isChecked = event.target.checked;
  const box = parent?.parentNode?.querySelector('.aspect-ratio-options');
  if (box) box.style.display = isChecked ? 'block' : 'none';
}
lockAspectCheck.forEach(cb => cb.addEventListener('change', revealAspectLockOptions));

function backgroundFillCheckToggle() {}
if (backgroundFillCheck) backgroundFillCheck.addEventListener('change', backgroundFillCheckToggle);
function backgroundColorInputGrabber() {}
if (backgroundColorInput) backgroundColorInput.addEventListener('change', backgroundColorInputGrabber);

function selectFitType(event) {
  const name = event.target.getAttribute('data-name');
  const desc = event.target.getAttribute('data-desc');

  for (let i = 0; i < allResizeFitButtons.length; i++) {
    if (allResizeFitButtons[i] === event.target) {
      bySizeFit = event.target.innerText;
      allResizeFitButtons[i].classList.add('active');
    } else {
      allResizeFitButtons[i].classList.remove('active');
    }
  }
  if (resizeFitDesc) resizeFitDesc.innerText = desc || '';
}
Array.from(allResizeFitButtons).forEach(btn => btn.addEventListener('click', selectFitType));

function changeResizeTab(event) {
  for (let i = 0; i < allResizeOptionTabs.length; i++) {
    if (allResizeOptionTabs[i] === event.target) {
      allResizeOptionTabs[i].classList.add('active');
      resizeMode = event.target.innerText;
    } else {
      allResizeOptionTabs[i].classList.remove('active');
    }
  }

  if (event.target.innerText === "By Size") {
    if (sizeOptions) sizeOptions.style.display = "block";
    if (percentOptions) percentOptions.style.display = "none";
    if (socialsOptions) socialsOptions.style.display = "none";
  } else if (event.target.innerText === "By Percent") {
    if (sizeOptions) sizeOptions.style.display = "none";
    if (percentOptions) percentOptions.style.display = "block";
    if (socialsOptions) socialsOptions.style.display = "none";
    if (sizeHeightInput) sizeHeightInput.value = "";
    if (sizeWidthInput)  sizeWidthInput.value = "";
  } else if (event.target.innerText === "By Socials") {
    if (sizeOptions) sizeOptions.style.display = "none";
    if (percentOptions) percentOptions.style.display = "none";
    if (socialsOptions) socialsOptions.style.display = "block";
  }

  document.querySelectorAll('.new-size').forEach(el => {
    el.style.opacity = '0';
    el.children[0].innerText = "0";
    el.children[2].innerText = "0";
  });
}
Array.from(allResizeOptionTabs).forEach(tab => tab.addEventListener('click', changeResizeTab));

// =========================
// Decode guard (browser renderability aware)
// =========================
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
      if (!settled) { settled = true; clean(); resolve(false); }
    }, timeoutMs);

    img.onload = () => { if (!settled) { settled = true; clean(); resolve(true); } };
    img.onerror = () => { if (!settled) { settled = true; clean(); resolve(false); } };

    img.src = url;
  });
}

// =========================
// Accept & process files (loader pattern you requested)
// =========================
async function acceptFiles(files) {
  // 1) Show loader, hide previews while processing; do NOT hide hero yet (per your pattern, we hide it)
  if (loadingCon) loadingCon.style.display = 'flex';
  if (previewCon) previewCon.style.display = 'none';
  if (resizerEl)  resizerEl.style.display = 'none';

  // 2) Enforce max cap
  const remainingSlots = Math.max(0, 10 - uploadedFiles.length);
  const batch = Array.from(files).slice(0, remainingSlots);
  if (batch.length === 0) {
    alert('You can only upload up to 10 images.');
    if (loadingCon) loadingCon.style.display = 'none';
    if (resizerEl) {
      resizerEl.style.display = 'flex';
      resizerEl.style.flexDirection = 'column';
    }
    return;
  }

  let acceptedAny = false;

  // 3) Process sequentially (decode guard + build preview), keep loader visible
  for (const file of batch) {
    const rejectReason = reasonForRejection(file);
    if (rejectReason) {
      console.warn(`Rejected ${file.name}: ${rejectReason}`);
      alert(`"${file.name}" was rejected: ${rejectReason}`);
      continue;
    }

    // Only decode if browser can render it (skip TIFF)
    let ok = true;
    if (isBrowserRenderable(file)) {
      ok = await decodeImage(file);
    }
    if (!ok) {
      console.warn(`Skipped broken image: ${file.name}`);
      alert(`"${file.name}" is broken or corrupted and cannot be used.`);
      continue;
    }

    await buildPreviewWithDimensions(file); // pushes into uploadedFiles inside
    acceptedAny = true;
  }

  // 4) All done: hide loader, then either show previews (and hide hero) or restore hero
  if (loadingCon) loadingCon.style.display = 'none';

  if (acceptedAny) {
    if (resizerEl) resizerEl.style.display = 'none';
    if (previewCon) previewCon.style.display = 'flex';
  } else {
    if (resizerEl) {
      resizerEl.style.display = 'flex';
      resizerEl.style.flexDirection = 'column';
    }
    if (previewCon) previewCon.style.display = 'none';
  }
}

// Build preview (with dimensions if browser can load the image)
function buildPreviewWithDimensions(file) {
  return new Promise((resolve) => {
    uploadedFiles.push(file);

    const reader = new FileReader();
    reader.onload = function (e) {
      const container = document.createElement('div');
      container.classList.add('image-preview-item');

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

      const makeCommonBlocks = (origW, origH) => {
        const caption = document.createElement('p');
        caption.className = 'image-caption';
        caption.style.whiteSpace   = 'normal';
        caption.style.wordBreak    = 'break-word';
        caption.style.overflowWrap = 'anywhere';
        caption.style.maxWidth     = '100%';
        caption.style.display      = 'block';
        caption.textContent = softBreakFilename(file.name, 12);
        caption.title = file.name;

        const dimensions = document.createElement('div'); dimensions.classList.add('image-dimensions');

        const originalSize = document.createElement('div'); originalSize.classList.add('original-size');
        const origWidthP = document.createElement('p');  origWidthP.textContent  = String(origW || 0);
        const xP         = document.createElement('p');  xP.textContent          = '×';
        const origHeightP= document.createElement('p');  origHeightP.textContent = String(origH || 0);
        originalSize.appendChild(origWidthP); originalSize.appendChild(xP); originalSize.appendChild(origHeightP);

        const newSize = document.createElement('div'); newSize.classList.add('new-size');
        const newWidthP = document.createElement('p');  newWidthP.textContent  = '0';
        const newX      = document.createElement('p');  newX.textContent       = '×';
        const newHeightP= document.createElement('p');  newHeightP.textContent = '0';
        newSize.appendChild(newWidthP); newSize.appendChild(newX); newSize.appendChild(newHeightP);
        newSize.style.opacity = '0';

        dimensions.appendChild(originalSize); dimensions.appendChild(newSize);

        container.setAttribute('data-filename', file.name);
        container.setAttribute('data-height', String(origH || 0));
        container.setAttribute('data-width',  String(origW || 0));

        container.appendChild(buttonWrapper);
        container.appendChild(img);
        container.appendChild(caption);
        container.appendChild(dimensions);

        previewContainer.appendChild(container);
        allNewDimensionsCon = document.querySelectorAll('.new-size');
      };

      if (tiff) {
        // Can't load dims via <img>; show placeholder and 0×0 (keeps downstream math safe)
        makeCommonBlocks(0, 0);
        resolve();
      } else {
        img.onload = () => {
          makeCommonBlocks(img.naturalWidth, img.naturalHeight);
          resolve();
        };
      }
    };
    reader.readAsDataURL(file);
  });
}

// =========================
// Upload triggers use acceptFiles
// =========================
if (addMoreIcon) addMoreIcon.addEventListener('click', () => fileInput?.click());

['dragenter', 'dragover'].forEach(ev =>
  dropArea?.addEventListener(ev, (e) => { e.preventDefault(); dropArea.classList.add('dragover'); })
);
['dragleave', 'drop'].forEach(ev =>
  dropArea?.addEventListener(ev, () => dropArea.classList.remove('dragover'))
);

dropArea?.addEventListener('drop', async (e) => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files);
  await acceptFiles(files);
});

fileInput?.addEventListener('change', async () => {
  const files = Array.from(fileInput.files);
  await acceptFiles(files);
});

// keep the compression value UI in sync
compressionSlider?.addEventListener('input', () => {
  if (compressionValue) compressionValue.textContent = `${compressionSlider.value}%`;
});

// =========================
// Remove preview item
// =========================
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
    if (resizerEl) {
      resizerEl.style.display = 'flex';
      resizerEl.style.flexDirection = 'column';
    }
    if (previewCon) previewCon.style.display = 'none';
  }
}

// =========================
// Start resize / compress
// =========================
compressBtn?.addEventListener('click', compressImages);

function compressImages() {
  const formData = new FormData();

  if (uploadedFiles.length === 0) { alert('No images to compress.'); return; }

  document.querySelector('.loading-con').style.display = "flex";
  if (previewCon) previewCon.style.display = "none";
  document.querySelector('.image-resizer-header')?.style.setProperty('display', 'none');
  document.querySelector('.image-resizer-copy')?.style.setProperty('display', 'none');

  setState('Uploading');
  renderPct(0);

  const jobId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
  startProgressStream(jobId);

  if (resizeMode === "By Size") {
    const activeFit = document.querySelector('.fit-type-buttons-con button.active');
    const fit = (activeFit?.dataset?.name || 'cover').toLowerCase();

    const resizeOptions = {
      mode: "size",
      width:  parseInt(document.querySelector(".by-size-width")?.value)  || undefined,
      height: parseInt(document.querySelector(".by-size-height")?.value) || undefined,
      fit,
      lockAspect:     document.querySelector('.aspect-checkbox input')?.checked || false,
      backgroundFill: document.querySelector('.background-fill input')?.checked || false,
      backgroundColor:document.querySelector('.background-color input')?.value || '#000000'
    };

    formData.append("options", JSON.stringify(resizeOptions));
    uploadedFiles.forEach((file) => { formData.append("images", file); });

  } else if (resizeMode === "By Percent") {
    const allNewSizeEls = document.querySelectorAll('.new-size');
    if (!allNewSizeEls.length || allNewSizeEls[0].children[0].innerText === "0") {
      alert("Please change percentage");
      document.querySelector('.loading-con').style.display = "none";
      if (previewCon) previewCon.style.display = "flex";
      document.querySelector('.image-resizer-header')?.style.setProperty('display', 'block');
      document.querySelector('.image-resizer-copy')?.style.setProperty('display', 'block');
      setState(''); renderPct(0);
      return;
    }
    allNewSizeEls.forEach((el, index) => {
      const newWidth  = parseInt(el.children[0].textContent.trim());
      const newHeight = parseInt(el.children[2].textContent.trim());
      formData.append("options", JSON.stringify({ mode: "percent", width: newWidth, height: newHeight }));
      formData.append("images", uploadedFiles[index]);
    });

  } else if (resizeMode === "By Socials") {
    const allNewSizeEls = document.querySelectorAll('.new-size');
    if (!allNewSizeEls.length || allNewSizeEls[0].children[0].innerText === "0") {
      alert("Please select an aspect ratio to resize.");
      document.querySelector('.loading-con').style.display = "none";
      if (previewCon) previewCon.style.display = "flex";
      document.querySelector('.image-resizer-header')?.style.setProperty('display', 'block');
      document.querySelector('.image-resizer-copy')?.style.setProperty('display', 'block');
      setState(''); renderPct(0);
      return;
    }
    allNewSizeEls.forEach((el, index) => {
      const newWidth  = parseInt(el.children[0].textContent.trim());
      const newHeight = parseInt(el.children[2].textContent.trim());
      if (!newWidth || !newHeight) { console.warn(`Skipping image ${index + 1}: invalid resized dimensions.`); return; }

      formData.append("options", JSON.stringify({
        mode: "social",
        width: newWidth,
        height: newHeight,
        lockAspect:     document.querySelector('.by-socials-options .aspect-checkbox input')?.checked || false,
        backgroundFill: document.querySelector('.by-socials-options .background-fill input')?.checked || false,
        backgroundColor:document.querySelector('.by-socials-options .background-color input')?.value || '#000000'
      }));
      formData.append("images", uploadedFiles[index]);
    });
  }

  formData.append('jobId', jobId);

  fetch('https://online-tool-backend.onrender.com/resize', { method: 'POST', body: formData })
    .then(res => {
      if (!res.ok) throw new Error('Resize failed');

      const cd = res.headers.get('Content-Disposition') || '';
      let filename = 'resized';
      const match = cd.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1].trim();
      } else {
        const ct = res.headers.get('Content-Type');
        const extMap = {
          'image/jpeg': '.jpg','image/png': '.png','image/webp': '.webp','image/avif': '.avif',
          'image/bmp': '.bmp','image/tiff': '.tiff','application/zip': '.zip'
        };
        filename += extMap[ct] || '';
      }
      return res.blob().then(blob => ({ blob, filename }));
    })
    .then(({ blob, filename }) => {
      setState('Done');
      renderPct(100);

      lastCompressedBlob = blob;
      lastCompressedFilename = filename;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);

      document.querySelector('.loading-con').style.display = "none";
      document.querySelector('.completion-con').style.display = "flex";
    })
    .catch(err => {
      console.error('Resize failed:', err);
      setState('Error'); renderPct(0);

      document.querySelector('.loading-con').style.display = "none";
      if (previewCon) previewCon.style.display = "flex";
      document.querySelector('.image-resizer-header')?.style.setProperty('display', 'block');
      document.querySelector('.image-resizer-copy')?.style.setProperty('display', 'block');
      alert('Something went wrong while resizing the images.');
    });
}

// =========================
redownloadBtn?.addEventListener('click', () => {
  if (!lastCompressedBlob || !lastCompressedFilename) {
    alert('No compressed images to download. Please compress images first.');
    return;
  }
  const url = window.URL.createObjectURL(lastCompressedBlob);
  const a = document.createElement('a');
  a.href = url; a.download = lastCompressedFilename;
  document.body.appendChild(a); a.click(); a.remove();
  window.URL.revokeObjectURL(url);
});
