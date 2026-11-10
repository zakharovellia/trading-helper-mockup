(function () {
  const TH = window.TH;
  const I = TH.icon;
  const S = TH.S;
  const LWC = window.LightweightCharts;
  const CUR = '₽';

  const B0 = { tab: 'rating', market: 'all', period: 182, q: '', styles: [], author: 'all', onlyProfit: false, quality: true, minTrades: 30, maxDD: 50, sort: { key: 'rank', dir: 1 } };
  const st = {
    runs: TH.store.get('bt.runs4', []),
    results: {},
    view: { name: 'bank' },
    bank: Object.assign({}, B0, TH.store.get('bt.bank', {})),
    sideOpen: TH.store.get('bt.side', innerWidth > 700),
    running: false,
    sort: { key: 'ret', dir: -1 },
    tradeFilter: 'all',
    dayFilter: null,
    calMonth: null,
    insp: TH.store.get('bt.insp', true),
    showInd: true,
    showAll: true,
  };
  let root, content, inited = false, charts = [], tri = null, triKey = null, form = null;
  const BK = TH.bank;
  const ME = TH.users.ME;
  const bounds = BK.bounds;
  const saveBank = () => TH.store.set('bt.bank', st.bank);
  const sname = (res) => res.cfg.sname || res.strat.name;
  const mkLabel = (v) => (BK.MARKETS.find((m) => m.v === v) || BK.MARKETS[0]).label;
  const perLabel = (v) => (BK.PERIODS.find((p) => p.v === v) || BK.PERIODS[3]).label;
  const spanLabel = (v) => (v ? perLabel(v) : 'вся история');
  const pfTxtS = (pf) => (pf === 'inf' ? '∞' : TH.fmt(pf, 2));
  const myRunsOf = (sid) => st.runs.filter((r) => r.cfg.sid === sid);
  const runsCount = (e) => (e.baseRuns || 0) + myRunsOf(e.id).length;
  const symsLabel = (syms) => {
    const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
    const l = BK.lists().find((x) => same(x.syms, syms));
    if (l) return `${l.name} · ${syms.length}`;
    return syms.length <= 3 ? syms.join(', ') : `${syms.slice(0, 3).join(', ')} +${syms.length - 3}`;
  };
  const srcIco = (e) => { const s = BK.SRC[e.source] || BK.SRC.text; return `<span class="src-ico ${e.source}" title="${s.label}">${I(s.icon, 13)}</span>`; };
  const styleBadge = (e) => { const s = BK.styleOf(e); return s ? `<span class="badge gray">${TH.STYLES[s]}</span>` : ''; };
  const sk = (w = 60) => `<span class="sk" style="width:${w}px"></span>`;

  function defaultAcc() {
    return { capital: 1000000, risk: S.data.risk.finam, commission: 0.04, maxLev: TH.bt.MAX_LEV };
  }

  function ensureParams(sid) {
    const e = BK.get(sid);
    if (!e) return {};
    const P = BK.params(e);
    form.paramsBy[sid] = Object.assign(P, form.paramsBy[sid] || {});
    return form.paramsBy[sid];
  }
  function defaultForm() {
    const syms = TH.data.LIST.map((i) => i.sym);
    const { minF, maxT } = bounds(syms);
    return { sid: 'u_break30', syms, from: Math.max(minF, maxT - 182 * 86400), to: maxT, acc: defaultAcc(), slippage: 1, paramsBy: {}, share: false };
  }
  function loadForm() {
    const saved = TH.store.get('bt.form3', null);
    const def = defaultForm();
    form = saved ? Object.assign(def, saved, { acc: Object.assign(def.acc, saved.acc || {}), paramsBy: saved.paramsBy || {} }) : def;
    form.syms = form.syms.filter((s) => TH.data.inst(s));
    const e = BK.get(form.sid);
    if (!e || e.status !== 'ready') form.sid = 'u_break30';
    ensureParams(form.sid);
    if (S.data.riskToBacktest) form.acc.risk = S.data.risk.finam;
  }
  const saveForm = () => TH.store.set('bt.form3', form);

  function init() {
    inited = true;
    root = TH.$('#view-backtest');
    root.innerHTML = `
      <div class="bt ${st.sideOpen ? '' : 'side-closed'}" id="bt">
        <aside class="bt-side glass">
          <div class="side-head"><div class="side-title">Пересчёт стратегии</div><button class="btn plain icon" id="btHide" title="Скрыть панель">${I('sidebarL', 16)}</button></div>
          <div class="side-scroll">
            <div class="form-stack" id="btForm"></div>
            <div class="side-sec" style="margin-top:22px"><div class="sec-title">История запусков <span class="r faint" id="btHistN"></span></div><div class="run-list" id="btHist"></div></div>
          </div>
          <div class="side-foot"><button class="btn primary lg block" id="btRun">${I('play', 13)} Запустить бэктест</button></div>
        </aside>
        <div class="bt-main">
          <div class="bt-bar"><button class="btn plain icon ${st.sideOpen ? 'hidden' : ''}" id="btShow" title="Показать панель параметров">${I('sidebarL', 16)}</button><nav class="crumbs" id="btCrumbs"></nav><div class="bt-bar-actions" id="btActs"></div></div>
          <div class="bt-content" id="btContent"></div>
        </div>
      </div>`;
    content = TH.$('#btContent');
    TH.$('#btHide').onclick = () => setSide(false, true);
    TH.$('#btShow').onclick = () => setSide(true, true);
    TH.$('#btRun').onclick = () => startRun();
    loadForm();
    renderForm();
    renderHistory();
    go({ name: 'bank' });
  }

  function flashSide() {
    const el = TH.$('.bt-side');
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
    if (innerWidth <= 1080) el.scrollIntoView({ behavior: S.data.general.motion ? 'smooth' : 'auto', block: 'start' });
  }

  function useInForm(sid, { params, syms, span, acc, quiet } = {}) {
    const e = BK.get(sid);
    if (!e || e.status !== 'ready') return;
    form.sid = sid;
    ensureParams(sid);
    if (params) form.paramsBy[sid] = Object.assign({}, params);
    if (syms) form.syms = syms.slice();
    if (span != null) {
      const { minF, maxT } = bounds(form.syms);
      form.to = maxT;
      form.from = span ? Math.max(minF, maxT - span * 86400) : minF;
    }
    if (acc) form.acc = Object.assign({}, form.acc, acc);
    saveForm();
    renderForm();
    setSide(true, true);
    flashSide();
    if (!quiet) TH.toast(`«${BK.displayName(e)}» в форме слева`, { type: 'info', sub: params ? 'параметры и инструменты подставлены' : 'задайте свои инструменты и параметры' });
  }

  function openAdd() {
    TH.openAddStrategy({ onSubmit: (e) => { st.bank.tab = 'mine'; saveBank(); go({ name: 'strat', sid: e.id }); } });
  }

  function openPicker(anchor) {
    const meta = (e) => {
      const sp = BK.refSpec(e, 'all');
      const s = BK.summary(sp);
      if (!s) BK.compute(sp);
      return s ? s.p[0] : null;
    };
    const wrap = TH.el(`<div class="inst-list sp-list">
      <div class="inst-search"><div class="input-wrap"><input class="input" placeholder="Стратегия, автор или идея" data-q><span class="suffix">${I('search', 14)}</span></div></div>
      <div class="inst-rows" data-rows></div>
      <div class="sp-foot"><button class="btn sm plain" data-add>${I('mic', 13)} Добавить свою стратегию</button></div></div>`);
    const rows = wrap.querySelector('[data-rows]');
    const row = (e) => {
      const m = meta(e);
      const u = TH.users.get(e.author);
      return `<div class="inst-row ${e.id === form.sid ? 'cur' : ''}" data-sid="${e.id}">${TH.uAva(e.author, 26)}<div class="t"><b>${TH.esc(BK.displayName(e))}</b><small>@${TH.esc(u.handle)} · ${TH.STYLES[BK.styleOf(e)]}${BK.isMine(e) && !e.shared ? ' · только вы' : ''}</small></div><div class="p">${m ? `<b class="${TH.cls(m.ret)}">${TH.pct(m.ret, 1)}</b><small>${m.n} сд. · эталон</small>` : '<small>эталон считается…</small>'}</div></div>`;
    };
    const draw = (q) => {
      q = (q || '').toLowerCase();
      const match = (e) => !q || (BK.displayName(e) + ' ' + TH.users.get(e.author).handle + ' ' + e.text).toLowerCase().includes(q);
      const av = BK.available().filter(match);
      const my = av.filter((e) => BK.isMine(e));
      const oth = av.filter((e) => !BK.isMine(e)).sort((a, b) => ((meta(b) || { ret: -1e9 }).ret - (meta(a) || { ret: -1e9 }).ret));
      let html = '';
      if (my.length) html += `<div class="menu-label">Мои стратегии</div>` + my.map(row).join('');
      if (oth.length) html += `<div class="menu-label">Банк стратегий · по эталону</div>` + oth.map(row).join('');
      rows.innerHTML = html || '<div class="empty-note" style="padding:12px">Ничего не найдено</div>';
    };
    draw();
    const pop = TH.popover(anchor, wrap);
    if (!pop) return;
    const q = wrap.querySelector('[data-q]');
    q.oninput = () => draw(q.value);
    setTimeout(() => q.focus(), 30);
    rows.addEventListener('click', (ev) => {
      const r = ev.target.closest('[data-sid]');
      if (!r) return;
      pop.close();
      if (r.dataset.sid !== form.sid) { form.sid = r.dataset.sid; ensureParams(form.sid); saveForm(); renderForm(); }
    });
    wrap.querySelector('[data-add]').onclick = () => { pop.close(); openAdd(); };
  }

  function saveListDialog() {
    const m = TH.modal(`<div class="alert" style="text-align:left">
      <h3 style="text-align:center">Сохранить список инструментов</h3>
      <p style="text-align:center">${form.syms.join(', ')}</p>
      <div class="field" style="margin-top:14px"><input class="input" id="lsName" maxlength="28" placeholder="Название списка"></div>
      <div class="a-btns"><button class="btn" data-a="0">Отмена</button><button class="btn primary" data-a="1">Сохранить</button></div></div>`, { sheetClass: 'alert-sheet' });
    const inp = m.el.querySelector('#lsName');
    const ok = () => {
      const name = inp.value.trim();
      if (!name) { inp.focus(); return; }
      BK.saveList(name, form.syms);
      m.close();
      renderForm();
      TH.toast('Список сохранён', { sub: `${name} · ${form.syms.length} инстр.` });
    };
    m.el.querySelector('[data-a="0"]').onclick = () => m.close();
    m.el.querySelector('[data-a="1"]').onclick = ok;
    inp.onkeydown = (ev) => { if (ev.key === 'Enter') ok(); };
    setTimeout(() => inp.focus(), 50);
  }

  function setSide(open, user) {
    if (user) { st.sideOpen = open; TH.store.set('bt.side', open); }
    TH.$('#bt').classList.toggle('side-closed', !open);
    TH.$('#btShow').classList.toggle('hidden', open);
  }

  function renderForm() {
    const e = BK.get(form.sid);
    const strat = BK.engineOf(e);
    const P = ensureParams(e.id);
    const AP = BK.params(e);
    const u = TH.users.get(e.author);
    const all = TH.data.LIST.map((i) => i.sym);
    const { minF, maxT } = bounds(form.syms);
    if (form.from < minF) form.from = minF;
    if (form.to > maxT) form.to = maxT;
    const a = form.acc;
    const same = (x, y) => x.length === y.length && x.every((s) => y.includes(s));
    const lists = BK.lists();
    const nChg = strat.params.filter((p) => P[p.k] !== AP[p.k]).length;
    const fp = (p, v) => TH.fmt(v, p.step < 1 ? 1 : 0);
    const accBlock = () => `<div class="acc-form">
        <div class="af-head">${I('wallet', 16)}<div><b>Счёт бэктеста</b><small>единый счёт · валюта ${CUR}</small></div></div>
        <div class="fields-2">
          <div class="field"><label>Капитал</label><div class="input-wrap"><input class="input" type="number" data-acc="capital" min="100" step="100" value="${a.capital}"><span class="suffix">${CUR}</span></div></div>
          <div class="field"><label>Риск на сделку</label><div class="input-wrap"><input class="input" type="number" data-acc="risk" min="0.1" max="10" step="0.1" value="${a.risk}"><span class="suffix">%</span></div></div>
          <div class="field"><label>Комиссия, сторона</label><div class="input-wrap"><input class="input" type="number" data-acc="commission" min="0" step="0.005" value="${a.commission}"><span class="suffix">%</span></div></div>
          <div class="field"><label>Макс. плечо</label><div class="input-wrap"><input class="input" type="number" data-acc="maxLev" min="1" max="20" step="1" value="${a.maxLev}"><span class="suffix">×</span></div></div>
        </div></div>`;
    TH.$('#btForm').innerHTML = `
      <div class="field"><label style="display:flex;justify-content:space-between;align-items:center">Стратегия <button class="btn sm plain" id="fCard" style="height:20px;font-size:11.5px">Карточка ${I('chevR', 11, 2.2)}</button></label>
        <button class="sp-pick" id="fStrat">${TH.uAva(e.author, 30)}<span class="t"><b>${TH.esc(BK.displayName(e))}</b><small>@${TH.esc(u.handle)}${e.author === ME ? ' · вы' : ''} · ${TH.STYLES[strat.style]}</small></span>${I('chevUD', 14, 2)}</button>
        <div class="strat-desc clamp" title="${TH.esc(e.text)}">${e.source === 'code' ? '' : '«'}${TH.esc(e.text)}${e.source === 'code' ? '' : '»'}</div></div>
      <div class="field"><label style="display:flex;justify-content:space-between;align-items:center">Инструменты · ${form.syms.length} из ${all.length} <button class="btn sm plain" id="fAll" style="height:20px;font-size:11.5px">${form.syms.length === all.length ? 'Снять все' : 'Выбрать все'}</button></label>
        <div class="lists">${lists.map((l) => `<button class="list-chip ${same(l.syms, form.syms) ? 'on' : ''} ${l.user ? 'user' : ''}" data-list="${l.id}" title="${l.syms.join(', ')}">${l.user ? I('star', 10) : ''}${TH.esc(l.name)}<span class="n">${l.syms.length}</span>${l.user ? `<span class="lc-x" data-ldel="${l.id}" title="Удалить список">${I('close', 9, 2.6)}</span>` : ''}</button>`).join('')}${lists.some((l) => same(l.syms, form.syms)) || !form.syms.length ? '' : `<button class="list-chip add" id="fSaveList">${I('plus', 10, 2.4)} Сохранить список</button>`}</div>
        <div class="chips">${all.map((sym) => `<button class="chip ${form.syms.includes(sym) ? 'on' : ''}" data-sym="${sym}">${sym}</button>`).join('')}</div></div>
      <div class="field"><label>Период тестирования</label>
        <div id="fPreset"></div>
        <div class="fields-2" style="margin-top:6px"><input class="input" type="date" id="fFrom" min="${TH.d.iso(minF)}" max="${TH.d.iso(maxT)}" value="${TH.d.iso(form.from)}"><input class="input" type="date" id="fTo" min="${TH.d.iso(minF)}" max="${TH.d.iso(maxT)}" value="${TH.d.iso(form.to)}"></div></div>
      ${accBlock()}
      <div class="fields-2"><div class="field"><label>Проскальзывание</label><div class="input-wrap"><input class="input" type="number" id="fSlip" min="0" step="1" value="${form.slippage}"><span class="suffix">тик</span></div></div></div>
      <div class="field"><label style="display:flex;justify-content:space-between;align-items:center"><span>Параметры <span class="faint" id="fChg">${nChg ? `· изменено ${nChg}` : '· как у автора'}</span></span><button class="btn sm plain" id="fReset" style="height:20px;font-size:11.5px" ${nChg ? '' : 'disabled'}>Как у автора</button></label>
        <div class="params-box"><div class="fields-2">${strat.params.map((p) => `<div class="field ${P[p.k] !== AP[p.k] ? 'chg' : ''}" data-pf="${p.k}"><label>${p.label}<span class="was" title="Значение автора">${fp(p, AP[p.k])}</span></label><input class="input" type="number" data-p="${p.k}" min="${p.min}" max="${p.max}" step="${p.step}" value="${P[p.k]}"></div>`).join('')}</div></div></div>
      <label class="share-row"><span class="t"><b>${I('share', 13)} Опубликовать пересчёт</b><small>результат увидят автор и пользователи банка</small></span><span class="switch sm"><input type="checkbox" id="fShare" ${form.share ? 'checked' : ''}><span></span></span></label>
      <div class="faint" style="font-size:11.5px;line-height:1.45">Сигналы — на закрытии часового бара, вход — по открытию следующего. Стоп и цель проверяются по минутным барам. Счёт один, все инструменты считаются в одной валюте.</div>`;
    const presets = [{ v: 30, label: '1М' }, { v: 91, label: '3М' }, { v: 182, label: '6М' }, { v: 0, label: 'Всё' }];
    const span = (form.to - form.from) / 86400;
    const curP = presets.find((p) => (p.v === 0 ? form.from <= minF : Math.abs(p.v - span) <= 3 && form.from > minF));
    TH.seg(TH.$('#fPreset'), presets, curP ? curP.v : -1, (v) => {
      form.from = v === 0 ? minF : Math.max(minF, form.to - v * 86400);
      TH.$('#fFrom').value = TH.d.iso(form.from);
      saveForm();
    }, { size: 'sm' });
    const fs = TH.$('#btForm');
    fs.querySelector('#fStrat').onclick = (ev) => openPicker(ev.currentTarget);
    fs.querySelector('#fCard').onclick = () => go({ name: 'strat', sid: e.id });
    fs.querySelectorAll('[data-sym]').forEach((b) => (b.onclick = () => {
      const v = b.dataset.sym;
      form.syms = form.syms.includes(v) ? form.syms.filter((x) => x !== v) : all.filter((x) => x === v || form.syms.includes(x));
      saveForm();
      renderForm();
    }));
    fs.querySelectorAll('[data-list]').forEach((b) => (b.onclick = async (ev) => {
      if (ev.target.closest('[data-ldel]')) {
        ev.stopPropagation();
        const l = lists.find((x) => x.id === b.dataset.list);
        const ok = await TH.confirm({ title: `Удалить список «${TH.esc(l.name)}»?`, message: l.syms.join(', '), ok: 'Удалить', destructive: true, icon: 'trash' });
        if (ok) { BK.deleteList(l.id); renderForm(); }
        return;
      }
      const l = lists.find((x) => x.id === b.dataset.list);
      form.syms = all.filter((s) => l.syms.includes(s));
      saveForm();
      renderForm();
    }));
    const sl = fs.querySelector('#fSaveList');
    if (sl) sl.onclick = saveListDialog;
    fs.querySelector('#fAll').onclick = () => { form.syms = form.syms.length === all.length ? [] : all.slice(); saveForm(); renderForm(); };
    fs.querySelector('#fFrom').onchange = (ev) => { form.from = TH.d.fromIso(ev.target.value); saveForm(); renderForm(); };
    fs.querySelector('#fTo').onchange = (ev) => { form.to = TH.d.fromIso(ev.target.value); saveForm(); renderForm(); };
    fs.querySelectorAll('[data-acc]').forEach((inp) => (inp.onchange = () => { form.acc[inp.dataset.acc] = +inp.value; saveForm(); }));
    fs.querySelector('#fSlip').onchange = (ev) => { form.slippage = +ev.target.value; saveForm(); };
    const markChg = () => {
      const n = strat.params.filter((p) => P[p.k] !== AP[p.k]).length;
      strat.params.forEach((p) => fs.querySelector(`[data-pf="${p.k}"]`).classList.toggle('chg', P[p.k] !== AP[p.k]));
      fs.querySelector('#fChg').textContent = n ? `· изменено ${n}` : '· как у автора';
      fs.querySelector('#fReset').disabled = !n;
    };
    fs.querySelectorAll('[data-p]').forEach((inp) => (inp.onchange = () => { P[inp.dataset.p] = +inp.value; saveForm(); markChg(); }));
    fs.querySelector('#fReset').onclick = () => { strat.params.forEach((p) => (P[p.k] = AP[p.k])); saveForm(); renderForm(); };
    fs.querySelector('#fShare').onchange = (ev) => { form.share = ev.target.checked; saveForm(); };
  }

  function renderHistory() {
    const host = TH.$('#btHist');
    TH.$('#btHistN').textContent = st.runs.length ? st.runs.length : '';
    const curId = st.view.id;
    host.innerHTML = st.runs.length ? st.runs.map((r) => {
      return `<button class="run-item ${r.id === curId ? 'cur' : ''}" data-run="${r.id}">
        <div class="t"><b>${TH.esc(r.cfg.sname)} · #${r.cfg.n}</b><small>${r.cfg.share ? `<span class="pub" title="Пересчёт опубликован в банке">${I('share', 10)}</span>` : ''}@${TH.esc(TH.users.get(r.cfg.author).handle)} · ${r.cfg.syms.length} инстр. · ${TH.d.dmShort(r.cfg.from)} — ${TH.d.dmShort(r.cfg.to)}</small></div>
        <div class="r"><span class="rr ${TH.cls(r.sum.ret)}">${TH.pct(r.sum.ret, 1)}</span><small>${r.sum.n} сд.</small></div>
        <span class="btn plain sm icon run-del" data-del="${r.id}" title="Удалить запуск">${I('trash', 13)}</span>
      </button>`;
    }).join('') : '<div class="empty-note">Запусков пока нет</div>';
    host.querySelectorAll('[data-run]').forEach((b) => (b.onclick = async (e) => {
      if (e.target.closest('[data-del]')) {
        e.stopPropagation();
        const id = e.target.closest('[data-del]').dataset.del;
        const ok = await TH.confirm({ title: 'Удалить запуск?', message: 'Результаты можно будет получить повторным запуском с теми же параметрами.', ok: 'Удалить', destructive: true, icon: 'trash' });
        if (!ok) return;
        st.runs = st.runs.filter((r) => r.id !== id);
        delete st.results[id];
        persistRuns();
        renderHistory();
        if (st.view.id === id) go({ name: 'bank' });
        return;
      }
      openRun(b.dataset.run);
    }));
  }
  const persistRuns = () => TH.store.set('bt.runs4', st.runs.slice(0, 20));

  function progressUI(title) {
    destroyCharts();
    content.classList.remove('fill');
    content.innerHTML = `<div class="progress-wrap"><div class="glass progress-card">
      <div class="spinner"></div><h3>${title}</h3><p id="pgTxt">Подготовка…</p>
      <div class="progress"><i id="pgBar"></i></div>
      <div class="steps" id="pgSteps"><span>Котировки</span><span>Сигналы</span><span>Сделки</span><span>Метрики</span></div>
    </div></div>`;
    return (pct, label, stepI) => {
      const bar = TH.$('#pgBar'), txt = TH.$('#pgTxt');
      if (!bar) return;
      bar.style.width = pct + '%';
      txt.textContent = label;
      TH.$$('#pgSteps span').forEach((s, i) => { s.className = i + 1 < stepI ? 'done' : i + 1 === stepI ? 'cur' : ''; });
    };
  }

  async function compute(cfg, title) {
    const prog = progressUI(title);
    const t0 = performance.now();
    const res = await TH.bt.run(cfg, prog);
    res.calcMs = performance.now() - t0;
    const wait = Math.max(0, 900 - res.calcMs);
    await new Promise((r) => setTimeout(r, wait));
    st.results[cfg.id] = res;
    return res;
  }

  async function startRun() {
    if (st.running) return;
    if (!form.syms.length) { TH.toast('Выберите хотя бы один инструмент', { type: 'warn' }); return; }
    if (form.from >= form.to) { TH.toast('Дата начала должна быть раньше даты окончания', { type: 'warn' }); return; }
    st.running = true;
    const btn = TH.$('#btRun');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:15px;height:15px;border-width:2px;margin:0;border-top-color:#fff"></span> Выполняется…';
    const n = st.runs.reduce((m, r) => Math.max(m, r.cfg.n), 0) + 1;
    const ent = BK.get(form.sid);
    const cfg = {
      id: TH.uid(), n, sid: ent.id, engine: ent.engine, strategy: ent.engine, sname: BK.displayName(ent), author: ent.author, share: !!form.share,
      syms: form.syms.slice(), from: form.from, to: form.to, acc: Object.assign({}, form.acc), slippage: form.slippage,
      params: Object.assign({}, form.paramsBy[form.sid]), authorParams: BK.params(ent), at: Math.floor(Date.now() / 1000),
    };
    try {
      const res = await compute(cfg, `Пересчёт «${TH.esc(cfg.sname)}»`);
      st.runs.unshift({ id: cfg.id, cfg, sum: { n: res.trades.length, ret: res.acc.m.ret } });
      persistRuns();
      go({ name: 'run', id: cfg.id });
      TH.toast(`Бэктест #${n} готов`, { sub: `${res.trades.length} сделок · ${TH.pct(res.acc.m.ret, 1)}${cfg.share ? ' · опубликован в банке' : ''}` });
    } catch (e) {
      console.error(e);
      TH.toast('Ошибка расчёта', { type: 'error', sub: String(e.message || e) });
    }
    st.running = false;
    btn.disabled = false;
    btn.innerHTML = `${I('play', 13)} Запустить бэктест`;
  }

  async function openRun(id, view) {
    const r = st.runs.find((x) => x.id === id);
    if (!r) { go({ name: 'bank' }); return; }
    if (!st.results[id]) await compute(r.cfg, `Загрузка запуска #${r.cfg.n}`);
    go(view || { name: 'run', id });
  }

  function destroyCharts() {
    charts.forEach((c) => c.destroy());
    charts = [];
    if (tri) { tri.destroy(); tri = null; triKey = null; }
  }

  function go(view) {
    const prev = st.view;
    st.view = view;
    if (prev.id !== view.id) { st.dayFilter = null; st.calMonth = null; }
    const keepTri = view.name === 'trade' && prev.name === 'trade' && prev.id === view.id && prev.sym === view.sym && tri;
    if (!keepTri) destroyCharts();
    setSide(view.name === 'trade' ? false : st.sideOpen, false);
    renderCrumbs();
    renderHistory();
    content.classList.toggle('fill', view.name === 'trade');
    if (view.name === 'bank') { renderBank(); if (prev.name !== 'bank') content.scrollTop = 0; return; }
    if (view.name === 'strat') { renderStrat(view.sid); if (prev.name !== 'strat' || prev.sid !== view.sid) content.scrollTop = 0; return; }
    const res = st.results[view.id];
    if (!res) { openRun(view.id, view); return; }
    if (view.name === 'run') renderRun(res);
    else if (view.name === 'inst') renderInst(res, view.sym);
    else if (view.name === 'trade') renderTrade(res, view.sym, view.k, keepTri);
    if (view.name !== 'trade') content.scrollTop = 0;
  }

  function renderCrumbs() {
    const v = st.view;
    const res = v.id ? st.results[v.id] : null;
    const parts = [{ label: 'Банк стратегий', go: { name: 'bank' } }];
    if (v.name === 'strat') { const e = BK.get(v.sid); parts.push({ label: e ? BK.displayName(e) : '…', go: null }); }
    if (res) {
      const c = res.cfg;
      parts.push({ label: c.sname, go: BK.get(c.sid) ? { name: 'strat', sid: c.sid } : null });
      parts.push({ label: c.ref ? `Эталон · ${mkLabel(c.market)}` : `Run #${c.n}`, go: { name: 'run', id: v.id } });
      if (v.name === 'inst' || v.name === 'trade') parts.push({ label: v.sym, go: { name: 'inst', id: v.id, sym: v.sym } });
      if (v.name === 'trade') parts.push({ label: `Сделка #${res.bySym[v.sym].trades[v.k].n}`, go: null });
    }
    const host = TH.$('#btCrumbs');
    host.innerHTML = `<span style="color:var(--label-3);display:flex;margin-right:2px">${I('flask', 15)}</span>` + parts.map((p, i) => `${i ? `<span class="sep">${I('chevR', 12, 2)}</span>` : ''}<button class="${i === parts.length - 1 ? 'cur' : ''}" data-i="${i}">${TH.esc(p.label)}</button>`).join('');
    host.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => { const p = parts[+b.dataset.i]; if (p.go && +b.dataset.i !== parts.length - 1) go(p.go); }));
  }

  const kpi = (label, v, sub, cls = '') => `<div class="glass kpi"><small>${label}</small><div class="v ${cls}">${v}</div><div class="s">${sub}</div></div>`;
  const pfTxt = (pf) => (pf === Infinity ? '∞' : TH.fmt(pf, 2));

  function equityChart(el, eq, bench, capital, cur, { dd = true } = {}) {
    const fmtM = (v) => TH.fmt(v, 0);
    const c = LWC.createChart(el, TH.chartTheme({
      rightPriceScale: { scaleMargins: { top: 0.08, bottom: dd ? 0.3 : 0.06 } },
      timeScale: { timeVisible: false, rightOffset: 2 },
      localization: { locale: 'ru-RU', timeFormatter: (t) => TH.d.med(t) },
      crosshair: { horzLine: { visible: true } },
    }));
    const s = c.addBaselineSeries({
      baseValue: { type: 'price', price: capital },
      topLineColor: '#0A84FF', topFillColor1: 'rgba(10,132,255,0.30)', topFillColor2: 'rgba(10,132,255,0.02)',
      bottomLineColor: '#FF453A', bottomFillColor1: 'rgba(255,69,58,0.02)', bottomFillColor2: 'rgba(255,69,58,0.28)',
      lineWidth: 2, priceLineVisible: false, priceFormat: { type: 'custom', formatter: fmtM, minMove: 1 },
    });
    s.setData(eq.map((e) => ({ time: e.time, value: e.value })));
    if (bench) {
      const b = c.addLineSeries({ color: 'rgba(235,235,245,.42)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, priceFormat: { type: 'custom', formatter: fmtM, minMove: 1 } });
      b.setData(bench);
    }
    if (dd) {
      let peak = -Infinity;
      const dds = eq.map((e) => { peak = Math.max(peak, e.value); return { time: e.time, value: (e.value / peak - 1) * 100 }; });
      const d = c.addBaselineSeries({
        priceScaleId: 'dd', baseValue: { type: 'price', price: 0 },
        topLineColor: 'rgba(0,0,0,0)', topFillColor1: 'rgba(0,0,0,0)', topFillColor2: 'rgba(0,0,0,0)',
        bottomLineColor: 'rgba(255,69,58,.85)', bottomFillColor1: 'rgba(255,69,58,.10)', bottomFillColor2: 'rgba(255,69,58,.38)',
        lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
        priceFormat: { type: 'custom', formatter: (v) => TH.fmt(v, 1) + '%', minMove: 0.01 },
      });
      c.priceScale('dd').applyOptions({ scaleMargins: { top: 0.76, bottom: 0.02 } });
      d.setData(dds);
    }
    c.timeScale().fitContent();
    return { destroy: () => c.remove(), chart: c };
  }

  function instRows(res) {
    const rows = res.cfg.syms.map((sym) => {
      const b = res.bySym[sym];
      return { sym, inst: TH.data.inst(sym), n: b.m.n, wr: b.m.winRate, pf: b.m.pf, net: b.m.net, ret: b.m.ret, mdd: b.m.mdd, sharpe: b.m.sharpe, avgR: b.m.avgR, eq: b.eq };
    });
    const { key, dir } = st.sort;
    rows.sort((a, b) => (key === 'sym' ? a.sym.localeCompare(b.sym) : (a[key] === Infinity ? 1e9 : a[key]) - (b[key] === Infinity ? 1e9 : b[key])) * dir);
    return rows;
  }

  function renderInstTable(res) {
    const host = TH.$('#instTbl');
    const rows = instRows(res);
    const cols = [['sym', 'Инструмент', ''], ['n', 'Сделок', 'r'], ['wr', 'Win rate', 'r'], ['pf', 'PF', 'r'], ['net', 'P&L', 'r'], ['ret', 'К капиталу', 'r'], ['mdd', 'Макс. DD', 'r'], ['sharpe', 'Sharpe', 'r'], ['avgR', 'Ср. R', 'r']];
    const th = cols.map(([k, l, c]) => `<th class="sort ${c} ${st.sort.key === k ? 'sorted' : ''}" data-k="${k}">${l}${st.sort.key === k ? `<span class="arr">${st.sort.dir > 0 ? '▲' : '▼'}</span>` : ''}</th>`).join('');
    host.innerHTML = `<table class="tbl"><thead><tr>${th}<th>Кривая</th><th></th></tr></thead><tbody>${rows.map((r) => {
      const step = Math.max(1, Math.floor(r.eq.length / 40));
      const sp = r.eq.filter((_, i) => i % step === 0 || i === r.eq.length - 1).map((e) => e.value);
      return `<tr class="click" data-sym="${r.sym}">
        <td><div class="sym">${TH.ava(r.sym)}<div><b>${r.sym}</b><small>${TH.esc(r.inst.name)}</small></div></div></td>
        <td class="r">${r.n}</td><td class="r">${TH.pct(r.wr, 1, false)}</td><td class="r">${pfTxt(r.pf)}</td>
        <td class="r ${TH.cls(r.net)}"><b>${TH.moneyS(r.net, CUR)}</b></td><td class="r ${TH.cls(r.ret)}">${TH.pct(r.ret, 2)}</td>
        <td class="r neg">${TH.pct(r.mdd, 2)}</td><td class="r">${TH.fmt(r.sharpe, 2)}</td><td class="r ${TH.cls(r.avgR)}">${TH.fmtS(r.avgR, 2)}</td>
        <td>${TH.spark(sp, { w: 86, h: 24, color: r.net >= 0 ? '#30D158' : '#FF453A' })}</td>
        <td class="r go">${I('chevR', 14, 2.2)}</td></tr>`;
    }).join('')}</tbody></table>`;
    host.querySelectorAll('th[data-k]').forEach((h) => (h.onclick = () => {
      const k = h.dataset.k;
      st.sort = { key: k, dir: st.sort.key === k ? -st.sort.dir : k === 'sym' ? 1 : -1 };
      renderInstTable(res);
    }));
    host.querySelectorAll('tr[data-sym]').forEach((tr) => (tr.onclick = () => go({ name: 'inst', id: res.cfg.id, sym: tr.dataset.sym })));
  }

  function tradesTable(host, res, trades, { showSym = true, onOpen }) {
    host.innerHTML = `<table class="tbl"><thead><tr><th>#</th>${showSym ? '<th>Инструмент</th>' : ''}<th>Сторона</th><th>Вход</th><th class="r">Цена</th><th>Выход</th><th class="r">Цена</th><th>Причина</th><th class="r">Объём</th><th class="r">P&L</th><th class="r">R</th><th class="r">Длит.</th><th></th></tr></thead>
      <tbody>${trades.length ? trades.map((t) => {
        const inst = TH.data.inst(t.sym);
        const f = (v) => TH.fmt(v, inst.dp);
        const qd = inst.lot < 1 ? Math.max(0, -Math.floor(Math.log10(inst.lot))) : 0;
        return `<tr class="click" data-sym="${t.sym}" data-n="${t.n}">
          <td class="faint">${t.n}</td>${showSym ? `<td><b>${t.sym}</b></td>` : ''}
          <td><span class="badge ${t.dir > 0 ? 'long' : 'short'}">${t.dir > 0 ? 'LONG' : 'SHORT'}</span></td>
          <td>${TH.d.dmhm(t.entryTime)}</td><td class="r">${f(t.entryPrice)}</td>
          <td>${TH.d.dmhm(t.exitTime)}</td><td class="r">${f(t.exitPrice)}</td>
          <td><span class="badge ${t.reason === 'tp' ? 'long' : t.reason === 'sl' ? 'short' : 'gray'}">${t.reasonLabel}</span></td>
          <td class="r">${TH.fmt(t.qty, qd)}</td>
          <td class="r ${TH.cls(t.pnl)}"><b>${TH.moneyS(t.pnl, CUR)}</b></td>
          <td class="r ${TH.cls(t.R)}">${TH.fmtS(t.R, 2)}</td>
          <td class="r faint">${TH.dur(t.exitTime - t.entryTime)}</td>
          <td class="r go">${I('candles', 14)}</td></tr>`;
      }).join('') : `<tr class="empty-row"><td colspan="13">Сделок нет</td></tr>`}</tbody></table>`;
    host.querySelectorAll('tr[data-n]').forEach((tr) => (tr.onclick = () => {
      const sym = tr.dataset.sym, n = +tr.dataset.n;
      const k = res.bySym[sym].trades.findIndex((t) => t.n === n);
      onOpen ? onOpen(sym, k) : go({ name: 'trade', id: res.cfg.id, sym, k });
    }));
  }

  function heatmap(mo) {
    const keys = Object.keys(mo).sort();
    if (!keys.length) return '<div class="faint">Нет данных</div>';
    const years = [...new Set(keys.map((k) => k.slice(0, 4)))];
    const mx = Math.max(...keys.map((k) => Math.abs(mo[k])), 0.5);
    const names = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    const cell = (v) => {
      if (v == null) return '<td class="na">·</td>';
      const a = (0.12 + (Math.abs(v) / mx) * 0.5).toFixed(2);
      const bg = v >= 0 ? `rgba(48,209,88,${a})` : `rgba(255,69,58,${a})`;
      return `<td style="background:${bg}" title="${TH.pct(v, 2)}">${TH.fmtS(v, 1)}</td>`;
    };
    const rows = years.map((y) => {
      let yr = 1;
      const cells = names.map((_, i) => {
        const k = `${y}-${String(i + 1).padStart(2, '0')}`;
        if (mo[k] != null) yr *= 1 + mo[k] / 100;
        return cell(mo[k]);
      });
      return `<tr><td class="y">${y}</td>${cells.slice(0, 6).join('')}</tr><tr><td class="y"></td>${cells.slice(6).join('')}</tr><tr><td class="y faint" style="font-size:10.5px;font-weight:500">итого</td><td colspan="6" style="text-align:left;padding-left:4px" class="${TH.cls(yr - 1)}"><b>${TH.pct((yr - 1) * 100, 2)}</b></td></tr>`;
    });
    return `<table class="heat"><thead><tr><th></th>${names.slice(0, 6).map((n, i) => `<th>${n}<span class="faint"> / ${names[i + 6]}</span></th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
  }

  function histogram(res) {
    const { edges, bins } = res.hist;
    const mx = Math.max(...bins, 1);
    const avgR = res.trades.length ? TH.sum(res.trades, (t) => t.R) / res.trades.length : 0;
    const bw = `<dt>Лучшая / худшая</dt><dd><span class="pos">${TH.moneyS(res.acc.m.best, CUR)}</span> / <span class="neg">${TH.moneyS(res.acc.m.worst, CUR)}</span></dd>`;
    return `<div class="hist">${bins.map((b, i) => `<div class="b" title="${edges[i]}…${edges[i + 1]} R: ${b}"><span>${b || ''}</span><i style="height:${(b / mx) * 86}%;background:${edges[i] < 0 ? 'linear-gradient(180deg,#FF6B61,rgba(255,69,58,.45))' : 'linear-gradient(180deg,#4CE07F,rgba(48,209,88,.45))'}"></i></div>`).join('')}</div>
      <div class="hist-x">${bins.map((_, i) => `<span>${i % 2 === 0 ? TH.fmt(edges[i], 1).replace(',0', '') : ''}</span>`).join('')}</div>
      <dl class="kv" style="margin-top:12px"><dt>Ожидание · все сделки</dt><dd class="${TH.cls(avgR)}">${TH.fmtS(avgR, 2)} R</dd>${bw}</dl>`;
  }

  function paramsKv(res) {
    const c = res.cfg;
    const AP = c.authorParams || {};
    const P = res.strat.params.map((p) => {
      const ch = AP[p.k] != null && AP[p.k] !== c.params[p.k];
      return `<dt>${p.label}</dt><dd${ch ? ' class="chg-v" title="У автора: ' + TH.fmt(AP[p.k], p.step < 1 ? 1 : 0) + '"' : ''}>${ch ? `<s>${TH.fmt(AP[p.k], p.step < 1 ? 1 : 0)}</s> ` : ''}${TH.fmt(c.params[p.k], p.step < 1 ? 1 : 0)}</dd>`;
    }).join('');
    const ent = BK.get(c.sid);
    const a = res.acc;
    const A = `<div class="kv-sep"></div>
      <dt class="kv-ex">${I('wallet', 14)} Счёт бэктеста</dt><dd class="faint">${a.syms.length} инстр.</dd>
      <dt>Капитал</dt><dd>${TH.money(a.cfg.capital, CUR)}</dd>
      <dt>Риск на сделку</dt><dd>${TH.fmt(a.cfg.risk, 1)}%</dd>
      <dt>Комиссия</dt><dd>${TH.fmt(a.cfg.commission, 3)}% / сторона</dd>
      <dt>Макс. плечо</dt><dd>×${a.cfg.maxLev}</dd>`;
    return `<dl class="kv">
      <dt>Стратегия</dt><dd>${TH.esc(sname(res))}</dd>
      <dt>Автор</dt><dd>${c.author ? '@' + TH.esc(TH.users.get(c.author).handle) + (c.author === ME ? ' · вы' : '') : '—'}</dd>
      <dt>Класс</dt><dd class="faint">${TH.esc((ent && ent.cls) || res.strat.id)}</dd>
      <dt>Шаблон</dt><dd class="faint">${res.strat.id}</dd>
      <dt>Данные</dt><dd>таблица quotes · все биржи</dd>
      <dt>Таймфрейм сигналов</dt><dd>H1 · исполнение M1</dd>
      <dt>Период</dt><dd>${TH.d.dmy(c.from)} — ${TH.d.dmy(c.to)}</dd>
      <dt>Инструменты</dt><dd title="${c.syms.join(', ')}">${c.syms.join(', ')}</dd>
      <dt>Проскальзывание</dt><dd>${c.slippage} тик</dd>
      ${A}
      <div class="kv-sep"></div>
      ${P}
      <div class="kv-sep"></div>
      <dt>${c.ref ? 'Рейтинг обновлён' : 'Запущен'}</dt><dd>${TH.d.dmy(c.at + 10800)} ${TH.d.hm(c.at + 10800)}</dd>
      ${c.ref ? '' : `<dt>Публикация</dt><dd>${c.share ? 'в банке стратегий' : 'только вы'}</dd>`}
      <dt>Время расчёта</dt><dd>${TH.fmt((res.calcMs || 0) / 1000, 2)} с</dd>
    </dl>`;
  }

  function metricsKv(m, cur) {
    return `<div class="grid-2">
      <dl class="kv">
        <dt>Валовая прибыль</dt><dd class="pos">${TH.moneyS(m.gp, cur)}</dd>
        <dt>Валовый убыток</dt><dd class="neg">${TH.moneyS(-m.gl, cur)}</dd>
        <dt>Средняя прибыльная</dt><dd class="pos">${TH.moneyS(m.avgWin, cur)}</dd>
        <dt>Средняя убыточная</dt><dd class="neg">${TH.moneyS(m.avgLoss, cur)}</dd>
        <dt>Ожидание на сделку</dt><dd class="${TH.cls(m.expectancy)}">${TH.moneyS(m.expectancy, cur)}</dd>
        <dt>Комиссии</dt><dd>${TH.money(m.comm, cur)}</dd>
        <dt>Recovery factor</dt><dd>${m.recovery == null ? '—' : TH.fmt(m.recovery, 2)}</dd>
        <dt>Calmar</dt><dd>${m.calmar == null ? '—' : TH.fmt(m.calmar, 2)}</dd>
      </dl>
      <dl class="kv">
        <dt>Long · сделок / win</dt><dd>${m.longs} · ${TH.pct(m.longWR, 1, false)}</dd>
        <dt>Long · P&L</dt><dd class="${TH.cls(m.longPnl)}">${TH.moneyS(m.longPnl, cur)}</dd>
        <dt>Short · сделок / win</dt><dd>${m.shorts} · ${TH.pct(m.shortWR, 1, false)}</dd>
        <dt>Short · P&L</dt><dd class="${TH.cls(m.shortPnl)}">${TH.moneyS(m.shortPnl, cur)}</dd>
        <dt>Серия прибыльных</dt><dd>${m.maxCW}</dd>
        <dt>Серия убыточных</dt><dd>${m.maxCL}</dd>
        <dt>Среднее удержание</dt><dd>${TH.dur(m.avgHold)}</dd>
        <dt>Время в рынке</dt><dd>${TH.pct(m.exposure, 1, false)}</dd>
      </dl></div>`;
  }

  function kpiRow(m, cur, capital) {
    return kpi('Чистая прибыль', TH.moneyS(m.net, cur), `${TH.pct(m.ret, 2)} к капиталу`, TH.cls(m.net)) +
      kpi('CAGR', TH.pct(m.cagr, 1), 'годовых', TH.cls(m.cagr)) +
      kpi('Макс. просадка', TH.pct(m.mdd, 2), TH.money(-m.mddMoney, cur), 'neg') +
      kpi('Sharpe', TH.fmt(m.sharpe, 2), `Sortino ${TH.fmt(m.sortino, 2)}`, m.sharpe >= 1 ? 'pos' : '') +
      kpi('Profit factor', pfTxt(m.pf), `${TH.compact(m.gp)} / ${TH.compact(m.gl)}`, m.pf >= 1 ? 'pos' : 'neg') +
      kpi('Win rate', TH.pct(m.winRate, 1, false), `${m.wins} приб. · ${m.losses} убыт.`) +
      kpi('Сделок', String(m.n), `${m.longs} long · ${m.shorts} short`) +
      kpi('Средняя сделка', TH.fmtS(m.avgR, 2) + ' R', TH.moneyS(m.expectancy, cur), TH.cls(m.avgR));
  }

  const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };

  function renderDailyCal(res) {
    const host = TH.$('#dCal');
    if (!host) return;
    const c = res.cfg;
    const lo = ym(c.from), hi = ym(c.to);
    if (st.calMonth == null || st.calMonth < lo || st.calMonth > hi) st.calMonth = hi;
    const cm = st.calMonth;
    const y = Math.floor(cm / 12), mo = cm % 12;
    TH.$('#calTitle').textContent = `${MONTHS[mo]} ${y}`;
    TH.$('#calPrev').disabled = cm <= lo;
    TH.$('#calNext').disabled = cm >= hi;
    const first = Date.UTC(y, mo, 1) / 1000;
    const dim = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    const dow = (new Date(first * 1000).getUTCDay() + 6) % 7;
    const a = res.acc, dl = a.daily;
    const vals = Object.values(dl).map((v) => Math.abs(v.ret));
    const mx = Math.max(0.25, ...vals.sort((p, q) => p - q).slice(Math.floor(vals.length * 0.9)));
    const inP = (t) => t >= a.days[a.fromIdx] && t <= a.days[a.toIdx];
    let cells = '', mRet = 1, mPnl = 0, up = 0, tot = 0, wk = 1, wkPnl = 0, wkAny = false, col = dow;
    for (let k = 0; k < dow; k++) cells += '<span class="dc pad"></span>';
    const flushWeek = () => {
      cells += wkAny ? `<span class="dc wk ${TH.cls(wk - 1)}" title="Неделя: ${TH.pct((wk - 1) * 100, 2)} · ${TH.moneyS(wkPnl, CUR)}"><b>${TH.fmtS((wk - 1) * 100, 1)}</b></span>` : '<span class="dc wk"></span>';
      wk = 1; wkPnl = 0; wkAny = false;
    };
    for (let d = 1; d <= dim; d++) {
      const t = Date.UTC(y, mo, d) / 1000;
      const key = TH.d.iso(t);
      const v = dl[key];
      if (v && inP(t)) {
        const al = TH.clamp(Math.abs(v.ret) / mx, 0, 1) * 0.55 + 0.08;
        const bg = v.ret > 0 ? `rgba(48,209,88,${al.toFixed(2)})` : v.ret < 0 ? `rgba(255,69,58,${al.toFixed(2)})` : 'rgba(255,255,255,.05)';
        const sel = st.dayFilter === key;
        cells += `<button class="dc ${v.n ? 'has' : ''} ${sel ? 'sel' : ''}" style="background:${bg}" data-day="${key}" title="${TH.d.dmy(t)} · ${TH.pct(v.ret, 2)} · ${TH.moneyS(v.pnl, CUR)} · закрыто сделок: ${v.n}"><i>${d}</i><b>${v.ret === 0 ? '0' : TH.fmtS(v.ret, Math.abs(v.ret) >= 10 ? 0 : 1)}</b>${v.n ? `<em>${v.n}</em>` : ''}</button>`;
        mRet *= 1 + v.ret / 100; mPnl += v.pnl; wk *= 1 + v.ret / 100; wkPnl += v.pnl; wkAny = true;
        tot++; if (v.ret > 0) up++;
      } else {
        const off = inP(t);
        cells += `<span class="dc ${off ? 'off' : 'out'}" title="${off ? 'Нет торгов' : 'Вне периода теста'}"><i>${d}</i></span>`;
      }
      col++;
      if (col === 7) { flushWeek(); col = 0; }
    }
    if (col) { for (let k = col; k < 7; k++) cells += '<span class="dc pad"></span>'; flushWeek(); }
    host.innerHTML = `<div class="dcal">
      <div class="dcal-head">${I('wallet', 14)}<b>Счёт бэктеста</b><span class="${TH.cls(mRet - 1)} tnum">${TH.pct((mRet - 1) * 100, 2)} · ${TH.moneyS(mPnl, CUR)}</span><span class="grow"></span><span class="faint">${up} из ${tot} дн. в плюс</span></div>
      <div class="dcal-grid">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс', 'Нед.'].map((x) => `<span class="dc-dow">${x}</span>`).join('')}${cells}</div>
    </div>`;
    host.querySelectorAll('[data-day]').forEach((b) => (b.onclick = () => {
      st.dayFilter = st.dayFilter === b.dataset.day ? null : b.dataset.day;
      renderDailyCal(res);
      drawTrades(res);
      if (st.dayFilter) TH.$('#allTradesCard').scrollIntoView({ behavior: S.data.general.motion ? 'smooth' : 'auto', block: 'start' });
    }));
  }

  function drawTrades(res) {
    const df = st.dayFilter;
    const list = res.trades.filter((t) => (st.tradeFilter === 'all' || (st.tradeFilter === 'win' ? t.pnl > 0 : t.pnl <= 0)) && (!df || TH.d.iso(Math.floor(t.exitTime / 86400) * 86400) === df));
    TH.$('#trCount').textContent = `${list.length} из ${res.trades.length}`;
    const chip = TH.$('#trDay');
    chip.innerHTML = df ? `<button class="chip on" id="trDayClr" title="Сбросить фильтр по дню">закрыты ${TH.d.dmShort(TH.d.fromIso(df))} ${I('close', 11, 2.4)}</button>` : '';
    if (df) chip.querySelector('#trDayClr').onclick = () => { st.dayFilter = null; renderDailyCal(res); drawTrades(res); };
    tradesTable(TH.$('#allTrades'), res, list.slice().reverse(), { showSym: true });
  }

  function renderRun(res) {
    const c = res.cfg;
    const a = res.acc;
    TH.$('#btActs').innerHTML = `<button class="btn" id="rClone" title="Подставить параметры запуска в форму">${I('copy', 14)} В форму</button><button class="btn" id="rExport">${I('export', 14)} Экспорт CSV</button>`;
    const eqSub = `${TH.money(a.cfg.capital, CUR)} → ${TH.money(a.m.final, CUR)}`;
    const legend = '<span><i style="background:#0A84FF"></i>Стратегия</span><span><i style="background:rgba(235,235,245,.45)"></i>Buy & Hold</span><span><i style="background:#FF453A"></i>Просадка</span>';
    content.innerHTML = `<div class="page">
      <div class="page-head"><div><h1>${TH.esc(sname(res))} ${c.ref ? `<span class="badge orange">Эталонный прогон · ${mkLabel(c.market)}</span>` : `<span class="badge blue">Run #${c.n}</span>`}</h1>
        <div class="sub">${c.author ? `${TH.uChip(c.author, { size: 18 })} · ` : ''}${c.ref ? 'параметры автора · ' : ''}Счёт бэктеста · ${TH.money(a.cfg.capital, CUR)} · ${c.syms.length} инструм. · ${TH.d.med(c.from)} — ${TH.d.med(c.to)} · ${res.trades.length} сделок</div></div></div>
      <div class="kpis">${kpiRow(a.m, CUR, a.cfg.capital)}</div>
      <div class="grid-main">
        <div class="glass card eq-card"><div class="card-head"><span class="card-title">Кривая капитала</span><span class="card-sub">${eqSub}</span>
          <div class="legend-inline">${legend}</div></div>
          <div class="chart-box tall" id="eqChart"></div></div>
        <div class="glass card"><div class="card-head"><span class="card-title">Параметры запуска</span></div>${paramsKv(res)}</div>
      </div>
      <div class="glass card"><div class="card-head"><span class="card-title">Календарь доходности по дням</span><span class="card-sub">доходность счёта за день · клик — сделки, закрытые в этот день</span><div class="grow"></div>
        <div class="cal-nav"><button class="btn plain sm icon" id="calPrev" title="Предыдущий месяц">${I('chevL', 14, 2.2)}</button><b id="calTitle"></b><button class="btn plain sm icon" id="calNext" title="Следующий месяц">${I('chevR', 14, 2.2)}</button></div></div>
        <div class="dcal-wrap n1" id="dCal"></div></div>
      <div class="grid-main">
        <div class="glass card"><div class="card-head"><span class="card-title">Результаты по инструментам</span><span class="card-sub">P&L в валюте счёта · клик по строке — детали и графики</span></div><div class="tbl-wrap" id="instTbl"></div></div>
        <div class="col">
          <div class="glass card"><div class="card-head"><span class="card-title">Доходность по месяцам</span></div>${heatmap(a.monthly)}</div>
          <div class="glass card"><div class="card-head"><span class="card-title">Распределение сделок</span><span class="card-sub">в R · все сделки</span></div>${histogram(res)}</div>
        </div>
      </div>
      <div class="glass card" id="allTradesCard"><div class="card-head"><span class="card-title">Все сделки</span><span class="card-sub" id="trCount"></span><span id="trDay"></span><div class="grow"></div><div id="trFilter"></div></div><div class="tbl-wrap scroll" id="allTrades"></div></div>
      <div class="glass card"><div class="card-head"><span class="card-title">Подробные метрики</span></div>${metricsKv(a.m, CUR)}</div>
    </div>`;
    charts.push(equityChart(TH.$('#eqChart'), a.eq, a.bench, a.cfg.capital, CUR));
    renderInstTable(res);
    TH.$('#calPrev').onclick = () => { st.calMonth--; renderDailyCal(res); };
    TH.$('#calNext').onclick = () => { st.calMonth++; renderDailyCal(res); };
    renderDailyCal(res);
    TH.seg(TH.$('#trFilter'), [{ v: 'all', label: 'Все' }, { v: 'win', label: 'Прибыльные' }, { v: 'loss', label: 'Убыточные' }], st.tradeFilter, (v) => { st.tradeFilter = v; drawTrades(res); }, { size: 'sm' });
    drawTrades(res);
    TH.$('#rExport').onclick = () => exportCsv(res);
    TH.$('#rClone').onclick = () => cloneToForm(res.cfg);
  }

  function cloneToForm(c) {
    const e = BK.get(c.sid);
    if (!e || e.status !== 'ready') { TH.toast('Стратегия больше недоступна', { type: 'warn', sub: 'автор удалил её или закрыл доступ' }); return; }
    Object.assign(form, { sid: c.sid, syms: c.syms.slice(), from: c.from, to: c.to, slippage: c.slippage });
    form.acc = Object.assign({}, form.acc, c.acc);
    form.paramsBy[c.sid] = Object.assign({}, c.params);
    saveForm();
    renderForm();
    setSide(true, true);
    flashSide();
    TH.toast('Параметры подставлены в форму', { type: 'info', sub: c.ref ? 'эталонный прогон' : `Run #${c.n}` });
  }

  function exportCsv(res) {
    const head = ['n', 'symbol', 'side', 'entry_time', 'entry_price', 'exit_time', 'exit_price', 'reason', 'qty', 'pnl', 'r'];
    const iso = (t) => new Date(t * 1000).toISOString().replace('.000', '');
    const rows = res.trades.map((t) => [t.n, t.sym, t.dir > 0 ? 'long' : 'short', iso(t.entryTime), t.entryPrice, iso(t.exitTime), t.exitPrice, t.reason, t.qty, t.pnl.toFixed(2), t.R.toFixed(3)].join(','));
    const blob = new Blob([head.join(',') + '\n' + rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backtest_${(res.cfg.sid || res.strat.id).replace(/[^\w-]/g, '')}_${res.cfg.ref ? 'ref' : 'run' + res.cfg.n}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    TH.toast('CSV выгружен', { sub: `${res.trades.length} сделок` });
  }

  function renderInst(res, sym) {
    const b = res.bySym[sym], m = b.m, inst = TH.data.inst(sym);
    TH.$('#btActs').innerHTML = b.trades.length ? `<button class="btn primary" id="iCharts">${I('candles', 14)} Открыть графики сделок</button>` : '';
    content.innerHTML = `<div class="page">
      <div class="page-head"><div style="display:flex;gap:12px;align-items:center">${TH.ava(sym, 'inst-ava', 'width:40px;height:40px;border-radius:11px;font-size:12px')}<div><h1>${sym} <span class="faint" style="font-weight:500;font-size:16px">${TH.esc(inst.name)}</span></h1>
        <div class="sub">${TH.esc(sname(res))} · ${res.cfg.ref ? 'эталон' : 'Run #' + res.cfg.n} · ${m.n} сделок · ${TH.d.med(b.days[b.fromIdx])} — ${TH.d.med(b.days[b.toIdx])} · риск ${TH.fmt(b.acc.risk, 1)}%</div></div></div></div>
      <div class="kpis">${kpiRow(m, CUR, b.acc.capital)}</div>
      <div class="grid-2">
        <div class="glass card" style="padding-bottom:10px"><div class="card-head"><span class="card-title">Цена и входы</span><span class="card-sub">D1 · клик по дню со сделкой — открыть графики</span></div><div class="chart-box" id="iPrice" style="height:320px"></div></div>
        <div class="glass card"><div class="card-head"><span class="card-title">Накопленный P&L</span><span class="card-sub">${TH.moneyS(m.net, CUR)}</span></div><div class="chart-box" id="iEq" style="height:320px"></div></div>
      </div>
      <div class="glass card"><div class="card-head"><span class="card-title">Сделки ${sym}</span><span class="card-sub">${m.n} · клик — графики сделки</span></div><div class="tbl-wrap scroll" id="iTrades"></div></div>
      <div class="glass card"><div class="card-head"><span class="card-title">Подробные метрики</span></div>${metricsKv(m, CUR)}</div>
    </div>`;
    const H = TH.data.history(sym);
    const pc = new TH.TChart(TH.$('#iPrice'), {
      tf: 'D', inst,
      onBarClick: (t) => {
        const k = b.trades.findIndex((x) => Math.floor(x.entryTime / 86400) * 86400 === t);
        if (k >= 0) go({ name: 'trade', id: res.cfg.id, sym, k });
      },
    });
    pc.setInst(inst);
    const D = H.D.slice(Math.max(0, b.fromIdx - 20), b.toIdx + 1);
    pc.setData(D, { volume: false });
    pc.setLines([{ name: 'EMA 20', data: TH.ind.ema(D.map((x) => x.close), 20), color: 'rgba(100,210,255,.7)' }]);
    pc.setBand(b.days[b.fromIdx], b.days[b.toIdx]);
    pc.setMarkers(b.trades.map((t) => ({ time: t.entryTime, position: t.dir > 0 ? 'belowBar' : 'aboveBar', shape: t.dir > 0 ? 'arrowUp' : 'arrowDown', color: t.pnl > 0 ? '#30D158' : '#FF453A', size: 0.6 })));
    pc.fit();
    charts.push(pc);
    charts.push(equityChart(TH.$('#iEq'), b.eq, null, b.acc.capital, CUR));
    tradesTable(TH.$('#iTrades'), res, b.trades, { showSym: false });
    const ic = TH.$('#iCharts');
    if (ic) ic.onclick = () => go({ name: 'trade', id: res.cfg.id, sym, k: 0 });
  }

  function excursion(sym, t) {
    const H = TH.data.history(sym);
    const d0 = H.hourDay[t.gI], d1 = H.hourDay[t.gX];
    let mae = 0, mfe = 0;
    for (let d = d0; d <= d1; d++) {
      for (const b of TH.data.minutes(sym, d, 1)) {
        if (b.time < t.entryTime || b.time > t.exitTime) continue;
        const adv = t.dir > 0 ? b.low - t.entryPrice : t.entryPrice - b.high;
        const fav = t.dir > 0 ? b.high - t.entryPrice : t.entryPrice - b.low;
        mae = Math.min(mae, adv);
        mfe = Math.max(mfe, fav);
      }
    }
    const risk = Math.abs(t.entryPrice - t.sl);
    return { mae: mae / risk, mfe: mfe / risk };
  }

  function renderTrade(res, sym, k, keepTri) {
    const b = res.bySym[sym];
    const trades = b.trades;
    k = TH.clamp(k, 0, trades.length - 1);
    st.view.k = k;
    const t = trades[k];
    const inst = TH.data.inst(sym);
    TH.$('#btActs').innerHTML = '';
    if (!keepTri) {
      content.innerHTML = `<div class="trade-view">
        <div class="toolbar glass">
          <div class="tv-nav"><button class="btn plain icon" id="tPrev" title="Предыдущая сделка · ←">${I('chevL', 17, 2.2)}</button><span id="tPos"></span><button class="btn plain icon" id="tNext" title="Следующая сделка · →">${I('chevR', 17, 2.2)}</button></div>
          <div class="tb-sep"></div>
          <div id="tHead" style="display:flex;align-items:center;gap:10px;min-width:0"></div>
          <div class="grow"></div>
          ${TH.checkChip('tvInd', 'Индикаторы стратегии', st.showInd)}
          ${TH.checkChip('tvAll', 'Все сделки', st.showAll)}
          <div class="tb-sep"></div>
          <button class="btn plain icon ${st.insp ? 'on' : ''}" id="tInsp" title="Детали сделки · I">${I('sidebar', 16)}</button>
        </div>
        <div class="tv-body"><div id="tvTri"></div><aside class="inspector glass ${st.insp ? '' : 'closed'}" id="tvInsp"><div class="insp-scroll" id="tvInspBody"></div></aside></div>
      </div>`;
      tri = new TH.TriChart(TH.$('#tvTri'), { inst, getTool: () => 'cursor' });
      triKey = res.cfg.id + sym;
      TH.$('#tPrev').onclick = () => go({ name: 'trade', id: res.cfg.id, sym, k: st.view.k - 1 });
      TH.$('#tNext').onclick = () => go({ name: 'trade', id: res.cfg.id, sym, k: st.view.k + 1 });
      TH.$('#tvInd').onchange = (e) => { st.showInd = e.target.checked; loadTradeCharts(res, sym, st.view.k, true); };
      TH.$('#tvAll').onchange = (e) => { st.showAll = e.target.checked; loadTradeCharts(res, sym, st.view.k, true); };
      TH.$('#tInsp').onclick = toggleInsp;
    }
    TH.$('#tPos').innerHTML = `Сделка <b>${k + 1}</b> из ${trades.length}`;
    TH.$('#tPrev').disabled = k <= 0;
    TH.$('#tNext').disabled = k >= trades.length - 1;
    TH.$('#tHead').innerHTML = `${TH.ava(sym)}<span class="badge ${t.dir > 0 ? 'long' : 'short'}">${t.dir > 0 ? 'LONG' : 'SHORT'}</span>
      <div class="tv-sum"><b>${sym}</b> · ${TH.d.dmhm(t.entryTime)} → ${TH.d.dmhm(t.exitTime)} · ${t.reasonLabel}</div>
      <span class="tnum ${TH.cls(t.pnl)}" style="font-weight:600;white-space:nowrap">${TH.moneyS(t.pnl, CUR)} · ${TH.fmtS(t.R, 2)} R</span>`;
    renderCrumbs();
    loadTradeCharts(res, sym, k, false);
    renderTradeInspector(res, sym, k);
  }

  function toggleInsp() {
    st.insp = !st.insp;
    TH.store.set('bt.insp', st.insp);
    const el = TH.$('#tvInsp');
    if (el) el.classList.toggle('closed', !st.insp);
    const b = TH.$('#tInsp');
    if (b) b.classList.toggle('on', st.insp);
  }

  function loadTradeCharts(res, sym, k, keepRange) {
    if (!tri) return;
    const trades = res.bySym[sym].trades;
    const t = trades[k];
    const H = TH.data.history(sym);
    const inst = H.inst;
    const p = res.cfg.params;
    const bs = res.bySym[sym];
    const SL = TH.bt.slice(sym, bs.fromIdx, bs.toIdx);
    const x = res.strat.prepare(SL.bars, p, { dayOf: SL.dayOf });
    const lines = st.showInd ? res.strat.lines(x, p) : [];
    const ranges = keepRange ? [tri.d, tri.h, tri.m].map((c) => c.chart.timeScale().getVisibleLogicalRange()) : null;
    const box = { t1: t.entryTime, t2: t.exitTime, entry: t.entryPrice, sl: t.sl, tp: t.tp, active: true, exitPrice: t.exitPrice, entryTime: t.entryTime, exitTime: t.exitTime, win: t.pnl > 0 };
    const shown = st.showAll ? trades : [t];
    const de = H.hourDay[t.gI], dx = H.hourDay[t.gX];

    const d0 = Math.max(0, bs.fromIdx - 60);
    const D = H.D.slice(d0, bs.toIdx + 1);
    tri.d.setData(D);
    tri.d.setLines(st.showInd ? [{ name: 'EMA 20', data: TH.ind.ema(D.map((q) => q.close), 20), color: 'rgba(100,210,255,.6)' }] : []);
    tri.d.setMarkers(shown.map((q) => ({ time: q.entryTime, position: q.dir > 0 ? 'belowBar' : 'aboveBar', shape: q.dir > 0 ? 'arrowUp' : 'arrowDown', color: q === t ? '#0A84FF' : q.pnl > 0 ? 'rgba(48,209,88,.8)' : 'rgba(255,69,58,.8)', size: q === t ? 1.2 : 0.6, text: q === t ? '#' + q.n : '' })));
    tri.d.setBand(H.days[de], H.days[dx]);
    tri.d.setBoxes([box]);
    tri.setSub('d', `${D.length} сессий · период теста подсвечен входами`);

    const off = Math.max(0, SL.start - 60);
    const Hb = SL.bars.slice(off);
    tri.h.setData(Hb);
    tri.h.setLines(lines.map((l) => Object.assign({}, l, { data: l.data.slice(off) })));
    const hm = [];
    shown.forEach((q) => {
      const cur = q === t;
      hm.push({ time: q.entryTime, position: q.dir > 0 ? 'belowBar' : 'aboveBar', shape: q.dir > 0 ? 'arrowUp' : 'arrowDown', color: cur ? '#0A84FF' : q.dir > 0 ? 'rgba(48,209,88,.85)' : 'rgba(255,69,58,.85)', text: cur ? `#${q.n} ${q.dir > 0 ? 'LONG' : 'SHORT'}` : '', size: cur ? 1.1 : 0.8 });
      hm.push({ time: q.exitTime, position: q.dir > 0 ? 'aboveBar' : 'belowBar', shape: 'circle', color: q.pnl > 0 ? '#30D158' : '#FF453A', text: cur ? `${TH.fmtS(q.R, 2)}R` : '', size: cur ? 0.9 : 0.5 });
    });
    hm.push({ time: t.sigTime, position: t.dir > 0 ? 'aboveBar' : 'belowBar', shape: 'square', color: '#FFD60A', text: 'сигнал', size: 0.6 });
    tri.h.setMarkers(hm);
    tri.h.setBoxes([box]);
    tri.h.setBand(t.sigTime, t.sigTime);
    tri.setSub('h', `сигнальный ТФ · бар сигнала ${TH.d.dmhm(t.sigTime)}`);

    let dlist = [];
    for (let d = de; d <= dx; d++) dlist.push(d);
    if (dlist.length > 4) dlist = [de, de + 1, dx - 1, dx];
    const M = [].concat(...dlist.map((d) => TH.data.minutes(sym, d, 1)));
    tri.m.setData(M);
    const hT = Hb.map((q) => q.time);
    const idxF = (tm) => { let lo = 0, hi = hT.length - 1, a = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (hT[mid] <= tm) { a = mid; lo = mid + 1; } else hi = mid - 1; } return a; };
    const mapIdx = M.map((q) => idxF(q.time) - 1);
    const mLines = lines.map((l) => ({ name: l.name + ' (H1)', color: l.color, width: 1, style: l.style, step: true, data: mapIdx.map((j) => (j >= 0 ? l.data[off + j] : null)) }));
    if (st.showInd) mLines.push({ name: 'VWAP', data: TH.ind.vwap(M), color: 'rgba(255,55,95,.85)', width: 1 });
    tri.m.setLines(mLines);
    const mm = [];
    shown.filter((q) => q.exitTime >= M[0].time && q.entryTime <= M[M.length - 1].time).forEach((q) => {
      const cur = q === t;
      const f = (v) => TH.fmt(v, inst.dp);
      mm.push({ time: q.entryTime, position: q.dir > 0 ? 'belowBar' : 'aboveBar', shape: q.dir > 0 ? 'arrowUp' : 'arrowDown', color: cur ? '#0A84FF' : 'rgba(235,235,245,.6)', text: cur ? `${q.dir > 0 ? 'BUY' : 'SELL'} ${f(q.entryPrice)}` : '', size: cur ? 1.2 : 0.7 });
      mm.push({ time: q.exitTime, position: q.dir > 0 ? 'aboveBar' : 'belowBar', shape: q.dir > 0 ? 'arrowDown' : 'arrowUp', color: q.pnl > 0 ? '#30D158' : '#FF453A', text: cur ? `${q.reason.toUpperCase()} ${f(q.exitPrice)}` : '', size: cur ? 1.2 : 0.7 });
    });
    tri.m.setMarkers(mm);
    tri.m.setBoxes([box]);
    tri.m.setExtraPrices([t.sl, t.tp]);
    tri.d.setLegendTime(t.entryTime);
    tri.h.setLegendTime(t.sigTime);
    tri.m.setLegendTime(t.entryTime);
    tri.setSub('m', `исполнение · ${dlist.map((d) => TH.d.dmShort(H.days[d])).join(', ')}`);

    if (ranges) {
      [tri.d, tri.h, tri.m].forEach((c, i) => ranges[i] && c.chart.timeScale().setVisibleLogicalRange(ranges[i]));
    } else {
      tri.d.showRange(H.days[de], H.days[dx], 45, 12);
      tri.h.showRange(t.sigTime, t.exitTime, 45, 20);
      tri.m.showRange(t.entryTime, t.exitTime, 70, 50);
    }
  }

  function renderTradeInspector(res, sym, k) {
    const trades = res.bySym[sym].trades;
    const t = trades[k];
    const bs = res.bySym[sym];
    const inst = TH.data.inst(sym);
    const f = (v) => (v == null ? '—' : TH.fmt(v, inst.dp));
    const qd = inst.lot < 1 ? Math.max(0, -Math.floor(Math.log10(inst.lot))) : 0;
    const exc = excursion(sym, t);
    const dist = Math.abs(t.entryPrice - t.sl);
    TH.$('#tvInspBody').innerHTML = `
      <div class="insp-sec">
        <div class="sec-title">Сделка #${t.n} <span class="r"><span class="badge ${t.reason === 'tp' ? 'long' : t.reason === 'sl' ? 'short' : 'gray'}">${t.reasonLabel}</span></span></div>
        <div class="trade-pnl ${TH.cls(t.pnl)}">${TH.moneyS(t.pnl, CUR)}</div>
        <div class="trade-pnl-sub">${TH.fmtS(t.R, 2)} R · ${TH.pct(t.retPct, 2)} капитала</div>
        <div class="stat-grid">
          <div><small>Вход · ${TH.d.dmhm(t.entryTime)}</small><b>${f(t.entryPrice)}</b></div>
          <div><small>Выход · ${TH.d.dmhm(t.exitTime)}</small><b class="${TH.cls(t.pnl)}">${f(t.exitPrice)}</b></div>
          <div><small>Стоп-лосс</small><b class="neg">${f(t.sl)}</b></div>
          <div><small>Тейк-профит</small><b class="pos">${f(t.tp)}</b></div>
          <div><small>Объём</small><b>${TH.fmt(t.qty, qd)}${inst.lot >= 1 && inst.lot > 1 ? ` · ${t.lots} лот.` : ''}</b></div>
          <div><small>Длительность</small><b>${TH.dur(t.exitTime - t.entryTime)} · ${t.barsHeld} H1</b></div>
          <div><small>MAE · макс. против</small><b class="neg">${TH.fmtS(exc.mae, 2)} R</b></div>
          <div><small>MFE · макс. в пользу</small><b class="pos">${TH.fmtS(exc.mfe, 2)} R</b></div>
          <div><small>Комиссия</small><b>${TH.money(t.comm, CUR)}</b></div>
          <div><small>Капитал на входе</small><b>${TH.money(t.eqAtEntry, CUR)}</b></div>
        </div>
      </div>
      <div class="insp-sec">
        <div class="sec-title">Расчёт сигнала <span class="r faint">${TH.d.dmhm(t.sigTime)} · H1</span></div>
        <div class="checks">${t.checks.map((c) => `<div class="check"><span class="ci ${c.info ? 'info' : ''}">${I(c.info ? 'info' : 'check', 11, 2.6)}</span><div class="ct">${TH.esc(c.label)}<small>${TH.esc(c.value)}</small></div></div>`).join('')}</div>
      </div>
      <div class="insp-sec">
        <div class="sec-title">Размер позиции</div>
        <div class="calc">
          Капитал <b>${TH.money(t.eqAtEntry, CUR)}</b> × риск <b>${TH.fmt(bs.acc.risk, 1)}%</b> = <b>${TH.money(t.riskMoney, CUR)}</b><br>
          Стоп-дистанция |${f(t.entryPrice)} − ${f(t.sl)}| = <b>${f(dist)}</b><br>
          Объём = ${TH.money(t.riskMoney, CUR)} ÷ ${f(dist)} → <b>${TH.fmt(t.qty, qd)}</b>${t.capped ? `<br><span style="color:#ffb84d">Ограничено плечом ×${bs.acc.maxLev}</span>` : ''}<br>
          Цель: ${t.tp != null ? `${f(t.tp)} (${TH.fmt(Math.abs(t.tp - t.entryPrice) / dist, 2)} R)` : 'не задана'}
        </div>
      </div>
      <div class="insp-sec">
        <div class="sec-title">Сделки ${sym} <span class="r faint">${trades.length}</span></div>
        <div class="mini-trades" id="tMini">${trades.map((q, i) => `<button class="mini-trade ${i === k ? 'cur' : ''}" data-k="${i}"><span class="n">#${q.n}</span><span><span class="badge ${q.dir > 0 ? 'long' : 'short'}" style="height:17px;padding:0 5px;font-size:10px">${q.dir > 0 ? 'L' : 'S'}</span> ${TH.d.dmhm(q.entryTime)}</span><b class="${TH.cls(q.R)}">${TH.fmtS(q.R, 2)}R</b></button>`).join('')}</div>
      </div>`;
    const mini = TH.$('#tMini');
    mini.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => go({ name: 'trade', id: res.cfg.id, sym, k: +b.dataset.k })));
    const curEl = mini.querySelector('.cur');
    if (curEl) mini.scrollTop = Math.max(0, curEl.offsetTop - mini.offsetTop - mini.clientHeight / 2 + 16);
  }

  const PER_TXT = { 30: 'за месяц', 91: 'за 3 месяца', 182: 'за полгода', 0: 'за всю историю' };
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const fmtP = (p, v) => TH.fmt(v, p.step < 1 ? 1 : 0);

  const statusPill = (e) => {
    if (e.status === 'ready') return `<span class="st-pill run">${I('check', 11, 2.6)} Готова</span>`;
    if (e.status === 'clarify') return `<span class="st-pill ask">${I('info', 11, 2.4)} Нужно уточнение</span>`;
    if (e.status === 'error') return `<span class="st-pill err">${I('close', 11, 2.6)} Ошибка</span>`;
    return `<span class="st-pill pipe"><span class="spinner xs"></span> В конвейере</span>`;
  };

  function ratingData(market, period) {
    const B = st.bank;
    const rows = BK.rated().map((e) => {
      const sp = BK.refSpec(e, market);
      const s = BK.summary(sp);
      if (!s) BK.compute(sp);
      return { e, s: s ? s.p[period] : null };
    });
    const ready = rows.filter((r) => r.s).sort((a, b) => b.s.ret - a.s.ret);
    const pass = (r) => !(B.quality && (r.s.n < B.minTrades || r.s.mdd < -B.maxDD));
    const ranked = ready.filter(pass);
    ranked.forEach((r, i) => (r.rank = i + 1));
    return { rows, ready, ranked, pass, pending: rows.filter((r) => !r.s) };
  }
  function rankOf(e, market, period) {
    const D = ratingData(market, period);
    if (D.pending.length) return null;
    const r = D.ranked.find((x) => x.e.id === e.id);
    return r ? { rank: r.rank, of: D.ranked.length } : { hidden: true };
  }

  function renderBank() {
    destroyCharts();
    TH.$('#btActs').innerHTML = '';
    const B = st.bank;
    const rated = BK.rated();
    const authors = new Set(rated.map((e) => e.author)).size;
    content.innerHTML = `<div class="page bank">
      <div class="page-head"><div><h1>Банк стратегий</h1>
        <div class="sub">${I('users', 14)} ${rated.length} стратегий от ${authors} авторов · любую можно пересчитать со своими параметрами и на своём списке инструментов</div></div>
        <div class="act"><button class="btn primary lg" id="bkAdd">${I('mic', 15)} Добавить стратегию</button></div></div>
      <div class="bank-tabs"><div id="bkTabs"></div></div>
      <div class="col" id="bkBody"></div>
    </div>`;
    const myN = BK.mine().length;
    const asks = BK.mine().filter((e) => e.status === 'clarify').length;
    TH.seg(TH.$('#bkTabs'), [{ v: 'rating', label: 'Общий рейтинг', icon: 'trophy' }, { v: 'mine', label: `Мои стратегии · ${myN}${asks ? `<span class="tab-dot" title="Ждут уточнения">${asks}</span>` : ''}`, icon: 'user' }], B.tab, (v) => { B.tab = v; saveBank(); renderBankBody(); });
    TH.$('#bkAdd').onclick = openAdd;
    renderBankBody();
  }
  function renderBankBody() {
    if (st.bank.tab === 'mine') renderMine();
    else renderRating();
  }

  function renderRating() {
    const B = st.bank;
    const host = TH.$('#bkBody');
    const authors = [...new Set(BK.rated().map((e) => e.author))].filter((a) => a !== ME);
    if (B.author !== 'all' && B.author !== 'me' && !authors.includes(B.author)) B.author = 'all';
    host.innerHTML = `
      <div class="glass card bk-filters">
        <div class="bkf-row">
          <div class="input-wrap bkf-search"><input class="input" id="bkQ" placeholder="Стратегия, автор или идея" value="${TH.esc(B.q)}"><span class="suffix">${I('search', 14)}</span></div>
          <div class="bkf-item"><span class="bkf-l">Рынок</span><div id="bkMk"></div></div>
          <div class="bkf-item"><span class="bkf-l">Период</span><div id="bkPer"></div></div>
          <div class="bkf-item"><span class="bkf-l">Автор</span><select class="select sm" id="bkAuth"><option value="all">Все авторы</option><option value="me">Только мои</option>${authors.map((a) => `<option value="${a}">@${TH.esc(TH.users.get(a).handle)}</option>`).join('')}</select></div>
        </div>
        <div class="bkf-row">
          <span class="bkf-l">Стиль</span>
          <div class="chips" id="bkStyles">${Object.entries(TH.STYLES).map(([k, l]) => `<button class="chip xs ${B.styles.includes(k) ? 'on' : ''}" data-style="${k}">${l}</button>`).join('')}</div>
          <div class="grow"></div>
          ${TH.checkChip('bkProfit', 'Только прибыльные', B.onlyProfit)}
          <span class="bkf-qual">${TH.checkChip('bkQual', 'Фильтр качества', B.quality)}<button class="btn plain sm" id="bkQualCfg" title="Пороги фильтра качества">${I('sliders', 13)} <span id="bkQualTxt"></span></button></span>
        </div>
      </div>
      <div class="ref-note">${I('info', 14)}<span>Место в рейтинге — по доходности <b>эталонного прогона</b> за период: параметры автора, капитал 1 000 000 ₽, риск 1%, комиссия 0,04%, проскальзывание 1 тик, все инструменты рынка. Условия одинаковые — результаты сравнимы.</span><span class="grow"></span><span id="bkProg" class="bk-prog"></span></div>
      <div class="podium" id="bkPod"></div>
      <div class="glass card"><div class="card-head"><span class="card-title">Общий рейтинг</span><span class="card-sub" id="bkCnt"></span><div class="grow"></div><span id="bkHidden"></span></div><div class="tbl-wrap" id="bkTbl"></div></div>`;
    TH.seg(TH.$('#bkMk'), BK.MARKETS.map((m) => ({ v: m.v, label: m.short })), B.market, (v) => { B.market = v; saveBank(); drawRating(); }, { size: 'sm' });
    TH.seg(TH.$('#bkPer'), BK.PERIODS, B.period, (v) => { B.period = v; saveBank(); drawRating(); }, { size: 'sm' });
    const auth = TH.$('#bkAuth');
    auth.value = B.author;
    auth.onchange = () => { B.author = auth.value; saveBank(); drawRating(); };
    const q = TH.$('#bkQ');
    q.oninput = () => { B.q = q.value; saveBank(); drawRating(); };
    TH.$$('#bkStyles [data-style]').forEach((b) => (b.onclick = () => {
      const k = b.dataset.style;
      B.styles = B.styles.includes(k) ? B.styles.filter((x) => x !== k) : B.styles.concat(k);
      b.classList.toggle('on');
      saveBank();
      drawRating();
    }));
    TH.$('#bkProfit').onchange = (ev) => { B.onlyProfit = ev.target.checked; saveBank(); drawRating(); };
    TH.$('#bkQual').onchange = (ev) => { B.quality = ev.target.checked; saveBank(); drawRating(); };
    TH.$('#bkQualCfg').onclick = (ev) => openQualCfg(ev.currentTarget);
    drawRating();
  }

  function openQualCfg(anchor) {
    const B = st.bank;
    const w = TH.el(`<div class="qual-pop"><div class="menu-label">Фильтр качества</div>
      <div class="field"><label>Минимум сделок за период</label><div class="input-wrap"><input class="input" type="number" min="0" step="5" data-k="minTrades" value="${B.minTrades}"><span class="suffix">сд.</span></div></div>
      <div class="field"><label>Просадка не глубже</label><div class="input-wrap"><input class="input" type="number" min="5" max="100" step="5" data-k="maxDD" value="${B.maxDD}"><span class="suffix">%</span></div></div>
      <div class="hint">Отсекает случайный результат на малой выборке и стратегии, которые по пути теряют слишком много. Скрытые стратегии не получают места в рейтинге.</div></div>`);
    w.querySelectorAll('[data-k]').forEach((inp) => (inp.oninput = () => {
      B[inp.dataset.k] = Math.max(0, +inp.value || 0);
      B.quality = true;
      const qc = TH.$('#bkQual');
      if (qc) qc.checked = true;
      saveBank();
      drawRating();
    }));
    TH.popover(anchor, w, { align: 'end' });
  }

  function podCard(r) {
    const s = r.s, e = r.e;
    const col = s.ret >= 0 ? '#30D158' : '#FF453A';
    return `<div class="glass pod r${r.rank}" data-sid="${e.id}">
      <div class="pod-top"><span class="medal m${r.rank}">${r.rank}</span><div class="t"><b>${TH.esc(BK.displayName(e))}</b><small>${TH.STYLES[BK.styleOf(e)]} · ${BK.engineOf(e).name}</small></div>${srcIco(e)}</div>
      <div class="pod-mid"><div class="pod-ret ${TH.cls(s.ret)}">${TH.pct(s.ret, 1)}</div><div class="pod-kv"><span>DD <b class="neg">${TH.pct(s.mdd, 1)}</b></span><span>Sharpe <b>${TH.fmt(s.sharpe, 2)}</b></span><span>Сделок <b>${s.n}</b></span></div></div>
      <div class="pod-spark">${TH.spark(s.spark, { w: 300, h: 50, color: col, stretch: true })}</div>
      <div class="pod-foot">${TH.uChip(e.author)}<div class="grow"></div><span class="faint pod-runs" title="Пересчётов">${I('refresh', 12)} ${runsCount(e)}</span><button class="btn sm tinted" data-use="${e.id}">Пересчитать</button></div>
    </div>`;
  }

  function drawRating() {
    const B = st.bank;
    const D = ratingData(B.market, B.period);
    const q = B.q.trim().toLowerCase();
    const vis = (r) => {
      const u = TH.users.get(r.e.author);
      return (!q || (BK.displayName(r.e) + ' ' + u.handle + ' ' + u.name + ' ' + r.e.text + ' ' + BK.engineOf(r.e).name).toLowerCase().includes(q))
        && (!B.styles.length || B.styles.includes(BK.styleOf(r.e)))
        && (B.author === 'all' || (B.author === 'me' ? r.e.author === ME : r.e.author === B.author));
    };
    let byRank = D.ranked.filter(vis);
    if (B.onlyProfit) byRank = byRank.filter((r) => r.s.ret > 0);
    const hidden = D.ready.filter((r) => vis(r) && !D.pass(r));
    const pend = D.pending.filter(vis);
    const { key, dir } = B.sort;
    const val = (r) => (key === 'rank' ? r.rank : key === 'runs' ? runsCount(r.e) : key === 'pf' ? (r.s.pf === 'inf' ? 1e9 : r.s.pf) : r.s[key]);
    const list = byRank.slice().sort((a, b) => (key === 'name' ? BK.displayName(a.e).localeCompare(BK.displayName(b.e), 'ru') : val(a) - val(b)) * dir);
    TH.$('#bkQualTxt').textContent = `≥ ${B.minTrades} сд. · DD ≤ ${B.maxDD}%`;
    const total = D.rows.length;
    const at = BK.sumsAt();
    TH.$('#bkProg').innerHTML = D.pending.length ? `<span class="spinner xs"></span> Пересчёт рейтинга на свежих котировках · ${total - D.pending.length} из ${total}` : `${I('check', 12, 2.6)} обновлён сегодня${at ? ' в ' + TH.d.hm(at + 10800) : ''}`;
    TH.$('#bkCnt').textContent = `${mkLabel(B.market)} · ${PER_TXT[B.period]} · ${byRank.length} в рейтинге`;
    TH.$('#bkHidden').innerHTML = hidden.length && B.quality ? `<button class="btn plain sm" id="bkShowHidden" title="${hidden.map((r) => TH.esc(BK.displayName(r.e))).join(', ')}">${I('filter', 12)} фильтр качества скрыл ${hidden.length} · показать</button>` : '';
    const sh = TH.$('#bkShowHidden');
    if (sh) sh.onclick = () => { B.quality = false; TH.$('#bkQual').checked = false; saveBank(); drawRating(); };

    const pod = TH.$('#bkPod');
    const top = byRank.slice(0, 3);
    if (D.pending.length && top.length < 3) pod.innerHTML = [1, 2, 3].map(() => `<div class="glass pod sk-pod">${sk(150)}${sk(90)}<span class="sk" style="width:100%;height:50px"></span>${sk(120)}</div>`).join('');
    else pod.innerHTML = top.map(podCard).join('');
    pod.classList.toggle('hidden', !D.pending.length && !top.length);

    const cols = [['rank', '#', 'c'], ['name', 'Стратегия', ''], [null, 'Автор', ''], ['ret', 'Доходность', 'r'], ['mdd', 'Макс. DD', 'r'], ['sharpe', 'Sharpe', 'r'], ['pf', 'PF', 'r'], ['wr', 'Win rate', 'r'], ['n', 'Сделок', 'r'], [null, 'Кривая', ''], ['runs', 'Пересчётов', 'r'], [null, '', '']];
    const th = cols.map(([k, l, c]) => k ? `<th class="sort ${c} ${key === k ? 'sorted' : ''}" data-k="${k}">${l}${key === k ? `<span class="arr">${dir > 0 ? '▲' : '▼'}</span>` : ''}</th>` : `<th class="${c}">${l}</th>`).join('');
    const strCell = (e) => `<div class="st-cell">${srcIco(e)}<div><b>${TH.esc(BK.displayName(e))}</b><small>${TH.STYLES[BK.styleOf(e)]} · ${BK.engineOf(e).name}</small></div></div>`;
    const row = (r) => {
      const s = r.s, e = r.e;
      return `<tr class="click ${BK.isMine(e) ? 'mine' : ''}" data-sid="${e.id}">
        <td class="c"><span class="rank r${r.rank}">${r.rank}</span></td>
        <td>${strCell(e)}</td><td>${TH.uChip(e.author)}</td>
        <td class="r ${TH.cls(s.ret)}"><b>${TH.pct(s.ret, 1)}</b></td><td class="r neg">${TH.pct(s.mdd, 1)}</td>
        <td class="r">${TH.fmt(s.sharpe, 2)}</td><td class="r">${pfTxtS(s.pf)}</td><td class="r">${TH.pct(s.wr, 1, false)}</td><td class="r">${s.n}</td>
        <td>${TH.spark(s.spark, { w: 86, h: 24, color: s.ret >= 0 ? '#30D158' : '#FF453A' })}</td>
        <td class="r faint">${runsCount(e)}</td>
        <td class="r"><button class="btn sm tinted" data-use="${e.id}">Пересчитать</button></td></tr>`;
    };
    const prow = (r) => `<tr class="click pend" data-sid="${r.e.id}"><td class="c"><span class="spinner xs"></span></td><td>${strCell(r.e)}</td><td>${TH.uChip(r.e.author)}</td>${'<td class="r">' + sk(46) + '</td>'.repeat(1)}<td class="r">${sk(40)}</td><td class="r">${sk(30)}</td><td class="r">${sk(30)}</td><td class="r">${sk(36)}</td><td class="r">${sk(26)}</td><td>${sk(86)}</td><td class="r faint">${runsCount(r.e)}</td><td></td></tr>`;
    const body = list.map(row).join('') + pend.map(prow).join('');
    TH.$('#bkTbl').innerHTML = `<table class="tbl bk-tbl"><thead><tr>${th}</tr></thead><tbody>${body || `<tr class="empty-row"><td colspan="12">Под фильтры ничего не попало${hidden.length ? ' — часть стратегий скрыта фильтром качества' : ''}</td></tr>`}</tbody></table>`;
    TH.$$('#bkTbl th[data-k]').forEach((h) => (h.onclick = () => {
      const k = h.dataset.k;
      B.sort = { key: k, dir: B.sort.key === k ? -B.sort.dir : k === 'rank' || k === 'name' ? 1 : -1 };
      saveBank();
      drawRating();
    }));
    const wire = (root) => root.querySelectorAll('[data-sid]').forEach((el) => (el.onclick = (ev) => {
      const u = ev.target.closest('[data-use]');
      if (u) { ev.stopPropagation(); useInForm(u.dataset.use); return; }
      go({ name: 'strat', sid: el.dataset.sid });
    }));
    wire(TH.$('#bkTbl'));
    wire(pod);
  }

  function pipeMini(e) {
    const P = e.pipe;
    const ids = P.ids.filter((id) => id !== 'done');
    const segs = ids.map((id, i) => {
      const S = BK.STAGES[id];
      const cls = i < P.i ? 'done' : i === P.i ? (e.status === 'clarify' ? 'ask' : e.status === 'error' ? 'err' : 'cur') : '';
      const el = cls === 'cur' ? Math.min(Date.now() - P.at, S.dur) : 0;
      return `<span class="pm-seg ${cls}" title="${S.title}"><i style="${cls === 'cur' ? `animation-duration:${S.dur}ms;animation-delay:-${el}ms` : ''}"></i></span>`;
    }).join('');
    const S = BK.STAGES[P.ids[P.i]];
    const cur = e.status === 'clarify' ? `<div class="pm-cur ask">${I('info', 13, 2.2)} ${BK.QUESTIONS[P.q].title}</div>`
      : e.status === 'error' ? `<div class="pm-cur err">${TH.esc(P.log.bt || 'Ошибка конвейера')}</div>`
        : `<div class="pm-cur"><span class="spinner xs"></span> ${S.title}<span class="faint"> · ${S.sub}</span></div>`;
    return `<div class="pipe-mini">${segs}</div>${cur}`;
  }

  function myCard(e) {
    const B = st.bank;
    let body;
    if (e.status === 'ready') {
      const sp = BK.refSpec(e, B.market);
      const s = BK.summary(sp);
      if (!s) BK.compute(sp);
      const w = s && s.p[B.period];
      const R = e.shared && w ? rankOf(e, B.market, B.period) : null;
      const rk = !e.shared ? 'не участвует' : !R ? '…' : R.hidden ? 'скрыта фильтром' : `#${R.rank} из ${R.of}`;
      body = w ? `<div class="mc-res"><div><small>Эталон · ${BK.MARKETS.find((m) => m.v === B.market).short} · ${perLabel(B.period)}</small><b class="${TH.cls(w.ret)}">${TH.pct(w.ret, 1)}</b></div><div><small>Макс. DD</small><b class="neg">${TH.pct(w.mdd, 1)}</b></div><div><small>Сделок</small><b>${w.n}</b></div><div><small>Рейтинг</small><b>${rk}</b></div></div><div class="mc-spark">${TH.spark(w.spark, { w: 300, h: 40, color: w.ret >= 0 ? '#30D158' : '#FF453A', stretch: true })}</div>`
        : `<div class="mc-res">${sk(80)}${sk(50)}${sk(40)}${sk(50)}</div><div class="mc-spark"><span class="sk" style="width:100%;height:40px"></span></div>`;
    } else body = pipeMini(e);
    return `<div class="glass my-card ${e.status}" data-sid="${e.id}">
      <div class="mc-top">${srcIco(e)}<div class="t"><b>${TH.esc(BK.displayName(e))}</b><small>${TH.d.dmShort(e.created + 10800)} · ${BK.SRC[e.source].label}${e.audio ? ' · ' + mmss(e.audio) : ''}</small></div>${statusPill(e)}</div>
      <div class="mc-body">${body}</div>
      <div class="mc-desc">«${TH.esc(e.text)}»</div>
      <div class="mc-foot">${e.status === 'ready' ? `<button class="btn sm tinted" data-use>${I('play', 10)} Пересчитать</button><button class="btn sm plain">Карточка</button>` : `<button class="btn sm ${e.status === 'clarify' ? 'primary' : ''}">${e.status === 'clarify' ? 'Ответить на вопрос' : 'Смотреть конвейер'}</button>`}<div class="grow"></div>
        <label class="mc-share" title="${e.shared ? 'Стратегия видна всем в банке' : 'Стратегия видна только вам'}">${I(e.shared ? 'users' : 'lock', 12)}<span>${e.shared ? 'В банке' : 'Только я'}</span><span class="switch sm"><input type="checkbox" data-share ${e.shared ? 'checked' : ''}><span></span></span></label>
        <button class="btn plain sm icon" data-del title="Удалить стратегию">${I('trash', 13)}</button></div>
    </div>`;
  }

  function renderMine() {
    const host = TH.$('#bkBody');
    if (!host) return;
    const list = BK.mine();
    host.innerHTML = `<div class="my-grid">
      <button class="my-new" id="myNew"><span class="mn-ico">${I('mic', 24)}</span><b>Новая стратегия</b><small>Расскажите идею голосом или опишите текстом. Конвейер напишет код, проверит его и посчитает контрольный бэктест — после этого стратегию можно пересчитывать.</small><span class="mn-tags"><span>${I('mic', 11)} голосом</span><span>${I('pen', 11)} текстом</span></span></button>
      ${list.map(myCard).join('')}
    </div>`;
    TH.$('#myNew').onclick = openAdd;
    host.querySelectorAll('.my-card').forEach((c) => {
      const id = c.dataset.sid;
      c.onclick = (ev) => {
        if (ev.target.closest('.mc-share')) return;
        if (ev.target.closest('[data-del]')) { delStrategy(id); return; }
        if (ev.target.closest('[data-use]')) { useInForm(id); return; }
        go({ name: 'strat', sid: id });
      };
      const shb = c.querySelector('[data-share]');
      shb.onchange = () => BK.setShared(id, shb.checked);
    });
  }

  async function delStrategy(id) {
    const e = BK.get(id);
    if (!e) return;
    const ok = await TH.confirm({ title: `Удалить «${TH.esc(BK.displayName(e))}»?`, message: e.shared && e.status === 'ready' ? 'Стратегия пропадёт из банка и рейтинга. Пересчёты других пользователей останутся в их истории.' : 'Описание, код и результаты контрольного бэктеста будут удалены.', ok: 'Удалить', destructive: true, icon: 'trash' });
    if (!ok) return;
    BK.remove(id);
    if (form.sid === id) { form.sid = 'u_break30'; ensureParams(form.sid); saveForm(); renderForm(); }
    if (st.view.name === 'strat' && st.view.sid === id) go({ name: 'bank' });
    TH.toast('Стратегия удалена', { type: 'info' });
  }

  const waveMini = (id) => `<span class="wm">${Array.from({ length: 26 }, (_, i) => `<i style="height:${22 + (TH.hash('w' + i + id) % 78)}%"></i>`).join('')}</span>`;
  function descInner(e) {
    const ans = (e.answers || []).map((a) => `<div class="qa"><small>${I('sparkle', 11)} ${TH.esc(a.q)}</small><b>${TH.esc(a.a)}</b></div>`).join('');
    return `<div class="card-head"><span class="card-title">${e.source === 'code' ? 'Описание' : 'Описание автора'}</span><span class="card-sub">${BK.SRC[e.source].label}${e.audio ? ' · ' + mmss(e.audio) : ''}</span></div>
      ${e.source === 'voice' ? `<button class="q-audio" title="Прослушать описание">${I('play', 11)}<span>${mmss(e.audio || 0)}</span>${waveMini(e.id)}</button>` : ''}
      <blockquote class="quote ${e.source}">${TH.esc(e.text)}</blockquote>
      ${ans ? `<div class="qa-list"><div class="sec-title">Уточнения для конвейера</div>${ans}</div>` : ''}`;
  }
  const rulesHtml = (e) => `<div class="rules">${BK.engineOf(e).rules(BK.params(e)).map(([k, v]) => `<div class="rule"><span class="rk">${k}</span><span class="rv">${TH.esc(v)}</span></div>`).join('')}</div>`;
  const authorKv = (e) => {
    const P = BK.params(e);
    return `<dl class="kv">${BK.engineOf(e).params.map((p) => `<dt>${p.label}</dt><dd>${fmtP(p, P[p.k])}</dd>`).join('')}<div class="kv-sep"></div><dt>Класс</dt><dd class="faint">${TH.esc(e.cls || e.engine)}</dd><dt>Шаблон</dt><dd class="faint">${e.engine}</dd><dt>Таймфрейм сигналов</dt><dd>H1 · исполнение M1</dd></dl>`;
  };
  function hl(code) {
    const re = /("[^"\n]*")|(#[^\n]*)|\b(class|def|return|if|and|or|not|None|from|import|is|in|self)\b|\b(\d+(?:\.\d+)?)\b/g;
    let out = '', last = 0, m;
    while ((m = re.exec(code))) {
      out += TH.esc(code.slice(last, m.index));
      const cls = m[1] ? 'cs' : m[2] ? 'cc' : m[3] ? (m[3] === 'self' ? 'cv' : 'ck') : 'cn';
      out += `<span class="${cls}">${TH.esc(m[0])}</span>`;
      last = re.lastIndex;
    }
    return out + TH.esc(code.slice(last));
  }
  function codeCard(e) {
    const code = BK.code(e);
    return `<details class="glass card code-card"><summary><span class="card-title">${I('code', 14)} Код стратегии</span><span class="card-sub">${TH.esc(e.cls || e.engine)}.py · ${code.split('\n').length} строк · сгенерирован конвейером · виден только вам</span><span class="grow"></span><span class="chev">${I('chevD', 13, 2.2)}</span></summary><pre class="code-pre">${hl(code)}</pre></details>`;
  }

  function pipelineFull(e) {
    const P = e.pipe;
    const steps = P.ids.map((id, i) => {
      const S = BK.STAGES[id];
      const isDone = i < P.i || (id === 'done' && e.status === 'ready');
      const isCur = i === P.i && e.status !== 'ready';
      const cls = isDone ? 'done' : isCur ? (e.status === 'clarify' ? 'ask' : e.status === 'error' ? 'err' : 'cur') : 'wait';
      const el = cls === 'cur' && S.dur ? Math.min(Date.now() - P.at, S.dur) : 0;
      const ico = cls === 'done' ? I('check', 12, 2.8) : cls === 'ask' ? I('info', 13, 2.4) : cls === 'err' ? I('close', 12, 2.6) : cls === 'cur' ? '<span class="spinner xs"></span>' : `<b>${i + 1}</b>`;
      return `<div class="pl-step ${cls}"><span class="pl-dot">${ico}</span><div class="pl-t"><div class="pl-h"><b>${S.title}</b>${P.t[id] ? `<span class="pl-time">${TH.fmt(P.t[id] / 1000, 1)} с</span>` : ''}</div><small>${S.sub}</small>
        ${P.log[id] ? `<div class="pl-log">${TH.esc(P.log[id])}</div>` : ''}
        ${cls === 'cur' && S.dur ? `<div class="progress pl-prog"><i style="animation-duration:${S.dur}ms;animation-delay:-${el}ms"></i></div>` : ''}
        ${cls === 'ask' ? clarifyBox(e) : ''}</div></div>`;
    }).join('');
    return `<div class="card-head"><span class="card-title">Конвейер</span><span class="card-sub">описание → код → проверка → контрольный бэктест</span></div><div class="pl">${steps}</div>`;
  }
  function clarifyBox(e) {
    const q = BK.QUESTIONS[e.pipe.q];
    return `<div class="pl-ask"><div class="pa-q">${I('sparkle', 15)}<div><b>${q.title}</b><small>${q.hint}</small></div></div>
      <div class="chips">${q.opts.map((o, i) => `<button class="chip" data-opt="${i}">${TH.esc(o)}</button>`).join('')}</div>
      <div class="pa-row"><input class="input" id="plAns" placeholder="Или ответьте своими словами"><button class="btn primary" id="plSend">${I('send', 13)} Ответить</button></div></div>`;
  }
  function wireStrat(e) {
    const sh = TH.$('#sShare');
    if (sh) sh.onchange = () => {
      BK.setShared(e.id, sh.checked);
      TH.toast(sh.checked ? 'Стратегия опубликована в банке' : 'Стратегия скрыта из банка', { type: 'info', sub: sh.checked ? 'другие пользователи смогут её пересчитать' : 'видна только вам' });
    };
    const del = TH.$('#sDel');
    if (del) del.onclick = () => delStrategy(e.id);
    const qa = TH.$('.q-audio');
    if (qa) qa.onclick = () => {
      const ss = window.speechSynthesis;
      if (!ss) { TH.toast('Воспроизведение недоступно в этом браузере', { type: 'warn' }); return; }
      if (ss.speaking) { ss.cancel(); qa.classList.remove('on'); return; }
      const u = new SpeechSynthesisUtterance(e.text);
      u.lang = 'ru-RU';
      u.rate = 1.05;
      u.onend = () => qa.classList.remove('on');
      qa.classList.add('on');
      ss.speak(u);
    };
    if (e.status === 'clarify') {
      const q = BK.QUESTIONS[e.pipe.q];
      const send = (txt) => { if (txt && txt.trim()) BK.answer(e.id, txt); };
      TH.$$('[data-opt]').forEach((b) => (b.onclick = () => send(q.opts[+b.dataset.opt])));
      const inp = TH.$('#plAns');
      TH.$('#plSend').onclick = () => send(inp.value);
      inp.onkeydown = (ev) => { if (ev.key === 'Enter') send(inp.value); };
    }
  }

  function openRef(e, market, res) {
    const id = `ref:${e.id}:${market}`;
    st.results[id] = Object.assign({}, res, { cfg: Object.assign({}, res.cfg, { id, n: 0, ref: true, market, sid: e.id, sname: BK.displayName(e), author: e.author, authorParams: BK.params(e), at: BK.sumsAt() || Math.floor(Date.now() / 1000) }) });
    go({ name: 'run', id });
  }

  function renderStrat(sid) {
    destroyCharts();
    const e = BK.get(sid);
    if (!e) { go({ name: 'bank' }); return; }
    renderCrumbs();
    const mine = BK.isMine(e);
    const eng = BK.engineOf(e);
    const B = st.bank;
    TH.$('#btActs').innerHTML = e.status === 'ready' ? `<button class="btn primary" id="sUse">${I('play', 12)} Пересчитать со своими параметрами</button>` : '';
    const sub = `${TH.uChip(e.author, { size: 18, name: true })}<span class="faint">·</span>${e.source === 'code' ? 'в банке' : 'добавлена'} ${TH.d.med(e.created + 10800)}<span class="faint">·</span>${srcIco(e)}${BK.SRC[e.source].label}${e.audio ? ' · ' + mmss(e.audio) : ''}${eng ? `<span class="faint">·</span>шаблон ${eng.id}` : ''}`;
    const acts = mine ? `<label class="mc-share big" title="Публикация в банке стратегий">${I(e.shared ? 'users' : 'lock', 13)}<span>${e.shared ? 'Опубликована в банке' : 'Видна только вам'}</span><span class="switch sm"><input type="checkbox" id="sShare" ${e.shared ? 'checked' : ''}><span></span></span></label><button class="btn plain icon" id="sDel" title="Удалить стратегию">${I('trash', 15)}</button>` : '';
    const head = `<div class="page-head sp-head"><div>${TH.uAva(e.author, 46)}</div><div><h1>${TH.esc(BK.displayName(e))} ${styleBadge(e)} ${mine || e.status !== 'ready' ? statusPill(e) : ''}</h1><div class="sub">${sub}</div></div><div class="act">${acts}</div></div>`;
    if (e.status !== 'ready') {
      content.innerHTML = `<div class="page">${head}<div class="grid-main"><div class="glass card">${pipelineFull(e)}</div><div class="col"><div class="glass card">${descInner(e)}</div><div class="glass card pl-help">${I('info', 14)}<div>Конвейер разбирает описание на формальные правила, генерирует класс на базе <b>TradingStrategy</b>, прогоняет тесты и контрольный бэктест. Если чего-то не хватает — задаёт вопрос здесь. Готовая стратегия появится в форме пересчёта${e.shared ? ' и в общем рейтинге' : ''}.</div></div></div></div></div>`;
      wireStrat(e);
      return;
    }
    content.innerHTML = `<div class="page">${head}
      <div class="grid-main">
        <div class="glass card eq-card"><div class="card-head"><span class="card-title nowrap">Эталонный прогон</span><span class="card-sub" id="spEqSub">параметры автора</span><div class="grow"></div><div id="spMk"></div><button class="btn sm" id="spFull" disabled>${I('arrowUR', 13)} Полный отчёт</button></div>
          <div class="chart-box tall" id="spEq"><div class="chart-wait"><span class="spinner"></span><span>Считаем эталонный прогон…</span></div></div></div>
        <div class="glass card" id="spRank"></div>
      </div>
      <div class="grid-2">
        <div class="glass card">${descInner(e)}</div>
        <div class="glass card"><div class="card-head"><span class="card-title">Как конвейер понял описание</span><span class="card-sub">формальные правила</span></div>${rulesHtml(e)}${mine ? '' : `<div class="rules-note">${I('lock', 12)} Код виден только автору. Вы меняете параметры и инструменты — логика остаётся авторской.</div>`}</div>
      </div>
      <div class="grid-main">
        <div class="glass card"><div class="card-head"><span class="card-title">Пересчёты</span><span class="card-sub" id="spRunsSub"></span></div><div class="tbl-wrap" id="spRuns"></div></div>
        <div class="glass card"><div class="card-head"><span class="card-title">Параметры автора</span><div class="grow"></div><button class="btn sm plain" id="spUse2">${I('copy', 12)} В форму</button></div>${authorKv(e)}</div>
      </div>
      ${mine ? codeCard(e) : ''}
    </div>`;
    wireStrat(e);
    TH.seg(TH.$('#spMk'), BK.MARKETS.map((m) => ({ v: m.v, label: m.short })), B.market, (v) => { B.market = v; saveBank(); renderStrat(sid); }, { size: 'sm' });
    TH.$('#sUse').onclick = () => useInForm(e.id);
    TH.$('#spUse2').onclick = () => useInForm(e.id, { params: BK.params(e) });
    fillStrat(e);
    const mk = B.market;
    const box = TH.$('#spEq');
    BK.compute(BK.refSpec(e, mk), true).then((res) => {
      if (!box.isConnected) return;
      box.innerHTML = '';
      charts.push(equityChart(box, res.acc.eq, res.acc.bench, res.acc.cfg.capital, CUR));
      TH.$('#spEqSub').textContent = `параметры автора · ${TH.money(res.acc.cfg.capital, CUR)} → ${TH.money(res.acc.m.final, CUR)}`;
      const full = TH.$('#spFull');
      full.disabled = false;
      full.onclick = () => openRef(e, mk, res);
    }).catch(() => { if (box.isConnected) box.innerHTML = '<div class="chart-wait">Не удалось посчитать эталон</div>'; });
  }

  function fillStrat(e) {
    const B = st.bank;
    const rk = TH.$('#spRank');
    if (!rk) return;
    const mine = BK.isMine(e);
    const s = BK.summary(BK.refSpec(e, B.market));
    const w = s && s.p[B.period];
    const R = e.shared ? rankOf(e, B.market, B.period) : null;
    let rankHtml;
    if (!e.shared) rankHtml = `<div class="rank-big off"><span class="rb-ico">${I('lock', 20)}</span><div><b>Не участвует в рейтинге</b><small>стратегия видна только вам — опубликуйте её, чтобы попасть в рейтинг</small></div></div>`;
    else if (!R) rankHtml = `<div class="rank-big"><span class="rb-ico"><span class="spinner xs"></span></span><div><b>Считаем рейтинг…</b><small>эталонные прогоны остальных стратегий</small></div></div>`;
    else if (R.hidden) rankHtml = `<div class="rank-big off"><span class="rb-ico">${I('filter', 20)}</span><div><b>Скрыта фильтром качества</b><small>${w && w.n < B.minTrades ? `меньше ${B.minTrades} сделок` : `просадка глубже ${B.maxDD}%`} ${PER_TXT[B.period]}</small></div></div>`;
    else rankHtml = `<div class="rank-big"><span class="medal big m${R.rank}">${R.rank}</span><div><b>${R.rank} место из ${R.of}</b><small>${mkLabel(B.market)} · ${PER_TXT[B.period]}</small></div></div>`;
    const users = (e.users || 0) + (!mine && myRunsOf(e.id).length ? 1 : 0);
    rk.innerHTML = `<div class="card-head"><span class="card-title">Рейтинг</span><div class="grow"></div><div id="spPer"></div></div>${rankHtml}
      ${w ? `<dl class="kv"><dt>Доходность</dt><dd class="${TH.cls(w.ret)}">${TH.pct(w.ret, 2)}</dd><dt>Макс. просадка</dt><dd class="neg">${TH.pct(w.mdd, 2)}</dd><dt>Sharpe</dt><dd>${TH.fmt(w.sharpe, 2)}</dd><dt>Profit factor</dt><dd>${pfTxtS(w.pf)}</dd><dt>Win rate</dt><dd>${TH.pct(w.wr, 1, false)}</dd><dt>Сделок</dt><dd>${w.n}</dd><div class="kv-sep"></div><dt>Пересчётов</dt><dd>${runsCount(e)}</dd><dt>Пересчитывали</dt><dd>${users} польз.</dd></dl>` : `<dl class="kv">${Array.from({ length: 6 }, () => `<dt>${sk(90)}</dt><dd>${sk(50)}</dd>`).join('')}</dl>`}`;
    TH.seg(TH.$('#spPer'), BK.PERIODS, B.period, (v) => { B.period = v; saveBank(); fillStrat(e); }, { size: 'sm' });

    const eng = BK.engineOf(e);
    const AP = BK.params(e);
    const my = myRunsOf(e.id);
    const comm = BK.community(e);
    const chg = (p, base) => eng.params.filter((q) => p[q.k] !== base[q.k]).map((q) => `<span class="pchg" title="${q.label}">${q.label.replace(/,.*$/, '')} <s>${fmtP(q, base[q.k])}</s> ${fmtP(q, p[q.k])}</span>`).join('') || '<span class="faint">как у автора</span>';
    const ago = (sec) => { const d = Math.floor((Date.now() / 1000 - sec) / 86400); return d <= 0 ? 'сегодня' : `${d} дн. назад`; };
    const rows = my.map((r) => `<tr class="click mine" data-run="${r.id}"><td>${TH.uChip(ME)}</td><td>${symsLabel(r.cfg.syms)}</td><td class="faint">${TH.d.dmShort(r.cfg.from)} — ${TH.d.dmShort(r.cfg.to)}</td><td><div class="pchgs">${chg(r.cfg.params, AP)}</div></td><td class="r ${TH.cls(r.sum.ret)}"><b>${TH.pct(r.sum.ret, 1)}</b></td><td class="r">${r.sum.n}</td><td class="r faint">${ago(r.cfg.at)}</td><td class="r"><button class="btn sm plain">Открыть</button></td></tr>`).join('')
      + comm.map((c, i) => {
        const sm = BK.summary(c.spec);
        if (!sm) BK.compute(c.spec);
        const w2 = sm && sm.p[0];
        return `<tr data-c="${i}"><td>${TH.uChip(c.user)}</td><td>${symsLabel(c.spec.syms)}</td><td class="faint">${c.spec.span ? 'последние ' + perLabel(c.spec.span) : 'вся история'}</td><td><div class="pchgs">${chg(c.spec.params, AP)}${c.spec.acc.risk !== 1 ? `<span class="pchg">риск <s>1</s> ${TH.fmt(c.spec.acc.risk, 1)}%</span>` : ''}</div></td><td class="r ${w2 ? TH.cls(w2.ret) : ''}">${w2 ? `<b>${TH.pct(w2.ret, 1)}</b>` : sk(44)}</td><td class="r">${w2 ? w2.n : sk(26)}</td><td class="r faint">${c.ago} дн. назад</td><td class="r"><button class="btn sm tinted" data-take="${i}">В форму</button></td></tr>`;
      }).join('');
    TH.$('#spRunsSub').textContent = `${my.length ? `ваших ${my.length} · ` : ''}${comm.length ? `сообщество — последние ${comm.length} из ${e.baseRuns}` : 'сообщество пока не пересчитывало'}`;
    const host = TH.$('#spRuns');
    host.innerHTML = `<table class="tbl"><thead><tr><th>Кто</th><th>Инструменты</th><th>Период</th><th>Изменения относительно автора</th><th class="r">Доходность</th><th class="r">Сделок</th><th class="r">Когда</th><th></th></tr></thead><tbody>${rows || `<tr class="empty-row"><td colspan="8">Пока никто не пересчитывал — будьте первым</td></tr>`}</tbody></table>`;
    host.querySelectorAll('[data-run]').forEach((tr) => (tr.onclick = () => openRun(tr.dataset.run)));
    host.querySelectorAll('[data-take]').forEach((b) => (b.onclick = () => {
      const c = comm[+b.dataset.take];
      useInForm(e.id, { params: c.spec.params, syms: c.spec.syms, span: c.spec.span, acc: { risk: c.spec.acc.risk } });
    }));
  }

  let compT = null;
  TH.bus.on('bank:computed', () => {
    if (!inited) return;
    clearTimeout(compT);
    compT = setTimeout(() => {
      const v = st.view;
      if (v.name === 'bank') {
        if (st.bank.tab === 'rating') { if (TH.$('#bkTbl')) drawRating(); } else renderMine();
      } else if (v.name === 'strat') {
        const e = BK.get(v.sid);
        if (e && e.status === 'ready') fillStrat(e);
      }
    }, 160);
  });
  TH.bus.on('bank', (ev) => {
    if (!inited) return;
    const v = st.view;
    if (v.name === 'bank') {
      if (st.bank.tab === 'mine') renderBank();
      else if (ev.type === 'ready' || ev.type === 'share' || ev.type === 'remove') drawRating();
    } else if (v.name === 'strat' && v.sid === ev.id && ev.type !== 'remove') renderStrat(ev.id);
  });

  function key(e) {
    const v = st.view;
    if (v.name === 'trade') {
      if (e.key === 'ArrowLeft') { go(Object.assign({}, v, { k: v.k - 1 })); return true; }
      if (e.key === 'ArrowRight') { go(Object.assign({}, v, { k: v.k + 1 })); return true; }
      if (e.key.toLowerCase() === 'i' || e.key.toLowerCase() === 'ш') { toggleInsp(); return true; }
    }
    return false;
  }

  TH.bus.on('settings', (k) => {
    if (!inited || k !== 'risk' || !S.data.riskToBacktest) return;
    form.acc.risk = S.data.risk.finam;
    const inp = TH.$('#btForm [data-acc="risk"]');
    if (inp) inp.value = form.acc.risk;
    saveForm();
  });

  TH.views.backtest = {
    show() {
      if (!inited) init();
      else if (tri) [tri.d, tri.h, tri.m].forEach((c) => c.redraw());
    },
    hide() { },
    key,
  };
})();
