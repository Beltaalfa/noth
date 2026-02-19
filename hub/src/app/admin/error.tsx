"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-xl border border-red-900/50 bg-red-950/20 p-8">
      <h2 className="text-lg font-semibold text-red-400">Erro no painel admin</h2>
      <p className="max-w-md text-center text-sm text-zinc-500">{error.message}</p>
      <Button variant="secondary" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
