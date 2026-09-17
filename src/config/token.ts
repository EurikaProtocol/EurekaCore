export type EurekaTokenConfig = {
  name: string;
  symbol: string;
  decimals: number;
  contractAddress: `0x${string}`;
  chainId: number;
  networkLabel: string;
  explorerBaseUrl: string;
};

export const EKA_TOKEN: EurekaTokenConfig = {
  name: "EUREKA",
  symbol: "EKA",
  decimals: 18,
  contractAddress: "0x4042973c0863cca0d73f028ca98465f44f0e6f97",
  chainId: 1,
  networkLabel: "Ethereum Mainnet",
  explorerBaseUrl: "https://etherscan.io",
};
