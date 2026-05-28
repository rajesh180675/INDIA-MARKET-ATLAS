import { type ReactNode } from "react";
import { cn } from "@/utils/cn";

export function GradientPanel({
  children,
  className = "",
  innerClassName = "",
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[32px] bg-[linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.04),rgba(255,255,255,0.08))] p-px",
        className,
      )}
    >
      <div
        className={cn("glass-card rounded-[32px] p-6 sm:p-7", innerClassName)}
      >
        {children}
      </div>
    </div>
  );
}
