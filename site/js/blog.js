const search = document.getElementById("search");
const tags = document.querySelectorAll(".tag-filter .tag");
const posts = document.querySelectorAll(".blog-tile");

let activeTag = "all";

function filterPosts() {
  const query = search.value.toLowerCase();

  posts.forEach(post => {
    const title = post.dataset.title.toLowerCase();
    const postTags = post.dataset.tags;
    const matchesTag = activeTag === "all" || postTags.includes(activeTag);
    const matchesSearch = title.includes(query);

    post.style.display = matchesTag && matchesSearch ? "flex" : "none";
  });
}

search.addEventListener("input", filterPosts);

tags.forEach(tag => {
  tag.addEventListener("click", () => {
    tags.forEach(t => t.classList.remove("active"));
    tag.classList.add("active");
    activeTag = tag.dataset.tag;
    filterPosts();
  });
});
