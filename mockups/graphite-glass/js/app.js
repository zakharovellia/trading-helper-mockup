(function () {
  const TH = window.TH;
  const I = TH.icon;
  const S = TH.S;
  const MODES = [
    { v: 'day', label: 'День', icon: 'candles' },
    { v: 'backtest', label: 'Бэктест', icon: 'flask' },
    { v: 'live', label: 'Live', icon: 'live' },
  ];
  let mode = null, seg = null;

  function go(m) {
    if (!TH.views[m] || m === mode) return;
    const prev = mode;
    mode = m;
    history.replaceState(null, '', '#' + m);
    TH.store.set('mode', m);
    TH.closePopover();
    TH.$$('.view').forEach((v) => v.classList.toggle('active', v.dataset.view === m));
    if (prev) TH.views[prev].hide();
    if (seg) seg.set(m, true);
    TH.views[m].show();
  }
  TH.app = { go, mode: () => mode };

  function renderAccount() {
    TH.$('#accountPill').innerHTML = TH.data.ids.map((id) => {
      const e = TH.data.ex(id);
      const a = TH.live.account(id);
      return `<div class="acc-seg">${TH.exAva(id, S.data.conn[id].ok)}<div class="acc-txt"><b>${TH.money(a.equity, e.cur)}</b><small><span class="${TH.cls(a.dayPnl)}">${TH.moneyS(a.dayPnl, e.cur)}</span> сегодня</small></div></div>`;
    }).join('<span class="acc-div"></span>') + `<span class="faint acc-chev">${I('chevD', 12, 2.2)}</span>`;
  }

  function marketState(ex) {
    const t = TH.data.nowFake(ex);
    const mins = Math.floor((t % 86400) / 60);
    const wd = new Date(t * 1000).getUTCDay();
    let label, dot = 'pulse';
    if (ex.id === 'finam') {
      if (wd === 0 || wd === 6) { label = 'Выходной'; dot = 'gray'; }
      else if (mins >= 600 && mins < 1130) label = 'Основная сессия';
      else if (mins >= 1145 && mins < 1430) { label = 'Вечерняя сессия'; dot = 'orange'; }
      else if (mins >= 410 && mins < 590) { label = 'Утренняя сессия'; dot = 'orange'; }
      else { label = 'Торги закрыты'; dot = 'gray'; }
    } else label = 'Торги 24/7';
    return { t, label, dot };
  }
  TH.marketState = marketState;

  function renderMarket() {
    TH.$('#marketChip').innerHTML = TH.data.ids.map((id) => {
      const ex = TH.data.ex(id);
      const m = marketState(ex);
      return `<span class="mk-seg" title="${ex.full} · ${m.label}"><span class="dot ${m.dot}"></span><b>${ex.market}</b><span class="mk-lbl">${m.label}</span><span class="mk-time">${TH.d.hm(m.t)} ${ex.tz}</span></span>`;
    }).join('<span class="mk-div"></span>');
  }

  function init() {
    document.body.classList.toggle('no-motion', !S.data.general.motion);
    TH.$('#brandLogo').innerHTML = TH.logo();
    TH.$('#menuBtn').innerHTML = I('menu', 18, 2);
    seg = TH.seg(TH.$('#modeSeg'), MODES, null, (v) => go(v), { size: 'lg' });
    TH.$('#accountPill').onclick = () => TH.openSettings('account');
    TH.$('#menuBtn').onclick = (e) => TH.openMenu(e.currentTarget);
    renderAccount();
    renderMarket();
    setInterval(renderMarket, 1000);
    TH.bus.on('account', renderAccount);
    TH.bus.on('conn', renderAccount);
    const h = location.hash.slice(1);
    go(TH.views[h] ? h : TH.store.get('mode', 'day'));

    document.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (TH.typing() || document.querySelector('.backdrop')) return;
      if (e.key === '1' || e.key === '2' || e.key === '3') { go(MODES[+e.key - 1].v); e.preventDefault(); return; }
      if (e.key === ',' || e.key === 'б') { TH.openSettings(); e.preventDefault(); return; }
      if (e.key === '?') { TH.openHotkeys(); e.preventDefault(); return; }
      const v = TH.views[mode];
      if (v && v.key && v.key(e)) e.preventDefault();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
