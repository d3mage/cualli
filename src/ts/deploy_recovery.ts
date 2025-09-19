import {
  AztecAddress,
  Contract,
  createLogger,
  loadContractArtifact,
  SponsoredFeePaymentMethod,
} from "@aztec/aztec.js";
import RecoveryContractJson from "../../target/recovery-Recovery.json" with { type: "json" };
import { writeFileSync } from "fs";
import { loadSchnorrAccount } from "./deploy_address.ts";
import { setupPXE } from "./setup_pxe.ts";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { getSponsoredFPCInstance } from "./fpc.ts";

const RecoveryContractArtifact = loadContractArtifact(RecoveryContractJson);

async function main() {
  const pxe = await setupPXE();

  const ownerWallet = await loadSchnorrAccount("WALLET_A", pxe);
  const ownerAddress = ownerWallet.getAddress().toString();

  let wormholeAddress =
    "0x0848d2af89dfd7c0e171238f9216399e61e908cd31b0222a920f1bf621a16ed6";

  const sponsoredFPC = await getSponsoredFPCInstance();
  const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(
    sponsoredFPC.address,
  );

  const logger = createLogger("aztec:aztec-starter");
  logger.info("Starting Recovery deployment...");

  const recovery = await Contract.deploy(
    ownerWallet,
    RecoveryContractArtifact,
    [ownerAddress, wormholeAddress, 3],
  )
    .send({
      from: AztecAddress.fromString(ownerAddress),
      fee: { paymentMethod: sponsoredPaymentMethod },
    })
    .deployed();

  await pxe.registerContract({
    instance: recovery.instance,
    artifact: RecoveryContractArtifact,
  });

  console.log(`Recovery deployed at ${recovery.address.toString()}`);

  const addresses = { recovery: recovery.address.toString() };
  writeFileSync("addresses.json", JSON.stringify(addresses, null, 2));
}

main().catch((err) => {
  console.error(`Error in deployment script: ${err}`);
  process.exit(1);
});
