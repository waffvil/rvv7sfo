// "Should I invest, and how much?" — fixed rules, all worked out on the phone. The savings figure never
// leaves the device. The owner's savings are money set aside purely to invest (no emergency buffer taken
// off — they keep that elsewhere). Rules (from HANDOVER §4/§12):
//   · 80% to the global index fund (the default home for money), 20% max in individual picks
//   · any one stock: at most 5% of the savings
//   · only a WORTH A LOOK gets an amount; WATCH / AVOID get £0
"use strict";

const SIZING = { corePct: 0.8, perStockPct: 0.05, minPick: 50 };

function roundDown(x, step) { return Math.max(0, Math.floor(x / step) * step); }

function sizePick(savings, verdict) {
  if (!(savings > 0)) return { ok: false, error: "Add your savings in the Savings & notifications section first." };
  const out = { ok: true, investable: savings };
  out.core = roundDown(savings * SIZING.corePct, 10);
  out.picksPot = roundDown(savings - out.core, 10);
  out.perStock = roundDown(savings * SIZING.perStockPct, 10);
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
