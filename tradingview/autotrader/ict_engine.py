"""Python port of "TradePulse Pro 3.1 - ICT Engine (Locked)" (Pine v6).

Bar-by-bar, closed bars only, no lookahead. Mirrors the Pine logic that
decides trades: market structure (BOS/CHoCH on confirmed pivots), PDH/PDL
sweeps, fair value gaps (LTF + one HTF stream), displacement, order blocks,
premium/discount, HTF EMA bias, the 0-100 confluence score, the confirmation
chain, falling-knife filter, session filter, daily guard, cooldown/re-arm,
and the locked trade lifecycle with thirds at TP1/TP2/TP3.

Visual-only modules (supply/demand zone boxes, trendlines, scanner) are not
ported: they never gate a trade in the Pine script.

Everything is driven by `Engine.on_bar(bar, htf_ctx)`; the caller supplies
the higher-timeframe context (last CLOSED HTF bars) exactly as
request.security(..., lookahead_off) would.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, time as dtime, timedelta
from typing import Deque, List, Optional, Tuple
from collections import deque
from zoneinfo import ZoneInfo

INF = 99999


# ----------------------------------------------------------------------------
# config (defaults = the Pine defaults after the 2026-11-03 tuning)
# ----------------------------------------------------------------------------
@dataclass
class Params:
    swing_len: int = 5
    fvg_min_atr: float = 0.25
    max_fvg: int = 3
    htf_fvg_tf: int = 60
    ob_lookback: int = 10
    max_ob: int = 2
    disp_mult: float = 1.5
    setup_mode: str = "Balanced"   # Strict 80 / Balanced 60 / Early 45
    sl_model: str = "Swing"         # Swing | ATR
    sl_mult: float = 2.0
    sl_buffer_atr: float = 0.25
    conf_win: int = 30
    cooldown: int = 10
    confirm_only: bool = True
    rearm: bool = True
    knife_filter: bool = True
    use_session: bool = True
    session_start: dtime = dtime(9, 30)
    session_end: dtime = dtime(16, 0)
    session_tz: str = "America/New_York"
    max_trades_day: int = 3
    max_losses_day: int = 2
    be_after_tp1: bool = False
    # market preset values
    htf_bias_tf: int = 60
    max_stop_atr: float = 3.0
    risk_pct: float = 1.0

    @property
    def thresh(self) -> int:
        return {"Strict": 80, "Balanced": 60}.get(self.setup_mode, 45)


def preset_for(symbol: str) -> Tuple[int, float, str]:
    s = symbol.upper()
    if "XAU" in s or "GOLD" in s:
        return 240, 4.0, "GOLD"
    if any(k in s for k in ("US30", "DJI", "DOW", "WS30")):
        return 240, 2.0, "US30"
    return 60, 3.0, "NAS"


# ----------------------------------------------------------------------------
# data
# ----------------------------------------------------------------------------
@dataclass
class Bar:
    ts: datetime
    open: float
    high: float
    low: float
    close: float


@dataclass
class HtfCtx:
    """Last CLOSED higher-timeframe values, as request.security would hand them over."""
    bias_fast: Optional[float] = None   # EMA9 of HTF close, one HTF bar back
    bias_slow: Optional[float] = None   # EMA21 of HTF close, one HTF bar back
    pdh: Optional[float] = None         # previous day high
    pdl: Optional[float] = None
    pwh: Optional[float] = None
    pwl: Optional[float] = None
    fvg_new_bull: Optional[Tuple[float, float]] = None  # (top, bottom) if a NEW HTF bull FVG closed on this LTF bar
    fvg_new_bear: Optional[Tuple[float, float]] = None


@dataclass
class Box:
    top: float
    bottom: float


@dataclass
class Trade:
    side: str                 # LONG | SHORT
    grade: str
    score: int
    entry: float
    sl: float
    tp1: float
    tp2: float
    tp3: float
    opened: datetime
    open_bar: int
    tp1_hit: bool = False
    tp2_hit: bool = False
    closed: Optional[datetime] = None
    result: str = ""
    r: float = 0.0


@dataclass
class Event:
    kind: str                 # SETUP | TP1 | TP2 | TP3 | SL | BE | REV
    trade: Trade
    bar: Bar


# ----------------------------------------------------------------------------
# small helpers
# ----------------------------------------------------------------------------
def ema_series(values: List[float], n: int) -> List[float]:
    out: List[float] = []
    k = 2.0 / (n + 1)
    e = None
    for i, v in enumerate(values):
        if e is None:
            e = v
        else:
            e = v * k + e * (1 - k)
        out.append(e)
    return out


def rma(values: List[float], n: int) -> List[float]:
    out: List[float] = []
    a = 1.0 / n
    r = None
    for i, v in enumerate(values):
        if r is None:
            r = sum(values[: i + 1]) / (i + 1) if i + 1 < n else sum(values[i + 1 - n: i + 1]) / n
        else:
            r = a * v + (1 - a) * r
        out.append(r)
    return out


# ----------------------------------------------------------------------------
# the engine
# ----------------------------------------------------------------------------
class Engine:
    def __init__(self, symbol: str, p: Optional[Params] = None):
        self.symbol = symbol
        self.p = p or Params()
        htf, cap, _ = preset_for(symbol)
        self.p.htf_bias_tf = htf
        self.p.max_stop_atr = cap
        self.tz = ZoneInfo(self.p.session_tz)

        self.bars: List[Bar] = []
        self.tr: List[float] = []
        self.atr: float = 0.0
        self.closes: List[float] = []
        self.ema9: Optional[float] = None
        self.ema21: Optional[float] = None

        # structure
        self.sw_hi: Optional[float] = None
        self.sw_lo: Optional[float] = None
        self.sw_hi_used = True
        self.sw_lo_used = True
        self.struct_dir = 0
        self.range_hi: Optional[float] = None
        self.range_lo: Optional[float] = None

        # event recency (bars since; INF = never)
        self.since_ssl = INF
        self.since_bsl = INF
        self.since_bull_ch = INF
        self.since_bear_ch = INF
        self.since_bull_bs = INF
        self.since_bear_bs = INF
        self.since_disp_up = INF
        self.since_disp_dn = INF

        # sweeps once per day/week
        self.swept_pdh = self.swept_pdl = self.swept_pwh = self.swept_pwl = False
        self.cur_day: Optional[datetime] = None
        self.cur_week: Optional[Tuple[int, int]] = None

        # zones
        self.fvg_bull: Deque[Box] = deque()
        self.fvg_bear: Deque[Box] = deque()
        self.ob_bull: Deque[Box] = deque()
        self.ob_bear: Deque[Box] = deque()
        self.disp_hist: Deque[Tuple[bool, bool]] = deque(maxlen=3)

        # trade state
        self.trade: Optional[Trade] = None
        self.closed_bar: Optional[int] = None
        self.prev_long_ok = False
        self.prev_short_ok = False
        self.prev_can_setup = False
        self.trades_today = 0
        self.losses_today = 0
        self.history: List[Trade] = []

        # last-bar diagnostics
        self.bull_score = 0
        self.bear_score = 0
        self.confirm_l = False
        self.confirm_s = False
        self.in_session = False

    # ---- public --------------------------------------------------------------
    @property
    def bar_index(self) -> int:
        return len(self.bars) - 1

    def on_bar(self, bar: Bar, htf: HtfCtx) -> List[Event]:
        """Feed one CLOSED LTF bar. Returns the events it produced."""
        p = self.p
        self.bars.append(bar)
        i = self.bar_index
        events: List[Event] = []

        # ---- ATR(14), EMAs 9/21 --------------------------------------------------
        prev = self.bars[-2] if i >= 1 else None
        tr = bar.high - bar.low if prev is None else max(bar.high - bar.low, abs(bar.high - prev.close), abs(bar.low - prev.close))
        self.tr.append(tr)
        n = 14
        if i == 0:
            self.atr = tr
        elif i < n:
            self.atr = sum(self.tr) / len(self.tr)
        else:
            self.atr = (self.atr * (n - 1) + tr) / n
        atr = self.atr if self.atr > 0 else bar.close * 0.01
        self.ema9 = bar.close if self.ema9 is None else bar.close * (2 / 10) + self.ema9 * (1 - 2 / 10)
        self.ema21 = bar.close if self.ema21 is None else bar.close * (2 / 22) + self.ema21 * (1 - 2 / 22)
        is_long_ema = self.ema9 > self.ema21

        # ---- day / week rollover (chart timezone = UTC here; Pine uses exchange tz) --
        day = bar.ts.date()
        if self.cur_day != day:
            self.cur_day = day
            self.swept_pdh = self.swept_pdl = False
            self.trades_today = 0
            self.losses_today = 0
        wk = bar.ts.isocalendar()[:2]
        if self.cur_week != wk:
            self.cur_week = wk
            self.swept_pwh = self.swept_pwl = False

        # ---- market structure: confirmed pivots ------------------------------------
        L = p.swing_len
        bull_break = bear_break = False
        if i >= 2 * L:
            c = self.bars[i - L]
            window = self.bars[i - 2 * L: i + 1]
            if all(c.high >= b.high for b in window) and sum(1 for b in window if b.high == c.high) == 1:
                self.sw_hi = c.high
                self.sw_hi_used = False
                self.range_hi = c.high
            if all(c.low <= b.low for b in window) and sum(1 for b in window if b.low == c.low) == 1:
                self.sw_lo = c.low
                self.sw_lo_used = False
                self.range_lo = c.low
        if not self.sw_hi_used and self.sw_hi is not None and bar.close > self.sw_hi:
            bull_break = True
        if not self.sw_lo_used and self.sw_lo is not None and bar.close < self.sw_lo:
            bear_break = True
        bull_ch = bull_break and self.struct_dir == -1
        bull_bs = bull_break and self.struct_dir >= 0
        bear_ch = bear_break and self.struct_dir == 1
        bear_bs = bear_break and self.struct_dir <= 0
        if bull_break:
            self.sw_hi_used = True
            self.struct_dir = 1
        if bear_break:
            self.sw_lo_used = True
            self.struct_dir = -1

        # ---- liquidity sweeps ------------------------------------------------------
        bsl = ssl = False
        if htf.pdh is not None and not self.swept_pdh and bar.high > htf.pdh and bar.close < htf.pdh:
            bsl = True
            self.swept_pdh = True
        if htf.pdl is not None and not self.swept_pdl and bar.low < htf.pdl and bar.close > htf.pdl:
            ssl = True
            self.swept_pdl = True
        if htf.pwh is not None and not self.swept_pwh and bar.high > htf.pwh and bar.close < htf.pwh:
            bsl = True
            self.swept_pwh = True
        if htf.pwl is not None and not self.swept_pwl and bar.low < htf.pwl and bar.close > htf.pwl:
            ssl = True
            self.swept_pwl = True

        # ---- fair value gaps -------------------------------------------------------
        min_gap = atr * p.fvg_min_atr
        if i >= 2:
            b2 = self.bars[i - 2]
            if bar.low > b2.high and (bar.low - b2.high) >= min_gap:
                self._push(self.fvg_bull, Box(bar.low, b2.high))
            if bar.high < b2.low and (b2.low - bar.high) >= min_gap:
                self._push(self.fvg_bear, Box(b2.low, bar.high))
        if htf.fvg_new_bull:
            self._push(self.fvg_bull, Box(*htf.fvg_new_bull))
        if htf.fvg_new_bear:
            self._push(self.fvg_bear, Box(*htf.fvg_new_bear))
        for bx in list(self.fvg_bull):
            if bar.low <= bx.bottom:
                self.fvg_bull.remove(bx)
        for bx in list(self.fvg_bear):
            if bar.high >= bx.top:
                self.fvg_bear.remove(bx)

        # ---- displacement ------------------------------------------------------------
        body = abs(bar.close - bar.open)
        disp_up = body > atr * p.disp_mult and bar.close > bar.open
        disp_dn = body > atr * p.disp_mult and bar.close < bar.open
        self.disp_hist.append((disp_up, disp_dn))
        disp_up_recent = any(d[0] for d in self.disp_hist)
        disp_dn_recent = any(d[1] for d in self.disp_hist)

        # ---- order blocks ------------------------------------------------------------
        if bull_break and disp_up_recent:
            for j in range(1, p.ob_lookback + 1):
                if i - j < 0:
                    break
                bj = self.bars[i - j]
                if bj.close < bj.open:
                    self._push(self.ob_bull, Box(bj.high, bj.low), p.max_ob)
                    break
        if bear_break and disp_dn_recent:
            for j in range(1, p.ob_lookback + 1):
                if i - j < 0:
                    break
                bj = self.bars[i - j]
                if bj.close > bj.open:
                    self._push(self.ob_bear, Box(bj.high, bj.low), p.max_ob)
                    break
        for bx in list(self.ob_bull):
            if bar.close < bx.bottom:
                self.ob_bull.remove(bx)
        for bx in list(self.ob_bear):
            if bar.close > bx.top:
                self.ob_bear.remove(bx)

        # ---- premium / discount --------------------------------------------------------
        have_range = self.range_hi is not None and self.range_lo is not None and self.range_hi > self.range_lo
        eq = (self.range_hi + self.range_lo) / 2 if have_range else None
        in_discount = have_range and bar.close < eq
        in_premium = have_range and bar.close > eq

        # ---- HTF bias ----------------------------------------------------------------------
        htf_bull = htf.bias_fast is not None and htf.bias_slow is not None and htf.bias_fast > htf.bias_slow
        htf_bear = htf.bias_fast is not None and htf.bias_slow is not None and htf.bias_fast < htf.bias_slow

        # ---- recency counters ----------------------------------------------------------------
        def tick(v: int, hit: bool) -> int:
            return 0 if hit else (v + 1 if v < INF else INF)
        self.since_ssl = tick(self.since_ssl, ssl)
        self.since_bsl = tick(self.since_bsl, bsl)
        self.since_bull_ch = tick(self.since_bull_ch, bull_ch)
        self.since_bear_ch = tick(self.since_bear_ch, bear_ch)
        self.since_bull_bs = tick(self.since_bull_bs, bull_bs)
        self.since_bear_bs = tick(self.since_bear_bs, bear_bs)
        self.since_disp_up = tick(self.since_disp_up, disp_up)
        self.since_disp_dn = tick(self.since_disp_dn, disp_dn)
        W = p.conf_win

        # ---- confluence score --------------------------------------------------------------
        bull = 0
        bull += 20 if self.since_ssl <= W else 0
        bull += 15 if self.since_bull_ch <= W else 0
        bull += 10 if self.since_bull_bs <= W else 0
        bull += 15 if htf_bull else 0
        bull += 10 if self.fvg_bull else 0
        bull += 10 if self.ob_bull else 0
        bull += 10 if in_discount else 0
        bull += 10 if self.since_disp_up <= W else 0
        bear = 0
        bear += 20 if self.since_bsl <= W else 0
        bear += 15 if self.since_bear_ch <= W else 0
        bear += 10 if self.since_bear_bs <= W else 0
        bear += 15 if htf_bear else 0
        bear += 10 if self.fvg_bear else 0
        bear += 10 if self.ob_bear else 0
        bear += 10 if in_premium else 0
        bear += 10 if self.since_disp_dn <= W else 0
        self.bull_score, self.bear_score = bull, bear

        # ---- knife filter ------------------------------------------------------------------------
        app_move = (bar.close - self.bars[i - 5].close) / atr if i >= 5 else 0.0
        extreme = abs(app_move) >= 4
        knife_dn = p.knife_filter and extreme and app_move < 0
        knife_up = p.knife_filter and extreme and app_move > 0

        # ---- confirmation chain ------------------------------------------------------------------
        struct_ok_l = self.since_bull_ch <= W or self.since_bull_bs <= W
        struct_ok_s = self.since_bear_ch <= W or self.since_bear_bs <= W
        sweep_ok_l = self.since_bsl > W or self.since_ssl < self.since_bsl
        sweep_ok_s = self.since_ssl > W or self.since_bsl < self.since_ssl
        self.confirm_l = struct_ok_l and self.since_disp_up <= W and htf_bull and sweep_ok_l
        self.confirm_s = struct_ok_s and self.since_disp_dn <= W and htf_bear and sweep_ok_s

        # ---- session ---------------------------------------------------------------------------------
        local_t = bar.ts.astimezone(self.tz).time()
        self.in_session = (not p.use_session) or (p.session_start <= local_t < p.session_end)

        long_ok = self.in_session and bull >= p.thresh and self.struct_dir == 1 and is_long_ema \
            and (not p.confirm_only or self.confirm_l) and not knife_dn
        short_ok = self.in_session and bear >= p.thresh and self.struct_dir == -1 and not is_long_ema \
            and (not p.confirm_only or self.confirm_s) and not knife_up

        # ---- manage open trade ---------------------------------------------------------------------
        t = self.trade
        trade_rev = False
        if t is not None:
            eff_stop = t.entry if (p.be_after_tp1 and t.tp1_hit) else t.sl
            is_l = t.side == "LONG"
            hit_sl = bar.low <= eff_stop if is_l else bar.high >= eff_stop
            hit_tp3 = bar.high >= t.tp3 if is_l else bar.low <= t.tp3
            trade_rev = (not hit_sl and not hit_tp3) and (short_ok if is_l else long_ok)
            if not hit_sl and not t.tp1_hit and (bar.high >= t.tp1 if is_l else bar.low <= t.tp1):
                t.tp1_hit = True
                events.append(Event("TP1", t, bar))
            if not hit_sl and not t.tp2_hit and (bar.high >= t.tp2 if is_l else bar.low <= t.tp2):
                t.tp2_hit = True
                events.append(Event("TP2", t, bar))
            if hit_tp3 or hit_sl or trade_rev:
                self._close_trade(t, bar, hit_tp3, hit_sl, eff_stop == t.entry and hit_sl)
                events.append(Event("TP3" if hit_tp3 else ("BE" if (eff_stop == t.entry and hit_sl) else "SL") if hit_sl else "REV", t, bar))
                self.trade = None
                self.closed_bar = i

        # ---- new setup ---------------------------------------------------------------------------------
        guard_ok = (p.max_trades_day == 0 or self.trades_today < p.max_trades_day) and \
                   (p.max_losses_day == 0 or self.losses_today < p.max_losses_day)
        can_setup = self.trade is None and guard_ok and (trade_rev or self.closed_bar is None or (i - self.closed_bar) >= p.cooldown)
        rearm_now = p.rearm and can_setup and not self.prev_can_setup
        long_setup = long_ok and (not self.prev_long_ok or trade_rev or rearm_now) and can_setup
        short_setup = short_ok and (not self.prev_short_ok or trade_rev or rearm_now) and can_setup and not long_setup
        self.prev_long_ok, self.prev_short_ok, self.prev_can_setup = long_ok, short_ok, can_setup

        if long_setup or short_setup:
            is_l = long_setup
            entry = bar.close
            if p.sl_model == "Swing":
                if is_l:
                    sl = (self.sw_lo if (self.sw_lo is not None and self.sw_lo < entry) else entry - atr * p.sl_mult) - atr * p.sl_buffer_atr
                else:
                    sl = (self.sw_hi if (self.sw_hi is not None and self.sw_hi > entry) else entry + atr * p.sl_mult) + atr * p.sl_buffer_atr
            else:
                sl = entry - atr * p.sl_mult if is_l else entry + atr * p.sl_mult
            risk = abs(entry - sl) or atr * p.sl_mult
            if risk > atr * p.max_stop_atr:
                risk = atr * p.max_stop_atr
                sl = entry - risk if is_l else entry + risk
            sgn = 1 if is_l else -1
            score = bull if is_l else bear
            grade = "A+" if score >= 85 else "A" if score >= 70 else "B"
            t = Trade("LONG" if is_l else "SHORT", grade, score, entry, sl,
                      entry + sgn * risk, entry + sgn * risk * 2, entry + sgn * risk * 3, bar.ts, i)
            self.trade = t
            self.trades_today += 1
            events.append(Event("SETUP", t, bar))
        return events

    # ---- internals ---------------------------------------------------------------
    def _push(self, dq: Deque[Box], bx: Box, cap: Optional[int] = None) -> None:
        dq.append(bx)
        while len(dq) > (cap or self.p.max_fvg):
            dq.popleft()

    def _close_trade(self, t: Trade, bar: Bar, hit_tp3: bool, hit_sl: bool, be: bool) -> None:
        risk = abs(t.entry - t.sl) or self.atr
        r1 = abs(t.tp1 - t.entry) / risk
        r2 = abs(t.tp2 - t.entry) / risk
        r3 = abs(t.tp3 - t.entry) / risk
        t1 = t.tp1_hit or hit_tp3
        t2 = t.tp2_hit or hit_tp3
        banked = (r1 if t1 else 0) / 3 + (r2 if t2 else 0) / 3 + (r3 if hit_tp3 else 0) / 3
        open_fr = 1 - ((1 if t1 else 0) + (1 if t2 else 0) + (1 if hit_tp3 else 0)) / 3
        sgn = 1 if t.side == "LONG" else -1
        exit_r = (0.0 if be else -1.0) if hit_sl else (0.0 if hit_tp3 else (bar.close - t.entry) * sgn / risk)
        t.r = round(banked + open_fr * exit_r, 3)
        t.closed = bar.ts
        t.result = "TP3" if hit_tp3 else ("BE" if be else "SL") if hit_sl else "REV"
        if t.r < -0.1:
            self.losses_today += 1
        self.history.append(t)

    # ---- diagnostics --------------------------------------------------------------
    def status(self) -> dict:
        t = self.trade
        return {
            "bar": self.bars[-1].ts.isoformat() if self.bars else None,
            "close": self.bars[-1].close if self.bars else None,
            "struct": self.struct_dir, "bull": self.bull_score, "bear": self.bear_score,
            "confirm_l": self.confirm_l, "confirm_s": self.confirm_s, "in_session": self.in_session,
            "trade": None if t is None else {"side": t.side, "grade": t.grade, "entry": t.entry, "sl": t.sl,
                                              "tp1": t.tp1, "tp2": t.tp2, "tp3": t.tp3, "tp1_hit": t.tp1_hit, "tp2_hit": t.tp2_hit},
            "today": {"trades": self.trades_today, "losses": self.losses_today},
            "record": self.record(),
        }

    def record(self) -> dict:
        w = sum(1 for t in self.history if t.r > 0.1)
        l = sum(1 for t in self.history if t.r < -0.1)
        s = len(self.history) - w - l
        return {"wins": w, "losses": l, "scratch": s, "net_r": round(sum(t.r for t in self.history), 2)}
