/* ═══════════════════════════════════════════════════════════════
   Farmacie di Turno — Milano
   app.js  — map logic and UI interactions
   ═══════════════════════════════════════════════════════════════ */

// ── Config ──────────────────────────────────────────────────────
const MILAN_CENTER   = [45.4642, 9.1900];
const DEFAULT_ZOOM   = 12;
const DATA_PATH      = './data/';

// Italian day/month short names
const DAY_SHORT   = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const MONTH_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu',
                     'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

// ── State ────────────────────────────────────────────────────────
let map;
let clusterGroup;
let currentEntries  = [];   // [{marker, data}]
let userMarker      = null;
let searchMarker    = null;
let userLatLng      = null; // last known user position
let currentDate     = null;

// ── Map initialisation ───────────────────────────────────────────
function initMap() {
  map = L.map('map', {
    center: MILAN_CENTER,
    zoom:   DEFAULT_ZOOM,
    zoomControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  clusterGroup = L.markerClusterGroup({ maxClusterRadius: 50 });
  map.addLayer(clusterGroup);
}

// ── Custom icon builders ─────────────────────────────────────────
function pharmacyIcon(nearest = false) {
  return L.divIcon({
    className: '',
    html: `<div class="pharmacy-icon${nearest ? ' nearest' : ''}">✚</div>`,
    iconSize:   [28, 28],
    iconAnchor: [14, 14],
    popupAnchor:[0, -16],
  });
}

const userIcon = L.divIcon({
  className: '',
  html: '<div class="you-icon"></div>',
  iconSize:   [18, 18],
  iconAnchor: [9, 9],
});

const pinIcon = L.divIcon({
  className: '',
  html: '<div class="pin-icon">📍</div>',
  iconSize:   [28, 36],
  iconAnchor: [14, 36],
  popupAnchor:[0, -36],
});

// ── Haversine distance (km) ──────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R  = 6371;
  const dL = (lat2 - lat1) * Math.PI / 180;
  const dO = (lon2 - lon1) * Math.PI / 180;
  const a  = Math.sin(dL / 2) ** 2 +
             Math.cos(lat1 * Math.PI / 180) *
             Math.cos(lat2 * Math.PI / 180) *
             Math.sin(dO / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDistance(km) {
  return km < 1
    ? `${Math.round(km * 1000)} m`
    : `${km.toFixed(1)} km`;
}

// ── Popup HTML builder ───────────────────────────────────────────
function buildPopupHtml(pharmacy, refLat, refLon) {
  const { nome, indirizzo, telefono, orario } = pharmacy;
  const pLat = parseFloat(pharmacy.lat);
  const pLon = parseFloat(pharmacy.lon);

  let distHtml = '';
  if (refLat != null && refLon != null && pLat && pLon) {
    const km = haversine(refLat, refLon, pLat, pLon);
    distHtml = `<p class="popup-distance">Distanza: ${fmtDistance(km)}</p>`;
  }

  const phoneRow = telefono
    ? `<div class="popup-row"><span class="icon">📞</span>
         <a href="tel:${telefono.replace(/\s+/g, '')}">${telefono}</a>
       </div>`
    : '';

  const timeRow = orario
    ? `<div class="popup-row"><span class="icon">🕐</span><span>${orario}</span></div>`
    : '';

  return `
    <div class="pharmacy-popup">
      <h3>${escapeHtml(nome)}</h3>
      <div class="popup-row"><span class="icon">📍</span><span>${escapeHtml(indirizzo)}</span></div>
      ${phoneRow}
      ${timeRow}
      ${distHtml}
    </div>`;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Render pharmacies on the map ─────────────────────────────────
function renderPharmacies(farmacie, refLat, refLon) {
  clusterGroup.clearLayers();
  currentEntries = [];

  farmacie.forEach(p => {
    const lat = parseFloat(p.lat);
    const lon = parseFloat(p.lon);
    if (!lat || !lon) return;

    const marker = L.marker([lat, lon], { icon: pharmacyIcon() });
    marker.bindPopup(buildPopupHtml(p, refLat, refLon), { maxWidth: 260 });
    clusterGroup.addLayer(marker);
    currentEntries.push({ marker, data: p, lat, lon });
  });

  updateCount(currentEntries.length);
}

// ── Find and highlight the nearest pharmacy ──────────────────────
function highlightNearest(refLat, refLon) {
  if (!currentEntries.length) return;

  // Reset all icons
  currentEntries.forEach(e => e.marker.setIcon(pharmacyIcon(false)));

  // Find nearest
  let best = null, bestDist = Infinity;
  currentEntries.forEach(e => {
    const d = haversine(refLat, refLon, e.lat, e.lon);
    if (d < bestDist) { bestDist = d; best = e; }
  });

  if (!best) return;

  // Update icon and popup with distance
  best.marker.setIcon(pharmacyIcon(true));
  best.marker.setPopupContent(buildPopupHtml(best.data, refLat, refLon));

  // Open popup — need to unspiderfy cluster first
  clusterGroup.zoomToShowLayer(best.marker, () => {
    best.marker.openPopup();
  });
}

// ── Status / count bar ───────────────────────────────────────────
function updateCount(n) {
  const el = document.getElementById('pharmacy-count');
  if (n === 0) {
    el.textContent = 'Nessuna farmacia trovata';
  } else {
    el.textContent = `${n} farmaci${n === 1 ? 'a' : 'e'} di turno`;
  }
}

// ── Loading overlay ──────────────────────────────────────────────
function setLoading(on) {
  document.getElementById('loading-overlay').classList.toggle('hidden', !on);
}

// ── No-data message ──────────────────────────────────────────────
function setNoData(visible, msg = '') {
  const el = document.getElementById('no-data-msg');
  if (visible) {
    el.innerHTML = msg;
    el.classList.add('visible');
  } else {
    el.classList.remove('visible');
  }
}

// ── Load available dates from index.json ─────────────────────────
async function loadIndex() {
  try {
    const res = await fetch(`${DATA_PATH}index.json?_=${Date.now()}`);
    if (!res.ok) throw new Error('no index');
    return await res.json();
  } catch {
    return null;
  }
}

// ── Load pharmacy data for a date string ────────────────────────
async function loadData(dateStr) {
  const filename = dateStr === 'sample'
    ? 'sample.json'
    : `farmacie-${dateStr}.json`;
  try {
    const res = await fetch(`${DATA_PATH}${filename}?_=${Date.now()}`);
    if (!res.ok) throw new Error('not found');
    return await res.json();
  } catch {
    return null;
  }
}

// ── Build day picker ─────────────────────────────────────────────
function buildDayPicker(dates) {
  const container = document.getElementById('day-picker');
  container.innerHTML = '';
  const todayStr = todayIso();

  dates.forEach(dateStr => {
    const btn = document.createElement('button');
    btn.className = 'day-btn';
    btn.dataset.date = dateStr;
    btn.textContent = formatDateLabel(dateStr, todayStr);
    btn.addEventListener('click', () => selectDate(dateStr));
    container.appendChild(btn);
  });
}

function formatDateLabel(dateStr, todayStr) {
  if (dateStr === 'sample') return 'Dati di esempio';

  const d = new Date(`${dateStr}T12:00:00`);
  const tomorrowStr = isoDate(addDays(new Date(todayStr + 'T12:00:00'), 1));

  const day   = d.getDate();
  const month = MONTH_SHORT[d.getMonth()];

  if (dateStr === todayStr)     return `Oggi — ${day} ${month}`;
  if (dateStr === tomorrowStr)  return `Domani — ${day} ${month}`;
  return `${DAY_SHORT[d.getDay()]} ${day} ${month}`;
}

// ── Select and display a date ────────────────────────────────────
async function selectDate(dateStr) {
  currentDate = dateStr;

  // Update button states
  document.querySelectorAll('.day-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.date === dateStr);
  });

  setLoading(true);
  setNoData(false);
  clusterGroup.clearLayers();
  currentEntries = [];
  updateCount(0);

  try {
    const payload = await loadData(dateStr);

    if (!payload || !Array.isArray(payload.farmacie) || payload.farmacie.length === 0) {
      setNoData(true, `
        <p><strong>Nessun dato disponibile</strong> per questa data.</p>
        <p>I dati vengono aggiornati automaticamente ogni giorno. Riprova domani.</p>
      `);
      return;
    }

    renderPharmacies(payload.farmacie, userLatLng?.lat, userLatLng?.lng);

    // If user location is known, highlight nearest
    if (userLatLng) {
      highlightNearest(userLatLng.lat, userLatLng.lng);
    }
  } catch (e) {
    console.error('Errore durante il caricamento della data', dateStr, e);
    setNoData(true, '<p><strong>Errore di rete.</strong> Ricarica la pagina.</p>');
  } finally {
    setLoading(false);
  }
}

// ── "Vicino a me" button ─────────────────────────────────────────
function handleNearMe() {
  if (!navigator.geolocation) {
    alert('Il tuo browser non supporta la geolocalizzazione.');
    return;
  }

  const btn = document.getElementById('near-me-btn');
  btn.textContent = 'Localizzazione…';
  btn.disabled = true;

  navigator.geolocation.getCurrentPosition(
    pos => {
      btn.textContent = 'Vicino a me';
      btn.disabled = false;

      const { latitude: lat, longitude: lng } = pos.coords;
      userLatLng = { lat, lng };

      // Place / move user marker
      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup('<b>La tua posizione</b>');

      map.setView([lat, lng], 14);

      // Re-render with distance and highlight nearest
      if (currentEntries.length > 0) {
        const farmacie = currentEntries.map(e => e.data);
        renderPharmacies(farmacie, lat, lng);
        highlightNearest(lat, lng);
      }
    },
    err => {
      btn.textContent = 'Vicino a me';
      btn.disabled = false;
      let msg = 'Impossibile ottenere la tua posizione.';
      if (err.code === 1) msg = 'Permesso negato. Controlla le impostazioni del browser.';
      alert(msg);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// ── Address search via Nominatim ─────────────────────────────────
async function handleSearch() {
  const query = document.getElementById('search-input').value.trim();
  if (!query) return;

  const btn = document.getElementById('search-btn');
  btn.textContent = '…';
  btn.disabled = true;

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Milano, Italia')}&format=json&limit=1&accept-language=it`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'it' } });
    const results = await res.json();

    if (!results.length) {
      alert('Indirizzo non trovato. Prova a essere più specifico (es. "Via Roma 10" o "Navigli").');
      return;
    }

    const { lat, lon, display_name } = results[0];
    const numLat = parseFloat(lat);
    const numLon = parseFloat(lon);

    // Place search pin
    if (searchMarker) map.removeLayer(searchMarker);
    searchMarker = L.marker([numLat, numLon], { icon: pinIcon })
      .addTo(map)
      .bindPopup(`<b>Posizione cercata:</b><br>${escapeHtml(display_name)}`)
      .openPopup();

    map.setView([numLat, numLon], 14);

    // Highlight nearest pharmacy
    if (currentEntries.length > 0) {
      const farmacie = currentEntries.map(e => e.data);
      renderPharmacies(farmacie, numLat, numLon);
      highlightNearest(numLat, numLon);
    }

  } catch (e) {
    alert('Errore durante la ricerca. Controlla la connessione e riprova.');
    console.error(e);
  } finally {
    btn.textContent = 'Cerca';
    btn.disabled = false;
  }
}

// ── Date helpers ─────────────────────────────────────────────────
function todayIso() {
  return isoDate(new Date());
}

function isoDate(d) {
  return d.toISOString().split('T')[0];
}

function addDays(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

// ── Bootstrap the app ────────────────────────────────────────────
async function init() {
  // Insert no-data message container (must exist before any setNoData call)
  const mapContainer = document.getElementById('map-container');
  const noDataEl = document.createElement('div');
  noDataEl.id = 'no-data-msg';
  mapContainer.appendChild(noDataEl);

  // Wire up buttons
  document.getElementById('near-me-btn').addEventListener('click', handleNearMe);
  document.getElementById('search-btn').addEventListener('click', handleSearch);
  document.getElementById('search-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSearch();
  });

  try {
    initMap();
  } catch (e) {
    console.error('Errore durante l\'inizializzazione della mappa:', e);
    setLoading(false);
    setNoData(true, '<p><strong>Errore:</strong> impossibile caricare la mappa. Ricarica la pagina.</p>');
    return;
  }

  setLoading(true);

  try {
    // Load index of available dates
    const index = await loadIndex();
    let dates = index?.dates ?? [];

    // Fallback to sample data if no real data exists yet
    if (!dates.length) {
      dates = ['sample'];
    }

    buildDayPicker(dates);

    // Auto-select the first (most recent) date
    if (dates.length) await selectDate(dates[0]);
  } catch (e) {
    console.error('Errore durante il caricamento dei dati:', e);
    setNoData(true, '<p><strong>Errore di rete.</strong> Ricarica la pagina.</p>');
  } finally {
    setLoading(false);
  }
}

init();
