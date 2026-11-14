

const dashboardData = {
    current: {
        temperature: "28°C",
        rainfall: "42 mm",
        soilMoisture: "38%",
        vegetation: "Healthy",
        temperatureNote: "Illustrative current estimate",
        rainfallNote: "Illustrative rainfall estimate",
        moistureNote: "Illustrative soil moisture",
        vegetationNote: "Illustrative vegetation status"
    }
};

const temperatureValue = document.getElementById("temperatureValue");
const rainfallValue = document.getElementById("rainfallValue");
const moistureValue = document.getElementById("moistureValue");
const vegetationValue = document.getElementById("vegetationValue");

const temperatureNote = document.getElementById("temperatureNote");
const rainfallNote = document.getElementById("rainfallNote");
const moistureNote = document.getElementById("moistureNote");
const vegetationNote = document.getElementById("vegetationNote");

function renderDashboard(mode) {
    const data = dashboardData[mode];
    if (!data) return;

    if (temperatureValue) temperatureValue.textContent = data.temperature;
    if (rainfallValue) rainfallValue.textContent = data.rainfall;
    if (moistureValue) moistureValue.textContent = data.soilMoisture;
    if (vegetationValue) vegetationValue.textContent = data.vegetation;

    if (temperatureNote) temperatureNote.textContent = data.temperatureNote;
    if (rainfallNote) rainfallNote.textContent = data.rainfallNote;
    if (moistureNote) moistureNote.textContent = data.moistureNote;
    if (vegetationNote) vegetationNote.textContent = data.vegetationNote;
}

// Initialize the cards with current data
renderDashboard("current");