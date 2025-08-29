// src/deploy.mjs
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import {
  Contract,
  createPXEClient,
  loadContractArtifact,
  waitForPXE,
} from "@aztec/aztec.js";
import RecoveryContractJson from "../../target/recovery-Recovery.json" with { type: "json" };
import { writeFileSync } from "fs";

const RecoveryContractArtifact = loadContractArtifact(RecoveryContractJson);

const { PXE_URL = "http://localhost:8080" } = process.env;

async function main() {
  const pxe = createPXEClient(PXE_URL);
  await waitForPXE(pxe);

  const [ownerWallet] = await getInitialTestAccountsWallets(pxe);
  const ownerAddress = ownerWallet.getAddress();

  let wormholeAddress =
    "0x0000000000000000000000000000000000000000000000000000000000000000";

  const recovery = await Contract.deploy(
    ownerWallet,
    RecoveryContractArtifact,
    [ownerAddress, wormholeAddress, 3],
  )
    .send()
    .deployed();

  console.log(`Recovery deployed at ${recovery.address.toString()}`);

  const addresses = { recovery: recovery.address.toString() };
  writeFileSync("addresses.json", JSON.stringify(addresses, null, 2));
}

main().catch((err) => {
  console.error(`Error in deployment script: ${err}`);
  process.exit(1);
});
