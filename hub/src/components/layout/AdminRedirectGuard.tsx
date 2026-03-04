"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function AdminRedirectGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname?.startsWith("/helpdesk") || pathname?.startsWith("/ferramentas")) return;
    router.replace("/admin/config/clientes");
  }, [pathname, router]);

  if (pathname?.startsWith("/helpdesk") || pathname?.startsWith("/ferramentas")) return <>{children}</>;
  return (
    <div className="flex min-h-screen items-center justify-center text-zinc-500">
      Redirecionando...
    </div>
  );
}
