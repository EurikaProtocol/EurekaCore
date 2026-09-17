export type EvmTokenConfig = {
  name: string;
  symbol: string;
  decimals: number;
  contractAddress: `0x${string}`;
  chainId: number;
  chainName: string;
  explorerBaseUrl: string;
};

export const EKA_TOKEN: EvmTokenConfig = {
  name: 'EUREKA Protocol',
  symbol: 'EKA',
  decimals: 18,
  contractAddress: '0x4042973c0863cca0d73f028ca98465f44f0e6f97',
  chainId: 1,
  chainName: 'Ethereum Mainnet',
  explorerBaseUrl: 'https://etherscan.io',
};

export const EKA_CONTRACT_URL = `${EKA_TOKEN.explorerBaseUrl}/token/${EKA_TOKEN.contractAddress}`;
