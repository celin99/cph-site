/* ==========================================================
   Central Palace Hotel — motion + cena 3D (Three.js + GSAP)
   ========================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  root.classList.add('js');

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const hasGSAP = !!window.gsap;
  const isNarrow = () => innerWidth < 861;

  // Se as bibliotecas não carregarem, o conteúdo continua visível.
  if (!hasGSAP) {
    root.classList.remove('js');
    document.getElementById('loader')?.remove();
    document.getElementById('year').textContent = new Date().getFullYear();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Smooth scroll ---------- */
  let lenis = null;
  if (window.Lenis && !reduce) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      closeMenu();
      if (lenis) lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
      else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  /* ---------- Navegação ---------- */
  const nav = document.getElementById('nav');
  const burger = document.getElementById('burger');
  function closeMenu() {
    nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    lenis && lenis.start();
  }
  burger.addEventListener('click', () => {
    const open = !nav.classList.contains('is-open');
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    lenis && (open ? lenis.stop() : lenis.start());
  });
  const onScrollNav = () => nav.classList.toggle('is-stuck', scrollY > 40);
  addEventListener('scroll', onScrollNav, { passive: true });
  onScrollNav();

  /* ====================================================
     CENA 3D — luz quente e bokeh dourado (sutil)
     ==================================================== */
  const canvas = document.getElementById('stage');

  // Estado controlado pelo GSAP conforme a seção visível
  const S = { x: 2.2, y: 0.2, op: 1 };
  const INTRO = { op: reduce ? 1 : 0 }; // entrada da cena
  const SECTION_STATES = {
    hero:     { x: 2.2,  y: 0.2, op: 1.0 },
    story:    { x: -2.6, y: 0,   op: 0.75 },
    rooms:    { x: 0,    y: 0,   op: 0.35 },
    services: { x: 2.8,  y: 0,   op: 0.6 },
    gallery:  { x: 0,    y: 0,   op: 0.3 },
    flats:    { x: 1.2,  y: 0,   op: 0.5 },
    contact:  { x: -2.2, y: 0,   op: 0.55 },
  };
  const resolveState = (name) => {
    const t = { ...SECTION_STATES[name] };
    if (isNarrow()) { t.x *= 0.25; t.op *= 0.75; }
    return t;
  };
  Object.assign(S, resolveState('hero'));

  let renderer, scene, camera, haloA, haloB, dust;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

  function glowTexture(inner, outer) {
    const SZ = 256;
    const c = document.createElement('canvas');
    c.width = c.height = SZ;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(SZ / 2, SZ / 2, 0, SZ / 2, SZ / 2, SZ / 2);
    // queda suave (curva de easing) para não formar anéis visíveis
    const m = inner.match(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/);
    const [r, gg, b, a] = [m[1], m[2], m[3], parseFloat(m[4])];
    for (let i = 0; i <= 12; i++) {
      const k = i / 12;
      const alpha = a * Math.pow(1 - k, 2.6);
      grd.addColorStop(k * 0.8, `rgba(${r},${gg},${b},${alpha.toFixed(4)})`);
    }
    grd.addColorStop(1, outer);
    g.fillStyle = grd;
    g.fillRect(0, 0, SZ, SZ);
    return new THREE.CanvasTexture(c);
  }

  function makePoints(count, spread, size, tex, color, opacity) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * spread[0];
      pos[i * 3 + 1] = (Math.random() - 0.5) * spread[1];
      pos[i * 3 + 2] = (Math.random() - 0.5) * spread[2] - 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({
      size, map: tex, color, transparent: true, opacity,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
  }

  function initScene() {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
    camera.position.set(0, 0, 9);

    // brilhos quentes (como lustres e luz ambiente de hotel)
    const warm = glowTexture('rgba(255,190,110,.55)', 'rgba(255,190,110,0)');
    haloA = new THREE.Sprite(new THREE.SpriteMaterial({ map: warm, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    haloA.scale.set(13, 13, 1);
    haloA.position.z = -2;
    haloB = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,225,170,.4)', 'rgba(255,225,170,0)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    haloB.scale.set(8, 8, 1);
    haloB.position.z = -3;
    scene.add(haloA, haloB);

    // poeira fina + bokeh grande e macio
    const dustTex = glowTexture('rgba(255,235,185,1)', 'rgba(255,235,185,0)');
    dust = makePoints(isNarrow() ? 300 : 800, [22, 16, 10], 0.07, dustTex, 0xf0d8a0, 0.7);
    scene.add(dust);

    resize();
  }

  function resize() {
    if (!renderer) return;
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 52 : 40;
    camera.updateProjectionMatrix();
  }

  const clock = new THREE.Clock();

  function frame() {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    clock.getDelta();
    const t = reduce ? 0 : clock.elapsedTime;

    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;

    const OP = S.op * INTRO.op;

    haloA.position.x = S.x + mouse.x * 0.8;
    haloA.position.y = S.y - mouse.y * 0.5;
    haloA.material.opacity = OP * (0.15 + 0.03 * Math.sin(t * 0.6));
    haloB.position.x = -S.x * 0.6 - mouse.x * 0.6;
    haloB.position.y = -S.y - 1 - mouse.y * 0.3;
    haloB.material.opacity = OP * 0.07;

    dust.rotation.y = t * 0.02 + mouse.x * 0.08;
    dust.position.y = scrollY * 0.0009;
    dust.material.opacity = 0.25 + 0.4 * Math.min(1, OP);

    renderer.render(scene, camera);
  }

  try {
    if (!window.THREE) throw new Error('three');
    initScene();
    frame();
    addEventListener('resize', resize);
    addEventListener('pointermove', (e) => {
      mouse.tx = (e.clientX / innerWidth - 0.5) * 2;
      mouse.ty = (e.clientY / innerHeight - 0.5) * 2;
    }, { passive: true });
  } catch (err) {
    canvas.style.display = 'none';
    console.warn('WebGL indisponível, seguindo sem a cena 3D.', err);
  }

  // Troca de estado da cena por seção
  document.querySelectorAll('[data-state]').forEach((sec) => {
    const name = sec.dataset.state;
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: (self) => {
        if (!self.isActive) return;
        gsap.to(S, { ...resolveState(name), duration: reduce ? 0 : 1.9, ease: 'power3.inOut', overwrite: true });
      },
    });
  });

  /* ====================================================
     TEXTO: divisão em palavras para animação
     ==================================================== */
  function splitWords(el) {
    const wrapWords = (text) => {
      const frag = document.createDocumentFragment();
      text.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        const w = document.createElement('span');
        w.className = 'word';
        const inner = document.createElement('span');
        inner.textContent = part;
        w.appendChild(inner);
        frag.appendChild(w);
      });
      return frag;
    };
    [...el.childNodes].forEach((node) => {
      if (node.nodeType === 3) node.replaceWith(wrapWords(node.textContent));
      else if (node.nodeType === 1) {
        const txt = node.textContent;
        node.textContent = '';
        node.appendChild(wrapWords(txt));
      }
    });
    el.classList.add('is-split');
    return el.querySelectorAll('.word > span');
  }

  document.querySelectorAll('[data-split]').forEach((el) => {
    const words = splitWords(el);
    if (reduce) return;
    gsap.set(words, { yPercent: 115 });
    gsap.to(words, {
      yPercent: 0, duration: 1.15, ease: 'power4.out', stagger: 0.055,
      scrollTrigger: { trigger: el, start: 'top 86%', once: true },
    });
  });

  /* ---------- Reveals ---------- */
  gsap.utils.toArray('[data-reveal]').forEach((el) => {
    const dir = el.dataset.reveal;
    const from = { opacity: 0, y: 46 };
    if (dir === 'left') Object.assign(from, { x: -70, y: 0 });
    if (dir === 'right') Object.assign(from, { x: 70, y: 0 });
    if (reduce) { gsap.set(el, { opacity: 1 }); return; }
    gsap.fromTo(el, from, {
      opacity: 1, x: 0, y: 0, duration: 1.3, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });

  /* ---------- Parallax de imagens ---------- */
  if (!reduce) {
    gsap.utils.toArray('[data-parallax]').forEach((img) => {
      gsap.fromTo(img, { yPercent: -6 }, {
        yPercent: 6, ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
    const badge = document.querySelector('[data-float]');
    badge && gsap.to(badge, { y: -14, duration: 2.6, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  }

  /* ---------- Tilt 3D nos cartões ---------- */
  if (fine && !reduce) {
    document.querySelectorAll('.tilt').forEach((el) => {
      const max = parseFloat(el.dataset.tilt || 8);
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--gx', px * 100 + '%');
        el.style.setProperty('--gy', py * 100 + '%');
        gsap.to(el, {
          rotationY: (px - 0.5) * max * 2,
          rotationX: -(py - 0.5) * max * 2,
          transformPerspective: 1000, duration: 0.5, ease: 'power3.out', overwrite: 'auto',
        });
      });
      el.addEventListener('pointerleave', () => {
        gsap.to(el, { rotationX: 0, rotationY: 0, duration: 1.1, ease: 'elastic.out(1,.6)', overwrite: 'auto' });
      });
    });

    // botões magnéticos
    document.querySelectorAll('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        gsap.to(el, { x: dx * 0.22, y: dy * 0.32, duration: 0.4, ease: 'power3.out' });
      });
      el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1,.5)' }));
    });

    // cursor
    const cur = document.getElementById('cursor');
    const qx = gsap.quickTo(cur, 'x', { duration: 0.35, ease: 'power3' });
    const qy = gsap.quickTo(cur, 'y', { duration: 0.35, ease: 'power3' });
    addEventListener('pointermove', (e) => { qx(e.clientX); qy(e.clientY); }, { passive: true });
    document.querySelectorAll('a,button,.tilt,[data-magnetic]').forEach((el) => {
      el.addEventListener('pointerenter', () => cur.classList.add('is-hover'));
      el.addEventListener('pointerleave', () => cur.classList.remove('is-hover'));
    });
  }

  /* ---------- Galeria: rolagem horizontal em 3D ---------- */
  const pin = document.getElementById('galPin');
  const track = document.getElementById('galTrack');
  const bar = document.getElementById('galBar');
  const items = gsap.utils.toArray('.g');

  function poseItems() {
    const half = innerWidth / 2;
    items.forEach((g) => {
      const r = g.getBoundingClientRect();
      const c = (r.left + r.width / 2 - half) / innerWidth;
      gsap.set(g, {
        transformPerspective: 1000,
        rotationY: gsap.utils.clamp(-40, 40, -c * 34),
        z: -Math.abs(c) * 160,
        scale: 1 - Math.min(0.12, Math.abs(c) * 0.1),
        opacity: 1 - Math.min(0.55, Math.abs(c) * 0.5),
      });
    });
  }

  const mm = gsap.matchMedia();
  mm.add('(min-width: 861px)', () => {
    if (reduce) return;
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: pin, start: 'top top', end: () => '+=' + dist(),
        pin: true, scrub: 0.7, invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: (self) => { bar.style.transform = `scaleX(${self.progress})`; poseItems(); },
        onRefresh: poseItems,
      },
    });
    poseItems();
    return () => items.forEach((g) => gsap.set(g, { clearProps: 'all' }));
  });

  /* ====================================================
     INTRO (após o preloader)
     ==================================================== */
  function runIntro() {
    const loader = document.getElementById('loader');
    const counters = document.querySelectorAll('[data-count]');
    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    tl.to(loader, { opacity: 0, duration: 0.8, ease: 'power2.inOut', onComplete: () => loader.remove() })
      .to('.ln > span', { y: 0, duration: 1.5, stagger: 0.13 }, 0.35)
      .fromTo('[data-intro]', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.1 }, 0.7)
      .from('.arch__img img', { scale: 1.22, duration: 2.8, ease: 'power3.out' }, 0.5)
      .from('.arch__outline', { x: -22, y: -22, opacity: 0, duration: 1.6 }, 1.1)
      .fromTo(nav,{ y: -60, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, clearProps: 'transform' }, 0.8);
    counters.forEach((el) => {
      const end = +el.dataset.count, suf = el.dataset.suffix || '';
      const o = { v: 0 };
      gsap.to(o, { v: end, duration: 2.2, delay: 1.1, ease: 'power2.out', onUpdate: () => (el.textContent = Math.round(o.v) + suf) });
    });
    if (!window.THREE) return;
    gsap.to(INTRO, { op: 1, duration: 2.4, delay: 0.5, ease: 'power2.out' });
  }

  if (reduce) {
    document.getElementById('loader')?.remove();
    document.querySelectorAll('[data-count]').forEach((el) => (el.textContent = el.dataset.count + (el.dataset.suffix || '')));
  } else {
    let started = false;
    const go = () => { if (started) return; started = true; runIntro(); };
    const minWait = new Promise((r) => setTimeout(r, 1100));
    const loaded = new Promise((r) => (document.readyState === 'complete' ? r() : addEventListener('load', r)));
    Promise.all([minWait, Promise.race([loaded, new Promise((r) => setTimeout(r, 3500))])]).then(go);
  }

  /* ====================================================
     FORMULÁRIOS
     ==================================================== */
  const WA = '5531986800200';
  const form = document.getElementById('contactForm');
  const status = document.getElementById('formStatus');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form).entries());
    let ok = true;
    ['nome', 'email', 'mensagem'].forEach((n) => {
      const f = form.elements[n];
      const bad = !f.value.trim() || (n === 'email' && !/^\S+@\S+\.\S+$/.test(f.value.trim()));
      f.closest('.field').classList.toggle('is-invalid', bad);
      if (bad) ok = false;
    });
    if (!ok) { status.textContent = 'Por favor, preencha os campos destacados.'; return; }
    const nome = [d.nome, d.sobrenome].filter(Boolean).join(' ').trim();
    const text = `Olá! Meu nome é ${nome}.\n${d.mensagem.trim()}\n\nE-mail: ${d.email.trim()}${d.telefone ? '\nTelefone: ' + d.telefone.trim() : ''}`;
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    status.textContent = 'Abrindo o WhatsApp com a sua mensagem…';
    form.reset();
  });
  form.querySelectorAll('input,textarea').forEach((f) => f.addEventListener('input', () => f.closest('.field').classList.remove('is-invalid')));

  document.getElementById('newsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = e.target.querySelector('input');
    const email = input.value.trim();
    if (!email) return;
    const subject = encodeURIComponent('Quero receber ofertas do Central Palace Hotel');
    const body = encodeURIComponent(`Olá! Gostaria de receber ofertas exclusivas neste e-mail: ${email}`);
    location.href = `mailto:reservas@centralpalacehotel.com.br?subject=${subject}&body=${body}`;
    input.value = '';
    input.placeholder = 'Obrigado! Abrindo seu e-mail…';
  });

  document.getElementById('year').textContent = new Date().getFullYear();

  addEventListener('load', () => ScrollTrigger.refresh());
})();
