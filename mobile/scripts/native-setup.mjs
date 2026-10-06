// Adds the phone permissions the apps need, after `npx cap add android|ios`.
//   node scripts/native-setup.mjs android
//   node scripts/native-setup.mjs ios
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const mobile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const platform = process.argv[2];
const cfg = JSON.parse(fs.readFileSync(path.join(mobile, "capacitor.config.json"), "utf8"));
const isCentre = cfg.appId.endsWith("centre");

if (platform === "android") {
  const file = path.join(mobile, "android/app/src/main/AndroidManifest.xml");
  let xml = fs.readFileSync(file, "utf8");
  const perms = [
    "android.permission.ACCESS_FINE_LOCATION",   // exact GPS for SOS
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.VIBRATE",                // SOS countdown / new alert
    "android.permission.POST_NOTIFICATIONS"      // alerts (Android 13+)
  ];
  const add = perms.filter(p => !xml.includes(`"${p}"`)).map(p => `    <uses-permission android:name="${p}" />`).join("\n");
  if (add) xml = xml.replace("</manifest>", `${add}\n    <uses-feature android:name="android.hardware.location.gps" android:required="false" />\n</manifest>`);
  fs.writeFileSync(file, xml);
  console.log("Android permissions added");
} else if (platform === "ios") {
  const plist = path.join(mobile, "ios/App/App/Info.plist");
  const set = (key, type, value) => {
    try { execFileSync("plutil", ["-remove", key, plist], { stdio: "ignore" }); } catch (e) { /* not there yet */ }
    execFileSync("plutil", ["-insert", key, `-${type}`, value, plist]);
  };
  set("NSLocationWhenInUseUsageDescription", "string", isCentre
    ? "THC Centre shows your position on the map of workers."
    : "THC sends your exact location to the Resource Centre when you press SOS, report a problem or check in, so staff can find and help you.");
  set("ITSAppUsesNonExemptEncryption", "bool", "NO");
  set("UIUserInterfaceStyle", "string", "Light");   // the apps use the white day theme only
  console.log("iOS Info.plist updated");
} else {
  console.error("Usage: node scripts/native-setup.mjs android|ios"); process.exit(1);
}
