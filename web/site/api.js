/* Data layer shared by the worker app and the staff dashboard.
   LIVE mode: Supabase (when SUPABASE_URL and SUPABASE_ANON_KEY are set in config.js).
   DEMO mode: this browser's storage only. */
(function () {
  const cfg = window.TUCTA_CONFIG || {};
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
        if (window.supabase) return resolve(window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY));
        const s = document.createElement("script");
        s.src = SUPABASE_SRC;
        s.onload = () => resolve(window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY));
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
    const { error } = await sb.rpc("worker_reply", { p_worker: workerId, p_event: eventId, p_body: body });
    if (error) throw error;
    return row;
  }
  // worker: status of their own cases and the Centre's messages (only for this phone's private id)
  async function workerFeed(workerId) {
    if (!navigator.onLine) throw new Error("offline");
    if (!LIVE) {
      const evs = ls.get(DEMO_KEY, []).filter(e => e.worker_id === workerId && (e.kind === "sos" || e.kind === "help"))
        .map(e => ({ id: e.id, status: e.status, kind: e.kind, category: e.category, created_at: e.created_at }));
      return { events: evs, replies: ls.get(REPLY_KEY, []).filter(r => r.worker_id === workerId) };
    }
    const sb = await client();
    const { data, error } = await sb.rpc("worker_feed", { p_worker: workerId });
    if (error) throw error;
    return data || { events: [], replies: [] };
  }

  function subscribe(onChange) {
    if (!LIVE) {
      window.addEventListener("storage", e => { if (e.key === DEMO_KEY || e.key === REPLY_KEY) onChange(e.key === REPLY_KEY ? "replies" : "events"); });
      return;
    }
    client().then(sb => {
      sb.channel("thc-feed")
        .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => onChange("events"))
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "replies" }, () => onChange("replies"))
        .subscribe();
    }).catch(() => {});
  }

  /* ---------- staff sign-in ---------- */
  const auth = {
    async session() { if (!LIVE) return { demo: true }; const sb = await client(); const { data } = await sb.auth.getSession(); return data.session; },
    async signIn(email, password) { const sb = await client(); const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; },
    async signOut() { if (!LIVE) return; const sb = await client(); await sb.auth.signOut(); }
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

  window.TuctaAPI = { LIVE, uuid, ls, sendEvent, listEvents, updateEvent, staffInsert, subscribe, auth, seedDemo, seedDemoReplies, clearDemo, listReplies, staffReply, workerReply, workerFeed };
})();
