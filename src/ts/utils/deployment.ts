import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import RecoveryJson from "../../../target/recovery-Recovery.json" with { type: "json" };
// import DummyHoleJson from "../../../target/dummyhole-DummyHole.json" with { type: "json" };
import { getSponsoredFPCInstance } from "./fpc.ts";
import {
  loadContractArtifact,
  type NoirCompiledContract,
  type ContractArtifact,
} from "@aztec/aztec.js/abi";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import {
  Contract,
  type ContractInstanceWithAddress,
  type DeployOptions,
  getContractInstanceFromInstantiationParams,
} from "@aztec/aztec.js/contracts";
import { type Logger, createLogger } from "@aztec/aztec.js/log";
import { TestWallet } from "@aztec/test-wallet/server";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { Fr } from "@aztec/aztec.js/fields";

import * as fs from "fs";

const logger: Logger = createLogger("aztec:deployment");

export const RecoveryContractArtifact = loadContractArtifact(
  RecoveryJson as NoirCompiledContract,
);

export interface RecoveryDeploymentArgs {
  ownerAddress: AztecAddress;
  wormholeAddress: AztecAddress;
  threshold?: number;
  wormholeMessage: Uint8Array[];
}

export async function deployRecovery(
  wallet: TestWallet,
  recoveryAddressFile: string,
  recoveryParamsFile: string,
  options: DeployOptions,
  args: RecoveryDeploymentArgs,
): Promise<Contract> {
  const {
    ownerAddress,
    wormholeAddress,
    threshold = 3,
    wormholeMessage,
  } = args;

  logger.info("Deploying Recovery contract...");
  logger.info(`  Owner: ${ownerAddress}`);
  logger.info(`  Wormhole: ${wormholeAddress}`);
  logger.info(`  Threshold: ${threshold}`);

  const sponsoredFPC = await getSponsoredFPCInstance();
  await wallet.registerContract({
    instance: sponsoredFPC,
    artifact: SponsoredFPCContract.artifact,
  });
  const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(
    sponsoredFPC.address,
  );

  const recovery = await Contract.deploy(wallet, RecoveryContractArtifact, [
    ownerAddress,
    wormholeAddress,
    threshold,
    wormholeMessage,
  ])
    .send({ ...options, fee: { paymentMethod: sponsoredPaymentMethod } })
    .deployed();
  await wallet.registerContract({
    instance: recovery.instance,
    artifact: RecoveryContractArtifact,
  });

  logger.info(`✅ Recovery deployed at ${recovery.address.toString()}`);

  const deploymentParams = {
    salt: recovery.instance.salt.toString(),
    deployer: recovery.instance.deployer.toString(),
    constructorArgs: [
      ownerAddress.toString(),
      wormholeAddress.toString(),
      threshold.toString(),
      wormholeMessage.map((msg) => Array.from(msg)),
    ],
  };

  fs.writeFileSync(
    recoveryAddressFile,
    JSON.stringify({ recovery: recovery.address.toString() }, null, 2),
  );
  fs.writeFileSync(
    recoveryParamsFile,
    JSON.stringify(deploymentParams, null, 2),
  );
  logger.info(`💾 Deployment parameters saved to ${recoveryParamsFile}`);

  return recovery;
}

export async function loadRecovery(
  paramsFilePath: string,
  artifact: ContractArtifact,
): Promise<ContractInstanceWithAddress> {
  return await getContractInstanceFromParamsFile(
    paramsFilePath,
    artifact,
    processRecoveryConstructorArgs,
  );
}

export async function getContractInstanceFromParamsFile(
  paramsFilePath: string,
  artifact: ContractArtifact,
  processConstructorArgs: (args: any[]) => any,
) {
  logger.info(`📦 Loading deployment parameters from ${paramsFilePath}...`);

  if (!fs.existsSync(paramsFilePath)) {
    throw new Error(
      `Deployment parameters file not found at ${paramsFilePath}`,
    );
  }

  const paramsJson = JSON.parse(fs.readFileSync(paramsFilePath, "utf-8"));
  const { salt, deployer, constructorArgs } = paramsJson;

  if (!salt || !deployer || !constructorArgs) {
    throw new Error(
      "Missing required deployment parameters (salt, deployer, constructorArgs)",
    );
  }

  logger.info("📦 Reconstructing contract instance from parameters...");

  const processedArgs = processConstructorArgs(constructorArgs as any[]);

  const instance = await getContractInstanceFromInstantiationParams(artifact, {
    constructorArgs: processedArgs,
    salt: Fr.fromString(salt),
    deployer: AztecAddress.fromString(deployer),
  });

  logger.info("✅ Contract instance reconstructed successfully");

  return instance;
}

function processRecoveryConstructorArgs(args: any[]): any[] {
  const wormholeMessage = (args[3] as number[][] | undefined)?.map((msg) =>
    Uint8Array.from(msg),
  );
  if (!wormholeMessage) {
    throw new Error("Missing wormhole message in recovery constructor args");
  }

  return [
    AztecAddress.fromString(args[0] as string),
    AztecAddress.fromString(args[1] as string),
    Number(args[2] as string | number),
    wormholeMessage,
  ];
}

// export async function deployDummyHole(
//   options: DeploymentOptions,
// ): Promise<Contract> {
//   const { wallet, pxe } = options;
//   const ownerAddress = wallet.getAddress();

//   logger.info("Deploying DummyHole contract...");

//   let sponsoredPaymentMethod: SponsoredFeePaymentMethod | undefined;

//   const sponsoredFPC = await getSponsoredFPCInstance();
//   const contracts = await pxe.getContracts();
//   const isRegistered = contracts.some((c) => c.equals(sponsoredFPC.address));

//   logger.info(
//     `Sponsored FPC contract ${isRegistered ? "already" : "not"} registered with PXE`,
//   );

//   sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

//   const deploymentOptions = {
//     from: ownerAddress,
//     fee: { paymentMethod: sponsoredPaymentMethod! },
//   };

//   const dummyhole = await Contract.deploy(
//     wallet,
//     DummyHoleContractArtifact,
//     [], // DummyHole has no constructor arguments
//   )
//     .send(deploymentOptions)
//     .deployed();

//   await pxe.registerContract({
//     instance: dummyhole.instance,
//     artifact: DummyHoleContractArtifact,
//   });

//   logger.info(`✅ DummyHole deployed at ${dummyhole.address.toString()}`);

//   return dummyhole;
// }

// export async function getOrDeployDummyHole(
//   options: DeploymentOptions,
// ): Promise<Contract> {
//   return await deployDummyHole(options);
// }

// export async function getOrDeployRecovery(
//   wallet: TestWallet,
//   options: DeployOptions,
//   args: RecoveryDeploymentArgs,
//   existingAddress?: string | AztecAddress,
// ): Promise<Contract> {
//   if (existingAddress) {
//     logger.info(
//       `Using existing Recovery at: ${typeof existingAddress === "string" ? existingAddress : existingAddress.toString()}`,
//     );
//     return await getContractAt(
//       existingAddress,
//       RecoveryContractArtifact,
//       wallet,
//     );
//   }

//   return await deployRecovery(wallet, options, args);
// }
