(function () {
  const TH = window.TH;
  const I = TH.icon;
  const S = TH.S;
  const IDS = TH.data.ids;
  const MSK = 3 * 3600;
  const states = {};
  let EVENTS = [];
  let root = null, inited = false, visible = false, dirty = false;
  let tri = null, chartSym = TH.store.get('live.sym', null), mtf = TH.store.get('live.mtf', 1);
  let tab = 'pos', tabSeg = null;
  let lastEventAt = 0, nextEventIn = 6;

  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const nowReal = () => Math.floor(Date.now() / 1000);
  const st = (id) => states[id] || (states[id] = mkState(id));
  const stOf = (sym) => st(TH.data.inst(sym).exch);
  const allPositions = () => [].concat(...IDS.map((id) => st(id).positions));
  const riskOf = (id) => S.data.risk[id];

  function mkState(exId) {
    const ex = TH.data.ex(exId);
    const list = TH.data.list(exId);
    const prices = {}, series = {}, dayOpen = {};
    list.forEach((i) => {
      const ls = TH.data.liveSeries(i.sym);
      series[i.sym] = ls.bars;
      prices[i.sym] = ls.bars[ls.bars.length - 1].close;
      dayOpen[i.sym] = ls.bars[0].open;
    });
    const nowF = TH.data.nowFake(ex);
    const R = (sym, v) => TH.data.roundTick(TH.data.inst(sym), v);
    const mk = (sym, dir, qty, off, slP, tpP, strategy, age) => {
      const p = prices[sym];
      const entry = R(sym, p * (1 - dir * off));
      const sl = R(sym, entry * (1 - dir * slP));
      const tp = R(sym, entry * (1 + dir * tpP));
      return { id: TH.uid(), ex: exId, sym, dir, qty, entry, sl, tp, strategy, openedAt: nowF - age * 60, price: p, pnl: 0, risk0: Math.abs(entry - sl) * qty };
    };
    let s;
    if (exId === 'finam') {
      s = {
        balance: 1254300, realized: 6240,
        positions: [
          mk('SBER', 1, 2000, 0.006, 0.014, 0.03, 'EMA Crossover', 142),
          mk('GAZP', -1, 3000, -0.004, 0.016, 0.032, 'EMA Crossover', 57),
          mk('YDEX', 1, 40, 0.003, 0.012, 0.022, 'Opening Range Breakout', 33),
        ],
        strategies: [
          { id: 's1', name: 'EMA Crossover', cls: 'EmaCrossover', tf: 'H1', syms: ['SBER', 'GAZP', 'LKOH'], status: 'run', pnl: 14820, trades: 3, last: { t: nowF - 57 * 60, txt: 'SHORT GAZP' }, started: nowF - 86400 * 3.2 },
          { id: 's2', name: 'Opening Range Breakout', cls: 'OpeningRangeBreakout', tf: 'H1', syms: ['YDEX', 'Si-6.26'], status: 'run', pnl: -2150, trades: 2, last: { t: nowF - 33 * 60, txt: 'LONG YDEX' }, started: nowF - 86400 * 11 },
          { id: 's3', name: 'Mean Reversion Z-Score', cls: 'MeanReversionZScore', tf: 'H1', syms: ['LKOH'], status: 'pause', pnl: 0, trades: 0, last: null, started: nowF - 86400 * 1.5 },
        ],
        orders: [
          { id: TH.uid(), ex: exId, sym: 'LKOH', type: 'Limit', dir: 1, qty: 15, price: R('LKOH', prices.LKOH * 0.988), strategy: 'EMA Crossover', at: nowF - 1200 },
          { id: TH.uid(), ex: exId, sym: 'Si-6.26', type: 'Stop', dir: -1, qty: 3, price: R('Si-6.26', prices['Si-6.26'] * 0.994), strategy: 'Opening Range Breakout', at: nowF - 2400 },
        ],
      };
    } else {
      s = {
        balance: 48210.55, realized: 312.4,
        positions: [
          mk('BTC', 1, 0.25, 0.004, 0.018, 0.035, 'Donchian Breakout', 380),
          mk('ETH', -1, 4, -0.003, 0.02, 0.04, 'Mean Reversion Z-Score', 95),
          mk('SOL', 1, 120, 0.006, 0.025, 0.05, 'Donchian Breakout', 41),
        ],
        strategies: [
          { id: 's1', name: 'Donchian Breakout', cls: 'DonchianBreakout', tf: 'H1', syms: ['BTC', 'SOL', 'HYPE'], status: 'run', pnl: 486.2, trades: 2, last: { t: nowF - 41 * 60, txt: 'LONG SOL' }, started: nowF - 86400 * 6 },
          { id: 's2', name: 'Mean Reversion Z-Score', cls: 'MeanReversionZScore', tf: 'H1', syms: ['ETH'], status: 'run', pnl: -95.8, trades: 1, last: { t: nowF - 95 * 60, txt: 'SHORT ETH' }, started: nowF - 86400 * 2.4 },
          { id: 's3', name: 'EMA Crossover', cls: 'EmaCrossover', tf: 'H1', syms: ['HYPE'], status: 'pause', pnl: 0, trades: 0, last: null, started: nowF - 86400 * 0.5 },
        ],
        orders: [
          { id: TH.uid(), ex: exId, sym: 'HYPE', type: 'Limit', dir: 1, qty: 400, price: R('HYPE', prices.HYPE * 0.975), strategy: 'Donchian Breakout', at: nowF - 900 },
        ],
      };
    }
    Object.assign(s, { ex, prices, series, dayOpen });
    s.strategies.forEach((x) => {
      const r = TH.rng(TH.hash(exId + x.id));
      let v = 0;
      x.spark = Array.from({ length: 30 }, () => (v += (r() - 0.46) * 1));
    });
    s.positions.forEach((p) => upd(s, p));
    const now = nowReal();
    const ev = (ago, type, title, sub) => EVENTS.push({ at: now - ago, ex: exId, type, title, sub });
    const p0 = s.positions[0];
    ev(exId === 'finam' ? 5 : 9, 'info', `Синхронизация со счётом ${ex.name}`, `${s.positions.length} позиции · ${s.orders.length + s.positions.length * 2} заявки`);
    ev(33 * 60, 'fill', `Исполнено: ${p0.dir > 0 ? 'покупка' : 'продажа'} ${p0.sym}`, `${TH.fmt(p0.qty, TH.qtyDp(p0))} @ ${TH.data.fp(TH.data.inst(p0.sym), p0.entry)}`);
    ev(33 * 60 + 2, 'signal', `Сигнал ${p0.dir > 0 ? 'LONG' : 'SHORT'} ${p0.sym}`, `${p0.strategy} · риск ${TH.fmt(riskOf(exId), 1)}%`);
    ev(exId === 'finam' ? 48 * 60 : 52 * 60, 'warn', 'Сигнал отклонён фильтром', `${s.strategies[0].syms[s.strategies[0].syms.length - 1]} · ATR ниже порога`);
    ev(exId === 'finam' ? 70 * 60 : 74 * 60, 'info', 'Стратегии запущены', s.strategies.filter((x) => x.status === 'run').map((x) => x.name).join(', '));
    EVENTS.sort((a, b) => b.at - a.at);
    return s;
  }

  function upd(s, p) {
    p.price = s.prices[p.sym];
    p.pnl = p.dir * (p.price - p.entry) * p.qty;
    p.r = p.risk0 ? p.pnl / p.risk0 : 0;
  }

  function account(id = IDS[0]) {
    const s = st(id);
    const unreal = TH.sum(s.positions, (p) => p.pnl);
    const notional = TH.sum(s.positions, (p) => Math.abs(p.qty * p.price));
    const margin = notional * s.ex.marginRate;
    const equity = s.balance + unreal;
    return { balance: s.balance, equity, unreal, margin, free: equity - margin, notional, positions: s.positions, cur: s.ex.cur, dayPnl: s.realized + unreal, realized: s.realized, ex: s.ex };
  }

  function ping(id = IDS[0]) { return (id === 'finam' ? 34 : 58) + Math.floor(Math.random() * 14); }

  function addEvent(exId, type, title, sub) {
    EVENTS.unshift({ at: nowReal(), ex: exId, type, title, sub });
    if (EVENTS.length > 160) EVENTS.length = 160;
    if (visible) renderLog(true);
  }

  function stepState(s) {
    const ex = s.ex;
    const nowF = TH.data.nowFake(ex);
    const minute = Math.floor(nowF / 60) * 60;
    for (const inst of TH.data.list(ex.id)) {
      const sig = (inst.vol / Math.sqrt((ex.sessEnd - ex.sessStart) * 60)) * 2.4;
      const p = TH.data.roundTick(inst, s.prices[inst.sym] * Math.exp(sig * TH.gauss(Math.random)));
      s.prices[inst.sym] = p;
      const bars = s.series[inst.sym];
      const last = bars[bars.length - 1];
      if (last.time === minute) {
        last.close = p;
        if (p > last.high) last.high = p;
        if (p < last.low) last.low = p;
        last.volume += Math.round(inst.vbase * Math.random() * 0.05);
      } else if (minute > last.time) {
        bars.push({ time: minute, open: last.close, high: Math.max(last.close, p), low: Math.min(last.close, p), close: p, volume: Math.round(inst.vbase * 0.1) });
        if (bars.length > 1600) bars.shift();
      }
    }
    const closed = [];
    s.positions.forEach((p) => {
      upd(s, p);
      const hitSL = p.sl != null && (p.dir > 0 ? p.price <= p.sl : p.price >= p.sl);
      const hitTP = p.tp != null && (p.dir > 0 ? p.price >= p.tp : p.price <= p.tp);
      if (hitSL || hitTP) closed.push([p, hitSL ? 'Стоп-лосс' : 'Тейк-профит']);
    });
    closed.forEach(([p, why]) => doClose(p, p.qty, why, true));
  }

  function step() {
    IDS.forEach((id) => stepState(st(id)));
    const now = nowReal();
    if (now - lastEventAt > nextEventIn) {
      lastEventAt = now;
      nextEventIn = 6 + Math.random() * 8;
      randomEvent(st(pick(IDS)));
    }
    TH.bus.emit('account');
    if (visible) update();
  }

  function randomEvent(s) {
    const run = s.strategies.filter((x) => x.status === 'run');
    if (!run.length) return;
    const stg = pick(run);
    const sym = pick(stg.syms);
    const inst = TH.data.inst(sym);
    const r = Math.random();
    const f = (v) => TH.data.fp(inst, v);
    const exId = s.ex.id;
    if (r < 0.3) {
      addEvent(exId, 'info', `${stg.name}: бар закрыт, сигналов нет`, `${sym} · close ${f(s.prices[sym])}`);
    } else if (r < 0.58) {
      const pos = s.positions.find((x) => x.strategy === stg.name && x.pnl > 0 && x.sl != null);
      if (pos) {
        const nsl = TH.data.roundTick(TH.data.inst(pos.sym), pos.sl + (pos.price - pos.sl) * 0.25);
        if (pos.dir * (nsl - pos.sl) > 0) {
          pos.sl = nsl;
          addEvent(exId, 'info', `Трейлинг-стоп ${pos.sym} → ${TH.data.fp(TH.data.inst(pos.sym), nsl)}`, `${stg.name} · заявка перевыставлена`);
          if (visible) { renderTable(); if (pos.sym === chartSym) syncChartLines(); }
        }
      } else addEvent(exId, 'warn', `Сигнал ${sym} отклонён`, 'Фильтр волатильности: ATR ниже порога');
    } else if (r < 0.8) {
      addEvent(exId, 'warn', `Сигнал ${sym} отклонён`, pick(['Фильтр волатильности: ATR ниже порога', 'Спред шире допустимого', 'Нет подтверждения объёмом']));
    } else {
      openFromSignal(s, stg, sym);
    }
  }

  function openFromSignal(s, stg, sym) {
    const exId = s.ex.id;
    if (s.positions.length >= S.data.maxPositions) { addEvent(exId, 'warn', `Сигнал ${sym} пропущен`, `Достигнут лимит позиций ${s.ex.name} (${S.data.maxPositions})`); return; }
    if (s.positions.some((p) => p.sym === sym)) return;
    const inst = TH.data.inst(sym);
    const a = account(exId);
    const dir = Math.random() < 0.55 ? 1 : -1;
    const price = s.prices[sym];
    const dist = price * inst.vol * 0.55;
    const riskMoney = (a.equity * riskOf(exId)) / 100;
    const lots = Math.floor(riskMoney / dist / inst.lot);
    if (lots < 1) return;
    const qty = +(lots * inst.lot).toFixed(6);
    const sl = TH.data.roundTick(inst, price - dir * dist);
    const tp = TH.data.roundTick(inst, price + dir * dist * 2);
    const f = (v) => TH.data.fp(inst, v);
    const qd = inst.lot < 1 ? Math.max(0, -Math.floor(Math.log10(inst.lot))) : 0;
    addEvent(exId, 'signal', `Сигнал ${dir > 0 ? 'LONG' : 'SHORT'} ${sym}`, `${stg.name} · риск ${TH.fmt(riskOf(exId), 1)}% = ${TH.money(riskMoney, s.ex.cur)} · стоп ${f(sl)} → ${TH.fmt(qty, qd)}`);
    setTimeout(() => {
      const p = { id: TH.uid(), ex: exId, sym, dir, qty, entry: s.prices[sym], sl, tp, strategy: stg.name, openedAt: TH.data.nowFake(s.ex), price: s.prices[sym], pnl: 0, risk0: Math.abs(s.prices[sym] - sl) * qty };
      upd(s, p);
      s.positions.push(p);
      stg.trades++;
      stg.last = { t: p.openedAt, txt: `${dir > 0 ? 'LONG' : 'SHORT'} ${sym}` };
      addEvent(exId, 'fill', `Исполнено: ${dir > 0 ? 'покупка' : 'продажа'} ${sym}`, `${TH.fmt(qty, qd)} @ ${f(p.entry)} · SL ${f(sl)} · TP ${f(tp)}`);
      if (S.data.general.sounds) beep();
      if (visible) { renderTable(); renderStrategies(); if (sym === chartSym) syncChartLines(); }
    }, 1300);
  }

  function beep() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.08, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.25);
      o.connect(g); g.connect(ac.destination);
      o.start(); o.stop(ac.currentTime + 0.25);
    } catch (e) { }
  }

  function realize(s, p, qty) {
    const comm = (qty * p.price * s.ex.commission) / 100;
    const pnl = p.dir * (p.price - p.entry) * qty - comm;
    s.balance += pnl;
    s.realized += pnl;
    const stg = s.strategies.find((x) => x.name === p.strategy);
    if (stg) stg.pnl += pnl;
    return pnl;
  }

  function doClose(p, qty, why, auto) {
    const s = stOf(p.sym);
    const inst = TH.data.inst(p.sym);
    qty = Math.min(qty, p.qty);
    const pnl = realize(s, p, qty);
    const qd = TH.qtyDp(p);
    const full = qty >= p.qty - 1e-9;
    if (full) s.positions = s.positions.filter((x) => x !== p);
    else { p.qty = +(p.qty - qty).toFixed(6); p.risk0 = Math.abs(p.entry - (p.sl ?? p.entry)) * p.qty || p.risk0 / 2; upd(s, p); }
    addEvent(s.ex.id, auto ? (pnl >= 0 ? 'fill' : 'stop') : 'close', `${auto ? why + ': ' : full ? 'Позиция закрыта вручную: ' : 'Частичное закрытие: '}${p.sym}`, `${p.dir > 0 ? 'продажа' : 'покупка'} ${TH.fmt(qty, qd)} @ ${TH.data.fp(inst, p.price)} · ${TH.moneyS(pnl, s.ex.cur)}`);
    if (!auto) TH.toast(full ? `Позиция ${p.sym} закрыта` : `Закрыто ${TH.fmt(qty, qd)} ${p.sym}`, { type: pnl >= 0 ? 'success' : 'info', sub: `${s.ex.name} · ${TH.moneyS(pnl, s.ex.cur)}` });
    else TH.toast(`${why}: ${p.sym}`, { type: pnl >= 0 ? 'success' : 'warn', sub: `${s.ex.name} · ${TH.moneyS(pnl, s.ex.cur)}` });
    TH.bus.emit('account');
    if (visible) { renderTable(); renderStrategies(); updateAccs(); if (p.sym === chartSym) syncChartLines(); }
    return pnl;
  }

  async function closePosition(p, part = 1) {
    const s = stOf(p.sym);
    const inst = TH.data.inst(p.sym);
    const qd = TH.qtyDp(p);
    let qty = p.qty;
    if (part < 1) {
      const lots = Math.max(1, Math.floor((p.qty * part) / inst.lot));
      qty = +(lots * inst.lot).toFixed(6);
    }
    if (S.data.general.confirmClose) {
      const ok = await TH.confirm({
        title: part < 1 ? `Закрыть половину ${p.sym}?` : `Закрыть позицию ${p.sym}?`,
        message: `${s.ex.name} · ${p.dir > 0 ? 'Long' : 'Short'} ${TH.fmt(qty, qd)} будет закрыт рыночной заявкой.<br>Текущий P&L: <b class="${TH.cls(p.pnl)}">${TH.moneyS((p.pnl * qty) / p.qty, s.ex.cur)}</b>`,
        ok: 'Закрыть', destructive: true, icon: 'close',
      });
      if (!ok) return;
    }
    if (!s.positions.includes(p)) return;
    doClose(p, qty, '', false);
  }

  function pnlByEx(list, f = (p) => p.pnl) {
    return IDS.filter((id) => list.some((p) => p.ex === id)).map((id) => {
      const e = TH.data.ex(id);
      const v = TH.sum(list.filter((p) => p.ex === id), f);
      return `${e.name}: <b class="${TH.cls(v)}">${TH.moneyS(v, e.cur)}</b>`;
    }).join(' · ');
  }

  async function closeAll(kill) {
    const list = allPositions();
    if (!list.length && !kill) { TH.toast('Нет открытых позиций', { type: 'info' }); return; }
    const extra = list.length ? `<div class="checks">${list.map((p) => `<div class="check" style="align-items:center"><span class="badge ${p.dir > 0 ? 'long' : 'short'}">${p.dir > 0 ? 'L' : 'S'}</span><div class="ct"><b>${p.sym}</b> ${TH.exTag(p.ex)} <span class="faint">${TH.fmt(p.qty, TH.qtyDp(p))}</span></div><span class="tnum ${TH.cls(p.pnl)}">${TH.moneyS(p.pnl, TH.data.ex(p.ex).cur)}</span></div>`).join('')}</div>` : '';
    const ok = await TH.confirm({
      title: kill ? 'Аварийная остановка на обеих биржах?' : `Закрыть все позиции (${list.length})?`,
      message: kill ? 'На Finam и Hyperliquid одновременно: все стратегии будут остановлены, активные заявки сняты, позиции закрыты по рынку.' : `Обе биржи · P&L ${pnlByEx(list)}`,
      ok: kill ? 'Остановить всё' : 'Закрыть все', destructive: true, icon: kill ? 'power' : 'close', extra,
    });
    if (!ok) return;
    const sums = {};
    list.forEach((p) => {
      const s = stOf(p.sym);
      if (!s.positions.includes(p)) return;
      const pnl = realize(s, p, p.qty);
      sums[p.ex] = (sums[p.ex] || 0) + pnl;
      s.positions = s.positions.filter((x) => x !== p);
      addEvent(p.ex, 'close', `Позиция закрыта вручную: ${p.sym}`, `${p.dir > 0 ? 'продажа' : 'покупка'} ${TH.fmt(p.qty, TH.qtyDp(p))} @ ${TH.data.fp(TH.data.inst(p.sym), p.price)} · ${TH.moneyS(pnl, s.ex.cur)}`);
    });
    if (kill) {
      IDS.forEach((id) => {
        const s = st(id);
        s.strategies.forEach((x) => (x.status = 'pause'));
        const n = s.orders.length;
        s.orders = [];
        const closedN = list.filter((p) => p.ex === id).length;
        addEvent(id, 'stop', 'Аварийная остановка', `Стратегии на паузе · снято заявок: ${n + closedN * 2} · закрыто позиций: ${closedN}`);
      });
    }
    const sub = Object.entries(sums).map(([id, v]) => `${TH.data.ex(id).name} ${TH.moneyS(v, TH.data.ex(id).cur)}`).join(' · ');
    TH.toast(kill ? 'Торговля остановлена на обеих биржах' : 'Позиции закрыты', { type: kill ? 'warn' : 'success', sub });
    TH.bus.emit('account');
    if (visible) render();
  }

  function init() {
    root = TH.$('#view-live');
    inited = true;
    render();
  }

  function render() {
    dirty = false;
    if (tri) { tri.destroy(); tri = null; }
    const off = IDS.filter((id) => !S.data.conn[id].ok);
    root.innerHTML = `
      <div class="live">
        ${off.map((id) => `<div class="glass card live-warn"><span style="color:var(--orange)">${I('warn', 18)}</span><div class="grow"><b>Биржа ${TH.data.ex(id).name} не подключена</b><div class="faint" style="font-size:12px">Показаны последние сохранённые данные счёта. Вторая биржа продолжает работать.</div></div><button class="btn tinted" data-conn>Открыть настройки</button></div>`).join('')}
        <div class="live-accs" id="lvAccs"></div>
        <div class="live-grid">
          <div class="live-left">
            <div class="live-chart">
              <div class="toolbar glass" id="lvChartBar"></div>
              <div class="live-tri" id="lvTri"></div>
            </div>
            <div class="glass card pos-card">
              <div class="card-head"><div id="lvTab"></div><span class="card-sub" id="lvSync"></span><div class="grow"></div><button class="btn sm danger" id="lvCloseAll">${I('close', 12, 2.4)} Закрыть все</button></div>
              <div class="tbl-wrap" id="lvTable"></div>
            </div>
          </div>
          <div class="live-right">
            <div class="glass card">
              <div class="card-head"><span class="card-title">Стратегии</span><span class="card-sub" id="lvStratSub"></span><div class="grow"></div><button class="btn sm danger" id="lvKill" title="Остановить стратегии, снять заявки и закрыть позиции сразу на обеих биржах">${I('power', 13, 2.2)} Аварийный стоп</button></div>
              <div class="strat-list" id="lvStrats"></div>
            </div>
            <div class="glass card live-log-card">
              <div class="card-head" style="margin-bottom:4px"><span class="card-title">Журнал событий</span><span class="dot pulse" style="margin-left:2px"></span><div class="grow"></div><span class="card-sub" id="lvLogSub"></span></div>
              <div class="log" id="lvLog"></div>
            </div>
          </div>
        </div>
      </div>`;
    root.querySelectorAll('[data-conn]').forEach((b) => (b.onclick = () => TH.openSettings('exchange')));
    tabSeg = TH.seg(root.querySelector('#lvTab'), [{ v: 'pos', label: 'Позиции' }, { v: 'ord', label: 'Заявки' }], tab, (v) => { tab = v; renderTable(); });
    root.querySelector('#lvCloseAll').onclick = () => closeAll(false);
    root.querySelector('#lvKill').onclick = () => closeAll(true);
    renderAccs();
    renderTable();
    renderStrategies();
    renderLog();
    if (!chartSym || !TH.data.inst(chartSym)) chartSym = (allPositions()[0] || TH.data.LIST[0]).sym;
    buildChart();
  }

  function renderAccs() {
    const host = root && root.querySelector('#lvAccs');
    if (!host) return;
    const card = (id) => {
      const e = TH.data.ex(id);
      const m = (k, label) => `<div><small>${label}</small><b data-k="${k}"></b><span data-k="${k}S"></span></div>`;
      return `<div class="glass acc-card" data-acc="${id}">
        <div class="acc-head">${TH.exAva(id, S.data.conn[id].ok)}<div class="t"><b>${e.name}</b><small>${e.accountLabel} · ${e.market}</small></div><span class="conn-status" data-k="conn"></span></div>
        <div class="acc-metrics">${m('bal', 'Баланс')}${m('eq', 'Эквити')}${m('unr', 'Нереализ. P&L')}${m('day', 'P&L за день')}${m('mar', 'Маржа')}
          <div class="acc-risk"><small>${I('shield', 11)} Риск на сделку</small><div class="risk-ctl"><b data-k="risk"></b><div class="stepper sm"><button data-rd="-0.1" title="−0,1%">${I('minus', 12, 2.2)}</button><button data-rd="0.1" title="+0,1%">${I('plus', 12, 2.2)}</button></div></div><span data-k="riskS"></span></div>
        </div>
      </div>`;
    };
    host.innerHTML = IDS.map(card).join('');
    host.querySelectorAll('[data-acc]').forEach((c) => {
      const id = c.dataset.acc;
      c.querySelectorAll('[data-rd]').forEach((b) => (b.onclick = () => {
        S.data.risk[id] = Math.round(TH.clamp(S.data.risk[id] + +b.dataset.rd, 0.1, 5) * 10) / 10;
        S.save();
        TH.bus.emit('settings', 'risk', id);
        updateAccs();
      }));
    });
    updateAccs();
  }

  function updateAccs() {
    if (!root || !root.querySelector('#lvAccs')) return;
    const plural = (n) => (n === 1 ? 'позиция' : n >= 2 && n <= 4 ? 'позиции' : 'позиций');
    IDS.forEach((id) => {
      const c = root.querySelector(`[data-acc="${id}"]`);
      if (!c) return;
      const a = account(id);
      const cur = a.ex.cur;
      const usedPct = a.equity ? (a.margin / a.equity) * 100 : 0;
      const set = (k, html, cls) => { const el = c.querySelector(`[data-k="${k}"]`); if (!el) return; el.innerHTML = html; if (cls != null) el.className = cls; };
      set('bal', TH.money(a.balance, cur));
      set('balS', `реализ. ${TH.moneyS(a.realized, cur)}`);
      set('eq', TH.money(a.equity, cur));
      set('eqS', `свободно ${TH.money(a.free, cur)}`);
      set('unr', TH.moneyS(a.unreal, cur), TH.cls(a.unreal));
      set('unrS', `${a.positions.length} ${plural(a.positions.length)}`);
      set('day', TH.moneyS(a.dayPnl, cur), TH.cls(a.dayPnl));
      set('dayS', `${TH.pct(a.equity ? (a.dayPnl / (a.equity - a.dayPnl)) * 100 : 0, 2)} к началу дня`);
      set('mar', TH.pct(usedPct, 1, false), usedPct > 60 ? 'neg' : '');
      set('marS', TH.money(a.margin, cur));
      const ok = S.data.conn[id].ok;
      set('conn', ok ? `<span class="dot pulse"></span>${ping(id)} мс` : '<span class="dot gray"></span>офлайн');
      set('risk', TH.fmt(riskOf(id), 1) + '%');
      set('riskS', `≈ ${TH.money((a.equity * riskOf(id)) / 100, cur)} · лимит ${S.data.maxPositions} поз.`);
    });
    const sync = root.querySelector('#lvSync');
    if (sync) sync.textContent = `Finam + Hyperliquid · обновлено ${TH.d.hms(nowReal() + MSK)} MSK`;
  }

  function renderTable() {
    const host = root && root.querySelector('#lvTable');
    if (!host) return;
    const ids = IDS;
    const positions = allPositions();
    const tabBtns = root.querySelectorAll('#lvTab button');
    if (tabBtns.length === 2) {
      const ordCount = TH.sum(ids, (id) => st(id).orders.length) + TH.sum(positions, (p) => (p.sl != null) + (p.tp != null));
      tabBtns[0].querySelector('span').textContent = `Позиции · ${positions.length}`;
      tabBtns[1].querySelector('span').textContent = `Заявки · ${ordCount}`;
      tabSeg.place();
    }
    root.querySelector('#lvCloseAll').classList.toggle('hidden', tab !== 'pos');
    if (tab === 'pos') {
      host.innerHTML = `<table class="tbl"><thead><tr>
        <th>Инструмент</th><th>Сторона</th><th class="r">Кол-во</th><th class="r">Вход</th><th class="r">Текущая</th><th class="r">P&L</th><th class="r">SL / TP</th><th class="r">R</th><th class="r">В позиции</th><th></th>
      </tr></thead><tbody>${positions.length ? positions.map(posRow).join('') : `<tr class="empty-row"><td colspan="10">Открытых позиций нет — стратегии ждут сигналов</td></tr>`}</tbody></table>`;
      host.querySelectorAll('tr[data-id]').forEach((tr) => {
        const p = positions.find((x) => x.id === tr.dataset.id);
        tr.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          setChartSym(p.sym);
        });
        tr.querySelector('[data-close]').onclick = () => closePosition(p, 1);
        tr.querySelector('[data-more]').onclick = (e) => moreMenu(e.currentTarget, p);
      });
    } else {
      const rows = [];
      positions.forEach((p) => {
        if (p.sl != null) rows.push({ ex: p.ex, sym: p.sym, type: 'Stop-loss', dir: -p.dir, qty: p.qty, price: p.sl, strategy: p.strategy, linked: true });
        if (p.tp != null) rows.push({ ex: p.ex, sym: p.sym, type: 'Take-profit', dir: -p.dir, qty: p.qty, price: p.tp, strategy: p.strategy, linked: true });
      });
      ids.forEach((id) => st(id).orders.forEach((o) => rows.push(Object.assign({}, o, { linked: false }))));
      host.innerHTML = `<table class="tbl"><thead><tr><th>Инструмент</th><th>Тип</th><th>Сторона</th><th class="r">Кол-во</th><th class="r">Цена</th><th class="r">До цены</th><th>Стратегия</th><th></th></tr></thead><tbody>
        ${rows.length ? rows.map((o) => {
          const inst = TH.data.inst(o.sym);
          const dist = (o.price / stOf(o.sym).prices[o.sym] - 1) * 100;
          const qd = inst.lot < 1 ? Math.max(0, -Math.floor(Math.log10(inst.lot))) : 0;
          return `<tr><td><div class="sym">${TH.ava(o.sym)}<div><b>${o.sym} ${TH.exTag(o.ex)}</b><small>${TH.data.ex(o.ex).name}</small></div></div></td><td>${o.linked ? `<span class="badge ${o.type === 'Stop-loss' ? 'short' : 'long'}">${o.type}</span>` : `<span class="badge gray">${o.type}</span>`}</td><td>${o.dir > 0 ? 'Покупка' : 'Продажа'}</td><td class="r">${TH.fmt(o.qty, qd)}</td><td class="r">${TH.data.fp(inst, o.price)}</td><td class="r faint">${TH.pct(dist, 2)}</td><td class="faint">${TH.esc(o.strategy)}</td><td class="r">${o.linked ? '<span class="faint" style="font-size:11.5px">связана с позицией</span>' : `<button class="btn sm" data-cancel="${o.id}">Снять</button>`}</td></tr>`;
        }).join('') : '<tr class="empty-row"><td colspan="8">Активных заявок нет</td></tr>'}</tbody></table>`;
      host.querySelectorAll('[data-cancel]').forEach((b) => (b.onclick = () => {
        const s = IDS.map(st).find((x) => x.orders.some((o) => o.id === b.dataset.cancel));
        if (!s) return;
        const o = s.orders.find((x) => x.id === b.dataset.cancel);
        s.orders = s.orders.filter((x) => x !== o);
        addEvent(s.ex.id, 'close', `Заявка снята: ${o.type} ${o.sym}`, `${o.dir > 0 ? 'покупка' : 'продажа'} ${o.qty} @ ${TH.data.fp(TH.data.inst(o.sym), o.price)}`);
        TH.toast('Заявка снята', { type: 'info', sub: `${s.ex.name} · ${o.type} ${o.sym}` });
        renderTable();
        if (o.sym === chartSym) syncChartLines();
      }));
    }
    renderPosChips();
  }

  function posRow(p) {
    const inst = TH.data.inst(p.sym);
    const s = stOf(p.sym);
    const f = (v) => (v == null ? '—' : TH.data.fp(inst, v));
    const pct = (p.dir * (p.price / p.entry - 1)) * 100;
    return `<tr class="click ${p.sym === chartSym ? 'cur' : ''}" data-id="${p.id}">
      <td><div class="sym">${TH.ava(p.sym)}<div><b>${p.sym} ${TH.exTag(p.ex)}</b><small>${TH.esc(p.strategy)}</small></div></div></td>
      <td><span class="badge ${p.dir > 0 ? 'long' : 'short'}">${p.dir > 0 ? 'LONG' : 'SHORT'}</span></td>
      <td class="r">${TH.fmt(p.qty, TH.qtyDp(p))}</td>
      <td class="r">${f(p.entry)}</td>
      <td class="r px" data-px>${f(p.price)}</td>
      <td class="r" data-pnl><b class="${TH.cls(p.pnl)}">${TH.moneyS(p.pnl, s.ex.cur)}</b><div class="${TH.cls(pct)}" style="font-size:11px">${TH.pct(pct)}</div></td>
      <td class="r faint" data-sltp>${f(p.sl)} / ${f(p.tp)}</td>
      <td class="r ${TH.cls(p.r)}" data-r>${TH.fmtS(p.r, 2)}</td>
      <td class="r faint" data-age>${TH.dur(TH.data.nowFake(s.ex) - p.openedAt)}</td>
      <td class="r nowrap"><button class="btn sm danger" data-close>Закрыть</button> <button class="btn sm plain icon" data-more title="Действия">${I('dots', 14)}</button></td>
    </tr>`;
  }

  function moreMenu(anchor, p) {
    const inst = TH.data.inst(p.sym);
    const pop = TH.popover(anchor, `<div style="width:250px">
      <button class="menu-item" data-a="be">${I('shield', 15)}<span>Стоп в безубыток</span><span class="r">${TH.data.fp(inst, p.entry)}</span></button>
      <button class="menu-item" data-a="half">${I('halfL', 15)}<span>Закрыть половину</span></button>
      <button class="menu-item" data-a="chart">${I('candles', 15)}<span>Открыть в режиме «День»</span></button>
      <div class="menu-sep"></div>
      <button class="menu-item danger" data-a="close">${I('close', 15)}<span>Закрыть по рынку</span></button>
    </div>`, { align: 'end' });
    if (!pop) return;
    pop.el.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => {
      pop.close();
      const a = b.dataset.a;
      if (a === 'be') {
        p.sl = p.entry;
        addEvent(p.ex, 'info', `Стоп ${p.sym} перенесён в безубыток`, TH.data.fp(inst, p.entry));
        TH.toast('Стоп перенесён в безубыток', { sub: `${TH.data.ex(p.ex).name} · ${p.sym}` });
        renderTable();
        if (p.sym === chartSym) syncChartLines();
      } else if (a === 'half') closePosition(p, 0.5);
      else if (a === 'close') closePosition(p, 1);
      else if (a === 'chart') TH.views.day.open(p.sym);
    }));
  }

  function update() {
    updateAccs();
    if (tab === 'pos') {
      allPositions().forEach((p) => {
        const tr = root.querySelector(`tr[data-id="${p.id}"]`);
        if (!tr) return;
        const s = stOf(p.sym);
        const inst = TH.data.inst(p.sym);
        const pxCell = tr.querySelector('[data-px]');
        const old = +pxCell.dataset.v || p.price;
        pxCell.dataset.v = p.price;
        pxCell.textContent = TH.data.fp(inst, p.price);
        if (p.price !== old && S.data.general.motion) {
          tr.classList.remove('flash-up', 'flash-dn');
          void tr.offsetWidth;
          tr.classList.add(p.price > old ? 'flash-up' : 'flash-dn');
        }
        const pct = (p.dir * (p.price / p.entry - 1)) * 100;
        tr.querySelector('[data-pnl]').innerHTML = `<b class="${TH.cls(p.pnl)}">${TH.moneyS(p.pnl, s.ex.cur)}</b><div class="${TH.cls(pct)}" style="font-size:11px">${TH.pct(pct)}</div>`;
        const r = tr.querySelector('[data-r]');
        r.textContent = TH.fmtS(p.r, 2);
        r.className = 'r ' + TH.cls(p.r);
        tr.querySelector('[data-sltp]').textContent = `${TH.data.fp(inst, p.sl)} / ${TH.data.fp(inst, p.tp)}`;
        tr.querySelector('[data-age]').textContent = TH.dur(TH.data.nowFake(s.ex) - p.openedAt);
      });
    }
    updateChart();
    if (Math.random() < 0.2) renderStrategies();
  }

  function renderStrategies() {
    const host = root && root.querySelector('#lvStrats');
    if (!host) return;
    const ids = IDS;
    const items = [].concat(...ids.map((id) => st(id).strategies.map((x) => ({ s: st(id), x }))));
    const running = items.filter((i) => i.x.status === 'run').length;
    root.querySelector('#lvStratSub').textContent = `${running} из ${items.length} работают`;
    host.innerHTML = items.map(({ s, x }) => {
      const ex = s.ex;
      const nowF = TH.data.nowFake(ex);
      const mine = s.positions.filter((p) => p.strategy === x.name);
      const total = x.pnl + TH.sum(mine, (p) => p.pnl);
      return `<div class="strat">
        <div class="strat-top">
          ${TH.exAva(ex.id, S.data.conn[ex.id].ok)}
          <div class="t"><b>${x.name}</b><small>${x.cls} · ${x.tf} · в работе ${TH.dur(nowF - x.started)}</small></div>
          ${x.status === 'run' ? '<span class="st-pill run"><span class="dot pulse"></span>Работает</span>' : '<span class="st-pill pause"><span class="dot orange"></span>Пауза</span>'}
        </div>
        <div class="strat-meta">
          <div><small>P&L сегодня</small><b class="${TH.cls(total)}">${TH.moneyS(total, ex.cur)}</b></div>
          <div><small>Сделок · открыто</small><b>${x.trades} · ${mine.length}</b></div>
          <div><small>Последний сигнал</small><b>${x.last ? `${TH.d.hm(x.last.t)} <span class="faint" style="font-weight:500">${x.last.txt}</span>` : '—'}</b></div>
        </div>
        <div class="strat-foot">
          <div class="chips">${x.syms.map((sym) => `<span class="chip xs static">${sym}</span>`).join('')}</div>
          ${TH.spark(x.spark, { w: 70, h: 22, color: total >= 0 ? '#30D158' : '#FF453A' })}
          <button class="btn sm ${x.status === 'run' ? '' : 'green'}" data-st="${ex.id}:${x.id}">${x.status === 'run' ? I('pause', 11) + ' Пауза' : I('play', 11) + ' Запустить'}</button>
        </div>
      </div>`;
    }).join('') || '<div class="empty-note">Стратегий нет</div>';
    host.querySelectorAll('[data-st]').forEach((b) => (b.onclick = () => {
      const [exId, sid] = b.dataset.st.split(':');
      const x = st(exId).strategies.find((q) => q.id === sid);
      x.status = x.status === 'run' ? 'pause' : 'run';
      addEvent(exId, x.status === 'run' ? 'fill' : 'warn', `${x.name}: ${x.status === 'run' ? 'запущена' : 'поставлена на паузу'}`, x.status === 'run' ? 'Ожидание закрытия следующего бара' : 'Открытые позиции сопровождаются, новые входы отключены');
      TH.toast(x.status === 'run' ? 'Стратегия запущена' : 'Стратегия на паузе', { type: x.status === 'run' ? 'success' : 'info', sub: `${TH.data.ex(exId).name} · ${x.name}` });
      renderStrategies();
    }));
  }

  const EV = {
    signal: ['bolt', 'rgba(10,132,255,.18)', 'var(--blue-t)'],
    fill: ['check', 'rgba(48,209,88,.16)', 'var(--green-t)'],
    close: ['close', 'rgba(255,255,255,.08)', 'var(--label-2)'],
    warn: ['warn', 'rgba(255,159,10,.16)', '#ffb84d'],
    info: ['info', 'rgba(255,255,255,.06)', 'var(--label-3)'],
    stop: ['shieldStop', 'rgba(255,69,58,.16)', 'var(--red-t)'],
  };
  function renderLog(onlyNew) {
    const host = root && root.querySelector('#lvLog');
    if (!host) return;
    const sub = root.querySelector('#lvLogSub');
    if (sub) sub.textContent = 'Finam + Hyperliquid · время MSK';
    const item = (e) => {
      const [ic, bg, col] = EV[e.type] || EV.info;
      return `<div class="log-item"><span class="tm">${TH.d.hm(e.at + MSK)}</span><span class="li" style="background:${bg};color:${col}">${I(ic, 12, 2.2)}</span><div class="lt">${TH.exTag(e.ex)} ${TH.esc(e.title)}<small>${TH.esc(e.sub || '')}</small></div></div>`;
    };
    const list = EVENTS;
    if (onlyNew && host.children.length && list.length) {
      host.insertAdjacentHTML('afterbegin', item(list[0]));
      while (host.children.length > 100) host.lastElementChild.remove();
    } else host.innerHTML = list.slice(0, 100).map(item).join('');
  }

  function setChartSym(sym) {
    if (sym === chartSym) return;
    chartSym = sym;
    TH.store.set('live.sym', sym);
    buildChart();
    renderTable();
  }

  function renderChartBar() {
    const bar = root.querySelector('#lvChartBar');
    if (!bar) return;
    const inst = TH.data.inst(chartSym), ex = TH.data.exOf(chartSym);
    bar.innerHTML = `
      <button class="inst-btn" id="lvInst" title="Выбрать инструмент · обе биржи">${TH.ava(chartSym)}<div><b>${chartSym} ${TH.exTag(ex.id)}</b><small>${TH.esc(inst.name)} · ${ex.name}</small></div>${I('chevD', 13, 2.2)}</button>
      <span class="badge short live-badge"><span class="dot red pulse"></span>LIVE</span>
      <span class="live-px" id="lvPx"></span>
      <div class="tb-sep"></div>
      <div class="pos-chips" id="lvPosChips"></div>
      <div class="grow"></div>
      <button class="btn plain" id="lvToDay" title="Открыть инструмент в режиме «День»">${I('candles', 15)}<span>В «День»</span></button>`;
    bar.querySelector('#lvInst').onclick = (e) => TH.openInstPicker(e.currentTarget, {
      cur: chartSym,
      onPick: (sym) => setChartSym(sym),
      quote: (i) => { const s = stOf(i.sym); return { price: s.prices[i.sym], ch: (s.prices[i.sym] / s.dayOpen[i.sym] - 1) * 100 }; },
    });
    bar.querySelector('#lvToDay').onclick = () => TH.views.day.open(chartSym);
    renderPosChips();
    renderChartPx();
  }

  function renderPosChips() {
    const host = root && root.querySelector('#lvPosChips');
    if (!host) return;
    const syms = [...new Set(allPositions().map((p) => p.sym))];
    host.innerHTML = `<span class="pc-lbl">В позиции</span>` + (syms.length ? syms.map((sym) => `<button class="chip xs ${sym === chartSym ? 'on' : ''}" data-csym="${sym}">${TH.exTag(TH.data.inst(sym).exch)}${sym}</button>`).join('') : '<span class="faint">—</span>');
    host.querySelectorAll('[data-csym]').forEach((b) => (b.onclick = () => setChartSym(b.dataset.csym)));
  }

  function renderChartPx() {
    const el = root && root.querySelector('#lvPx');
    if (!el || !chartSym) return;
    const s = stOf(chartSym);
    const inst = TH.data.inst(chartSym);
    const p = s.prices[chartSym];
    const ch = (p / s.dayOpen[chartSym] - 1) * 100;
    el.innerHTML = `<b class="tnum">${TH.data.fp(inst, p)}</b> <span class="${TH.cls(ch)} tnum">${TH.pct(ch)}</span><span class="faint"> к открытию</span>`;
  }

  function frames(sym) {
    const s = stOf(sym);
    const H = TH.data.history(sym);
    const M1 = s.series[sym];
    const dayT = Math.floor(M1[0].time / 86400) * 86400;
    const D = H.D.filter((b) => b.time < dayT).concat(TH.data.aggregate(M1, 86400));
    const h0 = H.dayH0[Math.max(0, H.days.length - 20)];
    const Hb = H.H.slice(h0).filter((b) => b.time < dayT).concat(TH.data.aggregate(M1, 3600));
    return { s, H, M1, D, Hb, dayT };
  }

  function buildChart() {
    const host = root && root.querySelector('#lvTri');
    if (!host) return;
    if (tri) { tri.destroy(); tri = null; }
    const inst = TH.data.inst(chartSym);
    tri = new TH.TriChart(host, {
      prefix: 'day',
      getTool: () => 'cursor',
      minuteTfs: [1, 5, 15],
      mtf,
      onMinuteTf: (v) => { mtf = v; TH.store.set('live.mtf', v); loadMinute(); syncChartLines(); },
    });
    tri.setInstrument(inst);
    const cfg = S.data.indicators;
    const { s, H, D, Hb, dayT } = frames(chartSym);
    const ex = s.ex;
    tri.d.setData(D, { volume: cfg.volume });
    tri.d.setLines(TH.buildIndicatorLines(D, cfg, 'D'));
    tri.d.setBand(dayT, dayT);
    tri.d.showLast(110, 4);
    tri.h.setData(Hb, { volume: cfg.volume });
    tri.h.setLines(TH.buildIndicatorLines(Hb, cfg, 'H'));
    const firstToday = Hb.find((b) => b.time >= dayT);
    if (firstToday) tri.h.setBand(firstToday.time, Hb[Hb.length - 1].time);
    tri.h.showLast(ex.weekdays ? 56 : 80, 4);
    tri.setSub('d', `${D.length} сессий · сегодняшний бар формируется`);
    tri.setSub('h', `${Math.min(20, H.days.length)} сессий + сегодня · подсвечен текущий день`);
    loadMinute();
    syncChartLines();
    renderChartBar();
  }

  function loadMinute() {
    if (!tri) return;
    const cfg = S.data.indicators;
    const s = stOf(chartSym);
    const M1 = s.series[chartSym];
    const M = mtf === 1 ? M1.map((b) => Object.assign({}, b)) : TH.data.aggregate(M1, mtf * 60);
    tri.m.setData(M, { volume: cfg.volume });
    tri.m.setLines(TH.buildIndicatorLines(M, cfg, 'M'));
    tri.m.showLast(mtf === 1 ? 180 : mtf === 5 ? 96 : 64, 8);
    tri.setSub('m', `сегодня с ${TH.d.hm(M1[0].time)} ${s.ex.tz} · ${M.length} баров · обновляется в реальном времени`);
  }

  function updateChart() {
    if (!tri || !chartSym) return;
    const cfg = S.data.indicators;
    const M1 = stOf(chartSym).series[chartSym];
    const up = (c, bar, tf) => {
      if (!bar || !c.bars.length || bar.time < c.bars[c.bars.length - 1].time) return;
      const n0 = c.bars.length;
      c.updateBar(bar);
      if (c.bars.length !== n0) c.setLines(TH.buildIndicatorLines(c.bars, cfg, tf));
    };
    up(tri.m, mtf === 1 ? Object.assign({}, M1[M1.length - 1]) : TH.data.bucket(M1, mtf * 60), 'M');
    up(tri.h, TH.data.bucket(M1, 3600), 'H');
    up(tri.d, TH.data.bucket(M1, 86400), 'D');
    renderChartPx();
  }

  function syncChartLines() {
    if (!tri) return;
    const s = stOf(chartSym);
    const lines = [];
    s.positions.filter((p) => p.sym === chartSym).forEach((p) => {
      lines.push({ price: p.entry, color: 'rgba(235,235,245,.7)', title: `${p.dir > 0 ? 'LONG' : 'SHORT'} ${TH.fmt(p.qty, TH.qtyDp(p))}`, style: 0 });
      if (p.sl != null) lines.push({ price: p.sl, color: '#FF453A', title: 'SL' });
      if (p.tp != null) lines.push({ price: p.tp, color: '#30D158', title: 'TP' });
    });
    s.orders.filter((o) => o.sym === chartSym).forEach((o) => lines.push({ price: o.price, color: '#FF9F0A', title: o.type, style: 3 }));
    [tri.h, tri.m].forEach((c) => c.setPriceLines(lines));
    const prices = lines.map((x) => x.price);
    tri.h.setExtraPrices(prices);
    tri.m.setExtraPrices(prices);
  }

  setInterval(() => { try { step(); } catch (e) { console.error(e); } }, 1000);

  TH.bus.on('conn', () => { if (!inited) return; if (visible) render(); else dirty = true; });
  TH.bus.on('settings', (k) => { if ((k === 'risk' || k === 'maxPositions') && inited && visible) updateAccs(); });

  TH.live = {
    account,
    accounts: () => IDS.map((id) => account(id)),
    ping,
    sync: () => TH.bus.emit('account'),
  };
  TH.views.live = {
    show() {
      if (!inited) init();
      else if (dirty) render();
      visible = true;
      renderAccs();
      renderTable();
      renderLog();
      renderStrategies();
      if (tri) [tri.d, tri.h, tri.m].forEach((c) => c.redraw());
    },
    hide() { visible = false; },
  };
})();
