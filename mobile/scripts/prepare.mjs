// Prepares one of the two native apps for Capacitor.
//   node scripts/prepare.mjs worker   -> THC (migrant workers)
//   node scripts/prepare.mjs centre   -> THC Centre (call centre staff)
// It copies the built web app (web/site) into mobile/www, makes the chosen page the start page,
// writes capacitor.config.json and puts that app's icon and splash into mobile/assets.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const mobile = path.resolve(here, "..");
const site = path.resolve(mobile, "..", "web", "site");
const which = process.argv[2];

const APPS = {
  worker: {
    appId: process.env.WORKER_APP_ID || "tz.or.tucta.thc",
    appName: "THC",
    page: "index.html",
    files: ["styles.css", "config.js", "api.js", "icon-192.png", "icon-512.png"],
    // remove the link to the staff app from the worker's app
    strip: [/ · <a href="centre\.html"[^>]*><\/a>/]
  },
  centre: {
    appId: process.env.CENTRE_APP_ID || "tz.or.tucta.thccentre",
    appName: "THC Centre",
    page: "centre.html",
    files: ["styles.css", "config.js", "api.js", "demo-data.js", "icon-centre-192.png", "icon-centre-512.png"],
    strip: [/<a class="btn" href="dashboard\.html">[^<]*<\/a>/]
  }
};

const app = APPS[which];
if (!app) { console.error("Usage: node scripts/prepare.mjs worker|centre"); process.exit(1); }
if (!fs.existsSync(path.join(site, app.page))) { console.error(`Missing ${site}/${app.page}. Run: python3 web/build.py`); process.exit(1); }

// 1. web files
const www = path.join(mobile, "www");
fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });
for (const f of app.files) fs.copyFileSync(path.join(site, f), path.join(www, f));
let html = fs.readFileSync(path.join(site, app.page), "utf8");
for (const re of app.strip) html = html.replace(re, "");
// inside the native app there is no service worker or web manifest
html = html.replace(/<link rel="manifest"[^>]*>\n?/, "");
html = html.replace('if ("serviceWorker" in navigator && location.protocol === "https:")', "if (false)");
fs.writeFileSync(path.join(www, "index.html"), html);

// 2. Capacitor settings
const config = {
  appId: app.appId,
  appName: app.appName,
  webDir: "www",
  backgroundColor: "#F5F5F7",
  android: { allowMixedContent: false, adjustMarginsForEdgeToEdge: "auto" },
  ios: { contentInset: "never", backgroundColor: "#F5F5F7" }
};
fs.writeFileSync(path.join(mobile, "capacitor.config.json"), JSON.stringify(config, null, 2));

// 3. icon + splash for @capacitor/assets
const assets = path.join(mobile, "assets");
fs.rmSync(assets, { recursive: true, force: true });
fs.cpSync(path.join(mobile, "art", which), assets, { recursive: true });

console.log(`Prepared ${app.appName} (${app.appId}) from ${app.page}`);
