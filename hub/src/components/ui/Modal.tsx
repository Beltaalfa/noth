"use client";

import { useEffect, useCallback } from "react";
import { IconX } from "@tabler/icons-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

const maxWidthClasses = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({ isOpen, onClose, title, children, maxWidth = "md" }: ModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm min-h-full"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        className={`
          relative w-full my-auto max-h-[calc(100vh-1.5rem)] overflow-y-auto
          ${maxWidthClasses[maxWidth]}
          bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl
          transition-all duration-200
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-zinc-800">
            <h2 id="modal-title" className="text-lg font-semibold text-zinc-100">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              aria-label="Fechar"
            >
              <IconX size={20} strokeWidth={2} />
            </button>
          </div>
        ) : (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            aria-label="Fechar"
          >
            <IconX size={20} strokeWidth={2} />
          </button>
        )}
        <div className="px-4 sm:px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
