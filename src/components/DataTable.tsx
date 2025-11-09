"use client";

import React, { useMemo, useState } from 'react';

export type Column<T> = {
  id: string;
  header: string;
  accessor?: (row: T) => React.ReactNode;
  field?: keyof T; // used when accessor not provided
  className?: string;
  sortable?: boolean;
};

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  emptyLabel = 'No data',
}: {
  data: T[];
  columns: Column<T>[];
  emptyLabel?: string;
}) {
  const [sort, setSort] = useState<{ id: string; dir: 'asc' | 'desc' } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.id === sort.id);
    if (!col) return data;
    const getVal = (row: T) => {
      if (col.accessor) return col.accessor(row) as any;
      if (col.field) return (row as any)[col.field];
      return undefined;
    };
    const arr = data.slice();
    arr.sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (va == null && vb == null) return 0;
      if (va == null) return sort.dir === 'asc' ? -1 : 1;
      if (vb == null) return sort.dir === 'asc' ? 1 : -1;
      if (typeof va === 'number' && typeof vb === 'number') return sort.dir === 'asc' ? va - vb : vb - va;
      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      return sort.dir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
    return arr;
  }, [data, columns, sort]);

  const toggleSort = (col: Column<T>) => {
    if (!col.sortable) return;
    setSort((prev) => {
      if (!prev || prev.id !== col.id) return { id: col.id, dir: 'asc' };
      if (prev.dir === 'asc') return { id: col.id, dir: 'desc' };
      return null; // third click clears sort
    });
  };

  return (
    <div className="overflow-x-auto hh-card p-2">
      <table className="min-w-full text-sm">
        <thead className="text-left">
          <tr>
            {columns.map((c) => (
              <th key={c.id} className={`px-3 py-2 text-(--hh-text-secondary) ${c.sortable ? 'cursor-pointer select-none' : ''}`} onClick={() => toggleSort(c)}>
                <div className="inline-flex items-center gap-1">
                  <span>{c.header}</span>
                  {sort?.id === c.id && (
                    <span aria-hidden className="text-(--hh-text-tertiary)">{sort.dir === 'asc' ? '▲' : '▼'}</span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-(--hh-text-tertiary)">{emptyLabel}</td>
            </tr>
          )}
          {sorted.map((row) => (
            <tr key={row.id} className="hover:bg-[rgba(255,255,255,0.03)]">
              {columns.map((c) => (
                <td key={c.id} className={`px-3 py-2 ${c.className ?? ''}`}>
                  {c.accessor ? c.accessor(row) : (c.field ? (row as any)[c.field] : null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
