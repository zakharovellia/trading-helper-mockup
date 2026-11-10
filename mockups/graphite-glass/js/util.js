(function () {
  const TH = (window.TH = window.TH || {});
  TH.views = {};

  TH.$ = (s, r = document) => r.querySelector(s);
  TH.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  TH.el = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };
  TH.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  TH.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  TH.sum = (a, f = (x) => x) => a.reduce((s, x) => s + f(x), 0);
  TH.uid = () => Math.random().toString(36).slice(2, 10);

  const handlers = {};
  TH.bus = {
    on(e, f) { (handlers[e] = handlers[e] || []).push(f); return () => TH.bus.off(e, f); },
    off(e, f) { handlers[e] = (handlers[e] || []).filter((x) => x !== f); },
    emit(e, ...a) { (handlers[e] || []).forEach((f) => f(...a)); },
  };

  TH.store = {
    get(k, d) {
      try {
        const v = localStorage.getItem('thg.' + k);
        return v == null ? d : JSON.parse(v);
      } catch (e) { return d; }
    },
    set(k, v) {
      try { localStorage.setItem('thg.' + k, JSON.stringify(v)); } catch (e) { }
    },
    clear() {
      Object.keys(localStorage).filter((k) => k.startsWith('thg.')).forEach((k) => localStorage.removeItem(k));
    },
  };

  TH.hash = function (str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
  TH.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  TH.gauss = function (r) {
    let u = 0;
    while (u === 0) u = r();
    const v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const nfc = {};
  TH.nf = (dp) => nfc[dp] || (nfc[dp] = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: dp, maximumFractionDigits: dp }));
  TH.fmt = (v, dp = 2) => (v == null || !isFinite(v) ? '—' : TH.nf(dp).format(v));
  TH.sign = (v) => (v > 0 ? '+' : v < 0 ? '−' : '');
  TH.fmtS = (v, dp = 2) => (v == null || !isFinite(v) ? '—' : TH.sign(v) + TH.nf(dp).format(Math.abs(v)));
  TH.pct = (v, dp = 2, signed = true) => (v == null || !isFinite(v) ? '—' : (signed ? TH.fmtS(v, dp) : TH.fmt(v, dp)) + '%');
  TH.money = (v, cur = '₽', dp) => {
    if (v == null || !isFinite(v)) return '—';
    if (dp == null) dp = cur === '₽' ? 0 : 2;
    return (v < 0 ? '−' : '') + TH.nf(dp).format(Math.abs(v)) + '\u00a0' + cur;
  };
  TH.moneyS = (v, cur = '₽', dp) => {
    if (v == null || !isFinite(v)) return '—';
    if (dp == null) dp = cur === '₽' ? 0 : 2;
    return TH.sign(v) + TH.nf(dp).format(Math.abs(v)) + '\u00a0' + cur;
  };
  TH.compact = (v) => {
    const a = Math.abs(v);
    if (a >= 1e9) return TH.fmt(v / 1e9, 2) + ' млрд';
    if (a >= 1e6) return TH.fmt(v / 1e6, 2) + ' млн';
    if (a >= 1e4) return TH.fmt(v / 1e3, 1) + ' тыс';
    return TH.fmt(v, 0);
  };
  TH.cls = (v) => (v > 0 ? 'pos' : v < 0 ? 'neg' : '');

  const dtf = (o) => new Intl.DateTimeFormat('ru-RU', Object.assign({ timeZone: 'UTC' }, o));
  const F = {
    long: dtf({ weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }),
    med: dtf({ day: 'numeric', month: 'short', year: 'numeric' }),
    dm: dtf({ day: '2-digit', month: '2-digit' }),
    dmy: dtf({ day: '2-digit', month: '2-digit', year: 'numeric' }),
    dmShort: dtf({ day: 'numeric', month: 'short' }),
    hm: dtf({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
    hms: dtf({ hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }),
    month: dtf({ month: 'long', year: 'numeric' }),
    mon: dtf({ month: 'short' }),
    wd: dtf({ weekday: 'long' }),
  };
  const ms = (t) => t * 1000;
  TH.d = {
    long: (t) => { const s = F.long.format(ms(t)).replace(/\s?г\.$/, ''); return s.charAt(0).toUpperCase() + s.slice(1); },
    med: (t) => F.med.format(ms(t)).replace(/\s?г\.$/, ''),
    dm: (t) => F.dm.format(ms(t)),
    dmy: (t) => F.dmy.format(ms(t)),
    dmShort: (t) => F.dmShort.format(ms(t)).replace('.', ''),
    hm: (t) => F.hm.format(ms(t)),
    hms: (t) => F.hms.format(ms(t)),
    dmhm: (t) => F.dm.format(ms(t)) + ' ' + F.hm.format(ms(t)),
    month: (t) => F.month.format(ms(t)).replace(/\s?г\.$/, ''),
    mon: (t) => F.mon.format(ms(t)).replace('.', ''),
    wd: (t) => F.wd.format(ms(t)),
    iso: (t) => new Date(ms(t)).toISOString().slice(0, 10),
    fromIso: (s) => Math.floor(Date.parse(s + 'T00:00:00Z') / 1000),
  };
  TH.dur = (sec) => {
    sec = Math.max(0, Math.round(sec));
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    if (d) return `${d} д ${h} ч`;
    if (h) return `${h} ч ${m} м`;
    if (m) return `${m} м`;
    return `${sec} с`;
  };

  const I = {
    candles: '<path d="M7 3.5v3M7 17v3.5M17 3v4.5M17 15.5V21"/><rect x="4.8" y="6.5" width="4.4" height="10.5" rx="1.2"/><rect x="14.8" y="7.5" width="4.4" height="8" rx="1.2"/>',
    flask: '<path d="M9 3h6M10 3.2v5.6L4.6 18.2A1.8 1.8 0 0 0 6.2 21h11.6a1.8 1.8 0 0 0 1.6-2.8L14 8.8V3.2"/><path d="M7.2 14.5h9.6"/>',
    live: '<circle cx="12" cy="12" r="2.2"/><path d="M8.2 15.8a5.4 5.4 0 0 1 0-7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.2 18.8a9.6 9.6 0 0 1 0-13.6M18.8 5.2a9.6 9.6 0 0 1 0 13.6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    chevL: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
    chevR: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
    chevD: '<path d="M6 9.5l6 6 6-6"/>',
    chevUD: '<path d="M8 9.5l4-4 4 4M8 14.5l4 4 4-4"/>',
    cursor: '<path d="M5.5 3.8l12.6 6.3-5.4 1.8-1.9 5.6z"/><path d="M12.8 12l4.6 4.6"/>',
    level: '<path d="M3 12h18"/><path d="M3 7.5h4M3 16.5h4" opacity=".45"/><circle cx="14" cy="12" r="2.2" fill="currentColor" stroke="none"/>',
    trend: '<path d="M5 18.5L19 5.5"/><circle cx="5" cy="18.5" r="2"/><circle cx="19" cy="5.5" r="2"/>',
    zone: '<rect x="3.8" y="7" width="16.4" height="10" rx="1.6"/><path d="M3.8 12h16.4" opacity=".4"/>',
    eraser: '<path d="M15.5 4.2l4.3 4.3a1.4 1.4 0 0 1 0 2L11.3 19H7.2l-3-3a1.4 1.4 0 0 1 0-2l9.3-9.8a1.4 1.4 0 0 1 2 0z"/><path d="M9.8 8.2l6 6M11.3 19H20"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12.2a1.5 1.5 0 0 0 1.5 1.3h6.2a1.5 1.5 0 0 0 1.5-1.3L17.5 7"/>',
    wave: '<path d="M3 16.5c2.6 0 3.4-9 6.2-9s3.6 7.5 6.2 7.5c2 0 2.6-3 5.6-3"/>',
    sidebar: '<rect x="3.2" y="4.2" width="17.6" height="15.6" rx="3"/><path d="M14.8 4.4v15.2"/>',
    sidebarL: '<rect x="3.2" y="4.2" width="17.6" height="15.6" rx="3"/><path d="M9.2 4.4v15.2"/>',
    note: '<path d="M6 3.8h8.2l4 4V19a1.4 1.4 0 0 1-1.4 1.4H6A1.4 1.4 0 0 1 4.6 19V5.2A1.4 1.4 0 0 1 6 3.8z"/><path d="M13.8 4v4.4h4.4M8 13h8M8 16.5h5"/>',
    play: '<path d="M7.5 5.2v13.6a.8.8 0 0 0 1.2.7l11-6.8a.8.8 0 0 0 0-1.4l-11-6.8a.8.8 0 0 0-1.2.7z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6.5" y="5" width="3.8" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.7" y="5" width="3.8" height="14" rx="1" fill="currentColor" stroke="none"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2.2" fill="currentColor" stroke="none"/>',
    close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3.1 2"/>',
    download: '<path d="M12 4v11M7.2 10.4L12 15.2l4.8-4.8M5 19.5h14"/>',
    key: '<circle cx="8" cy="15" r="4.2"/><path d="M11 12l8.5-8.5M16.5 6.5l2.2 2.2M14.3 8.7l1.8 1.8"/>',
    wallet: '<rect x="3.2" y="6.2" width="17.6" height="13.6" rx="3"/><path d="M3.4 10.2h17.2"/><circle cx="16.4" cy="14.8" r="1.2" fill="currentColor" stroke="none"/><path d="M6 6.2l9.5-2.6a1.4 1.4 0 0 1 1.8 1.3v1.3"/>',
    shield: '<path d="M12 3.2l7 2.8v5.2c0 4.4-2.9 7.9-7 9.6-4.1-1.7-7-5.2-7-9.6V6z"/><path d="M8.8 12l2.2 2.2 4.4-4.4"/>',
    sliders: '<path d="M4 7h9M18 7h2M4 17h3M11 17h9"/><circle cx="15.5" cy="7" r="2.3"/><circle cx="8.8" cy="17" r="2.3"/>',
    refresh: '<path d="M19.5 11a7.6 7.6 0 1 0-2.2 5.6"/><path d="M19.8 4.6V11h-6.4"/>',
    expand: '<path d="M4.5 9V4.5H9M19.5 9V4.5H15M4.5 15v4.5H9M19.5 15v4.5H15"/>',
    shrink: '<path d="M9 4.5V9H4.5M15 4.5V9h4.5M9 19.5V15H4.5M15 19.5V15h4.5"/>',
    fit: '<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/><path d="M8 13.5l2.5-2.5 2 2 3.5-3.5"/>',
    star: '<path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.6l-5.1 2.7 1-5.7-4.1-4 5.7-.8z" fill="currentColor" stroke="none"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.4"/><path d="M15.6 15.6l4.6 4.6"/>',
    calendar: '<rect x="3.8" y="5.2" width="16.4" height="15" rx="2.8"/><path d="M3.8 10h16.4M8 3.2v4M16 3.2v4"/>',
    bolt: '<path d="M13.2 3L5.4 13.4h6.1L10.6 21l8-10.6h-6.2z"/>',
    plug: '<path d="M9 3.5v4M15 3.5v4M6.8 7.5h10.4v3.8a5.2 5.2 0 0 1-10.4 0zM12 16.5v4"/>',
    info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.2"/><circle cx="12" cy="7.8" r=".6" fill="currentColor"/>',
    warn: '<path d="M12 4l9 15.6H3z"/><path d="M12 10v4.2"/><circle cx="12" cy="17" r=".5" fill="currentColor"/>',
    arrowUR: '<path d="M7 17L17 7M9 7h8v8"/>',
    arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    target: '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="4.4"/><circle cx="12" cy="12" r=".9" fill="currentColor"/>',
    globe: '<circle cx="12" cy="12" r="8.6"/><path d="M3.6 12h16.8M12 3.4c2.4 2.4 3.6 5.3 3.6 8.6s-1.2 6.2-3.6 8.6c-2.4-2.4-3.6-5.3-3.6-8.6s1.2-6.2 3.6-8.6z"/>',
    power: '<path d="M12 3.5v8"/><path d="M6.4 7.2a7.8 7.8 0 1 0 11.2 0"/>',
    list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1" fill="currentColor"/><circle cx="4.8" cy="12" r="1" fill="currentColor"/><circle cx="4.8" cy="17.5" r="1" fill="currentColor"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.8"/>',
    eye: '<path d="M2.8 12S6.2 5.5 12 5.5 21.2 12 21.2 12 17.8 18.5 12 18.5 2.8 12 2.8 12z"/><circle cx="12" cy="12" r="2.8"/>',
    eyeOff: '<path d="M4 4l16 16M10 6a9 9 0 0 1 2-.5c5.8 0 9.2 6.5 9.2 6.5a16 16 0 0 1-2.6 3.4M6.6 7.7C4.2 9.4 2.8 12 2.8 12s3.4 6.5 9.2 6.5a8.7 8.7 0 0 0 4.3-1.1"/><path d="M9.9 10a2.8 2.8 0 0 0 4 4"/>',
    dots: '<circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
    export: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2.4"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
    keyboard: '<rect x="2.8" y="6" width="18.4" height="12" rx="2.6"/><path d="M6.5 9.5h.01M10 9.5h.01M13.5 9.5h.01M17 9.5h.01M6.5 12.5h.01M17 12.5h.01M8.5 15h7"/>',
    sparkle: '<path d="M12 3.5l1.6 4.9 4.9 1.6-4.9 1.6L12 16.5l-1.6-4.9L5.5 10l4.9-1.6z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
    layers: '<path d="M12 4l8.5 4.5L12 13 3.5 8.5z"/><path d="M3.5 12.5L12 17l8.5-4.5M3.5 16.2L12 20.7l8.5-4.5" opacity=".6"/>',
    halfL: '<path d="M12 4v16"/><path d="M5 8l-2 4 2 4M19 8l2 4-2 4"/>',
    shieldStop: '<path d="M12 3.2l7 2.8v5.2c0 4.4-2.9 7.9-7 9.6-4.1-1.7-7-5.2-7-9.6V6z"/><path d="M12 8.5V12"/><circle cx="12" cy="15" r=".6" fill="currentColor"/>',
    mic: '<rect x="9" y="3.2" width="6" height="11.3" rx="3"/><path d="M5.6 11.2a6.4 6.4 0 0 0 12.8 0M12 17.6v3.2M8.8 20.8h6.4"/>',
    pen: '<path d="M4.2 19.8h4.1L19.4 8.7a2.1 2.1 0 0 0 0-3l-1.1-1.1a2.1 2.1 0 0 0-3 0L4.2 15.7z"/><path d="M13.8 6.2l4 4"/>',
    code: '<path d="M8.6 7L3.6 12l5 5M15.4 7l5 5-5 5"/>',
    trophy: '<path d="M7.8 3.8h8.4v5.4a4.2 4.2 0 0 1-8.4 0z"/><path d="M7.8 5.6H4.6v1.2a3.2 3.2 0 0 0 3.4 3.2M16.2 5.6h3.2v1.2a3.2 3.2 0 0 1-3.4 3.2M12 13.4v3.4M8.6 20.4h6.8M9.6 16.8h4.8v3.6H9.6z"/>',
    user: '<circle cx="12" cy="8.4" r="3.8"/><path d="M4.6 20.2c.8-3.9 3.7-6 7.4-6s6.6 2.1 7.4 6"/>',
    users: '<circle cx="9" cy="8.6" r="3.3"/><path d="M2.9 19.6c.6-3.3 3-5.1 6.1-5.1s5.5 1.8 6.1 5.1"/><circle cx="17.1" cy="9.6" r="2.5"/><path d="M16.6 14.6c2.4.2 4 1.8 4.5 4.6"/>',
    share: '<circle cx="6.2" cy="12" r="2.4"/><circle cx="17.6" cy="6" r="2.4"/><circle cx="17.6" cy="18" r="2.4"/><path d="M8.4 10.9l7-3.7M8.4 13.1l7 3.7"/>',
    lock: '<rect x="5.2" y="10.6" width="13.6" height="9.8" rx="2.4"/><path d="M8.3 10.6V7.9a3.7 3.7 0 0 1 7.4 0v2.7"/>',
    filter: '<path d="M4 5.4h16l-6.2 7.4v5.4l-3.6 1.8v-7.2z"/>',
    send: '<path d="M20.5 3.5L10.2 13.8M20.5 3.5l-6.6 17-3.7-6.7-6.7-3.7z"/>',
    gitBranch: '<circle cx="6.5" cy="5.5" r="2.2"/><circle cx="6.5" cy="18.5" r="2.2"/><circle cx="17.5" cy="7.5" r="2.2"/><path d="M6.5 7.7v8.6M17.5 9.7c0 4.4-6.6 3.4-10 6.6"/>',
  };
  TH.icon = (name, size = 16, sw = 1.8) =>
    `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${I[name] || ''}</svg>`;

  TH.logo = () => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fd3ff"/><stop offset="1" stop-color="#5E5CE6"/></linearGradient></defs><path d="M3 16.5l5-5.5 4 3.5 8.5-9" stroke="url(#lg1)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20.5" cy="5.5" r="1.9" fill="#8fd3ff"/><path d="M3 20.5h18" stroke="rgba(255,255,255,.28)" stroke-width="1.6" stroke-linecap="round"/></svg>`;

  const AVA = ['#0A84FF', '#30D158', '#FF9F0A', '#BF5AF2', '#FF375F', '#64D2FF', '#5E5CE6', '#66D4CF', '#FFD60A'];
  TH.avaColor = (sym) => AVA[TH.hash(sym) % AVA.length];
  TH.ava = (sym, cls = 'inst-ava', extra = '') => {
    const c = TH.avaColor(sym);
    const txt = sym.replace(/[^A-Za-z]/g, '').slice(0, 4);
    return `<span class="${cls}" style="background:linear-gradient(145deg, ${c}, ${shade(c, -0.35)});${extra}">${TH.esc(txt)}</span>`;
  };
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(r * (1 + k)); g = Math.round(g * (1 + k)); b = Math.round(b * (1 + k));
    return `rgb(${TH.clamp(r, 0, 255)},${TH.clamp(g, 0, 255)},${TH.clamp(b, 0, 255)})`;
  }
  TH.shade = shade;
  TH.exAva = (ex, st, size = '') => `<span class="ex-ava ${ex} ${size}">${ex === 'finam' ? 'F' : 'H'}${st == null ? '' : `<i class="st ${st ? '' : 'off'}"></i>`}</span>`;
  TH.exTag = (ex) => TH.exAva(ex, null, 'xs');

  TH.openInstPicker = function (anchor, { cur, onPick, quote, align } = {}) {
    const q0 = quote || ((i) => {
      const h = TH.data.history(i.sym);
      const a = h.D[h.D.length - 1], b = h.D[h.D.length - 2];
      return { price: a.close, ch: (a.close / b.close - 1) * 100 };
    });
    const wrap = TH.el(`<div class="inst-list">
      <div class="inst-search"><div class="input-wrap"><input class="input" placeholder="Поиск по обеим биржам" data-q><span class="suffix">${TH.icon('search', 14)}</span></div></div>
      <div class="inst-rows" data-rows></div></div>`);
    const rows = wrap.querySelector('[data-rows]');
    const draw = (q) => {
      q = (q || '').toLowerCase();
      let html = '';
      TH.data.ids.forEach((id) => {
        const ex = TH.data.ex(id);
        const list = TH.data.list(id).filter((i) => !q || i.sym.toLowerCase().includes(q) || i.name.toLowerCase().includes(q));
        if (!list.length) return;
        html += `<div class="menu-label ex-label">${TH.exTag(id)}${ex.name} · ${ex.market}</div>` + list.map((i) => {
          const v = q0(i);
          return `<div class="inst-row ${i.sym === cur ? 'cur' : ''}" data-sym="${i.sym}">${TH.ava(i.sym)}<div class="t"><b>${i.sym}</b><small>${TH.esc(i.name)}</small></div><div class="p"><b>${TH.fmt(v.price, i.dp)}</b><small class="${TH.cls(v.ch)}">${TH.pct(v.ch)}</small></div></div>`;
        }).join('');
      });
      rows.innerHTML = html || '<div class="empty-note" style="padding:12px">Ничего не найдено</div>';
    };
    draw();
    const pop = TH.popover(anchor, wrap, { align });
    if (!pop) return;
    const q = wrap.querySelector('[data-q]');
    q.oninput = () => draw(q.value);
    q.onkeydown = (e) => { if (e.key === 'Enter') { const f = rows.querySelector('[data-sym]'); if (f) f.click(); } };
    setTimeout(() => q.focus(), 30);
    rows.addEventListener('click', (e) => {
      const r = e.target.closest('[data-sym]');
      if (!r) return;
      pop.close();
      if (r.dataset.sym !== cur && onPick) onPick(r.dataset.sym);
    });
  };

  let curPop = null;
  TH.popover = function (anchor, content, opts = {}) {
    if (curPop && curPop.anchor === anchor) { curPop.close(); return null; }
    if (curPop) curPop.close();
    const pop = document.createElement('div');
    pop.className = 'popover ' + (opts.className || '');
    if (typeof content === 'string') pop.innerHTML = content; else pop.appendChild(content);
    document.body.appendChild(pop);
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const pw = pop.offsetWidth, ph = pop.offsetHeight;
      let left = opts.align === 'end' ? r.right - pw : opts.align === 'center' ? r.left + r.width / 2 - pw / 2 : r.left;
      left = TH.clamp(left, 8, innerWidth - pw - 8);
      let top = r.bottom + 8;
      if (top + ph > innerHeight - 8) top = Math.max(8, r.top - ph - 8);
      pop.style.left = left + 'px';
      pop.style.top = top + 'px';
    };
    place();
    requestAnimationFrame(() => pop.classList.add('in'));
    const onDown = (e) => { if (!pop.contains(e.target) && !anchor.contains(e.target)) api.close(); };
    const onKey = (e) => { if (e.key === 'Escape') api.close(); };
    setTimeout(() => document.addEventListener('pointerdown', onDown, true), 0);
    document.addEventListener('keydown', onKey);
    const api = {
      el: pop,
      anchor,
      place,
      close() {
        if (!pop.isConnected) return;
        document.removeEventListener('pointerdown', onDown, true);
        document.removeEventListener('keydown', onKey);
        pop.classList.remove('in');
        pop.classList.add('out');
        setTimeout(() => pop.remove(), 170);
        if (curPop === api) curPop = null;
        opts.onClose && opts.onClose();
      },
    };
    curPop = api;
    return api;
  };
  TH.closePopover = () => curPop && curPop.close();

  TH.modal = function (inner, { onClose, sheetClass = '', closeOnBackdrop = true } = {}) {
    TH.closePopover();
    const bd = document.createElement('div');
    bd.className = 'backdrop';
    const sh = document.createElement('div');
    sh.className = 'sheet ' + sheetClass;
    if (typeof inner === 'string') sh.innerHTML = inner; else sh.appendChild(inner);
    bd.appendChild(sh);
    document.body.appendChild(bd);
    requestAnimationFrame(() => bd.classList.add('in'));
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); api.close(); } };
    document.addEventListener('keydown', onKey, true);
    bd.addEventListener('pointerdown', (e) => { if (closeOnBackdrop && e.target === bd) api.close(); });
    const api = {
      el: sh,
      backdrop: bd,
      close(v) {
        if (!bd.isConnected) return;
        document.removeEventListener('keydown', onKey, true);
        bd.classList.remove('in');
        setTimeout(() => bd.remove(), 220);
        onClose && onClose(v);
      },
    };
    return api;
  };

  TH.confirm = function ({ title, message = '', ok = 'OK', cancel = 'Отмена', destructive = false, icon = 'warn', extra = '' }) {
    return new Promise((resolve) => {
      let done = false;
      const color = destructive ? 'var(--red)' : 'var(--blue)';
      const m = TH.modal(
        `<div class="alert">
          <div class="a-ico" style="background:${destructive ? 'rgba(255,69,58,.16)' : 'rgba(10,132,255,.16)'};color:${color}">${TH.icon(icon, 24)}</div>
          <h3>${title}</h3><p>${message}</p>${extra ? `<div class="a-extra">${extra}</div>` : ''}
          <div class="a-btns"><button class="btn" data-a="0">${cancel}</button><button class="btn ${destructive ? 'danger-filled' : 'primary'}" data-a="1">${ok}</button></div>
        </div>`,
        { sheetClass: 'alert-sheet', onClose: () => { if (!done) resolve(false); } }
      );
      m.el.querySelectorAll('[data-a]').forEach((b) =>
        b.addEventListener('click', () => { done = true; resolve(b.dataset.a === '1'); m.close(); })
      );
      setTimeout(() => m.el.querySelector('[data-a="1"]').focus(), 50);
    });
  };

  TH.toast = function (msg, { type = 'success', sub = '', ms: dur = 2600 } = {}) {
    const wrap = document.getElementById('toasts');
    const map = { success: ['check', 'var(--green)'], error: ['close', 'var(--red)'], info: ['info', 'var(--blue)'], warn: ['warn', 'var(--orange)'] };
    const [ic, col] = map[type] || map.info;
    const t = TH.el(`<div class="toast"><span class="t-ico" style="background:${col}">${TH.icon(ic, 13, 2.6)}</span><span>${msg}${sub ? `<small>${sub}</small>` : ''}</span></div>`);
    wrap.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, dur);
  };

  TH.seg = function (el, items, value, onChange, { size = '', iconOnly = false } = {}) {
    el.classList.add('seg');
    if (size) el.classList.add('seg-' + size);
    if (iconOnly) el.classList.add('icons');
    el.innerHTML = '<span class="thumb"></span>' + items.map((it) =>
      `<button type="button" data-v="${TH.esc(it.v)}" title="${TH.esc(it.title || '')}">${it.icon ? TH.icon(it.icon, it.iconSize || 15) : ''}${it.label ? `<span>${it.label}</span>` : ''}</button>`
    ).join('');
    const thumb = el.querySelector('.thumb');
    const place = () => {
      const b = el.querySelector('button.on');
      if (!b) { thumb.style.opacity = 0; return; }
      thumb.style.opacity = 1;
      thumb.style.left = b.offsetLeft + 'px';
      thumb.style.width = b.offsetWidth + 'px';
    };
    const api = {
      value,
      set(v, silent) {
        api.value = v;
        el.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === String(v)));
        place();
        if (!silent && onChange) onChange(v);
      },
      place,
    };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || !el.contains(b) || b.disabled) return;
      const it = items.find((i) => String(i.v) === b.dataset.v);
      if (it) api.set(it.v);
    });
    new ResizeObserver(place).observe(el);
    api.set(value, true);
    return api;
  };

  TH.spark = (vals, { w = 84, h = 26, color = '#30D158', fill = true, stretch = false } = {}) => {
    if (!vals || vals.length < 2) return '';
    let mn = Infinity, mx = -Infinity;
    vals.forEach((v) => { if (v < mn) mn = v; if (v > mx) mx = v; });
    const rg = mx - mn || 1;
    const pts = vals.map((v, i) => [(i / (vals.length - 1)) * w, h - 2 - ((v - mn) / rg) * (h - 4)]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    const sz = stretch ? 'preserveAspectRatio="none"' : `width="${w}" height="${h}"`;
    const ve = stretch ? ' vector-effect="non-scaling-stroke"' : '';
    return `<svg class="spark" ${sz} viewBox="0 0 ${w} ${h}">${fill ? `<path d="${d}L${w} ${h}L0 ${h}Z" fill="${color}" opacity=".12"/>` : ''}<path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"${ve}/></svg>`;
  };

  TH.typing = () => {
    const a = document.activeElement;
    return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable);
  };

  TH.rangeFill = (inp) => {
    const p = ((inp.value - inp.min) / (inp.max - inp.min)) * 100;
    inp.style.setProperty('--p', p + '%');
  };

  TH.checkChip = (id, label, checked) =>
    `<label class="check-chip"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''}><span class="box">${TH.icon('check', 12, 3)}</span>${label}</label>`;
})();
