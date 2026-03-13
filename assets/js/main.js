(() => {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealSections = document.querySelectorAll("[data-reveal]");
  const navLinks = document.querySelectorAll(".site-nav a");
  const menuToggle = document.querySelector(".menu-toggle");

  revealSections.forEach((section) => {
    const staggerEls = section.querySelectorAll("[data-stagger]");
    staggerEls.forEach((el, index) => {
      el.style.setProperty("--stagger-delay", `${index * 90}ms`);
    });
  });

  if (prefersReduced) {
    revealSections.forEach((section) => section.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.2 }
    );

    revealSections.forEach((section) => revealObserver.observe(section));
  }

  if (navLinks.length) {
    const linkById = new Map();
    navLinks.forEach((link) => {
      const hash = link.getAttribute("href");
      if (hash && hash.startsWith("#")) {
        linkById.set(hash.slice(1), link);
      }
    });

    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const link = linkById.get(entry.target.id);
          if (link && entry.isIntersecting) {
            navLinks.forEach((item) => item.classList.remove("active"));
            link.classList.add("active");
          }
        });
      },
      { rootMargin: "-40% 0px -50% 0px" }
    );

    document.querySelectorAll("[data-section]").forEach((section) => navObserver.observe(section));
  }

  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      const isOpen = document.body.classList.toggle("menu-open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        document.body.classList.remove("menu-open");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        document.body.classList.remove("menu-open");
        menuToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  const eqCanvas = document.getElementById("eq-canvas");
  const eqLayer = document.getElementById("eq-layer");

  if (eqCanvas && eqLayer && !prefersReduced) {
    initEqualizer(eqCanvas, eqLayer);
  }

  function initEqualizer(canvas, layer) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const eqColor =
      getComputedStyle(document.documentElement).getPropertyValue("--eq-color").trim() ||
      "rgba(244, 244, 244, 0.55)";

    let width = 0;
    let height = 0;
    let bars = [];
    let barWidth = 3;
    let gap = 6;
    let startX = 0;
    let layerTop = 0;
    let layerBottom = 0;
    const state = {
      scrollBoost: 0,
      mouseX: -9999,
      mouseY: -9999,
      mouseActive: false,
    };

    const resize = () => {
      const rect = layer.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      layerTop = rect.top;
      layerBottom = rect.bottom;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(40, Math.min(80, Math.floor(width / 13)));
      barWidth = Math.max(4, Math.floor(width / (count * 4)));
      gap = Math.max(4, Math.floor((width - count * barWidth) / (count + 1)));
      startX = gap;

      bars = Array.from({ length: count }, () => ({
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 1.2,
        value: 0,
      }));
    };

    const onScroll = () => {
      state.scrollBoost = Math.min(1, state.scrollBoost + 0.35);
    };

    const onMouseMove = (event) => {
      state.mouseX = event.clientX;
      state.mouseY = event.clientY;
      state.mouseActive = true;
    };

    const onMouseLeave = () => {
      state.mouseActive = false;
    };

    window.addEventListener("resize", resize);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);

    resize();

    let last = performance.now();

    const animate = (time) => {
      const delta = Math.min(0.05, (time - last) / 1000);
      last = time;
      state.scrollBoost = Math.max(0, state.scrollBoost - delta * 0.9);

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = eqColor;
      ctx.shadowColor = eqColor;
      ctx.shadowBlur = 6;

      const baseMax = height * 0.4;
      const scrollMax = height * 0.7;
      const maxCap = height - 6;
      const mouseRadius = Math.max(120, width * 0.15);
      const mouseInfluenceY =
        state.mouseActive && state.mouseY >= layerTop - 80 && state.mouseY <= layerBottom + 80 ? 1 : 0;

      bars.forEach((bar, index) => {
        const x = startX + index * (barWidth + gap);
        const sin1 = Math.sin(time * 0.002 * bar.speed + bar.phase) * 0.5 + 0.5;
        const sin2 = Math.sin(time * 0.004 * (bar.speed + 0.2) + bar.phase * 1.7) * 0.5 + 0.5;
        const wave = sin1 * 0.6 + sin2 * 0.4;
        const maxAmp = baseMax + (scrollMax - baseMax) * state.scrollBoost;
        let target = 6 + wave * maxAmp;

        if (state.mouseActive) {
          const dx = Math.abs(state.mouseX - x);
          const influence = Math.max(0, 1 - dx / mouseRadius) * mouseInfluenceY;
          target += influence * (maxCap - maxAmp);
        }

        target = Math.min(maxCap, target);
        bar.value += (target - bar.value) * 0.08;
        const h = Math.max(8, Math.min(maxCap, bar.value));
        ctx.fillRect(x, height - h, barWidth, h);
      });

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }
})();
