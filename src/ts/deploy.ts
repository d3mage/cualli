// src/deploy.mjs
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import {
  Contract,
  createPXEClient,
  loadContractArtifact,
  waitForPXE,
  AccountWallet,
} from "@aztec/aztec.js";
import RecoveryContractJson from "../../target/recovery-Recovery.json" with { type: "json" };
import WormholeContractJson from "../../target/dummyhole-DummyHole.json" with { type: "json" };
import { writeFileSync } from "fs";

const RecoveryContractArtifact = loadContractArtifact(RecoveryContractJson);
const WormholeContractArtifact = loadContractArtifact(WormholeContractJson);

const { PXE_URL = "http://localhost:8080" } = process.env;

function hexAddressToUint8Array(hexAddress) {
  // Remove 0x prefix if present
  if (hexAddress.startsWith("0x")) {
    hexAddress = hexAddress.substring(2);
  }

  // Ensure the hex string is the right length (40 characters for 20 bytes)
  if (hexAddress.length !== 40) {
    throw new Error(
      `Invalid address length: ${hexAddress.length} chars, expected 40`,
    );
  }

  // Create a new Uint8Array to hold the address (31 bytes total)
  const addressBytes = new Uint8Array(31);
  addressBytes.fill(0); // Fill with zeros initially

  // Convert each pair of hex characters to a byte (first 20 bytes)
  for (let i = 0; i < 20; i++) {
    const byteHex = hexAddress.substring(i * 2, i * 2 + 2);
    addressBytes[i] = parseInt(byteHex, 16);
  }

  return addressBytes;
}

function chainIdToUint8Array(chainId) {
  const chainIdBytes = new Uint8Array(31);
  chainIdBytes.fill(0); // Fill with zeros initially

  // Place chain ID at the beginning in little-endian format
  chainIdBytes[0] = chainId & 0xff; // Lower byte (0x14 for 10004)
  chainIdBytes[1] = (chainId >> 8) & 0xff; // Upper byte (0x27 for 10004)

  // Add the array index at the end for debugging
  chainIdBytes[30] = 2; // This is the second array

  return chainIdBytes;
}

async function deployWormhole(ownerWallet: AccountWallet): Promise<Contract> {
  const wormhole = await Contract.deploy(
    ownerWallet,
    WormholeContractArtifact,
    [],
  )
    .send()
    .deployed();

  console.log(`Wormhole deployed at ${wormhole.address.toString()}`);

  return wormhole;
}

async function deployRecovery(
  ownerWallet: AccountWallet,
  wormholeAddress: string,
): Promise<Contract> {
  const recovery = await Contract.deploy(
    ownerWallet,
    RecoveryContractArtifact,
    [ownerWallet.getAddress(), wormholeAddress, 3],
  )
    .send()
    .deployed();

  console.log(`Recovery deployed at ${recovery.address.toString()}`);

  return recovery;
}

async function main() {
  const pxe = createPXEClient(PXE_URL);
  await waitForPXE(pxe);

  const [ownerWallet] = await getInitialTestAccountsWallets(pxe);
  const ownerAddress = ownerWallet.getAddress();

  const wormhole = await deployWormhole(ownerWallet);
  // const recovery = await deployRecovery(ownerWallet, wormhole.address.toString());

  const chainId = 10004;
  const chainIdBytes = chainIdToUint8Array(chainId);
  console.log(chainIdBytes);

  const destinationAddress = hexAddressToUint8Array(
    "0x000000000000000000000000000000000000d3ad",
  );
  console.log(destinationAddress);

  const candidateAddress = hexAddressToUint8Array(
    "0x000000000000000000000000000000000000b0b5",
  );
  console.log(candidateAddress);

  const payload = [chainIdBytes, destinationAddress, candidateAddress];
  console.log(payload);

  const nonce = 15;
  const consistency = 1;

  const tx = await wormhole.methods
    .publish_message_in_private(nonce, payload, consistency)
    .send()
    .wait();
  console.log(tx);

  const sampleLogFilter = {
    fromBlock: 0,
    toBlock: 250,
    contractAddress: wormhole.address,
  };
  const logs = await pxe.getPublicLogs(sampleLogFilter);
  console.log(logs.logs[0].log.fields);

  // const addresses = { recovery: recovery.address.toString() };
  // writeFileSync("addresses.json", JSON.stringify(addresses, null, 2));
}

main().catch((err) => {
  console.error(`Error in deployment script: ${err}`);
  process.exit(1);
});
