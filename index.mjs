#!/usr/bin/env node
/**
 * Deployer-alert Discord bot — MadeOnSol API starter.
 *
 * Posts a Discord embed whenever a TRACKED Solana deployer (proven bonding
 * track record on pump.fun or LaunchLab/bonk) launches a new token or one of
 * their tokens bonds. Zero dependencies — just a Discord webhook URL.
 *
 * Free API key: https://madeonsol.com/pricing  (200 req/day — default poll
 * interval stays inside it). PRO = 10k/day → 60s polling, or go real-time
 * with the WebSocket deployer:alerts channel.
 *
 * Dry run (no Discord needed):  DRY_RUN=1 node index.mjs
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { buildEmbed, chunkEmbeds, newAlerts } from "./lib.mjs";

const API = process.env.MADEONSOL_API_BASE || "https://madeonsol.com/api/v1";
const KEY = process.env.MADEONSOL_API_KEY;
const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const DRY_RUN = process.env.DRY_RUN === "1";
const STATE_FILE = process.env.STATE_FILE || "state.json";

if (!KEY) {
  console.error("Missing MADEONSOL_API_KEY. Free key: https://madeonsol.com/pricing");
  process.exit(1);
}
if (!WEBHOOK && !DRY_RUN) {
  console.error("Missing DISCORD_WEBHOOK_URL (Server Settings → Integrations → Webhooks).");
  console.error("Tip: DRY_RUN=1 node index.mjs prints embeds to the console instead.");
  process.exit(1);
}

const api = async (path) => {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${KEY}` } });
  if (!res.ok) {
    const err = new Error(`API ${res.status} on ${path}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
};

async function postDiscord(embeds) {
  for (const chunk of chunkEmbeds(embeds)) {
    for (;;) {
      const res = await fetch(WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "Deployer Hunter", embeds: chunk }),
      });
      if (res.status === 429) { // rate limited — honor retry_after
        const body = await res.json().catch(() => ({}));
        const wait = Math.ceil((body.retry_after ?? 2) * 1000);
        console.log(`Discord rate limit — waiting ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) console.error(`Discord webhook ${res.status}: ${(await res.text()).slice(0, 200)}`);
      break;
    }
  }
}

// ── State: newest alert timestamp we've already posted ──────────────────────
let state = { last_created_at: null };
if (existsSync(STATE_FILE)) {
  try { state = JSON.parse(readFileSync(STATE_FILE, "utf8")); } catch { /* fresh */ }
}
const saveState = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

// ── Main loop ────────────────────────────────────────────────────────────────
const me = await api("/me");
const tier = me.tier || "BASIC";
// Free tier: 200 req/day → 480s (~180/day). PRO+: 60s.
const interval = Number(process.env.POLL_SECONDS || (tier === "BASIC" ? 480 : 60));
console.log(`Deployer alerts → ${DRY_RUN ? "console (dry run)" : "Discord"} · tier ${tier} · polling every ${interval}s`);
if (tier === "BASIC") console.log("PRO gets 60s polling or the real-time WebSocket → https://madeonsol.com/pricing");

let firstRun = state.last_created_at == null;
async function tick() {
  try {
    const data = await api(`/deployer-hunter/alerts?limit=20`);
    let fresh = newAlerts(data.alerts, state.last_created_at);
    if (firstRun && fresh.length > 3) fresh = fresh.slice(-3); // don't flood the channel on first boot
    firstRun = false;

    if (fresh.length > 0) {
      const embeds = fresh.map(buildEmbed);
      if (DRY_RUN) {
        for (const e of embeds) console.log(JSON.stringify(e, null, 2));
      } else {
        await postDiscord(embeds);
      }
      state.last_created_at = fresh[fresh.length - 1].created_at;
      saveState();
      console.log(`Posted ${fresh.length} alert(s) — up to ${state.last_created_at}`);
    }
  } catch (err) {
    if (err.status === 429) console.error("API rate limited — raise POLL_SECONDS or upgrade: madeonsol.com/pricing");
    else console.error("tick error:", err.message);
  }
}

await tick();
if (DRY_RUN && process.env.ONCE === "1") process.exit(0);
setInterval(tick, interval * 1000);
