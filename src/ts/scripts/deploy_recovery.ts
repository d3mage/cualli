import { loadSchnorrAccount } from "../utils/address.ts";
import { deployRecovery } from "../utils/deployment.ts";
import { setupWallet } from "../utils/wallet.ts";
import { AztecAddress } from "@aztec/aztec.js/addresses";

import * as path from "path";
import {
  chainIdToU8x31,
  hexAddressToU8x31,
  readJson,
  zeroU8x31,
} from "../utils/utils.ts";

const {
  DEST_ADDRESS = "0x0aA0D56F087Ee2EfA5FCfAf5d125Ae1DEAA8Fd02",
  DEST_CHAIN_ID = "11155111",
} = process.env as Record<string, string>;

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
      wormholeMessage: [
        hexAddressToU8x31(DEST_ADDRESS),
        chainIdToU8x31(DEST_CHAIN_ID),
        zeroU8x31(),
        zeroU8x31(),
        zeroU8x31(),
        zeroU8x31(),
        zeroU8x31(),
      ],
    },
  );
}

main().catch((err) => {
  console.error(`Error in deployment script: ${err}`);
  process.exit(1);
});
