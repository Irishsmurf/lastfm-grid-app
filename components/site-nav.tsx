'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/', label: 'Generate' },
  { href: '/about', label: 'About' },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex items-center gap-4 px-4 py-3 border-b-2"
      style={{ borderColor: 'var(--color-divider)' }}
    >
      <div className="flex items-center gap-2.5 mr-auto">
        <div className="grid grid-cols-2 grid-rows-2 gap-0.5 w-5 h-5">
          <div className="bg-foreground" />
          <div className="bg-primary" />
          <div className="bg-primary" />
          <div className="bg-foreground" />
        </div>
        <span className="font-archivo font-extrabold text-lg">
          LastFM Album Collage
        </span>
      </div>
      {NAV_LINKS.map(({ href, label }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'text-sm no-underline hover:text-primary',
              isActive ? 'text-primary' : 'text-foreground'
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export default SiteNav;
