import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { PRIMARY_NAVIGATION, PROJECT_IDENTITY } from '../core/identity';
import { shortenAddress } from '../core/verify';
import { classNames } from './ui';

export function AppShell({
  children,
  status,
  network,
  address,
}: {
  children: ReactNode;
  status: string;
  network: string;
  address: string;
}) {
  return (
    <div className='min-h-screen bg-tinan-black text-white'>
      <header className='mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div className='flex items-center gap-3'>
            <img alt='TinanEureka logo' className='h-12 w-12 rounded-2xl border border-white/10 bg-black/30 p-2' src='/logo.svg' />
            <div>
              <p className='text-xs uppercase tracking-[0.32em] text-tinan-cyan'>{PROJECT_IDENTITY.protocol}</p>
              <h1 className='text-2xl font-semibold text-white'>{PROJECT_IDENTITY.brand}</h1>
            </div>
          </div>
          <div className='glass cyan-outline grid gap-2 px-4 py-3 text-sm lg:min-w-[380px]'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <span className='text-white/60'>EVM wallet</span>
              <span className='font-medium text-white'>{shortenAddress(address, 'Disconnected')}</span>
            </div>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <span className='text-white/60'>Network</span>
              <span className='font-medium text-white'>{network}</span>
            </div>
            <p className='text-xs text-white/65'>{status}</p>
          </div>
        </div>

        <nav className='glass cyan-outline flex flex-wrap items-center gap-2 p-2 text-sm'>
          {PRIMARY_NAVIGATION.map(([path, label]) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                classNames(
                  'rounded-xl px-3 py-2 transition',
                  isActive ? 'bg-tinan-cyan text-black' : 'text-white/75 hover:bg-white/10 hover:text-white'
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className='mx-auto grid w-full max-w-7xl gap-4 px-4 pb-10'>{children}</main>

      <footer className='mx-auto mt-8 flex w-full max-w-7xl flex-col gap-3 px-4 pb-8 text-sm text-white/55 md:flex-row md:items-center md:justify-between'>
        <p>{PROJECT_IDENTITY.brand} keeps EKA on EVM and TinanAI Token on Solana strictly separated.</p>
        <div className='flex flex-wrap gap-4'>
          {PROJECT_IDENTITY.websiteUrl ? (
            <a href={PROJECT_IDENTITY.websiteUrl} rel='noreferrer' target='_blank'>Official site</a>
          ) : null}
          {PROJECT_IDENTITY.githubUrl ? (
            <a href={PROJECT_IDENTITY.githubUrl} rel='noreferrer' target='_blank'>GitHub</a>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
