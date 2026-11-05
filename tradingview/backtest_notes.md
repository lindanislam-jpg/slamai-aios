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
- Beast: score 85, Force Volume Scoring OFF = on, session 09:30-16:00 New York = on, BE after TP1 = off (neutral in test; off so no level ever moves after a signal).
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

## Scanner markets sweep (15m, final defaults, NY session 09:30-16:00)
| Market | Beast | ICT |
|---|---|---|
| EURUSD | -0.51%, PF 0.73, 3/6 | -6.32%, PF 0.40, DD 8.9%, 7/36 |
| GBPUSD | -0.94%, PF 0.61, 4/9 | -5.14%, PF 0.65, DD 10.3%, 18/59 |
| SPX500 | +1.61%, PF 2.26, DD 1.1%, 5/10 | +2.44%, PF 1.15, DD 5.8%, 31/74 |

Verdict: both engines are index tools. Trade NAS100 (primary) and optionally SPX500/US30 with Beast only. Do not trade EURUSD or GBPUSD with either engine; forex would need its own session window, thresholds and a fresh backtest.

## Gold tuning (OANDA:XAUUSD 15m, Aug-Nov 2026), ICT engine
| Variant | PnL | Max DD | Profitable | PF |
|---|---|---|---|---|
| NAS100 defaults (HTF 60, Balanced, stop 3, session on) | +0.42% | 12.96% | 23/63 | 1.03 |
| stop 2 | -1.57% | 12.52% | 24/72 | 0.91 |
| stop 5 | +0.19% | 5.45% | 20/51 | 1.02 |
| stop 5 + Strict | -1.00% | 1.00% | 0/3 | 0 |
| stop 5 + Early | -1.45% | 5.46% | 21/59 | 0.88 |
| stop 5 + Balanced + session OFF | -3.09% | 13.05% | 46/117 | 0.89 |
| stop 5 + Balanced + session + HTF 240 | +11.36% | 2.78% | 30/53 | 2.38 |
| HTF 240 + stop 3 | +5.91% | 4.51% | 26/57 | 1.53 |
| HTF 240 + stop 4 | +12.17% | 2.78% | 31/54 | 2.51 |
| HTF 240 + stop 5, 30m chart | -5.18% | 17.29% | 38/76 | 0.81 |
| HTF 240 + stop 6 | +9.48% | 2.76% | 29/53 | 2.13 |

Stop cap 4-6 with HTF 240 is a plateau (+9.5% to +12.2%), so the result is not a single-point fluke. Chosen gold settings: HTF 240, stop cap 4, Balanced, session on, 15m only.

## Gold tuning, Beast engine
| Variant | PnL | Max DD | Profitable | PF |
|---|---|---|---|---|
| NAS100 defaults | +0.25% | 1.63% | 5/9 | 1.16 |
| score 80 | +0.31% | 3.36% | 10/18 | 1.08 |
| score 85, HTF 240 / 1D | +0.25% | 1.63% | 5/9 | 1.16 |

Beast adds nothing on gold. Gold is an ICT-only market.

## Market Preset (added to the ICT engine)
Input "Market Preset": Auto (default) / NAS100 / Gold / Custom. Auto applies the Gold settings on any XAU or GOLD symbol and the NAS100 settings elsewhere. Verified: Auto on XAUUSD reproduces +12.17% / PF 2.51; Auto on NAS100 reproduces the NAS100 result.

## US30 tuning (CAPITALCOM:US30 15m), ICT engine
| Variant | PnL | Max DD | Profitable | PF |
|---|---|---|---|---|
| NAS100 settings (HTF 60, stop 3) | -0.03% | 4.59% | 31/73 | 1.00 |
| HTF 240, stop 3 | +1.04% | 1.62% | 13/26 | 1.25 |
| HTF 240, stop 4 | -3.04% | 3.98% | 8/25 | 0.32 |
| HTF 240, stop 2.5 | +1.10% | 1.68% | 13/26 | 1.27 |
| HTF 240, stop 2 | +2.02% | 1.51% | 13/23 | 1.64 |
| HTF 240, stop 1.5 | +1.95% | 1.77% | 14/25 | 1.53 |
| HTF 120, stop 2 | -0.79% | 3.89% | 20/46 | 0.90 |

Chosen US30 preset: HTF 240, stop cap 2 (1.5 to 2.5 is the plateau; 4 breaks it). About 8 full trades in the window, so treat as provisional. Beast on US30 stays at its NAS100 settings (+2.04%, 5/5).
