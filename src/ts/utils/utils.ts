import { AztecAddress } from "@aztec/aztec.js/addresses";
import { TestWallet } from "@aztec/test-wallet/server";
import { readFileSync } from "fs";

export function hexAddressToU8x31(hex: string): Uint8Array {
  let s = hex.toLowerCase();
  if (s.startsWith("0x")) s = s.slice(2);
  if (s.length !== 40) throw new Error(`Invalid EVM address: ${hex}`);
  const out = new Uint8Array(31);
  for (let i = 0; i < 20; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function chainIdToU8x31(chainId: bigint | number | string): Uint8Array {
  const out = new Uint8Array(31);
  let x = BigInt(chainId);
  let i = 0;
  while (x > 0n && i < 31) {
    out[i++] = Number(x & 0xffn);
    x >>= 8n;
  }
  return out;
}

export function zeroU8x31(): Uint8Array {
  return new Uint8Array(31);
}

export function readJson<T = any>(p: string): T | undefined {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return undefined;
  }
}

export async function is_registered(
  wallet: TestWallet,
  address: AztecAddress,
): Promise<boolean> {
  const metadata = await wallet.getContractMetadata(address);
  return !!metadata?.contractInstance;
}
