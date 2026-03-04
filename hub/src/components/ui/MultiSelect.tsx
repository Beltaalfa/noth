"use client";

import { useState, useRef, useEffect } from "react";

export type MultiSelectOption = { value: number | string; label: string };

interface MultiSelectProps {
  id?: string;
  label?: string;
  options: MultiSelectOption[];
  selected: (number | string)[];
  onChange: (selected: (number | string)[]) => void;
  placeholder?: string;
  className?: string;
  /** Altura máxima do painel de opções (ex: "max-h-60") */
  maxHeight?: string;
}

export function MultiSelect({
  id,
  label,
  options,
  selected,
  onChange,
  placeholder = "Selecione...",
  className = "",
  maxHeight = "max-h-60",
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const toggle = (value: number | string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const labelText = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? options.find((o) => o.value === selected[0])?.label ?? "1 selecionado"
      : `${selected.length} selecionado(s)`;

  return (
    <div ref={ref} className={`relative ${className}`}>
      {label && (
        <label htmlFor={id} className="mb-1 block text-xs font-medium text-zinc-400">
          {label}
        </label>
      )}
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-left text-sm text-zinc-100 flex items-center justify-between gap-2"
      >
        <span className="truncate">{labelText}</span>
        <span className="shrink-0 text-zinc-500">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div
          className={`absolute z-20 mt-1 w-full overflow-y-auto rounded-lg border border-zinc-600 bg-zinc-800 shadow-xl ${maxHeight}`}
        >
          {options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-zinc-500">Nenhuma opção</p>
          ) : (
            <ul className="py-1">
              {options.map((opt) => (
                <li key={String(opt.value)}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-zinc-700/50">
                    <input
                      type="checkbox"
                      checked={selected.includes(opt.value)}
                      onChange={() => toggle(opt.value)}
                      className="rounded border-zinc-500 text-amber-500"
                    />
                    <span className="text-sm text-zinc-300">{opt.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
