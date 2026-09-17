import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

export function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function PageSection({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className={classNames('glass p-6', className)}
      initial={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.3, delay }}
    >
      {children}
    </motion.section>
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <PageSection className='cyan-outline overflow-hidden bg-[radial-gradient(circle_at_top,rgba(21,208,201,0.18),transparent_42%),rgba(255,255,255,0.04)]'>
      <p className='text-xs uppercase tracking-[0.32em] text-tinan-cyan'>{eyebrow}</p>
      <h1 className='mt-3 text-3xl font-semibold text-white sm:text-4xl'>{title}</h1>
      <p className='mt-3 max-w-3xl text-sm leading-7 text-white/75'>{description}</p>
      {actions ? <div className='mt-5 flex flex-wrap gap-3'>{actions}</div> : null}
    </PageSection>
  );
}

export function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <PageSection className='p-4'>
      <p className='text-xs uppercase tracking-[0.24em] text-tinan-cyan'>{label}</p>
      <p className='mt-2 break-words text-2xl font-semibold text-white'>{value}</p>
      {hint ? <p className='mt-2 text-sm text-white/65'>{hint}</p> : null}
    </PageSection>
  );
}

export function DetailRow({ label, value, breakAll = false }: { label: string; value: string; breakAll?: boolean }) {
  return (
    <div className='rounded-2xl border border-white/10 bg-black/20 px-4 py-3'>
      <dt className='text-sm text-tinan-cyan'>{label}</dt>
      <dd className={classNames('mt-1 text-sm text-white/90', breakAll && 'break-all')}>{value}</dd>
    </div>
  );
}

export function StatusPill({ tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'warning'; children: ReactNode }) {
  const toneClass = tone === 'success' ? 'border-emerald-400/30 text-emerald-200' : tone === 'warning' ? 'border-amber-300/30 text-amber-100' : 'border-white/15 text-white/75';
  return <span className={classNames('inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em]', toneClass)}>{children}</span>;
}

export function ExternalLinkButton({ href, label }: { href: string | null; label: string }) {
  if (!href) {
    return <span className='rounded-xl border border-dashed border-white/15 px-4 py-2 text-sm text-white/40'>{label} unavailable</span>;
  }

  return (
    <a className='rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-tinan-cyan/50 hover:bg-white/10' href={href} rel='noreferrer' target='_blank'>
      {label}
    </a>
  );
}

export function RouteButton({ to, label }: { to: string; label: string }) {
  return (
    <NavLink className='rounded-xl bg-tinan-cyan px-4 py-2 text-sm font-semibold text-black transition hover:bg-tinan-turquoise' to={to}>
      {label}
    </NavLink>
  );
}
