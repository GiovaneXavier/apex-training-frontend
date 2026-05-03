import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export const Field = forwardRef<HTMLInputElement, Props>(function Field(
  { label, hint, error, className, ...rest },
  ref,
) {
  return (
    <label className="block mb-3.5">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.6px] text-ink-subtle mb-1.5">
        {label}
      </span>
      <input
        ref={ref}
        {...rest}
        className={cn(
          'w-full h-11 px-3.5 rounded-[12px] bg-surface border border-app-strong',
          'text-ink placeholder:text-ink-subtle',
          'text-[15px] leading-none',
          'outline-none focus:border-accent focus:ring-2 focus:ring-accent/20',
          'transition-[border,box-shadow]',
          error && 'border-danger focus:border-danger focus:ring-danger/20',
          className,
        )}
      />
      {error ? (
        <span className="block text-[11px] text-danger mt-1.5 font-medium">{error}</span>
      ) : hint ? (
        <span className="block text-[11px] text-ink-subtle mt-1.5">{hint}</span>
      ) : null}
    </label>
  );
});
