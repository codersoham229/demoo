import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
const sepoliaRpc = process.env.SEPOLIA_RPC_URL ?? "";

// NOTE: DEPLOYER_PRIVATE_KEY is server/deployment-only. Never import it in client code.
// NEXT_PUBLIC_* vars are browser-safe config only (RPC URL, chain id, contract addresses).

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    ...(sepoliaRpc && deployerKey
      ? {
          sepolia: {
            url: sepoliaRpc,
            accounts: [deployerKey]
          }
        }
      : {})
  }
};

export default config;
