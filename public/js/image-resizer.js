const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('fileElem');
const previewContainer = document.querySelector('.image-preview-con .image-previews');
const compressBtn = document.getElementById('compress-btn');
const compressionSlider = document.getElementById('compression-slider');
const compressionValue = document.getElementById('compression-value');
const addMoreIcon = document.getElementById('add-more-icon');
const redownloadBtn = document.querySelector('.completion-download-button');

let sizeOptions = document.querySelector('.by-size-options');
let percentOptions = document.querySelector('.by-percent-options');
let socialsOptions = document.querySelector('.by-socials-options');

let allResizeOptionTabs = document.querySelector('.image-option-tabs').children;

let allResizeFitButtons = document.querySelector('.fit-type-buttons-con').children;

let resizeFitDesc = document.querySelector('.fit-type-desc-con').children[0];

let lockAspectCheck = document.querySelector('.aspect-checkbox input');

let backgroundFillCheck = document.querySelector('.background-fill input');

let backgroundColorInput = document.querySelector('.background-color input');

let socialSelect = document.querySelector('.socials-list-con').children[0];

let sizeHeightInput = document.querySelector('.by-size-height');
let sizeWidthInput = document.querySelector('.by-size-width');
let allNewDimensionsCon;


let currentSocial;

let allSocialSizeButtons = document.querySelectorAll('.social-option')

let resizeMode = "By Size";

let bySizeFit = "Cover";

const percentSlider = document.querySelector('.resize-percent-input');
const percentDisplay = document.querySelector('.resize-percent');

function updateResizePercentDisplay(event) {
  const percent = parseInt(event.target.value);
  percentDisplay.textContent = `${percent}%`;

  const allNewSizeEls = document.querySelectorAll('.new-size');
  const allOriginalSizeEls = document.querySelectorAll('.original-size');

  allNewSizeEls.forEach((newSizeEl, index) => {
    const originalSizeEl = allOriginalSizeEls[index];

    const originalWidth = parseInt(originalSizeEl.children[0].textContent.trim());
    const originalHeight = parseInt(originalSizeEl.children[2].textContent.trim());

    const newWidth = Math.round(originalWidth * (percent / 100));
    const newHeight = Math.round(originalHeight * (percent / 100));

    newSizeEl.children[0].textContent = isNaN(newWidth) ? '0' : newWidth;
    newSizeEl.children[2].textContent = isNaN(newHeight) ? '0' : newHeight;

    newSizeEl.style.opacity = '1';
  });
}


percentSlider.addEventListener('input', updateResizePercentDisplay);



function bySizeDimChange(event) {
  let height = sizeHeightInput.value.trim();
  let width = sizeWidthInput.value.trim();

  const allNewSizeEls = document.querySelectorAll('.new-size');

  if (height === '') {
    height = '0';
    sizeHeightInput.value = '0';
  }

  if (width === '') {
    width = '0';
    sizeWidthInput.value = '0';
  }

  allNewSizeEls.forEach((el, index) => {
    const isZero = height === '0' && width === '0';
    el.style.opacity = isZero ? '0' : '1';

    allNewDimensionsCon[index].children[0].innerText = width;  // ✅
    allNewDimensionsCon[index].children[2].innerText = height; // ✅
  });
}


sizeHeightInput.addEventListener('input', bySizeDimChange);
sizeWidthInput.addEventListener('input', bySizeDimChange);

function selectSocialSize(event){
  console.log(event.target);
  for (let index = 0; index < allSocialSizeButtons.length; index++) {
    if(event.target===allSocialSizeButtons[index]){
      allSocialSizeButtons[index].classList.add('active')
    }else{
      allSocialSizeButtons[index].classList.remove('active')
    }
    
  }
}

allSocialSizeButtons.forEach(button => {
  button.addEventListener('click', selectSocialSize);
});


function changeSocialsTab(event){


  if(event.target.value==="Instagram"){
    currentSocial="instagram-list";
  } else if(event.target.value==="Facebook"){
    currentSocial="facebook-list";
  } else if(event.target.value==="X"){
    currentSocial="x-list";
  }else if(event.target.value==="Youtube"){
    currentSocial="youtube-list";
  }else if(event.target.value==="LinkedIn"){
    currentSocial="linkedin-list";
  }

  for (let index = 0; index < document.querySelectorAll('.social-options-con').length; index++) {
    if(document.querySelectorAll('.social-options-con')[index].classList[0]===currentSocial){
      document.querySelectorAll('.social-options-con')[index].style.display="flex";
    }else{
      document.querySelectorAll('.social-options-con')[index].style.display="none";
    }
    
  }

  


  selectSocialSize('reset')

}

socialSelect.addEventListener('change',changeSocialsTab);

function revealAspectLockOptions(event) {

  console.log(lockAspectCheck.checked);

  const isChecked = event.target.checked;
  console.log('Checkbox is checked:', isChecked);

  if (isChecked) {
    // Example: Show aspect lock options
    document.querySelector('.aspect-ratio-options').style.display = 'block';
  } else {
    // Example: Hide aspect lock options
    document.querySelector('.aspect-ratio-options').style.display = 'none';
  }
}

lockAspectCheck.addEventListener('change', revealAspectLockOptions);

function backgroundFillCheckToggle(event){
  console.log(backgroundFillCheck.checked)
}

backgroundFillCheck.addEventListener('change',backgroundFillCheckToggle)

function backgroundColorInputGrabber(){
  console.log(backgroundColorInput.value)
}

backgroundColorInput.addEventListener('change',backgroundColorInputGrabber);


function selectFitType(event){
  
  let name = event.target.getAttribute('data-name');
  let desc = event.target.getAttribute('data-desc');

  for (let index = 0; index < allResizeFitButtons.length; index++) {
    if(allResizeFitButtons[index]===event.target){
        bySizeFit = event.target.innerText
        allResizeFitButtons[index].classList.add('active')
    }
    else(
        allResizeFitButtons[index].classList.remove('active')
    )

    if(name==="Contain"){
        resizeFitDesc.innerText=desc
    }else if(name==="Cover"){
        resizeFitDesc.innerText=desc
    }else if(name==="Inside"){
        resizeFitDesc.innerText=desc
    }else if(name==="Outside"){
        resizeFitDesc.innerText=desc
    }else if(name==="Fill"){
        resizeFitDesc.innerText=desc
    }

  }

console.log(bySizeFit);

}

Array.from(allResizeFitButtons).forEach(button => {
  button.addEventListener('click', selectFitType);
});


function changeResizeTab(event) {

    

    for (let index = 0; index < allResizeOptionTabs.length; index++) {
        if(allResizeOptionTabs[index]===event.target){
            allResizeOptionTabs[index].classList.add('active');
            resizeMode = event.target.innerText;
        }else{
            allResizeOptionTabs[index].classList.remove('active');
        }
    }
  
        
    if(event.target.innerText==="By Size"){
        sizeOptions.style.display="block";
        percentOptions.style.display="none";
        socialsOptions.style.display="none";
    }
    else if(event.target.innerText==="By Percent"){
        sizeOptions.style.display="none";
        percentOptions.style.display="block";
        socialsOptions.style.display="none";

    }else if(event.target.innerText==="By Socials"){
        sizeOptions.style.display="none";
        percentOptions.style.display="none";
        socialsOptions.style.display="block";
    }

    const allNewSizeEls = document.querySelectorAll('.new-size');

    allNewSizeEls.forEach(el => {
      el.style.opacity = '0';

      el.children[0].innerText="0";
      el.children[2].innerText="0";
    });
  
}

Array.from(allResizeOptionTabs).forEach(tab => {
  tab.addEventListener('click', changeResizeTab);
});


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

  const invalidFiles = files.filter(file => {
    return !file.type.startsWith('image/') || file.size > 10 * 1024 * 1024;
  });

  if (invalidFiles.length > 0) {
    const reasons = invalidFiles.map(file => {
      if (!file.type.startsWith('image/')) return `❌ ${file.name}: Not an image`;
      if (file.size > 10 * 1024 * 1024) return `❌ ${file.name}: Larger than 10MB`;
    }).join('\n');
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

  const invalidFiles = files.filter(file => {
    return !file.type.startsWith('image/') || file.size > 10 * 1024 * 1024;
  });

  if (invalidFiles.length > 0) {
    const reasons = invalidFiles.map(file => {
      if (!file.type.startsWith('image/')) return `❌ ${file.name}: Not an image`;
      if (file.size > 10 * 1024 * 1024) return `❌ ${file.name}: Larger than 10MB`;
    }).join('\n');
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
    if (!file.type.startsWith('image/')) {
      alert(`${file.name} is not a valid image file.`);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert(`${file.name} exceeds the 10MB size limit.`);
      return;
    }

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

      img.onload = () => {
        const caption = document.createElement('p');
        caption.textContent = file.name;

        const dimensions = document.createElement('div');
        dimensions.classList.add('image-dimensions');

        // Original size block
        const originalSize = document.createElement('div');
        originalSize.classList.add('original-size');

        const origWidthP = document.createElement('p');
        origWidthP.textContent = img.naturalWidth;

        const xP = document.createElement('p');
        xP.textContent = '×';

        const origHeightP = document.createElement('p');
        origHeightP.textContent = img.naturalHeight;

        originalSize.appendChild(origWidthP);
        originalSize.appendChild(xP);
        originalSize.appendChild(origHeightP);

        // New size block (placeholder for future resizing)
        const newSize = document.createElement('div');
        newSize.classList.add('new-size');

        const newWidthP = document.createElement('p');
        newWidthP.textContent = ''; // Set dynamically later

        const newX = document.createElement('p');
        newX.textContent = '×';

        const newHeightP = document.createElement('p');
        newHeightP.textContent = ''; // Set dynamically later

        newSize.appendChild(newWidthP);
        newSize.appendChild(newX);
        newSize.appendChild(newHeightP);

        // Final structure
        dimensions.appendChild(originalSize);
        dimensions.appendChild(newSize);

        container.setAttribute('data-filename', file.name);
        container.setAttribute('data-height', origHeightP.textContent);
        container.setAttribute('data-width', origWidthP.textContent);

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

compressBtn?.addEventListener('click', compressImages);

function compressImages() {

  if(resizeMode==="By Size"){
    console.log("By Size Mode")
  }else if(resizeMode==="By Percent"){
    console.log("By Percent")
  }else if(resizeMode==="By Socials"){
    console.log("By Socials")
  }

  

  // document.querySelector('.loading-con').style.display = "flex";
  // document.querySelector('.image-preview-con').style.display = "none";
  // document.querySelector('.image-resizer-header').style.display = "none";
  // document.querySelector('.image-resizer-copy').style.display = "none";

  // if (uploadedFiles.length === 0) {
  //   alert('No images to compress.');
  //   return;
  // }

  // const totalOriginalSize = uploadedFiles.reduce((sum, file) => sum + file.size, 0);
  // console.log(`📦 Original Total Size: ${(totalOriginalSize / 1024).toFixed(1)} KB`);

  // const startTime = performance.now();

  // const formData = new FormData();
  // uploadedFiles.forEach(file => formData.append('images', file));
  // formData.append('quality', compressionSlider.value);

  // fetch('https://online-tool-backend.onrender.com/compress', {
  //   method: 'POST',
  //   body: formData
  // })
  //   .then(res => {
  //     if (!res.ok) throw new Error('Compression failed');

  //     const contentDisposition = res.headers.get('Content-Disposition') || '';
  //     let filename = 'compressed';
  //     const match = contentDisposition.match(/filename="?([^"]+)"?/);
  //     if (match && match[1]) {
  //       filename = match[1].trim();
  //     } else {
  //       const contentType = res.headers.get('Content-Type');
  //       const extMap = {
  //         'image/jpeg': '.jpg',
  //         'image/png': '.png',
  //         'image/webp': '.webp',
  //         'image/avif': '.avif',
  //         'image/bmp': '.bmp',
  //         'image/tiff': '.tiff',
  //         'application/zip': '.zip'
  //       };
  //       filename += extMap[contentType] || '';
  //     }

  //     return res.blob().then(blob => ({ blob, filename }));
  //   })
  //   .then(({ blob, filename }) => {
  //     lastCompressedBlob = blob;
  //     lastCompressedFilename = filename;

  //     const endTime = performance.now();
  //     console.log(`✅ Compression completed in ${(endTime - startTime).toFixed(2)} ms`);
  //     console.log(`📦 Compressed Size: ${(blob.size / 1024).toFixed(1)} KB`);

  //     const url = window.URL.createObjectURL(blob);
  //     const a = document.createElement('a');
  //     a.href = url;
  //     a.download = filename;
  //     document.body.appendChild(a);
  //     a.click();
  //     a.remove();
  //     window.URL.revokeObjectURL(url);

  //     document.querySelector('.loading-con').style.display = "none";
  //     document.querySelector('.completion-con').style.display = "flex";
  //     console.log("✅ Compression success");
  //   })
  //   .catch(err => {
  //     console.error('Compression failed:', err);
  //     document.querySelector('.loading-con').style.display = "none";
  //     alert('Something went wrong while compressing the images.');
  //   });
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
