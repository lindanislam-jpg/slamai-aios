# TradePulse trading plan (demo only — the engine has no demonstrated edge)

Rewritten 2026-11-18, after ~500 trades across 26 markets measured outside
TradingView showed the entry signal is a coin flip on direction (49.7%
out-of-sample). Earlier versions of this plan recommended NAS100, then gold,
then US30, each on a single favourable backtest window. All three
recommendations are withdrawn.

This is a rule set for demo practice. It is not a claim that the system makes
money, because the evidence says it does not.

## STOP — the engine has no edge. Demo only, and probably not even that.

**Settled 2026-11-18.** Earlier versions of this section chased explanations for
why one backtest looked good. That question is now closed by a larger test: the
backtest was noise.

Across ~500 trades on 26 markets — indices, futures, crypto, single stocks,
ETFs, FX and grains — measured outside TradingView with
`autotrader/yf_replay.py`:

| Measure | Result |
|---|---|
| Direction, in-sample | 44.4% |
| Direction, out-of-sample #1 (132 trades) | 48.5% |
| Direction, out-of-sample #2 (189 trades) | **49.7%**, z = −0.07 |
| Net R, 8-market breadth test (119 trades) | **−31.7R**, 25% win rate |
| Five exit models | all negative |
| Confluence score as a quality ranking | no predictive power |

TP1 sits at +1R against a −1R stop, so direction is a symmetric bracket where a
coin flip scores 50%. The engine scores 49.7% on fresh data. **It flips a coin.**
A coin flip on a ±1R bracket loses exactly the trading costs.

This is not a bug, a setting, or a tuning problem. The implementation is sound —
non-repainting, honestly accounted, levels locked. The thesis is what fails.

### Leads that looked real and died out-of-sample — do not reopen

1. **"Invert the signal"** — 39.0% in-sample looked exploitable; 48.5% on fresh
   markets. Dead.
2. **"Half at TP1, half to TP3 makes +4.3R"** — a bug that charged only −0.5R to
   trades stopping out before TP1, which is 61% of them. Corrected: −31.7R.
3. **"The confluence score is anti-predictive"** — 47.5→40.0→35.0% in-sample
   reversed to 47.7→51.9→54.2% out-of-sample. All three pre-committed pass
   conditions failed.

Anything that looks promising in-sample must clear a pre-committed out-of-sample
test before it is believed. Three for three have failed so far.

### What this means

**No real money.** Not on US30, not on NAS100, not on gold, not on any market
tested. Demo is for learning the platform and the rules, not for validating an
edge that the data says is not there.

Making this profitable would require a different entry thesis. That is new
research, not repair.

## What is on the chart now (2026-11-19)

**TradePulse ICT is removed.** It had no edge (see the STOP section above), so
it no longer prints signals on this chart. The source is kept in
`ict_engine_v28_locked.pine` and can be re-added from the Pine Editor if ever
wanted.

**In its place: `reference_levels_v1.pine` — "TP Levels".** It marks facts and
does the sizing arithmetic. It makes NO prediction and has no signals, no score,
no arrows. What it draws:

| Item | What it is |
|---|---|
| PDH / PDL | the completed previous day's high and low |
| PWH / PWL | previous week's extremes (off by default) |
| ON High / Low | overnight range, between the close and the open |
| Open | where today's cash session began |
| Readout | ATR, stop distance at N ATR, cash at risk, **position size in units** |

The position-size line is the point of it: whatever you decide to trade, it tells
you how many units put exactly your chosen risk on the locked stop distance.

Known behaviours, so they are not mistaken for bugs:
* Daily and weekly levels use the COMPLETED prior period, so they never repaint
  and read identically on any chart timeframe. Verified: PDH showed 27,528.0 on
  both the 15m and the 1D chart.
* The overnight range and session open are built from this chart's own bars, so
  on daily and above they report "intraday only" rather than a wrong number.
* TradingView draws candles OVER the readout table. Its position is an input —
  move it when price moves into it.

### How to use it

There is no signal to wait for. You decide the trade. The levels tell you where
price has already been, and the readout tells you what a position costs.

## Market and time
- **No market is approved for real money.** All three tested markets are either
  losing, flat, or contradicted:
  - **US30** — the old Tier 1 pick. Strategy Tester said +1.95% / PF 1.64; the live
    ledger says −9.3R over 4 wins and 22 losses. Demo only, and only to gather
    data for the contradiction above.
  - **NAS100** — +0.68%, PF 1.08 over 60 trades, and it **underperformed
    buy-and-hold** over the same window (+677 vs +1,246). No edge demonstrated.
  - **Gold** — loses in both Setup Modes (Balanced −1.76% / PF 0.73, Strict
    −2.35% / PF 0.29). **Do not trade.** The old "+12.2%, PF 2.5" figure is stale
    and must never be used to justify a gold trade.
  - **SPX500** — untested since the engine changed. Unknown, not a tier.
- No forex. Both engines lose 5-6% on EURUSD and GBPUSD.
- New York session only, 09:30-16:00 ET. The script blocks signals outside it, and
  a trade can never open outside it — `longOK` / `shortOK` both require
  `inSession`. Skip the first 5 minutes after the open and the last 15 before the
  close.
- No trades in the 30 minutes around FOMC, CPI, NFP or Nvidia/Apple/Microsoft
  earnings. The script cannot see news; you must.

## Which signal to take

**There are none.** The engine that produced signals is off the chart because it
did not predict direction. TP Levels marks facts and never tells you to buy or
sell.

If you trade this chart, the decision is entirely yours. The plan's remaining
value is the risk discipline below — it applies to any trade you take, from any
source, including your own judgement.

## Risk
- 1% of account per trade. Position size = (account x 0.01) / stop distance. The
  dashboard's POS SIZE row assumes a 10,000 account; set "Account Size" in the
  inputs to your real balance.
- Stop and targets are the locked levels on the chart. Never widen a stop.
- Exit one third at TP1, one third at TP2, one third at TP3. That is what the
  ledger and the backtests assume.
- Daily guard (built in): maximum 3 signals per day, stop after 2 losing trades in
  a day. When the panel says STOP FOR TODAY, close the platform.
- Weekly guard (manual): stop for the week after -4R or after 3 consecutive losing
  days.

## Review
- Every Friday: compare the sheet with the dashboard, note which setup type made or
  lost money, and whether every loss followed the rules.
- Monthly: re-run `pine/ict_strategy_v28.pine` in the Strategy Tester on the latest
  3 months of US30. If profit factor drops below 1.0 for two months, stop and
  re-tune. Record the run in `pine/backtest_notes.md` with its date range.

## What changed on 2026-11-17
- **US30 is no longer recommended.** Two weeks of live ledger data (−9.3R, 4 W /
  22 L) contradict the single Strategy Tester window the recommendation rested on.
- **A contradiction was found and partly resolved** — see the STOP section. The
  two files generate trades identically (verified by full diff); the earlier
  "7.6x more often" claim was an arithmetic error and is withdrawn. What remains
  unresolved is that the two measurements disagree on the SIGN of the result.
- **BUY / SELL tags outside the session are now hidden** (`Only Inside The
  Session` = ON). They were never tradable — a trade cannot open outside the
  session — but they printed on the chart looking identical to real signals.
- Closed trades now keep their levels visible (`Keep Levels Visible After The
  Trade Closes`), so every past result can be traced.

## What changed on 2026-11-11
- Demo market moved from NAS100 to US30 (now reversed, see above).
- Gold dropped entirely; it lost in both modes.
- Setup Mode stays Balanced. Strict was tested on all three markets and was worse
  on every one — it removed winners as fast as losers.
- Beast engine removed, so all "both engines agree" rules are gone.

## What this is not
- Not financial advice. There is currently **no evidence this engine is
  profitable.** The one positive backtest is contradicted by live ledger data on
  the same market, and the two cannot be reconciled. Every market tested was
  slightly positive, flat, or losing. The honest position as of 2026-11-17 is
  that the edge is unproven and may not exist. The plan exists so you find that
  out on a demo account instead of with real money.
