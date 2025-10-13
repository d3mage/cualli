import {
  AztecAddress,
  Contract,
  type ContractArtifact,
  createLogger,
  loadContractArtifact,
  type Logger,
  type NoirCompiledContract,
  type PXE,
  type Wallet,
} from "@aztec/aztec.js";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import RecoveryJson from "../../../target/recovery-Recovery.json" with { type: "json" };
import DummyHoleJson from "../../../target/dummyhole-DummyHole.json" with { type: "json" };
import { getSponsoredFPCInstance } from "./fpc.ts";

const logger: Logger = createLogger("aztec:deployment");

export const RecoveryContractArtifact = loadContractArtifact(
  RecoveryJson as NoirCompiledContract,
);

export const DummyHoleContractArtifact = loadContractArtifact(
  DummyHoleJson as NoirCompiledContract,
);

export interface DeploymentOptions {
  wallet: Wallet;
  pxe: PXE;
}

export interface RecoveryDeploymentArgs {
  ownerAddress: string | AztecAddress;
  wormholeAddress: string | AztecAddress;
  threshold?: number;
}

/**
 * Deploys the DummyHole contract
 * @param options - Deployment options including wallet, PXE, and fee settings
 * @returns Deployed DummyHole contract instance
 */
export async function deployDummyHole(
  options: DeploymentOptions,
): Promise<Contract> {
  const { wallet, pxe } = options;
  const ownerAddress = wallet.getAddress();

  logger.info("Deploying DummyHole contract...");

  let sponsoredPaymentMethod: SponsoredFeePaymentMethod | undefined;

  const sponsoredFPC = await getSponsoredFPCInstance();
  const contracts = await pxe.getContracts();
  const isRegistered = contracts.some((c) => c.equals(sponsoredFPC.address));

  logger.info(
    `Sponsored FPC contract ${isRegistered ? "already" : "not"} registered with PXE`,
  );

  sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

  const deploymentOptions = {
    from: ownerAddress,
    fee: { paymentMethod: sponsoredPaymentMethod! },
  };

  const dummyhole = await Contract.deploy(
    wallet,
    DummyHoleContractArtifact,
    [], // DummyHole has no constructor arguments
  )
    .send(deploymentOptions)
    .deployed();

  await pxe.registerContract({
    instance: dummyhole.instance,
    artifact: DummyHoleContractArtifact,
  });

  logger.info(`✅ DummyHole deployed at ${dummyhole.address.toString()}`);

  return dummyhole;
}

/**
 * Deploys the Recovery contract
 * @param options - Deployment options including wallet, PXE, and fee settings
 * @param args - Recovery contract constructor arguments
 * @returns Deployed Recovery contract instance
 */
export async function deployRecovery(
  options: DeploymentOptions,
  args: RecoveryDeploymentArgs,
): Promise<Contract> {
  const { wallet, pxe } = options;
  const { ownerAddress, wormholeAddress, threshold = 3 } = args;

  logger.info("Deploying Recovery contract...");
  logger.info(`  Owner: ${ownerAddress}`);
  logger.info(`  Wormhole: ${wormholeAddress}`);
  logger.info(`  Threshold: ${threshold}`);

  let sponsoredPaymentMethod: SponsoredFeePaymentMethod | undefined;

  const sponsoredFPC = await getSponsoredFPCInstance();
  const contracts = await pxe.getContracts();
  const isRegistered = contracts.some((c) => c.equals(sponsoredFPC.address));

  logger.info(
    `Sponsored FPC contract ${isRegistered ? "already" : "not"} registered with PXE`,
  );

  sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

  const deploymentOptions = {
    from: wallet.getAddress(),
    fee: { paymentMethod: sponsoredPaymentMethod! },
    timeout: 180,
  };

  const recovery = await Contract.deploy(wallet, RecoveryContractArtifact, [
    ownerAddress,
    wormholeAddress,
    threshold,
  ])
    .send(deploymentOptions)
    .deployed();

  await pxe.registerContract({
    instance: recovery.instance,
    artifact: RecoveryContractArtifact,
  });

  logger.info(`✅ Recovery deployed at ${recovery.address.toString()}`);

  return recovery;
}

/**
 * Gets an existing contract instance by address
 * @param address - Contract address
 * @param artifact - Contract artifact
 * @param wallet - Wallet to use for contract interactions
 * @returns Contract instance
 */
export async function getContractAt(
  address: string | AztecAddress,
  artifact: ContractArtifact,
  wallet: Wallet,
): Promise<Contract> {
  const contractAddr =
    typeof address === "string" ? AztecAddress.fromString(address) : address;
  return await Contract.at(contractAddr, artifact, wallet);
}

/**
 * Deploys or gets an existing DummyHole contract
 * @param options - Deployment options
 * @param existingAddress - Optional existing contract address
 * @returns DummyHole contract instance
 */
export async function getOrDeployDummyHole(
  options: DeploymentOptions,
): Promise<Contract> {
  return await deployDummyHole(options);
}

/**
 * Deploys or gets an existing Recovery contract
 * @param options - Deployment options
 * @param args - Recovery constructor arguments
 * @param existingAddress - Optional existing contract address
 * @returns Recovery contract instance
 */
export async function getOrDeployRecovery(
  options: DeploymentOptions,
  args: RecoveryDeploymentArgs,
  existingAddress?: string | AztecAddress,
): Promise<Contract> {
  if (existingAddress) {
    logger.info(
      `Using existing Recovery at: ${typeof existingAddress === "string" ? existingAddress : existingAddress.toString()}`,
    );
    return await getContractAt(
      existingAddress,
      RecoveryContractArtifact,
      options.wallet,
    );
  }

  return await deployRecovery(options, args);
}
