import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Logo } from './Logo.tsx';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/study-hub', label: 'AI Study Hub' },
  { to: '/quiz', label: 'Smart Quiz' },
  { to: '/tutor', label: 'Live Tutor' },
  { to: '/settings', label: 'Settings' },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Brand mark */}
        <Link
          to="/"
          className="flex items-center gap-2.5 whitespace-nowrap shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-brand-indigo"
        >
          <Logo className="h-8 w-8 shrink-0" />
          <span className="font-display text-lg font-bold tracking-tight text-primary-dark">
            EduGenius AI
          </span>
        </Link>

        {/* Zone 2: Single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-text-secondary"
        >
          {NAV_LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `whitespace-nowrap shrink-0 py-1.5 border-b-2 transition-colors ${
                  isActive
                    ? 'border-brand-indigo text-primary-dark font-semibold'
                    : 'border-transparent hover:text-primary-dark hover:border-border-strong'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Zone 3: Primary action + mobile toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/study-hub"
            className="hidden sm:inline-flex items-center justify-center rounded-xl bg-brand-indigo px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark whitespace-nowrap shrink-0"
          >
            Try AI Free
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-drawer"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border-subtle text-text-primary hover:bg-surface-muted md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div
          id="mobile-nav-drawer"
          className="border-t border-border-subtle bg-surface px-4 py-4 md:hidden"
        >
          <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
            {NAV_LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex min-h-[44px] items-center rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-indigo/10 text-brand-indigo font-semibold'
                      : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <Link
              to="/study-hub"
              className="mt-2 flex min-h-[44px] items-center justify-center rounded-xl bg-brand-indigo px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
            >
              Try AI Free
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
