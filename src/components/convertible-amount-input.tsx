"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { dollarsToCents, formatCents } from "@/lib/money/cents";
import { convertAmountString } from "@/lib/money/convert";
import { isSupportedCurrency, type Currency } from "@/lib/money/currency";
import { cn } from "@/lib/utils";

const OTHER_CURRENCY: Record<Currency, Currency> = { USD: "KHR", KHR: "USD" };
const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", KHR: "៛" };

export interface ConvertibleAmountInputProps {
  /** The group's/trip's centralized currency — the value this component
   *  always reports/submits, regardless of which currency the user picks
   *  to type in. */
  baseCurrency: string;
  /** Riel per 1 USD, used to convert between USD and KHR. */
  usdKhrRate: number;
  id?: string;
  /** Uncontrolled/FormData mode: renders a hidden input with this name
   *  holding the base-currency value, for plain <form> submission. */
  name?: string;
  /** Controlled mode: current value, in base currency. */
  value?: string;
  /** Uncontrolled mode: initial value, in base currency. */
  defaultValue?: string;
  /** Controlled mode: called with the new value, in base currency. */
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}

/**
 * A money-amount input that lets the user type in either USD or KHR, no
 * matter which currency the group/trip actually centralizes on
 * (`baseCurrency`) — converting automatically via `usdKhrRate`. The value
 * this component reports (onChange, or the hidden input under `name`) is
 * always in `baseCurrency`, so every caller's downstream logic (split
 * math, server validation) is completely unaffected by which currency the
 * user happened to type in.
 *
 * Works both as a controlled input (`value`/`onChange`, for forms that
 * hold all their state in React, like the expense form) and as a plain
 * FormData field (`name`, optionally `defaultValue`, for forms that
 * submit via native <form> — the actual amount hides behind `name`
 * already converted, so server actions never see the display currency).
 */
export function ConvertibleAmountInput({
  baseCurrency,
  usdKhrRate,
  id,
  name,
  value,
  defaultValue,
  onChange,
  placeholder,
  required,
  disabled,
  className,
  "data-testid": testId,
}: ConvertibleAmountInputProps) {
  const supportedBase = isSupportedCurrency(baseCurrency) ? baseCurrency : null;
  const isControlled = value !== undefined;
  const [uncontrolledBaseValue, setUncontrolledBaseValue] = useState(defaultValue ?? "");
  const baseValue = isControlled ? value : uncontrolledBaseValue;

  const [displayCurrency, setDisplayCurrency] = useState<Currency>(supportedBase ?? "USD");
  const [rawText, setRawText] = useState(baseValue);
  const lastEmitted = useRef(baseValue);

  // Resync the displayed text when `value` changes for a reason other
  // than this component's own edits (e.g. an edit-mode prefill landing
  // after mount, or a sibling field driving a computed default) — but
  // never while the user is actively typing in the OTHER currency, or
  // every keystroke's round-trip conversion would visibly reformat what
  // they're mid-typing.
  useEffect(() => {
    if (baseValue === lastEmitted.current) return;
    lastEmitted.current = baseValue;
    setRawText(
      !supportedBase || displayCurrency === supportedBase
        ? baseValue
        : (convertAmountString(baseValue, supportedBase, displayCurrency, usdKhrRate) ?? ""),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseValue]);

  function emitBaseValue(next: string) {
    lastEmitted.current = next;
    if (isControlled) onChange?.(next);
    else setUncontrolledBaseValue(next);
  }

  function handleRawChange(raw: string) {
    setRawText(raw);
    if (!supportedBase || displayCurrency === supportedBase) {
      emitBaseValue(raw);
      return;
    }
    emitBaseValue(convertAmountString(raw, displayCurrency, supportedBase, usdKhrRate) ?? "");
  }

  function toggleCurrency() {
    if (!supportedBase) return;
    const next = OTHER_CURRENCY[displayCurrency];
    const nextRaw =
      next === supportedBase
        ? baseValue
        : (convertAmountString(baseValue, supportedBase, next, usdKhrRate) ?? "");
    setDisplayCurrency(next);
    setRawText(nextRaw);
  }

  const step = supportedBase && displayCurrency === "KHR" ? "1" : "0.01";
  const defaultPlaceholder = supportedBase && displayCurrency === "KHR" ? "0" : "0.00";

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-1.5">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          min="0"
          placeholder={placeholder ?? defaultPlaceholder}
          required={required}
          disabled={disabled}
          value={rawText}
          onChange={(e) => handleRawChange(e.target.value)}
          data-testid={testId}
          className="flex-1"
        />
        {supportedBase && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={toggleCurrency}
            disabled={disabled}
            aria-label={`Switch to ${OTHER_CURRENCY[displayCurrency]}`}
            title={`Currently ${displayCurrency} — tap to switch to ${OTHER_CURRENCY[displayCurrency]}`}
            className="shrink-0 rounded-full px-2.5 font-semibold"
            data-testid={testId ? `${testId}-currency-toggle` : undefined}
          >
            {CURRENCY_SYMBOL[displayCurrency]}
          </Button>
        )}
        {name && <input type="hidden" name={name} value={baseValue} />}
      </div>
      {supportedBase && displayCurrency !== supportedBase && baseValue && (
        <p className="text-xs text-muted-foreground">
          ≈ {formatCents(dollarsToCents(baseValue) ?? 0, supportedBase)}
        </p>
      )}
    </div>
  );
}
