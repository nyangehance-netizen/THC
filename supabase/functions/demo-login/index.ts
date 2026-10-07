// TMWRC demo sign-in: lets people try the apps with a shared demo code before real emails are set up.
// Turn it off in the database:  update app_settings set value = 'false' where key = 'demo_enabled';
//
// Safety: an email that already belongs to a real account (confirmed by an emailed code) cannot be
// opened with the demo code. Demo accounts are marked app_metadata.demo = true.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply(405, { error: "method" });

  let body: { email?: string; code?: string; name?: string };
  try { body = await req.json(); } catch { return reply(400, { error: "bad_request" }); }
  const email = String(body.email || "").trim().toLowerCase();
  const code = String(body.code || "").replace(/\D/g, "");
  const name = String(body.name || "").trim().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) return reply(400, { error: "bad_email" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error: setErr } = await admin.from("app_settings").select("key,value");
  if (setErr) return reply(500, { error: "settings" });
  const s = Object.fromEntries((rows || []).map((r: { key: string; value: string }) => [r.key, r.value]));
  if (s.demo_enabled !== "true") return reply(403, { error: "demo_off" });
  if (!code || code !== s.demo_code) return reply(403, { error: "bad_code" });

  const { data: found, error: lookErr } = await admin.rpc("demo_lookup_user", { p_email: email });
  if (lookErr) return reply(500, { error: "lookup" });
  const user = Array.isArray(found) ? found[0] : null;

  if (user && !user.is_demo && user.confirmed) return reply(403, { error: "real_account" });

  if (!user) {
    const { error } = await admin.auth.admin.createUser({
      email, email_confirm: true, user_metadata: name ? { name } : {}, app_metadata: { demo: true },
    });
    if (error) return reply(500, { error: "create", detail: error.message });
  } else if (!user.is_demo) {
    // registered earlier but never confirmed by email: turn it into a demo account
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      email_confirm: true, app_metadata: { demo: true }, ...(name ? { user_metadata: { name } } : {}),
    });
    if (error) return reply(500, { error: "update", detail: error.message });
  }

  // A one-time sign-in token for the app; no email is sent.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkErr || !link?.properties?.hashed_token) return reply(500, { error: "link", detail: linkErr?.message });
  return reply(200, { token_hash: link.properties.hashed_token, new_account: !user });
});
