// Opens sealed data files (see briefing/seal.py). The passphrase is asked for once; the derived key —
// not the passphrase — is kept on this phone, so it's never asked for again unless the app is deleted.
// SALT and ITERATIONS must match briefing/seal.py.
"use strict";

const LOCK = { salt: "market-briefing/rvv7sfo/v1", iterations: 600000, storeKey: "unlockKey" };
const enc = new TextEncoder();
const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64e = (u8) => btoa(String.fromCharCode(...u8));

class NeedsPasscode extends Error {}

async function deriveKeyBytes(passphrase) {
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(LOCK.salt), iterations: LOCK.iterations }, base, 256);
  return new Uint8Array(bits);
}

async function openSealed(obj, keyBytes) {
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(obj.iv) }, key, b64d(obj.ct));
  return JSON.parse(new TextDecoder().decode(plain));
}

function storedKey() {
  try { const k = localStorage.getItem(LOCK.storeKey); return k ? b64d(k) : null; } catch (_) { return null; }
}

// Fetch a data file; plain JSON passes straight through.
async function fetchData(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  const obj = await r.json();
  if (!obj || obj.sealed !== 1) return obj;
  const k = storedKey();
  if (!k) throw new NeedsPasscode();
  try { return await openSealed(obj, k); } catch (_) { throw new NeedsPasscode(); } // passphrase changed
}

// Shows the one-time passphrase screen; resolves once a passphrase opens `url`.
function askPasscode(url) {
  return new Promise((resolve) => {
    const input = el("input", { type: "password", autocomplete: "current-password", placeholder: "Passphrase", id: "lock-input" });
    const msg = el("div", { class: "sub", style: "min-height:18px;margin-top:8px" });
    const btn = el("button", { class: "btn", type: "submit", text: "Unlock" });
    const form = el("form", { class: "lock" },
      el("h2", { text: "Market Briefing" }),
      el("div", { class: "sub", style: "margin:6px 0 12px", text: "Enter the passphrase once — this phone will remember it." }),
      input, btn, msg);
    form.onsubmit = async (e) => {
      e.preventDefault();
      btn.disabled = true;
      msg.textContent = "Checking…";
      try {
        const keyBytes = await deriveKeyBytes(input.value);
        const r = await fetch(url, { cache: "no-store" });
        await openSealed(await r.json(), keyBytes);
        try { localStorage.setItem(LOCK.storeKey, b64e(keyBytes)); } catch (_) {}
        form.remove();
        resolve(keyBytes);
      } catch (_) {
        msg.textContent = "That passphrase didn't work.";
        btn.disabled = false;
      }
    };
    $("main").before(form);
    input.focus();
  });
}
