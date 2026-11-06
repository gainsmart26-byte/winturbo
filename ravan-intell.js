(() => {
  'use strict';

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
      <div class="card"><button type="button" data-check>Test connection</button>
      <button type="button" data-refresh>Refresh recent calls</button>
      <p role="status">Connection not checked.</p><div data-analytics></div><div data-calls></div></div>
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
    }, true);

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
          status.textContent = error.message;
        } finally {
          button.disabled = false;
        }
      };
    }

    onClick(section.querySelector('[data-check]'), async () => {
      await request('connection');
      status.textContent = 'Connected to Ravan.';
    });

    onClick(section.querySelector('[data-refresh]'), async () => {
      const { callSessions } = await request('history');
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
      const summary = document.createElement('p');
      summary.textContent = callSessions.length + ' calls · ' + (seconds / 60).toFixed(1) + ' call minutes';
      const breakdown = document.createElement('ul');
      for (const [label, count] of counts) {
        const item = document.createElement('li');
        item.textContent = label + ' · ' + count;
        breakdown.append(item);
      }
      analytics.replaceChildren(heading, summary, breakdown);
      calls.replaceChildren();
      for (const call of callSessions) {
        const row = document.createElement('p');
        const button = document.createElement('button');
        button.textContent = 'View call';
        row.append([call.calleeNumber, call.status, call.channel].filter(Boolean).join(' · ') + ' ', button);
        calls.append(row);
        onClick(button, async () => {
          const detail = await request('detail', { id: call.id });
          dialog.querySelector('pre').textContent = JSON.stringify(detail, null, 2);
          if (!dialog.open) dialog.showModal();
          status.textContent = 'Call details loaded.';
        });
      }
      status.textContent = callSessions.length ? 'Recent Ravan calls loaded.' : 'No recent Ravan calls.';
    });
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
