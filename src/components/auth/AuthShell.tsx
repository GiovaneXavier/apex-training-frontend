import { useTheme } from '@/contexts/ThemeContext';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  eyebrow?: string;
  title: string;
  subtitle?: string;
};

export default function AuthShell({ children, eyebrow = 'Apex Training', title, subtitle }: Props) {
  const { theme, toggle } = useTheme();
  return (
    <div className="min-h-screen flex flex-col bg-bg text-ink">
      <header className="px-5 pt-6 pb-2 flex items-center justify-between">
        <div className="text-mono text-[10px] uppercase tracking-[0.7px] font-bold text-ink-subtle">
          {eyebrow}
        </div>
        <button
          onClick={toggle}
          className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border border-app-strong text-ink-muted"
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </header>
      <main className="flex-1 flex items-center justify-center px-5 py-8">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-bold tracking-tight mb-2">{title}</h1>
          {subtitle && <p className="text-ink-muted text-sm leading-relaxed mb-7">{subtitle}</p>}
          {children}
        </div>
      </main>
    </div>
  );
}
