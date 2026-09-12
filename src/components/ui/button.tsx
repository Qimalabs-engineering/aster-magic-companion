import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "outline" | "quiet";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-sm border px-4 font-mono text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" &&
          "border-primary bg-primary text-primary-foreground hover:bg-primary/88",
        variant === "outline" &&
          "border-border bg-transparent text-foreground hover:border-foreground/40 hover:bg-muted",
        variant === "quiet" &&
          "border-transparent bg-transparent px-2 text-muted-foreground hover:text-foreground",
        className,
      )}
      {...props}
    />
  ),
);