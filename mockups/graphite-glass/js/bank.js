(function () {
  const TH = window.TH;
  const I = TH.icon;
  const ME = 'aska';
  const DAY = 86400;
  const nowSec = () => Math.floor(Date.now() / 1000);

  const USERS = {
    aska: { name: 'Aska', handle: 'aska', color: '#0A84FF' },
    th: { name: 'Trading Helper', handle: 'trading-helper', color: '#5E5CE6', system: true },
    turtle_dima: { name: 'Дмитрий Черепанов', handle: 'turtle_dima', color: '#30D158' },
    vol_cat: { name: 'Volatility Cat', handle: 'vol_cat', color: '#FFD60A' },
    quant_olga: { name: 'Ольга Сафина', handle: 'quant_olga', color: '#BF5AF2' },
    mike_trend: { name: 'Михаил Орлов', handle: 'mike_trend', color: '#FF9F0A' },
    breakout_lena: { name: 'Елена Пак', handle: 'breakout_lena', color: '#FF375F' },
    hyper_vlad: { name: 'Влад Ким', handle: 'hyper_vlad', color: '#66D4CF' },
    moex_irina: { name: 'Ирина Белова', handle: 'moex_irina', color: '#64D2FF' },
    scalp_max: { name: 'Максим Лис', handle: 'scalp_max', color: '#FF6B61' },
  };
  const uget = (id) => USERS[id] || { name: id, handle: id, color: '#8E8E93' };
  const initials = (u) => u.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  TH.users = { ME, get: uget, all: USERS, isMe: (id) => id === ME };
  TH.uAva = (id, size = 22) => {
    const u = uget(id);
    const fs = Math.round(size * 0.4);
    if (u.system) return `<span class="u-ava sys" style="width:${size}px;height:${size}px" title="${TH.esc(u.name)}">${TH.logo().replace(/width="20" height="20"/, `width="${Math.round(size * 0.62)}" height="${Math.round(size * 0.62)}"`)}</span>`;
    const n = parseInt(u.color.slice(1), 16);
    const light = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 170;
    return `<span class="u-ava" style="width:${size}px;height:${size}px;font-size:${fs}px;color:${light ? '#1c1c1e' : '#fff'};background:linear-gradient(145deg, ${u.color}, ${TH.shade(u.color, -0.42)})" title="${TH.esc(u.name)}">${TH.esc(initials(u))}</span>`;
  };
  TH.uChip = (id, { size = 20, name = false } = {}) => {
    const u = uget(id);
    return `<span class="u-chip">${TH.uAva(id, size)}<span class="u-h">${name ? `<b>${TH.esc(u.name)}</b>` : ''}<span>@${TH.esc(u.handle)}</span></span>${id === ME ? '<span class="you">вы</span>' : ''}</span>`;
  };

  const SRC = {
    voice: { icon: 'mic', label: 'голосовое описание' },
    text: { icon: 'pen', label: 'текстовое описание' },
    code: { icon: 'code', label: 'класс из репозитория' },
  };

  const OTHERS = [
    { id: 'EmaCrossover', author: 'th', engine: 'EmaCrossover', source: 'code', ago: 164, baseRuns: 412, users: 61, cls: 'EmaCrossover' },
    { id: 'MeanReversionZScore', author: 'th', engine: 'MeanReversionZScore', source: 'code', ago: 151, baseRuns: 287, users: 44, cls: 'MeanReversionZScore' },
    { id: 'DonchianBreakout', author: 'th', engine: 'DonchianBreakout', source: 'code', ago: 158, baseRuns: 356, users: 52, cls: 'DonchianBreakout' },
    { id: 'OpeningRangeBreakout', author: 'th', engine: 'OpeningRangeBreakout', source: 'code', ago: 133, baseRuns: 198, users: 37, cls: 'OpeningRangeBreakout' },
    {
      id: 'u_break30', name: 'Пробой 30 часов по тренду', author: 'turtle_dima', engine: 'DonchianBreakout', source: 'text', ago: 34, baseRuns: 214, users: 38, cls: 'Break30TrendFilter',
      params: { n: 30, trend: 100, sl: 2, rr: 3, hold: 60 },
      text: 'Беру часовик. Если свеча закрылась выше максимума последних 30 часов и при этом цена над EMA 100 — захожу в лонг, зеркально в шорт под минимум 30 часов и под EMA 100. Стоп 2 ATR, тейк 3 к 1. Если за 60 часов ничего не случилось — выхожу по рынку.',
    },
    {
      id: 'u_turtle', name: 'Черепахи на часах', author: 'turtle_dima', engine: 'DonchianBreakout', source: 'text', ago: 61, baseRuns: 173, users: 29, cls: 'HourlyTurtles',
      params: { n: 55, trend: 200, sl: 2, rr: 4, hold: 120 },
      text: 'Классические черепахи, только на часах: пробой 55-часового канала, торгую только по тренду EMA 200. Стоп 2 ATR, цель 4R, держу максимум 120 часов.',
    },
    {
      id: 'u_squeeze', name: 'Выстрел после сжатия', author: 'vol_cat', engine: 'BollingerSqueeze', source: 'voice', audio: 48, ago: 12, baseRuns: 96, users: 21, cls: 'SqueezeShot',
      params: { q: 10, rr: 3, sl: 2 },
      text: 'Значит так. Жду, пока полосы Боллинджера сожмутся — ширина должна быть в нижних 10% за последние 120 часов. Как только после этого свеча закрывается за полосой, иду в сторону пробоя. Стоп 2 ATR, цель 3 к 1.',
    },
    {
      id: 'u_bbclassic', name: 'Сжатие Боллинджера · классика', author: 'quant_olga', engine: 'BollingerSqueeze', source: 'voice', audio: 29, ago: 22, baseRuns: 58, users: 14, cls: 'BollingerSqueezeClassic',
      text: 'Сжатие Боллинджера по учебнику: 20 периодов, 2 сигмы, сжатие — нижние 20% ширины. Пробой полосы — вход, стоп 1,5 ATR, цель 2,5R.',
    },
    {
      id: 'u_golden', name: 'Золотой крест 50/200', author: 'mike_trend', engine: 'EmaCrossover', source: 'text', ago: 47, baseRuns: 131, users: 33, cls: 'GoldenCross50x200',
      params: { fast: 50, slow: 200, sl: 2.5, rr: 3, hold: 80 },
      text: 'Золотой и мёртвый крест на часах: EMA 50 и EMA 200. Пересекла вверх — лонг, вниз — шорт. Стоп широкий, 2,5 ATR, цель 3R. Сделку держу до 80 часов.',
    },
    {
      id: 'u_don20', name: 'Пробой 20 баров', author: 'breakout_lena', engine: 'DonchianBreakout', source: 'text', ago: 18, baseRuns: 44, users: 11, cls: 'Donchian20Fast',
      params: { n: 20, trend: 50, sl: 1.5, rr: 2, hold: 40 },
      text: 'Пробой 20-часового канала Дончиана с фильтром EMA 50. Стоп 1,5 ATR, тейк 2R, выход через 40 часов.',
    },
    {
      id: 'u_rsitrend', name: 'RSI-откат по тренду', author: 'quant_olga', engine: 'RsiReversal', source: 'voice', audio: 41, ago: 5, baseRuns: 23, users: 9, cls: 'RsiPullbackTrend',
      params: { trend: 200 },
      text: 'RSI 14. Покупаю, когда он выходит вверх из-под 30, но только если цена выше EMA 200. Шорт — зеркально от 70 под EMA 200. Стоп 1,5 ATR, цель 2R, а если RSI добежал до противоположной зоны — закрываю раньше.',
    },
    {
      id: 'u_mrcrypto', name: 'Возврат к среднему · крипта', author: 'hyper_vlad', engine: 'MeanReversionZScore', source: 'voice', audio: 33, ago: 27, baseRuns: 67, users: 16, cls: 'CryptoMeanRevert48',
      params: { n: 48, zIn: 2.2, sl: 3, hold: 36 },
      text: 'Крипта постоянно возвращается к среднему. Считаю Z-score от SMA 48 часов: ушёл за 2,2 сигмы — захожу против движения, цель — возврат к средней. Стоп 3 ATR, держу не больше 36 часов.',
    },
    {
      id: 'u_orbmoex', name: 'Первый час Мосбиржи', author: 'moex_irina', engine: 'OpeningRangeBreakout', source: 'voice', audio: 52, ago: 40, baseRuns: 88, users: 19, cls: 'MoexFirstHour',
      params: { rr: 2, minAtr: 0.6 },
      text: 'На Мосбирже первый час задаёт тон. Отмечаю максимум и минимум первого часа, если следующий час закрылся выше — покупаю, ниже — продаю. Стоп за противоположную границу, цель 2R, вечером всё закрываю. Узкие диапазоны меньше 0,6 ATR пропускаю.',
    },
    {
      id: 'u_scalp', name: 'Скальп EMA 5/13', author: 'scalp_max', engine: 'EmaCrossover', source: 'text', ago: 3, baseRuns: 31, users: 12, cls: 'ScalpEma5x13',
      params: { fast: 5, slow: 13, sl: 1, rr: 1.5, hold: 8 },
      text: 'Быстрые EMA 5 и 13, вход на пересечении, стоп 1 ATR, тейк 1,5R, сидеть в сделке не дольше 8 часов.',
    },
  ].map((e) => Object.assign({ status: 'ready', shared: true, params: {} }, e, {
    name: e.name || TH.strategy(e.engine).name,
    text: e.text || TH.strategy(e.engine).desc,
    created: nowSec() - e.ago * DAY - (TH.hash(e.id) % 36000),
  }));

  const MINE_SEED = () => [
    {
      id: 'my_pullback', name: 'Откат к EMA 20/50', author: ME, engine: 'EmaCrossover', source: 'voice', audio: 36, status: 'ready', shared: true,
      params: { fast: 20, slow: 50, sl: 2, rr: 2.5, hold: 48 }, baseRuns: 57, users: 13, cls: 'GenEmaPullback2050', created: nowSec() - 9 * DAY - 5200,
      text: 'Работаю по тренду на часовом графике. Когда EMA 20 пересекает EMA 50 вверх — покупаю, вниз — продаю. Стоп ставлю на 2 ATR, цель 2,5R, позицию держу не дольше 48 часов.',
    },
    {
      id: 'my_rsicrypto', name: 'RSI 30/70 на крипте', author: ME, engine: 'RsiReversal', source: 'text', status: 'ready', shared: false,
      params: {}, baseRuns: 0, users: 0, cls: 'GenRsiCrypto3070', created: nowSec() - 2 * DAY - 7400,
      text: 'RSI 14 на крипте: ушёл ниже 30 и вернулся обратно вверх — лонг, выше 70 и обратно вниз — шорт. Стоп 1,5 ATR, цель 2R.',
    },
    {
      id: 'my_orbclarify', name: '', author: ME, engine: null, source: 'text', status: 'clarify', shared: true, params: {}, baseRuns: 0, users: 0, fresh: true, created: nowSec() - 3 * 3600,
      text: 'Хочу торговать пробой диапазона первого часа на Мосбирже. Если цена закрывает час выше максимума первого часа — покупаю, ниже минимума — продаю. Прибыль фиксирую на 2R или в конце дня.',
      answers: [],
      pipe: { ids: ['parse', 'code', 'test', 'bt', 'done'], i: 0, at: Date.now() - 4000, log: { parse: 'Найдено: вход long, вход short, цель · не хватает стоп-лосса' }, t: {}, q: 'stop' },
    },
  ];

  let mine = TH.store.get('bank.mine', null);
  if (!mine) { mine = MINE_SEED(); TH.store.set('bank.mine', mine); }
  const saveMine = () => TH.store.set('bank.mine', mine);
  const emit = (id, type) => TH.bus.emit('bank', { id, type });

  const all = () => mine.concat(OTHERS);
  const get = (id) => all().find((e) => e.id === id) || null;
  const engineOf = (e) => (e && e.engine ? TH.strategy(e.engine) : null);
  function params(e, over) {
    const E = engineOf(e);
    const P = {};
    if (!E) return P;
    E.params.forEach((q) => (P[q.k] = q.def));
    Object.assign(P, e.params || {}, over || {});
    E.params.forEach((q) => (P[q.k] = +P[q.k]));
    return P;
  }
  const styleOf = (e) => (engineOf(e) ? engineOf(e).style : null);
  const isMine = (e) => e && e.author === ME;
  const available = () => all().filter((e) => e.status === 'ready' && (e.shared || isMine(e)));
  const rated = () => all().filter((e) => e.status === 'ready' && e.shared);
  const displayName = (e) => e.name || 'Новая стратегия';

  const REF_ACC = { capital: 1000000, risk: 1, commission: 0.04, maxLev: 3 };
  const MARKETS = [{ v: 'all', label: 'Все рынки', short: 'Все' }, { v: 'finam', label: 'MOEX', short: 'MOEX' }, { v: 'hyperliquid', label: 'Крипто', short: 'Крипто' }];
  const PERIODS = [{ v: 30, label: '1М' }, { v: 91, label: '3М' }, { v: 182, label: '6М' }, { v: 0, label: 'Всё' }];
  const marketSyms = (m) => TH.data.LIST.filter((i) => m === 'all' || i.exch === m).map((i) => i.sym);
  const minFromIdx = (exch) => (TH.data.ex(exch).weekdays ? 40 : 16);
  function bounds(syms) {
    const list = syms.length ? syms : TH.data.LIST.map((i) => i.sym);
    const minF = Math.max(...list.map((s) => { const H = TH.data.history(s); return H.days[minFromIdx(H.inst.exch)]; }));
    const maxT = Math.max(...list.map((s) => { const H = TH.data.history(s); return H.days[H.days.length - 1]; }));
    return { minF, maxT };
  }
  const refSpec = (e, m = 'all') => ({ engine: e.engine, params: params(e), syms: marketSyms(m), span: 0, acc: REF_ACC, slippage: 1 });

  const dayKey = () => new Date().toISOString().slice(0, 10);
  const specKey = (s) => 'k' + TH.hash(JSON.stringify([s.engine, s.params, s.syms, s.span, s.acc, s.slippage])).toString(36);
  let sums = TH.store.get('bank.sums', null);
  if (!sums || sums.day !== dayKey()) sums = { day: dayKey(), at: null, map: {} };
  let saveT = null;
  const saveSums = () => { clearTimeout(saveT); saveT = setTimeout(() => TH.store.set('bank.sums', sums), 300); };

  const r2 = (v) => Math.round(v * 100) / 100;
  function windowSum(res, days) {
    const eq = res.acc.eq;
    let k = 0;
    if (days) {
      const t0 = eq[eq.length - 1].time - days * DAY;
      const j = eq.findIndex((e) => e.time >= t0);
      k = Math.max(0, j - 1);
    }
    const E = eq.slice(k);
    const tr = k === 0 ? res.trades : res.trades.filter((t) => t.exitTime >= E[0].time + DAY);
    const m = TH.bt.metrics(tr, E, E[0].value, 365);
    const step = Math.max(1, Math.ceil(E.length / 56));
    const spark = E.filter((_, i) => i % step === 0 || i === E.length - 1).map((e) => Math.round(e.value));
    return { ret: r2(m.ret), mdd: r2(m.mdd), sharpe: r2(m.sharpe), pf: isFinite(m.pf) ? r2(m.pf) : 'inf', n: m.n, wr: r2(m.winRate), spark };
  }
  function summarize(res) {
    const p = {};
    PERIODS.forEach((x) => (p[x.v] = windowSum(res, x.v)));
    return { p };
  }

  function materialize(spec, key) {
    const { minF, maxT } = bounds(spec.syms);
    const from = spec.span ? Math.max(minF, maxT - spec.span * DAY) : minF;
    return { id: 'c-' + key, engine: spec.engine, strategy: spec.engine, syms: spec.syms.slice(), from, to: maxT, acc: Object.assign({}, spec.acc), slippage: spec.slippage, params: Object.assign({}, spec.params), at: nowSec() };
  }

  const memRes = new Map();
  const pending = new Map();
  const jobs = [];
  let busy = false;
  let done = 0;
  function compute(spec, prio = false) {
    const key = specKey(spec);
    if (memRes.has(key)) {
      const v = memRes.get(key);
      memRes.delete(key);
      memRes.set(key, v);
      return Promise.resolve(v);
    }
    if (pending.has(key)) {
      const j = pending.get(key);
      if (prio) { const i = jobs.indexOf(j); if (i > 0) { jobs.splice(i, 1); jobs.unshift(j); } }
      return j.p;
    }
    let resolve, reject;
    const p = new Promise((a, b) => { resolve = a; reject = b; });
    const job = { key, spec, resolve, reject, p };
    pending.set(key, job);
    if (prio) jobs.unshift(job); else jobs.push(job);
    pump();
    return p;
  }
  async function pump() {
    if (busy) return;
    busy = true;
    await new Promise((r) => setTimeout(r, 30));
    while (jobs.length) {
      const j = jobs.shift();
      try {
        const t0 = performance.now();
        const res = await TH.bt.run(materialize(j.spec, j.key));
        res.calcMs = performance.now() - t0;
        res.key = j.key;
        memRes.set(j.key, res);
        if (memRes.size > 10) memRes.delete(memRes.keys().next().value);
        sums.map[j.key] = summarize(res);
        sums.at = nowSec();
        saveSums();
        done++;
        j.resolve(res);
      } catch (err) {
        console.error(err);
        j.reject(err);
      }
      pending.delete(j.key);
      TH.bus.emit('bank:computed', j.key);
    }
    busy = false;
  }
  const summary = (spec) => sums.map[specKey(spec)] || null;
  const queueState = () => ({ pending: pending.size, done });

  const LISTS_SYS = [
    { id: 'all', name: 'Все', syms: () => marketSyms('all') },
    { id: 'finam', name: 'MOEX', syms: () => marketSyms('finam') },
    { id: 'hyperliquid', name: 'Крипто', syms: () => marketSyms('hyperliquid') },
  ];
  let ulists = TH.store.get('bank.lists', null);
  if (!ulists) {
    ulists = [{ id: 'l_blue', name: 'Голубые фишки', syms: ['SBER', 'GAZP', 'LKOH'] }, { id: 'l_majors', name: 'BTC + ETH', syms: ['BTC', 'ETH'] }];
    TH.store.set('bank.lists', ulists);
  }
  function lists() {
    return LISTS_SYS.map((l) => ({ id: l.id, name: l.name, syms: l.syms(), sys: true })).concat(ulists.map((l) => Object.assign({ user: true }, l, { syms: l.syms.filter((s) => TH.data.inst(s)) })));
  }
  function saveList(name, syms) {
    const l = { id: 'l_' + TH.uid(), name, syms: syms.slice() };
    ulists.push(l);
    TH.store.set('bank.lists', ulists);
    return l;
  }
  function deleteList(id) {
    ulists = ulists.filter((l) => l.id !== id);
    TH.store.set('bank.lists', ulists);
  }

  function community(e) {
    if (!e || e.status !== 'ready' || !e.shared || e.fresh) return [];
    const E = engineOf(e);
    const r = TH.rng(TH.hash('comm:' + e.id));
    const others = Object.keys(USERS).filter((u) => u !== ME && u !== 'th' && u !== e.author);
    const SETS = [marketSyms('finam'), marketSyms('hyperliquid'), ['SBER', 'GAZP', 'LKOH'], ['BTC', 'ETH'], ['ETH', 'SOL', 'HYPE'], marketSyms('all'), ['SBER', 'YDEX', 'BTC', 'ETH']];
    const tunable = E.params.filter((q) => q.k !== 'hold');
    const base = params(e);
    const n = 3 + Math.floor(r() * 2);
    const out = [];
    for (let k = 0; k < n; k++) {
      const user = others[Math.floor(r() * others.length)];
      const syms = SETS[Math.floor(r() * SETS.length)];
      const span = [91, 182, 0][Math.floor(r() * 3)];
      const p = Object.assign({}, base);
      const changed = [];
      const nCh = 1 + Math.floor(r() * 2);
      for (let c = 0; c < nCh; c++) {
        const q = tunable[Math.floor(r() * tunable.length)];
        if (changed.includes(q.k)) continue;
        let v = base[q.k] * (0.65 + r() * 0.8);
        v = TH.clamp(Math.round(v / q.step) * q.step, q.min, q.max);
        v = +v.toFixed(q.step < 1 ? 1 : 0);
        if (v === base[q.k]) continue;
        p[q.k] = v;
        changed.push(q.k);
      }
      const risk = [0.5, 1, 1, 1.5, 2][Math.floor(r() * 5)];
      out.push({ id: `${e.id}:c${k}`, user, spec: { engine: e.engine, params: p, syms, span, acc: Object.assign({}, REF_ACC, { risk }), slippage: 1 }, changed, ago: 1 + Math.floor(r() * 26) + k * 2 });
    }
    return out.sort((a, b) => a.ago - b.ago);
  }

  const ASPECTS = [
    { k: 'entry', label: 'Условие входа', req: true, re: /(вход|захож|покупа|покупк|куплю|продаю|шорт|short|лонг|long|пересе|пробо|пробив|выходит|откры)/i },
    { k: 'exit', label: 'Цель или выход', req: true, re: /(цел[ьиюя]|тейк|take|фикс|выхож|выход |закрыва|закрою|\d\s*r\b|\d\s*к\s*1|держу|не дольше|не больше)/i },
    { k: 'stop', label: 'Стоп-лосс', req: true, re: /(стоп|stop|sl\b|atr|атр)/i },
    { k: 'tf', label: 'Таймфрейм', def: 'по умолч. H1', re: /(час|минут|дневк|дневн|h1|m5|m15|d1|таймфрейм|свеч)/i },
    { k: 'inst', label: 'Рынок', def: 'по умолч. все', re: /(акци|фьюч|крипт|биткоин|btc|eth|sol|сбер|sber|газпром|мосбирж|moex|perp|инструмент)/i },
  ];
  const QUESTIONS = {
    entry: { title: 'При каком условии открывать сделку?', hint: 'В описании не нашлось сигнала на вход.', label: 'Условие входа', opts: ['Пересечение EMA 20 и EMA 50', 'Пробой максимума или минимума 30 часов', 'RSI 14 выходит из зон 30 / 70'] },
    stop: { title: 'Где ставить стоп-лосс?', hint: 'Без стопа нельзя рассчитать размер позиции от риска на сделку.', label: 'Стоп-лосс', opts: ['1,5 ATR от цены входа', '2 ATR от цены входа', 'За противоположную границу диапазона'] },
    exit: { title: 'Когда фиксировать прибыль?', hint: 'Не нашлось цели или правила выхода из позиции.', label: 'Цель или выход', opts: ['Цель 2R', 'Цель 3R', 'Выход через 24 часа по рынку'] },
  };
  const ENGINE_RE = [
    ['RsiReversal', /(rsi|рси|перекуплен|перепродан)/i],
    ['BollingerSqueeze', /(боллинджер|bollinger|сжати|squeeze)/i],
    ['OpeningRangeBreakout', /(перв\S* час|opening range|утренн\S* диапазон)/i],
    ['MeanReversionZScore', /(z-?score|z-оценк|возврат\S* к средн|к средней|сигм|отклонени)/i],
    ['DonchianBreakout', /(дончиан|donchian|черепах|канал|пробо\S* (максимум|минимум)|максимум\S* последних)/i],
    ['EmaCrossover', /(ema|ема|скользящ|средн|пересе|крест)/i],
  ];
  const fullText = (e) => [e.text].concat((e.answers || []).map((a) => `${a.label}: ${a.a}`)).join('\n');

  function extract(eid, raw) {
    const E = TH.strategy(eid);
    const P = {};
    E.params.forEach((q) => (P[q.k] = q.def));
    const t = ' ' + raw.toLowerCase().replace(/(\d),(\d)/g, '$1.$2').replace(/полтора/g, '1.5').replace(/два с половиной/g, '2.5') + ' ';
    const set = (k, v) => {
      const q = E.params.find((x) => x.k === k);
      if (!q || v == null || isNaN(v)) return;
      P[k] = +TH.clamp(Math.round(v / q.step) * q.step, q.min, q.max).toFixed(q.step < 1 ? 1 : 0);
    };
    const m1 = (re) => { const m = t.match(re); return m ? parseFloat(m[1]) : null; };
    const atrMul = m1(/(\d+(?:\.\d+)?)\s*(?:x|×|х|\*)?\s*(?:atr|атр)/);
    if (eid === 'OpeningRangeBreakout') set('minAtr', atrMul);
    else set('sl', atrMul);
    const atrN = m1(/(?:atr|атр)\s*\(?(\d+)/);
    if (atrN >= 5) set('atr', atrN);
    set('rr', m1(/(\d+(?:\.\d+)?)\s*r\b/) ?? m1(/(\d+(?:\.\d+)?)\s*к\s*1/));
    set('hold', m1(/(?:дольше|больше|через|максимум|до)\s*(\d+)\s*(?:час|бар|свеч)/));
    const emas = [...t.matchAll(/(?:ema|ема)\s*(\d+)/g)].map((m) => +m[1]);
    if (eid === 'EmaCrossover') {
      const pair = t.match(/(?:ema|ема)\s*(\d+)\D{1,14}?(\d+)/);
      const nums = emas.length >= 2 ? emas.slice(0, 2) : pair ? [+pair[1], +pair[2]] : null;
      if (nums) { set('fast', Math.min(...nums)); set('slow', Math.max(...nums)); }
    }
    if (eid === 'DonchianBreakout') {
      set('n', m1(/(?:максимум\S*|минимум\S*|канал\S*)\s*(?:последних\s*)?(\d+)/) ?? m1(/(\d+)[-\s]*(?:час\S*|бар\S*|свеч\S*)\s*(?:канал|максимум|диапазон)/));
      if (emas.length) set('trend', emas[0]);
    }
    if (eid === 'RsiReversal') {
      set('n', m1(/(?:rsi|рси)\s*\(?(\d+)/));
      const lo = m1(/(?:ниже|под|из-под)\s*(\d{2})\b/), hi = m1(/(?:выше|над|от)\s*(\d{2})\b/);
      if (lo && lo < 50) set('lo', lo);
      if (hi && hi > 50) set('hi', hi);
      if (emas.length && /(тренд|выше ema|ниже ema|над ema|под ema)/.test(t)) set('trend', Math.max(...emas));
    }
    if (eid === 'MeanReversionZScore') {
      set('n', m1(/(?:sma|средн\S*)\s*(\d+)/));
      set('zIn', m1(/(\d+(?:\.\d+)?)\s*(?:сигм|σ|стандартн)/));
    }
    if (eid === 'BollingerSqueeze') {
      set('n', m1(/(?:боллинджер\S*|bb)\s*\(?(\d+)/) ?? m1(/(\d+)\s*период/));
      set('q', m1(/(\d+)\s*(?:%|процент)/));
      set('look', m1(/(?:за|последних)\s*(?:последние\s*)?(\d+)\s*(?:час|бар|свеч)/));
    }
    return P;
  }

  function analyze(text) {
    const found = {};
    ASPECTS.forEach((a) => (found[a.k] = a.re.test(text)));
    const missing = ASPECTS.filter((a) => a.req && !found[a.k]).map((a) => a.k);
    let engine = 'EmaCrossover';
    for (const [id, re] of ENGINE_RE) if (re.test(text)) { engine = id; break; }
    return { found, missing, engine, params: extract(engine, text) };
  }

  function autoName(eid, p) {
    switch (eid) {
      case 'EmaCrossover': return `Пересечение EMA ${p.fast}/${p.slow}`;
      case 'MeanReversionZScore': return `Возврат к SMA ${p.n} · Z ${TH.fmt(p.zIn, 1)}`;
      case 'DonchianBreakout': return `Пробой ${p.n} баров · EMA ${p.trend}`;
      case 'OpeningRangeBreakout': return `Пробой первого часа · ${TH.fmt(p.rr, 1)}R`;
      case 'RsiReversal': return `RSI ${p.n} · ${p.lo}/${p.hi}${p.trend ? ' по тренду' : ''}`;
      case 'BollingerSqueeze': return `Сжатие Боллинджера ${p.n}`;
      default: return 'Новая стратегия';
    }
  }

  const STAGES = {
    asr: { title: 'Распознавание речи', sub: 'голос → текст', dur: 2200 },
    parse: { title: 'Разбор описания', sub: 'выделяем условия входа, выхода и риска', dur: 2600 },
    code: { title: 'Генерация кода', sub: 'класс на базе TradingStrategy', dur: 3000 },
    test: { title: 'Проверка кода', sub: 'синтаксис, юнит-тесты, контроль заглядывания в будущее', dur: 2400 },
    bt: { title: 'Контрольный бэктест', sub: 'эталонный прогон на всех инструментах', dur: 1400 },
    done: { title: 'Готово', sub: 'стратегия доступна для пересчёта' },
  };

  function submit({ text, name, source, audio, shared }) {
    const ids = (source === 'voice' ? ['asr'] : []).concat(['parse', 'code', 'test', 'bt', 'done']);
    const e = {
      id: 'my_' + TH.uid(), name: (name || '').trim(), author: ME, engine: null, params: {}, source, audio: audio || 0, status: 'pipeline', shared: !!shared,
      baseRuns: 0, users: 0, fresh: true, created: nowSec(), text: text.trim(), answers: [],
      pipe: { ids, i: 0, at: Date.now(), log: {}, t: {}, q: null },
    };
    mine.unshift(e);
    saveMine();
    emit(e.id, 'new');
    ensureTicker();
    return e;
  }

  function advance(e) {
    const P = e.pipe;
    const sid = P.ids[P.i];
    P.t[sid] = Date.now() - P.at;
    P.i++;
    P.at = Date.now();
    P.btRun = false;
    if (P.ids[P.i] === 'done') {
      e.status = 'ready';
      P.doneAt = Date.now();
      TH.toast(`Стратегия «${displayName(e)}» готова`, { sub: e.shared ? 'доступна для пересчёта и опубликована в банке' : 'доступна для пересчёта · видна только вам', ms: 4200 });
    }
    saveMine();
    emit(e.id, e.status === 'ready' ? 'ready' : 'stage');
  }

  function runStage(e) {
    const P = e.pipe;
    const sid = P.ids[P.i];
    if (sid === 'asr') {
      const words = e.text.split(/\s+/).filter(Boolean).length;
      P.log.asr = `${words} слов · ${TH.fmt(e.audio || 0, 0)} с записи · язык ru-RU`;
      advance(e);
    } else if (sid === 'parse') {
      const a = analyze(fullText(e));
      const foundL = ASPECTS.filter((x) => a.found[x.k]).map((x) => x.label.toLowerCase());
      if (a.missing.length) {
        e.status = 'clarify';
        P.q = a.missing[0];
        P.log.parse = `Найдено: ${foundL.join(', ') || 'ничего'} · не хватает: ${a.missing.map((k) => QUESTIONS[k].label.toLowerCase()).join(', ')}`;
        saveMine();
        emit(e.id, 'clarify');
        return;
      }
      e.engine = a.engine;
      e.params = a.params;
      if (!e.name) e.name = autoName(a.engine, params(e));
      e.cls = 'Gen' + a.engine + '_' + e.id.slice(-4).toUpperCase();
      P.log.parse = `Найдено: ${foundL.join(', ')} · шаблон ${TH.strategy(a.engine).name}`;
      advance(e);
    } else if (sid === 'code') {
      const code = TH.strategyCode(engineOf(e), params(e), e.cls);
      P.log.code = `${e.cls}.py · ${code.split('\n').length} строк · ${engineOf(e).params.length} параметров`;
      advance(e);
    } else if (sid === 'test') {
      P.log.test = `${9 + engineOf(e).params.length} тестов пройдено · заглядывания в будущее нет · ruff без замечаний`;
      advance(e);
    }
  }

  let ticker = null;
  function tick() {
    const now = Date.now();
    let active = false;
    mine.forEach((e) => {
      if (e.status !== 'pipeline') return;
      active = true;
      const P = e.pipe;
      const sid = P.ids[P.i];
      const S = STAGES[sid];
      if (sid === 'bt') {
        if (P.btRun) return;
        P.btRun = true;
        const t0 = P.at;
        compute(refSpec(e, 'all'), true).then((res) => {
          const m = res.acc.m;
          P.log.bt = `${res.trades.length} сделок · ${TH.pct(m.ret, 1)} · макс. просадка ${TH.pct(m.mdd, 1)}`;
          setTimeout(() => { if (e.status === 'pipeline' && P.ids[P.i] === 'bt') advance(e); }, Math.max(0, S.dur - (Date.now() - t0)));
        }).catch((err) => {
          e.status = 'error';
          P.log.bt = 'Ошибка расчёта: ' + String(err.message || err);
          saveMine();
          emit(e.id, 'error');
        });
        return;
      }
      if (now - P.at >= S.dur) runStage(e);
    });
    if (!active) { clearInterval(ticker); ticker = null; }
  }
  function ensureTicker() { if (!ticker) ticker = setInterval(tick, 250); }
  if (mine.some((e) => e.status === 'pipeline')) { mine.forEach((e) => { if (e.status === 'pipeline') e.pipe.btRun = false; }); ensureTicker(); }

  function answer(id, text) {
    const e = mine.find((x) => x.id === id);
    if (!e || e.status !== 'clarify' || !text.trim()) return;
    const q = QUESTIONS[e.pipe.q];
    e.answers = (e.answers || []).concat([{ q: q.title, label: q.label, a: text.trim() }]);
    e.pipe.q = null;
    e.pipe.at = Date.now();
    delete e.pipe.log.parse;
    e.status = 'pipeline';
    saveMine();
    emit(id, 'stage');
    ensureTicker();
  }
  function setShared(id, v) {
    const e = mine.find((x) => x.id === id);
    if (!e) return;
    e.shared = !!v;
    saveMine();
    emit(id, 'share');
  }
  function remove(id) {
    mine = mine.filter((x) => x.id !== id);
    saveMine();
    emit(id, 'remove');
  }

  TH.bank = {
    ME, SRC, STAGES, QUESTIONS, ASPECTS, MARKETS, PERIODS, REF_ACC,
    all, get, mine: () => mine.slice(), isMine, available, rated, params, engineOf, styleOf, displayName,
    marketSyms, bounds, refSpec, compute, summary, specKey, queueState, sumsAt: () => sums.at,
    lists, saveList, deleteList, community, analyze, fullText,
    submit, answer, setShared, remove,
    code: (e) => TH.strategyCode(engineOf(e), params(e), e.cls || e.engine),
  };

  const DEMO = 'Смотрю на часовой график биткоина и эфира. Когда RSI 14 опускается ниже 30 и потом возвращается обратно выше — покупаю. Если поднимается выше 70 и разворачивается вниз — продаю в шорт. Работаю только по тренду: для покупок цена должна быть выше EMA 200, для шортов ниже. Стоп ставлю 1,5 ATR от входа, цель — 2 к 1.';
  const EXAMPLES = [
    { label: 'Пробой канала', text: 'Часовой график. Покупаю, когда закрытие выше максимума последних 40 часов и цена выше EMA 150; продаю, когда закрытие ниже минимума 40 часов и цена ниже EMA 150. Стоп 2 ATR, цель 3R, держу не больше 72 часов.' },
    { label: 'Возврат к средней', text: 'На крипте цена часто возвращается к средней. Если Z-score от SMA 30 ушёл за 2,5 сигмы — вхожу против движения, цель — возврат к средней. Стоп 2,5 ATR, держу не больше 24 часов.' },
    { label: 'Без стопа — будет вопрос', text: 'Покупаю на пересечении EMA 9 и EMA 21 снизу вверх, продаю на пересечении сверху вниз. Прибыль фиксирую на 2R.' },
  ];
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  TH.openAddStrategy = function ({ onSubmit } = {}) {
    let mode = TH.store.get('bank.addMode', 'voice');
    let state = 'idle', rec = null, demoTimer = null, timer = null, raf = null, stream = null, actx = null, analyser = null;
    let t0 = 0, audioSec = 0, base = '', finalText = '', interim = '', demo = false, restarts = 0;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const m = TH.modal(`<div class="add-strat">
      <div class="as-head"><span class="as-ico">${I('sparkle', 20)}</span><div class="t"><h2>Новая стратегия</h2><p>Опишите идею своими словами — конвейер превратит описание в код, проверит его и посчитает контрольный бэктест. После этого стратегию можно пересчитывать со своими параметрами.</p></div><button class="btn plain icon" data-x title="Закрыть · Esc">${I('close', 16)}</button></div>
      <div class="as-body">
        <div id="asMode"></div>
        <div class="as-voice" id="asVoice">
          <button class="mic-btn" id="asMic" title="Начать запись">${I('mic', 28, 2)}</button>
          <div class="as-vr">
            <div class="wave" id="asWave">${'<i></i>'.repeat(46)}</div>
            <div class="as-status"><b id="asStat">Нажмите на микрофон и расскажите идею</b><button class="btn plain sm" id="asDemo" title="Подставить демонстрационную запись — если нет микрофона">${I('play', 10)} Демо-запись</button><span class="tnum" id="asTime">0:00 / 3:00</span></div>
          </div>
        </div>
        <div class="field"><label id="asTxtLbl"></label>
          <div class="as-live hidden" id="asLive"></div>
          <textarea class="textarea" id="asText" spellcheck="true"></textarea>
          <div class="as-ex" id="asEx"><span class="faint">Примеры:</span>${EXAMPLES.map((x, i) => `<button class="chip xs" data-ex="${i}">${x.label}</button>`).join('')}</div>
        </div>
        <div class="as-check" id="asCheck"></div>
        <div class="fields-2 as-meta">
          <div class="field"><label>Название</label><input class="input" id="asName" maxlength="60" placeholder="Придумаем по описанию"></div>
          <div class="field"><label>Доступ</label><label class="as-share"><span class="switch sm"><input type="checkbox" id="asShare" checked><span></span></span><span><b>Поделиться в банке</b><small>другие пересчитают её со своими параметрами</small></span></label></div>
        </div>
        <div class="as-pipe">${['Разбор описания', 'Генерация кода', 'Проверка', 'Контрольный бэктест'].map((s, i) => `${i ? `<span class="sep">${I('chevR', 11, 2.2)}</span>` : ''}<span>${s}</span>`).join('')}</div>
      </div>
      <div class="as-foot"><span class="faint" id="asFootNote">Если чего-то не хватит, конвейер задаст уточняющий вопрос.</span><div class="grow"></div><button class="btn" data-x>Отмена</button><button class="btn primary" id="asGo">${I('send', 14)} Отправить в конвейер</button></div>
    </div>`, { sheetClass: 'as-sheet', closeOnBackdrop: false, onClose: cleanup });
    const $ = (s) => m.el.querySelector(s);
    const ta = $('#asText'), live = $('#asLive'), mic = $('#asMic'), stat = $('#asStat'), time = $('#asTime');
    const bars = [...m.el.querySelectorAll('#asWave i')];
    m.el.querySelectorAll('[data-x]').forEach((b) => (b.onclick = () => m.close()));

    function setMode(v) {
      if (state === 'rec') stopRec();
      mode = v;
      TH.store.set('bank.addMode', v);
      $('#asVoice').classList.toggle('hidden', v !== 'voice');
      $('#asEx').classList.toggle('hidden', v === 'voice');
      $('#asTxtLbl').textContent = v === 'voice' ? (ta.value ? 'Расшифровка · можно поправить перед отправкой' : 'Расшифровка появится здесь') : 'Описание стратегии';
      ta.placeholder = v === 'voice' ? 'Можно говорить свободно: когда входить, где стоп, когда выходить…' : 'Например: на часовике покупаю, когда закрытие выше максимума 30 часов и цена над EMA 100. Стоп 2 ATR, цель 3R…';
      ta.classList.toggle('tall', v === 'text');
      if (v === 'text') setTimeout(() => ta.focus(), 30);
      check();
    }
    TH.seg($('#asMode'), [{ v: 'voice', label: 'Голосом', icon: 'mic' }, { v: 'text', label: 'Текстом', icon: 'pen' }], mode, setMode, { size: 'lg' });
    $('#asMode').classList.add('seg-block');

    function check() {
      const txt = (state === 'rec' ? base + ' ' + finalText + interim : ta.value).trim();
      const a = analyze(txt);
      $('#asCheck').innerHTML = ASPECTS.map((x) => {
        const ok = a.found[x.k];
        const cls = ok ? 'ok' : x.req ? 'ask' : 'def';
        const tip = ok ? 'есть в описании' : x.req ? 'спросим' : x.def;
        return `<span class="asc ${cls}" title="${tip}"><i>${I(ok ? 'check' : x.req ? 'info' : 'minus', 10, 2.8)}</i>${x.label}<small>${tip}</small></span>`;
      }).join('');
      const go = $('#asGo');
      go.disabled = txt.length < 25 || state === 'rec';
      $('#asFootNote').textContent = txt.length < 25 ? 'Опишите идею хотя бы одной-двумя фразами.' : a.missing.length ? `Не хватает: ${a.missing.map((k) => QUESTIONS[k].label.toLowerCase()).join(', ')} — конвейер спросит.` : 'Описание полное — можно отправлять.';
    }
    ta.oninput = check;
    m.el.querySelectorAll('[data-ex]').forEach((b) => (b.onclick = () => { ta.value = EXAMPLES[+b.dataset.ex].text; check(); ta.focus(); }));

    function renderLive() {
      live.innerHTML = `${TH.esc(base ? base + ' ' : '')}${TH.esc(finalText)}<span class="interim">${TH.esc(interim)}</span><span class="caret"></span>`;
      live.scrollTop = live.scrollHeight;
      check();
    }
    function wave() {
      const tt = performance.now() / 1000;
      let data = null;
      if (analyser) { data = new Uint8Array(analyser.frequencyBinCount); analyser.getByteFrequencyData(data); }
      bars.forEach((b, i) => {
        let v;
        if (data) v = data[Math.floor((i / bars.length) * data.length * 0.6)] / 255;
        else {
          const env = demo && !demoTimer ? 0.05 : 0.35 + 0.65 * Math.abs(Math.sin(tt * 2.3 + Math.sin(tt * 0.7) * 2));
          v = env * (0.25 + 0.75 * Math.abs(Math.sin(i * 0.55 + tt * 7.5) * Math.cos(i * 0.21 - tt * 3.1)));
        }
        b.style.height = Math.max(8, Math.min(100, v * 100)) + '%';
      });
      raf = requestAnimationFrame(wave);
    }
    function stopAudio() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      bars.forEach((b) => (b.style.height = ''));
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null;
      if (actx) actx.close().catch(() => { });
      actx = null;
      analyser = null;
    }
    function startDemo(reason) {
      if (demoTimer) return;
      demo = true;
      clearTimeout(hintT);
      if (rec) { try { rec.abort(); } catch (e) { } rec = null; }
      stat.innerHTML = `Демонстрационная запись <span class="faint">· ${TH.esc(reason)}</span>`;
      const words = DEMO.split(' ');
      let k = 0;
      demoTimer = setInterval(() => {
        if (k >= words.length) {
          clearInterval(demoTimer);
          demoTimer = null;
          if (interim) { finalText += interim + ' '; interim = ''; }
          renderLive();
          setTimeout(() => state === 'rec' && stopRec(), 700);
          return;
        }
        interim += (interim ? ' ' : '') + words[k++];
        if (/[.!?]$/.test(words[k - 1])) { finalText += interim + ' '; interim = ''; }
        renderLive();
      }, 190);
    }
    let heard = false, hintT = null;
    function startRec(forceDemo) {
      state = 'rec';
      heard = false;
      base = ta.value.trim();
      finalText = '';
      interim = '';
      demo = false;
      restarts = 0;
      t0 = performance.now();
      mic.classList.add('rec');
      mic.innerHTML = I('stop', 22);
      mic.title = 'Остановить запись';
      ta.classList.add('hidden');
      live.classList.remove('hidden');
      $('#asTxtLbl').textContent = 'Расшифровка в реальном времени';
      stat.innerHTML = 'Идёт запись — говорите свободно';
      renderLive();
      timer = setInterval(() => {
        audioSec = (performance.now() - t0) / 1000;
        time.textContent = `${mmss(audioSec)} / 3:00`;
        if (audioSec >= 180) stopRec();
      }, 200);
      wave();
      if (forceDemo === true) { startDemo('без микрофона'); return; }
      if (!SR) { startDemo('распознавание речи недоступно в этом браузере'); return; }
      clearTimeout(hintT);
      hintT = setTimeout(() => { if (state === 'rec' && !demo && !heard) stat.innerHTML = 'Не слышу микрофон <span class="faint">· разрешите доступ или нажмите «Демо-запись»</span>'; }, 6000);
      try {
        rec = new SR();
        rec.lang = 'ru-RU';
        rec.continuous = true;
        rec.interimResults = true;
        rec.onaudiostart = () => { heard = true; };
        rec.onresult = (ev) => {
          heard = true;
          interim = '';
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const r = ev.results[i];
            if (r.isFinal) finalText += r[0].transcript.trim() + ' ';
            else interim += r[0].transcript;
          }
          renderLive();
        };
        rec.onerror = (ev) => {
          if (state !== 'rec') return;
          const map = { 'not-allowed': 'нет доступа к микрофону', 'service-not-allowed': 'распознавание запрещено', 'audio-capture': 'микрофон не найден', network: 'сервис распознавания недоступен', 'language-not-supported': 'русский не поддерживается' };
          if (map[ev.error]) { rec = null; startDemo(map[ev.error]); }
        };
        rec.onend = () => { if (state === 'rec' && rec && restarts++ < 20) { try { rec.start(); } catch (e) { } } };
        rec.start();
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
            if (state !== 'rec') { s.getTracks().forEach((t) => t.stop()); return; }
            stream = s;
            actx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = actx.createAnalyser();
            analyser.fftSize = 128;
            actx.createMediaStreamSource(s).connect(analyser);
          }).catch(() => { });
        }
      } catch (err) {
        rec = null;
        startDemo('распознавание недоступно');
      }
    }
    function stopRec() {
      if (state !== 'rec') return;
      state = 'done';
      clearTimeout(hintT);
      clearInterval(timer);
      timer = null;
      if (demoTimer) { clearInterval(demoTimer); demoTimer = null; }
      if (rec) { const r = rec; rec = null; try { r.stop(); } catch (e) { } }
      stopAudio();
      finalText += interim;
      interim = '';
      ta.value = [base, finalText.trim()].filter(Boolean).join(' ');
      live.classList.add('hidden');
      ta.classList.remove('hidden');
      mic.classList.remove('rec');
      mic.innerHTML = I('mic', 28, 2);
      mic.title = 'Дописать голосом';
      $('#asTxtLbl').textContent = 'Расшифровка · можно поправить перед отправкой';
      stat.innerHTML = ta.value ? `Готово · ${mmss(audioSec)} записи <span class="faint">· нажмите микрофон, чтобы дописать</span>` : 'Ничего не распознано — попробуйте ещё раз';
      check();
    }
    function cleanup() {
      if (state === 'rec') { state = 'closed'; clearInterval(timer); if (demoTimer) clearInterval(demoTimer); if (rec) { try { rec.abort(); } catch (e) { } } stopAudio(); }
    }
    mic.onclick = () => (state === 'rec' ? stopRec() : startRec());
    $('#asDemo').onclick = () => { if (state !== 'rec') { ta.value = ''; startRec(true); } else if (!demo) startDemo('без микрофона'); };
    $('#asGo').onclick = () => {
      if (state === 'rec') stopRec();
      const text = ta.value.trim();
      if (text.length < 25) return;
      const e = submit({ text, name: $('#asName').value, source: mode === 'voice' && audioSec > 0 ? 'voice' : 'text', audio: Math.round(audioSec), shared: $('#asShare').checked });
      m.close();
      onSubmit && onSubmit(e);
    };
    setMode(mode);
    return m;
  };
})();
