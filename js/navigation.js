
document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("appSidebar");
  const overlay = document.getElementById("sidebarOverlay");

  // Avoid breaking pages that don't contain the app navigation.
  if (!menuToggle || !sidebar || !overlay) {
    console.warn("Field Shift navigation: required element is missing.");
    return;
  }

  function openMenu() {
    sidebar.classList.add("is-open");
    overlay.classList.add("is-visible");
    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "Close navigation");
    document.body.classList.add("menu-open");
  }

  function closeMenu() {
    sidebar.classList.remove("is-open");
    overlay.classList.remove("is-visible");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation");
    document.body.classList.remove("menu-open");
  }

  menuToggle.addEventListener("click", () => {
    if (sidebar.classList.contains("is-open")) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  overlay.addEventListener("click", closeMenu);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  sidebar.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 800) closeMenu();
  });
});
