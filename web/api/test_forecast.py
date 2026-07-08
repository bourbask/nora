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


if __name__ == "__main__":
    for n, f in sorted(globals().items()):
        if n.startswith("test_"):
            f()
    print("test_forecast.py OK")
