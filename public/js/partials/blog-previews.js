// 🧠 Number of previews you want to show (you can change this)

const maxPreviews = 3;

// 🧠 Path to your posts.json (same as used in your blog archive)
const postsPath = "../blog/posts.json";

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

async function loadRecentPosts() {
  try {
    const res = await fetch('/blog/posts.json');
    const posts = await res.json();

    // Sort by most recent date
    const sorted = posts.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Take only the latest 3
    const recent = sorted.slice(0, 3);

    const container = document.querySelector('.blog-previews');
    container.innerHTML = '';

    recent.forEach(post => {
      const postEl = document.createElement('a');
      postEl.href = post.url;
      postEl.classList.add('preview');

      const thumbnail = post.thumbnail || '/images/placeholder-blog-featured-image.jpeg';

      postEl.innerHTML = `
        <img src="${thumbnail}" alt="${post.title}">
        <div>
          <h3>${post.title}</h3>
          <p class="date">${formatDate(post.date)}</p>
          <p>${post.excerpt}</p>
        </div>
      `;

      container.appendChild(postEl);
    });

  } catch (err) {
    console.error("Error loading recent blog posts:", err);
  }
}

// Run immediately after script is injected
loadRecentPosts();
