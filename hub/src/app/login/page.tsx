"use client";

import { useState, Suspense } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const configError = searchParams.get("error") === "config";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(configError ? "Erro na configuração do servidor. Verifique NEXTAUTH_SECRET e NEXTAUTH_URL no servidor." : "");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Email ou senha inválidos. Tente novamente.");
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Erro ao fazer login. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-2 min-h-[48px] items-center">
            <Image
              src="/logo.svg"
              alt="Hub Nortempresarial"
              width={140}
              height={48}
              className="h-12 w-auto object-contain [color:white]"
            />
            <span className="text-2xl font-bold text-zinc-100" style={{ display: "none" }}>
              Hub
            </span>
          </div>
          <p className="text-zinc-500 mt-1">Nortempresarial</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 p-6 rounded-xl border border-zinc-800 bg-zinc-900/30"
        >
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">
            Acesse sua conta
          </h2>

          {error ? (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm" role="alert" aria-live="polite">
              {error}
            </div>
          ) : null}

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
            autoComplete="email"
          />

          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />

          <Button
            type="submit"
            className="w-full"
            isLoading={isLoading}
            disabled={isLoading}
          >
            Entrar
          </Button>
        </form>

        <p className="text-center text-zinc-500 text-sm mt-6">
          Portal do Cliente e Painel Admin
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-black"><p className="text-zinc-500">Carregando...</p></div>}>
      <LoginForm />
    </Suspense>
  );
}
