document.getElementById('year').textContent = new Date().getFullYear();

const dropArea = document.getElementById('drop-area');

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

function handleFiles(files) {
  // Send files to backend here using FormData
  console.log(files);
}

