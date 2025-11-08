// import { createLogger } from "@aztec/aztec.js/log";
// import type { Logger } from "@aztec/aztec.js/log";
// import { Fr } from "@aztec/aztec.js/fields";
// import { deploySchnorrAccount } from "../utils/address.ts";
// import { setupPXE } from "../utils/setup_pxe.ts";
// import { getOrDeployDummyHole } from "../utils/deployment.ts";
// import {
//   hexAddressToU8x31,
//   chainIdToU8x31,
//   zeroU8x31,
// } from "../utils/utils.ts";

// const {
//   DEST_ADDRESS = "0x009cbB8f91d392856Cb880d67c806Aa731E3d686",
//   DEST_CHAIN_ID = "10004",
// } = process.env as Record<string, string>;

// async function main() {
//   const logger: Logger = createLogger("aztec:dummyhole-test");
//   const useLocalhost = true;

//   const pxe = await setupPXE(useLocalhost);

//   const ownerWallet = await (
//     await deploySchnorrAccount(pxe, "wallet_a")
//   ).getWallet();
//   const ownerAddress = ownerWallet.getAddress();
//   logger.info(`Owner address: ${ownerAddress}`);

//   const dummyhole = await getOrDeployDummyHole({
//     wallet: ownerWallet,
//     pxe,
//   });

//   const nonce = 1n;
//   const msg0_dest = hexAddressToU8x31(DEST_ADDRESS);
//   const msg1_chain = chainIdToU8x31(DEST_CHAIN_ID);
//   const msgArrays: Uint8Array[] = [
//     msg0_dest,
//     msg1_chain,
//     zeroU8x31(),
//     zeroU8x31(),
//     zeroU8x31(),
//     zeroU8x31(),
//     zeroU8x31(),
//     zeroU8x31(),
//   ];

//   logger.info(`Preparing to send message with nonce: ${nonce}`);
//   logger.info(`Destination address: ${DEST_ADDRESS}`);
//   logger.info(`Destination chain ID: ${DEST_CHAIN_ID}`);

//   const message_fee = 0n;
//   const consistency = 1n;
//   const token_nonce = Fr.random();

//   // logger.info("Simulating message send...");
//   // const sim = await dummyhole.methods
//   //     .publish_message_in_public(
//   //         nonce,
//   //         msgArrays,
//   //         message_fee,
//   //         consistency,
//   //         ownerWallet.getAddress(),
//   //         token_nonce,
//   //     )
//   //     .simulate({
//   //         from: ownerWallet.getAddress(),
//   //     });

//   // logger.info(`Simulation successful! Expected sequence: ${sim}`);

//   logger.info("Sending message transaction...");
//   const tx = await dummyhole.methods
//     .publish_message_in_public(
//       nonce,
//       msgArrays,
//       message_fee,
//       consistency,
//       ownerWallet.getAddress(),
//       token_nonce,
//     )
//     .send({
//       from: ownerWallet.getAddress(),
//     })
//     .wait({ timeout: 180 });

//   logger.info(`✅ Message sent successfully!`);
//   logger.info(`   Transaction hash: ${tx.txHash}`);
//   logger.info(`   Block number: ${tx.blockNumber}`);

//   // Test reading logs
//   if (tx.blockNumber) {
//     logger.info("Fetching logs from the transaction...");
//     try {
//       const logs = await pxe.getPublicLogs({
//         contractAddress: dummyhole.address,
//         fromBlock: tx.blockNumber,
//         toBlock: tx.blockNumber,
//       });

//       if (logs.logs.length > 0) {
//         logger.info(`Found ${logs.logs.length} log(s):`);
//         logs.logs.forEach((log, idx) => {
//           logger.info(`  Log ${idx + 1}: ${log.log.toString()}`);
//         });
//       } else {
//         logger.info("No logs found in the transaction block");
//       }
//     } catch (err) {
//       logger.warn(`Could not fetch logs: ${err}`);
//     }
//   }
// }

// main().catch((err) => {
//   console.error(`Error in dummyhole test: ${err}`);
//   process.exit(1);
// });
