import snapshots as S

NW = {"net_of_debt": 9864.88, "total": 12000.0, "debt": 2135.12, "dormant": 5000.0}
SUMM = {"savings_rate": 0.32}
PF = {"total_cost": 7000.0, "bucket_weights": {"high": 0.5, "mid": 0.3, "low": 0.2}, "crypto_weight": 0.05}


def test_build_snapshot_fields():
    s = S.build_snapshot("2026-06", NW, SUMM, PF, 78, 65, "2026-07-01T00:00:00Z")
    assert s["month"] == "2026-06"
    assert s["net_worth"] == 9864.88 and s["net_worth_gross"] == 12000.0 and s["debt"] == 2135.12
    assert s["dormant_cash"] == 5000.0 and s["invested_cost"] == 7000.0
    assert s["savings_rate"] == 0.32
    assert s["dormant_score"] == 78 and s["invested_score"] == 65
    assert s["bucket_weights"]["high"] == 0.5 and s["crypto_weight"] == 0.05
    assert s["backfilled"] is False and s["captured_at"] == "2026-07-01T00:00:00Z"


def test_build_snapshot_invested_none_ok():
    s = S.build_snapshot("2026-06", NW, SUMM, PF, 78, None, "t")
    assert s["invested_score"] is None


def test_backfill_only_reliable_fields():
    s = S.backfill_snapshot("2025-01", 8000.0, 0.25, "t")
    assert s["net_worth"] == 8000.0 and s["savings_rate"] == 0.25
    assert s["backfilled"] is True
    for k in ("net_worth_gross", "debt", "dormant_cash", "invested_cost",
              "dormant_score", "invested_score", "bucket_weights", "crypto_weight"):
        assert s[k] is None


def test_upsert_replaces_and_adds():
    store = {}
    S.upsert(store, S.build_snapshot("2026-06", NW, SUMM, PF, 1, 1, "t"))
    S.upsert(store, S.build_snapshot("2026-06", NW, SUMM, PF, 99, 99, "t"))  # same month
    S.upsert(store, S.build_snapshot("2026-07", NW, SUMM, PF, 2, 2, "t"))
    assert set(store) == {"2026-06", "2026-07"}
    assert store["2026-06"]["dormant_score"] == 99  # replaced


def test_to_series_sorted():
    store = {"2026-07": {"month": "2026-07"}, "2026-05": {"month": "2026-05"}}
    assert [s["month"] for s in S.to_series(store)] == ["2026-05", "2026-07"]


def test_load_missing_is_empty(tmp_path=None):
    assert S.load("/nonexistent/path/snapshots.json") == {}


if __name__ == "__main__":
    for n, f in sorted(globals().items()):
        if n.startswith("test_"):
            f()
    print("test_snapshots.py OK")
