'use strict';

const DRAFT_STORAGE_KEY = 'field-shift-planner-draft';
const PLAN_STORAGE_KEY = 'field-shift-rotation-plan';

function saveFormDraft() {
    const form = document.getElementById('planner-form');
    if (!form) return;

    const selectedYears = document.querySelector('input[name="years"]:checked');
    const preferredCrops = Array.from(document.querySelectorAll('#preferred-crops input:checked')).map(el => el.value);
    const priorities = Array.from(document.querySelectorAll('#priority-options input:checked')).map(el => el.value);

    const draft = {
        farmName: document.getElementById('farm-name')?.value || '',
        location: document.getElementById('farm-location')?.value || '',
        sizeHectares: document.getElementById('farm-size')?.value || '',
        currentCrop: document.getElementById('current-crop')?.value || '',
        currentCropName: document.getElementById('current-crop-name')?.value || '',
        previousCrop: document.getElementById('previous-crop')?.value || '',
        previousCropName: document.getElementById('previous-crop-name')?.value || '',
        earlierCrop: document.getElementById('earlier-crop')?.value || '',
        earlierCropName: document.getElementById('earlier-crop-name')?.value || '',
        planningYears: selectedYears ? selectedYears.value : '2',
        preferredCrops,
        soilType: document.getElementById('soil-type')?.value || '',
        waterAvailability: document.getElementById('water-availability')?.value || '',
        fertility: document.getElementById('fertility')?.value || '',
        farmNotes: document.getElementById('farm-notes')?.value || '',
        priorities,
        updatedAt: new Date().toISOString()
    };

    try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch (err) {
        console.warn('Could not auto-save form draft to localStorage:', err);
    }
}

function restoreFormDraft() {
    const form = document.getElementById('planner-form');
    if (!form) return;

    try {
        const rawDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (!rawDraft) return;
        const draft = JSON.parse(rawDraft);

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el && val !== undefined) el.value = val;
        };

        setVal('farm-name', draft.farmName);
        setVal('farm-location', draft.location);
        setVal('farm-size', draft.sizeHectares);
        setVal('current-crop', draft.currentCrop);
        setVal('current-crop-name', draft.currentCropName);
        setVal('previous-crop', draft.previousCrop);
        setVal('previous-crop-name', draft.previousCropName);
        setVal('earlier-crop', draft.earlierCrop);
        setVal('earlier-crop-name', draft.earlierCropName);
        setVal('soil-type', draft.soilType);
        setVal('water-availability', draft.waterAvailability);
        setVal('fertility', draft.fertility);
        setVal('farm-notes', draft.farmNotes);

        // Trigger custom crop input visibility if "other" was selected
        ['#current-crop', '#previous-crop', '#earlier-crop'].forEach(selector => {
            const selectEl = document.querySelector(selector);
            if (selectEl) selectEl.dispatchEvent(new Event('change'));
        });
        setVal('current-crop-name', draft.currentCropName);
        setVal('previous-crop-name', draft.previousCropName);
        setVal('earlier-crop-name', draft.earlierCropName);

        // Restore planning years radio and visual chip state
        if (draft.planningYears) {
            const radio = document.querySelector(`input[name="years"][value="${draft.planningYears}"]`);
            if (radio) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change'));
            }
        }

        // Restore preferred crop chips
        if (Array.isArray(draft.preferredCrops)) {
            document.querySelectorAll('#preferred-crops input').forEach(input => {
                input.checked = draft.preferredCrops.includes(input.value);
                input.closest('.crop-chip')?.classList.toggle('selected', input.checked);
            });
        }

        // Restore priorities, update counter, and clear error banners
        if (Array.isArray(draft.priorities)) {
            document.querySelectorAll('#priority-options input').forEach(input => {
                input.checked = draft.priorities.includes(input.value);
            });
            const countEl = document.getElementById('priority-count');
            if (countEl) countEl.textContent = String(draft.priorities.length);

            // Clear any leftover error summary banner on restore
            const errorSummary = document.getElementById('planner-error-summary');
            if (errorSummary) errorSummary.hidden = true;
        }
    } catch (err) {
        console.warn('Could not restore form draft from localStorage:', err);
    }
}

function restoreSavedSimulationPlan() {
    try {
        const rawPlan = localStorage.getItem(PLAN_STORAGE_KEY);
        if (!rawPlan || typeof state === 'undefined') return;

        const saved = JSON.parse(rawPlan);
        if (!saved || !saved.input || !Array.isArray(saved.strategies)) return;

        state.input = saved.input;
        state.strategies = saved.strategies;
        state.results = saved.results || {};
        state.selectedId = saved.selectedStrategyId || null;
        state.stale = [];

        if (typeof renderSummary === 'function') renderSummary();
        if (typeof renderStrategies === 'function') renderStrategies();
        if (typeof updateCompareButton === 'function') updateCompareButton();

        const simBtn = document.querySelector('.step-button[data-step="simulator"]');
        if (simBtn) simBtn.disabled = false;

        const alertBox = document.getElementById('app-alert');
        if (alertBox) {
            const farmLabel = saved.input.farm?.name || 'your farm';
            alertBox.innerHTML = `<strong>Saved plan restored:</strong> Loaded previous rotation strategies for ${farmLabel} from local storage.`;
            alertBox.hidden = false;
        }
    } catch (err) {
        console.warn('Could not restore saved simulation plan:', err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    restoreFormDraft();
    restoreSavedSimulationPlan();

    const form = document.getElementById('planner-form');
    if (form) {
        form.addEventListener('input', saveFormDraft);
        form.addEventListener('change', saveFormDraft);
    }

    const resetBtn = document.getElementById('reset-form');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            localStorage.removeItem(DRAFT_STORAGE_KEY);
            localStorage.removeItem(PLAN_STORAGE_KEY);
            const alertBox = document.getElementById('app-alert');
            if (alertBox) alertBox.hidden = true;
        });
    }
});