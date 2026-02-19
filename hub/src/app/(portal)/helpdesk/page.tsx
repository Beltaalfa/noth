import { redirect } from "next/navigation";

/** Home do helpdesk: redireciona para Meus Chamados (conforme plano). */
export default function HelpdeskPortalPage() {
  redirect("/helpdesk/meus-chamados");
}
