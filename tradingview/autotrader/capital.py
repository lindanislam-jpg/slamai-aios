"""Minimal Capital.com REST client (demo or live), synchronous, built on httpx.

Docs: https://open-api.capital.com/
Session tokens expire after 10 minutes of inactivity; `_ensure_session`
re-logs in transparently. Candle prices are mid (bid+ask)/2.
"""
from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Optional

import httpx

log = logging.getLogger("autotrader.capital")

DEMO_BASE = "https://demo-api-capital.backend-capital.com"
LIVE_BASE = "https://api-capital.backend-capital.com"

RESOLUTIONS = {1: "MINUTE", 5: "MINUTE_5", 15: "MINUTE_15", 30: "MINUTE_30", 60: "HOUR", 240: "HOUR_4", 1440: "DAY"}


@dataclass
class Candle:
    ts: datetime  # bar open time, UTC
    open: float
    high: float
    low: float
    close: float
    volume: float


class CapitalClient:
    def __init__(self, api_key: str, identifier: str, password: str, demo: bool = True, timeout: float = 20.0):
        self.base = DEMO_BASE if demo else LIVE_BASE
        self.demo = demo
        self.api_key = api_key
        self.identifier = identifier
        self.password = password
        self.cst: Optional[str] = None
        self.xst: Optional[str] = None
        self._last_call = 0.0
        self.http = httpx.Client(base_url=self.base, timeout=timeout)

    # ---- session ---------------------------------------------------------
    def login(self) -> None:
        r = self.http.post(
            "/api/v1/session",
            headers={"X-CAP-API-KEY": self.api_key, "Content-Type": "application/json"},
            json={"identifier": self.identifier, "password": self.password, "encryptedPassword": False},
        )
        if r.status_code >= 400:
            raise RuntimeError(f"Capital.com login failed: {r.status_code} {r.text[:200]}")
        self.cst = r.headers.get("CST")
        self.xst = r.headers.get("X-SECURITY-TOKEN")
        self._last_call = time.time()
        if not self.cst or not self.xst:
            raise RuntimeError("Capital.com session created but tokens missing")
        log.info("Capital.com session opened (%s)", "demo" if self.demo else "LIVE")

    def _ensure_session(self) -> None:
        if not self.cst or time.time() - self._last_call > 540:  # tokens die at 10 min idle
            self.login()

    def _hdr(self) -> Dict[str, str]:
        return {"X-CAP-API-KEY": self.api_key, "CST": self.cst or "", "X-SECURITY-TOKEN": self.xst or "",
                "Content-Type": "application/json"}

    def _req(self, method: str, path: str, **kw) -> httpx.Response:
        self._ensure_session()
        gap = time.time() - self._last_call
        if gap < 0.15:  # stay under the 10 req/s ceiling
            time.sleep(0.15 - gap)
        r = self.http.request(method, path, headers=self._hdr(), **kw)
        self._last_call = time.time()
        if r.status_code == 401:
            self.login()
            r = self.http.request(method, path, headers=self._hdr(), **kw)
            self._last_call = time.time()
        if r.status_code >= 400:
            log.error("%s %s -> %s %s", method, path, r.status_code, r.text[:300])
        r.raise_for_status()
        return r

    # ---- reference data --------------------------------------------------
    def search_markets(self, term: str) -> List[dict]:
        return self._req("GET", "/api/v1/markets", params={"searchTerm": term}).json().get("markets", [])

    def market(self, epic: str) -> dict:
        return self._req("GET", f"/api/v1/markets/{epic}").json()

    def accounts(self) -> List[dict]:
        return self._req("GET", "/api/v1/accounts").json().get("accounts", [])

    def balance(self) -> float:
        accs = self.accounts()
        for a in accs:
            if a.get("preferred"):
                return float(a["balance"]["balance"])
        return float(accs[0]["balance"]["balance"]) if accs else 0.0

    # ---- candles -----------------------------------------------------------
    def candles(self, epic: str, tf_minutes: int, count: int = 500) -> List[Candle]:
        res = RESOLUTIONS[tf_minutes]
        out: List[Candle] = []
        remaining = count
        to: Optional[str] = None
        while remaining > 0:
            params: Dict[str, object] = {"resolution": res, "max": min(1000, remaining)}
            if to:
                params["to"] = to
            data = self._req("GET", f"/api/v1/history/candles/{epic}", params=params).json()
            prices = data.get("prices", [])
            if not prices:
                break
            batch = []
            for p in prices:
                ts = datetime.strptime(p["snapshotTimeUTC"], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
                mid = lambda k: (p[k]["bid"] + p[k]["ask"]) / 2.0  # noqa: E731
                batch.append(Candle(ts, mid("openPrice"), mid("highPrice"), mid("lowPrice"), mid("closePrice"),
                                    float(p.get("lastTradedVolume", 0) or 0)))
            batch.sort(key=lambda b: b.ts)
            out = batch + out
            remaining -= len(batch)
            if len(prices) < int(params["max"]):
                break
            to = batch[0].ts.strftime("%Y-%m-%dT%H:%M:%S")
        seen = set()
        dedup = []
        for c in out:
            if c.ts not in seen:
                seen.add(c.ts)
                dedup.append(c)
        return dedup[-count:]

    # ---- positions ---------------------------------------------------------
    def positions(self) -> List[dict]:
        return self._req("GET", "/api/v1/positions").json().get("positions", [])

    def open_position(self, epic: str, direction: str, size: float, stop: Optional[float] = None,
                      limit: Optional[float] = None) -> dict:
        body: Dict[str, object] = {"epic": epic, "direction": direction.upper(), "size": size, "guaranteedStop": False}
        if stop is not None:
            body["stopLevel"] = round(stop, 2)
        if limit is not None:
            body["profitLevel"] = round(limit, 2)
        ref = self._req("POST", "/api/v1/positions", json=body).json()["dealReference"]
        time.sleep(0.3)
        return self.confirm(ref)

    def confirm(self, deal_reference: str) -> dict:
        return self._req("GET", f"/api/v1/confirms/{deal_reference}").json()

    def close_position(self, deal_id: str) -> dict:
        ref = self._req("DELETE", f"/api/v1/positions/{deal_id}").json()["dealReference"]
        time.sleep(0.3)
        return self.confirm(ref)

    def close(self) -> None:
        try:
            self._req("DELETE", "/api/v1/session")
        except Exception:
            pass
        self.http.close()


def from_env(demo: bool = True) -> CapitalClient:
    key = os.environ.get("CAPITAL_API_KEY", "")
    ident = os.environ.get("CAPITAL_IDENTIFIER", "")
    pw = os.environ.get("CAPITAL_PASSWORD", "")
    if not (key and ident and pw):
        raise RuntimeError("Set CAPITAL_API_KEY, CAPITAL_IDENTIFIER and CAPITAL_PASSWORD (see .env.example)")
    return CapitalClient(key, ident, pw, demo=demo)
