"""
NORA backend proxy — thin FastAPI over Firefly III.

The Firefly Personal Access Token stays here (server-side); the browser only ever
receives aggregate JSON. All data logic lives in firefly_client.py.

Run (dev):  uvicorn main:app --reload --port 8068   (from web/api/)
"""

import os
from pathlib import Path

import yaml
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import firefly_client as fc
import scores

REPO_ROOT = Path(__file__).resolve().parents[2]
CONFIG_DIR = Path(os.environ.get("NORA_CONFIG_DIR", REPO_ROOT / "config"))
STRATEGY_FILE = CONFIG_DIR / "strategy.yaml"
STRATEGY_EXAMPLE = CONFIG_DIR / "strategy.example.yaml"

app = FastAPI(title="NORA API")

# Dev only: Vite dev server hits us cross-origin. In prod, nginx serves same-origin.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://localhost:\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_cfg():
    path = STRATEGY_FILE if STRATEGY_FILE.exists() else STRATEGY_EXAMPLE
    if not path.exists():
        raise HTTPException(500, "no strategy config found")
    return yaml.safe_load(path.read_text())


def current_month():
    accts_date = fc.date.today()
    return f"{accts_date.year}-{accts_date.month:02d}"


@app.get("/api/health")
def health():
    return {"ok": True, "firefly": fc.FIREFLY_BASE_URL}


@app.get("/api/networth")
def api_networth():
    return fc.networth(load_cfg())


@app.get("/api/summary")
def api_summary(month: str | None = None):
    return fc.summary(month or current_month(), load_cfg())


@app.get("/api/categories/expense")
def api_expense(month: str | None = None, top: int | None = None):
    return {"month": month or current_month(),
            "categories": fc.expense_by_category(month or current_month(), load_cfg(), top)}


@app.get("/api/scores")
def api_scores(month: str | None = None):
    cfg = load_cfg()
    month = month or current_month()
    nw = fc.networth(cfg)
    s = fc.summary(month, cfg)
    typical_exp = fc.typical_monthly_expense(month, months=6)
    dormant = scores.dormant_health(
        dormant_cash=nw["dormant"],
        avg_monthly_expense=typical_exp,
        savings_rate=s["savings_rate"],
        cfg=cfg,
    )
    p = fc.portfolio(cfg)
    invested = scores.invested_health(
        instrument_cost=p["instrument_cost"],
        bucket_weights_actual=p["bucket_weights"],
        crypto_weight=p["crypto_weight"],
        cfg=cfg,
    )
    return {"month": month, "typical_monthly_expense": typical_exp,
            "dormant": dormant, "invested": invested}


@app.get("/api/portfolio")
def api_portfolio():
    return fc.portfolio(load_cfg())


@app.get("/api/flow")
def api_flow(month: str | None = None):
    return fc.flow(month or current_month(), load_cfg())


@app.get("/api/strategy")
def api_strategy_get():
    return load_cfg()
