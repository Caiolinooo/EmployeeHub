"use client";
import React, { useEffect, useState } from 'react';

interface Criterio {
  id: string;
  nome: string;
  descricao?: string;
  categoria?: string;
  tipo?: string;
  apenas_lideres?: boolean;
  ordem?: number;
  peso?: number;
  ativo?: boolean;
  created_at?: string;
}

export function CriteriosManager() {
  const [lista, setLista] = useState<Criterio[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ nome: '', descricao: '', categoria: '', tipo: 'gerente', ordem: 0, peso: 1, apenas_lideres: false });
  const [saving, setSaving] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/avaliacao/criterios');
      const json = await res.json();
      if (json.success) setLista(json.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const salvarNovo = async () => {
    if (!form.nome) return alert('Nome obrigatório');
    setSaving(true);
    try {
      const res = await fetch('/api/avaliacao/criterios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (json.success) {
        setForm({ nome: '', descricao: '', categoria: '', tipo: 'gerente', ordem: 0, peso: 1, apenas_lideres: false });
        carregar();
      } else alert(json.error || 'Erro ao criar');
    } catch(e:any) {
      alert(e.message);
    } finally { setSaving(false); }
  };

  const atualizar = async (id: string, data: Partial<Criterio>) => {
    const res = await fetch(`/api/avaliacao/criterios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (json.success) carregar(); else alert(json.error || 'Erro');
  };

  const desativar = async (id: string) => {
    if (!confirm('Desativar critério?')) return;
    const res = await fetch(`/api/avaliacao/criterios/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) carregar(); else alert(json.error || 'Erro');
  };

  return (
    <div className="space-y-6">
      <div className="p-4 border rounded-md bg-white shadow-sm">
        <h3 className="font-semibold mb-4">Novo Critério</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input className="border p-2 rounded" placeholder="Nome" value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} />
          <input className="border p-2 rounded" placeholder="Categoria" value={form.categoria} onChange={e=>setForm({...form,categoria:e.target.value})} />
          <select className="border p-2 rounded" value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})}>
            <option value="gerente">Gerente</option>
            <option value="colaborador">Colaborador</option>
          </select>
          <input type="number" className="border p-2 rounded" placeholder="Ordem" value={form.ordem} onChange={e=>setForm({...form,ordem:Number(e.target.value)})} />
          <input type="number" step="0.01" className="border p-2 rounded" placeholder="Peso" value={form.peso} onChange={e=>setForm({...form,peso:Number(e.target.value)})} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.apenas_lideres} onChange={e=>setForm({...form,apenas_lideres:e.target.checked})} /> Apenas líderes</label>
          <textarea className="border p-2 rounded md:col-span-3" placeholder="Descrição" value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})}></textarea>
        </div>
        <button onClick={salvarNovo} disabled={saving} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">{saving?'Salvando...':'Salvar'}</button>
      </div>

      <div className="p-4 border rounded-md bg-white shadow-sm">
        <h3 className="font-semibold mb-4">Critérios Ativos</h3>
        {loading ? <p>Carregando...</p> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th>Nome</th><th>Categoria</th><th>Tipo</th><th>Ordem</th><th>Peso</th><th>Líderes</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(c => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td>{c.nome}</td>
                  <td>{c.categoria||'-'}</td>
                  <td>{c.tipo}</td>
                  <td>
                    <input type="number" value={c.ordem||0} onChange={e=>atualizar(c.id,{ordem:Number(e.target.value)})} className="w-16 border p-1 rounded" />
                  </td>
                  <td>
                    <input type="number" step="0.01" value={c.peso||1} onChange={e=>atualizar(c.id,{peso:Number(e.target.value)})} className="w-20 border p-1 rounded" />
                  </td>
                  <td>
                    <input type="checkbox" checked={!!c.apenas_lideres} onChange={e=>atualizar(c.id,{apenas_lideres:e.target.checked})} />
                  </td>
                  <td className="space-x-2">
                    <button onClick={()=>desativar(c.id)} className="text-red-600 hover:underline">Desativar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
