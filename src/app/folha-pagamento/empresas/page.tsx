import { redirect } from 'next/navigation';

/** Rota morta (design §4): CRUD de empresas vive na aba Empresas do hub. */
export default function EmpresasPage() {
  redirect('/folha-pagamento?tab=empresas');
}
