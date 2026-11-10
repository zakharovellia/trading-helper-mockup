(function () {
  const TH = window.TH;
  const I = TH.icon;

  const DEFAULTS = {
    keys: {
      finam: { token: 'fnm_demo_token', accountId: '0000000' },
      hyperliquid: { address: '0x0000000000000000000000000000000000000000', apiKey: '0x_demo_key', network: 'mainnet' },
    },
    conn: { finam: { ok: true, at: 0 }, hyperliquid: { ok: true, at: 0 } },
    risk: { finam: 1.0, hyperliquid: 0.5 },
    maxDailyLoss: 3,
    maxPositions: 5,
    riskToBacktest: true,
    indicators: { ema9: true, ema21: true, sma50: false, sma200: false, bb: false, vwap: true, volume: true },
    general: { tz: 'exchange', confirmClose: true, sounds: false, motion: true },
    schedules: [
      { id: 'j1', name: 'Вечерняя догрузка MOEX', exch: 'finam', syms: ['SBER', 'GAZP', 'LKOH', 'YDEX', 'Si-6.26'], tfs: ['1m', '1h', '1D'], mode: 'weekdays', time: '19:05', every: 4, depth: 3, gaps: true, enabled: true, last: { ago: 3600 * 20, ok: true, bars: 12480, dur: 14 } },
      { id: 'j2', name: 'Крипто — каждые 4 часа', exch: 'hyperliquid', syms: ['BTC', 'ETH', 'SOL', 'HYPE'], tfs: ['1m', '1h'], mode: 'hours', time: '00:00', every: 4, depth: 1, gaps: true, enabled: true, last: { ago: 3600 * 2.3, ok: true, bars: 5760, dur: 6 } },
      { id: 'j3', name: 'Глубокая история (выходные)', exch: 'finam', syms: ['SBER', 'GAZP', 'LKOH'], tfs: ['1D', '1h'], mode: 'daily', time: '03:30', every: 4, depth: 365, gaps: false, enabled: false, last: { ago: 86400 * 6, ok: false, bars: 0, dur: 31, err: 'Превышен лимит запросов API (429)' } },
    ],
    loadLog: [],
  };

  function merge(def, v) {
    if (v == null) return JSON.parse(JSON.stringify(def));
    if (typeof def !== 'object' || Array.isArray(def)) return v;
    const out = {};
    for (const k of Object.keys(def)) out[k] = merge(def[k], v[k]);
    for (const k of Object.keys(v)) if (!(k in out)) out[k] = v[k];
    return out;
  }

  const S = (TH.S = {
    data: merge(DEFAULTS, TH.store.get('settings', null)),
    get(k) { return this.data[k]; },
    set(k, v) {
      this.data[k] = v;
      this.save();
      TH.bus.emit('settings', k, v);
    },
    save() { TH.store.set('settings', this.data); },
  });
  delete S.data.exchange;
  if (S.data.riskPct != null) {
    if (!(TH.store.get('settings', {}) || {}).risk) S.data.risk = { finam: S.data.riskPct, hyperliquid: S.data.riskPct };
    delete S.data.riskPct;
  }
  const now = Math.floor(Date.now() / 1000);
  S.data.schedules.forEach((j) => { if (j.last && j.last.ago != null && !j.last.at) { j.last.at = now - j.last.ago; delete j.last.ago; } });
  Object.values(S.data.conn).forEach((c) => { if (!c.at) c.at = now - 120; });
  if (!S.data.loadLog.length) {
    S.data.loadLog = S.data.schedules.filter((j) => j.last).map((j) => ({ at: j.last.at, name: j.name, ok: j.last.ok, bars: j.last.bars, dur: j.last.dur, err: j.last.err }));
  }

  const SECTIONS = [
    { id: 'exchange', title: 'Биржи и API-ключи', icon: 'plug', color: '#0A84FF' },
    { id: 'account', title: 'Счёт и риск', icon: 'wallet', color: '#30D158' },
    { id: 'schedule', title: 'Плановая загрузка', icon: 'clock', color: '#FF9F0A' },
    { id: 'general', title: 'Общие', icon: 'sliders', color: '#8E8E93' },
  ];
  const ico = (name, color, size = 14) => `<span class="menu-ico" style="background:linear-gradient(180deg, ${color}, ${TH.shade(color, -0.18)})">${I(name, size, 2)}</span>`;

  const EX_DESC = { finam: 'Мосбиржа · акции и фьючерсы', hyperliquid: 'Бессрочные фьючерсы · USDC' };

  TH.riskMoney = (id) => '≈ ' + TH.money((TH.live.account(id).equity * S.data.risk[id]) / 100, TH.data.ex(id).cur);

  TH.openMenu = function (anchor) {
    const active = S.data.schedules.filter((j) => j.enabled).length;
    const okN = TH.data.ids.filter((id) => S.data.conn[id].ok).length;
    const heads = TH.data.ids.map((id) => {
      const e = TH.data.ex(id);
      const a = TH.live ? TH.live.account(id) : null;
      return `<div class="menu-head">${TH.exAva(id, S.data.conn[id].ok)}<div><b>${e.full}</b><small>${e.accountLabel}${a ? ' · ' + TH.money(a.equity, e.cur) : ''}</small></div></div>`;
    }).join('');
    const item = (id, icon, color, label, right = '') =>
      `<button class="menu-item" data-go="${id}">${ico(icon, color)}<span>${label}</span><span class="r">${right}</span></button>`;
    const html = `<div style="width:300px">
      <div class="menu-heads">${heads}</div>
      <div class="menu-sep"></div>
      ${item('exchange', 'plug', '#0A84FF', 'Биржи и API-ключи', `${okN} из ${TH.data.ids.length} подкл.`)}
      ${item('account', 'wallet', '#30D158', 'Счёт и риск', TH.data.ids.map((id) => TH.exTag(id) + TH.fmt(S.data.risk[id], 1) + '%').join(' '))}
      ${item('schedule', 'clock', '#FF9F0A', 'Плановая загрузка котировок', active ? active + ' акт.' : '')}
      ${item('general', 'sliders', '#8E8E93', 'Общие настройки')}
      <div class="menu-sep"></div>
      ${item('keys', 'keyboard', '#5E5CE6', 'Горячие клавиши', '<span class="kbd">?</span>')}
      ${item('about', 'info', '#64D2FF', 'О макете')}
    </div>`;
    const pop = TH.popover(anchor, html, { align: 'end' });
    if (!pop) return;
    pop.el.querySelectorAll('[data-go]').forEach((b) =>
      b.addEventListener('click', () => {
        pop.close();
        const g = b.dataset.go;
        if (g === 'keys') TH.openHotkeys();
        else if (g === 'about') TH.openAbout();
        else TH.openSettings(g);
      })
    );
  };

  let modal = null;
  TH.openSettings = function (section = 'exchange') {
    if (modal) { modal.show(section); return; }
    const m = TH.modal(
      `<div class="settings">
        <aside class="set-side">
          <div class="acc" id="setAcc"></div>
          ${SECTIONS.map((s) => `<button class="set-nav" data-sec="${s.id}">${ico(s.icon, s.color)}<span>${s.title}</span></button>`).join('')}
          <div class="foot">Настройки общие для режимов «День», «Бэктест» и «Live».</div>
        </aside>
        <div class="set-main">
          <div class="set-head"><h2 id="setTitle"></h2><div class="grow"></div><button class="btn plain icon" data-close title="Закрыть (Esc)">${I('close', 16)}</button></div>
          <div class="set-body" id="setBody"></div>
        </div>
      </div>`,
      { onClose: () => { modal = null; offAcc && offAcc(); } }
    );
    let offAcc = null;
    const body = m.el.querySelector('#setBody');
    m.el.querySelector('[data-close]').onclick = () => m.close();
    m.el.querySelectorAll('[data-sec]').forEach((b) => (b.onclick = () => show(b.dataset.sec)));
    let cur = null;
    function renderAcc() {
      m.el.querySelector('#setAcc').innerHTML = TH.data.ids.map((id) => {
        const e = TH.data.ex(id);
        const a = TH.live.account(id);
        return `<div class="acc-line">${TH.exAva(id, S.data.conn[id].ok)}<div><b>${e.name}</b><small>${TH.money(a.equity, e.cur)}</small></div></div>`;
      }).join('');
    }
    function show(sec) {
      cur = sec;
      m.el.querySelectorAll('[data-sec]').forEach((b) => b.classList.toggle('on', b.dataset.sec === sec));
      m.el.querySelector('#setTitle').textContent = SECTIONS.find((s) => s.id === sec).title;
      body.scrollTop = 0;
      renderAcc();
      ({ exchange: secExchange, account: secAccount, schedule: secSchedule, general: secGeneral })[sec](body, { rerender: () => show(sec), renderAcc });
    }
    const onAcc = () => {
      if (!modal) return;
      renderAcc();
      if (cur === 'account') updateAccountNumbers(body);
    };
    offAcc = TH.bus.on('account', onAcc);
    modal = { show, m };
    show(section);
  };

  function secExchange(body, ctx) {
    const ids = TH.data.ids;
    const card = (id) => {
      const e = TH.data.ex(id), c = S.data.conn[id];
      return `<button class="ex-card" data-goex="${id}">${TH.exAva(id, c.ok)}<div><b>${e.name}</b><small>${EX_DESC[id]}</small><small style="margin-top:4px">${c.ok ? `<span class="pos">● Подключено</span> · ${TH.live.ping(id)} мс` : '<span class="faint">● Не подключено</span>'}</small></div><span class="ex-card-go">${I('chevD', 14, 2.2)}</span></button>`;
    };
    const secret = (id, label, val, sub, ph) => `
      <div class="row"><div class="t"><b>${label}</b><small>${sub}</small></div>
      <div class="ctl"><div class="input-wrap" style="width:300px"><input class="input" type="password" id="${id}" value="${TH.esc(val)}" placeholder="${ph}" autocomplete="off" spellcheck="false"><button class="btn plain sm icon eye" data-eye="${id}" title="Показать">${I('eye', 14)}</button></div></div></div>`;
    const plain = (id, label, val, sub, ph) => `
      <div class="row"><div class="t"><b>${label}</b><small>${sub}</small></div>
      <div class="ctl"><input class="input" style="width:300px" id="${id}" value="${TH.esc(val)}" placeholder="${ph}" spellcheck="false"></div></div>`;
    const section = (id) => {
      const k = S.data.keys[id], c = S.data.conn[id], e = TH.data.ex(id);
      const form = id === 'finam'
        ? secret('k1_' + id, 'Токен Trade API', k.token, 'Личный кабинет Finam → Trade API → Токены', 'fnm_…') + plain('k2_' + id, 'Торговый счёт', k.accountId, 'Client ID счёта для заявок и позиций', '1234567')
        : plain('k1_' + id, 'Адрес кошелька', k.address, 'Основной адрес аккаунта (0x…)', '0x…') + secret('k2_' + id, 'Ключ API-кошелька', k.apiKey, 'Приватный ключ agent-кошелька, без права вывода', '0x…') +
          `<div class="row"><div class="t"><b>Сеть</b><small>Testnet — для проверки стратегий без риска</small></div><div class="ctl"><div id="hlNet"></div></div></div>`;
      return `<section class="ex-sec" id="exs_${id}">
        <div class="g-title ex-g-title"><span class="ex-title">${TH.exAva(id, c.ok)}${e.full}</span><span class="conn-status" data-connst="${id}">${c.ok ? `<span class="dot pulse"></span>Подключено · ${TH.live.ping(id)} мс` : '<span class="dot gray"></span>Не подключено'}</span></div>
        <div class="group">${form}
          <div class="row"><div class="t"><b>Права ключа</b><small>Проверено ${agoText(c.at)}</small></div><div class="ctl perm">${['Котировки', 'Данные счёта', 'Торговля'].map((p) => `<span>${c.ok ? `<span class="pos">${I('check', 13, 2.6)}</span>` : `<span class="faint">${I('minus', 13, 2.6)}</span>`}${p}</span>`).join('')}</div></div>
          <div class="row"><div class="t"><b>Инструменты</b><small>Котировки для «День», «Бэктест», Live и плановой загрузки</small></div><div class="ctl chips">${TH.data.list(id).map((i) => `<span class="chip xs static">${i.sym}</span>`).join('')}</div></div>
        </div>
        <div class="g-note">${id === 'finam' ? 'Для торговли токену нужны права «Торговые операции». Котировки загружаются через тот же токен.' : 'Рекомендуется отдельный API-кошелёк (agent wallet): он может торговать, но не выводить средства.'}</div>
        <div class="ex-actions">
          <button class="btn" data-test="${id}">${I('refresh', 14)} Проверить подключение</button>
          <button class="btn primary" data-save="${id}">Сохранить</button>
        </div>
      </section>`;
    };
    body.innerHTML = `
      <p class="set-desc">Обе биржи работают одновременно: котировки, счёт, позиции и заявки каждой из них доступны во всех режимах без переключения. Инструменты MOEX идут через Finam, бессрочные фьючерсы — через Hyperliquid. Ключи в макете хранятся только локально в браузере.</p>
      <div class="ex-cards">${ids.map(card).join('')}</div>
      ${ids.map(section).join('')}`;
    body.querySelectorAll('[data-goex]').forEach((b) => (b.onclick = () => {
      const sec = body.querySelector('#exs_' + b.dataset.goex);
      body.scrollTo({ top: sec.offsetTop - 12, behavior: S.data.general.motion ? 'smooth' : 'auto' });
    }));
    body.querySelectorAll('[data-eye]').forEach((b) => (b.onclick = () => {
      const inp = body.querySelector('#' + b.dataset.eye);
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      b.innerHTML = I(show ? 'eyeOff' : 'eye', 14);
    }));
    const hk = S.data.keys.hyperliquid;
    TH.seg(body.querySelector('#hlNet'), [{ v: 'mainnet', label: 'Mainnet' }, { v: 'testnet', label: 'Testnet' }], hk.network, (v) => { hk.network = v; });
    const collect = (id) => {
      const k = S.data.keys[id];
      const v1 = body.querySelector('#k1_' + id).value.trim(), v2 = body.querySelector('#k2_' + id).value.trim();
      if (id === 'finam') { k.token = v1; k.accountId = v2; } else { k.address = v1; k.apiKey = v2; }
      return v1 && v2;
    };
    body.querySelectorAll('[data-save]').forEach((b) => (b.onclick = () => {
      const id = b.dataset.save;
      collect(id);
      S.save();
      TH.toast('Ключи сохранены', { sub: TH.data.ex(id).name });
    }));
    body.querySelectorAll('[data-test]').forEach((b) => (b.onclick = () => {
      const id = b.dataset.test;
      const e = TH.data.ex(id);
      const okFields = collect(id);
      b.disabled = true;
      b.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;margin:0"></span> Проверка…';
      body.querySelector(`[data-connst="${id}"]`).innerHTML = '<span class="dot orange"></span>Проверка…';
      setTimeout(() => {
        const ok = !!okFields;
        S.data.conn[id] = { ok, at: Math.floor(Date.now() / 1000) };
        S.save();
        TH.bus.emit('conn', id, ok);
        if (ok) TH.toast('Подключение установлено', { sub: `${e.name} · ${TH.live.ping(id)} мс` });
        else TH.toast('Не удалось подключиться', { type: 'error', sub: `${e.name} · заполните ключи` });
        const top = body.scrollTop;
        ctx.rerender();
        body.scrollTop = top;
      }, 1100);
    }));
  }

  function agoText(at) {
    const s = Math.floor(Date.now() / 1000) - at;
    if (s < 60) return 'только что';
    if (s < 3600) return Math.floor(s / 60) + ' мин назад';
    if (s < 86400) return Math.floor(s / 3600) + ' ч назад';
    return Math.floor(s / 86400) + ' дн назад';
  }

  function updateAccountNumbers(body) {
    const set = (id, html) => { const el = body.querySelector('#' + id); if (el) el.innerHTML = html; };
    TH.data.ids.forEach((id) => {
      const a = TH.live.account(id);
      const e = TH.data.ex(id);
      set('aBal_' + id, TH.money(a.balance, e.cur));
      set('aEq_' + id, TH.money(a.equity, e.cur));
      set('aUnr_' + id, `<span class="${TH.cls(a.unreal)}">${TH.moneyS(a.unreal, e.cur)}</span>`);
      set('aFree_' + id, TH.money(a.free, e.cur));
      set('riskMoney_' + id, TH.riskMoney(id));
      a.positions.forEach((p) => set('ap_' + p.id, `<span class="${TH.cls(p.pnl)}">${TH.moneyS(p.pnl, e.cur)}</span>`));
    });
  }

  function secAccount(body, ctx) {
    const ids = TH.data.ids;
    const pos = [].concat(...ids.map((id) => TH.live.account(id).positions));
    const accBlock = (id) => {
      const e = TH.data.ex(id), a = TH.live.account(id);
      return `<div class="g-title"><span class="ex-title">${TH.exAva(id, S.data.conn[id].ok)}${e.name} · ${e.accountLabel}</span><span class="faint" style="font-weight:500">${e.market}</span></div>
      <div class="group"><div class="acc-grid">
        <div><small>Баланс</small><b id="aBal_${id}">${TH.money(a.balance, e.cur)}</b></div>
        <div><small>Эквити</small><b id="aEq_${id}">${TH.money(a.equity, e.cur)}</b></div>
        <div><small>Нереализованный P&L</small><b id="aUnr_${id}"><span class="${TH.cls(a.unreal)}">${TH.moneyS(a.unreal, e.cur)}</span></b></div>
        <div><small>Свободно</small><b id="aFree_${id}">${TH.money(a.free, e.cur)}</b></div>
      </div>
      <div class="row col risk-row" style="gap:8px;padding:14px">
        <div style="display:flex;align-items:flex-start;gap:12px"><div class="t" style="flex:1"><b>Риск на сделку · ${e.name}</b><small>Доля эквити счёта ${e.name}, которую теряет сделка при срабатывании стопа. Объём позиции = риск ÷ расстояние до стопа.</small></div>
        <div style="text-align:right"><div class="risk-big"><b id="riskVal_${id}">${TH.fmt(S.data.risk[id], 1)}%</b></div><div class="muted tnum" id="riskMoney_${id}" style="font-size:12px">${TH.riskMoney(id)}</div></div></div>
        <input type="range" data-risk="${id}" min="0.1" max="5" step="0.1" value="${S.data.risk[id]}">
        <div style="display:flex;justify-content:space-between;font-size:11px" class="faint"><span>0,1% · консервативно</span><span>2%</span><span>5% · агрессивно</span></div>
      </div></div>`;
    };
    body.innerHTML = `
      <p class="set-desc" style="display:flex;align-items:center;gap:8px">Счета обеих бирж ведутся параллельно, у каждой свой риск на сделку; суммы — в валюте счёта<span class="grow"></span><button class="btn sm" id="accRefresh">${I('refresh', 13)} Обновить</button></p>
      ${ids.map(accBlock).join('')}
      <div class="g-title">Открытые позиции · ${pos.length}<button class="btn sm plain" id="toLive">Открыть Live ${I('arrowR', 13)}</button></div>
      <div class="group">${pos.length ? pos.map((p) => {
        const e = TH.data.exOf(p.sym);
        return `
        <div class="row">${TH.ava(p.sym)}<div class="t"><b>${p.sym} ${TH.exTag(e.id)} <span class="badge ${p.dir > 0 ? 'long' : 'short'}" style="margin-left:4px">${p.dir > 0 ? 'LONG' : 'SHORT'}</span></b><small>${TH.fmt(p.qty, qtyDp(p))} · вход ${TH.fmt(p.entry, TH.data.inst(p.sym).dp)} · ${TH.esc(p.strategy)}</small></div><div class="v" id="ap_${p.id}"><span class="${TH.cls(p.pnl)}">${TH.moneyS(p.pnl, e.cur)}</span></div></div>`;
      }).join('') : '<div class="row"><div class="t faint">Нет открытых позиций</div></div>'}
      </div>
      <div class="g-title">Ограничения · действуют на каждую биржу</div>
      <div class="group">
        <div class="row"><div class="t"><b>Макс. дневной убыток</b><small>От эквити счёта; live-стратегии этой биржи ставятся на паузу при достижении лимита</small></div><div class="ctl"><div class="input-wrap" style="width:110px"><input class="input" type="number" id="mdl" min="0.5" max="20" step="0.5" value="${S.data.maxDailyLoss}"><span class="suffix">%</span></div></div></div>
        <div class="row"><div class="t"><b>Макс. открытых позиций</b><small>На каждую биржу; новые сигналы игнорируются при достижении лимита</small></div><div class="ctl"><span class="tnum" id="mpVal" style="min-width:22px;text-align:center;font-weight:600">${S.data.maxPositions}</span><div class="stepper"><button id="mpDec">${I('minus', 13, 2.2)}</button><button id="mpInc">${I('plus', 13, 2.2)}</button></div></div></div>
        <div class="row"><div class="t"><b>Использовать в бэктестах</b><small>Подставлять риск на сделку в форму бэктеста; счёт бэктеста единый и считается в рублях</small></div><div class="ctl"><label class="switch"><input type="checkbox" id="r2bt" ${S.data.riskToBacktest ? 'checked' : ''}><span></span></label></div></div>
      </div>`;
    body.querySelectorAll('[data-risk]').forEach((rr) => {
      const id = rr.dataset.risk;
      TH.rangeFill(rr);
      rr.oninput = () => {
        TH.rangeFill(rr);
        S.data.risk[id] = +rr.value;
        body.querySelector('#riskVal_' + id).textContent = TH.fmt(S.data.risk[id], 1) + '%';
        updateAccountNumbers(body);
      };
      rr.onchange = () => { S.save(); TH.bus.emit('settings', 'risk', id); };
    });
    body.querySelector('#mdl').onchange = (ev) => { S.data.maxDailyLoss = +ev.target.value; S.save(); };
    const mp = (d) => { S.data.maxPositions = TH.clamp(S.data.maxPositions + d, 1, 30); body.querySelector('#mpVal').textContent = S.data.maxPositions; S.save(); TH.bus.emit('settings', 'maxPositions', S.data.maxPositions); };
    body.querySelector('#mpDec').onclick = () => mp(-1);
    body.querySelector('#mpInc').onclick = () => mp(1);
    body.querySelector('#r2bt').onchange = (ev) => { S.data.riskToBacktest = ev.target.checked; S.save(); };
    body.querySelector('#toLive').onclick = () => { if (modal) modal.m.close(); TH.app.go('live'); };
    body.querySelector('#accRefresh').onclick = () => { TH.live.sync(); TH.toast('Данные счетов обновлены', { type: 'info', sub: 'Finam · Hyperliquid' }); ctx.rerender(); };
  }

  function qtyDp(p) {
    const inst = TH.data.inst(p.sym);
    return inst.lot < 1 ? Math.max(0, -Math.floor(Math.log10(inst.lot))) : 0;
  }
  TH.qtyDp = qtyDp;

  const MODE_TXT = { daily: 'Ежедневно', weekdays: 'По будням', hours: 'Каждые N часов' };
  function nextRun(j) {
    const ex = TH.data.ex(j.exch);
    const nowF = TH.data.nowFake(ex);
    if (j.mode === 'hours') { const st = j.every * 3600; return Math.ceil((nowF + 1) / st) * st; }
    const [hh, mm] = j.time.split(':').map(Number);
    const day = Math.floor(nowF / 86400) * 86400;
    for (let k = 0; k < 9; k++) {
      const t = day + k * 86400 + hh * 3600 + mm * 60;
      const wd = new Date(t * 1000).getUTCDay();
      if (t > nowF && (j.mode !== 'weekdays' || (wd !== 0 && wd !== 6))) return t;
    }
    return null;
  }
  function whenText(t, ex) {
    const today = Math.floor(TH.data.nowFake(ex) / 86400);
    const d = Math.floor(t / 86400);
    const pre = d === today ? 'сегодня' : d === today + 1 ? 'завтра' : TH.d.wd(t);
    return `${pre}, ${TH.d.hm(t)} ${ex.tz}`;
  }
  function jobDesc(j) {
    const mode = j.mode === 'hours' ? `каждые ${j.every} ч` : `${MODE_TXT[j.mode].toLowerCase()} в ${j.time}`;
    return `${j.syms.join(', ')} · ${j.tfs.join(', ')} · ${mode} · глубина ${j.depth} дн.`;
  }

  function secSchedule(body, ctx) {
    const jobs = S.data.schedules;
    const log = S.data.loadLog.slice().sort((a, b) => b.at - a.at).slice(0, 6);
    body.innerHTML = `
      <p class="set-desc">Плановая загрузка котировок с биржи в базу данных. Задание ставит в очередь загрузку выбранных инструментов и таймфреймов; время задаётся в часовом поясе биржи.</p>
      <div class="g-title"><span>Расписания</span><button class="btn sm tinted" id="addJob">${I('plus', 13, 2.2)} Новое расписание</button></div>
      <div id="jobFormHost"></div>
      <div class="group" id="jobs">${jobs.length ? jobs.map(jobHtml).join('') : '<div class="row"><div class="t faint">Расписаний нет</div></div>'}</div>
      <div class="g-title">Последние загрузки</div>
      <div class="group"><div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Время</th><th>Задание</th><th class="r">Баров</th><th class="r">Длительность</th><th>Статус</th></tr></thead>
        <tbody>${log.map((l) => `<tr><td class="faint">${TH.d.dmShort(l.at + 10800)} ${TH.d.hm(l.at + 10800)}</td><td>${TH.esc(l.name)}</td><td class="r">${TH.fmt(l.bars, 0)}</td><td class="r">${l.dur} с</td><td>${l.ok ? '<span class="badge long">Успешно</span>' : `<span class="badge short" title="${TH.esc(l.err || '')}">Ошибка</span>`}</td></tr>`).join('')}</tbody>
      </table></div></div>`;
    body.querySelector('#addJob').onclick = () => jobForm(body, null, ctx);
    body.querySelectorAll('[data-job]').forEach((row) => {
      const j = jobs.find((x) => x.id === row.dataset.job);
      row.querySelector('[data-toggle]').onchange = (ev) => { j.enabled = ev.target.checked; S.save(); row.classList.toggle('off', !j.enabled); row.querySelector('[data-next]').innerHTML = nextHtml(j); };
      row.querySelector('[data-run]').onclick = () => runJob(j, row, ctx);
      row.querySelector('[data-edit]').onclick = () => jobForm(body, j, ctx);
      row.querySelector('[data-del]').onclick = async () => {
        const ok = await TH.confirm({ title: 'Удалить расписание?', message: `«${TH.esc(j.name)}» больше не будет запускаться.`, ok: 'Удалить', destructive: true, icon: 'trash' });
        if (!ok) return;
        S.data.schedules = S.data.schedules.filter((x) => x !== j);
        S.save();
        ctx.rerender();
      };
    });
  }
  function nextHtml(j) {
    if (!j.enabled) return `${I('pause', 12)} Приостановлено`;
    const t = nextRun(j);
    return `${I('clock', 13)} Следующий запуск: ${t ? whenText(t, TH.data.ex(j.exch)) : '—'}`;
  }
  function jobHtml(j) {
    const ex = TH.data.ex(j.exch);
    const last = j.last
      ? j.last.ok ? `<span class="pos">${I('check', 13, 2.4)}</span> ${agoText(j.last.at)} · ${TH.fmt(j.last.bars, 0)} баров` : `<span class="neg">${I('warn', 13)}</span> ${agoText(j.last.at)} · ${TH.esc(j.last.err || 'ошибка')}`
      : 'Ещё не запускалось';
    return `<div class="job ${j.enabled ? '' : 'off'}" data-job="${j.id}">
      <div class="job-top"><div class="job-ico">${I('download', 17)}</div>
        <div class="t"><b>${TH.esc(j.name)} <span class="badge gray" style="margin-left:6px">${ex.name}</span></b><small>${TH.esc(jobDesc(j))}</small></div>
        <button class="btn sm" data-run title="Запустить сейчас">${I('play', 11)} Сейчас</button>
        <button class="btn sm plain icon" data-edit title="Изменить">${I('sliders', 14)}</button>
        <button class="btn sm plain icon" data-del title="Удалить">${I('trash', 14)}</button>
        <label class="switch sm"><input type="checkbox" data-toggle ${j.enabled ? 'checked' : ''}><span></span></label>
      </div>
      <div class="job-meta"><span data-next>${nextHtml(j)}</span><span>${last}</span></div>
      <div class="job-progress hidden"><div class="progress"><i></i></div><div class="faint" style="font-size:11px;margin-top:5px" data-ptxt></div></div>
    </div>`;
  }
  function runJob(j, row, ctx) {
    const box = row.querySelector('.job-progress');
    const bar = box.querySelector('i'), txt = box.querySelector('[data-ptxt]');
    const btn = row.querySelector('[data-run]');
    btn.disabled = true;
    box.classList.remove('hidden');
    const total = j.syms.length * j.tfs.length;
    let k = 0;
    const t0 = Date.now();
    const iv = setInterval(() => {
      k++;
      const pct = Math.min(100, (k / total) * 100);
      bar.style.width = pct + '%';
      const s = j.syms[Math.min(j.syms.length - 1, Math.floor((k - 1) / j.tfs.length))];
      const tf = j.tfs[(k - 1) % j.tfs.length];
      txt.textContent = k < total ? `Загрузка ${s} · ${tf}… (${k}/${total})` : 'Запись в базу…';
      if (k >= total + 1) {
        clearInterval(iv);
        const bars = Math.round(j.depth * j.syms.length * j.tfs.reduce((s2, tf2) => s2 + ({ '1m': 530, '5m': 106, '15m': 36, '1h': 9, '1D': 1 }[tf2] || 10), 0) * (0.95 + Math.random() * 0.1));
        const dur = Math.max(1, Math.round((Date.now() - t0) / 1000));
        j.last = { at: Math.floor(Date.now() / 1000), ok: true, bars, dur };
        S.data.loadLog.push({ at: j.last.at, name: j.name, ok: true, bars, dur });
        S.save();
        TH.toast(`Загружено ${TH.fmt(bars, 0)} баров`, { sub: j.name });
        if (row.isConnected) ctx.rerender();
      }
    }, 260);
  }

  function jobForm(body, j, ctx) {
    const host = body.querySelector('#jobFormHost');
    const isNew = !j;
    const d = j ? JSON.parse(JSON.stringify(j)) : { id: 'j' + TH.uid(), name: '', exch: 'finam', syms: TH.data.list('finam').map((i) => i.sym), tfs: ['1m', '1h', '1D'], mode: 'weekdays', time: '19:00', every: 4, depth: 3, gaps: true, enabled: true, last: null };
    const TFS = ['1m', '5m', '15m', '1h', '1D'];
    host.innerHTML = `<div class="group" style="margin-bottom:12px;box-shadow:inset 0 0 0 1px rgba(10,132,255,.45)"><div class="job-form">
      <div style="font-weight:600;font-size:14px">${isNew ? 'Новое расписание' : 'Изменить расписание'}</div>
      <div class="fields-2">
        <div class="field"><label>Название</label><input class="input" id="jfName" value="${TH.esc(d.name)}" placeholder="Например, вечерняя догрузка"></div>
        <div class="field"><label>Биржа-источник</label><div id="jfEx"></div></div>
      </div>
      <div class="field"><label>Инструменты</label><div class="chips" id="jfSyms"></div></div>
      <div class="field"><label>Таймфреймы</label><div class="chips" id="jfTfs">${TFS.map((t) => `<button class="chip ${d.tfs.includes(t) ? 'on' : ''}" data-tf="${t}">${t}</button>`).join('')}</div></div>
      <div class="fields-3">
        <div class="field"><label>Периодичность</label><select class="select" id="jfMode">${Object.entries(MODE_TXT).map(([k, v]) => `<option value="${k}" ${d.mode === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="field" id="jfTimeF"><label>Время запуска</label><input class="input" type="time" id="jfTime" value="${d.time}"></div>
        <div class="field" id="jfEveryF"><label>Интервал</label><select class="select" id="jfEvery">${[1, 2, 4, 6, 12].map((h) => `<option value="${h}" ${+d.every === h ? 'selected' : ''}>каждые ${h} ч</option>`).join('')}</select></div>
        <div class="field"><label>Глубина загрузки</label><div class="input-wrap"><input class="input" type="number" id="jfDepth" min="1" max="3650" value="${d.depth}"><span class="suffix">дн.</span></div></div>
      </div>
      <label class="check-chip" style="padding:0"><input type="checkbox" id="jfGaps" ${d.gaps ? 'checked' : ''}><span class="box">${I('check', 12, 3)}</span>Догружать пропуски в истории</label>
      <div class="actions"><button class="btn" id="jfCancel">Отмена</button><button class="btn primary" id="jfSave">${isNew ? 'Создать' : 'Сохранить'}</button></div>
    </div></div>`;
    const renderSyms = () => {
      host.querySelector('#jfSyms').innerHTML = TH.data.list(d.exch).map((i) => `<button class="chip ${d.syms.includes(i.sym) ? 'on' : ''}" data-sym="${i.sym}">${i.sym}</button>`).join('');
    };
    renderSyms();
    TH.seg(host.querySelector('#jfEx'), [{ v: 'finam', label: 'Finam' }, { v: 'hyperliquid', label: 'Hyperliquid' }], d.exch, (v) => {
      d.exch = v;
      d.syms = TH.data.list(v).map((i) => i.sym);
      renderSyms();
    });
    const modeVis = () => {
      host.querySelector('#jfTimeF').classList.toggle('hidden', d.mode === 'hours');
      host.querySelector('#jfEveryF').classList.toggle('hidden', d.mode !== 'hours');
    };
    modeVis();
    host.querySelector('#jfMode').onchange = (e) => { d.mode = e.target.value; modeVis(); };
    host.addEventListener('click', (e) => {
      const s = e.target.closest('[data-sym]');
      if (s) { const v = s.dataset.sym; d.syms = d.syms.includes(v) ? d.syms.filter((x) => x !== v) : [...d.syms, v]; s.classList.toggle('on'); }
      const t = e.target.closest('[data-tf]');
      if (t) { const v = t.dataset.tf; d.tfs = d.tfs.includes(v) ? d.tfs.filter((x) => x !== v) : TFS.filter((x) => x === v || d.tfs.includes(x)); t.classList.toggle('on'); }
    });
    host.querySelector('#jfCancel').onclick = () => (host.innerHTML = '');
    host.querySelector('#jfSave').onclick = () => {
      d.name = host.querySelector('#jfName').value.trim() || 'Загрузка ' + d.syms.slice(0, 3).join(', ');
      d.time = host.querySelector('#jfTime').value || '19:00';
      d.every = +host.querySelector('#jfEvery').value;
      d.depth = Math.max(1, +host.querySelector('#jfDepth').value || 1);
      d.gaps = host.querySelector('#jfGaps').checked;
      if (!d.syms.length || !d.tfs.length) { TH.toast('Выберите инструменты и таймфреймы', { type: 'warn' }); return; }
      if (isNew) S.data.schedules.unshift(d);
      else Object.assign(j, d);
      S.save();
      TH.toast(isNew ? 'Расписание создано' : 'Расписание обновлено', { sub: nextRun(d) ? 'следующий запуск ' + whenText(nextRun(d), TH.data.ex(d.exch)) : '' });
      ctx.rerender();
    };
    host.querySelector('#jfName').focus();
  }

  function secGeneral(body, ctx) {
    const g = S.data.general;
    body.innerHTML = `
      <div class="g-title">Отображение</div>
      <div class="group">
        <div class="row"><div class="t"><b>Часовой пояс графиков</b><small>Время баров и журналов</small></div><div class="ctl"><select class="select" id="gTz" style="width:220px"><option value="exchange">Часовой пояс биржи</option><option value="utc">UTC</option><option value="local">Локальный</option></select></div></div>
        <div class="row"><div class="t"><b>Анимации интерфейса</b><small>Плавные переходы, всплывающие окна и подсветка цен</small></div><div class="ctl"><label class="switch"><input type="checkbox" id="gMotion" ${g.motion ? 'checked' : ''}><span></span></label></div></div>
      </div>
      <div class="g-title">Торговля</div>
      <div class="group">
        <div class="row"><div class="t"><b>Подтверждать закрытие позиций</b><small>Показывать диалог перед принудительным закрытием</small></div><div class="ctl"><label class="switch"><input type="checkbox" id="gConfirm" ${g.confirmClose ? 'checked' : ''}><span></span></label></div></div>
        <div class="row"><div class="t"><b>Звук при исполнении заявок</b><small>Короткий сигнал при сделках live-стратегий</small></div><div class="ctl"><label class="switch"><input type="checkbox" id="gSound" ${g.sounds ? 'checked' : ''}><span></span></label></div></div>
      </div>
      <div class="g-title">Данные макета</div>
      <div class="group">
        <div class="row"><div class="t"><b>Сбросить локальные данные</b><small>Заметки, рисунки на графиках, история бэктестов и настройки</small></div><div class="ctl"><button class="btn danger" id="gReset">Сбросить…</button></div></div>
      </div>`;
    body.querySelector('#gTz').value = g.tz;
    body.querySelector('#gTz').onchange = (e) => { g.tz = e.target.value; S.save(); TH.toast('Часовой пояс сохранён', { type: 'info', sub: 'в макете время показывается по бирже' }); };
    body.querySelector('#gMotion').onchange = (e) => { g.motion = e.target.checked; S.save(); document.body.classList.toggle('no-motion', !g.motion); };
    body.querySelector('#gConfirm').onchange = (e) => { g.confirmClose = e.target.checked; S.save(); };
    body.querySelector('#gSound').onchange = (e) => { g.sounds = e.target.checked; S.save(); };
    body.querySelector('#gReset').onclick = async () => {
      const ok = await TH.confirm({ title: 'Сбросить данные макета?', message: 'Заметки, уровни, история запусков и настройки будут удалены. Страница перезагрузится.', ok: 'Сбросить', destructive: true, icon: 'trash' });
      if (!ok) return;
      TH.store.clear();
      location.reload();
    };
  }

  TH.openHotkeys = function () {
    const k = (...a) => a.map((x) => `<span class="kbd">${x}</span>`).join('');
    const m = TH.modal(`<div class="alert" style="width:400px;text-align:left">
      <h3 style="text-align:center;margin-bottom:16px">Горячие клавиши</h3>
      <div class="kb-grid">
        <span>Режимы День · Бэктест · Live</span><span>${k('1')}${k('2')}${k('3')}</span>
        <span>Предыдущая / следующая сессия или сделка</span><span>${k('←')}${k('→')}</span>
        <span>Курсор</span><span>${k('V')}</span>
        <span>Горизонтальный уровень</span><span>${k('L')}</span>
        <span>Трендовая линия</span><span>${k('T')}</span>
        <span>Зона</span><span>${k('Z')}</span>
        <span>Ластик</span><span>${k('E')}</span>
        <span>Панель справа</span><span>${k('I')}</span>
        <span>Отменить построение / закрыть окно</span><span>${k('Esc')}</span>
        <span>Настройки</span><span>${k(',')}</span>
      </div>
      <div class="a-btns" style="grid-template-columns:1fr"><button class="btn primary" data-ok>Готово</button></div></div>`);
    m.el.querySelector('[data-ok]').onclick = () => m.close();
  };

  TH.openAbout = function () {
    const m = TH.modal(`<div class="alert" style="width:380px">
      <div class="a-ico" style="background:linear-gradient(145deg,#454852,#1c1d22);box-shadow:inset 0 1px 0 rgba(255,255,255,.2)">${TH.logo()}</div>
      <h3>Trading Helper · Graphite</h3>
      <p>Интерактивный макет интерфейса: просмотр торговых сессий, бэктесты стратегий и live-контур. Котировки, счёт и сделки — синтетические, детерминированные данные.</p>
      <p style="margin-top:10px;font-size:11.5px" class="faint">Графики: <a href="https://www.tradingview.com/lightweight-charts/" target="_blank" rel="noopener">TradingView Lightweight Charts™</a> · Apache 2.0</p>
      <div class="a-btns" style="grid-template-columns:1fr"><button class="btn primary" data-ok>Закрыть</button></div></div>`);
    m.el.querySelector('[data-ok]').onclick = () => m.close();
  };
})();
