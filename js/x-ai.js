/* 16-11: AI-blok met vijf tabs — beweging zoals in het klantprototype ("AI-blok landingspagina's", 12-11).
   Per tab een reeks stappen van 500 ms (aantal in data-max). Elementen krijgen hun stand uit data-attributen:
   data-in = verschijnt vanaf stap n, data-on = aan vanaf n, data-hl = alleen gearceerd op stap n,
   data-act = actief op stap n en daarna klaar, data-bar = voortgangsbalk (34% per stap).
   Start zodra het blok in beeld komt; een klik op een tab speelt die tab vanaf het begin. Met reduced motion: direct de eindstand. */
(() => {
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STEP = 500;
  const apply = (p, s) => {
    p.dataset.step = s;
    p.querySelectorAll('[data-in]').forEach(e => e.classList.toggle('is-in', s >= +e.dataset.in));
    p.querySelectorAll('[data-on]').forEach(e => e.classList.toggle('is-on', s >= +e.dataset.on));
    p.querySelectorAll('[data-hl]').forEach(e => e.classList.toggle('is-hl', s === +e.dataset.hl));
    p.querySelectorAll('[data-act]').forEach(e => {
      e.classList.toggle('is-act', s === +e.dataset.act);
      e.classList.toggle('is-done', s > +e.dataset.act);
    });
    p.querySelectorAll('[data-bar]').forEach(e => { e.style.width = Math.min(100, s * 34) + '%'; });
  };
  document.querySelectorAll('.xa[data-live]').forEach(block => {
    const panels = [...block.querySelectorAll('.xa-panel')];
    const heads = [...block.querySelectorAll('.xa-head')];
    const tabs = [...block.querySelectorAll('.hp-tab')];
    let cur = Math.max(0, panels.findIndex(p => !p.hidden)), timer;
    const show = i => {
      [panels, heads].forEach(list => list.forEach((el, k) => { el.hidden = k !== i; }));
      tabs.forEach((t, k) => { t.classList.toggle('is-active', k === i); t.setAttribute('aria-selected', k === i); });
    };
    const play = i => {
      clearInterval(timer);
      cur = i; show(i);
      const p = panels[i], max = +p.dataset.max;
      if (reduce) { apply(p, max); return; }
      let s = 0; apply(p, 0);
      timer = setInterval(() => { s += 1; apply(p, s); if (s >= max) clearInterval(timer); }, STEP);
    };
    tabs.forEach((t, i) => t.addEventListener('click', e => { e.preventDefault(); play(i); }));
    if (reduce || !('IntersectionObserver' in window)) { play(cur); return; }
    apply(panels[cur], 0);   // wacht in de beginstand tot het blok in beeld is
    const io = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) { io.disconnect(); play(cur); }
    }, { threshold: 0.35 });
    io.observe(block);
  });
})();
