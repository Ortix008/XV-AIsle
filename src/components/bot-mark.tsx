import { Megaphone, Package, PenLine, Search, type LucideIcon } from "lucide-react";
import type { BotId } from "@/lib/types";

export function botIcon(id: BotId): LucideIcon {
  switch (id) {
    case "scout":
      return Search;
    case "listings":
      return PenLine;
    case "orders":
      return Package;
    case "marketing":
      return Megaphone;
    default: {
      const _never: never = id;
      return _never;
    }
  }
}

export function AiBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-[#1a1a1a] px-2.5 py-0.5 text-sm font-medium text-[#1a1a1a]">
      AI assistant
    </span>
  );
}
