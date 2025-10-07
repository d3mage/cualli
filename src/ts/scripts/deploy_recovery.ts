import {
  AztecAddress,
  Contract,
  createLogger,
  loadContractArtifact,
  type Logger,
  type NoirCompiledContract,
  SponsoredFeePaymentMethod,
} from "@aztec/aztec.js";
import RecoveryJson from "../../../target/recovery-Recovery.json" with { type: "json" };
import { writeFileSync } from "fs";
import { loadSchnorrAccount } from "../utils/address.ts";
import { setupPXE } from "../utils/setup_pxe.ts";
import { getSponsoredFPCInstance } from "../utils/fpc.ts";

const RecoveryContractArtifact = loadContractArtifact(
  RecoveryJson as NoirCompiledContract,
);

async function main() {
  const pxe = await setupPXE();
  const logger: Logger = createLogger("aztec:aztec-starter");

  const ownerWallet = await loadSchnorrAccount("WALLET_A", pxe);
  const ownerAddress = ownerWallet.getAddress().toString();

  const wormholeAddress =
    "0x0848d2af89dfd7c0e171238f9216399e61e908cd31b0222a920f1bf621a16ed6";

  const sponsoredFPC = await getSponsoredFPCInstance();
  const contracts = await pxe.getContracts();
  const isRegistered = contracts.some((c) => c.equals(sponsoredFPC.address));

  logger.info(
    `Sponsored FPC contract ${isRegistered ? "already" : "not"} registered with PXE`,
  );

  const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(
    sponsoredFPC.address,
  );

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
  writeFileSync("../config/addresses.json", JSON.stringify(addresses, null, 2));
}

main().catch((err) => {
  console.error(`Error in deployment script: ${err}`);
  process.exit(1);
});
