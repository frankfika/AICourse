import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl active:scale-95',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground border-0 hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5 shadow-md',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-lg hover:-translate-y-0.5 shadow-md',
        outline:
          'border-2 border-border bg-transparent text-foreground hover:border-primary/40 hover:bg-muted/70 hover:-translate-y-0.5',
        secondary:
          'bg-muted text-foreground border border-border/60 hover:border-border hover:bg-muted/80 hover:-translate-y-0.5',
        ghost: 'border-0 hover:bg-muted/50 hover:text-foreground',
        link: 'border-0 text-foreground underline-offset-4 hover:text-primary hover:underline',
      },
      size: {
        default: 'h-11 px-6 py-2.5 text-sm',
        sm: 'h-9 px-4 text-xs',
        lg: 'h-13 px-8 text-base',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
