const toggle = document.getElementById("theme-toggle");
const html = document.documentElement;

// Load saved theme (only dark is stored)
const saved = localStorage.getItem("theme");

if (saved === "dark") {
  html.setAttribute("data-theme", "dark");
  toggle.textContent = "☀️";
} else {
  toggle.textContent = "🌙";
}

// Toggle theme
toggle.onclick = () => {
  const isDark = html.getAttribute("data-theme") === "dark";

  if (isDark) {
    html.removeAttribute("data-theme");   // back to light
    localStorage.removeItem("theme");
    toggle.textContent = "🌙";
  } else {
    html.setAttribute("data-theme", "dark");
    localStorage.setItem("theme", "dark");
    toggle.textContent = "☀️";
  }
};