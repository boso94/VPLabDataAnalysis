/**
 * API module - handles Python analysis via Pyodide
 */

let pyodideReady = null;
const pyCodePromise = fetch('analyze.py').then((r) => r.text());

/**
 * Load Pyodide once and install dependencies
 */
export async function loadPyodideOnce() {
  if (pyodideReady) return pyodideReady;

  const loadingEl = document.getElementById('loading');
  if (loadingEl) {
    loadingEl.hidden = false;
    loadingEl.textContent = 'Loading Pyodide (this may take a few seconds)...';
  }

  pyodideReady = loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
  }).then(async (pyodide) => {
    await pyodide.loadPackage(['pandas', 'scipy', 'statsmodels', 'micropip']);
    await pyodide.runPythonAsync("import micropip; await micropip.install('scikit-posthocs')");
    return pyodide;
  }).finally(() => {
    if (loadingEl) loadingEl.hidden = true;
  });

  return pyodideReady;
}

/**
 * Run analysis on CSV data
 * @param {string} csvText - CSV data
 * @param {string} conditionCol - Condition column name
 * @param {string[]} metrics - List of metric columns
 * @param {number} multiplier - Sample multiplier
 * @param {string[]} condFilter - Condition filter
 * @returns {Promise<Object>} Analysis results
 */
export async function runAnalysis(csvText, conditionCol, metrics, multiplier = 1, condFilter = []) {
  const pyodide = await loadPyodideOnce();
  const pyCode = await pyCodePromise;

  pyodide.runPython(pyCode);
  pyodide.globals.set('csv_text', csvText);
  pyodide.globals.set('condition_col', conditionCol);
  pyodide.globals.set('metrics_list', metrics);
  pyodide.globals.set('multiplier', multiplier);
  pyodide.globals.set('cond_filter', condFilter);

  const result = pyodide.runPython(
    'analyze_csv(csv_text, condition_col, metrics_list, multiplier, cond_filter)'
  );

  return JSON.parse(result);
}
