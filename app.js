(() => {
  'use strict';

  const PALETTE = Array.from({ length: 16 }, (_, i) =>
    `hsl(${Math.round(i * 22.5)}, 65%, 72%)`
  );

  const I18N = {
    nl: {
      appTitle: 'Dagen tot...',
      appTitleShort: 'Dagen tot',
      addAria: 'Nieuwe gebeurtenis toevoegen',
      helpAria: 'Help',
      closeAria: 'Sluiten',
      empty: 'Druk op + om je eerste gebeurtenis toe te voegen.',
      newEvent: 'Nieuwe gebeurtenis',
      editEvent: 'Bewerken',
      title: 'Titel',
      typeLegend: 'Type',
      typeYearly: 'Jaarlijks',
      typeFixed: 'Vaste datum',
      date: 'Datum',
      colorLegend: 'Kleur',
      delete: 'Wissen',
      cancel: 'Annuleren',
      save: 'Opslaan',
      deleteConfirm: 'Deze gebeurtenis wissen?',
      today: 'vandaag',
      dayOne: 'dag',
      dayMany: 'dagen',
      dayOneAgo: 'dag geleden',
      dayManyAgo: 'dagen geleden',
      dragAria: 'Sleep om te verplaatsen',
      colorAria: (n) => `Kleur ${n}`,
      saveToast: 'URL is gewijzigd — sla opnieuw op je beginscherm op',
      months: ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
               'juli', 'augustus', 'september', 'oktober', 'november', 'december'],
    },
    en: {
      appTitle: 'Days Until...',
      appTitleShort: 'Days Until',
      addAria: 'Add new event',
      helpAria: 'Help',
      closeAria: 'Close',
      empty: 'Tap + to add your first event.',
      newEvent: 'New event',
      editEvent: 'Edit',
      title: 'Title',
      typeLegend: 'Type',
      typeYearly: 'Yearly',
      typeFixed: 'Fixed date',
      date: 'Date',
      colorLegend: 'Color',
      delete: 'Delete',
      cancel: 'Cancel',
      save: 'Save',
      deleteConfirm: 'Delete this event?',
      today: 'today',
      dayOne: 'day',
      dayMany: 'days',
      dayOneAgo: 'day ago',
      dayManyAgo: 'days ago',
      dragAria: 'Drag to reorder',
      colorAria: (n) => `Color ${n}`,
      saveToast: 'URL changed — re-save it to your home screen',
      months: ['January', 'February', 'March', 'April', 'May', 'June',
               'July', 'August', 'September', 'October', 'November', 'December'],
    },
  };

  let currentLang = 'nl';
  function t(key) { return I18N[currentLang][key]; }

  const LONG_PRESS_MS = 500;
  const MOVE_TOLERANCE = 8;

  // ---------- URL hash <-> events ----------

  function b64urlEncode(s) {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  const MAX_PAYLOAD = 50000;
  const MAX_EVENTS = 200;
  const MAX_TITLE = 200;

  function decodeData() {
    // Prefer query string (?d=...); fall back to legacy hash (#d=...) for migration.
    let payload = new URLSearchParams(location.search).get('d');
    if (!payload && location.hash.startsWith('#d=')) {
      payload = location.hash.slice(3);
    }
    if (!payload || payload.length > MAX_PAYLOAD) return [];
    try {
      const arr = JSON.parse(b64urlDecode(payload));
      if (!Array.isArray(arr)) return [];
      return arr.filter(e =>
        e && typeof e.t === 'string' && e.t.length > 0 && e.t.length <= MAX_TITLE
        && (e.r === 0 || e.r === 1)
        && typeof e.d === 'string' && e.d.length <= 10
        && Number.isInteger(e.c) && e.c >= 0 && e.c < 16
      ).slice(0, MAX_EVENTS);
    } catch {
      return [];
    }
  }

  function encodeData(events) {
    const payload = b64urlEncode(JSON.stringify(events));
    history.replaceState(null, '', location.pathname + '?d=' + payload);
  }

  // ---------- Date math ----------

  function todayLocal() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function targetDate(ev, today) {
    if (ev.r === 1) {
      const [mm, dd] = ev.d.split('-').map(Number);
      let d = new Date(today.getFullYear(), mm - 1, dd);
      if (d < today) d = new Date(today.getFullYear() + 1, mm - 1, dd);
      return d;
    } else {
      const [y, m, day] = ev.d.split('-').map(Number);
      return new Date(y, m - 1, day);
    }
  }

  function daysBetween(a, b) {
    return Math.round((b - a) / 86400000);
  }

  function formatDate(ev, target) {
    const m = t('months')[target.getMonth()];
    const d = target.getDate();
    return ev.r === 1
      ? `${d} ${m}`
      : `${d} ${m} ${target.getFullYear()}`;
  }

  // ---------- Render ----------

  const elEvents = document.getElementById('events');
  const elEmpty = document.getElementById('empty');
  const eventTpl = document.getElementById('event-tpl');

  let events = decodeData();

  function setDaysText(daysEl, days) {
    daysEl.textContent = '';
    if (days === 0) {
      daysEl.textContent = t('today');
      return;
    }
    const n = Math.abs(days);
    const label = days > 0
      ? (days === 1 ? t('dayOne') : t('dayMany'))
      : (days === -1 ? t('dayOneAgo') : t('dayManyAgo'));
    daysEl.textContent = String(n);
    const span = document.createElement('span');
    span.className = 'label';
    span.textContent = label;
    daysEl.appendChild(span);
  }

  function render() {
    elEvents.textContent = '';
    elEmpty.hidden = events.length > 0;

    const today = todayLocal();
    events.forEach((ev, idx) => {
      const target = targetDate(ev, today);
      const days = daysBetween(today, target);
      const dateStr = formatDate(ev, target);

      const el = eventTpl.content.firstElementChild.cloneNode(true);
      el.dataset.idx = idx;
      el.style.setProperty('--ev-color', PALETTE[ev.c]);
      if (days < 0) el.classList.add('past');

      el.querySelector('.title').textContent = ev.t;
      el.querySelector('.date').textContent = dateStr;
      el.querySelector('.handle').setAttribute('aria-label', t('dragAria'));
      setDaysText(el.querySelector('.days'), days);

      attachLongPress(el, idx);
      attachDrag(el, idx);
      elEvents.appendChild(el);
    });
  }

  // ---------- Long press ----------

  function attachLongPress(el, idx) {
    let timer = null;
    let startX = 0, startY = 0;
    let fired = false;

    const cancel = () => {
      if (timer) { clearTimeout(timer); timer = null; }
    };

    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.handle')) return;
      if (e.button !== undefined && e.button !== 0) return;
      fired = false;
      startX = e.clientX;
      startY = e.clientY;
      cancel();
      timer = setTimeout(() => {
        timer = null;
        fired = true;
        if (navigator.vibrate) navigator.vibrate(20);
        openEditModal(idx);
      }, LONG_PRESS_MS);
    });

    el.addEventListener('pointermove', (e) => {
      if (!timer) return;
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_TOLERANCE) cancel();
    });

    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t =>
      el.addEventListener(t, cancel)
    );
  }

  // ---------- Drag reorder ----------

  function attachDrag(el, idx) {
    const handle = el.querySelector('.handle');
    let active = false;
    let pointerId = null;
    let startY = 0;
    let originY = 0;
    let rects = [];

    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      active = true;
      pointerId = e.pointerId;
      startY = e.clientY;
      originY = el.getBoundingClientRect().top;
      rects = Array.from(elEvents.children).map(c => {
        const r = c.getBoundingClientRect();
        return { el: c, top: r.top, bottom: r.bottom, mid: (r.top + r.bottom) / 2 };
      });
      el.classList.add('dragging');
      el.style.zIndex = '5';
      handle.setPointerCapture(pointerId);
    });

    handle.addEventListener('pointermove', (e) => {
      if (!active) return;
      const dy = e.clientY - startY;
      el.style.transform = `translateY(${dy}px)`;

      const currentMid = originY + dy + el.offsetHeight / 2;
      clearDropMarkers();
      let target = null;
      let position = null;
      for (const r of rects) {
        if (r.el === el) continue;
        if (currentMid < r.mid) {
          target = r.el; position = 'before'; break;
        }
      }
      if (!target) {
        const others = rects.filter(r => r.el !== el);
        if (others.length) { target = others[others.length - 1].el; position = 'after'; }
      }
      if (target) target.classList.add(position === 'before' ? 'drop-target-before' : 'drop-target-after');
    });

    const finish = (e) => {
      if (!active) return;
      active = false;
      el.classList.remove('dragging');
      el.style.transform = '';
      el.style.zIndex = '';
      const dy = (e.clientY ?? startY) - startY;
      const currentMid = originY + dy + el.offsetHeight / 2;

      let newIdx = events.length - 1;
      const order = rects.filter(r => r.el !== el);
      for (let i = 0; i < order.length; i++) {
        if (currentMid < order[i].mid) {
          newIdx = Number(order[i].el.dataset.idx);
          if (newIdx > idx) newIdx -= 1;
          break;
        }
        newIdx = Number(order[i].el.dataset.idx);
        if (newIdx > idx) newIdx -= 1;
      }

      clearDropMarkers();
      try { handle.releasePointerCapture(pointerId); } catch {}

      if (newIdx !== idx) {
        const [moved] = events.splice(idx, 1);
        events.splice(newIdx, 0, moved);
        save();
      }
    };

    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
  }

  function clearDropMarkers() {
    elEvents.querySelectorAll('.drop-target-before, .drop-target-after')
      .forEach(el => el.classList.remove('drop-target-before', 'drop-target-after'));
  }

  // ---------- Edit modal ----------

  const modal = document.getElementById('modal');
  const form = document.getElementById('edit-form');
  const modalTitle = document.getElementById('modal-title');
  const deleteBtn = document.getElementById('delete-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const colorGrid = document.getElementById('color-grid');

  // Build color swatches once. Aria-labels are localized by applyLang().
  PALETTE.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.style.background = c;
    b.dataset.color = i;
    b.dataset.swatchIdx = i + 1;
    b.addEventListener('click', () => {
      colorGrid.querySelectorAll('button').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
    });
    colorGrid.appendChild(b);
  });

  let editingIdx = null;

  function openEditModal(idx) {
    editingIdx = idx;
    const isNew = idx === null;
    const ev = isNew
      ? { t: '', r: 1, d: '', c: Math.floor(Math.random() * 16) }
      : events[idx];

    modalTitle.textContent = isNew ? t('newEvent') : t('editEvent');
    deleteBtn.hidden = isNew;

    form.title.value = ev.t;
    form.querySelector(`input[name=type][value="${ev.r}"]`).checked = true;
    setDateInput(ev);

    colorGrid.querySelectorAll('button').forEach(b => {
      b.classList.toggle('selected', Number(b.dataset.color) === ev.c);
    });

    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => form.title.focus(), 50);
  }

  function setDateInput(ev) {
    const dateInput = form.date;
    if (ev.r === 1 && ev.d) {
      const [mm, dd] = ev.d.split('-');
      dateInput.value = `${new Date().getFullYear()}-${mm}-${dd}`;
    } else if (ev.r === 0 && ev.d) {
      dateInput.value = ev.d;
    } else {
      dateInput.value = '';
    }
  }

  function closeModal() {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    editingIdx = null;
  }

  cancelBtn.addEventListener('click', closeModal);
  modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);

  form.querySelectorAll('input[name=type]').forEach(radio => {
    radio.addEventListener('change', () => {
      // When switching to yearly, lop off the year for storage purposes,
      // but the native input still requires a full date. Just leave the value;
      // we only store MM-DD on save.
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = form.title.value.trim();
    const r = Number(form.querySelector('input[name=type]:checked').value);
    const dateVal = form.date.value;
    const selected = colorGrid.querySelector('button.selected');
    if (!title || !dateVal || !selected) return;

    const c = Number(selected.dataset.color);
    const d = r === 1 ? dateVal.slice(5) : dateVal; // MM-DD or YYYY-MM-DD

    const ev = { t: title, r, d, c };
    if (editingIdx === null) {
      events.push(ev);
    } else {
      events[editingIdx] = ev;
    }
    closeModal();
    save();
  });

  deleteBtn.addEventListener('click', () => {
    if (editingIdx === null) return;
    if (!confirm(t('deleteConfirm'))) return;
    events.splice(editingIdx, 1);
    closeModal();
    save();
  });

  document.getElementById('add-btn').addEventListener('click', () => openEditModal(null));

  // ---------- Info overlay + language ----------

  const infoOverlay = document.getElementById('info-overlay');
  const infoBtn = document.getElementById('info-btn');
  const infoCloseBtn = document.getElementById('info-close-btn');
  const appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');

  function getInitialLang() {
    const stored = (() => { try { return localStorage.getItem('lang'); } catch { return null; } })();
    if (stored === 'nl' || stored === 'en') return stored;
    return (navigator.language || '').toLowerCase().startsWith('nl') ? 'nl' : 'en';
  }

  function applyLang(lang) {
    currentLang = lang;
    try { localStorage.setItem('lang', lang); } catch {}

    document.documentElement.lang = lang;
    document.title = t('appTitle');
    if (appleTitleMeta) appleTitleMeta.setAttribute('content', t('appTitleShort'));

    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      el.setAttribute('aria-label', t(el.dataset.i18nAria));
    });

    // Color swatch aria-labels (built dynamically).
    colorGrid.querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-label', t('colorAria')(Number(b.dataset.swatchIdx)));
    });

    // Help overlay: show only the matching language block + highlight flag.
    infoOverlay.querySelectorAll('.info-content').forEach(el => {
      el.hidden = el.dataset.lang !== lang;
    });
    infoOverlay.querySelectorAll('.lang-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.lang === lang);
    });

    // Re-render events so date strings and day labels reflect the new language.
    render();
  }

  function openInfo() {
    infoOverlay.hidden = false;
    infoOverlay.setAttribute('aria-hidden', 'false');
  }
  function closeInfo() {
    infoOverlay.hidden = true;
    infoOverlay.setAttribute('aria-hidden', 'true');
  }

  infoBtn.addEventListener('click', openInfo);
  infoCloseBtn.addEventListener('click', closeInfo);
  infoOverlay.querySelector('[data-close-info]').addEventListener('click', closeInfo);
  infoOverlay.querySelectorAll('.lang-btn').forEach(b => {
    b.addEventListener('click', () => applyLang(b.dataset.lang));
  });

  // ---------- Save + toast ----------

  const toast = document.getElementById('toast');
  let toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
  }

  function save() {
    encodeData(events);
    render();
    updateManifestLink();
    showToast(t('saveToast'));
  }

  // ---------- Dynamic manifest (non-iOS only) ----------

  // iOS Safari drops query strings when launching from a PWA with start_url,
  // so we only inject a manifest on other platforms. On those platforms the
  // manifest captures the current URL (including ?d=…) as start_url, so the
  // installed app launches with the events frozen at install time.
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  let manifestBlobUrl = null;
  function updateManifestLink() {
    if (isIOS) return;
    const manifest = {
      name: 'Dagen tot...',
      short_name: 'Dagen tot',
      start_url: location.href,
      scope: './',
      display: 'standalone',
      background_color: '#121212',
      theme_color: '#121212',
      lang: 'nl',
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    };
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
    if (manifestBlobUrl) URL.revokeObjectURL(manifestBlobUrl);
    manifestBlobUrl = URL.createObjectURL(blob);
    let link = document.querySelector('link[rel="manifest"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    link.href = manifestBlobUrl;
  }

  // ---------- Init ----------

  // Migrate legacy hash-based URLs to query string so the manifest start_url
  // and Safari "Add to Home Screen" both capture the data.
  if (events.length > 0 && location.hash.startsWith('#d=') && !location.search) {
    encodeData(events);
  }

  applyLang(getInitialLang());
  updateManifestLink();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
