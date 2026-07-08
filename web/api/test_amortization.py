# web/api/test_amortization.py
import amortization as A

def test_standard_loan_pays_off():
    r = A.schedule(10000.0, 200.0, 0.05)
    assert r["never_amortizes"] is False
    assert r["payoff_months"] is not None and 55 <= r["payoff_months"] <= 60
    assert r["total_interest"] > 0
    assert abs(r["schedule"][-1]["balance"]) < 0.01           # soldé

def test_zero_rate():
    r = A.schedule(1000.0, 100.0, 0.0)
    assert r["payoff_months"] == 10 and r["total_interest"] == 0.0

def test_payment_too_low_never_amortizes():
    r = A.schedule(10000.0, 10.0, 0.05)                        # 10 < intérêt initial (~41.67)
    assert r["never_amortizes"] is True and r["payoff_months"] is None
    assert len(r["schedule"]) == 0

def test_payoff_month():
    assert A.payoff_month("2026-01", 5) == "2026-06"
    assert A.payoff_month("2026-01", None) is None

if __name__ == "__main__":
    for n, f in sorted(globals().items()):
        if n.startswith("test_"):
            f()
    print("test_amortization.py OK")
