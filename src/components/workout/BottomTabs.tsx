import { TabIconChart, TabIconDumb, TabIconFlag, TabIconUser } from './icons';
import type { WithTheme } from './types';

type TabId = 'treinos' | 'progresso' | 'desafios' | 'perfil';

type TabDef = {
  id: TabId;
  label: string;
  icon: (p: { color: string }) => JSX.Element;
};

const TABS: TabDef[] = [
  { id: 'treinos', label: 'Treinos', icon: TabIconDumb },
  { id: 'progresso', label: 'Progresso', icon: TabIconChart },
  { id: 'desafios', label: 'Desafios', icon: TabIconFlag },
  { id: 'perfil', label: 'Perfil', icon: TabIconUser },
];

export function BottomTabs({ t, active = 'treinos' }: WithTheme & { active?: TabId }) {
  return (
    <div
      style={{
        paddingTop: 8,
        paddingBottom: 28,
        background: t.bg,
        borderTop: `0.5px solid ${t.border}`,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
      }}
    >
      {TABS.map((tb) => {
        const isActive = tb.id === active;
        const c = isActive ? t.ink : t.inkSubtle;
        const Ic = tb.icon;
        return (
          <div
            key={tb.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '6px 0',
            }}
          >
            <Ic color={c} />
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: c,
                letterSpacing: 0.1,
              }}
            >
              {tb.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
