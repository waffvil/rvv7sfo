// Renders data/today.json (written each weekday by the briefing job). No framework, no build step.
// Every piece of text from the data goes in via textContent — headlines come from outside sources.
"use strict";

const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
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

function renderPicks(d) {
  const p = d.picks || { status: "not_built", items: [] };
  const empty = $("picks-empty");
  if (p.status !== "ok") {
    $("picks-title").textContent = "Things worth a look";
    empty.textContent = "Coming soon — this needs the stock scorecard, which isn't built yet. Until then, your core index plan is the default.";
    return;
  }
  $("picks-title").textContent = `${p.items.length || ""} thing${p.items.length === 1 ? "" : "s"} worth a look`.trim();
  if (!p.items.length) { empty.textContent = "Nothing stands out today — your core index plan is the default."; return; }
  empty.hidden = true;
  const box = $("picks");
  box.hidden = false;
  for (const it of p.items) {
    const [label, cls] = VERDICT[it.verdict] || [it.verdict, "neutral"];
    box.append(el("a", { class: "pick", href: safeUrl(it.url) || "#" },
      el("div", { class: "ph" }, el("span", { class: "tk", text: it.ticker }),
        el("strong", { class: it.pct >= 0 ? "up" : "down", text: pct(it.pct) })),
      el("div", { class: "sub", text: `${it.name} · ${it.theme}` }),
      el("span", { class: `chip ${cls}`, style: "align-self:flex-start", text: label }),
      el("div", { style: "font-size:12px;line-height:1.4", text: it.reason })));
  }
  const l = d.ledger;
  if (l && l.status === "ok") {
    const s = $("ledger");
    s.hidden = false;
    s.replaceChildren("Picks vs global index: ", el("strong", { text: `${l.picks_pct >= 0 ? "+" : ""}${l.picks_pct}% vs ${l.index_pct >= 0 ? "+" : ""}${l.index_pct}%` }));
  }
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
    const url = safeUrl(n.url);
    const row = el(url ? "a" : "div", url ? { class: "nrow", href: url, target: "_blank", rel: "noopener noreferrer" } : { class: "nrow" },
      el("span", { class: `dot ${cls}`, text: dot }),
      el("span", { class: "t", text: n.title }),
      el("span", { class: "s", text: [n.asset, n.source].filter(Boolean).join(" · ") }));
    box.append(row);
  }
}

function renderWatch(d) {
  const box = $("watch");
  const items = d.watch || [];
  if (!items.length) { box.append(el("div", { class: "sub", text: "Nothing scheduled." })); return; }
  for (const w of items) {
    const x = el("div", { class: "x" }, el("strong", { text: w.name }));
    if (w.expect) x.append(el("br"), el("span", { text: `Expect ${w.expect}` }));
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
    const r = await fetch("data/today.json", { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
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
  $("notify-state").textContent = "on for this phone";
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

load();
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then(() => navigator.serviceWorker.ready)
    .then(setupNotifications).catch(() => setupNotifications(null));
} else {
  setupNotifications(null);
}
