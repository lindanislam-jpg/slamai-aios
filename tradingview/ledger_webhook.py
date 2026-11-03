"""
TradePulse ledger webhook receiver.

Receives the JSON alerts emitted by the Beast Signal Engine and the ICT Engine
(TradingView alert -> Webhook URL) and appends every event to ledger.csv so the
win/loss record survives chart reloads, layout changes and plan limits.

Run:
    pip install fastapi uvicorn
    uvicorn ledger_webhook:app --host 0.0.0.0 --port 8787

Then expose it (e.g. `ngrok http 8787` or a small VPS) and put the public URL
into the TradingView alert's "Webhook URL" field. Webhook alerts need a
TradingView Essential plan or higher; on Basic use email alerts instead and
paste them into ledger.csv by hand.

Set LEDGER_TOKEN to require a shared secret: the alert JSON must then include
"token": "<secret>" (add it to the message in the Pine f_json helper).
"""
from __future__ import annotations

import csv
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request

LEDGER = Path(os.environ.get("LEDGER_FILE", "ledger.csv"))
TOKEN = os.environ.get("LEDGER_TOKEN", "")
FIELDS = [
    "received_at", "source", "event", "symbol", "exchange", "timeframe",
    "direction", "side", "tier", "grade", "setup", "score", "entry", "stop",
    "tp1", "tp2", "tp3", "rr", "r", "net_r", "wins", "losses", "htf", "regime", "time",
]

app = FastAPI(title="TradePulse ledger")


def _append(row: dict) -> None:
    new = not LEDGER.exists()
    with LEDGER.open("a", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS, extrasaction="ignore")
        if new:
            w.writeheader()
        w.writerow(row)


@app.post("/tradepulse/ledger")
async def ledger(request: Request) -> dict:
    raw = await request.body()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(400, f"not JSON: {exc}") from exc
    if TOKEN and data.get("token") != TOKEN:
        raise HTTPException(403, "bad token")
    data["received_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    _append(data)
    return {"ok": True, "event": data.get("event"), "symbol": data.get("symbol")}


@app.get("/tradepulse/ledger")
def summary() -> dict:
    """Quick totals: trades closed, wins, losses and net R per engine."""
    if not LEDGER.exists():
        return {"trades": 0}
    out: dict[str, dict] = {}
    with LEDGER.open() as fh:
        for row in csv.DictReader(fh):
            src = row.get("source") or "?"
            s = out.setdefault(src, {"closed": 0, "wins": 0, "losses": 0, "net_r": 0.0})
            if row.get("event") in {"TP3_HIT", "STOP_HIT", "BREAKEVEN_HIT", "EXPIRED", "INVALIDATED", "REVERSAL"}:
                s["closed"] += 1
                try:
                    r = float(row.get("r") or 0)
                except ValueError:
                    r = 0.0
                s["net_r"] = round(s["net_r"] + r, 2)
                if r > 0.1:
                    s["wins"] += 1
                elif r < -0.1:
                    s["losses"] += 1
    return out
