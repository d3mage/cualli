import { writeFileSync } from "fs";
import { loadSchnorrAccount } from "../utils/address.ts";
import { deployRecovery } from "../utils/deployment.ts";
import { setupWallet } from "../utils/wallet.ts";
import { AztecAddress } from "@aztec/aztec.js/addresses";

import * as fs from "fs";
import * as path from "path";

async function main() {
  const RECOVERY_ADDRESS_FILE = path.join(
    process.cwd(),
    "../config/recovery.json",
  );
  const RECOVERY_PARAMS_FILE = path.join(
    process.cwd(),
    "../config/recovery_params.json",
  );

  const ownerWallet = await setupWallet();
  const ownerAccount = await loadSchnorrAccount(ownerWallet, "wallet0");
  const ownerAddress = ownerAccount.address;

  //TODO: extract to config
  const wormholeAddress = AztecAddress.fromString(
    "0x0e61ae3f9f51ae20042f48674e2bf1c19cde5c916ae3a5ed114d84c873cc9a8f",
  );

  await deployRecovery(
    ownerWallet,
    RECOVERY_ADDRESS_FILE,
    RECOVERY_PARAMS_FILE,
    {
      from: ownerAddress,
    },
    {
      ownerAddress,
      wormholeAddress,
      threshold: 1,
    },
  );
}

main().catch((err) => {
  console.error(`Error in deployment script: ${err}`);
  process.exit(1);
});
