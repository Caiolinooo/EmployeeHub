import Link from 'next/link';
import { FiAlertTriangle } from 'react-icons/fi';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-abz-background p-6">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md text-center">
        <FiAlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-3" />
        <h1 className="text-xl font-semibold text-gray-800 mb-2">Acesso negado</h1>
        <p className="text-gray-600 mb-6">
          Você não tem permissão para acessar esta página ou recurso.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center px-4 py-2 bg-abz-blue text-white rounded-md hover:opacity-90 transition-colors text-sm font-medium shadow-sm"
        >
          Voltar para o Dashboard
        </Link>
      </div>
    </div>
  );
}
