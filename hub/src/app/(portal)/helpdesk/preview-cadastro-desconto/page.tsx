import { PreviewCadastroDescontoForm } from "@/components/helpdesk/PreviewCadastroDescontoForm";

export default function PreviewCadastroDescontoPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
        <strong>Preview</strong> — Este é o layout proposto do formulário &quot;Cadastro e aprovação de desconto comercial&quot;.
        Nenhum dado é enviado. Após aprovar, o formulário real será alterado.
      </div>
      <PreviewCadastroDescontoForm />
    </div>
  );
}
