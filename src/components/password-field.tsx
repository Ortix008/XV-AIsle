"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";
import { Input } from "@/components/ui/input";

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  minLength,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "new-password" | "current-password";
  minLength?: number;
  maxLength?: number;
}) {
  const id = useId();
  const [shown, setShown] = useState(false);
  return (
    <div className="flex flex-col gap-1 text-base">
      <label htmlFor={id}>{label}</label>
      <div className="relative">
        <Input
          id={id}
          type={shown ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required
          minLength={minLength}
          maxLength={maxLength}
          className="h-10 pr-10 md:text-base"
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 grid w-9 place-items-center text-muted-foreground hover:text-foreground"
          aria-pressed={shown}
          aria-label={shown ? "Hide password" : "Show password"}
          onClick={() => setShown((current) => !current)}
        >
          {shown ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </button>
      </div>
    </div>
  );
}
