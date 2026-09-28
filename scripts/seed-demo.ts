import fs from "fs";
import path from "path";
import hre from "hardhat";

// Default import (not `import { ethers }`) because scripts may load as ESM,
// where named imports from Hardhat's CommonJS package fail on Node 22+.
const { ethers } = hre;

/**
 * OPTIONAL demo initializer. Creates a small deterministic demo state with REAL
 * transactions on the target Hardhat network (default: localhost).
 *
 *   npx hardhat run scripts/seed-demo.ts --network localhost
 *
 * Creates (all synthetic, clearly labeled):
 *   - identities for 2 test wallets (each wallet anchors its own identity)
 *   - Issuer role -> test wallet #1, Verifier role -> test wallet #2
 *   - 2 registered assets (#1 -> wallet #1, #2 -> wallet #2)
 *
 * Server/deployment-only. Uses Hardhat signers — never handles real keys and
 * must NEVER be imported from browser/client code. Never runs automatically.
 */
async function main() {
  const networkName = hre.network.name;
  const deploymentsFile = path.join(process.cwd(), "deployments", `${networkName}.json`);
  if (!fs.existsSync(deploymentsFile)) {
    throw new Error(
      `No deployment found at deployments/${networkName}.json. Run "npx hardhat run scripts/deploy.ts --network ${networkName}" first.`
    );
  }
  const addrs = JSON.parse(fs.readFileSync(deploymentsFile, "utf8")) as {
    IdentityRegistry: string;
    AccessManager: string;
    AssetRegistry: string;
  };

  const [admin, issuerWallet, verifierWallet] = await ethers.getSigners();
  console.log(`Network: ${networkName}`);
  console.log(`Admin:   ${admin.address}`);
  console.log(`Issuer:  ${issuerWallet.address}`);
  console.log(`Verifier:${verifierWallet.address}`);

  const identity = await ethers.getContractAt("IdentityRegistry", addrs.IdentityRegistry);
  const access = await ethers.getContractAt("AccessManager", addrs.AccessManager);
  const asset = await ethers.getContractAt("AssetRegistry", addrs.AssetRegistry);

  const hash = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));

  // 1. Identities (each wallet anchors its own — same rule as the UI enforces).
  const tx1 = await identity
    .connect(issuerWallet)
    .anchorIdentity(
      `did:demo:seed-issuer-${issuerWallet.address.toLowerCase().slice(2, 8)}`,
      hash("SEED-CRED-ISSUER-001")
    );
  await tx1.wait();
  console.log(`Identity anchored for issuer wallet: ${tx1.hash}`);
  const tx2 = await identity
    .connect(verifierWallet)
    .anchorIdentity(
      `did:demo:seed-verifier-${verifierWallet.address.toLowerCase().slice(2, 8)}`,
      hash("SEED-CRED-VERIFIER-001")
    );
  await tx2.wait();
  console.log(`Identity anchored for verifier wallet: ${tx2.hash}`);

  // 2. Roles (admin grants — same rule as the Access page enforces).
  const g1 = await access.connect(admin).grantIssuer(issuerWallet.address);
  await g1.wait();
  console.log(`Issuer role granted: ${g1.hash}`);
  const g2 = await access.connect(admin).grantVerifier(verifierWallet.address);
  await g2.wait();
  console.log(`Verifier role granted: ${g2.hash}`);

  // 3. Assets (admin holds MINTER_ROLE after deployment).
  const a1 = await asset
    .connect(admin)
    .registerAsset(issuerWallet.address, "sih26125:Seed Demo Certificate|Certificate|SEED-CERT-001");
  await a1.wait();
  console.log(`Asset #1 registered: ${a1.hash}`);
  const a2 = await asset
    .connect(admin)
    .registerAsset(verifierWallet.address, "sih26125:Seed Demo ID Card|Identity Document|SEED-DOC-002");
  await a2.wait();
  console.log(`Asset #2 registered: ${a2.hash}`);

  console.log("\nSeed complete. Open /audit to see these real on-chain events.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
