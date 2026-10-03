/* =========================
   BARANGAY360 ADMIN DASHBOARD
========================= */

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);

const REQ_STATUSES = ["Submitted", "Under Review", "Approved", "Ready for Pickup", "Released", "Rejected"];
const CON_STATUSES = ["New", "In Progress", "Resolved", "Dismissed"];
const ANN_CATEGORIES = ["BARANGAY NOTICE", "COMMUNITY", "HEALTH", "PEACE & ORDER", "EDUCATION", "LIVELIHOOD"];

let requests = [], concerns = [], announcements = [], ordinances = [], officials = [], editors = [];
let myRole = "editor", myId = null;
const ORD_STATUSES = ["Approved", "Pending", "Repealed", "Amended"];

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const slug = s => String(s).toLowerCase().replace(/[^a-z]+/g, "-");
const badge = (s, cls) => `<span class="badge ${cls || slug(s)}">${esc(s)}</span>`;
const fmtDate = d => new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
const fmtDateTime = d => new Date(d).toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const options = (list, sel) => list.map(o => `<option ${o === sel ? "selected" : ""}>${esc(o)}</option>`).join("");

function toast(msg, isErr) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast show" + (isErr ? " err" : "");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.className = "toast"), 2800);
}

/* ---------- MODAL ---------- */
function openModal(html) { $("modalContent").innerHTML = html; $("modalOverlay").classList.add("active"); }
function closeModal() { $("modalOverlay").classList.remove("active"); }
$("modalOverlay").addEventListener("click", e => { if (e.target === $("modalOverlay")) closeModal(); });

/* ---------- AUTH ---------- */
function showLogin(msg) {
  $("dashView").hidden = true;
  $("loginView").hidden = false;
  $("loginError").textContent = msg || "";
}

async function enter(user) {
  // Only users listed in public.admins may see the dashboard
  const { data } = await sb.from("admins").select("user_id, role").eq("user_id", user.id).maybeSingle();
  if (!data) {
    await sb.auth.signOut();
    showLogin("This account is not authorized to use the admin portal.");
    return;
  }
  myRole = data.role || "admin";
  myId = user.id;
  $("adminEmail").textContent = user.email + " (" + myRole + ")";
  $("editorsTab").hidden = myRole !== "admin";
  $("loginView").hidden = true;
  $("dashView").hidden = false;
  loadAll();
}

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("loginBtn");
  btn.disabled = true; btn.textContent = "Signing in...";
  $("loginError").textContent = "";

  const { data, error } = await sb.auth.signInWithPassword({
    email: $("loginEmail").value.trim(),
    password: $("loginPassword").value
  });

  btn.disabled = false; btn.textContent = "Sign In";
  if (error) { $("loginError").textContent = "Incorrect email or password."; return; }
  $("loginPassword").value = "";
  enter(data.user);
});

async function logout() {
  await sb.auth.signOut();
  showLogin();
}

(async function init() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) enter(session.user); else showLogin();
})();

/* ---------- DATA ---------- */
async function loadAll() {
  const [r, c, a, o, offRes] = await Promise.all([
    sb.from("service_requests").select("*").order("created_at", { ascending: false }),
    sb.from("concerns").select("*").order("created_at", { ascending: false }),
    sb.from("announcements").select("*").order("event_date", { ascending: false }),
    sb.from("ordinances").select("*").order("date_approved", { ascending: false }),
    sb.from("officials").select("*").order("term_start", { ascending: false })
  ]);

  if (r.error || c.error || a.error) {
    toast("Could not load data. Check your connection or permissions.", true);
  }
  requests = r.data || [];
  concerns = c.data || [];
  announcements = a.data || [];
  ordinances = o.data || [];
  if (offRes.error) toast("Officials could not load. Have you run officials.sql in Supabase?", true);
  officials = offRes.data || [];
  if (myRole === "admin") {
    const e = await sb.rpc("list_editors");
    editors = e.data || [];
  }
  renderAll();
}

function renderAll() {
  renderStats();
  renderRequests();
  renderConcerns();
  renderAnnouncements();
  renderOrdinances();
  renderOfficials();
  renderEditors();
  updateTabCounts();
}

function renderStats() {
  const n = (arr, s) => arr.filter(x => x.status === s).length;
  const stats = [
    [n(requests, "Submitted"), "New requests"],
    [n(requests, "Under Review"), "Under review"],
    [n(requests, "Ready for Pickup"), "Ready for pickup"],
    [n(concerns, "New"), "New concerns"],
    [announcements.filter(a => a.is_published).length, "Live announcements"]
  ];
  $("stats").innerHTML = stats.map(([v, l]) => `<div class="stat"><strong>${v}</strong><span>${l}</span></div>`).join("");
}

function updateTabCounts() {
  const counts = {
    requests: requests.filter(r => r.status === "Submitted").length,
    concerns: concerns.filter(c => c.status === "New").length
  };
  document.querySelectorAll(".adm-tab").forEach(t => {
    const base = t.dataset.tab;
    const label = { requests: "Service Requests", concerns: "Concerns", announcements: "Announcements", ordinances: "Ordinances & Resolutions", officials: "Officials", editors: "Editors" }[base];
    t.innerHTML = esc(label) + (counts[base] ? `<span class="count">${counts[base]}</span>` : "");
  });
}

/* ---------- TABS ---------- */
$("admTabs").addEventListener("click", e => {
  const b = e.target.closest(".adm-tab");
  if (!b) return;
  document.querySelectorAll(".adm-tab").forEach(t => t.classList.toggle("active", t === b));
  ["requests", "concerns", "announcements", "ordinances", "officials", "editors"].forEach(p => ($("panel-" + p).hidden = p !== b.dataset.tab));
});

/* ---------- SERVICE REQUESTS ---------- */
$("reqFilter").innerHTML = '<option value="All">All statuses</option>' + options(REQ_STATUSES);
$("reqFilter").addEventListener("change", renderRequests);
$("reqSearch").addEventListener("input", renderRequests);

function renderRequests() {
  const q = $("reqSearch").value.trim().toLowerCase();
  const f = $("reqFilter").value;
  const rows = requests.filter(r =>
    (f === "All" || r.status === f) &&
    (r.full_name + " " + r.reference_no).toLowerCase().includes(q));

  $("reqBody").innerHTML = rows.length ? rows.map(r => `
    <tr>
      <td><strong>${esc(r.reference_no)}</strong></td>
      <td>${esc(r.full_name)}<br><small>${esc(r.contact)}</small></td>
      <td>${esc(r.service)}</td>
      <td>${badge(r.status)}</td>
      <td>${fmtDate(r.created_at)}</td>
      <td><button class="row-btn" onclick="openRequest('${r.id}')">Manage</button></td>
    </tr>`).join("") : '<tr class="empty"><td colspan="6">No requests found.</td></tr>';
}

function openRequest(id) {
  const r = requests.find(x => x.id === id);
  if (!r) return;
  openModal(`
    <span class="section-label">SERVICE REQUEST</span>
    <h2>${esc(r.reference_no)}</h2>

    <div class="detail-grid">
      <div><b>Name</b>${esc(r.full_name)}</div>
      <div><b>Contact</b>${esc(r.contact)}</div>
      <div><b>Service</b>${esc(r.service)}</div>
      <div><b>Submitted</b>${fmtDateTime(r.created_at)}</div>
      <div class="full"><b>Purpose</b>${esc(r.purpose)}</div>
    </div>

    <div class="form-group">
      <label>Status</label>
      <select id="rqStatus">${options(REQ_STATUSES, r.status)}</select>
    </div>
    <div class="form-group">
      <label>Remarks (visible to the resident when they track)</label>
      <textarea id="rqRemarks" placeholder="e.g. Please bring a valid ID when claiming.">${esc(r.admin_remarks || "")}</textarea>
    </div>

    <div class="modal-actions">
      <button class="primary-btn" onclick="saveRequest('${r.id}')">Save Changes</button>
      <button class="danger-btn" onclick="deleteRow('service_requests','${r.id}')">Delete</button>
    </div>
  `);
}

async function saveRequest(id) {
  const { error } = await sb.from("service_requests").update({
    status: $("rqStatus").value,
    admin_remarks: $("rqRemarks").value.trim() || null
  }).eq("id", id);
  if (error) return toast("Save failed.", true);
  closeModal(); toast("Request updated."); loadAll();
}

/* ---------- CONCERNS ---------- */
$("conFilter").innerHTML = '<option value="All">All statuses</option>' + options(CON_STATUSES);
$("conFilter").addEventListener("change", renderConcerns);
$("conSearch").addEventListener("input", renderConcerns);

function renderConcerns() {
  const q = $("conSearch").value.trim().toLowerCase();
  const f = $("conFilter").value;
  const rows = concerns.filter(c =>
    (f === "All" || c.status === f) &&
    (c.full_name + " " + c.description + " " + c.category).toLowerCase().includes(q));

  $("conBody").innerHTML = rows.length ? rows.map(c => `
    <tr>
      <td>${esc(c.full_name)}</td>
      <td>${esc(c.category)}</td>
      <td class="desc">${esc(c.description.length > 120 ? c.description.slice(0, 120) + "…" : c.description)}</td>
      <td>${badge(c.status)}</td>
      <td>${fmtDate(c.created_at)}</td>
      <td><button class="row-btn" onclick="openConcern('${c.id}')">View</button></td>
    </tr>`).join("") : '<tr class="empty"><td colspan="6">No concerns found.</td></tr>';
}

function openConcern(id) {
  const c = concerns.find(x => x.id === id);
  if (!c) return;
  openModal(`
    <span class="section-label">COMMUNITY CONCERN</span>
    <h2>${esc(c.category)}</h2>

    <div class="detail-grid">
      <div><b>Reported by</b>${esc(c.full_name)}</div>
      <div><b>Submitted</b>${fmtDateTime(c.created_at)}</div>
      <div class="full"><b>Description</b>${esc(c.description)}</div>
    </div>

    <div class="form-group">
      <label>Status</label>
      <select id="cnStatus">${options(CON_STATUSES, c.status)}</select>
    </div>
    <div class="form-group">
      <label>Internal notes (not public)</label>
      <textarea id="cnNotes">${esc(c.admin_notes || "")}</textarea>
    </div>

    <div class="modal-actions">
      <button class="primary-btn" onclick="saveConcern('${c.id}')">Save Changes</button>
      <button class="danger-btn" onclick="deleteRow('concerns','${c.id}')">Delete</button>
    </div>
  `);
}

async function saveConcern(id) {
  const { error } = await sb.from("concerns").update({
    status: $("cnStatus").value,
    admin_notes: $("cnNotes").value.trim() || null
  }).eq("id", id);
  if (error) return toast("Save failed.", true);
  closeModal(); toast("Concern updated."); loadAll();
}

/* ---------- ANNOUNCEMENTS ---------- */
function renderAnnouncements() {
  $("annBody").innerHTML = announcements.length ? announcements.map(a => `
    <tr>
      <td>${fmtDate(a.event_date + "T00:00:00")}${a.event_time ? "<br><small>" + esc(a.event_time) + "</small>" : ""}</td>
      <td><strong>${esc(a.title)}</strong>${a.location ? "<br><small>📍 " + esc(a.location) + "</small>" : ""}</td>
      <td>${esc(a.category)}</td>
      <td>${a.is_published ? badge("Live", "live") : badge("Hidden", "hidden-post")}</td>
      <td><button class="row-btn" onclick="openAnnouncementForm('${a.id}')">Edit</button></td>
    </tr>`).join("") : '<tr class="empty"><td colspan="5">No announcements yet.</td></tr>';
}

function openAnnouncementForm(id) {
  const a = id ? announcements.find(x => x.id === id) : null;
  const v = a || { title: "", body: "", category: ANN_CATEGORIES[0], location: "", event_date: new Date().toISOString().slice(0, 10), event_time: "", is_featured: false, is_published: true };
  const cats = ANN_CATEGORIES.includes(v.category) ? ANN_CATEGORIES : [v.category, ...ANN_CATEGORIES];

  openModal(`
    <span class="section-label">${a ? "EDIT" : "NEW"} ANNOUNCEMENT</span>
    <h2>${a ? "Edit Announcement" : "Post an Announcement"}</h2>

    <form id="annForm">
      <div class="form-group"><label>Title</label>
        <input id="anTitle" required maxlength="150" value="${esc(v.title)}"></div>
      <div class="form-group"><label>Details</label>
        <textarea id="anBody" required>${esc(v.body)}</textarea></div>
      <div class="row2">
        <div class="form-group"><label>Category</label>
          <select id="anCategory">${options(cats, v.category)}</select></div>
        <div class="form-group"><label>Location</label>
          <input id="anLocation" placeholder="e.g. Barangay Covered Court" value="${esc(v.location || "")}"></div>
      </div>
      <div class="row2">
        <div class="form-group"><label>Date</label>
          <input id="anDate" type="date" required value="${esc(v.event_date)}"></div>
        <div class="form-group"><label>Time</label>
          <input id="anTime" placeholder="e.g. 8:00 AM" value="${esc(v.event_time || "")}"></div>
      </div>
      <label class="check"><input id="anFeatured" type="checkbox" ${v.is_featured ? "checked" : ""}> Featured</label>
      <label class="check"><input id="anPublished" type="checkbox" ${v.is_published ? "checked" : ""}> Published (visible on the website)</label>

      <div class="modal-actions">
        <button class="primary-btn" type="submit">${a ? "Save Changes" : "Post Announcement"}</button>
        ${a ? `<button class="danger-btn" type="button" onclick="deleteRow('announcements','${a.id}')">Delete</button>` : ""}
      </div>
    </form>
  `);

  $("annForm").addEventListener("submit", async e => {
    e.preventDefault();
    const payload = {
      title: $("anTitle").value.trim(),
      body: $("anBody").value.trim(),
      category: $("anCategory").value,
      location: $("anLocation").value.trim() || null,
      event_date: $("anDate").value,
      event_time: $("anTime").value.trim() || null,
      is_featured: $("anFeatured").checked,
      is_published: $("anPublished").checked
    };
    const q = a ? sb.from("announcements").update(payload).eq("id", a.id)
                : sb.from("announcements").insert(payload);
    const { error } = await q;
    if (error) return toast("Save failed.", true);
    closeModal(); toast(a ? "Announcement updated." : "Announcement posted."); loadAll();
  });
}


/* ---------- ORDINANCES & RESOLUTIONS ---------- */
$("ordSearch").addEventListener("input", renderOrdinances);
$("ordFilter").addEventListener("change", renderOrdinances);

const fileUrl = p => sb.storage.from("documents").getPublicUrl(p).data.publicUrl;

function renderOrdinances() {
  const q = $("ordSearch").value.trim().toLowerCase();
  const f = $("ordFilter").value;
  const rows = ordinances.filter(o =>
    (f === "All" || o.type === f) && (o.title + " " + o.number).toLowerCase().includes(q));

  $("ordAdminList").innerHTML = rows.length ? rows.map(o => `
    <div class="ord-row">
      <span class="ord-type-badge ${o.type === "Resolution" ? "res" : ""}">${esc(o.type.toUpperCase())}</span>
      <div class="info">
        <strong>${esc(o.number)}</strong>
        <h4>${esc(o.title)}</h4>
        <small>${fmtDate(o.date_approved + "T00:00:00")} &middot; ${esc(o.status)} &middot; ${o.is_published ? "Live" : "Hidden"}</small>
      </div>
      <div class="acts">
        ${o.file_path ? `<a class="pdf-chip" href="${esc(fileUrl(o.file_path))}" target="_blank" rel="noopener">PDF</a>` : `<span class="pdf-chip none">No PDF</span>`}
        <button class="icon-btn" title="Edit" aria-label="Edit" onclick="openOrdinanceForm('${o.id}')">&#9998;</button>
        <button class="icon-btn del" title="Delete" aria-label="Delete" onclick="deleteOrdinance('${o.id}')">&#128465;</button>
      </div>
    </div>`).join("") : '<div class="ord-empty" style="text-align:center;padding:30px;background:#fff;border:1px dashed var(--border);border-radius:12px">No ordinances or resolutions yet. Click the + button to add one.</div>';
}

function openOrdinanceForm(id) {
  const o = id ? ordinances.find(x => x.id === id) : null;
  const v = o || { type: "Ordinance", number: "", title: "", date_approved: new Date().toISOString().slice(0, 10), status: "Approved", summary: "", file_path: null, is_published: true };

  openModal(`
    <span class="section-label">${o ? "EDIT" : "NEW"} DOCUMENT</span>
    <h2>${o ? "Edit Ordinance / Resolution" : "Add Ordinance / Resolution"}</h2>
    <form id="ordForm">
      <div class="row2">
        <div class="form-group"><label>Type</label>
          <select id="orType">${options(["Ordinance", "Resolution"], v.type)}</select></div>
        <div class="form-group"><label>Number</label>
          <input id="orNumber" required maxlength="80" placeholder="e.g. Ordinance No. 2026-003" value="${esc(v.number)}"></div>
      </div>
      <div class="form-group"><label>Title</label>
        <input id="orTitle" required maxlength="250" value="${esc(v.title)}"></div>
      <div class="form-group"><label>Summary</label>
        <textarea id="orSummary">${esc(v.summary || "")}</textarea></div>
      <div class="row2">
        <div class="form-group"><label>Date approved</label>
          <input id="orDate" type="date" required value="${esc(v.date_approved)}"></div>
        <div class="form-group"><label>Status</label>
          <select id="orStatus">${options(ORD_STATUSES.includes(v.status) ? ORD_STATUSES : [v.status, ...ORD_STATUSES], v.status)}</select></div>
      </div>
      <div class="form-group"><label>PDF file (max 10 MB)</label>
        ${v.file_path ? `<small>Current: <a href="${esc(fileUrl(v.file_path))}" target="_blank" rel="noopener">view PDF</a> &mdash; choose a file below to replace it.</small>` : ""}
        <input id="orFile" type="file" accept="application/pdf,.pdf"></div>
      <label class="check"><input id="orPublished" type="checkbox" ${v.is_published ? "checked" : ""}> Published (visible on the website)</label>
      <div class="modal-actions">
        <button class="primary-btn" type="submit" id="orSave">${o ? "Save Changes" : "Add Document"}</button>
        ${o ? `<button class="danger-btn" type="button" onclick="deleteOrdinance('${o.id}')">Delete</button>` : ""}
      </div>
    </form>
  `);

  $("ordForm").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("orSave");
    const file = $("orFile").files[0];

    if (file) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return toast("Only PDF files are allowed.", true);
      if (file.size > 10 * 1024 * 1024) return toast("PDF is larger than 10 MB.", true);
    }

    btn.disabled = true; btn.textContent = "Saving...";
    let file_path = v.file_path;

    if (file) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const path = `ordinances/${Date.now()}-${safe}`;
      const up = await sb.storage.from("documents").upload(path, file, { contentType: "application/pdf" });
      if (up.error) { btn.disabled = false; btn.textContent = "Try again"; return toast("PDF upload failed.", true); }
      file_path = path;
    }

    const payload = {
      type: $("orType").value,
      number: $("orNumber").value.trim(),
      title: $("orTitle").value.trim(),
      summary: $("orSummary").value.trim() || null,
      date_approved: $("orDate").value,
      status: $("orStatus").value,
      is_published: $("orPublished").checked,
      file_path
    };
    const { error } = o ? await sb.from("ordinances").update(payload).eq("id", o.id)
                        : await sb.from("ordinances").insert(payload);

    if (error) {
      if (file) await sb.storage.from("documents").remove([file_path]); // don't leave orphan upload
      btn.disabled = false; btn.textContent = o ? "Save Changes" : "Add Document";
      return toast("Save failed.", true);
    }
    // replaced PDF -> remove the old one
    if (file && v.file_path) await sb.storage.from("documents").remove([v.file_path]);
    closeModal(); toast(o ? "Document updated." : "Document added."); loadAll();
  });
}

async function deleteOrdinance(id) {
  const o = ordinances.find(x => x.id === id);
  if (!o) return;
  if (!confirm(`Delete "${o.number}" and its PDF permanently? This cannot be undone.`)) return;
  const { error } = await sb.from("ordinances").delete().eq("id", id);
  if (error) return toast("Delete failed.", true);
  if (o.file_path) await sb.storage.from("documents").remove([o.file_path]);
  closeModal(); toast("Deleted."); loadAll();
}

/* ---------- OFFICIALS ---------- */
const OFF_PHOTO_W = 480, OFF_PHOTO_H = 600;   // 4:5 portrait, matches the website frame
const offPhotoUrl = p => sb.storage.from("officials").getPublicUrl(p).data.publicUrl;
const offInitials = n => {
  const parts = String(n || "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() : "?";
};
const termLabel = (s, e) => `${s} \u2013 ${e ? e : "Present"}`;

function frameHTML(photoUrl, name, size) {
  const inner = photoUrl ? `<img src="${esc(photoUrl)}" alt="${esc(name)}">` : `<span class="pf-initials">${esc(offInitials(name))}</span>`;
  return `<div class="photo-frame ${size || "sm"}"><div class="pf-inner">${inner}</div></div>`;
}

function refreshOfficialFilter() {
  const sel = $("offFilter");
  const prev = sel.value || "All";
  const terms = [...new Set(officials.map(o => o.term_start))].sort((a, b) => b - a);
  sel.innerHTML = '<option value="All">All terms</option><option value="current">Current officials</option><option value="past">Past officials</option>' +
    terms.map(t => `<option value="t${t}">Term starting ${t}</option>`).join("");
  sel.value = [...sel.options].some(o => o.value === prev) ? prev : "All";
}

$("offSearch").addEventListener("input", renderOfficials);
$("offFilter").addEventListener("change", renderOfficials);

function renderOfficials() {
  refreshOfficialFilter();
  const q = $("offSearch").value.trim().toLowerCase();
  const f = $("offFilter").value;

  const rows = officials.filter(o => {
    const okTerm = f === "All" || (f === "current" && o.term_end == null) || (f === "past" && o.term_end != null) ||
      (f.startsWith("t") && String(o.term_start) === f.slice(1));
    return okTerm && (o.full_name + " " + o.position + " " + (o.committee || "")).toLowerCase().includes(q);
  });

  if (!rows.length) {
    $("offAdminList").innerHTML = '<div style="text-align:center;padding:30px;background:#fff;border:1px dashed var(--border);border-radius:12px">No officials yet. Click the + button to add one.</div>';
    return;
  }

  // group by term (newest first) so past officials are clearly separated
  const groups = new Map();
  rows.forEach(o => { const k = o.term_start; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o); });

  $("offAdminList").innerHTML = [...groups.keys()].sort((a, b) => b - a).map(k => {
    const list = groups.get(k).sort((a, b) => positionRank(a.position) - positionRank(b.position) || a.sort_order - b.sort_order || a.full_name.localeCompare(b.full_name));
    const serving = list.some(o => o.term_end == null);
    const end = serving ? null : Math.max(...list.map(o => o.term_end || 0));
    return `
      <h4 class="off-group-title">${esc(termLabel(k, end))} ${serving ? '<span class="badge live">Current</span>' : '<span class="badge hidden-post">Past term</span>'}</h4>
      <div class="ord-admin-list">${list.map(o => `
        <div class="ord-row">
          ${frameHTML(o.photo_path ? offPhotoUrl(o.photo_path) : "", o.full_name, "sm")}
          <div class="info">
            <strong>${esc(o.position.toUpperCase())}</strong>
            <h4>${esc(o.full_name)}</h4>
            <small>${o.committee ? esc(o.committee) + " &middot; " : ""}${esc(termLabel(o.term_start, o.term_end))} &middot; ${o.is_published ? "Live" : "Hidden"}</small>
          </div>
          <div class="acts">
            <button class="icon-btn" title="Edit" aria-label="Edit" onclick="openOfficialForm('${o.id}')">&#9998;</button>
            <button class="icon-btn del" title="Delete" aria-label="Delete" onclick="deleteOfficial('${o.id}')">&#128465;</button>
          </div>
        </div>`).join("")}</div>`;
  }).join("");
}

/* Center-crop to 4:5 and shrink so photos stay light (~60-100 KB) */
function prepareOfficialPhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const target = OFF_PHOTO_W / OFF_PHOTO_H;
      let sw = img.width, sh = img.height;
      if (sw / sh > target) sw = sh * target; else sh = sw / target;
      const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
      const c = document.createElement("canvas");
      c.width = OFF_PHOTO_W; c.height = OFF_PHOTO_H;
      c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, OFF_PHOTO_W, OFF_PHOTO_H);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? resolve(b) : reject(new Error("encode")), "image/jpeg", 0.86);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("load")); };
    img.src = url;
  });
}

function openOfficialForm(id) {
  const o = id ? officials.find(x => x.id === id) : null;
  const thisYear = new Date().getFullYear();
  const st = barangayStats();
  const v = o || { full_name: "", position: OFFICIAL_POSITIONS[1], committee: "", term_start: st.currentTermStart, term_end: null, sort_order: 0, is_published: true, photo_path: null };
  const positions = OFFICIAL_POSITIONS.includes(v.position) ? OFFICIAL_POSITIONS : [v.position, ...OFFICIAL_POSITIONS];

  // quick-fill choices built from the election list: "2018 - 2023", ..., "2023 - Present"
  const termChoices = BARANGAY_ELECTIONS.map((e, i) => {
    const next = BARANGAY_ELECTIONS[i + 1];
    return { s: e.year, e: next ? next.year : null };
  }).reverse();

  openModal(`
    <span class="section-label">${o ? "EDIT" : "NEW"} OFFICIAL</span>
    <h2>${o ? "Edit Official" : "Add Official"}</h2>
    <form id="offForm">
      <div class="off-form-top">
        <div class="off-photo-col">
          <div id="offPreview">${frameHTML(v.photo_path ? offPhotoUrl(v.photo_path) : "", v.full_name || "?", "lg")}</div>
          <label class="outline-btn off-file-btn">Choose photo
            <input id="ofFile" type="file" accept="image/jpeg,image/png,image/webp" hidden></label>
          ${v.photo_path ? `<label class="check" style="margin-top:8px"><input id="ofRemovePhoto" type="checkbox"> Remove current photo</label>` : ""}
          <small class="hint" style="margin:6px 0 0">JPG, PNG or WebP, up to 8 MB. It is cropped to the frame automatically - use a clear, front-facing photo.</small>
        </div>
        <div class="off-fields">
          <div class="form-group"><label>Full name</label>
            <input id="ofName" required maxlength="120" placeholder="e.g. Juan D. Dela Cruz" value="${esc(v.full_name)}"></div>
          <div class="form-group"><label>Position</label>
            <select id="ofPosition">${options(positions, v.position)}</select></div>
          <div class="form-group"><label>Committee / role (optional)</label>
            <input id="ofCommittee" maxlength="120" placeholder="e.g. Committee on Health" value="${esc(v.committee || "")}"></div>
        </div>
      </div>

      <div class="form-group"><label>Term (quick fill)</label>
        <select id="ofTermPick">
          <option value="">Choose a term...</option>
          ${termChoices.map(t => `<option value="${t.s}|${t.e ?? ""}">${t.s} \u2013 ${t.e ?? "Present"}</option>`).join("")}
        </select></div>
      <div class="row2">
        <div class="form-group"><label>Term start (year elected / appointed)</label>
          <input id="ofStart" type="number" required min="1960" max="${thisYear + 1}" value="${esc(v.term_start)}"></div>
        <div class="form-group"><label>Term end (leave blank if still serving)</label>
          <input id="ofEnd" type="number" min="1960" max="${thisYear + 5}" value="${v.term_end ?? ""}"></div>
      </div>
      <div class="row2">
        <div class="form-group"><label>Display order (lower shows first)</label>
          <input id="ofOrder" type="number" value="${esc(v.sort_order)}"></div>
        <div></div>
      </div>
      <label class="check"><input id="ofPublished" type="checkbox" ${v.is_published ? "checked" : ""}> Published (visible on the website)</label>

      <div class="modal-actions">
        <button class="primary-btn" type="submit" id="ofSave">${o ? "Save Changes" : "Add Official"}</button>
        ${o ? `<button class="danger-btn" type="button" onclick="deleteOfficial('${o.id}')">Delete</button>` : ""}
      </div>
    </form>
  `);

  let newBlob = null;

  const refreshPreview = (url) => {
    $("offPreview").innerHTML = frameHTML(url, $("ofName").value || "?", "lg");
  };
  $("ofName").addEventListener("input", () => { if (!newBlob && !(v.photo_path && !($("ofRemovePhoto") && $("ofRemovePhoto").checked))) refreshPreview(""); });

  $("ofTermPick").addEventListener("change", e => {
    if (!e.target.value) return;
    const [s, en] = e.target.value.split("|");
    $("ofStart").value = s; $("ofEnd").value = en;
  });

  $("ofFile").addEventListener("change", async e => {
    const f = e.target.files[0];
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { e.target.value = ""; return toast("Please choose a JPG, PNG or WebP image.", true); }
    if (f.size > 8 * 1024 * 1024) { e.target.value = ""; return toast("Image is larger than 8 MB.", true); }
    try {
      newBlob = await prepareOfficialPhoto(f);
      refreshPreview(URL.createObjectURL(newBlob));
    } catch { newBlob = null; e.target.value = ""; toast("Could not read that image.", true); }
  });

  if ($("ofRemovePhoto")) $("ofRemovePhoto").addEventListener("change", e => {
    if (newBlob) return;
    refreshPreview(e.target.checked ? "" : offPhotoUrl(v.photo_path));
  });

  $("offForm").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("ofSave");
    const start = parseInt($("ofStart").value, 10);
    const endRaw = $("ofEnd").value.trim();
    const end = endRaw === "" ? null : parseInt(endRaw, 10);
    if (end !== null && end < start) return toast("Term end cannot be earlier than term start.", true);

    btn.disabled = true; btn.textContent = "Saving...";

    let photo_path = v.photo_path;
    const removeOld = ($("ofRemovePhoto") && $("ofRemovePhoto").checked) || newBlob;
    let uploaded = null;

    if (newBlob) {
      uploaded = `photos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const up = await sb.storage.from("officials").upload(uploaded, newBlob, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (up.error) { btn.disabled = false; btn.textContent = "Try again"; return toast("Photo upload failed.", true); }
      photo_path = uploaded;
    } else if ($("ofRemovePhoto") && $("ofRemovePhoto").checked) {
      photo_path = null;
    }

    const payload = {
      full_name: $("ofName").value.trim(),
      position: $("ofPosition").value,
      committee: $("ofCommittee").value.trim() || null,
      term_start: start,
      term_end: end,
      sort_order: parseInt($("ofOrder").value, 10) || 0,
      is_published: $("ofPublished").checked,
      photo_path
    };

    const { error } = o ? await sb.from("officials").update(payload).eq("id", o.id)
                        : await sb.from("officials").insert(payload);
    if (error) {
      if (uploaded) await sb.storage.from("officials").remove([uploaded]);
      btn.disabled = false; btn.textContent = o ? "Save Changes" : "Add Official";
      return toast("Save failed.", true);
    }
    if (removeOld && v.photo_path) await sb.storage.from("officials").remove([v.photo_path]);
    closeModal(); toast(o ? "Official updated." : "Official added."); loadAll();
  });
}

async function deleteOfficial(id) {
  const o = officials.find(x => x.id === id);
  if (!o) return;
  if (!confirm(`Delete "${o.full_name}" and the photo permanently? This cannot be undone.\n\nTip: if this person simply finished their term, set a Term end year instead so they stay in the timeline.`)) return;
  const { error } = await sb.from("officials").delete().eq("id", id);
  if (error) return toast("Delete failed.", true);
  if (o.photo_path) await sb.storage.from("officials").remove([o.photo_path]);
  closeModal(); toast("Deleted."); loadAll();
}

/* After an election: move everyone currently serving into the past-officials timeline */
function openCloseTerm() {
  const serving = officials.filter(o => o.term_end == null);
  if (!serving.length) return toast("No current officials to close.", true);
  const y = new Date().getFullYear();
  openModal(`
    <span class="section-label">END OF TERM</span>
    <h2>Close current term</h2>
    <p style="font-size:14px;margin-bottom:14px">${serving.length} official${serving.length > 1 ? "s" : ""} currently serving will be given an end year and move to the <b>Timeline of Past Officials</b>. Add the newly elected officials afterwards.</p>
    <div class="form-group"><label>Term end year</label>
      <input id="ctYear" type="number" min="1960" max="${y + 5}" value="${y}"></div>
    <div class="modal-actions">
      <button class="primary-btn" id="ctGo">Close term</button>
    </div>`);
  $("ctGo").addEventListener("click", async () => {
    const yr = parseInt($("ctYear").value, 10);
    if (!yr) return toast("Enter a valid year.", true);
    const bad = serving.find(o => yr < o.term_start);
    if (bad) return toast(`End year cannot be earlier than ${bad.full_name}'s start year (${bad.term_start}).`, true);
    const { error } = await sb.from("officials").update({ term_end: yr }).is("term_end", null);
    if (error) return toast("Could not close the term.", true);
    closeModal(); toast("Term closed. Past officials are now in the timeline."); loadAll();
  });
}

/* ---------- EDITORS (admins only) ---------- */
function renderEditors() {
  if (myRole !== "admin") return;
  $("edBody").innerHTML = editors.length ? editors.map(e => `
    <tr>
      <td>${esc(e.email)}${e.user_id === myId ? " <small>(you)</small>" : ""}</td>
      <td>${badge(e.role === "admin" ? "Admin" : "Editor", e.role === "admin" ? "approved" : "under-review")}</td>
      <td>${e.created_at ? fmtDate(e.created_at) : ""}</td>
      <td>${e.user_id === myId ? "" : `<button class="icon-btn del" title="Remove" aria-label="Remove" onclick="removeEditor('${e.user_id}')">&#128465;</button>`}</td>
    </tr>`).join("") : '<tr class="empty"><td colspan="4">No editors yet.</td></tr>';
}

async function addEditor() {
  const email = $("edEmail").value.trim().toLowerCase();
  if (!email) return toast("Enter an email address.", true);
  const { error } = await sb.rpc("add_editor", { p_email: email, p_role: $("edRole").value });
  if (error) return toast(/no account/i.test(error.message) ? "No account with that email. Create the user in Supabase first." : "Could not add editor.", true);
  $("edEmail").value = "";
  toast("Editor added."); loadAll();
}

async function removeEditor(userId) {
  if (!confirm("Remove this person's access to the admin portal?")) return;
  const { error } = await sb.rpc("remove_editor", { p_user_id: userId });
  if (error) return toast("Could not remove.", true);
  toast("Access removed."); loadAll();
}

/* ---------- DELETE ---------- */
async function deleteRow(table, id) {
  if (!confirm("Delete this record permanently? This cannot be undone.")) return;
  const { error } = await sb.from(table).delete().eq("id", id);
  if (error) return toast("Delete failed.", true);
  closeModal(); toast("Deleted."); loadAll();
}
