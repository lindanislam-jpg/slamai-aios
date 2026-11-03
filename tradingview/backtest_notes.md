# Backtest notes (NAS100 15m, Capital.com, Aug 2 - Nov 3 2026, 1% risk/trade, 9-tick slippage per side, 20:1 margin)

## Beast Signal Engine strategy
| Variant | PnL | Max DD | Profitable | PF |
|---|---|---|---|---|
| Baseline (score 80, volume on, no session, no BE) | -1.00% | 4.30% | 13/37 (35%) | 0.80 |
| + session 09:30-16:00 NY | -0.43% | 2.50% | 6/18 (33%) | 0.77 |
| + BE after TP1 | -0.43% | 2.50% | 6/18 (33%) | 0.77 |
| + Force Volume Scoring OFF | +0.74% | 3.93% | 16/36 (44%) | 1.17 |
| score 70 (with above) | -2.68% | 4.15% | 14/42 (33%) | 0.59 |
| score 85 (with above) | +1.69% | 1.76% | 9/15 (60%) | 1.99 |
| score 85, session OFF | -0.42% | 4.20% | 12/33 (36%) | 0.90 |

"Profitable trades" counts partial exits (thirds), so 15 = about 5 full trades. Small sample.

## ICT Engine strategy (max stop cap 3 ATR unless noted)
| Variant | PnL | Max DD | Profitable | PF |
|---|---|---|---|---|
| Baseline (HTF 240 default, Early, no session) | +0.03% | 4.68% | 19/50 (38%) | 1.00 |
| HTF 60 (the live setting) | +1.25% | 10.17% | 58/148 (39%) | 1.05 |
| + session 09:30-16:00 NY | +3.65% | 5.33% | 37/86 (43%) | 1.29 |
| + BE after TP1 | +2.42% | 5.40% | 34/89 (38%) | 1.20 |
| stop cap 2 ATR (BE off) | -2.85% | 7.68% | 32/88 (36%) | 0.81 |
| stop cap 5 ATR | +2.75% | 3.65% | 30/71 (42%) | 1.21 |
| stop cap 3, Setup Mode Balanced | +3.29% | 3.57% | 27/58 (47%) | 1.40 |
| Setup Mode Strict | -0.60% | 2.22% | 3/10 (30%) | 0.93 |
| Balanced, re-arm OFF | +3.22% | 3.63% | 27/58 (47%) | 1.39 |

## Chosen defaults (baked into the files on 2026-11-03)
- Beast: score 85, Force Volume Scoring OFF = on, session 09:30-16:00 New York = on, BE after TP1 = on (neutral in test, kept for live protection).
- ICT: HTF bias 60, Setup Mode Balanced, session on, stop cap 3 ATR, BE off, re-arm on.
- Caveat: 3 months of 15m data, ~5 Beast trades and ~19 ICT trades. Treat as a first pass, not proof. Forward-test on a demo account before risking money.

## Robustness check (final defaults + daily guards: max 3 signals/day, stop after 2 losses/day)
### Beast
| Market / TF | PnL | Max DD | Profitable | PF |
|---|---|---|---|---|
| NAS100 15m (Aug-Nov 2026) | +1.69% | 1.76% | 9/15 | 1.99 |
| NAS100 30m | +1.90% | 2.32% | 14/33 | 1.45 |
| NAS100 1h (Jan-Nov 2026) | +1.07% | 1.00% | 5/12 | 1.75 |
| US30 15m | +2.04% | 0.65% | 5/5 | n/a (no losers) |
| XAUUSD 15m | +0.23% | 1.63% | 4/10 | 1.16 |
### ICT
| Market / TF | PnL | Max DD | Profitable | PF |
|---|---|---|---|---|
| NAS100 15m (Aug-Nov 2026) | +3.28% | 3.57% | 27/58 | 1.40 |
| NAS100 30m | +9.32% | 3.50% | 59/119 | 1.59 |
| NAS100 1h (HTF 60 = same TF, bias degenerate) | -1.22% | 3.20% | 18/58 | 0.84 |
| US30 15m | -0.03% | 4.59% | 31/73 | 1.00 |
| XAUUSD 15m | +0.42% | 12.96% | 23/63 | 1.03 |

Conclusion: ICT is a NAS100 tool (15m or 30m). Beast is weaker but consistent across markets. Do not run ICT on gold or US30 with these settings.
