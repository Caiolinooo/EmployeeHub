'use client';

import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiSave, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function SuppliersAdminPage() {
    const { user } = useSupabaseAuth();
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
    const [saving, setSaving] = useState(false);
    const [useSameEmail, setUseSameEmail] = useState(true);

    // Form state
    const [formData, setFormData] = useState({
        trade_name: '',
        legal_name: '',
        document_number: '',
        contact_email: '',
        contact_phone: '',
        address: '',
        city: '',
        state_uf: '',
        zip_code: '',
        bank_details: '',
        payment_terms: '',
        status: 'active',
        po_email: '',
        auto_send_po: true
    });

    const fetchSuppliers = async () => {
        setLoading(true);
        try {
            const url = search
                ? `/api/suppliers?search=${encodeURIComponent(search)}`
                : `/api/suppliers`;

            const res = await fetch(url);
            const json = await res.json();

            if (json.success) {
                setSuppliers(json.data);
            } else {
                toast.error('Erro ao buscar fornecedores');
            }
        } catch (error) {
            console.error(error);
            toast.error('Erro de conexão');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.role === 'admin' || user?.role === 'ADMIN') {
            fetchSuppliers();
        }
    }, [user, search]);

    const handleOpenModal = (supplier: any = null) => {
        if (supplier) {
            setEditingSupplier(supplier);
            setFormData({
                trade_name: supplier.trade_name || '',
                legal_name: supplier.legal_name || '',
                document_number: supplier.document_number || '',
                contact_email: supplier.contact_email || '',
                contact_phone: supplier.contact_phone || '',
                address: supplier.address || '',
                city: supplier.city || '',
                state_uf: supplier.state_uf || '',
                zip_code: supplier.zip_code || '',
                bank_details: supplier.bank_details || '',
                payment_terms: supplier.payment_terms || '',
                status: supplier.status || 'active',
                po_email: supplier.po_email || '',
                auto_send_po: supplier.auto_send_po !== false
            });
            setUseSameEmail(!supplier.po_email);
        } else {
            setEditingSupplier(null);
            setFormData({
                trade_name: '',
                legal_name: '',
                document_number: '',
                contact_email: '',
                contact_phone: '',
                address: '',
                city: '',
                state_uf: '',
                zip_code: '',
                bank_details: '',
                payment_terms: '',
                status: 'active',
                po_email: '',
                auto_send_po: true
            });
            setUseSameEmail(true);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target as HTMLInputElement;
        const checked = (e.target as HTMLInputElement).checked;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.trade_name) {
            toast.error('O Nome Fantasia é obrigatório');
            return;
        }

        setSaving(true);
        try {
            const method = editingSupplier ? 'PUT' : 'POST';
            const payload = editingSupplier ? { ...formData, id: editingSupplier.id } : { ...formData, created_by: user?.id };

            const res = await fetch('/api/suppliers', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const json = await res.json();
            if (json.success) {
                toast.success(editingSupplier ? 'Fornecedor atualizado' : 'Fornecedor cadastrado');
                handleCloseModal();
                fetchSuppliers();
            } else {
                toast.error(json.error || 'Erro ao salvar fornecedor');
            }
        } catch (error) {
            console.error(error);
            toast.error('Erro de conexão ao salvar');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Tem certeza que deseja remover o fornecedor "${name}"?`)) return;

        try {
            const res = await fetch(`/api/suppliers?id=${id}`, { method: 'DELETE' });
            const json = await res.json();

            if (json.success) {
                toast.success('Fornecedor removido');
                fetchSuppliers();
            } else {
                toast.error(json.error || 'Erro ao remover');
            }
        } catch (error) {
            console.error(error);
            toast.error('Erro de conexão');
        }
    };

    if (!user || (user.role !== 'admin' && user.role !== 'ADMIN')) {
        return (
            <div className="p-8 text-center text-gray-500">
                Você não tem permissão para acessar esta página.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Fornecedores</h1>
                    <p className="text-sm text-gray-500">Gerencie a lista de fornecedores para o módulo de Compras</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm font-medium"
                >
                    <FiPlus /> Novo Fornecedor
                </button>
            </div>

            {/* Busca */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
                <FiSearch className="text-gray-400 text-lg" />
                <input
                    type="text"
                    placeholder="Buscar fornecedores por nome, CNPJ..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-transparent border-0 outline-none text-sm text-gray-700"
                />
                {search && (
                    <button onClick={() => setSearch('')} className="text-gray-500 hover:text-gray-700" aria-label="Limpar busca">
                        <FiX />
                    </button>
                )}
            </div>

            {/* Lista de Fornecedores */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 font-medium">
                            <tr>
                                <th className="px-6 py-4">ID / Status</th>
                                <th className="px-6 py-4">Nome Fantasia</th>
                                <th className="px-6 py-4">CNPJ/Documento</th>
                                <th className="px-6 py-4">Contato</th>
                                <th className="px-6 py-4">Cidade/UF</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                        <div className="animate-pulse flex flex-col items-center gap-2">
                                            <div className="h-4 w-24 bg-gray-200 rounded"></div>
                                            <div className="h-4 w-32 bg-gray-200 rounded"></div>
                                        </div>
                                    </td>
                                </tr>
                            ) : suppliers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                        Nenhum fornecedor encontrado.
                                    </td>
                                </tr>
                            ) : (
                                suppliers.map((supplier) => (
                                    <tr key={supplier.id} className="hover:bg-gray-50 transition">
                                        <td className="px-6 py-4">
                                            <div className="font-mono text-xs font-semibold text-gray-600 mb-1">
                                                #{supplier.sequential_id || '--'}
                                            </div>
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${supplier.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                {supplier.status === 'active' ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-gray-900">{supplier.trade_name}</div>
                                            {supplier.legal_name && <div className="text-xs text-gray-500">{supplier.legal_name}</div>}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {supplier.document_number || '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-gray-900">{supplier.contact_email || '-'}</div>
                                            <div className="text-xs text-gray-500">{supplier.contact_phone}</div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {supplier.city ? `${supplier.city}/${supplier.state_uf || ''}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenModal(supplier)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                    title="Editar"
                                                >
                                                    <FiEdit />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(supplier.id, supplier.trade_name)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                                    title="Excluir"
                                                >
                                                    <FiTrash2 />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Cadastro/Edição */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                            </h2>
                            <button onClick={handleCloseModal} className="text-gray-500 hover:text-gray-700 p-2" aria-label="Fechar">
                                <FiX className="text-xl" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Informações Básicas */}
                                <div className="space-y-4 md:col-span-2">
                                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">Informações Básicas</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Fantasia *</label>
                                            <input
                                                type="text"
                                                name="trade_name"
                                                value={formData.trade_name}
                                                onChange={handleChange}
                                                required
                                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social</label>
                                            <input
                                                type="text"
                                                name="legal_name"
                                                value={formData.legal_name}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ / CPF</label>
                                            <input
                                                type="text"
                                                name="document_number"
                                                value={formData.document_number}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                            <select
                                                name="status"
                                                value={formData.status}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                                            >
                                                <option value="active">Ativo</option>
                                                <option value="inactive">Inativo</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Contato e Endereço */}
                                <div className="space-y-4 md:col-span-2">
                                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mt-2 mb-2">Contato e Endereço</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                                            <input
                                                type="email"
                                                name="contact_email"
                                                value={formData.contact_email}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                                            <input
                                                type="text"
                                                name="contact_phone"
                                                value={formData.contact_phone}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Endereço (Rua, Número, Bairro)</label>
                                            <input
                                                type="text"
                                                name="address"
                                                value={formData.address}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                                            <input
                                                type="text"
                                                name="city"
                                                value={formData.city}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">UF</label>
                                                <input
                                                    type="text"
                                                    name="state_uf"
                                                    maxLength={2}
                                                    value={formData.state_uf}
                                                    onChange={handleChange}
                                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white uppercase"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                                                <input
                                                    type="text"
                                                    name="zip_code"
                                                    value={formData.zip_code}
                                                    onChange={handleChange}
                                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Financeiro */}
                                <div className="space-y-4 md:col-span-2">
                                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mt-2 mb-2">Financeiro</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Dados Bancários</label>
                                            <textarea
                                                name="bank_details"
                                                value={formData.bank_details}
                                                onChange={handleChange}
                                                rows={3}
                                                placeholder="Ex: Banco Itaú, Ag: 0000, Conta: 00000-0"
                                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Condições de Pagamento</label>
                                            <textarea
                                                name="payment_terms"
                                                value={formData.payment_terms}
                                                onChange={handleChange}
                                                rows={3}
                                                placeholder="Ex: 30/60/90 dias, PIX, Boleto"
                                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Envio de OC */}
                                <div className="space-y-4 md:col-span-2">
                                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mt-2 mb-2">Envio de Ordem de Compra</h3>

                                    {/* Toggle auto-send */}
                                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">Envio automático de OC por e-mail</p>
                                            <p className="text-xs text-gray-500 mt-0.5">A OC será enviada automaticamente ao fornecedor após aprovação</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer ml-4 flex-shrink-0">
                                            <input
                                                type="checkbox"
                                                name="auto_send_po"
                                                checked={(formData as any).auto_send_po}
                                                onChange={handleChange}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-300 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:bg-blue-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                                        </label>
                                    </div>

                                    {/* po_email */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">E-mail para recebimento de OC</label>
                                        <label className="flex items-center gap-2 text-sm text-gray-600 mb-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={useSameEmail}
                                                onChange={(e) => {
                                                    setUseSameEmail(e.target.checked);
                                                    if (e.target.checked) setFormData(prev => ({ ...prev, po_email: '' }));
                                                }}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            Usar o mesmo e-mail de contato
                                        </label>
                                        {!useSameEmail && (
                                            <input
                                                type="email"
                                                name="po_email"
                                                value={(formData as any).po_email || ''}
                                                onChange={handleChange}
                                                placeholder="compras@fornecedor.com"
                                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                                            />
                                        )}
                                        {useSameEmail && formData.contact_email && (
                                            <p className="text-xs text-gray-500">OC será enviada para: <span className="font-medium text-gray-700">{formData.contact_email}</span></p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-6 py-2 border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-70"
                                >
                                    {saving ? (
                                        'Salvando...'
                                    ) : (
                                        <>
                                            <FiSave /> Salvar Fornecedor
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
