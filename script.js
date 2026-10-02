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
  modalContent.innerHTML = content;
  modalOverlay.classList.add("active");
}

function closeModal() {
  modalOverlay.classList.remove("active");
}

modalOverlay.addEventListener("click", function(e) {
  if (e.target === modalOverlay) {
    closeModal();
  }
});


// SERVICE INFORMATION

function openService(service) {

  let requirements = "";

  if (service === "Barangay Clearance") {
    requirements = `
      <ul>
        <li>Valid identification</li>
        <li>Proof of residency, when required</li>
        <li>Purpose of certification</li>
      </ul>
    `;
  }

  else if (service === "Certificate of Residency") {
    requirements = `
      <ul>
        <li>Valid identification</li>
        <li>Proof of residence</li>
      </ul>
    `;
  }

  else if (service === "Certificate of Indigency") {
    requirements = `
      <ul>
        <li>Valid identification</li>
        <li>Barangay verification</li>
        <li>Purpose of certification</li>
      </ul>
    `;
  }

  else {
    requirements = `
      <ul>
        <li>Valid identification</li>
        <li>Additional documents may apply</li>
      </ul>
    `;
  }

  openModal(`
    <span class="section-label">BARANGAY SERVICE</span>

    <h2>${service}</h2>

    <p>
      Please verify the current requirements, fees,
      and processing procedures with the Barangay Office.
    </p>

    <h3 style="margin-top:20px;">Typical Requirements</h3>

    <div style="margin:15px 0;">
      ${requirements}
    </div>

    <button class="primary-btn"
      onclick="openRequestModal('${service}')">
      Request This Service
    </button>
  `);
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

          <option ${service === "Barangay Clearance" ? "selected" : ""}>
            Barangay Clearance
          </option>

          <option ${service === "Certificate of Residency" ? "selected" : ""}>
            Certificate of Residency
          </option>

          <option ${service === "Certificate of Indigency" ? "selected" : ""}>
            Certificate of Indigency
          </option>

          <option>
            Barangay ID
          </option>

          <option>
            Business Certification
          </option>

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

function openEmergency() {

  openModal(`
    <span class="section-label">
      EMERGENCY CONTACTS
    </span>

    <h2>Emergency Assistance</h2>

    <p>
      For immediate emergencies, contact the
      appropriate emergency service.
    </p>

    <div style="margin-top:20px;">

      <div style="padding:15px;border-bottom:1px solid #eee;">
        🚓 <strong>Police</strong>
        <strong style="float:right;">911</strong>
      </div>

      <div style="padding:15px;border-bottom:1px solid #eee;">
        🚒 <strong>Fire</strong>
        <strong style="float:right;">911</strong>
      </div>

      <div style="padding:15px;border-bottom:1px solid #eee;">
        🏥 <strong>Medical Emergency</strong>
        <strong style="float:right;">911</strong>
      </div>

      <div style="padding:15px;">
        🏛️ <strong>Barangay Hall</strong>
        <strong style="float:right;">(000) 000-0000</strong>
      </div>

    </div>
  `);
}


// ADMIN LOGIN

function openAdminLogin() {
  window.location.href = "admin.html";
}


// ANNOUNCEMENTS (loaded from Supabase; the static cards in index.html are the fallback)

let allAnnouncements = [];

function annParts(a) {
  const d = new Date(a.event_date + "T00:00:00");
  return { day: String(d.getDate()).padStart(2, "0"), mon: MONTHS[d.getMonth()], d };
}

function annSub(a) {
  if (a.location) return "📍 " + esc(a.location);
  if (a.event_time) return "⏰ " + esc(a.event_time);
  return "";
}

async function loadAnnouncements() {

  if (!sb) return;

  const { data, error } = await sb
    .from("announcements")
    .select("*")
    .eq("is_published", true)
    .order("event_date", { ascending: false })
    .limit(100);

  if (error || !data || !data.length) return;

  allAnnouncements = data;

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = data.filter(a => a.event_date >= today).sort((x, y) => x.event_date.localeCompare(y.event_date));
  const shown = (upcoming.length ? upcoming : data).slice(0, 3);

  document.querySelector(".announcement-grid").innerHTML = shown.map((a, i) => {
    const p = annParts(a);
    return `
      <article class="announcement-card ${i === 0 ? "featured" : ""}">
        <div class="announcement-date"><strong>${p.day}</strong><span>${p.mon}</span></div>
        <div>
          <span class="category">${esc(a.category)}</span>
          <h3>${esc(a.title)}</h3>
          <p>${esc(a.body)}</p>
          <small>${annSub(a)}</small>
        </div>
      </article>`;
  }).join("");
}

function showAllAnnouncements() {

  const list = allAnnouncements.length ? allAnnouncements : [];

  const rows = list.length
    ? list.map(a => {
        const p = annParts(a);
        return `
          <div style="padding:15px;border-bottom:1px solid #eee;">
            <strong>${esc(a.title)}</strong>
            <p style="font-size:13px;">${p.d.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}${a.location ? " · " + esc(a.location) : ""}</p>
            <p style="font-size:13px;margin-top:4px;">${esc(a.body)}</p>
          </div>`;
      }).join("")
    : '<p style="padding:15px;">No announcements available.</p>';

  openModal(`
    <span class="section-label">BARANGAY INFORMATION</span>
    <h2>All Announcements</h2>
    <div style="margin-top:20px;max-height:60vh;overflow:auto;">${rows}</div>
  `);
}

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
