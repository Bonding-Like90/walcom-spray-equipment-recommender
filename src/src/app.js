import { recommendWalcom } from "./recommend.js";

function parseCSV(text) {
  // Simple CSV parser for basic CSVs.
  // Assumes fields do not contain commas.
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map(h => h.trim());

  return lines.slice(1).map(line => {
    const parts = line.split(",").map(p => p.trim());
    const obj = {};
    headers.forEach((h, i) => obj[h] = parts[i]);
    return obj;
  });
}

function toTypedItems(items) {
  return items.map(i => ({
    walcom_item_id: i.walcom_item_id,
    halo_family: i.halo_family,
    variant_group: i.variant_group,
    digital_mode: i.digital_mode,
    tip_size: Number(i.tip_size),
    description: i.description || "",
    source_page: i.source_page || "",
    confidence: i.confidence ? Number(i.confidence) : undefined
  }));
}

async function loadWalcomData() {
  const [csvRes, addonsRes] = await Promise.all([
    fetch("/data/walcom_items.csv"),
    fetch("/data/walcom_addons.json")
  ]);

  if (!csvRes.ok) throw new Error(`Failed to fetch walcom_items.csv (${csvRes.status})`);
  if (!addonsRes.ok) throw new Error(`Failed to fetch walcom_addons.json (${addonsRes.status})`);

  const csvText = await csvRes.text();
  const addons = await addonsRes.json();

  const parsed = parseCSV(csvText);
  const walcomItems = toTypedItems(parsed);
  return { walcomItems, addons };
}

const state = {
  walcomItems: [],
  addons: null
};

async function init() {
  const { walcomItems, addons } = await loadWalcomData();
  state.walcomItems = walcomItems;
  state.addons = addons;
}

init().catch(err => {
  console.error(err);
  document.getElementById("haloOut").textContent = "Error loading data (see console). " + err.message;
  document.getElementById("addonOut").textContent = "Error loading data (see console).";
});

document.getElementById("recForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const input = {
    competitorName: document.getElementById("competitorName").value,
    haloFamily: document.getElementById("haloFamily").value,
    digitalLevel: document.getElementById("digitalLevel").value,
    baseClear: document.getElementById("baseClear").value,
    needleSize: Number(document.getElementById("needleSize").value)
  };

  const result = recommendWalcom({
    walcomItems: state.walcomItems,
    addons: state.addons,
    input
  });

  document.getElementById("addonOut").textContent =
    result.addon_recommendation
      ? JSON.stringify(result.addon_recommendation, null, 2)
      : "No add-on";

  document.getElementById("haloOut").textContent =
    JSON.stringify(result.halo_recommendations, null, 2);
});
