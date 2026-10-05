/* =========================================================
   BARANGAY360 PUBLIC SITE - EXTRA SECTIONS
   Site settings (footer contact), History & Location, Transparency,
   Photo gallery, Directory.
   Loaded after script.js (uses its sb, esc, openModal, telHref...).
   Needs upgrade.sql to have been run in Supabase; until then each
   section simply shows a friendly "coming soon" message.
========================================================= */

const SX = {};   // site settings, filled from Supabase

const sxParas = t => String(t || "").split(/\n\s*\n/).map(s => s.trim()).filter(Boolean)
  .map(s => `<p>${esc(s).replace(/\n/g, "<br>")}</p>`).join("");

const sxDate = d => d ? new Date(d + "T00:00:00").toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "";

/* =========================================================
   SITE SETTINGS -> footer + emergency fallback
========================================================= */
function applyContact() {
  const show = (id, html) => {
    const el = document.getElementById(id);
    if (!el) return false;
    if (!html) { el.hidden = true; return false; }
    el.innerHTML = html;
    el.hidden = false;
    return true;
  };
  const inline = 'style="display:inline;margin:0;color:inherit"';

  show("ftAddress", SX.address ? esc(SX.address) : "");

  const hasPhone = show("ftPhone", SX.phone ? `\u{1F4DE} <a href="${esc(telHref(SX.phone))}" ${inline}>${esc(SX.phone)}</a>` : "");
  const hasEmail = show("ftEmail", SX.email ? `\u2709\uFE0F <a href="mailto:${esc(SX.email)}" ${inline}>${esc(SX.email)}</a>` : "");
  const hasHours = show("ftHours", SX.hours ? `\u{1F550} ${esc(SX.hours)}` : "");

  const fb = document.getElementById("ftFacebook");
  const hasFb = !!(fb && /^https?:\/\//i.test(SX.facebook || ""));
  if (fb) { fb.hidden = !hasFb; if (hasFb) fb.href = SX.facebook; }

  const empty = document.getElementById("ftEmpty");
  if (empty) empty.hidden = hasPhone || hasEmail || hasHours || hasFb;

  // keep the emergency list's Barangay Hall number in step with the settings
  if (SX.phone && typeof emergencyData !== "undefined") {
    emergencyData = emergencyData.map(c =>
      (/barangay hall/i.test(c.agency) && /^\(000\)/.test(c.phone)) ? { ...c, phone: SX.phone } : c);
    renderEmergency();
  }
}

async function loadSiteSettings() {
  if (sb) {
    const { data, error } = await sb.from("site_settings").select("key,value");
    if (!error && data) data.forEach(r => { SX[r.key] = (r.value || "").trim(); });
  }
  applyContact();
  renderAbout();
}

/* =========================================================
   HISTORY & LOCATION
========================================================= */
let aboutPuroks = [];

function mapEmbed() {
  const lat = parseFloat(SX.map_lat), lng = parseFloat(SX.map_lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return "";
  const dx = 0.012, dy = 0.008;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - dx}%2C${lat - dy}%2C${lng + dx}%2C${lat + dy}&layer=mapnik&marker=${lat}%2C${lng}`;
  const big = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
  return `
    <div class="about-map">
      <iframe src="${esc(src)}" title="Map showing the location of the Barangay Hall" loading="lazy"></iframe>
      <a href="${esc(big)}" target="_blank" rel="noopener">Open larger map &rarr;</a>
    </div>`;
}

function renderAbout() {
  const box = document.getElementById("aboutBody");
  if (!box) return;

  const intro = sxParas(SX.history_intro);
  const founding = SX.founding_story
    ? `<div class="about-card"><h3>How Madalag began</h3>${sxParas(SX.founding_story)}</div>` : "";

  const miles = [...MADALAG_MILESTONES].sort((a, b) => a.year - b.year).map(m => `
    <div class="about-mile">
      <div class="about-year">${esc(m.year)}</div>
      <div>
        <h4>${esc(m.title)}</h4>
        <small>${esc(m.date)}</small>
        <p>${esc(m.text)}</p>
        ${m.note ? `<p class="about-note">${esc(m.note)}</p>` : ""}
      </div>
    </div>`).join("");

  const map = mapEmbed();
  const puroks = aboutPuroks.length ? `
    <div class="about-card">
      <h3>Puroks &amp; Sitios</h3>
      <div class="purok-chips">${aboutPuroks.map(p => `
        <span class="purok-chip">${esc(p.label)}${p.value != null && p.value !== "" ? ` <small>${esc(fmtNum(p.value))} residents</small>` : ""}</span>`).join("")}</div>
    </div>` : "";

  const where = (SX.address || map) ? `
    <div class="about-card">
      <h3>Where to find us</h3>
      ${SX.address ? `<p>\u{1F4CD} ${esc(SX.address)}</p>` : ""}
      ${map}
    </div>` : "";

  box.innerHTML = `
    ${intro ? `<div class="about-intro">${intro}</div>` : ""}
    <div class="about-grid">
      <div class="about-col">
        ${founding}
        <div class="about-card">
          <h3>Milestones</h3>
          <div class="about-miles">${miles}</div>
        </div>
      </div>
      <div class="about-col">
        ${where}
        ${puroks}
      </div>
    </div>`;
}

async function loadAboutPuroks() {
  if (!sb) return;
  const { data, error } = await sb.from("profile_items").select("label,value,sort_order")
    .eq("category", "sitio").eq("is_published", true).order("sort_order", { ascending: true });
  if (!error && data) { aboutPuroks = data; renderAbout(); }
}

/* =========================================================
   TRANSPARENCY BOARD
========================================================= */
let trData = [], trCat = "All";

/* ---------- Transparency dropdown in the top navigation ----------
   kind: "ordinance" | "resolution" -> opens that tab of Ordinances & Resolutions
         "documents"                -> its own separate section further down the page (PDFs uploaded under the same category name)
   Managed in the admin portal (Transparency tab). Defaults are used until
   the transparency_menu table exists / has rows. */
const DEFAULT_TR_MENU = [
  { name: "Barangay Ordinances",         kind: "ordinance" },
  { name: "Barangay Resolutions",        kind: "resolution" },
  { name: "Awards and Recognitions",     kind: "documents" },
  { name: "Bids and Awards Committee",   kind: "documents" }
];
let trMenu = DEFAULT_TR_MENU.slice();

const trSlug = n => "tr-sec-" + String(n).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const trSepNames = () => new Set(trMenu.filter(m => m.kind === "documents").map(m => m.name));
const trBoardDocs = () => { const sep = trSepNames(); return trData.filter(t => !sep.has(t.category)); };

function trItemHTML(t) {
  const url = trFileUrl(t.file_path);
  return `
    <div class="ord-item">
      <span class="ord-badge tr-badge">${esc(t.category.toUpperCase())}</span>
      <div class="ord-info">
        <strong>${t.fiscal_year ? "Fiscal Year " + esc(t.fiscal_year) : "&nbsp;"}</strong>
        <h3>${esc(t.title)}</h3>
        <small>Posted ${esc(sxDate(t.created_at.slice(0, 10)))}</small>
      </div>
      ${url ? `<a class="ord-btn" href="${esc(url)}" target="_blank" rel="noopener">Download PDF</a>` : ""}
    </div>`;
}

/* One separate page section per "documents" menu item */
function renderTransparencySections() {
  const box = document.getElementById("trExtraSections");
  if (!box) return;
  box.innerHTML = trMenu.filter(m => m.kind === "documents").map(m => {
    const docs = trData.filter(t => t.category === m.name);
    return `
  <section class="section transparency-section" id="${esc(trSlug(m.name))}">
    <div class="section-heading">
      <div>
        <span class="section-label">TRANSPARENCY</span>
        <h2>${esc(m.name)}</h2>
      </div>
    </div>
    <div class="ord-list">${docs.length ? docs.map(trItemHTML).join("")
      : '<div class="ord-empty">Documents under ' + esc(m.name) + ' will be posted here soon.</div>'}</div>
  </section>`;
  }).join("");
}

function renderTransparencyMenu() {
  const menu = document.getElementById("transparencyMenu");
  if (!menu) return;
  menu.innerHTML = trMenu.map((m, i) => `
    <li role="option" tabindex="0" data-i="${i}"><strong>${esc(m.name)}</strong></li>`).join("")
    || '<li class="empty">Nothing here yet.</li>';
}

function pickTransparency(i) {
  const m = trMenu[i];
  if (!m) return;
  if (m.kind === "ordinance" || m.kind === "resolution") {
    ordType = m.kind === "ordinance" ? "Ordinance" : "Resolution";
    document.querySelectorAll("#ordTabs .ord-tab").forEach(t => t.classList.toggle("active", t.dataset.type === ordType));
    renderOrdinances();
    scrollToSection("ordinances");
  } else {
    const sec = document.getElementById(trSlug(m.name));
    if (sec) sec.scrollIntoView({ behavior: "smooth" });
  }
}

renderTransparencySections();
initNavDropdown("navTransparency", "navTransparencyBtn", "transparencyMenu", pickTransparency);
renderTransparencyMenu();

async function loadTransparencyMenu() {
  if (sb) {
    const { data, error } = await sb.from("transparency_menu").select("name,kind,sort_order")
      .eq("is_published", true)
      .order("sort_order", { ascending: true }).order("created_at", { ascending: true });
    if (!error && data && data.length) trMenu = data;
  }
  renderTransparencyMenu();
  renderTransparencySections();
  buildTransparencyControls();
  renderTransparencyBoard();
}
const trFileUrl = p => (p && sb) ? sb.storage.from("documents").getPublicUrl(p).data.publicUrl : "";

function renderTransparencyBoard() {
  const list = document.getElementById("trList");
  if (!list) return;

  const docs = trBoardDocs();
  if (!docs.length) {
    list.innerHTML = '<div class="ord-empty">Budget, investment plan and financial reports will be posted here soon.</div>';
    return;
  }

  const year = document.getElementById("trYear").value;
  const rows = docs.filter(t => (trCat === "All" || t.category === trCat) && (year === "All" || String(t.fiscal_year) === year));

  list.innerHTML = rows.length ? rows.map(trItemHTML).join("")
    : '<div class="ord-empty">No documents match your filter.</div>';
}

function buildTransparencyControls() {
  const cats = [...new Set(trBoardDocs().map(t => t.category))];
  if (trCat !== "All" && !cats.includes(trCat)) trCat = "All";
  document.getElementById("trTabs").innerHTML =
    ["All", ...cats].map(c => `<button class="ord-tab ${c === trCat ? "active" : ""}" data-cat="${esc(c)}">${c === "All" ? "All" : esc(c)}</button>`).join("");

  const years = [...new Set(trBoardDocs().map(t => t.fiscal_year).filter(Boolean))].sort((a, b) => b - a);
  document.getElementById("trYear").innerHTML =
    '<option value="All">All Years</option>' + years.map(y => `<option>${y}</option>`).join("");
}

async function loadTransparencyBoard() {
  if (sb) {
    const { data, error } = await sb.from("transparency_docs").select("*").eq("is_published", true)
      .order("fiscal_year", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
    if (!error && data) trData = data;
  }
  renderTransparencySections();
  buildTransparencyControls();
  renderTransparencyBoard();
}

document.getElementById("trTabs").addEventListener("click", e => {
  const b = e.target.closest(".ord-tab");
  if (!b) return;
  trCat = b.dataset.cat;
  document.querySelectorAll("#trTabs .ord-tab").forEach(t => t.classList.toggle("active", t === b));
  renderTransparencyBoard();
});
document.getElementById("trYear").addEventListener("change", renderTransparencyBoard);

/* =========================================================
   PHOTO GALLERY
========================================================= */
let galAlbums = [], galPhotos = [];
const galFileUrl = p => (p && sb) ? sb.storage.from("gallery").getPublicUrl(p).data.publicUrl : "";

function renderGalleryGrid() {
  const grid = document.getElementById("galleryGrid");
  if (!grid) return;
  const withPhotos = galAlbums.filter(a => galPhotos.some(p => p.album_id === a.id));

  if (!withPhotos.length) {
    grid.innerHTML = '<div class="off-empty" style="grid-column:1/-1">Photos from barangay events will be posted here soon.</div>';
    return;
  }

  grid.innerHTML = withPhotos.map(a => {
    const ph = galPhotos.filter(p => p.album_id === a.id);
    return `
    <button class="gallery-card" onclick="openAlbum('${esc(a.id)}')">
      <img src="${esc(galFileUrl(ph[0].photo_path))}" alt="" loading="lazy">
      <span class="gallery-meta">
        <strong>${esc(a.title)}</strong>
        <small>${a.event_date ? esc(sxDate(a.event_date)) + " \u00b7 " : ""}${ph.length} photo${ph.length === 1 ? "" : "s"}</small>
      </span>
    </button>`;
  }).join("");
}

function openAlbum(id) {
  const a = galAlbums.find(x => x.id === id);
  if (!a) return;
  const ph = galPhotos.filter(p => p.album_id === id);
  openModal(`
    <span class="section-label">PHOTO ALBUM</span>
    <h2>${esc(a.title)}</h2>
    ${a.event_date ? `<p style="font-size:13px">${esc(sxDate(a.event_date))}</p>` : ""}
    ${a.description ? `<p style="margin-top:6px">${esc(a.description)}</p>` : ""}
    <div class="album-thumbs">${ph.map((p, i) => `
      <button onclick="openLightbox('${esc(id)}', ${i})" aria-label="View photo ${i + 1}">
        <img src="${esc(galFileUrl(p.photo_path))}" alt="" loading="lazy">
      </button>`).join("")}</div>`);
}

/* lightbox */
let lbList = [], lbIndex = 0;

function ensureLightbox() {
  let lb = document.getElementById("lightbox");
  if (lb) return lb;
  lb = document.createElement("div");
  lb.id = "lightbox";
  lb.className = "lightbox";
  lb.innerHTML = `
    <button class="lb-close" aria-label="Close">&times;</button>
    <button class="lb-nav prev" aria-label="Previous photo">&#10094;</button>
    <img alt="">
    <button class="lb-nav next" aria-label="Next photo">&#10095;</button>
    <div class="lb-count"></div>`;
  document.body.appendChild(lb);
  lb.addEventListener("click", e => {
    if (e.target.closest(".prev")) return lbStep(-1);
    if (e.target.closest(".next")) return lbStep(1);
    if (e.target.tagName !== "IMG") closeLightbox();
  });
  return lb;
}

function showLightboxPhoto() {
  const lb = ensureLightbox();
  lb.querySelector("img").src = lbList[lbIndex];
  lb.querySelector(".lb-count").textContent = `${lbIndex + 1} / ${lbList.length}`;
  const multi = lbList.length > 1;
  lb.querySelectorAll(".lb-nav").forEach(b => (b.hidden = !multi));
}

function openLightbox(albumId, index) {
  lbList = galPhotos.filter(p => p.album_id === albumId).map(p => galFileUrl(p.photo_path));
  lbIndex = index;
  ensureLightbox().classList.add("active");
  showLightboxPhoto();
}

function lbStep(d) { lbIndex = (lbIndex + d + lbList.length) % lbList.length; showLightboxPhoto(); }
function closeLightbox() { const lb = document.getElementById("lightbox"); if (lb) lb.classList.remove("active"); }

document.addEventListener("keydown", e => {
  const lb = document.getElementById("lightbox");
  if (!lb || !lb.classList.contains("active")) return;
  if (e.key === "Escape") closeLightbox();
  else if (e.key === "ArrowLeft") lbStep(-1);
  else if (e.key === "ArrowRight") lbStep(1);
});

async function loadGallery() {
  if (sb) {
    const [al, ph] = await Promise.all([
      sb.from("gallery_albums").select("*").eq("is_published", true)
        .order("event_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
      sb.from("gallery_photos").select("id,album_id,photo_path,sort_order,created_at")
        .order("sort_order", { ascending: true }).order("created_at", { ascending: true })
    ]);
    if (!al.error && !ph.error) { galAlbums = al.data || []; galPhotos = ph.data || []; }
  }
  renderGalleryGrid();
}

/* =========================================================
   DIRECTORY
========================================================= */
let dirData = [];
const DIR_ORDER = [
  "Lupong Tagapamayapa", "Barangay Health Workers (BHW)", "Barangay Tanod", "SK Council",
  "Barangay Nutrition Scholar / Day Care", "Committees & Other Staff"
];
const dirPhoto = p => (p && sb) ? sb.storage.from("directory").getPublicUrl(p).data.publicUrl : "";

function dirFrame(m, size) {
  const url = dirPhoto(m.photo_path);
  const inner = url
    ? `<img src="${esc(url)}" alt="${esc(m.full_name)}" loading="lazy">`
    : `<span class="pf-initials">${esc(offInitials(m.full_name))}</span>`;
  return `<div class="photo-frame ${size || ""}"><div class="pf-inner">${inner}</div></div>`;
}

function renderDirectory() {
  const box = document.getElementById("directoryBody");
  if (!box) return;

  if (!dirData.length) {
    box.innerHTML = '<div class="off-empty">The barangay directory will be posted here soon.</div>';
    return;
  }

  const groups = new Map();
  dirData.forEach(m => { if (!groups.has(m.group_name)) groups.set(m.group_name, []); groups.get(m.group_name).push(m); });
  const rank = g => { const i = DIR_ORDER.indexOf(g); return i === -1 ? 99 : i; };

  box.innerHTML = [...groups.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).map(g => `
    <div class="dir-group">
      <h3>${esc(g)} <small>${groups.get(g).length}</small></h3>
      <div class="dir-grid">${groups.get(g).map(m => `
        <button class="dir-card" onclick="openDirMember('${esc(m.id)}')">
          ${dirFrame(m, "md")}
          <strong>${esc(m.full_name)}</strong>
          ${m.role_title ? `<span>${esc(m.role_title)}</span>` : ""}
        </button>`).join("")}</div>
    </div>`).join("");
}

function openDirMember(id) {
  const m = dirData.find(x => x.id === id);
  if (!m) return;
  openModal(`
    <div class="off-modal">
      ${dirFrame(m, "xl")}
      <span class="section-label">${esc(m.group_name.toUpperCase())}</span>
      <h2>${esc(m.full_name)}</h2>
      ${m.role_title ? `<p>${esc(m.role_title)}</p>` : ""}
    </div>`);
}

async function loadDirectory() {
  if (sb) {
    const { data, error } = await sb.from("directory_members").select("*").eq("is_published", true)
      .order("sort_order", { ascending: true }).order("full_name", { ascending: true });
    if (!error && data) dirData = data;
  }
  renderDirectory();
}

/* ---------- START ---------- */
renderAbout();
loadSiteSettings();
loadAboutPuroks();
loadTransparencyBoard().then(loadTransparencyMenu);
loadGallery();
loadDirectory();


/* =========================================================
   ABOUT DROPDOWN (top navigation)
   History and Location + Barangay Profile (with its own sub-list).
   Each choice opens its content in a pop-up.
========================================================= */
const setAboutMenuOpen = initNavDropdown("navAbout", "navAboutBtn", "aboutMenu", openAboutItem);

(function initProfileSub() {
  const t = document.getElementById("profileToggle"), sub = document.getElementById("profileSub");
  if (!t || !sub) return;
  t.addEventListener("click", () => {
    sub.hidden = !sub.hidden;
    t.setAttribute("aria-expanded", sub.hidden ? "false" : "true");
  });
})();

// Used by the footer link
function openAboutMenu(expandProfile) {
  window.scrollTo({ top: 0, behavior: "smooth" });
  document.getElementById("mainNav").classList.add("active");
  setAboutMenuOpen(true);
  if (expandProfile) {
    document.getElementById("profileSub").hidden = false;
    document.getElementById("profileToggle").setAttribute("aria-expanded", "true");
  }
}

const profSoon = what => `<div class="off-empty">${esc(what)} will be posted here soon.</div>`;

function profStat(re, title) {
  const s = profileData.filter(x => x.category === "stat" && hasVal(x) && re.test(x.label))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))[0];
  if (!s) return profSoon(title);
  return `<div class="prof-stats"><div class="prof-stat">
      <strong>${esc(fmtNum(s.value))}</strong>
      <span>${esc(s.label)}</span>
      ${s.as_of || s.source ? `<small>${esc([s.as_of ? "As of " + s.as_of : "", s.source || ""].filter(Boolean).join(" \u00b7 "))}</small>` : ""}
    </div></div>`;
}

function profRows(cat) {
  return profileData.filter(x => x.category === cat && hasVal(x)).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

function profileModalBody(key) {
  switch (key) {
    case "population": return ["Total Population", profStat(/total\s*population|^population$/i, "Total population") ];
    case "households": return ["Households", profStat(/household/i, "The number of households")];
    case "male":       return ["Male Residents", profStat(/^male/i, "The number of male residents")];
    case "female":     return ["Female Residents", profStat(/^female/i, "The number of female residents")];
    case "voters":     return ["Registered Voters", profStat(/voter/i, "The number of registered voters")];

    case "growth": {
      const census = profRows("census").sort((a, b) => Number(a.label) - Number(b.label));
      if (!census.length) return ["Population Growth", profSoon("Population growth")];
      let trend = "";
      if (census.length > 1) {
        const a = census[census.length - 2], b = census[census.length - 1];
        const pct = (Number(b.value) - Number(a.value)) / Number(a.value) * 100;
        trend = `<p class="prof-trend">${pct >= 0 ? "Up" : "Down"} <b>${Math.abs(pct).toFixed(1)}%</b> from ${esc(a.label)} (${esc(fmtNum(a.value))}) to ${esc(b.label)} (${esc(fmtNum(b.value))}).</p>`;
      }
      return ["Population Growth", `<p class="prof-sub">Residents counted in each national census</p>${populationChartSVG(census)}${trend}${profNote(census, true)}`];
    }

    case "history_table": {
      const census = profRows("census").sort((a, b) => Number(b.label) - Number(a.label));
      if (!census.length) return ["Population History", profSoon("Population history")];
      const showHh = census.some(r => r.value2 != null);
      return ["Population History", `
        <table class="prof-table">
          <thead><tr><th>Census year</th><th>Population</th>${showHh ? "<th>Households</th>" : ""}<th>As of</th></tr></thead>
          <tbody>${census.map(r => `<tr><td>${esc(r.label)}</td><td>${esc(fmtNum(r.value))}</td>${showHh ? `<td>${r.value2 != null ? esc(fmtNum(r.value2)) : "\u2013"}</td>` : ""}<td>${esc(r.as_of || "")}</td></tr>`).join("")}</tbody>
        </table>${profNote(census, true)}`];
    }

    case "age": {
      const age = profRows("age");
      return ["Population by Age Group", age.length ? barList(age) + profNote(age) : profSoon("Population by age group")];
    }

    case "sitio": {
      const sitio = profRows("sitio");
      if (!sitio.length) return ["Purok / Sitio", profSoon("Purok and sitio information")];
      const tp = sitio.reduce((s, r) => s + Number(r.value || 0), 0);
      const th = sitio.reduce((s, r) => s + Number(r.value2 || 0), 0);
      const showHh = sitio.some(r => r.value2 != null);
      return ["Purok / Sitio", `
        <table class="prof-table">
          <thead><tr><th>Name</th><th>Population</th>${showHh ? "<th>Households</th>" : ""}</tr></thead>
          <tbody>${sitio.map(r => `<tr><td>${esc(r.label)}</td><td>${esc(fmtNum(r.value))}</td>${showHh ? `<td>${r.value2 != null ? esc(fmtNum(r.value2)) : "\u2013"}</td>` : ""}</tr>`).join("")}</tbody>
          <tfoot><tr><td>Total</td><td>${esc(fmtNum(tp))}</td>${showHh ? `<td>${esc(fmtNum(th))}</td>` : ""}</tr></tfoot>
        </table>${profNote(sitio)}`];
    }

    case "livelihood": {
      const live = profRows("livelihood");
      return ["Main Sources of Livelihood", live.length ? barList(live) + profNote(live) : profSoon("Livelihood information")];
    }
  }
  return null;
}

function openAboutItem(key) {
  if (key === "history") {
    renderAbout();
    openWideModal(`
      <span class="section-label">OUR STORY</span>
      <h2>History &amp; Location</h2>
      <div class="about-modal">${document.getElementById("aboutBody").innerHTML}</div>`);
    return;
  }
  const r = profileModalBody(key);
  if (!r) return;
  openWideModal(`
    <span class="section-label">BARANGAY PROFILE</span>
    <h2>${esc(r[0])}</h2>
    ${r[1]}
    <p class="prof-foot">Figures are aggregate counts only, based on the Philippine Statistics Authority and barangay records. No personal information about individual residents is published.</p>`);
}
