import { deploySchnorrAccount } from "../utils/address.ts";
import { setupPXE } from "../utils/setup_pxe.ts";

async function main() {
  const pxe = await setupPXE();

  await deploySchnorrAccount(pxe, "WALLET_A");
  await deploySchnorrAccount(pxe, "WALLET_B");

  console.log("\nBoth wallets deployed and registered with PXE.");
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
