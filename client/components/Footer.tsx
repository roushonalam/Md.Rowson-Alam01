import { Link } from 'react-router-dom';
import { Logo } from './Logo.tsx';

export function Footer() {
  return (
    <footer className="border-t border-border-subtle bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm space-y-2.5">
            <div className="flex items-center gap-2.5">
              <Logo className="h-7 w-7 shrink-0" />
              <span className="font-display text-base font-bold text-primary-dark">
                EduGenius AI
              </span>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              Bilingual AI learning workspace for Class 9–12, SSC, HSC, University, and
              competitive exam learners.
            </p>
            <p className="font-bengali text-sm text-text-muted">
              বাংলা ও ইংরেজি মাধ্যমের শিক্ষার্থীদের জন্য নির্মিত।
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 text-sm">
            <div className="space-y-2.5">
              <h3 className="font-display text-xs font-semibold tracking-wide text-text-muted">
                Platform
              </h3>
              <ul className="space-y-2 text-text-secondary">
                <li>
                  <Link to="/study-hub" className="hover:text-primary-dark transition-colors">
                    AI Study Hub
                  </Link>
                </li>
                <li>
                  <Link to="/quiz" className="hover:text-primary-dark transition-colors">
                    Smart Quiz
                  </Link>
                </li>
                <li>
                  <Link to="/tutor" className="hover:text-primary-dark transition-colors">
                    Live Tutor
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-2.5">
              <h3 className="font-display text-xs font-semibold tracking-wide text-text-muted">
                Configuration
              </h3>
              <ul className="space-y-2 text-text-secondary">
                <li>
                  <Link to="/settings" className="hover:text-primary-dark transition-colors">
                    Model &amp; Connection
                  </Link>
                </li>
                <li>
                  <Link to="/admin" className="hover:text-primary-dark transition-colors">
                    Admin Portal
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:text-primary-dark transition-colors">
                    Overview
                  </Link>
                </li>
              </ul>
            </div>

            <div className="col-span-2 sm:col-span-1 space-y-2.5">
              <h3 className="font-display text-xs font-semibold tracking-wide text-text-muted">
                Publisher
              </h3>
              <p className="text-text-secondary leading-relaxed">
                Apex Edutech Labs Inc.
              </p>
              <p className="text-xs text-text-muted leading-relaxed">
                All AI calls are processed securely server-side. No API keys are stored in your
                browser.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-border-subtle pt-6 text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Apex Edutech Labs Inc. All rights reserved.</p>
          <p>EduGenius AI Learning Platform</p>
        </div>
      </div>
    </footer>
  );
}
