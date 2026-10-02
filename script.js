/* =========================
   BARANGAY360 JAVASCRIPT
========================= */

const modalOverlay = document.getElementById("modalOverlay");
const modalContent = document.getElementById("modalContent");


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

function submitRequest(e) {

  e.preventDefault();

  const randomNumber =
    Math.floor(10000 + Math.random() * 90000);

  const reference =
    "BRGY-2026-" + randomNumber;

  openModal(`
    <div style="text-align:center;">

      <div style="
        font-size:50px;
        margin-bottom:15px;
      ">✓</div>

      <span class="section-label">
        REQUEST SUBMITTED
      </span>

      <h2>Your Request Has Been Received</h2>

      <p>
        Please save your reference number.
      </p>

      <div style="
        background:#e7f5ef;
        color:#0b6b4f;
        padding:20px;
        border-radius:12px;
        margin:20px 0;
        font-size:22px;
        font-weight:800;
      ">
        ${reference}
      </div>

      <p style="font-size:13px;">
        Use this reference number to track your request.
      </p>

      <button class="primary-btn"
        onclick="closeModal()">
        Done
      </button>

    </div>
  `);
}


// TRACK REQUEST

function trackRequest() {

  const input =
    document.getElementById("trackingNumber");

  const result =
    document.getElementById("trackingResult");

  const number =
    input.value.trim();

  if (!number) {

    result.innerHTML = `
      <div style="
        margin-top:15px;
        background:#fff0f0;
        color:#ffdddd;
        padding:12px;
        border-radius:8px;
      ">
        Please enter a reference number.
      </div>
    `;

    return;
  }

  result.innerHTML = `
    <div style="
      margin-top:20px;
      background:white;
      color:#14201c;
      padding:25px;
      border-radius:12px;
      text-align:left;
    ">

      <strong>Request ${number}</strong>

      <div style="
        margin-top:15px;
        padding:15px;
        background:#e7f5ef;
        border-radius:10px;
      ">

        <strong style="color:#0b6b4f;">
          🟢 Submitted
        </strong>

        <p style="margin-top:5px;color:#53605b;">
          Your request has been received by the
          Barangay Office.
        </p>

      </div>

      <p style="
        margin-top:12px;
        font-size:12px;
        color:#777;
      ">
        Demo status. This will be connected to
        Supabase in the next version.
      </p>

    </div>
  `;
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

  const value =
    document.getElementById("modalTrackingNumber").value;

  const result =
    document.getElementById("modalTrackingResult");

  if (!value) {
    result.innerHTML = `
      <p style="color:#c62828;margin-top:10px;">
        Enter a reference number.
      </p>
    `;
    return;
  }

  result.innerHTML = `
    <div style="
      margin-top:20px;
      padding:15px;
      background:#e7f5ef;
      border-radius:10px;
      color:#0b6b4f;
    ">
      <strong>🟢 Request Submitted</strong>
      <p style="font-size:13px;">
        Reference: ${value}
      </p>
    </div>
  `;
}


// REPORT CONCERN

function openConcernModal() {

  openModal(`
    <span class="section-label">
      COMMUNITY FEEDBACK
    </span>

    <h2>Report a Concern</h2>

    <form id="concernForm">

      <div class="form-group">
        <label>Your Name</label>
        <input required placeholder="Full name">
      </div>

      <div class="form-group">
        <label>Concern Category</label>

        <select required>
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

        <textarea
          required
          placeholder="Describe the concern..."></textarea>
      </div>

      <button class="primary-btn">
        Submit Concern
      </button>

    </form>
  `);

  document.getElementById("concernForm")
    .addEventListener("submit", function(e) {

      e.preventDefault();

      openModal(`
        <div style="text-align:center">

          <div style="font-size:50px;">✓</div>

          <h2>Concern Submitted</h2>

          <p>
            Thank you for helping improve our community.
          </p>

          <button
            class="primary-btn"
            onclick="closeModal()">
            Close
          </button>

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

  openModal(`
    <span class="section-label">
      AUTHORIZED PERSONNEL
    </span>

    <h2>Barangay Admin Portal</h2>

    <p>
      Authorized barangay personnel only.
    </p>

    <form id="adminForm">

      <div class="form-group">
        <label>Email</label>

        <input
          type="email"
          placeholder="admin@example.com"
          required>
      </div>

      <div class="form-group">
        <label>Password</label>

        <input
          type="password"
          placeholder="Password"
          required>
      </div>

      <button class="primary-btn">
        Sign In
      </button>

    </form>
  `);

  document.getElementById("adminForm")
    .addEventListener("submit", function(e) {

      e.preventDefault();

      openModal(`
        <div style="text-align:center">

          <div style="font-size:50px;">🔐</div>

          <h2>Admin Portal</h2>

          <p>
            Authentication will be connected to
            Supabase in the next development phase.
          </p>

          <button class="primary-btn"
            onclick="closeModal()">
            Close
          </button>

        </div>
      `);

    });
}


// ANNOUNCEMENTS

function showAllAnnouncements() {

  openModal(`
    <span class="section-label">
      BARANGAY INFORMATION
    </span>

    <h2>All Announcements</h2>

    <div style="margin-top:20px;">

      <div style="padding:15px;border-bottom:1px solid #eee;">
        <strong>Barangay Assembly Meeting</strong>
        <p style="font-size:13px;">
          October 5 · Covered Court
        </p>
      </div>

      <div style="padding:15px;border-bottom:1px solid #eee;">
        <strong>Community Clean-Up Drive</strong>
        <p style="font-size:13px;">
          October 8 · Purok 3
        </p>
      </div>

      <div style="padding:15px;">
        <strong>Free Medical Mission</strong>
        <p style="font-size:13px;">
          October 12 · Barangay Health Center
        </p>
      </div>

    </div>
  `);
}

// ORDINANCES & RESOLUTIONS
// Sample records - replace with your barangay's actual documents.
// "file" can be a PDF link, e.g. "documents/ordinance-2026-001.pdf"

const ordinanceData = [
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

(function initOrdinances() {
  const years = [...new Set(ordinanceData.map(o => o.date.slice(0, 4)))].sort().reverse();
  document.getElementById("ordYear").innerHTML =
    '<option value="All">All Years</option>' + years.map(y => `<option>${y}</option>`).join("");

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
})();
