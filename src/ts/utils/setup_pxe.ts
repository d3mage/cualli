import { createPXEService, getPXEServiceConfig } from "@aztec/pxe/server";
import { createStore } from "@aztec/kv-store/lmdb";
import { createAztecNodeClient, waitForPXE } from "@aztec/aztec.js";

export const setupPXE = async (useLocalhost = false) => {
  const NODE_URL = useLocalhost
    ? "http://localhost:8080"
    : "https://aztec-testnet-fullnode.zkv.xyz";
  console.log(`Setting up PXE on ${NODE_URL}`);
  const node = createAztecNodeClient(NODE_URL);
  const l1Contracts = await node.getL1ContractAddresses();
  const config = getPXEServiceConfig();
  const fullConfig = { ...config, l1Contracts };

  const store = await createStore("pxe", {
    dataDirectory: "../config/",
    dataStoreMapSizeKB: 1e6,
  });

  const pxe = await createPXEService(node, fullConfig, { store });
  await waitForPXE(pxe);
  return pxe;
};
