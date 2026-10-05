import { Contract, JsonRpcProvider, formatUnits } from 'ethers';
import { isValidEvmAddress } from '../core/verify';

const ERC20_READ_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
] as const;

export type TokenSnapshot = {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  balance: string | null;
};

export async function readTokenSnapshot(
  address: string,
  rpcUrl: string,
  walletAddress?: string,
): Promise<TokenSnapshot> {
  if (!isValidEvmAddress(address)) throw new Error('Enter a valid EVM contract address.');
  if (walletAddress && !isValidEvmAddress(walletAddress)) throw new Error('Connected wallet address is invalid.');

  const provider = new JsonRpcProvider(rpcUrl);
  try {
    const contract = new Contract(address, ERC20_READ_ABI, provider);
    const [name, symbol, decimalsValue, supplyValue, balanceValue] = await Promise.all([
      contract.name() as Promise<string>,
      contract.symbol() as Promise<string>,
      contract.decimals() as Promise<bigint>,
      contract.totalSupply() as Promise<bigint>,
      walletAddress
        ? contract.balanceOf(walletAddress) as Promise<bigint>
        : Promise.resolve(null),
    ]);
    const decimals = Number(decimalsValue);
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
      throw new Error('The token returned an invalid decimals value.');
    }

    return {
      address,
      name,
      symbol,
      decimals,
      totalSupply: formatUnits(supplyValue, decimals),
      balance: balanceValue === null ? null : formatUnits(balanceValue, decimals),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The contract could not be read.';
    throw new Error(`Unable to read this token on the configured network. ${message}`);
  } finally {
    provider.destroy();
  }
}
