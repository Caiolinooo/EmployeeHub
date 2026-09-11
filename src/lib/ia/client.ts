/**
 * Cliente LLM compatível com OpenAI API (LM Studio)
 * Suporta respostas normais e streaming via SSE
 */
import type {
  IAConfig,
  LLMMessage,
  LLMCompletionRequest,
  LLMCompletionResponse,
} from '@/types/ia';
import { supabaseAdmin } from '@/lib/supabase';
import { IA_TOOLS_DEFINITION, executeToolCall } from './tools';
import { routeToSubAgent, sanitizeToolsForLLM } from './agents-router';

// Cache da config para evitar queries repetidas
let configCache: IAConfig | null = null;
let configCacheTime = 0;
const CONFIG_CACHE_TTL = 60_000; // 1 minuto

/**
 * Lê o body da Response e faz parse JSON com erro legível quando o endpoint devolve HTML.
 */
async function parseJsonResponse<T = unknown>(response: Response, context: string): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error(`${context}: resposta vazia do servidor.`);
  }

  const looksLikeHtml =
    contentType.includes('text/html') ||
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html');

  if (looksLikeHtml) {
    throw new Error(
      `${context}: o endpoint retornou uma página HTML em vez de JSON. ` +
      'Verifique a URL da API da IA no painel admin (deve ser o endpoint /v1, não a interface web).'
    );
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const preview = trimmed.slice(0, 120).replace(/\s+/g, ' ');
    throw new Error(`${context}: resposta inválida (não é JSON). Preview: ${preview}`);
  }
}

/**
 * Buscar configuração ativa da IA do banco
 */
export async function getIAConfig(): Promise<IAConfig | null> {
  const now = Date.now();
  if (configCache && now - configCacheTime < CONFIG_CACHE_TTL) {
    return configCache;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('ia_config')
      .select('*')
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data && data.endpoint) {
      configCache = data as IAConfig;
      configCacheTime = now;
      return configCache;
    }
  } catch (err) {
    console.error('[IA Client] Erro ao buscar config do banco:', err);
  }

  // Fallback para variáveis de ambiente se a tabela do banco estiver vazia
  const envApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.OPENAI_API_KEY || process.env.IA_API_KEY;
  const envEndpoint = process.env.IA_ENDPOINT || (
    (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
      ? 'https://generativelanguage.googleapis.com/v1beta/openai'
      : (process.env.OPENAI_API_KEY ? 'https://api.openai.com/v1' : '')
  );
  const envModel = process.env.IA_MODEL || (
    (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
      ? 'gemini-2.5-flash'
      : (process.env.OPENAI_API_KEY ? 'gpt-4o-mini' : 'default')
  );

  if (envEndpoint && envApiKey) {
    const envConfig: IAConfig = {
      id: 'env-fallback',
      endpoint: envEndpoint,
      api_key: envApiKey,
      model_default: envModel,
      max_tokens: 8192,
      temperatura: 0.7,
      system_prompt: '',
      ativo: true,
      provider: (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) ? 'gemini' : 'openai',
      provider_settings: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    configCache = envConfig;
    configCacheTime = now;
    return configCache;
  }

  return null;
}

/**
 * Invalidar cache de config (após update via admin)
 */
export function invalidateConfigCache(): void {
  configCache = null;
  configCacheTime = 0;
}

/**
 * Resolver o modelo correto com fallback para o provedor
 */
export function resolveModel(requestedModel?: string, configModel?: string, provider?: string): string {
  if (requestedModel && requestedModel !== 'default' && requestedModel.trim()) return requestedModel.trim();
  if (configModel && configModel !== 'default' && configModel.trim()) return configModel.trim();

  if (provider === 'gemini') return 'gemini-2.5-flash';
  if (provider === 'openai') return 'gpt-4o-mini';
  return 'meta-llama-3-8b';
}

/**
 * Limpar e sanitizar mensagens para compatibilidade estrita com OpenAI / Gemini API
 */
export function sanitizeMessagesForLLM(messages: LLMMessage[]): LLMMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages
    .map((msg) => {
      if (!msg) return null;

      const role = msg.role;
      let rawContent = typeof msg.content === 'string' ? msg.content : (msg.content ? String(msg.content) : '');
      // Prefixo interno de roteamento do Companion — não enviar ao LLM
      if (role === 'user') {
        rawContent = rawContent.replace(/^\[ABZ_COMPANION\]\s*/i, '');
      }

      const cleanMsg: any = {
        role,
        content: rawContent.trim(),
      };

      if (role === 'tool') {
        cleanMsg.tool_call_id = msg.tool_call_id || 'call_0';
        // Sem 'name' no objeto tool para compatibilidade estrita com o Gemini
      }

      if (role === 'assistant' && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
        cleanMsg.tool_calls = msg.tool_calls;
      }

      return cleanMsg as LLMMessage;
    })
    .filter(Boolean) as LLMMessage[];
}

/**
 * Remove blocos de raciocínio interno (<thought>...</thought>, <think>...</think>, <reasoning>...</reasoning>)
 * de modelos de raciocínio como Gemini 2.5, DeepSeek R1 e Llama 3 Thinking.
 */
export function stripReasoningBlocks(text: string): string {
  if (!text) return '';

  let cleaned = text;
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, '');
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
  cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');

  cleaned = cleaned.replace(/<thought>[\s\S]*$/gi, '');
  cleaned = cleaned.replace(/<think>[\s\S]*$/gi, '');
  cleaned = cleaned.replace(/<reasoning>[\s\S]*$/gi, '');

  cleaned = cleaned.replace(/<\/?thought>/gi, '');
  cleaned = cleaned.replace(/<\/?think>/gi, '');
  cleaned = cleaned.replace(/<\/?reasoning>/gi, '');

  return cleaned.trim();
}

/**
 * Enviar mensagens ao LLM e obter resposta completa (sem streaming)
 */
export async function chatCompletion(
  messages: LLMMessage[],
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    signal?: AbortSignal;
    _toolIterations?: number;
    _firstValidContent?: string | null;
    _timeoutMs?: number;
    _accumulatedMetadata?: any;
    onStatus?: (status: string) => void;
  },
  userContext?: { role: string; userId: string }
): Promise<LLMCompletionResponse> {
  const callStartTime = Date.now();
  const config = await getIAConfig();

  if (!config) {
    throw new Error('IA não está configurada. Configure o endpoint e token no painel admin.');
  }

  let rawTools: any[] = [];
  if (userContext) {
    const { getAvailableTools } = await import('./tools');
    const userMsg = messages.filter(m => m.role === 'user').pop()?.content || '';
    const activeSubAgent = routeToSubAgent(userMsg);
    console.log(`[IA Client] Sub-Agente Ativo: ${activeSubAgent.name} (${activeSubAgent.id})`);

    const allTools = await getAvailableTools(userContext.userId, userContext.role);
    const domainTools = allTools.filter((t: any) =>
      t.function && activeSubAgent.toolNames.includes(t.function.name)
    );
    rawTools = domainTools.length > 0 ? domainTools : allTools;
  } else {
    rawTools = IA_TOOLS_DEFINITION;
  }

  const tools = sanitizeToolsForLLM(rawTools);
  const selectedModel = resolveModel(options?.model, config.model_default, config.provider);
  const cleanMessages = sanitizeMessagesForLLM(messages);

  console.log('[IA Client] Modelo:', selectedModel, '| Tools sanitizadas:', tools.length);

  const body: any = {
    model: selectedModel,
    messages: cleanMessages,
    max_tokens: options?.maxTokens || config.max_tokens || 8192,
    temperature: options?.temperature ?? config.temperatura ?? 0.7,
    stream: false,
    tools: tools.length > 0 ? tools : undefined,
    tool_choice: tools.length > 0 ? 'auto' : undefined,
  };

  const controller = new AbortController();
  const timeoutMs = options?._timeoutMs || 240_000;
  const timeout = setTimeout(() => {
    console.log('[IA Client] TIMEOUT ATINGIDO - Abortando requisição');
    controller.abort();
  }, timeoutMs);

  try {
    const combinedSignal = options?.signal 
      ? AbortSignal.any([controller.signal, options.signal]) 
      : controller.signal;

    const baseEndpoint = normalizeEndpoint(config!.endpoint);
    const response = await fetch(`${baseEndpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config!.api_key}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Sem detalhes');
      const preview = errorText.trim().slice(0, 200);
      if (preview.startsWith('<!DOCTYPE') || preview.startsWith('<html')) {
        throw new Error(
          `LLM retornou ${response.status} com HTML. Verifique a URL da API da IA no painel admin.`
        );
      }
      throw new Error(`LLM retornou ${response.status}: ${preview || 'Sem detalhes'}`);
    }

    const data = await parseJsonResponse<LLMCompletionResponse>(response, 'LLM chat/completions');
    if (data.choices?.[0]?.message?.content) {
      data.choices[0].message.content = stripReasoningBlocks(data.choices[0].message.content);
    }
    
    // Multi-tool workflows (pendências → dashboard → abrir KPI) precisam de várias rodadas
    const MAX_TOOL_ITERATIONS = 12;
    const toolIterationCount = options?._toolIterations || 0;
    const firstValidContent = options?._firstValidContent || null;
    
    if (!firstValidContent && data.choices?.[0]?.message?.content?.trim()) {
      options = { ...options, _firstValidContent: data.choices[0].message.content };
    }
    
    const hasToolCalls = data.choices?.[0]?.message?.tool_calls && 
                         Array.isArray(data.choices[0].message.tool_calls) && 
                         data.choices[0].message.tool_calls.length > 0;
    
    if (hasToolCalls && userContext) {
      if (toolIterationCount >= MAX_TOOL_ITERATIONS) {
        const fallbackContent = options?._firstValidContent;
        data.choices[0].message.content = fallbackContent || 'Limite de busca atingido.';
        return data;
      }
      
      const toolCalls = data.choices[0].message.tool_calls ?? [];
      const assistantMessage: LLMMessage = {
        role: 'assistant',
        content: data.choices[0].message.content,
        tool_calls: toolCalls,
      };
      const newMessages: LLMMessage[] = [...messages, assistantMessage];
      let mergedMetadata = options?._accumulatedMetadata || {};
      const { formatToolResultForLLM } = await import('./tool-result-format');
      
      for (const tc of toolCalls) {
          if (options?.onStatus) {
            options.onStatus(`Processando: ${tc.function.name}...`);
          }
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments || '{}');
          } catch {
            args = {};
          }
          const result = await executeToolCall(tc.function.name, args, userContext.role, userContext.userId);
          let toolContent = result;
          try {
            const parsedResult = JSON.parse(result);
            if (parsedResult._metadata) {
              const incoming = parsedResult._metadata;
              // Concatena portalCommands em vez de sobrescrever
              if (Array.isArray(incoming.portalCommands)) {
                const prev = Array.isArray(mergedMetadata.portalCommands)
                  ? mergedMetadata.portalCommands
                  : [];
                mergedMetadata = {
                  ...mergedMetadata,
                  ...incoming,
                  portalCommands: [...prev, ...incoming.portalCommands],
                };
              } else {
                mergedMetadata = { ...mergedMetadata, ...incoming };
              }
            }
            if (tc.function.name === 'render_dashboard') {
              toolContent = JSON.stringify({
                _summary: parsedResult.message || 'Dashboard renderizado.',
                success: parsedResult.success !== false,
                message: parsedResult.message || 'Dashboard renderizado.',
              });
            } else {
              toolContent = formatToolResultForLLM(tc.function.name, result).contentForLlm;
            }
          } catch {
            toolContent = formatToolResultForLLM(tc.function.name, result).contentForLlm;
          }

          newMessages.push({
            role: 'tool',
            content: toolContent,
            tool_call_id: tc.id,
          });
        }
      
      const totalElapsed = Date.now() - callStartTime;
      const remainingTimeout = timeoutMs - totalElapsed;

      return chatCompletion(newMessages, { 
        ...options, 
        _toolIterations: toolIterationCount + 1,
        _firstValidContent: firstValidContent || data.choices[0].message.content,
        _timeoutMs: Math.max(remainingTimeout, 30000),
        _accumulatedMetadata: mergedMetadata,
        onStatus: options?.onStatus
      }, userContext);
    }
    
      // Se terminou e temos metadados acumulados, anexa ao resultado final
      if (options && Object.keys(options._accumulatedMetadata || {}).length > 0) {
        if (data.choices?.[0]?.message) {
          data.choices[0].message.metadata = {
            ...data.choices[0].message.metadata,
            ...options._accumulatedMetadata
          };
        }
      }

    // Fallback: Extração de dashboard "perdido" no texto (caso o modelo não use a tool corretamente)
    if (!data.choices?.[0]?.message?.metadata?.dashboard && data.choices?.[0]?.message?.content) {
      try {
        const content = data.choices[0].message.content;
        const dashboardRegex = /\{[\s\S]*?"dashboard"[\s\S]*?"layout"[\s\S]*?"widgets"[\s\S]*?\}/g;
        const match = content.match(dashboardRegex);
        if (match) {
          const parsed = JSON.parse(match[0]);
          const layout = parsed.dashboard?.layout || parsed.layout;
          if (layout && layout.widgets) {
            data.choices[0].message.metadata = {
              ...data.choices[0].message.metadata,
              dashboard: layout
            };
            // Remove o JSON do texto para não poluir a interface
            data.choices[0].message.content = content.replace(match[0], '').replace(/```json|```/g, '').trim();
          }
        }
      } catch { /* ignore */ }
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Enviar mensagens ao LLM e obter resposta via streaming (SSE)
 */
export async function chatCompletionStream(
  messages: LLMMessage[],
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    signal?: AbortSignal;
    onStatus?: (status: string) => void;
  },
  userContext?: { role: string; userId: string }
): Promise<ReadableStream<Uint8Array>> {
  const config = await getIAConfig();
  if (!config) {
    throw new Error('IA não está configurada.');
  }

  let rawTools: any[] = [];
  if (userContext) {
    const { getAvailableTools } = await import('./tools');
    const userMsg = messages.filter(m => m.role === 'user').pop()?.content || '';
    const activeSubAgent = routeToSubAgent(userMsg);
    console.log(`[IA Stream] Sub-Agente Ativo: ${activeSubAgent.name} (${activeSubAgent.id})`);

    const allTools = await getAvailableTools(userContext.userId, userContext.role);
    const domainTools = allTools.filter((t: any) =>
      t.function && activeSubAgent.toolNames.includes(t.function.name)
    );
    rawTools = domainTools.length > 0 ? domainTools : allTools;
  } else {
    rawTools = IA_TOOLS_DEFINITION;
  }

  const tools = sanitizeToolsForLLM(rawTools);
  const selectedModel = resolveModel(options?.model, config!.model_default, config!.provider);
  const cleanMessages = sanitizeMessagesForLLM(messages);

  console.log('[IA Stream] Modelo:', selectedModel, '| Tools sanitizadas:', tools.length);

  const body: any = {
    model: selectedModel,
    messages: cleanMessages,
    max_tokens: options?.maxTokens || config!.max_tokens || 8192,
    temperature: options?.temperature ?? config!.temperatura ?? 0.7,
    stream: true,
    tools: tools.length > 0 ? tools : undefined,
    tool_choice: tools.length > 0 ? 'auto' : undefined,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 240_000);

  const combinedSignal = options?.signal 
    ? AbortSignal.any([controller.signal, options.signal]) 
    : controller.signal;

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let fullContent = '';
  let fullReasoning = '';
  let insideThinkBlock = false;
  let pendingText = '';
  let accumulatedMetadata: any = {};


  function findPartialOpenTag(text: string): number {
    const tag = '<think>';
    for (let len = Math.min(tag.length - 1, text.length); len > 0; len--) {
      if (text.endsWith(tag.slice(0, len))) return len;
    }
    return 0;
  }

  function processContentDelta(delta: string): string {
    let result = '';
    let remaining = pendingText + delta;
    pendingText = '';

    while (remaining.length > 0) {
      if (insideThinkBlock) {
        const closeIdx = remaining.indexOf('</think>');
        if (closeIdx === -1) {
          fullReasoning += remaining;
          remaining = '';
        } else {
          fullReasoning += remaining.slice(0, closeIdx);
          insideThinkBlock = false;
          remaining = remaining.slice(closeIdx + 8);
        }
      } else {
        const openIdx = remaining.indexOf('<think>');
        if (openIdx === -1) {
          const partialLen = findPartialOpenTag(remaining);
          if (partialLen > 0) {
            result += remaining.slice(0, remaining.length - partialLen);
            pendingText = remaining.slice(remaining.length - partialLen);
            remaining = '';
          } else {
            result += remaining;
            remaining = '';
          }
        } else {
          result += remaining.slice(0, openIdx);
          insideThinkBlock = true;
          remaining = remaining.slice(openIdx + 7);
        }
      }
    }
    return result;
  }

  let toolIterationCount = 0;
  const MAX_TOOL_ITERATIONS = 10;

  async function startStream(currentMessages: LLMMessage[], streamController: ReadableStreamDefaultController<Uint8Array>) {
    if (toolIterationCount >= MAX_TOOL_ITERATIONS) {
      const event = `data: ${JSON.stringify({ content: 'Limite de busca atingido.', done: true })}\n\n`;
      streamController.enqueue(encoder.encode(event));
      streamController.close();
      return;
    }

    const baseEndpoint = normalizeEndpoint(config!.endpoint);
    const response = await fetch(`${baseEndpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config!.api_key}`,
      },
      body: JSON.stringify({
        ...body,
        messages: currentMessages,
      }),
      signal: combinedSignal,
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => 'Sem detalhes');
      const preview = errorText.trim().slice(0, 200);
      if (preview.startsWith('<!DOCTYPE') || preview.startsWith('<html')) {
        throw new Error(
          `LLM retornou ${response.status} com HTML. Verifique a URL da API da IA no painel admin.`
        );
      }
      throw new Error(`LLM retornou ${response.status}: ${preview || 'Sem detalhes'}`);
    }

    const responseContentType = response.headers.get('content-type') || '';
    if (responseContentType.includes('text/html')) {
      throw new Error(
        'LLM retornou HTML em modo stream. Verifique a URL da API da IA no painel admin (deve ser o endpoint /v1).'
      );
    }

    const reader = response.body.getReader();
    let currentFullContent = '';
    let isToolCallMode = false;
    let pendingToolCalls: { id: string; name: string; arguments: string }[] = [];
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.slice(6).trim();
        if (dataStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(dataStr);
          const delta = parsed.choices?.[0]?.delta;
          
          if (delta?.tool_calls) {
            isToolCallMode = true;
            for (const tc of delta.tool_calls) {
              if (tc.id && tc.function?.name) {
                pendingToolCalls.push({
                  id: tc.id,
                  name: tc.function.name,
                  arguments: tc.function.arguments || ''
                });
              } else if (tc.function?.arguments) {
                if (pendingToolCalls.length > 0) {
                  pendingToolCalls[pendingToolCalls.length - 1].arguments += tc.function.arguments;
                }
              }
            }
            continue;
          }

          if (delta?.content !== undefined && delta?.content !== null) {
            const rawContent = delta.content;
            const cleanContent = processContentDelta(rawContent);
            if (cleanContent) {
              currentFullContent += cleanContent;
              fullContent += cleanContent;
              const event = `data: ${JSON.stringify({ content: cleanContent, done: false })}\n\n`;
              streamController.enqueue(encoder.encode(event));
            }
          }
        } catch { /* skip */ }
      }
    }

    if (isToolCallMode && pendingToolCalls.length > 0) {
      toolIterationCount++;
      const nextMessages = [...currentMessages, { role: 'assistant', tool_calls: pendingToolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: tc.arguments }
      })) }];

      for (const tc of pendingToolCalls) {
        const event = `data: ${JSON.stringify({ status: `Executando: ${tc.name}...` })}\n\n`;
        streamController.enqueue(encoder.encode(event));

        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.arguments || '{}');
        } catch {
          args = {};
        }
        const rawResult = await executeToolCall(tc.name, args, userContext?.role || 'USER', userContext?.userId || '');
        const { formatToolResultForLLM } = await import('./tool-result-format');
        
        let toolContent = rawResult;
        try {
          const parsedResult = JSON.parse(rawResult);
          if (parsedResult._metadata) {
            const incoming = parsedResult._metadata;
            if (Array.isArray(incoming.portalCommands)) {
              const prev = Array.isArray(accumulatedMetadata.portalCommands)
                ? accumulatedMetadata.portalCommands
                : [];
              accumulatedMetadata = {
                ...accumulatedMetadata,
                ...incoming,
                portalCommands: [...prev, ...incoming.portalCommands],
              };
            } else {
              accumulatedMetadata = { ...accumulatedMetadata, ...incoming };
            }
          }
          if (tc.name === 'render_dashboard') {
            toolContent = JSON.stringify({
              _summary: parsedResult.message || 'Dashboard renderizado.',
              success: parsedResult.success !== false,
              message: parsedResult.message || 'Dashboard renderizado.',
            });
          } else {
            toolContent = formatToolResultForLLM(tc.name, rawResult).contentForLlm;
          }
        } catch {
          toolContent = formatToolResultForLLM(tc.name, rawResult).contentForLlm;
        }

        nextMessages.push({
          role: 'tool',
          content: toolContent,
          tool_call_id: tc.id,
        } as any);
      }

       // Envia metadados acumulados se houver
      if (Object.keys(accumulatedMetadata).length > 0) {
        const metaEvent = `data: ${JSON.stringify({ metadata: accumulatedMetadata })}\n\n`;
        streamController.enqueue(encoder.encode(metaEvent));
      }

      await startStream(nextMessages as LLMMessage[], streamController);
    } else {
      let finalDashboard = accumulatedMetadata.dashboard;
      
      // Fallback para streaming: tenta extrair se não veio via tool
      if (!finalDashboard && fullContent) {
        try {
          const dashboardRegex = /\{[\s\S]*?"dashboard"[\s\S]*?"layout"[\s\S]*?"widgets"[\s\S]*?\}/g;
          const match = fullContent.match(dashboardRegex);
          if (match) {
            const parsed = JSON.parse(match[0]);
            finalDashboard = parsed.dashboard?.layout || parsed.layout;
            if (finalDashboard && finalDashboard.widgets) {
              accumulatedMetadata.dashboard = finalDashboard;
              fullContent = fullContent.replace(match[0], '').replace(/```json|```/g, '').trim();
            }
          }
        } catch { /* ignore */ }
      }

      const cleanFullContent = stripReasoningBlocks(fullContent);

      const finalEvent = `data: ${JSON.stringify({ 
        done: true, 
        fullContent: cleanFullContent, 
        metadata: Object.keys(accumulatedMetadata).length > 0 ? accumulatedMetadata : undefined 
      })}\n\n`;
      streamController.enqueue(encoder.encode(finalEvent));
      streamController.close();
    }
  }

  return new ReadableStream<Uint8Array>({
    async start(streamController) {
      try {
        // Feedback imediato na UI (evita só "..." enquanto o LLM ainda não emitiu delta)
        streamController.enqueue(
          encoder.encode(`data: ${JSON.stringify({ status: 'Consultando a IA...' })}\n\n`)
        );
        await startStream(cleanMessages, streamController);
      } catch (err) {
        console.error('[IA Stream] Erro na orquestração:', err);
        const msg = err instanceof Error ? err.message : 'Erro no streaming da IA';
        try {
          streamController.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                content: `❌ ${msg}`,
                done: true,
                fullContent: `❌ ${msg}`,
              })}\n\n`
            )
          );
          streamController.close();
        } catch {
          streamController.error(err);
        }
      } finally {
        clearTimeout(timeout);
      }
    },
    cancel() {
      clearTimeout(timeout);
      controller.abort();
    },
  });
}

/**
 * Normalizar URL de endpoint de IA (e.g. adiciona /v1beta/openai para Google Gemini se necessário)
 */
export function normalizeEndpoint(rawEndpoint: string): string {
  let ep = (rawEndpoint || '').trim().replace(/\/+$/, '');
  if (!ep) return ep;
  
  // Normalização para Google Gemini OpenAI Compatibility API
  if (ep.includes('generativelanguage.googleapis.com')) {
    if (!ep.includes('/openai')) {
      if (ep.endsWith('/v1beta')) {
        ep += '/openai';
      } else if (!ep.includes('/v1beta')) {
        ep += '/v1beta/openai';
      }
    }
  }
  return ep;
}

/**
 * Listar modelos disponíveis no endpoint LLM
 */
export async function listModels(
  customEndpoint?: string,
  customApiKey?: string
): Promise<Array<{ id: string; object: string; owned_by: string }>> {
  let endpoint = customEndpoint;
  let apiKey = customApiKey;

  if (!endpoint) {
    const config = await getIAConfig();
    if (!config) throw new Error('IA não está configurada.');
    endpoint = config.endpoint;
    apiKey = config.api_key;
  }

  endpoint = normalizeEndpoint(endpoint);
  if (!endpoint) throw new Error('Endpoint da IA não informado.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${endpoint}/models`, {
      headers,
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Erro ao listar modelos (${response.status})`);

    const data = await parseJsonResponse<any>(response, 'LLM /models');

    if (Array.isArray(data?.data)) {
      return data.data.map((m: any) => ({
        id: typeof m === 'string' ? m : (m.id || m.name || String(m)),
        object: m.object || 'model',
        owned_by: m.owned_by || 'provider',
      }));
    }

    if (Array.isArray(data?.models)) {
      return data.models.map((m: any) => {
        const rawName = m.name || m.id || String(m);
        const cleanId = rawName.replace(/^models\//, '');
        return {
          id: cleanId,
          object: 'model',
          owned_by: 'google',
        };
      });
    }

    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Testar conexão com o endpoint LLM
 */
export async function testConnection(
  customEndpoint?: string,
  customApiKey?: string
): Promise<{ success: boolean; message: string; models?: string[] }> {
  try {
    const models = await listModels(customEndpoint, customApiKey);
    return {
      success: true,
      message: `Conectado com sucesso. ${models.length} modelo(s) disponível(is).`,
      models: models.map(m => m.id),
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Erro desconhecido ao conectar.',
    };
  }
}
