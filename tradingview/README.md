# TradePulse Pro — Beast Signal Engine

Pine Script v6 confluence engine for TradingView. Works on crypto, forex, stocks,
ETFs, indices, futures and commodities — nothing in the core engine is hard-coded
to BTC or to any one instrument.

| File | What it is |
|---|---|
| `TradePulsePro.pine` | The indicator. This is the one you put on your chart and create alerts from. |
| `TradePulseProStrategy.pine` | Generated backtest version of the **same** engine. |
| `../scripts/build-tradepulse-strategy.py` | Regenerates the strategy file from the indicator. |

The strategy file is generated, never hand-edited. Change the engine in
`TradePulsePro.pine` (between the `ENGINE START` / `ENGINE END` markers) and run:

```bash
python3 scripts/build-tradepulse-strategy.py
```

## Install

1. TradingView → **Pine Editor** → *Open* → *New indicator*.
2. Paste the whole contents of `TradePulsePro.pine`, replacing what's there.
3. **Save**, then **Add to chart**.
4. Repeat with `TradePulseProStrategy.pine` as a *New strategy* if you want the backtest.

## How it decides

```
SCAN  →  ANALYZE  →  SCORE  →  CONFIRM  →  SIGNAL
```

A signal needs **all** of these, not any one of them:

1. A **market regime** that suits the setup (no trend-continuation entries in a
   range, no breakout entries in dead volatility).
2. One of four **entry triggers**: trend pullback, breakout, breakout retest,
   liquidity sweep.
3. A **Beast Score** at or above your minimum (default 80).
4. A logical stop and a **real** R:R at or above your minimum (default 1:2).
5. No **no-trade filter** firing.

### Beast Score (0–100)

| Component | Weight |
|---|---|
| Trend (EMA stack, price location, +DI/−DI) | 15 |
| Market structure (HH/HL/LH/LL, BOS, CHoCH) | 15 |
| Momentum (RSI, MACD, rate of change) | 10 |
| Volume (relative volume, expansion) | 10 |
| VWAP (position, reclaim/reject, slope) | 10 |
| Support / resistance (proximity, room to target) | 10 |
| Liquidity (equal highs/lows, sweeps, rejection) | 10 |
| Volatility (ATR percentile, expansion) | 10 |
| Multi-timeframe (HTF bias + HTF structure) | 10 |

Two things make this score honest rather than decorative:

- **Unavailable components are removed from the denominator, not scored as zero.**
  On a symbol without real volume, or on a daily chart where session VWAP is
  meaningless, those components report `n/a` in the dashboard and the remaining
  components are re-weighted. The engine never pretends it has data it doesn't.
- **Weights adapt to the regime.** In a range, support/resistance and liquidity
  matter more and trend matters less. In a breakout, volume and volatility matter
  more. The score is not a fixed checklist.

Bands: `<60` no trade · `60–69` watch · `70–79` developing · `80–89` strong ·
`90–94` elite · `95–100` beast. Nothing forces a score above 90.

### R:R is capped by real structure

TPs come from your R multiples, but the **R:R the engine reports and gates on** is
measured to the first real resistance (long) or support (short) standing in the
way. If a level sits between entry and TP2, the trade is judged on the distance to
that level, not on the pretty number. This is why some high-score setups still
print `⚠️ NO TRADE — Poor R:R (target blocked)`.

## ICT / Smart Money layer

Switched on by default (`Enable ICT Layer`). Everything below is confirmed on
bar close and uses no future data.

### What it detects

| Feature | Notes |
|---|---|
| **Fair value gaps** | Classic three-candle gap, confirmed on the close of the third candle. Filtered by minimum size in ATR and (by default) by whether a real displacement candle created it |
| **FVG mitigation** | `ACTIVE → TOUCHED → PARTIAL → FILLED`, plus `INVALIDATED` when price closes through the far side. Handling is configurable: remove, fade, or keep |
| **Order blocks** | The last opposing candle before displacement or a structure break — not every candle, and only where structure confirms it |
| **Draw-on liquidity** | PDH / PDL / PWH / PWL, taken from the last *closed* daily and weekly bar |
| **Liquidity raids** | A sweep is a raid *and* a rejection: price trades through the level and closes back on the original side. Trading through and staying there is a break, not a sweep |
| **Displacement** | Body size measured against ATR, so the same threshold means the same thing on gold, BTC, EURUSD and an index future |
| **Dealing range** | Built from the two most recent confirmed swings. Fibonacci 0 / .236 / .382 / .5 / .618 / .786 / 1, equilibrium at 0.5 |
| **Premium / discount** | Above equilibrium is premium, below is discount. A filter and a score input — never a trigger on its own |

### The execution model

A fifth setup type alongside trend pullback, breakout, retest and sweep:

```
liquidity raid  →  displacement  →  structure shift (CHoCH/BOS)  →  retrace into FVG or OB
```

Three modes:

- **Strict** — every leg, plus premium/discount alignment and HTF agreement
- **Balanced** (default) — the core legs, HTF must not oppose
- **Early** — sweep and structure shift, entered before the retrace completes

All four legs must land inside `ICT Sequence Window` bars of each other.

### Two scores, not one

- **Beast Score** — the overall grade. The ICT components (FVG, order block,
  premium/discount, displacement) are now four of its thirteen weighted inputs,
  worth 30 of the raw weight. Liquidity now counts previous-day and
  previous-week raids, not just swing sweeps.
- **ICT Score** — the smart-money read on its own, using the classic weights
  (sweep 20, CHoCH 15, BOS 10, HTF 15, FVG 10, OB 10, P/D 10, displacement 10).

Both appear on the dashboard. Neither is a probability of profit — they are
counts of conditions met. Every signal label carries the reason list, so you can
see exactly which legs fired and which didn't.

### Honest limits

- **Correlated components.** Sweep, CHoCH, BOS, order block and displacement all
  key off the same handful of swing pivots. They are not eight independent
  confirmations, and the score should not be read as if they were.
- **Object budget.** Pine allows 500 boxes, 500 lines and 500 labels per script.
  Active FVGs and order blocks are capped (6 and 3 by default) and mitigated
  zones are removed. Raise those caps and you will eventually hit the ceiling,
  at which point TradingView silently deletes the oldest drawings.
- **Not built, and not buildable in Pine:** position sizing against a real
  account balance, max daily loss, max simultaneous trades, max correlated
  exposure. An indicator cannot see your account or your other positions. That
  needs a broker connection, which is a different product.
- **Still to come (Phase 2):** HTF fair value gaps, inversion FVGs, the session
  engine, and stop-loss models anchored to the sweep / FVG / order block.

## Anti-repainting

- Signals confirm on **bar close** by default (`Confirm Signals On Bar Close`).
- `request.security()` uses `lookahead_off` and, by default, only **closed** HTF
  bars (`Use Only Closed HTF Bars`). Turning that off makes the HTF bias faster
  but it can change while the HTF candle is still forming.
- Swings use `ta.pivothigh` / `ta.pivotlow`, which confirm N bars after the fact.
  That's lag, not repainting — the levels never move once drawn.
- No future-referencing anywhere.
- Only two `request.security()` calls in total.

## Anti-spam

Cooldown in bars, one active setup at a time, and a full lifecycle
(`ACTIVE → TP1 → TP2 → TP3 / STOP HIT / INVALIDATED / EXPIRED`) so the engine
can't re-signal the same idea every candle.

## Alerts and webhooks

Two layers:

- **`alertcondition` entries** show up in TradingView's alert dialog:
  BEAST/ELITE/STRONG × LONG/SHORT, TP1/TP2/TP3 HIT, STOP LOSS HIT,
  SIGNAL INVALIDATED, SIGNAL EXPIRED, ANY SIGNAL. Their messages carry live
  values via `{{plot(...)}}` placeholders.
- **`alert()` JSON payload**, fired automatically on every signal and lifecycle
  event, ready for n8n / Make / Zapier / Telegram / Discord / your own API:

```json
{
  "source": "TradePulse Pro",
  "event": "SIGNAL",
  "symbol": "XAUUSD",
  "exchange": "OANDA",
  "timeframe": "60",
  "direction": "LONG",
  "tier": "BEAST",
  "setup": "LIQUIDITY SWEEP",
  "score": 94,
  "entry": 3702.11,
  "stop": 3673.5,
  "tp1": 3730.72,
  "tp2": 3759.33,
  "tp3": 3787.94,
  "rr": 2.0,
  "htf": "BULLISH",
  "regime": "BULL",
  "time": 1757944800000
}
```

To use it: create an alert on the indicator, choose condition
**"TradePulse Pro" → "Any alert() function call"**, tick *Webhook URL*, paste your
endpoint. Pine never executes trades — TradingView generates the signal, execution
is a separate system.

## Backtest mode — read this before you trust a number

The strategy file measures **one deliberately pessimistic model**: single target at
TP2, full stop at SL, flat on invalidation or expiry. No scaling out at TP1, no
trailing. It includes 0.02% commission and 2 ticks of slippage by default — change
these to match your broker before drawing any conclusion.

The stats table breaks results down by score band (80–89 / 90–94 / 95–100) and by
regime. It exists to answer one question: **do higher scores actually correspond to
better setups on this instrument and timeframe?** If they don't, the score needs
work — don't rationalise it.

Be aware of the usual traps:
- A backtest on one symbol and one timeframe is an anecdote, not evidence.
- 30 trades tells you close to nothing. Look for 100+ per score band.
- Every input you tune against the same history is overfitting.

**No claim of profitability is made anywhere in this repository.**

## Notes for specific markets

- **Forex and spot metals (e.g. OANDA XAUUSD):** the feed reports *tick* volume,
  not traded volume. It's a reasonable activity proxy, but if you'd rather it not
  influence the score at all, turn on `Force Volume Scoring OFF` — the 10 volume
  points are redistributed across the other components automatically.
- **Daily and higher timeframes:** session VWAP is switched off automatically and
  reported as `n/a`.
- **Illiquid symbols:** volume reliability is checked over a rolling window; if
  most bars have no volume the component turns itself off.

## Settings worth touching first

| Setting | Why |
|---|---|
| `Minimum Signal Score` | The single biggest quality/quantity dial. Raise to 88–90 for far fewer, stronger signals. |
| `Minimum Bars Between Signals` | Raise it if the chart still feels busy. |
| `Tuning Mode` | `Scalp` = EMA 9/21 + RSI 55/45. `Swing` = EMA 20/50 + RSI 60/40. `Balanced` = your manual values. |
| `Higher Timeframe 1 / 2` | Rule of thumb: 4×–6× your chart timeframe. On 15m use 1H and 4H. |
| `Minimum R:R` | Nothing below 1:2 should reach your chart. |

## Disclaimer

This is decision-support software, not financial advice. It does not predict the
future and it does not guarantee profits. Trading carries the risk of substantial
loss. You are responsible for every order you place.
