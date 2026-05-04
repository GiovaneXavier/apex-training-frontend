import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

type TabId = 'treinos' | 'progresso' | 'agenda' | 'perfil';

type TabDef = {
  id: TabId;
  label: string;
  href: string;
  icon: (p: { active: boolean }) => JSX.Element;
};

const TABS: TabDef[] = [
  { id: 'treinos', label: 'Treinos', href: '/aluno/dashboard', icon: TabIconDumb },
  { id: 'agenda', label: 'Agenda', href: '/aluno/calendario', icon: TabIconCalendar },
  { id: 'progresso', label: 'RPs', href: '/aluno/rps', icon: TabIconChart },
  { id: 'perfil', label: 'Perfil', href: '/aluno/perfil', icon: TabIconUser },
];

function activeFor(pathname: string): TabId {
  if (pathname.startsWith('/aluno/calendario')) return 'agenda';
  if (pathname.startsWith('/aluno/rps')) return 'progresso';
  if (pathname.startsWith('/aluno/perfil')) return 'perfil';
  return 'treinos';
}

export function AlunoTabs() {
  const { pathname } = useLocation();
  const active = activeFor(pathname);
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 bg-bg/95 backdrop-blur border-t border-app pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="grid grid-cols-4 max-w-md mx-auto">
        {TABS.map((t) => {
          const isActive = t.id === active;
          const Ic = t.icon;
          return (
            <Link
              key={t.id}
              to={t.href}
              className={cn(
                'flex flex-col items-center gap-1 py-2.5',
                isActive ? 'text-ink' : 'text-ink-subtle',
              )}
            >
              <Ic active={isActive} />
              <span className="text-[10px] font-bold uppercase tracking-[0.4px]">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function TabIconDumb({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 9v6M5.5 6.5v11M18.5 6.5v11M21 9v6M5.5 12h13"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.7}
        strokeLinecap="round"
      />
    </svg>
  );
}
function TabIconCalendar({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="5.5" width="17" height="14" rx="2.5" stroke="currentColor" strokeWidth={active ? 2 : 1.7} />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth={active ? 2 : 1.7} strokeLinecap="round" />
    </svg>
  );
}
function TabIconChart({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-3M20 16v-7"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.7}
        strokeLinecap="round"
      />
    </svg>
  );
}
function TabIconUser({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth={active ? 2 : 1.7} />
      <path
        d="M5 20c1-3.5 4-5 7-5s6 1.5 7 5"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.7}
        strokeLinecap="round"
      />
    </svg>
  );
}
