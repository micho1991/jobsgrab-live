"use client";
import { useId, useState } from "react";
import { Label, FieldMessage, inputClass } from "./field";

const RULES = [
  { test: (v: string) => v.length >= 8, label: "8 or more characters" },
  { test: (v: string) => /[a-z]/.test(v) && /[A-Z]/.test(v), label: "Upper and lowercase letters" },
  { test: (v: string) => /[0-9]/.test(v), label: "At least one number" },
];

interface Props {
  name: string;
  label: string;
  error?: string;
  autoComplete: "current-password" | "new-password";
  showRules?: boolean;
  hint?: React.ReactNode;
}

export function PasswordInput({ name, label, error, autoComplete, showRules, hint }: Props) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const id = useId();
  const rulesId = `${id}-rules`;

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <input id={id} name={name} type={visible ? "text" : "password"} autoComplete={autoComplete}
          required value={value} onChange={(e) => setValue(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={[error && `${id}-error`, showRules && rulesId].filter(Boolean).join(" ") || undefined}
          className={`${inputClass(!!error)} pr-16`} />
        <button type="button" onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-1 right-1 rounded-md px-2.5 text-sm font-medium text-steel hover:bg-mist hover:text-ink"
          aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}>
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {showRules && (
        <ul id={rulesId} className="mt-2 grid gap-1 text-[13px]" aria-live="polite">
          {RULES.map((r) => {
            const ok = r.test(value);
            return (
              <li key={r.label} className={`flex items-center gap-2 ${ok ? "text-ok" : "text-muted"}`}>
                <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" aria-hidden="true">
                  {ok
                    ? <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    : <circle cx="8" cy="8" r="3" fill="currentColor" opacity=".45" />}
                </svg>
                <span>{r.label}<span className="sr-only">{ok ? " (met)" : " (not met)"}</span></span>
              </li>
            );
          })}
        </ul>
      )}
      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  );
}
