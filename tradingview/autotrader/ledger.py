"""Append-only CSV ledger for every engine event and broker action."""
from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

FIELDS = ["logged_at", "bar_ts", "symbol", "event", "side", "grade", "score", "entry", "stop", "tp1", "tp2", "tp3",
          "r", "result", "deal_id", "size", "note"]


class Ledger:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            with self.path.open("w", newline="") as fh:
                csv.DictWriter(fh, fieldnames=FIELDS).writeheader()

    def write(self, **row) -> None:
        row.setdefault("logged_at", datetime.now(timezone.utc).isoformat(timespec="seconds"))
        with self.path.open("a", newline="") as fh:
            csv.DictWriter(fh, fieldnames=FIELDS, extrasaction="ignore").writerow(row)

    def summary(self) -> dict:
        out = {"closed": 0, "wins": 0, "losses": 0, "scratch": 0, "net_r": 0.0}
        if not self.path.exists():
            return out
        with self.path.open() as fh:
            for r in csv.DictReader(fh):
                if r["event"] in ("TP3", "SL", "BE", "REV"):
                    out["closed"] += 1
                    try:
                        x = float(r["r"] or 0)
                    except ValueError:
                        x = 0.0
                    out["net_r"] = round(out["net_r"] + x, 2)
                    if x > 0.1:
                        out["wins"] += 1
                    elif x < -0.1:
                        out["losses"] += 1
                    else:
                        out["scratch"] += 1
        return out


class State:
    """Tiny JSON state so a restart does not re-open a trade the broker already holds."""

    def __init__(self, path: Path):
        self.path = path
        self.data = {}
        if path.exists():
            try:
                self.data = json.loads(path.read_text())
            except Exception:
                self.data = {}

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.data, indent=1, default=str))

    def get(self, k: str, default=None):
        return self.data.get(k, default)

    def set(self, k: str, v) -> None:
        self.data[k] = v
        self.save()
