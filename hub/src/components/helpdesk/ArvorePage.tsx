"use client";

import { useState, useEffect, useCallback } from "react";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import Link from "next/link";

type ArvoreNode = {
  id: string;
  label: string;
  type: "group" | "sector" | "status";
  count?: number;
  children?: ArvoreNode[];
  ticketIds?: string[];
};

const STATUS_LABEL: Record<string, string> = {
  open: "Aberto", aguardando_atendimento: "Aguard. atend.", em_atendimento: "Em atendimento",
  concluido: "Concluído", closed: "Fechado", pending_approval: "Pend. aprovação",
  custo_aguardando_aprovacao: "Pend. autorização",
};

function TreeNode({
  node,
  depth,
  expandedIds,
  onToggle,
}: {
  node: ArvoreNode;
  depth: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isExpanded = expandedIds.has(node.id);
  const paddingLeft = depth * 16 + 8;

  return (
    <div className="text-sm">
      <div
        className="flex items-center gap-2 py-1.5 hover:bg-zinc-800/40 rounded px-2 -mx-2 cursor-pointer"
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={() => hasChildren && onToggle(node.id)}
      >
        {hasChildren ? (
          <span className="text-zinc-500 flex-shrink-0">
            {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          </span>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}
        <span className={node.type === "group" ? "font-medium text-zinc-200" : node.type === "sector" ? "text-zinc-300" : "text-zinc-400"}>
          {node.type === "status" ? STATUS_LABEL[node.label] ?? node.label : node.label}
        </span>
        {node.count != null && (
          <span className="ml-2 rounded bg-zinc-700/50 px-1.5 py-0.5 text-xs text-zinc-400">{node.count}</span>
        )}
        {node.type === "status" && node.ticketIds && node.ticketIds.length > 0 && (
          <Link href="/helpdesk/areas-geridas" className="ml-2 text-xs text-blue-400 hover:underline" onClick={(e) => e.stopPropagation()}>
            Ver áreas
          </Link>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ArvorePage() {
  const [tree, setTree] = useState<ArvoreNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchArvore = useCallback(async () => {
    const res = await fetch("/api/helpdesk/tickets/arvore");
    const data = await res.json();
    if (res.ok) setTree(Array.isArray(data) ? data : []);
    else setTree([]);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchArvore().then(() => setLoading(false));
  }, [fetchArvore]);

  const onToggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) return <p className="text-zinc-500 text-sm py-4">Carregando...</p>;

  if (tree.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-100">Árvore de Chamados</h1>
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-8 text-center text-zinc-500">
          Nenhum dado disponível ou sem permissão.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-100">Árvore de Chamados</h1>
        <p className="mt-1 text-sm text-zinc-500">Agrupado por área e status. Expanda para ver contagens.</p>
      </header>
      <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-4">
        {tree.map((node) => (
          <TreeNode key={node.id} node={node} depth={0} expandedIds={expandedIds} onToggle={onToggle} />
        ))}
      </div>
    </div>
  );
}
