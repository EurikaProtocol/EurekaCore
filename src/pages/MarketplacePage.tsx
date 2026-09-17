import { getMarketplaceListings } from "../core/marketplace";
import { PageIntro, Panel } from "../components/ui";

export function MarketplacePage() {
  const listings = getMarketplaceListings(import.meta.env.DEV);

  return (
    <div className="grid gap-4">
      <PageIntro
        eyebrow="Marketplace"
        title="Marketplace routes are ready for verified tokenized data and AI commerce integrations."
        description="Production keeps the surface clean until live, trusted marketplace APIs are connected. Development mode can show clearly labeled mock cards for layout and QA only."
      />

      <Panel title="Listings" subtitle="No fake production data.">
        {listings.length === 0 ? (
          <p className="text-sm text-white/72">No live marketplace listings are configured yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {listings.map((listing) => (
              <article key={listing.title} className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-white/78">
                <p className="font-medium text-white">{listing.title}</p>
                <p className="mt-2">{listing.summary}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.24em] text-amber-200">{listing.status}</p>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
