'use client';

import { useId, useState } from 'react';
import { formatNumber, parseNumberInput } from '@/lib/number-format';

export function FormattedNumberInput({ label, unit, value, max, integer, onChange, hint, placeholder }: {
  label: string; unit: string; value: number | null; max: number; integer?: boolean;
  onChange: (value: number | null) => void; hint?: string; placeholder?: string;
}) {
  const id = useId();
  const [text, setText] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const error = `0–${formatNumber(max)} arasında ${integer ? 'bir tam sayı' : 'geçerli bir sayı'} girin.`;
  return <div>
    <label htmlFor={id} className="block text-sm font-medium">{label}</label>
    <div className="mt-1.5 flex min-w-0 overflow-hidden rounded-lg border border-[#cfddd7] bg-[#fbfcfc] focus-within:border-[#3d8173] focus-within:ring-2 focus-within:ring-[#dceee8]">
      <input
        id={id}
        type="text"
        inputMode={integer ? 'numeric' : 'decimal'}
        value={text ?? (value === null ? '' : formatNumber(value))}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid || hint ? `${id}-description` : undefined}
        onFocus={() => {
          if (!invalid && value !== null) setText(formatNumber(value, false));
        }}
        onChange={event => {
          const next = event.currentTarget.value;
          const parsed = parseNumberInput(next, unit, max, integer);
          const invalidInput = parsed === undefined;
          setText(next);
          setInvalid(invalidInput);
          event.currentTarget.setCustomValidity(invalidInput ? error : '');
          if (parsed !== undefined) onChange(parsed);
        }}
        onBlur={() => { if (!invalid) setText(null); }}
        className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm tabular-nums outline-none"
      />
      <span className="shrink-0 border-l border-[#e1eae6] bg-[#eef5f1] px-2.5 py-2.5 text-xs leading-5 text-[#45655d]" aria-hidden="true">{unit}</span>
    </div>
    {(invalid || hint) && <p id={`${id}-description`} className={`mt-1 text-xs ${invalid ? 'text-red-700' : 'text-[#536c64]'}`}>{invalid ? error : hint}</p>}
  </div>;
}
