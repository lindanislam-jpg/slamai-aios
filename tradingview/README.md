# TradePulse Pine Script indicators

Pine Script v6 indicators for TradingView, used on NAS100 15m (Capital.com).

| File | What it is |
|---|---|
| `beast_signal_engine_v25_locked.pine` | TradePulse Pro v2.1 - Beast Signal Engine (Locked). Current version. |
| `ict_engine_v28_locked.pine` | TradePulse Pro 3.1 - ICT Engine (Locked). Current version. |
| `beast_strategy_v25.pine` | Strategy wrapper of the Beast engine for the Strategy Tester (same logic, thirds at TP1/2/3). |
| `ict_strategy_v28.pine` | Strategy wrapper of the ICT engine for the Strategy Tester. |
| `backtest_notes.md` | Backtest matrix (Aug-Nov 2026, NAS100 15m) and the chosen defaults. |
| `ledger_webhook.py` | FastAPI receiver for the JSON alerts; appends every trade event to `ledger.csv`. |
| `beast_signal_engine_v24_original.pine` | Beast engine as it was before the 2026-11-03 patch. |
| `ict_engine_v27_original.pine` | ICT engine as it was before the 2026-11-03 patch. |

## What changed on 2026-11-03

- No moving "plan" levels. Entry, stop and targets only appear once a signal has fired and are locked at that price.
- Closed trades stay on the chart, faded grey at their original prices, with a result stamp in R.
- Dashboards gained RESULT, RECORD W-L-S and NET R rows.
- Result ledger uses a scale-out model: one third closed at TP1, TP2 and TP3; the open remainder closes at the original stop (-1R) or at the closing bar's price if the setup expired, was invalidated or reversed.
- Beast: minimum R:R default lowered from 2.0 to 1.5 (2.0 equalled TP2 and blocked every trade with a level below TP2); signal label no longer follows price; stray text removed from the end of the file.
- ICT: dashboard position input (default Middle Left); "Re-arm After Cooldown" input so a setup can print as soon as the cooldown ends if the confirmation chain still holds.

## Round 2 (same day)

- Session filter (default on, 09:30-16:00 New York) in both engines. Backtests: trades outside the session were the losers.
- Breakeven-after-TP1 option in both (on for Beast where it was neutral, off for ICT where it hurt).
- ICT: stop capped at 3 ATR, HTF bias default 60, Setup Mode default Balanced, optional "Require Beast Bias Agreement" using the Beast engine's exported "Beast Bias" plot, JSON alert events for a webhook ledger.
- Beast: default score 85 and tick-volume scoring forced off (Capital.com CFDs report tick volume, which was dragging every score down).
- Backtest (3 months, 1% risk, spread modelled): Beast went from -1.0% / PF 0.80 to +1.69% / PF 1.99 (about 5 trades); ICT from +0.03% / PF 1.00 to +3.29% / PF 1.40 with 3.6% max drawdown (about 19 trades). Small samples; forward-test on demo first.

## Loading on TradingView

The Basic plan cannot save Pine scripts, so load each file by hand:

1. Open the Pine Editor, then the script name dropdown, then **Create new > Indicator**.
2. Select all in the editor and paste the file contents.
3. Click **Add to chart**. Always use a fresh "Create new" tab for the second script. Clicking Add to chart again on the same tab becomes "Update on chart" and overwrites the first indicator.
4. The ICT engine's **HTF Bias Timeframe** should be set to 60 to match the live setup; the default is 240.

The Basic plan allows two indicators per chart, so remove an old copy before adding a new one.

## Alerts and the Basic plan

TradingView Basic allows **0 technical alerts**, so no indicator alert can be saved on this account.
Both scripts are ready for alerts the moment the plan is upgraded (Essential gives 20 alerts and webhooks):

1. Alerts panel > Create alert > Condition = the indicator > **Any alert() function call**. One alert per engine covers every event (signal, TP1/TP2/TP3, stop, breakeven, expiry, invalidation, reversal) as JSON.
2. Put the `ledger_webhook.py` URL in the Webhook field to persist the record to `ledger.csv`.
3. The scripts also export plots `Alert Signal` (+1 long / -1 short on the signal bar) and `Alert Event` for plot-based alerts if ever needed.
