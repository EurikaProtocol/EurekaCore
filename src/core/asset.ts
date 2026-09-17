export type AssetFamily = "EVM" | "Solana";

export type AssetProfile = {
  name: string;
  symbol: string;
  family: AssetFamily;
  network: string;
  addressLabel: string;
  address: string | null;
  description: string;
};

export function createAssetProfile(profile: AssetProfile) {
  return profile;
}

export function describeAssetSeparation(primary: AssetProfile, secondary: AssetProfile) {
  return `${primary.symbol} is configured for ${primary.family} on ${primary.network}, while ${secondary.symbol} remains isolated on ${secondary.family} (${secondary.network}).`;
}
