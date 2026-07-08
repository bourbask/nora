# V2-B Alertes de dérive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Transformer les distances d'allocation/crypto déjà calculées en alertes explicites au-delà d'un seuil, chaque alerte portant une trace `{rule_id, computed_value, threshold, verdict, message}` (couture IA V2-C).

**Architecture:** Cœur pur `drift.py` ← knob `drift_threshold` + endpoint `/api/drift` ← UI carte + input seuil.

## Global Constraints

- Zéro LLM ; déterministe ; cœur pur sans I/O.
- Chaque alerte porte la trace `{rule_id, computed_value, threshold, verdict, message}`.
- Réutilise `portfolio` (`bucket_weights`, `crypto_weight`), config `invested`, `PUT /api/strategy`.
- Tests plain-assert dans `make test-unit`. Commits `--no-gpg-sign`, sans attribution IA.

---

### Task 1: Cœur pur `drift.py` (TDD)

**Files:** Create `web/api/drift.py`, `web/api/test_drift.py` ; Modify `Makefile`.

**Interfaces:** `drift_alerts(bucket_weights_actual, target_buckets, crypto_weight, crypto_cap, threshold=0.10) -> list[dict]`.

- [ ] **Step 1: Test (échoue)**

```python
# web/api/test_drift.py
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
```

- [ ] **Step 2: Lancer → FAIL.**

- [ ] **Step 3: Implémenter**

```python
# web/api/drift.py
"""Alertes de dérive déterministes (allocation vs cible, crypto vs cap). Zéro I/O,
zéro LLM. Chaque alerte porte une trace {rule_id, computed_value, threshold,
verdict, message} = payload de la narration IA V2-C/V3."""


def drift_alerts(bucket_weights_actual, target_buckets, crypto_weight, crypto_cap, threshold=0.10):
    alerts = []
    if crypto_weight > crypto_cap:
        alerts.append({
            "rule_id": "crypto_over_cap", "actual": crypto_weight, "cap": crypto_cap,
            "computed_value": round(crypto_weight, 4), "threshold": crypto_cap,
            "verdict": "over",
            "message": f"crypto à {crypto_weight:.0%} > plafond {crypto_cap:.0%}",
        })
    bucket_alerts = []
    for b in set(target_buckets) | set(bucket_weights_actual):
        actual = bucket_weights_actual.get(b, 0.0)
        target = target_buckets.get(b, 0.0)
        delta = round(actual - target, 4)
        if abs(delta) > threshold:
            bucket_alerts.append({
                "rule_id": "bucket_drift", "bucket": b, "actual": round(actual, 4),
                "target": round(target, 4), "delta": delta,
                "direction": "over" if delta > 0 else "under",
                "computed_value": round(abs(delta), 4), "threshold": threshold,
                "verdict": "drift",
                "message": f"{b} à {actual:.0%} vs cible {target:.0%} (écart {delta:+.0%})",
            })
    bucket_alerts.sort(key=lambda x: x["computed_value"], reverse=True)
    return alerts + bucket_alerts
```

- [ ] **Step 4: Lancer → OK.**

- [ ] **Step 5: Wire `Makefile`** : `\tcd web/api && python3 test_drift.py`.

- [ ] **Step 6: `make test-unit` vert.**

- [ ] **Step 7: Commit** `feat(api): pure allocation/crypto drift alerts with rule-trace`.

---

### Task 2: Knob `drift_threshold` + endpoint `/api/drift`

**Files:** Modify `web/api/main.py`.

- [ ] **Step 1: Modèle `InvestedEdit`** : ajouter `drift_threshold: float = Field(default=0.10, ge=0, le=1)`.

- [ ] **Step 2: Persistance dans `api_strategy_put`** : là où `inv[...]` est écrit, ajouter `inv["drift_threshold"] = edit.invested.drift_threshold`.

- [ ] **Step 3: Endpoint** (`import drift` en tête ; après `/api/loans` ou autres GET) :
```python
@app.get("/api/drift")
def api_drift():
    cfg = load_cfg()
    pf = fc.portfolio(cfg)
    inv = cfg.get("invested", {})
    return {"alerts": drift.drift_alerts(
        pf["bucket_weights"], inv.get("target_buckets", {}),
        pf["crypto_weight"], inv.get("crypto_cap", 0.10), inv.get("drift_threshold", 0.10))}
```

- [ ] **Step 4: Vérifier contre le stack** :
```bash
cd web/api && set -a && source ../../.env && set +a && ../../.venv/bin/python -c "import main,json; print(json.dumps(main.api_drift(),ensure_ascii=False))"
```
Expected: `{"alerts": [...]}` (live : selon l'allocation réelle vs cible). Pas d'exception. Coller dans le rapport.

- [ ] **Step 5: Commit** `feat(api): /api/drift endpoint + drift_threshold knob`.

---

### Task 3: UI — carte dérive + input seuil

**Files:** Modify `web/ui/src/lib/api.ts`, `web/ui/src/pages/Strategy.tsx`.

- [ ] **Step 1: api.ts — types + hook** :
```typescript
export interface DriftAlert {
  rule_id: string; message: string; computed_value: number; threshold: number;
  verdict: string; bucket?: string; direction?: string; actual?: number; target?: number; cap?: number; delta?: number;
}
export const useDrift = () =>
  useQuery({ queryKey: ["drift"], queryFn: () => get<{ alerts: DriftAlert[] }>("/api/drift") });
```

- [ ] **Step 2: Strategy.tsx — carte dérive + knob**
  - `import { useDrift } from "@/lib/api";` + `const drift = useDrift();`.
  - `FormState` gagne `driftThreshold: number` ; `toForm` : `driftThreshold: Math.round((s.invested.drift_threshold ?? 0.10) * 100)` ; `toPayload` invested : `drift_threshold: f.driftThreshold / 100`.
  - Ajouter un `<Field label="Seuil de dérive" suffix="%" value={f.driftThreshold} onChange={(n) => set({ driftThreshold: n })} />` près des autres champs invested.
  - Carte, après la section buckets :
```tsx
{drift.data && (
  <Card>
    <CardContent className="space-y-2 pt-6">
      <CardTitle>Dérive d'allocation</CardTitle>
      {drift.data.alerts.length === 0 ? (
        <p className="text-sm text-success">Allocation dans les clous ✓</p>
      ) : drift.data.alerts.map((a, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className={cn("h-2 w-2 rounded-full", a.rule_id === "crypto_over_cap" ? "bg-danger" : "bg-warning")} />
          <span className="text-muted-foreground">{a.message}</span>
        </div>
      ))}
    </CardContent>
  </Card>
)}
```
  (si `bg-warning`/`cn` absents dans Strategy.tsx : importer `cn` de `@/lib/utils` ; utiliser `bg-danger`/`text-muted-foreground` si `bg-warning` n'existe pas dans le thème — vérifier `tailwind`/`theme`, fallback `bg-danger`.)

- [ ] **Step 3: `cd web/ui && npx tsc --noEmit` → clean.**

- [ ] **Step 4: Commit** `feat(ui): allocation-drift card + drift threshold knob`.

---

## Notes

- Ordre 1→2→3. Dépend du fait que Task 2 de l'amortissement (rate) est déjà sur la branche (même fichiers `main.py`/`api.ts`/`Strategy.tsx` — exécuter l'amortissement AVANT la dérive sur la même branche évite tout conflit interne).
- Vérifier le nom de classe de couleur `warning` dans le thème ; fallback `danger`.
