
(() => {
  const pairs = [
    ['#adminDateFrom', '#adminDateTo'], ['#reportFrom', '#reportTo'],
    ['#pnlFrom', '#pnlTo'], ['#tmiFrom', '#tmiTo'], ['#waFrom', '#waTo'],
    ['#leadDateFrom', '#leadDateTo'], ['#miFrom', '#miTo'], ['#giFrom', '#giTo'],
    ['#tsFrom', '#tsTo'], ['#og-start', '#og-end'],
    ['input[type="date"][data-from]', 'input[type="date"][data-to]']
  ];
  const monthFormat = new Intl.DateTimeFormat('en-IN', {month:'long', year:'numeric', timeZone:'UTC'});
  const dateFormat = new Intl.DateTimeFormat('en-IN', {day:'numeric', month:'short', year:'numeric', timeZone:'UTC'});
  const day = (year, month, date) => new Date(Date.UTC(year, month, date));
  const iso = date => date.toISOString().slice(0,10);
  const parse = value => new Date(value + 'T00:00:00Z');
  const dialog = document.createElement('dialog');
  dialog.className = 'wt-range-calendar';
  dialog.setAttribute('aria-label', 'Choose date range');
  dialog.innerHTML = '<div class="wt-range-nav"><button type="button" data-prev aria-label="Previous month">‹</button><strong data-month aria-live="polite"></strong><button type="button" data-next aria-label="Next month">›</button></div><p data-selection aria-live="polite"></p><div class="wt-range-grid"></div><div class="wt-range-actions"><button type="button" data-cancel>Cancel</button><button type="button" data-apply>Apply</button></div>';
  const style = document.createElement('style');
  style.textContent = "\n.wt-range-calendar{width:min(360px,calc(100vw - 32px));box-sizing:border-box;border:1px solid #385143;border-radius:16px;background:#111b16;color:#f4f7f5;padding:18px}\n.wt-range-calendar::backdrop{background:#0009}\n.wt-range-nav,.wt-range-actions{display:flex;align-items:center;justify-content:space-between;gap:8px}\n.wt-range-calendar p{text-align:center;min-height:20px;margin:10px 0}\n.wt-range-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px;text-align:center}\n.wt-range-grid span{padding:5px 0;color:#a9bcb0}\n.wt-range-calendar button{margin:0;border:1px solid #385143;background:#1c2b22;color:#f4f7f5;padding:6px;border-radius:7px;cursor:pointer}\n.wt-range-grid button{min-height:36px}\n.wt-range-grid button.wt-in-range{background:#26503b}\n.wt-range-grid button[aria-pressed=\"true\"],.wt-range-calendar [data-apply]:enabled{background:#54de8e;color:#102318}\n.wt-range-calendar button:disabled{opacity:.5;cursor:default}\n.wt-range-actions{justify-content:flex-end;margin-top:14px}\n";
  document.head.append(style);
  document.body.append(dialog);
  const grid = dialog.querySelector('.wt-range-grid');
  const apply = dialog.querySelector('[data-apply]');
  let fromInput, toInput, start, end, month, pickingEnd;
  function render(focusDate) {
    dialog.querySelector('[data-month]').textContent = monthFormat.format(month);
    dialog.querySelector('[data-selection]').textContent =
      pickingEnd ? 'Choose end date · ' + dateFormat.format(parse(start)) :
      start && end ? dateFormat.format(parse(start)) + ' – ' + dateFormat.format(parse(end)) :
      'Choose start date';
    apply.disabled = pickingEnd || !start || !end;
    grid.replaceChildren();
    for (const name of ['Mo','Tu','We','Th','Fr','Sa','Su']) {
      const heading = document.createElement('span');
      heading.textContent = name;
      grid.append(heading);
    }
    const year = month.getUTCFullYear();
    const index = month.getUTCMonth();
    for (let offset = 0; offset < (month.getUTCDay() + 6) % 7; offset++) {
      grid.append(document.createElement('span'));
    }
    for (let number = 1; number <= day(year,index+1,0).getUTCDate(); number++) {
      const date = day(year,index,number);
      const value = iso(date);
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = number;
      button.setAttribute('aria-label', dateFormat.format(date));
      button.setAttribute('aria-pressed', String(value === start || value === end));
      if (start && end && value > start && value < end) button.classList.add('wt-in-range');
      button.onclick = () => {
        if (pickingEnd) {
          end = value;
          if (end < start) [start,end] = [end,start];
        } else {
          start = value;
          end = '';
        }
        pickingEnd = !pickingEnd;
        render(value);
      };
      grid.append(button);
      if (value === focusDate) button.focus();
    }
  }
  function moveMonth(offset) {
    month = day(month.getUTCFullYear(),month.getUTCMonth()+offset,1);
    render();
  }
  dialog.querySelector('[data-prev]').onclick = () => moveMonth(-1);
  dialog.querySelector('[data-next]').onclick = () => moveMonth(1);
  dialog.querySelector('[data-cancel]').onclick = () => dialog.close();
  apply.onclick = () => {
    const changes = [[fromInput,start],[toInput,end]].filter(([input,value]) => input.value !== value);
    for (const [input,value] of changes) input.value = value;
    dialog.close();
    for (const [input] of changes) {
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
    }
  };
  document.addEventListener('click', event => {
    const input = event.target.closest('input[type="date"]');
    if (!input || input.disabled || input.readOnly) return;
    const pair = pairs.find(selectors => selectors.some(selector => input.matches(selector)));
    if (!pair) return;
    const [from,to] = pair.map(selector => input.matches(selector) ? input : document.querySelector(selector));
    if (!from || !to || from.disabled || to.disabled || from.readOnly || to.readOnly) return;
    event.preventDefault();
    fromInput = from;
    toInput = to;
    start = from.value;
    end = to.value;
    pickingEnd = input === to && !!start;
    const initial = parse(input.value || start || new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Kolkata'}).format());
    month = day(initial.getUTCFullYear(),initial.getUTCMonth(),1);
    render();
    dialog.showModal();
  }, true);
})();
