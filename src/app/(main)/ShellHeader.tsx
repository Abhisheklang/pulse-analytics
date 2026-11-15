'use client';
import { LanguageButton } from '@/components/input/LanguageButton';
import { UserButton } from '@/components/input/UserButton';
import { TopNav } from './TopNav';

/** Slim desktop header bar: the entity switchers in the middle, language
 *  picker and user menu on the right. The brand lives at the top of the
 *  sidebar (SideNav) — this bar only renders at widths where the sidebar
 *  is permanently visible, and on phone widths MobileNav carries the
 *  brand, so exactly one lockup is visible at any width. */
export function ShellHeader() {
  return (
    <div
      className="pulse-shell-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '6px 16px',
        width: '100%',
        minHeight: 'var(--pulse-header-height)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <TopNav />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <LanguageButton />
        <UserButton />
      </div>
    </div>
  );
}
