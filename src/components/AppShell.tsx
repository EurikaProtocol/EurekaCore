import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { FOOTER_NAVIGATION, HEADER_NAVIGATION, PRIMARY_NAVIGATION, PROJECT_IDENTITY } from '../core/identity';
import type { EvmWalletController } from '../hooks/useEvmWallet';
import { WalletButton } from './WalletButton';
import { classNames } from './ui';

const HOME_TITLE = 'TINAN AI — EUREKA | Natural Intelligence';
const HOME_DESCRIPTION = 'TINAN AI — Natural Intelligence for Web3, tokenization, data and the future.';
const TAGLINE = 'Not Artificial Intelligence. Natural Intelligence.';

function Logo() {
  return (
    <Link aria-label='EUREKA home' className='flex min-h-11 items-center gap-3' to='/'>
      <img alt='' className='h-9 w-9 rounded-xl border border-white/10 bg-black/30 p-1.5' height={36} src='/assets/tinan-logo.svg' width={36} />
      <span className='text-lg font-semibold tracking-[0.2em]'>EUREKA</span>
    </Link>
  );
}

export function AppShell({ children, evm }: { children: ReactNode; evm: EvmWalletController }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const isHome = pathname === '/';
    const section = pathname.split('/').filter(Boolean)[0] ?? '';
    const name = section === 'ai' ? 'TINAN AI' : section.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
    const title = isHome ? HOME_TITLE : `${name} — TINAN AI | EUREKA`;
    const description = isHome ? HOME_DESCRIPTION : `${name} · ${HOME_DESCRIPTION}`;
    const canonical = isHome ? 'https://www.tinaneureka.com' : `https://www.tinaneureka.com${pathname}`;
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', isHome ? 'TINAN AI — EUREKA' : title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', isHome ? TAGLINE : description);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical);
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const linkClass = ({ isActive }: { isActive: boolean }) => classNames(
    'inline-flex min-h-11 items-center rounded-lg px-3 text-sm transition',
    isActive ? 'text-tinan-turquoise' : 'text-white/75 hover:text-white'
  );

  return (
    <div className='min-h-screen overflow-x-hidden text-white'>
      <a className='sr-only z-[60] rounded-lg bg-tinan-turquoise px-4 py-2 text-black focus:not-sr-only focus:fixed focus:left-4 focus:top-4' href='#main'>Skip to content</a>
      <header className={classNames('fixed inset-x-0 top-0 z-50 border-b transition duration-300', scrolled ? 'border-white/10 bg-[#07090b]/70 backdrop-blur-xl' : 'border-transparent bg-[#07090b]/90')}>
        <div className='eu-container flex h-16 items-center justify-between gap-2'>
          <div className='flex items-center gap-1 lg:hidden'>
            <button
              aria-controls='primary-navigation'
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
              className='inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5'
              onClick={() => setMenuOpen((open) => !open)}
              type='button'
            >
              <span aria-hidden='true' className='text-lg leading-none'>{menuOpen ? '×' : '☰'}</span>
            </button>
          </div>
          <Logo />
          <nav aria-label='Primary' className='hidden items-center gap-1 lg:flex'>
            {HEADER_NAVIGATION.map(([path, label]) => <NavLink className={linkClass} key={path} to={path}>{label}</NavLink>)}
          </nav>
          <WalletButton evm={evm} />
        </div>
        {menuOpen ? (
          <nav aria-label='Mobile' className='max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-white/10 bg-[#07090b]/95 backdrop-blur-xl lg:hidden' id='primary-navigation'>
            <div className='eu-container grid grid-cols-2 gap-1 py-3'>
              {PRIMARY_NAVIGATION.map(([path, label]) => (
                <NavLink className={({ isActive }) => classNames('flex min-h-11 items-center rounded-lg px-3 text-sm', isActive ? 'bg-tinan-cyan/20 text-tinan-turquoise' : 'text-white/80 hover:bg-white/10')} end={path === '/'} key={path} to={path}>{label}</NavLink>
              ))}
            </div>
          </nav>
        ) : null}
      </header>

      <main className='eu-container pb-16 pt-24' id='main'>{children}</main>

      <footer className='border-t border-white/10 bg-black/30'>
        <div className='eu-container grid gap-8 py-10 md:grid-cols-[1.2fr_2fr]'>
          <div>
            <p className='text-lg font-semibold tracking-[0.2em]'>EUREKA</p>
            <p className='mt-1 text-xs uppercase tracking-[0.3em] text-tinan-turquoise'>A BRIGHTER TOMORROW</p>
            <p className='mt-5 font-semibold'>TINAN AI</p>
            <p className='text-sm text-white/60'>Natural Intelligence</p>
          </div>
          <nav aria-label='Footer' className='flex flex-wrap content-start gap-x-2 text-sm text-white/65'>
            {FOOTER_NAVIGATION.map(([path, label]) => <NavLink className='inline-flex min-h-11 items-center px-2 hover:text-white' key={path} to={path}>{label}</NavLink>)}
            <a className='inline-flex min-h-11 items-center px-2 hover:text-white' href='/eureka-legacy.html'>Legacy site</a>
            {PROJECT_IDENTITY.githubUrl ? <a className='inline-flex min-h-11 items-center px-2 hover:text-white' href={PROJECT_IDENTITY.githubUrl} rel='noreferrer' target='_blank'>GitHub</a> : null}
          </nav>
        </div>
        <div className='eu-container border-t border-white/5 py-5 text-xs text-white/45'>© 2026 EUREKA / TINAN AI</div>
      </footer>
    </div>
  );
}
