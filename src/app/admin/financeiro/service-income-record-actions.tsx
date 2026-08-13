"use client";

import { deleteServiceIncome, updateServiceIncome } from "./actions";

type Props = {
  id: string;
  month: string;
  serviceDate: string;
  cashCents: number;
  pixCents: number;
};

function currencyInputValue(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export default function ServiceIncomeRecordActions({ id, month, serviceDate, cashCents, pixCents }: Props) {
  return (
    <div className="finance-service-record-actions">
      <details>
        <summary>Editar</summary>
        <form action={updateServiceIncome}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="returnMonth" value={month} />
          <label>Data do culto<input name="serviceDate" type="date" defaultValue={serviceDate} required /></label>
          <label>Valor em Pix<input name="pixAmount" inputMode="decimal" defaultValue={currencyInputValue(pixCents)} /></label>
          <label>Valor em dinheiro<input name="cashAmount" inputMode="decimal" defaultValue={currencyInputValue(cashCents)} /></label>
          <button type="submit">Salvar alterações</button>
        </form>
      </details>
      <form
        action={deleteServiceIncome}
        onSubmit={(event) => {
          if (!window.confirm("Excluir definitivamente esta entrada do culto?")) event.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="returnMonth" value={month} />
        <button className="danger" type="submit">Excluir</button>
      </form>
    </div>
  );
}
