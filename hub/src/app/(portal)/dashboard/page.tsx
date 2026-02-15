import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
      <p className="text-zinc-500 mt-2">
        Bem-vindo, {session?.user?.name ?? session?.user?.email}
      </p>
      <p className="text-zinc-500 mt-4">
        Suas ferramentas aparecerão no menu lateral.
      </p>
    </div>
  );
}
