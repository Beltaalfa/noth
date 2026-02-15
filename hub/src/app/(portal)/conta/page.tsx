import { auth } from "@/lib/auth";

export default async function ContaPage() {
  const session = await auth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-100">Minha conta</h1>
      <div className="mt-6 space-y-4">
        <div>
          <span className="text-zinc-500">Nome:</span>
          <span className="ml-2 text-zinc-100">{session?.user?.name}</span>
        </div>
        <div>
          <span className="text-zinc-500">Email:</span>
          <span className="ml-2 text-zinc-100">{session?.user?.email}</span>
        </div>
      </div>
    </div>
  );
}
