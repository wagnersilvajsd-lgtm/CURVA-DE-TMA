import React from 'react';
import type {CategoryMetric, SegmentFilter} from '../types/operations';
import {formatTma} from '../utils/analytics';

interface ChannelQueueBreakdownProps {
  queues: CategoryMetric[];
  chatbotSources: CategoryMetric[];
  disconnects: CategoryMetric[];
  surveyBreakdown: CategoryMetric[];
  segmentFilter: SegmentFilter;
  selectedQueue: string;
  onSelectQueue: (queue: string) => void;
}

export const ChannelQueueBreakdown: React.FC<ChannelQueueBreakdownProps> = ({
  queues,
  chatbotSources,
  disconnects,
  surveyBreakdown,
  segmentFilter,
  selectedQueue,
  onSelectQueue,
}) => {
  const maxQueueCount = Math.max(1, ...queues.map((q) => q.count));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Filas de Atendimento */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-6">
        <div className="flex items-baseline justify-between border-b border-slate-200 pb-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Filas de Atendimento
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Volume e TMA por fila · Clique para filtrar o painel
            </p>
          </div>
          {selectedQueue !== 'all' && (
            <button
              type="button"
              onClick={() => onSelectQueue('all')}
              className="text-xs font-medium text-blue-700 hover:underline cursor-pointer whitespace-nowrap"
            >
              Mostrar todas
            </button>
          )}
        </div>

        {queues.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">Nenhuma fila registrada.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {queues.map((q) => {
              const isSelected = selectedQueue === q.name;
              const widthPct = Math.max(4, (q.count / maxQueueCount) * 100);
              return (
                <button
                  key={q.name}
                  type="button"
                  onClick={() => onSelectQueue(isSelected ? 'all' : q.name)}
                  className={`block w-full rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/40'
                      : 'border-slate-100 bg-slate-50/40 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-slate-900">{q.name}</span>
                    <span className="shrink-0 font-mono text-slate-700 tabular-nums">
                      {q.count} ({q.sharePercent.toFixed(1)}%) · TMA {formatTma(q.tmaSeconds)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
                    <div
                      className="h-full rounded-full bg-blue-700"
                      style={{width: `${widthPct}%`}}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Column: Chat Origem Chatbot + Voice Pesquisa & Desligamento */}
      <div className="space-y-6 lg:col-span-6">
        {/* CHATBOT Origin (Chat specific) */}
        {segmentFilter !== 'voice' && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Origem Chatbot (Segmento Chat)
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Comparativo de entrada entre Site do Produto, WhatsApp e outros canais
              </p>
            </div>

            {chatbotSources.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                Nenhum registro de Chat encontrado no filtro atual.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {chatbotSources.map((src) => (
                  <div key={src.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-900">{src.name}</span>
                      <span className="font-mono text-slate-700 tabular-nums">
                        {src.count} chats ({src.sharePercent.toFixed(1)}%) · TMA {formatTma(src.tmaSeconds)}
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-teal-600"
                        style={{width: `${Math.max(4, src.sharePercent)}%`}}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Desligamento & Pesquisa (Voice) */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Desligamento e Pesquisa de Satisfação
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Responsável pelo encerramento {segmentFilter !== 'chat' ? 'e transferência para pesquisa (Voice)' : ''}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold text-slate-700">Desligamento</h3>
              <div className="mt-2.5 divide-y divide-slate-100 text-xs">
                {disconnects.map((item) => (
                  <div key={item.name} className="flex items-center justify-between py-2 tabular-nums">
                    <span className="truncate text-slate-700">{item.name}</span>
                    <span className="font-mono font-medium text-slate-900">
                      {item.count} ({item.sharePercent.toFixed(0)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {segmentFilter !== 'chat' && (
              <div>
                <h3 className="text-xs font-semibold text-slate-700">Transferência p/ Pesquisa (Voice)</h3>
                {surveyBreakdown.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">Sem registros Voice.</p>
                ) : (
                  <div className="mt-2.5 divide-y divide-slate-100 text-xs">
                    {surveyBreakdown.map((item) => (
                      <div key={item.name} className="flex items-center justify-between py-2 tabular-nums">
                        <span className="truncate text-slate-700">{item.name}</span>
                        <span className="font-mono font-medium text-slate-900">
                          {item.count} ({item.sharePercent.toFixed(0)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
