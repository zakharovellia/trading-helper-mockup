(function () {
  const TH = window.TH;
  const gauss = TH.gauss;

  const EXCHANGES = {
    finam: {
      id: 'finam', name: 'Finam', full: 'Finam Trade API', market: 'MOEX', cur: '₽', curDp: 0,
      tz: 'MSK', tzOffset: 3, sessStart: 600, sessEnd: 1130, weekdays: true,
      commission: 0.04, marginRate: 0.25, ann: 252, days: 240, accountLabel: 'Счёт 1899011',
    },
    hyperliquid: {
      id: 'hyperliquid', name: 'Hyperliquid', full: 'Hyperliquid API', market: 'Perps', cur: '$', curDp: 2,
      tz: 'UTC', tzOffset: 0, sessStart: 0, sessEnd: 1440, weekdays: false,
      commission: 0.035, marginRate: 0.1, ann: 365, days: 200, accountLabel: '0xDEMO…demo',
    },
  };

  const LIST = [
    { sym: 'SBER', name: 'Сбербанк', exch: 'finam', price: 312.45, vol: 0.017, tick: 0.01, dp: 2, lot: 10, vbase: 42000 },
    { sym: 'GAZP', name: 'Газпром', exch: 'finam', price: 131.2, vol: 0.021, tick: 0.01, dp: 2, lot: 10, vbase: 38000 },
    { sym: 'LKOH', name: 'Лукойл', exch: 'finam', price: 6912, vol: 0.014, tick: 0.5, dp: 1, lot: 1, vbase: 2200 },
    { sym: 'YDEX', name: 'Яндекс', exch: 'finam', price: 4186, vol: 0.02, tick: 0.5, dp: 1, lot: 1, vbase: 3100 },
    { sym: 'Si-6.26', name: 'Фьючерс USD/RUB', exch: 'finam', price: 84250, vol: 0.007, tick: 1, dp: 0, lot: 1, vbase: 9000 },
    { sym: 'BTC', name: 'Bitcoin · Perp', exch: 'hyperliquid', price: 97340, vol: 0.028, tick: 1, dp: 0, lot: 0.001, vbase: 180 },
    { sym: 'ETH', name: 'Ethereum · Perp', exch: 'hyperliquid', price: 3412.5, vol: 0.034, tick: 0.1, dp: 1, lot: 0.01, vbase: 2400 },
    { sym: 'SOL', name: 'Solana · Perp', exch: 'hyperliquid', price: 186.42, vol: 0.045, tick: 0.01, dp: 2, lot: 0.1, vbase: 26000 },
    { sym: 'HYPE', name: 'Hyperliquid · Perp', exch: 'hyperliquid', price: 24.815, vol: 0.055, tick: 0.001, dp: 3, lot: 0.1, vbase: 140000 },
  ];
  const BY = {};
  LIST.forEach((i) => (BY[i.sym] = i));

  function nowFake(ex) {
    return Math.floor(Date.now() / 1000) + ex.tzOffset * 3600;
  }

  function tradingDays(ex, n) {
    const today = Math.floor(nowFake(ex) / 86400) * 86400;
    const out = [];
    let t = today - 86400;
    while (out.length < n) {
      const wd = new Date(t * 1000).getUTCDay();
      if (!ex.weekdays || (wd !== 0 && wd !== 6)) out.push(t);
      t -= 86400;
    }
    return out.reverse();
  }

  function simDay(inst, ex, dayTs, m, want) {
    const r = TH.rng(m.seed);
    const n = ex.sessEnd - ex.sessStart;
    const sig = (inst.vol * m.volMult) / Math.sqrt(n);
    const mu = m.drift / n;
    let lp = m.lp0;
    let dH = -Infinity, dL = Infinity, dV = 0;
    const hours = [];
    let cur = null;
    const mins = want ? new Array(n) : null;
    for (let k = 0; k < n; k++) {
      const mod = ex.sessStart + k;
      const x = k / (n - 1);
      let shape;
      if (ex.weekdays) shape = 0.6 + 1.3 * Math.pow(1 - x, 10) + 0.55 * Math.pow(x, 8) + (k < 10 ? 0.7 : 0);
      else {
        const hh = mod / 60;
        shape = 0.72 + 0.6 * Math.exp(-((hh - 15) ** 2) / 6) + 0.25 * Math.exp(-((hh - 8) ** 2) / 4);
      }
      let z = gauss(r);
      if (r() < 0.003) z *= 3.5;
      const o = lp;
      lp += mu + sig * shape * z;
      const c = lp;
      const w = sig * shape * 0.55;
      const hi = Math.max(o, c) + Math.abs(gauss(r)) * w;
      const lo = Math.min(o, c) - Math.abs(gauss(r)) * w;
      const v = Math.max(1, Math.round(inst.vbase * shape * shape * (0.55 + 0.45 * Math.abs(z)) * (0.6 + 0.8 * r()) * m.volMult));
      if (hi > dH) dH = hi;
      if (lo < dL) dL = lo;
      dV += v;
      const hr = Math.floor(mod / 60);
      if (!cur || cur.hr !== hr) {
        cur = { hr, o, h: hi, l: lo, c, v };
        hours.push(cur);
      } else {
        if (hi > cur.h) cur.h = hi;
        if (lo < cur.l) cur.l = lo;
        cur.c = c;
        cur.v += v;
      }
      if (want) mins[k] = { t: dayTs + mod * 60, o, h: hi, l: lo, c, v };
    }
    return { o: m.lp0, h: dH, l: dL, c: lp, v: dV, hours, mins };
  }

  const hcache = {};
  function history(sym) {
    if (hcache[sym]) return hcache[sym];
    const inst = BY[sym];
    const ex = EXCHANGES[inst.exch];
    const days = tradingDays(ex, ex.days);
    const r = TH.rng(TH.hash('h:' + sym));
    let lp = 0, trend = 0, lv = 0;
    const meta = [], raw = [];
    for (let d = 0; d < days.length; d++) {
      trend = 0.955 * trend + 0.075 * gauss(r) * inst.vol;
      lv = 0.88 * lv + 0.13 * gauss(r);
      const volMult = Math.exp(lv) * (r() < 0.04 ? 1.9 : 1);
      if (d > 0 && ex.weekdays) lp += gauss(r) * inst.vol * 0.22;
      const m = { seed: TH.hash(sym + '#' + d), lp0: lp, drift: trend, volMult };
      const s = simDay(inst, ex, days[d], m, false);
      meta.push(m);
      raw.push(s);
      lp = s.c;
    }
    const F = inst.price / Math.exp(lp);
    const tick = inst.tick, dp = inst.dp;
    const P = (v) => +(Math.round((Math.exp(v) * F) / tick) * tick).toFixed(dp);
    const D = [], H = [], hourDay = [], dayH0 = [];
    raw.forEach((s, d) => {
      D.push({ time: days[d], open: P(s.o), high: P(s.h), low: P(s.l), close: P(s.c), volume: s.v });
      dayH0.push(H.length);
      s.hours.forEach((hh) => {
        H.push({ time: days[d] + hh.hr * 3600, open: P(hh.o), high: P(hh.h), low: P(hh.l), close: P(hh.c), volume: hh.v });
        hourDay.push(d);
      });
    });
    dayH0.push(H.length);
    const h = { sym, inst, ex, days, D, H, hourDay, dayH0, meta, P };
    hcache[sym] = h;
    return h;
  }

  function aggregate(bars, sec) {
    const out = [];
    let cur = null;
    for (const b of bars) {
      const t = Math.floor(b.time / sec) * sec;
      if (!cur || cur.time !== t) {
        cur = { time: t, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume };
        out.push(cur);
      } else {
        if (b.high > cur.high) cur.high = b.high;
        if (b.low < cur.low) cur.low = b.low;
        cur.close = b.close;
        cur.volume += b.volume;
      }
    }
    return out;
  }

  const mcache = new Map();
  function minutes(sym, d, tf = 1) {
    const key = sym + ':' + d + ':' + tf;
    if (mcache.has(key)) {
      const v = mcache.get(key);
      mcache.delete(key);
      mcache.set(key, v);
      return v;
    }
    let bars;
    if (tf === 1) {
      const H = history(sym);
      const s = simDay(H.inst, H.ex, H.days[d], H.meta[d], true);
      const P = H.P;
      bars = s.mins.map((m) => ({ time: m.t, open: P(m.o), high: P(m.h), low: P(m.l), close: P(m.c), volume: m.v }));
    } else {
      bars = aggregate(minutes(sym, d, 1), tf * 60);
    }
    mcache.set(key, bars);
    if (mcache.size > 260) mcache.delete(mcache.keys().next().value);
    return bars;
  }

  function dayIndexOf(H, t) {
    const D = H.days;
    let lo = 0, hi = D.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (D[mid] <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  }

  function liveSeries(sym) {
    const H = history(sym);
    const inst = H.inst, ex = H.ex;
    const now = nowFake(ex);
    const end = Math.floor(now / 60) * 60;
    const today = Math.floor(now / 86400) * 86400;
    const start = Math.max(today, Math.min(today + ex.sessStart * 60, end - 119 * 60));
    const count = Math.floor((end - start) / 60) + 1;
    const r = TH.rng(TH.hash('live:' + sym + ':' + Math.floor(now / 86400)));
    const sig = (inst.vol * 1.1) / Math.sqrt(ex.sessEnd - ex.sessStart);
    let lp = Math.log(H.D[H.D.length - 1].close);
    const tick = inst.tick, dp = inst.dp;
    const P = (v) => +(Math.round(Math.exp(v) / tick) * tick).toFixed(dp);
    const bars = [];
    for (let k = count - 1; k >= 0; k--) {
      const t = end - k * 60;
      const o = lp;
      lp += sig * gauss(r);
      const hi = Math.max(o, lp) + Math.abs(gauss(r)) * sig * 0.5;
      const lo = Math.min(o, lp) - Math.abs(gauss(r)) * sig * 0.5;
      bars.push({ time: t, open: P(o), high: P(hi), low: P(lo), close: P(lp), volume: Math.round(inst.vbase * (0.5 + r())) });
    }
    return { bars, sig, P };
  }

  function bucket(bars, sec) {
    const n = bars.length;
    if (!n) return null;
    const t = Math.floor(bars[n - 1].time / sec) * sec;
    let i = n - 1;
    while (i > 0 && bars[i - 1].time >= t) i--;
    const b0 = bars[i];
    const out = { time: t, open: b0.open, high: b0.high, low: b0.low, close: bars[n - 1].close, volume: 0 };
    for (let k = i; k < n; k++) {
      const b = bars[k];
      if (b.high > out.high) out.high = b.high;
      if (b.low < out.low) out.low = b.low;
      out.volume += b.volume;
    }
    return out;
  }

  TH.data = {
    EXCHANGES,
    LIST,
    inst: (sym) => BY[sym],
    ex: (id) => EXCHANGES[id],
    ids: Object.keys(EXCHANGES),
    exOf: (sym) => EXCHANGES[BY[sym].exch],
    list: (exch) => LIST.filter((i) => i.exch === exch),
    history,
    minutes,
    aggregate,
    bucket,
    dayIndexOf,
    nowFake,
    liveSeries,
    roundTick: (inst, v) => +(Math.round(v / inst.tick) * inst.tick).toFixed(inst.dp),
    fp: (inst, v) => TH.fmt(v, inst.dp),
  };

  const ind = {};
  ind.sma = (a, n) => {
    const out = new Array(a.length).fill(null);
    let s = 0;
    for (let i = 0; i < a.length; i++) {
      s += a[i];
      if (i >= n) s -= a[i - n];
      if (i >= n - 1) out[i] = s / n;
    }
    return out;
  };
  ind.ema = (a, n) => {
    const out = new Array(a.length).fill(null);
    const k = 2 / (n + 1);
    let e = null;
    for (let i = 0; i < a.length; i++) {
      e = e == null ? a[i] : a[i] * k + e * (1 - k);
      if (i >= n - 1) out[i] = e;
    }
    return out;
  };
  ind.std = (a, n) => {
    const out = new Array(a.length).fill(null);
    let s = 0, q = 0;
    for (let i = 0; i < a.length; i++) {
      s += a[i];
      q += a[i] * a[i];
      if (i >= n) { s -= a[i - n]; q -= a[i - n] * a[i - n]; }
      if (i >= n - 1) {
        const m = s / n;
        out[i] = Math.sqrt(Math.max(0, q / n - m * m));
      }
    }
    return out;
  };
  ind.atr = (bars, n) => {
    const out = new Array(bars.length).fill(null);
    let prev = null, acc = 0, v = null;
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      const tr = prev == null ? b.high - b.low : Math.max(b.high - b.low, Math.abs(b.high - prev), Math.abs(b.low - prev));
      prev = b.close;
      if (i < n) {
        acc += tr;
        if (i === n - 1) { v = acc / n; out[i] = v; }
      } else {
        v = (v * (n - 1) + tr) / n;
        out[i] = v;
      }
    }
    return out;
  };
  ind.bb = (a, n, k) => {
    const m = ind.sma(a, n), s = ind.std(a, n);
    return { mid: m, up: m.map((v, i) => (v == null ? null : v + k * s[i])), lo: m.map((v, i) => (v == null ? null : v - k * s[i])) };
  };
  ind.rsi = (a, n) => {
    const out = new Array(a.length).fill(null);
    let g = 0, l = 0;
    const val = () => (l === 0 ? 100 : 100 - 100 / (1 + g / l));
    for (let i = 1; i < a.length; i++) {
      const d = a[i] - a[i - 1];
      const up = d > 0 ? d : 0, dn = d < 0 ? -d : 0;
      if (i <= n) {
        g += up;
        l += dn;
        if (i === n) { g /= n; l /= n; out[i] = val(); }
      } else {
        g = (g * (n - 1) + up) / n;
        l = (l * (n - 1) + dn) / n;
        out[i] = val();
      }
    }
    return out;
  };
  ind.vwap = (bars) => {
    const out = new Array(bars.length).fill(null);
    let day = null, pv = 0, vv = 0;
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      const d = Math.floor(b.time / 86400);
      if (d !== day) { day = d; pv = 0; vv = 0; }
      const tp = (b.high + b.low + b.close) / 3;
      pv += tp * b.volume;
      vv += b.volume;
      out[i] = vv ? pv / vv : null;
    }
    return out;
  };
  ind.donchian = (bars, n) => {
    const up = new Array(bars.length).fill(null), lo = new Array(bars.length).fill(null);
    for (let i = n; i < bars.length; i++) {
      let h = -Infinity, l = Infinity;
      for (let j = i - n; j < i; j++) {
        if (bars[j].high > h) h = bars[j].high;
        if (bars[j].low < l) l = bars[j].low;
      }
      up[i] = h;
      lo[i] = l;
    }
    return { up, lo };
  };
  TH.ind = ind;

  TH.INDICATORS = [
    { id: 'ema9', name: 'EMA 9', desc: 'Экспоненциальная средняя', color: '#64D2FF' },
    { id: 'ema21', name: 'EMA 21', desc: 'Экспоненциальная средняя', color: '#BF5AF2' },
    { id: 'sma50', name: 'SMA 50', desc: 'Простая средняя', color: '#FF9F0A' },
    { id: 'sma200', name: 'SMA 200', desc: 'Простая средняя', color: '#FFD60A' },
    { id: 'bb', name: 'Bollinger 20, 2', desc: 'Полосы волатильности', color: 'rgba(235,235,245,.55)' },
    { id: 'vwap', name: 'VWAP', desc: 'Средневзвешенная по объёму · только внутри дня', color: '#FF375F' },
    { id: 'volume', name: 'Объём', desc: 'Гистограмма под графиком', color: 'rgba(120,120,128,.8)' },
  ];

  TH.buildIndicatorLines = function (bars, cfg, tf) {
    const c = bars.map((b) => b.close);
    const L = [];
    if (cfg.ema9) L.push({ name: 'EMA 9', data: ind.ema(c, 9), color: '#64D2FF' });
    if (cfg.ema21) L.push({ name: 'EMA 21', data: ind.ema(c, 21), color: '#BF5AF2' });
    if (cfg.sma50) L.push({ name: 'SMA 50', data: ind.sma(c, 50), color: '#FF9F0A' });
    if (cfg.sma200) L.push({ name: 'SMA 200', data: ind.sma(c, 200), color: '#FFD60A' });
    if (cfg.bb) {
      const b = ind.bb(c, 20, 2);
      L.push({ name: 'BB ↑', data: b.up, color: 'rgba(235,235,245,.42)', style: 2, legend: false });
      L.push({ name: 'BB 20', data: b.mid, color: 'rgba(235,235,245,.30)', width: 1 });
      L.push({ name: 'BB ↓', data: b.lo, color: 'rgba(235,235,245,.42)', style: 2, legend: false });
    }
    if (cfg.vwap && tf !== 'D') L.push({ name: 'VWAP', data: ind.vwap(bars), color: '#FF375F', width: 2 });
    return L;
  };
})();
