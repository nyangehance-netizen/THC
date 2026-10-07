// End-to-end test with the real online database: two separate "phones".
// Phone A runs THC (worker), phone B runs THC Centre (staff). Nothing is shared between them
// except the database, exactly like two real phones.
//   STAFF_EMAIL / STAFF_PASSWORD  staff login for THC Centre
//   BASE_URL                      where docs/app is served
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:8080";
const EMAIL = process.env.STAFF_EMAIL, PASSWORD = process.env.STAFF_PASSWORD;
const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
const NAME = `Test Worker ${stamp}`;
const REPLY = `Tumepokea SOS yako (test ${stamp})`;
const ANSWER = `Niko salama sasa (test ${stamp})`;
const log = (...a) => console.log("•", ...a);
const fail = m => { console.error("FAILED:", m); process.exit(1); };

const browser = await chromium.launch();
const geo = { geolocation: { latitude: 23.5880, longitude: 58.4059, accuracy: 12 }, permissions: ["geolocation"], viewport: { width: 400, height: 860 } };
const phoneA = await browser.newContext(geo);   // worker's phone (Muscat, Oman)
const phoneB = await browser.newContext(geo);   // centre staff phone
const errors = [];
for (const ctx of [phoneA, phoneB]) ctx.on("page", p => p.on("pageerror", e => errors.push(e.message)));

// 1. Worker registers and presses SOS
const w = await phoneA.newPage();
await w.goto(`${BASE}/index.html`);
await w.fill("#f_name", NAME); await w.fill("#f_phone", "+968 9000 0000"); await w.click("#nextBtn");
await w.selectOption("#f_country", "Oman"); await w.fill("#f_city", "Muscat"); await w.fill("#f_address", "Test address, Al Khuwair"); await w.click("#nextBtn");
await w.check("#f_consent"); await w.click("#nextBtn");
await w.waitForTimeout(3000);
await w.click("#sosBtn"); await w.click("#cdNow");
await w.waitForSelector(".sheet .done h2", { timeout: 20000 });
const sosResult = await w.textContent(".sheet .done h2");
log("Worker phone, after SOS:", sosResult);
if (!/SOS imetumwa|SOS sent/.test(sosResult)) fail("SOS was not delivered to the database");
await w.click("[data-x]");

// 2. Centre staff signs in and sees the SOS with the worker's GPS
const c = await phoneB.newPage();
await c.goto(`${BASE}/centre.html`);
await c.waitForSelector("#loginForm", { timeout: 20000 });
await c.fill("#lg_email", EMAIL); await c.fill("#lg_pass", PASSWORD); await c.click("#loginForm button[type=submit]");
await c.waitForSelector("#v-alerts:not([hidden])", { timeout: 20000 });
const card = c.locator(".cc", { hasText: NAME }).first();
await card.waitFor({ timeout: 20000 });
log("Centre phone sees:", (await card.innerText()).replace(/\s+/g, " "));
await card.click();
await c.waitForSelector("#pBody .hero", { timeout: 10000 });
const coords = await c.locator("#pBody .mono").first().innerText();
log("Centre phone, worker location:", coords);
if (!coords.includes("23.58")) fail("worker GPS not shown at the Centre");

// 3. Staff replies
await c.fill("#msg", REPLY); await c.click("#sendMsg");
await c.waitForTimeout(2500);
log("Centre phone, case status:", (await c.textContent("#pSt")).trim());

// 4. Worker sees the reply and the status, and answers
await w.waitForSelector(".centre-msg", { timeout: 60000 });
const banner = (await w.innerText(".centre-msg")).replace(/\s+/g, " ");
log("Worker phone, message from Centre:", banner);
if (!banner.includes(REPLY)) fail("staff reply did not reach the worker");
await w.click(".centre-msg");
await w.fill("#thMsg", ANSWER); await w.click("#thSend");
await w.waitForTimeout(2500);

// 5. Centre sees the worker's answer
await c.reload();
await c.waitForSelector("#v-alerts:not([hidden])", { timeout: 20000 });
await c.locator(".cc", { hasText: NAME }).first().click();
await c.waitForSelector(`#thread .bub.worker:has-text("${ANSWER}")`, { timeout: 30000 });
log("Centre phone, worker's answer arrived:", ANSWER);

await w.screenshot({ path: "out/worker-phone.png" });
await c.screenshot({ path: "out/centre-phone.png" });
if (errors.length) log("page errors:", errors);
console.log("\nPASSED: worker phone → database → centre phone → worker phone");
await browser.close();
