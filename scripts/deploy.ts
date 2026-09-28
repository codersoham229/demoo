import fs from "fs";
import path from "path";
import hre from "hardhat";

// Default import (not `import { ethers }`) because scripts may load as ESM,
// where named imports from Hardhat's CommonJS package fail on Node 22+.
const { ethers } = hre;

/**
 * Deploys the 3 SIH-26125 prototype contracts.
 * Server/deployment-only script: may read DEPLOYER_PRIVATE_KEY via hardhat network config.
 * Never import this file (or DEPLOYER_PRIVATE_KEY) from client/browser code.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
  const identity = await IdentityRegistry.deploy();
  await identity.waitForDeployment();
  const identityAddr = await identity.getAddress();
  console.log(`IdentityRegistry: ${identityAddr}`);

  const AccessManager = await ethers.getContractFactory("AccessManager");
  const access = await AccessManager.deploy(deployer.address);
  await access.waitForDeployment();
  const accessAddr = await access.getAddress();
  console.log(`AccessManager: ${accessAddr}`);

  const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
  const asset = await AssetRegistry.deploy(deployer.address);
  await asset.waitForDeployment();
  const assetAddr = await asset.getAddress();
  console.log(`AssetRegistry: ${assetAddr}`);

  console.log("\nCopy into .env.local (browser-safe NEXT_PUBLIC_* only):");
  console.log(`NEXT_PUBLIC_IDENTITY_ADDR=${identityAddr}`);
  console.log(`NEXT_PUBLIC_ACCESS_ADDR=${accessAddr}`);
  console.log(`NEXT_PUBLIC_ASSET_ADDR=${assetAddr}`);

  // Persist addresses for tooling (e.g. scripts/seed-demo.ts). Contains no keys.
  const networkName = hre.network.name;
  const outDir = path.join(process.cwd(), "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${networkName}.json`);
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        network: networkName,
        chainId: hre.network.config.chainId ?? null,
        IdentityRegistry: identityAddr,
        AccessManager: accessAddr,
        AssetRegistry: assetAddr,
        deployer: deployer.address
      },
      null,
      2
    ) + "\n"
  );
  console.log(`\nSaved to ${path.relative(process.cwd(), outFile)}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
