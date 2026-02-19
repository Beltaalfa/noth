import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AreasGeridasPage } from "@/components/helpdesk/AreasGeridasPage";

export default async function AreasGeridasRoute() {
  const session = await auth();
  if (!session) redirect("/login");

  return <AreasGeridasPage />;
}
