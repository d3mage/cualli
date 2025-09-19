import { createLogger, Fr, type PXE, AccountManager } from "@aztec/aztec.js";
import { getSchnorrAccount } from "@aztec/accounts/schnorr";
import { deriveSigningKey } from "@aztec/stdlib/keys";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { getSponsoredFPCInstance } from "./fpc.ts";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import * as fs from "fs";
import * as path from "path";
import { setupPXE } from "./setup_pxe.ts";

export async function deploySchnorrAccount(
  pxe: PXE,
  label: string,
): Promise<AccountManager> {
  const logger = createLogger("aztec:aztec-starter");

  logger.info("👤 Starting Schnorr account deployment...");

  // Setup sponsored FPC
  logger.info("💰 Setting up sponsored fee payment for account deployment...");
  const sponsoredFPC = await getSponsoredFPCInstance();

  await pxe.registerContract({
    instance: sponsoredFPC,
    artifact: SponsoredFPCContract.artifact,
  });
  const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(
    sponsoredFPC.address,
  );
  logger.info(
    "✅ Sponsored fee payment method configured for account deployment",
  );

  // Generate account keys
  logger.info("🔐 Generating account keys...");
  let secretKey = Fr.random();
  let salt = Fr.random();
  logger.info(`Save the following SECRET and SALT in .env for future use.`);
  logger.info(`🔑 Secret key generated: ${secretKey.toString()}`);
  logger.info(`🧂 Salt generated: ${salt.toString()}`);

  // Create Schnorr account
  logger.info("🏗️  Creating Schnorr account instance...");
  let schnorrAccount = await getSchnorrAccount(
    pxe,
    secretKey,
    deriveSigningKey(secretKey),
    salt,
  );
  const accountAddress = schnorrAccount.getAddress();
  logger.info(`📍 Account address will be: ${accountAddress}`);

  // Deploy the account
  logger.info("🚀 Deploying account to the network...");
  logger.info("⏳ Waiting for account deployment transaction to be mined...");
  let tx = await schnorrAccount
    .deploy({
      fee: { paymentMethod: sponsoredPaymentMethod },
    })
    .wait({ timeout: 120000 });

  logger.info(`✅ Account deployment transaction successful!`);
  logger.info(`📋 Transaction hash: ${tx.txHash}`);

  // Get wallet instance
  logger.info("👛 Getting wallet instance...");
  let wallet = await schnorrAccount.getWallet();
  const deployedAddress = wallet.getAddress();
  logger.info(`✅ Wallet instance created for address: ${deployedAddress}`);

  // Verify deployment
  logger.info("🔍 Verifying account deployment...");
  try {
    const registeredAccounts = await pxe.getRegisteredAccounts();
    const isRegistered = registeredAccounts.some((acc) =>
      acc.address.equals(deployedAddress),
    );

    if (isRegistered) {
      logger.info("✅ Account successfully registered with PXE");
    } else {
      logger.warn("⚠️  Account not found in registered accounts list");
    }
  } catch (error) {
    logger.error(`❌ Account verification failed: ${error}`);
  }

  logger.info("🎉 Schnorr account deployment completed successfully!");
  logger.info(`📋 Account Summary:`);
  logger.info(`   - Address: ${deployedAddress}`);
  logger.info(`   - Transaction Hash: ${tx.txHash}`);
  logger.info(`   - Fee Payment: Sponsored FPC (${sponsoredFPC.address})`);

  const accountData = {
    address: deployedAddress.toString(),
    secret: secretKey.toString(),
    salt: salt.toString(),
  };

  const accountsFile = path.join(process.cwd(), `${label}.json`);
  fs.writeFileSync(accountsFile, JSON.stringify(accountData, null, 2));

  return schnorrAccount;
}

export async function loadSchnorrAccount(label: string, pxe: PXE) {
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
  const pxe = await setupPXE();

  const w1 = await deploySchnorrAccount(pxe, "WALLET_A");
  const w2 = await deploySchnorrAccount(pxe, "WALLET_B");

  console.log("\nBoth wallets deployed and registered with PXE.");
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
