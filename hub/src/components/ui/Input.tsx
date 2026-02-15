"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;

    return (
      <div className="w-full">
        {label ? (
          <label htmlFor={inputId} className="block text-sm font-medium text-zinc-300 mb-1">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-3 py-2 rounded-lg
            bg-zinc-900/50 border border-zinc-700
            text-zinc-100 placeholder-zinc-500
            focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? "border-red-500/50 focus:ring-red-500/50" : ""}
            ${className}
          `}
          {...props}
        />
        {error ? <p className="mt-1 text-sm text-red-400">{error}</p> : null}
      </div>
    );
  }
);

Input.displayName = "Input";
