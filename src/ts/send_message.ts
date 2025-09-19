import {
  AztecAddress,
  Contract,
  createLogger,
  loadContractArtifact,
} from "@aztec/aztec.js";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { TokenContract } from "@aztec/noir-contracts.js/Token";
import RecoveryJson from "../../target/recovery-Recovery.json" with { type: "json" };
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { loadSchnorrAccount } from "./deploy_address.ts";
import { setupPXE } from "./setup_pxe.ts";
import { getSponsoredFPCInstance } from "./fpc.ts";

// ---------- ENV ----------
const {
  // Recovery contract Aztec address (written by your deploy step).
  ADDRESSES_FILE = path.join(process.cwd(), "addresses.json"),

  // Wormhole contract Aztec address (the one your Recovery calls into).
  WORMHOLE_ADDR = "0x1320a7c89797e4506b683fcc547acb7f02a809bd1b3a967a3dfe18b7d3f38669",

  // Token used as message_fee inside Wormhole.publish_message_in_private (must match Wormhole’s hardcoded value if any).
  TOKEN_ADDR = "0x037e5d19d6d27e2fb7c947cfe7c36459e27d35e46dd59f5f47373a64ff491d2c",

  // Receiver address used by Wormhole for the private fee transfer (must match Wormhole’s hardcoded receiver).
  WORMHOLE_FEE_RECEIVER = "0x0d071eec273fa0c82825d9c5d2096965a40bcc33ae942714cf6c683af9632504",

  // Payload content for your Recovery::send_wormhole_message
  DEST_ADDRESS = "0x009cbB8f91d392856Cb880d67c806Aa731E3d686", // EVM address to relay in payload[0]
  DEST_CHAIN_ID = "10004", // payload[1], little-endian u8[31]

  // Candidate (Eth L1 address) that your Recovery encodes into payload[2]
  CANDIDATE_ETH = "0x1234567890abcdef1234567890abcdef12345678",

  // Path to a Schnorr account seed (created via your own deploy script). If absent, falls back to PXE test accounts wallet.
  SCHNORR_FILE = path.join(process.cwd(), "WALLET_A.json"),
} = process.env as Record<string, string>;

// ---------- UTILS ----------
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
// ---------- MAIN ----------
async function main() {
  const pxe = await setupPXE();
  const wallet = await loadSchnorrAccount("WALLET_A", pxe);

  const addresses = readJson<{ recovery: string }>(ADDRESSES_FILE);
  if (!addresses?.recovery) {
    throw new Error(
      `addresses.json missing "recovery" address at ${ADDRESSES_FILE}`,
    );
  }

  const logger = createLogger("aztec:aztec-starter");
  logger.info("Here...");

  const recoveryAddr = AztecAddress.fromString(addresses.recovery);
  const RecoveryArtifact = loadContractArtifact(RecoveryJson);
  const recovery = await Contract.at(recoveryAddr, RecoveryArtifact, wallet);

  logger.info("Here2...");

  const wormholeAddress = AztecAddress.fromString(WORMHOLE_ADDR);

  const tokenAddress = TOKEN_ADDR;
  await pxe.registerContractClass(TokenContract.artifact);
  const meta = await pxe.getContractMetadata(
    AztecAddress.fromString(tokenAddress),
  );
  if (!meta.contractInstance)
    throw new Error("Contract not found at that address");
  await pxe.registerContract({
    instance: meta.contractInstance,
    artifact: TokenContract.artifact,
  });

  const token = await TokenContract.at(
    AztecAddress.fromString(tokenAddress),
    wallet,
  );
  logger.info("Here3...");

  // Nonce for the *private token fee* consumed by Wormhole.publish_message_in_private
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

  // Authwit for the *private* fee transfer executed by Wormhole (must match its internal call exactly).
  // from = our wallet; to = Wormhole's hardcoded fee receiver; amount = 1; nonce = token_nonce
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

  // 7 × [u8;31] message arrays for Recovery::send_wormhole_message
  const msg0_dest = hexAddressToU8x31(DEST_ADDRESS);
  const msg1_chain = chainIdToU8x31(DEST_CHAIN_ID);
  const msg2 = zeroU8x31();
  const msg3 = zeroU8x31();
  const msg4 = zeroU8x31();
  const msg5 = zeroU8x31();
  const msg6 = zeroU8x31();
  const msgArrays: Uint8Array[] = [
    msg0_dest,
    msg1_chain,
    msg2,
    msg3,
    msg4,
    msg5,
    msg6,
  ];

  const candidateEth = CANDIDATE_ETH;

  const sponsoredFPC = await getSponsoredFPCInstance();
  const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(
    sponsoredFPC.address,
  );
  const sendOpts: any = { authWitnesses: [wormholeWitness] };
  sendOpts.fee = { paymentMethod: sponsoredPaymentMethod };

  const tx = await recovery.methods
    .send_wormhole_message(
      candidateEth, // EthAddress encoded inside the contract into payload[2]
      msgArrays, // [[u8;31];7] → payload[0]=dest, [1]=chain id, [3..7]=spares
      wormholeAddress,
      tokenAddress,
      token_nonce, // Field-compatible; contract treats it as the token nonce too
    )
    .send(sendOpts)
    .wait();

  console.log("✅ Sent. txHash:", tx.txHash, "block:", tx.blockNumber);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
