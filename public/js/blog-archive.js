// 🗓️ Converts a date string to "Month Day, Year" format (e.g., "July 11, 2025")
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// 🌍 Holds all loaded blog post objects
let allPosts = [];

// 🔎 Holds the result after search/sort filters are applied
let filteredPosts = [];

// 🔢 Current pagination page the user is viewing
let currentPage = 1;

// 📦 Number of posts to show per page
const postsPerPage = 8;

// 📊 Max number of pagination buttons to show
const maxButtons = 4;

// 🖼️ Renders a slice of blog posts to the DOM based on the current page
function renderPosts(posts, page = 1) {
  const container = document.querySelector('.all-blogs');
  container.innerHTML = '';

  const start = (page - 1) * postsPerPage;
  const end = start + postsPerPage;
  const paginatedPosts = posts.slice(start, end);

  paginatedPosts.forEach(post => {
    const postLink = document.createElement('a');
    postLink.href = post.url;
    const thumbnail = post.thumbnail || '../images/placeholder-blog-featured-image.jpeg';

    postLink.innerHTML = `
      <img src="${thumbnail}" alt="${post.title}">
      <div>
        <h2>${post.title}</h2>
        <p>${formatDate(post.date)}</p>
        <p>${post.excerpt}</p>
      </div>
    `;

    container.appendChild(postLink);
  });

  generatePaginationButtons(posts.length);
}

// 🔘 Creates dynamic sliding pagination buttons
function generatePaginationButtons(totalPosts) {
  const paginationContainer = document.querySelector('.blog-pagination');
  paginationContainer.innerHTML = '';

  const totalPages = Math.ceil(totalPosts / postsPerPage);
  let startPage = Math.max(currentPage - Math.floor(maxButtons / 2), 1);
  let endPage = startPage + maxButtons - 1;

  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(endPage - maxButtons + 1, 1);
  }

  // ← Prev Arrow
  if (currentPage > 1) {
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '←';
    prevBtn.addEventListener('click', () => {
      currentPage--;
      renderPosts(filteredPosts, currentPage);
    });
    paginationContainer.appendChild(prevBtn);
  }

  // Numbered page buttons
  for (let i = startPage; i <= endPage; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    if (i === currentPage) btn.classList.add('active');
    btn.addEventListener('click', () => {
      currentPage = i;
      renderPosts(filteredPosts, currentPage);
    });
    paginationContainer.appendChild(btn);
  }

  // → Next Arrow
  if (currentPage < totalPages) {
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '→';
    nextBtn.addEventListener('click', () => {
      currentPage++;
      renderPosts(filteredPosts, currentPage);
    });
    paginationContainer.appendChild(nextBtn);
  }
}

// 🎛️ Sets up search and sort event listeners
function setupFilters() {
  const searchInput = document.querySelector('.blog-search-con input');
  const sortSelect = document.querySelector('#sort');

  searchInput.addEventListener('input', () => {
    currentPage = 1;
    applyFilters();
  });

  sortSelect.addEventListener('change', () => {
    currentPage = 1;
    applyFilters();
  });
}

// 🔍 Filters and sorts posts
function applyFilters() {
  const searchQuery = document.querySelector('.blog-search-con input').value.toLowerCase();
  const sortOption = document.querySelector('#sort').value;

  filteredPosts = allPosts.filter(post =>
    post.title.toLowerCase().includes(searchQuery) ||
    post.excerpt.toLowerCase().includes(searchQuery)
  );

  switch (sortOption) {
    case 'newest':
      filteredPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
      break;
    case 'oldest':
      filteredPosts.sort((a, b) => new Date(a.date) - new Date(b.date));
      break;
    case 'a-z':
      filteredPosts.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'z-a':
      filteredPosts.sort((a, b) => b.title.localeCompare(a.title));
      break;
    case 'most-popular':
      // Future enhancement if you add view counts or other popularity metrics
      break;
  }

  renderPosts(filteredPosts, currentPage);
}

// 🚀 Loads post metadata from a single JSON file
async function loadPosts() {
  try {
    const res = await fetch('../../blog/posts.json');
    const posts = await res.json();

    allPosts = posts;
    filteredPosts = [...allPosts];

    applyFilters();
    setupFilters();
  } catch (err) {
    console.error("Failed to load blog post metadata:", err);
  }
}

// 🌐 Start everything on DOM load
document.addEventListener("DOMContentLoaded", () => {
  loadPosts();
});
