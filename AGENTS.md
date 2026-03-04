# AGENTS.md - VPLab Data Analysis

This document provides guidance for AI agents operating in this repository.

## Project Overview

VPLab Data Analysis is a web-based statistical analysis tool that runs Python in the browser via Pyodide (WebAssembly). It performs statistical tests (t-test, Mann-Whitney U, ANOVA, Kruskal-Wallis) with post-hoc comparisons (Tukey HSD, Dunn) on CSV data.

## Project Structure

```
docs/
├── index.html           # Landing page
├── analysis.html        # Main analysis UI
├── style.css           # Styles
├── analyze.py          # Legacy Python module (backward compatible)
├── package.json        # Node.js dependencies
├── vite.config.js      # Vite configuration
├── src/                # Modern JavaScript source
│   ├── main.js        # Entry point
│   ├── api.js         # Pyodide/Python API
│   └── render.js      # Results rendering
├── stats/              # Python statistical tests module
│   ├── __init__.py
│   └── tests.py
├── posthoc/            # Python post-hoc comparisons module
│   ├── __init__.py
│   └── comparisons.py
├── core.py            # Main Python analysis module
└── tests/             # Python test suite
    └── test_analyze.py
```

## Environment Setup

### Python (virtual environment)
```bash
# Create virtual environment
python3 -m venv venv

# Activate (Linux/Mac)
source venv/bin/activate

# Install dependencies
pip install pandas scipy statsmodels scikit-posthocs pytest numpy ruff
```

### Node.js
```bash
cd docs
npm install
```

## Build / Lint / Test Commands

### Python

**Dependencies:**
```bash
pip install pandas scipy statsmodels scikit-posthocs pytest numpy ruff
```

**Linting:**
```bash
# Lint all Python files
ruff check docs/

# Auto-fix issues
ruff check docs/ --fix
```

**Testing:**
```bash
# Run all tests
pytest

# Run specific test file
pytest docs/tests/test_analyze.py

# Run with verbose output
pytest -v

# Run specific test
pytest docs/tests/test_analyze.py::TestNormality::test_normality_normal_data
```

### JavaScript (Vite)

**Setup:**
```bash
cd docs
npm install
```

**Commands:**
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
npm run test:e2e # Run Playwright E2E tests
```

## Code Style Guidelines

### Python

- **Imports**: Standard library first, then third-party (alphabetically)
  ```python
  import json
  from io import StringIO
  
  import pandas as pd
  from scipy.stats import shapiro, f_oneway, kruskal
  from scipy.stats import ttest_ind, mannwhitneyu
  from statsmodels.stats.multicomp import pairwise_tukeyhsd
  import scikit_posthocs as sp
  ```

- **Formatting**: 4 spaces for indentation, max line length ~100 chars

- **Types**: Use type hints where beneficial
  ```python
  def analyze_csv(csv_text: str, condition_col: str, metrics: list[str], multiplier: int = 1, cond_filter: list[str] | None = None) -> str:
  ```

- **Naming**:
  - Functions: `snake_case` (e.g., `tukey_to_list`, `analyze_csv`)
  - Variables: `snake_case` (e.g., `csv_text`, `sw_raw`)
  - Constants: UPPER_SNAKE_CASE

- **Docstrings**: Use Google-style docstrings for all public functions
  ```python
  def test_normality(series: pd.Series) -> tuple[float | None, float | None]:
      """Perform Shapiro-Wilk test for normality.

      Args:
          series: Data series to test for normality.

      Returns:
          Tuple of (raw p-value, rounded p-value).
      """
  ```

- **Error Handling**: Return error dicts rather than raising for expected failure modes
- **Math/Statistics**: Round floating-point results to 3 decimal places

### JavaScript

- **Formatting**: 2 spaces for indentation, ES modules
- **Naming**: camelCase for functions/variables, prefix DOM elements (e.g., `fileInput`, `resultsGrid`)
- **Async/Await**: Use for all asynchronous operations
- **Error Handling**: Wrap async operations in try/catch
- **Structure**: Use ES modules in `src/` directory

### HTML/CSS

- **HTML**: Semantic tags, accessible attributes
- **CSS**: Class-based styling, BEM-like naming (e.g., `metric-pill`, `test-row`)

## Common Development Tasks

### Adding a New Statistical Test

1. Add test function in `docs/stats/tests.py`
2. Import and call from `docs/core.py`
3. Return results in the same dict format

### Modifying the UI

1. Edit `docs/analysis.html` for structure
2. Edit `docs/style.css` for appearance
3. Edit `docs/src/main.js` for behavior

### Running Tests

```bash
# Python
pytest docs/tests/test_analyze.py -v

# E2E (requires npm install)
cd docs && npm run test:e2e
```

## Dependencies

- **Python**: pandas, scipy, statsmodels, scikit-posthocs, pytest
- **Frontend**: Pyodide (loaded from CDN), Chart.js, @sgratzl/chartjs-chart-boxplot
- **Dev**: Vite, ESLint, Playwright

## Notes for Agents

- The Python code runs entirely client-side via Pyodide
- New code should go in `docs/src/` (JS) and `docs/core.py` (Python)
- Legacy `app.js` and `analyze.py` are kept for backward compatibility
- Always run `pytest` before committing Python changes
- Use `npm run lint` for JavaScript changes
