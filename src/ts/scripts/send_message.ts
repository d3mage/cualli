import { AztecAddress } from "@aztec/aztec.js/addresses";
import { loadContractArtifact } from "@aztec/aztec.js/abi";
import type { NoirCompiledContract } from "@aztec/aztec.js/abi";
import { createLogger } from "@aztec/aztec.js/log";
import type { Logger } from "@aztec/aztec.js/log";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import RecoveryJson from "../../../target/recovery-Recovery.json" with { type: "json" };
import * as path from "path";
import { loadSchnorrAccount } from "../utils/address.ts";
import { getSponsoredFPCInstance } from "../utils/fpc.ts";
import {
  readJson,
  hexAddressToU8x31,
  chainIdToU8x31,
  zeroU8x31,
  is_registered,
} from "../utils/utils.ts";
import { Contract } from "@aztec/aztec.js/contracts";
import { setupWallet } from "../utils/wallet.ts";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { loadRecovery } from "../utils/deployment.ts";

const RecoveryArtifact = loadContractArtifact(
  RecoveryJson as NoirCompiledContract,
);

const {
  RECOVERY_ADDRESS_FILE = path.join(process.cwd(), "../config/recovery.json"),
  RECOVERY_PARAMS_FILE = path.join(
    process.cwd(),
    "../config/recovery_params.json",
  ),
  DEST_ADDRESS = "0x31B807f791dCc3f86DDef5b31BA76F62c0eb832F",
  DEST_CHAIN_ID = "421614",
  CANDIDATE_ETH = "0x1234567890abcdef1234567890abcdef12345678",
} = process.env as Record<string, string>;

async function main() {
  const logger: Logger = createLogger("send-message");

  const wallet = await setupWallet();
  const ownerAccount = await loadSchnorrAccount(wallet, "wallet0");
  const ownerAddress = ownerAccount.address;

  let recoveryAddr = readJson<{ recovery: string }>(
    RECOVERY_ADDRESS_FILE,
  )?.recovery;
  if (!recoveryAddr) {
    throw new Error(
      `recovery.json missing "recovery" at ${RECOVERY_ADDRESS_FILE}`,
    );
  }
  const recoveryAddress = AztecAddress.fromString(recoveryAddr);

  const sponsoredFPC = await getSponsoredFPCInstance();
  await wallet.registerContract({
    instance: sponsoredFPC,
    artifact: SponsoredFPCContract.artifact,
  });
  const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(
    sponsoredFPC.address,
  );

  const isRecoveryRegistered = await is_registered(wallet, recoveryAddress);
  if (!isRecoveryRegistered) {
    logger.info(
      "📦 Reconstructing contract instance from environment variables...",
    );

    const recovery = await loadRecovery(RECOVERY_PARAMS_FILE, RecoveryArtifact);
    logger.info("✅ Contract instance reconstructed successfully");

    await wallet.registerContract({
      instance: recovery,
      artifact: RecoveryArtifact,
    });
    logger.info("✅ Contract registered with the wallet");
  }

  const recovery = await Contract.at(recoveryAddress, RecoveryArtifact, wallet);

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

  logger.info(`Sending message with payload: ${msgArrays}`);

  const tx = await recovery.methods
    .send_wormhole_message(CANDIDATE_ETH, msgArrays)
    .send({
      from: ownerAddress,
      fee: { paymentMethod: sponsoredPaymentMethod },
    })
    .wait({ timeout: 180 });

  logger.info(`✅ Sent. txHash: ${tx.txHash}, block: ${tx.blockNumber}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
