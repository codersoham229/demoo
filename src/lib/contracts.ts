"use client";

import { BrowserProvider, Contract, JsonRpcProvider, Signer, ethers } from "ethers";
import { ACCESS_ADDR, ASSET_ADDR, IDENTITY_ADDR, RPC_URL, isAddressConfigured } from "./config";

// Minimal ABIs matching the Stage-1 contracts. Kept here (not per-page) so
// connection logic lives in one place.
export const IDENTITY_ABI = [
  "function anchorIdentity(string did, bytes32 credentialHash) external",
  "function updateIdentity(string did, bytes32 credentialHash) external",
  "function revokeIdentity() external",
  "function getIdentity(address user) view returns (tuple(string did, bytes32 credentialHash, bool revoked, uint256 updatedAt))",
  "function isValid(address user) view returns (bool)",
  "event IdentityAnchored(address indexed user, string did, bytes32 credentialHash)",
  "event IdentityUpdated(address indexed user, string did, bytes32 credentialHash)",
  "event IdentityRevoked(address indexed user, string did)"
];

export const ACCESS_ABI = [
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function ISSUER_ROLE() view returns (bytes32)",
  "function VERIFIER_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function grantIssuer(address account) external",
  "function revokeIssuer(address account) external",
  "function grantVerifier(address account) external",
  "function revokeVerifier(address account) external",
  "function hasIssuerRole(address account) view returns (bool)",
  "function hasVerifierRole(address account) view returns (bool)",
  "event RoleGrantedLogged(bytes32 indexed role, address indexed account, address indexed sender)",
  "event RoleRevokedLogged(bytes32 indexed role, address indexed account, address indexed sender)",
  "event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)",
  "event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)"
];

export const ASSET_ABI = [
  "function registerAsset(address to, string tokenURI_) external returns (uint256)",
  "function transferAsset(address to, uint256 tokenId) external",
  "function lockAsset(uint256 tokenId) external",
  "function unlockAsset(uint256 tokenId) external",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function locked(uint256 tokenId) view returns (bool)",
  "event AssetRegistered(uint256 indexed tokenId, address indexed owner, string tokenURI)",
  "event AssetTransferred(uint256 indexed tokenId, address indexed from, address indexed to)",
  "event AssetLocked(uint256 indexed tokenId)",
  "event AssetUnlocked(uint256 indexed tokenId)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

export type IdentityRecord = {
  did: string;
  credentialHash: string;
  revoked: boolean;
  updatedAt: bigint;
};

export function getReadProvider(): JsonRpcProvider {
  return new JsonRpcProvider(RPC_URL);
}

function requireConfigured(addr: string, name: string): void {
  if (!isAddressConfigured(addr)) {
    throw new Error(
      `${name} contract address is not configured. Deploy with scripts/deploy.ts and set NEXT_PUBLIC_* in .env.local, then restart the app.`
    );
  }
}

// ---- Read/write contract factories ----

export function getIdentityRead(): Contract {
  requireConfigured(IDENTITY_ADDR, "IdentityRegistry");
  return new Contract(IDENTITY_ADDR, IDENTITY_ABI, getReadProvider());
}

export function getIdentityWrite(signer: Signer): Contract {
  requireConfigured(IDENTITY_ADDR, "IdentityRegistry");
  return new Contract(IDENTITY_ADDR, IDENTITY_ABI, signer);
}

export function getAccessRead(): Contract {
  requireConfigured(ACCESS_ADDR, "AccessManager");
  return new Contract(ACCESS_ADDR, ACCESS_ABI, getReadProvider());
}

export function getAccessWrite(signer: Signer): Contract {
  requireConfigured(ACCESS_ADDR, "AccessManager");
  return new Contract(ACCESS_ADDR, ACCESS_ABI, signer);
}

export function getAssetRead(): Contract {
  requireConfigured(ASSET_ADDR, "AssetRegistry");
  return new Contract(ASSET_ADDR, ASSET_ABI, getReadProvider());
}

export function getAssetWrite(signer: Signer): Contract {
  requireConfigured(ASSET_ADDR, "AssetRegistry");
  return new Contract(ASSET_ADDR, ASSET_ABI, signer);
}

export function getSignerProvider(): BrowserProvider {
  const eth = (window as unknown as { ethereum?: unknown }).ethereum;
  if (!eth) throw new Error("No injected wallet found. Install MetaMask (test network only).");
  return new BrowserProvider(eth as ethers.Eip1193Provider);
}

// ---- Shared read helpers ----

export async function readIdentity(user: string): Promise<{ record: IdentityRecord; valid: boolean }> {
  const c = getIdentityRead();
  const [rec, valid] = await Promise.all([c.getIdentity(user), c.isValid(user)]);
  return {
    record: { did: rec.did as string, credentialHash: rec.credentialHash as string, revoked: rec.revoked as boolean, updatedAt: rec.updatedAt as bigint },
    valid: valid as boolean
  };
}

export type RoleStatus = { admin: boolean; issuer: boolean; verifier: boolean };

export async function readRoles(user: string): Promise<RoleStatus> {
  const c = getAccessRead();
  const [adminRole, issuerRole, verifierRole] = await Promise.all([
    c.DEFAULT_ADMIN_ROLE() as Promise<string>,
    c.ISSUER_ROLE() as Promise<string>,
    c.VERIFIER_ROLE() as Promise<string>
  ]);
  const [admin, issuer, verifier] = await Promise.all([
    c.hasRole(adminRole, user) as Promise<boolean>,
    c.hasRole(issuerRole, user) as Promise<boolean>,
    c.hasRole(verifierRole, user) as Promise<boolean>
  ]);
  return { admin, issuer, verifier };
}

export type AssetInfo = {
  tokenId: number;
  owner: string;
  uri: string;
  locked: boolean;
};

export async function readAsset(tokenId: number): Promise<AssetInfo> {
  const c = getAssetRead();
  const [owner, uri, locked] = await Promise.all([
    c.ownerOf(tokenId) as Promise<string>,
    c.tokenURI(tokenId) as Promise<string>,
    c.locked(tokenId) as Promise<boolean>
  ]);
  return { tokenId, owner, uri, locked };
}

/** Probe sequential token IDs (1..limit). Stops after 3 consecutive gaps. Honest on-chain count. */
export async function listAssets(limit = 25): Promise<{ assets: AssetInfo[]; scanned: number }> {
  const c = getAssetRead();
  const assets: AssetInfo[] = [];
  let gaps = 0;
  let scanned = 0;
  for (let id = 1; id <= limit; id++) {
    scanned = id;
    try {
      const [owner, uri, locked] = await Promise.all([
        c.ownerOf(id) as Promise<string>,
        c.tokenURI(id) as Promise<string>,
        c.locked(id) as Promise<boolean>
      ]);
      assets.push({ tokenId: id, owner, uri, locked });
      gaps = 0;
    } catch {
      gaps += 1;
      if (gaps >= 3 && assets.length > 0) break;
    }
  }
  return { assets, scanned };
}
