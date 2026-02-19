import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ArvorePage } from "@/components/helpdesk/ArvorePage";

export default async function ArvoreRoute() {
  const session = await auth();
  if (!session) redirect("/login");

  return <ArvorePage />;
}
