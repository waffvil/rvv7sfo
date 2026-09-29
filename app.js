// Renders data/today.json (written each weekday by the briefing job). No framework, no build step.
// Every piece of text from the data goes in via textContent — headlines come from outside sources.
"use strict";

const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (typeof v === "function") n[k] = v;
    else n.setAttribute(k, v);
  }
  for (const c of children) if (c != null) n.append(c);
  return n;
}

const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : null);
const DIR = { up: ["▲", "up"], down: ["▼", "down"], flat: ["→", "flat"] };

function fmtDate(iso) {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function pct(v) {
  return `${v >= 0 ? "▲" : "▼"} ${Math.abs(v).toFixed(1)}%`;
}

function renderHeader(d) {
  $("date").textContent = fmtDate(d.data_date || d.trading_day);
  const mode = $("mode");
  mode.hidden = false;
  mode.textContent = d.mode === "active" ? "⚡ Active session" : "Quiet session";

  if (d.alerts && d.alerts.length) {
    const a = $("alert");
    a.hidden = false;
    a.replaceChildren(el("strong", { text: "⚡ Big day: " }), d.alerts.join(" · "));
  }
  const notes = [];
  if (d.stale) {
    notes.push(`Markets were closed on ${fmtDate(d.trading_day)} — data is from ${fmtDate(d.data_date)}.`);
  }
  // Weekend gaps are normal; more than ~3.5 days without an update means the daily job has stopped.
  const ageH = (Date.now() - new Date(d.generated_at).getTime()) / 36e5;
  if (ageH > 84) notes.push(`This briefing is from ${fmtDate(d.generated_at.slice(0, 10))} — no newer one has arrived.`);
  if (notes.length) { $("stale").hidden = false; $("stale").textContent = notes.join(" "); }
}

const VERDICT = { worth_a_look: ["WORTH A LOOK", "good"], watch: ["WATCH", "watch"], avoid: ["AVOID – cheap for a reason", "bad"] };
const RESULT = { pass: ["✓", "up"], fail: ["✗", "down"], unclear: ["?", "flat"] };

function renderPicks(d) {
  const p = d.picks || { status: "unavailable", items: [] };
  const empty = $("picks-empty");
  if (p.status !== "ok") {
    empty.textContent = "Couldn't check the watched stocks today. Your core index plan is the default.";
    return;
  }
  const n = p.items.length;
  const count = (v) => p.items.filter((i) => i.verdict === v).length;
  const worth = count("worth_a_look");
  $("picks-title").textContent = worth ? `${worth} thing${worth === 1 ? "" : "s"} worth a look` : "Nothing worth a look today";
  if (n) {
    const parts = [[worth, "worth a look"], [count("watch"), "to watch"], [count("avoid"), "to avoid"]]
      .filter(([k]) => k).map(([k, t]) => `${k} ${t}`);
    $("picks-count").hidden = false;
    $("picks-count").textContent = `${parts.join(" · ")} · checked ${p.checked} stocks`;
  }
  if (!n) {
    empty.textContent = `Checked ${p.checked} stocks — none has dipped enough to look at. Your core index plan is the default.`;
  } else {
    empty.hidden = true;
    const box = $("picks-grid");
    box.hidden = false;
    p.items.forEach((it) => {
      const [label, cls] = VERDICT[it.verdict] || [it.verdict, "neutral"];
      const card = el("button", { class: "pick", type: "button" },
        el("div", { class: "ph" }, el("span", { class: "tk", text: it.ticker }),
          el("strong", { class: it.pct >= 0 ? "up" : "down", text: pct(it.pct) })),
        el("div", { class: "sub", text: `${it.name} · ${it.theme} · ${it.pct_label}` }),
        el("span", { class: `chip ${cls}`, style: "align-self:flex-start", text: label }),
        el("div", { style: "font-size:12px;line-height:1.4", text: it.reason }));
      card.onclick = () => openPick(it);
      box.append(card);
    });
  }
  const l = d.ledger || {}, s = $("ledger");
  const sign = (v) => `${v >= 0 ? "+" : ""}${v}%`;
  if (l.status === "ok") {
    s.hidden = false;
    s.replaceChildren("Picks vs global index: ", el("strong", { text: `${sign(l.picks_pct)} vs ${sign(l.index_pct)}` }),
      ` (${l.beat} of ${l.count} ahead)`);
  } else if (l.status === "started") {
    s.hidden = false;
    s.textContent = `Scoring ${l.count} pick${l.count === 1 ? "" : "s"} vs the index from tomorrow`;
  }
}

function openPick(it) {
  const [label, cls] = VERDICT[it.verdict] || [it.verdict, "neutral"];
  const body = $("pick-body");
  body.replaceChildren(
    el("h2", { text: it.name === it.ticker ? it.ticker : `${it.ticker} · ${it.name}` }),
    el("span", { class: `chip ${cls}`, style: "margin-top:6px", text: label }),
    el("div", { class: "sub", style: "margin-top:4px",
      text: `${it.theme} · ${pct(it.pct)} ${it.pct_label} · ${Math.abs(it.from_high52).toFixed(0)}% below its 1-year high` }),
    el("p", { class: "narr", text: it.reason }),
    ...it.checks.map((c) => {
      const [mark, mcls] = RESULT[c.result] || RESULT.unclear;
      return el("div", { class: "wrow" }, el("span", { class: `d ${mcls}`, text: mark }),
        el("div", { class: "x" }, el("strong", { text: c.name }), el("br"), el("span", { text: c.text })));
    }),
    el("div", { class: "sub", style: "margin:12px 0 4px", text: "Headlines" }),
    ...(it.headlines.length ? it.headlines.map((h) => {
      const url = safeUrl(h.url);
      return el(url ? "a" : "div", url ? { class: "nrow", href: url, target: "_blank", rel: "noopener noreferrer" } : { class: "nrow" },
        el("span", { class: "t", text: h.title }), el("span", { class: "s", text: [h.source, h.published].filter(Boolean).join(" · ") }));
    }) : [el("div", { class: "sub", text: "No recent headlines found." })]),
    el("p", { class: "sub", style: "margin-top:12px",
      text: "Or: the same money in the global index fund (VWRP) already includes most of these companies. These rules are new and unproven — the ledger tracks whether they beat the index." }),
    investForm(it));
  showSheet();
}

function showSheet() {
  $("pick-sheet").hidden = false;
  document.body.classList.add("locked");
  $("pick-sheet").scrollTop = 0;
}

const NEWS_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h13v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v10a2 2 0 0 1-2 2"/><path d="M7 9h7M7 13h7M7 17h4"/></svg>';

function openNews(n) {
  const [dot, cls] = DIR[n.direction] || DIR.flat;
  const mood = { up: ["GOOD FOR MARKETS", "good"], down: ["BAD FOR MARKETS", "bad"], flat: ["NEUTRAL", "neutral"] }[n.direction] || ["NEUTRAL", "neutral"];
  const when = n.published ? new Date(n.published).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  const s = n.summary;
  const url = safeUrl(n.url);
  const body = $("pick-body");
  body.replaceChildren(
    el("h2", { text: n.title }),
    el("div", { style: "display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px" },
      el("span", { class: `chip ${mood[1]}`, text: `${dot} ${mood[0]}` }),
      el("span", { class: "sub", text: [n.asset, n.source, when].filter(Boolean).join(" · ") })),
    el("div", { class: "sub", style: "margin-top:14px", text: "What happened" }),
    el("p", { class: "narr", style: "font-size:14px", text: (s && s.what) || n.description || "No summary for this one — open the article below." }),
    ...(s && s.why ? [el("div", { class: "sub", style: "margin-top:10px", text: "Why it matters" }),
                      el("p", { class: "narr", style: "font-size:14px", text: s.why })] : []),
    el("p", { class: "sub", style: "margin-top:12px",
      text: s ? "Summary written by AI from the headline and the article's intro only — check the article before acting on it."
              : "This is the article's own intro." }));
  if (url) {
    const a = el("a", { class: "btn newslink", href: url, target: "_blank", rel: "noopener noreferrer" });
    a.innerHTML = NEWS_ICON;
    a.append(el("span", { text: `Read the full article${n.source ? ` on ${n.source}` : ""}` }));
    body.append(a);
  }
  showSheet();
}

// ---------- "Should I invest, and how much?" — worked out on this phone; nothing is sent anywhere ----------
const gbp = (v) => `£${Math.round(v).toLocaleString("en-GB")}`;

function loadSizing() {
  try { return JSON.parse(localStorage.getItem("sizing") || "{}"); } catch (_) { return {}; }
}
function saveSizing(v) {
  try { localStorage.setItem("sizing", JSON.stringify(v)); } catch (_) {}
}

function savedSavings() { return parseFloat(loadSizing().savings) || 0; }

function setupSavings() {
  const input = $("savings-input"), note = $("savings-note");
  const v = savedSavings();
  if (v) input.value = String(v);
  $("savings-save").onclick = () => {
    const n = parseFloat(input.value);
    if (!(n > 0)) { note.textContent = "Enter an amount above £0."; return; }
    saveSizing({ savings: n });
    note.textContent = `Saved: ${gbp(n)} — on this phone only, never sent anywhere.`;
  };
}

function goToSavings() {
  closePick();
  $("notify-details").open = true;
  $("notify").scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => $("savings-input").focus(), 400);
}

function investForm(it) {
  const savings = savedSavings();
  // The whole section is one button: tap "Should I invest in AMD?" and the answer opens underneath.
  const box = el("details", { class: "invest" },
    el("summary", { class: "btn invest-btn", text: `Should I invest in ${it.ticker}?` }));
  const r = sizePick(savings, it.verdict);
  if (!r.ok) {
    box.append(el("p", { class: "sub", text: r.error }),
      el("button", { class: "btn", type: "button", text: "Add my savings", onclick: goToSavings }));
    return box;
  }
  const line = (a, b, strong) => el("div", { class: `sz-line${strong ? " strong" : ""}` }, el("span", { text: a }), el("span", { text: b }));
  const cls = { yes: "good", no: "bad", index: "watch" }[r.answer];
  box.append(
    el("div", { class: `sz-answer chip ${cls}`, text: { yes: "YES — A SMALL AMOUNT", no: "NO", index: "INDEX INSTEAD" }[r.answer] }),
    el("p", { class: "narr", style: "font-size:15px;font-weight:600", text: r.headline }),
    line("Your investment savings", gbp(savings), true),
    line("→ Global index fund (VWRP), 80%", gbp(r.core)),
    line("→ Pot for individual picks, 20%", gbp(r.picksPot)),
    line("→ Most in any one stock (5%)", gbp(r.perStock)),
    line(`${it.ticker} now`, gbp(r.amount), true),
    el("button", { class: "btn", type: "button", style: "margin-top:10px", text: "Change my savings", onclick: goToSavings }),
    el("p", { class: "sub", style: "margin-top:10px", text:
      "J.P. Morgan Personal Investing can't buy single shares like this — you'd need a DIY Stocks & Shares ISA " +
      "(e.g. Trading 212, Freetrade). Move money by ISA transfer, not withdrawal, so it doesn't use this year's £20,000 allowance." }),
    el("p", { class: "sub", text:
      "Only invest money you won't need for 5+ years. If a fall right after buying would upset you, spread the index money over 3–6 months. " +
      "Fixed rules, not personal advice." }));
  return box;
}

function closePick() {
  $("pick-sheet").hidden = true;
  document.body.classList.remove("locked");
}

function renderBrief(d) {
  const s = d.sentiment;
  if (s) {
    const chip = $("sent-chip");
    chip.hidden = false;
    const [label, cls] = s.avg >= 0.1 ? ["BULLISH", "good"] : s.avg <= -0.1 ? ["BEARISH", "bad"] : ["NEUTRAL", "neutral"];
    chip.className = `chip ${cls}`;
    chip.textContent = `${label} ${s.avg >= 0 ? "+" : "−"}${Math.abs(s.avg).toFixed(2)}`;
    $("sent-counts").textContent = `${s.bullish}▲ · ${s.bearish}▼ · ${s.neutral}→`;
  }
  $("narrative").textContent = d.narrative || "No write-up today.";
  const box = $("news");
  for (const n of d.news || []) {
    const [dot, cls] = DIR[n.direction] || DIR.flat;
    const row = el("button", { class: "nrow", type: "button" },
      el("span", { class: `dot ${cls}`, text: dot }),
      el("span", { class: "t", text: n.title }),
      el("span", { class: "s", text: [n.asset, n.source].filter(Boolean).join(" · ") }));
    row.onclick = () => openNews(n);
    box.append(row);
  }
}

function renderWatch(d) {
  const box = $("watch");
  const items = d.watch || [];
  if (!items.length) { box.append(el("div", { class: "sub", text: "Nothing scheduled." })); return; }
  for (const w of items) {
    const x = el("div", { class: "x" }, el("strong", { text: w.name }));
    if (w.expect) x.append(el("br"), el("span", { text: `Expect ${w.expect.charAt(0).toLowerCase()}${w.expect.slice(1)}` }));
    if (w.why) x.append(el("br"), el("span", { text: w.why }));
    box.append(el("div", { class: "wrow" }, el("span", { class: "d", text: w.date || "—" }), x));
  }
}

function renderHype(d) {
  const h = d.hype || { status: "not_built", items: [] };
  const box = $("hype");
  if (h.status !== "ok") { box.append(el("div", { class: "sub", text: "Coming soon — needs Reddit access. Crowd buzz will show here as a warning, never a buy signal." })); return; }
  if (!h.items.length) { box.append(el("div", { class: "sub", text: "No unusual buzz today." })); return; }
  for (const it of h.items) {
    box.append(el("div", { class: "ph", style: "font-size:12px" },
      el("span", {}, el("strong", { text: it.ticker }), ` ${it.name}`),
      el("span", { class: "muted", text: `${it.buzz}× normal` })));
  }
}

function renderFooter(d) {
  const when = new Date(d.generated_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  $("sources").textContent = `Data: ${(d.sources || []).join(", ")} · Text by ${d.model} (Groq); numbers from code · Updated ${when}`;
}

async function load() {
  try {
    let d;
    try {
      d = await fetchData("data/today.json");
    } catch (e) {
      if (!(e instanceof NeedsPasscode)) throw e;
      $("main").hidden = true;
      await askPasscode("data/today.json");
      $("main").hidden = false;
      d = await fetchData("data/today.json");
    }
    renderHeader(d); renderPicks(d); renderBrief(d); renderWatch(d); renderHype(d); renderFooter(d);
  } catch (e) {
    $("main").replaceChildren(el("div", { class: "empty", text: "No briefing yet — the first one arrives after the next weekday run." }));
  }
}

// ---------- notifications (one phone: the subscription is copied into a GitHub secret by hand) ----------
function b64ToBytes(s) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function showSubscription(sub) {
  $("notify-out").hidden = false;
  $("notify-json").value = JSON.stringify(sub);
  $("notify-state").textContent = "on ✓";
}

async function setupNotifications(reg) {
  const box = $("notify"), help = $("notify-help"), btn = $("notify-btn");
  box.hidden = false;
  $("notify-copy").onclick = async () => {
    const t = $("notify-json");
    try { await navigator.clipboard.writeText(t.value); } catch (_) { t.select(); document.execCommand("copy"); }
    $("notify-copy").textContent = "Copied";
  };
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (!("PushManager" in window) || !reg) {
    help.textContent = standalone
      ? "This browser can't receive notifications."
      : "On iPhone: tap Share → Add to Home Screen, then open the app from its icon to turn notifications on.";
    return;
  }
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    showSubscription(existing);
    help.textContent = "You'll get one notification each weekday when the briefing is ready.";
    return;
  }
  help.textContent = "Get one notification each weekday when the briefing is ready (and if it fails).";
  $("notify-state").textContent = "off — tap to turn on";
  btn.hidden = false;
  btn.onclick = async () => {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { help.textContent = "Notifications are blocked — allow them in Settings → Notifications."; return; }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(window.VAPID_PUBLIC_KEY) });
      btn.hidden = true;
      showSubscription(sub);
    } catch (e) {
      help.textContent = `Couldn't turn them on: ${e.message || e}`;
    }
  };
}

$("pick-close").onclick = closePick;
$("pick-sheet").addEventListener("click", (e) => { if (e.target.id === "pick-sheet") closePick(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePick(); });

setupSavings();
load();
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then(() => navigator.serviceWorker.ready)
    .then(setupNotifications).catch(() => setupNotifications(null));
} else {
  setupNotifications(null);
}
