/* =========================================================
   BARANGAY MADALAG - HISTORY DATA  (shared by index + admin)
   Edit this file if the barangay secretary finds corrections.
   ========================================================= */

/* Milestones that are documented.
   "verified" = found in an official source. "note" explains caveats. */
const MADALAG_MILESTONES = [
  {
    year: 1961, date: "March 21, 1961", verified: true,
    title: "Barrio of Madalag joins the new Municipality of Alcantara",
    text: "Executive Order No. 427 (Pres. Carlos P. Garcia) separated eight barrios of Looc - Alcantara, San Isidro, Comoed-om, Tugdan, Calagonsao, Bonlao, Madalag and Camili - to form the Municipality of Alcantara, Romblon."
  },
  {
    year: 1974, date: "September 21, 1974", verified: false,
    title: "Barrio becomes Barangay",
    text: "Presidential Decree No. 557 declared every barrio in the Philippines a barangay (the term itself began with PD 86 in December 1972). Madalag became a barangay by operation of this law.",
    note: "Exact barrio founding year of Madalag was not found in published sources - confirm with the Municipal Archives / Sangguniang Bayan."
  },
  {
    year: 1982, date: "May 17, 1982", verified: true,
    title: "First nationwide barangay elections",
    text: "Batas Pambansa 222 (Barangay Election Act) - a Punong Barangay and six Kagawads elected in every barangay."
  }
];

/* Every regular barangay election held since 1982.
   term = years the winners were officially in office (approximate start year -> next election year). */
const BARANGAY_ELECTIONS = [
  { year: 1982, date: "May 17, 1982",   note: "First barangay election. Term cut short after the 1986 EDSA change of government (officers-in-charge)." },
  { year: 1989, date: "March 1989",     note: "Postponed twice from May 1988." },
  { year: 1994, date: "May 9, 1994",    note: "First election under the 1991 Local Government Code." },
  { year: 1997, date: "May 12, 1997" },
  { year: 2002, date: "July 15, 2002",  note: "First synchronized Barangay and SK election." },
  { year: 2007, date: "October 29, 2007", note: "Postponed from 2005." },
  { year: 2010, date: "October 25, 2010" },
  { year: 2013, date: "October 28, 2013" },
  { year: 2018, date: "May 14, 2018",   note: "Postponed several times from 2016/2017." },
  { year: 2023, date: "October 30, 2023", note: "Terms extended after the 2020/2022 postponements." }
];

/* Upcoming election (RA 12232 - four-year term, starts December 1). */
const NEXT_ELECTION = { year: 2026, date: "November 2, 2026", note: "Next BSKE. Four-year terms under RA 12232." };

/* Preferred display order of positions */
const OFFICIAL_POSITIONS = [
  "Punong Barangay",
  "Barangay Kagawad",
  "SK Chairperson",
  "Barangay Secretary",
  "Barangay Treasurer"
];

function positionRank(p) {
  const i = OFFICIAL_POSITIONS.indexOf(p);
  return i === -1 ? 99 : i;
}

/* Summary numbers, computed so they stay correct without edits. */
function barangayStats(now = new Date()) {
  const held = BARANGAY_ELECTIONS.length;            // elections already held
  return {
    electionsHeld: held,
    termsCompleted: held - 1,                         // latest elected term is still running
    currentTermStart: BARANGAY_ELECTIONS[held - 1].year,
    yearsAsBarangay: now.getFullYear() - 1974,
    next: NEXT_ELECTION
  };
}
