document.getElementById('year').textContent = new Date().getFullYear();

const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('fileElem');
const previewContainer = document.querySelector('.image-preview-con .image-previews');
const compressBtn = document.getElementById('compress-btn');
const compressionSlider = document.getElementById('compression-slider');
const compressionValue = document.getElementById('compression-value');

let uploadedFiles = [];

['dragenter', 'dragover'].forEach(eventName => {
  dropArea.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropArea.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, () => {
    dropArea.classList.remove('dragover');
  });
});

dropArea.addEventListener('drop', (e) => {
  e.preventDefault();
  const files = e.dataTransfer.files;
  handleFiles(files);
});

fileInput.addEventListener('change', () => {
  handleFiles(fileInput.files);
});

compressionSlider.addEventListener('input', () => {
  compressionValue.textContent = `${compressionSlider.value}%`;
});

function handleFiles(files) {
  Array.from(files).forEach(file => {
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

compressBtn.addEventListener('click', () => {
  if (uploadedFiles.length === 0) {
    alert('No images to compress.');
    return;
  }

  const formData = new FormData();
  uploadedFiles.forEach(file => formData.append('images', file));
  formData.append('quality', compressionSlider.value);

  fetch('http://localhost:3000/compress', {
    method: 'POST',
    body: formData
  })
    .then(res => {
      if (!res.ok) throw new Error('Compression failed');

      const contentDisposition = res.headers.get('Content-Disposition') || '';
      const match = contentDisposition.match(/filename="?(.+?)"?$/);
      const filename = match ? match[1] : 'compressed';

      return res.blob().then(blob => ({ blob, filename }));
    })
    .then(({ blob, filename }) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    })
    .catch(err => {
      console.error('Compression failed:', err);
      alert('Something went wrong while compressing the images.');
    });
});
