import { getTheme, type DensityName, type ThemeName } from '@/themes/tokens';
import { Header } from './Header';
import { ProgressStrip } from './ProgressStrip';
import { SportChips } from './SportChips';
import { ExerciseCard } from './ExerciseCard';
import { SetsTable } from './SetsTable';
import { SaveBar } from './SaveBar';
import { FinalizeCTA } from './FinalizeCTA';
import { BottomTabs } from './BottomTabs';
import { OfflineBanner } from './OfflineBanner';
import { PRCelebration } from './PRCelebration';
import type { WorkoutSet, WorkoutVariant } from './types';

type Props = {
  theme?: ThemeName;
  variant?: WorkoutVariant;
  density?: DensityName;
  accent?: string;
  fontFamily?: string;
};

export function WorkoutScreen({
  theme = 'light',
  variant = 'in-progress',
  density = 'regular',
  accent,
  fontFamily,
}: Props) {
  const t = getTheme(theme, accent);
  const themeWithFont = fontFamily ? { ...t, font: fontFamily } : t;
  const online = variant !== 'offline';

  let sets: WorkoutSet[];
  let activeIdx: number;
  let saveLabel: string;
  let saveEnabled = true;
  let saveDim = false;
  const currentExercise = 1;

  switch (variant) {
    case 'start':
      sets = [
        { kgHint: '— —', repsHint: '— —' },
        { kgHint: '— —', repsHint: '— —' },
        { kgHint: '— —', repsHint: '— —' },
      ];
      activeIdx = 0;
      saveLabel = 'Salvar série';
      saveEnabled = false;
      saveDim = true;
      break;
    case 'in-progress':
      sets = [
        { state: 'done', kg: '32', reps: '12' },
        { kg: '32', repsHint: '— —' },
        { kgHint: '— —', repsHint: '— —' },
      ];
      activeIdx = 1;
      saveLabel = 'Salvar série 2';
      break;
    case 'set-saved':
      sets = [
        { state: 'done', kg: '32', reps: '12' },
        { state: 'done', kg: '32', reps: '11' },
        { kgHint: '34', repsHint: '— —' },
      ];
      activeIdx = 2;
      saveLabel = 'Salvar série 3';
      break;
    case 'new-pr':
      sets = [
        { state: 'done', kg: '32', reps: '12' },
        { state: 'done', kg: '34', reps: '12' },
        { state: 'pr', kg: '36', reps: '12' },
      ];
      activeIdx = -1;
      saveLabel = 'Próximo exercício';
      break;
    case 'offline':
    default:
      sets = [
        { state: 'done', kg: '32', reps: '12' },
        { state: 'done', kg: '34', reps: '11' },
        { kg: '34', repsHint: '— —' },
      ];
      activeIdx = 2;
      saveLabel = 'Salvar série 3';
      break;
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: themeWithFont.bg,
        color: themeWithFont.ink,
        fontFamily: themeWithFont.font,
        display: 'flex',
        flexDirection: 'column',
        WebkitFontSmoothing: 'antialiased',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes wsPulse { 0% { transform: scale(1); opacity: .35 } 100% { transform: scale(2.2); opacity: 0 } }
        @keyframes wsBlink { 50% { opacity: 0 } }
      `}</style>

      <div style={{ flex: 1, overflow: 'auto', paddingTop: 4 }}>
        <Header t={themeWithFont} online={online} density={density} />
        {variant === 'offline' && <OfflineBanner t={themeWithFont} density={density} />}
        <ProgressStrip t={themeWithFont} current={currentExercise} total={6} density={density} />
        <SportChips t={themeWithFont} density={density} items={['musc', 'run', 'swim']} />
        <ExerciseCard
          t={themeWithFont}
          density={density}
          restTimer={variant === 'set-saved' ? 87 : 120}
        />
        <SetsTable t={themeWithFont} density={density} sets={sets} activeIdx={activeIdx} />
        <SaveBar t={themeWithFont} density={density} label={saveLabel} enabled={saveEnabled} dim={saveDim} />
        <FinalizeCTA t={themeWithFont} density={density} ghost={variant === 'start'} />
      </div>
      <BottomTabs t={themeWithFont} />

      {variant === 'new-pr' && <PRCelebration t={themeWithFont} />}
    </div>
  );
}
