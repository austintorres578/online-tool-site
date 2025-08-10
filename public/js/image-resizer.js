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
// Progress helpers (UI)
// =========================
function renderPct(pct) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  if (percentEl)  percentEl.textContent = `${clamped}%`;
  if (progressEl) progressEl.style.width = `${clamped}%`;
}
function setState(txt) {
  if (progressStateEl) progressStateEl.textContent = txt;
}

// Hook SSE progress stream
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
      // console.log(`Resizing: ${Math.round(pct)}% [${mode}] (${processed}/${total})`);
    } catch {
      /* ignore heartbeats/comments */
    }
  };

  progressSource.addEventListener('end', () => {
    setState('Done');
    renderPct(100);
    try { progressSource.close(); } catch {}
    progressSource = null;
  });

  progressSource.onerror = () => {
    // optional: console.warn('SSE error');
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

    if (!isNaN(width) && !isNaN(height)) {
      const currentRatio = width / height;
      if (currentRatio > targetRatio) width = Math.round(height * targetRatio);
      else height = Math.round(width / targetRatio);

      newWidth.innerText  = width;
      newHeight.innerText = height;
      allNewSizeEls[i].style.opacity = "1";
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

  // reset any shown numbers
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
// Upload / preview
// =========================
if (addMoreIcon) addMoreIcon.addEventListener('click', () => fileInput?.click());

['dragenter', 'dragover'].forEach(ev =>
  dropArea?.addEventListener(ev, (e) => { e.preventDefault(); dropArea.classList.add('dragover'); })
);
['dragleave', 'drop'].forEach(ev =>
  dropArea?.addEventListener(ev, () => dropArea.classList.remove('dragover'))
);

dropArea?.addEventListener('drop', (e) => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files);
  const totalImages = uploadedFiles.length + files.length;
  if (totalImages > 10) { alert('You can only upload up to 10 images.'); return; }

  const invalid = files.filter(f => !f.type.startsWith('image/') || f.size > 10 * 1024 * 1024);
  if (invalid.length) {
    const reasons = invalid.map(f => !f.type.startsWith('image/') ? `❌ ${f.name}: Not an image` : `❌ ${f.name}: Larger than 10MB`).join('\n');
    alert(`Some files were rejected:\n${reasons}`); return;
  }
  handleFiles(files);
});

fileInput?.addEventListener('change', () => {
  const files = Array.from(fileInput.files);
  const totalImages = uploadedFiles.length + files.length;
  if (totalImages > 10) { alert('You can only upload up to 10 images.'); fileInput.value = ''; return; }

  const invalid = files.filter(f => !f.type.startsWith('image/') || f.size > 10 * 1024 * 1024);
  if (invalid.length) {
    const reasons = invalid.map(f => !f.type.startsWith('image/') ? `❌ ${f.name}: Not an image` : `❌ ${f.name}: Larger than 10MB`).join('\n');
    alert(`Some files were rejected:\n${reasons}`); fileInput.value = ''; return;
  }
  handleFiles(files);
});

compressionSlider?.addEventListener('input', () => {
  if (compressionValue) compressionValue.textContent = `${compressionSlider.value}%`;
});

function handleFiles(files) {
  const remainingSlots = 10 - uploadedFiles.length;
  const filesArray = Array.from(files);
  if (filesArray.length > remainingSlots) {
    alert(`You can only upload ${remainingSlots} more image${remainingSlots === 1 ? '' : 's'}.`); return;
  }

  filesArray.forEach(file => {
    if (!file.type.startsWith('image/')) { alert(`${file.name} is not a valid image file.`); return; }
    if (file.size > 10 * 1024 * 1024) { alert(`${file.name} exceeds the 10MB size limit.`); return; }

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
      const isTiff = file.type === 'image/tiff' || file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff');
      img.src = isTiff ? '/images/tiff-placeholder.png' : e.target.result;
      if (isTiff) img.style.boxShadow = 'none';

      img.onload = () => {
        const caption = document.createElement('p'); caption.textContent = file.name;

        const dimensions = document.createElement('div'); dimensions.classList.add('image-dimensions');

        const originalSize = document.createElement('div'); originalSize.classList.add('original-size');
        const origWidthP = document.createElement('p');  origWidthP.textContent = img.naturalWidth;
        const xP         = document.createElement('p');  xP.textContent = '×';
        const origHeightP= document.createElement('p');  origHeightP.textContent = img.naturalHeight;
        originalSize.appendChild(origWidthP); originalSize.appendChild(xP); originalSize.appendChild(origHeightP);

        const newSize = document.createElement('div'); newSize.classList.add('new-size');
        const newWidthP = document.createElement('p');  newWidthP.textContent = '';
        const newX      = document.createElement('p');  newX.textContent = '×';
        const newHeightP= document.createElement('p');  newHeightP.textContent = '';
        newSize.appendChild(newWidthP); newSize.appendChild(newX); newSize.appendChild(newHeightP);

        dimensions.appendChild(originalSize); dimensions.appendChild(newSize);

        container.setAttribute('data-filename', file.name);
        container.setAttribute('data-height', origHeightP.textContent);
        container.setAttribute('data-width',  origWidthP.textContent);

        container.appendChild(buttonWrapper);
        container.appendChild(img);
        container.appendChild(caption);
        container.appendChild(dimensions);

        previewContainer.appendChild(container);
        allNewDimensionsCon = document.querySelectorAll('.new-size');
      };
    };
    reader.readAsDataURL(file);

    document.querySelector('.image-resizer').style.display = 'none';
    document.querySelector('.image-preview-con').style.display = 'flex';
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
    document.querySelector('.image-resizer').style.display = 'flex';
    document.querySelector('.image-preview-con').style.display = 'none';
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
  document.querySelector('.image-preview-con').style.display = "none";
  document.querySelector('.image-resizer-header').style.display = "none";
  document.querySelector('.image-resizer-copy').style.display = "none";

  // progress: start at 0 / Uploading
  setState('Uploading');
  renderPct(0);

  // Make job id and start SSE BEFORE uploading
  const jobId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
  startProgressStream(jobId);

  // Build options per mode
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
    uploadedFiles.forEach((file, i) => { formData.append("images", file); });

  } else if (resizeMode === "By Percent") {
    const allNewSizeEls = document.querySelectorAll('.new-size');
    if (!allNewSizeEls.length || allNewSizeEls[0].children[0].innerText === "0") {
      alert("Please change percentage"); 
      document.querySelector('.loading-con').style.display = "none";
      document.querySelector('.image-preview-con').style.display = "flex";
      document.querySelector('.image-resizer-header').style.display = "block";
      document.querySelector('.image-resizer-copy').style.display = "block";
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
      document.querySelector('.image-preview-con').style.display = "flex";
      document.querySelector('.image-resizer-header').style.display = "block";
      document.querySelector('.image-resizer-copy').style.display = "block";
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

  // include job id so SSE matches this request
  formData.append('jobId', jobId);

  // Send (fetch; SSE shows server progress)
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
      document.querySelector('.image-preview-con').style.display = "flex";
      document.querySelector('.image-resizer-header').style.display = "block";
      document.querySelector('.image-resizer-copy').style.display = "block";
      alert('Something went wrong while resizing the images.');
    });
}

// =========================
// Redownload last file
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
