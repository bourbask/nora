import drift as D

TARGET = {"high": 0.10, "mid": 0.70, "low": 0.20}

def test_bucket_over_threshold():
    a = D.drift_alerts({"high": 0.30, "mid": 0.55, "low": 0.15}, TARGET, 0.0, 0.10, 0.10)
    highs = [x for x in a if x.get("bucket") == "high"]
    assert len(highs) == 1 and highs[0]["direction"] == "over"
    assert highs[0]["rule_id"] == "bucket_drift" and highs[0]["computed_value"] > 0.10

def test_bucket_within_threshold_no_alert():
    a = D.drift_alerts({"high": 0.12, "mid": 0.70, "low": 0.18}, TARGET, 0.0, 0.10, 0.10)
    assert [x for x in a if x.get("bucket")] == []      # tous les écarts <= 0.10

def test_crypto_over_cap():
    a = D.drift_alerts(TARGET, TARGET, 0.20, 0.10, 0.10)
    cr = [x for x in a if x["rule_id"] == "crypto_over_cap"]
    assert len(cr) == 1 and cr[0]["actual"] == 0.20

def test_crypto_within_cap_no_alert():
    a = D.drift_alerts(TARGET, TARGET, 0.05, 0.10, 0.10)
    assert [x for x in a if x["rule_id"] == "crypto_over_cap"] == []

def test_on_target_empty():
    assert D.drift_alerts(TARGET, TARGET, 0.0, 0.10, 0.10) == []

def test_crypto_sorted_first():
    a = D.drift_alerts({"high": 0.40, "mid": 0.45, "low": 0.15}, TARGET, 0.20, 0.10, 0.10)
    assert a[0]["rule_id"] == "crypto_over_cap"

if __name__ == "__main__":
    for n, f in sorted(globals().items()):
        if n.startswith("test_"):
            f()
    print("test_drift.py OK")
