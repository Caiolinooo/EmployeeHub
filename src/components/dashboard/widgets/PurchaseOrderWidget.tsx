'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiShoppingBag, FiArrowRight, FiClock, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { useI18n } from '@/contexts/I18nContext';

export default function PurchaseOrderWidget() {
    const { t } = useI18n();
    const { user } = useSupabaseAuth();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { hasPermission } = useEffectivePermissions();

    useEffect(() => {
        const fetchRecentOrders = async () => {
            try {
                const res = await fetch('/api/purchase-orders?limit=5');
                if (res.ok) {
                    const json = await res.json();
                    setOrders(json.data?.slice(0, 5) || []);
                }
            } catch (error) {
                console.error('Widget error:', error);
            } finally {
                setLoading(false);
            }
        };

        if (user && hasPermission('compras')) {
            fetchRecentOrders();
        } else {
            setLoading(false);
        }
    }, [user, hasPermission]);

    if (!user || !hasPermission('compras')) return null;

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'approved': return <FiCheckCircle className="text-green-500" />;
            case 'rejected': return <FiXCircle className="text-red-500" />;
            default: return <FiClock className="text-yellow-500" />;
        }
    };

    return (
        <div className="flex flex-col gap-4 flex-1 min-h-0">
            <div className="flex justify-between items-center mb-1">
                <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                    {t('dashboard.purchaseOrderWidget.myPurchases')}
                </h3>
                <Link href="/department/purchase-orders" className="text-sm text-blue-600 font-semibold hover:underline flex items-center">
                    {t('dashboard.purchaseOrderWidget.viewAll')} <FiArrowRight className="ml-1" />
                </Link>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 min-h-[200px]">
                {loading ? (
                    <div className="space-y-3 animate-pulse">
                        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white rounded-3xl shadow-sm"></div>)}
                    </div>
                ) : orders.length === 0 ? (
                    <div className="bg-white rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center text-gray-500 text-sm h-full">
                        <p>{t('dashboard.purchaseOrderWidget.noRecentRequests')}</p>
                        <Link href="/department/purchase-orders/new" className="mt-2 text-blue-500 hover:underline font-medium">
                            {t('dashboard.purchaseOrderWidget.createNew')}
                        </Link>
                    </div>
                ) : (
                    <>
                        {orders.map(order => (
                            <Link
                                key={order.id}
                                href={`/department/purchase-orders/${order.id}`}
                                className="group block p-5 rounded-3xl bg-white hover:bg-white/80 hover:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.04)] shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] transition-all border-0 relative overflow-hidden shrink-0"
                            >
                                <div className="flex justify-between items-center relative z-10">
                                    <div className="min-w-0 pr-4">
                                        <p className="text-base font-bold text-gray-900 truncate mb-1">
                                            {order.provider_trade_name || order.provider_name || t('dashboard.purchaseOrderWidget.unknownProvider')}
                                        </p>
                                        <p className="text-sm text-gray-500 font-medium">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total_value)}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end shrink-0">
                                        {getStatusIcon(order.status)}
                                        <span className="text-[10px] text-gray-500 mt-1 font-medium bg-gray-50 px-2 py-0.5 rounded-full">
                                            {new Date(order.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </>
                )}
            </div>

            <div className="mt-auto pt-2">
                <Link
                    href="/department/purchase-orders/new"
                    className="block w-full text-center py-3.5 bg-blue-50 text-blue-600 rounded-3xl hover:bg-blue-100 text-sm font-bold transition-colors shadow-sm"
                >
                    {t('dashboard.purchaseOrderWidget.newRequest')}
                </Link>
            </div>
        </div>
    );
}
