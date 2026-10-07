// Checks the demo code sign-in against the real database: worker and Centre staff.
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const cfgSrc = fs.readFileSync("web/config.js", "utf8");
const pick = k => (cfgSrc.match(new RegExp(k + ':\\s*"([^"]*)"')) || [])[1];
const URL = pick("SUPABASE_URL"), KEY = pick("SUPABASE_ANON_KEY"), CODE = pick("DEMO_CODE");
const fail = m => { console.error("FAILED:", m); process.exit(1); };
const mk = () => createClient(URL, KEY, { auth: { persistSession: false } });

async function demoLogin(sb, email, code, name) {
  const { data, error } = await sb.functions.invoke("demo-login", { body: { email, code, name } });
  if (error) { let j = {}; try { j = await error.context.json(); } catch {} return { error: j.error || error.message }; }
  const r = await sb.auth.verifyOtp({ token_hash: data.token_hash, type: "magiclink" });
  return r.error ? { error: r.error.message } : { user: r.data.user };
}

const w = mk();
const wrong = await demoLogin(w, "demo-check-worker@tmwrc.test", "000000", "x");
console.log("wrong code →", wrong.error); if (wrong.error !== "bad_code") fail("wrong code accepted");

const a = await demoLogin(w, "demo-check-worker@tmwrc.test", CODE, "Demo Check Worker");
if (a.error) fail("worker demo login: " + a.error);
console.log("worker signed in:", a.user.email, "demo =", a.user.app_metadata.demo);
const ev = { id: crypto.randomUUID(), created_at: new Date().toISOString(), worker_id: a.user.id, kind: "checkin", message: "demo check", worker: { full_name: "Demo Check Worker" }, channel: "app" };
const ins = await w.from("events").insert(ev); if (ins.error) fail("worker insert: " + ins.error.message);
console.log("worker can send a report: yes");
const other = await w.from("events").select("id").neq("worker_id", a.user.id).limit(1);
console.log("worker sees other workers' reports:", (other.data || []).length ? "YES (bad)" : "no");
if ((other.data || []).length) fail("worker can read others");

const real = await demoLogin(mk(), "hansnyange6@gmail.com", CODE, "x");
console.log("real account with demo code →", real.error); if (real.error !== "real_account") fail("real account not protected");

const c = mk();
const s = await demoLogin(c, "demo-check-staff@tmwrc.test", CODE, "Demo Check Staff");
if (s.error) fail("staff demo login: " + s.error);
const st = await c.rpc("request_staff", { p_name: "Demo Check Staff" });
console.log("Centre demo staff status:", st.data, st.error ? st.error.message : "");
if (st.data !== "staff") fail("demo staff not approved");
const seen = await c.from("events").select("id").eq("id", ev.id);
console.log("Centre sees the worker's report:", (seen.data || []).length ? "yes" : "no");
if (!(seen.data || []).length) fail("centre cannot see report");
console.log("\nPASSED");
