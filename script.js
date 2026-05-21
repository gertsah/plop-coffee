(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Year ---------- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Live open / closed status ---------- */
  const statusEl = document.getElementById("openStatus");
  if (statusEl) {
    const now = new Date();
    const h = now.getHours();
    const month = now.getMonth(); // 0 = Jan
    const openH = 8;
    const closeH = month >= 5 && month <= 7 ? 22 : 21; // Jun–Aug → 22:00
    const text = statusEl.querySelector(".status-text");
    if (h >= openH && h < closeH) {
      statusEl.classList.add("is-open");
      text.textContent = "Открыто сейчас · до " + closeH + ":00";
    } else {
      statusEl.classList.add("is-closed");
      text.textContent = h < openH ? "Закрыто · откроемся в 08:00" : "Закрыто · откроемся завтра в 08:00";
    }
  }

  /* ---------- Sticky header ---------- */
  const header = document.getElementById("header");
  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 40);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Mobile menu ---------- */
  const burger = document.getElementById("burger");
  const nav = document.getElementById("nav");
  const toggleMenu = (open) => {
    const willOpen = open ?? !nav.classList.contains("mobile-open");
    nav.classList.toggle("mobile-open", willOpen);
    burger.classList.toggle("open", willOpen);
    header.classList.toggle("nav-open", willOpen);
    burger.setAttribute("aria-expanded", String(willOpen));
    document.body.style.overflow = willOpen ? "hidden" : "";
  };
  burger.addEventListener("click", () => toggleMenu());
  nav.querySelectorAll(".nav-link").forEach((l) =>
    l.addEventListener("click", () => toggleMenu(false))
  );

  /* ---------- Menu tabs ---------- */
  const tabs = document.querySelectorAll(".tab");
  const panels = document.querySelectorAll(".menu-panel");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const key = tab.dataset.tab;
      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle("is-active", active);
        t.setAttribute("aria-selected", String(active));
      });
      panels.forEach((p) => {
        const active = p.dataset.panel === key;
        p.classList.toggle("is-active", active);
        p.hidden = !active;
      });
    });
  });

  /* ---------- Reviews marquee (auto-scroll, seamless loop) ---------- */
  const reviewsTrack = document.getElementById("reviewsTrack");
  if (reviewsTrack && !reduceMotion) {
    // duplicate the cards so the -50% translate loops seamlessly
    const clones = reviewsTrack.innerHTML;
    reviewsTrack.insertAdjacentHTML("beforeend", clones);
    Array.from(reviewsTrack.children).slice(reviewsTrack.children.length / 2)
      .forEach((el) => el.setAttribute("aria-hidden", "true"));
  }

  /* ---------- Catalog carousel (multi-item) ---------- */
  const catTrack = document.getElementById("catalogTrack");
  if (catTrack) {
    const viewport = document.getElementById("catViewport");
    const cards = Array.from(catTrack.children);
    const dotsWrap = document.getElementById("catalogDots");
    const prevBtn = document.getElementById("catPrev");
    const nextBtn = document.getElementById("catNext");
    let index = 0,
      step = 0,
      perView = 1,
      maxIndex = 0,
      timer = null;

    const gap = () => parseFloat(getComputedStyle(catTrack).columnGap || getComputedStyle(catTrack).gap) || 0;

    function measure() {
      const cardW = cards[0].getBoundingClientRect().width;
      const g = gap();
      step = cardW + g;
      perView = Math.max(1, Math.round((viewport.clientWidth + g) / step));
      maxIndex = Math.max(0, cards.length - perView);
      index = Math.min(index, maxIndex);
      buildDots();
      apply();
    }

    function buildDots() {
      dotsWrap.innerHTML = "";
      for (let i = 0; i <= maxIndex; i++) {
        const d = document.createElement("button");
        d.setAttribute("aria-label", "Показать группу " + (i + 1));
        d.addEventListener("click", () => goTo(i, true));
        dotsWrap.appendChild(d);
      }
    }

    function apply() {
      catTrack.style.transform = `translateX(${-index * step}px)`;
      Array.from(dotsWrap.children).forEach((d, i) => d.classList.toggle("active", i === index));
      prevBtn.disabled = index <= 0;
      nextBtn.disabled = index >= maxIndex;
    }

    function goTo(i, user) {
      index = Math.max(0, Math.min(i, maxIndex));
      apply();
      if (user) restart();
    }

    nextBtn.addEventListener("click", () => goTo(index + 1, true));
    prevBtn.addEventListener("click", () => goTo(index - 1, true));

    function autoNext() {
      goTo(index >= maxIndex ? 0 : index + 1);
    }
    function start() {
      if (reduceMotion || maxIndex === 0) return;
      timer = setInterval(autoNext, 4500);
    }
    function restart() {
      clearInterval(timer);
      start();
    }
    function stop() {
      clearInterval(timer);
    }
    viewport.addEventListener("mouseenter", stop);
    viewport.addEventListener("mouseleave", start);
    viewport.addEventListener("focusin", stop);

    // drag / swipe
    let down = false, startX = 0, startIdx = 0, moved = 0;
    const onDown = (x) => { down = true; startX = x; startIdx = index; moved = 0; catTrack.classList.add("dragging"); stop(); };
    const onMove = (x) => {
      if (!down) return;
      moved = x - startX;
      catTrack.style.transform = `translateX(${-startIdx * step + moved}px)`;
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      catTrack.classList.remove("dragging");
      if (Math.abs(moved) > step * 0.18) goTo(startIdx + (moved < 0 ? 1 : -1));
      else apply();
      restart();
    };
    viewport.addEventListener("pointerdown", (e) => { onDown(e.clientX); });
    window.addEventListener("pointermove", (e) => onMove(e.clientX));
    window.addEventListener("pointerup", onUp);
    viewport.addEventListener("dragstart", (e) => e.preventDefault());

    let rt;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(measure, 150); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    measure();
    start();
  }

  /* ---------- Cup spin: full-screen video ---------- */
  const cupSpin = document.getElementById("cup");
  const cupVideo = document.getElementById("cupVideo");
  // Mobile Safari does not paint a video that is only seeked (never played),
  // so scroll-scrub renders blank on phones. On mobile we autoplay the loop.
  const cupIsMobile = window.matchMedia("(max-width: 760px), (hover: none)").matches;

  if (cupSpin && cupVideo && cupIsMobile) {
    cupVideo.loop = true;
    cupVideo.muted = true;
    cupVideo.setAttribute("playsinline", "");
    cupVideo.setAttribute("autoplay", "");
    const playCup = () => { const p = cupVideo.play(); if (p) p.catch(() => {}); };
    if (cupVideo.readyState >= 2) playCup();
    else cupVideo.addEventListener("loadeddata", playCup, { once: true });
    cupVideo.addEventListener("canplay", playCup, { once: true });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) playCup(); });
      }, { threshold: 0.1 }).observe(cupSpin);
    }
    ["touchstart", "click", "scroll"].forEach((ev) =>
      window.addEventListener(ev, playCup, { once: true, passive: true })
    );
    // Scroll-driven motion on mobile (zoom + heading parallax) while the loop plays.
    if (!reduceMotion) {
      const cupCopy = cupSpin.querySelector(".cup-copy");
      let tp = 0, cp = 0, running = false;
      const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
      const setT = () => {
        const travel = cupSpin.offsetHeight - window.innerHeight;
        tp = travel > 0 ? clamp(-cupSpin.getBoundingClientRect().top / travel, 0, 1) : 0;
        if (!running) { running = true; requestAnimationFrame(tick); }
      };
      const tick = () => {
        cp += (tp - cp) * 0.12;
        if (Math.abs(tp - cp) < 0.001) { cp = tp; running = false; }
        cupVideo.style.transform = "scale(" + (1.12 - 0.12 * cp).toFixed(4) + ")";
        if (cupCopy) {
          cupCopy.style.opacity = clamp(1 - cp * 1.5, 0, 1).toFixed(3);
          cupCopy.style.transform = "translateY(" + (-cp * 46).toFixed(1) + "px)";
        }
        if (running) requestAnimationFrame(tick);
      };
      window.addEventListener("scroll", setT, { passive: true });
      window.addEventListener("resize", setT, { passive: true });
      setT();
    }
  } else if (cupSpin && cupVideo) {
    cupVideo.muted = true;
    cupVideo.setAttribute("playsinline", "");
    const cupCopy = cupSpin.querySelector(".cup-copy");
    let dur = 0, ready = false, targetP = 0, curP = 0, running = false;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

    function setTarget() {
      const travel = cupSpin.offsetHeight - window.innerHeight;
      targetP = travel > 0 ? clamp(-cupSpin.getBoundingClientRect().top / travel, 0, 1) : 0;
      if (!running) {
        running = true;
        requestAnimationFrame(tick);
      }
    }
    function apply() {
      if (ready && dur) {
        try { cupVideo.currentTime = clamp(curP * dur, 0, dur - 0.03); } catch (e) {}
      }
      cupVideo.style.transform = "scale(" + (1.06 - 0.06 * curP).toFixed(4) + ")";
      if (cupCopy) {
        cupCopy.style.opacity = clamp(1 - curP * 1.5, 0, 1).toFixed(3);
        cupCopy.style.transform = "translateY(" + (-curP * 46).toFixed(1) + "px)";
      }
    }
    function tick() {
      curP += (targetP - curP) * 0.12; // ease toward scroll -> buttery smooth
      if (Math.abs(targetP - curP) < 0.0006) {
        curP = targetP;
        running = false;
      }
      apply();
      if (running) requestAnimationFrame(tick);
    }
    function onMeta() {
      dur = cupVideo.duration || 0;
      ready = true;
      cupVideo.pause();
      apply();
    }
    if (cupVideo.readyState >= 1) onMeta();
    else cupVideo.addEventListener("loadedmetadata", onMeta, { once: true });

    if (!reduceMotion) {
      window.addEventListener("scroll", setTarget, { passive: true });
      window.addEventListener("resize", setTarget, { passive: true });
    }
    setTarget();
  }

  /* ---------- Scroll reveal ---------- */
  const revealEls = document.querySelectorAll("[data-reveal]");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("in"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            // light stagger for siblings entering together
            setTimeout(() => el.classList.add("in"), (i % 6) * 80);
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  }

  /* ---------- Hero video: force playback (mobile-safe), drop if reduced motion ---------- */
  const video = document.querySelector(".hero-video");
  if (video) {
    if (reduceMotion) {
      video.removeAttribute("autoplay");
      video.pause();
    } else {
      video.muted = true;
      video.setAttribute("playsinline", "");
      const playHero = () => { const p = video.play(); if (p) p.catch(() => {}); };
      if (video.readyState >= 2) playHero();
      video.addEventListener("loadeddata", playHero, { once: true });
      video.addEventListener("canplay", playHero, { once: true });
      if ("IntersectionObserver" in window) {
        new IntersectionObserver((entries) => {
          entries.forEach((e) => { if (e.isIntersecting) playHero(); });
        }, { threshold: 0.05 }).observe(video);
      }
      ["touchstart", "click", "scroll"].forEach((ev) =>
        window.addEventListener(ev, playHero, { once: true, passive: true })
      );
      video.addEventListener("error", () => video.remove(), { once: true });
    }
  }
})();
