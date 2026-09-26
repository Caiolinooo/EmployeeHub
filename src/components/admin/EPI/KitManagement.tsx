'use client';

import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiBox, FiCheck, FiX, FiSearch, FiUserCheck } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { EPIKitWithItems, EPIType, CreateKitRequest } from '@/types/epi';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';

export default function KitManagement() {
    const { user } = useSupabaseAuth();
    const [kits, setKits] = useState<EPIKitWithItems[]>([]);
    const [epiTypes, setEpiTypes] = useState<EPIType[]>([]);
    const [sectors, setSectors] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingKit, setEditingKit] = useState<EPIKitWithItems | null>(null);

    // Assignment Check
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [selectedKitForAssign, setSelectedKitForAssign] = useState<EPIKitWithItems | null>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [assignLoading, setAssignLoading] = useState(false);
    const [userSearchTerm, setUserSearchTerm] = useState('');

    // Form State
    const [formData, setFormData] = useState<CreateKitRequest>({
        name: '',
        description: '',
        sector_id: '',
        items: []
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/epi/kits');
            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.error || 'Erro ao carregar dados');
            }

            setKits(json.data.kits || []);
            setEpiTypes(json.data.epiTypes || []);
            setSectors(json.data.sectors || []);
            setUsers(json.data.users || []);
        } catch (error: any) {
            console.error(error);
            toast.error('Erro ao carregar dados dos kits');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (kit?: EPIKitWithItems) => {
        if (kit) {
            setEditingKit(kit);
            setFormData({
                name: kit.name,
                description: kit.description || '',
                sector_id: kit.sector_id || '',
                items: kit.items.map(i => ({
                    epi_type_id: i.epi_type_id,
                    quantity: i.quantity,
                    is_mandatory: i.is_mandatory
                }))
            });
        } else {
            setEditingKit(null);
            setFormData({
                name: '',
                description: '',
                sector_id: '',
                items: []
            });
        }
        setShowModal(true);
    };

    const handleAddItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { epi_type_id: '', quantity: 1, is_mandatory: true }]
        });
    };

    const handleRemoveItem = (index: number) => {
        const newItems = [...formData.items];
        newItems.splice(index, 1);
        setFormData({ ...formData, items: newItems });
    };

    const handleItemChange = (index: number, field: string, value: any) => {
        const newItems = [...formData.items];
        (newItems[index] as any)[field] = value;
        setFormData({ ...formData, items: newItems });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Validation
            if (!formData.name) return toast.error('Nome do kit é obrigatório');
            if (formData.items.length === 0) return toast.error('Adicione pelo menos um item ao kit');
            if (formData.items.some(i => !i.epi_type_id)) return toast.error('Selecione o EPI para todos os itens');

            if (editingKit) {
                const res = await fetch('/api/epi/kits', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editingKit.id, ...formData })
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'Erro ao atualizar kit');
                toast.success('Kit atualizado com sucesso');
            } else {
                const res = await fetch('/api/epi/kits', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'Erro ao criar kit');
                toast.success('Kit criado com sucesso');
            }
            setShowModal(false);
            loadData();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este kit?')) return;
        try {
            const res = await fetch(`/api/epi/kits?id=${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Erro ao excluir kit');
            toast.success('Kit excluído');
            loadData();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const handleOpenAssignModal = (kit: EPIKitWithItems) => {
        setSelectedKitForAssign(kit);
        setAssignModalOpen(true);
        setSelectedUserId('');
        setUserSearchTerm('');
    };

    const handleAssignSubmit = async () => {
        if (!selectedKitForAssign || !selectedUserId) return;

        setAssignLoading(true);
        try {
            const res = await fetch('/api/epi/kits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'assign',
                    userId: selectedUserId,
                    kitId: selectedKitForAssign.id
                })
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Erro ao atribuir kit');

            toast.success(`Kit "${selectedKitForAssign.name}" atribuído com sucesso!`);
            setAssignModalOpen(false);
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Erro ao atribuir kit');
        } finally {
            setAssignLoading(false);
        }
    };

    const filteredUsers = users.filter(user =>
        (user.name || '').toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        (user.email || '').toLowerCase().includes(userSearchTerm.toLowerCase())
    );

    if (loading) return <div className="p-8 text-center">Carregando kits...</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-semibold text-gray-800">Kits de EPI</h2>
                    <p className="text-sm text-gray-500">Gerencie conjuntos de EPIs para atribuição rápida</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                >
                    <FiPlus /> Novo Kit
                </button>
            </div>

            {kits.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <FiBox className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum kit criado</h3>
                    <p className="mt-1 text-sm text-gray-500">Comece criando um kit para padronizar a entrega de EPIs.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {kits.map(kit => (
                        <div key={kit.id} className="bg-white rounded-lg shadow-sm border p-5 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-900">{kit.name}</h3>
                                    {kit.sector_id && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                                            {kit.sector_id}
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleOpenAssignModal(kit)} className="text-gray-400 hover:text-green-600" title="Atribuir Kit"><FiUserCheck /></button>
                                    <button onClick={() => handleOpenModal(kit)} className="text-gray-400 hover:text-blue-600" title="Editar"><FiEdit2 /></button>
                                    <button onClick={() => handleDelete(kit.id)} className="text-gray-400 hover:text-red-600" title="Excluir"><FiTrash2 /></button>
                                </div>
                            </div>
                            <p className="text-sm text-gray-600 mb-4 line-clamp-2">{kit.description || 'Sem descrição'}</p>

                            <div className="border-t pt-3">
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Itens ({kit.items.length})</p>
                                <ul className="space-y-1">
                                    {kit.items.slice(0, 3).map(item => (
                                        <li key={item.id} className="text-sm text-gray-700 flex justify-between">
                                            <span>{item.epi_type?.name || 'EPI Removido'}</span>
                                            <span className="text-gray-500">x{item.quantity}</span>
                                        </li>
                                    ))}
                                    {kit.items.length > 3 && (
                                        <li className="text-xs text-gray-400 italic">...e mais {kit.items.length - 3} itens</li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Assignment Modal */}
            {assignModalOpen && selectedKitForAssign && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-gray-900">Atribuir Kit: {selectedKitForAssign.name}</h3>
                            <button onClick={() => setAssignModalOpen(false)} className="text-gray-500 hover:text-gray-700" aria-label="Fechar"><FiX size={24} /></button>
                        </div>

                        <p className="text-sm text-gray-500 mb-4">Selecione o colaborador que receberá este kit. Serão criadas solicitações pendentes para cada item.</p>

                        <div className="mb-4">
                            <div className="relative">
                                <FiSearch className="absolute left-3 top-3 text-gray-400" />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                                    placeholder="Buscar usuário..."
                                    value={userSearchTerm}
                                    onChange={(e) => setUserSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="mb-6 max-h-60 overflow-y-auto border rounded-lg">
                            {filteredUsers.length === 0 ? (
                                <div className="p-4 text-center text-gray-500">Nenhum usuário encontrado.</div>
                            ) : (
                                filteredUsers.map(user => (
                                    <div
                                        key={user.id}
                                        onClick={() => setSelectedUserId(user.id)}
                                        className={`p-3 cursor-pointer hover:bg-gray-50 border-b last:border-0 flex justify-between items-center ${selectedUserId === user.id ? 'bg-green-50 border-l-4 border-l-green-500' : ''}`}
                                    >
                                        <div>
                                            <p className="font-medium text-sm">{user.name}</p>
                                            <p className="text-xs text-gray-500">{user.email}</p>
                                        </div>
                                        {selectedUserId === user.id && <FiCheck className="text-green-600" />}
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="flex justify-end gap-3 border-t pt-4">
                            <button
                                onClick={() => setAssignModalOpen(false)}
                                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAssignSubmit}
                                disabled={!selectedUserId || assignLoading}
                                className={`px-4 py-2 text-white rounded-lg flex items-center gap-2 ${!selectedUserId ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                            >
                                {assignLoading ? (
                                    <>
                                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                        Atribuindo...
                                    </>
                                ) : (
                                    <>
                                        <FiUserCheck /> Confirmar Atribuição
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-lg max-w-2xl w-full p-6 my-8">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h3 className="text-xl font-bold text-gray-900">{editingKit ? 'Editar Kit' : 'Novo Kit'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700" aria-label="Fechar"><FiX size={24} /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Kit *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 outline-none"
                                        placeholder="Ex: Kit Cozinha"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Setor Associado</label>
                                    <select
                                        value={formData.sector_id || ''}
                                        onChange={e => setFormData({ ...formData, sector_id: e.target.value })}
                                        className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 outline-none"
                                    >
                                        <option value="">Nenhum (Genérico)</option>
                                        {sectors.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    rows={2}
                                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 outline-none"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium text-gray-700">Itens do Kit</label>
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="text-sm text-yellow-600 font-medium hover:text-yellow-700 flex items-center gap-1"
                                    >
                                        <FiPlus /> Adicionar Item
                                    </button>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4 border space-y-3 max-h-60 overflow-y-auto">
                                    {formData.items.length === 0 ? (
                                        <p className="text-center text-sm text-gray-500 py-4">Nenhum item adicionado.</p>
                                    ) : (
                                        formData.items.map((item, idx) => (
                                            <div key={idx} className="flex gap-3 items-end bg-white p-3 rounded shadow-sm">
                                                <div className="flex-1">
                                                    <label className="block text-xs text-gray-500 mb-1">Tipo de EPI</label>
                                                    <select
                                                        value={item.epi_type_id}
                                                        onChange={e => handleItemChange(idx, 'epi_type_id', e.target.value)}
                                                        className="w-full border rounded px-2 py-1 text-sm"
                                                        required
                                                    >
                                                        <option value="">Selecione...</option>
                                                        {epiTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                    </select>
                                                </div>
                                                <div className="w-20">
                                                    <label className="block text-xs text-gray-500 mb-1">Qtd</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={e => handleItemChange(idx, 'quantity', parseInt(e.target.value))}
                                                        className="w-full border rounded px-2 py-1 text-sm"
                                                    />
                                                </div>
                                                <div className="pb-2">
                                                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={item.is_mandatory}
                                                            onChange={e => handleItemChange(idx, 'is_mandatory', e.target.checked)}
                                                        />
                                                        Obrigatório
                                                    </label>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveItem(idx)}
                                                    className="text-red-500 hover:text-red-700 p-2"
                                                >
                                                    <FiTrash2 size={16} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                                >
                                    {editingKit ? 'Salvar Alterações' : 'Criar Kit'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
