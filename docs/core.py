"""
Core module for VPLab Data Analysis.

Main entry point for CSV analysis.
"""

import json
from io import StringIO
from typing import Any

import pandas as pd

from .posthoc.comparisons import run_dunn, run_tukey
from .stats.tests import (
    check_anova,
    check_kruskal,
    check_normality,
    check_two_groups,
)


def analyze_csv(
    csv_text: str,
    condition_col: str,
    metrics: list[str],
    multiplier: int = 1,
    cond_filter: list[str] | None = None,
) -> str:
    """
    Analyze CSV data with statistical tests.

    Performs normality testing and selects appropriate statistical test
    based on number of groups and normality. Runs post-hoc comparisons
    when significant.

    Args:
        csv_text: CSV data as string.
        condition_col: Name of the condition/group column.
        metrics: List of metric column names to analyze.
        multiplier: Number of times to replicate data (for sample size simulation).
        cond_filter: Optional list of condition values to include.

    Returns:
        JSON string with analysis results.
    """
    df = pd.read_csv(StringIO(csv_text), sep=None, engine='python')
    if cond_filter:
        df = df[df[condition_col].isin(cond_filter)]
    if multiplier is None or multiplier < 1:
        multiplier = 1
    if multiplier > 1:
        df = pd.concat([df] * multiplier, ignore_index=True)
    df = df.replace(',', '.', regex=True)

    results: dict[str, Any] = {}

    for metric in metrics:
        if metric == condition_col:
            continue

        series = pd.to_numeric(df[metric], errors='coerce')
        df_metric = df[[condition_col]].copy()
        df_metric['metric'] = series
        df_metric = df_metric.dropna(subset=['metric', condition_col])

        if df_metric.empty:
            results[metric] = {"error": "No data after cleaning"}
            continue

        grouped = list(df_metric.groupby(condition_col))
        n_groups = len(grouped)
        groups = [g['metric'].values for _, g in grouped]
        desc = df_metric.groupby(condition_col)['metric'].describe().round(3).to_dict()

        sw_raw, sw_out = {}, {}
        for cond, values in df_metric.groupby(condition_col)['metric']:
            raw, rounded = check_normality(values)
            sw_raw[cond] = raw
            sw_out[cond] = rounded

        if n_groups < 2:
            results[metric] = {
                "error": "Need at least two groups",
                "descriptive": desc,
                "shapiro_p": sw_out,
            }
            continue

        posthoc = None
        posthoc_reason = None
        all_normal = all(p is None or p >= 0.05 for p in sw_raw.values())

        if n_groups == 2:
            normal_ok = all(p is not None and p >= 0.05 for p in sw_raw.values())
            test = check_two_groups(groups[0], groups[1], normal_ok)
        else:
            if all_normal:
                test = check_anova(*groups)
                if test["p"] < 0.05:
                    posthoc = run_tukey(df_metric, condition_col, 'metric')
                else:
                    posthoc_reason = "ANOVA not significant (p >= 0.05)"
            else:
                test = check_kruskal(*groups)
                if test["p"] < 0.05:
                    posthoc = run_dunn(df_metric, condition_col, 'metric')
                else:
                    posthoc_reason = "Kruskal-Wallis not significant (p >= 0.05)"

        results[metric] = {
            "descriptive": desc,
            "shapiro_p": sw_out,
            "all_normal": all_normal,
            "test": test,
            "posthoc": posthoc,
            "posthoc_reason": posthoc_reason,
            "groups": n_groups,
        }

    return json.dumps(results, indent=2)
