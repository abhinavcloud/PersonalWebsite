const toggle = document.getElementById("theme-toggle");

const saved = localStorage.getItem("theme");


if (saved) {

  document.documentElement.setAttribute("data-theme", saved);

  toggle.textContent = saved === "light" ? "🌞" : "🌙";

}


toggle.onclick = () => {

  const current = document.documentElement.getAttribute("data-theme");

  const next = current === "light" ? "dark" : "light";

  document.documentElement.setAttribute("data-theme", next);

  localStorage.setItem("theme", next);

  toggle.textContent = next === "light" ? "🌞" : "🌙";

};