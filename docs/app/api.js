/* Data layer shared by the worker app and the staff dashboard.
   LIVE mode: Supabase (when SUPABASE_URL and SUPABASE_ANON_KEY are set in config.js).
   DEMO mode: this browser's storage only. */
(function () {
  const cfg = window.TUCTA_CONFIG || {};
  // The worker app and the staff apps keep separate sign-ins, even on the same website.
  const ROLE = window.TMWRC_ROLE || "worker";
  const STORAGE_KEY = "tmwrc-auth-" + (ROLE === "worker" ? "worker" : "staff");
  const LIVE = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  const DEMO_KEY = "tucta_demo_events";
  const SUPABASE_SRC = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";

  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };

  let sbPromise = null;
  function client() {
    if (!LIVE) return Promise.resolve(null);
    if (!sbPromise) {
      sbPromise = new Promise((resolve, reject) => {
        const make = () => window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY,
          { auth: { storageKey: STORAGE_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
        if (window.supabase) return resolve(make());
        const s = document.createElement("script");
        s.src = SUPABASE_SRC;
        s.onload = () => resolve(make());
        s.onerror = () => { sbPromise = null; reject(new Error("Could not load the online database library")); };
        document.head.appendChild(s);
      });
    }
    return sbPromise;
  }

  function uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  /* ---------- writes (worker app) ---------- */
  async function sendEvent(ev) {
    if (!navigator.onLine) throw new Error("offline");
    if (!LIVE) {
      const all = ls.get(DEMO_KEY, []);
      if (!all.some(e => e.id === ev.id)) all.push({ ...ev, received_at: new Date().toISOString(), status: "new", staff_note: null });
      ls.set(DEMO_KEY, all);
      return;
    }
    const sb = await client();
    const { error } = await sb.from("events").insert(ev);
    if (error && error.code !== "23505") throw error; // 23505 = already received (safe retry)
  }

  /* ---------- reads & updates (dashboard) ---------- */
  async function listEvents() {
    if (!LIVE) return ls.get(DEMO_KEY, []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
    const sb = await client();
    const { data, error } = await sb.from("events").select("*").order("created_at", { ascending: false }).limit(5000);
    if (error) throw error;
    return data;
  }

  async function updateEvent(id, patch) {
    if (!LIVE) {
      const all = ls.get(DEMO_KEY, []);
      const i = all.findIndex(e => e.id === id);
      if (i >= 0) { all[i] = { ...all[i], ...patch }; ls.set(DEMO_KEY, all); }
      return;
    }
    const sb = await client();
    const { error } = await sb.from("events").update(patch).eq("id", id);
    if (error) throw error;
  }

  async function staffInsert(ev) {
    if (!LIVE) { const all = ls.get(DEMO_KEY, []); all.push({ status: "new", staff_note: null, ...ev, received_at: new Date().toISOString() }); ls.set(DEMO_KEY, all); return; }
    const sb = await client();
    const { error } = await sb.from("events").insert(ev);
    if (error) throw error;
  }

  /* ---------- messages between the Centre and the worker ---------- */
  const REPLY_KEY = "tucta_demo_replies";
  // staff: every message
  async function listReplies() {
    if (!LIVE) return ls.get(REPLY_KEY, []);
    const sb = await client();
    const { data, error } = await sb.from("replies").select("*").order("created_at", { ascending: true }).limit(10000);
    if (error) throw error;
    return data;
  }
  // staff sends a message to a worker about one case
  async function staffReply(r) {
    const row = { id: uuid(), created_at: new Date().toISOString(), sender: "staff", ...r };
    if (!LIVE) { ls.set(REPLY_KEY, ls.get(REPLY_KEY, []).concat(row)); return row; }
    const sb = await client();
    const { error } = await sb.from("replies").insert(row);
    if (error) throw error;
    return row;
  }
  // worker answers on one of their own cases
  async function workerReply(workerId, eventId, body) {
    if (!navigator.onLine) throw new Error("offline");
    const row = { id: uuid(), created_at: new Date().toISOString(), worker_id: workerId, event_id: eventId, sender: "worker", body, staff_name: null };
    if (!LIVE) { ls.set(REPLY_KEY, ls.get(REPLY_KEY, []).concat(row)); return row; }
    const sb = await client();
    const { error } = await sb.from("replies").insert(row);
    if (error) throw error;
    return row;
  }
  // worker: status of their own cases and the Centre's messages (the database only returns their own)
  async function workerFeed(workerId) {
    if (!navigator.onLine) throw new Error("offline");
    if (!LIVE) {
      const evs = ls.get(DEMO_KEY, []).filter(e => e.worker_id === workerId && (e.kind === "sos" || e.kind === "help"))
        .map(e => ({ id: e.id, status: e.status, kind: e.kind, category: e.category, created_at: e.created_at }));
      return { events: evs, replies: ls.get(REPLY_KEY, []).filter(r => r.worker_id === workerId) };
    }
    const sb = await client();
    const [ev, rp] = await Promise.all([
      sb.from("events").select("id,status,kind,category,created_at").eq("worker_id", workerId).in("kind", ["sos", "help"]).order("created_at", { ascending: false }),
      sb.from("replies").select("id,created_at,event_id,sender,staff_name,body").eq("worker_id", workerId).order("created_at", { ascending: true })
    ]);
    if (ev.error) throw ev.error; if (rp.error) throw rp.error;
    return { events: ev.data || [], replies: rp.data || [] };
  }

  function subscribe(onChange) {
    if (!LIVE) {
      window.addEventListener("storage", e => { if (e.key === DEMO_KEY || e.key === REPLY_KEY) onChange(e.key === REPLY_KEY ? "replies" : "events"); });
      return;
    }
    client().then(sb => {
      sb.channel("tmwrc-feed")
        .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => onChange("events"))
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "replies" }, () => onChange("replies"))
        .subscribe();
    }).catch(() => {});
  }

  /* ---------- accounts: register / sign in with a one-time code sent by email ---------- */
  const DEMO_AUTH = "tmwrc_demo_auth_" + (ROLE === "worker" ? "worker" : "staff");
  const DEMO_USERS = "tmwrc_demo_users";
  const friendly = (e) => {
    const m = String((e && e.message) || e || "");
    if (/signups not allowed|user not found|not allowed for otp/i.test(m)) return new Error("no_account");
    if (/expired|invalid/i.test(m) && /token|otp|code/i.test(m)) return new Error("bad_code");
    if (/rate limit|too many|security purposes|only request this after/i.test(m)) return new Error("too_many");
    if (/email.*invalid|invalid.*email/i.test(m)) return new Error("bad_email");
    return new Error(m || "failed");
  };
  const auth = {
    // Sends a 6-digit code to the email. create=true for "Register", false for "Sign in".
    async sendCode(email, create, name) {
      email = email.trim().toLowerCase();
      if (!LIVE) {
        const users = ls.get(DEMO_USERS, {});
        if (!create && !users[email]) throw new Error("no_account");
        const code = String(Math.floor(100000 + Math.random() * 900000));
        ls.set("tmwrc_demo_code", { email, code, create, name });
        return { demoCode: code };
      }
      const sb = await client();
      const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: !!create, data: name ? { name } : undefined } });
      if (error) throw friendly(error);
      return {};
    },
    async verifyCode(email, code) {
      email = email.trim().toLowerCase(); code = String(code).replace(/\D/g, "");
      if (!LIVE) {
        const p = ls.get("tmwrc_demo_code", null);
        if (!p || p.email !== email || p.code !== code) throw new Error("bad_code");
        const users = ls.get(DEMO_USERS, {});
        if (!users[email]) users[email] = { id: uuid(), email, name: p.name || "" };
        ls.set(DEMO_USERS, users);
        ls.set(DEMO_AUTH, users[email]);
        return users[email];
      }
      const sb = await client();
      const { data, error } = await sb.auth.verifyOtp({ email, token: code, type: "email" });
      if (error) throw friendly(error);
      return { id: data.user.id, email: data.user.email, name: (data.user.user_metadata || {}).name || "" };
    },
    // Fallback while the email still contains a link instead of a code: the person pastes the link here.
    async verifyLink(link) {
      let u; try { u = new URL(String(link).trim()); } catch (e) { throw new Error("bad_link"); }
      const hash = u.searchParams.get("token") || u.searchParams.get("token_hash");
      const kind = u.searchParams.get("type") || "magiclink";
      if (!hash) throw new Error("bad_link");
      if (!LIVE) throw new Error("bad_link");
      const sb = await client();
      let r = await sb.auth.verifyOtp({ token_hash: hash, type: kind === "signup" ? "signup" : kind === "invite" ? "invite" : "magiclink" });
      if (r.error) r = await sb.auth.verifyOtp({ token_hash: hash, type: "email" });
      if (r.error) throw friendly(r.error);
      const usr = r.data.user;
      return { id: usr.id, email: usr.email, name: (usr.user_metadata || {}).name || "" };
    },
    // Signed-in user from this phone (works offline once signed in)
    async user() {
      if (!LIVE) return ls.get(DEMO_AUTH, null);
      const sb = await client();
      const { data } = await sb.auth.getSession();
      const u = data.session && data.session.user;
      return u ? { id: u.id, email: u.email, name: (u.user_metadata || {}).name || "" } : null;
    },
    async session() { return this.user(); },
    async signOut() {
      if (!LIVE) { ls.set(DEMO_AUTH, null); return; }
      const sb = await client(); await sb.auth.signOut();
    }
  };

  /* ---------- worker profile, kept online so it comes back on a new phone ---------- */
  async function saveProfile(userId, profile) {
    if (!LIVE) { const all = ls.get("tmwrc_demo_profiles", {}); all[userId] = profile; ls.set("tmwrc_demo_profiles", all); return; }
    const sb = await client();
    const { error } = await sb.from("workers").upsert({ user_id: userId, profile, updated_at: new Date().toISOString() });
    if (error) throw error;
  }
  async function loadProfile(userId) {
    if (!LIVE) return (ls.get("tmwrc_demo_profiles", {}))[userId] || null;
    const sb = await client();
    const { data, error } = await sb.from("workers").select("profile").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data ? data.profile : null;
  }

  /* ---------- staff accounts: register, wait for approval, approve others ---------- */
  const staff = {
    async status() {
      if (!LIVE) { const u = ls.get(DEMO_AUTH, null); const st = ls.get("tmwrc_demo_staff", {}); return u ? (st[u.id] || "none") : "none"; }
      const sb = await client();
      const { data, error } = await sb.rpc("my_staff_status");
      if (error) throw error;
      return data;
    },
    async request(name) {
      if (!LIVE) { // demo: the first staff account is approved at once, later ones wait
        const u = ls.get(DEMO_AUTH, null); const st = ls.get("tmwrc_demo_staff", {});
        st[u.id] = Object.values(st).includes("staff") ? (st[u.id] === "staff" ? "staff" : "pending") : "staff";
        ls.set("tmwrc_demo_staff", st);
        if (st[u.id] === "pending") { const r = ls.get("tmwrc_demo_requests", []); r.push({ user_id: u.id, name, email: u.email, status: "pending", created_at: new Date().toISOString() }); ls.set("tmwrc_demo_requests", r); }
        return st[u.id];
      }
      const sb = await client();
      const { data, error } = await sb.rpc("request_staff", { p_name: name });
      if (error) throw error;
      return data;
    },
    async requests() {
      if (!LIVE) return ls.get("tmwrc_demo_requests", []).filter(r => r.status === "pending");
      const sb = await client();
      const { data, error } = await sb.from("staff_requests").select("*").eq("status", "pending").order("created_at");
      if (error) throw error;
      return data;
    },
    async decide(userId, approve) {
      if (!LIVE) {
        const r = ls.get("tmwrc_demo_requests", []); const x = r.find(y => y.user_id === userId); if (x) x.status = approve ? "approved" : "declined"; ls.set("tmwrc_demo_requests", r);
        const st = ls.get("tmwrc_demo_staff", {}); st[userId] = approve ? "staff" : "declined"; ls.set("tmwrc_demo_staff", st); return;
      }
      const sb = await client();
      const { error } = await sb.rpc("decide_staff", { p_user: userId, p_approve: approve });
      if (error) throw error;
    }
  };

  /* ---------- demo helpers ---------- */
  function seedDemo(events) {
    if (LIVE) return false;
    if (ls.get("tucta_demo_seeded", false)) return false;
    ls.set(DEMO_KEY, ls.get(DEMO_KEY, []).concat(events));
    ls.set("tucta_demo_seeded", true);
    return true;
  }
  function seedDemoReplies(rows) { if (!LIVE && !ls.get(REPLY_KEY, []).length) ls.set(REPLY_KEY, rows); }
  function clearDemo() { if (!LIVE) { ls.set(DEMO_KEY, []); ls.set(REPLY_KEY, []); ls.set("tucta_demo_seeded", false); } }

  window.TuctaAPI = { LIVE, ROLE, uuid, ls, sendEvent, listEvents, updateEvent, staffInsert, subscribe, auth, staff, saveProfile, loadProfile, seedDemo, seedDemoReplies, clearDemo, listReplies, staffReply, workerReply, workerFeed };
})();
