/* Register / Sign in screen with a one-time code sent to the person's email.
   Used by the TMWRC worker app and the TMWRC Centre app.
   AuthUI.mount(container, { brand, subtitle, texts, onDone(user, { isNew, name }) }) */
(function () {
  const API = window.TuctaAPI;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const EN = {
    register: "Register", signin: "Sign in",
    regTitle: "Create your account", regSub: "New here? Enter your name and email. We send you a code to confirm it.",
    inTitle: "Welcome back", inSub: "Enter the email you registered with. We send you a code to sign in.",
    name: "Full name", email: "Email address", send: "Send code",
    codeTitle: "Enter the code", codeSub: "We sent a 6-digit code to {e}. It can take a minute to arrive. Check your spam folder too.",
    verify: "Confirm", resend: "Send a new code", resendIn: "New code in {s} s", change: "Use a different email",
    needName: "Enter your full name.", needEmail: "Enter a valid email address.", needCode: "Enter the code from the email.",
    no_account: "No account uses this email. Tap Register to create one.",
    bad_code: "That code is wrong or has expired. Check the latest email or send a new code.",
    too_many: "Too many codes requested. Wait a minute and try again.",
    bad_email: "That email address does not look right.",
    offline: "No internet. Connect to send the code.", failed: "Something went wrong. Try again.",
    demoCode: "Demo mode, no email is sent. Your code is {c}.", sent: "Code sent",
    demoHint: "Demo version: if the email does not arrive, enter the demo code {c}.",
    real_account: "This email already has a real account. Enter the code from the email instead of the demo code.",
    demo_off: "The demo code is switched off. Enter the code from the email.",
    gotLink: "Got a link in the email instead of a code?", linkHelp: "Press and hold the link or button in the email, choose Copy link, then paste it here.",
    linkPh: "Paste the link from the email", useLink: "Sign in with link", bad_link: "That is not the link from the email. Copy the whole link and try again."
  };

  function mount(el, opts) {
    const T = Object.assign({}, EN, opts.texts || {});
    const t = (k, v) => { let s = T[k] || k; if (v) for (const x in v) s = s.replace("{" + x + "}", v[x]); return s; };
    const st = { mode: opts.start || "register", step: "form", email: "", name: "", timer: null, wait: 0 };

    function render() {
      clearInterval(st.timer);
      el.innerHTML = `<div class="auth">
        <div class="auth-brand"><span class="auth-logo">${esc(opts.brand || "TMWRC")}</span>${opts.subtitle ? `<span class="auth-sub">${esc(opts.subtitle)}</span>` : ""}</div>
        ${st.step === "form" ? formHtml() : codeHtml()}
      </div>`;
      wire();
    }
    function formHtml() {
      const reg = st.mode === "register";
      return `<div class="auth-seg" role="tablist">
          <span class="auth-pill" style="transform:translateX(${reg ? 0 : 100}%)"></span>
          <button type="button" role="tab" data-m="register" aria-selected="${reg}">${t("register")}</button>
          <button type="button" role="tab" data-m="signin" aria-selected="${!reg}">${t("signin")}</button>
        </div>
        <form class="auth-card" id="authForm" novalidate>
          <h1>${t(reg ? "regTitle" : "inTitle")}</h1>
          <p class="muted">${t(reg ? "regSub" : "inSub")}</p>
          ${reg ? `<label>${t("name")}<input id="au_name" autocomplete="name" value="${esc(st.name)}"></label>` : ""}
          <label>${t("email")}<input id="au_email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" value="${esc(st.email)}" placeholder="name@example.com"></label>
          <p class="note bad" id="au_err" hidden></p>
          <button class="btn primary big" type="submit" id="au_send">${t("send")}</button>
        </form>`;
    }
    function codeHtml() {
      return `<form class="auth-card" id="codeForm" novalidate>
          <h1>${t("codeTitle")}</h1>
          <p class="muted">${t("codeSub", { e: `<b>${esc(st.email)}</b>` })}</p>
          <p class="note" id="au_demo" hidden></p>
          <input id="au_code" class="auth-code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="••••••" aria-label="${esc(t("codeTitle"))}">
          <p class="note bad" id="au_err" hidden></p>
          <button class="btn primary big" type="submit" id="au_verify">${t("verify")}</button>
          <div class="auth-links"><button type="button" class="linkbtn" id="au_resend"></button><button type="button" class="linkbtn" id="au_change">${t("change")}</button></div>
          <details class="auth-alt"><summary>${t("gotLink")}</summary>
            <p class="small muted">${t("linkHelp")}</p>
            <input id="au_link" type="url" inputmode="url" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${esc(t("linkPh"))}">
            <button type="button" class="btn" id="au_linkgo">${t("useLink")}</button>
          </details>
        </form>`;
    }
    function err(msg) { const e = el.querySelector("#au_err"); e.hidden = false; e.textContent = msg; const c = el.querySelector(".auth-card"); c.classList.remove("shake"); void c.offsetWidth; c.classList.add("shake"); }
    function msgFor(e) { const k = e && e.message; return T[k] || (navigator.onLine ? t("failed") + (k && !T[k] ? ` (${k})` : "") : t("offline")); }
    function startWait(sec) {
      st.wait = sec; const b = el.querySelector("#au_resend"); if (!b) return;
      const tick = () => { b.disabled = st.wait > 0; b.textContent = st.wait > 0 ? t("resendIn", { s: st.wait }) : t("resend"); st.wait--; if (st.wait < -1) clearInterval(st.timer); };
      tick(); clearInterval(st.timer); st.timer = setInterval(tick, 1000);
    }
    async function send(btn) {
      if (!navigator.onLine && API.LIVE) return err(t("offline"));
      btn.disabled = true;
      try {
        const r = await API.auth.sendCode(st.email, st.mode === "register", st.name);
        st.step = "code"; render(); startWait(60); showDemo();
        if (r.demoCode) { const d = el.querySelector("#au_demo"); d.hidden = false; d.textContent = t("demoCode", { c: r.demoCode }); }
        el.querySelector("#au_code").focus();
      } catch (e) {
        const demo = (window.TUCTA_CONFIG || {}).DEMO_CODE;
        if (demo && API.LIVE && !["no_account", "bad_email"].includes(e && e.message)) { st.step = "code"; render(); startWait(60); showDemo(); el.querySelector("#au_code").focus(); return; }
        btn.disabled = false; err(msgFor(e));
      }
    }
    function showDemo() {
      const demo = (window.TUCTA_CONFIG || {}).DEMO_CODE; const d = el.querySelector("#au_demo");
      if (demo && API.LIVE && d) { d.hidden = false; d.textContent = t("demoHint", { c: demo }); }
    }
    function wire() {
      el.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { st.mode = b.dataset.m; render(); });
      const f = el.querySelector("#authForm");
      if (f) f.onsubmit = ev => {
        ev.preventDefault();
        if (st.mode === "register") { st.name = el.querySelector("#au_name").value.trim(); if (!st.name) return err(t("needName")); }
        st.email = el.querySelector("#au_email").value.trim().toLowerCase();
        if (!EMAIL_RE.test(st.email)) return err(t("needEmail"));
        send(el.querySelector("#au_send"));
      };
      const c = el.querySelector("#codeForm");
      if (c) {
        const inp = el.querySelector("#au_code");
        inp.oninput = () => { inp.value = inp.value.replace(/\D/g, ""); if (inp.value.length === 6) c.requestSubmit(); };
        c.onsubmit = async ev => {
          ev.preventDefault();
          const code = inp.value.trim(); if (code.length < 6) return err(t("needCode"));
          const b = el.querySelector("#au_verify"); b.disabled = true;
          try {
            const demo = (window.TUCTA_CONFIG || {}).DEMO_CODE;
            const user = (demo && API.LIVE && code === demo)
              ? await API.auth.demoLogin(st.email, code, st.name)
              : await API.auth.verifyCode(st.email, code);
            clearInterval(st.timer);
            opts.onDone(user, { isNew: st.mode === "register", name: st.name || user.name });
          } catch (e) { b.disabled = false; inp.select(); err(msgFor(e)); }
        };
        el.querySelector("#au_resend").onclick = e => { send(e.currentTarget).then(() => {}); };
        el.querySelector("#au_change").onclick = () => { st.step = "form"; render(); };
        el.querySelector("#au_linkgo").onclick = async e => {
          const b = e.currentTarget; const link = el.querySelector("#au_link").value.trim();
          if (!link) return err(t("bad_link"));
          b.disabled = true;
          try {
            const user = await API.auth.verifyLink(link);
            clearInterval(st.timer);
            opts.onDone(user, { isNew: st.mode === "register", name: st.name || user.name });
          } catch (ex) { b.disabled = false; err(msgFor(ex)); }
        };
      }
    }
    render();
    return { setTexts(x) { Object.assign(T, x); render(); } };
  }
  window.AuthUI = { mount };
})();
