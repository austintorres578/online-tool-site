const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('fileElem');
const previewContainer = document.querySelector('.image-preview-con .image-previews');
const compressBtn = document.getElementById('compress-btn');
const compressionSlider = document.getElementById('compression-slider');
const compressionValue = document.getElementById('compression-value');
const addMoreIcon = document.getElementById('add-more-icon');
const redownloadBtn = document.querySelector('.completion-download-button');

let uploadedFiles = [];
let lastCompressedBlob = null;
let lastCompressedFilename = null;

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

dropArea?.addEventListener('drop', (e) => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files);
  const totalImages = uploadedFiles.length + files.length;

  if (totalImages > 10) {
    alert('You can only upload up to 10 images.');
    return;
  }

  const invalidFiles = files.filter(file => !file.type.startsWith('image/'));

  if (invalidFiles.length > 0) {
    const reasons = invalidFiles.map(file => `❌ ${file.name}: Not an image`).join('\n');
    alert(`Some files were rejected:\n${reasons}`);
    return;
  }

  handleFiles(files);
});

fileInput?.addEventListener('change', () => {
  const files = Array.from(fileInput.files);
  const totalImages = uploadedFiles.length + files.length;

  if (totalImages > 10) {
    alert('You can only upload up to 10 images.');
    fileInput.value = '';
    return;
  }

  const invalidFiles = files.filter(file => !file.type.startsWith('image/'));

  if (invalidFiles.length > 0) {
    const reasons = invalidFiles.map(file => `❌ ${file.name}: Not an image`).join('\n');
    alert(`Some files were rejected:\n${reasons}`);
    fileInput.value = '';
    return;
  }

  handleFiles(files);
});

compressionSlider?.addEventListener('input', () => {
  compressionValue.textContent = `${compressionSlider.value}%`;
});

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

        // Set placeholder if TIFF
        img.src = isTiff ? '/images/tiff-placeholder.png' : e.target.result;
        if (isTiff) {
          img.style.boxShadow = 'none';
        }

        const caption = document.createElement('p');
        caption.textContent = file.name;

        container.setAttribute('data-filename', file.name);
        container.appendChild(buttonWrapper);
        container.appendChild(img);
        container.appendChild(caption);

        previewContainer.appendChild(container);
      };
      reader.readAsDataURL(file);

      document.querySelector('.image-compressor').style.display = 'none';
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
    document.querySelector('.image-compressor').style.display = 'flex';
    document.querySelector('.image-preview-con').style.display = 'none';
  }
}

compressBtn?.addEventListener('click', compressImages);

function compressImages() {
  if (uploadedFiles.length === 0) {
    alert('No images to compress.');
    return;
  }

  document.querySelector('.loading-con').style.display = "flex";
  document.querySelector('.image-preview-con').style.display = "none";
  document.querySelector('.image-compressor-header').style.display = "none";
  document.querySelector('.image-compressor-copy').style.display = "none";

  const totalOriginalSize = uploadedFiles.reduce((sum, file) => sum + file.size, 0);
  console.log(`📦 Original Total Size: ${(totalOriginalSize / 1024).toFixed(1)} KB`);

  const startTime = performance.now();

  const formData = new FormData();
  uploadedFiles.forEach(file => formData.append('images', file));
  formData.append('quality', compressionSlider.value);

  fetch('https://online-tool-backend.onrender.com/compress', {
    method: 'POST',
    body: formData
  })
    .then(res => {
      if (!res.ok) throw new Error('Compression failed');

      const contentDisposition = res.headers.get('Content-Disposition') || '';
      let filename = 'compressed';
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1].trim();
      } else {
        const contentType = res.headers.get('Content-Type');
        const extMap = {
          'image/jpeg': '.jpg',
          'image/png': '.png',
          'image/webp': '.webp',
          'image/avif': '.avif',
          'image/bmp': '.bmp',
          'image/tiff': '.tiff',
          'application/zip': '.zip'
        };
        filename += extMap[contentType] || '';
      }

      return res.blob().then(blob => ({ blob, filename }));
    })
    .then(({ blob, filename }) => {
      lastCompressedBlob = blob;
      lastCompressedFilename = filename;

      const endTime = performance.now();
      console.log(`✅ Compression completed in ${(endTime - startTime).toFixed(2)} ms`);
      console.log(`📦 Compressed Size: ${(blob.size / 1024).toFixed(1)} KB`);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      document.querySelector('.loading-con').style.display = "none";
      document.querySelector('.completion-con').style.display = "flex";
      console.log("✅ Compression success");
    })
    .catch(err => {
      console.error('Compression failed:', err);
      document.querySelector('.loading-con').style.display = "none";
      alert('Something went wrong while compressing the images.');
    });
}

redownloadBtn?.addEventListener('click', () => {
  if (!lastCompressedBlob || !lastCompressedFilename) {
    alert('No compressed images to download. Please compress images first.');
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
