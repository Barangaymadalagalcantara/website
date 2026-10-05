/* =========================================================
   BARANGAY360 ADMIN - EXTRA SECTIONS
   Site Settings, Directory, Transparency, Gallery,
   Activity Log, CSV export, Printable certificates.
   Loaded after admin.js (uses its sb, $, esc, toast, openModal...).
   Needs upgrade.sql to have been run in Supabase.
========================================================= */

let siteSettings = {}, servicesList = [], trMenuList = [], directory = [], transparency = [], albums = [], galleryPhotos = [], activity = [];

const DIR_GROUPS = [
  "Lupong Tagapamayapa",
  "Barangay Health Workers (BHW)",
  "Barangay Tanod",
  "SK Council",
  "Barangay Nutrition Scholar / Day Care",
  "Committees & Other Staff"
];
const TRANSPARENCY_CATEGORIES = ["Annual Budget", "Annual Investment Plan", "Financial Report", "Barangay Development Plan", "Other"];

const todayISO = () => new Date().toISOString().slice(0, 10);

/* ---------- LOAD ---------- */
async function loadExtra() {
  const [s, d, t, al, ph] = await Promise.all([
    sb.from("site_settings").select("*"),
    sb.from("directory_members").select("*").order("sort_order", { ascending: true }).order("full_name", { ascending: true }),
    sb.from("transparency_docs").select("*").order("fiscal_year", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    sb.from("gallery_albums").select("*").order("event_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    sb.from("gallery_photos").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true })
  ]);

  if ([s, d, t, al, ph].some(x => x.error)) {
    toast("Some new sections could not load. Have you run upgrade.sql in Supabase?", true);
  }
  const sv = await sb.from("services").select("*")
    .order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (sv.error) toast("Services could not load. Have you run services.sql in Supabase?", true);
  servicesList = sv.data || [];

  const tm = await sb.from("transparency_menu").select("*")
    .order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (tm.error) toast("Transparency menu could not load. Have you run transparency_menu.sql in Supabase?", true);
  trMenuList = tm.data || [];

  siteSettings = Object.fromEntries((s.data || []).map(r => [r.key, r.value || ""]));
  directory = d.data || [];
  transparency = t.data || [];
  albums = al.data || [];
  galleryPhotos = ph.data || [];

  if (myRole === "admin") {
    const a = await sb.from("activity_log").select("*").order("created_at", { ascending: false }).limit(500);
    activity = a.data || [];
  }
}

function renderExtra() {
  renderSettings();
  renderServices();
  renderTransparencyMenuAdmin();
  renderDirectory();
  renderTransparency();
  renderGallery();
  renderActivity();
}

/* Write one line to the activity log for things the database cannot see
   (printing a certificate, exporting a file, uploading photos, saving settings). */
function logActivity(action, table, label, detail) {
  if (!myId) return;
  sb.from("activity_log").insert({
    user_id: myId, user_email: myEmail, action, table_name: table,
    record_label: label || null, detail: detail || null
  }).then(() => {}, () => {});
}

/* ---------- SHARED HELPERS ---------- */
function prepareImage(file, maxEdge, quality) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? resolve(b) : reject(new Error("encode")), "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("load")); };
    img.src = url;
  });
}

const emptyBox = msg => `<div style="text-align:center;padding:30px;background:#fff;border:1px dashed var(--border);border-radius:12px">${msg}</div>`;
const randId = () => Math.random().toString(36).slice(2, 8);

/* =========================================================
   CSV EXPORT  (requests + concerns + activity log)
========================================================= */
function csvCell(v) {
  let s = v == null ? "" : String(v);
  // Residents type this text. A cell starting with = + - @ could run as a
  // formula when the file is opened in Excel, so we neutralise it.
  // Plain phone numbers / numbers are left alone.
  if (/^[=+\-@\t\r]/.test(s) && !/^[+\-]?[0-9][0-9 ()\-]*$/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

function downloadCSV(filename, headers, rows) {
  const lines = [headers.map(csvCell).join(",")].concat(rows.map(r => r.map(csvCell).join(",")));
  // BOM so Excel reads Filipino characters (e.g. ñ) correctly
  const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function exportRequestsCSV() {
  if (!requests.length) return toast("No requests to export.", true);
  downloadCSV(`madalag-requests-${todayISO()}.csv`,
    ["Reference", "Name", "Contact", "Service", "Purpose", "Status", "Remarks", "Submitted", "Last updated"],
    requests.map(r => [r.reference_no, r.full_name, r.contact, r.service, r.purpose, r.status, r.admin_remarks, r.created_at, r.updated_at]));
  logActivity("export", "requests_csv", "Service requests", requests.length + " rows");
  toast("Requests exported. Keep the file private - it has residents' contact details.");
}

function exportConcernsCSV() {
  if (!concerns.length) return toast("No concerns to export.", true);
  downloadCSV(`madalag-concerns-${todayISO()}.csv`,
    ["Name", "Category", "Description", "Status", "Internal notes", "Submitted"],
    concerns.map(c => [c.full_name, c.category, c.description, c.status, c.admin_notes, c.created_at]));
  logActivity("export", "concerns_csv", "Concerns", concerns.length + " rows");
  toast("Concerns exported. Keep the file private.");
}

/* =========================================================
   2/1. SITE SETTINGS
========================================================= */
const SETTING_GROUPS = [
  {
    title: "Barangay Hall contact",
    help: "Shown in the website footer and the Emergency list. Leave a field empty to hide it.",
    fields: [
      { k: "address", label: "Address", ph: "Street / Purok, Barangay Madalag, Alcantara, Romblon" },
      { k: "phone", label: "Contact number", ph: "e.g. 0917 123 4567" },
      { k: "email", label: "Email", ph: "e.g. brgy.madalag@gmail.com" },
      { k: "hours", label: "Office hours", ph: "e.g. Mon-Fri, 8:00 AM - 5:00 PM" },
      { k: "facebook", label: "Facebook page link (optional)", ph: "https://facebook.com/..." }
    ]
  },
  {
    title: "Location map",
    help: "In Google Maps, right-click the Barangay Hall and click the two numbers at the top of the menu to copy them. The first is latitude, the second longitude. The map stays hidden until both are filled in.",
    fields: [
      { k: "map_lat", label: "Latitude", ph: "numbers only" },
      { k: "map_lng", label: "Longitude", ph: "numbers only" }
    ]
  },
  {
    title: "About Barangay Madalag",
    help: "Shown in the website's History & Location section. Separate paragraphs with a blank line.",
    fields: [
      { k: "history_intro", label: "Introduction", area: true, ph: "A short welcome to the story of Barangay Madalag." },
      { k: "founding_story", label: "Founding story / origin of the name", area: true, ph: "From the Barangay Secretary or the elders. The exact founding year has not been confirmed, so only add what has been verified." }
    ]
  },
  {
    title: "Certificates",
    help: "Used on printed barangay certificates.",
    fields: [
      { k: "cert_validity", label: "Validity wording", ph: "e.g. six (6) months" }
    ]
  }
];

function renderSettings() {
  const box = $("settingsAdmin");
  if (!box) return;
  box.innerHTML = `<form id="setForm">${SETTING_GROUPS.map(g => `
    <div class="prof-admin-group">
      <div class="prof-admin-head"><div><h3>${esc(g.title)}</h3><small>${esc(g.help)}</small></div></div>
      <div class="set-card">
        ${g.fields.map(f => `
          <div class="form-group"><label>${esc(f.label)}</label>
            ${f.area
              ? `<textarea id="set_${f.k}" placeholder="${esc(f.ph || "")}">${esc(siteSettings[f.k] || "")}</textarea>`
              : `<input id="set_${f.k}" placeholder="${esc(f.ph || "")}" value="${esc(siteSettings[f.k] || "")}">`}
          </div>`).join("")}
      </div>
    </div>`).join("")}
    <div class="modal-actions"><button class="primary-btn" type="submit" id="setSave">Save Settings</button></div>
  </form>`;
  $("setForm").addEventListener("submit", saveSettings);
}

async function saveSettings(e) {
  e.preventDefault();
  const val = k => $("set_" + k).value.trim();

  const email = val("email");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return toast("That email address does not look right.", true);

  const lat = val("map_lat"), lng = val("map_lng");
  if ((lat && !lng) || (!lat && lng)) return toast("Fill in both latitude and longitude, or leave both empty.", true);
  if (lat && (isNaN(lat) || Math.abs(+lat) > 90 || isNaN(lng) || Math.abs(+lng) > 180)) return toast("Latitude/longitude must be valid numbers.", true);

  let fb = val("facebook");
  if (fb && !/^https?:\/\//i.test(fb)) fb = "https://" + fb;

  const rows = SETTING_GROUPS.flatMap(g => g.fields).map(f => ({
    key: f.k,
    value: f.k === "facebook" ? fb : val(f.k),
    updated_at: new Date().toISOString()
  }));

  const btn = $("setSave");
  btn.disabled = true; btn.textContent = "Saving...";
  const { error } = await sb.from("site_settings").upsert(rows, { onConflict: "key" });
  btn.disabled = false; btn.textContent = "Save Settings";
  if (error) return toast("Save failed. Have you run upgrade.sql?", true);
  logActivity("update", "site_settings", "Site Settings", "contact, map and about text");
  toast("Settings saved. The website updates right away.");
  loadAll();
}

/* =========================================================
   4. DIRECTORY
========================================================= */
const dirPhotoUrl = p => sb.storage.from("directory").getPublicUrl(p).data.publicUrl;

$("dirSearch").addEventListener("input", renderDirectory);

function renderDirectory() {
  const q = $("dirSearch").value.trim().toLowerCase();
  const rows = directory.filter(m => (m.full_name + " " + m.group_name + " " + (m.role_title || "")).toLowerCase().includes(q));

  if (!rows.length) {
    $("dirAdminList").innerHTML = emptyBox("No one in the directory yet. Click the + button to add a member.");
    return;
  }

  const groups = new Map();
  rows.forEach(m => { if (!groups.has(m.group_name)) groups.set(m.group_name, []); groups.get(m.group_name).push(m); });
  const order = g => { const i = DIR_GROUPS.indexOf(g); return i === -1 ? 99 : i; };

  $("dirAdminList").innerHTML = [...groups.keys()].sort((a, b) => order(a) - order(b) || a.localeCompare(b)).map(g => `
    <h4 class="off-group-title">${esc(g)} <span class="badge hidden-post">${groups.get(g).length}</span></h4>
    <div class="ord-admin-list">${groups.get(g).map(m => `
      <div class="ord-row">
        ${frameHTML(m.photo_path ? dirPhotoUrl(m.photo_path) : "", m.full_name, "sm")}
        <div class="info">
          <strong>${m.is_published ? "LIVE" : "HIDDEN"}</strong>
          <h4>${esc(m.full_name)}</h4>
          <small>${esc(m.role_title || "")}</small>
        </div>
        <div class="acts">
          <button class="icon-btn" title="Edit" aria-label="Edit" onclick="openDirectoryForm('${m.id}')">&#9998;</button>
          <button class="icon-btn del" title="Delete" aria-label="Delete" onclick="deleteDirectory('${m.id}')">&#128465;</button>
        </div>
      </div>`).join("")}</div>`).join("");
}

function openDirectoryForm(id) {
  const m = id ? directory.find(x => x.id === id) : null;
  const v = m || { full_name: "", group_name: DIR_GROUPS[0], role_title: "", photo_path: null, sort_order: 0, is_published: true };
  const usedGroups = [...new Set([...DIR_GROUPS, ...directory.map(x => x.group_name)])];

  openModal(`
    <span class="section-label">${m ? "EDIT" : "NEW"} DIRECTORY MEMBER</span>
    <h2>${m ? "Edit Member" : "Add Member"}</h2>
    <form id="dirForm">
      <div class="off-form-top">
        <div class="off-photo-col">
          <div id="dirPreview">${frameHTML(v.photo_path ? dirPhotoUrl(v.photo_path) : "", v.full_name || "?", "lg")}</div>
          <label class="outline-btn off-file-btn">Choose photo
            <input id="dmFile" type="file" accept="image/jpeg,image/png,image/webp" hidden></label>
          ${v.photo_path ? `<label class="check" style="margin-top:8px"><input id="dmRemovePhoto" type="checkbox"> Remove current photo</label>` : ""}
          <small class="hint" style="margin:6px 0 0">JPG, PNG or WebP, up to 8 MB. Cropped to the frame automatically.</small>
        </div>
        <div class="off-fields">
          <div class="form-group"><label>Full name</label>
            <input id="dmName" required maxlength="120" value="${esc(v.full_name)}"></div>
          <div class="form-group"><label>Group</label>
            <input id="dmGroup" required maxlength="80" list="dmGroups" value="${esc(v.group_name)}">
            <datalist id="dmGroups">${usedGroups.map(g => `<option value="${esc(g)}">`).join("")}</datalist></div>
          <div class="form-group"><label>Role / title (optional)</label>
            <input id="dmRole" maxlength="120" placeholder="e.g. Chairperson, Head Tanod, BHW President" value="${esc(v.role_title || "")}"></div>
        </div>
      </div>
      <div class="row2">
        <div class="form-group"><label>Display order (lower shows first)</label>
          <input id="dmOrder" type="number" value="${esc(v.sort_order)}"></div>
        <div></div>
      </div>
      <p class="hint">For privacy, personal phone numbers and home addresses are not collected here.</p>
      <label class="check"><input id="dmPublished" type="checkbox" ${v.is_published ? "checked" : ""}> Published (visible on the website)</label>
      <div class="modal-actions">
        <button class="primary-btn" type="submit" id="dmSave">${m ? "Save Changes" : "Add Member"}</button>
        ${m ? `<button class="danger-btn" type="button" onclick="deleteDirectory('${m.id}')">Delete</button>` : ""}
      </div>
    </form>
  `);

  let newBlob = null;
  const preview = url => { $("dirPreview").innerHTML = frameHTML(url, $("dmName").value || "?", "lg"); };

  $("dmName").addEventListener("input", () => {
    const keepsOld = v.photo_path && !($("dmRemovePhoto") && $("dmRemovePhoto").checked);
    if (!newBlob && !keepsOld) preview("");
  });

  $("dmFile").addEventListener("change", async e => {
    const f = e.target.files[0];
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { e.target.value = ""; return toast("Please choose a JPG, PNG or WebP image.", true); }
    if (f.size > 8 * 1024 * 1024) { e.target.value = ""; return toast("Image is larger than 8 MB.", true); }
    try { newBlob = await prepareOfficialPhoto(f); preview(URL.createObjectURL(newBlob)); }
    catch { newBlob = null; e.target.value = ""; toast("Could not read that image.", true); }
  });

  if ($("dmRemovePhoto")) $("dmRemovePhoto").addEventListener("change", e => {
    if (newBlob) return;
    preview(e.target.checked ? "" : dirPhotoUrl(v.photo_path));
  });

  $("dirForm").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("dmSave");
    btn.disabled = true; btn.textContent = "Saving...";

    let photo_path = v.photo_path, uploaded = null;
    const removeOld = ($("dmRemovePhoto") && $("dmRemovePhoto").checked) || newBlob;

    if (newBlob) {
      uploaded = `photos/${Date.now()}-${randId()}.jpg`;
      const up = await sb.storage.from("directory").upload(uploaded, newBlob, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (up.error) { btn.disabled = false; btn.textContent = "Try again"; return toast("Photo upload failed.", true); }
      photo_path = uploaded;
    } else if ($("dmRemovePhoto") && $("dmRemovePhoto").checked) {
      photo_path = null;
    }

    const payload = {
      full_name: $("dmName").value.trim(),
      group_name: $("dmGroup").value.trim(),
      role_title: $("dmRole").value.trim() || null,
      sort_order: parseInt($("dmOrder").value, 10) || 0,
      is_published: $("dmPublished").checked,
      photo_path
    };
    const { error } = m ? await sb.from("directory_members").update(payload).eq("id", m.id)
                        : await sb.from("directory_members").insert(payload);
    if (error) {
      if (uploaded) await sb.storage.from("directory").remove([uploaded]);
      btn.disabled = false; btn.textContent = m ? "Save Changes" : "Add Member";
      return toast("Save failed.", true);
    }
    if (removeOld && v.photo_path) await sb.storage.from("directory").remove([v.photo_path]);
    closeModal(); toast(m ? "Member updated." : "Member added."); loadAll();
  });
}

async function deleteDirectory(id) {
  const m = directory.find(x => x.id === id);
  if (!m) return;
  if (!confirm(`Delete "${m.full_name}" from the directory? This cannot be undone.`)) return;
  const { error } = await sb.from("directory_members").delete().eq("id", id);
  if (error) return toast("Delete failed.", true);
  if (m.photo_path) await sb.storage.from("directory").remove([m.photo_path]);
  closeModal(); toast("Deleted."); loadAll();
}

/* =========================================================
   SERVICES  (dropdown on the public Services section)
========================================================= */
$("svcSearch").addEventListener("input", renderServices);

function renderServices() {
  const q = $("svcSearch").value.trim().toLowerCase();
  const rows = servicesList.filter(s => (s.name + " " + (s.description || "")).toLowerCase().includes(q));

  if (!rows.length) {
    $("svcAdminList").innerHTML = emptyBox(servicesList.length
      ? "No services match your search."
      : "No services yet. The website is showing its built-in defaults. Click the + button to add your own.");
    return;
  }

  $("svcAdminList").innerHTML = rows.map(s => `
    <div class="ord-row">
      <div class="info">
        <strong>${s.is_published ? "LIVE" : "HIDDEN"}</strong>
        <h4>${esc(s.name)}</h4>
        <small>${esc(s.description || "")}</small>
      </div>
      <div class="acts">
        <button class="icon-btn" title="Edit" aria-label="Edit" onclick="openServiceForm('${s.id}')">&#9998;</button>
        <button class="icon-btn del" title="Delete" aria-label="Delete" onclick="deleteService('${s.id}')">&#128465;</button>
      </div>
    </div>`).join("");
}

function openServiceForm(id) {
  const s = id ? servicesList.find(x => x.id === id) : null;
  const v = s || { name: "", description: "", requirements: "", sort_order: (servicesList.length + 1) * 10, is_published: true };

  openModal(`
    <span class="section-label">${s ? "EDIT" : "NEW"} SERVICE</span>
    <h2>${s ? "Edit Service" : "Add Service"}</h2>
    <form id="svcForm">
      <div class="form-group"><label>Service name</label>
        <input id="svName" required maxlength="100" placeholder="e.g. Certificate of Good Moral" value="${esc(v.name)}"></div>
      <div class="form-group"><label>Short description (optional)</label>
        <input id="svDesc" maxlength="200" value="${esc(v.description || "")}"></div>
      <div class="form-group"><label>Requirements (one per line)</label>
        <textarea id="svReq" rows="5" placeholder="Valid identification&#10;Proof of residency">${esc(v.requirements || "")}</textarea></div>
      <div class="row2">
        <div class="form-group"><label>Display order (lower shows first)</label>
          <input id="svOrder" type="number" value="${esc(v.sort_order)}"></div>
        <div></div>
      </div>
      <label class="check"><input id="svPublished" type="checkbox" ${v.is_published ? "checked" : ""}> Published (visible on the website)</label>
      <div class="modal-actions">
        <button class="primary-btn" type="submit" id="svSave">${s ? "Save Changes" : "Add Service"}</button>
        ${s ? `<button class="danger-btn" type="button" onclick="deleteService('${s.id}')">Delete</button>` : ""}
      </div>
    </form>
  `);

  $("svcForm").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("svSave");
    btn.disabled = true; btn.textContent = "Saving...";
    const payload = {
      name: $("svName").value.trim(),
      description: $("svDesc").value.trim() || null,
      requirements: $("svReq").value.trim() || null,
      sort_order: parseInt($("svOrder").value, 10) || 0,
      is_published: $("svPublished").checked
    };
    const { error } = s ? await sb.from("services").update(payload).eq("id", s.id)
                        : await sb.from("services").insert(payload);
    if (error) {
      btn.disabled = false; btn.textContent = s ? "Save Changes" : "Add Service";
      return toast(error.code === "23505" ? "A service with that name already exists." : "Save failed.", true);
    }
    logActivity(s ? "update" : "insert", "services", payload.name);
    closeModal(); toast(s ? "Service updated." : "Service added."); loadAll();
  });
}

async function deleteService(id) {
  const s = servicesList.find(x => x.id === id);
  if (!s) return;
  if (!confirm(`Delete "${s.name}" from the Services list? This cannot be undone.`)) return;
  const { error } = await sb.from("services").delete().eq("id", id);
  if (error) return toast("Delete failed.", true);
  logActivity("delete", "services", s.name);
  closeModal(); toast("Deleted."); loadAll();
}

/* =========================================================
   TRANSPARENCY MENU  (dropdown in the top navigation)
========================================================= */
const TR_KINDS = {
  ordinance: "Opens the Ordinances list",
  resolution: "Opens the Resolutions list",
  documents: "Its own separate section with PDF documents"
};

function renderTransparencyMenuAdmin() {
  const box = $("trMenuAdmin");
  if (!box) return;
  box.innerHTML = `
    <div class="toolbar" style="margin-top:6px">
      <h4 class="off-group-title" style="margin:0;flex:1">Transparency menu (top navigation)</h4>
      <button class="add-btn" title="Add menu item" aria-label="Add menu item" onclick="openTrMenuForm()">+</button>
    </div>
    <p class="hint">These are the choices in the <b>Transparency</b> dropdown. Items that open <b>PDF documents</b> each get their own separate section on the website, showing the files you upload below under the same category name. If this list is empty the website uses its four default items.</p>
    ${trMenuList.length ? `<div class="ord-admin-list">${trMenuList.map(m => `
      <div class="ord-row">
        <div class="info">
          <strong>${m.is_published ? "LIVE" : "HIDDEN"}</strong>
          <h4>${esc(m.name)}</h4>
          <small>${esc(TR_KINDS[m.kind] || "")}</small>
        </div>
        <div class="acts">
          <button class="icon-btn" title="Edit" aria-label="Edit" onclick="openTrMenuForm('${m.id}')">&#9998;</button>
          <button class="icon-btn del" title="Delete" aria-label="Delete" onclick="deleteTrMenu('${m.id}')">&#128465;</button>
        </div>
      </div>`).join("")}</div>`
      : emptyBox("No menu items yet. The website is showing its built-in defaults. Click + to add your own.")}`;
}

function openTrMenuForm(id) {
  const m = id ? trMenuList.find(x => x.id === id) : null;
  const v = m || { name: "", kind: "documents", sort_order: (trMenuList.length + 1) * 10, is_published: true };

  openModal(`
    <span class="section-label">${m ? "EDIT" : "NEW"} MENU ITEM</span>
    <h2>${m ? "Edit Menu Item" : "Add Menu Item"}</h2>
    <form id="tmForm">
      <div class="form-group"><label>Name shown in the menu</label>
        <input id="tmName" required maxlength="80" placeholder="e.g. Annual Reports" value="${esc(v.name)}"></div>
      <div class="form-group"><label>What it opens</label>
        <select id="tmKind">${Object.entries(TR_KINDS).map(([k, t]) =>
          `<option value="${k}" ${k === v.kind ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></div>
      <div class="row2">
        <div class="form-group"><label>Display order (lower shows first)</label>
          <input id="tmOrder" type="number" value="${esc(v.sort_order)}"></div>
        <div></div>
      </div>
      <p class="hint">For PDF documents, upload files in the section below and choose this exact name as their <b>Category</b>.</p>
      <label class="check"><input id="tmPublished" type="checkbox" ${v.is_published ? "checked" : ""}> Published (visible on the website)</label>
      <div class="modal-actions">
        <button class="primary-btn" type="submit" id="tmSave">${m ? "Save Changes" : "Add Item"}</button>
        ${m ? `<button class="danger-btn" type="button" onclick="deleteTrMenu('${m.id}')">Delete</button>` : ""}
      </div>
    </form>
  `);

  $("tmForm").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("tmSave");
    btn.disabled = true; btn.textContent = "Saving...";
    const payload = {
      name: $("tmName").value.trim(),
      kind: $("tmKind").value,
      sort_order: parseInt($("tmOrder").value, 10) || 0,
      is_published: $("tmPublished").checked
    };
    const { error } = m ? await sb.from("transparency_menu").update(payload).eq("id", m.id)
                        : await sb.from("transparency_menu").insert(payload);
    if (error) {
      btn.disabled = false; btn.textContent = m ? "Save Changes" : "Add Item";
      return toast(error.code === "23505" ? "A menu item with that name already exists." : "Save failed.", true);
    }
    logActivity(m ? "update" : "insert", "transparency_menu", payload.name);
    closeModal(); toast(m ? "Menu item updated." : "Menu item added."); loadAll();
  });
}

async function deleteTrMenu(id) {
  const m = trMenuList.find(x => x.id === id);
  if (!m) return;
  if (!confirm(`Remove "${m.name}" from the Transparency menu? Uploaded documents are not deleted.`)) return;
  const { error } = await sb.from("transparency_menu").delete().eq("id", id);
  if (error) return toast("Delete failed.", true);
  logActivity("delete", "transparency_menu", m.name);
  closeModal(); toast("Deleted."); loadAll();
}

/* =========================================================
   3. TRANSPARENCY
========================================================= */
const docUrl = p => sb.storage.from("documents").getPublicUrl(p).data.publicUrl;

$("trSearch").addEventListener("input", renderTransparency);

function renderTransparency() {
  const q = $("trSearch").value.trim().toLowerCase();
  const rows = transparency.filter(t => (t.title + " " + t.category + " " + (t.fiscal_year || "")).toLowerCase().includes(q));

  $("trAdminList").innerHTML = rows.length ? rows.map(t => `
    <div class="ord-row">
      <span class="ord-type-badge">${esc(t.category.toUpperCase())}</span>
      <div class="info">
        <strong>${t.fiscal_year ? "FY " + esc(t.fiscal_year) : "NO YEAR"}</strong>
        <h4>${esc(t.title)}</h4>
        <small>${t.is_published ? "Live" : "Hidden"} &middot; added ${fmtDate(t.created_at)}</small>
      </div>
      <div class="acts">
        ${t.file_path ? `<a class="pdf-chip" href="${esc(docUrl(t.file_path))}" target="_blank" rel="noopener">PDF</a>` : `<span class="pdf-chip none">No PDF</span>`}
        <button class="icon-btn" title="Edit" aria-label="Edit" onclick="openTransparencyForm('${t.id}')">&#9998;</button>
        <button class="icon-btn del" title="Delete" aria-label="Delete" onclick="deleteTransparency('${t.id}')">&#128465;</button>
      </div>
    </div>`).join("") : emptyBox("No transparency documents yet. Click the + button to upload one.");
}

function openTransparencyForm(id) {
  const t = id ? transparency.find(x => x.id === id) : null;
  const v = t || { category: TRANSPARENCY_CATEGORIES[0], title: "", fiscal_year: new Date().getFullYear(), file_path: null, is_published: true };
  const base = [...new Set([...trMenuList.filter(m => m.kind === "documents").map(m => m.name), ...TRANSPARENCY_CATEGORIES])];
  const cats = base.includes(v.category) ? base : [v.category, ...base];

  openModal(`
    <span class="section-label">${t ? "EDIT" : "NEW"} TRANSPARENCY DOCUMENT</span>
    <h2>${t ? "Edit Document" : "Upload Document"}</h2>
    <form id="trForm">
      <div class="row2">
        <div class="form-group"><label>Category</label>
          <select id="trCategory">${options(cats, v.category)}</select></div>
        <div class="form-group"><label>Fiscal year</label>
          <input id="trYear" type="number" min="2000" max="${new Date().getFullYear() + 2}" value="${v.fiscal_year ?? ""}"></div>
      </div>
      <div class="form-group"><label>Title</label>
        <input id="trTitle" required maxlength="200" placeholder="e.g. 2026 Barangay Annual Budget" value="${esc(v.title)}"></div>
      <div class="form-group"><label>PDF file (max 10 MB)</label>
        ${v.file_path ? `<small>Current: <a href="${esc(docUrl(v.file_path))}" target="_blank" rel="noopener">view PDF</a> &mdash; choose a file below to replace it.</small>` : ""}
        <input id="trFile" type="file" accept="application/pdf,.pdf"></div>
      <label class="check"><input id="trPublished" type="checkbox" ${v.is_published ? "checked" : ""}> Published (visible on the website)</label>
      <div class="modal-actions">
        <button class="primary-btn" type="submit" id="trSave">${t ? "Save Changes" : "Add Document"}</button>
        ${t ? `<button class="danger-btn" type="button" onclick="deleteTransparency('${t.id}')">Delete</button>` : ""}
      </div>
    </form>
  `);

  $("trForm").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("trSave");
    const file = $("trFile").files[0];

    if (file) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return toast("Only PDF files are allowed.", true);
      if (file.size > 10 * 1024 * 1024) return toast("PDF is larger than 10 MB.", true);
    }
    if (!file && !v.file_path && !confirm("No PDF is attached. Save anyway? Residents will see the title only.")) return;

    btn.disabled = true; btn.textContent = "Saving...";
    let file_path = v.file_path;

    if (file) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const path = `transparency/${Date.now()}-${safe}`;
      const up = await sb.storage.from("documents").upload(path, file, { contentType: "application/pdf" });
      if (up.error) { btn.disabled = false; btn.textContent = "Try again"; return toast("PDF upload failed.", true); }
      file_path = path;
    }

    const yr = parseInt($("trYear").value, 10);
    const payload = {
      category: $("trCategory").value,
      title: $("trTitle").value.trim(),
      fiscal_year: Number.isFinite(yr) ? yr : null,
      is_published: $("trPublished").checked,
      file_path
    };
    const { error } = t ? await sb.from("transparency_docs").update(payload).eq("id", t.id)
                        : await sb.from("transparency_docs").insert(payload);
    if (error) {
      if (file) await sb.storage.from("documents").remove([file_path]);
      btn.disabled = false; btn.textContent = t ? "Save Changes" : "Add Document";
      return toast("Save failed.", true);
    }
    if (file && v.file_path) await sb.storage.from("documents").remove([v.file_path]);
    closeModal(); toast(t ? "Document updated." : "Document added."); loadAll();
  });
}

async function deleteTransparency(id) {
  const t = transparency.find(x => x.id === id);
  if (!t) return;
  if (!confirm(`Delete "${t.title}" and its PDF permanently? This cannot be undone.`)) return;
  const { error } = await sb.from("transparency_docs").delete().eq("id", id);
  if (error) return toast("Delete failed.", true);
  if (t.file_path) await sb.storage.from("documents").remove([t.file_path]);
  closeModal(); toast("Deleted."); loadAll();
}

/* =========================================================
   5. GALLERY
========================================================= */
const galUrl = p => sb.storage.from("gallery").getPublicUrl(p).data.publicUrl;
const GAL_MAX_EDGE = 1600, GAL_QUALITY = 0.82, GAL_MAX_BATCH = 20;

function renderGallery() {
  if (!$("galAdminList")) return;
  $("galAdminList").innerHTML = albums.length ? albums.map(a => {
    const ph = galleryPhotos.filter(p => p.album_id === a.id);
    return `
    <div class="ord-row">
      ${ph.length ? `<img class="g-thumb" src="${esc(galUrl(ph[0].photo_path))}" alt="" loading="lazy">` : `<span class="g-thumb none">No photos</span>`}
      <div class="info">
        <strong>${a.is_published ? "LIVE" : "HIDDEN"} &middot; ${ph.length} photo${ph.length === 1 ? "" : "s"}</strong>
        <h4>${esc(a.title)}</h4>
        <small>${a.event_date ? fmtDate(a.event_date + "T00:00:00") : "No date"}</small>
      </div>
      <div class="acts">
        <button class="row-btn" onclick="openAlbumForm('${a.id}')">Manage</button>
        <button class="icon-btn del" title="Delete" aria-label="Delete" onclick="deleteAlbum('${a.id}')">&#128465;</button>
      </div>
    </div>`;
  }).join("") : emptyBox("No albums yet. Click the + button to create one, then add photos.");
}

function openAlbumForm(id) {
  const a = id ? albums.find(x => x.id === id) : null;
  const v = a || { title: "", description: "", event_date: todayISO(), is_published: true };
  const mine = a ? galleryPhotos.filter(p => p.album_id === a.id) : [];

  openModal(`
    <span class="section-label">${a ? "EDIT" : "NEW"} ALBUM</span>
    <h2>${a ? "Manage Album" : "Create Album"}</h2>
    <form id="albForm">
      <div class="form-group"><label>Album title</label>
        <input id="alTitle" required maxlength="150" placeholder="e.g. Barangay Fiesta 2026" value="${esc(v.title)}"></div>
      <div class="form-group"><label>Short description (optional)</label>
        <textarea id="alDesc" style="min-height:70px">${esc(v.description || "")}</textarea></div>
      <div class="row2">
        <div class="form-group"><label>Date of event</label>
          <input id="alDate" type="date" value="${esc(v.event_date || "")}"></div>
        <div></div>
      </div>
      <label class="check"><input id="alPublished" type="checkbox" ${v.is_published ? "checked" : ""}> Published (visible on the website)</label>
      <div class="modal-actions">
        <button class="primary-btn" type="submit" id="alSave">${a ? "Save Changes" : "Create Album"}</button>
        ${a ? `<button class="danger-btn" type="button" onclick="deleteAlbum('${a.id}')">Delete album</button>` : ""}
      </div>
    </form>

    ${a ? `
    <div class="g-manage">
      <h3>Photos (${mine.length})</h3>
      ${mine.length ? `<div class="g-grid">${mine.map(p => `
        <div class="g-item">
          <img src="${esc(galUrl(p.photo_path))}" alt="" loading="lazy">
          <button type="button" class="g-del" title="Delete photo" aria-label="Delete photo" onclick="deletePhoto('${p.id}')">&times;</button>
        </div>`).join("")}</div>` : '<p class="hint">No photos yet.</p>'}
      <label class="outline-btn off-file-btn" style="margin-top:12px">+ Add photos
        <input id="alFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden></label>
      <small class="hint" id="alProgress" style="display:block;margin-top:8px">Up to ${GAL_MAX_BATCH} photos at a time, 15 MB each. They are shrunk automatically to load quickly.</small>
    </div>` : '<p class="hint" style="margin-top:14px">Create the album first, then you can add photos to it.</p>'}
  `);

  $("albForm").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("alSave");
    btn.disabled = true; btn.textContent = "Saving...";
    const payload = {
      title: $("alTitle").value.trim(),
      description: $("alDesc").value.trim() || null,
      event_date: $("alDate").value || null,
      is_published: $("alPublished").checked
    };
    if (a) {
      const { error } = await sb.from("gallery_albums").update(payload).eq("id", a.id);
      if (error) { btn.disabled = false; btn.textContent = "Save Changes"; return toast("Save failed.", true); }
      closeModal(); toast("Album updated."); loadAll();
    } else {
      const { data, error } = await sb.from("gallery_albums").insert(payload).select("id").single();
      if (error) { btn.disabled = false; btn.textContent = "Create Album"; return toast("Save failed.", true); }
      toast("Album created. Now add photos.");
      await loadAll();
      openAlbumForm(data.id);
    }
  });

  if (a) $("alFiles").addEventListener("change", async e => {
    const files = [...e.target.files];
    e.target.value = "";
    if (!files.length) return;
    if (files.length > GAL_MAX_BATCH) return toast(`Please choose up to ${GAL_MAX_BATCH} photos at a time.`, true);

    const prog = $("alProgress");
    let done = 0, failed = 0;
    for (const f of files) {
      prog.textContent = `Uploading ${done + failed + 1} of ${files.length}...`;
      if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 15 * 1024 * 1024) { failed++; continue; }
      let uploaded = null;
      try {
        const blob = await prepareImage(f, GAL_MAX_EDGE, GAL_QUALITY);
        uploaded = `albums/${a.id}/${Date.now()}-${randId()}.jpg`;
        const up = await sb.storage.from("gallery").upload(uploaded, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
        if (up.error) throw up.error;
        const { error } = await sb.from("gallery_photos").insert({ album_id: a.id, photo_path: uploaded });
        if (error) { await sb.storage.from("gallery").remove([uploaded]); throw error; }
        done++;
      } catch { failed++; }
    }
    if (done) logActivity("insert", "gallery_photos", a.title, done + " photo" + (done === 1 ? "" : "s") + " added");
    toast(failed ? `${done} added, ${failed} failed (wrong type, over 15 MB, or upload error).` : `${done} photo${done === 1 ? "" : "s"} added.`, !!failed && !done);
    await loadAll();
    openAlbumForm(a.id);
  });
}

async function deletePhoto(id) {
  const p = galleryPhotos.find(x => x.id === id);
  if (!p) return;
  if (!confirm("Delete this photo permanently?")) return;
  const album = albums.find(x => x.id === p.album_id);
  const { error } = await sb.from("gallery_photos").delete().eq("id", id);
  if (error) return toast("Delete failed.", true);
  await sb.storage.from("gallery").remove([p.photo_path]);
  logActivity("delete", "gallery_photos", album ? album.title : "", "1 photo deleted");
  toast("Photo deleted.");
  await loadAll();
  openAlbumForm(p.album_id);
}

async function deleteAlbum(id) {
  const a = albums.find(x => x.id === id);
  if (!a) return;
  const mine = galleryPhotos.filter(p => p.album_id === id);
  if (!confirm(`Delete the album "${a.title}" and its ${mine.length} photo${mine.length === 1 ? "" : "s"} permanently? This cannot be undone.`)) return;
  const { error } = await sb.from("gallery_albums").delete().eq("id", id);
  if (error) return toast("Delete failed.", true);
  if (mine.length) await sb.storage.from("gallery").remove(mine.map(p => p.photo_path));
  closeModal(); toast("Album deleted."); loadAll();
}

/* =========================================================
   7. ACTIVITY LOG  (admins only)
========================================================= */
const ACTION_LABELS = { insert: "Added", update: "Edited", delete: "Deleted", print: "Printed", export: "Exported" };
const TABLE_LABELS = {
  service_requests: "Service request", concerns: "Concern", announcements: "Announcement",
  ordinances: "Ordinance / resolution", officials: "Official", emergency_contacts: "Emergency contact",
  profile_items: "Barangay profile", services: "Service", transparency_menu: "Transparency menu", directory_members: "Directory", transparency_docs: "Transparency document",
  gallery_albums: "Gallery album", gallery_photos: "Gallery photos", site_settings: "Site settings",
  admins: "Editor access", certificate: "Certificate", requests_csv: "Requests CSV", concerns_csv: "Concerns CSV",
  activity_csv: "Activity log CSV"
};
const actionLabel = a => ACTION_LABELS[a] || a;
const tableLabel = t => TABLE_LABELS[t] || t || "";

$("actSearch").addEventListener("input", renderActivity);

function filteredActivity() {
  const q = $("actSearch").value.trim().toLowerCase();
  return activity.filter(a => (a.user_email + " " + actionLabel(a.action) + " " + tableLabel(a.table_name) + " " + (a.record_label || "") + " " + (a.detail || "")).toLowerCase().includes(q));
}

function renderActivity() {
  if (myRole !== "admin" || !$("actBody")) return;
  const rows = filteredActivity();
  $("actBody").innerHTML = rows.length ? rows.slice(0, 300).map(a => `
    <tr>
      <td>${fmtDateTime(a.created_at)}</td>
      <td>${esc(a.user_email || "")}</td>
      <td>${badge(actionLabel(a.action), a.action === "delete" ? "rejected" : a.action === "insert" ? "approved" : "under-review")}</td>
      <td>${esc(tableLabel(a.table_name))}</td>
      <td>${esc(a.record_label || "")}${a.detail ? `<br><small>${esc(a.detail)}</small>` : ""}</td>
    </tr>`).join("") : '<tr class="empty"><td colspan="5">No activity recorded yet.</td></tr>';
}

function exportActivityCSV() {
  const rows = filteredActivity();
  if (!rows.length) return toast("Nothing to export.", true);
  downloadCSV(`madalag-activity-${todayISO()}.csv`,
    ["When", "Who", "Action", "Area", "Item", "Details"],
    rows.map(a => [a.created_at, a.user_email, actionLabel(a.action), tableLabel(a.table_name), a.record_label, a.detail]));
  logActivity("export", "activity_csv", "Activity log", rows.length + " rows");
}

/* =========================================================
   6. PRINTABLE CERTIFICATES
========================================================= */
const CERT_TYPES = {
  "Barangay Clearance": "BARANGAY CLEARANCE",
  "Certificate of Residency": "CERTIFICATE OF RESIDENCY",
  "Certificate of Indigency": "CERTIFICATE OF INDIGENCY"
};
const CERT_PRINTABLE_STATUSES = ["Approved", "Ready for Pickup", "Released"];
const CIVIL_STATUSES = ["", "Single", "Married", "Widowed", "Separated"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function ordinalDay(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function currentPunong() {
  const p = officials.find(o => o.position === "Punong Barangay" && o.term_end == null);
  return p ? p.full_name : "";
}

function certBodyHTML(type, f) {
  const person = [
    `<b>${esc(f.name.toUpperCase() || "________________")}</b>`,
    f.age ? `${esc(f.age)} years old` : "",
    f.civil ? esc(f.civil.toLowerCase()) : ""
  ].filter(Boolean).join(", ");
  const address = `${f.address ? esc(f.address) + ", " : ""}Barangay Madalag, Alcantara, Romblon`;
  const purpose = esc(f.purpose || "________________");
  const d = f.date ? new Date(f.date + "T00:00:00") : new Date();
  const issued = `${ordinalDay(d.getDate())} day of ${MONTH_NAMES[d.getMonth()]}, ${d.getFullYear()}`;

  let main;
  if (type === "Certificate of Residency") {
    main = `<p>This is to certify that ${person}, is a bona fide resident of ${address}${f.years ? `, and has been residing in this barangay for ${esc(f.years)}` : ""}.</p>
            <p>This certification is issued upon the request of the above-named person for <b>${purpose}</b> purposes.</p>`;
  } else if (type === "Certificate of Indigency") {
    main = `<p>This is to certify that ${person}, is a resident of ${address}, and belongs to an indigent family of this barangay, based on the records and verification of this office.</p>
            <p>This certification is issued upon the request of the above-named person for <b>${purpose}</b> purposes.</p>`;
  } else {
    main = `<p>This is to certify that ${person}, a resident of ${address}, is known to this office to be of good moral character and has no derogatory record on file in this barangay as of the date of this certification.</p>
            <p>This clearance is issued upon the request of the above-named person for <b>${purpose}</b> purposes.</p>`;
  }

  const validity = siteSettings.cert_validity ? `Valid for ${esc(siteSettings.cert_validity)} from date of issue.` : "";
  return `
    <div class="cert">
      <div class="cert-head">
        <img src="${esc(new URL("seal.png", location.href).href)}" alt="">
        <div>
          <div>Republic of the Philippines</div>
          <div>Province of Romblon</div>
          <div>Municipality of Alcantara</div>
          <div class="cert-brgy">BARANGAY MADALAG</div>
          <div class="cert-office">OFFICE OF THE PUNONG BARANGAY</div>
        </div>
      </div>
      <h1>${esc(CERT_TYPES[type])}</h1>
      <p class="cert-to"><b>TO WHOM IT MAY CONCERN:</b></p>
      <div class="cert-body">${main}
        <p>Issued this ${issued} at Barangay Madalag, Alcantara, Romblon, Philippines.</p>
      </div>
      <div class="cert-sign">
        <div class="cert-line">${esc((f.signatory || "").toUpperCase())}</div>
        <div>Punong Barangay</div>
      </div>
      <div class="cert-foot">
        <div>Certificate No.: ${esc(f.ref)}</div>
        <div>${validity} Not valid without the official dry seal.</div>
      </div>
    </div>`;
}

const CERT_CSS = `
  @page { size: 8.5in 11in; margin: 0.6in; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Times New Roman", Times, serif; color: #111; }
  .cert { border: 4px double #4e2c1a; padding: 0.45in 0.5in; min-height: 9.6in; display: flex; flex-direction: column; font-size: 14pt; line-height: 1.6; }
  .cert-head { display: flex; align-items: center; justify-content: center; gap: 18px; text-align: center; font-size: 12pt; line-height: 1.35; }
  .cert-head img { width: 90px; height: 90px; object-fit: contain; }
  .cert-brgy { font-weight: bold; font-size: 16pt; letter-spacing: 1px; margin-top: 2px; }
  .cert-office { font-size: 11pt; letter-spacing: 1px; }
  h1 { text-align: center; font-size: 22pt; letter-spacing: 3px; margin: 34px 0 26px; border-top: 2px solid #4e2c1a; border-bottom: 2px solid #4e2c1a; padding: 8px 0; color: #4e2c1a; }
  .cert-to { margin: 0 0 14px; }
  .cert-body p { text-indent: 0.5in; text-align: justify; margin: 0 0 14px; }
  .cert-sign { margin-top: auto; align-self: flex-end; text-align: center; min-width: 3in; padding-top: 70px; }
  .cert-line { border-top: 1px solid #111; font-weight: bold; padding-top: 4px; }
  .cert-foot { margin-top: 26px; font-size: 10pt; border-top: 1px solid #bbb; padding-top: 8px; }
`;

function printHTMLDocument(bodyHTML) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Barangay Certificate</title><style>${CERT_CSS}</style></head><body>${bodyHTML}</body></html>`);
  doc.close();

  const imgs = [...doc.images];
  const ready = Promise.all(imgs.map(i => i.complete ? Promise.resolve() : new Promise(r => { i.onload = i.onerror = r; })));
  ready.then(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 60000);
  });
}

function openCertificate(requestId) {
  const r = requests.find(x => x.id === requestId);
  if (!r || !CERT_TYPES[r.service]) return;
  if (!CERT_PRINTABLE_STATUSES.includes(r.status)) return toast("Approve the request before printing a certificate.", true);

  const isResidency = r.service === "Certificate of Residency";
  const signatory = currentPunong();

  openModal(`
    <span class="section-label">PRINT CERTIFICATE</span>
    <h2>${esc(r.service)}</h2>
    <p class="hint">Fill in the details the request form does not collect. These are used for printing only and are not saved. Please verify the resident's records before signing.</p>
    <div class="cert-form">
      <div class="form-group"><label>Full name</label><input id="ctName" value="${esc(r.full_name)}"></div>
      <div class="row2">
        <div class="form-group"><label>Age</label><input id="ctAge" type="number" min="0" max="130"></div>
        <div class="form-group"><label>Civil status</label><select id="ctCivil">${CIVIL_STATUSES.map(c => `<option value="${esc(c)}">${esc(c || "(not stated)")}</option>`).join("")}</select></div>
      </div>
      <div class="form-group"><label>Purok / Sitio</label><input id="ctAddress" placeholder="e.g. Purok 3"></div>
      ${isResidency ? `<div class="form-group"><label>Years of residency (optional)</label><input id="ctYears" placeholder="e.g. 12 years"></div>` : ""}
      <div class="form-group"><label>Purpose</label><input id="ctPurpose" value="${esc(r.purpose)}"></div>
      <div class="row2">
        <div class="form-group"><label>Date issued</label><input id="ctDate" type="date" value="${todayISO()}"></div>
        <div class="form-group"><label>Signed by (Punong Barangay)</label><input id="ctSignatory" value="${esc(signatory)}" placeholder="Name of Punong Barangay"></div>
      </div>
    </div>
    <div class="cert-preview-wrap"><div class="cert-preview" id="ctPreview"></div></div>
    <div class="modal-actions">
      <button class="primary-btn" id="ctPrint">&#128424; Print / Save as PDF</button>
      <button class="outline-btn" type="button" onclick="closeModal()">Cancel</button>
    </div>
  `);

  const collect = () => ({
    name: $("ctName").value.trim(),
    age: $("ctAge").value.trim(),
    civil: $("ctCivil").value,
    address: $("ctAddress").value.trim(),
    years: isResidency ? $("ctYears").value.trim() : "",
    purpose: $("ctPurpose").value.trim(),
    date: $("ctDate").value,
    signatory: $("ctSignatory").value.trim(),
    ref: r.reference_no
  });
  const refresh = () => { $("ctPreview").innerHTML = certBodyHTML(r.service, collect()); };

  document.querySelectorAll(".cert-form input, .cert-form select").forEach(el => el.addEventListener("input", refresh));
  refresh();

  $("ctPrint").addEventListener("click", () => {
    const f = collect();
    if (!f.name) return toast("Enter the resident's name.", true);
    if (!f.signatory) return toast("Enter the name of the Punong Barangay who will sign.", true);
    printHTMLDocument(certBodyHTML(r.service, f));
    logActivity("print", "certificate", r.reference_no, r.service);
  });
}
