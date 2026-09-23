import { redirect } from 'next/navigation';

/** Rota morta (design §4): funcionários da folha vivem na aba Folhas do hub. */
export default function PayrollEmployeesPage() {
  redirect('/folha-pagamento?tab=folhas');
}
