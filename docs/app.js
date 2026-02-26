const fileInput = document.getElementById('file-input');
const conditionSelect = document.getElementById('condition-select');
const conditionsList = document.getElementById('conditions-list');
const metricsList = document.getElementById('metrics-list');
const multiplierInput = document.getElementById('multiplier-input');
const configSection = document.getElementById('config-section');
const analyzeBtn = document.getElementById('analyze-btn');
const loadingEl = document.getElementById('loading');
const resultsSection = document.getElementById('results');
const resultsGrid = document.getElementById('results-grid');

let pyodideReady = null;
let fileText = '';
let currentSeparator = ',';
const selectedMetrics = new Set();
const selectedConditions = new Set();

const pyCodePromise = fetch('analyze.py').then((r) => r.text());

async function loadPyodideOnce() {
  if (pyodideReady) return pyodideReady;
  loadingEl.hidden = false;
  loadingEl.textContent = '⚙️ Loading Pyodide (this may take a few seconds)...';
  pyodideReady = loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
  }).then(async (pyodide) => {
    await pyodide.loadPackage(['pandas', 'scipy', 'statsmodels', 'micropip']);
    // Install scikit-posthocs via micropip (non incluso di default)
    await pyodide.runPythonAsync("import micropip; await micropip.install('scikit-posthocs')");
    return pyodide;
  }).finally(() => {
    loadingEl.hidden = true;
  });
  return pyodideReady;
}

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  fileText = await file.text();

  // Estrai header
  const firstLine = fileText.split(/\r?\n/).find(Boolean) || '';
  currentSeparator = firstLine.includes(';') ? ';' : ',';
  const headers = firstLine.split(currentSeparator).map((h) => h.trim()).filter(Boolean);

  conditionSelect.innerHTML = `<option value=\"\" disabled selected>-- pick condition column --</option>` +
    headers.map((h) => `<option value=\"${h}\">${h}</option>`).join('');
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
  resultsSection.hidden = true;
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
    const pyodide = await loadPyodideOnce();
    const pyCode = await pyCodePromise;
    pyodide.runPython(pyCode);
    pyodide.globals.set('csv_text', fileText);
    pyodide.globals.set('condition_col', conditionCol);
    pyodide.globals.set('metrics_list', metrics);
    const multiplier = parseInt(multiplierInput.value, 10) || 1;
    pyodide.globals.set('multiplier', multiplier);
    pyodide.globals.set('cond_filter', conds);
    const result = pyodide.runPython('analyze_csv(csv_text, condition_col, metrics_list, multiplier, cond_filter)');
    renderResults(JSON.parse(result));
  } catch (err) {
    console.error(err);
    alert('Errore durante l\'analisi: ' + err.message);
  } finally {
    analyzeBtn.disabled = false;
    loadingEl.hidden = true;
  }
});

function renderResults(results) {
  resultsGrid.innerHTML = '';
  const metrics = Object.keys(results);
  metrics.forEach((metric) => {
    const res = results[metric];
    const card = document.createElement('div');
    card.className = 'metric-card';
    const badge = res?.test?.name ? `<span class="badge">${res.test.name}</span>` : '';
    card.innerHTML = `
      <h3><span>${metric}</span>${badge}</h3>
      ${res.error ? `<div class="test-row">⚠️ ${res.error}</div>` : ''}
      ${renderDescriptive(res)}
      ${renderShapiro(res)}
      ${renderTest(res)}
      ${renderPosthoc(res)}
      ${renderApa(res, metric)}
    `;
    resultsGrid.appendChild(card);
  });
  resultsSection.hidden = false;
}

resultsGrid.addEventListener('click', async (e) => {
  if (e.target.matches('.copy-btn')) {
    const text = e.target.getAttribute('data-apa') || '';
    try {
      await navigator.clipboard.writeText(text);
      e.target.textContent = 'Copied!';
      setTimeout(() => { e.target.textContent = 'Copy APA'; }, 1500);
    } catch (err) {
      console.error('Clipboard copy failed', err);
      e.target.textContent = 'Copy failed';
      setTimeout(() => { e.target.textContent = 'Copy APA'; }, 1500);
    }
  }
});

function buildConditionPills() {
  const conditionCol = conditionSelect.value;
  if (!conditionCol || !fileText) return;
  // parse file to get unique condition values
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

function renderTest(res) {
  if (!res.test) return '';
  const normality = res.all_normal ? 'Distribution: normal (Shapiro p≥0.05 for all groups)' : 'Distribution: non-normal';
  return `<div class="test-row">${normality}</div>
    <div class="test-row">Chosen test: ${res.test.name} — stat = ${res.test.stat ?? '-'}, p = ${res.test.p ?? '-'} · groups = ${res.groups ?? '?'}</div>`;
}

function renderShapiro(res) {
  if (!res.shapiro_p) return '';
  const rows = Object.entries(res.shapiro_p)
    .map(([cond, p]) => `<tr><td>${cond}</td><td>${p === null ? 'n/a' : p}</td></tr>`)
    .join('');
  return `<div class="test-row">Shapiro-Wilk per group</div><div class="table-wrap"><table><tr><th>Condition</th><th>p</th></tr>${rows}</table></div>`;
}

function renderDescriptive(res) {
  if (!res.descriptive) return '';
  const rows = [];
  for (const cond of Object.keys(res.descriptive['count'] || {})) {
    const stats = Object.fromEntries(Object.entries(res.descriptive).map(([k, v]) => [k, v[cond]]));
    rows.push(`
      <tr>
        <td>${cond}</td>
        <td>${stats.count ?? '-'}</td>
        <td>${stats.mean ?? '-'}</td>
        <td>${stats.std ?? '-'}</td>
        <td>${stats['50%'] ?? '-'}</td>
      </tr>
    `);
  }
  return `<div class="test-row">Descriptives</div>
    <div class="table-wrap">
      <table>
        <tr><th>Condition</th><th>N</th><th>Mean</th><th>SD</th><th>Median</th></tr>
        ${rows.join('')}
      </table>
    </div>`;
}

function renderPosthoc(res) {
  if (!res.posthoc) {
    if (res.groups >= 3 && res.posthoc_reason) {
      return `<div class="test-row">Post-hoc: not run — ${res.posthoc_reason}</div>`;
    }
    return '';
  }
  const pairs = res.posthoc.pairs || [];
  const rows = pairs
    .filter((p) => p.reject === true || (p.reject === undefined && p.p < 0.05))
    .map((p) => `
    <tr>
      <td>${p.pair}</td>
      <td>${p.p}</td>
      ${p.reject !== undefined ? `<td>${p.reject ? 'significant' : 'n.s.'}</td>` : '<td></td>'}
    </tr>
  `).join('');
  const table = rows
    ? `<div class="table-wrap">
      <table>
        <tr><th>Comparison</th><th>p</th><th></th></tr>
        ${rows || '<tr><td colspan="3">No significant comparisons</td></tr>'}
      </table>
    </div>`
    : '<div class="test-row">No significant comparisons</div>';
  return `<div class="test-row">Post-hoc: ${res.posthoc.name}</div>${table}`;
}

function formatP(p) {
  if (p == null || Number.isNaN(p)) return '-';
  if (p < 0.001) return '< .001';
  return p.toFixed(3);
}

function pThreshold(p) {
  if (p == null || Number.isNaN(p)) return 'p ? 0.05';
  return p < 0.05 ? 'p < 0.05' : 'p ≥ 0.05';
}

function renderApa(res, metric) {
  if (!res.test) return '';
  const statLabel = (() => {
    const name = res.test.name || '';
    if (name.includes('ANOVA')) return 'F';
    if (name.includes('Kruskal')) return 'H';
    if (name.includes('t-test')) return 't';
    if (name.includes('Mann-Whitney')) return 'U';
    return 'stat';
  })();
  const pTxt = pThreshold(res.test.p);
  const statTxt = res.test.stat != null ? res.test.stat.toFixed(3) : '-';
  const sigTxt = res.test.p != null && res.test.p < 0.05
    ? 'a significant difference between conditions'
    : 'no significant difference between conditions';

  const sigPairs = (res.posthoc?.pairs || []).filter((p) => p.reject === true || (p.reject === undefined && p.p < 0.05));

  let apaText = `For ${metric}, ${res.test.name} indicated ${sigTxt} (${statLabel} = ${statTxt}, ${pTxt}).`;

  if (sigPairs.length) {
    const useMedian = res.posthoc?.name?.toLowerCase().includes('dunn');
    const descr = res.descriptive || {};
    const meanMap = (descr.mean || {});
    const medMap = (descr['50%'] || {});
    const details = sigPairs.map((p) => {
      const [a, b] = p.pair.split(' vs ');
      const aVal = useMedian ? medMap[a] : meanMap[a];
      const bVal = useMedian ? medMap[b] : meanMap[b];
      let higher = '';
      if (aVal != null && bVal != null) {
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        if (aNum > bNum) higher = `${a} > ${b}`;
        else if (bNum > aNum) higher = `${b} > ${a}`;
        else higher = `${a} = ${b}`;
      }
      const pval = pThreshold(p.p);
      return `${p.pair}: ${higher || 'difference'} (${pval})`;
    }).join(' ');
    apaText += ` Post-hoc ${res.posthoc.name} found: ${details}. No other statistically significant pairwise differences were observed.`;
  } else if (res.groups >= 3 && res.posthoc_reason) {
    apaText += ` Post-hoc was not run: ${res.posthoc_reason}.`;
  } else if (res.posthoc) {
    apaText += ' Post-hoc tests found no statistically significant pairwise differences.';
  }

  const safeApa = apaText.replace(/"/g, '&quot;');
  return `<div class="test-row apa-text">${apaText}</div>
    <button class="copy-btn" data-apa="${safeApa}">Copy APA</button>`;
}
