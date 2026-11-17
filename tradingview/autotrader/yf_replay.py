"""Independent replay of the ICT engine port on free Yahoo data.

No Capital.com, no TradingView. Third opinion on whether the engine makes money.
"""
import sys, warnings
warnings.filterwarnings("ignore")
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))

from datetime import timezone
import yfinance as yf
from autotrader.capital import Candle
from autotrader.ict_engine import Bar, Engine, Params
from autotrader.htf import build_ctx


def fetch(sym, interval, period):
    df = yf.download(sym, period=period, interval=interval, progress=False, auto_adjust=False)
    if df is None or df.empty:
        return []
    if hasattr(df.columns, "nlevels") and df.columns.nlevels > 1:
        df.columns = df.columns.get_level_values(0)
    out = []
    for ts, r in df.iterrows():
        ts = ts.to_pydatetime()
        ts = ts.astimezone(timezone.utc) if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
        try:
            o, h, l, c = float(r["Open"]), float(r["High"]), float(r["Low"]), float(r["Close"])
        except Exception:
            continue
        if any(x != x for x in (o, h, l, c)):   # NaN
            continue
        out.append(Candle(ts=ts, open=o, high=h, low=l, close=c, volume=0.0))
    return out


def resample(c15, minutes):
    """Bucket 15m candles into `minutes` bars, keyed on bucket start."""
    buckets, out = {}, []
    for c in c15:
        epoch = int(c.ts.timestamp())
        key = epoch - (epoch % (minutes * 60))
        b = buckets.get(key)
        if b is None:
            buckets[key] = [c.ts, c.open, c.high, c.low, c.close]
        else:
            b[2] = max(b[2], c.high); b[3] = min(b[3], c.low); b[4] = c.close
    from datetime import datetime
    for key in sorted(buckets):
        _, o, h, l, cl = buckets[key]
        ts = datetime.fromtimestamp(key, tz=timezone.utc)
        out.append(Candle(ts=ts, open=o, high=h, low=l, close=cl, volume=0.0))
    return out


def run(symbol, epic, use_session=True):
    c15 = fetch(symbol, "15m", "60d")
    if len(c15) < 300:
        print(f"{symbol}: only {len(c15)} bars, skipping"); return
    p = Params(use_session=use_session)
    eng = Engine(epic, p)
    bias = resample(c15, eng.p.htf_bias_tf)
    fvg  = resample(c15, 60)
    daily = resample(c15, 1440)
    weekly = resample(c15, 1440 * 7)

    prev_n = None
    setups = 0
    for c in c15:
        ctx, prev_n = build_ctx(c.ts, bias, eng.p.htf_bias_tf, fvg, 60, daily, weekly, prev_n)
        for ev in eng.on_bar(Bar(c.ts, c.open, c.high, c.low, c.close), ctx):
            if ev.kind == "SETUP":
                setups += 1

    rec = eng.record()
    days = (c15[-1].ts - c15[0].ts).days or 1
    closed = rec["wins"] + rec["losses"] + rec["scratch"]
    wr = (rec["wins"] / closed * 100) if closed else 0.0
    print(f"\n{symbol} as {epic}  (session filter {'ON' if use_session else 'OFF'})")
    print(f"  bars        {len(c15)}   {c15[0].ts:%Y-%m-%d} -> {c15[-1].ts:%Y-%m-%d}  ({days} days)")
    print(f"  setups      {setups}   ({setups/days:.2f} per day)")
    print(f"  closed      {closed}   W {rec['wins']}  L {rec['losses']}  scratch {rec['scratch']}")
    print(f"  win rate    {wr:.1f}%")
    print(f"  NET R       {rec['net_r']:+.1f}R")


if __name__ == "__main__":
    run("YM=F", "US30")
    run("^DJI", "US30")
    run("NQ=F", "US100")
