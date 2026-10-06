/* ============================================================
   TUCTA Migrant Workers Resource Centre — app settings
   Edit this file before you put the app online.
   ============================================================ */
window.TUCTA_CONFIG = {
  // Name shown in the app header
  ORG_NAME: "TUCTA Migrant Workers Resource Centre",
  SHORT_NAME: "THC",

  // Phone number that receives SOS text messages (SMS) when a worker has no internet.
  // Use full international format. REPLACE THIS with the Centre's real number.
  SMS_NUMBER: "+255 000 000 000",

  // Number a worker can call for help (can be the same as above).
  HOTLINE_NUMBER: "+255 000 000 000",

  // WhatsApp number in international format, digits only (e.g. 255712345678). Leave "" to hide.
  WHATSAPP_NUMBER: "",

  // Email shown on the help screen
  EMAIL: "info@example.org",

  // Online database (Supabase). Leave both empty to run in DEMO mode,
  // where everything is saved only in this browser.
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  // Dashboard flags a worker as "no contact" after this many hours without a check-in.
  NO_CONTACT_HOURS: 72
};
