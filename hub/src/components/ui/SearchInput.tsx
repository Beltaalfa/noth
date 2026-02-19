"use client";

import { IconSearch } from "@tabler/icons-react";

export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar...",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 size-4" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full max-w-xs pl-9 pr-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-700 text-zinc-100 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 focus:border-zinc-500"
      />
    </div>
  );
}
