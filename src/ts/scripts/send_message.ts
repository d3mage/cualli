import {
  AztecAddress,
  Contract,
  loadContractArtifact,
  NoirCompiledContract,
} from "@aztec/aztec.js";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { TokenContract } from "@aztec/noir-contracts.js/Token";
import RecoveryJson from "../../../target/recovery-Recovery.json" with { type: "json" };
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { loadSchnorrAccount } from "../utils/address.ts";
import { setupPXE } from "../utils/setup_pxe.ts";
import { getSponsoredFPCInstance } from "../utils/fpc.ts";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";

// ---------- ENV ----------
const {
  ADDRESSES_FILE = path.join(process.cwd(), "addresses.json"),
  WORMHOLE_ADDR = "0x1320a7c89797e4506b683fcc547acb7f02a809bd1b3a967a3dfe18b7d3f38669",
  TOKEN_ADDR = "0x037e5d19d6d27e2fb7c947cfe7c36459e27d35e46dd59f5f47373a64ff491d2c",
  WORMHOLE_FEE_RECEIVER = "0x0d071eec273fa0c82825d9c5d2096965a40bcc33ae942714cf6c683af9632504",
  DEST_ADDRESS = "0x009cbB8f91d392856Cb880d67c806Aa731E3d686",
  DEST_CHAIN_ID = "10004",
  CANDIDATE_ETH = "0x1234567890abcdef1234567890abcdef12345678",
} = process.env as Record<string, string>;

// ---------- HELPERS ----------
function hexAddressToU8x31(hex: string) {
  let s = hex.toLowerCase();
  if (s.startsWith("0x")) s = s.slice(2);
  if (s.length !== 40) throw new Error(`Invalid EVM address: ${hex}`);
  const out = new Uint8Array(31);
  for (let i = 0; i < 20; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function chainIdToU8x31(chainId: bigint | number | string) {
  const out = new Uint8Array(31);
  let x = BigInt(chainId);
  let i = 0;
  while (x > 0n && i < 31) {
    out[i++] = Number(x & 0xffn);
    x >>= 8n;
  }
  return out;
}

function zeroU8x31() {
  return new Uint8Array(31);
}

function readJson<T = any>(p: string): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return undefined;
  }
}

async function registerContractIfNeeded(
  pxe: any,
  instance: any,
  artifact: any,
) {
  const list = await pxe.getRegisteredContracts?.();
  const already =
    Array.isArray(list) &&
    list.some((c: any) => c.instance.address.equals(instance.address));
  if (!already) {
    await pxe.registerContract({ instance, artifact });
  }
}

async function registerClassIfNeeded(pxe: any, artifact: any) {
  // If PXE exposes class queries, check them; otherwise try/catch registration for idempotency.
  try {
    const classes = await pxe.getRegisteredContractClasses?.();
    const hash = artifact?.hash ?? artifact?.artifactHash;
    const already =
      Array.isArray(classes) &&
      hash &&
      classes.some((c: any) => c.hash === hash || c.artifactHash === hash);
    if (!already) {
      await pxe.registerContractClass(artifact);
    }
  } catch {
    // Fallback: attempt registration; PXE should no-op if already present
    await pxe.registerContractClass(artifact);
  }
}

async function ensureKnownContractAtAddress(
  pxe: any,
  artifact: any,
  addr: AztecAddress,
) {
  await registerClassIfNeeded(pxe, artifact);
  const meta = await pxe.getContractMetadata(addr);
  if (!meta?.contractInstance)
    throw new Error(`Contract not found at ${addr.toString()}`);
  await registerContractIfNeeded(pxe, meta.contractInstance, artifact);
}

// ---------- MAIN ----------
async function main() {
  const pxe = await setupPXE();
  const wallet = await loadSchnorrAccount("WALLET_A", pxe);

  const addresses = readJson<{ recovery: string }>(ADDRESSES_FILE);
  if (!addresses?.recovery) {
    throw new Error(`addresses.json missing "recovery" at ${ADDRESSES_FILE}`);
  }

  // Ensure Sponsored FPC is registered (for sponsored fees)
  const sponsoredFPC = await getSponsoredFPCInstance();
  await registerContractIfNeeded(
    pxe,
    sponsoredFPC,
    SponsoredFPCContract.artifact,
  );
  const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(
    sponsoredFPC.address,
  );

  // Bind Recovery
  const recoveryAddr = AztecAddress.fromString(addresses.recovery);
  const RecoveryArtifact = loadContractArtifact(
    RecoveryJson as NoirCompiledContract,
  );
  const recovery = await Contract.at(recoveryAddr, RecoveryArtifact, wallet);

  // Ensure Token is known to PXE (class + instance)
  const tokenAddress = AztecAddress.fromString(TOKEN_ADDR);
  await ensureKnownContractAtAddress(pxe, TokenContract.artifact, tokenAddress);
  const token = await TokenContract.at(tokenAddress, wallet);

  // Build auth witness for Wormhole's private fee transfer
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const noncePath = path.join(__dirname, "nonce.json");
  const nonceData = readJson<{ token_nonce?: string }>(noncePath) ?? {};
  const current = BigInt(nonceData.token_nonce ?? "0");
  const token_nonce = current + 1n;
  fs.writeFileSync(
    noncePath,
    JSON.stringify({ token_nonce: token_nonce.toString() }, null, 2),
    "utf8",
  );

  const wormholeAddress = AztecAddress.fromString(WORMHOLE_ADDR);
  const feeReceiver = AztecAddress.fromString(WORMHOLE_FEE_RECEIVER);
  const messageFee = 1n;

  const feeAction = token.methods.transfer_in_private(
    wallet.getAddress(),
    feeReceiver,
    messageFee,
    token_nonce,
  );
  const wormholeWitness = await wallet.createAuthWit({
    caller: wormholeAddress,
    action: feeAction,
  });

  // Payload parts
  const msg0_dest = hexAddressToU8x31(DEST_ADDRESS);
  const msg1_chain = chainIdToU8x31(DEST_CHAIN_ID);
  const msgArrays: Uint8Array[] = [
    msg0_dest,
    msg1_chain,
    zeroU8x31(),
    zeroU8x31(),
    zeroU8x31(),
    zeroU8x31(),
    zeroU8x31(),
  ];

  // Send
  const sendOpts: any = {
    authWitnesses: [wormholeWitness],
    fee: { paymentMethod: sponsoredPaymentMethod },
  };

  const tx = await recovery.methods
    .send_wormhole_message(
      CANDIDATE_ETH,
      msgArrays,
      wormholeAddress,
      tokenAddress.toString(),
      token_nonce,
    )
    .send(sendOpts)
    .wait();

  console.log("✅ Sent. txHash:", tx.txHash, "block:", tx.blockNumber);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
