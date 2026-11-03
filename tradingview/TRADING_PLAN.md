# TradePulse trading plan (NAS100)

Written 2026-11-03 from the backtests in `pine/backtest_notes.md`. This is a rule set, not a promise of profit.

## Phase 0: demo first (minimum 4 weeks, 30 closed trades)
- Trade a demo account on Capital.com with the exact chart layout "TradePulse NAS100" (15m, both indicators, default inputs).
- Log every trade in a sheet: date, engine, side, entry, stop, TP1/2/3, result in R, screenshot. The dashboards' RECORD and NET R rows must match your sheet.
- Go live only if, after 30 trades: net R > 0, profit factor >= 1.2, max drawdown < 8%, and you followed every rule below without exception.

## Market and time
- NAS100 only. Backtests say the ICT engine is flat on US30 and gold with a 13% drawdown on gold.
- New York session only, 09:30-16:00 ET (the scripts block signals outside it). Skip the first 5 minutes after the open and the last 15 minutes before the close.
- No trades in the 30 minutes around FOMC, CPI, NFP or Nvidia/Apple/Microsoft earnings. The scripts cannot see news; you must.

## Which signal to take
- Primary: ICT engine setup (LONG/SHORT arrow with the locked box). Grade A or A+ preferred; grade B only when the Beast panel also shows the same bias.
- Secondary: Beast engine signal (STRONG/ELITE/BEAST label) when the ICT dashboard's CONFIRM row is not pointing the other way.
- Never take a signal if the two engines point in opposite directions.
- Enter only while the Beast panel's ENTRY row shows the green check or the ICT box is still at its printed entry. If price has run past 30% of the stop distance, the trade is gone. Do not chase.

## Risk
- 1% of account per trade. Position size = (account x 0.01) / (entry - stop distance). The ICT dashboard's POS SIZE row does this for a 10,000 account; change "Account Size" in its inputs to your real balance.
- Stop and targets are the locked levels on the chart. Never widen a stop.
- Exit one third at TP1, one third at TP2, one third at TP3. That is what the ledger and the backtests assume.
- Daily guard (built into both scripts): maximum 3 signals per day, stop after 2 losing trades in a day. When the panel says STOP FOR TODAY, close the platform.
- Weekly guard (manual): stop for the week after -4R or after 3 consecutive losing days.

## Review
- Every Friday: compare the sheet with the dashboards, note which engine and which setup type made or lost money, and whether every loss followed the rules.
- Monthly: re-run the strategy versions on the latest 3 months. If profit factor on the live window drops below 1.0 for two months, stop and re-tune.

## What this is not
- Not financial advice. Three months of backtest and a handful of trades per engine do not prove an edge. The plan exists so you find out cheaply on demo whether the edge is real.
