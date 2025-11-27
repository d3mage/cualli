import { loadSchnorrAccount } from "../utils/address.ts";
import { deployRecovery } from "../utils/deployment.ts";
import { setupWallet } from "../utils/wallet.ts";
import { AztecAddress } from "@aztec/aztec.js/addresses";

import * as path from "path";
import { readJson } from "../utils/utils.ts";

async function main() {
  const RECOVERY_ADDRESS_FILE = path.join(
    process.cwd(),
    "../config/recovery.json",
  );
  const WORMHOLE_ADDRESS_FILE = path.join(
    process.cwd(),
    "../config/wormhole.json",
  );
  const RECOVERY_PARAMS_FILE = path.join(
    process.cwd(),
    "../config/recovery_params.json",
  );

  const ownerWallet = await setupWallet();
  const ownerAccount = await loadSchnorrAccount(ownerWallet, "wallet0");
  const ownerAddress = ownerAccount.address;

  const wormholeAddressString = readJson<{ wormhole: string }>(
    WORMHOLE_ADDRESS_FILE,
  )?.wormhole;
  if (!wormholeAddressString) {
    throw new Error(
      `wormhole.json missing "wormhole" at ${WORMHOLE_ADDRESS_FILE}`,
    );
  }
  const wormholeAddress = AztecAddress.fromString(wormholeAddressString);

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
