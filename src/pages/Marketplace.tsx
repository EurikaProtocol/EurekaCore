import { MARKETPLACE_MODULES } from '../core/marketplace';
import { LICENSE_POLICY } from '../core/license';
import { PERMISSION_GUARDS } from '../core/permissions';
import { PageHero, PageSection, StatusPill } from '../components/ui';

export function MarketplacePage() {
  return (
    <div className='grid gap-4'>
      <PageHero
        eyebrow='Marketplace'
        title='Verified commerce surfaces without fake market data.'
        description='Marketplace routes emphasize verifiable inventory, permissions, and licensing. No production price feed is rendered unless a real source is connected, and no fake TinanAI or EKA market data is shipped.'
      />

      <div className='grid gap-4 xl:grid-cols-3'>
        {MARKETPLACE_MODULES.map((module) => (
          <PageSection key={module.title} className='p-5'>
            <div className='flex items-center justify-between gap-2'>
              <h3 className='text-xl font-semibold text-white'>{module.title}</h3>
              <StatusPill tone={module.status === 'Ready for listings' ? 'success' : 'warning'}>{module.status}</StatusPill>
            </div>
            <p className='mt-3 text-sm leading-7 text-white/75'>{module.description}</p>
          </PageSection>
        ))}
      </div>

      <div className='grid gap-4 lg:grid-cols-2'>
        <PageSection>
          <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>License policy</p>
          <ul className='mt-4 space-y-3 text-sm text-white/75'>
            {LICENSE_POLICY.map((item) => (
              <li key={item.title}><span className='font-semibold text-white'>{item.title}:</span> {item.description}</li>
            ))}
          </ul>
        </PageSection>
        <PageSection>
          <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>Permission guards</p>
          <ul className='mt-4 space-y-3 text-sm text-white/75'>
            {PERMISSION_GUARDS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </PageSection>
      </div>
    </div>
  );
}
