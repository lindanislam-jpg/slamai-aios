# TradePulse trading plan (demo only — no market has a demonstrated edge)

Rewritten 2026-11-17. The 2026-11-11 version recommended US30 as the Tier 1 demo
market on the strength of one Strategy Tester window. Two weeks of live ledger
data contradict it, and the two measurements cannot be reconciled. Until that is
resolved, **this plan authorises demo trading only.** It is a rule set, not a
promise of profit, and right now it is not even a claim of edge.

## STOP — what is and is not known (read before anything else)

**This section has been corrected twice on 2026-11-17. Treat every explanation
below as unconfirmed.** Two theories were raised and both were disproven by
direct observation on the same day. That record is kept here deliberately, so
nobody re-runs the dead ends.

### The one thing that is solid

The two Pine files generate trades identically. A full diff of
`ict_engine_v28_locked.pine` against `ict_strategy_v28.pine` shows the only
differences are the indicator/strategy header, four display-only defaults, the
BUY/SELL tag gating, `tradeKeep`, and the strategy bridge. Every line deciding
whether a trade fires is identical.

### The disagreement, still unexplained

| Measurement | Window | Trades | Per day | Result |
|---|---|---|---|---|
| Strategy Tester `ict_strategy_v28` (US30) | labelled Aug 2 – Nov 11 | 23 | ~0.2 | +1.95%, PF 1.64 |
| Indicator ledger (US30) | chart history | 26 | ~1.7 | **−9.3R, 4 W / 22 L** |

### Theories raised and KILLED — do not retry these

1. *"The tester only had two weeks of bars loaded, so the per-day maths was
   wrong."* **Disproven.** Loading the saved `TradePulse ICT Backtest` strategy
   and opening its List of Trades shows a first trade on **Sep 1, 2026** — about
   2.5 months of history. The Strategy Tester is not limited to two weeks.
2. *"TradingView counts each `strategy.exit` partial as its own trade, inflating
   the win rate."* **Disproven.** In the List of Trades each trade number carries
   exactly one Entry row and one Exit row with a single size. Varying sizes
   (1, 0.2, 1.4) come from percent-of-equity position sizing, not from splitting
   a position.

### What this means right now

No explanation for the sign disagreement survives contact with the evidence. The
frequency gap is real and unexplained. **No real money on this engine.**

The decisive test is an independent third implementation outside TradingView:
the Python port in `autotrader/` run with `--replay`. It is blocked on a
Capital.com demo API key in `autotrader/.env` (`CAPITAL_API_KEY` and
`CAPITAL_PASSWORD` are empty; only the identifier is filled in).

Also note, so it is not rediscovered: the saved `TradePulse ICT Backtest` script
is NOT a valid comparison — it runs Setup Mode `Early`, `All sessions`, 100%-of-
equity sizing, 100x leverage and pyramiding 1. Its numbers (+1.68%, PF 1.09,
28 trades, 28.6% profitable, Sep 1 – Nov 17) describe a different configuration
from the chart and must not be quoted as evidence for or against the engine.

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
