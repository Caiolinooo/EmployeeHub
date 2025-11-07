"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Lightweight PDF preview with draggable text fields overlaid.
 * - Uses pdfjs-dist via CDN (no package install needed)
 * - Renders first page of selected PDF file
 * - Allows drag-and-drop of configured fields and updates JSON in parent
 */
export default function CertificateTemplateEditor({
  file,
  url,
  configJson,
  onChangeConfig,
}: {
  file: File | null;
  url?: string | null;
  configJson: string;
  onChangeConfig: (v: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [pdfPageSize, setPdfPageSize] = useState<{ width: number; height: number } | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapStep, setSnapStep] = useState(10);

  // Ensure pdfjs (global) is available
  useEffect(() => {
    const ensurePdfJs = async () => {
      if (typeof window === 'undefined') return;
      const w = window as any;
      if (!w.pdfjsLib) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.min.js';
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Falha ao carregar pdfjs'));
          document.head.appendChild(s);
        });
      }
      const w2 = window as any;
      if (w2.pdfjsLib) {
        // Set worker
        w2.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.js';
      }
    };
    ensurePdfJs().catch((e) => console.error(e));
  }, []);

  // Render first page of the PDF to canvas whenever file/url or scale changes
  useEffect(() => {
    const render = async () => {
      setError(null);
      const w = window as any;
      if (!w.pdfjsLib) return; // will rerun after script loads
      if (!file && !url) return; // nothing to preview until a file or url is provided
      let revoke: string | null = null;
      try {
        setIsLoadingPdf(true);
        let src: string;
        if (file) {
          src = URL.createObjectURL(file);
          revoke = src;
        } else {
          src = String(url);
        }
        const pdf = await w.pdfjsLib.getDocument({ url: src }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        // Fit width to container
        const maxWidth = containerRef.current ? containerRef.current.clientWidth : 800;
        const s = Math.min(maxWidth / viewport.width, 1.5) * scale;
        const vp = page.getViewport({ scale: s });
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        setPdfPageSize({ width: vp.width, height: vp.height });
        const renderTask = page.render({ canvasContext: ctx, viewport: vp });
        await renderTask.promise;
        if (revoke) URL.revokeObjectURL(revoke);
      } catch (e: any) {
        console.error('Erro ao renderizar PDF:', e);
        setError(e?.message || 'Erro ao renderizar PDF');
      } finally {
        setIsLoadingPdf(false);
      }
    };
    render();
  }, [file, url, scale]);

  // Parse config JSON safely
  const config = useMemo(() => {
    try {
      if (!configJson?.trim()) return { page: 1, fields: {} as any };
      const parsed = JSON.parse(configJson);
      return { page: parsed.page || 1, fields: parsed.fields || {} } as { page: number; fields: Record<string, any> };
    } catch (e) {
      return { page: 1, fields: {} as any };
    }
  }, [configJson]);

  // Drag handlers
  const [drag, setDrag] = useState<{ key: string; offsetX: number; offsetY: number } | null>(null);

  const beginDrag = (key: string, e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    setDrag({ key, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag || !containerRef.current || !pdfPageSize) return;
    const rect = containerRef.current.getBoundingClientRect();
    const rawX = Math.max(0, Math.min(pdfPageSize.width - 1, e.clientX - rect.left - drag.offsetX));
    const rawY = Math.max(0, Math.min(pdfPageSize.height - 1, e.clientY - rect.top - drag.offsetY));
    const step = snapEnabled ? Math.max(1, snapStep) : 1;
    const x = Math.round(rawX / step) * step;
    const y = Math.round(rawY / step) * step;
    // Update live (without committing string yet)
    const newFields = { ...config.fields, [drag.key]: { ...(config.fields as any)[drag.key], x, y } };
    const next = JSON.stringify({ page: config.page, fields: newFields }, null, 2);
    onChangeConfig(next);
  };

  const endDrag = () => setDrag(null);

  // Utility to ensure a field exists
  const ensureField = (key: string) => {
    if (!(config.fields as any)[key]) {
      const newFields = { ...config.fields, [key]: { x: 50, y: 50, size: 18 } };
      onChangeConfig(JSON.stringify({ page: config.page, fields: newFields }, null, 2));
    }
  };

  const fieldEntries = Object.entries(config.fields || {});

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-600">Visualização do PDF (página 1)</div>
        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-600">Zoom</label>
          <input type="range" min={0.5} max={2} step={0.1} value={scale} onChange={(e)=>setScale(parseFloat(e.target.value))} />
          <label className="flex items-center gap-1 text-sm text-gray-600">
            <input type="checkbox" checked={showGrid} onChange={(e)=>setShowGrid(e.target.checked)} /> Grade
          </label>
          <label className="flex items-center gap-1 text-sm text-gray-600">
            <input type="checkbox" checked={snapEnabled} onChange={(e)=>setSnapEnabled(e.target.checked)} /> Snap
          </label>
          <label className="text-sm text-gray-600">Passo</label>
          <input type="number" min={1} max={100} value={snapStep} onChange={(e)=>setSnapStep(parseInt(e.target.value||'10'))} className="w-16 border rounded px-2 py-1 text-sm" />
        </div>
      </div>

      {/* Canvas + overlay */}
      <div
        ref={containerRef}
        className="relative border rounded overflow-hidden"
        style={showGrid ? { backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)', backgroundSize: `${snapStep}px ${snapStep}px`, backgroundColor: '#fafafa' } : { backgroundColor: '#fafafa' }}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
      >
        <canvas ref={canvasRef} className="block w-full h-auto" />

        {/* Overlay fields */}
        {pdfPageSize && fieldEntries.map(([key, f]: any) => (
          <div
            key={key}
            onMouseDown={(e)=>beginDrag(key, e)}
            className="absolute cursor-move select-none px-2 py-1 rounded text-xs"
            style={{ left: (f?.x||0), top: (f?.y||0), transform: (f?.align==='center' ? 'translate(-50%, 0)' : (f?.align==='right' ? 'translate(-100%, 0)' : 'translate(0, 0)')), fontSize: (f?.size||16), color: (f?.color || '#ffffff'), backgroundColor: 'rgba(79,70,229,0.8)' }}
            title={`${key} (arraste)`}
          >
            {key}
          </div>
        ))}

        {(!file && !url) && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm bg-white/60">
            Selecione um PDF acima ou escolha um template existente para visualizar aqui.
          </div>
        )}
      </div>

      {/* Quick-add fields */}
      <div className="mt-3 flex flex-wrap gap-2">
        {['student_name','course_title','completion_date','certificate_id','instructor_name','issue_date'].map(k=> (
          <button key={k} type="button" onClick={()=>ensureField(k)} className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border">
            Adicionar {k}
          </button>
        ))}
      </div>

      {/* Field style editor */}
      {fieldEntries.length > 0 && (
        <div className="mt-4 border rounded p-3 bg-white">
          <div className="text-sm font-medium mb-2">Estilos dos campos</div>
          <div className="space-y-2">
            {fieldEntries.map(([key, f]: any) => (
              <div key={key} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-3 text-xs text-gray-700 truncate">{key}</div>
                <label className="col-span-2 flex items-center gap-1 text-xs text-gray-600">
                  Tamanho
                  <input type="number" value={f?.size||16} onChange={(e)=>{
                    const newFields = { ...config.fields, [key]: { ...f, size: parseInt(e.target.value||'16') } };
                    onChangeConfig(JSON.stringify({ page: config.page, fields: newFields }, null, 2));
                  }} className="w-16 border rounded px-2 py-1" />
                </label>
                <label className="col-span-2 flex items-center gap-1 text-xs text-gray-600">
                  Cor
                  <input type="color" value={f?.color||'#000000'} onChange={(e)=>{
                    const newFields = { ...config.fields, [key]: { ...f, color: e.target.value } };
                    onChangeConfig(JSON.stringify({ page: config.page, fields: newFields }, null, 2));
                  }} className="w-16 h-7 border rounded" />
                </label>
                <label className="col-span-2 flex items-center gap-1 text-xs text-gray-600">
                  Fonte
                  <select value={f?.font||'Helvetica'} onChange={(e)=>{
                    const newFields = { ...config.fields, [key]: { ...f, font: e.target.value } };
                    onChangeConfig(JSON.stringify({ page: config.page, fields: newFields }, null, 2));
                  }} className="border rounded px-2 py-1 text-xs">
                    <option value="Helvetica">Helvetica</option>
                    <option value="TimesRoman">Times</option>
                    <option value="Courier">Courier</option>
                  </select>
                </label>
                <label className="col-span-3 flex items-center gap-1 text-xs text-gray-600">
                  Alinhamento
                  <select value={f?.align||'left'} onChange={(e)=>{
                    const newFields = { ...config.fields, [key]: { ...f, align: e.target.value } };
                    onChangeConfig(JSON.stringify({ page: config.page, fields: newFields }, null, 2));
                  }} className="border rounded px-2 py-1 text-xs">
                    <option value="left">Esquerda</option>
                    <option value="center">Centro</option>
                    <option value="right">Direita</option>
                  </select>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoadingPdf && <div className="mt-2 text-sm text-gray-500">Carregando PDF...</div>}
      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
    </div>
  );
}

