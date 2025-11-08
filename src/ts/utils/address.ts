import { createLogger } from "@aztec/aztec.js/log";
import type { Logger } from "@aztec/aztec.js/log";
import { Fr } from "@aztec/aztec.js/fields";
import { Fq } from "@aztec/aztec.js/fields";
import type { PXE } from "@aztec/aztec.js/pxe";
import { AccountManager } from "@aztec/aztec.js/account";
import { getSchnorrAccount } from "@aztec/accounts/schnorr";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { getSponsoredFPCInstance } from "./fpc.ts";
import * as fs from "fs";
import * as path from "path";

export async function deploySchnorrAccount(
  pxe: PXE,
  label: string,
  save: boolean = true,
): Promise<AccountManager> {
  const logger: Logger = createLogger("schnorr-account");

  logger.info("👤 Starting Schnorr account deployment...");
  const sponsoredFPC = await getSponsoredFPCInstance();

  const contracts = await pxe.getContracts();
  const isRegistered = contracts.some((c) => c.equals(sponsoredFPC.address));
  logger.info(
    `Sponsored FPC contract ${isRegistered ? "already" : "not"} registered with PXE`,
  );

  await pxe.registerContract({
    instance: sponsoredFPC,
    artifact: SponsoredFPCContract.artifact,
  });

  const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(
    sponsoredFPC.address,
  );

  logger.info("🔐 Generating account keys...");
  const secretKey = Fr.random();
  const signingKey = Fq.random();
  const salt = Fr.random();
  logger.info(`Save the following SECRET and SALT in .env for future use.`);
  logger.info(`🔑 Secret key generated: ${secretKey.toString()}`);
  logger.info(`🖊️ Signing key generated: ${signingKey.toString()}`);
  logger.info(`🧂 Salt generated: ${salt.toString()}`);

  logger.info("🏗️  Creating Schnorr account instance...");
  const schnorrAccount = await getSchnorrAccount(
    pxe,
    secretKey,
    signingKey,
    salt,
  );
  const accountAddress = schnorrAccount.getAddress();
  logger.info(`📍 Account address will be: ${accountAddress}`);

  logger.info("⏳ Waiting for account deployment transaction to be mined...");
  const tx = await schnorrAccount
    .deploy({
      fee: { paymentMethod: sponsoredPaymentMethod },
    })
    .wait({ timeout: 120000 });

  logger.info(`✅ Account deployment transaction successful!`);
  logger.info(`📋 Transaction hash: ${tx.txHash}`);

  logger.info("👛 Getting wallet instance...");
  const wallet = await schnorrAccount.getWallet();
  const deployedAddress = wallet.getAddress();
  logger.info(`✅ Wallet instance created for address: ${deployedAddress}`);

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

  if (save) {
    const accountData = {
      address: deployedAddress.toString(),
      secret: secretKey.toString(),
      signingKey: signingKey.toString(),
      salt: salt.toString(),
    };

    const accountsFile = path.join(process.cwd(), `../config/${label}.json`);
    fs.writeFileSync(accountsFile, JSON.stringify(accountData, null, 2));
  }

  return schnorrAccount;
}

export async function loadSchnorrAccount(label: string, pxe: PXE) {
  const accountsFile = path.join(process.cwd(), `../config/${label}.json`);

  if (!fs.existsSync(accountsFile)) {
    throw new Error(`Account file ${accountsFile} not found`);
  }

  const accountData = JSON.parse(fs.readFileSync(accountsFile, "utf8"));

  const secret = Fr.fromString(accountData.secret);
  const signingKey = Fq.fromString(accountData.signingKey);
  const salt = Fr.fromString(accountData.salt);

  const manager = await getSchnorrAccount(pxe, secret, signingKey, salt);
  const wallet = await manager.getWallet();
  return wallet;
}
