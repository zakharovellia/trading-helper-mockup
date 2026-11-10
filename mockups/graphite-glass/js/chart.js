(function () {
  const TH = window.TH;
  const LWC = window.LightweightCharts;
  const UP = '#30D158', DN = '#FF453A';
  const UPV = 'rgba(48,209,88,0.26)', DNV = 'rgba(255,69,58,0.26)';
  const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, "Segoe UI", Roboto, sans-serif';

  TH.chartTheme = function (extra = {}) {
    const base = {
      autoSize: true,
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: 'rgba(235,235,245,0.48)', fontFamily: FONT, fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: 'rgba(255,255,255,0.032)' }, horzLines: { color: 'rgba(255,255,255,0.032)' } },
      crosshair: {
        mode: LWC.CrosshairMode.Normal,
        vertLine: { color: 'rgba(255,255,255,0.26)', width: 1, style: LWC.LineStyle.Dashed, labelBackgroundColor: '#3b3c44' },
        horzLine: { color: 'rgba(255,255,255,0.26)', width: 1, style: LWC.LineStyle.Dashed, labelBackgroundColor: '#3b3c44' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)', scaleMargins: { top: 0.14, bottom: 0.18 } },
      timeScale: { borderColor: 'rgba(255,255,255,0.06)', rightOffset: 6, minBarSpacing: 0.6 },
      handleScale: { axisPressedMouseMove: { time: true, price: true } },
      kineticScroll: { mouse: false, touch: true },
    };
    return deepMerge(base, extra);
  };
  function deepMerge(a, b) {
    for (const k of Object.keys(b)) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && typeof b[k] !== 'function' && a[k] && typeof a[k] === 'object') deepMerge(a[k], b[k]);
      else a[k] = b[k];
    }
    return a;
  }

  class TChart {
    constructor(el, opts = {}) {
      this.el = el;
      this.opts = opts;
      this.tf = opts.tf || 'M';
      this.inst = opts.inst || { dp: 2, tick: 0.01 };
      el.classList.add('tchart');
      this.bg = document.createElement('canvas');
      this.bg.className = 'tc-bg';
      this.host = document.createElement('div');
      this.host.className = 'tc-host';
      this.fg = document.createElement('canvas');
      this.fg.className = 'tc-fg';
      this.legendEl = document.createElement('div');
      this.legendEl.className = 'legend';
      el.append(this.bg, this.host, this.fg, this.legendEl);
      const tf = this.tf;
      this.chart = LWC.createChart(this.host, TH.chartTheme({
        timeScale: { timeVisible: tf !== 'D', secondsVisible: false, barSpacing: tf === 'D' ? 7 : 6 },
        localization: {
          locale: 'ru-RU',
          timeFormatter: (t) => (tf === 'D' ? TH.d.med(t) : TH.d.dmShort(t) + ' ' + TH.d.hm(t)),
          priceFormatter: (p) => TH.fmt(p, this.inst.dp),
        },
      }));
      this.extraPrices = [];
      this._asp = (orig) => {
        const r = orig();
        if (!r || !r.priceRange || !this.extraPrices.length) return r;
        return Object.assign({}, r, { priceRange: { minValue: Math.min(r.priceRange.minValue, ...this.extraPrices), maxValue: Math.max(r.priceRange.maxValue, ...this.extraPrices) } });
      };
      this.candles = this.chart.addCandlestickSeries({
        upColor: UP, downColor: DN, borderVisible: false, wickUpColor: UP, wickDownColor: DN,
        priceLineColor: 'rgba(255,255,255,.4)', priceLineStyle: LWC.LineStyle.Dotted,
        autoscaleInfoProvider: this._asp,
      });
      this.vol = this.chart.addHistogramSeries({ priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
      this.chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.86, bottom: 0 } });
      this.lineSeries = [];
      this.lineDefs = [];
      this.bars = [];
      this.times = [];
      this.band = null;
      this.boxes = [];
      this.sync = null;
      this.drawings = [];
      this.pending = null;
      this.hover = null;
      this.levels = [];
      this.levelLines = [];
      this.priceLines = [];
      this.showVolume = true;
      this._raf = 0;
      this._again = false;
      this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => this.redraw());
      this.chart.subscribeCrosshairMove((p) => this._move(p));
      this.chart.subscribeClick((p) => this._click(p));
      this._ro = new ResizeObserver(() => this.redraw());
      this._ro.observe(el);
      const late = () => this.redraw();
      ['wheel', 'pointermove', 'pointerup', 'dblclick'].forEach((ev) => el.addEventListener(ev, late, { passive: true }));
    }

    setInst(inst) {
      this.inst = inst;
      this.candles.applyOptions({ priceFormat: { type: 'price', precision: inst.dp, minMove: inst.tick } });
    }

    setData(bars, { volume = true } = {}) {
      this.bars = bars;
      this.times = bars.map((b) => b.time);
      this.candles.setData(bars);
      this.showVolume = volume;
      this.vol.setData(volume ? bars.map((b) => ({ time: b.time, value: b.volume, color: b.close >= b.open ? UPV : DNV })) : []);
      this._legend(null);
      this.redraw();
    }

    updateBar(bar) {
      const n = this.bars.length;
      if (n && this.bars[n - 1].time === bar.time) this.bars[n - 1] = bar;
      else { this.bars.push(bar); this.times.push(bar.time); }
      this.candles.update(bar);
      if (this.showVolume) this.vol.update({ time: bar.time, value: bar.volume, color: bar.close >= bar.open ? UPV : DNV });
      if (this._hoverIdx == null) this._legend(null);
      this.redraw();
    }

    setLines(defs) {
      this.lineSeries.forEach((s) => this.chart.removeSeries(s));
      this.lineSeries = [];
      this.lineDefs = defs || [];
      for (const d of this.lineDefs) {
        const s = this.chart.addLineSeries({
          color: d.color, lineWidth: d.width || 1, lineStyle: d.style || 0,
          priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
          lineType: d.step ? 1 : 0,
        });
        s.setData(this.bars.map((b, i) => (d.data[i] == null || !isFinite(d.data[i]) ? { time: b.time } : { time: b.time, value: d.data[i] })));
        this.lineSeries.push(s);
      }
      this._legend(null);
    }

    setMarkers(list) {
      const ms = (list || [])
        .map((m) => Object.assign({}, m, { time: this.snap(m.time) }))
        .filter((m) => m.time != null)
        .sort((a, b) => a.time - b.time);
      this.candles.setMarkers(ms);
    }

    setPriceLines(defs) {
      this.priceLines.forEach((l) => this.candles.removePriceLine(l));
      this.priceLines = (defs || []).map((d) =>
        this.candles.createPriceLine({ price: d.price, color: d.color, lineWidth: d.width || 1, lineStyle: d.style ?? LWC.LineStyle.Dashed, axisLabelVisible: true, title: d.title || '' })
      );
    }

    setLevels(levels) {
      this.levels = levels || [];
      this.levelLines.forEach((l) => this.candles.removePriceLine(l));
      this.levelLines = this.levels.map((lv) =>
        this.candles.createPriceLine({ price: lv.price, color: '#FF9F0A', lineWidth: 1, lineStyle: LWC.LineStyle.LargeDashed, axisLabelVisible: true, title: '' })
      );
    }

    setExtraPrices(list) {
      this.extraPrices = (list || []).filter((v) => v != null && isFinite(v));
      this.candles.applyOptions({ autoscaleInfoProvider: this._asp });
    }
    setLegendTime(t) { this._legendT = t; this._legend(null); }

    setDrawings(list) { this.drawings = list || []; this.pending = null; this.redraw(); }
    setBand(t1, t2) { this.band = t1 == null ? null : [t1, t2]; this.redraw(); }
    setBoxes(boxes) { this.boxes = boxes || []; this.redraw(); }
    setSync(s) { this.sync = s; this.redraw(); }
    cancelPending() { if (this.pending) { this.pending = null; this.redraw(); } }
    setDrawMode(on) { this.el.classList.toggle('drawing', !!on); if (!on) this.cancelPending(); }

    fit() { this.chart.timeScale().fitContent(); }
    showLast(n, right = 5) {
      const N = this.bars.length;
      this.chart.timeScale().setVisibleLogicalRange({ from: Math.max(-2, N - n), to: N - 1 + right });
    }
    showRange(t1, t2, padL = 10, padR = 10) {
      const l1 = this.tToL(t1, 'floor'), l2 = this.tToL(t2, 'floor');
      if (l1 == null || l2 == null) return this.fit();
      this.chart.timeScale().setVisibleLogicalRange({ from: l1 - padL, to: l2 + padR });
    }

    idxFloor(t) {
      const T = this.times;
      let lo = 0, hi = T.length - 1, a = -1;
      while (lo <= hi) {
        const m = (lo + hi) >> 1;
        if (T[m] <= t) { a = m; lo = m + 1; } else hi = m - 1;
      }
      return a;
    }
    snap(t) { const i = this.idxFloor(t); return i < 0 ? null : this.times[i]; }
    tToL(t, mode) {
      const T = this.times, n = T.length;
      if (!n) return null;
      if (mode === 'floor') {
        const i = this.idxFloor(t);
        return i < 0 ? -1 : i;
      }
      if (t <= T[0]) { const dt = n > 1 ? T[1] - T[0] : 60; return (t - T[0]) / dt; }
      if (t >= T[n - 1]) { const dt = n > 1 ? T[n - 1] - T[n - 2] : 60; return n - 1 + (t - T[n - 1]) / dt; }
      const i = this.idxFloor(t);
      return i + (t - T[i]) / (T[i + 1] - T[i]);
    }
    lToT(l) {
      const T = this.times, n = T.length;
      if (!n) return null;
      if (l <= 0) { const dt = n > 1 ? T[1] - T[0] : 60; return T[0] + l * dt; }
      if (l >= n - 1) { const dt = n > 1 ? T[n - 1] - T[n - 2] : 60; return T[n - 1] + (l - (n - 1)) * dt; }
      const i = Math.floor(l);
      return T[i] + (l - i) * (T[i + 1] - T[i]);
    }
    lToX(l) { return l == null ? null : this.chart.timeScale().logicalToCoordinate(l); }
    xOf(t, mode) { return this.lToX(this.tToL(t, mode)); }
    xToL(x) {
      const ts = this.chart.timeScale();
      const a = ts.logicalToCoordinate(0), b = ts.logicalToCoordinate(1);
      if (a == null || b == null || a === b) return null;
      return (x - a) / (b - a);
    }
    yOf(p) { return this.candles.priceToCoordinate(p); }

    redraw() {
      if (this._dead) return;
      if (this._raf) { this._again = true; return; }
      this._raf = requestAnimationFrame(() => {
        this._raf = 0;
        try { this._draw(); } catch (e) { }
        if (this._again) { this._again = false; this.redraw(); }
      });
    }

    _ctx(cv, w, h) {
      const dpr = window.devicePixelRatio || 1;
      const W = Math.round(w * dpr), H = Math.round(h * dpr);
      if (cv.width !== W || cv.height !== H) {
        cv.width = W; cv.height = H;
        cv.style.width = w + 'px'; cv.style.height = h + 'px';
      }
      const c = cv.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      return c;
    }

    _draw() {
      const w = this.el.clientWidth, h = this.el.clientHeight;
      if (!w || !h) return;
      const bg = this._ctx(this.bg, w, h), fg = this._ctx(this.fg, w, h);
      if (!this.times.length) return;
      const ts = this.chart.timeScale();
      const pw = w - this.chart.priceScale('right').width();
      const ph = h - ts.height();
      const x0 = ts.logicalToCoordinate(0), x1 = ts.logicalToCoordinate(1);
      const sp = x0 != null && x1 != null ? Math.abs(x1 - x0) : 6;
      [bg, fg].forEach((c) => { c.save(); c.beginPath(); c.rect(0, 0, pw, ph); c.clip(); });

      if (this.band) {
        const l1 = this.tToL(this.band[0], 'floor'), l2 = this.tToL(this.band[1], 'floor');
        if (l1 != null && l2 != null) {
          const a = this.lToX(l1) - sp / 2, b = this.lToX(l2) + sp / 2;
          const g = bg.createLinearGradient(0, 0, 0, ph);
          g.addColorStop(0, 'rgba(10,132,255,0.15)');
          g.addColorStop(1, 'rgba(10,132,255,0.04)');
          bg.fillStyle = g;
          bg.fillRect(a, 0, b - a, ph);
          bg.fillStyle = 'rgba(10,132,255,0.5)';
          bg.fillRect(a, 0, 1, ph);
          bg.fillRect(b - 1, 0, 1, ph);
        }
      }

      if (this.sync) {
        const l1 = this.tToL(this.sync.t, 'floor'), l2 = this.tToL(this.sync.t + this.sync.span - 1, 'floor');
        if (l1 != null && l2 != null && l2 >= 0) {
          const a = this.lToX(Math.max(l1, -1)) - sp / 2, b = this.lToX(l2) + sp / 2;
          bg.fillStyle = 'rgba(255,255,255,0.055)';
          bg.fillRect(a, 0, Math.max(1, b - a), ph);
          fg.strokeStyle = 'rgba(255,255,255,0.32)';
          fg.setLineDash([3, 3]);
          fg.lineWidth = 1;
          const xm = Math.round(a) + 0.5;
          fg.beginPath(); fg.moveTo(xm, 0); fg.lineTo(xm, ph); fg.stroke();
          fg.setLineDash([]);
        }
      }

      for (const bx of this.boxes) this._box(bg, fg, bx, sp, pw);
      for (const d of this.drawings) this._drawing(fg, d, false);
      if (this.pending && this.hover) {
        const l = this.xToL(this.hover.x);
        const p = this.candles.coordinateToPrice(this.hover.y);
        if (l != null && p != null) this._drawing(fg, { type: this.pending.type, a: this.pending.a, b: { t: this.lToT(l), p } }, true);
      }
      if (this.opts.getTool && this.opts.getTool() === 'eraser' && this.hover) {
        const hit = this._hit(this.hover.x, this.hover.y);
        if (hit && hit.kind === 'drawing') this._drawing(fg, hit.d, false, true);
      }
      bg.restore();
      fg.restore();
    }

    _box(bg, fg, bx, sp, pw) {
      const l1 = this.tToL(bx.t1, 'floor'), l2 = this.tToL(bx.t2, 'floor');
      if (l1 == null || l2 == null || l2 < 0) return;
      const xa = this.lToX(l1) - sp / 2, xb = this.lToX(l2) + sp / 2;
      if (xb < -50 || xa > pw + 50) return;
      const ye = this.yOf(bx.entry);
      const ys = bx.sl != null ? this.yOf(bx.sl) : null;
      const yt = bx.tp != null ? this.yOf(bx.tp) : null;
      if (ye == null) return;
      const k = bx.active ? 1 : 0.45;
      if (yt != null) {
        bg.fillStyle = `rgba(48,209,88,${0.15 * k})`;
        bg.fillRect(xa, Math.min(ye, yt), xb - xa, Math.abs(yt - ye));
      }
      if (ys != null) {
        bg.fillStyle = `rgba(255,69,58,${0.15 * k})`;
        bg.fillRect(xa, Math.min(ye, ys), xb - xa, Math.abs(ys - ye));
      }
      const hl = (y, col, dash) => {
        fg.strokeStyle = col;
        fg.lineWidth = 1;
        fg.setLineDash(dash || []);
        fg.beginPath(); fg.moveTo(xa, Math.round(y) + 0.5); fg.lineTo(xb, Math.round(y) + 0.5); fg.stroke();
        fg.setLineDash([]);
      };
      if (bx.active) {
        if (yt != null) hl(yt, 'rgba(76,224,127,.85)');
        if (ys != null) hl(ys, 'rgba(255,107,97,.85)');
        hl(ye, 'rgba(235,235,245,.6)', [4, 3]);
        if (bx.exitPrice != null) {
          const yx = this.yOf(bx.exitPrice);
          const xe = this.lToX(this.tToL(bx.entryTime ?? bx.t1, 'floor'));
          const xx = this.lToX(this.tToL(bx.exitTime ?? bx.t2, 'floor'));
          if (yx != null && xe != null && xx != null) {
            fg.strokeStyle = bx.win ? 'rgba(76,224,127,.95)' : 'rgba(255,107,97,.95)';
            fg.lineWidth = 1.5;
            fg.setLineDash([5, 4]);
            fg.beginPath(); fg.moveTo(xe, ye); fg.lineTo(xx, yx); fg.stroke();
            fg.setLineDash([]);
          }
        }
        if (xb - xa > 46) {
          fg.font = '600 10px ' + FONT;
          fg.textBaseline = 'middle';
          const lab = (y, txt, col) => {
            const tw = fg.measureText(txt).width + 8;
            const yy = y;
            fg.fillStyle = 'rgba(20,21,24,.75)';
            roundRect(fg, xa + 4, yy - 8, tw, 16, 4); fg.fill();
            fg.fillStyle = col;
            fg.fillText(txt, xa + 8, yy + 0.5);
          };
          if (yt != null) lab(yt + (yt < ye ? 10 : -10), 'TP ' + TH.fmt(bx.tp, this.inst.dp), '#4CE07F');
          if (ys != null) lab(ys + (ys < ye ? 10 : -10), 'SL ' + TH.fmt(bx.sl, this.inst.dp), '#FF6B61');
        }
      }
    }

    _pt(p) { return [this.xOf(p.t), this.yOf(p.p)]; }

    _drawing(c, d, preview, hot) {
      const [ax, ay] = this._pt(d.a), [bx, by] = this._pt(d.b);
      if (ax == null || ay == null || bx == null || by == null) return;
      if (Math.abs(ax) > 1e5 || Math.abs(bx) > 1e5) return;
      c.lineWidth = 1.6;
      c.setLineDash(preview ? [5, 4] : []);
      if (d.type === 'trend') {
        c.strokeStyle = hot ? '#FF453A' : '#64D2FF';
        c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
        c.setLineDash([]);
        c.fillStyle = hot ? '#FF453A' : '#64D2FF';
        [[ax, ay], [bx, by]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill(); });
      } else {
        const x = Math.min(ax, bx), y = Math.min(ay, by), w = Math.abs(bx - ax), h = Math.abs(by - ay);
        c.fillStyle = hot ? 'rgba(255,69,58,.16)' : 'rgba(191,90,242,.13)';
        c.fillRect(x, y, w, h);
        c.strokeStyle = hot ? 'rgba(255,69,58,.8)' : 'rgba(191,90,242,.75)';
        c.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h));
        c.setLineDash([]);
      }
    }

    _hit(x, y) {
      for (const lv of this.levels) {
        const yy = this.yOf(lv.price);
        if (yy != null && Math.abs(yy - y) < 6) return { kind: 'level', lv };
      }
      for (let i = this.drawings.length - 1; i >= 0; i--) {
        const d = this.drawings[i];
        const [ax, ay] = this._pt(d.a), [bx, by] = this._pt(d.b);
        if (ax == null || ay == null || bx == null || by == null) continue;
        if (d.type === 'trend') {
          if (distSeg(x, y, ax, ay, bx, by) < 7) return { kind: 'drawing', d };
        } else if (x >= Math.min(ax, bx) - 4 && x <= Math.max(ax, bx) + 4 && y >= Math.min(ay, by) - 4 && y <= Math.max(ay, by) + 4) {
          return { kind: 'drawing', d };
        }
      }
      return null;
    }

    _move(p) {
      this.hover = p.point ? { x: p.point.x, y: p.point.y } : null;
      const idx = p.time != null ? this.idxFloor(p.time) : null;
      this._hoverIdx = idx;
      this._legend(idx);
      if (this.opts.onHover) this.opts.onHover(p.time != null && p.point ? p.time : null);
      if (this.pending || (this.opts.getTool && this.opts.getTool() === 'eraser')) this.redraw();
    }

    _click(p) {
      if (!p.point) return;
      const tool = this.opts.getTool ? this.opts.getTool() : 'cursor';
      if (tool === 'cursor') { this.opts.onBarClick && p.time != null && this.opts.onBarClick(p.time); return; }
      const { x, y } = p.point;
      const price = this.candles.coordinateToPrice(y);
      const l = this.xToL(x);
      if (price == null || l == null) return;
      if (tool === 'level') { this.opts.onLevelAdd && this.opts.onLevelAdd(TH.data.roundTick(this.inst, price)); return; }
      if (tool === 'eraser') {
        const hit = this._hit(x, y);
        if (!hit) return;
        if (hit.kind === 'level') this.opts.onLevelRemove && this.opts.onLevelRemove(hit.lv.id);
        else {
          this.drawings = this.drawings.filter((d) => d !== hit.d);
          this.opts.onDrawings && this.opts.onDrawings(this.drawings);
          this.redraw();
        }
        return;
      }
      const pt = { t: this.lToT(l), p: TH.data.roundTick(this.inst, price) };
      if (!this.pending) this.pending = { type: tool, a: pt };
      else {
        this.drawings.push({ id: TH.uid(), type: this.pending.type, a: this.pending.a, b: pt });
        this.pending = null;
        this.opts.onDrawings && this.opts.onDrawings(this.drawings);
      }
      this.redraw();
    }

    _legend(idx) {
      const B = this.bars;
      if (!B.length) { this.legendEl.innerHTML = ''; return; }
      if (idx == null || idx < 0) idx = this._legendT != null ? Math.max(0, this.idxFloor(this._legendT)) : B.length - 1;
      const b = B[idx];
      const prev = idx > 0 ? B[idx - 1].close : b.open;
      const ch = (b.close / prev - 1) * 100;
      const f = (v) => TH.fmt(v, this.inst.dp);
      const col = b.close >= b.open ? 'pos' : 'neg';
      let html = `<div class="lg-row"><span>O <b class="${col}">${f(b.open)}</b></span><span>H <b class="${col}">${f(b.high)}</b></span><span>L <b class="${col}">${f(b.low)}</b></span><span>C <b class="${col}">${f(b.close)}</b></span><span class="${TH.cls(ch)}">${TH.pct(ch)}</span>${this.showVolume ? `<span>V <b>${TH.compact(b.volume)}</b></span>` : ''}</div>`;
      const inds = this.lineDefs.filter((d) => d.legend !== false);
      if (inds.length) {
        html += '<div class="lg-row">' + inds.map((d) => `<span class="lg-ind"><i style="background:${d.color}"></i>${TH.esc(d.name)} <b>${d.data[idx] == null ? '—' : f(d.data[idx])}</b></span>`).join('') + '</div>';
      }
      this.legendEl.innerHTML = html;
    }

    destroy() {
      this._dead = true;
      this._ro.disconnect();
      try { this.chart.remove(); } catch (e) { }
      this.el.innerHTML = '';
    }
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function distSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const L = dx * dx + dy * dy;
    let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  class TriChart {
    constructor(root, opts = {}) {
      this.root = root;
      this.opts = opts;
      this.inst = opts.inst;
      this.mtf = opts.mtf || 1;
      root.classList.add('tri');
      const I = TH.icon;
      const pane = (k, title, tf) => `
        <div class="pane pane-${k} glass" data-k="${k}">
          <div class="pane-head">
            <span class="pane-title">${title}</span><span class="tf-badge" data-badge>${tf}</span><span class="pane-sub" data-sub></span>
            <div class="pane-actions">
              ${k === 'm' && opts.minuteTfs ? '<div data-mtf></div>' : ''}
              <button class="btn plain sm icon" data-fit title="Вписать данные">${I('fit', 14)}</button>
              <button class="btn plain sm icon" data-max title="Развернуть · двойной клик по заголовку">${I('expand', 14)}</button>
            </div>
          </div>
          <div class="pane-body"><div data-chart></div></div>
        </div>`;
      root.innerHTML = pane('d', 'Дневной', 'D1') + pane('h', 'Часовой', 'H1') + pane('m', 'Минутный', 'M' + this.mtf);
      const mk = (k, tf) => new TChart(root.querySelector(`.pane-${k} [data-chart]`), {
        tf,
        inst: opts.inst,
        getTool: opts.getTool,
        onHover: (t) => this._hover(k, t),
        onLevelAdd: (p) => this.addLevel(p),
        onLevelRemove: (id) => this.removeLevel(id),
        onDrawings: (list) => this._saveDrawings(k, list),
        onBarClick: opts.onBarClick ? (t) => opts.onBarClick(k, t) : null,
      });
      this.d = mk('d', 'D');
      this.h = mk('h', 'H');
      this.m = mk('m', 'M');
      this.charts = { d: this.d, h: this.h, m: this.m };
      root.querySelectorAll('.pane').forEach((p) => {
        const k = p.dataset.k;
        p.querySelector('[data-fit]').onclick = () => this.charts[k].fit();
        p.querySelector('[data-max]').onclick = () => this.toggleMax(k);
        p.querySelector('.pane-head').addEventListener('dblclick', (e) => { if (!e.target.closest('button')) this.toggleMax(k); });
      });
      if (opts.minuteTfs) {
        this.mtfSeg = TH.seg(root.querySelector('[data-mtf]'), opts.minuteTfs.map((v) => ({ v, label: v + 'm' })), this.mtf, (v) => {
          this.mtf = v;
          root.querySelector('.pane-m [data-badge]').textContent = 'M' + v;
          opts.onMinuteTf && opts.onMinuteTf(v);
        }, { size: 'sm' });
      }
      this._esc = (e) => { if (e.key === 'Escape') Object.values(this.charts).forEach((c) => c.cancelPending()); };
      document.addEventListener('keydown', this._esc);
      this.levels = [];
      if (opts.inst) this.setInstrument(opts.inst);
    }

    _span(k) { return k === 'd' ? 86400 : k === 'h' ? 3600 : this.mtf * 60; }
    _hover(k, t) {
      for (const [kk, c] of Object.entries(this.charts)) {
        if (kk === k) continue;
        c.setSync(t == null ? null : { t, span: this._span(k) });
      }
    }

    _key(s) { return this.opts.prefix ? `${this.opts.prefix}.${s}.${this.inst.sym}` : null; }

    setInstrument(inst) {
      this.inst = inst;
      Object.values(this.charts).forEach((c) => c.setInst(inst));
      const lk = this._key('lv');
      this.levels = lk ? TH.store.get(lk, []) : [];
      Object.values(this.charts).forEach((c) => c.setLevels(this.levels));
      for (const k of ['d', 'h', 'm']) {
        const dk = this._key('dr.' + k);
        this.charts[k].setDrawings(dk ? TH.store.get(dk, []) : []);
      }
    }

    addLevel(price) {
      this.levels.push({ id: TH.uid(), price });
      this._applyLevels();
      TH.toast('Уровень добавлен на все графики', { type: 'info', sub: TH.fmt(price, this.inst.dp), ms: 1600 });
    }
    removeLevel(id) { this.levels = this.levels.filter((l) => l.id !== id); this._applyLevels(); }
    _applyLevels() {
      Object.values(this.charts).forEach((c) => c.setLevels(this.levels));
      const lk = this._key('lv');
      if (lk) TH.store.set(lk, this.levels);
    }
    _saveDrawings(k, list) {
      const dk = this._key('dr.' + k);
      if (dk) TH.store.set(dk, list);
    }
    clearDrawings() {
      this.levels = [];
      this._applyLevels();
      for (const k of ['d', 'h', 'm']) { this.charts[k].setDrawings([]); this._saveDrawings(k, []); }
    }
    drawingCount() { return this.levels.length + this.d.drawings.length + this.h.drawings.length + this.m.drawings.length; }

    setTool(tool) { Object.values(this.charts).forEach((c) => c.setDrawMode(tool !== 'cursor')); }
    setSub(k, html) { this.root.querySelector(`.pane-${k} [data-sub]`).innerHTML = html; }

    toggleMax(k) {
      const cur = ['d', 'h', 'm'].find((x) => this.root.classList.contains('max-' + x));
      this.root.classList.remove('max-d', 'max-h', 'max-m');
      if (cur !== k) this.root.classList.add('max-' + k);
      this.root.querySelectorAll('[data-max]').forEach((b) => {
        const kk = b.closest('.pane').dataset.k;
        b.innerHTML = TH.icon(this.root.classList.contains('max-' + kk) ? 'shrink' : 'expand', 14);
      });
    }

    destroy() {
      document.removeEventListener('keydown', this._esc);
      Object.values(this.charts).forEach((c) => c.destroy());
      this.root.innerHTML = '';
      this.root.classList.remove('tri', 'max-d', 'max-h', 'max-m');
    }
  }

  TH.TChart = TChart;
  TH.TriChart = TriChart;
})();
