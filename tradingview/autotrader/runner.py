"""TradePulse auto-trader: runs the ICT engine on Capital.com candles and
executes the locked setups on the DEMO account, thirds at TP1/TP2/TP3.

    python -m autotrader.runner --symbol US100 --dry-run      # signals only, no orders
    python -m autotrader.runner --symbol US100                # demo execution
    python -m autotrader.runner --symbol US100 --replay 2000  # replay last 2000 bars, print record

Execution model (matches the Pine ledger exactly):
  * one setup -> three equal positions, each with the locked stop; TP1/TP2/TP3
    as profitLevel on positions 1/2/3 respectively
  * nothing is ever moved; if the engine closes the trade (reversal), all
    remaining positions are closed at market
  * position size: (balance * risk%) / stop distance, split in three, floored
    to the market's minimum deal size

Safety: refuses to run against the LIVE endpoint unless --i-know-this-is-live
is passed AND CAPITAL_ALLOW_LIVE=1 is set. The demo is the point of this tool.
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional

from .capital import Candle, CapitalClient, from_env
from .htf import build_ctx
from .ict_engine import Bar, Engine, Event, Params, Trade, preset_for
from .ledger import Ledger, State

log = logging.getLogger("autotrader")
HERE = Path(__file__).resolve().parent
VAR = HERE / "var"


def to_bar(c: Candle) -> Bar:
    return Bar(c.ts, c.open, c.high, c.low, c.close)


class Feed:
    """Pulls and caches candles for the LTF plus every HTF the engine needs."""

    def __init__(self, client: CapitalClient, epic: str, bias_tf: int, fvg_tf: int):
        self.c, self.epic, self.bias_tf, self.fvg_tf = client, epic, bias_tf, fvg_tf
        self.ltf: List[Candle] = []
        self.bias: List[Candle] = []
        self.fvg: List[Candle] = []
        self.daily: List[Candle] = []
        self.weekly: List[Candle] = []

    def load(self, ltf_count: int) -> None:
        self.ltf = self.c.candles(self.epic, 15, ltf_count)
        htf_bars = max(60, ltf_count * 15 // self.bias_tf + 30)
        self.bias = self.c.candles(self.epic, self.bias_tf, htf_bars)
        self.fvg = self.bias if self.fvg_tf == self.bias_tf else self.c.candles(self.epic, self.fvg_tf, max(60, ltf_count * 15 // self.fvg_tf + 30))
        self.daily = self.c.candles(self.epic, 1440, 60)
        self.weekly = self._weekly_from_daily(self.daily)

    @staticmethod
    def _weekly_from_daily(daily: List[Candle]) -> List[Candle]:
        out: Dict[tuple, Candle] = {}
        for d in daily:
            k = d.ts.isocalendar()[:2]
            if k not in out:
                out[k] = Candle(d.ts, d.open, d.high, d.low, d.close, d.volume)
            else:
                w = out[k]
                w.high, w.low, w.close = max(w.high, d.high), min(w.low, d.low), d.close
        return [out[k] for k in sorted(out)]

    def refresh(self) -> List[Candle]:
        """Fetch latest; return LTF candles newer than the last one we have."""
        last = self.ltf[-1].ts if self.ltf else None
        new = self.c.candles(self.epic, 15, 40)
        fresh = [c for c in new if last is None or c.ts > last]
        if fresh:
            self.ltf.extend(fresh)
            self.bias = self.c.candles(self.epic, self.bias_tf, 120)
            self.fvg = self.bias if self.fvg_tf == self.bias_tf else self.c.candles(self.epic, self.fvg_tf, 120)
            if fresh[-1].ts.date() != (self.daily[-1].ts.date() if self.daily else None):
                self.daily = self.c.candles(self.epic, 1440, 60)
                self.weekly = self._weekly_from_daily(self.daily)
        return fresh


class Executor:
    def __init__(self, client: Optional[CapitalClient], epic: str, risk_pct: float, ledger: Ledger, state: State,
                 dry: bool, min_size: float = 0.1, size_step: float = 0.1):
        self.c, self.epic, self.risk_pct, self.ledger, self.state, self.dry = client, epic, risk_pct, ledger, state, dry
        self.min_size, self.size_step = min_size, size_step

    def _size(self, risk_points: float) -> float:
        bal = 10000.0 if (self.dry or self.c is None) else self.c.balance()
        total = (bal * self.risk_pct / 100.0) / max(risk_points, 1e-9)
        third = max(self.min_size, (total / 3) // self.size_step * self.size_step)
        return round(third, 2)

    def on_event(self, ev: Event, symbol: str) -> None:
        t = ev.trade
        base = dict(bar_ts=ev.bar.ts.isoformat(), symbol=symbol, event=ev.kind, side=t.side, grade=t.grade,
                    score=t.score, entry=t.entry, stop=t.sl, tp1=t.tp1, tp2=t.tp2, tp3=t.tp3)
        if ev.kind == "SETUP":
            size = self._size(abs(t.entry - t.sl))
            deals = []
            if not self.dry and self.c is not None:
                direction = "BUY" if t.side == "LONG" else "SELL"
                for tp in (t.tp1, t.tp2, t.tp3):
                    try:
                        conf = self.c.open_position(self.epic, direction, size, stop=t.sl, limit=tp)
                        deals.append(conf.get("dealId", ""))
                        log.info("opened %s %s size %s stop %s tp %s -> %s", direction, self.epic, size, t.sl, tp, conf.get("dealStatus"))
                    except Exception as e:  # keep going; ledger records what happened
                        log.error("open failed: %s", e)
                        deals.append("")
                self.state.set("open_deals", deals)
            self.ledger.write(**base, size=size, deal_id=",".join(deals), note="dry-run" if self.dry else "")
            log.info("SETUP %s %s grade %s score %s entry %.2f sl %.2f tp %.2f/%.2f/%.2f size %s%s",
                     symbol, t.side, t.grade, t.score, t.entry, t.sl, t.tp1, t.tp2, t.tp3, size, " (dry)" if self.dry else "")
        elif ev.kind in ("TP1", "TP2"):
            self.ledger.write(**base, note=f"{ev.kind} hit (broker closes that third via profitLevel)")
            log.info("%s hit on %s %s", ev.kind, symbol, t.side)
        else:  # TP3 / SL / BE / REV -> trade over
            if ev.kind == "REV" and not self.dry and self.c is not None:
                for d in self.state.get("open_deals", []) or []:
                    if d:
                        try:
                            self.c.close_position(d)
                        except Exception as e:
                            log.warning("close %s: %s", d, e)
            self.state.set("open_deals", [])
            self.ledger.write(**base, r=t.r, result=t.result)
            log.info("CLOSED %s %s -> %s %+.2fR", symbol, t.side, t.result, t.r)


def run_engine_over(engine: Engine, feed: Feed, bars: List[Candle], executor: Optional[Executor], symbol: str,
                    fvg_count: Optional[int] = None) -> int:
    for c in bars:
        ctx, fvg_count = build_ctx(c.ts, feed.bias, engine.p.htf_bias_tf, feed.fvg, engine.p.htf_fvg_tf, feed.daily, feed.weekly, fvg_count)
        for ev in engine.on_bar(to_bar(c), ctx):
            if executor is not None:
                executor.on_event(ev, symbol)
    return fvg_count


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description="TradePulse ICT auto-trader (Capital.com demo)")
    ap.add_argument("--symbol", default="US100", help="Capital.com epic, e.g. US100, GOLD, US30")
    ap.add_argument("--dry-run", action="store_true", help="signals + ledger only, no orders")
    ap.add_argument("--replay", type=int, default=0, help="replay the last N 15m bars and print the record, then exit")
    ap.add_argument("--warmup", type=int, default=600, help="historical 15m bars to seed the engine with")
    ap.add_argument("--live-endpoint", action="store_true", help="use the LIVE API (refused unless CAPITAL_ALLOW_LIVE=1)")
    ap.add_argument("--risk", type=float, default=1.0, help="risk per trade, %% of balance")
    ap.add_argument("--poll", type=int, default=20, help="seconds between candle polls")
    a = ap.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    if a.live_endpoint and os.environ.get("CAPITAL_ALLOW_LIVE") != "1":
        log.error("Refusing to use the LIVE endpoint without CAPITAL_ALLOW_LIVE=1. This tool is for demo testing.")
        return 2

    client = from_env(demo=not a.live_endpoint)
    client.login()
    _, _, preset = preset_for(a.symbol)
    params = Params(risk_pct=a.risk)
    engine = Engine(a.symbol, params)
    log.info("engine %s preset %s: HTF bias %sm, stop cap %.1f ATR, session %s-%s %s",
             a.symbol, preset, engine.p.htf_bias_tf, engine.p.max_stop_atr, engine.p.session_start, engine.p.session_end, engine.p.session_tz)

    feed = Feed(client, a.symbol, engine.p.htf_bias_tf, engine.p.htf_fvg_tf)
    feed.load(max(a.warmup, a.replay))
    log.info("loaded %d x 15m, %d x %dm, %d daily", len(feed.ltf), len(feed.bias), engine.p.htf_bias_tf, len(feed.daily))

    ledger = Ledger(VAR / f"ledger_{a.symbol}.csv")
    state = State(VAR / f"state_{a.symbol}.json")

    if a.replay:
        run_engine_over(engine, feed, feed.ltf[-a.replay:], None, a.symbol)
        rec = engine.record()
        print(f"\nREPLAY {a.symbol} last {a.replay} bars ({feed.ltf[-a.replay].ts:%Y-%m-%d} -> {feed.ltf[-1].ts:%Y-%m-%d})")
        print(f"  trades {len(engine.history)}  W-L-S {rec['wins']}-{rec['losses']}-{rec['scratch']}  net {rec['net_r']:+.2f}R")
        for t in engine.history[-15:]:
            print(f"  {t.opened:%m-%d %H:%M} {t.side:5s} {t.grade:2s} {t.score:3d} entry {t.entry:9.2f} sl {t.sl:9.2f} -> {t.result:3s} {t.r:+.2f}R")
        return 0

    # seed the engine on history WITHOUT executing (those trades already happened)
    fvg_n = run_engine_over(engine, feed, feed.ltf, None, a.symbol)
    engine.trade = None  # never carry a historical "open" trade into live execution
    log.info("warm-up done; historical record %s", engine.record())

    # live-ish loop: act only on NEW closed candles
    executor = Executor(client, a.symbol, a.risk, ledger, state, dry=a.dry_run)
    log.info("%s on %s (%s). Ctrl-C to stop.", "DRY RUN" if a.dry_run else "DEMO EXECUTION", a.symbol, "demo" if client.demo else "LIVE")
    try:
        while True:
            try:
                fresh = feed.refresh()
                if fresh:
                    # the newest candle from the API is usually still forming: only feed bars whose close time has passed
                    now = datetime.now(timezone.utc)
                    closed = [c for c in fresh if c.ts + timedelta(minutes=15) <= now]
                    forming = [c for c in fresh if c not in closed]
                    if forming:
                        feed.ltf = [c for c in feed.ltf if c not in forming]
                    if closed:
                        fvg_n = run_engine_over(engine, feed, closed, executor, a.symbol, fvg_n)
                        st = engine.status()
                        log.info("bar %s close %.2f struct %+d bull %d bear %d session %s trade %s",
                                 closed[-1].ts.strftime("%H:%M"), st["close"], st["struct"], st["bull"], st["bear"],
                                 st["in_session"], (st["trade"] or {}).get("side"))
            except Exception as e:
                log.exception("loop error: %s", e)
            time.sleep(a.poll)
    except KeyboardInterrupt:
        log.info("stopped. ledger %s", ledger.summary())
    finally:
        client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
