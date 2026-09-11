'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import type { IADashboardLayout, IADashboardWidget } from '@/types/ia';
import { normalizeWidgetData } from '@/lib/ia/kpi-board-shared';

interface Props {
  layout: IADashboardLayout;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function GenerativeDashboard({ layout }: Props) {
  if (!layout || !layout.widgets || layout.widgets.length === 0) return null;

  const columns = layout.columns || (layout.widgets.length > 2 ? 3 : layout.widgets.length);

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="grid gap-4 mt-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      style={{ 
        gridTemplateColumns: columns > 1 ? `repeat(${columns}, minmax(0, 1fr))` : undefined 
      }}
    >
      {layout.widgets.map((widget) => (
        <motion.div 
          key={widget.id} 
          variants={item}
          className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow ${
            widget.type === 'table' ? 'md:col-span-full' : ''
          }`}
        >
          {widget.title && (
            <div className="px-4 py-2 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{widget.title}</h4>
              <Info className="w-3 h-3 text-gray-300" />
            </div>
          )}
          <div className="p-4">
            {renderWidgetContent(widget)}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-xs text-gray-400 italic text-center py-4 px-2">
      {message}
    </div>
  );
}

function renderWidgetContent(widget: IADashboardWidget) {
  const data = normalizeWidgetData(widget.type, widget.data);

  switch (widget.type) {
    case 'metric':
      return <MetricWidget data={data} />;
    case 'table':
      return <TableWidget data={data} />;
    case 'list':
      return <ListWidget data={data} />;
    case 'chart':
      return <ChartWidget data={data} />;
    case 'markdown':
      return (
        <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap text-xs">
          {typeof data === 'object' && data && 'content' in data
            ? String((data as { content?: string }).content || '') || (
                <span className="text-gray-400 italic">Sem conteúdo</span>
              )
            : String(data ?? '')}
        </div>
      );
    default: {
      const _exhaustive: never = widget.type;
      return <div className="text-xs text-gray-400 italic">Widget não suportado: {String(_exhaustive)}</div>;
    }
  }
}

function ChartWidget({ data }: { data: any }) {
  if (!data) return <EmptyState message="Sem dados para o gráfico" />;
  const { type, items, height = 200, emptyMessage, error } = data;
  if (error && (!items || items.length === 0)) {
    return <EmptyState message={String(error)} />;
  }
  if (!items || items.length === 0) {
    return <EmptyState message={emptyMessage || 'Sem dados para o gráfico'} />;
  }

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        {type === 'bar' ? (
          <BarChart data={items} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              itemStyle={{ fontSize: '10px' }}
            />
            <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : type === 'pie' ? (
          <PieChart>
            <Pie
              data={items}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={60}
              paddingAngle={5}
              dataKey="value"
            >
              {items.map((_: any, index: number) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        ) : (
          <LineChart data={items} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              itemStyle={{ fontSize: '10px' }}
            />
            <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function MetricWidget({ data }: { data: any }) {
  if (!data) return <EmptyState message="Sem dados" />;
  const { value, label, change, trend, unit, action, error, empty } = data;
  if (error && (value === undefined || value === null || value === '—')) {
    return <EmptyState message={String(error)} />;
  }
  if (empty && (value === undefined || value === null || value === '—') && !label) {
    return <EmptyState message="Sem dados" />;
  }
  const isPositive = trend === 'up';
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-900 tracking-tight">
          {value !== undefined && value !== null && value !== '' ? String(value) : '—'}
        </span>
        {unit && <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{unit}</span>}
      </div>
      <div className="flex items-center justify-between mt-1 mb-2">
        <span className="text-[11px] font-medium text-gray-500 truncate">
          {label || (empty ? 'Sem dados' : '')}
        </span>
        {change && (
          <div className={`flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
            isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}>
            {isPositive ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
            {change}
          </div>
        )}
      </div>
      {action && (
        <button 
          onClick={() => {
            window.dispatchEvent(new CustomEvent('ia-dashboard-action', { 
              detail: { type: 'metric_action', action: action.type, value: action.value } 
            }));
          }}
          className="mt-auto flex items-center justify-center gap-2 w-full py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[10px] font-bold transition-all border border-blue-100 hover:border-blue-200"
        >
          {action.label}
          <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function TableWidget({ data }: { data: any }) {
  if (!data) return <EmptyState message="Sem dados para exibir" />;
  const { columns, rows, actions, emptyMessage, error } = data;
  if (error && (!rows || rows.length === 0)) {
    return <EmptyState message={String(error)} />;
  }
  if (!columns || !rows || rows.length === 0) {
    return <EmptyState message={emptyMessage || 'Sem dados para exibir'} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/30">
            {columns.map((col: any) => (
              <th key={col.key} className="py-3 px-3 font-bold text-gray-500 uppercase tracking-wider first:rounded-tl-xl last:rounded-tr-xl">
                {col.label}
              </th>
            ))}
            {actions && <th className="py-3 px-3 font-bold text-gray-500 uppercase tracking-wider text-right last:rounded-tr-xl">Ações</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row: any, i: number) => (
            <tr key={i} className="group hover:bg-blue-50/30 transition-all">
              {columns.map((col: any) => (
                <td key={col.key} className="py-3 px-3 whitespace-nowrap text-gray-700">
                  {renderTableCell(row[col.key], col.type)}
                </td>
              ))}
              {actions && (
                <td className="py-2 px-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    {actions.map((act: any, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('ia-dashboard-action', { 
                            detail: { type: 'table_action', action: act.type, rowId: row.id || i, rowData: row } 
                          }));
                        }}
                        className={`p-1.5 rounded-lg transition-all ${
                          act.color === 'danger' 
                            ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' 
                            : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                        }`}
                        title={act.label}
                      >
                        {act.icon === 'check' ? <CheckCircle2 className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderTableCell(value: any, type?: string) {
  if (type === 'status') {
    const statusMap: Record<string, { label: string, color: string, icon?: React.ReactNode }> = {
      'PENDING': { label: 'Pendente', color: 'bg-amber-50 text-amber-700 border-amber-100' },
      'PENDING_LEADER': { label: 'Aguardando Líder', color: 'bg-amber-50 text-amber-700 border-amber-100' },
      'PENDING_MANAGER': { label: 'Aguardando Gerente', color: 'bg-orange-50 text-orange-700 border-orange-100' },
      'APPROVED': { label: 'Aprovado', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
      'REJECTED': { label: 'Recusado', color: 'bg-rose-50 text-rose-700 border-rose-100' },
      'CANCELLED': { label: 'Cancelado', color: 'bg-gray-50 text-gray-500 border-gray-100' },
      'ACTIVE': { label: 'Ativo', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
      'INACTIVE': { label: 'Inativo', color: 'bg-gray-50 text-gray-400 border-gray-100' },
      'COMPLETED': { label: 'Concluído', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
      'IN_PROGRESS': { label: 'Em Andamento', color: 'bg-sky-50 text-sky-700 border-sky-100' },
      'pendente': { label: 'Pendente', color: 'bg-amber-50 text-amber-700 border-amber-100' },
      'aprovado': { label: 'Aprovado', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
      'recusado': { label: 'Recusado', color: 'bg-rose-50 text-rose-700 border-rose-100' },
    };

    const val = String(value).toUpperCase();
    const config = statusMap[value] || statusMap[val] || { label: value, color: 'bg-gray-50 text-gray-600 border-gray-100' };

    return (
      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${config.color} whitespace-nowrap inline-flex items-center gap-1.5 shadow-sm`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {config.label}
      </span>
    );
  }
  
  if (type === 'currency') {
    return (
      <span className="font-mono font-bold text-gray-900 tracking-tight">
        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))}
      </span>
    );
  }

  if (type === 'date') {
    return (
      <div className="flex items-center gap-2 text-gray-600 font-medium">
        <Clock className="w-3.5 h-3.5 text-gray-400" />
        <span>{new Date(value).toLocaleDateString('pt-BR')}</span>
      </div>
    );
  }

  if (type === 'progress') {
    const val = Number(value || 0);
    const colorClass = val >= 100 ? 'bg-emerald-500' : val >= 50 ? 'bg-blue-500' : 'bg-amber-500';
    return (
      <div className="flex items-center gap-3 min-w-[100px]">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(val, 100)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={`h-full ${colorClass} rounded-full`} 
          />
        </div>
        <span className="text-[10px] font-bold text-gray-700">{val}%</span>
      </div>
    );
  }

  return <span className="font-medium text-gray-700">{String(value ?? '')}</span>;
}

function ListWidget({ data }: { data: any }) {
  if (!data) return <EmptyState message="Nenhum item" />;
  const { items, emptyMessage, error } = data;
  if (error && (!items || items.length === 0)) {
    return <EmptyState message={String(error)} />;
  }
  if (!items || items.length === 0) {
    return <EmptyState message={emptyMessage || 'Nenhum item'} />;
  }

  return (
    <div className="space-y-3">
      {items.map((listItem: any, i: number) => {
        const title = String(
          listItem.title || listItem.label || listItem.name || listItem.assunto || 'Item'
        );
        const subtitle = String(
          listItem.subtitle || listItem.value || listItem.description || listItem.de || ''
        );
        return (
          <div key={listItem.id ?? i} className="flex items-center gap-4 p-3 rounded-xl hover:bg-blue-50/50 border border-transparent hover:border-blue-100 transition-all group">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
              listItem.status === 'urgent' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
            }`}>
              {listItem.status === 'urgent' ? <AlertCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="text-xs font-bold text-gray-900 truncate tracking-tight">{title}</h5>
              {subtitle ? (
                <p className="text-[11px] font-medium text-gray-500 truncate mt-0.5">{subtitle}</p>
              ) : null}
            </div>
            <button 
              onClick={() => {
                window.dispatchEvent(new CustomEvent('ia-dashboard-action', { 
                  detail: { type: 'list_action', itemId: listItem.id || i, itemData: listItem } 
                }));
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-300 group-hover:text-blue-600 group-hover:bg-white transition-all shadow-sm"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
