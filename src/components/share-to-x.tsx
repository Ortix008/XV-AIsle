import { cn } from "cn";
import { XMark } from "@/components/x-mark";
import { SHARE_LABEL } from "@/lib/share-label";

export function ShareToX({ href, className }: { href: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn("share-x gap-2", className)}
      aria-label="Share this find on X"
    >
      <XMark />
      {SHARE_LABEL}
    </a>
  );
}
