import { Chart, registerables } from 'chart.js';
import { BoxPlotController, BoxAndWiskers } from '@sgratzl/chartjs-chart-boxplot';

Chart.register(...registerables, BoxPlotController, BoxAndWiskers);

/**
 * Render module - handles result display
 */

/**
 * Format p-value for display
 * @param {number|null} p - P-value
 * @returns {string} Formatted p-value
 */
export function formatP(p) {
  if (p == null || Number.isNaN(p)) return '-';
  if (p < 0.001) return '< .001';
  return p.toFixed(3);
}

/**
 * Get p-threshold text
 * @param {number|null} p - P-value
 * @returns {string} Threshold text
 */
export function pThreshold(p) {
  if (p == null || Number.isNaN(p)) return 'p ? 0.05';
  return p < 0.05 ? 'p < 0.05' : 'p >= 0.05';
}

/**
 * Render test result section
 * @param {Object} res - Analysis result
 * @returns {string} HTML string
 */
export function renderTest(res) {
  if (!res.test) return '';
  const normality = res.all_normal
    ? 'Distribution: normal (Shapiro p>=0.05 for all groups)'
    : 'Distribution: non-normal';
  return `<div class="test-row">${normality}</div>
    <div class="test-row">Chosen test: ${res.test.name} -- stat = ${res.test.stat ?? '-'}, p = ${res.test.p ?? '-'} - groups = ${res.groups ?? '?'}</div>`;
}

/**
 * Render Shapiro-Wilk results
 * @param {Object} res - Analysis result
 * @returns {string} HTML string
 */
export function renderShapiro(res) {
  if (!res.shapiro_p) return '';
  const rows = Object.entries(res.shapiro_p)
    .map(([cond, p]) => `<tr><td>${cond}</td><td>${p === null ? 'n/a' : p}</td></tr>`)
    .join('');
  return `<div class="test-row">Shapiro-Wilk per group</div><div class="table-wrap"><table><tr><th>Condition</th><th>p</th></tr>${rows}</table></div>`;
}

/**
 * Render descriptive statistics
 * @param {Object} res - Analysis result
 * @returns {string} HTML string
 */
export function renderDescriptive(res) {
  if (!res.descriptive) return '';
  const rows = [];
  for (const cond of Object.keys(res.descriptive['count'] || {})) {
    const stats = Object.fromEntries(
      Object.entries(res.descriptive).map(([k, v]) => [k, v[cond]])
    );
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

/**
 * Render post-hoc results
 * @param {Object} res - Analysis result
 * @returns {string} HTML string
 */
export function renderPosthoc(res) {
  if (!res.posthoc) {
    if (res.groups >= 3 && res.posthoc_reason) {
      return `<div class="test-row">Post-hoc: not run -- ${res.posthoc_reason}</div>`;
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

/**
 * Render APA format text
 * @param {Object} res - Analysis result
 * @param {string} metric - Metric name
 * @returns {string} HTML string
 */
export function renderApa(res, metric) {
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

  const sigPairs = (res.posthoc?.pairs || []).filter(
    (p) => p.reject === true || (p.reject === undefined && p.p < 0.05)
  );

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

/**
 * Render all results
 * @param {Object} results - Analysis results object
 * @returns {void}
 */
export function renderResults(results) {
  const resultsGrid = document.getElementById('results-grid');
  if (!resultsGrid) return;

  resultsGrid.innerHTML = '';
  const metrics = Object.keys(results);

  metrics.forEach((metric) => {
    const res = results[metric];
    const card = document.createElement('div');
    card.className = 'metric-card';
    const badge = res?.test?.name ? `<span class="badge">${res.test.name}</span>` : '';
    card.innerHTML = `
      <h3><span>${metric}</span>${badge}</h3>
      ${res.error ? `<div class="test-row">${res.error}</div>` : ''}
      <div class="chart-container">
        <canvas id="chart-${metric.replace(/[^a-z0-9]/gi, '_')}"></canvas>
      </div>
      ${renderDescriptive(res)}
      ${renderShapiro(res)}
      ${renderTest(res)}
      ${renderPosthoc(res)}
      ${renderApa(res, metric)}
    `;
    resultsGrid.appendChild(card);
    renderChart(res, metric);
  });

  const resultsSection = document.getElementById('results');
  if (resultsSection) resultsSection.hidden = false;
}

/**
 * Render a box plot for a metric
 * @param {Object} res - Analysis result for one metric
 * @param {string} metric - Metric name
 */
function renderChart(res, metric) {
  if (res.error || !res.descriptive) return;

  const ctx = document.getElementById(`chart-${metric.replace(/[^a-z0-9]/gi, '_')}`).getContext('2d');
  const conditions = Object.keys(res.descriptive.count);
  
  const boxData = conditions.map(cond => ({
    min: res.descriptive.min[cond],
    q1: res.descriptive['25%'][cond],
    median: res.descriptive['50%'][cond],
    q3: res.descriptive['75%'][cond],
    max: res.descriptive.max[cond],
    mean: res.descriptive.mean[cond]
  }));

  new Chart(ctx, {
    type: 'boxplot',
    data: {
      labels: conditions,
      datasets: [{
        label: metric,
        backgroundColor: 'rgba(56, 189, 248, 0.2)',
        borderColor: '#38bdf8',
        borderWidth: 1,
        outlierColor: '#999999',
        padding: 10,
        itemRadius: 0,
        data: boxData
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const d = context.raw;
              return [
                `Max: ${d.max}`,
                `Q3: ${d.q3}`,
                `Median: ${d.median}`,
                `Mean: ${d.mean}`,
                `Q1: ${d.q1}`,
                `Min: ${d.min}`
              ];
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: '#94a3b8'
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#94a3b8'
          }
        }
      }
    }
  });
}
