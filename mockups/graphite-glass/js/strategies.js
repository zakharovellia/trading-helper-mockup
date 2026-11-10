(function () {
  const TH = window.TH;
  const ind = TH.ind;
  const closes = (b) => b.map((x) => x.close);
  const n1 = (v) => TH.fmt(v, Number.isInteger(v) ? 0 : 1);
  const STOP = (p) => ['Стоп-лосс', `${n1(p.sl)} × ATR ${p.atr} от цены входа`];
  const TARGET = (p) => ['Цель', `${n1(p.rr)} R — ${n1(p.rr)} размера стопа от цены входа`];
  const HOLD = (p) => ['Выход по времени', `через ${p.hold} часовых баров, если не сработали стоп или цель`];
  const EXEC = ['Исполнение', 'сигнал на закрытии часового бара, вход по открытию следующего; стоп и цель проверяются по минутным барам'];

  const STRATEGIES = [
    {
      id: 'EmaCrossover',
      name: 'EMA Crossover',
      style: 'trend',
      desc: 'Пересечение быстрой и медленной EMA на часовом таймфрейме. Стоп — кратный ATR, цель — кратная риску (R).',
      params: [
        { k: 'fast', label: 'Быстрая EMA', def: 9, min: 2, max: 100, step: 1 },
        { k: 'slow', label: 'Медленная EMA', def: 21, min: 3, max: 300, step: 1 },
        { k: 'atr', label: 'Период ATR', def: 14, min: 2, max: 100, step: 1 },
        { k: 'sl', label: 'Стоп, × ATR', def: 1.5, min: 0.3, max: 10, step: 0.1 },
        { k: 'rr', label: 'Цель, R', def: 2, min: 0.5, max: 10, step: 0.1 },
        { k: 'hold', label: 'Макс. удержание, бар', def: 30, min: 1, max: 500, step: 1 },
      ],
      prepare(b, p) {
        const c = closes(b);
        return { fast: ind.ema(c, p.fast), slow: ind.ema(c, p.slow), atr: ind.atr(b, p.atr) };
      },
      lines(x, p) {
        return [
          { name: `EMA ${p.fast}`, data: x.fast, color: '#64D2FF', width: 2 },
          { name: `EMA ${p.slow}`, data: x.slow, color: '#BF5AF2', width: 2 },
        ];
      },
      rules: (p) => [
        ['Вход long', `EMA ${p.fast} пересекает EMA ${p.slow} снизу вверх`],
        ['Вход short', `EMA ${p.fast} пересекает EMA ${p.slow} сверху вниз`],
        STOP(p), TARGET(p), HOLD(p), EXEC,
      ],
      code: () => ({
        prep: ['self.fast = ema(bars.close, self.p.fast)', 'self.slow = ema(bars.close, self.p.slow)', 'self.atr = atr(bars, self.p.atr)'],
        entry: ['stop = self.atr[i] * self.p.sl', 'if crossed_above(self.fast, self.slow, i):', '    return Signal.long(stop=stop, rr=self.p.rr)', 'if crossed_below(self.fast, self.slow, i):', '    return Signal.short(stop=stop, rr=self.p.rr)', 'return None'],
      }),
      entry(i, b, x, p, ctx) {
        const f = x.fast, s = x.slow, a = x.atr;
        if (i < 1 || f[i - 1] == null || s[i - 1] == null || a[i] == null) return null;
        const up = f[i - 1] <= s[i - 1] && f[i] > s[i];
        const dn = f[i - 1] >= s[i - 1] && f[i] < s[i];
        if (!up && !dn) return null;
        const dir = up ? 1 : -1;
        const sd = a[i] * p.sl;
        return {
          dir, stopDist: sd, rr: p.rr,
          checks: [
            { label: `EMA ${p.fast} пересекла EMA ${p.slow} ${up ? 'снизу вверх' : 'сверху вниз'}`, value: `${ctx.f(f[i])} ${up ? '>' : '<'} ${ctx.f(s[i])}` },
            { label: `На предыдущем баре EMA ${p.fast} ${up ? '≤' : '≥'} EMA ${p.slow}`, value: `${ctx.f(f[i - 1])} / ${ctx.f(s[i - 1])}` },
            { label: `ATR ${p.atr} на баре сигнала`, value: ctx.f(a[i]), info: true },
            { label: `Стоп = ${p.sl} × ATR`, value: ctx.f(sd), info: true },
            { label: `Цель = ${p.rr} R`, value: ctx.f(sd * p.rr), info: true },
          ],
        };
      },
    },
    {
      id: 'MeanReversionZScore',
      name: 'Mean Reversion Z-Score',
      style: 'meanrev',
      desc: 'Возврат к среднему: вход против движения, когда Z-score выходит за порог; выход при возврате Z к нулю или по стопу.',
      params: [
        { k: 'n', label: 'Окно SMA / σ', def: 20, min: 5, max: 200, step: 1 },
        { k: 'zIn', label: 'Порог входа |Z|', def: 2.0, min: 0.5, max: 5, step: 0.1 },
        { k: 'zOut', label: 'Порог выхода |Z|', def: 0.2, min: 0, max: 2, step: 0.1 },
        { k: 'atr', label: 'Период ATR', def: 14, min: 2, max: 100, step: 1 },
        { k: 'sl', label: 'Стоп, × ATR', def: 2.0, min: 0.3, max: 10, step: 0.1 },
        { k: 'hold', label: 'Макс. удержание, бар', def: 24, min: 1, max: 500, step: 1 },
      ],
      prepare(b, p) {
        const c = closes(b);
        const mid = ind.sma(c, p.n), sd = ind.std(c, p.n);
        const z = c.map((v, i) => (sd[i] ? (v - mid[i]) / sd[i] : null));
        return { mid, sd, z, atr: ind.atr(b, p.atr), up: mid.map((m, i) => (m == null ? null : m + p.zIn * sd[i])), lo: mid.map((m, i) => (m == null ? null : m - p.zIn * sd[i])) };
      },
      lines(x, p) {
        return [
          { name: `SMA ${p.n}`, data: x.mid, color: '#FFD60A', width: 2 },
          { name: `+${p.zIn}σ`, data: x.up, color: 'rgba(100,210,255,.8)', style: 2 },
          { name: `−${p.zIn}σ`, data: x.lo, color: 'rgba(100,210,255,.8)', style: 2 },
        ];
      },
      rules: (p) => [
        ['Вход long', `Z-score цены относительно SMA ${p.n} опускается до −${n1(p.zIn)} и ниже`],
        ['Вход short', `Z-score поднимается до +${n1(p.zIn)} и выше`],
        STOP(p),
        ['Цель', `возврат цены к SMA ${p.n} на баре сигнала`],
        ['Выход по сигналу', `|Z| вернулся к ${n1(p.zOut)}`],
        HOLD(p), EXEC,
      ],
      code: () => ({
        prep: ['self.mid = sma(bars.close, self.p.n)', 'self.z = (bars.close - self.mid) / stdev(bars.close, self.p.n)', 'self.atr = atr(bars, self.p.atr)'],
        entry: ['stop = self.atr[i] * self.p.sl', 'if crossed_below(self.z, -self.p.z_in, i):', '    return Signal.long(stop=stop, target=self.mid[i])', 'if crossed_above(self.z, self.p.z_in, i):', '    return Signal.short(stop=stop, target=self.mid[i])', 'return None'],
        exit: ['if pos.is_long and self.z[i] >= -self.p.z_out:', '    return "signal"', 'if pos.is_short and self.z[i] <= self.p.z_out:', '    return "signal"', 'return None'],
      }),
      entry(i, b, x, p, ctx) {
        const z = x.z;
        if (i < 1 || z[i - 1] == null || z[i] == null || x.atr[i] == null) return null;
        let dir = 0;
        if (z[i - 1] > -p.zIn && z[i] <= -p.zIn) dir = 1;
        else if (z[i - 1] < p.zIn && z[i] >= p.zIn) dir = -1;
        if (!dir) return null;
        const sd = x.atr[i] * p.sl;
        return {
          dir, stopDist: sd, tpPrice: x.mid[i],
          checks: [
            { label: `Z-score (${p.n}) ${dir > 0 ? 'пробил −' + p.zIn + ' вниз' : 'пробил +' + p.zIn + ' вверх'}`, value: `Z = ${TH.fmt(z[i], 2)} (пред. ${TH.fmt(z[i - 1], 2)})` },
            { label: `Среднее SMA ${p.n}`, value: ctx.f(x.mid[i]), info: true },
            { label: 'Стандартное отклонение σ', value: ctx.f(x.sd[i]), info: true },
            { label: `Стоп = ${p.sl} × ATR ${p.atr}`, value: ctx.f(sd), info: true },
            { label: 'Цель — возврат к SMA', value: ctx.f(x.mid[i]), info: true },
          ],
        };
      },
      exit(i, b, x, p, pos) {
        const z = x.z[i];
        if (z == null) return null;
        if (pos.dir > 0 && z >= -p.zOut) return 'signal';
        if (pos.dir < 0 && z <= p.zOut) return 'signal';
        return null;
      },
    },
    {
      id: 'DonchianBreakout',
      name: 'Donchian Breakout',
      style: 'breakout',
      desc: 'Пробой канала Дончиана на часовом таймфрейме с фильтром тренда по EMA. Стоп по ATR, цель — кратная риску.',
      params: [
        { k: 'n', label: 'Канал, баров', def: 40, min: 5, max: 300, step: 1 },
        { k: 'trend', label: 'EMA тренда', def: 100, min: 10, max: 400, step: 1 },
        { k: 'atr', label: 'Период ATR', def: 14, min: 2, max: 100, step: 1 },
        { k: 'sl', label: 'Стоп, × ATR', def: 2.0, min: 0.3, max: 10, step: 0.1 },
        { k: 'rr', label: 'Цель, R', def: 3, min: 0.5, max: 10, step: 0.1 },
        { k: 'hold', label: 'Макс. удержание, бар', def: 60, min: 1, max: 500, step: 1 },
      ],
      prepare(b, p) {
        const c = closes(b);
        const dc = ind.donchian(b, p.n);
        return { up: dc.up, lo: dc.lo, ema: ind.ema(c, p.trend), atr: ind.atr(b, p.atr) };
      },
      lines(x, p) {
        return [
          { name: `Donchian ${p.n} ↑`, data: x.up, color: '#66D4CF', step: true },
          { name: `Donchian ${p.n} ↓`, data: x.lo, color: '#FF375F', step: true },
          { name: `EMA ${p.trend}`, data: x.ema, color: '#BF5AF2', width: 2 },
        ];
      },
      rules: (p) => [
        ['Вход long', `закрытие выше максимума последних ${p.n} баров при цене выше EMA ${p.trend}`],
        ['Вход short', `закрытие ниже минимума последних ${p.n} баров при цене ниже EMA ${p.trend}`],
        STOP(p), TARGET(p), HOLD(p), EXEC,
      ],
      code: () => ({
        prep: ['self.up, self.lo = donchian(bars, self.p.n)', 'self.trend = ema(bars.close, self.p.trend)', 'self.atr = atr(bars, self.p.atr)'],
        entry: ['c, stop = self.close[i], self.atr[i] * self.p.sl', 'if crossed_above(self.close, self.up, i) and c > self.trend[i]:', '    return Signal.long(stop=stop, rr=self.p.rr)', 'if crossed_below(self.close, self.lo, i) and c < self.trend[i]:', '    return Signal.short(stop=stop, rr=self.p.rr)', 'return None'],
      }),
      entry(i, b, x, p, ctx) {
        if (i < 1 || x.up[i] == null || x.up[i - 1] == null || x.ema[i] == null || x.atr[i] == null) return null;
        const c = b[i].close, pc = b[i - 1].close;
        let dir = 0;
        if (c > x.up[i] && pc <= x.up[i - 1] && c > x.ema[i]) dir = 1;
        else if (c < x.lo[i] && pc >= x.lo[i - 1] && c < x.ema[i]) dir = -1;
        if (!dir) return null;
        const sd = x.atr[i] * p.sl;
        return {
          dir, stopDist: sd, rr: p.rr,
          checks: [
            { label: `Закрытие ${dir > 0 ? 'выше максимума' : 'ниже минимума'} ${p.n} баров`, value: `${ctx.f(c)} ${dir > 0 ? '>' : '<'} ${ctx.f(dir > 0 ? x.up[i] : x.lo[i])}` },
            { label: `Фильтр тренда: цена ${dir > 0 ? 'выше' : 'ниже'} EMA ${p.trend}`, value: `${ctx.f(c)} ${dir > 0 ? '>' : '<'} ${ctx.f(x.ema[i])}` },
            { label: `ATR ${p.atr}`, value: ctx.f(x.atr[i]), info: true },
            { label: `Стоп = ${p.sl} × ATR`, value: ctx.f(sd), info: true },
            { label: `Цель = ${p.rr} R`, value: ctx.f(sd * p.rr), info: true },
          ],
        };
      },
    },
    {
      id: 'OpeningRangeBreakout',
      name: 'Opening Range Breakout',
      style: 'intraday',
      desc: 'Пробой диапазона первого часа сессии. Стоп — противоположная граница диапазона, принудительный выход в конце сессии.',
      intraday: true,
      params: [
        { k: 'rr', label: 'Цель, R', def: 1.5, min: 0.3, max: 10, step: 0.1 },
        { k: 'minAtr', label: 'Мин. ширина, × ATR', def: 0.4, min: 0, max: 5, step: 0.1 },
        { k: 'atr', label: 'Период ATR', def: 14, min: 2, max: 100, step: 1 },
        { k: 'hold', label: 'Макс. удержание, бар', def: 24, min: 1, max: 500, step: 1 },
      ],
      prepare(b, p, { dayOf }) {
        const orH = new Array(b.length).fill(null), orL = new Array(b.length).fill(null), first = new Array(b.length).fill(false);
        let h = null, l = null;
        for (let i = 0; i < b.length; i++) {
          if (i === 0 || dayOf[i] !== dayOf[i - 1]) { first[i] = true; h = b[i].high; l = b[i].low; continue; }
          orH[i] = h;
          orL[i] = l;
        }
        return { orH, orL, first, atr: ind.atr(b, p.atr) };
      },
      lines(x) {
        return [
          { name: 'OR high', data: x.orH, color: '#4CE07F', style: 2, step: true },
          { name: 'OR low', data: x.orL, color: '#FF6B61', style: 2, step: true },
        ];
      },
      rules: (p) => [
        ['Диапазон', 'максимум и минимум первого часа сессии'],
        ['Вход long', 'закрытие часа выше верхней границы диапазона, один вход за сессию'],
        ['Вход short', 'закрытие часа ниже нижней границы диапазона'],
        ['Фильтр', `ширина диапазона не меньше ${n1(p.minAtr)} × ATR ${p.atr}`],
        ['Стоп-лосс', 'противоположная граница диапазона'],
        TARGET(p),
        ['Выход по времени', 'принудительно на последнем часе сессии'],
        EXEC,
      ],
      code: () => ({
        prep: ['self.or_high, self.or_low = opening_range(bars, minutes=60)', 'self.atr = atr(bars, self.p.atr)'],
        entry: ['if self.traded_today(i) or self.width(i) < self.p.min_atr * self.atr[i]:', '    return None', 'if self.close[i] > self.or_high[i]:', '    return Signal.long(stop_price=self.or_low[i], rr=self.p.rr)', 'if self.close[i] < self.or_low[i]:', '    return Signal.short(stop_price=self.or_high[i], rr=self.p.rr)', 'return None'],
        exit: ['return "eod" if self.is_last_bar_of_session(i) else None'],
      }),
      entry(i, b, x, p, ctx, dayOf) {
        if (x.first[i] || x.orH[i] == null || x.atr[i] == null) return null;
        if (ctx.tradedDay === dayOf[i]) return null;
        if (i + 1 >= b.length || dayOf[i + 1] !== dayOf[i]) return null;
        const c = b[i].close, rg = x.orH[i] - x.orL[i];
        let dir = 0;
        if (c > x.orH[i]) dir = 1;
        else if (c < x.orL[i]) dir = -1;
        if (!dir) return null;
        if (rg < p.minAtr * x.atr[i]) return null;
        ctx.tradedDay = dayOf[i];
        return {
          dir, stopPrice: dir > 0 ? x.orL[i] : x.orH[i], rr: p.rr,
          checks: [
            { label: 'Диапазон первого часа сессии', value: `${ctx.f(x.orL[i])} — ${ctx.f(x.orH[i])}` },
            { label: `Закрытие часа ${dir > 0 ? 'выше верхней' : 'ниже нижней'} границы`, value: `${ctx.f(c)} ${dir > 0 ? '>' : '<'} ${ctx.f(dir > 0 ? x.orH[i] : x.orL[i])}` },
            { label: `Ширина диапазона ≥ ${p.minAtr} × ATR`, value: `${ctx.f(rg)} ≥ ${ctx.f(p.minAtr * x.atr[i])}` },
            { label: 'Первый пробой за сессию', value: 'да' },
            { label: 'Стоп — противоположная граница', value: ctx.f(dir > 0 ? x.orL[i] : x.orH[i]), info: true },
            { label: 'Принудительный выход в конце сессии', value: 'включён', info: true },
          ],
        };
      },
      exit(i, b, x, p, pos, { lastOfDay }) { return lastOfDay ? 'eod' : null; },
    },
    {
      id: 'RsiReversal',
      name: 'RSI Reversal',
      style: 'meanrev',
      desc: 'Разворот от зон перекупленности и перепроданности RSI с необязательным фильтром тренда по EMA. Стоп по ATR, выход по цели или при достижении противоположной зоны.',
      params: [
        { k: 'n', label: 'Период RSI', def: 14, min: 2, max: 100, step: 1 },
        { k: 'lo', label: 'Перепроданность', def: 30, min: 5, max: 50, step: 1 },
        { k: 'hi', label: 'Перекупленность', def: 70, min: 50, max: 95, step: 1 },
        { k: 'trend', label: 'EMA тренда, 0 — выкл.', def: 0, min: 0, max: 400, step: 1 },
        { k: 'atr', label: 'Период ATR', def: 14, min: 2, max: 100, step: 1 },
        { k: 'sl', label: 'Стоп, × ATR', def: 1.5, min: 0.3, max: 10, step: 0.1 },
        { k: 'rr', label: 'Цель, R', def: 2, min: 0.5, max: 10, step: 0.1 },
        { k: 'hold', label: 'Макс. удержание, бар', def: 24, min: 1, max: 500, step: 1 },
      ],
      prepare(b, p) {
        const c = closes(b);
        return { rsi: ind.rsi(c, p.n), ema: p.trend ? ind.ema(c, p.trend) : null, atr: ind.atr(b, p.atr) };
      },
      lines(x, p) {
        return x.ema ? [{ name: `EMA ${p.trend}`, data: x.ema, color: '#BF5AF2', width: 2 }] : [];
      },
      rules: (p) => [
        ['Вход long', `RSI ${p.n} возвращается выше ${p.lo} из зоны перепроданности${p.trend ? `, цена выше EMA ${p.trend}` : ''}`],
        ['Вход short', `RSI ${p.n} опускается ниже ${p.hi} из зоны перекупленности${p.trend ? `, цена ниже EMA ${p.trend}` : ''}`],
        STOP(p), TARGET(p),
        ['Выход по сигналу', `RSI дошёл до противоположной зоны: ${p.hi} для long, ${p.lo} для short`],
        HOLD(p), EXEC,
      ],
      code: (p) => ({
        prep: ['self.rsi = rsi(bars.close, self.p.n)', ...(p.trend ? ['self.trend = ema(bars.close, self.p.trend)'] : []), 'self.atr = atr(bars, self.p.atr)'],
        entry: ['stop = self.atr[i] * self.p.sl', `if crossed_above(self.rsi, self.p.lo, i)${p.trend ? ' and self.close[i] > self.trend[i]' : ''}:`, '    return Signal.long(stop=stop, rr=self.p.rr)', `if crossed_below(self.rsi, self.p.hi, i)${p.trend ? ' and self.close[i] < self.trend[i]' : ''}:`, '    return Signal.short(stop=stop, rr=self.p.rr)', 'return None'],
        exit: ['if pos.is_long and self.rsi[i] >= self.p.hi:', '    return "signal"', 'if pos.is_short and self.rsi[i] <= self.p.lo:', '    return "signal"', 'return None'],
      }),
      entry(i, b, x, p, ctx) {
        const r = x.rsi;
        if (i < 1 || r[i - 1] == null || r[i] == null || x.atr[i] == null) return null;
        let dir = 0;
        if (r[i - 1] < p.lo && r[i] >= p.lo) dir = 1;
        else if (r[i - 1] > p.hi && r[i] <= p.hi) dir = -1;
        if (!dir) return null;
        const c = b[i].close;
        if (x.ema) {
          if (x.ema[i] == null) return null;
          if ((dir > 0 && c < x.ema[i]) || (dir < 0 && c > x.ema[i])) return null;
        }
        const sd = x.atr[i] * p.sl;
        const checks = [{ label: `RSI ${p.n} ${dir > 0 ? 'вернулся выше ' + p.lo : 'опустился ниже ' + p.hi}`, value: `RSI = ${TH.fmt(r[i], 1)} (пред. ${TH.fmt(r[i - 1], 1)})` }];
        if (x.ema) checks.push({ label: `Фильтр тренда: цена ${dir > 0 ? 'выше' : 'ниже'} EMA ${p.trend}`, value: `${ctx.f(c)} ${dir > 0 ? '>' : '<'} ${ctx.f(x.ema[i])}` });
        checks.push({ label: `ATR ${p.atr}`, value: ctx.f(x.atr[i]), info: true }, { label: `Стоп = ${p.sl} × ATR`, value: ctx.f(sd), info: true }, { label: `Цель = ${p.rr} R`, value: ctx.f(sd * p.rr), info: true });
        return { dir, stopDist: sd, rr: p.rr, checks };
      },
      exit(i, b, x, p, pos) {
        const r = x.rsi[i];
        if (r == null) return null;
        if (pos.dir > 0 && r >= p.hi) return 'signal';
        if (pos.dir < 0 && r <= p.lo) return 'signal';
        return null;
      },
    },
    {
      id: 'BollingerSqueeze',
      name: 'Bollinger Squeeze',
      style: 'breakout',
      desc: 'Пробой полос Боллинджера после сжатия волатильности: ширина полос в нижних процентах за окно. Стоп по ATR, цель кратна риску.',
      params: [
        { k: 'n', label: 'Период BB', def: 20, min: 5, max: 200, step: 1 },
        { k: 'k', label: 'Ширина полос, σ', def: 2, min: 0.5, max: 4, step: 0.1 },
        { k: 'look', label: 'Окно сжатия, бар', def: 120, min: 20, max: 500, step: 1 },
        { k: 'q', label: 'Порог сжатия, %', def: 20, min: 1, max: 60, step: 1 },
        { k: 'atr', label: 'Период ATR', def: 14, min: 2, max: 100, step: 1 },
        { k: 'sl', label: 'Стоп, × ATR', def: 1.5, min: 0.3, max: 10, step: 0.1 },
        { k: 'rr', label: 'Цель, R', def: 2.5, min: 0.5, max: 10, step: 0.1 },
        { k: 'hold', label: 'Макс. удержание, бар', def: 36, min: 1, max: 500, step: 1 },
      ],
      prepare(b, p) {
        const c = closes(b);
        const bb = ind.bb(c, p.n, p.k);
        const bw = bb.mid.map((m, i) => (m == null ? null : (bb.up[i] - bb.lo[i]) / m));
        const sq = new Array(b.length).fill(false);
        for (let i = p.look; i < b.length; i++) {
          if (bw[i] == null) continue;
          let below = 0, cnt = 0;
          for (let j = i - p.look; j < i; j++) {
            if (bw[j] == null) continue;
            cnt++;
            if (bw[j] < bw[i]) below++;
          }
          sq[i] = cnt > 0 && (below / cnt) * 100 <= p.q;
        }
        return { up: bb.up, mid: bb.mid, lo: bb.lo, bw, sq, atr: ind.atr(b, p.atr) };
      },
      lines(x, p) {
        return [
          { name: `BB ${p.n} ↑`, data: x.up, color: 'rgba(100,210,255,.8)', style: 2 },
          { name: `BB ${p.n}`, data: x.mid, color: '#FFD60A', width: 1 },
          { name: `BB ${p.n} ↓`, data: x.lo, color: 'rgba(100,210,255,.8)', style: 2 },
        ];
      },
      rules: (p) => [
        ['Сжатие', `ширина полос BB ${p.n}, ${n1(p.k)}σ — в нижних ${p.q}% за последние ${p.look} баров`],
        ['Вход long', 'в течение 6 баров после сжатия закрытие пробивает верхнюю полосу'],
        ['Вход short', 'в течение 6 баров после сжатия закрытие пробивает нижнюю полосу'],
        STOP(p), TARGET(p), HOLD(p), EXEC,
      ],
      code: () => ({
        prep: ['self.up, self.mid, self.lo = bollinger(bars.close, self.p.n, self.p.k)', 'width = (self.up - self.lo) / self.mid', 'self.squeeze = percentile_rank(width, self.p.look) <= self.p.q', 'self.atr = atr(bars, self.p.atr)'],
        entry: ['if not self.squeeze[i - 6:i].any():', '    return None', 'stop = self.atr[i] * self.p.sl', 'if crossed_above(self.close, self.up, i):', '    return Signal.long(stop=stop, rr=self.p.rr)', 'if crossed_below(self.close, self.lo, i):', '    return Signal.short(stop=stop, rr=self.p.rr)', 'return None'],
      }),
      entry(i, b, x, p, ctx) {
        if (i < 1 || x.up[i] == null || x.up[i - 1] == null || x.atr[i] == null) return null;
        let recent = false;
        for (let j = Math.max(0, i - 6); j < i; j++) if (x.sq[j]) { recent = true; break; }
        if (!recent) return null;
        const c = b[i].close, pc = b[i - 1].close;
        let dir = 0;
        if (c > x.up[i] && pc <= x.up[i - 1]) dir = 1;
        else if (c < x.lo[i] && pc >= x.lo[i - 1]) dir = -1;
        if (!dir) return null;
        const sd = x.atr[i] * p.sl;
        return {
          dir, stopDist: sd, rr: p.rr,
          checks: [
            { label: `Сжатие: ширина BB в нижних ${p.q}% за ${p.look} баров`, value: `ширина ${TH.fmt(x.bw[i] * 100, 2)}%` },
            { label: `Закрытие ${dir > 0 ? 'выше верхней' : 'ниже нижней'} полосы`, value: `${ctx.f(c)} ${dir > 0 ? '>' : '<'} ${ctx.f(dir > 0 ? x.up[i] : x.lo[i])}` },
            { label: `ATR ${p.atr}`, value: ctx.f(x.atr[i]), info: true },
            { label: `Стоп = ${p.sl} × ATR`, value: ctx.f(sd), info: true },
            { label: `Цель = ${p.rr} R`, value: ctx.f(sd * p.rr), info: true },
          ],
        };
      },
    },
  ];
  const STYLES = { trend: 'Тренд', meanrev: 'Возврат к среднему', breakout: 'Пробой', intraday: 'Внутри дня' };

  function strategyCode(engine, p, cls) {
    const c = engine.code(p);
    const snake = (k) => k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
    const lines = [
      'from core.strategy import TradingStrategy, Signal, Position',
      'from indicators import ' + [...new Set((c.prep.join(' ').match(/\b(ema|sma|atr|rsi|stdev|donchian|bollinger|percentile_rank|opening_range)\(/g) || []).map((x) => x.slice(0, -1)))].join(', '),
      '',
      '',
      `class ${cls}(TradingStrategy):`,
      '    timeframe = "1h"',
      '    params = {',
      ...Object.entries(p).map(([k, v]) => `        "${snake(k)}": ${v},`),
      '    }',
      '',
      '    def prepare(self, bars: pd.DataFrame) -> None:',
      ...c.prep.map((l) => '        ' + l),
      '',
      '    def entry(self, i: int) -> Signal | None:',
      ...c.entry.map((l) => '        ' + l),
    ];
    if (c.exit) lines.push('', '    def exit(self, i: int, pos: Position) -> str | None:', ...c.exit.map((l) => '        ' + l));
    return lines.join('\n');
  }
  const SBY = {};
  STRATEGIES.forEach((s) => (SBY[s.id] = s));

  const REASONS = { sl: 'Стоп-лосс', tp: 'Тейк-профит', signal: 'Сигнал выхода', time: 'Тайм-стоп', eod: 'Конец сессии', end: 'Конец периода' };
  const WARM = 320;

  function hourLastMinute(b, ex) {
    const day = Math.floor(b.time / 86400) * 86400;
    return Math.min(b.time + 59 * 60, day + (ex.sessEnd - 1) * 60);
  }

  function refine(sym, H, gi, pos) {
    const d = H.hourDay[gi], bar = H.H[gi];
    const mins = TH.data.minutes(sym, d, 1);
    for (const m of mins) {
      if (m.time < bar.time) continue;
      if (m.time >= bar.time + 3600) break;
      if (pos.dir > 0) {
        if (m.low <= pos.sl) return { price: Math.min(m.open, pos.sl), time: m.time, reason: 'sl' };
        if (pos.tp != null && m.high >= pos.tp) return { price: Math.max(m.open, pos.tp), time: m.time, reason: 'tp' };
      } else {
        if (m.high >= pos.sl) return { price: Math.max(m.open, pos.sl), time: m.time, reason: 'sl' };
        if (pos.tp != null && m.low <= pos.tp) return { price: Math.min(m.open, pos.tp), time: m.time, reason: 'tp' };
      }
    }
    return null;
  }

  function slice(sym, fromIdx, toIdx) {
    const H = TH.data.history(sym);
    const h0 = H.dayH0[fromIdx], h1 = H.dayH0[toIdx + 1] - 1;
    const s = Math.max(0, h0 - WARM);
    return { H, s, h0, h1, bars: H.H.slice(s, h1 + 1), dayOf: H.hourDay.slice(s, h1 + 1), start: h0 - s };
  }

  function simulate(sym, strat, p, fromIdx, toIdx, cfg) {
    const S = slice(sym, fromIdx, toIdx);
    const { H, bars, dayOf, start } = S;
    const inst = H.inst, ex = H.ex;
    const x = strat.prepare(bars, p, { dayOf });
    const slip = (cfg.slippage || 0) * inst.tick;
    const R = (v) => TH.data.roundTick(inst, v);
    const ctx = { f: (v) => TH.fmt(v, inst.dp) };
    const trades = [];
    let pos = null;
    for (let i = start; i < bars.length; i++) {
      const b = bars[i];
      if (pos) {
        let out = null;
        const hitSL = pos.dir > 0 ? b.low <= pos.sl : b.high >= pos.sl;
        const hitTP = pos.tp != null && (pos.dir > 0 ? b.high >= pos.tp : b.low <= pos.tp);
        if (hitSL || hitTP) {
          const rf = refine(sym, H, S.s + i, pos);
          if (rf) out = { price: rf.reason === 'sl' ? R(rf.price - pos.dir * slip) : rf.price, time: rf.time, reason: rf.reason };
        }
        if (!out) {
          const lastOfDay = i === bars.length - 1 || dayOf[i + 1] !== dayOf[i];
          const se = strat.exit ? strat.exit(i, bars, x, p, pos, { lastOfDay }) : null;
          const held = i - pos.entryI + 1;
          let reason = null;
          if (se) reason = se;
          else if (p.hold && held >= p.hold) reason = 'time';
          else if (i === bars.length - 1) reason = 'end';
          if (reason) out = { price: R(b.close - pos.dir * slip), time: hourLastMinute(b, ex), reason };
        }
        if (out) {
          trades.push(Object.assign(pos, {
            exitTime: out.time, exitPrice: out.price, reason: out.reason, reasonLabel: REASONS[out.reason],
            exitI: i, gX: S.s + i, barsHeld: i - pos.entryI + 1,
            R: (pos.dir * (out.price - pos.entryPrice)) / Math.abs(pos.entryPrice - pos.sl),
          }));
          pos = null;
        }
      }
      if (!pos && i < bars.length - 1) {
        const sig = strat.entry(i, bars, x, p, ctx, dayOf);
        if (sig) {
          const nb = bars[i + 1];
          const entry = R(nb.open + sig.dir * slip);
          const sl = R(sig.stopPrice != null ? sig.stopPrice : entry - sig.dir * sig.stopDist);
          if (sig.dir * (entry - sl) < inst.tick * 2) continue;
          let tp = sig.tpPrice != null ? R(sig.tpPrice) : sig.rr ? R(entry + sig.dir * Math.abs(entry - sl) * sig.rr) : null;
          if (tp != null && sig.dir * (tp - entry) <= inst.tick) tp = null;
          pos = {
            sym, dir: sig.dir, entryI: i + 1, sigI: i, gI: S.s + i + 1, sigTime: b.time,
            entryTime: nb.time, entryPrice: entry, sl, tp, checks: sig.checks,
            sigClose: b.close,
          };
        }
      }
    }
    return trades;
  }

  function compose(trades, cfg) {
    const sorted = trades.slice().sort((a, b) => a.entryTime - b.entryTime || a.sym.localeCompare(b.sym));
    let realized = 0;
    const open = [];
    const out = [];
    for (const t of sorted) {
      open.sort((a, b) => a.exitTime - b.exitTime);
      while (open.length && open[0].exitTime <= t.entryTime) realized += open.shift().pnl;
      const inst = TH.data.inst(t.sym);
      const eq = cfg.capital + realized;
      const riskMoney = (eq * cfg.risk) / 100;
      const dist = Math.abs(t.entryPrice - t.sl);
      let qty = riskMoney / dist;
      const maxQty = (eq * cfg.maxLev) / t.entryPrice;
      let capped = false;
      if (qty > maxQty) { qty = maxQty; capped = true; }
      const lots = Math.floor(qty / inst.lot + 1e-9);
      if (lots < 1) continue;
      qty = +(lots * inst.lot).toFixed(6);
      const comm = ((qty * t.entryPrice + qty * t.exitPrice) * cfg.commission) / 100;
      const gross = t.dir * (t.exitPrice - t.entryPrice) * qty;
      Object.assign(t, {
        qty, lots, capped, riskMoney, eqAtEntry: eq, comm, gross, pnl: gross - comm, retPct: ((gross - comm) / eq) * 100,
      });
      open.push(t);
      out.push(t);
    }
    out.forEach((t, i) => (t.n = i + 1));
    return out;
  }

  function equityCurve(trades, days, fromIdx, toIdx, capital) {
    const ex = trades.slice().sort((a, b) => a.exitTime - b.exitTime);
    const pts = [];
    let k = 0, acc = 0;
    pts.push({ time: fromIdx > 0 ? days[fromIdx - 1] : days[fromIdx] - 86400, value: capital });
    for (let d = fromIdx; d <= toIdx; d++) {
      const end = days[d] + 86400;
      while (k < ex.length && ex[k].exitTime < end) acc += ex[k++].pnl;
      pts.push({ time: days[d], value: capital + acc });
    }
    return pts;
  }

  function metrics(trades, eq, capital, ann) {
    const n = trades.length;
    const wins = trades.filter((t) => t.pnl > 0), losses = trades.filter((t) => t.pnl <= 0);
    const gp = TH.sum(wins, (t) => t.pnl), gl = -TH.sum(losses, (t) => t.pnl);
    const net = gp - gl;
    const final = eq.length ? eq[eq.length - 1].value : capital;
    const span = eq.length > 1 ? eq[eq.length - 1].time - eq[0].time : 86400;
    const years = Math.max(span / (365 * 86400), 1 / 365);
    let peak = -Infinity, mdd = 0, mddMoney = 0, ddStart = 0, longestDD = 0, ddFrom = eq.length ? eq[0].time : 0;
    for (const e of eq) {
      if (e.value >= peak) { peak = e.value; ddFrom = e.time; }
      const dd = e.value / peak - 1;
      if (dd < mdd) mdd = dd;
      if (peak - e.value > mddMoney) mddMoney = peak - e.value;
      if (e.value < peak) longestDD = Math.max(longestDD, e.time - ddFrom);
    }
    const rets = [];
    for (let i = 1; i < eq.length; i++) rets.push(eq[i].value / eq[i - 1].value - 1);
    const mean = rets.length ? TH.sum(rets) / rets.length : 0;
    const sd = rets.length > 1 ? Math.sqrt(TH.sum(rets, (r) => (r - mean) ** 2) / (rets.length - 1)) : 0;
    const dsd = rets.length > 1 ? Math.sqrt(TH.sum(rets, (r) => Math.min(0, r) ** 2) / (rets.length - 1)) : 0;
    let cl = 0, maxCL = 0, cw = 0, maxCW = 0;
    for (const t of trades.slice().sort((a, b) => a.exitTime - b.exitTime)) {
      if (t.pnl <= 0) { cl++; cw = 0; } else { cw++; cl = 0; }
      maxCL = Math.max(maxCL, cl);
      maxCW = Math.max(maxCW, cw);
    }
    const longs = trades.filter((t) => t.dir > 0), shorts = trades.filter((t) => t.dir < 0);
    const wr = (a) => (a.length ? (a.filter((t) => t.pnl > 0).length / a.length) * 100 : 0);
    const exposure = span > 0 ? Math.min(100, (TH.sum(trades, (t) => t.exitTime - t.entryTime) / span) * 100) : 0;
    return {
      n, wins: wins.length, losses: losses.length, net, gp, gl, final,
      ret: (final / capital - 1) * 100,
      cagr: (Math.pow(Math.max(final, 1) / capital, 1 / years) - 1) * 100,
      mdd: mdd * 100, mddMoney, longestDD,
      sharpe: sd > 0 ? (mean / sd) * Math.sqrt(ann) : 0,
      sortino: dsd > 0 ? (mean / dsd) * Math.sqrt(ann) : 0,
      pf: gl > 0 ? gp / gl : gp > 0 ? Infinity : 0,
      winRate: n ? (wins.length / n) * 100 : 0,
      avgWin: wins.length ? gp / wins.length : 0,
      avgLoss: losses.length ? -gl / losses.length : 0,
      expectancy: n ? net / n : 0,
      avgR: n ? TH.sum(trades, (t) => t.R) / n : 0,
      best: n ? Math.max(...trades.map((t) => t.pnl)) : 0,
      worst: n ? Math.min(...trades.map((t) => t.pnl)) : 0,
      avgHold: n ? TH.sum(trades, (t) => t.exitTime - t.entryTime) / n : 0,
      maxCL, maxCW,
      longs: longs.length, shorts: shorts.length, longWR: wr(longs), shortWR: wr(shorts),
      longPnl: TH.sum(longs, (t) => t.pnl), shortPnl: TH.sum(shorts, (t) => t.pnl),
      comm: TH.sum(trades, (t) => t.comm),
      recovery: mddMoney > 0 ? net / mddMoney : null,
      exposure,
      calmar: mdd < 0 ? ((Math.pow(Math.max(final, 1) / capital, 1 / years) - 1) * 100) / Math.abs(mdd * 100) : null,
    };
  }

  function monthly(eq, capital) {
    const out = {};
    let prevEnd = capital, curKey = null, last = capital;
    for (const e of eq.slice(1)) {
      const d = new Date(e.time * 1000);
      const key = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
      if (curKey && key !== curKey) { out[curKey] = (last / prevEnd - 1) * 100; prevEnd = last; }
      curKey = key;
      last = e.value;
    }
    if (curKey) out[curKey] = (last / prevEnd - 1) * 100;
    return out;
  }

  function rHist(trades) {
    const edges = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];
    const bins = new Array(edges.length - 1).fill(0);
    trades.forEach((t) => {
      let k = edges.findIndex((e, i) => i < edges.length - 1 && t.R >= e && t.R < edges[i + 1]);
      if (k < 0) k = t.R < edges[0] ? 0 : bins.length - 1;
      bins[k]++;
    });
    return { edges, bins };
  }

  const MAX_LEV = 3;
  const ANN = 365;

  function idxRange(days, from, to) {
    const fromIdx = Math.max(0, days.findIndex((d) => d >= from));
    let toIdx = -1;
    for (let i = days.length - 1; i >= 0; i--) if (days[i] <= to) { toIdx = i; break; }
    if (toIdx < fromIdx) toIdx = days.length - 1;
    return { fromIdx, toIdx };
  }

  function unionDays(syms, from, to) {
    const set = new Set();
    syms.forEach((s) => {
      const H = TH.data.history(s);
      const r = idxRange(H.days, from, to);
      for (let i = r.fromIdx; i <= r.toIdx; i++) set.add(H.days[i]);
    });
    return [...set].sort((a, b) => a - b);
  }

  function daily(eq, trades) {
    const out = {};
    for (let i = 1; i < eq.length; i++) {
      const prev = eq[i - 1].value, v = eq[i].value;
      out[TH.d.iso(eq[i].time)] = { ret: (v / prev - 1) * 100, pnl: v - prev, n: 0 };
    }
    trades.forEach((t) => {
      const k = TH.d.iso(Math.floor(t.exitTime / 86400) * 86400);
      if (out[k]) out[k].n++;
    });
    return out;
  }

  async function run(cfg, onProgress = () => { }) {
    const strat = SBY[cfg.engine || cfg.strategy];
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const bySym = {}, raw = {};
    const steps = cfg.syms.length + 2;
    for (let k = 0; k < cfg.syms.length; k++) {
      const sym = cfg.syms[k];
      onProgress((k / steps) * 100, `Котировки из базы и сигналы · ${sym}`, 1);
      await tick();
      const H = TH.data.history(sym);
      const r = idxRange(H.days, cfg.from, cfg.to);
      bySym[sym] = { ex: H.ex, days: H.days, fromIdx: r.fromIdx, toIdx: r.toIdx };
      onProgress(((k + 0.5) / steps) * 100, `Симуляция сделок · ${sym}`, 2);
      await tick();
      raw[sym] = simulate(sym, strat, cfg.params, r.fromIdx, r.toIdx, cfg);
    }
    onProgress(((steps - 2) / steps) * 100, 'Расчёт позиций и капитала', 3);
    await tick();
    const a = Object.assign({ maxLev: MAX_LEV }, cfg.acc);
    const trades = compose([].concat(...cfg.syms.map((s) => raw[s])), a);
    const days = unionDays(cfg.syms, cfg.from, cfg.to);
    const fromIdx = 0, toIdx = days.length - 1;
    const eq = equityCurve(trades, days, fromIdx, toIdx, a.capital);
    const bench = eq.map((e, i) => {
      if (i === 0) return { time: e.time, value: a.capital };
      const vals = cfg.syms.map((s) => {
        const H = TH.data.history(s);
        const b = bySym[s];
        const di = TH.clamp(TH.data.dayIndexOf(H, e.time), b.fromIdx, b.toIdx);
        return H.D[di].close / H.D[b.fromIdx].open;
      });
      return { time: e.time, value: a.capital * (TH.sum(vals) / vals.length) };
    });
    const m = metrics(trades, eq, a.capital, ANN);
    const acc = { cfg: a, syms: cfg.syms, trades, eq, bench, m, days, fromIdx, toIdx, monthly: monthly(eq, a.capital), daily: daily(eq, trades) };
    cfg.syms.forEach((s) => {
      const b = bySym[s];
      const tr = trades.filter((t) => t.sym === s);
      const e = equityCurve(tr, b.days, b.fromIdx, b.toIdx, a.capital);
      Object.assign(b, { acc: a, trades: tr, eq: e, m: metrics(tr, e, a.capital, ANN) });
    });
    onProgress(((steps - 1) / steps) * 100, 'Метрики и отчёт', 4);
    await tick();
    trades.forEach((t, i) => (t.n = i + 1));
    onProgress(100, 'Готово', 5);
    return { id: cfg.id, cfg, strat, acc, trades, bySym, hist: rHist(trades) };
  }

  TH.STRATEGIES = STRATEGIES;
  TH.STYLES = STYLES;
  TH.strategy = (id) => SBY[id];
  TH.strategyCode = strategyCode;
  TH.bt = { run, simulate, slice, metrics, idxRange, MAX_LEV, REASONS, WARM };
})();
