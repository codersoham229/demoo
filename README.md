# TrustLedger — SIH 2026 PS-26125 (Public Demo)

Blockchain-based secure platform for **Identity, Access Control, and Digital Asset Management** — public demonstration copy. Built with Next.js 14, ethers v6, Hardhat, and OpenZeppelin contracts.

> **Demo only.** Uses test networks and synthetic data. No real personal data, no mainnet usage.

## What it does

1. **Identity** — anchor one verifiable DID + credential hash per wallet (`IdentityRegistry`).
2. **Access** — Admin / Issuer / Verifier roles enforced by `AccessManager` (grant + revoke).
3. **Assets** — register digital certificates as NFTs with owner, lock state, and history (`AssetRegistry`).
4. **Verify** — check identity validity, roles, and asset ownership without a wallet.
5. **Audit** — every important operation is indexed from real on-chain events.

## Reference deployment (Ethereum Sepolia, chain 11155111)

Public contract addresses — also recorded in [`deployments/sepolia.json`](deployments/sepolia.json):

| Contract | Address |
| --- | --- |
| IdentityRegistry | `0x38cC76113b786495BB81a7250B7BF899c58DdcB2` |
| AccessManager | `0xB04CC349d389C00070435d85f92685801B70c15b` |
| AssetRegistry | `0x2E6E6cfFbe70D749bE5561F96fe6796AB74fafF0` |

View them on [Sepolia Etherscan](https://sepolia.etherscan.io/).

## Setup

Prerequisites: Node.js 20+, npm, MetaMask (for writes).

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local`:
- `NEXT_PUBLIC_RPC_URL` — your Sepolia RPC endpoint (or `http://127.0.0.1:8545` for local).
- `NEXT_PUBLIC_CHAIN_ID` — `11155111` for Sepolia, `31337` for local.
- `NEXT_PUBLIC_*_ADDR` — the three contract addresses (Sepolia ones above, or your local deploy output).
- `SEPOLIA_RPC_URL` / `DEPLOYER_PRIVATE_KEY` — only needed to deploy; use a dedicated throwaway key and never commit this file.

```bash
npm run dev      # http://localhost:3000 (or --port 3001)
npm run build    # production build check
```

## Local chain (optional)

```bash
npx hardhat node                                        # terminal 1
npx hardhat run scripts/deploy.ts --network localhost   # terminal 2
npm run seed:localhost                                  # optional demo data (real local txs)
```

## Sepolia deploy (maintainers)

```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

## 3-minute demo flow

1. Connect MetaMask (Sepolia, funded with a little SepoliaETH).
2. **Identity** → Fill demo values → Anchor Identity → `✓ VALID`.
3. **Access** (as admin/deployer wallet) → enter demo wallet → Grant Verifier.
4. **Assets** → Fill demo values → Register Asset → Token #1, ACTIVE.
5. **Verify** → check the wallet and the token → `✓ VERIFIED` / `OWNERSHIP VERIFIED`.
6. **Audit** → newest-first on-chain event timeline with transaction hashes.

## Repository layout

```
src/                Next.js app (app router), components, ethers v6 integration
contracts/          IdentityRegistry, AccessManager, AssetRegistry (Solidity)
scripts/            deploy.ts, seed-demo.ts (Hardhat, server-side only)
deployments/        public deployment records (addresses, no secrets)
```

## Security notes

- This repo contains **no private keys, API keys, or secrets** — `.env.local` is gitignored; configure it locally from `.env.example`.
- Only a DID string and a document *hash* go on-chain — never raw personal data.
- `DEPLOYER_PRIVATE_KEY`, if used, must be a throwaway key and must never leave your machine.
