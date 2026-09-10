'use client';

import React from 'react';
import type { IAChatMessage } from '@/types/ia';
import GenerativeDashboard from './GenerativeDashboard';
import { renderChatMarkdown, stripReasoningBlocks } from './chatMarkdown';

interface Props {
  message: IAChatMessage;
  isStreaming?: boolean;
}

export default function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.role === 'user';
  if (message.role === 'system') return null;

  // Extrair dashboard da metadata
  const dashboard = message.metadata?.dashboard;
  const cleanContent = isUser ? message.content : stripReasoningBlocks(message.content);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <div className="flex-shrink-0 mr-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
            <span className="text-white text-xs font-bold">IA</span>
          </div>
        </div>
      )}
      <div className="max-w-[85%] w-full flex flex-col items-start">
        <div className={`rounded-2xl px-4 py-3 w-fit max-w-full min-w-0 ${
          isUser
            ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-br-md shadow-md ml-auto'
            : 'bg-white text-gray-800 rounded-bl-md shadow-sm border border-gray-100'
        }`}>
          <div className="text-sm leading-relaxed min-w-0">
            {isUser ? cleanContent : renderChatMarkdown(cleanContent)}
            {isStreaming && <span className="inline-block w-2 h-4 bg-blue-500 ml-0.5 animate-pulse rounded-sm align-middle" />}
          </div>
        </div>

        {/* Dashboard Generativo */}
        {!isUser && dashboard && (
          <div className="w-full">
            <GenerativeDashboard layout={dashboard} />
          </div>
        )}

        {/* Status Profissional */}
        {!isUser && message.status && (
          <div className="flex items-center gap-2 mt-2 px-1 text-[10px] text-blue-500 font-medium italic animate-pulse">
            <div className="w-1 h-1 bg-blue-500 rounded-full" />
            {message.status}
          </div>
        )}
        <div className={`flex items-center gap-2 mt-1 px-1 ${isUser ? 'justify-end' : ''}`}>
          <span className="text-[10px] text-gray-400">
            {new Date(message.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {message.response_time_ms && !isUser && (
            <span className="text-[10px] text-gray-300">{(message.response_time_ms / 1000).toFixed(1)}s</span>
          )}
        </div>
      </div>
      {isUser && (
        <div className="flex-shrink-0 ml-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
            <span className="text-white text-xs font-bold">EU</span>
          </div>
        </div>
      )}
    </div>
  );
}
