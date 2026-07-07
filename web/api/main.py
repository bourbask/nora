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
from pydantic import BaseModel, Field, model_validator

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


# ── editable strategy knobs (accounts / instrument_rules / weights preserved) ──

class RecurringCharge(BaseModel):
    name: str
    amount: float = Field(ge=0)
    freq: str = "monthly"


class DormantEdit(BaseModel):
    safety_cushion_months: float = Field(gt=0, le=60)
    checking_buffer_eur: float = Field(ge=0)
    target_savings_rate: float = Field(ge=0, le=1)
    recurring_charges: list[RecurringCharge] = []


class Buckets(BaseModel):
    high: float = Field(ge=0, le=1)
    mid: float = Field(ge=0, le=1)
    low: float = Field(ge=0, le=1)

    @model_validator(mode="after")
    def sum_to_one(self):
        if abs((self.high + self.mid + self.low) - 1.0) > 0.01:
            raise ValueError("target_buckets must sum to 1.0")
        return self


class InvestedEdit(BaseModel):
    target_buckets: Buckets
    target_holdings: int = Field(gt=0, le=200)
    crypto_cap: float = Field(ge=0, le=1)


class StrategyEdit(BaseModel):
    dormant: DormantEdit
    invested: InvestedEdit


@app.put("/api/strategy")
def api_strategy_put(edit: StrategyEdit):
    """Update the user-facing knobs and persist to config/strategy.yaml.
    Accounts, instrument_rules, score weights and transfer_categories are kept."""
    if not STRATEGY_FILE.exists() and STRATEGY_EXAMPLE.exists():
        cfg = yaml.safe_load(STRATEGY_EXAMPLE.read_text())
    else:
        cfg = load_cfg()

    d = cfg.setdefault("dormant", {})
    d["safety_cushion_months"] = edit.dormant.safety_cushion_months
    d["checking_buffer_eur"] = edit.dormant.checking_buffer_eur
    d["target_savings_rate"] = edit.dormant.target_savings_rate
    d["recurring_charges"] = [c.model_dump() for c in edit.dormant.recurring_charges]

    inv = cfg.setdefault("invested", {})
    inv["target_buckets"] = edit.invested.target_buckets.model_dump()
    inv["target_holdings"] = edit.invested.target_holdings
    inv["crypto_cap"] = edit.invested.crypto_cap

    STRATEGY_FILE.parent.mkdir(parents=True, exist_ok=True)
    STRATEGY_FILE.write_text(yaml.safe_dump(cfg, allow_unicode=True, sort_keys=False))
    return cfg
