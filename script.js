  document.getElementById('year').textContent = new Date().getFullYear();

  const dropArea = document.getElementById('drop-area');
  const fileInput = document.getElementById('fileElem');
  const previewContainer = document.querySelector('.image-preview-con .image-previews');

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
    console.log('Dropped files:', files);
    handleFiles(files);
  });

  fileInput.addEventListener('change', () => {
    console.log('Selected files:', fileInput.files);
    handleFiles(fileInput.files);
  });

  function handleFiles(files) {
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function (e) {
          const container = document.createElement('div');
          container.classList.add('image-preview-item');

          const buttonWrapper = document.createElement('div');
          buttonWrapper.className = 'image-preview-buttons';

          const removeBtn = document.createElement('button');
          removeBtn.className = 'remove-button';
          removeBtn.textContent = 'X';
          removeBtn.addEventListener('click', removeUncompressedImage);

          buttonWrapper.appendChild(removeBtn);

          const img = document.createElement('img');
          img.src = e.target.result;

          const caption = document.createElement('p');
          const maxChars = 50;
          caption.textContent = file.name.length > maxChars
            ? file.name.substring(0, maxChars - 3) + '...'
            : file.name;

          container.appendChild(buttonWrapper);
          container.appendChild(img);
          container.appendChild(caption);

          previewContainer.appendChild(container);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  function removeUncompressedImage(event) {
    const container = event.target.closest('.image-preview-item');
    if (container) {
      container.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      container.style.opacity = '0';
      container.style.transform = 'scale(0.95)';
      setTimeout(() => container.remove(), 300);
    }
  }