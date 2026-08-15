import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Password input with a reveal toggle. Judges and organisers sign in on
 * phones and on shared machines under time pressure, where a mistyped
 * password is far more likely than someone reading it over their shoulder.
 * Defaults to masked; revealing is always a deliberate act.
 */
export function PasswordField({
  value,
  onChange,
  label,
  autoComplete = "current-password",
  required,
  minLength,
  maxLength = 200,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className={cn("block", className)}>
      <span className="hv-label mb-2 block">{label}</span>
      <span className="relative block">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="w-full border border-input bg-background py-3 pr-12 pl-3 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          // Sits inside the field, sized for a thumb (§31).
          className="absolute top-1/2 right-0 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
    </label>
  );
}
