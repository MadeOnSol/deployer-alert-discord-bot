/**
 * Tests — unit (embed building, chunking, cursor logic) + live shape tests
 * against production. Live tests need MADEONSOL_API_KEY. If
 * DISCORD_WEBHOOK_URL is also set, posts ONE real test embed.
 *
 *   MADEONSOL_API_KEY=msk_... node test.mjs
 */
import { buildEmbed, chunkEmbeds, newAlerts, fmtUsd, pct } from "./lib.mjs";

let pass = 0, fail = 0;
const assert = (cond, name) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`); }
};

// ── Unit ─────────────────────────────────────────────────────────────────────
console.log("Unit: helpers");
assert(fmtUsd(2_310_000) === "$2.31M" && fmtUsd(null) === "—", "fmtUsd");
assert(pct(0.62) === 62 && pct(62) === 62 && pct(null) === null, "pct normalizes 0–1 and 0–100");

console.log("Unit: buildEmbed");
const baseAlert = {
  alert_type: "new_deploy",
  token_mint: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  token_name: "Test Token",
  token_symbol: "TST",
  title: "Elite deployer launched $TST",
  message: "Tracked deployer deployed a new token. 8/10 lifetime bonds.",
  created_at: "2026-07-02T12:00:00Z",
  market_cap_at_alert: 45_000,
  launchpad: "pumpfun",
  deployers: { wallet_address: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", tier: "elite", total_tokens_deployed: 10, total_bonded: 8, bonding_rate: 0.8 },
};
{
  const e = buildEmbed(baseAlert);
  assert(e.title.includes("🚀 New deploy: $TST"), "deploy title");
  assert(!e.title.includes("Bonk"), "no badge for pumpfun");
  assert(e.color === 0x9945ff, "deploy color purple");
  assert(e.url?.includes("/deployer-hunter/9WzDX"), "links to deployer profile");
  assert(e.fields.some((f) => f.name === "MC at alert" && f.value === "$45.0k"), "MC field");
  assert(e.fields.some((f) => f.name === "Track record" && f.value === "8/10 bonded (80%)"), "track record + rate");
  assert(e.fields.some((f) => f.name === "Mint" && f.value.includes("7xKXtg2")), "mint field");
}
{
  const e = buildEmbed({ ...baseAlert, alert_type: "bonded", launchpad: "launchlab" });
  assert(e.title.includes("🔗 Bonded") && e.title.includes("🟠 Bonk"), "bonded + Bonk badge (launchlab)");
  assert(e.color === 0x14f195, "bond color green");
}
{
  const e = buildEmbed({ ...baseAlert, token_symbol: "$BULLBET" });
  assert(e.title.includes("$BULLBET") && !e.title.includes("$$"), "pre-$ symbol not doubled");
}
{
  const e = buildEmbed({ alert_type: "new_deploy", token_mint: null, title: "x", message: "y", created_at: "2026-07-02T12:00:00Z" });
  assert(e.fields.every((f) => f.name !== "Mint") && e.url === undefined, "handles missing mint/deployer gracefully");
}

console.log("Unit: chunkEmbeds + newAlerts");
assert(chunkEmbeds(Array(23).fill({})).map((c) => c.length).join(",") === "10,10,3", "chunks at 10");
{
  const alerts = [
    { created_at: "2026-07-02T12:03:00Z", id: 3 },
    { created_at: "2026-07-02T12:01:00Z", id: 1 },
    { created_at: "2026-07-02T12:02:00Z", id: 2 },
  ];
  const fresh = newAlerts(alerts, "2026-07-02T12:01:00Z");
  assert(fresh.length === 2 && fresh[0].id === 2 && fresh[1].id === 3, "cursor filters + sorts oldest-first");
  assert(newAlerts(alerts, null).length === 3, "null cursor returns all");
}

// ── Live ─────────────────────────────────────────────────────────────────────
const KEY = process.env.MADEONSOL_API_KEY;
if (!KEY) {
  console.log("\n(no MADEONSOL_API_KEY — skipping live tests)");
} else {
  console.log("\nLive: production API");
  const res = await fetch("https://madeonsol.com/api/v1/deployer-hunter/alerts?limit=5", { headers: { Authorization: `Bearer ${KEY}` } });
  assert(res.ok, `/deployer-hunter/alerts → ${res.status}`);
  const data = await res.json();
  assert(Array.isArray(data.alerts), "alerts[] present");
  if (data.alerts.length > 0) {
    const a = data.alerts[0];
    assert(typeof a.alert_type === "string" && typeof a.created_at === "string", "alert core fields");
    assert("launchpad" in a, "alert carries launchpad field (bonk-aware)");
    assert(a.deployers && typeof a.deployers.wallet_address === "string", "deployer join present");
    const embed = buildEmbed(a);
    assert(embed.title.length > 0 && embed.timestamp === a.created_at, "live alert → valid embed");

    if (process.env.DISCORD_WEBHOOK_URL) {
      const post = await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "Deployer Hunter (test)", embeds: [embed] }),
      });
      assert(post.ok || post.status === 204, `real webhook post → ${post.status}`);
    } else {
      console.log("(no DISCORD_WEBHOOK_URL — skipping real webhook post)");
    }
  }
}

console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail ? 1 : 0);
