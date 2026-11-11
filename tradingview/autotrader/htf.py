"""Higher-timeframe context builder.

Reproduces what the Pine script gets from request.security(..., lookahead_off)
for the last CLOSED higher-timeframe bar, plus previous-day and previous-week
high/low, from plain candle lists.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from .capital import Candle
from .ict_engine import HtfCtx, ema_series


def _closed_before(cands: List[Candle], tf_minutes: int, ts: datetime) -> List[Candle]:
    """HTF candles whose close time is <= ts (i.e. fully closed when the LTF bar at ts closed)."""
    cut = ts + timedelta(minutes=15)  # ts is LTF bar OPEN; LTF close = ts + 15m
    return [c for c in cands if c.ts + timedelta(minutes=tf_minutes) <= cut]


def build_ctx(ts: datetime, htf_bias: List[Candle], bias_tf: int, htf_fvg: List[Candle], fvg_tf: int,
              daily: List[Candle], weekly: List[Candle], prev_fvg_count: Optional[int] = None) -> Tuple[HtfCtx, int]:
    ctx = HtfCtx()
    # EMA 9/21 on HTF closes, shifted one HTF bar back ([1] in Pine)
    hb = _closed_before(htf_bias, bias_tf, ts)
    if len(hb) >= 23:
        closes = [c.close for c in hb]
        e9 = ema_series(closes, 9)
        e21 = ema_series(closes, 21)
        ctx.bias_fast, ctx.bias_slow = e9[-2], e21[-2]
    # previous day / week high-low (lookahead_on in Pine = the completed previous period)
    d = [c for c in daily if c.ts.date() < ts.date()]
    if d:
        ctx.pdh, ctx.pdl = d[-1].high, d[-1].low
    wk = ts.isocalendar()[:2]
    w = [c for c in weekly if c.ts.isocalendar()[:2] < wk]
    if w:
        ctx.pwh, ctx.pwl = w[-1].high, w[-1].low
    # HTF FVG: Pine checks low[1] > high[3] on the HTF stream and fires once per new HTF bar
    hf = _closed_before(htf_fvg, fvg_tf, ts)
    n = len(hf)
    if n >= 4 and prev_fvg_count is not None and n > prev_fvg_count:
        b1, b3 = hf[-2], hf[-4]
        if b1.low > b3.high:
            ctx.fvg_new_bull = (b1.low, b3.high)
        if b1.high < b3.low:
            ctx.fvg_new_bear = (b3.low, b1.high)
    return ctx, n
