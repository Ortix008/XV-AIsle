import { cn } from "cn";

export function ShareToX({ href, className }: { href: string; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={cn("share-x", className)}>
      Share to X
    </a>
  );
}
