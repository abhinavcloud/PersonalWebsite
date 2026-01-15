const list = document.getElementById("blog-list");
const tagFilter = document.getElementById("tag-filter");
const search = document.getElementById("search");

let posts = [];
let activeTag = "all";

fetch("posts.json")
  .then(res => res.json())
  .then(data => {
    posts = data;
    renderTags();
    renderPosts();
  });

function renderTags() {
  const tags = new Set(["all"]);
  posts.forEach(p => p.tags.forEach(t => tags.add(t)));

  tagFilter.innerHTML = [...tags].map(tag =>
    `<button class="tag ${tag === "all" ? "active" : ""}" data-tag="${tag}">${tag}</button>`
  ).join("");

  document.querySelectorAll(".tag").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".tag").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      activeTag = btn.dataset.tag;
      renderPosts();
    };
  });
}

function renderPosts() {
  const query = search.value.toLowerCase();

  list.innerHTML = posts
    .filter(p =>
      (activeTag === "All" || p.tags.includes(activeTag)) &&
      p.title.toLowerCase().includes(query)
    )
    .map(p => `
      <a class="blog-tile" href="post.html?post=${p.slug}">
        <div class="blog-icon">${p.icon}</div>
        <div class="blog-text">
          <div class="blog-title">${p.title}</div>
          <div class="blog-meta">${p.date} · ${p.readingTime}</div>
          <div class="blog-subtitle">${p.subtitle}</div>
          <div class="blog-tags">
            ${p.tags.map(t => `<span class="tag">${t}</span>`).join("")}
          </div>
        </div>
        <div class="blog-arrow">→</div>
      </a>
    `)
    .join("") || "<p>No posts found.</p>";
}

search.oninput = renderPosts;
