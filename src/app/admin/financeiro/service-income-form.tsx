import { createServiceIncome } from "./actions";

export default function ServiceIncomeForm({ month }: { month: string }) {
  return (
    <form action={createServiceIncome} className="finance-service-income-form">
      <input type="hidden" name="returnMonth" value={month} />
      <label>Data do culto<input name="serviceDate" type="date" required /></label>
      <label>Valor em Pix<input name="pixAmount" inputMode="decimal" placeholder="0,00" /></label>
      <label>Valor em dinheiro<input name="cashAmount" inputMode="decimal" placeholder="0,00" /></label>
      <button className="wide primary" type="submit">Salvar entrada do culto</button>
    </form>
  );
}
