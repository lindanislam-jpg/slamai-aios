"""Offline sanity tests for the ICT engine port: synthetic bars, no network."""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

from autotrader.ict_engine import Bar, Engine, HtfCtx, Params


def synth(n: int, seed: int = 7, start: float = 20000.0):
    rnd = random.Random(seed)
    ts = datetime(2026, 10, 1, 13, 30, tzinfo=timezone.utc)  # 09:30 New York (EDT)
    px = start
    bars = []
    for i in range(n):
        drift = 8 if (i // 60) % 2 == 0 else -8
        o = px
        c = o + drift + rnd.gauss(0, 25)
        h = max(o, c) + abs(rnd.gauss(0, 12))
        l = min(o, c) - abs(rnd.gauss(0, 12))
        bars.append(Bar(ts, o, h, l, c))
        px = c
        ts += timedelta(minutes=15)
    return bars


def test_runs_and_locks_levels():
    p = Params(use_session=False)
    e = Engine("US100", p)
    ctx = HtfCtx(bias_fast=1.0, bias_slow=0.0, pdh=20100, pdl=19900)
    setups = []
    for b in synth(800):
        for ev in e.on_bar(b, ctx):
            if ev.kind == "SETUP":
                setups.append((ev.trade.entry, ev.trade.sl, ev.trade.tp1, ev.trade.tp2, ev.trade.tp3))
            # levels must never change after the setup
            if e.trade is not None and setups:
                t = e.trade
                assert (t.entry, t.sl, t.tp1, t.tp2, t.tp3) == setups[-1]
    assert len(setups) > 0, "engine never produced a setup on synthetic trend data"
    rec = e.record()
    assert rec["wins"] + rec["losses"] + rec["scratch"] == len(e.history)


def test_session_filter_blocks_overnight():
    p = Params(use_session=True)
    e = Engine("US100", p)
    ctx = HtfCtx(bias_fast=1.0, bias_slow=0.0)
    overnight = 0
    for b in synth(800):
        for ev in e.on_bar(b, ctx):
            if ev.kind == "SETUP":
                lt = ev.bar.ts.astimezone(e.tz).time()
                if not (p.session_start <= lt < p.session_end):
                    overnight += 1
    assert overnight == 0


def test_daily_guard():
    p = Params(use_session=False, max_trades_day=1, cooldown=0)
    e = Engine("US100", p)
    ctx = HtfCtx(bias_fast=1.0, bias_slow=0.0)
    per_day = {}
    for b in synth(800):
        for ev in e.on_bar(b, ctx):
            if ev.kind == "SETUP":
                d = ev.bar.ts.date()
                per_day[d] = per_day.get(d, 0) + 1
    assert all(v <= 1 for v in per_day.values()), per_day


def test_presets():
    assert Engine("GOLD").p.htf_bias_tf == 240 and Engine("GOLD").p.max_stop_atr == 4.0
    assert Engine("US30").p.htf_bias_tf == 240 and Engine("US30").p.max_stop_atr == 2.0
    assert Engine("US100").p.htf_bias_tf == 60 and Engine("US100").p.max_stop_atr == 3.0


if __name__ == "__main__":
    test_runs_and_locks_levels(); test_session_filter_blocks_overnight(); test_daily_guard(); test_presets()
    print("all engine tests passed")
