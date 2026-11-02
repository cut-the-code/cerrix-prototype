// Prototype in motion (03-11-2026): interacties en scrollbeweging bovenop het ontwerp.
// De 3D-ring (ring.js) en de 3D-sectorobjecten (sectors.js) zijn aparte modules.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const onView = (els, fn, opts = { threshold: 0.25 }) => {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); } }), opts);
    els.forEach(el => io.observe(el));
  };

  // Zonder WebGL valt de hero terug op het statische ringbeeld
  try { if (!document.createElement('canvas').getContext('webgl2')) throw 0; } catch { document.body.classList.add('no-webgl'); }

  // Prototype-label linksonder
  const badge = document.createElement('div');
  badge.className = 'proto-badge';
  badge.innerHTML = 'Prototype CERRIX · ontwerp 03-11<a href="index.html">Home</a><a href="sector-pensioenfondsen.html">Sector</a><a href="regelgeving-dora.html">Regelgeving</a>';
  document.body.append(badge);

  // Placeholderlinks (#) springen niet naar boven
  document.addEventListener('click', e => { const a = e.target.closest('a[href="#"]'); if (a) e.preventDefault(); });

  // ---------- navigatie: dropdown per menu-item (hover op desktop, klik als terugval) ----------
  const header = $('.cx-header');
  const items = $$('.cx-header .wf-nav a.has-sub');
  const dds = $$('.proto-dd');
  let closeT;
  const openDD = label => {
    clearTimeout(closeT);
    items.forEach(a => a.classList.toggle('is-open', a.dataset.label === label));
    dds.forEach(d => d.hidden = d.dataset.dd !== label);
  };
  const closeDD = () => { closeT = setTimeout(() => openDD(null), 160); };
  items.forEach(a => {
    a.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') openDD(a.dataset.label); });
    a.addEventListener('click', e => { e.preventDefault(); openDD(a.classList.contains('is-open') ? null : a.dataset.label); });
  });
  $$('.cx-header .wf-nav a:not(.has-sub)').forEach(a => a.addEventListener('pointerenter', () => openDD(null)));
  [header, ...dds].forEach(el => { el.addEventListener('pointerleave', closeDD); el.addEventListener('pointerenter', () => clearTimeout(closeT)); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') openDD(null); });

  // ---------- hero-intro (homepage en templates) ----------
  const heroCopy = $('.hp-s1 .wf-hero-copy, .tp-s1 .wf-hero-copy, .hp-hero .wf-hero-copy');
  if (heroCopy && !reduce) [...heroCopy.children].forEach((c, i) => { c.classList.add('proto-intro'); c.style.setProperty('--d', `${150 + i * 110}ms`); });

  // ---------- scroll: koppen en kaarten komen binnen ----------
  if (!reduce) {
    const groups = [
      '.wf-section-head', '.wf-section-head--bar', '.hp-trust', '.hp-logos', '.hp-regs', '.hp-product', '.hp-ai-wrap > .wf-eyebrow',
      '.hp-ai-wrap > .wf-h2', '.hp-ai-lead', '.hp-tabs', '.hp-compare', '.hp-s6 .wf-h2', '.hp-case', '.hp-case-tabs', '.tp-proof',
      '.tp-facts', '.tp-regs', '.tp-faq', '.cx-tl', '.tp-tl-panel', '.tp-table', '.tp-ruler',
    ];
    const els = $$(groups.join(',')).filter(el => !el.closest('.hp-s1, .tp-s1, .cx-header, .proto-dd'));
    els.forEach(el => el.setAttribute('data-reveal', ''));
    // kaarten in een rij komen kort na elkaar
    const staggered = ['.hp-srow:not(.proto-more)', '.hp-acard', '.tp-topic', '.lv .enterprise-security .w-layout-grid > *'];
    staggered.forEach(sel => {
      const list = $$(sel);
      list.forEach((el, i) => { el.setAttribute('data-reveal', ''); el.style.setProperty('--d', `${(i % 6) * 90}ms`); });
    });
    onView($$('[data-reveal]'), el => el.classList.add('in'), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  }

  // ---------- blok 3: sectoren — hover-staat volgt de muis, 'Bekijk meer' klapt drie rijen open ----------
  const srows = $('.hp-srows');
  if (srows) {
    const rows = $$('.hp-srow', srows);
    rows.forEach(r => r.addEventListener('pointerenter', () => rows.forEach(x => x.classList.toggle('is-hover', x === r))));
    srows.addEventListener('pointerleave', () => rows.forEach(x => x.classList.remove('is-hover')));
    const more = $('.hp-more', srows);
    if (more) more.addEventListener('click', () => {
      srows.classList.add('is-expanded');
      $$('.proto-more', srows).forEach((r, i) => { r.classList.add('is-new'); r.style.setProperty('--d', `${i * 90}ms`); });
      more.remove();
    });
  }

  // ---------- blok 4: product — klik opent de module, het beeld wisselt mee ----------
  const accs = $('.hp-accs');
  if (accs && window.PROTO_MODULES) {
    const M = window.PROTO_MODULES;
    const openNow = $('.hp-acc.is-open', accs);
    const CHECK = $('.ds-check', openNow)?.outerHTML || '';
    const ARROW = $('.cx-link svg', openNow)?.outerHTML || '';
    const CHEV = $('a.hp-acc .hp-acc-head > svg:last-child', accs)?.outerHTML || '';
    const img = $('.hp-sticky img');
    const tag = t => t ? `<em class="cx-tag">${t}</em>` : '';
    const openHTML = m => `<div class="hp-acc is-open"><div class="hp-acc-head"><span class="ds-tile">${m.icon}</span><strong>${m.title}</strong>${tag(m.tag)}</div>
      <div class="hp-acc-body"><p class="hp-mod-desc">${m.desc}</p>${m.usps.length ? `<ul class="hp-usps">${m.usps.map(u => `<li>${CHECK}<span>${u}</span></li>`).join('')}</ul>` : ''}
      <div class="wf-row"><a class="wf-btn" href="#">Plan een walkthrough</a><a class="cx-link" href="#">Naar de module ${ARROW}</a></div></div></div>`;
    const closedHTML = m => `<a class="hp-acc" href="#"><div class="hp-acc-head"><span class="ds-tile">${m.icon}</span><span>${m.title}</span>${tag(m.tag)}${CHEV}</div></a>`;
    let current = M.findIndex(m => openNow && openNow.textContent.includes(m.title));
    const render = () => { accs.innerHTML = M.map((m, i) => i === current ? openHTML(m) : closedHTML(m)).join(''); };
    accs.addEventListener('click', e => {
      const a = e.target.closest('a.hp-acc'); if (!a) return;
      e.preventDefault();
      current = [...accs.children].indexOf(a);
      render();
      if (img && !img.src.endsWith(M[current].img)) {
        img.classList.add('is-swapping');
        setTimeout(() => { img.src = M[current].img; img.onload = () => img.classList.remove('is-swapping'); }, 220);
      }
    });
  }

  // ---------- blok 5: AI — vraag typt zich uit, antwoord en grafiek bouwen zich op; tabs spelen opnieuw af ----------
  const on = $('.hp-cmp--on');
  if (on) {
    const q = $('.hp-msg-q', on), full = q.textContent;
    $$('.hp-rows > *', on).forEach((el, i) => el.style.setProperty('--d', `${200 + i * 120}ms`));
    $$('.hp-bars i', on).forEach((el, i) => el.style.setProperty('--d', `${300 + i * 110}ms`));
    let run = 0;
    const play = async () => {
      const me = ++run;
      on.classList.add('is-waiting');
      q.innerHTML = '<span class="proto-caret"></span>';
      await wait(450);
      for (let i = 1; i <= full.length; i++) {
        if (me !== run) return;
        q.innerHTML = full.slice(0, i) + '<span class="proto-caret"></span>';
        await wait(reduce ? 0 : 28);
      }
      await wait(350);
      if (me !== run) return;
      q.textContent = full;
      on.classList.remove('is-waiting');
    };
    if (reduce) { q.textContent = full; } else { on.classList.add('is-waiting'); onView([on], play, { threshold: 0.5 }); }
    $$('.hp-tab').forEach(t => t.addEventListener('click', e => {
      e.preventDefault();
      $$('.hp-tab').forEach(x => x.classList.toggle('is-active', x === t));
      if (!reduce) play();
    }));
  }

  // ---------- blok 6: klantverhaal — logo-tabs lopen vanzelf door ----------
  const tabsWrap = $('.hp-case-tabs'), caseCard = $('.hp-case');
  if (tabsWrap && caseCard) {
    const tabs = $$('.ds-logo', tabsWrap), DUR = 7000;
    const bar = $('.hp-progress', tabsWrap);
    let idx = tabs.findIndex(t => t.classList.contains('is-active')), timer;
    const select = (i, animate = true) => {
      idx = (i + tabs.length) % tabs.length;
      tabs.forEach((t, k) => t.classList.toggle('is-active', k === idx));
      tabs[idx].append(bar);
      const fill = $('i', bar);
      fill.classList.remove('is-running'); void fill.offsetWidth;
      tabsWrap.style.setProperty('--dur', `${DUR}ms`);
      if (!reduce) fill.classList.add('is-running');
      if (animate) { caseCard.classList.add('is-swapping'); setTimeout(() => caseCard.classList.remove('is-swapping'), 350); }
      clearTimeout(timer);
      if (!reduce) timer = setTimeout(() => select(idx + 1), DUR);
    };
    tabs.forEach((t, k) => t.addEventListener('click', e => { e.preventDefault(); select(k); }));
    onView([tabsWrap], () => select(idx, false), { threshold: 0.4 });
  }

  // ---------- tijdlijn (sector + regelgeving): de lijn loopt vol tot de actieve stap zodra hij in beeld komt.
  // Stappen zijn (nog) niet klikbaar: er is per stap nog geen eigen inhoud voor de kaart eronder.
  if (!reduce) $$('.cx-tl').forEach(tl => {
    tl.classList.add('is-idle');
    onView([tl], () => setTimeout(() => tl.classList.remove('is-idle'), 250), { threshold: 0.4 });
  });

  // ---------- FAQ: vraag klapt open (antwoord = placeholder tot de klant teksten levert) ----------
  $$('.tp-faq-q').forEach(q => {
    const a = document.createElement('div');
    a.className = 'proto-faq-a';
    a.textContent = '[Antwoord volgt. Kort en concreet, twee tot drie zinnen, met een link naar de pagina die er dieper op ingaat.]';
    q.append(a);
    q.addEventListener('click', () => q.classList.toggle('is-open'));
  });

  // ---------- 'Van vereiste naar module': hover alleen op de modulekaart ----------
  const trs = $$('.tp-table tbody tr');
  if (trs.length) {
    trs.forEach(tr => {
      const mod = $('.tp-mod', tr);
      mod?.addEventListener('pointerenter', () => trs.forEach(x => x.classList.toggle('is-hover', x === tr)));
    });
    $('.tp-table')?.addEventListener('pointerleave', () => trs.forEach((x, k) => x.classList.toggle('is-hover', k === 0)));
  }
})();
