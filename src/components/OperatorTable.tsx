import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  FileSpreadsheet,
  Search,
} from 'lucide-react';
import type { OperatorMetrics } from '../types/callCenter';
import { formatDecimalBR } from '../utils/metricsCalculator';

interface OperatorTableProps {
  operators: OperatorMetrics[];
  teamAvgTmaMinutes: number;
  onExportXLSX: () => void;
  onExportCSV: () => void;
}

type SortKey =
  | 'operator'
  | 'callCount'
  | 'tmaMinutes'
  | 'peakHour'
  | 'avgWaitSeconds';

export const OperatorTable: React.FC<OperatorTableProps> = ({
  operators,
  teamAvgTmaMinutes,
  onExportXLSX,
  onExportCSV,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>('tmaMinutes');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'operator' ? 'asc' : 'desc');
    }
  };

  const rows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const filtered = q
      ? operators.filter((o) => o.operator.toLowerCase().includes(q))
      : operators;

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'operator') {
        cmp = a.operator.localeCompare(b.operator, 'pt-BR');
      } else if (sortKey === 'callCount') {
        cmp = a.callCount - b.callCount;
      } else if (sortKey === 'tmaMinutes') {
        cmp = a.tmaMinutes - b.tmaMinutes;
      } else if (sortKey === 'peakHour') {
        cmp = (a.peakHour ?? -1) - (b.peakHour ?? -1);
      } else if (sortKey === 'avgWaitSeconds') {
        cmp = a.avgWaitSeconds - b.avgWaitSeconds;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [operators, searchTerm, sortKey, sortDir]);

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
    );
  };

  return (
    <section
      aria-label="Tabela detalhada por operador"
      className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 p-5 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Desempenho Detalhado por Operador
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Clique nos cabeçalhos para ordenar · Média da equipe:{' '}
            <span className="font-mono font-medium text-slate-700 dark:text-slate-300 tabular-nums">
              {formatDecimalBR(teamAvgTmaMinutes, 2)} min
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar operador na tabela..."
              className="h-9 w-56 rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <button
            type="button"
            onClick={onExportXLSX}
            disabled={operators.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-40 dark:bg-emerald-600 dark:hover:bg-emerald-500 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Exportar XLSX
          </button>
          <button
            type="button"
            onClick={onExportCSV}
            disabled={operators.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
              <th className="px-5 py-3">
                <button
                  type="button"
                  onClick={() => handleSort('operator')}
                  className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap"
                >
                  Operador
                  {renderSortIcon('operator')}
                </button>
              </th>
              <th className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => handleSort('callCount')}
                  className="inline-flex items-center justify-end gap-1.5 hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap"
                >
                  Qtd. Chamadas
                  {renderSortIcon('callCount')}
                </button>
              </th>
              <th className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => handleSort('tmaMinutes')}
                  className="inline-flex items-center justify-end gap-1.5 hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap"
                >
                  TMA (Minutos)
                  {renderSortIcon('tmaMinutes')}
                </button>
              </th>
              <th className="px-4 py-3 text-right">
                <span className="whitespace-nowrap">TMA (MM:SS)</span>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort('peakHour')}
                  className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap"
                >
                  Horário de Pico Individual
                  {renderSortIcon('peakHour')}
                </button>
              </th>
              <th className="px-5 py-3 text-right">
                <button
                  type="button"
                  onClick={() => handleSort('avgWaitSeconds')}
                  className="inline-flex items-center justify-end gap-1.5 hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap"
                >
                  Espera Média
                  {renderSortIcon('avgWaitSeconds')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  Nenhum operador corresponde aos filtros atuais.
                </td>
              </tr>
            ) : (
              rows.map((op) => {
                const isAboveAvg = op.tmaMinutes > teamAvgTmaMinutes;
                return (
                  <tr
                    key={op.operator}
                    className="transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">
                      <div className="flex items-baseline justify-between gap-2">
                        <span>{op.operator}</span>
                        <span className="font-mono text-[11px] font-normal text-slate-400 dark:text-slate-500 tabular-nums">
                          {formatDecimalBR(op.sharePercent, 1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-800 dark:text-slate-200 tabular-nums">
                      {op.callCount.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      <span
                        className={`font-semibold ${
                          isAboveAvg
                            ? 'text-blue-800 dark:text-blue-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {formatDecimalBR(op.tmaMinutes, 2)} min
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                      {op.tmaFormatted}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300 tabular-nums">
                      <span>{op.peakHourLabel}</span>
                      {op.peakHourCalls > 0 && (
                        <span className="ml-2 text-slate-400 dark:text-slate-500">
                          ({op.peakHourCalls} cham.)
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                      {formatDecimalBR(op.avgWaitSeconds, 1)} s{' '}
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        ({op.avgWaitFormatted})
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
