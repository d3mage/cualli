import "dotenv/config";
import {
  Fr,
  AztecAddress,
  SponsoredFeePaymentMethod,
  type PXE,
} from "@aztec/aztec.js";
import { getSchnorrAccount } from "@aztec/accounts/schnorr";
import { deriveSigningKey } from "@aztec/stdlib/keys";
import { setupPXE } from "./setup_pxe.ts";
import * as fs from "fs";
import * as path from "path";

type DeployedWallet = {
  address: AztecAddress;
  secret: Fr;
  salt: Fr;
};

export async function createAndDeployWallet(
  pxe: PXE,
  label: string,
): Promise<DeployedWallet> {
  const secret = Fr.random();
  const salt = Fr.random();
  const signingKey = deriveSigningKey(secret);

  const schnorrAccount = await getSchnorrAccount(pxe, secret, signingKey, salt);
  console.log(
    `Schnorr account created with address ${schnorrAccount.getAddress().toString()}`,
  );

  const fpcAddress =
    "0x19b5539ca1b104d4c3705de94e4555c9630def411f025e023a13189d0c56f8f22";
  const fee = {
    paymentMethod: new SponsoredFeePaymentMethod(
      AztecAddress.fromString(fpcAddress),
    ),
  };
  const receipt = await schnorrAccount.deploy({ fee }).wait();

  const wallet = await schnorrAccount.getWallet();
  const address = wallet.getAddress();

  console.log(`Registering wallet ${label} with address ${address.toString()}`);
  await pxe.registerSender(address);

  console.log(`Wallet ${label} registered with address ${address.toString()}`);
  const accountData = {
    address: address.toString(),
    secret: secret.toString(),
    salt: salt.toString(),
    deployTx: receipt.txHash.toString(),
  };

  const accountsFile = path.join(process.cwd(), `${label}.json`);
  fs.writeFileSync(accountsFile, JSON.stringify(accountData, null, 2));

  console.log(`Wallet ${label} deployed:`, accountData);

  return { address, secret, salt };
}

export async function loadWalletFromCompleteAddress(label: string, pxe: PXE) {
  const accountsFile = path.join(process.cwd(), `${label}.json`);

  if (!fs.existsSync(accountsFile)) {
    throw new Error(`Account file ${label}.json not found`);
  }

  const accountData = JSON.parse(fs.readFileSync(accountsFile, "utf8"));

  const secret = Fr.fromString(accountData.secret);
  const salt = Fr.fromString(accountData.salt);
  const signingKey = deriveSigningKey(secret);

  const manager = await getSchnorrAccount(pxe, secret, signingKey, salt);
  const wallet = await manager.getWallet();
  return wallet;
}

async function main() {
  const pxe1 = await setupPXE();
  const pxe2 = await setupPXE();

  const w1 = await createAndDeployWallet(pxe1, "WALLET_A");
  const w2 = await createAndDeployWallet(pxe2, "WALLET_B");

  console.log("\nBoth wallets deployed and registered with PXE.");
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
