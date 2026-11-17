(() => {
  'use strict';

  const draft = 'Thank you for speaking with WinTurbo. If you need help with your account, visit https://winturbo.com.';
  const dateTime = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata',
  });
  const states = {
    http_ok: 'Provider HTTP OK',
    http_error: 'Provider rejected request',
    unconfirmed: 'Submission unconfirmed',
  };

  let navigation;

  async function mount() {
    const { profile } = await window.WinTurboLoadProfile();
    if (profile?.role !== 'admin' || !profile.is_active || document.getElementById('smsIntell')) return;
    const nav = document.querySelector('#app .nav');
    const main = document.querySelector('main.main');
    if (!nav || !main) return;

    const tab = document.createElement('button');
    tab.dataset.s = 'smsIntell';
    tab.textContent = 'SMS Intell';
    const section = document.createElement('section');
    section.id = 'smsIntell';
    section.className = 'section';
    section.innerHTML = `
      <div class="adminHero"><div><h2>SMS Intell</h2><p>SamparkHub follow-ups for answered outbound Ravan calls</p></div></div>
      <div class="card">
        <form>
          <p><label>Approved SMS text<br><textarea name="message" rows="4" maxlength="1000" required style="width:min(100%,42rem)"></textarea></label></p>
          <p><label>SamparkHub template ID<br><input name="templateId" inputmode="numeric" pattern="[0-9]{1,40}" required></label></p>
          <button class="primary" type="submit">Save draft</button>
          <button class="ghost" type="button" data-enable disabled>Enable sending</button>
          <button class="ghost" type="button" data-pause disabled>Pause sending</button>
        </form>
        <p data-state></p><p role="status" aria-live="polite"></p>
      </div>
      <div class="card">
        <h3>Recent send attempts</h3>
        <button class="ghost" type="button" data-refresh>Refresh delivery reports</button>
        <p>Code 011 confirms submission. Delivery status is fetched from SamparkHub for messages with a provider ID.</p>
        <div style="overflow-x:auto"><table>
          <thead><tr><th>Time (IST)</th><th>Phone</th><th>Outcome</th><th>HTTP status</th><th>Provider code</th><th>Delivery status</th><th>Delivery time (provider)</th></tr></thead>
          <tbody></tbody>
        </table></div>
      </div>`;
    nav.append(tab);
    main.append(section);

    const form = section.querySelector('form');
    const message = form.elements.namedItem('message');
    const templateId = form.elements.namedItem('templateId');
    const state = section.querySelector('[data-state]');
    const status = section.querySelector('[role=status]');
    const enable = section.querySelector('[data-enable]');
    const pause = section.querySelector('[data-pause]');
    const refresh = section.querySelector('[data-refresh]');
    const log = section.querySelector('tbody');
    let loaded;
    let pending = false;

    function updateButtons() {
      const saved = loaded?.settings;
      const matches = saved && saved.message === message.value && saved.template_id === templateId.value;
      enable.disabled = pending || !loaded?.configured || !matches || Boolean(saved?.enabled_at);
      pause.disabled = pending || !saved?.enabled_at;
    }

    async function run(action) {
      if (pending) return;
      pending = true;
      const fields = { message: message.value, templateId: templateId.value };
      const controls = [message, templateId, form.querySelector('[type=submit]'), refresh];
      controls.forEach((control) => { control.disabled = true; });
      updateButtons();
      status.textContent = 'Working…';
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) throw new Error('Sign in again.');
        const response = await fetch(SB_URL + '/functions/v1/sms-intell', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: 'Bearer ' + session.access_token },
          body: JSON.stringify({ action, ...fields }),
          signal: AbortSignal.timeout(15000),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'SMS Intell is unavailable.');
        if (!loaded || action !== 'status' && action !== 'refresh-delivery') {
          message.value = result.settings?.message ?? draft;
          templateId.value = result.settings?.template_id ?? '';
        }
        loaded = result;
        state.textContent = result.settings?.enabled_at
          ? 'Sending enabled since ' + dateTime.format(new Date(result.settings.enabled_at)) + ' IST'
          : result.configured ? 'Sending paused' : 'Server setup required';
        log.replaceChildren();
        if (!result.log.length) {
          const cell = log.insertRow().insertCell();
          cell.colSpan = 7;
          cell.textContent = 'No send attempts yet.';
        }
        for (const row of result.log) {
          const tr = log.insertRow();
          for (const value of [dateTime.format(new Date(row.created_at)), row.phone,
            row.status === 'http_ok' && row.provider_code === '011' ? 'Submitted' : states[row.status] ?? row.status,
            row.http_status ?? '—', row.provider_code ?? '—', row.delivery_status ?? (row.provider_message_id ? 'Awaiting report' : '—'), row.delivery_time ?? '—']) {
            tr.insertCell().textContent = value;
          }
        }
        status.textContent = result.delivery ? (result.delivery.checked ?
          result.delivery.updated + ' reports updated · ' + result.delivery.unavailable + ' unavailable' :
          'No pending submissions with a provider message ID.') : action === 'save' ? 'Draft saved. Sending is paused.' : '';
      } catch (error) {
        status.textContent = error.message;
      } finally {
        pending = false;
        controls.forEach((control) => { control.disabled = false; });
        updateButtons();
      }
    }

    form.addEventListener('input', updateButtons);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void run('save');
    });
    enable.onclick = () => { void run('enable'); };
    pause.onclick = () => { void run('pause'); };
    refresh.onclick = () => { void run('refresh-delivery'); };
    navigation = new AbortController();
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
      if (title) title.textContent = 'SMS Intell';
      void run('status');
    }, { capture: true, signal: navigation.signal });
  }

  if (location.hostname === 'winturbo.live' && typeof sb !== 'undefined') {
    window.WinTurboRegisterModule('smsIntell', mount);
    sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        navigation?.abort();
        document.getElementById('smsIntell')?.remove();
        document.querySelector('[data-s="smsIntell"]')?.remove();
      } else if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        setTimeout(() => mount().catch(() => {}), 0);
      }
    });
  }
})();
