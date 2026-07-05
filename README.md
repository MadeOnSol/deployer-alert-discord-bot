# Deployer-Alert Discord Bot (Solana)

Post a Discord embed the moment a **tracked Solana deployer** — one with a proven bonding track record on pump.fun or LaunchLab (bonk) — launches a new token or one of their tokens bonds. Zero dependencies, ~130 lines, runs in 5 minutes on a **free API key**.

Powered by the [MadeOnSol Deployer Hunter](https://madeonsol.com/deployer-hunter) — 23,000+ scored deployers, alerts fired in real time from on-chain deploy detection.

📖 **Full tutorial:** [Pump.fun deployer alerts in your Discord — build the bot in 5 minutes](https://madeonsol.com/blog/solana-deployer-alerts-discord-bot-tutorial)

> **Data only, DYOR.** MadeOnSol never executes trades. A good deployer track record is a signal, not a guarantee.

## Quickstart (5 minutes)

```bash
git clone https://github.com/madeonsol/deployer-alert-discord-bot
cd deployer-alert-discord-bot

# 1. Free API key (200 req/day): https://madeonsol.com/pricing
export MADEONSOL_API_KEY=msk_your_key_here

# 2. Discord webhook: Server Settings → Integrations → Webhooks → New
export DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

node index.mjs
```

Embeds look like:

> **🚀 New deploy: $TICKER · 🟠 Bonk**
> Tracked deployer deployed a new token. 8/10 lifetime bonds.
> **MC at alert** $45.0k · **Deployer tier** elite · **Track record** 8/10 bonded (80%)

Purple = new deploy, green = bonded. LaunchLab (bonk) launches get the 🟠 badge. Each embed links to the deployer's full profile.

### No Discord yet? Dry-run to your terminal

```bash
DRY_RUN=1 node index.mjs
```

## How polling works

| Your key | Poll interval | Daily budget |
|---|---|---|
| **Free (BASIC)** | 480 s (default) | stays inside 200 req/day |
| **PRO / ULTRA** | 60 s (default) | 10k / 100k req/day — or go real-time with the `deployer:alerts` WebSocket channel |

Tier is detected automatically. State survives restarts (`state.json`) and the first boot posts at most 3 recent alerts so it never floods your channel.

## Configuration

| Var | Default | What |
|---|---|---|
| `MADEONSOL_API_KEY` | — (required) | `msk_` key — free at [madeonsol.com/pricing](https://madeonsol.com/pricing) |
| `DISCORD_WEBHOOK_URL` | — | Webhook to post to (not needed with `DRY_RUN=1`) |
| `POLL_SECONDS` | 480 free / 60 PRO | Poll interval |
| `DRY_RUN` | — | `1` = print embeds instead of posting |
| `STATE_FILE` | `state.json` | Cursor persistence |

## Ideas to build on top

- Filter to elite-tier only (`alert.deployers.tier === "elite"`) or bonk-only (`alert.launchpad === "launchlab"`)
- Score the token at alert time: `POST /tokens/batch/risk` (PRO) — rug score before you even look
- Swap the webhook for a full Discord bot with buttons (trade links, mute-deployer)
- Real-time instead of polling: WebSocket `deployer:alerts` channel (PRO), see [api-docs](https://madeonsol.com/api-docs)

## Tests

```bash
MADEONSOL_API_KEY=msk_... node test.mjs
```

Unit tests (embed building incl. the Bonk badge, chunking, cursor logic) + live shape tests. Set `DISCORD_WEBHOOK_URL` too and it posts one real test embed.

## License

MIT
