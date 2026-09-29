// Shared language toggle — included on every page
// Translatable elements use data-es="..." data-en="..." attributes
(function () {
  let lang = 'es';
  try { lang = localStorage.getItem('tt_menu_lang') || 'es'; } catch (_) {}

  function applyLang(l) {
    lang = l;
    try { localStorage.setItem('tt_menu_lang', l); } catch (_) {}

    document.querySelectorAll('[data-es][data-en]').forEach(el => {
      const val = l === 'en' ? el.dataset.en : el.dataset.es;
      if ((el.dataset.es || '').includes('<br>') || (el.dataset.en || '').includes('<br>'))
        el.innerHTML = val;
      else
        el.textContent = val;
    });

    const btn = document.getElementById('_lang_fab');
    if (btn) btn.textContent = l === 'en' ? 'EN' : 'ES';

    // Update any date element that has id="dt"
    const dtEl = document.getElementById('dt');
    if (dtEl) {
      const d = new Date();
      const fmt = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
      dtEl.textContent = d.toLocaleDateString(l === 'en' ? 'en-US' : 'es-CO', fmt).toUpperCase();
    }
  }

  function toggle() { applyLang(lang === 'es' ? 'en' : 'es'); }

  // Inject the floating button once DOM is ready
  function inject() {
    if (document.getElementById('_lang_fab')) return;
    const btn = document.createElement('button');
    btn.id = '_lang_fab';
    btn.textContent = lang === 'en' ? 'EN' : 'ES';
    btn.title = 'Switch language / Cambiar idioma';
    btn.onclick = toggle;
    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '18px',
      right: '18px',
      zIndex: '99999',
      fontFamily: "'DM Mono', 'Courier New', monospace",
      fontSize: '10px',
      fontWeight: '500',
      letterSpacing: '.1em',
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,.75)',
      background: 'rgba(26,24,20,.75)',
      border: '1px solid rgba(255,255,255,.18)',
      borderRadius: '4px',
      padding: '6px 11px',
      cursor: 'pointer',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      boxShadow: '0 2px 10px rgba(0,0,0,.3)',
      transition: 'background .15s, color .15s',
    });
    btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(154,125,82,.85)'; btn.style.color = '#fff'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(26,24,20,.75)'; btn.style.color = 'rgba(255,255,255,.75)'; });
    document.body.appendChild(btn);
    applyLang(lang);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
