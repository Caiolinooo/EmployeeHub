import { redirect } from 'next/navigation';

/** Rota morta (design §4): competências/folhas vivem na aba Folhas do hub. */
export default function PayrollSheetsPage() {
  redirect('/folha-pagamento?tab=folhas');
}
