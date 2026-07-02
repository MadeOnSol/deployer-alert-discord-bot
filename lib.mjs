/**
 * Deployer-alert → Discord embed logic. Pure functions, unit-testable.
 *
 * Alerts come from GET /api/v1/deployer-hunter/alerts — fired when a TRACKED
 * pump.fun / LaunchLab (bonk) deployer (proven bonding track record) launches
 * a new token or one of their tokens bonds.
 */

const COLOR = {
  new_deploy: 0x9945ff, // Solana purple
  bonded: 0x14f195,     // Solana green
  high_mc: 0xf59e0b,
};

const LAUNCHPAD_BADGE = {
  launchlab: "🟠 Bonk",
  bags: "🔵 Bags",
};

export function fmtUsd(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  n = Number(n);
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

/** bonding_rate arrives as 0–1 or 0–100 depending on age of row — normalize to %. */
export function pct(v) {
  if (v == null || !Number.isFinite(Number(v))) return null;
  const n = Number(v);
  return Math.round(n <= 1 ? n * 100 : n);
}

/** One alert → one Discord embed object. */
export function buildEmbed(alert) {
  const d = alert.deployers ?? {};
  // token_symbol sometimes already carries a leading $ — don't double it
  const rawSym = (alert.token_symbol || "").replace(/^\$+/, "");
  const sym = rawSym ? `$${rawSym}` : alert.token_name || "new token";
  const kind = alert.alert_type === "bonded" ? "🔗 Bonded" : "🚀 New deploy";
  const badge = LAUNCHPAD_BADGE[alert.launchpad];
  const title = `${kind}: ${sym}${badge ? `  ·  ${badge}` : ""}`;

  const fields = [];
  if (alert.market_cap_at_alert != null) {
    fields.push({ name: "MC at alert", value: fmtUsd(alert.market_cap_at_alert), inline: true });
  }
  if (d.tier) fields.push({ name: "Deployer tier", value: String(d.tier), inline: true });
  const rate = pct(d.bonding_rate);
  if (d.total_tokens_deployed != null) {
    fields.push({
      name: "Track record",
      value: `${d.total_bonded ?? 0}/${d.total_tokens_deployed} bonded${rate != null ? ` (${rate}%)` : ""}`,
      inline: true,
    });
  }
  if (alert.token_mint) fields.push({ name: "Mint", value: `\`${alert.token_mint}\``, inline: false });

  return {
    title: title.slice(0, 256),
    url: d.wallet_address ? `https://madeonsol.com/deployer-hunter/${d.wallet_address}` : undefined,
    description: (alert.message || alert.title || "").slice(0, 2048),
    color: COLOR[alert.alert_type] ?? 0x9945ff,
    fields: fields.slice(0, 25),
    timestamp: alert.created_at,
    footer: { text: "MadeOnSol Deployer Hunter · data only, DYOR" },
  };
}

/** Discord allows max 10 embeds per webhook message. */
export function chunkEmbeds(embeds, size = 10) {
  const chunks = [];
  for (let i = 0; i < embeds.length; i += size) chunks.push(embeds.slice(i, i + size));
  return chunks;
}

/**
 * Return alerts newer than `sinceIso`, oldest-first (stable posting order).
 */
export function newAlerts(alerts, sinceIso) {
  return (alerts ?? [])
    .filter((a) => !sinceIso || (a.created_at && a.created_at > sinceIso))
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
}
