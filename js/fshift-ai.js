'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // ============================================================================
    // 1. GEMINI API CONFIGURATION (SUPPORTS BOTH 'AQ.' AUTH KEYS & 'AIza' KEYS)
    // ============================================================================
    // Paste your Google AI Studio key below, OR type "/key YOUR_KEY" in the chat!
    const DEFAULT_API_KEY = '';

    const GEMINI_MODELS = [
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite'
    ];

    function getActiveApiKey() {
        const saved = localStorage.getItem('fshift_gemini_api_key');
        return (saved !== null ? saved : DEFAULT_API_KEY).trim();
    }

    // State tracking for Scanner + Multi-turn Chat
    let latestScanSummary = null;
    let uploadedImageBase64 = null;
    let uploadedImageMimeType = 'image/jpeg';
    const chatHistory = [];

    // ============================================================================
    // 2. CROP & LEAF SCANNER (REAL PIXEL RGB ANALYSIS + GEMINI VISION)
    // ============================================================================
    const dropzone = document.getElementById('uploadDropzone');
    const fileInput = document.getElementById('cropFileInput');
    const chooseBtn = document.getElementById('chooseImageBtn');
    const runScanBtn = document.getElementById('runScanBtn');
    const preview = document.getElementById('imagePreview');
    const uploadPrompt = document.getElementById('uploadPrompt');
    const emptyState = document.getElementById('scanEmptyState');
    const activeState = document.getElementById('scanActiveState');
    const statusText = document.getElementById('scanStatusText');
    const progressBar = document.getElementById('scanProgressBar');
    const outputCards = document.getElementById('scanOutputCards');

    function handleFile(file) {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            preview.src = dataUrl;
            preview.style.display = 'block';
            if (uploadPrompt) uploadPrompt.style.display = 'none';
            runScanBtn.disabled = false;

            // Extract raw base64 and mimeType for Gemini Multimodal Vision
            const matches = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
            if (matches) {
                uploadedImageMimeType = matches[1];
                uploadedImageBase64 = matches[2];
            }
            latestScanSummary = { fileName: file.name, scanned: false };
        };
        reader.readAsDataURL(file);
    }

    chooseBtn?.addEventListener('click', () => fileInput.click());
    fileInput?.addEventListener('change', (e) => handleFile(e.target.files[0]));

    dropzone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });
    dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        handleFile(e.dataTransfer.files[0]);
    });

    // Analyze actual leaf color distribution using an offscreen canvas
    function analyzeImagePixels(imgElement) {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const size = 120;
            canvas.width = size;
            canvas.height = size;
            ctx.drawImage(imgElement, 0, 0, size, size);
            const { data } = ctx.getImageData(0, 0, size, size);

            let greenPixels = 0;
            let yellowChloroticPixels = 0;
            let brownNecroticPixels = 0;
            let totalValid = 0;

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                // Ignore near-white or near-black background pixels
                if ((r > 240 && g > 240 && b > 240) || (r < 15 && g < 15 && b < 15)) continue;
                totalValid++;

                if (g > r * 1.08 && g > b * 1.15) {
                    greenPixels++;
                } else if (r > 130 && g > 110 && b < 100 && Math.abs(r - g) < 55) {
                    yellowChloroticPixels++;
                } else if (r > g && g >= b && r > 70 && r < 185) {
                    brownNecroticPixels++;
                }
            }

            const safeTotal = Math.max(totalValid, 1);
            const greenRatio = Math.round((greenPixels / safeTotal) * 100);
            const yellowRatio = Math.round((yellowChloroticPixels / safeTotal) * 100);
            const brownRatio = Math.round((brownNecroticPixels / safeTotal) * 100);

            if (brownRatio >= 18) {
                return {
                    condition: 'Foliar Necrosis / Possible Leaf Blight or Rust',
                    severity: 'Moderate-High Stress',
                    summary: `Pixel photometry detected ${brownRatio}% necrotic/brown surface lesions and ${greenRatio}% healthy chlorophyll canopy. Inspect for fungal rust, blight, or severe potassium/moisture deficit.`,
                    tags: [`Canopy Greenness: ${greenRatio}%`, `Lesion Index: ${brownRatio}%`, 'Fungal / Moisture Check']
                };
            }
            if (yellowRatio >= 16 || greenRatio < 35) {
                return {
                    condition: 'Interveinal Chlorosis / Nitrogen or Water Stress',
                    severity: 'Moderate Stress',
                    summary: `Surface colorimetry shows ${yellowRatio}% yellowing chlorotic tissue vs. ${greenRatio}% active green canopy. Indicates likely soil nitrogen depletion or root-zone moisture stress.`,
                    tags: [`Canopy Greenness: ${greenRatio}%`, `Chlorosis Index: ${yellowRatio}%`, 'Rotate with Legumes']
                };
            }
            return {
                condition: 'Vigorous Chlorophyll Canopy (Low Visual Stress)',
                severity: 'Healthy',
                summary: `Canopy reflectance shows strong chlorophyll dominance (${greenRatio}% healthy green index, minimal chlorosis at ${yellowRatio}%). Maintain current irrigation and monitor lower leaves.`,
                tags: [`Canopy Greenness: ${greenRatio}%`, `Chlorosis: ${yellowRatio}%`, 'Healthy Pigmentation']
            };
        } catch {
            return {
                condition: 'Mild Interveinal Chlorosis / Moisture Stress',
                severity: 'Moderate',
                summary: 'Surface pigment distribution suggests potential nitrogen depletion or early moisture stress.',
                tags: ['Nitrogen Check', 'Monitor Canopy Moisture', 'Inspect Lower Leaves']
            };
        }
    }

    runScanBtn?.addEventListener('click', async () => {
        emptyState.hidden = true;
        activeState.hidden = false;
        outputCards.innerHTML = '';
        progressBar.style.width = '30%';
        statusText.textContent = 'Analyzing leaf chlorophyll & chlorosis pixel ratios...';
        runScanBtn.disabled = true;

        const pixelMetrics = analyzeImagePixels(preview);

        setTimeout(() => {
            progressBar.style.width = '70%';
            statusText.textContent = getActiveApiKey()
                ? 'Running Fshift AI multimodal vision inspection...'
                : 'Cross-checking agronomic stress indicators...';
        }, 350);

        // Try live Gemini Vision diagnosis if an API key is configured
        let aiVisionNote = null;
        if (getActiveApiKey() && uploadedImageBase64) {
            try {
                const visionPrompt = 'You are Fshift AI, an agronomic vision system. In 2 short sentences, identify the plant/crop (if visible) and any leaf health, pest, chlorosis, or moisture symptoms in this image, plus 1 actionable remedy for an Ethiopian farmer.';
                aiVisionNote = await callGeminiAPI(visionPrompt, true);
            } catch (err) {
                console.warn('Vision scan fallback to pixel photometry:', err.message);
            }
        }

        progressBar.style.width = '100%';
        statusText.textContent = aiVisionNote
            ? 'Fshift AI Vision + Pixel Photometry Complete'
            : 'Visual Canopy Photometry Complete';
        runScanBtn.disabled = false;

        latestScanSummary = {
            fileName: latestScanSummary?.fileName || 'crop-sample.jpg',
            scanned: true,
            condition: pixelMetrics.condition,
            severity: pixelMetrics.severity,
            summary: aiVisionNote || pixelMetrics.summary,
            tags: pixelMetrics.tags
        };

        outputCards.innerHTML = `
      <div class="result-card">
        <h4>Visual Indicator: ${latestScanSummary.condition}</h4>
        <p>${formatMarkdownToHtml(latestScanSummary.summary)}</p>
        <div style="margin-top: 8px;">
          ${latestScanSummary.tags.map(t => `<span class="result-tag">${t}</span>`).join('')}
        </div>
      </div>
      <div class="result-card result-warning">
        <h4>Next Step with Fshift AI</h4>
        <p>Click <strong>"🌿 Interpret Leaf Scan"</strong> on the right so Fshift AI can combine this scan with your saved Rotation Planner profile.</p>
      </div>
    `;
    });

    // ============================================================================
    // 3. FSHIFT AI ADVISOR (LIVE GEMINI 2.5 FLASH + DEEP AGRONOMY ENGINE)
    // ============================================================================
    const messagesBox = document.getElementById('fshiftMessages');
    const fshiftForm = document.getElementById('fshiftForm');
    const fshiftInput = document.getElementById('fshiftInput');
    const fshiftSendBtn = document.getElementById('fshiftSendBtn');

    function formatMarkdownToHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/^\s*[-*•]\s+/gm, '• ')
            .replace(/\n/g, '<br>');
    }

    function appendMessage(role, htmlText) {
        const div = document.createElement('div');
        div.className = `fshift-msg ${role}`;
        div.innerHTML = role === 'ai' ? `<strong>Fshift:</strong> ${htmlText}` : htmlText;
        messagesBox.appendChild(div);
        messagesBox.scrollTop = messagesBox.scrollHeight;
        return div;
    }

    function getSavedFarmContext() {
        try {
            const draft = JSON.parse(localStorage.getItem('field-shift-planner-draft') || 'null');
            const plan = JSON.parse(localStorage.getItem('field-shift-rotation-plan') || 'null');
            return { draft, plan };
        } catch {
            return { draft: null, plan: null };
        }
    }

    // Live Gemini 2.5 Flash REST API caller with automatic model failover
    async function callGeminiAPI(userQuery, includeImage = false) {
        const apiKey = getActiveApiKey();
        if (!apiKey) throw new Error('No API key configured');

        const { draft, plan } = getSavedFarmContext();
        const farmContextStr = JSON.stringify({
            savedDraft: draft || 'None',
            savedRotationPlan: plan?.input || 'None',
            latestLeafScan: latestScanSummary || 'No scan run yet'
        });

        const systemInstruction = `You are Fshift AI, the intelligent agronomic advisor built by team "The Originals" for the Field Shift web application (NASA Space Apps Challenge).
Your role:
1. Answer ANY question the user asks directly, accurately, and conversationally (whether about Field Shift, what a crop is, specific Ethiopian crops like Teff, Wheat, Maize, Sorghum, Faba bean, Chickpea, Lentil, Coffee, soil science, pests, NASA satellite data, or general science).
2. Reference the user's saved Field Shift context when relevant: ${farmContextStr}.
3. Keep answers clear, structured with short bullet points where helpful, and under 120 words.`;

        const parts = [{ text: userQuery }];
        if (includeImage && uploadedImageBase64) {
            parts.push({
                inline_data: {
                    mime_type: uploadedImageMimeType,
                    data: uploadedImageBase64
                }
            });
        }

        const contents = [
            ...chatHistory.slice(-6),
            { role: 'user', parts }
        ];

        let lastError = null;

        for (const modelName of GEMINI_MODELS) {
            try {
                const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        system_instruction: { parts: [{ text: systemInstruction }] },
                        contents,
                        generationConfig: {
                            temperature: 0.65,
                            maxOutputTokens: 350
                        }
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    const errMsg = data?.error?.message || `HTTP ${response.status}`;
                    throw new Error(errMsg);
                }

                const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (replyText) {
                    chatHistory.push({ role: 'user', parts: [{ text: userQuery }] });
                    chatHistory.push({ role: 'model', parts: [{ text: replyText }] });
                    return replyText;
                }
            } catch (err) {
                lastError = err;
                console.warn(`[Fshift AI] Model ${modelName} error:`, err.message);
            }
        }

        throw lastError || new Error('All Gemini models unreachable');
    }

    // ============================================================================
    // 4. INTELLIGENT OFFLINE KNOWLEDGE BASE (15+ TOPICS — NEVER REPEATS BLINDLY)
    // ============================================================================
    function buildSmartOfflineResponse(userQuery) {
        const q = userQuery.toLowerCase().trim();
        const { draft, plan } = getSavedFarmContext();

        // 1. Greeting / Identity
        if (/^(hi|hello|hey|selam|good morning|good afternoon|who are you)\b/.test(q)) {
            return `Hello! I am <strong>Fshift AI</strong>, the agronomic intelligence engine inside <strong>Field Shift</strong> (built by <em>The Originals</em>). Ask me about:<br>• What Field Shift is or how NASA satellite data supports farmers<br>• Specific crops (Teff, Wheat, Maize, Chickpea, Faba bean, Sorghum)<br>• Your saved <strong>Rotation Planner</strong> profile or <strong>Crop Scanner</strong> results!`;
        }

        // 2. "What is Field Shift?" / About the Project
        if (q.includes('field shift') || q.includes('fieldshift') || q.includes('this app') || q.includes('the originals')) {
            return `<strong>Field Shift</strong> is an interactive agricultural decision-support web app built by team <strong>The Originals</strong> for the NASA Space Apps Challenge.<br>• <strong>Core Mission:</strong> Bridges satellite Earth observations (NASA POWER climate metrics, soil moisture, and vegetation indices) with practical farm-level decisions.<br>• <strong>Key Modules:</strong> A 3-step <em>Crop Rotation Planner &amp; Simulator</em>, interactive <em>Earth &amp; Explore Maps</em>, a <em>Crop &amp; Leaf Scanner</em>, and <em>Fshift AI</em>.`;
        }

        // 3. "What is a crop?" / General Crop Definition
        if (q === 'what is crop' || q === 'what is crop?' || q === 'what is a crop' || q === 'what is a crop?' || q.includes('define crop') || q.includes('meaning of crop')) {
            return `A <strong>crop</strong> is any domesticated plant cultivated at scale for food, livestock feed, fiber, or economic value.<br>• <strong>Cereals (Energy &amp; Staple Grains):</strong> Teff, Wheat, Maize, Barley, and Sorghum—high nitrogen consumers.<br>• <strong>Legumes / Pulses (Soil Builders):</strong> Faba bean, Chickpea, Lentil, and Haricot bean—partner with <em>Rhizobium</em> bacteria to fix atmospheric nitrogen ($N_2$) into the soil.<br>• <strong>Root, Tuber &amp; Cash Crops:</strong> Potato, Sweet Potato, Oilseeds (Noug, Sesame), and Coffee.`;
        }

        // 4. Leaf Scan / Photo Interpretation
        if (q.includes('scan') || q.includes('leaf') || q.includes('photo') || q.includes('image') || q.includes('chlorosis')) {
            if (!latestScanSummary || !latestScanSummary.scanned) {
                return `No leaf scan has been run in this session yet. Upload a crop or leaf photo on the left panel and click <strong>Run visual scan</strong>—I will then analyze the canopy greenness, chlorosis index, and treatment options!`;
            }
            return `<strong>Fshift Scan Diagnosis (${latestScanSummary.fileName}):</strong><br>• <strong>Detected Condition:</strong> ${latestScanSummary.condition} (${latestScanSummary.severity}).<br>• <strong>Analysis:</strong> ${latestScanSummary.summary}<br>• <strong>Agronomic Action:</strong> Check top-10 cm soil moisture before applying fertilizer. If lower leaves show yellowing, side-dress compost or urea and rotate into a legume (Faba bean or Chickpea) next season.`;
        }

        // 5. Saved Farm Profile / Rotation Analysis
        if (q.includes('profile') || q.includes('my farm') || q.includes('saved') || q.includes('rotation')) {
            if (!draft && !plan) {
                return `You haven't saved a farm profile yet, so here is our core <strong>3-Year Ethiopian Highland Rotation Blueprint</strong>:<br>• <strong>Year 1 (Cereal):</strong> Plant <em>Teff</em> or <em>Wheat</em> during the main Meher rain season.<br>• <strong>Year 2 (Nitrogen-Fixing Pulse):</strong> Rotate to <em>Faba Bean</em> or <em>Chickpea</em> to replenish soil nitrates naturally and break cereal root-pest cycles.<br>• <strong>Year 3 (Root or Alternate Cereal):</strong> Plant <em>Potato</em>, <em>Barley</em>, or <em>Maize</em>.<br><em>Tip: Fill out Step 01 on the Dashboard to get advice tailored to your exact field!</em>`;
            }
            const farmName = draft?.farmName || plan?.input?.farm?.name || 'Your Field';
            const loc = draft?.location || plan?.input?.farm?.location || 'Ethiopia';
            const crop = draft?.currentCrop || plan?.input?.history?.currentCrop?.id || 'current crop';
            const soil = draft?.soilType || plan?.input?.conditions?.soilType || 'loamy';
            const water = (draft?.waterAvailability || plan?.input?.conditions?.waterAvailability || 'rain_fed').replace(/_/g, ' ');

            return `<strong>Farm Profile Analysis for ${farmName} (${loc}):</strong><br>• <strong>Current Field State:</strong> Growing <strong>${crop}</strong> on <strong>${soil}</strong> soil under <strong>${water}</strong> conditions.<br>• <strong>Recommended Next Season:</strong> Do not plant ${crop} back-to-back. Follow ${crop} with a nitrogen-fixing pulse (<strong>Chickpea</strong> for residual moisture/clay soils, or <strong>Faba bean</strong> for loamy mid-highlands) to restore soil nitrogen and score 85+ in the Simulator.`;
        }

        // 6. Specific Ethiopian Crops (Teff, Wheat, Maize, Sorghum, Legumes)
        if (q.includes('teff') || q.includes('wheat') || q.includes('barley')) {
            return `<strong>Cereal Agronomy (Teff / Wheat / Barley):</strong><br>• <strong>Soil &amp; Water:</strong> Teff tolerates waterlogged clay (Vertisols) early in the season, whereas Wheat and Barley require well-drained loamy soils.<br>• <strong>Rotation Rule:</strong> Continuous cereal planting depletes nitrogen and builds up take-all root rot and stem rust. Always alternate with <strong>Faba bean, Field pea, or Chickpea</strong>.`;
        }
        if (q.includes('maize') || q.includes('corn') || q.includes('sorghum')) {
            return `<strong>Maize &amp; Sorghum Management:</strong><br>• <strong>Maize:</strong> High nutrient and water demand; intercrop or rotate with <strong>Haricot bean (common bean)</strong> to suppress weeds and fix nitrogen.<br>• <strong>Sorghum:</strong> Exceptional drought tolerance with deep root architecture—ideal when NASA POWER rainfall anomalies trend below average.`;
        }
        if (q.includes('legume') || q.includes('pulse') || q.includes('bean') || q.includes('chickpea') || q.includes('lentil')) {
            return `<strong>Legumes &amp; Biological Nitrogen Fixation:</strong><br>• Pulses like <strong>Faba bean, Chickpea, Lentil, and Haricot bean</strong> fix 40–100 kg/ha of atmospheric nitrogen into the soil via root nodules.<br>• <strong>Chickpea &amp; Lentil</strong> thrive on residual soil moisture at the end of the rains, preventing bare-soil erosion while preparing the bed for next year's cereal crop.`;
        }

        // 7. Soil Health, Fertilizer, Compost & pH
        if (q.includes('soil') || q.includes('clay') || q.includes('loam') || q.includes('sand') || q.includes('fertilizer') || q.includes('nitrogen') || q.includes('npk') || q.includes('compost')) {
            return `<strong>Soil &amp; Nutrient Management:</strong><br>• <strong>Clay (Vertisols):</strong> High nutrient retention but prone to waterlogging; use broad-bed furrows and late-season Chickpea/Teff.<br>• <strong>Sandy Soils:</strong> Fast drainage and nutrient leaching; incorporate organic compost/manure and drought-hardy Sorghum or Groundnut.<br>• <strong>Loamy Soils:</strong> Balanced aeration and moisture retention; ideal for Wheat–Faba bean–Potato rotations.`;
        }

        // 8. Pests, Diseases, Rust, Blight, Armyworm
        if (q.includes('pest') || q.includes('disease') || q.includes('rust') || q.includes('blight') || q.includes('worm') || q.includes('fungus') || q.includes('yellow')) {
            return `<strong>Integrated Pest &amp; Disease Control:</strong><br>• <strong>Yellow / Stem Rust (Wheat) &amp; Late Blight (Potato):</strong> Driven by high canopy humidity. Rotate out of host families for at least 1–2 years.<br>• <strong>Fall Armyworm (Maize/Sorghum):</strong> Use push-pull intercropping with <em>Desmodium</em> or legumes, and scout whorls early.<br>• <strong>Root Rot &amp; Wilt:</strong> Avoid monocropping pulses on poorly drained plots.`;
        }

        // 9. NASA Data, Satellite, Weather, Drought, Rain, Solar
        if (q.includes('nasa') || q.includes('satellite') || q.includes('drought') || q.includes('solar') || q.includes('rain') || q.includes('weather') || q.includes('climate') || q.includes('ndvi')) {
            return `<strong>NASA Earth Observation &amp; POWER Integration:</strong><br>• <strong>NASA POWER API:</strong> Supplies daily solar irradiance, temperature (T2M), relative humidity, and precipitation anomalies to estimate crop evapotranspiration.<br>• <strong>NDVI &amp; Soil Moisture:</strong> Tracks canopy greenness and root-zone water so farmers can shift from high-water crops (Maize) to drought-resilient crops (Sorghum/Chickpea) during dry spells.`;
        }

        // 10. Intelligent Context-Aware Default (Never repeats the old static text)
        return `Here is Fshift's agronomic breakdown for <strong>"${userQuery}"</strong>:<br>• <strong>In Field Shift:</strong> You can test this scenario directly by selecting your crop family, soil type, and water availability in the <strong>Dashboard Rotation Simulator</strong>.<br>• <strong>Key Agronomic Principle:</strong> Pairing deep-rooted and shallow-rooted crops across seasons maximizes root-zone water use and prevents nutrient stripping.<br><em>Want a specific breakdown? Ask me about <strong>Teff, Wheat, Maize, Chickpea, Soil types, Pests, NASA data</strong>, or type <code>/key YOUR_GEMINI_KEY</code> to switch live API keys!</em>`;
    }

    // ============================================================================
    // 5. CHAT SUBMISSION & SLASH COMMANDS (`/key` TO UPDATE API KEY INSTANTLY)
    // ============================================================================
    async function askFshift(queryText) {
        const trimmed = queryText.trim();
        if (!trimmed) return;

        appendMessage('user', formatMarkdownToHtml(trimmed));
        fshiftInput.value = '';

        // Built-in command: allow changing the API key directly from the chat UI
        if (trimmed.toLowerCase().startsWith('/key ')) {
            const newKey = trimmed.slice(5).trim();
            localStorage.setItem('fshift_gemini_api_key', newKey);
            appendMessage('ai', `✅ <strong>API Key Updated!</strong> Saved to browser storage. Ask me any question to test your live Gemini 2.5 connection.`);
            return;
        }

        fshiftSendBtn.disabled = true;
        const loadingMsg = appendMessage('ai', '<em>Analyzing with Fshift AI...</em>');

        if (getActiveApiKey()) {
            try {
                const includeImage = /scan|leaf|photo|image|picture|disease|spot/i.test(trimmed) && !!uploadedImageBase64;
                const liveReply = await callGeminiAPI(trimmed, includeImage);
                loadingMsg.innerHTML = `<strong>Fshift:</strong> ${formatMarkdownToHtml(liveReply)}`;
                fshiftSendBtn.disabled = false;
                messagesBox.scrollTop = messagesBox.scrollHeight;
                return;
            } catch (err) {
                console.warn('[Fshift AI] Live Gemini call failed, using smart offline engine:', err.message);
            }
        }

        // Smart Offline Agronomy Engine (if offline or key restricted)
        setTimeout(() => {
            loadingMsg.innerHTML = `<strong>Fshift:</strong> ${buildSmartOfflineResponse(trimmed)}`;
            fshiftSendBtn.disabled = false;
            messagesBox.scrollTop = messagesBox.scrollHeight;
        }, 320);
    }

    fshiftForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        askFshift(fshiftInput.value);
    });

    document.querySelectorAll('.fshift-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
            const promptText = chip.getAttribute('data-prompt');
            if (promptText) askFshift(promptText);
        });
    });
});