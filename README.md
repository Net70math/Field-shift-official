# 🌍 Field Shift
**Earth Intelligence for Agriculture | NASA Space Apps Challenge 2026**  
*Built by **The Originals** — "Humanity's Origin. Space's Future."*

---

## 📖 Overview
**Field Shift** is an agricultural intelligence and climate-monitoring web platform designed to bridge the gap between raw Earth observation satellite telemetry and actionable farm-level decisions. Centered on agricultural regions in Ethiopia (including Adama and Addis Ababa), Field Shift empowers farmers, planners, and researchers to inspect terrain via satellite imagery, track live meteorological indicators, simulate multi-year crop rotations, and generate AI-driven agronomic insights.

---

## ✨ Key Platform Features

* **🛰️ Live NASA POWER Telemetry Engine:** Automatically queries the NASA Prediction Of Worldwide Energy Resources (POWER) Agroclimatology API (`PRECTOTCORR` and `T2M` parameters) using a calibrated 3-day satellite processing offset to calculate 7-day cumulative rainfall (mm) and average air temperature (°C).
* **🗺️ Interactive Satellite Explore Map (`explore.html`):** Built on Leaflet.js with high-resolution Esri World Imagery and OpenStreetMap layers. Clicking any coordinate on the globe dynamically updates the Location Inspector and fetches live point-specific climate data from NASA servers.
* **📊 Real-Time Workspace Dashboard (`dashboard.html`):** Displays live regional climate metrics alongside soil moisture and vegetation health indicators, paired with a 3-step interactive **Crop Rotation Planner, Sequence Simulator, and Strategy Comparison Engine**.
* **⚛️ Smart Analysis & Fshift AI (`smart-analysis.html`):** Integrates Google Gemini AI (`fshift-ai.js`) to synthesize environmental telemetry and field profiles into tailored agricultural recommendations.
* **🌱 Agriculture Intelligence & Earth Data (`agriculture.html`, `earth-data.html`, `methodology.html`):** Dedicated workspaces for inspecting agro-ecological indicators, 3D/globe visualizations, and transparent scoring methodology.

---

## 🛠️ Tech Stack & Architecture

* **Frontend:** HTML5, CSS3 (`css/style.css`), Vanilla JavaScript (ES6+)
* **Mapping & Geospatial:** Leaflet.js, Esri ArcGIS World Imagery, OpenStreetMap
* **Earth Observation Data:** NASA POWER API (Agroclimatology Community Daily Point API)
* **AI Integration:** Google Gemini API (`Fshift AI` with client-side `localStorage` key isolation)
* **Core Modules:**
  * `js/map.js` — Interactive Leaflet controller & live NASA point-telemetry fetcher
  * `js/fshift-ai.js` — Gemini AI assistant & secure browser-memory API key manager
  * `js/planner.js` & `js/metrics.js` — Multi-year crop rotation simulator & rule-based agronomic scoring
  * `js/globe.js` & `js/scanner.js` — Earth visualization and environmental scanning utilities
  * `js/storage.js` & `js/navigation.js` — Local state persistence and responsive workspace routing

---

## 🚀 Getting Started & Judge Testing Guide

### 1. Clone the Repository
### 2. Launch with a Local Server
Because Field Shift executes live asynchronous `fetch()` requests to NASA servers and renders Esri map tiles, run the project through a local HTTP server rather than opening the HTML files via `file://`:
* **VS Code:** Right-click `index.html` or `dashboard.html` and select **Open with Live Server**.
* **Python CLI:** Run `python3 -m http.server 5500` and open `http://localhost:5500/dashboard.html`.

### 3. Activating Fshift AI (Zero-Leak API Security)
To protect credentials in a public repository, no API keys are hardcoded in the source files:
1. Navigate to the **Smart Analysis** page.
2. A browser prompt will ask for a **Google Gemini API Key**.
3. Paste your key into the prompt. It is saved exclusively in your local browser memory (`localStorage`) under `FSHIFT_GEMINI_KEY` and is never transmitted to GitHub.
4. To swap or clear the key at any time, run `resetGeminiKey()` in the browser console.

---

## 👥 Team: The Originals

All project modules were merged and deployed through a centralized repository workflow by:

| Team Member | GitHub Handle | Role & Contributions |
| :--- | :--- | :--- |
| **Natnael Walelign** | [@Net70math](https://github.com/Net70math) | Project Lead & Lead Developer |
| **Fiker Derese** | [@fikir-dev](https://github.com/fikir-dev) | Frontend Developer & UI/UX ☠️|
| **Feven Dereje** | [@Feven-tec](https://github.com/Feven-tec) | Frontend Developer & UI/UX |
| **Eden Sewareg** | [@ESA2008](https://github.com/ESA2008) | Frontend Developer & UI/UX |
| **Michael Melkamu** | [@arsmikister](https://github.com/arsmikister) | Agricultural Planner & Developer |
| **Elias Teku** | [@eliasteku](https://github.com/eliasteku) | Backend Developer & API Integration |

---

## 📄 Data Transparency & Attribution
* **Satellite Basemaps:** Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community. Street data © OpenStreetMap contributors.
* **Climate Telemetry:** Meteorological data obtained from the NASA Langley Research Center (LaRC) POWER Project funded through the NASA Earth Science/Applied Science Program.
