import type { HTMLAttributes, ReactNode } from "react";

import { surface, type SurfaceVariant } from "@/lib/workspace/design";
import { cn } from "@/lib/utils";

type SurfaceElement = "div" | "section" | "article";

type SurfaceProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  variant?: SurfaceVariant;
  className?: string;
  as?: SurfaceElement;
};

export function Surface({
  children,
  variant = "default",
  className,
  as: Tag = "section",
  ...props
}: SurfaceProps) {
  return (
    <Tag className={cn(surface(variant), className)} {...props}>
      {children}
    </Tag>
  );
}