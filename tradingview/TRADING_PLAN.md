# TradePulse trading plan (US30)

Rewritten 2026-11-11 after the Strict-vs-Balanced test in `pine/backtest_notes.md`.
This is a rule set, not a promise of profit. It replaces the 2026-11-03 NAS100 plan;
what changed and why is at the bottom.

## Phase 0: demo first (minimum 4 weeks, 30 closed trades)
- Trade a demo account on Capital.com with the chart layout "TradePulse NAS100"
  (the layout keeps its old name; the symbol on it is US30), 15m, the single
  "TradePulse Pro 3.1 - ICT Engine (Locked)" indicator, Setup Mode **Balanced**.
- Log every trade in a sheet: date, side, entry, stop, TP1/2/3, result in R,
  screenshot. The dashboard's RECORD and NET R rows must match your sheet.
- Go live only if, after 30 closed trades: net R > 0, profit factor >= 1.2,
  max drawdown < 8%, and you followed every rule below without exception.
- Current demo record: 2 trades, 2 losses, -2R. The 30 starts from zero on US30.

## Market and time
- **Tier 1, demo now: US30, ICT engine only.** It was the only market in the
  2026-11-11 test with a result that looks like an edge: +1.95%, profit factor
  1.64, 56.5% win rate, 1.51% max drawdown over 23 trades (Aug 2 - Nov 11 2026,
  15m). The engine's Auto Market Preset applies the US30 settings on US30 / DJI /
  DOW / WS30 symbols: 4-hour bias, 2 ATR stop cap. 23 trades is a thin sample -
  this is the best of a weak field, not a proven edge.
- **Tier 2, only after the US30 demo passes, each with its own demo:**
  - NAS100. Backtest +0.68%, PF 1.08 over 60 trades - barely above water, and it
    **underperformed buy-and-hold** over the same window (+677 vs +1,246).
  - SPX500. Untested since the engine changed; treat as unknown, not as Tier 2.
- **Do not trade gold.** It lost in both Setup Modes on 2026-11-11: Balanced
  -1.76% / PF 0.73, Strict -2.35% / PF 0.29. The old "+12.2%, PF 2.5" gold result
  does not reproduce - different window and a different data feed. That number is
  stale and must not be used to justify a gold trade.
- No forex. Both engines lose 5-6% on EURUSD and GBPUSD.
- New York session only, 09:30-16:00 ET (the script blocks signals outside it).
  Skip the first 5 minutes after the open and the last 15 minutes before the close.
- No trades in the 30 minutes around FOMC, CPI, NFP or Nvidia/Apple/Microsoft
  earnings. The script cannot see news; you must.

## Which signal to take
The Beast engine has been removed from the chart. There is one engine and one
signal set, so there is no "do the two agree" test any more.
- **The signal is the LONG / SHORT triangle with the locked box.** Grade A or A+
  preferred; grade B only when the dashboard's CONFIRM row agrees and the R:R row
  is at least 1:1.5.
- The **BUY / SELL tag** marks the bar where the confirmation chain completed. With
  the tag floor at 60 it fires on the same bars as the triangle. A tag reading
  `· outside session` or `· day guard` is information only - **never trade it**.
- Enter only while price is still at the printed entry. If price has run past 30%
  of the stop distance, the trade is gone. Do not chase.
- The market scanner and the trendline / supply-demand drawings are switched off.
  They never gated a trade; their absence changes nothing about the signals.

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

## What changed on 2026-11-11, and why
- **Demo market moved from NAS100 to US30.** US30 was the only market that tested
  positive with a profit factor above 1.2.
- **Gold dropped entirely.** It lost in both modes; the old gold number was stale.
- **Setup Mode stays Balanced.** Strict (score floor 80) was tested on all three
  markets and was worse on every one - it removed winners as fast as losers.
- **Beast engine removed**, so all "both engines agree" rules are gone.

## What this is not
- Not financial advice. One ~3-month backtest window of 23 trades, tuned on the
  same data it was measured on, does not prove an edge. Every market tested was
  either slightly positive, flat, or losing. The plan exists so you find out
  cheaply on demo whether the edge is real - and it may not be.
