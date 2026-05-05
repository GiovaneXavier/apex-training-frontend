import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  width?: number;
  height?: number;
  dark?: boolean;
};

// Mobile-first canvas frame.
// Em mobile real (≤ 768px) vira fullscreen — sem moldura — para o app
// usar 100% da viewport. Em desktop, mostra a moldura 380×760 para
// preview do design mobile.
export function PhoneFrame({ children, width = 380, height = 760, dark = false }: Props) {
  return (
    <>
      {/* Mobile real: fullscreen, sem moldura */}
      <div
        className="md:hidden"
        style={{
          height: '100dvh',
          width: '100%',
          background: dark ? '#0a0a0b' : '#fafaf9',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>

      {/* Desktop / tablet largo: moldura de preview */}
      <div className="hidden md:flex min-h-screen items-center justify-center bg-bg p-4">
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
    </>
  );
}
