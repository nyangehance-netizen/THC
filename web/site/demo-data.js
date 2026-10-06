/* Example cases for DEMO mode only (no online database configured). Clearly marked as examples in the apps. */
window.thcDemo = function () {
    const API = window.TuctaAPI;
    const JUMA_CASE = "c0ffee00-0000-4000-8000-000000000002";
    const now = Date.now(), at = min => new Date(now - min * 60000).toISOString();
    const W = {
      amina: { id: "a1b2c3d4-0000-4000-8000-000000000001", p: { full_name: "Amina Rashidi", phone: "+968 9000 0001", phone_tz: "+255 700 000 001", passport_no: "TAE000001", country: "Oman", city: "Muscat", address: "Al Khuwair, villa behind the mosque on Way 3012", employer: "Private household", job: "domestic", emergency_name: "Mwanaisha Rashidi (sister)", emergency_phone: "+255 700 000 101", consent: true } },
      juma: { id: "a1b2c3d4-0000-4000-8000-000000000002", p: { full_name: "Juma Mwakalinga", phone: "+966 50 000 0002", passport_no: "TAE000002", country: "Saudi Arabia", city: "Riyadh", address: "Al Olaya, workers' housing block C", employer: "Example Transport Co.", job: "driver", emergency_name: "Rehema Mwakalinga", emergency_phone: "+255 700 000 102", consent: true } },
      neema: { id: "a1b2c3d4-0000-4000-8000-000000000003", p: { full_name: "Neema Kimaro", phone: "+971 50 000 0003", country: "United Arab Emirates", city: "Dubai", address: "Deira, staff accommodation near Al Rigga metro", employer: "Example Hotel Group", job: "hotel", consent: true } },
      halima: { id: "a1b2c3d4-0000-4000-8000-000000000004", p: { full_name: "Halima Said", phone: "+974 3000 0004", country: "Qatar", city: "Doha", address: "Al Sadd, apartment 4B", employer: "Private household", job: "domestic", emergency_name: "Said Omari (father)", emergency_phone: "+255 700 000 104", consent: true } },
      baraka: { id: "a1b2c3d4-0000-4000-8000-000000000005", p: { full_name: "Baraka Ngowi", phone: "+965 5000 0005", country: "Kuwait", city: "Kuwait City", address: "Mahboula labour camp, room 212", employer: "Example Construction", job: "construction", consent: true } }
    };
    const ev = (w, kind, min, lat, lng, extra) => Object.assign({ id: API.uuid(), created_at: at(min), received_at: at(min), worker_id: W[w].id, kind, category: null, message: null, lat, lng, accuracy: 12, loc_time: at(min), place: `${W[w].p.city}, ${W[w].p.country}`, worker: W[w].p, channel: "app", status: kind === "checkin" || kind === "register" ? "resolved" : "new", staff_note: null, example: true }, extra || {});
    const events = [
      ev("amina", "register", 60 * 24 * 40, 23.5880, 58.4059),
      ev("amina", "checkin", 60 * 50, 23.5882, 58.4061),
      ev("amina", "sos", 12, 23.5879, 58.4057, { accuracy: 9 }),
      ev("juma", "register", 60 * 24 * 90, 24.6910, 46.6850),
      ev("juma", "help", 190, 24.6908, 46.6853, { id: JUMA_CASE, category: "passport", message: "My employer has kept my passport since I arrived and refuses to return it. My contract ends next month.", status: "in_progress", staff_note: "Called the recruitment agency in Dar. Waiting for their reply." }),
      ev("neema", "register", 60 * 24 * 20, 25.2667, 55.3170),
      ev("neema", "help", 60 * 26, 25.2665, 55.3168, { category: "wages", message: "I have not been paid for 3 months. 14 of us from Tanzania are in the same situation." }),
      ev("halima", "register", 60 * 24 * 60, 25.2850, 51.5050),
      ev("halima", "checkin", 60 * 24 * 5, 25.2851, 51.5049),
      ev("baraka", "register", 60 * 24 * 120, 29.1500, 48.1200),
      ev("baraka", "help", 60 * 24 * 2, 29.1502, 48.1203, { category: "health", message: "Injured my hand at the site. Need help to see a doctor.", status: "resolved", staff_note: "Embassy labour attaché arranged clinic visit. Worker confirmed treatment." })
    ];
    const replies = [
      { id: API.uuid(), created_at: at(170), worker_id: W.juma.id, event_id: JUMA_CASE, sender: "staff", staff_name: "Resource Centre", body: "Tumepokea ripoti yako kuhusu pasipoti. Tunawasiliana na wakala wako sasa." },
      { id: API.uuid(), created_at: at(150), worker_id: W.juma.id, event_id: JUMA_CASE, sender: "worker", staff_name: null, body: "Asante. Mwajiri anasema atairudisha mwisho wa mkataba tu." },
      { id: API.uuid(), created_at: at(120), worker_id: W.juma.id, event_id: JUMA_CASE, sender: "staff", staff_name: "Resource Centre", body: "Ni kinyume cha sheria kushikilia pasipoti yako. Tumewasiliana na ubalozi. Tutakupigia kesho saa 4 asubuhi." }
    ];
    return { events, replies };
  };
