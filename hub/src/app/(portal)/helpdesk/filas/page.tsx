import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FilasPage } from "@/components/helpdesk/FilasPage";

export default async function FilasRoute() {
  const session = await auth();
  if (!session) redirect("/login");

  return <FilasPage />;
}
