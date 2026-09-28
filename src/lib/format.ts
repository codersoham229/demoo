export function shortAddress(addr: string | null | undefined): string {
  if (!addr) return "—";
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function shortHash(hash: string | null | undefined): string {
  if (!hash) return "—";
  if (hash.length < 14) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export type TxStage = "ready" | "confirm" | "pending" | "confirmed" | "failed";

export const TX_STAGE_LABEL: Record<TxStage, string> = {
  ready: "Ready",
  confirm: "Waiting for wallet…",
  pending: "Confirming transaction…",
  confirmed: "Transaction confirmed",
  failed: "Failed"
};

export function txStageHint(stage: TxStage): string {
  switch (stage) {
    case "ready":
      return "Fill the form, then submit. Your wallet will ask for approval — nothing happens until you confirm.";
    case "confirm":
      return "Waiting for wallet… approve or reject the transaction in MetaMask.";
    case "pending":
      return "Confirming transaction… waiting for the blockchain to include it.";
    case "confirmed":
      return "Transaction confirmed on-chain. The state below was re-read from the contract.";
    case "failed":
      return "Transaction failed or was rejected. See the error below — nothing was written.";
  }
}

export function friendlyError(e: unknown): string {
  if (e instanceof Error) {
    const msg = e.message;
    if (/user rejected|user denied|rejected the request/i.test(msg)) {
      return "You rejected the transaction in your wallet. Nothing was sent.";
    }
    if (/no injected wallet|metamask/i.test(msg)) return msg;
    if (/insufficient funds/i.test(msg)) return "Insufficient test funds for gas. Fund this account from the local node or faucet.";
    if (/already anchored/i.test(msg)) return "This wallet already has an identity. Use Update instead of Anchor.";
    if (/not anchored/i.test(msg)) return "No identity found for this wallet yet. Anchor one first.";
    if (/revoked/i.test(msg)) return "This identity has been revoked and cannot be updated.";
    if (/not authorized|AccessControl/i.test(msg)) return "Your wallet lacks the required on-chain role for this action.";
    if (/asset locked/i.test(msg)) return "This asset is locked and cannot be transferred until unlocked by an admin.";
    if (/nonexistent token|ERC721NonexistentToken|invalid token/i.test(msg)) return "That token ID does not exist.";
    // Trim verbose ethers revert data but keep the first useful line.
    const first = msg.split("\n")[0];
    return first.length > 300 ? first.slice(0, 300) + "…" : first;
  }
  return "Unexpected error. See console for details.";
}
