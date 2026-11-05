# TradePulse auto-trader (Capital.com demo)

Runs a Python port of the "TradePulse Pro 3.1 - ICT Engine (Locked)" Pine script
on Capital.com candles and executes the locked setups on the **demo** account,
thirds at TP1/TP2/TP3, stop never moved. Every event is written to a CSV ledger
so the 30-trade demo record fills itself.

## Setup (one time)

1. In Capital.com (demo account): Settings > API integrations > Generate API key.
   Set an API-key password when prompted. Copy the key.
2. `cp autotrader/.env.example autotrader/.env` and fill in the three values.
3. Install deps into the existing backend venv (httpx is already there):
   `backend/.venv/bin/pip install httpx`

## Commands (run from the `tradepulse` folder)

```bash
set -a; source autotrader/.env; set +a                     # load credentials into the shell
backend/.venv/bin/python -m autotrader.runner --symbol US100 --replay 2000   # verify the port on 2000 real bars
backend/.venv/bin/python -m autotrader.runner --symbol US100 --dry-run       # watch signals, no orders
backend/.venv/bin/python -m autotrader.runner --symbol US100                 # DEMO execution
backend/.venv/bin/python -m pytest autotrader/test_engine.py                  # offline tests
```

Symbols are Capital.com epics: `US100` (NAS100), `GOLD`, `US30`. The engine
applies the same market preset as the Pine script (NAS: 1h bias, 3 ATR stop cap;
gold: 4h, 4 ATR; US30: 4h, 2 ATR).

## What it does each 15-minute close

1. Pull new candles (15m plus the 1h/4h bias stream, daily for PDH/PDL).
2. Feed the closed bar to the engine; HTF values come from the last *closed* HTF
   bar, exactly like `request.security(..., lookahead_off)`.
3. On SETUP: size = (balance x risk%) / stop distance, split in three, three
   positions opened with the locked stop and TP1/TP2/TP3 as profit levels.
4. On TP1/TP2: nothing to do (the broker closes that third). On TP3/SL: the
   broker has closed everything; the ledger records R. On REV: close remaining.
5. Ledger: `autotrader/var/ledger_<symbol>.csv`. State: `var/state_<symbol>.json`.

## Guards

* Session 09:30-16:00 New York, max 3 setups and 2 losses per day, cooldown
  10 bars, falling-knife filter, stop cap per preset. Same as the Pine defaults.
* Refuses the LIVE endpoint unless `--live-endpoint` **and** `CAPITAL_ALLOW_LIVE=1`.
  Do not set that until the demo has passed the plan's criteria.
* Restart-safe: historical bars are replayed to warm up the engine without
  placing orders; only candles that close after start-up can trigger trades.

## Known differences from the Pine script

* Day boundaries use UTC for the daily guard and PDH/PDL rollover; the Pine
  script uses the exchange timezone. For NAS100 inside the NY session this does
  not change which trades fire.
* Supply/demand zone boxes, trendlines and the scanner are display-only in Pine
  and are not ported; they never gate a trade.
* Candle prices are mid (bid+ask)/2. The Pine chart on Capital.com also shows mid.
* Volume is not used by the ICT engine.

Run `--replay` on the same window the TradingView Strategy Tester used and
compare trade count and net R before trusting execution. Small differences in
ATR seeding and pivot ties are expected; a different sign or a 2x trade count
is not.
