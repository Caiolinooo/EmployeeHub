import { redirect } from 'next/navigation';

/** Rota morta (design §4): criação de folha vive na aba Folhas do hub. */
export default function NovaFolhaPage() {
  redirect('/folha-pagamento?tab=folhas');
}
