"use client";
import { useActionState, useState, type ReactNode } from "react";
import { saveMinistryFund } from "./actions";
import { ENTRY_KINDS, type FundDream, type FundEvent, type EntryKind } from "@/lib/ministry-funds";

function FundForm({children,ministryKey,id,operation,editing=false,label="Salvar"}:{children:ReactNode;ministryKey:string;id:string;operation:string;editing?:boolean;label?:string}) {
  const [state,action,pending]=useActionState(saveMinistryFund,{ok:false,message:""});
  return <form action={action} className="mf-form">
    <input type="hidden" name="id" value={id}/><input type="hidden" name="ministry_key" value={ministryKey}/><input type="hidden" name="operation" value={operation}/><input type="hidden" name="editing" value={String(editing)}/>
    <fieldset disabled={pending || (state.ok&&!editing)}>{children}<button type="submit">{pending?"Salvando…":state.ok&&!editing?"Salvo":label}</button></fieldset>
    {state.message&&<p role={state.ok?"status":"alert"} data-ok={state.ok}>{state.message}</p>}
    {state.ok&&!editing&&operation!=="void"&&<button type="button" onClick={()=>window.location.reload()}>Cadastrar outro</button>}
  </form>;
}
export function EventForm({ministryKey,id,event,today}:{ministryKey:string;id:string;event?:FundEvent;today:string}) {
  return <FundForm ministryKey={ministryKey} id={id} operation="event" editing={!!event} label={event?"Salvar evento":"Criar evento"}>
    <label>Nome do evento<input name="title" required minLength={3} maxLength={120} defaultValue={event?.title} placeholder="Ex.: Pastéis de domingo"/></label>
    <label>Data<input name="event_date" type="date" required min="2000-01-01" max="2100-12-31" defaultValue={event?.event_date??today}/></label>
    <label>Descrição<textarea name="description" maxLength={2000} rows={3} defaultValue={event?.description} placeholder="Objetivo, organização e observações"/></label>
    <label>Situação<select name="status" defaultValue={event?.status??"planned"}><option value="planned">Planejado / em andamento</option><option value="completed">Realizado</option><option value="archived">Arquivado</option></select></label>
    <p>Controle interno do ministério. Não publica inscrições nem cria cobranças.</p>
  </FundForm>;
}
export function DreamForm({ministryKey,id,dream}:{ministryKey:string;id:string;dream?:FundDream}) {
  return <FundForm ministryKey={ministryKey} id={id} operation="dream" editing={!!dream} label={dream?"Salvar sonho":"Criar sonho"}>
    <label>O que precisamos adquirir?<input name="title" required minLength={3} maxLength={120} defaultValue={dream?.title} placeholder="Ex.: Equipamento para a cozinha"/></label>
    <label>Valor da meta (R$)<input name="target" inputMode="decimal" required defaultValue={dream?(dream.target_cents/100).toFixed(2).replace(".",","):""} placeholder="0,00"/></label>
    <label>Descrição / necessidade<textarea name="description" rows={3} maxLength={2000} defaultValue={dream?.description}/></label>
    <label>Situação<select name="status" defaultValue={dream?.status??"active"}><option value="active">Arrecadando</option><option value="purchased">Comprado / realizado</option><option value="archived">Arquivado</option></select></label>
    <p>Vincule entradas e despesas a este sonho. Marcar como comprado não lança uma despesa automaticamente.</p>
  </FundForm>;
}
export function EntryForm({ministryKey,id,events,dreams,today,eventId=""}:{ministryKey:string;id:string;events:FundEvent[];dreams:FundDream[];today:string;eventId?:string}) {
  const [kind,setKind]=useState<EntryKind>(eventId?"sale":"cash_donation");
  return <FundForm ministryKey={ministryKey} id={id} operation="entry" label="Registrar lançamento">
    <label>Tipo<select name="kind" value={kind} onChange={e=>setKind(e.target.value as EntryKind)}>{Object.entries(ENTRY_KINDS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label>Data<input name="occurred_on" type="date" required min="2000-01-01" max="2100-12-31" defaultValue={today}/></label>
    <label>Descrição<input name="description" minLength={3} maxLength={500} required placeholder={kind==="in_kind"?"Ex.: 5 kg de queijo doados":"Ex.: Venda de 30 pastéis / compra de ingredientes"}/></label>
    <label>{kind==="in_kind"?"Valor estimado (R$); use 0 se não souber":"Valor total recebido ou pago (R$)"}<input name="amount" required inputMode="decimal" placeholder="0,00"/></label>
    {(kind==="sale"||kind==="in_kind")&&<label>{kind==="sale"?"Unidades vendidas":"Quantidade doada (opcional)"}<input name="quantity" type="number" required={kind==="sale"} min={kind==="sale"?1:0} max={1000000} step={1} defaultValue={kind==="sale"?1:0}/></label>}
    {kind!=="opening_balance"&&<>
      <label>Evento{kind==="sale"?" (obrigatório)":" (opcional)"}<select name="event_id" defaultValue={eventId} required={kind==="sale"}><option value="">Caixinha geral / sem evento</option>{events.filter(e=>e.status!=="archived").map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
      <label>Destinar a um sonho (opcional)<select name="dream_id" defaultValue=""><option value="">Sem destinação específica</option>{dreams.filter(d=>d.status!=="archived").map(d=><option key={d.id} value={d.id}>{d.title}</option>)}</select></label>
    </>}
    <p>{kind==="in_kind"?"Materiais e serviços doados ficam registrados, mas não aumentam o dinheiro da caixinha.":"Registre somente valores efetivamente recebidos ou pagos. Não há importação automática do checkout; não lance duas vezes o mesmo recebimento."}</p>
  </FundForm>;
}
export function VoidForm({ministryKey,id}:{ministryKey:string;id:string}) {
  return <details className="mf-void"><summary>Corrigir / cancelar lançamento</summary><FundForm ministryKey={ministryKey} id={id} operation="void" label="Confirmar cancelamento"><label>Motivo<input name="reason" required minLength={3} maxLength={500}/></label><p>O valor deixará de compor o saldo. Para corrigir, cancele e registre o lançamento correto.</p></FundForm></details>;
}
