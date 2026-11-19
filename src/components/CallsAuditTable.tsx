import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { CallRecord } from '../types/callCenter';
import { formatDecimalBR } from '../utils/metricsCalculator';
import { formatDateTimeBR } from '../utils/spreadsheetParser';

interface CallsAuditTableProps {
  records: CallRecord[];
}

const PAGE_SIZE = 25;

export const CallsAuditTable: React.FC<CallsAuditTableProps> = ({ records }) => {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        r.atendente.toLowerCase().includes(q) ||
        r.protocolo.toLowerCase().includes(q) ||
        r.numero.toLowerCase().includes(q) ||
        r.fila.toLowerCase().includes(q) ||
        r.cod.toLowerCase().includes(q)
    );
  }, [records, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <section
      aria-label="Registros individuais importados"
      className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Registros de Chamadas Importados
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Exibindo {filtered.length.toLocaleString('pt-BR')} chamadas filtradas para conferência de datas e durações
          </p>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar protocolo, número, fila..."
            className="h-9 w-64 rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
              <th className="px-4 py-3 whitespace-nowrap">Protocolo</th>
              <th className="px-4 py-3 whitespace-nowrap">Atendente</th>
              <th className="px-4 py-3 whitespace-nowrap">Fila</th>
              <th className="px-4 py-3 whitespace-nowrap">Data da Entrada</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">Duração (MM:SS)</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">Duração (Min)</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">Espera (Seg)</th>
              <th className="px-4 py-3 whitespace-nowrap">Desligamento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {pageItems.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              pageItems.map((r) => (
                <tr
                  key={r.id}
                  className="transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-800/40"
                >
                  <td className="px-4 py-2.5 font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                    {r.protocolo || r.cod || '—'}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                    {r.atendente}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{r.fila}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                    {r.dataEntrada ? formatDateTimeBR(r.dataEntrada) : r.dataEntradaRaw || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-800 dark:text-slate-200 tabular-nums">
                    {r.duracaoFormatted}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {r.duracaoMinutes !== null ? `${formatDecimalBR(r.duracaoMinutes, 2)} m` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                    {r.esperaSeconds !== null ? `${r.esperaSeconds} s` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">
                    {r.desligamento}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
          <span className="tabular-nums">
            Página {safePage} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Anterior
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Próxima
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
