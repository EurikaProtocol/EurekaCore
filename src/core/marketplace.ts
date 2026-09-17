export type MarketplaceListing = {
  title: string;
  summary: string;
  status: string;
  devOnly?: boolean;
};

const DEV_MARKETPLACE_LISTINGS: MarketplaceListing[] = [
  {
    title: "DEV ONLY · TinanAI prompt bundles",
    summary: "Mock preview for testing route layout and filtering before live marketplace feeds are connected.",
    status: "Development mock",
    devOnly: true,
  },
  {
    title: "DEV ONLY · Device proof packages",
    summary: "Mock proof bundle examples for staging environment demos only.",
    status: "Development mock",
    devOnly: true,
  },
];

export function getMarketplaceListings(isDev: boolean) {
  return isDev ? DEV_MARKETPLACE_LISTINGS : [];
}
