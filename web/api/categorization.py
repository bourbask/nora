"""Jauge data-integrity : part de la dépense non catégorisée + plus grosses tx
non taggées. Cœur pur, aucune I/O."""

UNCATEGORIZED = "(sans catégorie)"


def coverage(expense_by_cat):
    total = round(sum(expense_by_cat.values()), 2)
    uncategorized = round(expense_by_cat.get(UNCATEGORIZED, 0.0), 2)
    ratio = round(uncategorized / total, 4) if total > 0 else 0.0
    return {"uncategorized": uncategorized, "total": total, "ratio": ratio}


def top_untagged(txs, n=5):
    untagged = [t for t in txs if not (t.get("category") or "")]
    untagged.sort(key=lambda t: t["amount"], reverse=True)
    return [{"date": t["date"], "amount": t["amount"], "description": t["description"]}
            for t in untagged[:n]]
