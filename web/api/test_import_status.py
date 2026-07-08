import import_status as I

LOG = """\
{"timestamp":"2026-07-07T12:26:06Z","source":"trade_republic","event":"import_failed","transactions":null}
{"timestamp":"2026-07-07T12:27:58Z","source":"trade_republic","event":"import_completed","transactions":325}
{"timestamp":"2026-07-08T06:00:00Z","source":"cmb","event":"import_completed","transactions":42}
garbage not json
"""


def test_last_per_source_takes_latest_line():
    r = I.last_per_source(LOG)
    assert r["trade_republic"]["event"] == "import_completed"
    assert r["trade_republic"]["transactions"] == 325
    assert r["cmb"]["transactions"] == 42


def test_empty_log_is_empty_dict():
    assert I.last_per_source("") == {}


def test_malformed_lines_ignored():
    r = I.last_per_source('garbage\n{"timestamp":"t","source":"cmb","event":"x","transactions":1}\n')
    assert set(r) == {"cmb"}


if __name__ == "__main__":
    for n, f in sorted(globals().items()):
        if n.startswith("test_"):
            f()
    print("test_import_status.py OK")
