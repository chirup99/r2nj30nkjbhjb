export type HmdaMasterPlanGroup = "plan-2031" | "revised-huda";

export type HmdaMasterPlanMap = {
  id: string;
  area: string;
  group: HmdaMasterPlanGroup;
  imageUrl: string;
  sourcePage: string;
};

const districtMap = (id: string, area: string, fileName: string) => ({
  id: `district-${id}`,
  area,
  group: "plan-2031" as const,
  imageUrl: `https://masterplan.hmda.gov.in/Masterplan2031/Content/${fileName}`,
  sourcePage: "https://www.hmda.gov.in/master-planning-2031/",
});

const zoneMap = (id: string, area: string, fileName: string) => ({
  id: `zone-${id}`,
  area,
  group: "revised-huda" as const,
  imageUrl: `https://masterplan.hmda.gov.in/Masterplanzonewise/Content/${fileName}`,
  sourcePage: "https://www.hmda.gov.in/masterplan-huda/",
});

// These public image URLs are linked from HMDA's official Master Plan pages.
export const HMDA_MASTER_PLAN_MAPS: readonly HmdaMasterPlanMap[] = [
  districtMap("bibinagar", "Bibinagar", "BIBINAGAR.jpg"),
  districtMap("bommal-aramaram", "Bommal Raramaram", "BOMMALARAMARAM.jpg"),
  districtMap("bhuvanagiri", "Bhuvanagiri", "BUVANAGIRI.jpg"),
  districtMap("chevella", "Chevella", "CHEVELLA.jpg"),
  districtMap("choutuppal", "Choutuppal", "CHOUTUPPAL.jpg"),
  districtMap("faruqnagar", "Faruqnagar", "FARUQNAGAR.jpg"),
  districtMap("ghatkesar", "Ghatkesar", "GHATKESAR.jpg"),
  districtMap("hatnura", "Hatnura", "HATNURA.jpg"),
  districtMap("hayathnagar", "Hayathnagar", "HAYATHNAGAR.jpg"),
  districtMap(
    "ibrahimpatnam-manchal",
    "Ibrahimpatnam Manchal",
    "IBRAHIMPATNAM%20MANCHAL.jpg",
  ),
  districtMap("jinnawaram", "Jinnawaram", "JINNAWARAM_FPLU.jpg"),
  districtMap("kandukur", "Kandukur", "KANDUKUR.jpg"),
  districtMap("kisara", "Kisara", "KISARA.jpg"),
  districtMap("kothuru", "Kothuru", "KOTHURU.jpg"),
  districtMap("maheshwaram", "Maheshwaram", "MAHESHWARAM.jpg"),
  districtMap(
    "medchal-qutubullapur",
    "Medchal Qutubullapur",
    "medchal_qutubullapur.jpg",
  ),
  districtMap(
    "moinabad-rajendranagar",
    "Moinabad Rajendranagar",
    "MOINABAD_RAJENDRANAGAR.jpg",
  ),
  districtMap("mulug", "Mulug", "MULUG.jpg"),
  districtMap("narsapur", "Narsapur", "NARSAPUR.jpg"),
  districtMap("patancheruvu", "Patancheruvu", "PATANCHERUVU.jpg"),
  districtMap("pochampalli", "Pochampalli", "POCHAMPALLI.jpg"),
  districtMap("sangareddy", "Sangareddy", "SANGAREDDY.jpg"),
  districtMap("shahbad", "Shahbad", "SHAHBAD.jpg"),
  districtMap("shamirpet", "Shamirpet", "SHAHMIRPET.jpg"),
  districtMap("shamshabad", "Shamshabad", "SHAMSHABAD.jpg"),
  districtMap(
    "shankarpalli-ramachandrapuram",
    "Shankarpalli Ramachandrapuram",
    "SHANKARPALLI_RAMCHANDRAPURAM.jpg",
  ),
  districtMap("shivampet", "Shivampet", "SHIVAMPET.jpg"),
  districtMap("tupran", "Tupran", "TUPRAN.jpg"),
  districtMap("wargal", "Wargal", "WARGAL.jpg"),
  districtMap("yacharam", "Yacharam", "YACHARAM.jpg"),
  zoneMap("budvel", "Budvel Zone", "Budvel%20Zone.jpg"),
  zoneMap(
    "chengicherla-sheet-1",
    "Chengicherla Zone — Sheet 1",
    "Chengicherla%20Zone%20Sheet1.jpg",
  ),
  zoneMap(
    "chengicherla-sheet-2",
    "Chengicherla Zone — Sheet 2",
    "Chengicherla%20Zone%20Sheet2.jpg",
  ),
  zoneMap(
    "ghatkesar-sheet-1",
    "Ghatkesar Zone — Sheet 1",
    "Ghatkesar%20Zone%20Sheet1.jpg",
  ),
  zoneMap(
    "ghatkesar-sheet-2",
    "Ghatkesar Zone — Sheet 2",
    "Ghatkesar%20Zone%20Sheet2.jpg",
  ),
  zoneMap(
    "hayathnagar-sheet-1",
    "Hayathnagar Zone — Sheet 1",
    "Hayathnagar%20Zone%20Sheet1.jpg",
  ),
  zoneMap(
    "hayathnagar-sheet-2",
    "Hayathnagar Zone — Sheet 2",
    "Hayathnagar%20Zone%20Sheet2.jpg",
  ),
  zoneMap(
    "himayath-nagar-sheet-1",
    "Himayath Nagar Zone — Sheet 1",
    "Himayath%20Nagar%20Sheet1%20(1).jpg",
  ),
  zoneMap(
    "himayath-nagar-sheet-2",
    "Himayath Nagar Zone — Sheet 2",
    "Himayath%20Nagar%20Sheet2.jpg",
  ),
  zoneMap(
    "keesara-sheet-1",
    "Keesara Zone — Sheet 1",
    "Keesara%20Zone%20Sheet1.jpg",
  ),
  zoneMap(
    "keesara-sheet-2",
    "Keesara Zone — Sheet 2",
    "Keesara%20Zone%20Sheet2.jpg",
  ),
  zoneMap(
    "kollur-sheet-1",
    "Kollur Zone — Sheet 1",
    "Kollur%20Zone%20Sheet1%20(1).jpg",
  ),
  zoneMap("kollur-sheet-2", "Kollur Zone — Sheet 2", "Kollur%20Zone%20Sheet2.jpg"),
  zoneMap(
    "kukatpally-sheet-1",
    "Kukatpally Zone — Sheet 1",
    "Kukatpally%20Zone%20Sheet1.jpg",
  ),
  zoneMap(
    "kukatpally-sheet-2",
    "Kukatpally Zone — Sheet 2",
    "Kukatpally%20Zone%20Sheet2.jpg",
  ),
  zoneMap(
    "medchal-sheet-1",
    "Medchal Zone — Sheet 1",
    "Medchal%20Zone%20Sheet1.jpg",
  ),
  zoneMap(
    "medchal-sheet-2",
    "Medchal Zone — Sheet 2",
    "Medchal%20Zone%20Sheet2.jpg",
  ),
  zoneMap(
    "yamzal-sheet-1",
    "Yamzal Zone — Sheet 1",
    "Yamzal%20Zone%20Sheet1.jpg",
  ),
  zoneMap(
    "yamzal-sheet-2",
    "Yamzal Zone — Sheet 2",
    "Yamzal%20Zone%20Sheet2.jpg",
  ),
  zoneMap(
    "shamirpet-sheet-1",
    "Shamirpet Zone — Sheet 1",
    "Shamirpet%20Zone%20Sheet1%20(1).jpg",
  ),
  zoneMap(
    "shamirpet-sheet-2",
    "Shamirpet Zone — Sheet 2",
    "Shamirpet%20Zone%20Sheet2.jpg",
  ),
  zoneMap("kothapet", "Kothapet Zone", "Kothapet%20Zone.jpg"),
  zoneMap("moula-ali", "Moula Ali Zone", "Moula%20Ali%20Zone.jpg"),
  zoneMap("nadergul", "Nadergul Zone", "Nadergul%20Zone.jpg"),
  zoneMap("poppalguda", "Poppalguda Zone", "Poppalguda%20Zone.jpg"),
  zoneMap(
    "rc-puram-sheet-1",
    "RC Puram Zone — Sheet 1",
    "RC%20Puram%20Zone%20Sheet1.jpg",
  ),
  zoneMap(
    "rc-puram-sheet-2",
    "RC Puram Zone — Sheet 2",
    "RC%20Puram%20Zone%20Sheet2.jpg",
  ),
  zoneMap(
    "shambhupur-sheet-1",
    "Shambhupur Zone — Sheet 1",
    "Shambhupur%20Zone%20Sheet1.jpg",
  ),
  zoneMap(
    "shambhupur-sheet-2",
    "Shambhupur Zone — Sheet 2",
    "Shambhupur%20Zone%20Sheet2.jpg",
  ),
  zoneMap("shamshabad", "Shamshabad Zone", "Shamshabad%20Zone.jpg"),
];