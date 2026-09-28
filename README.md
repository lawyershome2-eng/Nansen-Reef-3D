# Nansen Reef

A saltwater tank where a Nansen watch becomes fish. The size of the trade picks the body. The label on the wallet picks the kind. A rare pass crosses the tank and the shoal dives.

This is the aquarium idea from the [Meridian Buildathon](https://nansen.ai/campaigns/meridian-buildathon). Nansen data drives which fish appear. It is not a caption pasted on a loop.

## Run it

You need Node 20 or newer, and a key from [app.nansen.ai/api](https://app.nansen.ai/api). The key is free to start.

```bash
git clone https://github.com/lawyershome2-eng/Nansen-Reef-3D.git
cd Nansen-Reef-3D
npm install
printf 'NANSEN_API_KEY=your_key_here\n' > .env
set -a && source .env && set +a
npm run dev
```

Open [http://localhost:8080/reefscape/index.html](http://localhost:8080/reefscape/index.html).

Check the key was picked up:

```bash
curl -s http://localhost:8080/api/health
```

`"live": true` means the key is in the process. `"mode": "mock"` on that same line is normal. Ocean is a sample tide. Wallet, token, and name are the live Nansen watches.

No key at all: the tank still opens, and every watch stays on the sample tide.

## What to click

| Control | What it does |
|---|---|
| Ocean | Sample tide. No Nansen call. |
| Wallet | Paste an address. Trades from that wallet become fish. |
| Token | Paste a token contract. Transfers, or trades only. A profile panel opens on the side. |
| Name | Search a token or an entity, then pick a row. |
| Chain | Ethereum, Solana, Base, Arbitrum, Optimism, Polygon, BNB, Avalanche, Robinhood, Arc, or All chains. |
| Drag | Turn the tank. Pinch to come closer. |
| Key | Which body is which. |
| Pause, Feed, Fullscreen | Space, a tap, and F. H hides the chrome. |

The door at `/` only points at the aquarium and the flat feed. The feed is [/pipeline.html](http://localhost:8080/pipeline.html).

## Chains

Supported on the watch bar:

| Chain | Value |
|---|---|
| Ethereum | `ethereum` |
| Solana | `solana` |
| Base | `base` |
| Arbitrum | `arbitrum` |
| Optimism | `optimism` |
| Polygon | `polygon` |
| BNB | `bnb` |
| Avalanche | `avalanche` |
| Robinhood | `robinhood` |
| Arc | `arc` |
| All chains | `all` (ocean / wallet / name only — not for a single token) |

Token mode requires a single chain.

## Token profile

After a successful **token** resolve (Token mode or Name → pick a token), a profile panel opens:

- **Desktop** — right rail
- **Mobile** — bottom sheet
- **Hide** collapses it; a **Token** chip brings it back

Data comes from Nansen Token God Mode (`POST /api/v1/tgm/token-information`, 1 credit). Only Nansen-native fields are shown; missing values are **—**.

| Field | Source |
|---|---|
| Symbol, name, address, chain | TGM token-information |
| Market cap, FDV, liquidity, volume (1d) | TGM |
| Buys / sells / unique traders / holders | TGM |
| Deployment date | TGM |
| Taxes, max buy/sell, burn, clog, audit, launchpad | Always **—** (not in Nansen) |
| Link | DexScreener only |

Ocean and wallet watches hide the panel.

Client route:

```
GET /api/watch/token-profile?chain=<chain>&address=<token_address>
```

## How a trade becomes a fish

The browser never sees the key. It opens `/api/watch/stream` (a live stream) and `/api/watch/suggest` (name search). The server calls Nansen, then sends a fish.

Endpoints used, all `POST` to `https://api.nansen.ai`:

- `/api/v1/tgm/transfers`
- `/api/v1/tgm/dex-trades`
- `/api/v1/tgm/token-information` (token profile panel)
- `/api/v1/profiler/address/transactions`
- `/api/v1/profiler/address/labels`
- `/api/v1/search/general`
- `/api/v1/search/entity-name`

The dollar size and the Nansen label pick the body:

| Fish | Who it is |
|---|---|
| Shrimp | Under about $1k |
| Wallet | An ordinary wallet |
| Smart trader | A labeled smart trader |
| KOL | Stays on the anemone |
| Whale | About $100k and up |
| Institution | A fund |
| Shark | A rare pass. The shoal dives. |

## Put it on the internet

Two hosts, one repo.

**Railway** runs the server. Root directory is the repository root. Set `NANSEN_API_KEY`. Do not set `PORT`. `railway.json` builds and starts it. Health check is `/api/health`.

**Vercel** serves the pages. Root directory is `public`. Preset is Other. Build command empty. Set `RAILWAY_URL` to the Railway URL with `https://` and no slash at the end, for example `https://nansen-reef-3d-production.up.railway.app`. `public/vercel.json` forwards `/api` to that host, so the tank can keep calling `/api/watch/stream` and `/api/watch/token-profile`.

## Enter the buildathon

From the campaign page, in order:

1. Create a key at [app.nansen.ai/api](https://app.nansen.ai/api).
2. Use the API in the build. Wallet, token, and name watches are the calls. Token profile uses Token God Mode.
3. Post a recording on X and tag [@nansen_ai](https://x.com/nansen_ai). The recording has to run from open to a live fish, with no crash.
4. Submit your email, the X post, and this repo on [the campaign page](https://nansen.ai/campaigns/meridian-buildathon).

Judges score four things, 25% each: Nansen data driving the logic, a use that is not another dashboard, a live run that does not break, and a README plus a recording another builder can follow.
