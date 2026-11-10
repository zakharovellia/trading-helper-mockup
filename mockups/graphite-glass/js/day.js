(function () {
  const TH = window.TH;
  const I = TH.icon;
  const S = TH.S;
  const TAGS = ['Тренд', 'Флэт', 'Разворот', 'Гэп', 'Новости', 'Высокая волатильность', 'По плану', 'Ошибка'];
  const st = {
    sym: TH.store.get('day.sym', null),
    dayIdx: null,
    mtf: TH.store.get('day.mtf', 1),
    tool: 'cursor',
    insp: TH.store.get('day.insp', true),
  };
  let root, tri, toolSeg, inited = false, saveTimer = null;

  const notesAll = () => TH.store.get('notes', {});
  const noteKey = () => TH.d.iso(H().days[st.dayIdx]);
  const H = () => TH.data.history(st.sym);
  const inst = () => TH.data.inst(st.sym);

  function init() {
    inited = true;
    root = TH.$('#view-day');
    root.innerHTML = `
      <div class="toolbar glass" id="dayBar">
        <button class="inst-btn" id="dInst" title="Выбрать инструмент"></button>
        <div class="tb-sep"></div>
        <div class="sess-nav">
          <button class="btn plain icon" id="dPrev" title="Предыдущая сессия · ←">${I('chevL', 17, 2.2)}</button>
          <button class="sess-date" id="dDate" title="Календарь сессий"></button>
          <button class="btn plain icon" id="dNext" title="Следующая сессия · →">${I('chevR', 17, 2.2)}</button>
          <button class="btn sm plain" id="dLast" title="К последней сессии">Последняя</button>
        </div>
        <div class="tb-sep"></div>
        <div class="quote-sum" id="dSum"></div>
        <div class="grow"></div>
        <button class="btn plain" id="dInd" title="Индикаторы на графиках">${I('wave', 15)}<span>Индикаторы</span></button>
        <div class="tb-sep"></div>
        <div id="dTools"></div>
        <button class="btn plain icon" id="dClear" title="Удалить все построения инструмента">${I('trash', 15)}</button>
        <div class="tb-sep"></div>
        <button class="btn plain icon ${st.insp ? 'on' : ''}" id="dInsp" title="Статистика и заметки · I">${I('sidebar', 16)}</button>
      </div>
      <div class="day-body">
        <div id="dayTri"></div>
        <aside class="inspector glass ${st.insp ? '' : 'closed'}" id="dayInsp"><div class="insp-scroll" id="dayInspBody"></div></aside>
      </div>`;
    toolSeg = TH.seg(TH.$('#dTools'), [
      { v: 'cursor', icon: 'cursor', title: 'Курсор · V' },
      { v: 'level', icon: 'level', title: 'Горизонтальный уровень · L — появится на всех трёх графиках' },
      { v: 'trend', icon: 'trend', title: 'Трендовая линия · T — два клика' },
      { v: 'zone', icon: 'zone', title: 'Зона · Z — два клика по углам' },
      { v: 'eraser', icon: 'eraser', title: 'Ластик · E — клик по построению' },
    ], st.tool, (v) => setTool(v), { iconOnly: true });
    tri = new TH.TriChart(TH.$('#dayTri'), {
      prefix: 'day',
      getTool: () => st.tool,
      minuteTfs: [1, 5, 15],
      mtf: st.mtf,
      onMinuteTf: (v) => { st.mtf = v; TH.store.set('day.mtf', v); loadMinute(); },
      onBarClick: (k, t) => {
        if (k === 'm') return;
        const idx = TH.data.dayIndexOf(H(), t);
        if (idx >= 0 && idx !== st.dayIdx) setDay(idx);
      },
    });
    TH.$('#dPrev').onclick = () => shift(-1);
    TH.$('#dNext').onclick = () => shift(1);
    TH.$('#dLast').onclick = () => setDay(H().days.length - 1);
    TH.$('#dDate').onclick = (e) => openCalendar(e.currentTarget);
    TH.$('#dInst').onclick = (e) => openInstPicker(e.currentTarget);
    TH.$('#dInd').onclick = (e) => openIndicators(e.currentTarget);
    TH.$('#dInsp').onclick = toggleInspector;
    TH.$('#dClear').onclick = async () => {
      if (!tri.drawingCount()) { TH.toast('Построений нет', { type: 'info' }); return; }
      const ok = await TH.confirm({ title: 'Удалить построения?', message: `Уровни, линии и зоны ${st.sym} на всех таймфреймах будут удалены.`, ok: 'Удалить', destructive: true, icon: 'trash' });
      if (ok) tri.clearDrawings();
    };
    setInstrument(TH.data.inst(st.sym) ? st.sym : TH.data.LIST[0].sym);
  }

  function setTool(v) {
    st.tool = v;
    if (toolSeg && toolSeg.value !== v) toolSeg.set(v, true);
    tri.setTool(v);
  }

  function toggleInspector() {
    st.insp = !st.insp;
    TH.store.set('day.insp', st.insp);
    TH.$('#dayInsp').classList.toggle('closed', !st.insp);
    TH.$('#dInsp').classList.toggle('on', st.insp);
  }

  function setInstrument(sym, dayIdx) {
    st.sym = sym;
    TH.store.set('day.sym', sym);
    const h = H();
    st.dayIdx = dayIdx != null ? dayIdx : h.days.length - 1;
    tri.setInstrument(inst());
    const i = inst();
    TH.$('#dInst').innerHTML = `${TH.ava(sym)}<div><b>${sym} ${TH.exTag(h.ex.id)}</b><small>${TH.esc(i.name)} · ${h.ex.name}</small></div>${I('chevD', 13, 2.2)}`;
    load();
  }

  function shift(d) {
    const n = TH.clamp(st.dayIdx + d, 0, H().days.length - 1);
    if (n !== st.dayIdx) setDay(n);
  }

  function setDay(idx) {
    st.dayIdx = idx;
    load();
  }

  function load() {
    const h = H(), d = st.dayIdx, cfg = S.data.indicators;
    const D = h.D.slice(0, d + 1);
    tri.d.setData(D, { volume: cfg.volume });
    tri.d.setLines(TH.buildIndicatorLines(D, cfg, 'D'));
    tri.d.setBand(h.days[d], h.days[d]);
    tri.d.showLast(110, 4);
    const from = Math.max(0, d - 30);
    const Hb = h.H.slice(h.dayH0[from], h.dayH0[d + 1]);
    tri.h.setData(Hb, { volume: cfg.volume });
    tri.h.setLines(TH.buildIndicatorLines(Hb, cfg, 'H'));
    const first = h.H[h.dayH0[d]].time, last = h.H[h.dayH0[d + 1] - 1].time;
    tri.h.setBand(first, last);
    tri.h.showRange(h.H[h.dayH0[Math.max(0, d - (h.ex.weekdays ? 6 : 3))]].time, last, 1, 4);
    tri.setSub('d', `${D.length} сессий · клик по бару — открыть день`);
    tri.setSub('h', `${d - from + 1} сессий · выбранный день подсвечен`);
    loadMinute();
    renderSummary();
    renderInspector();
    TH.$('#dPrev').disabled = d <= 0;
    TH.$('#dNext').disabled = d >= h.days.length - 1;
    TH.$('#dLast').classList.toggle('hidden', d >= h.days.length - 1);
  }

  function loadMinute() {
    const h = H(), cfg = S.data.indicators;
    const M = TH.data.minutes(st.sym, st.dayIdx, st.mtf);
    tri.m.setData(M, { volume: cfg.volume });
    tri.m.setLines(TH.buildIndicatorLines(M, cfg, 'M'));
    tri.m.fit();
    const ex = h.ex;
    const hh = (m) => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    tri.setSub('m', `${TH.d.dmShort(h.days[st.dayIdx])} · ${hh(ex.sessStart)}–${hh(ex.sessEnd)} ${ex.tz} · ${M.length} баров`);
  }

  function refreshIndicators() {
    if (!inited) return;
    const cfg = S.data.indicators;
    for (const c of [tri.d, tri.h, tri.m]) {
      const r = c.chart.timeScale().getVisibleLogicalRange();
      c.setData(c.bars, { volume: cfg.volume });
      c.setLines(TH.buildIndicatorLines(c.bars, cfg, c.tf));
      if (r) c.chart.timeScale().setVisibleLogicalRange(r);
    }
  }

  function dayStats() {
    const h = H(), d = st.dayIdx, b = h.D[d];
    const prev = d > 0 ? h.D[d - 1].close : b.open;
    const atr = TH.ind.atr(h.D.slice(Math.max(0, d - 40), d + 1), 14);
    const a = atr[atr.length - 1];
    const vols = h.D.slice(Math.max(0, d - 20), d).map((x) => x.volume);
    const avgV = vols.length ? TH.sum(vols) / vols.length : b.volume;
    return { b, prev, chg: b.close - prev, chgPct: (b.close / prev - 1) * 100, range: b.high - b.low, rangePct: ((b.high - b.low) / prev) * 100, atr: a, gap: ((b.open - prev) / prev) * 100, vRel: b.volume / avgV };
  }

  function renderSummary() {
    const h = H(), i = inst(), s = dayStats();
    const f = (v) => TH.fmt(v, i.dp);
    TH.$('#dDate').innerHTML = `<b>${TH.d.long(h.days[st.dayIdx])}</b><small>Сессия ${st.dayIdx + 1} из ${h.days.length} · ${h.ex.market}</small>`;
    TH.$('#dSum').innerHTML = `
      <div class="qs"><small>Open</small><b>${f(s.b.open)}</b></div>
      <div class="qs"><small>High</small><b>${f(s.b.high)}</b></div>
      <div class="qs"><small>Low</small><b>${f(s.b.low)}</b></div>
      <div class="qs"><small>Close</small><b>${f(s.b.close)}</b></div>
      <div class="qs"><small>Изм.</small><b class="${TH.cls(s.chg)}">${TH.pct(s.chgPct)}</b></div>
      <div class="qs opt"><small>Диапазон</small><b>${TH.pct(s.rangePct, 2, false)}</b></div>
      <div class="qs opt"><small>Объём</small><b>${TH.compact(s.b.volume)}</b></div>`;
  }

  function renderInspector() {
    const h = H(), i = inst(), s = dayStats();
    const f = (v) => TH.fmt(v, i.dp);
    const all = notesAll();
    const n = (all[st.sym] || {})[noteKey()] || { text: '', tags: [], rating: 0 };
    const rng = s.b.high - s.b.low || 1;
    const po = ((s.b.open - s.b.low) / rng) * 100, pc = ((s.b.close - s.b.low) / rng) * 100;
    const journal = Object.entries(all[st.sym] || {}).filter(([, v]) => v.text || (v.tags && v.tags.length) || v.rating).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 8);
    TH.$('#dayInspBody').innerHTML = `
      <div class="insp-sec">
        <div class="sec-title">Сессия <span class="r faint">${TH.d.wd(h.days[st.dayIdx])}</span></div>
        <div class="big-price"><b>${f(s.b.close)}</b><span class="${TH.cls(s.chg)}">${TH.fmtS(s.chg, i.dp)} · ${TH.pct(s.chgPct)}</span></div>
        <div class="stat-grid">
          <div><small>Пред. закрытие</small><b>${f(s.prev)}</b></div>
          <div><small>Гэп открытия</small><b class="${TH.cls(s.gap)}">${TH.pct(s.gap)}</b></div>
          <div><small>Диапазон</small><b>${f(s.range)} · ${TH.pct(s.rangePct, 2, false)}</b></div>
          <div><small>Диапазон / ATR 14</small><b>${s.atr ? TH.fmt(s.range / s.atr, 2) + '×' : '—'}</b></div>
          <div><small>Объём</small><b>${TH.compact(s.b.volume)}</b></div>
          <div><small>К среднему за 20</small><b class="${s.vRel >= 1 ? 'pos' : ''}">${TH.fmt(s.vRel, 2)}×</b></div>
        </div>
        <div class="range-bar">
          <div class="track"><span class="mk o" style="left:${po}%" title="Open"></span><span class="mk c" style="left:${pc}%" title="Close"></span></div>
          <div class="lbl"><span>L ${f(s.b.low)}</span><span>○ open · ● close</span><span>H ${f(s.b.high)}</span></div>
        </div>
      </div>
      <div class="insp-sec">
        <div class="sec-title">Заметки к сессии <span class="r faint" id="nSaved"></span></div>
        <div class="chips" id="nTags">${TAGS.map((t) => `<button class="chip ${n.tags.includes(t) ? 'on' : ''}" data-tag="${t}">${t}</button>`).join('')}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin:14px 0 8px"><span class="field-label">Оценка торговли</span><div class="stars" id="nStars">${[1, 2, 3, 4, 5].map((k) => `<button data-star="${k}" class="${k <= n.rating ? 'on' : ''}" title="${k}">${I('star', 17)}</button>`).join('')}</div></div>
        <textarea class="textarea" id="nText" placeholder="План на сессию, что сработало, ошибки, наблюдения…">${TH.esc(n.text)}</textarea>
        <div class="note-status" id="nStatus">${n.at ? `${I('check', 12, 2.4)} Сохранено ${TH.d.dmShort(n.at)} в ${TH.d.hm(n.at)}` : `${I('note', 12)} Сохраняется автоматически`}</div>
      </div>
      <div class="insp-sec">
        <div class="sec-title">Журнал · ${st.sym} <span class="r faint">${journal.length ? journal.length + ' зап.' : ''}</span></div>
        <div class="note-list">${journal.length ? journal.map(([iso, v]) => `
          <button class="note-item ${iso === noteKey() ? 'cur' : ''}" data-iso="${iso}">
            <div class="top"><span>${TH.d.med(TH.d.fromIso(iso))}</span><span style="color:var(--yellow);font-size:11px">${'★'.repeat(v.rating || 0)}</span></div>
            <div class="txt">${v.tags && v.tags.length ? `<span class="faint">${v.tags.join(' · ')}</span> ` : ''}${TH.esc(v.text || '')}</div>
          </button>`).join('') : '<div class="empty-note">Заметок пока нет. Напишите первую — она появится здесь.</div>'}</div>
      </div>`;
    const body = TH.$('#dayInspBody');
    body.querySelectorAll('[data-tag]').forEach((b) => (b.onclick = () => { b.classList.toggle('on'); saveNote(true); }));
    body.querySelectorAll('[data-star]').forEach((b) => (b.onclick = () => {
      const k = +b.dataset.star;
      const curR = body.querySelectorAll('[data-star].on').length;
      const v = curR === k ? 0 : k;
      body.querySelectorAll('[data-star]').forEach((x) => x.classList.toggle('on', +x.dataset.star <= v));
      saveNote(true);
    }));
    body.querySelector('#nText').oninput = () => {
      TH.$('#nStatus').innerHTML = `${I('clock', 12)} Изменено…`;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => saveNote(false), 600);
    };
    body.querySelectorAll('[data-iso]').forEach((b) => (b.onclick = () => {
      const idx = H().days.findIndex((t) => TH.d.iso(t) === b.dataset.iso);
      if (idx >= 0) setDay(idx);
    }));
  }

  function saveNote(rerenderJournal) {
    const body = TH.$('#dayInspBody');
    if (!body || !body.querySelector('#nText')) return;
    const all = notesAll();
    const text = body.querySelector('#nText').value;
    const tags = Array.from(body.querySelectorAll('[data-tag].on')).map((b) => b.dataset.tag);
    const rating = body.querySelectorAll('[data-star].on').length;
    all[st.sym] = all[st.sym] || {};
    const at = Math.floor(Date.now() / 1000) + H().ex.tzOffset * 3600;
    if (!text && !tags.length && !rating) delete all[st.sym][noteKey()];
    else all[st.sym][noteKey()] = { text, tags, rating, at };
    TH.store.set('notes', all);
    TH.$('#nStatus').innerHTML = `${I('check', 12, 2.4)} Сохранено в ${TH.d.hm(at)}`;
    if (rerenderJournal) {
      const ta = body.querySelector('#nText');
      const sel = [ta.selectionStart, ta.selectionEnd];
      const focused = document.activeElement === ta;
      renderInspector();
      if (focused) { const t2 = TH.$('#nText'); t2.focus(); t2.setSelectionRange(sel[0], sel[1]); }
    }
  }

  function openInstPicker(anchor) {
    TH.openInstPicker(anchor, {
      cur: st.sym,
      onPick: (sym) => {
        const curT = H().days[st.dayIdx];
        const nh = TH.data.history(sym);
        let idx = TH.data.dayIndexOf(nh, curT);
        if (idx < 0) idx = nh.days.length - 1;
        setInstrument(sym, idx);
      },
    });
  }

  function openIndicators(anchor) {
    const cfg = S.data.indicators;
    const wrap = TH.el(`<div class="ind-list"><div class="menu-label">Индикаторы · все графики</div>${TH.INDICATORS.map((d) => `
      <label class="ind-row"><span class="sw" style="background:${d.color}"></span><span class="t">${d.name}<small>${d.desc}</small></span><span class="switch sm"><input type="checkbox" data-ind="${d.id}" ${cfg[d.id] ? 'checked' : ''}><span></span></span></label>`).join('')}</div>`);
    const pop = TH.popover(anchor, wrap, { align: 'end' });
    if (!pop) return;
    wrap.querySelectorAll('[data-ind]').forEach((inp) => (inp.onchange = () => {
      cfg[inp.dataset.ind] = inp.checked;
      S.save();
      refreshIndicators();
    }));
  }

  function openCalendar(anchor) {
    const h = H();
    const idxByIso = {};
    h.days.forEach((t, i) => (idxByIso[TH.d.iso(t)] = i));
    const notes = notesAll()[st.sym] || {};
    const cd = new Date(h.days[st.dayIdx] * 1000);
    let y = cd.getUTCFullYear(), m = cd.getUTCMonth();
    const wrap = TH.el('<div class="cal"></div>');
    const minT = h.days[0], maxT = h.days[h.days.length - 1];
    const draw = () => {
      const first = Date.UTC(y, m, 1) / 1000;
      const dow = (new Date(first * 1000).getUTCDay() + 6) % 7;
      const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      let cells = '';
      for (let k = 0; k < dow; k++) cells += '<span></span>';
      for (let d = 1; d <= dim; d++) {
        const t = Date.UTC(y, m, d) / 1000;
        const iso = TH.d.iso(t);
        const idx = idxByIso[iso];
        if (idx == null) { cells += `<button class="cal-d na" disabled>${d}</button>`; continue; }
        const b = h.D[idx], pc = idx > 0 ? h.D[idx - 1].close : b.open;
        const r = b.close / pc - 1;
        const a = TH.clamp(Math.abs(r) / (h.inst.vol * 2.2), 0.06, 0.4).toFixed(2);
        cells += `<button class="cal-d ${r >= 0 ? 'up' : 'dn'} ${idx === st.dayIdx ? 'sel' : ''}" style="--a:${a}" data-idx="${idx}" title="${TH.pct(r * 100)}">${d}${notes[iso] ? '<i class="nd"></i>' : ''}</button>`;
      }
      const prevOk = Date.UTC(y, m, 1) / 1000 > minT, nextOk = Date.UTC(y, m + 1, 1) / 1000 <= maxT;
      wrap.innerHTML = `<div class="cal-head"><button class="btn plain sm icon" data-m="-1" ${prevOk ? '' : 'disabled'}>${I('chevL', 14, 2.2)}</button><b>${TH.d.month(Date.UTC(y, m, 15) / 1000)}</b><button class="btn plain sm icon" data-m="1" ${nextOk ? '' : 'disabled'}>${I('chevR', 14, 2.2)}</button></div>
        <div class="cal-grid">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((x) => `<span class="cal-dow">${x}</span>`).join('')}${cells}</div>
        <div class="cal-foot"><span><i style="background:rgba(48,209,88,.35)"></i>рост</span><span><i style="background:rgba(255,69,58,.35)"></i>падение</span><span><i style="background:var(--orange);border-radius:50%;width:6px;height:6px"></i>заметка</span></div>`;
    };
    draw();
    const pop = TH.popover(anchor, wrap, { align: 'center' });
    if (!pop) return;
    wrap.addEventListener('click', (e) => {
      const mb = e.target.closest('[data-m]');
      if (mb) { m += +mb.dataset.m; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } draw(); return; }
      const db = e.target.closest('[data-idx]');
      if (db) { pop.close(); setDay(+db.dataset.idx); }
    });
  }

  function key(e) {
    if (e.key === 'ArrowLeft') { shift(-1); return true; }
    if (e.key === 'ArrowRight') { shift(1); return true; }
    const map = { v: 'cursor', l: 'level', t: 'trend', z: 'zone', e: 'eraser' };
    const k = e.key.toLowerCase();
    const ru = { м: 'v', д: 'l', е: 't', я: 'z', у: 'e', ш: 'i' }[k] || k;
    if (map[ru]) { setTool(map[ru]); return true; }
    if (ru === 'i') { toggleInspector(); return true; }
    return false;
  }

  TH.views.day = {
    show() {
      if (!inited) init();
      else [tri.d, tri.h, tri.m].forEach((c) => c.redraw());
    },
    hide() { },
    key,
    open(sym) {
      TH.app.go('day');
      if (sym && sym !== st.sym) setInstrument(sym);
    },
  };
})();
