"use client";

import { IconArrowUp, IconArrowDown, IconSelector } from "@tabler/icons-react";

export type SortDirection = "default" | "asc" | "desc";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  sortKey?: string;
  sortDirection?: SortDirection;
  onSort?: (key: string) => void;
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "Nenhum registro encontrado.",
  onRowClick,
  sortKey,
  sortDirection = "default",
  onSort,
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800" role="region" aria-label="Tabela de dados">
      <table className="w-full text-sm" role="table">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/50">
            {columns.map((col) => {
              const isSorted = sortKey === col.key && sortDirection !== "default";
              const canSort = col.sortable === true && onSort;
              const ariaSort = canSort && isSorted
                ? (sortDirection === "asc" ? "ascending" as const : "descending" as const)
                : canSort
                  ? "none" as const
                  : undefined;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={`px-4 py-3 text-left font-medium text-zinc-400 ${canSort ? "cursor-pointer select-none hover:text-zinc-200 hover:bg-zinc-800/50" : ""}`}
                  onClick={() => canSort && onSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {canSort && (
                      <span className="text-zinc-500">
                        {!isSorted && <IconSelector size={14} />}
                        {isSorted && sortDirection === "asc" && <IconArrowUp size={14} />}
                        {isSorted && sortDirection === "desc" && <IconArrowDown size={14} />}
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-zinc-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={keyExtractor(item)}
                onClick={() => onRowClick?.(item)}
                className={`
                  border-b border-zinc-800/50 last:border-b-0
                  ${onRowClick ? "cursor-pointer hover:bg-zinc-800/30" : ""}
                `}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-zinc-200">
                    {col.render
                      ? col.render(item)
                      : String(item[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
