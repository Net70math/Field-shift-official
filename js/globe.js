
(() => {
  const container = document.getElementById("worldGlobe");
  if (!container || typeof Globe !== "function") return;

  const countryTitle = document.getElementById("selectedCountry");
  const countryDetails = document.getElementById("countryDetails");
  const status = document.getElementById("globeStatus");

  const initialView = { lat: 9.03, lng: 38.74, altitude: 2.2 };
  let selectedFeature = null;
  let globe;

  function countryName(feature) {
    const p = feature.properties || {};
    return p.ADMIN || p.name || p.NAME || "Unknown country";
  }

  function safeText(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function getCenter(feature) {
    const geometry = feature.geometry;
    const points = [];

    function visitCoordinates(value) {
      if (!Array.isArray(value)) return;

      if (
        value.length >= 2 &&
        typeof value[0] === "number" &&
        typeof value[1] === "number"
      ) {
        points.push(value);
        return;
      }

      value.forEach(visitCoordinates);
    }

    visitCoordinates(geometry.coordinates);

    if (!points.length) return initialView;

    // Average points using circular longitude averaging to handle
    // countries that cross the international date line.
    let x = 0, y = 0, latSum = 0;

    points.forEach(([lng, lat]) => {
      const radians = lng * Math.PI / 180;
      x += Math.cos(radians);
      y += Math.sin(radians);
      latSum += lat;
    });

    return {
      lat: latSum / points.length,
      lng: Math.atan2(y, x) * 180 / Math.PI,
      altitude: 1.65
    };
  }

  function selectCountry(feature) {
    selectedFeature = feature;
    const name = countryName(feature);
    const view = getCenter(feature);

    countryTitle.textContent = name;
    countryDetails.textContent =
      "Selected on the interactive globe. Geographic center is approximate.";

    globe.polygonsTransitionDuration(300);
    globe.polygonCapColor(featureItem => {
      if (featureItem === selectedFeature) {
        return "rgba(185, 246, 106, 0.60)";
      }
      return "rgba(36, 115, 83, 0.20)";
    });

    globe.pointOfView(view, 1000);
  }

  globe = Globe()(container)
    .backgroundColor("rgba(0,0,0,0)")
    .globeImageUrl(
      "https://unpkg.com/three-globe/example/img/earth-dark.jpg"
    )
    .bumpImageUrl(
      "https://unpkg.com/three-globe/example/img/earth-topology.png"
    )
    .showAtmosphere(true)
    .atmosphereColor("#62c9a2")
    .atmosphereAltitude(0.16)
    .polygonAltitude(0.008)
    .polygonCapColor(() => "rgba(36, 115, 83, 0.20)")
    .polygonSideColor(() => "rgba(87, 180, 130, 0.12)")
    .polygonStrokeColor(() => "#80cfa0")
    .polygonLabel(feature => {
      const name = safeText(countryName(feature));
      return `<div style="padding:8px;background:#0b1915;color:#eff7f2;border:1px solid #365b48;border-radius:8px;font-family:sans-serif">
        <strong>${name}</strong><br>
        <span style="font-size:11px;color:#b9f66a">Click to select</span>
      </div>`;
    })
    .onPolygonClick(selectCountry);

  globe.pointOfView(initialView, 0);
  globe.controls().autoRotate = true;
  globe.controls().autoRotateSpeed = 0.30;
  globe.controls().enableDamping = true;

  function resizeGlobe() {
    globe.width(container.clientWidth);
    globe.height(container.clientHeight);
  }

  resizeGlobe();

  if ("ResizeObserver" in window) {
    new ResizeObserver(resizeGlobe).observe(container);
  } else {
    window.addEventListener("resize", resizeGlobe);
  }

  const countriesUrl =
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";

  fetch(countriesUrl)
    .then(response => {
      if (!response.ok) throw new Error("Could not download country boundaries");
      return response.json();
    })
    .then(data => {
      const countries = data.features.filter(feature =>
        countryName(feature) !== "Antarctica"
      );

      // Some country boundary datasets include a label point.
      // Use it when available; otherwise use an approximate center.
      const labels = countries.map(feature => {
        const center = getCenter(feature);
        return {
          text: countryName(feature),
          lat: center.lat,
          lng: center.lng,
          feature
        };
      });

      globe
        .polygonsData(countries)
        .labelsData(labels)
        .labelText(item => item.text)
        .labelLat(item => item.lat)
        .labelLng(item => item.lng)
        .labelSize(0.38)
        .labelDotRadius(0.08)
        .labelAltitude(0.018)
        .labelColor(() => "#f1f7f1")
        .labelResolution(2)
        .labelIncludeDot(true)
        .labelLabel(item =>
          `<div style="padding:5px;background:#0b1915;color:#eff7f2;border-radius:5px">${safeText(item.text)}</div>`
        );

      const ethiopia = countries.find(feature => {
        const name = countryName(feature).toLowerCase();
        return name === "ethiopia";
      });

      if (ethiopia) {
        selectCountry(ethiopia);
      }

      if (status) status.textContent =
        `${countries.length} country boundaries loaded · Drag to rotate`;
    })
    .catch(error => {
      console.error("Globe country data error:", error);
      if (status) status.textContent =
        "Country boundaries could not load. Check your internet connection.";
    });

  // Expose a search helper for the landing page.
  window.fieldShiftGlobeSearch = function (query) {
    if (!query || !globe) return false;

    const wanted = query.trim().toLowerCase();
    const country = globe.polygonsData().find(feature => {
      const p = feature.properties || {};
      return [p.ADMIN, p.name, p.NAME, p.ISO_A3, p.ADM0_A3]
        .some(value => String(value || "").toLowerCase() === wanted);
    });

    if (!country) return false;

    selectCountry(country);
    return true;
  };
})();
