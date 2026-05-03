import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  width?: number;
  height?: number;
  dark?: boolean;
};

// Mobile-first canvas frame. The real screen renders inside this 380×760 container
// so design fidelity matches the artboards in Agenda de Treinos.html.
// On real devices we let the inner screen fill the viewport via CSS clamp.
export function PhoneFrame({ children, width = 380, height = 760, dark = false }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div
        style={{
          width,
          height,
          maxWidth: '100vw',
          maxHeight: '100vh',
          borderRadius: 36,
          overflow: 'hidden',
          background: dark ? '#0a0a0b' : '#fafaf9',
          boxShadow: dark
            ? '0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)'
            : '0 30px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
          position: 'relative',
        }}
      >
        {children}
      </div>
    </div>
  );
}
