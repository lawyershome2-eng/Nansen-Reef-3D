/**
 * GET /api/watch/token-profile?chain=&address=
 * Uses Nansen Token God Mode: POST /api/v1/tgm/token-information
 * Returns only Nansen-native fields; missing values become null (UI shows "—").
 */
import { createFileRoute } from "@tanstack/react-router";
import { getNansen, publicMessage } from "@/lib/cinema/nansen.ts";
import { addressOk, CHAINS } from "@/lib/cinema/query.ts";

const CHAIN_SET = new Set<string>(CHAINS.filter((c) => c !== "all"));

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function dexscreenerUrl(chain: string, address: string): string {
  const map: Record<string, string> = {
    ethereum: "ethereum",
    solana: "solana",
    base: "base",
    arbitrum: "arbitrum",
    optimism: "optimism",
    polygon: "polygon",
    bnb: "bsc",
    avalanche: "avalanche",
    robinhood: "robinhood",
    arc: "arc",
  };
  const c = map[chain] || chain;
  return `https://dexscreener.com/${c}/${address}`;
}

export async function tokenProfileResponse(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const chain = (url.searchParams.get("chain") || "").trim().toLowerCase();
  const address = (url.searchParams.get("address") || "").trim();

  if (!CHAIN_SET.has(chain)) {
    return Response.json({ error: "Pick a supported chain." }, { status: 400 });
  }
  if (!addressOk(chain, address)) {
    return Response.json({ error: "That doesn't look like a valid address." }, { status: 400 });
  }

  const client = getNansen();
  if (!client) {
    return Response.json({
      live: false,
      chain,
      address,
      symbol: null,
      name: null,
      logo: null,
      marketCapUsd: null,
      fdvUsd: null,
      liquidityUsd: null,
      volumeTotalUsd: null,
      buyVolumeUsd: null,
      sellVolumeUsd: null,
      totalBuys: null,
      totalSells: null,
      uniqueBuyers: null,
      uniqueSellers: null,
      totalHolders: null,
      circulatingSupply: null,
      totalSupply: null,
      deploymentDate: null,
      website: null,
      x: null,
      telegram: null,
      dexscreener: dexscreenerUrl(chain, address),
      note: "Sample profile. A Nansen key loads Token God Mode.",
    });
  }

  try {
    const raw = await client.tokenInformation({ chain, tokenAddress: address, timeframe: "1d" });
    const body = asRecord(raw);
    const data = asRecord(body?.data) ?? body;
    const details = asRecord(data?.token_details) ?? {};
    const spot = asRecord(data?.spot_metrics) ?? {};

    return Response.json({
      live: true,
      chain,
      address: str(data?.contract_address) || address,
      symbol: str(data?.symbol),
      name: str(data?.name),
      logo: str(data?.logo),
      marketCapUsd: num(details.market_cap_usd),
      fdvUsd: num(details.fdv_usd),
      liquidityUsd: num(spot.liquidity_usd),
      volumeTotalUsd: num(spot.volume_total_usd),
      buyVolumeUsd: num(spot.buy_volume_usd),
      sellVolumeUsd: num(spot.sell_volume_usd),
      totalBuys: num(spot.total_buys),
      totalSells: num(spot.total_sells),
      uniqueBuyers: num(spot.unique_buyers),
      uniqueSellers: num(spot.unique_sellers),
      totalHolders: num(spot.total_holders),
      circulatingSupply: num(details.circulating_supply),
      totalSupply: num(details.total_supply),
      deploymentDate: str(details.token_deployment_date),
      website: str(details.website),
      x: str(details.x),
      telegram: str(details.telegram),
      dexscreener: dexscreenerUrl(chain, address),
      creditsRemaining: client.creditsRemaining,
    });
  } catch (err) {
    return Response.json({ error: publicMessage(err) }, { status: 502 });
  }
}

export const Route = createFileRoute("/api/watch/token-profile")({
  server: {
    handlers: {
      GET: ({ request }) => tokenProfileResponse(request),
    },
  },
});
