/* =========================
   BARANGAY360 ADMIN DASHBOARD
========================= */

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);

const REQ_STATUSES = ["Submitted", "Under Review", "Approved", "Ready for Pickup", "Released", "Rejected"];
const CON_STATUSES = ["New", "In Progress", "Resolved", "Dismissed"];
const ANN_CATEGORIES = ["BARANGAY NOTICE", "COMMUNITY", "HEALTH", "PEACE & ORDER", "EDUCATION", "LIVELIHOOD"];

let requests = [], concerns = [], announcements = [], ordinances = [], editors = [];
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
  const [r, c, a, o] = await Promise.all([
    sb.from("service_requests").select("*").order("created_at", { ascending: false }),
    sb.from("concerns").select("*").order("created_at", { ascending: false }),
    sb.from("announcements").select("*").order("event_date", { ascending: false }),
    sb.from("ordinances").select("*").order("date_approved", { ascending: false })
  ]);

  if (r.error || c.error || a.error) {
    toast("Could not load data. Check your connection or permissions.", true);
  }
  requests = r.data || [];
  concerns = c.data || [];
  announcements = a.data || [];
  ordinances = o.data || [];
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
    const label = { requests: "Service Requests", concerns: "Concerns", announcements: "Announcements", ordinances: "Ordinances & Resolutions", editors: "Editors" }[base];
    t.innerHTML = esc(label) + (counts[base] ? `<span class="count">${counts[base]}</span>` : "");
  });
}

/* ---------- TABS ---------- */
$("admTabs").addEventListener("click", e => {
  const b = e.target.closest(".adm-tab");
  if (!b) return;
  document.querySelectorAll(".adm-tab").forEach(t => t.classList.toggle("active", t === b));
  ["requests", "concerns", "announcements", "ordinances", "editors"].forEach(p => ($("panel-" + p).hidden = p !== b.dataset.tab));
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
