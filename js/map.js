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
  const placeDetails = document.getElementById("placeDetails");
  const latitude = document.getElementById("latitude");
  const longitude = document.getElementById("longitude");
  const searchInput = document.getElementById("countrySearch");
  const searchButton = document.getElementById("searchCountry");
  const suggestionsElement = document.getElementById("locationSuggestions");
  const searchStatus = document.getElementById("searchStatus");
  const locateButton = document.getElementById("locateMe");
  const locationStatus = document.getElementById("locationStatus");
  const copyButton = document.getElementById("copyCoords");

  let selectedMarker = null;
  let selectedBoundary = null;
  let selectedCountryLayer = null;
  let countryGeoJsonLayer = null;
  let geocodingController = null;
  let lastGeocodingRequest = 0;
  const geocodingCache = new Map();

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

  function hideSuggestions() {
    if (!suggestionsElement) return;
    suggestionsElement.hidden = true;
    suggestionsElement.replaceChildren();
    if (searchInput) searchInput.setAttribute("aria-expanded", "false");
  }

  function selectLocation(
    lat,
    lng,
    name,
    accuracy,
    details = "Selected geographic position",
    zoom = Math.max(map.getZoom(), 11),
    countryLayer = null
  ) {
    if (selectedCountryLayer && selectedCountryLayer !== countryLayer && countryGeoJsonLayer) {
      countryGeoJsonLayer.resetStyle(selectedCountryLayer);
      selectedCountryLayer.getElement()?.classList.remove("country-boundary-selected");
    }
    selectedCountryLayer = countryLayer;
    clearSelection();
    showCoordinates(lat, lng, name);
    map.flyTo([lat, lng], zoom, {
      animate: true,
      duration: 1.2
    });
    if (placeDetails) placeDetails.textContent = details;

    if (Number.isFinite(accuracy)) {
      selectedBoundary = L.circle([lat, lng], {
        radius: accuracy,
        color: "#b9f66a",
        fillColor: "#b9f66a",
        fillOpacity: 0.12,
        weight: 1
      }).addTo(map);
    }

    const popupContent = document.createElement("span");
    popupContent.textContent = name;
    selectedMarker = L.marker([lat, lng])
      .addTo(map)
      .bindPopup(popupContent)
      .openPopup();

    fetchNasaPowerData(lat, lng);
  }

  async function searchLocations() {
    const query = searchInput?.value.trim();
    if (!searchInput || !searchButton || !suggestionsElement || !searchStatus) return;
    if (!query) {
      hideSuggestions();
      searchStatus.textContent = "Enter a city, town, village, or other place to search.";
      searchInput.focus();
      return;
    }

    if (geocodingController) geocodingController.abort();
    const controller = new AbortController();
    geocodingController = controller;
    searchButton.disabled = true;
    hideSuggestions();
    searchStatus.textContent = "Searching for places...";

    try {
      const cacheKey = query.toLocaleLowerCase();
      let results = geocodingCache.get(cacheKey);
      if (!results) {
        const waitMs = Math.max(0, 1000 - (Date.now() - lastGeocodingRequest));
        if (waitMs) {
          await new Promise(resolve => setTimeout(resolve, waitMs));
        }
        if (controller.signal.aborted) return;

        lastGeocodingRequest = Date.now();
        const params = new URLSearchParams({
          q: query,
          format: "jsonv2",
          addressdetails: "1",
          limit: "5"
        });
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?${params.toString()}`,
          { headers: { Accept: "application/json" }, signal: controller.signal }
        );
        if (!response.ok) throw new Error(`Geocoder returned HTTP ${response.status}`);

        results = await response.json();
        if (!Array.isArray(results)) throw new Error("Geocoder returned an invalid response");
        geocodingCache.set(cacheKey, results);
      }
      if (controller.signal.aborted) return;
      if (!results.length) {
        searchStatus.textContent = `No places found for "${query}". Try a different name.`;
        return;
      }

      results.forEach(result => {
        const lat = Number(result.lat);
        const lng = Number(result.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          return;
        }

        const option = document.createElement("button");
        option.type = "button";
        option.className = "location-suggestion";
        option.setAttribute("role", "option");
        option.textContent = result.display_name;
        option.addEventListener("click", () => {
          const name = result.name || result.display_name;
          searchInput.value = result.display_name;
          hideSuggestions();
          searchStatus.textContent = `Selected ${result.display_name}.`;
          if (locationStatus) locationStatus.textContent = "";
          selectLocation(lat, lng, name, undefined, "Search result");
        });
        suggestionsElement.append(option);
      });

      if (!suggestionsElement.childElementCount) {
        searchStatus.textContent = "The search service returned no usable locations. Try another search.";
        return;
      }

      suggestionsElement.hidden = false;
      searchInput.setAttribute("aria-expanded", "true");
      searchStatus.textContent = `${suggestionsElement.childElementCount} places found. Choose a suggestion to select it.`;
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("Location search error:", error);
      searchStatus.textContent = "Location search is temporarily unavailable. Please try again.";
    } finally {
      if (geocodingController === controller) {
        geocodingController = null;
        searchButton.disabled = false;
      }
    }
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

  function countryName(feature) {
    const properties = feature.properties || {};
    return properties.ADMIN || properties.NAME_EN || properties.NAME || "Unknown country";
  }

  function countrySummary(feature) {
    const properties = feature.properties || {};
    return [
      properties.CONTINENT,
      properties.SUBREGION,
      properties.ISO_A3 && properties.ISO_A3 !== "-99" ? `ISO ${properties.ISO_A3}` : null
    ].filter(Boolean).join(" · ") || "Country selected";
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  async function loadCountryBoundaries() {
    if (mapElement.dataset.countryBorders !== "true") return;

    const status = document.getElementById("countryLayerStatus");
    const source =
      "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";

    try {
      const response = await fetch(source);
      if (!response.ok) throw new Error(`Country data returned HTTP ${response.status}`);

      const data = await response.json();
      if (!Array.isArray(data.features)) throw new Error("Country data has no feature collection");

      const countries = data.features.filter(feature =>
        countryName(feature) !== "Antarctica"
      );
      const baseStyle = {
        color: "#b9f66a",
        weight: 1.2,
        opacity: 0.88,
        fillColor: "#0b2018",
        fillOpacity: 0.08,
        bubblingMouseEvents: false,
        className: "country-boundary"
      };
      const selectedStyle = {
        color: "#e5ffc0",
        weight: 2,
        opacity: 1,
        fillColor: "#b9f66a",
        fillOpacity: 0.32
      };
      const hoverStyle = {
        color: "#e5ffc0",
        weight: 1.8,
        opacity: 1,
        fillColor: "#b9f66a",
        fillOpacity: 0.2,
        className: "country-boundary"
      };

      countryGeoJsonLayer = L.geoJSON(countries, {
        style: baseStyle,
        onEachFeature(feature, layer) {
          layer.on({
            mouseover() {
              if (layer !== selectedCountryLayer) layer.setStyle(hoverStyle);
            },
            mouseout() {
              if (layer !== selectedCountryLayer) countryGeoJsonLayer.resetStyle(layer);
            },
            click(event) {
              L.DomEvent.stopPropagation(event.originalEvent);
              if (selectedCountryLayer && selectedCountryLayer !== layer) {
                countryGeoJsonLayer.resetStyle(selectedCountryLayer);
                selectedCountryLayer.getElement()?.classList.remove("country-boundary-selected");
              }
              selectedCountryLayer = layer;
              selectedCountryLayer.setStyle(selectedStyle);
              selectedCountryLayer.getElement()?.classList.add("country-boundary-selected");
              selectedCountryLayer.bringToFront();

              const { lat, lng } = event.latlng;
              selectLocation(
                lat,
                lng,
                countryName(feature),
                undefined,
                countrySummary(feature),
                Math.max(map.getZoom(), 6),
                layer
              );
            }
          });
        }
      }).addTo(map);

      map.attributionControl.addAttribution("Country boundaries © Natural Earth");

      const labels = countries.map(feature => {
        const properties = feature.properties || {};
        const lat = Number(properties.LABEL_Y);
        const lng = Number(properties.LABEL_X);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        return {
          name: countryName(feature),
          lat,
          lng,
          rank: Number(properties.LABELRANK) || 99,
          minZoom: Number(properties.MIN_LABEL) || 0
        };
      }).filter(Boolean);
      const labelLayer = L.layerGroup().addTo(map);

      function updateCountryLabels() {
        const zoom = map.getZoom();
        const isMobile = window.matchMedia("(max-width: 560px)").matches;
        const minimumGap = isMobile ? 42 : 58;
        const bounds = map.getBounds().pad(0.2);
        const centerLongitude = map.getCenter().lng;
        const placed = [];
        const visible = labels
          .filter(label => zoom >= label.minZoom)
          .map(label => ({
            ...label,
            longitude: label.lng + 360 * Math.round((centerLongitude - label.lng) / 360)
          }))
          .filter(label => bounds.contains([label.lat, label.longitude]))
          .sort((a, b) => a.rank - b.rank);

        visible.forEach(label => {
          const point = map.latLngToContainerPoint([label.lat, label.longitude]);
          const gap = Math.max(
            minimumGap,
            Math.min(isMobile ? 82 : 112, label.name.length * (isMobile ? 4 : 5))
          );
          if (placed.some(item => point.distanceTo(item.point) < Math.max(gap, item.gap))) return;
          placed.push({ point, gap });

          labelLayer.addLayer(L.marker([label.lat, label.longitude], {
            icon: L.divIcon({
              className: "country-label-marker",
              html: `<span class="country-label">${escapeHtml(label.name)}</span>`,
              iconSize: [1, 1],
              iconAnchor: [0, 0]
            }),
            interactive: false,
            keyboard: false
          }));
        });
      }

      function refreshCountryLabels() {
        labelLayer.clearLayers();
        updateCountryLabels();
      }

      map.on("zoomend moveend resize", refreshCountryLabels);
      updateCountryLabels();

      const initialCountry = countries.find(feature =>
        countryName(feature).toLowerCase() === placeName?.textContent.toLowerCase()
      );
      if (initialCountry) {
        selectedCountryLayer = countryGeoJsonLayer.getLayers().find(layer =>
          layer.feature === initialCountry
        );
        if (selectedCountryLayer) {
          selectedCountryLayer.setStyle(selectedStyle);
          selectedCountryLayer.getElement()?.classList.add("country-boundary-selected");
        }
        if (placeDetails) placeDetails.textContent = countrySummary(initialCountry);
      }

      if (status) {
        status.textContent = `${countries.length} country borders loaded · labels adjust with zoom.`;
      }
    } catch (error) {
      console.error("Country boundaries error:", error);
      if (status) status.textContent = "Country borders could not load. Check your internet connection.";
    }
  }

  // MASTER CLICK EVENT
  map.on("click", event => {
    const { lat, lng } = event.latlng;
    selectLocation(lat, lng, "Selected map point", undefined, "Selected map point");
  });

  if (searchButton) searchButton.addEventListener("click", searchLocations);
  if (searchInput) {
    searchInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        searchLocations();
      } else if (event.key === "Escape") {
        hideSuggestions();
      }
    });
    searchInput.addEventListener("input", () => {
      if (geocodingController) geocodingController.abort();
      hideSuggestions();
      if (searchStatus) searchStatus.textContent = "";
    });
  }

  if (locateButton) {
    locateButton.addEventListener("click", () => {
      if (!locationStatus) return;
      if (!navigator.geolocation) {
        locationStatus.textContent = "Your browser does not support location services.";
        return;
      }

      locateButton.disabled = true;
      locationStatus.textContent = "Waiting for your device location...";
      navigator.geolocation.getCurrentPosition(
        position => {
          const { latitude: lat, longitude: lng, accuracy } = position.coords;
          selectLocation(
            lat,
            lng,
            "My location",
            accuracy,
            `Device location · accuracy within ${Math.round(accuracy)} m`
          );
          locationStatus.textContent = `Your location is selected (accuracy within ${Math.round(accuracy)} m).`;
          locateButton.disabled = false;
        },
        error => {
          const messages = {
            1: "Location permission was denied. Allow location access in your browser settings and try again.",
            2: "Your location is unavailable right now. Check your device's location services and try again.",
            3: "Finding your location timed out. Please try again."
          };
          locationStatus.textContent = messages[error.code] || "Your location could not be determined. Please try again.";
          locateButton.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }

  loadCountryBoundaries();
  window.fieldShiftMap = map;
})();