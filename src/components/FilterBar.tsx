import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  ChevronDown,
  Layers,
  RotateCcw,
  Search,
  Users,
  X,
} from 'lucide-react';
import type { FilterState } from '../types/callCenter';

interface FilterBarProps {
  operators: string[];
  queues: string[];
  minDate: string;
  maxDate: string;
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onReset: () => void;
  totalRecords: number;
  filteredRecords: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  operators,
  queues,
  minDate,
  maxDate,
  filters,
  onChange,
  onReset,
  totalRecords,
  filteredRecords,
}) => {
  const [opOpen, setOpOpen] = useState(false);
  const [opSearch, setOpSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOperatorList = useMemo(() => {
    const q = opSearch.trim().toLowerCase();
    if (!q) return operators;
    return operators.filter((op) => op.toLowerCase().includes(q));
  }, [operators, opSearch]);

  const isAllOperators = filters.selectedOperators.length === 0;

  const toggleOperator = (op: string) => {
    const exists = filters.selectedOperators.includes(op);
    const next = exists
      ? filters.selectedOperators.filter((item) => item !== op)
      : [...filters.selectedOperators, op];
    onChange({ ...filters, selectedOperators: next });
  };

  const selectAllOperators = () => {
    onChange({ ...filters, selectedOperators: [] });
  };

  const operatorLabel = useMemo(() => {
    if (isAllOperators) return 'Todos os Operadores';
    if (filters.selectedOperators.length === 1) return filters.selectedOperators[0];
    return `${filters.selectedOperators.length} operadores selecionados`;
  }, [isAllOperators, filters.selectedOperators]);

  const hasActiveFilters =
    filters.selectedOperators.length > 0 ||
    filters.selectedQueue !== 'ALL' ||
    (minDate && filters.startDate !== minDate) ||
    (maxDate && filters.endDate !== maxDate);

  return (
    <section
      aria-label="Filtros operacionais"
      className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12 xl:items-end">
        {/* Operator Multi-Select with Internal Search */}
        <div className="relative xl:col-span-4" ref={dropdownRef}>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Users className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            Operador (Atendente)
          </label>
          <button
            type="button"
            onClick={() => setOpOpen((prev) => !prev)}
            aria-expanded={opOpen}
            className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 text-left text-sm text-slate-900 transition-colors hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-600"
          >
            <span className="truncate font-medium">{operatorLabel}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {!isAllOperators && (
                <span className="font-mono text-xs text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {filters.selectedOperators.length}/{operators.length}
                </span>
              )}
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform ${
                  opOpen ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>

          {opOpen && (
            <div className="absolute left-0 top-full z-40 mt-1.5 w-full min-w-[280px] rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
              <div className="border-b border-slate-100 p-2.5 dark:border-slate-800">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={opSearch}
                    onChange={(e) => setOpSearch(e.target.value)}
                    placeholder="Buscar operador..."
                    autoFocus
                    className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-7 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-emerald-500"
                  />
                  {opSearch && (
                    <button
                      type="button"
                      onClick={() => setOpSearch('')}
                      aria-label="Limpar busca de operador"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto p-1.5">
                <button
                  type="button"
                  onClick={selectAllOperators}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-colors ${
                    isAllOperators
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>Todos os Operadores ({operators.length})</span>
                  {isAllOperators && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                </button>

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                {filteredOperatorList.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                    Nenhum operador encontrado
                  </p>
                ) : (
                  filteredOperatorList.map((op) => {
                    const checked = filters.selectedOperators.includes(op);
                    return (
                      <button
                        key={op}
                        type="button"
                        onClick={() => toggleOperator(op)}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                          checked
                            ? 'bg-slate-100 font-medium text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                            : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                              checked
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-950'
                            }`}
                          >
                            {checked && <Check className="h-3 w-3 stroke-[2.5]" />}
                          </span>
                          <span className="truncate">{op}</span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {!isAllOperators && (
                <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs dark:border-slate-800">
                  <button
                    type="button"
                    onClick={selectAllOperators}
                    className="font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    Marcar todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpOpen(false)}
                    className="font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                  >
                    Aplicar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Date Start */}
        <div className="xl:col-span-2">
          <label
            htmlFor="filter-start-date"
            className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            <Calendar className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            Data Inicial
          </label>
          <input
            id="filter-start-date"
            type="date"
            value={filters.startDate}
            min={minDate || undefined}
            max={filters.endDate || maxDate || undefined}
            onChange={(e) => onChange({ ...filters, startDate: e.target.value })}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-emerald-500"
          />
        </div>

        {/* Date End */}
        <div className="xl:col-span-2">
          <label
            htmlFor="filter-end-date"
            className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            <Calendar className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            Data Final
          </label>
          <input
            id="filter-end-date"
            type="date"
            value={filters.endDate}
            min={filters.startDate || minDate || undefined}
            max={maxDate || undefined}
            onChange={(e) => onChange({ ...filters, endDate: e.target.value })}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 tabular-nums focus:border-emerald-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-emerald-500"
          />
        </div>

        {/* Queue Select */}
        <div className="xl:col-span-2">
          <label
            htmlFor="filter-queue"
            className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            <Layers className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            Fila de Atendimento
          </label>
          <select
            id="filter-queue"
            value={filters.selectedQueue}
            onChange={(e) => onChange({ ...filters, selectedQueue: e.target.value })}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-emerald-500"
          >
            <option value="ALL">Todas ({queues.length})</option>
            {queues.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </div>

        {/* Summary & Reset */}
        <div className="flex items-center justify-between gap-3 xl:col-span-2 xl:justify-end">
          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {filteredRecords.toLocaleString('pt-BR')}
            </span>{' '}
            de {totalRecords.toLocaleString('pt-BR')} registros
          </div>
          <button
            type="button"
            onClick={onReset}
            disabled={!hasActiveFilters}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Limpar
          </button>
        </div>
      </div>
    </section>
  );
};
