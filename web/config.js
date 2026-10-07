/* ============================================================
   TUCTA Migrant Workers Resource Centre — app settings
   Edit this file before you put the app online.
   ============================================================ */
window.TUCTA_CONFIG = {
  // Name shown in the app header
  ORG_NAME: "TUCTA Migrant Workers Resource Centre",
  SHORT_NAME: "TMWRC",

  // Phone number that receives SOS text messages (SMS) when a worker has no internet.
  // Use full international format. REPLACE THIS with the Centre's real number.
  SMS_NUMBER: "+255 000 000 000",

  // Number a worker can call for help (can be the same as above).
  HOTLINE_NUMBER: "+255 000 000 000",

  // WhatsApp number in international format, digits only (e.g. 255712345678). Leave "" to hide.
  WHATSAPP_NUMBER: "",

  // Email shown on the help screen
  EMAIL: "info@example.org",

  // Online database (Supabase project "thc"). This key is public by design: the database's
  // security rules decide what it may do. Leave both empty to run in DEMO mode,
  // where everything is saved only in this browser.
  SUPABASE_URL: "https://grcjuugxhsztoxzzwmha.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY2p1dWd4aHN6dG94enp3bWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNTU4NDAsImV4cCI6MjEwNjkzMTg0MH0.-CGE9ypIQg1_gSbqXPJX2haoenOk41JuVRXTQfVyTpc",

  // Demo sign-in code shown on the code screen, for trying the apps before real emails are set up.
  // Must match app_settings.demo_code in the database. Set to "" (and turn demo_enabled off) to stop it.
  DEMO_CODE: "123456",

  // Dashboard flags a worker as "no contact" after this many hours without a check-in.
  NO_CONTACT_HOURS: 72
};
