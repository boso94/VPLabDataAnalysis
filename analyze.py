import json
import pandas as pd
from io import StringIO
from scipy.stats import shapiro, f_oneway, kruskal
from scipy.stats import ttest_ind, mannwhitneyu
from statsmodels.stats.multicomp import pairwise_tukeyhsd
import scikit_posthocs as sp


def tukey_to_list(tukey_obj):
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


def dunn_to_list(df_dunn):
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


def analyze_csv(csv_text: str, condition_col: str, metrics, multiplier: int = 1, cond_filter=None):
    df = pd.read_csv(StringIO(csv_text), sep=None, engine='python')
    if cond_filter:
        df = df[df[condition_col].isin(cond_filter)]
    if multiplier is None or multiplier < 1:
        multiplier = 1
    if multiplier > 1:
        df = pd.concat([df] * multiplier, ignore_index=True)
    df = df.replace(',', '.', regex=True)
    results = {}
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
            if len(values) < 3:
                sw_raw[cond] = None
                sw_out[cond] = None
            else:
                _, p = shapiro(values)
                sw_raw[cond] = float(p)
                sw_out[cond] = round(float(p), 3)

        if n_groups < 2:
            results[metric] = {
                "error": "Need at least two groups",
                "descriptive": desc,
                "shapiro_p": sw_out,
            }
            continue

        posthoc = None
        posthoc_reason = None
        if n_groups == 2:
            normal_ok = all(p is not None and p >= 0.05 for p in sw_raw.values())
            g1, g2 = groups
            if normal_ok:
                stat, p_val = ttest_ind(g1, g2, equal_var=True)
                test = {"name": "Independent t-test", "stat": round(float(stat), 3), "p": round(float(p_val), 3)}
            else:
                stat, p_val = mannwhitneyu(g1, g2, alternative="two-sided")
                test = {"name": "Mann-Whitney U", "stat": round(float(stat), 3), "p": round(float(p_val), 3)}
        else:
            all_normal = all(p is None or p >= 0.05 for p in sw_raw.values())
            if all_normal:
                f_stat, p_val = f_oneway(*groups)
                test = {"name": "ANOVA", "stat": round(float(f_stat), 3), "p": round(float(p_val), 3)}
                if p_val < 0.05:
                    tukey = pairwise_tukeyhsd(endog=df_metric['metric'], groups=df_metric[condition_col], alpha=0.05)
                    posthoc = {"name": "Tukey HSD", "pairs": tukey_to_list(tukey)}
                else:
                    posthoc_reason = "ANOVA not significant (p ≥ 0.05)"
            else:
                h_stat, p_val = kruskal(*groups)
                test = {"name": "Kruskal-Wallis", "stat": round(float(h_stat), 3), "p": round(float(p_val), 3)}
                if p_val < 0.05:
                    dunn = sp.posthoc_dunn(df_metric, val_col='metric', group_col=condition_col, p_adjust='bonferroni')
                    posthoc = {"name": "Dunn (Bonferroni)", "pairs": dunn_to_list(dunn)}
                else:
                    posthoc_reason = "Kruskal-Wallis not significant (p ≥ 0.05)"

        results[metric] = {
            "descriptive": desc,
            "shapiro_p": sw_out,
            "all_normal": all(p is None or p >= 0.05 for p in sw_raw.values()),
            "test": test,
            "posthoc": posthoc,
            "posthoc_reason": posthoc_reason,
            "groups": n_groups,
        }
    return json.dumps(results, indent=2)
