# Providers

A **provider** turns one institution's raw export into the standard Firefly CSV
that `scripts/import-csv-firefly.sh` imports. Providers are plugins: the core repo
ships none of your banks — you add a provider per institution, kept **local and
private** (the `providers/` directory is gitignored except this doc and `example/`).

This keeps NORA's public code institution-agnostic: which banks/brokers you use,
and your real account names, never leave your machine.

## Contract

A provider is a directory `providers/<name>/` containing:

| Path | Role |
|---|---|
| `convert.py` | CLI `python convert.py <inbox_dir> <out_csv>` — reads the raw export(s) from `inbox_dir`, writes the standard CSV to `out_csv`. |
| `inbox/` | where you drop the raw export files (manual download, or a scrape). |
| `processed/` | consumed raw files are archived here after a successful import (auto). |
| `scrape.sh` *(optional)* | interactive fetch (e.g. a login with 2FA) that populates `inbox/`. Run manually; never called by the timer. |

`scripts/auto-sync.sh` discovers every `providers/*/` (except `example/`), and for
each with files in `inbox/`: runs `convert.py`, imports the result, archives.

## Standard CSV format (what `convert.py` must output)

Header + rows, comma-separated, UTF-8:

```
date,amount,description,account_name,opposing_name,category,external_id
2026-07-02,-80.00,Achat ETF,Broker - Cash,Broker - Securities,Investment,abc123
```

- `date` — `YYYY-MM-DD`.
- `amount` — signed; negative = money leaving `account_name`.
- `account_name` — your Firefly asset account for this line (cash-centric).
- `opposing_name` — the counterparty (another asset account → booked as a transfer; else a payee/revenue account).
- `external_id` — a stable unique id per row; the importer dedups on it, so re-imports are safe. If the source has no id, synthesize a stable hash of `account|date|description|amount|occurrence`.

Map your account names to Firefly in `importer/config/config.json` (see
`config.example.json`) and classify them dormant/invested in `config/strategy.yaml`.

See `example/` for a minimal working provider.
