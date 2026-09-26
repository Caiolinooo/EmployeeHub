'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { startRegistration } from '@simplewebauthn/browser';
import { FiKey, FiTrash2, FiPlus, FiSmartphone, FiMonitor } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PasskeyManagement() {
    const { user } = useSupabaseAuth();
    const [passkeys, setPasskeys] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRegistering, setIsRegistering] = useState(false);

    useEffect(() => {
        if (user) {
            loadPasskeys();
        }
    }, [user]);

    const loadPasskeys = async () => {
        try {
            setIsLoading(true);
            const res = await fetch('/api/auth/webauthn/passkeys');
            if (!res.ok) throw new Error('Erro ao buscar biometrias');
            const data = await res.json();
            setPasskeys(data || []);
        } catch (error: any) {
            console.error('Error loading passkeys:', error);
            toast.error('Erro ao carregar biometrias cadastradas');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async () => {
        if (typeof window === 'undefined' || !window.PublicKeyCredential) {
            toast.error('Biometria indisponível. Verifique se seu navegador suporta e se você está em um ambiente seguro (HTTPS).', { duration: 5000 });
            return;
        }

        try {
            setIsRegistering(true);

            // 1. Get options from server
            const optionsRes = await fetch('/api/auth/webauthn/register/options', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            if (!optionsRes.ok) {
                throw new Error('Erro ao obter opções de registro');
            }

            const options = await optionsRes.json();

            // 2. Pass options to the browser to get local credentials
            let attResp;
            try {
                attResp = await startRegistration({ optionsJSON: options });
            } catch (error: any) {
                if (error.name === 'NotAllowedError') {
                    toast.error('Registro cancelado pelo usuário.');
                    return;
                }
                throw new Error('Falha na interação com o dispositivo biométrico.');
            }

            // 3. Verify the response with the server
            const verificationRes = await fetch('/api/auth/webauthn/register/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(attResp),
            });

            const verificationResult = await verificationRes.json();

            if (verificationResult.success) {
                toast.success(verificationResult.message || 'Biometria cadastrada com sucesso!');
                loadPasskeys();
            } else {
                throw new Error(verificationResult.error || 'Erro na verificação no servidor');
            }
        } catch (error: any) {
            console.error('Passkey registration error:', error);
            if (error.message === 'Failed to fetch') {
                toast.error('Erro de conexão. Verifique se seu AdBlocker/Antivírus está bloqueando a biometria ou se o servidor caiu.', { duration: 6000 });
            } else {
                toast.error(error.message || 'Houve um erro indesejado');
            }
        } finally {
            setIsRegistering(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja remover esta biometria?')) return;

        try {
            const res = await fetch(`/api/auth/webauthn/passkeys/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Erro ao remover biometria');

            toast.success('Biometria removida');
            loadPasskeys();
        } catch (error: any) {
            console.error('Error deleting passkey:', error);
            toast.error('Erro ao remover biometria');
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <FiKey className="text-blue-500" /> Biometria / Passkeys
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Cadastre seu rosto, impressão digital ou PIN (Windows Hello, Touch ID) para usar como assinatura e login.
                    </p>
                </div>
                <Button
                    onClick={handleRegister}
                    disabled={isRegistering}
                    className="bg-blue-600 hover:bg-blue-700 text-white flex gap-2 items-center whitespace-nowrap"
                >
                    {isRegistering ? (
                        <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent"></div>
                    ) : (
                        <FiPlus />
                    )}
                    Cadastrar Novo
                </Button>
            </div>

            {passkeys.length === 0 ? (
                <div className="bg-gray-50 border border-dashed rounded-lg p-8 text-center">
                    <FiKey className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Nenhuma biometria cadastrada.</p>
                    <p className="text-sm text-gray-500 mt-1">Cadastre uma para agilizar suas assinaturas de EPI.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {passkeys.map((pk) => (
                        <div key={pk.id} className="bg-white border rounded-lg p-4 flex justify-between items-center shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className="bg-blue-50 p-3 rounded-full text-blue-600">
                                    {pk.device_type?.toLowerCase().includes('mac') || pk.device_type?.toLowerCase().includes('windows') ? <FiMonitor className="w-5 h-5" /> : <FiSmartphone className="w-5 h-5" />}
                                </div>
                                <div>
                                    <p className="font-medium text-gray-800">
                                        Dispositivo Registrado
                                        {pk.backed_up && <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Sincronizado</span>}
                                    </p>
                                    <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                                        <p>Adicionado em: {format(new Date(pk.created_at), "dd 'de' MMMM', 'yyyy", { locale: ptBR })}</p>
                                        <p>Último uso: {format(new Date(pk.last_used_at), "dd/MM/yyyy HH:mm")}</p>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(pk.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remover credencial"
                            >
                                <FiTrash2 className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
