(() => {
  'use strict';

  const colors = {
    completed: '#57e6ab', no_answer: '#ffd166', busy: '#f9a65a',
    failed: '#ff879c', in_progress: '#67d9fb', unknown: '#acb9d3',
  };
  const palettes = ['#bba4ff', '#67d9fb', '#f3a3ed'];
  const statusLabel = (value) => String(value || 'Unknown').replace(/[_-]+/g, ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
  const statusColor = (value, fallback = colors.unknown) =>
    colors[String(value || '').toLowerCase().replace(/[- ]/g, '_')] || fallback;

  function accentCard(card, color) {
    card.style.borderColor = color + '66';
    card.style.borderTop = '3px solid ' + color;
    card.style.background = 'linear-gradient(145deg, ' + color + '24, #101a22 78%)';
  }

  const dayFormat = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const dayOf = (value) => {
    const date = new Date(value || '');
    return Number.isFinite(date.getTime()) ? dayFormat.format(date) : '';
  };
  const numberKey = (value) => String(value || '').replace(/[\s()+.-]/g, '')
    .replace(/^(?:0091|91)(?=\d{10}$)/, '');
  async function lookupPlayers(sessions) {
    const keys = [...new Set(sessions.map((call) => numberKey(call.calleeNumber))
      .filter((key) => /^\d{10}$/.test(key)))];
    const matches = new Map();
    for (let start = 0; start < keys.length; start += 40) {
      const variants = keys.slice(start, start + 40).flatMap((key) =>
        [key, '+91' + key, '91' + key, '0091' + key]);
      const { data, error } = await sb.from('admin_players')
        .select('phone,ftd_at,ftd,deposit_count').in('phone', variants);
      if (error) throw error;
      for (const player of data) {
        const key = numberKey(player.phone);
        matches.set(key, matches.has(key) ? null : player);
      }
    }
    return matches;
  }

  function playerBadge(call, matches) {
    const key = numberKey(call.calleeNumber);
    if (!matches || !/^\d{10}$/.test(key)) return ['Registration unavailable', colors.unknown];
    if (!matches.has(key)) return ['Non-registered · no synced match', '#ff879c'];
    const player = matches.get(key);
    if (!player) return ['Multiple registered matches', '#ffd166'];
    const first = dayOf(player.ftd_at);
    const count = player.deposit_count == null ? NaN : Number(player.deposit_count);
    if (!first && !(Number(player.ftd) > 0) && !(count > 0)) {
      return ['Registered · Non-FTD', '#bba4ff'];
    }
    if (count === 1) {
      const days = first ? (Date.parse(dayFormat.format(new Date())) - Date.parse(first)) / 86400000 : NaN;
      const age = Number.isFinite(days) && days >= 0 ? ' · ' + days + (days === 1 ? ' day' : ' days') + ' since FTD' : '';
      return ['FTD · No additional deposit' + age, '#ffd166'];
    }
    return [count > 1 ? 'FTD · Repeat depositor' : 'FTD · Deposit count unavailable', '#57e6ab'];
  }

  async function request(action, fields = {}) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error('Sign in again.');
    const response = await fetch(SB_URL + '/functions/v1/ravan-intell', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SB_KEY,
        Authorization: 'Bearer ' + session.access_token,
      },
      body: JSON.stringify({ action, ...fields }),
      signal: AbortSignal.timeout(25000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Ravan request failed.');
    return result.data;
  }

  async function mount() {
    if (location.hostname !== 'winturbo.live' || typeof sb === 'undefined') return;
    const { user, profile } = await window.WinTurboLoadProfile();
    if (!user) return;
    if (profile?.role !== 'admin' || !profile.is_active || document.getElementById('ravanIntell')) return;
    const nav = document.querySelector('#app .nav');
    const main = document.querySelector('main.main');
    if (!nav || !main) return;

    const tab = document.createElement('button');
    tab.dataset.s = 'ravanIntell';
    tab.textContent = '☎ Ravan Intell';
    nav.append(tab);
    const section = document.createElement('section');
    section.id = 'ravanIntell';
    section.className = 'section';
    section.innerHTML = `
      <div class="adminHero"><div><h2>Ravan Intell</h2><p>Ravan connection and recent AI calls</p></div>
      <a href="https://app.ravan.ai" target="_blank" rel="noopener noreferrer">Open Ravan ↗</a></div>
      <div class="card"><button class="ghost" type="button" data-check>Test connection</button>
      <button class="primary" type="button" data-refresh>Refresh recent calls</button>
      <p data-connection class="muted">Connection not checked.</p><p role="status" aria-live="polite">Call history loads when you open this tab.</p><div style="display:flex;gap:12px;flex-wrap:wrap;margin:16px 0"><label>From (IST) <input type="date" data-from></label><label>To (IST) <input type="date" data-to></label><button type="button" class="ghost" data-clear>All loaded dates</button></div><div data-analytics><h3>Call analytics</h3><p class="muted">Waiting for Ravan call history.</p></div><div data-calls style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px;margin-top:16px"></div></div>
      <dialog><form method="dialog"><button>Close</button></form>
      <pre style="white-space:pre-wrap;overflow-wrap:anywhere"></pre></dialog>`;
    main.append(section);
    const leadButtons = new MutationObserver(addLeadButtons);
    leadButtons.observe(main, { childList: true, subtree: true });
    addLeadButtons();

    function addLeadButtons() {
      if (!section.isConnected) {
        leadButtons.disconnect();
        return;
      }
      for (const row of main.querySelectorAll('#leadRows tr[data-lead]')) {
        const cell = row.lastElementChild;
        if (!cell || cell.querySelector('[data-ravan-dial]')) continue;
        const username = row.cells[0]?.querySelector('b')?.textContent;
        const rawPhone = row.cells[0]?.querySelector('.small')?.textContent || '';
        const phone = rawPhone.replace(/[\s()+.-]/g, '').replace(/^(?:0091|91)(?=\d{10}$)/, '');
        const button = document.createElement('button');
        button.className = 'mini';
        button.type = 'button';
        button.dataset.ravanDial = '';
        button.textContent = 'Call Now';
        button.disabled = !/^[6-9]\d{9}$/.test(phone);
        button.title = button.disabled ? 'A valid Indian mobile number is required' : 'Place one Ravan AI call';
        cell.append(' ', button);
        button.onclick = async (event) => {
          event.stopPropagation();
          if (!window.confirm('Place one Ravan AI call to ' + username + ' (+91' + phone +
              ')? Confirm the lead has agreed to receive this call.')) return;
          button.disabled = true;
          button.textContent = 'Calling…';
          try {
            await request('dial', { phone, username, leadKey: row.dataset.lead, confirmed: true });
            button.textContent = 'Call submitted';
          } catch (error) {
            button.textContent = 'Call Now';
            button.disabled = false;
            window.alert(error.message);
          }
        };
      }
    }
    window.addEventListener('click', (event) => {
      if (!tab.isConnected || !tab.contains(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      for (const panel of main.querySelectorAll(':scope > section.section')) {
        const selected = panel === section;
        panel.classList.toggle('on', selected);
        panel.style.setProperty('display', selected ? 'block' : 'none', 'important');
        panel.setAttribute('aria-hidden', String(!selected));
      }
      for (const button of nav.querySelectorAll('button[data-s]')) {
        button.classList.toggle('on', button === tab);
      }
      const title = document.getElementById('title');
      if (title) title.textContent = 'Ravan Intell';
      if (!historyLoaded) refresh.click();
    }, true);

    let historyLoaded = false;
    const refresh = section.querySelector('[data-refresh]');
    const connection = section.querySelector('[data-connection]');
    const status = section.querySelector('[role=status]');
    const calls = section.querySelector('[data-calls]');
    const dialog = section.querySelector('dialog');
    function onClick(button, operation) {
      button.onclick = async () => {
        button.disabled = true;
        status.textContent = 'Loading…';
        try {
          await operation();
        } catch (error) {
          status.textContent = button === refresh
            ? 'Could not load Ravan call history. ' + error.message
            : error.message;
        } finally {
          button.disabled = false;
        }
      };
    }

    onClick(section.querySelector('[data-check]'), async () => {
      try {
        await request('connection');
        connection.textContent = 'Connected to Ravan.';
        status.textContent = 'Connection verified.';
        if (!historyLoaded) refresh.click();
      } catch (error) {
        connection.textContent = 'Connection check failed.';
        throw error;
      }
    });

    const from = section.querySelector('[data-from]');
    const to = section.querySelector('[data-to]');
    let loadedCalls = [];
    let players = null;
    from.onchange = to.onchange = renderHistory;
    section.querySelector('[data-clear]').onclick = () => {
      from.value = to.value = '';
      renderHistory();
    };
    onClick(refresh, async () => {
      const { callSessions } = await request('history');
      loadedCalls = callSessions;
      players = null;
      try {
        players = await lookupPlayers(callSessions);
      } catch {
        // Call history remains visible when registration data cannot be loaded.
      }
      historyLoaded = true;
      renderHistory();
    });

    function renderHistory() {
      if (!historyLoaded) return;
      if (from.value && to.value && from.value > to.value) {
        status.textContent = 'Choose a From date on or before the To date.';
        return;
      }
      const callDate = (call) => call.startedAt || call.createdAt;
      const callSessions = loadedCalls.filter((call) => {
        const day = dayOf(callDate(call));
        return (!from.value || day >= from.value) && (!to.value || (day && day <= to.value));
      }).sort((left, right) => (Date.parse(callDate(right)) || 0) - (Date.parse(callDate(left)) || 0));
      const analytics = section.querySelector('[data-analytics]');
      const counts = new Map();
      let seconds = 0;
      for (const call of callSessions) {
        const label = String(call.status || 'Unknown');
        counts.set(label, (counts.get(label) || 0) + 1);
        if (Number.isFinite(call.durationSec) && call.durationSec > 0) seconds += call.durationSec;
      }
      const heading = document.createElement('h3');
      heading.textContent = 'Analytics for loaded calls';
      const metrics = document.createElement('div');
      metrics.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,155px),1fr));gap:12px;margin:12px 0 22px';
      const totals = [
        ['Total calls', callSessions.length, palettes[0]],
        ['Call minutes', (seconds / 60).toFixed(1), palettes[1]],
        ...[...counts].map(([label, count], index) => [
          statusLabel(label), count, statusColor(label, palettes[index % palettes.length]),
        ]),
      ];
      for (const [label, value, color] of totals) {
        const card = document.createElement('article');
        card.className = 'card';
        accentCard(card, color);
        const title = document.createElement('span');
        title.textContent = label;
        title.style.color = '#e6edf7';
        const figure = document.createElement('strong');
        figure.textContent = value;
        figure.style.cssText = 'display:block;margin-top:5px;font-size:clamp(1.8rem,3vw,2.6rem);line-height:1.1;color:' + color;
        card.append(title, figure);
        metrics.append(card);
      }
      analytics.replaceChildren(heading, metrics);
      calls.replaceChildren();
      let previousDay = null;
      for (const call of callSessions) {
        const day = dayOf(callDate(call));
        if (day !== previousDay) {
          const dateHeading = document.createElement('h3');
          dateHeading.style.gridColumn = '1 / -1';
          dateHeading.textContent = day
            ? new Date(day + 'T12:00:00Z').toLocaleDateString('en-IN', { dateStyle: 'full', timeZone: 'Asia/Kolkata' })
            : 'Date unavailable';
          calls.append(dateHeading);
          previousDay = day;
        }
        const row = document.createElement('article');
        row.className = 'card';
        const color = statusColor(call.status);
        accentCard(row, color);
        const number = document.createElement('h3');
        number.textContent = call.calleeNumber || 'Number unavailable';
        const date = new Date(call.startedAt || call.createdAt || '');
        const time = document.createElement('p');
        time.textContent = Number.isFinite(date.getTime())
          ? date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) + ' IST'
          : 'Date and time unavailable';
        const outcome = document.createElement('p');
        outcome.textContent = statusLabel(call.status);
        outcome.style.cssText = 'display:inline-block;border-radius:999px;padding:4px 10px;font-weight:700;color:' + color + ';background:' + color + '18';
        const sentiment = document.createElement('p');
        const analysis = call.postCallAnalysisResult;
        const label = call.sentiment || analysis?.sentiment || analysis?.user_sentiment || analysis?.userSentiment;
        sentiment.textContent = 'Sentiment: ' + (typeof label === 'string' && label.trim() ? label : 'Unavailable');
        const recording = document.createElement('p');
        recording.textContent = 'Recording unavailable';
        if (typeof call.recordingUrl === 'string') {
          try {
            const url = new URL(call.recordingUrl);
            if (url.protocol === 'https:') {
              const link = document.createElement('a');
              link.href = url.href;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              link.textContent = 'Open recording ↗';
              recording.replaceChildren(link);
            }
          } catch {}
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ghost';
        button.textContent = 'View call details';
        const [badgeText, badgeColor] = playerBadge(call, players);
        const badge = document.createElement('p');
        badge.textContent = badgeText;
        badge.style.cssText = 'padding:7px 10px;border-radius:8px;font-weight:700;color:' + badgeColor + ';background:' + badgeColor + '24';
        row.append(number, time, outcome, badge, sentiment, recording, button);
        calls.append(row);
        onClick(button, async () => {
          const detail = await request('detail', { id: call.id });
          dialog.querySelector('pre').textContent = JSON.stringify(detail, null, 2);
          if (!dialog.open) dialog.showModal();
          status.textContent = 'Call details loaded.';
        });
      }
      status.textContent = callSessions.length
        ? callSessions.length + ' of ' + loadedCalls.length + ' loaded calls shown · IST' +
          (players ? '' : ' · Registration data unavailable')
        : loadedCalls.length ? 'No loaded calls match these dates.' : 'Ravan returned no recent calls.';
    }
  }

  if (location.hostname === 'winturbo.live' && typeof sb !== 'undefined') {
    window.WinTurboRegisterModule('ravanIntell', mount);
    sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        document.getElementById('ravanIntell')?.remove();
        document.querySelectorAll('[data-ravan-dial]').forEach((button) => button.remove());
        document.querySelector('[data-s="ravanIntell"]')?.remove();
      } else if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        setTimeout(() => mount().catch(() => {}), 0);
      }
    });
  }
})();
