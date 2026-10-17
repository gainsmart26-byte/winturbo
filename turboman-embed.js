(() => {
  if (window.__turboManEmbed) return;
  window.__turboManEmbed = true;
  const script = document.currentScript;
  const assetBase = new URL(".", script?.src || location.href).href;
  const supabaseUrl = "https://kxspsqtdvngiovjvskuq.supabase.co";
  const endpoint = `${supabaseUrl}/functions/v1/turboman-chat`;
  const apiKey = "sb_publishable_mY0ClcO6rmkXBE9ppsX5ew_IFQ4jvD8";
  const visitor = localStorage.turbomanVisitor || (localStorage.turbomanVisitor = crypto.randomUUID());
  let session = localStorage.turbomanSession || "", voice = true, recognition, listening = false, pendingMessage = "";
  const codes = { English:"en-IN", Hindi:"hi-IN", Hinglish:"hi-IN", Punjabi:"pa-IN", Bengali:"bn-IN", Marathi:"mr-IN", Gujarati:"gu-IN", Tamil:"ta-IN", Telugu:"te-IN", Kannada:"kn-IN", Malayalam:"ml-IN", Auto:"en-IN" };
  const token = () => sessionStorage.getItem("turbomanAccessToken") || "";

  const host = document.createElement("div");
  host.id = "turboman-chatbot";
  document.body.appendChild(host);
  const root = host.attachShadow({ mode:"open" });
  root.innerHTML = `<style>
    *{box-sizing:border-box;font-family:Inter,system-ui,sans-serif}.launch{position:fixed;right:20px;bottom:20px;z-index:2147483646;border:0;border-radius:999px;background:linear-gradient(135deg,#42e36c,#ff8a2b);color:#07100a;font-weight:950;padding:14px 18px;box-shadow:0 14px 40px #0009;cursor:pointer}.panel{position:fixed;right:20px;bottom:82px;z-index:2147483647;width:min(390px,calc(100vw - 24px));height:min(650px,calc(100vh - 104px));display:none;grid-template-rows:auto 1fr auto;background:#0b120e;color:#f4fff7;border:1px solid #314038;border-radius:20px;overflow:hidden;box-shadow:0 28px 80px #000d}.panel.open{display:grid}.head{display:flex;align-items:center;gap:10px;padding:13px;background:linear-gradient(120deg,#14251a,#15170f);border-bottom:1px solid #29362e}.avatar{width:44px;height:44px;border-radius:13px;filter:drop-shadow(0 0 8px #42e36c77)}.identity{min-width:0}.identity b,.identity small{display:block}.identity small{font-size:10px;color:#9caf9f}.head select{margin-left:auto;max-width:105px;background:#111b15;color:#fff;border:1px solid #334238;border-radius:8px;padding:7px}.close{border:0;background:transparent;color:#fff;font-size:22px;cursor:pointer}.messages{overflow:auto;padding:14px;display:flex;flex-direction:column;gap:9px}.msg{max-width:86%;padding:10px 12px;border-radius:14px;white-space:pre-wrap;line-height:1.42;font-size:13px}.bot{align-self:flex-start;background:#17231b;border:1px solid #2a3c30}.user{align-self:flex-end;background:#42e36c;color:#07100a}.compose{display:grid;grid-template-columns:auto 1fr auto;gap:7px;padding:11px;border-top:1px solid #29362e}.compose textarea{resize:none;min-height:44px;max-height:90px;border:1px solid #334238;border-radius:10px;background:#111a14;color:#fff;padding:10px}.compose button{border:0;border-radius:9px;background:#223027;color:#fff;padding:0 11px;cursor:pointer}.compose .send{background:#42e36c;color:#07100a;font-weight:900}.mic.live{background:#ff8a2b;color:#07100a}.tools{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;color:#82958a;font-size:9px}.tools button{padding:4px 7px;font-size:9px}.verify{display:none;position:absolute;inset:70px 16px auto;padding:16px;background:#111b15;border:1px solid #42e36c;border-radius:14px;z-index:3;box-shadow:0 16px 50px #000}.verify.open{display:block}.verify h3{margin:0 0 6px}.verify p{font-size:11px;color:#a9b9ae}.verify input{width:100%;padding:10px;margin:5px 0;background:#08100b;color:#fff;border:1px solid #34483b;border-radius:8px}.verify button{padding:9px 11px;margin-top:5px;border:0;border-radius:8px;background:#42e36c;color:#07100a;font-weight:800}.verify .cancel{background:#26352b;color:#fff}.verify small{display:block;margin-top:7px;color:#ffbd85}@media(max-width:520px){.launch{right:12px;bottom:12px}.panel{right:12px;bottom:68px}}
  </style>
  <button class="launch">⚡ Ask TurboMan · 24×7</button>
  <aside class="panel" aria-label="TurboMan chat">
    <header class="head"><img class="avatar" src="${assetBase}turboman-icon.svg" alt="TurboMan"><div class="identity"><b>TurboMan</b><small>Here 24×7 · Multilingual support</small></div><select class="language"><option>Auto</option></select><button class="close">×</button></header>
    <div class="verify"><h3>Verify your account</h3><p>Enter the phone number registered with WinTurbo. We will send a one-time password. Never share the OTP with an agent.</p><input class="phone" inputmode="tel" placeholder="+91 98765 43210"><button class="sendOtp">Send OTP</button><input class="otp" inputmode="numeric" maxlength="8" placeholder="Enter OTP" hidden><button class="verifyOtp" hidden>Verify & show my details</button><button class="cancel">Cancel</button><small class="verifyStatus"></small></div>
    <div class="messages"></div>
    <div class="compose"><button class="mic" title="Start hands-free conversation">🎙</button><textarea maxlength="2000" placeholder="Ask in any language…"></textarea><button class="send">Send</button><div class="tools"><span>Account details require registered-phone OTP</span><button class="voice">🔊 Voice on</button></div></div>
  </aside>`;
  const q = s => root.querySelector(s), panel = q(".panel"), messages = q(".messages"), input = q("textarea"), language = q(".language");

  function speak(text) {
    if (!voice || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = codes[language.value] || "en-IN";
    speechSynthesis.speak(u);
  }
  function add(text, type) {
    const d = document.createElement("div");
    d.className = `msg ${type}`;
    d.textContent = text;
    messages.appendChild(d);
    messages.scrollTop = messages.scrollHeight;
    if (type === "bot") speak(text);
  }
  async function send(messageOverride) {
    const message = (messageOverride || input.value).trim();
    if (!message) return;
    if (!messageOverride) { input.value = ""; add(message, "user"); }
    q(".send").disabled = true;
    try {
      const headers = { "Content-Type":"application/json", apikey:apiKey };
      if (token()) headers.Authorization = `Bearer ${token()}`;
      const r = await fetch(endpoint, { method:"POST", headers, body:JSON.stringify({ message, session_id:session, visitor_id:visitor, language:language.value }) });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "TurboMan is unavailable");
      session = data.session_id;
      localStorage.turbomanSession = session;
      add(data.answer, "bot");
      if (data.verification_required) { pendingMessage = message; q(".verify").classList.add("open"); }
    } catch (e) { add(e.message, "bot"); }
    finally { q(".send").disabled = false; }
  }
  function stopListening() {
    listening = false;
    q(".mic").classList.remove("live");
    q(".mic").textContent = "🎙";
    try { recognition?.stop(); } catch {}
  }
  function toggleListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert("Voice input is not supported in this browser.");
    if (listening) return stopListening();
    recognition = new SR();
    recognition.lang = codes[language.value] || "en-IN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onspeechstart = () => { if ("speechSynthesis" in window) speechSynthesis.cancel(); };
    recognition.onresult = e => {
      let finalText = "";
      for (let i=e.resultIndex;i<e.results.length;i++) if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
      if (finalText.trim()) { input.value = finalText.trim(); send(); }
    };
    recognition.onend = () => { if (listening) { try { recognition.start(); } catch {} } };
    recognition.onerror = e => { if (e.error === "not-allowed" || e.error === "service-not-allowed") stopListening(); };
    listening = true;
    q(".mic").classList.add("live");
    q(".mic").textContent = "■";
    recognition.start();
  }
  const cleanPhone = value => {
    const digits = value.replace(/\D/g, "");
    return digits.length === 10 ? `+91${digits}` : `+${digits}`;
  };
  async function requestOtp() {
    const phone = cleanPhone(q(".phone").value);
    if (!/^\+\d{10,15}$/.test(phone)) return q(".verifyStatus").textContent = "Enter a valid phone number with country code.";
    q(".verifyStatus").textContent = "Sending OTP…";
    const r = await fetch(`${supabaseUrl}/auth/v1/otp`, { method:"POST", headers:{ apikey:apiKey, "Content-Type":"application/json" }, body:JSON.stringify({ phone, create_user:true }) });
    if (!r.ok) { const e = await r.json().catch(()=>({})); q(".verifyStatus").textContent = e.msg || e.message || "Phone verification is not configured yet."; return; }
    q(".otp").hidden = q(".verifyOtp").hidden = false;
    q(".verifyStatus").textContent = "OTP sent. It expires shortly.";
  }
  async function verifyOtp() {
    const phone = cleanPhone(q(".phone").value), otp = q(".otp").value.trim();
    q(".verifyStatus").textContent = "Verifying…";
    const r = await fetch(`${supabaseUrl}/auth/v1/verify`, { method:"POST", headers:{ apikey:apiKey, "Content-Type":"application/json" }, body:JSON.stringify({ phone, token:otp, type:"sms" }) });
    const data = await r.json().catch(()=>({}));
    if (!r.ok || !data.access_token) return q(".verifyStatus").textContent = data.msg || data.message || "The OTP is invalid or expired.";
    sessionStorage.setItem("turbomanAccessToken", data.access_token);
    q(".verify").classList.remove("open");
    add("Phone verified securely. I’m retrieving your account information now.", "bot");
    if (pendingMessage) { const retry = pendingMessage; pendingMessage = ""; await send(retry); }
  }

  q(".launch").onclick = () => panel.classList.add("open");
  q(".close").onclick = () => { panel.classList.remove("open"); stopListening(); };
  q(".send").onclick = () => send();
  q(".mic").onclick = toggleListening;
  input.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };
  q(".voice").onclick = () => { voice = !voice; if (!voice) speechSynthesis?.cancel(); q(".voice").textContent = voice ? "🔊 Voice on" : "🔇 Voice off"; };
  q(".sendOtp").onclick = requestOtp;
  q(".verifyOtp").onclick = verifyOtp;
  q(".cancel").onclick = () => q(".verify").classList.remove("open");
  fetch(endpoint, { headers:{ apikey:apiKey } }).then(async r => {
    const c = await r.json();
    if (!r.ok) throw Error(c.error);
    language.innerHTML = "<option>Auto</option>" + c.supported_languages.map(x => `<option>${x}</option>`).join("");
    add(c.welcome_message, "bot");
    if (script?.dataset.open === "true") panel.classList.add("open");
  }).catch(e => { q(".launch").hidden = true; console.warn("TurboMan:", e.message); });
})();
