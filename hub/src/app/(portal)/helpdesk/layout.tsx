import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { HelpdeskNav } from "@/components/helpdesk/HelpdeskNav";

export default async function HelpdeskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const _userId = (session.user as { id?: string })?.id;
  if (!_userId) redirect("/login");

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <HelpdeskNav />
      {children}
    </div>
  );
}
