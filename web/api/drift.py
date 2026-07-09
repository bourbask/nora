"""Alertes de dérive déterministes (allocation vs cible, crypto vs cap). Zéro I/O,
zéro LLM. Chaque alerte porte une trace {rule_id, computed_value, threshold,
verdict, message} = payload de la narration IA V2-C/V3."""


def drift_alerts(bucket_weights_actual, target_buckets, crypto_weight, crypto_cap, threshold=0.10):
    alerts = []
    if crypto_weight > crypto_cap:
        alerts.append({
            "rule_id": "crypto_over_cap", "actual": crypto_weight, "cap": crypto_cap,
            "computed_value": round(crypto_weight, 4), "threshold": crypto_cap,
            "verdict": "over",
            "message": f"crypto à {crypto_weight:.0%} > plafond {crypto_cap:.0%}",
        })
    bucket_alerts = []
    for b in set(target_buckets) | set(bucket_weights_actual):
        actual = bucket_weights_actual.get(b, 0.0)
        target = target_buckets.get(b, 0.0)
        delta = round(actual - target, 4)
        if abs(delta) > threshold:
            bucket_alerts.append({
                "rule_id": "bucket_drift", "bucket": b, "actual": round(actual, 4),
                "target": round(target, 4), "delta": delta,
                "direction": "over" if delta > 0 else "under",
                "computed_value": round(abs(delta), 4), "threshold": threshold,
                "verdict": "drift",
                "message": f"{b} à {actual:.0%} vs cible {target:.0%} (écart {delta:+.0%})",
            })
    bucket_alerts.sort(key=lambda x: x["computed_value"], reverse=True)
    return alerts + bucket_alerts
