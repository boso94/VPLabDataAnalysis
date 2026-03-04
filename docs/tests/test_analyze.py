"""Tests for VPLab Data Analysis."""

import json

import numpy as np
import pandas as pd

from docs.core import analyze_csv
from docs.stats.tests import check_anova, check_kruskal, check_normality, check_two_groups


class TestNormality:
    """Tests for normality testing."""

    def test_normality_normal_data(self):
        """Shapiro-Wilk should pass for normal data."""
        data = pd.Series([10, 12, 11, 13, 12, 11, 10, 12])
        raw, rounded = check_normality(data)
        assert raw is not None
        assert rounded is not None
        assert 0 <= rounded <= 1

    def test_normality_small_sample(self):
        """Should return None for samples < 3."""
        data = pd.Series([10, 12])
        raw, rounded = check_normality(data)
        assert raw is None
        assert rounded is None


class TestTwoGroups:
    """Tests for two-group comparisons."""

    def test_ttest_normal_data(self):
        """Should use t-test for normal data."""
        group1 = pd.Series([10, 12, 11, 13, 12])
        group2 = pd.Series([20, 22, 21, 23, 22])
        result = check_two_groups(group1, group2, normal=True)
        assert result["name"] == "Independent t-test"
        assert "stat" in result
        assert "p" in result
        assert result["p"] < 0.05

    def test_mannwhitneyu_non_normal(self):
        """Should use Mann-Whitney for non-normal data."""
        group1 = pd.Series([1, 2, 3, 4, 5])
        group2 = pd.Series([10, 11, 12, 13, 14])
        result = check_two_groups(group1, group2, normal=False)
        assert result["name"] == "Mann-Whitney U"
        assert "stat" in result
        assert "p" in result


class TestAnova:
    """Tests for ANOVA."""

    def test_anova_significant(self):
        """ANOVA should detect significant differences."""
        group1 = pd.Series([10, 12, 11, 13])
        group2 = pd.Series([20, 22, 21, 23])
        group3 = pd.Series([30, 32, 31, 33])
        result = check_anova(group1, group2, group3)
        assert result["name"] == "ANOVA"
        assert result["p"] < 0.05

    def test_anova_not_significant(self):
        """ANOVA should not detect difference in similar groups."""
        group1 = pd.Series([10, 11, 12, 11, 10])
        group2 = pd.Series([11, 12, 10, 12, 11])
        result = check_anova(group1, group2)
        assert result["name"] == "ANOVA"
        assert result["p"] >= 0.05


class TestKruskal:
    """Tests for Kruskal-Wallis."""

    def test_kruskal_significant(self):
        """Kruskal-Wallis should detect significant differences."""
        group1 = pd.Series([1, 2, 3, 4, 5])
        group2 = pd.Series([10, 11, 12, 13, 14])
        group3 = pd.Series([20, 21, 22, 23, 24])
        result = check_kruskal(group1, group2, group3)
        assert result["name"] == "Kruskal-Wallis"
        assert result["p"] < 0.05


class TestAnalyzeCSV:
    """Tests for main analyze_csv function."""

    def test_two_groups_ttest(self):
        """Should use t-test for two normal groups."""
        csv_data = """condition,value
A,10
A,12
A,11
A,13
B,20
B,22
B,21
B,23"""
        result = analyze_csv(csv_data, "condition", ["value"])
        data = json.loads(result)
        assert "value" in data
        assert data["value"]["test"]["name"] == "Independent t-test"
        assert data["value"]["groups"] == 2

    def test_two_groups_mannwhitneyu(self):
        """Should use Mann-Whitney for non-normal groups."""
        np.random.seed(42)
        a = np.random.exponential(1, 20)
        b = np.random.exponential(3, 20)
        csv_data = "condition,value\n" + "\n".join(
            [f"A,{v}" for v in a] + [f"B,{v}" for v in b]
        )
        result = analyze_csv(csv_data, "condition", ["value"])
        data = json.loads(result)
        assert data["value"]["test"]["name"] == "Mann-Whitney U"

    def test_three_groups_anova(self):
        """Should use ANOVA for three normal groups."""
        csv_data = """condition,value
A,10
A,12
A,11
B,20
B,22
B,21
C,30
C,32
C,31"""
        result = analyze_csv(csv_data, "condition", ["value"])
        data = json.loads(result)
        assert data["value"]["test"]["name"] == "ANOVA"
        assert data["value"]["groups"] == 3

    def test_three_groups_kruskal(self):
        """Should use Kruskal-Wallis for non-normal groups."""
        np.random.seed(42)
        a = np.random.exponential(1, 10)
        b = np.random.exponential(2, 10)
        c = np.random.exponential(3, 10)
        csv_data = "condition,value\n" + "\n".join(
            [f"A,{v}" for v in a] + [f"B,{v}" for v in b] + [f"C,{v}" for v in c]
        )
        result = analyze_csv(csv_data, "condition", ["value"])
        data = json.loads(result)
        assert data["value"]["test"]["name"] == "Kruskal-Wallis"

    def test_posthoc_tukey(self):
        """Should run Tukey post-hoc for significant ANOVA."""
        csv_data = """condition,value
A,10
A,12
A,11
A,10
B,20
B,22
B,21
B,23
C,30
C,32
C,31
C,33"""
        result = analyze_csv(csv_data, "condition", ["value"])
        data = json.loads(result)
        assert data["value"]["posthoc"] is not None
        assert data["value"]["posthoc"]["name"] == "Tukey HSD"
        assert len(data["value"]["posthoc"]["pairs"]) > 0

    def test_condition_filter(self):
        """Should filter conditions when cond_filter is provided."""
        csv_data = """condition,value
A,10
A,12
B,20
B,22
C,30
C,32"""
        result = analyze_csv(csv_data, "condition", ["value"], cond_filter=["A", "B"])
        data = json.loads(result)
        assert data["value"]["groups"] == 2

    def test_multiplier(self):
        """Should replicate data when multiplier > 1."""
        csv_data = """condition,value
A,10
B,20"""
        result = analyze_csv(csv_data, "condition", ["value"], multiplier=3)
        data = json.loads(result)
        assert data["value"]["descriptive"]["count"]["A"] == 3
        assert data["value"]["descriptive"]["count"]["B"] == 3

    def test_error_no_data(self):
        """Should return error for empty data."""
        csv_data = """condition,value
A,
B,20"""
        result = analyze_csv(csv_data, "condition", ["value"])
        data = json.loads(result)
        assert "error" in data["value"]

    def test_error_single_group(self):
        """Should return error for single group."""
        csv_data = """condition,value
A,10
A,12"""
        result = analyze_csv(csv_data, "condition", ["value"])
        data = json.loads(result)
        assert "error" in data["value"]
        assert "two groups" in data["value"]["error"]
