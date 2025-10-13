import { writeFileSync } from "fs";
import { loadSchnorrAccount } from "../utils/address.ts";
import { setupPXE } from "../utils/setup_pxe.ts";
import { deployRecovery } from "../utils/deployment.ts";

async function main() {
  const pxe = await setupPXE();

  const ownerWallet = await loadSchnorrAccount("WALLET_A", pxe);
  const ownerAddress = ownerWallet.getAddress().toString();

  const wormholeAddress =
    "0x0e61ae3f9f51ae20042f48674e2bf1c19cde5c916ae3a5ed114d84c873cc9a8f";

  const recovery = await deployRecovery(
    {
      wallet: ownerWallet,
      pxe,
    },
    {
      ownerAddress,
      wormholeAddress,
      threshold: 1,
    },
  );

  const addresses = { recovery: recovery.address.toString() };
  writeFileSync("../config/addresses.json", JSON.stringify(addresses, null, 2));
}

main().catch((err) => {
  console.error(`Error in deployment script: ${err}`);
  process.exit(1);
});
