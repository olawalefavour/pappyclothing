// PAPPY CLOTHING — interactions
(function () {
  // NAV scroll state
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile burger
  const burger = document.getElementById('burger');
  const navMobile = document.getElementById('navMobile');
  burger.addEventListener('click', () => navMobile.classList.toggle('is-open'));
  navMobile.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navMobile.classList.remove('is-open')));

  // Countdown — 30 days from now
  const target = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const cdEls = {
    d: document.querySelector('[data-k="d"]'),
    h: document.querySelector('[data-k="h"]'),
    m: document.querySelector('[data-k="m"]'),
    s: document.querySelector('[data-k="s"]'),
  };
  const pad = n => String(n).padStart(2, '0');
  function tick() {
    const diff = Math.max(0, target - Date.now());
    cdEls.d.textContent = pad(Math.floor(diff / 86400000));
    cdEls.h.textContent = pad(Math.floor((diff / 3600000) % 24));
    cdEls.m.textContent = pad(Math.floor((diff / 60000) % 60));
    cdEls.s.textContent = pad(Math.floor((diff / 1000) % 60));
  }
  tick();
  setInterval(tick, 1000);

  // Gallery
  const gallery = document.getElementById('gallery');
  const thumbs = document.getElementById('thumbs');
  thumbs.addEventListener('click', e => {
    const btn = e.target.closest('.thumb');
    if (!btn) return;
    const i = btn.dataset.i;
    thumbs.querySelectorAll('.thumb').forEach(t => t.classList.toggle('is-active', t.dataset.i === i));
    gallery.querySelectorAll('.gallery__img').forEach(img => img.classList.toggle('is-active', img.dataset.i === i));
  });

  // Sizes
  const sizes = document.getElementById('sizes');
  const sumSize = document.getElementById('sumSize');
  sizes.addEventListener('click', e => {
    const btn = e.target.closest('.size');
    if (!btn) return;
    sizes.querySelectorAll('.size').forEach(s => s.classList.remove('is-active'));
    btn.classList.add('is-active');
    if (sumSize) sumSize.textContent = btn.dataset.s;
  });

  // Pre-order form
  const preForm = document.getElementById('preorderForm');
  const preWrap = document.getElementById('preorderWrap');
  const preDone = document.getElementById('preorderDone');
  const orderRef = document.getElementById('orderRef');
  preForm.addEventListener('submit', e => {
    e.preventDefault();
    orderRef.textContent = 'PPY-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    preWrap.hidden = true;
    preDone.hidden = false;
    preDone.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // Circle form
  const circleForm = document.getElementById('circleForm');
  const circleDone = document.getElementById('circleDone');
  circleForm.addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      name: circleForm.querySelector('input[type="text"]').value,
      email: circleForm.querySelector('input[type="email"]').value,
      phone: circleForm.querySelector('input[type="tel"]').value,
      timestamp: new Date().toISOString(),
    };
    try {
      const leads = JSON.parse(localStorage.getItem('pappy_leads') || '[]');
      leads.push(data);
      localStorage.setItem('pappy_leads', JSON.stringify(leads));
    } catch {}
    circleForm.hidden = true;
    circleDone.hidden = false;
  });

  // Reveal on scroll
  const obs = new IntersectionObserver(entries => {
    entries.forEach(en => en.isIntersecting && en.target.classList.add('in'));
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

  // Smooth scroll handled by CSS (scroll-behavior: smooth) + fixed nav offset
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id.length > 1) {
        const tgt = document.querySelector(id);
        if (tgt) {
          e.preventDefault();
          const y = tgt.getBoundingClientRect().top + window.scrollY - 70;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }
    });
  });
})();
