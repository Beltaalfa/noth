"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type UserOption = { id: string; name: string; area?: string | null };
type Destinatarios = { users: UserOption[] };

export function EncaminharModal({
  ticketId,
  clientId,
  onClose,
  onSuccess,
}: {
  ticketId: string;
  clientId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [novoResponsavelUserId, setNovoResponsavelUserId] = useState("");
  const [operadoresAuxiliaresIds, setOperadoresAuxiliaresIds] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [comentario, setComentario] = useState("");

  useEffect(() => {
    if (!clientId) return;
    fetch(`/api/helpdesk/destinatarios?clientId=${clientId}&onlyReceivers=true`)
      .then((r) => r.json())
      .then((d: Destinatarios) => setUsers(d?.users ?? []))
      .catch(() => setUsers([]));
  }, [clientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoResponsavelUserId.trim()) {
      toast.error("Selecione o novo responsável");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/helpdesk/tickets/${ticketId}/encaminhar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          novoResponsavelUserId: novoResponsavelUserId.trim(),
          operadoresAuxiliaresIds: operadoresAuxiliaresIds.filter(Boolean),
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          comentario: comentario.trim() || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Chamado encaminhado");
        onSuccess();
        onClose();
      } else {
        toast.error(data.error ?? "Erro ao encaminhar");
      }
    } catch {
      toast.error("Erro ao encaminhar");
    } finally {
      setLoading(false);
    }
  };

  const toggleAux = (id: string) => {
    if (id === novoResponsavelUserId) return;
    setOperadoresAuxiliaresIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <Modal isOpen onClose={onClose} title="Agendar / Encaminhar" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Novo responsável *</label>
          <select
            value={novoResponsavelUserId}
            onChange={(e) => setNovoResponsavelUserId(e.target.value)}
            className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
            required
          >
            <option value="">Selecione...</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} {u.area ? `(${u.area})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Operadores auxiliares</label>
          <div className="max-h-32 overflow-y-auto rounded-lg border border-zinc-600/80 bg-zinc-800/50 p-2 space-y-1">
            {users.filter((u) => u.id !== novoResponsavelUserId).map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={operadoresAuxiliaresIds.includes(u.id)}
                  onChange={() => toggleAux(u.id)}
                  className="rounded border-zinc-600 bg-zinc-800"
                />
                {u.name}
              </label>
            ))}
            {users.length === 0 && <p className="text-zinc-500 text-sm">Nenhum operador disponível (pode receber chamados).</p>}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Data/hora de agendamento (opcional)</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Comentário / observação</label>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={3}
            placeholder="Mensagem para o novo responsável..."
            className="w-full rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-700/50">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={loading}>Encaminhar</Button>
        </div>
      </form>
    </Modal>
  );
}
