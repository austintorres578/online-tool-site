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

let imageTypeButtonCon = document.querySelector('.conversion-options');
let allTypeButtons = imageTypeButtonCon.querySelectorAll('button');
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
  if (progressEl) progressEl.style.width = `${clamped}%`;
}

allTypeButtons.forEach(button => button.addEventListener('click', selectImageType));

if (addMoreIcon) {
  addMoreIcon.addEventListener('click', () => fileInput.click());
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

function isValidFile(file, acceptTypes) {
  const fileExt = '.' + file.name.split('.').pop().toLowerCase();
  const mimeType = (file.type || '').toLowerCase();
  return (
    (acceptTypes.includes('image/*') && file.type.startsWith('image/')) ||
    acceptTypes.includes(fileExt) ||
    acceptTypes.includes(mimeType)
  );
}

function validateFiles(files, acceptTypes) {
  return files.filter(file => !isValidFile(file, acceptTypes));
}

if (dropArea) {
  dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const acceptTypes = fileInput.accept.trim().split(',').map(type => type.trim().toLowerCase());

    const invalidFiles = validateFiles(files, acceptTypes);
    if (invalidFiles.length > 0) {
      const reasons = invalidFiles.map(file => {
        if (!file.type.startsWith('image/')) return `❌ ${file.name}: Not an image`;
      }).join('\n');
      alert(`Some files were rejected:\n${reasons}`);
      return;
    }

    const totalImages = uploadedFiles.length + files.length;
    if (totalImages > 10) {
      alert('You can only upload up to 10 images.');
      return;
    }

    handleFiles(files);
  });
}

if (fileInput) {
  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files);
    const acceptTypes = fileInput.accept.trim().split(',').map(type => type.trim().toLowerCase());

    const invalidFiles = validateFiles(files, acceptTypes);
    if (invalidFiles.length > 0) {
      const reasons = invalidFiles.map(file => {
        if (!file.type.startsWith('image/')) return `❌ ${file.name}: Not an image`;
      }).join('\n');
      alert(`Some files were rejected:\n${reasons}`);
      fileInput.value = '';
      return;
    }

    const totalImages = uploadedFiles.length + files.length;
    if (totalImages > 10) {
      alert('You can only upload up to 10 images.');
      fileInput.value = '';
      return;
    }

    handleFiles(files);
  });
}

if (compressionSlider) {
  compressionSlider.addEventListener('input', () => {
    compressionValue.textContent = `${compressionSlider.value}%`;
  });
}

function handleFiles(files) {
  const remainingSlots = 10 - uploadedFiles.length;
  const filesArray = Array.from(files);

  if (filesArray.length > remainingSlots) {
    alert(`You can only upload ${remainingSlots} more image${remainingSlots === 1 ? '' : 's'}.`);
    return;
  }

  filesArray.forEach(file => {
    if (file.type.startsWith('image/')) {
      uploadedFiles.push(file);

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
        const isTiff = file.type === 'image/tiff' || file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff');

        img.src = isTiff ? '/images/tiff-placeholder.png' : e.target.result;
        if (isTiff) {
          img.style.boxShadow = 'none';
        }

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
      };
      reader.readAsDataURL(file);

      document.querySelector('.image-converter').style.display = 'none';
      document.querySelector('.image-preview-con').style.display = 'flex';
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
    document.querySelector('.image-converter').style.display = 'flex';
    document.querySelector('.image-converter').style.flexDirection = 'column';
    document.querySelector('.image-preview-con').style.display = 'none';
  }
}

if (compressBtn) {
  compressBtn.addEventListener('click', convertImages);
}

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

  const format = activeTypeButton.textContent.toLowerCase() === 'jpg' ? 'jpeg' : activeTypeButton.textContent.toLowerCase();
  const quality = compressionSlider.value;

  // ✅ Log initial total size (MB) before conversion
  const initialSizeBytes = uploadedFiles.reduce((sum, f) => sum + f.size, 0);
  const initialMB = (initialSizeBytes / (1024 * 1024)).toFixed(2);
  console.log(`Initial upload size: ${initialMB} MB`);

  document.querySelector('.loading-con').style.display = "flex";
  document.querySelector('.image-preview-con').style.display = "none";
  document.querySelector('.image-converter-header').style.display = "none";
  document.querySelector('.image-converter-copy').style.display = "none";
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

    // ✅ Log final downloaded size (MB) and % change vs initial
    const outMB = (blob.size / (1024 * 1024)).toFixed(2);
    console.log(`Converted download size: ${outMB} MB`);
    if (initialSizeBytes > 0) {
      const deltaPct = ((blob.size - initialSizeBytes) / initialSizeBytes * 100).toFixed(2);
      const sign = deltaPct > 0 ? '+' : '';
      console.log(`Size change vs. original: ${sign}${deltaPct}%`);
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
