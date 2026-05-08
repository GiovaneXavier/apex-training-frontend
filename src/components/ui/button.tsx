import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-ink text-bg hover:opacity-90',
        coral:   'bg-[#fc4c02] text-white hover:bg-[#e04400]',
        accent:  'bg-accent text-accent-ink hover:opacity-90',
        outline: 'border border-app-strong bg-transparent text-ink hover:bg-surface',
        ghost:   'bg-transparent text-ink hover:bg-surface',
        danger:  'bg-danger-bg text-danger',
      },
      size: {
        default: 'h-11 px-5 text-[13px]',
        sm: 'h-9 px-3 text-[12px]',
        icon: 'size-10',
        iconSm: 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant, size, asChild, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp ref={ref as never} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  );
});

export { buttonVariants };
