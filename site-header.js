(function () {
  const header = document.querySelector(".site-header");
  if (!header) {
    return;
  }

  const HIDE_SCROLL_Y = 72;
  const SHOW_DELTA_Y = 10;
  const TOP_SHOW_Y = 8;
  let lastY = Math.max(window.scrollY || 0, 0);
  let ticking = false;
  let hidden = false;

  function applyHidden(nextHidden) {
    if (nextHidden === hidden) {
      return;
    }

    hidden = nextHidden;
    header.classList.toggle("site-header-hidden", hidden);
  }

  function updateHeaderState() {
    ticking = false;
    const currentY = Math.max(window.scrollY || 0, 0);

    if (currentY <= TOP_SHOW_Y) {
      applyHidden(false);
    } else if (currentY > lastY && currentY > HIDE_SCROLL_Y) {
      applyHidden(true);
    } else if (lastY - currentY >= SHOW_DELTA_Y) {
      applyHidden(false);
    }

    lastY = currentY;
  }

  function requestUpdate() {
    if (ticking) {
      return;
    }

    ticking = true;
    window.requestAnimationFrame(updateHeaderState);
  }

  updateHeaderState();
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate, { passive: true });
  window.addEventListener("pageshow", requestUpdate);
})();
