'use strict';

const CROPS = [
    { id: 'teff', label: 'Teff', family: 'cereal', waterNeed: 'moderate' },
    { id: 'maize', label: 'Maize', family: 'cereal', waterNeed: 'high' },
    { id: 'wheat', label: 'Wheat', family: 'cereal', waterNeed: 'moderate' },
    { id: 'sorghum', label: 'Sorghum', family: 'cereal', waterNeed: 'low' },
    { id: 'barley', label: 'Barley', family: 'cereal', waterNeed: 'low' },
    { id: 'faba_bean', label: 'Faba bean', family: 'legume', waterNeed: 'moderate' },
    { id: 'chickpea', label: 'Chickpea', family: 'legume', waterNeed: 'low' },
    { id: 'lentil', label: 'Lentil', family: 'legume', waterNeed: 'low' },
    { id: 'field_pea', label: 'Field pea', family: 'legume', waterNeed: 'moderate' },
    { id: 'haricot_bean', label: 'Haricot bean', family: 'legume', waterNeed: 'moderate' },
    { id: 'noug', label: 'Noug (niger seed)', family: 'oilseed', waterNeed: 'low' },
    { id: 'potato', label: 'Potato', family: 'root_tuber', waterNeed: 'high' },
    { id: 'fallow', label: 'Fallow / rest', family: 'fallow', waterNeed: 'low' },
    { id: 'other', label: 'Other (type a name)', family: 'unknown', waterNeed: 'unknown' }
];
const PRIORITIES = [
    { id: 'soil_health', label: 'Improve soil health' },
    { id: 'productivity', label: 'Increase potential crop productivity' },
    { id: 'low_water', label: 'Reduce water requirements' },
    { id: 'drought_resilience', label: 'Improve drought resilience' },
    { id: 'low_input_cost', label: 'Reduce input costs' },
    { id: 'pest_disease', label: 'Manage pest and disease risks' }
];
const MAX_PRIORITIES = 3;
const SCORING_RULES = [
    { id: 'family_alternation', title: 'Soil-health and family alternation', max: 25 },
    { id: 'legume_inclusion', title: 'Legume contribution', max: 20 },
    { id: 'water_match', title: 'Water compatibility', max: 25 },
    { id: 'pest_disease', title: 'Pest and disease breaks', max: 15 },
    { id: 'priority_alignment', title: 'Alignment with your priorities', max: 15 }
];
const state = { step: 'planner', form: null, input: null, strategies: [], results: {}, errors: {}, stale: [], selectedId: null, compareIds: [], running: false };
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cropInfo = id => CROPS.find(c => c.id === id) || CROPS[CROPS.length - 1];
const cropName = c => !c ? 'Unknown' : c.id === 'other' ? (c.customName?.trim() || 'Other (unnamed)') : cropInfo(c.id).label;
const human = v => String(v || '').replace(/_/g, ' ');
const makeId = () => `s_${Math.random().toString(36).slice(2, 9)}`;
const makeSeasons = years => Array.from({ length: years }, (_, i) => ({ label: `Year ${i + 1}`, crop: null }));
function emptyForm() { return { farmName: '', location: '', sizeHectares: '', history: { currentCrop: null, previousCrop: null, earlierCrop: null, preferredCrops: [], planningYears: 2 }, conditions: { soilType: '', waterAvailability: '', fertilityConcerns: '', notes: '' }, priorities: [] }; }
state.form = emptyForm();

function setOptions(select, allowUnknown) {
    const first = allowUnknown ? '<option value="">Unknown / not sure</option>' : '<option value="">Choose a crop</option>';
    select.innerHTML = first + CROPS.map(c => `<option value="${c.id}">${escapeHTML(c.label)}</option>`).join('');
}
setOptions($('#current-crop'), false); setOptions($('#previous-crop'), true); setOptions($('#earlier-crop'), true);
$('#preferred-crops').innerHTML = CROPS.filter(c => !['other', 'fallow'].includes(c.id)).map(c => `<label class="crop-chip"><input type="checkbox" value="${c.id}"><span>${escapeHTML(c.label)}</span></label>`).join('');
$('#priority-options').innerHTML = PRIORITIES.map(p => `<label class="priority-option"><input type="checkbox" value="${p.id}"><span>${escapeHTML(p.label)}</span></label>`).join('');

function cropSelectionFrom(id, nameId) { const value = $(id).value; if (!value) return null; return { id: value, ...(value === 'other' ? { customName: $(nameId).value } : {}) }; }
function updateCustom(selectId, nameId) { const show = $(selectId).value === 'other'; $(nameId).hidden = !show; if (!show) $(nameId).value = ''; }
[['#current-crop', '#current-crop-name'], ['#previous-crop', '#previous-crop-name'], ['#earlier-crop', '#earlier-crop-name']].forEach(([s, n]) => $(s).addEventListener('change', () => updateCustom(s, n)));
$$('input[name="years"]').forEach(r => r.addEventListener('change', () => { $$('.choice-chip').forEach(x => x.classList.toggle('selected', x.querySelector('input').checked)); }));
$$('#preferred-crops input').forEach(() => { }); // dynamically generated chips are handled by event delegation
$('#preferred-crops').addEventListener('change', e => { if (e.target.matches('input')) e.target.closest('.crop-chip').classList.toggle('selected', e.target.checked); });
$('#priority-options').addEventListener('change', e => {
    if (!e.target.matches('input')) return;
    const checked = $$('#priority-options input:checked');
    if (checked.length > MAX_PRIORITIES) { e.target.checked = false; return; }
    $('#priority-count').textContent = String(checked.length);
    const err = $('[data-error="priorities"]'); if (err) err.textContent = '';
});
function formFromDOM() {
    const years = Number($('input[name="years"]:checked').value);
    return {
        farmName: $('#farm-name').value, location: $('#farm-location').value, sizeHectares: $('#farm-size').value,
        history: { currentCrop: cropSelectionFrom('#current-crop', '#current-crop-name'), previousCrop: cropSelectionFrom('#previous-crop', '#previous-crop-name'), earlierCrop: cropSelectionFrom('#earlier-crop', '#earlier-crop-name'), preferredCrops: $$('#preferred-crops input:checked').map(x => ({ id: x.value })), planningYears: years },
        conditions: { soilType: $('#soil-type').value, waterAvailability: $('#water-availability').value, fertilityConcerns: $('#fertility').value.trim(), notes: $('#farm-notes').value.trim() },
        priorities: $$('#priority-options input:checked').map(x => x.value)
    };
}
function validateForm(f) {
    const e = {};
    if (!f.history.currentCrop) e.currentCrop = 'Choose your current crop, or "Other".';
    ['currentCrop', 'previousCrop', 'earlierCrop'].forEach(k => { const c = f.history[k]; if (c?.id === 'other' && !c.customName?.trim()) e[k] = 'Type the name of the crop.'; });
    if (!f.conditions.soilType) e.soilType = 'Choose a soil type, or "Unknown".';
    if (!f.conditions.waterAvailability) e.waterAvailability = 'Choose water availability, or "Unknown".';
    if (!f.priorities.length) e.priorities = 'Select at least one priority.';
    if (f.priorities.length > MAX_PRIORITIES) e.priorities = `Select no more than ${MAX_PRIORITIES} priorities.`;
    if (f.sizeHectares.trim() !== '' && (!Number.isFinite(Number(f.sizeHectares)) || Number(f.sizeHectares) <= 0)) e.sizeHectares = 'Enter farm size as a number greater than 0, or leave it empty.';
    return e;
}
function showFormErrors(errors) {
    $$('[data-error]').forEach(el => el.textContent = '');
    Object.entries(errors).forEach(([k, v]) => { const el = $(`[data-error="${k}"]`); if (el) el.textContent = v; });
    const summary = $('#planner-error-summary'); summary.hidden = !Object.keys(errors).length;
    if (Object.keys(errors).length) summary.focus();
}
function buildInput(f) {
    if (Object.keys(validateForm(f)).length) return null;
    const size = f.sizeHectares.trim() === '' ? undefined : Number(f.sizeHectares);
    return {
        farm: { name: f.farmName.trim() || undefined, location: f.location.trim() || undefined, sizeHectares: size },
        history: f.history, conditions: f.conditions, priorities: f.priorities.slice()
    };
}
$('#planner-form').addEventListener('submit', e => {
    e.preventDefault(); const f = formFromDOM(); state.form = f; const errors = validateForm(f); showFormErrors(errors); if (Object.keys(errors).length) return;
    state.input = buildInput(f); state.strategies = createStarterStrategies(state.input); state.results = {}; state.errors = {}; state.stale = []; state.selectedId = null; state.compareIds = [];
    renderSummary(); renderStrategies(); setStep('simulator');
});
$('#reset-form').addEventListener('click', () => {
    $('#planner-form').reset(); $('#preferred-crops').querySelectorAll('input').forEach(x => { x.checked = false; x.closest('label').classList.remove('selected'); });
    $('#priority-count').textContent = '0'; $$('.custom-crop').forEach(x => { x.value = ''; x.hidden = true; }); showFormErrors({}); $('#planner-error-summary').hidden = true;
    state.form = emptyForm();
});

function createStarterStrategies(input) {
    const years = input.history.planningYears, preferred = input.history.preferredCrops;
    return [
        { id: makeId(), name: 'Strategy A (from your preferred crops)', seasons: Array.from({ length: years }, (_, i) => ({ label: `Year ${i + 1}`, crop: preferred.length ? preferred[i % preferred.length] : null })) },
        { id: makeId(), name: 'Strategy B', seasons: makeSeasons(years) }
    ];
}
function validateStrategy(s) {
    const msgs = []; if (!s.name.trim()) msgs.push('Give the strategy a name.');
    s.seasons.forEach(slot => { if (!slot.crop) msgs.push(`${slot.label}: choose a crop.`); else if (slot.crop.id === 'other' && !slot.crop.customName?.trim()) msgs.push(`${slot.label}: type the crop name.`); });
    return msgs;
}
function renderSummary() {
    const i = state.input;
    const rows = [['Farm', `${i.farm.name || 'Not named'}${i.farm.location ? `, ${i.farm.location}` : ''}${i.farm.sizeHectares ? `, ${i.farm.sizeHectares} ha` : ''}`], ['Current crop', cropName(i.history.currentCrop)], ['Soil / water', `${human(i.conditions.soilType)} / ${human(i.conditions.waterAvailability)}`], ['Planning period', `${i.history.planningYears} ${i.history.planningYears === 1 ? 'year' : 'years'}, one crop per year`], ['Priorities', i.priorities.map(id => PRIORITIES.find(p => p.id === id)?.label || id).join('; ')]];
    $('#farm-summary').innerHTML = rows.map(([k, v], idx) => `<div class="summary-item ${idx === 4 ? 'full' : ''}"><dt>${escapeHTML(k)}</dt><dd>${escapeHTML(v)}</dd></div>`).join('') + '<p class="summary-note">Assumptions: general crop families and water categories only; soil type and notes are recorded but not used by the demo rules.</p>';
}
function renderStrategies() {
    const container = $('#strategy-list');
    if (!state.strategies.length) { container.innerHTML = '<div class="empty-state">No strategies yet. Add one to build a crop sequence.</div>'; return; }
    container.innerHTML = state.strategies.map(s => {
        const issues = validateStrategy(s), r = state.results[s.id], error = state.errors[s.id], stale = state.stale.includes(s.id);
        return `<article class="strategy-card" data-strategy="${s.id}">
 <div class="strategy-head"><div class="field"><label for="name-${s.id}">Strategy name</label><input class="strategy-name" id="name-${s.id}" data-name="${s.id}" value="${escapeHTML(s.name)}"></div>
 <div class="strategy-actions"><button type="button" class="mini-button" data-action="duplicate" data-id="${s.id}">Duplicate</button><button type="button" class="mini-button" data-action="remove" data-id="${s.id}" ${state.strategies.length <= 1 ? 'disabled' : ''}>Remove</button></div></div>
 <div class="sequence-grid">${s.seasons.map((slot, idx) => `<div class="sequence-slot"><label for="${s.id}-crop-${idx}">${escapeHTML(slot.label)}</label><select id="${s.id}-crop-${idx}" data-season="${s.id}:${idx}"><option value="">Choose a crop</option>${CROPS.map(c => `<option value="${c.id}" ${slot.crop?.id === c.id ? 'selected' : ''}>${escapeHTML(c.label)}</option>`).join('')}</select>${slot.crop?.id === 'other' ? `<input class="custom-crop-sequence" data-custom="${s.id}:${idx}" placeholder="Type crop name" value="${escapeHTML(slot.crop.customName || '')}" aria-label="${escapeHTML(slot.label)} custom crop name">` : ''}</div>`).join('')}</div>
 ${issues.length ? `<ul class="strategy-issues">${issues.map(x => `<li>${escapeHTML(x)}</li>`).join('')}</ul>` : ''}
 ${error ? `<p class="field-error" role="alert">Simulation failed: ${escapeHTML(error)}</p>` : ''}
 ${r && !error ? `<p class="result-line">${stale ? '<span style="color:var(--amber)">Edited since last run. Simulate again. </span>' : ''}<span class="score-pill ${r.demoScore === null ? 'muted' : ''}">Demo score</span>${r.demoScore === null ? 'Insufficient data' : `${r.demoScore} / 100`}</p>` : ''}
 </article>`;
    }).join('');
}
$('#strategy-list').addEventListener('input', e => {
    const id = e.target.dataset.name; if (id) { const s = state.strategies.find(x => x.id === id); if (s) { s.name = e.target.value; markStale(id); } }
    const key = e.target.dataset.custom; if (key) { const [sid, idx] = key.split(':'); const s = state.strategies.find(x => x.id === sid); if (s && s.seasons[Number(idx)].crop) { s.seasons[Number(idx)].crop.customName = e.target.value; markStale(sid); } }
});
$('#strategy-list').addEventListener('change', e => {
    const key = e.target.dataset.season; if (!key) return; const [sid, idx] = key.split(':'); const s = state.strategies.find(x => x.id === sid); if (!s) return;
    const val = e.target.value; s.seasons[Number(idx)].crop = val ? { id: val, ...(val === 'other' ? { customName: '' } : {}) } : null; delete state.results[sid]; state.stale = state.stale.filter(x => x !== sid); renderStrategies();
});
function markStale(id) { if (state.results[id] && !state.stale.includes(id)) state.stale.push(id); state.errors[id] = undefined; updateCompareButton(); }
$('#strategy-list').addEventListener('click', e => {
    const b = e.target.closest('button[data-action]'); if (!b) return; const s = state.strategies.find(x => x.id === b.dataset.id); if (!s) return;
    if (b.dataset.action === 'remove') { if (state.strategies.length <= 1) return; state.strategies = state.strategies.filter(x => x.id !== s.id); delete state.results[s.id]; delete state.errors[s.id]; state.stale = state.stale.filter(x => x !== s.id); state.compareIds = state.compareIds.filter(x => x !== s.id); }
    if (b.dataset.action === 'duplicate') { if (state.strategies.length >= 5) return; state.strategies.push({ id: makeId(), name: `${s.name} (copy)`, seasons: s.seasons.map(x => ({ ...x, crop: x.crop ? { ...x.crop } : null })) }); }
    renderStrategies(); updateCompareButton();
});
$('#add-strategy').addEventListener('click', () => { if (state.strategies.length >= 5) return; state.strategies.push({ id: makeId(), name: `Strategy ${String.fromCharCode(65 + state.strategies.length)}`, seasons: makeSeasons(state.input.history.planningYears) }); renderStrategies(); });
function chain(input, s) { return [input.history.currentCrop, ...s.seasons.map(x => x.crop)].filter(Boolean); }
function scored(id, ratio, explanation) { const rule = SCORING_RULES.find(x => x.id === id); const points = Math.round(Math.max(0, Math.min(1, ratio)) * rule.max); let rating = ratio >= .75 ? 'favorable' : ratio >= .4 ? 'mixed' : 'unfavorable'; return { criterion: id, title: rule.title, rating, points, maxPoints: rule.max, explanation }; }
function insufficient(id, explanation) { const rule = SCORING_RULES.find(x => x.id === id); return { criterion: id, title: rule.title, rating: 'insufficient_data', points: null, maxPoints: rule.max, explanation }; }
function familyAlternation(input, s) {
    const crops = s.seasons.map(x => x.crop).filter(Boolean); if (!crops.length) return insufficient('family_alternation', 'No crops were provided.');
    const pairs = []; let prev = input.history.currentCrop; for (const c of crops) { if (prev) pairs.push([prev, c]); prev = c; }
    if (!pairs.length) return insufficient('family_alternation', 'Not enough consecutive crops to check.');
    const same = pairs.filter(([a, b]) => a.id !== 'other' && b.id !== 'other' && cropInfo(a.id).family === cropInfo(b.id).family);
    const unknown = pairs.some(([a, b]) => a.id === 'other' || b.id === 'other');
    if (unknown && same.length === 0) return insufficient('family_alternation', 'A custom crop has an unknown family, so family alternation cannot be fully judged.');
    return scored('family_alternation', 1 - same.length / pairs.length, same.length === 0 ? 'Crop families alternate across the sequence.' : `Same-family transitions: ${same.map(([a, b]) => `${cropName(a)} → ${cropName(b)}`).join(', ')}.`);
}
function legumeInclusion(s) { const crops = s.seasons.map(x => x.crop).filter(Boolean); if (crops.some(c => cropInfo(c.id).family === 'legume')) return scored('legume_inclusion', 1, 'The sequence includes at least one legume.'); if (crops.some(c => c.id === 'other')) return insufficient('legume_inclusion', 'A custom crop is included and its family is unknown, so legume inclusion cannot be judged.'); return scored('legume_inclusion', 0, 'No legume in the sequence.'); }
function compat(need, water) { if (need === 'unknown' || water === 'unknown') return null; if (water === 'reliable_irrigation') return 1; if (need === 'low') return 1; if (need === 'moderate') return water === 'limited_irrigation' ? 1 : .6; return water === 'limited_irrigation' ? .5 : 0; }
function waterMatch(input, s) { if (input.conditions.waterAvailability === 'unknown') return insufficient('water_match', 'Water availability was marked unknown, so crop water needs cannot be compared.'); const vals = s.seasons.map(x => x.crop ? compat(cropInfo(x.crop.id).waterNeed, input.conditions.waterAvailability) : null).filter(v => v !== null); if (!vals.length) return insufficient('water_match', 'No crop with a known general water category.'); const avg = vals.reduce((a, b) => a + b, 0) / vals.length; return scored('water_match', avg, `General water categories compared with "${human(input.conditions.waterAvailability)}" availability. This uses coarse categories, not measured water use.`); }
function pestBreaks(input, s) { const pairs = []; let prev = input.history.currentCrop; for (const slot of s.seasons) { if (prev && slot.crop) pairs.push([prev, slot.crop]); prev = slot.crop; } const valid = pairs.filter(([a, b]) => a.id !== 'fallow' && b.id !== 'fallow'); if (!valid.length) return insufficient('pest_disease', 'Not enough consecutive crops to check.'); const same = valid.filter(([a, b]) => (a.id !== 'other' && a.id === b.id) || (a.id === 'other' && b.id === 'other' && cropName(a).toLowerCase() === cropName(b).toLowerCase())); return scored('pest_disease', 1 - same.length / valid.length, same.length === 0 ? 'The same crop is never planted twice in a row.' : `Same crop repeated: ${same.map(([a]) => cropName(a)).join(', ')}. Repeating a crop can allow crop-specific pests and diseases to carry over.`); }
function priorityChecks(input, s, criteria) {
    const crops = s.seasons.map(x => x.crop).filter(Boolean), hasLegume = crops.some(c => cropInfo(c.id).family === 'legume'), hasHigh = crops.some(c => cropInfo(c.id).waterNeed === 'high'), get = id => criteria.find(x => x.criterion === id);
    return input.priorities.map(p => { let ok = null, why = 'cannot be estimated by the demo rules'; switch (p) { case 'soil_health': ok = hasLegume && get('family_alternation')?.rating !== 'unfavorable'; why = 'needs a legume and alternating families'; break; case 'low_water': ok = !hasHigh; why = 'no crop in the high water-need category'; break; case 'drought_resilience': ok = !hasHigh && crops.some(c => cropInfo(c.id).waterNeed === 'low'); why = 'includes a low water-need crop and no high-need crop'; break; case 'low_input_cost': ok = hasLegume; why = 'a legume may reduce nitrogen fertilizer reliance'; break; case 'pest_disease': ok = get('pest_disease')?.rating === 'favorable' && get('family_alternation')?.rating !== 'unfavorable'; why = 'no repeated crops and alternating families'; break; }return { p, ok, why }; });
}
function evaluateStrategy(input, s) {
    const base = [familyAlternation(input, s), legumeInclusion(s), waterMatch(input, s), pestBreaks(input, s)], checks = priorityChecks(input, s, base), evaluable = checks.filter(c => c.ok !== null);
    const priority = evaluable.length === 0 ? insufficient('priority_alignment', 'None of your selected priorities can be assessed by the demo rules.') : scored('priority_alignment', evaluable.filter(c => c.ok).length / evaluable.length, checks.map(c => `${human(c.p)}: ${c.ok === null ? 'not assessable' : c.ok ? 'addressed' : 'not addressed'} (${c.why})`).join('; ') + '.');
    const criteria = [...base, priority], known = criteria.filter(c => c.points !== null), knownMax = known.reduce((a, c) => a + c.maxPoints, 0), total = criteria.reduce((a, c) => a + c.maxPoints, 0), earned = known.reduce((a, c) => a + (c.points ?? 0), 0), enough = knownMax >= total * .5, demoScore = enough ? Math.round(earned / knownMax * 100) : null;
    const dataGaps = []; if (input.conditions.soilType === 'unknown') dataGaps.push('Soil type is unknown.'); if (input.conditions.waterAvailability === 'unknown') dataGaps.push('Water availability is unknown.'); if (s.seasons.some(x => x.crop?.id === 'other')) dataGaps.push('Custom crops have no family or water category in the demo data.'); if (input.priorities.includes('productivity')) dataGaps.push('Productivity cannot be estimated by the demo rules; no yields are predicted.'); dataGaps.push('Soil type, fertility concerns and notes are recorded but not used by the demo rules.', 'No rainfall, soil-moisture or vegetation data from NASA or any other source was used.');
    return { strategyId: s.id, source: 'local-demo-rules', criteria, advantages: criteria.filter(c => c.rating === 'favorable').map(c => `${c.title}: ${c.explanation}`), disadvantages: criteria.filter(c => ['unfavorable', 'mixed'].includes(c.rating)).map(c => `${c.title}: ${c.explanation}`), dataGaps, assumptions: ['One crop per year; the current crop is treated as the season immediately before the plan.', 'Crop families and water categories are general, simplified labels.', 'Not a validated agronomic model and not a recommendation for any specific farm.'], demoScore, demoScoreNote: demoScore === null ? 'Insufficient data: fewer than half of the scoring points could be assessed.' : `Rule-based demonstration score from ${known.length} of ${criteria.length} criteria (${knownMax} of ${total} points assessable). Not a probability, yield prediction or verified suitability.`, ranAt: new Date().toISOString() };
}
function setStep(step) {
    state.step = step;['planner', 'simulator', 'compare'].forEach(id => { $(`#${id}-view`).hidden = id !== step; const b = $(`.step-button[data-step="${id}"]`); b.classList.toggle('active', id === step); if (id === step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    $('.step-button[data-step="simulator"]').disabled = !state.input;
    $('.step-button[data-step="compare"]').disabled = !state.input || !Object.keys(state.results).length;
    $('#app-alert').hidden = true; window.scrollTo({ top: 0, behavior: 'smooth' });
}
$$('.step-button').forEach(b => b.addEventListener('click', () => { if (!b.disabled) setStep(b.dataset.step); }));
$('#back-planner').addEventListener('click', () => setStep('planner')); $('#back-simulator').addEventListener('click', () => setStep('simulator'));
$('#go-compare').addEventListener('click', () => { renderComparison(); setStep('compare'); });
function updateCompareButton() { const has = state.strategies.some(s => state.results[s.id] && !state.stale.includes(s.id)); $('#go-compare').disabled = !has; $('.step-button[data-step="compare"]').disabled = !has; }
$('#simulate').addEventListener('click', async () => {
    const issues = state.strategies.flatMap(s => validateStrategy(s).map(m => `${s.name}: ${m}`));
    if (issues.length) { $('#app-alert').innerHTML = '<strong>Complete your strategies first.</strong><br>' + issues.map(escapeHTML).join('<br>'); $('#app-alert').hidden = false; renderStrategies(); return; }
    state.running = true; $('#simulate').disabled = true; $('#simulate').textContent = 'Simulating…';
    await new Promise(resolve => setTimeout(resolve, 350));
    state.errors = {}; state.results = { ...state.results }; state.strategies.forEach(s => { try { state.results[s.id] = evaluateStrategy(state.input, s); } catch (err) { state.errors[s.id] = err.message || 'Simulation failed.'; } });
    state.stale = []; state.running = false; $('#simulate').disabled = false; $('#simulate').innerHTML = 'Run simulation <span aria-hidden="true">→</span>'; renderStrategies(); updateCompareButton();
    $('#app-alert').textContent = 'Simulation finished using local demonstration rules.'; $('#app-alert').hidden = false;
});
function renderComparison() {
    const simulated = state.strategies.filter(s => state.results[s.id] && !state.stale.includes(s.id));
    state.compareIds = state.compareIds.filter(id => simulated.some(s => s.id === id)); simulated.forEach(s => { if (!state.compareIds.includes(s.id)) state.compareIds.push(s.id); });
    $('#compare-toggles').innerHTML = simulated.map(s => `<label class="compare-toggle"><input type="checkbox" value="${s.id}" ${state.compareIds.includes(s.id) ? 'checked' : ''}>${escapeHTML(s.name)}</label>`).join('');
    $('#compare-toggles').onchange = e => { if (e.target.matches('input')) { state.compareIds = $$('#compare-toggles input:checked').map(x => x.value); renderTable(); } };
    renderTable();
}
function ratingLabel(r) { return ({ favorable: 'Favorable', mixed: 'Mixed', unfavorable: 'Unfavorable', insufficient_data: 'Insufficient data' })[r] || r; }
function listHTML(items, empty) { return items?.length ? `<ul>${items.map(x => `<li>${escapeHTML(x)}</li>`).join('')}</ul>` : `<span class="muted">${escapeHTML(empty)}</span>`; }
function renderTable() {
    const selected = state.strategies.filter(s => state.compareIds.includes(s.id) && state.results[s.id] && !state.stale.includes(s.id));
    if (!selected.length) { $('#comparison-container').innerHTML = '<div class="empty-state">Select at least one simulated strategy to review.</div>'; return; }
    const rows = [
        { title: 'Crop sequence', cell: s => `<ol>${s.seasons.map(x => `<li>${escapeHTML(x.label)}: ${escapeHTML(cropName(x.crop))}</li>`).join('')}</ol>` },
        ...SCORING_RULES.map(rule => ({ title: rule.title, cell: s => { const c = state.results[s.id].criteria.find(x => x.criterion === rule.id); return c ? `<strong class="rating ${c.rating}">${ratingLabel(c.rating)}</strong><p class="muted">${escapeHTML(c.explanation)}</p>` : 'Not simulated'; } })),
        { title: 'Drought considerations', cell: s => escapeHTML(state.results[s.id].criteria.find(c => c.criterion === 'priority_alignment')?.explanation.split('; ').filter(t => t.startsWith('drought')).join('') || 'Not selected as a priority, or not assessable. Rainfall and soil-moisture data were not used.') },
        { title: 'Advantages', cell: s => listHTML(state.results[s.id].advantages, 'None identified by the demo rules') },
        { title: 'Disadvantages', cell: s => listHTML(state.results[s.id].disadvantages, 'None identified by the demo rules') },
        { title: 'Data gaps and assumptions', cell: s => listHTML([...state.results[s.id].dataGaps, ...state.results[s.id].assumptions], '—') },
        { title: 'Demo score (rule-based)', cell: s => { const r = state.results[s.id]; return `<strong class="rating">${r.demoScore === null ? 'Insufficient data' : `${r.demoScore} / 100`}</strong><p class="muted">${escapeHTML(r.demoScoreNote)}</p>`; } }
    ];
    $('#comparison-container').innerHTML = `<div class="table-wrap" tabindex="0" role="region" aria-label="Strategy comparison table; scroll horizontally on small screens"><table class="compare-table"><thead><tr><th scope="col">Criterion</th>${selected.map(s => `<th scope="col">${escapeHTML(s.name)}<div class="table-actions"><button class="mini-button" data-select="${s.id}">${state.selectedId === s.id ? 'Selected' : 'Select for consideration'}</button><button class="mini-button" data-edit="${s.id}">Edit</button></div></th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr><th scope="row">${escapeHTML(r.title)}</th>${selected.map(s => `<td>${r.cell(s)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    $('#comparison-container').querySelectorAll('[data-select]').forEach(b => b.addEventListener('click', () => { state.selectedId = b.dataset.select; renderTable(); }));
    $('#comparison-container').querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => { setStep('simulator'); const card = $(`[data-strategy="${b.dataset.edit}"]`); card?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }));
}
$('#save-plan').addEventListener('click', () => {
    const payload = { input: state.input, strategies: state.strategies, results: state.results, selectedStrategyId: state.selectedId, savedAt: new Date().toISOString() };
    try { localStorage.setItem('field-shift-rotation-plan', JSON.stringify(payload)); $('#save-message').textContent = 'Plan saved in this browser on this device.'; $('#save-message').hidden = false; } catch (e) { $('#save-message').textContent = 'Could not save in browser storage. You can still use the plan during this session.'; $('#save-message').hidden = false; }
});
