const menu = document.querySelector(".menu");
const nav = document.querySelector(".nav");
menu?.addEventListener("click", () => nav.classList.toggle("mobile-open"));

document.querySelectorAll('.nav nav a').forEach(a => {
  a.addEventListener('click', () => nav.classList.remove("mobile-open"));
});

const toast = document.getElementById("toast");
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

document.querySelectorAll(".chain-card").forEach(card => {
  card.addEventListener("click", () => {
    const chain = card.dataset.chain;
    const url = card.dataset.url;
    if (url && url.startsWith("http")) {
      showToast(`Opening ${chain}…`);
      setTimeout(() => window.open(url, "_blank", "noopener"), 450);
    } else {
      document.querySelector("#launch").scrollIntoView({behavior:"smooth"});
      showToast(`${chain} will be added to the Eureka network.`);
    }
  });
});

document.getElementById("year").textContent = new Date().getFullYear();

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.animate(
        [{opacity:0, transform:"translateY(20px)"}, {opacity:1, transform:"translateY(0)"}],
        {duration:700, easing:"cubic-bezier(.2,.7,.2,1)", fill:"forwards"}
      );
      observer.unobserve(entry.target);
    }
  });
}, {threshold:.12});

document.querySelectorAll(".section > *, .chain-card, .token-panel").forEach(el => observer.observe(el));
