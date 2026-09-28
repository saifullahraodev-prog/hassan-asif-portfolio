/* =====================================================
   EDIT YOUR VIDEOS HERE
   -----------------------------------------------------
   Each video can be one of:
     { type: "youtube", id: "dQw4w9WgXcQ" }         -> id from youtube.com/watch?v=ID
     { type: "vimeo",   id: "76979871" }            -> id from vimeo.com/ID
     { type: "file",    src: "videos/reel.mp4" }    -> local MP4 in the site folder
     null                                           -> shows a "coming soon" placeholder
   Optional: thumb: "images/project.jpg" (YouTube thumbnails are fetched automatically)
   ===================================================== */

const SHOWREEL = {
  title: "Showreel 2026",
  video: null,
};

const PROJECTS = [
  { title: "Volta — Charge Up", client: "Volta Energy Drink", category: "commercial", duration: "0:45", big: true, colors: ["#ff4d8d", "#ffd23f", "#b8f34a"], video: null },
  { title: "Midnight Drive", client: "DJ Rayyan · Orbit Records", category: "music", duration: "3:28", colors: ["#9b5cff", "#ff8a3d", "#ffd23f"], video: null },
  { title: "I Tried Living Offline", client: "Ali Raza · YouTube", category: "youtube", duration: "18:04", colors: ["#3b5bff", "#b8f34a", "#ff4d8d"], video: null },
  { title: "The Last Tailor", client: "Short film · Festival selection", category: "film", duration: "12:10", colors: ["#ff8a3d", "#3b5bff", "#ffd23f"], video: null },
  { title: "Lumen Skincare Launch", client: "Lumen·Co", category: "commercial", duration: "0:30", colors: ["#b8f34a", "#ff4d8d", "#3b5bff"], video: null },
  { title: "Golden Hour", client: "Noor · Independent artist", category: "music", duration: "4:02", big: true, colors: ["#ffd23f", "#9b5cff", "#ff8a3d"], video: null },
  { title: "Street Food Tour Lahore", client: "Peak Studio · YouTube", category: "youtube", duration: "22:37", colors: ["#ff4d8d", "#3b5bff", "#b8f34a"], video: null },
  { title: "Northwind — Go Further", client: "Northwind Travel", category: "commercial", duration: "1:00", colors: ["#3b5bff", "#ffd23f", "#ff4d8d"], video: null },
  { title: "Paper Boats", client: "Short film", category: "film", duration: "8:45", colors: ["#9b5cff", "#b8f34a", "#ffd23f"], video: null },
];

const CATEGORY_LABELS = { commercial: "Commercial", music: "Music Video", youtube: "YouTube", film: "Short Film" };

/* ================= WORK GRID ================= */
const grid = document.getElementById("workGrid");

function thumbFor(p) {
  if (p.thumb) return p.thumb;
  if (p.video && p.video.type === "youtube") return `https://img.youtube.com/vi/${p.video.id}/hqdefault.jpg`;
  return null;
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

PROJECTS.forEach((p, i) => {
  const [c1, c2, c3] = p.colors;
  const img = thumbFor(p);
  const card = document.createElement("button");
  card.className = `card reveal${p.big ? " big" : ""}`;
  card.dataset.category = p.category;
  card.style.cssText = `--c1:${c1};--c2:${c2};--c3:${c3}`;
  card.innerHTML = `
    <div class="thumb">
      ${img ? `<img src="${escapeHTML(img)}" alt="" loading="lazy">` : `<div class="thumb-art"></div><div class="thumb-title">${escapeHTML(p.title)}</div>`}
      <span class="duration">${escapeHTML(p.duration)}</span>
      <span class="mini-play">▶</span>
    </div>
    <div class="card-body">
      <div><h3>${escapeHTML(p.title)}</h3><p>${escapeHTML(p.client)}</p></div>
      <span class="tag">${CATEGORY_LABELS[p.category]}</span>
    </div>`;
  card.addEventListener("click", () => openLightbox(p));
  grid.appendChild(card);
});

/* Filters */
document.getElementById("filters").addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === btn));
  const f = btn.dataset.filter;
  grid.querySelectorAll(".card").forEach((card) => {
    const show = f === "all" || card.dataset.category === f;
    card.classList.toggle("hide", !show);
    card.classList.toggle("big", show && f === "all" && PROJECTS[[...grid.children].indexOf(card)].big);
  });
});

/* ================= LIGHTBOX ================= */
const lightbox = document.getElementById("lightbox");
const lbVideo = document.getElementById("lightboxVideo");
const lbInfo = document.getElementById("lightboxInfo");

function embedHTML(v) {
  if (!v) {
    return `<div class="placeholder-video"><b>Video coming soon 🎬</b>
      <span>Add a link in <code>script.js</code> to show it here.</span></div>`;
  }
  if (v.type === "youtube")
    return `<iframe src="https://www.youtube.com/embed/${encodeURIComponent(v.id)}?autoplay=1&rel=0" allow="autoplay; fullscreen; encrypted-media" allowfullscreen></iframe>`;
  if (v.type === "vimeo")
    return `<iframe src="https://player.vimeo.com/video/${encodeURIComponent(v.id)}?autoplay=1" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
  if (v.type === "file")
    return `<video src="${escapeHTML(v.src)}" controls autoplay playsinline></video>`;
  return "";
}

function openLightbox(p) {
  lbVideo.innerHTML = embedHTML(p.video);
  lbInfo.innerHTML = p.client
    ? `<h3>${escapeHTML(p.title)}</h3><span><b>${escapeHTML(p.client)}</b> · ${CATEGORY_LABELS[p.category]} · ${escapeHTML(p.duration)}</span>`
    : `<h3>${escapeHTML(p.title)}</h3>`;
  lightbox.classList.add("open");
  lightbox.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  lightbox.classList.remove("open");
  lightbox.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  setTimeout(() => (lbVideo.innerHTML = ""), 250); // stops playback
}

document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeLightbox(); });

document.querySelectorAll('[data-play="reel"]').forEach((el) => {
  el.addEventListener("click", () => openLightbox(SHOWREEL));
  el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openLightbox(SHOWREEL); } });
});

/* ================= MOBILE MENU ================= */
const toggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");
toggle.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  toggle.setAttribute("aria-expanded", open);
});
navLinks.addEventListener("click", (e) => {
  if (e.target.tagName === "A") { navLinks.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }
});

/* ================= REVEAL + COUNTERS ================= */
document.querySelectorAll(".stat, .service, .quote, .section-head, .about-photo, .contact").forEach((el) => el.classList.add("reveal"));

const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("in");
    const num = entry.target.querySelector("[data-count]");
    if (num) countUp(num);
    io.unobserve(entry.target);
  });
}, { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

function countUp(el) {
  const target = +el.dataset.count;
  const start = performance.now();
  const dur = 1400;
  (function tick(now) {
    const t = Math.min((now - start) / dur, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(tick);
  })(start);
}

/* ================= CONTACT FORM ================= */
// No server needed: opens the visitor's email app with the message pre-filled.
// To receive messages directly instead, point the form at a service like Formspree.
const CONTACT_EMAIL = "hello@hassanasif.com";
document.getElementById("contactForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const d = new FormData(e.target);
  const subject = `New project: ${d.get("type")} — ${d.get("name")}`;
  const body = `${d.get("message")}\n\n— ${d.get("name")} (${d.get("email")})`;
  window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  document.getElementById("formNote").textContent = "Opening your email app… thanks! 🎉";
});

document.getElementById("year").textContent = new Date().getFullYear();
