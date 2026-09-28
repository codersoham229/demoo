"use client";

import type { Contract, Log } from "ethers";
import { CHAIN_ID, contractsConfigured } from "./config";
import { shortAddress } from "./format";
import { getAccessRead, getAssetRead, getIdentityRead, getReadProvider } from "./contracts";
import sepoliaDeploy from "../../deployments/sepolia.json";

export type AuditCategory = "Identity" | "Access" | "Asset";

export type AuditRecord = {
  key: string;
  category: AuditCategory;
  event: string;
  title: string;
  description: string;
  actor: string | null;
  related: string | null;
  tokenId: number | null;
  txHash: string;
  blockNumber: number;
  logIndex: number;
  timestamp: number | null;
  contractName: string;
};

const IDENTITY_EVENTS = ["IdentityAnchored", "IdentityUpdated", "IdentityRevoked"] as const;
const ACCESS_EVENTS = ["RoleGrantedLogged", "RoleRevokedLogged", "RoleGranted", "RoleRevoked"] as const;
const ASSET_EVENTS = ["AssetRegistered", "AssetTransferred", "AssetLocked", "AssetUnlocked", "Transfer"] as const;

type ContractName = "IdentityRegistry" | "AccessManager" | "AssetRegistry";
type TaggedLog = { log: Log; contractName: ContractName };

function str(v: unknown): string {
  return typeof v === "string" ? v : String(v ?? "");
}

function num(v: unknown): number | null {
  try {
    const n = Number(v);
    return Number.isInteger(n) ? n : null;
  } catch {
    return null;
  }
}

async function roleLabel(roleHash: string, access: Contract, cache: { issuer?: string; verifier?: string; admin?: string }): Promise<string> {
  if (!cache.issuer) {
    const [issuer, verifier, admin] = await Promise.all([
      access.ISSUER_ROLE() as Promise<string>,
      access.VERIFIER_ROLE() as Promise<string>,
      access.DEFAULT_ADMIN_ROLE() as Promise<string>
    ]);
    cache.issuer = issuer.toLowerCase();
    cache.verifier = verifier.toLowerCase();
    cache.admin = admin.toLowerCase();
  }
  const h = roleHash.toLowerCase();
  if (h === cache.issuer) return "Issuer";
  if (h === cache.verifier) return "Verifier";
  if (h === cache.admin) return "Admin";
  return `Role ${roleHash.slice(0, 10)}…`;
}

function isGrantedEvent(event: string): boolean {
  return event === "RoleGrantedLogged" || event === "RoleGranted";
}

/**
 * Blocks per eth_getLogs call. Live-probed against the tier (10 OK, 15–2000
 * all rejected), so 10 is the largest first-try-safe size; fetchWindow splits
 * further on its own if a tier ever allows less.
 */
const LOG_CHUNK_SIZE = 10;
/** Below this range we stop splitting and report the index as unavailable. */
const LOG_MIN_CHUNK = 5;
/** Concurrent window requests. Kept very low: free-tier per-second
 * compute-unit budgets throttle hard above a couple of parallel getLogs. */
const WINDOW_CONCURRENCY = 2;
/** Retries per window on rate-limit/transient failures. */
const QUERY_MAX_RETRIES = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(e: unknown): boolean {
  const code = (e as { code?: number })?.code;
  if (code === 429) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /compute units|rate limit|too many requests|timeout|timed out|network|ECONNRESET|502|503/i.test(msg);
}

function isRangeError(e: unknown): boolean {
  const code = (e as { code?: number })?.code;
  if (code === -32600) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /block range|range.*exceed|too large|response.*too large|limit/i.test(msg);
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let last: unknown = null;
  for (let attempt = 0; attempt < QUERY_MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!isRetryable(e) || attempt === QUERY_MAX_RETRIES - 1) throw e;
      await sleep(1200 * (attempt + 1));
    }
  }
  throw last;
}

/** Thrown when event history cannot be retrieved — never reported as "zero events". */
export class AuditIndexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditIndexError";
  }
}

/** First block worth scanning: the deployment block on Sepolia, 0 on local chains (no range limits). */
function deploymentStartBlock(): number {
  if (CHAIN_ID === 11155111) {
    const b = (sepoliaDeploy as { deployedAtBlock?: unknown }).deployedAtBlock;
    if (typeof b === "number" && Number.isInteger(b) && b >= 0) return b;
  }
  return 0;
}

/** Strip anything URL/secret-like before an RPC error reaches the UI. */
function safeReason(e: unknown): string {
  const raw = e instanceof Error ? e.message.split("\n")[0] : String(e);
  const scrubbed = raw.replace(/https?:\/\/\S+/g, "[rpc]").replace(/0x[0-9a-fA-F]{64}/g, "[key]");
  return scrubbed.length > 220 ? scrubbed.slice(0, 220) + "…" : scrubbed;
}

/**
 * One multi-address, topic-OR window fetch. Splits the range only on
 * range-limit failures; anything else surfaces immediately as AuditIndexError.
 */
async function fetchWindow(
  provider: ReturnType<typeof getReadProvider>,
  addresses: string[],
  topic0s: string[],
  from: number,
  to: number
): Promise<Log[]> {
  try {
    const logs = await withRetry(() =>
      provider.getLogs({ address: addresses, topics: [topic0s], fromBlock: from, toBlock: to })
    );
    return logs as Log[];
  } catch (e) {
    if (!isRangeError(e) || to - from + 1 <= LOG_MIN_CHUNK) {
      throw new AuditIndexError(`#${from}–#${to}: ${safeReason(e)}`);
    }
    const mid = Math.floor((from + to) / 2);
    const [a, b] = await Promise.all([
      fetchWindow(provider, addresses, topic0s, from, mid),
      fetchWindow(provider, addresses, topic0s, mid + 1, to)
    ]);
    return [...a, ...b];
  }
}

/** Bounded-concurrency map: fast without bursting the RPC budget all at once. */
async function mapPool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const idx = next++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Read REAL on-chain events from all three contracts. No localStorage, no mocks.
 * Windows stream newest-first via onProgress so the UI shows records as they
 * arrive; the returned array is the complete deduplicated, sorted history.
 */
export async function fetchAuditEvents(onProgress?: (batch: AuditRecord[]) => void): Promise<AuditRecord[]> {
  if (!contractsConfigured()) {
    throw new Error("Contracts are not configured. Deploy first and set NEXT_PUBLIC_* in .env.local.");
  }
  const provider = getReadProvider();
  const identity = getIdentityRead();
  const access = getAccessRead();
  const asset = getAssetRead();
  const contracts: Record<ContractName, Contract> = {
    IdentityRegistry: identity,
    AccessManager: access,
    AssetRegistry: asset
  };
  const contractEvents: Record<ContractName, readonly string[]> = {
    IdentityRegistry: IDENTITY_EVENTS,
    AccessManager: ACCESS_EVENTS,
    AssetRegistry: ASSET_EVENTS
  };

  const byAddr = new Map<string, ContractName>();
  const allTopics: string[] = [];
  for (const name of Object.keys(contracts) as ContractName[]) {
    const contract = contracts[name];
    let address: string;
    try {
      address = await contract.getAddress();
    } catch (e) {
      throw new AuditIndexError(`Audit event index unavailable (${name} address: ${safeReason(e)})`);
    }
    byAddr.set(address.toLowerCase(), name);
    for (const ev of contractEvents[name]) {
      try {
        const topic = contract.interface.getEvent(ev)!.topicHash;
        if (!allTopics.includes(topic)) allTopics.push(topic);
      } catch (e) {
        throw new AuditIndexError(`Audit event index unavailable (${name} ABI for ${ev}: ${safeReason(e)})`);
      }
    }
  }
  const addresses = Array.from(byAddr.keys());

  let latest: number;
  try {
    latest = await provider.getBlockNumber();
  } catch (e) {
    throw new AuditIndexError(`Audit event index unavailable (chain head: ${safeReason(e)})`);
  }
  const fromBlock = deploymentStartBlock();
  if (latest < fromBlock) return [];

  // Bidirectional order: alternate newest/oldest windows so both fresh demo
  // transactions (head) and deployment-era events (start) stream in within
  // seconds, while the empty middle fills in the background.
  const windows: Array<[number, number]> = [];
  let lo = fromBlock;
  let hi = latest;
  let takeNewest = true;
  while (lo <= hi) {
    if (takeNewest) {
      const to = hi;
      const from = Math.max(lo, to - LOG_CHUNK_SIZE + 1);
      windows.push([from, to]);
      hi = from - 1;
    } else {
      const from = lo;
      const to = Math.min(lo + LOG_CHUNK_SIZE - 1, hi);
      windows.push([from, to]);
      lo = to + 1;
    }
    takeNewest = !takeNewest;
  }

  const byBlock = new Map<number, number | null>();
  const roleCache: { issuer?: string; verifier?: string; admin?: string } = {};

  const fillTimestamps = async (recs: AuditRecord[]): Promise<void> => {
    const missing = Array.from(new Set(recs.map((r) => r.blockNumber))).filter((b) => !byBlock.has(b));
    await Promise.all(
      missing.map(async (b) => {
        try {
          const block = await provider.getBlock(b);
          byBlock.set(b, block ? block.timestamp : null);
        } catch {
          byBlock.set(b, null);
        }
      })
    );
    for (const r of recs) r.timestamp = byBlock.get(r.blockNumber) ?? null;
  };

  const decodeIdentityLogs = (logs: Log[], out: AuditRecord[]): void => {
    for (const log of logs) {
      let parsed: { name: string; args: Record<string, unknown> };
      try {
        const p = identity.interface.parseLog({ topics: log.topics as string[], data: log.data });
        if (!p) continue;
        parsed = { name: p.name, args: p.args as unknown as Record<string, unknown> };
      } catch {
        continue;
      }
      const user = str(parsed.args.user);
      if (parsed.name === "IdentityAnchored") {
        out.push({
          key: `${log.transactionHash}-${log.index}`,
          category: "Identity",
          event: parsed.name,
          title: "Identity Anchored",
          description: `Identity ${str(parsed.args.did) ? `"${str(parsed.args.did)}" ` : ""}was anchored to wallet ${shortAddress(user)}.`,
          actor: user || null,
          related: user || null,
          tokenId: null,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          logIndex: log.index,
          timestamp: null,
          contractName: "IdentityRegistry"
        });
      } else if (parsed.name === "IdentityUpdated") {
        out.push({
          key: `${log.transactionHash}-${log.index}`,
          category: "Identity",
          event: parsed.name,
          title: "Identity Updated",
          description: `Identity for wallet ${shortAddress(user)} was updated to "${str(parsed.args.did)}".`,
          actor: user || null,
          related: user || null,
          tokenId: null,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          logIndex: log.index,
          timestamp: null,
          contractName: "IdentityRegistry"
        });
      } else if (parsed.name === "IdentityRevoked") {
        out.push({
          key: `${log.transactionHash}-${log.index}`,
          category: "Identity",
          event: parsed.name,
          title: "Identity Revoked",
          description: `Identity for wallet ${shortAddress(user)} was revoked and is no longer valid.`,
          actor: user || null,
          related: user || null,
          tokenId: null,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          logIndex: log.index,
          timestamp: null,
          contractName: "IdentityRegistry"
        });
      }
    }
  };

  const decodeAccessLogs = async (logs: Log[], out: AuditRecord[]): Promise<void> => {
    for (const log of logs) {
      let parsed: { name: string; args: Record<string, unknown> };
      try {
        const p = access.interface.parseLog({ topics: log.topics as string[], data: log.data });
        if (!p) continue;
        parsed = { name: p.name, args: p.args as unknown as Record<string, unknown> };
      } catch {
        continue;
      }
      if (!ACCESS_EVENTS.includes(parsed.name as (typeof ACCESS_EVENTS)[number])) continue;
      // Skip the raw OZ duplicate when our *_Logged twin exists in the same tx is not
      // detectable here — both are real events, so label them honestly instead.
      const granted = isGrantedEvent(parsed.name);
      const label = await roleLabel(str(parsed.args.role), access, roleCache);
      const account = str(parsed.args.account);
      const sender = str(parsed.args.sender);
      const origin = sender.toLowerCase() === "0x0000000000000000000000000000000000000000"
        ? "assigned at contract deployment"
        : granted
          ? `granted to wallet ${shortAddress(account)} by ${shortAddress(sender)}`
          : `revoked from wallet ${shortAddress(account)} by ${shortAddress(sender)}`;
      out.push({
        key: `${log.transactionHash}-${log.index}`,
        category: "Access",
        event: parsed.name,
        title: granted ? `${label} Role Granted` : `${label} Role Revoked`,
        description: granted
          ? `${label} access was ${origin}.`
          : `${label} access was ${origin}.`,
        actor: sender || null,
        related: account || null,
        tokenId: null,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        logIndex: log.index,
        timestamp: null,
        contractName: "AccessManager"
      });
    }
  };

  const decodeAssetLogs = (logs: Log[], out: AuditRecord[]): void => {
    for (const log of logs) {
      let parsed: { name: string; args: Record<string, unknown> };
      try {
        const p = asset.interface.parseLog({ topics: log.topics as string[], data: log.data });
        if (!p) continue;
        parsed = { name: p.name, args: p.args as unknown as Record<string, unknown> };
      } catch {
        continue;
      }
      const tokenId = num(parsed.args.tokenId);
      if (parsed.name === "AssetRegistered") {
        const owner = str(parsed.args.owner);
        out.push({
          key: `${log.transactionHash}-${log.index}`,
          category: "Asset",
          event: parsed.name,
          title: `Asset Registered${tokenId !== null ? ` #${tokenId}` : ""}`,
          description: `Digital asset${tokenId !== null ? ` #${tokenId}` : ""} was registered to wallet ${shortAddress(owner)}.`,
          actor: owner || null,
          related: owner || null,
          tokenId,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          logIndex: log.index,
          timestamp: null,
          contractName: "AssetRegistry"
        });
      } else if (parsed.name === "AssetTransferred") {
        out.push({
          key: `${log.transactionHash}-${log.index}`,
          category: "Asset",
          event: parsed.name,
          title: `Asset Transferred${tokenId !== null ? ` #${tokenId}` : ""}`,
          description: `Asset${tokenId !== null ? ` #${tokenId}` : ""} ownership changed from ${shortAddress(str(parsed.args.from))} to ${shortAddress(str(parsed.args.to))}.`,
          actor: str(parsed.args.from) || null,
          related: str(parsed.args.to) || null,
          tokenId,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          logIndex: log.index,
          timestamp: null,
          contractName: "AssetRegistry"
        });
      } else if (parsed.name === "AssetLocked" || parsed.name === "AssetUnlocked") {
        const locked = parsed.name === "AssetLocked";
        out.push({
          key: `${log.transactionHash}-${log.index}`,
          category: "Asset",
          event: parsed.name,
          title: locked ? `Asset Locked${tokenId !== null ? ` #${tokenId}` : ""}` : `Asset Unlocked${tokenId !== null ? ` #${tokenId}` : ""}`,
          description: locked
            ? `Asset${tokenId !== null ? ` #${tokenId}` : ""} was locked by an admin. Transfers are frozen.`
            : `Asset${tokenId !== null ? ` #${tokenId}` : ""} was unlocked by an admin and is transferable again.`,
          actor: null,
          related: null,
          tokenId,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          logIndex: log.index,
          timestamp: null,
          contractName: "AssetRegistry"
        });
      } else if (parsed.name === "Transfer") {
        // Raw ERC721 transfer (mint/transfer). Shown honestly as the token-level movement.
        out.push({
          key: `${log.transactionHash}-${log.index}`,
          category: "Asset",
          event: parsed.name,
          title: `Token Movement${tokenId !== null ? ` #${tokenId}` : ""}`,
          description: `Token${tokenId !== null ? ` #${tokenId}` : ""} moved from ${shortAddress(str(parsed.args.from))} to ${shortAddress(str(parsed.args.to))} (ERC721 Transfer).`,
          actor: str(parsed.args.from) || null,
          related: str(parsed.args.to) || null,
          tokenId,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          logIndex: log.index,
          timestamp: null,
          contractName: "AssetRegistry"
        });
      }
    }
  };

  const all: AuditRecord[] = [];
  const decodeBatch = async (tagged: TaggedLog[]): Promise<AuditRecord[]> => {
    const batch: AuditRecord[] = [];
    decodeIdentityLogs(tagged.filter((t) => t.contractName === "IdentityRegistry").map((t) => t.log), batch);
    await decodeAccessLogs(tagged.filter((t) => t.contractName === "AccessManager").map((t) => t.log), batch);
    decodeAssetLogs(tagged.filter((t) => t.contractName === "AssetRegistry").map((t) => t.log), batch);
    await fillTimestamps(batch);
    return batch;
  };

  try {
    await mapPool(windows, WINDOW_CONCURRENCY, async ([from, to]) => {
      const logs = await fetchWindow(provider, addresses, allTopics, from, to);
      const tagged: TaggedLog[] = [];
      for (const log of logs) {
        const name = byAddr.get(log.address.toLowerCase());
        if (name) tagged.push({ log, contractName: name });
      }
      const batch = await decodeBatch(tagged);
      all.push(...batch);
      onProgress?.(batch);
    });
  } catch (e) {
    const inner = e instanceof AuditIndexError ? e.message : safeReason(e);
    throw new AuditIndexError(`Audit event index unavailable (${inner})`);
  }

  // Deduplicate (defensive: overlapping/retried ranges must never double-count).
  const seen = new Set<string>();
  const unique = all.filter((r) => {
    if (seen.has(r.key)) return false;
    seen.add(r.key);
    return true;
  });

  // Newest first.
  unique.sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
  return unique;
}

/** Block-explorer link when the network has one; null on localhost (explained in UI). */
export function explorerTxUrl(txHash: string): string | null {
  if (CHAIN_ID === 11155111) return `https://sepolia.etherscan.io/tx/${txHash}`;
  if (CHAIN_ID === 1) return `https://etherscan.io/tx/${txHash}`;
  return null;
}
