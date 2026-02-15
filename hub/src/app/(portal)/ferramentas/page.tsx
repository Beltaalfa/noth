import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getToolsForUser } from "@/lib/permissions";
import { IconTools } from "@tabler/icons-react";

export default async function FerramentasPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const userId = (session.user as { id?: string })?.id;
  if (!userId) redirect("/login");

  const tools = await getToolsForUser(userId);

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-100">Ferramentas</h1>
      <p className="text-zinc-500 mt-2 mb-6">
        Clique em uma ferramenta para acessar.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((t) => (
          <Link
            key={t.id}
            href={`/ferramentas/${t.slug}`}
            className="flex items-center gap-3 p-4 rounded-lg border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-800/50 transition-colors"
          >
            <IconTools size={24} strokeWidth={2} className="text-zinc-400" />
            <span className="font-medium text-zinc-100">{t.name}</span>
          </Link>
        ))}
      </div>
      {tools.length === 0 && (
        <p className="text-zinc-500">Nenhuma ferramenta disponível. Entre em contato com o administrador.</p>
      )}
    </div>
  );
}
