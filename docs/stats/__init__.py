"""Stats module for statistical tests."""

from .tests import check_anova, check_kruskal, check_normality, check_two_groups

__all__ = [
    "check_normality",
    "check_two_groups",
    "check_anova",
    "check_kruskal",
]
