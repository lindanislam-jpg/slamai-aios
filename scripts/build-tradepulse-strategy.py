#!/usr/bin/env python3
"""Generate the TradePulse Pro strategy (backtest) script from the indicator.

The signal engine lives in exactly one place - tradingview/TradePulsePro.pine,
between the ENGINE/VISUALS markers. This script wraps that same engine in a
strategy() declaration so the backtest and the live indicator can never drift
apart. Run it after any engine change:

    python3 scripts/build-tradepulse-strategy.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tradingview" / "TradePulsePro.pine"
DST = ROOT / "tradingview" / "TradePulseProStrategy.pine"


def between(text: str, start: str, end: str) -> str:
    a = text.index(start) + len(start)
    b = text.index(end)
    return text[a:b].strip("\n")


HEADER = '''//@version=6
// ============================================================================
//  TRADEPULSE PRO - BEAST STRATEGY (BACKTEST MODE)
//
//  GENERATED FILE - DO NOT EDIT BY HAND.
//  Source of truth: tradingview/TradePulsePro.pine
//  Regenerate with: python3 scripts/build-tradepulse-strategy.py
//
//  Exit model used for the score/regime statistics below:
//    single target TP2, full stop at SL, flat on invalidation or expiry.
//  That is a deliberately simple and pessimistic model. It does not scale out
//  at TP1 and it does not trail. Real results will differ. Nothing here is a
//  performance promise - it exists to answer one question honestly:
//  do higher TradePulse scores actually correspond to better setups on this
//  instrument and timeframe?
// ============================================================================
strategy("TradePulse Pro - Beast Strategy", shorttitle = "TradePulse Strategy", overlay = true, initial_capital = 10000, default_qty_type = strategy.percent_of_equity, default_qty_value = 10, commission_type = strategy.commission.percent, commission_value = 0.02, slippage = 2, calc_on_every_tick = false, process_orders_on_close = true, max_labels_count = 500, max_lines_count = 500, max_boxes_count = 500)
'''

TAIL = '''
// ----------------------------------------------------------------------------
// S1. ORDER EXECUTION
// ----------------------------------------------------------------------------
gBt = "BACKTEST"
btUseDateFilter = input.bool(false, "Limit Backtest Date Range", group = gBt)
btFrom = input.time(timestamp("01 Jan 2020 00:00 +0000"), "From", group = gBt)
btTo   = input.time(timestamp("01 Jan 2030 00:00 +0000"), "To",   group = gBt)
inWindow = not btUseDateFilter or (time >= btFrom and time <= btTo)

if longFire and inWindow
    strategy.entry("TP Long", strategy.long)
    strategy.exit("TP Long X", from_entry = "TP Long", stop = sigSL, limit = sigTP2, comment_loss = "SL", comment_profit = "TP2")
if shortFire and inWindow
    strategy.entry("TP Short", strategy.short)
    strategy.exit("TP Short X", from_entry = "TP Short", stop = sigSL, limit = sigTP2, comment_loss = "SL", comment_profit = "TP2")

// ----------------------------------------------------------------------------
// S2. PERFORMANCE BY SCORE BAND AND BY MARKET REGIME
//     Bucket layout: 0 = 80-89, 1 = 90-94, 2 = 95-100, 3 = ALL,
//                    4 = TRENDING, 5 = RANGING, 6 = BREAKOUT, 7 = OTHER
// ----------------------------------------------------------------------------
var array<float> btTrades = array.new<float>(8, 0.0)
var array<float> btWins   = array.new<float>(8, 0.0)
var array<float> btSumR   = array.new<float>(8, 0.0)
var array<float> btGrossW = array.new<float>(8, 0.0)
var array<float> btGrossL = array.new<float>(8, 0.0)
var array<float> btCumR   = array.new<float>(8, 0.0)
var array<float> btPeakR  = array.new<float>(8, 0.0)
var array<float> btMaxDD  = array.new<float>(8, 0.0)

f_btAdd(idx, r) =>
    array.set(btTrades, idx, array.get(btTrades, idx) + 1.0)
    if r > 0
        array.set(btWins, idx, array.get(btWins, idx) + 1.0)
        array.set(btGrossW, idx, array.get(btGrossW, idx) + r)
    else
        array.set(btGrossL, idx, array.get(btGrossL, idx) - r)
    array.set(btSumR, idx, array.get(btSumR, idx) + r)
    cum = array.get(btCumR, idx) + r
    array.set(btCumR, idx, cum)
    peak = math.max(array.get(btPeakR, idx), cum)
    array.set(btPeakR, idx, peak)
    array.set(btMaxDD, idx, math.max(array.get(btMaxDD, idx), peak - cum))

var bool   bkOpen   = false
var float  bkScore  = na
var string bkRegime = ""
var float  bkEntry  = na
var float  bkRisk   = na
var int    bkDir    = 0

if newSignal and inWindow
    bkOpen   := true
    bkScore  := sigScoreV
    bkRegime := regime
    bkEntry  := sigEntry
    bkRisk   := math.abs(sigEntry - sigSL)
    bkDir    := sigDir

float bkR = na
bool  bkClosed = false
if bkOpen
    if evSL
        bkR := -1.0
        bkClosed := true
    else if evT2
        bkR := bkRisk > 0 ? math.abs(sigTP2 - bkEntry) / bkRisk : 0.0
        bkClosed := true
    else if evInv or evExp
        bkR := bkRisk > 0 ? (bkDir == 1 ? (close - bkEntry) : (bkEntry - close)) / bkRisk : 0.0
        bkClosed := true

if bkClosed
    sIdx = bkScore >= beastTh ? 2 : bkScore >= eliteTh ? 1 : 0
    rIdx = bkRegime == "STRONG BULL" or bkRegime == "BULL" or bkRegime == "STRONG BEAR" or bkRegime == "BEAR" ? 4 : bkRegime == "RANGE" or bkRegime == "LOW VOLATILITY" ? 5 : bkRegime == "BREAKOUT" ? 6 : 7
    f_btAdd(sIdx, bkR)
    f_btAdd(3, bkR)
    f_btAdd(rIdx, bkR)
    bkOpen := false

f_pct(a, b) => b > 0 ? str.tostring(a / b * 100.0, "#.#") + "%" : "-"
f_avg(a, b) => b > 0 ? str.tostring(a / b, "#.##") : "-"
f_pf(w, l)  => l > 0 ? str.tostring(w / l, "#.##") : (w > 0 ? "inf" : "-")
f_num(x)    => str.tostring(x, "#")

showStats = input.bool(true, "Show Performance Table", group = gBt)
var table stats = table.new(position.bottom_right, 5, 11, border_width = 1, border_color = color.new(#2a2a35, 0), frame_width = 1, frame_color = color.new(#2a2a35, 0))

f_statCol(col, idx, headline) =>
    t  = array.get(btTrades, idx)
    w  = array.get(btWins, idx)
    sr = array.get(btSumR, idx)
    gw = array.get(btGrossW, idx)
    gl = array.get(btGrossL, idx)
    dd = array.get(btMaxDD, idx)
    table.cell(stats, col, 0, headline, text_color = color.white, text_size = size.tiny, bgcolor = color.new(#1c1c26, 0))
    table.cell(stats, col, 1, f_num(t),           text_color = color.white, text_size = size.tiny, bgcolor = color.new(#12121a, 0))
    table.cell(stats, col, 2, f_num(w),           text_color = color.white, text_size = size.tiny, bgcolor = color.new(#12121a, 0))
    table.cell(stats, col, 3, f_num(t - w),       text_color = color.white, text_size = size.tiny, bgcolor = color.new(#12121a, 0))
    table.cell(stats, col, 4, f_pct(w, t),        text_color = t > 0 and w / t >= 0.5 ? cBull : cBear, text_size = size.tiny, bgcolor = color.new(#12121a, 0))
    table.cell(stats, col, 5, f_avg(sr, t),       text_color = sr > 0 ? cBull : cBear, text_size = size.tiny, bgcolor = color.new(#12121a, 0))
    table.cell(stats, col, 6, f_pf(gw, gl),       text_color = gl > 0 and gw / gl >= 1 ? cBull : cBear, text_size = size.tiny, bgcolor = color.new(#12121a, 0))
    avgW = w > 0 ? gw / w : na
    avgL = (t - w) > 0 ? gl / (t - w) : na
    table.cell(stats, col, 7, na(avgW) or na(avgL) or avgL == 0 ? "-" : str.tostring(avgW / avgL, "#.##"), text_color = color.new(#9aa0b5, 0), text_size = size.tiny, bgcolor = color.new(#12121a, 0))
    table.cell(stats, col, 8, str.tostring(sr, "#.#"), text_color = sr > 0 ? cBull : cBear, text_size = size.tiny, bgcolor = color.new(#12121a, 0))
    table.cell(stats, col, 9, str.tostring(dd, "#.#"), text_color = color.new(#ffd54f, 0), text_size = size.tiny, bgcolor = color.new(#12121a, 0))

if showStats and barstate.islast
    table.cell(stats, 0, 0, "TRADEPULSE STATS", text_color = color.white, text_size = size.tiny, text_halign = text.align_left, bgcolor = color.new(#1c1c26, 0))
    labels = array.from("Trades", "Wins", "Losses", "Win Rate", "Expectancy (R)", "Profit Factor", "Avg Win / Avg Loss", "Total R", "Max DD (R)")
    for i = 0 to array.size(labels) - 1
        table.cell(stats, 0, i + 1, array.get(labels, i), text_color = color.new(#9aa0b5, 0), text_size = size.tiny, text_halign = text.align_left, bgcolor = color.new(#12121a, 0))
    f_statCol(1, 0, "80-89")
    f_statCol(2, 1, "90-94")
    f_statCol(3, 2, "95-100")
    f_statCol(4, 3, "ALL")
    table.cell(stats, 0, 10, "By regime (trades / avg R)", text_color = color.new(#9aa0b5, 0), text_size = size.tiny, text_halign = text.align_left, bgcolor = color.new(#1c1c26, 0))
    table.cell(stats, 1, 10, "TRND " + f_num(array.get(btTrades, 4)) + " / " + f_avg(array.get(btSumR, 4), array.get(btTrades, 4)), text_color = color.white, text_size = size.tiny, bgcolor = color.new(#1c1c26, 0))
    table.cell(stats, 2, 10, "RNG " + f_num(array.get(btTrades, 5)) + " / " + f_avg(array.get(btSumR, 5), array.get(btTrades, 5)), text_color = color.white, text_size = size.tiny, bgcolor = color.new(#1c1c26, 0))
    table.cell(stats, 3, 10, "BRK " + f_num(array.get(btTrades, 6)) + " / " + f_avg(array.get(btSumR, 6), array.get(btTrades, 6)), text_color = color.white, text_size = size.tiny, bgcolor = color.new(#1c1c26, 0))
    table.cell(stats, 4, 10, "OTH " + f_num(array.get(btTrades, 7)) + " / " + f_avg(array.get(btSumR, 7), array.get(btTrades, 7)), text_color = color.white, text_size = size.tiny, bgcolor = color.new(#1c1c26, 0))
'''


def main() -> None:
    src = SRC.read_text()
    engine = between(src, "// === ENGINE START ===", "// === ENGINE END ===")
    visuals = between(src, "// === VISUALS START ===", "// === VISUALS END ===")
    # The stats table sits bottom-right; if the user parks the dashboard there
    # too they can move it from the indicator settings.
    # The backtest exits the whole position at TP2, so the setup has to complete
    # there as well - otherwise the engine holds its one signal slot open while
    # the strategy is already flat, and the test silently reports fewer trades
    # than the indicator would actually produce.
    engine = engine.replace('completeAt   = input.string("TP3", "Setup Completes At"',
                            'completeAt   = input.string("TP2", "Setup Completes At"')
    out = HEADER + "\n" + engine + "\n\n" + visuals + "\n" + TAIL
    DST.write_text(out)
    print(f"wrote {DST.relative_to(ROOT)} ({len(out.splitlines())} lines)")


if __name__ == "__main__":
    main()
