"""Posthoc module for post-hoc comparisons."""

from .comparisons import dunn_to_list, run_dunn, run_tukey, tukey_to_list

__all__ = [
    "tukey_to_list",
    "dunn_to_list",
    "run_tukey",
    "run_dunn",
]
