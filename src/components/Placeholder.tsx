import { useTheme } from '@/contexts/ThemeContext';

type Props = {
  title: string;
  subtitle?: string;
  sprint?: string;
};

export default function Placeholder({ title, subtitle, sprint }: Props) {
  const { theme, toggle } = useTheme();
  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col">
      <header className="px-4 pt-6 pb-4 flex items-center justify-between border-b border-app">
        <div>
          <div className="text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-semibold text-mono">
            Apex Training
          </div>
          <div className="text-xl font-bold tracking-tight">{title}</div>
        </div>
        <button
          onClick={toggle}
          className="text-[11px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full border border-app-strong text-ink-muted"
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 text-center">
        <div className="max-w-sm">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-muted text-ink-muted text-[11px] font-semibold mb-4">
            <span className="size-1.5 rounded-full bg-accent" />
            {sprint ?? 'Em breve'}
          </div>
          <h1 className="text-2xl font-bold mb-2 tracking-tight">{title}</h1>
          {subtitle && <p className="text-ink-muted text-sm leading-relaxed">{subtitle}</p>}
        </div>
      </main>
    </div>
  );
}
