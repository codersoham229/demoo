// Browser-safe configuration only. Never put DEPLOYER_PRIVATE_KEY here.
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 31337);

/** Human-readable name of the configured chain. Drive all network labels from this. */
export const NETWORK_NAME =
  CHAIN_ID === 11155111 ? "Sepolia" : CHAIN_ID === 31337 ? "Hardhat Local" : `Chain ${CHAIN_ID}`;

export const IDENTITY_ADDR = (process.env.NEXT_PUBLIC_IDENTITY_ADDR ?? "").toLowerCase();
export const ACCESS_ADDR = (process.env.NEXT_PUBLIC_ACCESS_ADDR ?? "").toLowerCase();
export const ASSET_ADDR = (process.env.NEXT_PUBLIC_ASSET_ADDR ?? "").toLowerCase();

// Public Spline 3D scene URL for the landing hero. Empty = show fallback panel.
// (Spline scene URLs are public by design — safe to expose via NEXT_PUBLIC_*.)
export const SPLINE_SCENE_URL = process.env.NEXT_PUBLIC_SPLINE_SCENE ?? "";

const ZERO = "0x0000000000000000000000000000000000000000";

export function isAddressConfigured(addr: string | undefined): boolean {
  if (!addr) return false;
  const a = addr.toLowerCase();
  return a !== "" && a !== ZERO && /^0x[0-9a-f]{40}$/.test(a);
}

export function contractsConfigured(): boolean {
  return isAddressConfigured(IDENTITY_ADDR) && isAddressConfigured(ACCESS_ADDR) && isAddressConfigured(ASSET_ADDR);
}

export function chainLabel(chainId: number | bigint | null | undefined): string {
  if (chainId === null || chainId === undefined) return "Not connected";
  const id = Number(chainId);
  if (id === 31337) return "Localhost 31337";
  if (id === 11155111) return "Sepolia testnet";
  if (id === 1) return "Ethereum mainnet (use testnet only)";
  if (Number.isNaN(id)) return "Unknown network";
  return `Chain ${id}`;
}
