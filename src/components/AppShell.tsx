import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { PRIMARY_NAVIGATION, PROJECT_IDENTITY } from '../core/identity';
import type { EvmWalletController } from '../hooks/useEvmWallet';
import { classNames } from './ui';
import { WalletButton } from './WalletButton';

const HEADER_NAVIGATION = [
  ['/ai', 'AI'],
  ['/tokenize', 'Tokenize'],
  ['/projects', 'Projects'],
  ['/dashboard', 'Dashboard'],
  ['/tokens', 'Tokens'],
  ['/docs', 'Docs'],
] as const;

const FOOTER_LINKS = [
  ['/ai', 'AI'],
  ['/tokenize', 'Tokenize'],
  ['/projects', 'Projects'],
  ['/dashboard', 'Dashboard'],
  ['/tokens', 'Tokens'],
  ['/docs', 'Docs'],
  ['/about', 'About'],
  ['/privacy', 'Privacy'],
  ['/terms', 'Terms'],
] as const;

const DEFAULT_TITLE = 'TINAN AI — EUREKA | Natural Intelligence';
const DEFAULT_DESCRIPTION = 'TINAN AI — Natural Intelligence for Web3, tokenization, data and the future.';
const SITE = 'https://www.tinaneureka.com';

function Logo() {
  return (
    <Link aria-label='EUREKA — home' className='flex min-h-11 items-center gap-3 rounded-xl' to='/'>
      <img alt='' className='h-9 w-9 rounded-xl border border-white/10 bg-black/30 p-1.5' height={36} src='/assets/tinan-logo.svg' width={36} />
      <span className='text-base font-semibold tracking-[0.14em] sm:text-lg sm:tracking-[0.18em]'>EUREKA</span>
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
    const title = isHome ? DEFAULT_TITLE : `${section === 'ai' ? 'TINAN AI' : section.replace(/-/g, ' ')} | EUREKA`;
    const description = isHome ? DEFAULT_DESCRIPTION : 'EUREKA — A Brighter Tomorrow. Not Artificial Intelligence. Natural Intelligence.';
    const canonical = isHome ? SITE : `${SITE}${pathname}`;
    const ogTitle = isHome ? 'TINAN AI — EUREKA' : title;
    const ogDescription = isHome ? 'Not Artificial Intelligence. Natural Intelligence.' : description;
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', ogTitle);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', ogDescription);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical);
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className='min-h-screen overflow-x-clip text-white'>
      <a className='skip-link' href='#main'>Skip to content</a>
      <header className={classNames('fixed inset-x-0 top-0 z-40 border-b transition-all duration-300', scrolled || menuOpen ? 'border-white/10 bg-[#07090a]/70 shadow-glass backdrop-blur-xl' : 'border-transparent bg-transparent')}>
        <div className='mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6'>
          <div className='flex items-center gap-2 lg:hidden'>
            <button
              aria-controls='primary-navigation'
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
              className='flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5'
              onClick={() => setMenuOpen((open) => !open)}
              type='button'
            >
              <span aria-hidden='true' className='text-xl leading-none'>{menuOpen ? '×' : '☰'}</span>
            </button>
          </div>
          <Logo />
          <nav aria-label='Primary' className='hidden items-center gap-1 text-sm lg:flex'>
            {HEADER_NAVIGATION.map(([path, label]) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  classNames('flex min-h-11 items-center rounded-xl px-3 transition', isActive ? 'bg-white/10 text-tinan-turquoise' : 'text-white/75 hover:bg-white/5 hover:text-white')
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <WalletButton evm={evm} />
        </div>
        {menuOpen ? (
          <nav aria-label='Mobile' className='mx-auto grid max-h-[calc(100dvh-4rem)] w-full max-w-7xl gap-1 overflow-y-auto px-4 pb-4 sm:grid-cols-2 sm:px-6 lg:hidden' id='primary-navigation'>
            {PRIMARY_NAVIGATION.map(([path, label]) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  classNames('flex min-h-11 items-center rounded-xl px-4 text-sm transition', isActive ? 'bg-tinan-turquoise text-black' : 'text-white/80 hover:bg-white/10')
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        ) : null}
      </header>

      <main className='mx-auto grid w-full max-w-7xl gap-5 px-4 pb-16 pt-24 sm:px-6' id='main'>{children}</main>

      <footer className='border-t border-white/10 bg-black/30'>
        <div className='mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_2fr]'>
          <div>
            <p className='text-lg font-semibold tracking-[0.18em]'>EUREKA</p>
            <p className='mt-1 text-xs uppercase tracking-[0.3em] text-tinan-turquoise'>A BRIGHTER TOMORROW</p>
            <p className='mt-5 font-semibold'>TINAN AI</p>
            <p className='text-sm text-white/60'>Natural Intelligence</p>
          </div>
          <div>
            <ul className='flex flex-wrap gap-x-1 gap-y-1 text-sm text-white/70'>
              {FOOTER_LINKS.map(([path, label]) => (
                <li key={path}><Link className='inline-flex min-h-11 items-center px-3 hover:text-white' to={path}>{label}</Link></li>
              ))}
            </ul>
            <ul className='mt-1 flex flex-wrap gap-x-1 gap-y-1 text-xs text-white/50'>
              <li><Link className='inline-flex min-h-11 items-center px-3 hover:text-white' to='/whitepaper'>Whitepaper</Link></li>
              <li><Link className='inline-flex min-h-11 items-center px-3 hover:text-white' to='/marketplace'>Marketplace</Link></li>
              <li><a className='inline-flex min-h-11 items-center px-3 hover:text-white' href='/eureka-legacy.html'>Legacy Eureka landing</a></li>
              {PROJECT_IDENTITY.githubUrl ? (
                <li><a className='inline-flex min-h-11 items-center px-3 hover:text-white' href={PROJECT_IDENTITY.githubUrl} rel='noreferrer' target='_blank'>GitHub</a></li>
              ) : null}
            </ul>
          </div>
        </div>
        <p className='mx-auto w-full max-w-7xl px-4 pb-8 text-xs text-white/45 sm:px-6'>© 2026 EUREKA / TINAN AI</p>
      </footer>
    </div>
  );
}
