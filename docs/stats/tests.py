"""
Statistical tests module for VPLab Data Analysis.

Provides functions for normality testing and group comparison tests.
"""

from typing import Any

import pandas as pd
from scipy.stats import f_oneway, kruskal, mannwhitneyu, shapiro, ttest_ind


def check_normality(series: pd.Series) -> tuple[float | None, float | None]:
    """
    Perform Shapiro-Wilk test for normality.

    Args:
        series: Data series to test for normality.

    Returns:
        Tuple of (raw p-value, rounded p-value). Returns (None, None) if
        sample size is less than 3.
    """
    if len(series) < 3:
        return None, None
    _, p = shapiro(series)
    return float(p), round(float(p), 3)


def check_two_groups(
    group1: pd.Series,
    group2: pd.Series,
    normal: bool,
) -> dict[str, Any]:
    """
    Perform appropriate test for two groups.

    Args:
        group1: First group data.
        group2: Second group data.
        normal: Whether both groups are normally distributed.

    Returns:
        Dictionary with test name, statistic, and p-value.
    """
    if normal:
        stat, p_val = ttest_ind(group1, group2, equal_var=True)
        name = "Independent t-test"
    else:
        stat, p_val = mannwhitneyu(group1, group2, alternative="two-sided")
        name = "Mann-Whitney U"

    return {
        "name": name,
        "stat": round(float(stat), 3),
        "p": round(float(p_val), 3),
    }


def check_anova(*groups: pd.Series) -> dict[str, Any]:
    """
    Perform one-way ANOVA.

    Args:
        *groups: Variable number of group series.

    Returns:
        Dictionary with test name, F-statistic, and p-value.
    """
    f_stat, p_val = f_oneway(*groups)
    return {
        "name": "ANOVA",
        "stat": round(float(f_stat), 3),
        "p": round(float(p_val), 3),
    }


def check_kruskal(*groups: pd.Series) -> dict[str, Any]:
    """
    Perform Kruskal-Wallis H-test.

    Args:
        *groups: Variable number of group series.

    Returns:
        Dictionary with test name, H-statistic, and p-value.
    """
    h_stat, p_val = kruskal(*groups)
    return {
        "name": "Kruskal-Wallis",
        "stat": round(float(h_stat), 3),
        "p": round(float(p_val), 3),
    }
