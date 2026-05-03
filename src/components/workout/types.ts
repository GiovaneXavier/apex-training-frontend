import type { ThemeTokens, DensityName } from '@/themes/tokens';

export type WorkoutVariant = 'start' | 'in-progress' | 'set-saved' | 'new-pr' | 'offline';

export type SetState = 'done' | 'pr' | undefined;

export type WorkoutSet = {
  state?: SetState;
  kg?: string;
  reps?: string;
  kgHint?: string;
  repsHint?: string;
};

export type SportKey = 'musc' | 'run' | 'swim';

export type WithTheme = { t: ThemeTokens };
export type WithDensity = { density: DensityName };
