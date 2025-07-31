const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('fileElem');
const previewContainer = document.querySelector('.image-preview-con .image-previews');
const compressBtn = document.getElementById('compress-btn');
const compressionSlider = document.getElementById('compression-slider');
const compressionValue = document.getElementById('compression-value');
const addMoreIcon = document.getElementById('add-more-icon');
const redownloadBtn = document.querySelector('.completion-download-button');

let imageTypeButtonCon = document.querySelector('.conversion-options');
let allTypeButtons = imageTypeButtonCon.querySelectorAll('button');

function selectImageType(event) {
  for (let i = 0; i < allTypeButtons.length; i++) {
    allTypeButtons[i].classList.toggle('active', allTypeButtons[i] === event.target);
  }
}
allTypeButtons.forEach(button => button.addEventListener('click', selectImageType));

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

function isValidFile(file, acceptTypes) {
  const fileExt = '.' + file.name.split('.').pop().toLowerCase();
  const mimeType = file.type.toLowerCase();
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
        img.src = e.target.result;

        const caption = document.createElement('p');
        caption.textContent = file.name;

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
    document.querySelector('.image-preview-con').style.display = 'none';
  }
}

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

  const format = activeTypeButton.textContent.toLowerCase() === 'jpg' ? 'jpeg' : activeTypeButton.textContent.toLowerCase();
  const quality = compressionSlider.value;

  document.querySelector('.loading-con').style.display = "flex";
  document.querySelector('.image-preview-con').style.display = "none";
  document.querySelector('.image-converter-header').style.display = "none";
  document.querySelector('.image-converter-copy').style.display = "none";

  const formData = new FormData();
  uploadedFiles.forEach(file => formData.append('images', file));
  formData.append('format', format);
  formData.append('quality', quality);

  fetch('https://online-tool-backend.onrender.com/convert', {
    method: 'POST',
    body: formData
  })
    .then(res => {
      if (!res.ok) throw new Error('Conversion failed');

      const contentDisposition = res.headers.get('Content-Disposition') || '';
      let filename = 'converted';
      const match = contentDisposition.match(/filename="?([^\"]+)"?/);
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
    })
    .catch(err => {
      console.error('Conversion failed:', err);
      document.querySelector('.loading-con').style.display = "none";
      alert('Something went wrong while converting the images.');
    });
}

if (redownloadBtn) {
  redownloadBtn.addEventListener('click', () => {
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
}