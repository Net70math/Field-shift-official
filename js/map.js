(() => {
  const mapElement = document.getElementById("fieldMap");
  if (!mapElement || typeof L === "undefined") return;

  if (mapElement.dataset.mapReady === "true") return;
  mapElement.dataset.mapReady = "true";

  const map = L.map(mapElement, {
    zoomControl: false,
    worldCopyJump: true
  }).setView([9.03, 38.74], 6);

  L.control.zoom({ position: "bottomright" }).addTo(map);

  const satellite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, attribution: "Tiles © Esri" }
  ).addTo(map);

  const street = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { maxZoom: 19, attribution: "© OpenStreetMap contributors" }
  );

  L.control.layers(
    { "Satellite imagery": satellite, "Street map": street },
    {},
    { position: "topright" }
  ).addTo(map);

  const placeName = document.getElementById("placeName");
  const latitude = document.getElementById("latitude");
  const longitude = document.getElementById("longitude");
  const searchInput = document.getElementById("countrySearch");
  const searchButton = document.getElementById("searchCountry");
  const locateButton = document.getElementById("locateMe");
  const copyButton = document.getElementById("copyCoords");

  let selectedMarker = null;
  let selectedBoundary = null;

  function showCoordinates(lat, lng, name = "Selected location") {
    if (placeName) placeName.textContent = name;
    if (latitude) latitude.textContent = Number(lat).toFixed(5) + "°";
    if (longitude) longitude.textContent = Number(lng).toFixed(5) + "°";
  }

  function clearSelection() {
    if (selectedMarker) map.removeLayer(selectedMarker);
    if (selectedBoundary) map.removeLayer(selectedBoundary);
    selectedMarker = null;
    selectedBoundary = null;
  }

  function selectLocation(lat, lng, name) {
    clearSelection();
    showCoordinates(lat, lng, name);
    map.flyTo([lat, lng], Math.max(map.getZoom(), 11), {
      animate: true,
      duration: 1.2
    });

    selectedMarker = L.marker([lat, lng])
      .addTo(map)
      .bindPopup(`<strong>${name}</strong>`)
      .openPopup();
  }

  // NASA POWER DATA ENGINE
  async function fetchNasaPowerData(lat, lng) {
    const statusEl = document.getElementById('nasa-status');
    const precipEl = document.getElementById('nasa-precip');
    const tempEl = document.getElementById('nasa-temp');

    if (statusEl) statusEl.textContent = "Fetching live telemetry from NASA servers...";

    try {
      // Offset dates to account for NASA's 3-day satellite processing delay
      const today = new Date();
      const endDate = new Date(today.getTime() - (3 * 24 * 60 * 60 * 1000));
      const startDate = new Date(today.getTime() - (10 * 24 * 60 * 60 * 1000));

      const end = endDate.toISOString().slice(0, 10).replace(/-/g, '');
      const start = startDate.toISOString().slice(0, 10).replace(/-/g, '');

      const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR,T2M&community=AG&longitude=${lng}&latitude=${lat}&start=${start}&end=${end}&format=JSON`;

      const response = await fetch(url);
      const data = await response.json();

      const precipData = Object.values(data.properties.parameter.PRECTOTCORR);
      const tempData = Object.values(data.properties.parameter.T2M);

      const totalPrecip = precipData.reduce((a, b) => a + (b > 0 ? b : 0), 0).toFixed(1);
      const avgTemp = (tempData.reduce((a, b) => a + b, 0) / tempData.length).toFixed(1);

      if (statusEl) statusEl.textContent = `Live data loaded for ${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
      if (precipEl) precipEl.textContent = `${totalPrecip} mm`;
      if (tempEl) tempEl.textContent = `${avgTemp} °C`;

    } catch (error) {
      console.error("NASA API Error:", error);
      if (statusEl) statusEl.textContent = "NASA satellite data temporarily unavailable.";
    }
  }

  // MASTER CLICK EVENT
  map.on("click", event => {
    const { lat, lng } = event.latlng;
    selectLocation(lat, lng, "Selected map point");
    fetchNasaPowerData(lat, lng);
  });

  window.fieldShiftMap = map;
})();