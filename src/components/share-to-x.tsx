import { cn } from "cn";
import { SHARE_LABEL } from "@/lib/share-label";

export function ShareToX({ href, className }: { href: string; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={cn("share-x", className)}>
      {SHARE_LABEL}
    </a>
  );
}
