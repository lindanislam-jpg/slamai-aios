# TradePulse Pine Script indicators

Pine Script v6 indicators for TradingView, used on NAS100 15m (Capital.com).

| File | What it is |
|---|---|
| `beast_signal_engine_v25_locked.pine` | TradePulse Pro v2.1 - Beast Signal Engine (Locked). Current version. |
| `ict_engine_v28_locked.pine` | TradePulse Pro 3.1 - ICT Engine (Locked). Current version. |
| `beast_signal_engine_v24_original.pine` | Beast engine as it was before the 2026-11-03 patch. |
| `ict_engine_v27_original.pine` | ICT engine as it was before the 2026-11-03 patch. |

## What changed on 2026-11-03

- No moving "plan" levels. Entry, stop and targets only appear once a signal has fired and are locked at that price.
- Closed trades stay on the chart, faded grey at their original prices, with a result stamp in R.
- Dashboards gained RESULT, RECORD W-L-S and NET R rows.
- Result ledger uses a scale-out model: one third closed at TP1, TP2 and TP3; the open remainder closes at the original stop (-1R) or at the closing bar's price if the setup expired, was invalidated or reversed.
- Beast: minimum R:R default lowered from 2.0 to 1.5 (2.0 equalled TP2 and blocked every trade with a level below TP2); signal label no longer follows price; stray text removed from the end of the file.
- ICT: dashboard position input (default Middle Left); "Re-arm After Cooldown" input so a setup can print as soon as the cooldown ends if the confirmation chain still holds.

## Loading on TradingView

The Basic plan cannot save Pine scripts, so load each file by hand:

1. Open the Pine Editor, then the script name dropdown, then **Create new > Indicator**.
2. Select all in the editor and paste the file contents.
3. Click **Add to chart**. Always use a fresh "Create new" tab for the second script. Clicking Add to chart again on the same tab becomes "Update on chart" and overwrites the first indicator.
4. The ICT engine's **HTF Bias Timeframe** should be set to 60 to match the live setup; the default is 240.

The Basic plan allows two indicators per chart, so remove an old copy before adding a new one.
