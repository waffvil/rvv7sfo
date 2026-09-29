// "Should I invest, and how much?" — fixed rules, all worked out on the phone. The savings figure never
// leaves the device. Rules (from HANDOVER §4/§12):
//   · keep an emergency buffer of 6 months' essential spending — never invested
//   · of the rest: 80% to the global index fund (the default home for money), 20% max in individual picks
//   · any one stock: at most 5% of the invested money
//   · only a WORTH A LOOK gets an amount; WATCH / AVOID get £0
"use strict";

const SIZING = { bufferMonths: 6, corePct: 0.8, perStockPct: 0.05, minPick: 50 };

function roundDown(x, step) { return Math.max(0, Math.floor(x / step) * step); }

function sizePick(savings, monthly, verdict) {
  const out = { ok: false };
  if (!(savings > 0) || !(monthly > 0)) return { ok: false, error: "Enter your savings and monthly spending." };
  const buffer = monthly * SIZING.bufferMonths;
  const investable = Math.max(0, savings - buffer);
  out.ok = true;
  out.buffer = buffer;
  out.investable = investable;
  out.core = roundDown(investable * SIZING.corePct, 10);
  out.picksPot = roundDown(investable - out.core, 10);
  out.perStock = roundDown(investable * SIZING.perStockPct, 10);
  if (investable <= 0) {
    out.answer = "no";
    out.amount = 0;
    out.headline = "Don't invest yet — build your emergency buffer first.";
    return out;
  }
  if (verdict !== "worth_a_look") {
    out.answer = "no";
    out.amount = 0;
    out.headline = verdict === "avoid"
      ? "Don't buy this one — it looks cheap for a reason."
      : "Not now — wait until it's WORTH A LOOK.";
    return out;
  }
  if (out.perStock < SIZING.minPick) {
    out.answer = "index";
    out.amount = 0;
    out.headline = `Your picks limit is under £${SIZING.minPick} — put it in the global index instead.`;
    return out;
  }
  out.answer = "yes";
  out.amount = out.perStock;
  out.headline = `Up to £${out.perStock.toLocaleString("en-GB")} in this stock.`;
  return out;
}

if (typeof module !== "undefined") module.exports = { sizePick, SIZING };
