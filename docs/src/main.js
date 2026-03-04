/**
 * Main entry point for VPLab Data Analysis
 */

import { runAnalysis } from './api.js';
import { renderResults } from './render.js';

const fileInput = document.getElementById('file-input');
const conditionSelect = document.getElementById('condition-select');
const conditionsList = document.getElementById('conditions-list');
const metricsList = document.getElementById('metrics-list');
const multiplierInput = document.getElementById('multiplier-input');
const configSection = document.getElementById('config-section');
const analyzeBtn = document.getElementById('analyze-btn');
const loadingEl = document.getElementById('loading');

let fileText = '';
let currentSeparator = ',';
const selectedMetrics = new Set();
const selectedConditions = new Set();

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  fileText = await file.text();

  const firstLine = fileText.split(/\r?\n/).find(Boolean) || '';
  currentSeparator = firstLine.includes(';') ? ';' : ',';
  const headers = firstLine.split(currentSeparator).map((h) => h.trim()).filter(Boolean);

  conditionSelect.innerHTML = `<option value="" disabled selected>-- pick condition column --</option>` +
    headers.map((h) => `<option value="${h}">${h}</option>`).join('');
  metricsList.innerHTML = '';
  selectedMetrics.clear();
  headers.forEach((h) => {
    const pill = document.createElement('div');
    pill.className = 'metric-pill';
    pill.textContent = h;
    pill.addEventListener('click', () => {
      if (pill.classList.contains('active')) {
        pill.classList.remove('active');
        selectedMetrics.delete(h);
      } else {
        pill.classList.add('active');
        selectedMetrics.add(h);
      }
    });
    metricsList.appendChild(pill);
  });
  conditionsList.innerHTML = '';
  selectedConditions.clear();
  configSection.hidden = false;
});

conditionSelect.addEventListener('change', () => {
  buildConditionPills();
});

analyzeBtn.addEventListener('click', async () => {
  const conditionCol = conditionSelect.value;
  const metrics = Array.from(selectedMetrics);
  const conds = Array.from(selectedConditions);

  if (!fileText) {
    alert('Please upload a CSV first');
    return;
  }
  if (!conditionCol || metrics.length === 0) {
    alert('Select the condition column and at least one metric');
    return;
  }

  analyzeBtn.disabled = true;
  loadingEl.hidden = false;
  loadingEl.textContent = 'Running analysis...';

  try {
    const multiplier = parseInt(multiplierInput.value, 10) || 1;
    const result = await runAnalysis(fileText, conditionCol, metrics, multiplier, conds);
    renderResults(result);
  } catch (err) {
    console.error(err);
    alert('Error during analysis: ' + err.message);
  } finally {
    analyzeBtn.disabled = false;
    loadingEl.hidden = true;
  }
});

function buildConditionPills() {
  const conditionCol = conditionSelect.value;
  if (!conditionCol || !fileText) return;

  const lines = fileText.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return;
  const headers = lines[0].split(currentSeparator).map((h) => h.trim());
  const idx = headers.indexOf(conditionCol);
  if (idx === -1) return;

  const values = new Set();
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(currentSeparator);
    if (parts.length <= idx) continue;
    const val = parts[idx].trim();
    if (val) values.add(val);
  }

  conditionsList.innerHTML = '';
  selectedConditions.clear();
  values.forEach((v) => {
    const pill = document.createElement('div');
    pill.className = 'metric-pill active';
    pill.textContent = v;
    selectedConditions.add(v);
    pill.addEventListener('click', () => {
      if (pill.classList.contains('active')) {
        pill.classList.remove('active');
        selectedConditions.delete(v);
      } else {
        pill.classList.add('active');
        selectedConditions.add(v);
      }
    });
    conditionsList.appendChild(pill);
  });
}
