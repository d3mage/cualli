import { createStore } from "@aztec/kv-store/lmdb";
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { createPXE, getPXEConfig, PXE } from "@aztec/pxe/server";

export const setupPXE = async (useLocalhost = false): Promise<PXE> => {
  const NODE_URL = useLocalhost
    ? "http://localhost:8080"
    : "https://aztec-testnet-fullnode.zkv.xyz";
  console.log(`Setting up PXE on ${NODE_URL}`);
  const node = createAztecNodeClient(NODE_URL);
  const l1Contracts = await node.getL1ContractAddresses();
  const config = getPXEConfig();
  const fullConfig = { ...config, l1Contracts };

  const store = await createStore("pxe", {
    dataDirectory: "../config/",
    dataStoreMapSizeKb: 1e6,
  });

  const pxe = await createPXE(node, fullConfig, { store });
  return pxe;
};
