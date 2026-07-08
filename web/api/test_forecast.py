import forecast as F


def test_month_add():
    assert F.month_add("2026-11", 2) == "2027-01"
    assert F.month_add("2026-01", -1) == "2025-12"


def test_active_obligations():
    ch = [
        {"amount": 300, "freq": "monthly", "start": "2026-01", "end": "2030-01"},
        {"amount": 250, "freq": "monthly", "start": "2026-01", "end": "2026-12"},  # tax ends Dec
        {"amount": 60,  "freq": "monthly", "start": "2026-09", "end": None},
    ]
    assert F.active_obligations(ch, "2026-08") == 550.0   # loan+tax, insurance not started
    assert F.active_obligations(ch, "2026-10") == 610.0   # +insurance
    assert F.active_obligations(ch, "2027-03") == 360.0   # tax ended, loan+insurance


def test_variable_typical():
    ch = [{"amount": 300, "freq": "monthly", "start": "2025-01", "end": None}]  # long-running -> in history
    # typical total expense 1000 includes the 300 obligation -> variable = 700
    assert F.variable_typical(1000.0, ch, "2026-07") == 700.0
    # never negative
    assert F.variable_typical(200.0, ch, "2026-07") == 0.0


def test_expected_salary():
    assert F.expected_salary([2000, 2100, 1900], None) == 2000.0   # median
    assert F.expected_salary([2000, 2100, 1900], 2500) == 2500.0   # override wins


def test_build_runway():
    ch = [{"amount": 250, "freq": "monthly", "start": "2026-07", "end": "2026-09"}]  # 3 tight months
    r = F.build_runway(salary=1000, charges=ch, variable=800, one_offs=[],
                       dormant_cash=500, start_month="2026-07", horizon=4)
    nets = [m["net"] for m in r["months"]]
    assert nets == [-50.0, -50.0, -50.0, 200.0]   # 1000-250-800 then 1000-800
    assert r["months"][0]["balance"] == 450.0     # 500 + (-50)
    assert r["trough"]["month"] == "2026-09"       # lowest balance before recovery
    assert r["positive_month"] == "2026-10"        # first net>=0


def test_build_runway_oneoff_moves_trough():
    r = F.build_runway(salary=1000, charges=[], variable=800,
                       one_offs=[{"amount": 400, "date": "2026-08"}],
                       dormant_cash=500, start_month="2026-07", horizon=3)
    assert r["months"][1]["net"] == -200.0   # Aug: 1000-800-400
    assert r["trough"]["month"] == "2026-08"


def test_guardrail_blocks_when_cushion_low():
    runway_ok = {"months": [{"net": 100}]}
    g = F.guardrail(dormant_cash=6000, monthly_cost=2000, cushion_months=6, runway=runway_ok)
    assert g["coverage_months"] == 3.0
    assert g["invest_ok"] is False               # 3 < 6 months
    assert "R1" in g["rule_refs"]


def test_guardrail_blocks_when_runway_red_even_if_cushion_ok():
    runway_neg = {"months": [{"net": 100}, {"net": -50}]}
    g = F.guardrail(dormant_cash=20000, monthly_cost=2000, cushion_months=6, runway=runway_neg)
    assert g["coverage_months"] == 10.0
    assert g["invest_ok"] is False               # cushion ok but a month is negative


def test_guardrail_green():
    runway_ok = {"months": [{"net": 10}, {"net": 20}]}
    g = F.guardrail(dormant_cash=20000, monthly_cost=2000, cushion_months=6, runway=runway_ok)
    assert g["invest_ok"] is True


def test_remaining_buffer_first_then_rate():
    # salary 2000, no obligations, variable 1200 -> reste_a_vivre 800
    # buffer 500 first, then 20% savings rate of salary as the invest target, capped by surplus
    r = F.remaining(salary=2000, charges=[], variable=1200, month="2027-03",
                    buffer=500, savings_rate=0.20, invest_ok=True)
    assert r["reste_a_vivre"] == 800.0
    assert r["reste_a_investir"] == 300.0        # min(max(800-500,0), 2000*0.20)=min(300,400)=300


def test_remaining_gated_by_guardrail():
    r = F.remaining(salary=2000, charges=[], variable=1200, month="2026-08",
                    buffer=500, savings_rate=0.20, invest_ok=False)
    assert r["reste_a_vivre"] == 800.0
    assert r["reste_a_investir"] == 0.0          # guardrail blocks deploy


def test_debt_total():
    ch = [{"remaining_balance": 8000, "kind": "loan"},
          {"remaining_balance": 4400, "kind": "loan"},
          {"remaining_balance": None, "kind": "rent"}]
    assert F.debt_total(ch) == 12400.0


def test_housing_ratio():
    ch = [{"amount": 700, "kind": "rent", "freq": "monthly", "start": "2024-01", "end": None}]
    h = F.housing_ratio(ch, salary=2000, ref_month="2026-07")
    assert h["ratio"] == 0.35
    assert h["over_33"] is True


if __name__ == "__main__":
    for n, f in sorted(globals().items()):
        if n.startswith("test_"):
            f()
    print("test_forecast.py OK")
