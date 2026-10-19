import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/* shadcn/ui's Button, re-themed to the buttons in DESIGN_SYSTEM.md. Variants are added
   as pages need them; only the nav's gold button exists so far. */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // .nav-cta / .btn-primary: gold fill, navy text, for dark surfaces
        gold: 'bg-gold text-navy hover:bg-gold-hover',
      },
      size: {
        // .nav-cta
        sm: 'px-[22px] py-[9px] text-[13px] tracking-[0.02em]',
      },
    },
    defaultVariants: { variant: 'gold', size: 'sm' },
  },
);

type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, type = 'button', ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...(asChild ? {} : { type })}
      {...props}
    />
  );
}
