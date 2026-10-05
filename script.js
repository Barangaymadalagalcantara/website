/* =========================
   BARANGAY360 JAVASCRIPT
========================= */

const modalOverlay = document.getElementById("modalOverlay");
const modalContent = document.getElementById("modalContent");



// SUPABASE (configured in config.js)

const sb = (window.supabase && typeof SUPABASE_URL !== "undefined" && !SUPABASE_URL.includes("YOUR-PROJECT"))
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

// MOBILE MENU

document.getElementById("menuToggle").addEventListener("click", () => {
  document.getElementById("mainNav").classList.toggle("active");
});


// SCROLL

function scrollToSection(id) {
  document.getElementById(id).scrollIntoView({
    behavior: "smooth"
  });
}


// MODAL

function openModal(content) {
  modalContent.parentElement.classList.remove("wide");
  modalContent.innerHTML = content;
  modalOverlay.classList.add("active");
}

function openWideModal(content) {
  openModal(content);
  modalContent.parentElement.classList.add("wide");
}

function closeModal() {
  modalOverlay.classList.remove("active");
}

modalOverlay.addEventListener("click", function(e) {
  if (e.target === modalOverlay) {
    closeModal();
  }
});


// SERVICES (managed in the admin portal; defaults are used until the
// `services` table exists or while it is empty)

const DEFAULT_SERVICES = [
  { name: "Barangay Clearance", description: "For employment, business, school, and other purposes.",
    requirements: "Valid identification\nProof of residency, when required\nPurpose of certification" },
  { name: "Certificate of Residency", description: "Proof that a resident lives within the barangay.",
    requirements: "Valid identification\nProof of residence" },
  { name: "Certificate of Indigency", description: "Certification for qualified residents.",
    requirements: "Valid identification\nBarangay verification\nPurpose of certification" },
  { name: "Business Certification", description: "Barangay requirements for local businesses.",
    requirements: "Valid identification\nBusiness details\nProof of business location" },
  { name: "Other Services", description: "Explore additional barangay services.",
    requirements: "Valid identification\nAdditional documents may apply" }
];

let servicesData = DEFAULT_SERVICES.slice();

function renderServiceMenu() {
  const menu = document.getElementById("serviceMenu");
  if (!menu) return;
  menu.innerHTML = servicesData.map((s, i) => `
    <li role="option" tabindex="0" data-i="${i}">
      <strong>${esc(s.name)}</strong>
      ${s.description ? `<small>${esc(s.description)}</small>` : ""}
    </li>`).join("") || '<li class="empty">No services available yet.</li>';
}

async function loadServices() {
  if (sb) {
    const { data, error } = await sb.from("services")
      .select("name,description,requirements,sort_order")
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (!error && data && data.length) servicesData = data;
  }
  renderServiceMenu();
}

// Generic top-navigation dropdown. onPick(li) runs when an item is chosen.
function initNavDropdown(wrapId, btnId, menuId, onPick) {
  const wrap = document.getElementById(wrapId);
  const btn  = document.getElementById(btnId);
  const menu = document.getElementById(menuId);
  if (!wrap || !btn || !menu) return () => {};

  const setOpen = open => {
    menu.hidden = !open;
    wrap.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  };
  const pick = li => {
    if (!li || li.dataset.i === undefined) return;
    setOpen(false);
    document.getElementById("mainNav").classList.remove("active");
    onPick(li.dataset.i);
  };

  btn.addEventListener("click", () => setOpen(menu.hidden));
  menu.addEventListener("click", e => pick(e.target.closest("li")));
  menu.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(e.target.closest("li")); }
  });
  document.addEventListener("click", e => { if (!wrap.contains(e.target)) setOpen(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") setOpen(false); });
  return setOpen;
}

const setServicesMenuOpen = initNavDropdown("navServices", "navServicesBtn", "serviceMenu",
  i => openService(servicesData[i].name));
renderServiceMenu();

// Used by the hero and Services-section buttons
function openServicesMenu() {
  window.scrollTo({ top: 0, behavior: "smooth" });
  document.getElementById("mainNav").classList.add("active");
  setServicesMenuOpen(true);
}

loadServices();


// SERVICE INFORMATION

function openService(name) {

  const svc = servicesData.find(s => s.name === name) ||
    { name, description: "", requirements: "Valid identification\nAdditional documents may apply" };

  const items = String(svc.requirements || "").split(/\r?\n/).map(t => t.trim()).filter(Boolean);
  const requirements = `<ul>${(items.length ? items : ["Please ask the Barangay Office for the requirements."])
    .map(t => `<li>${esc(t)}</li>`).join("")}</ul>`;

  openModal(`
    <span class="section-label">BARANGAY SERVICE</span>

    <h2>${esc(svc.name)}</h2>

    ${svc.description ? `<p>${esc(svc.description)}</p>` : ""}

    <p>
      Please verify the current requirements, fees,
      and processing procedures with the Barangay Office.
    </p>

    <h3 style="margin-top:20px;">Typical Requirements</h3>

    <div style="margin:15px 0;">
      ${requirements}
    </div>

    <button class="primary-btn" id="svcRequestBtn">
      Request This Service
    </button>
  `);

  document.getElementById("svcRequestBtn")
    .addEventListener("click", () => openRequestModal(svc.name));
}


// REQUEST FORM

function openRequestModal(service = "") {

  openModal(`
    <span class="section-label">ONLINE REQUEST</span>

    <h2>Request a Barangay Service</h2>

    <form id="requestForm">

      <div class="form-group">
        <label>Full Name</label>
        <input id="requestName"
          type="text"
          placeholder="Enter your full name"
          required>
      </div>

      <div class="form-group">
        <label>Contact Number</label>
        <input id="requestContact"
          type="text"
          placeholder="09XXXXXXXXX"
          required>
      </div>

      <div class="form-group">
        <label>Service</label>

        <select id="requestService" required>

          <option value="">
            Select a service
          </option>

          ${servicesData.map(sv => `
          <option value="${esc(sv.name)}" ${service === sv.name ? "selected" : ""}>
            ${esc(sv.name)}
          </option>`).join("")}

        </select>
      </div>

      <div class="form-group">
        <label>Purpose</label>

        <textarea
          id="requestPurpose"
          placeholder="State the purpose of your request"
          required></textarea>
      </div>

      <button class="primary-btn" type="submit">
        Submit Request
      </button>

    </form>
  `);

  document.getElementById("requestForm")
    .addEventListener("submit", submitRequest);
}


// SUBMIT REQUEST

async function submitRequest(e) {

  e.preventDefault();

  if (!sb) { alert("The service is not connected yet. Please contact the Barangay Office."); return; }

  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Submitting...";

  const { data: reference, error } = await sb.rpc("submit_service_request", {
    p_full_name: document.getElementById("requestName").value,
    p_contact:   document.getElementById("requestContact").value,
    p_service:   document.getElementById("requestService").value,
    p_purpose:   document.getElementById("requestPurpose").value
  });

  if (error) {
    btn.disabled = false;
    btn.textContent = "Submit Request";
    alert("Sorry, your request could not be submitted. Please check your details and try again.");
    return;
  }

  openModal(`
    <div style="text-align:center;">

      <div style="font-size:50px;margin-bottom:15px;">✓</div>

      <span class="section-label">REQUEST SUBMITTED</span>

      <h2>Your Request Has Been Received</h2>

      <p>Please save your reference number.</p>

      <div style="background:#e7f5ef;color:#0b6b4f;padding:20px;border-radius:12px;margin:20px 0;font-size:22px;font-weight:800;">
        ${esc(reference)}
      </div>

      <p style="font-size:13px;">Use this reference number to track your request.</p>

      <button class="primary-btn" onclick="closeModal()">Done</button>

    </div>
  `);
}


// TRACK REQUEST

const STATUS_INFO = {
  "Submitted":        ["🟢", "Your request has been received by the Barangay Office."],
  "Under Review":     ["🟡", "Your request is being reviewed by barangay staff."],
  "Approved":         ["🟢", "Your request has been approved."],
  "Ready for Pickup": ["📄", "Your document is ready. Please claim it at the Barangay Hall."],
  "Released":         ["✅", "Your document has been released."],
  "Rejected":         ["🔴", "Your request could not be approved. See the remarks below."]
};

async function lookupRequest(number, box) {

  if (!sb) { box.innerHTML = '<p style="margin-top:12px;color:#c62828;">Tracking is not available right now.</p>'; return; }

  box.innerHTML = '<p style="margin-top:12px;">Searching...</p>';

  const { data, error } = await sb.rpc("track_request", { p_reference: number });

  if (error) {
    box.innerHTML = '<p style="margin-top:12px;color:#c62828;">Something went wrong. Please try again.</p>';
    return;
  }

  if (!data || !data.length) {
    box.innerHTML = '<p style="margin-top:12px;color:#c62828;">No request found with that reference number.</p>';
    return;
  }

  const r = data[0];
  const [icon, msg] = STATUS_INFO[r.status] || ["🟢", ""];
  const updated = new Date(r.updated_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });

  box.innerHTML = `
    <div style="margin-top:20px;background:white;color:#14201c;padding:25px;border-radius:12px;text-align:left;">

      <strong>${esc(r.reference_no)}</strong>
      <div style="font-size:13px;color:#53605b;">${esc(r.service)}</div>

      <div style="margin-top:15px;padding:15px;background:#e7f5ef;border-radius:10px;">
        <strong style="color:#0b6b4f;">${icon} ${esc(r.status)}</strong>
        <p style="margin-top:5px;color:#53605b;">${esc(msg)}</p>
        ${r.admin_remarks ? `<p style="margin-top:8px;color:#14201c;"><b>Remarks:</b> ${esc(r.admin_remarks)}</p>` : ""}
      </div>

      <p style="margin-top:12px;font-size:12px;color:#777;">Last updated ${updated}</p>

    </div>
  `;
}

function trackRequest() {

  const number = document.getElementById("trackingNumber").value.trim();
  const result = document.getElementById("trackingResult");

  if (!number) {
    result.innerHTML = '<div style="margin-top:15px;background:#fff0f0;color:#c62828;padding:12px;border-radius:8px;">Please enter a reference number.</div>';
    return;
  }

  lookupRequest(number, result);
}


// TRACKING MODAL

function openTrackingModal() {

  openModal(`
    <span class="section-label">REQUEST TRACKING</span>

    <h2>Track Your Request</h2>

    <p>
      Enter your reference number below.
    </p>

    <input
      id="modalTrackingNumber"
      placeholder="BRGY-2026-00482">

    <button class="primary-btn"
      onclick="modalTrack()">
      Track Request
    </button>

    <div id="modalTrackingResult"></div>
  `);
}

function modalTrack() {

  const value = document.getElementById("modalTrackingNumber").value.trim();
  const result = document.getElementById("modalTrackingResult");

  if (!value) {
    result.innerHTML = '<p style="color:#c62828;margin-top:10px;">Enter a reference number.</p>';
    return;
  }

  lookupRequest(value, result);
}


// REPORT CONCERN

function openConcernModal() {

  openModal(`
    <span class="section-label">COMMUNITY FEEDBACK</span>

    <h2>Report a Concern</h2>

    <form id="concernForm">

      <div class="form-group">
        <label>Your Name</label>
        <input id="concernName" required placeholder="Full name">
      </div>

      <div class="form-group">
        <label>Concern Category</label>
        <select id="concernCategory" required>
          <option value="">Select category</option>
          <option>Road / Infrastructure</option>
          <option>Garbage / Environment</option>
          <option>Peace and Order</option>
          <option>Street Lighting</option>
          <option>Drainage / Flooding</option>
          <option>Other</option>
        </select>
      </div>

      <div class="form-group">
        <label>Description</label>
        <textarea id="concernDescription" required placeholder="Describe the concern..."></textarea>
      </div>

      <button class="primary-btn" type="submit">Submit Concern</button>

    </form>
  `);

  document.getElementById("concernForm").addEventListener("submit", async function(e) {

    e.preventDefault();

    if (!sb) { alert("The service is not connected yet."); return; }

    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Submitting...";

    const { error } = await sb.from("concerns").insert({
      full_name:   document.getElementById("concernName").value.trim(),
      category:    document.getElementById("concernCategory").value,
      description: document.getElementById("concernDescription").value.trim()
    });

    if (error) {
      btn.disabled = false;
      btn.textContent = "Submit Concern";
      alert("Sorry, your concern could not be submitted. Please try again.");
      return;
    }

    openModal(`
      <div style="text-align:center">
        <div style="font-size:50px;">✓</div>
        <h2>Concern Submitted</h2>
        <p>Thank you for helping improve our community.</p>
        <button class="primary-btn" onclick="closeModal()">Close</button>
      </div>
    `);
  });
}


// EMERGENCY

/* EMERGENCY CONTACTS (editable from the admin portal) */

let emergencyData = [
  { agency: "Police", phone: "911", icon: "\u{1F693}" },
  { agency: "Fire", phone: "911", icon: "\u{1F692}" },
  { agency: "Medical Emergency", phone: "911", icon: "\u{1F3E5}" },
  { agency: "Barangay Hall", phone: "(000) 000-0000", icon: "\u{1F3DB}\uFE0F" }
];

const telHref = n => "tel:" + String(n).replace(/[^0-9+*#,]/g, "");

function emergencyNumber(c) {
  return `<a href="${esc(telHref(c.phone))}">${esc(c.phone)}</a>`;
}

function renderEmergency() {
  const box = document.getElementById("emergencyList");
  if (!box) return;
  box.innerHTML = emergencyData.map(c => `
    <div>
      <strong>${esc((c.icon ? c.icon + " " : "") + c.agency)}</strong>
      <span>${emergencyNumber(c)}</span>
    </div>`).join("");
}

async function loadEmergency() {
  if (sb) {
    const { data, error } = await sb.from("emergency_contacts").select("*")
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (!error && data && data.length) emergencyData = data;
  }
  renderEmergency();
}

function openEmergency() {
  openModal(`
    <span class="section-label">EMERGENCY CONTACTS</span>
    <h2>Emergency Assistance</h2>
    <p>For immediate emergencies, contact the appropriate emergency service.</p>
    <div style="margin-top:20px;">
      ${emergencyData.map(c => `
        <div style="padding:15px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;gap:12px;">
          <span>${esc(c.icon || "")} <strong>${esc(c.agency)}</strong></span>
          <strong style="text-align:right;">${emergencyNumber(c)}</strong>
        </div>`).join("")}
    </div>
  `);
}

renderEmergency();
loadEmergency();


// ADMIN LOGIN

function openAdminLogin() {
  window.location.href = "admin.html";
}


// ANNOUNCEMENTS (top-navigation dropdown; managed in the admin portal)
// The built-in samples show only if the announcements table cannot be read.

let allAnnouncements = [
  { title: "Barangay Assembly Meeting", category: "BARANGAY NOTICE", event_date: "2026-10-05", location: "Barangay Covered Court", event_time: "",
    body: "All residents are invited to attend the upcoming Barangay Assembly Meeting." },
  { title: "Community Clean-Up Drive", category: "COMMUNITY", event_date: "2026-10-08", location: "", event_time: "7:00 AM",
    body: "Join our community clean-up activity in designated areas." },
  { title: "Free Medical Check-Up", category: "HEALTH", event_date: "2026-10-12", location: "Barangay Health Center", event_time: "",
    body: "Free basic health consultation for barangay residents." }
];
let annMenuList = [];

function annParts(a) {
  const d = new Date(a.event_date + "T00:00:00");
  return { day: String(d.getDate()).padStart(2, "0"), mon: MONTHS[d.getMonth()], d };
}

function renderAnnouncementsMenu() {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = allAnnouncements.filter(a => a.event_date >= today).sort((x, y) => x.event_date.localeCompare(y.event_date));
  const past = allAnnouncements.filter(a => a.event_date < today).sort((x, y) => y.event_date.localeCompare(x.event_date));
  annMenuList = [...upcoming, ...past].slice(0, 20);

  const menu = document.getElementById("announcementsMenu");
  if (!menu) return;
  menu.innerHTML = annMenuList.map((a, i) => {
    const p = annParts(a);
    return `
    <li role="option" tabindex="0" data-i="${i}">
      <strong>${esc(a.title)}</strong>
      <small>${esc(p.mon)} ${esc(p.day)}${a.category ? " \u00b7 " + esc(a.category) : ""}</small>
    </li>`;
  }).join("") || '<li class="empty">No announcements right now.</li>';
}

async function loadAnnouncements() {
  if (sb) {
    const { data, error } = await sb.from("announcements").select("*")
      .eq("is_published", true).order("event_date", { ascending: false }).limit(100);
    if (!error && data) allAnnouncements = data;
  }
  renderAnnouncementsMenu();
}

const setAnnouncementsMenuOpen = initNavDropdown("navAnnouncements", "navAnnouncementsBtn", "announcementsMenu", i => {
  const a = annMenuList[i];
  if (!a) return;
  const p = annParts(a);
  openModal(`
    <span class="section-label">${esc(a.category || "ANNOUNCEMENT")}</span>
    <h2>${esc(a.title)}</h2>
    <div class="ord-meta">
      <div><b>DATE</b>${esc(p.d.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" }))}</div>
      ${a.event_time ? `<div><b>TIME</b>${esc(a.event_time)}</div>` : ""}
      ${a.location ? `<div><b>PLACE</b>${esc(a.location)}</div>` : ""}
    </div>
    <p style="margin-top:14px">${esc(a.body).replace(/\n/g, "<br>")}</p>`);
});

// Used by the top-bar and footer links
function openAnnouncementsMenu() {
  window.scrollTo({ top: 0, behavior: "smooth" });
  document.getElementById("mainNav").classList.add("active");
  setAnnouncementsMenuOpen(true);
}

renderAnnouncementsMenu();
loadAnnouncements();


// ORDINANCES & RESOLUTIONS
// Sample records - replace with your barangay's actual documents.
// "file" can be a PDF link, e.g. "documents/ordinance-2026-001.pdf"

let ordinanceData = [
  { type: "Ordinance", number: "Ordinance No. 2026-001", title: "Barangay Clean and Green Ordinance", date: "2026-01-15", status: "Approved", summary: "Regulates proper waste segregation and community clean-up activities within the barangay.", file: "" },
  { type: "Ordinance", number: "Ordinance No. 2026-002", title: "Curfew for Minors Ordinance", date: "2026-03-10", status: "Approved", summary: "Sets curfew hours for minors and the corresponding parental responsibilities.", file: "" },
  { type: "Ordinance", number: "Ordinance No. 2025-005", title: "Barangay Fishing and Coastal Protection Ordinance", date: "2025-08-22", status: "Approved", summary: "Protects coastal resources and sets guidelines for local fishing activities.", file: "" },
  { type: "Resolution", number: "Resolution No. 2026-010", title: "Approving the 2026 Barangay Annual Investment Plan", date: "2026-02-05", status: "Approved", summary: "Approves the annual investment plan for barangay programs and projects.", file: "" },
  { type: "Resolution", number: "Resolution No. 2026-014", title: "Authorizing the Punong Barangay to Enter into a Memorandum of Agreement", date: "2026-05-18", status: "Approved", summary: "Authorizes the Punong Barangay to sign a partnership agreement with the municipal government.", file: "" },
  { type: "Resolution", number: "Resolution No. 2025-021", title: "Declaring Barangay Fiesta Week", date: "2025-11-12", status: "Approved", summary: "Declares the official dates and activities for the annual barangay fiesta.", file: "" }
];

let ordType = "All";

function formatOrdDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function renderOrdinances() {
  const q = document.getElementById("ordSearch").value.trim().toLowerCase();
  const year = document.getElementById("ordYear").value;

  const rows = ordinanceData
    .map((o, i) => ({ ...o, i }))
    .filter(o => (ordType === "All" || o.type === ordType)
      && (year === "All" || o.date.startsWith(year))
      && (o.title + " " + o.number).toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date));

  const list = document.getElementById("ordList");

  if (!rows.length) {
    list.innerHTML = '<div class="ord-empty">No ordinances or resolutions found.</div>';
    return;
  }

  list.innerHTML = rows.map(o => `
    <div class="ord-item">
      <span class="ord-badge ${o.type === "Resolution" ? "res" : ""}">${o.type.toUpperCase()}</span>
      <div class="ord-info">
        <strong>${o.number}</strong>
        <h3>${o.title}</h3>
        <small>Approved ${formatOrdDate(o.date)}</small>
      </div>
      <button class="ord-btn" onclick="openOrdinance(${o.i})">View</button>
    </div>
  `).join("");
}

function openOrdinance(i) {
  const o = ordinanceData[i];
  openModal(`
    <span class="section-label">${o.type.toUpperCase()}</span>
    <h2>${o.title}</h2>
    <div class="ord-meta">
      <div><b>NUMBER</b>${o.number}</div>
      <div><b>DATE APPROVED</b>${formatOrdDate(o.date)}</div>
      <div><b>STATUS</b>${o.status}</div>
      <div><b>TYPE</b>${o.type}</div>
    </div>
    <p>${o.summary}</p>
    ${o.file
      ? `<a class="primary-btn" style="display:inline-block;margin-top:16px;" href="${o.file}" target="_blank" rel="noopener">Download Copy (PDF)</a>`
      : `<p style="margin-top:16px;font-size:13px;color:#7a6a5d;">A copy may be requested at the Barangay Hall.</p>`}
  `);
}

function populateOrdYears() {
  const years = [...new Set(ordinanceData.map(o => o.date.slice(0, 4)))].sort().reverse();
  document.getElementById("ordYear").innerHTML =
    '<option value="All">All Years</option>' + years.map(y => `<option>${y}</option>`).join("");
}

(function initOrdinances() {
  populateOrdYears();

  document.getElementById("ordTabs").addEventListener("click", e => {
    const b = e.target.closest(".ord-tab");
    if (!b) return;
    document.querySelectorAll(".ord-tab").forEach(t => t.classList.remove("active"));
    b.classList.add("active");
    ordType = b.dataset.type;
    renderOrdinances();
  });
  document.getElementById("ordSearch").addEventListener("input", renderOrdinances);
  document.getElementById("ordYear").addEventListener("change", renderOrdinances);
  renderOrdinances();
  loadOrdinances();
})();

async function loadOrdinances() {

  if (!sb) return;

  const { data, error } = await sb
    .from("ordinances")
    .select("*")
    .eq("is_published", true)
    .order("date_approved", { ascending: false });

  if (error || !data) return;

  ordinanceData = data.map(o => ({
    type: o.type,
    number: o.number,
    title: o.title,
    date: o.date_approved,
    status: o.status,
    summary: o.summary || "",
    file: o.file_path ? sb.storage.from("documents").getPublicUrl(o.file_path).data.publicUrl : ""
  }));

  populateOrdYears();
  renderOrdinances();
}


/* =========================
   OFFICIALS + TIMELINE
========================= */

let officialsData = [];
let officialsLoaded = false;

const offPhotoUrl = p => (p && sb) ? sb.storage.from("officials").getPublicUrl(p).data.publicUrl : "";

function offInitials(name) {
  const parts = String(name || "").replace(/\b(hon|kgwd|pb)\.?\b/gi, "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function offOrdinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/* Picture frame: photo (or initials) inside an ornamental frame */
function photoFrame(o, size) {
  const url = offPhotoUrl(o.photo_path);
  const inner = url
    ? `<img src="${esc(url)}" alt="${esc(o.full_name)}" loading="lazy">`
    : `<span class="pf-initials">${esc(offInitials(o.full_name))}</span>`;
  return `<div class="photo-frame ${size || ""}"><div class="pf-inner">${inner}</div></div>`;
}

function termText(start, end) {
  return `${start} \u2013 ${end ? end : "Present"}`;
}

function officialCard(o, extraClass) {
  return `
    <button class="official-card ${extraClass || ""}" onclick="openOfficial('${esc(o.id)}')">
      ${photoFrame(o, extraClass === "chief" ? "lg" : "")}
      <span>${esc(String(o.position).toUpperCase())}</span>
      <h3>${esc(o.full_name)}</h3>
      <p>${esc(o.committee || "")}</p>
    </button>`;
}

function openOfficial(id) {
  const o = officialsData.find(x => x.id === id);
  if (!o) return;
  openModal(`
    <div class="off-modal">
      ${photoFrame(o, "xl")}
      <span class="section-label">${esc(String(o.position).toUpperCase())}</span>
      <h2>${esc(o.full_name)}</h2>
      ${o.committee ? `<p>${esc(o.committee)}</p>` : ""}
      <p class="off-modal-term">Term: ${esc(termText(o.term_start, o.term_end))}</p>
    </div>`);
}

function sortOfficials(list) {
  return [...list].sort((a, b) =>
    positionRank(a.position) - positionRank(b.position) ||
    (a.sort_order - b.sort_order) ||
    a.full_name.localeCompare(b.full_name));
}

/* ---------- CURRENT OFFICIALS ---------- */
function renderCurrentOfficials() {
  const box = document.getElementById("offCurrent");
  const current = sortOfficials(officialsData.filter(o => o.term_end == null));

  if (!current.length) {
    box.innerHTML = '<div class="off-empty">The list of current officials will be posted here soon.</div>';
    return;
  }

  const chiefs = current.filter(o => o.position === "Punong Barangay");
  const rest = current.filter(o => o.position !== "Punong Barangay");
  const start = Math.max(...current.map(o => o.term_start));

  box.innerHTML = `
    <p class="off-termline">Term ${esc(start)} \u2013 Present</p>
    ${chiefs.length ? `<div class="officials-chief-row">${chiefs.map(o => officialCard(o, "chief")).join("")}</div>` : ""}
    ${rest.length ? `<div class="officials-grid">${rest.map(o => officialCard(o)).join("")}</div>` : ""}`;
}

/* ---------- TIMELINE ---------- */
function buildTimelineItems() {
  // group officials by the year their term started
  const groups = new Map();
  officialsData.forEach(o => {
    if (!groups.has(o.term_start)) groups.set(o.term_start, []);
    groups.get(o.term_start).push(o);
  });
  // make sure every known election has a node, even with no records yet
  BARANGAY_ELECTIONS.forEach(e => { if (!groups.has(e.year)) groups.set(e.year, []); });

  const items = [];
  [...groups.keys()].forEach(start => {
    const members = groups.get(start);
    const election = BARANGAY_ELECTIONS.find(e => e.year === start);
    const idx = BARANGAY_ELECTIONS.findIndex(e => e.year === start);
    const serving = members.some(m => m.term_end == null) ||
      (!members.length && election && start === BARANGAY_ELECTIONS[BARANGAY_ELECTIONS.length - 1].year);
    const ends = members.map(m => m.term_end).filter(Boolean);
    const nextElection = idx >= 0 ? BARANGAY_ELECTIONS[idx + 1] : null;
    const end = serving ? null : (ends.length ? Math.max(...ends) : (nextElection ? nextElection.year : null));
    items.push({ kind: "term", year: start, end, serving, members: sortOfficials(members), election, number: idx >= 0 ? idx + 1 : null });
  });

  MADALAG_MILESTONES.forEach(m => items.push({ kind: "milestone", year: m.year, m }));
  items.push({ kind: "upcoming", year: NEXT_ELECTION.year });

  // newest first; milestones sit just after the term that started in the same year
  const order = { upcoming: 0, term: 1, milestone: 2 };
  return items.sort((a, b) => b.year - a.year || order[a.kind] - order[b.kind]);
}

function timelineTermHTML(t) {
  const chief = t.members.filter(m => m.position === "Punong Barangay");
  const others = t.members.filter(m => m.position !== "Punong Barangay");
  const sub = t.election
    ? `${t.number ? offOrdinal(t.number) + " barangay election \u00b7 " : ""}Elected ${esc(t.election.date)}`
    : "";

  let body;
  if (!t.members.length) {
    body = '<p class="tl-empty">Records for this term are still being gathered. If you or your family served, please tell the Barangay Hall so we can honor you here.</p>';
  } else {
    body = `
      ${chief.length ? `<div class="tl-chiefs">${chief.map(m => `
        <button class="tl-person chief" onclick="openOfficial('${esc(m.id)}')">
          ${photoFrame(m, "md")}
          <span>${esc(m.position)}</span><strong>${esc(m.full_name)}</strong>
        </button>`).join("")}</div>` : ""}
      ${others.length ? `<div class="tl-people">${others.map(m => `
        <button class="tl-person" onclick="openOfficial('${esc(m.id)}')">
          ${photoFrame(m, "sm")}
          <strong>${esc(m.full_name)}</strong>
          <span>${esc(m.position === "Barangay Kagawad" ? (m.committee || "Kagawad") : m.position)}</span>
        </button>`).join("")}</div>` : ""}`;
  }

  return `
    <div class="tl-item ${t.serving ? "current" : ""}">
      <div class="tl-year">${esc(t.year)}</div>
      <div class="tl-dot"></div>
      <div class="tl-card">
        <div class="tl-head">
          <h3>${esc(termText(t.year, t.end))}${t.serving ? ' <em class="tl-now">Serving now</em>' : ""}</h3>
          ${sub ? `<small>${sub}</small>` : ""}
          ${t.election && t.election.note ? `<small class="tl-note">${esc(t.election.note)}</small>` : ""}
        </div>
        ${body}
      </div>
    </div>`;
}

function renderTimeline() {
  const st = barangayStats();

  document.getElementById("offStats").innerHTML = `
    <div><strong>${st.yearsAsBarangay}</strong><span>years as a barangay<br>(since 1974)</span></div>
    <div><strong>${st.electionsHeld}</strong><span>barangay elections held<br>since 1982</span></div>
    <div><strong>${st.termsCompleted}</strong><span>terms completed<br>+ the ${offOrdinal(st.electionsHeld)} term now serving</span></div>
    <div><strong>${esc(st.next.date.replace(/, \d{4}$/, ""))}</strong><span>next election<br>${esc(st.next.year)}</span></div>`;

  document.getElementById("offHistory").innerHTML = `
    <p>Madalag was one of the eight barrios of Looc that formed the Municipality of Alcantara on
    <b>March 21, 1961</b> (Executive Order No. 427). When Presidential Decree No. 557 turned all barrios
    into barangays on <b>September 21, 1974</b>, Madalag became a barangay. Since the first nationwide
    barangay election in <b>1982</b>, ${st.electionsHeld} elections have been held.</p>`;

  const items = buildTimelineItems();
  document.getElementById("timelineList").innerHTML = items.map(it => {
    if (it.kind === "term") return timelineTermHTML(it);
    if (it.kind === "upcoming") return `
      <div class="tl-item upcoming">
        <div class="tl-year">${esc(it.year)}</div><div class="tl-dot"></div>
        <div class="tl-card"><div class="tl-head">
          <h3>Next barangay election</h3><small>${esc(NEXT_ELECTION.date)} \u00b7 ${esc(NEXT_ELECTION.note)}</small>
        </div></div>
      </div>`;
    return `
      <div class="tl-item milestone">
        <div class="tl-year">${esc(it.year)}</div><div class="tl-dot"></div>
        <div class="tl-card"><div class="tl-head">
          <h3>${esc(it.m.title)}</h3><small>${esc(it.m.date)}</small></div>
          <p>${esc(it.m.text)}</p>
          ${it.m.note ? `<p class="tl-note">${esc(it.m.note)}</p>` : ""}
        </div>
      </div>`;
  }).join("");
}

/* ---------- LOAD + TABS ---------- */
async function loadOfficials() {
  if (sb) {
    const { data, error } = await sb.from("officials").select("*")
      .eq("is_published", true).order("term_start", { ascending: false });
    if (!error && data) officialsData = data;
  }
  officialsLoaded = true;
  renderCurrentOfficials();
  renderTimeline();
}

document.getElementById("offTabs").addEventListener("click", e => {
  const b = e.target.closest(".off-tab");
  if (!b) return;
  document.querySelectorAll(".off-tab").forEach(t => t.classList.toggle("active", t === b));
  document.getElementById("offCurrent").hidden = b.dataset.view !== "current";
  document.getElementById("offTimeline").hidden = b.dataset.view !== "timeline";
});

loadOfficials();


/* =========================
   BARANGAY PROFILE (DEMOGRAPHICS)
========================= */

let profileData = PROFILE_SEED;

const fmtNum = n => {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString("en-PH", { maximumFractionDigits: 2 }) : "";
};
const hasVal = x => x.value !== null && x.value !== undefined && x.value !== "";

function profNote(rows, sourceOnly) {
  const r = rows.find(x => x.as_of || x.source) || {};
  const bits = [(!sourceOnly && r.as_of) ? "As of " + r.as_of : "", r.source || ""].filter(Boolean);
  return bits.length ? `<p class="prof-note">${esc(bits.join(" \u00b7 "))}</p>` : "";
}

function populationChartSVG(rows) {
  const W = 640, H = 270, padL = 16, padR = 16, top = 30, bottom = 38;
  const max = Math.max(...rows.map(r => Number(r.value))) * 1.12;
  const slot = (W - padL - padR) / rows.length;
  const bw = Math.min(54, slot * 0.62);
  const bars = rows.map((r, i) => {
    const h = (Number(r.value) / max) * (H - top - bottom);
    const x = padL + slot * i + (slot - bw) / 2;
    const y = H - bottom - h;
    const last = i === rows.length - 1;
    return `
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="4" style="fill:${last ? "var(--accent)" : "var(--primary)"}"/>
      <text x="${(x + bw / 2).toFixed(1)}" y="${(y - 8).toFixed(1)}" text-anchor="middle" style="font:700 12px 'DM Sans',sans-serif;fill:var(--dark)">${esc(fmtNum(r.value))}</text>
      <text x="${(x + bw / 2).toFixed(1)}" y="${H - 16}" text-anchor="middle" style="font:600 12px 'DM Sans',sans-serif;fill:var(--text)">${esc(r.label)}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Population of Barangay Madalag by census year" class="prof-chart">
    <line x1="${padL}" y1="${H - bottom}" x2="${W - padR}" y2="${H - bottom}" style="stroke:var(--border);stroke-width:1.5"/>${bars}</svg>`;
}

function barList(rows) {
  const total = rows.reduce((s, r) => s + Number(r.value || 0), 0);
  const max = Math.max(...rows.map(r => Number(r.value || 0)), 1);
  return `<div class="prof-bars">${rows.map(r => `
    <div class="prof-bar-row">
      <span class="pb-label">${esc(r.label)}</span>
      <span class="pb-track"><span class="pb-fill" style="width:${(Number(r.value) / max * 100).toFixed(1)}%"></span></span>
      <span class="pb-val">${esc(fmtNum(r.value))}${total ? ` <small>${(Number(r.value) / total * 100).toFixed(1)}%</small>` : ""}</span>
    </div>`).join("")}</div>`;
}

function renderProfile() {
  const box = document.getElementById("profileBody");
  if (!box) return;

  const by = cat => profileData.filter(x => x.category === cat && hasVal(x)).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const stats = by("stat"), census = by("census"), age = by("age"), sitio = by("sitio"), live = by("livelihood");

  if (!stats.length && !census.length && !age.length && !sitio.length && !live.length) {
    box.innerHTML = '<div class="off-empty">The barangay profile will be posted here soon.</div>';
    return;
  }

  let html = "";

  if (stats.length) {
    html += `<div class="prof-stats">${stats.map(s => `
      <div class="prof-stat">
        <strong>${esc(fmtNum(s.value))}</strong>
        <span>${esc(s.label)}${s.unit && !/residents|households|voters/i.test(s.unit) ? ` <em>(${esc(s.unit.replace(/km2/i, "km\u00b2"))})</em>` : ""}</span>
        ${s.as_of || s.source ? `<small>${esc([s.as_of ? "As of " + s.as_of : "", s.source || ""].filter(Boolean).join(" \u00b7 "))}</small>` : ""}
      </div>`).join("")}</div>`;
  }

  const blocks = [];

  if (census.length) {
    census.sort((a, b) => Number(a.label) - Number(b.label));
    let trend = "";
    if (census.length > 1) {
      const a = census[census.length - 2], b = census[census.length - 1];
      const pct = (Number(b.value) - Number(a.value)) / Number(a.value) * 100;
      trend = `<p class="prof-trend">${pct >= 0 ? "Up" : "Down"} <b>${Math.abs(pct).toFixed(1)}%</b> from ${esc(a.label)} (${esc(fmtNum(a.value))}) to ${esc(b.label)} (${esc(fmtNum(b.value))}).</p>`;
    }
    blocks.push(`
      <div class="prof-card wide">
        <h3>Population Growth</h3>
        <p class="prof-sub">Residents counted in each national census</p>
        ${populationChartSVG(census)}
        ${trend}
        ${profNote(census, true)}
      </div>`);
  }

  if (age.length) {
    blocks.push(`
      <div class="prof-card">
        <h3>Population by Age Group</h3>
        ${barList(age)}
        ${profNote(age)}
      </div>`);
  }

  if (sitio.length) {
    const tp = sitio.reduce((s, r) => s + Number(r.value || 0), 0);
    const th = sitio.reduce((s, r) => s + Number(r.value2 || 0), 0);
    const showHh = sitio.some(r => r.value2 != null);
    blocks.push(`
      <div class="prof-card">
        <h3>Puroks &amp; Sitios</h3>
        <table class="prof-table">
          <thead><tr><th>Name</th><th>Population</th>${showHh ? "<th>Households</th>" : ""}</tr></thead>
          <tbody>${sitio.map(r => `<tr><td>${esc(r.label)}</td><td>${esc(fmtNum(r.value))}</td>${showHh ? `<td>${r.value2 != null ? esc(fmtNum(r.value2)) : "\u2013"}</td>` : ""}</tr>`).join("")}</tbody>
          <tfoot><tr><td>Total</td><td>${esc(fmtNum(tp))}</td>${showHh ? `<td>${esc(fmtNum(th))}</td>` : ""}</tr></tfoot>
        </table>
        ${profNote(sitio)}
      </div>`);
  }

  if (live.length) {
    blocks.push(`
      <div class="prof-card">
        <h3>Main Sources of Livelihood</h3>
        ${barList(live)}
        ${profNote(live)}
      </div>`);
  }

  if (blocks.length) html += `<div class="prof-grid">${blocks.join("")}</div>`;

  html += `<p class="prof-foot">Figures are aggregate counts only, based on the Philippine Statistics Authority and barangay records. No personal information about individual residents is published.</p>`;
  box.innerHTML = html;
}

async function loadProfile() {
  renderProfile();   // PSA starter figures show immediately
  if (!sb) return;
  const { data, error } = await sb.from("profile_items").select("*").eq("is_published", true)
    .order("category").order("sort_order", { ascending: true });
  if (!error && data && data.length) { profileData = data; renderProfile(); }
}

loadProfile();
