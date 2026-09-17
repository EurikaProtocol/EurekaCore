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
  contractAddress: '0x5D0435779b10234fD4941cc15fae8C7C86117E91',
  chainId: 1,
  chainName: 'Ethereum Mainnet',
  explorerBaseUrl: 'https://etherscan.io',
};

export const EKA_CONTRACT_URL = `${EKA_TOKEN.explorerBaseUrl}/token/${EKA_TOKEN.contractAddress}`;
