import categorization as C


def test_coverage_ratio():
    cov = C.coverage({"Courses": 600.0, "(sans catégorie)": 200.0, "Loyer": 200.0})
    assert cov["uncategorized"] == 200.0
    assert cov["total"] == 1000.0
    assert cov["ratio"] == 0.2


def test_coverage_none_uncategorized():
    cov = C.coverage({"Courses": 500.0})
    assert cov["uncategorized"] == 0.0 and cov["ratio"] == 0.0


def test_coverage_zero_total_no_div():
    cov = C.coverage({})
    assert cov["total"] == 0.0 and cov["ratio"] == 0.0


def test_top_untagged_sorts_and_limits():
    txs = [
        {"date": "2026-06-02", "amount": 10.0, "description": "a", "category": ""},
        {"date": "2026-06-03", "amount": 90.0, "description": "b", "category": ""},
        {"date": "2026-06-04", "amount": 50.0, "description": "c", "category": "Courses"},
        {"date": "2026-06-05", "amount": 30.0, "description": "d", "category": None},
    ]
    top = C.top_untagged(txs, 2)
    assert [t["amount"] for t in top] == [90.0, 30.0]      # tagged 'c' exclu, trié desc, limité
    assert top[0] == {"date": "2026-06-03", "amount": 90.0, "description": "b"}


def test_top_untagged_empty():
    assert C.top_untagged([], 5) == []


if __name__ == "__main__":
    for n, f in sorted(globals().items()):
        if n.startswith("test_"):
            f()
    print("test_categorization.py OK")
