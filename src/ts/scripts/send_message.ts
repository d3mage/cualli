import {
  AztecAddress,
  Contract,
  loadContractArtifact,
  type NoirCompiledContract,
  createLogger,
  type Logger,
  FunctionSelector,
} from "@aztec/aztec.js";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import RecoveryJson from "../../../target/recovery-Recovery.json" with { type: "json" };
import * as path from "path";
import { loadSchnorrAccount } from "../utils/address.ts";
import { setupPXE } from "../utils/setup_pxe.ts";
import { getSponsoredFPCInstance } from "../utils/fpc.ts";
import {
  readJson,
  hexAddressToU8x31,
  chainIdToU8x31,
  zeroU8x31,
} from "../utils/utils.ts";

//IN THE FUTURE, THERE WILL BE A MESSAGE FEE
//SO WE WILL NEED AUTHWIT FOR THE TX

const {
  ADDRESSES_FILE = path.join(process.cwd(), "../config/addresses.json"),
  DEST_ADDRESS = "0x510c0d85Fd5a54AA6bc1800Fa705b6607Eb3c49a",
  DEST_CHAIN_ID = "421614",
  CANDIDATE_ETH = "0x1234567890abcdef1234567890abcdef12345678",
} = process.env as Record<string, string>;

async function main() {
  const logger: Logger = createLogger("send-message");
  const pxe = await setupPXE();
  const ownerWallet = await loadSchnorrAccount("WALLET_A", pxe);

  const addresses = readJson<{ recovery: string }>(ADDRESSES_FILE);
  if (!addresses?.recovery) {
    throw new Error(`addresses.json missing "recovery" at ${ADDRESSES_FILE}`);
  }

  const sponsoredFPC = await getSponsoredFPCInstance();
  const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(
    sponsoredFPC.address,
  );
  const contracts = await pxe.getContracts();
  const isRegistered = contracts.some((c) => c.equals(sponsoredFPC.address));

  logger.info(
    `Sponsored FPC contract ${isRegistered ? "already" : "not"} registered with PXE`,
  );

  const recoveryAddr = AztecAddress.fromString(addresses.recovery);
  const RecoveryArtifact = loadContractArtifact(
    RecoveryJson as NoirCompiledContract,
  );
  const recovery = await Contract.at(
    recoveryAddr,
    RecoveryArtifact,
    ownerWallet,
  );

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

  const sim = await recovery.methods
    .send_wormhole_message(CANDIDATE_ETH, msgArrays)
    .simulate({
      from: ownerWallet.getAddress(),
      fee: { paymentMethod: sponsoredPaymentMethod },
    });
  return;

  // const tx = await recovery.methods
  //   .send_wormhole_message(CANDIDATE_ETH, msgArrays)
  //   .send({
  //     from: ownerWallet.getAddress(),
  //     fee: { paymentMethod: sponsoredPaymentMethod },
  //   })
  //   .wait({ timeout: 180 });

  // logger.info(`✅ Sent. txHash: ${tx.txHash}, block: ${tx.blockNumber}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
