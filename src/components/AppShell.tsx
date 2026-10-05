import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const section = pathname === '/' ? 'Home' : pathname.split('/').filter(Boolean)[0] ?? 'Home';
    const title = `${section === 'ai' ? 'TINAN AI' : section.replace(/-/g, ' ')} | EUREKA`;
    const description = 'EUREKA — A Brighter Tomorrow. Not Artificial Intelligence. Natural Intelligence.';
    const canonical = `https://www.tinaneureka.com${pathname}`;
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical);
  }, [pathname]);

  return (
    <div className='min-h-screen bg-tinan-black text-white'>
      <header className='mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div className='flex items-center gap-3'>
            <img alt='Eureka logo' className='h-12 w-12 rounded-2xl border border-white/10 bg-black/30 p-2' src='/assets/tinan-logo.svg' />
            <div>
              <p className='text-xs uppercase tracking-[0.32em] text-tinan-cyan'>A BRIGHTER TOMORROW</p>
              <h1 className='text-xl font-semibold text-white'>{PROJECT_IDENTITY.brand} <span className='text-tinan-cyan'>· TINAN AI</span></h1>
            </div>
          </div>
          <div className='glass cyan-outline grid gap-2 px-4 py-3 text-sm lg:min-w-[330px]'>
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

        <button
          aria-controls='primary-navigation'
          aria-expanded={menuOpen}
          className='glass cyan-outline flex min-h-11 items-center justify-between px-4 py-2 text-sm lg:hidden'
          onClick={() => setMenuOpen((open) => !open)}
          type='button'
        >
          <span>{menuOpen ? 'Close navigation' : 'Open navigation'}</span>
          <span aria-hidden='true'>{menuOpen ? '×' : '☰'}</span>
        </button>
        <nav className={`glass cyan-outline ${menuOpen ? 'flex' : 'hidden'} flex-wrap items-center gap-1 p-2 text-sm lg:flex`} id='primary-navigation'>
          {PRIMARY_NAVIGATION.map(([path, label]) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                classNames(
                  'min-h-10 rounded-xl px-3 py-2 transition',
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
        <p>{PROJECT_IDENTITY.brand} · A BRIGHTER TOMORROW · Not Artificial Intelligence. Natural Intelligence.</p>
        <div className='flex flex-wrap gap-4'>
          <NavLink to='/privacy'>Privacy</NavLink>
          <NavLink to='/terms'>Terms</NavLink>
          <NavLink to='/whitepaper'>Eureka Whitepaper</NavLink>
          <NavLink to='/marketplace'>Eureka Marketplace</NavLink>
          <a href='/eureka-legacy.html'>Legacy Eureka landing</a>
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
