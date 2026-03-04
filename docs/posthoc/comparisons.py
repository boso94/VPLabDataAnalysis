"""
Post-hoc comparison module for VPLab Data Analysis.

Provides functions for Tukey HSD and Dunn's tests.
"""

from typing import Any

import pandas as pd
import scikit_posthocs as sp
from statsmodels.stats.multicomp import pairwise_tukeyhsd


def tukey_to_list(tukey_obj) -> list[dict[str, Any]]:
    """
    Convert Tukey HSD results to list format.

    Args:
        tukey_obj: Pairwise_tukeyhsd result object.

    Returns:
        List of dictionaries with pair, p-value, reject status, and mean difference.
    """
    rows = []
    for res in tukey_obj._results_table.data[1:]:
        g1, g2, meandiff, p_adj, lower, upper, reject = res
        rows.append({
            "pair": f"{g1} vs {g2}",
            "p": round(float(p_adj), 3),
            "reject": bool(reject),
            "diff": round(float(meandiff), 3),
        })
    return rows


def dunn_to_list(df_dunn) -> list[dict[str, Any]]:
    """
    Convert Dunn's test results to list format.

    Args:
        df_dunn: Dunn test result DataFrame.

    Returns:
        List of dictionaries with pair, p-value, and reject status.
    """
    out = []
    cols = list(df_dunn.columns)
    for i, c1 in enumerate(cols):
        for j, c2 in enumerate(cols):
            if j <= i:
                continue
            p = df_dunn.loc[c1, c2]
            out.append({
                "pair": f"{c1} vs {c2}",
                "p": round(float(p), 3),
                "reject": bool(float(p) < 0.05)
            })
    return out


def run_tukey(df: pd.DataFrame, condition_col: str, metric_col: str) -> dict[str, Any]:
    """
    Run Tukey HSD post-hoc test.

    Args:
        df: DataFrame with condition and metric columns.
        condition_col: Name of condition column.
        metric_col: Name of metric column.

    Returns:
        Dictionary with test name and pairs results.
    """
    tukey = pairwise_tukeyhsd(
        endog=df[metric_col],
        groups=df[condition_col],
        alpha=0.05
    )
    return {"name": "Tukey HSD", "pairs": tukey_to_list(tukey)}


def run_dunn(df: pd.DataFrame, condition_col: str, metric_col: str) -> dict[str, Any]:
    """
    Run Dunn's post-hoc test with Bonferroni correction.

    Args:
        df: DataFrame with condition and metric columns.
        condition_col: Name of condition column.
        metric_col: Name of metric column.

    Returns:
        Dictionary with test name and pairs results.
    """
    dunn = sp.posthoc_dunn(
        df,
        val_col=metric_col,
        group_col=condition_col,
        p_adjust='bonferroni'
    )
    return {"name": "Dunn (Bonferroni)", "pairs": dunn_to_list(dunn)}
