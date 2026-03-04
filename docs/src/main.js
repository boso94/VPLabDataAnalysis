/**
 * Main entry point for VPLab Data Analysis
 */

import { runAnalysis } from './api.js';
import { renderResults } from './render.js';

const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const filePreview = document.getElementById('file-preview');
const previewInfo = filePreview.querySelector('.preview-info');
const previewTable = document.getElementById('preview-table');
const resetBtn = document.getElementById('reset-btn');
const conditionSelect = document.getElementById('condition-select');
const conditionsList = document.getElementById('conditions-list');
const metricsList = document.getElementById('metrics-list');
const multiplierInput = document.getElementById('multiplier-input');
const configSection = document.getElementById('config-section');
const analyzeBtn = document.getElementById('analyze-btn');
const exportBtn = document.getElementById('export-btn');
const loadingEl = document.getElementById('loading');

let fileText = '';
let currentSeparator = ',';
const selectedMetrics = new Set();
const selectedConditions = new Set();
let currentResults = null;

// Persistence keys
const STORAGE_KEY_CONDITION = 'vplab_condition_col';
const STORAGE_KEY_MULTIPLIER = 'vplab_multiplier';

function loadFileFromInput(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (event) => {
    fileText = event.target.result;
    handleFileLoaded();
  };
  reader.readAsText(file);
}

fileInput.addEventListener('change', loadFileFromInput);

// Drag and drop handlers
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith('.csv')) {
    fileText = await file.text();
    handleFileLoaded();
  } else {
    alert('Please drop a CSV file');
  }
});

resetBtn.addEventListener('click', () => {
  fileText = '';
  fileInput.value = '';
  filePreview.hidden = true;
  configSection.hidden = true;
  document.getElementById('results').hidden = true;
  currentResults = null;
});

function handleFileLoaded() {
  const firstLine = fileText.split(/\r?\n/).find(Boolean) || '';
  currentSeparator = firstLine.includes(';') ? ';' : ',';
  const headers = firstLine.split(currentSeparator).map((h) => h.trim()).filter(Boolean);

  conditionSelect.innerHTML = `<option value="" disabled selected>-- pick condition column --</option>` +
    headers.map((h) => `<option value="${h}">${h}</option>`).join('');
  
  // Apply saved condition if available
  const savedCondition = localStorage.getItem(STORAGE_KEY_CONDITION);
  if (savedCondition && headers.includes(savedCondition)) {
    conditionSelect.value = savedCondition;
  }
  
  // Apply saved multiplier
  const savedMultiplier = localStorage.getItem(STORAGE_KEY_MULTIPLIER);
  if (savedMultiplier) {
    multiplierInput.value = savedMultiplier;
  }

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
  
  if (conditionSelect.value) {
    buildConditionPills();
  }

  // Show file preview
  const lines = fileText.split(/\r?\n/).filter(Boolean);
  const previewRows = lines.slice(0, 6);
  previewInfo.textContent = `Loaded ${lines.length} rows, ${headers.length} columns`;
  
  let tableHtml = '<thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';
  for (let i = 1; i < previewRows.length; i++) {
    const cells = previewRows[i].split(currentSeparator).map(c => c.trim());
    tableHtml += '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
  }
  tableHtml += '</tbody>';
  previewTable.innerHTML = tableHtml;
  filePreview.hidden = false;
}

conditionSelect.addEventListener('change', () => {
  localStorage.setItem(STORAGE_KEY_CONDITION, conditionSelect.value);
  buildConditionPills();
});

multiplierInput.addEventListener('input', () => {
  localStorage.setItem(STORAGE_KEY_MULTIPLIER, multiplierInput.value);
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
    currentResults = result;
    renderResults(result);
  } catch (err) {
    console.error(err);
    alert('Error during analysis: ' + err.message);
  } finally {
    analyzeBtn.disabled = false;
    loadingEl.hidden = true;
  }
});

exportBtn.addEventListener('click', () => {
  if (!currentResults) {
    alert('No results to export');
    return;
  }

  const csvContent = generateCSVReport(currentResults);
  downloadCSV(csvContent, 'analysis-results.csv');
});

function generateCSVReport(results) {
  let csv = 'Metric,Condition,N,Mean,SD,Median,Test,Statistic,P-Value,Significant,Significant Pairs\n';
  
  for (const [metric, data] of Object.entries(results)) {
    if (data.error) continue;
    
    const testName = data.test?.name || 'N/A';
    const stat = data.test?.stat ?? 'N/A';
    const pVal = data.test?.p ?? 'N/A';
    const sig = (data.test?.p ?? 1) < 0.05 ? 'Yes' : 'No';
    const pairs = data.posthoc?.pairs
      ?.filter(p => p.reject === true || (p.reject === undefined && p.p < 0.05))
      ?.map(p => `${p.pair}(p=${p.p})`)
      ?.join('; ') || 'None';

    const desc = data.descriptive;
    const conditions = Object.keys(desc.count);
    
    conditions.forEach((cond, i) => {
      const line = [
        `"${metric}"`,
        `"${cond}"`,
        desc.count[cond],
        desc.mean[cond],
        desc.std[cond],
        desc['50%'][cond],
        i === 0 ? `"${testName}"` : '""',
        i === 0 ? stat : '""',
        i === 0 ? pVal : '""',
        i === 0 ? `"${sig}"` : '""',
        i === 0 ? `"${pairs}"` : '""'
      ].join(',');
      csv += line + '\n';
    });
  }
  
  return csv;
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

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
