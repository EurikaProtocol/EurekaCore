export type EurekaTokenConfig = {
  name: string;
  symbol: string;
  decimals: number;
  contractAddress: `0x${string}`;
  chainId: number;
};

export const EUREKA_TOKEN: EurekaTokenConfig = {
  name: "Eureka",
  symbol: "EUREKA",
  decimals: 18,
  contractAddress: "0x4042973c0863cca0d73f028ca98465f44f0e6f97",
  chainId: 1,
};
