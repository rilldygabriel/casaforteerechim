import type { Metadata } from "next";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { ministryFundAccess } from "@/lib/ministry-funds-server";
import { ENTRY_KINDS, EMPTY_TOTAL, money, dateLabel, dreamProgress, type FundEvent, type FundDream, type FundEntry, type FundTotal } from "@/lib/ministry-funds";
import { EventForm, DreamForm, EntryForm, VoidForm } from "./forms";
import "./ministry-funds.css";
import { PublicationForm,CashConfirmation,type Publication } from "./publication-form";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { METHOD_LABELS,type MinistryMethod,type MinistryOrderItem } from "@/lib/ministry-event-policy";

export const metadata:Metadata={title:"Eventos e caixinhas dos ministérios",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";
async function readAll<T>(query:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:unknown}>) {
  const rows:T[]=[];
  for(let from=0;;from+=1000){const result=await query(from,from+999);if(result.error)throw new Error("Não foi possível carregar o painel. Atualize para tentar novamente.");rows.push(...(result.data??[]));if((result.data?.length??0)<1000)return rows;}
}
function Stats({total,event=false}:{total:FundTotal;event?:boolean}) {
  return <div className="mf-stats">
    <article className="mf-balance"><span>{event?"Resultado do evento":"Saldo em caixinha"}</span><strong>{money(total.balance_cents)}</strong></article>
    <article><span>Vendas recebidas</span><strong>{money(total.sales_cents)}</strong><small>{total.units} unidades vendidas</small></article>
    <article><span>Doações em dinheiro</span><strong>{money(total.donations_cents)}</strong></article>
    <article><span>Gastos pagos</span><strong>{money(total.expenses_cents)}</strong><small>Retiradas / repasses: {money(total.withdrawals_cents)}</small></article>
  </div>;
}
export default async function MinistryFundsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const access=await ministryFundAccess();
  if(!access)redirect("/admin");
  const params=await searchParams;
  const ministryKey=typeof params.ministerio==="string"?params.ministerio:"";
  const selected=access.ministries.find(m=>m.key===ministryKey)??(!access.isAdmin?access.ministries[0]:null);
  const {db}=access;
  const totals=await readAll<FundTotal>((from,to)=>db.rpc("ministry_fund_totals").order("ministry_key").order("scope").order("scope_id").range(from,to));
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo"}).format(new Date());
  const root="/admin/ministerios/eventos";
  if(!selected) return <main className="mf-page"><header className="mf-header"><Link href="/admin">← Painel</Link><span>Visão administrativa</span></header><section className="mf-hero"><p>MINISTÉRIOS DA CASA</p><h1>Eventos, sonhos<br/>e caixinhas.</h1><p>Cada ministério com seu próprio controle. Escolha abaixo para acompanhar ou gerenciar.</p></section><div className="mf-ministry-grid">{access.ministries.map(m=>{const total=totals.find(t=>t.ministry_key===m.key&&t.scope==="ministry")??EMPTY_TOTAL;return <Link key={m.key} href={`${root}?ministerio=${m.key}`}><span>Ministério</span><h2>{m.label}</h2><small>Saldo em caixinha</small><strong>{money(total.balance_cents)}</strong><p>{total.units} unidades vendidas · {money(total.sales_cents)} em vendas</p><b>Abrir painel →</b></Link>;})}</div><p className="mf-note">Líderes acessam somente seu ministério; Rilldy e Lisi acompanham todos. Vendas online confirmadas entram automaticamente na caixinha. Pix e cartão dos eventos são recebidos pelo PagBank; dinheiro exige confirmação. A caixinha não transfere dinheiro entre contas.</p></main>;
  const [events,dreams]=await Promise.all([
    readAll<FundEvent>((from,to)=>db.from("ministry_fund_events").select("id,ministry_key,title,description,event_date,status").eq("ministry_key",selected.key).order("event_date",{ascending:false}).order("id").range(from,to)),
    readAll<FundDream>((from,to)=>db.from("ministry_fund_dreams").select("id,ministry_key,title,description,target_cents,status").eq("ministry_key",selected.key).order("created_at",{ascending:false}).order("id").range(from,to)),
  ]);
  const url=`${root}?ministerio=${selected.key}`;
  const tab=typeof params.aba==="string"&&["eventos","caixinha","sonhos"].includes(params.aba)?params.aba:"eventos";
  const event=typeof params.evento==="string"?events.find(e=>e.id===params.evento):undefined;
  // A service read is allowed only after selecting an event already returned by ministry RLS.
  const publicationResult=event?await db.from("events").select("image_url,start_time,location,capacity,is_public,slug,ministry_products,ministry_payment_methods").eq("ministry_fund_id",event.id).eq("ministry_key",selected.key).maybeSingle():{data:null,error:null};
  if(publicationResult.error)throw new Error("Não foi possível carregar a publicação.");
  const publication=publicationResult.data as Publication|null;
  const orders=event?await readAll<{id:string;full_name:string;phone:string;status:string;ministry_items:MinistryOrderItem[];ministry_method:MinistryMethod;order_total_cents:number}>((from,to)=>getSupabaseServiceClient().from("event_registrations").select("id,full_name,phone,status,ministry_items,ministry_method,order_total_cents").eq("event_id",event.id).not("ministry_method","is",null).order("created_at",{ascending:false}).order("id").range(from,to)):[];
  const tickets=orders.length?await getSupabaseServiceClient().from("event_tickets").select("registration_id,public_token").eq("event_id",event!.id):{data:[]};
  const page=typeof params.pagina==="string"&&/^\d+$/.test(params.pagina)?Math.max(1,Math.min(100000,Number(params.pagina))):1;
  let entryQuery=db.from("ministry_fund_entries").select("id,ministry_key,event_id,dream_id,kind,description,amount_cents,quantity,occurred_on,created_by,created_at,voided_at,void_reason",{count:"exact"}).eq("ministry_key",selected.key).order("occurred_on",{ascending:false}).order("created_at",{ascending:false}).order("id").range((page-1)*50,page*50-1);
  if(event)entryQuery=entryQuery.eq("event_id",event.id);
  const entryResult=(tab==="caixinha"||event)?await entryQuery:{data:[],count:0,error:null};
  if(entryResult.error)throw new Error("Não foi possível carregar os lançamentos.");
  const entries=(entryResult.data??[]) as FundEntry[];
  const total=totals.find(t=>t.ministry_key===selected.key&&t.scope==="ministry")??EMPTY_TOTAL;
  const eventTotal=event?(totals.find(t=>t.scope==="event"&&t.scope_id===event.id)??EMPTY_TOTAL):null;
  const ledgerUrl=`${url}&aba=${tab}${event?`&evento=${event.id}`:""}`;
  return <main className="mf-page">
    <header className="mf-header"><Link href={access.isAdmin?root:"/admin/meu-ministerio"}>← {access.isAdmin?"Todos os ministérios":"Meu ministério"}</Link><nav aria-label="Trocar ministério">{access.ministries.map(m=><Link key={m.key} href={`${root}?ministerio=${m.key}`} aria-current={m.key===selected.key?"page":undefined}>{m.label}</Link>)}</nav></header>
    <section className="mf-hero"><p>EVENTOS DO MINISTÉRIO</p><h1>{selected.label}</h1><p>Organize eventos, registre cada valor e acompanhe os sonhos da equipe.</p></section>
    <Stats total={total}/>
    <p className="mf-note">Saldo inicial: {money(total.other_in_cents)}. Materiais / serviços doados: {money(total.in_kind_cents)} estimados, fora do saldo. Pedidos online entram automaticamente após confirmação do PagSeguro; dinheiro, após confirmação do líder. Valores brutos; registre taxas como despesas.</p>
    <nav className="mf-tabs" aria-label="Áreas do ministério">{[["eventos","Eventos"],["caixinha","Caixinha"],["sonhos","Painel de sonhos"]].map(([key,label])=><Link key={key} href={`${url}&aba=${key}`} aria-current={tab===key?"page":undefined}>{label}</Link>)}</nav>
    {tab==="eventos"&&!event&&<>
      <details className="mf-panel"><summary>＋ Criar evento do ministério</summary><EventForm ministryKey={selected.key} id={randomUUID()} today={today}/></details>
      <section className="mf-grid" aria-label="Eventos do ministério">{events.length===0?<p className="mf-empty">Nenhum evento registrado. Comece criando o primeiro evento da equipe.</p>:events.map(e=>{const t=totals.find(t=>t.scope==="event"&&t.scope_id===e.id)??EMPTY_TOTAL;return <article className="mf-card" key={e.id}><span>{dateLabel(e.event_date)} · {e.status==="planned"?"Em andamento":e.status==="completed"?"Realizado":"Arquivado"}</span><h2>{e.title}</h2><p>{e.description}</p><dl><div><dt>Vendas + doações</dt><dd>{money(Number(t.sales_cents)+Number(t.donations_cents))}</dd></div><div><dt>Despesas</dt><dd>{money(t.expenses_cents)}</dd></div><div><dt>Unidades vendidas</dt><dd>{t.units}</dd></div><div><dt>Resultado</dt><dd>{money(t.balance_cents)}</dd></div></dl><Link className="mf-button" href={`${url}&aba=eventos&evento=${e.id}`}>Abrir evento →</Link></article>;})}</section>
    </>}
    {event&&eventTotal&&<section className="mf-panel"><Link href={`${url}&aba=eventos`}>← Lista de eventos</Link><h2>{event.title}</h2><p>{dateLabel(event.event_date)} · {event.description}</p><Stats total={eventTotal} event/><p>Doações de materiais / serviços: {money(eventTotal.in_kind_cents)} estimados (não entram no caixa).</p><details><summary>Editar informações do evento</summary><EventForm ministryKey={selected.key} id={event.id} event={event} today={today}/></details></section>}
    {(tab==="caixinha"||event)&&<>
      {event&&event.status!=="archived"&&<section className="mf-panel"><h2>Divulgação e pedidos no site</h2><p>{publication?.is_public?"Publicado para toda a Casa":"Ainda não publicado"}</p>{publication?.is_public&&<Link className="mf-button" href={`/eventos/${publication.slug}`} target="_blank">Ver página pública ↗</Link>}<details open={!publication}><summary>Produtos, foto e formas de recebimento</summary><PublicationForm key={publication?.slug||event.id} event={event} publication={publication}/></details></section>}
      {event&&<section className="mf-panel"><h2>Pedidos do site · {orders.length}</h2><p>Somente pagamentos confirmados compõem o saldo. Não lance novamente estes pedidos como venda manual.</p><Link href={`/admin/eventos/ingressos?evento=${event.id}`}>Abrir leitor de ingressos →</Link>{orders.length===0?<p>Nenhum pedido recebido.</p>:<div className="mf-ledger">{orders.map(order=>{const ticket=tickets.data?.find(t=>t.registration_id===order.id);return <article key={order.id}><header><strong>{order.full_name}</strong><strong>{money(order.order_total_cents)}</strong></header><p>{order.ministry_items.map(p=>`${p.quantity} × ${p.name}`).join(" · ")}</p><p>{METHOD_LABELS[order.ministry_method]} · {order.status==="confirmed"?"Pago":order.status==="awaiting_payment"?"Aguardando pagamento":order.status==="cancelled"?"Cancelado":order.status}</p><small>{order.phone} · referência {order.id.slice(0,8)}</small>{order.ministry_method==="cash"&&order.status==="awaiting_payment"&&<CashConfirmation id={order.id}/>} {ticket&&<p><Link target="_blank" href={`/ingressos/${ticket.public_token}`}>Abrir ingresso</Link></p>}</article>;})}</div>}</section>}
      {(!event||event.status!=="archived")&&<details className="mf-panel"><summary>＋ Registrar venda, gasto ou doação</summary><EntryForm key={`entry-${entryResult.count}`} ministryKey={selected.key} id={randomUUID()} today={today} events={events} dreams={dreams} eventId={event?.id}/></details>}
      <section className="mf-panel"><h2>{event?"Lançamentos deste evento":"Movimentações da caixinha"}</h2><p>Para vendas, informe o produto, as unidades e o valor total efetivamente recebido. Registre taxas como despesas separadas.</p>
        {entries.length===0?<p className="mf-empty">Nenhum lançamento registrado.</p>:<div className="mf-ledger">{entries.map(e=><article key={e.id} data-void={!!e.voided_at}><header><span>{ENTRY_KINDS[e.kind]} · {dateLabel(e.occurred_on)}</span><strong>{money(e.amount_cents)}</strong></header><h3>{e.description}</h3><p>{e.quantity>0?`${e.quantity} ${e.kind==="sale"?"unidades vendidas":"unidades doadas"} · `:""}{e.event_id?events.find(v=>v.id===e.event_id)?.title:"Caixinha geral"}{e.dream_id?` · Sonho: ${dreams.find(d=>d.id===e.dream_id)?.title}`:""}</p><small>Registrado em {new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"}).format(new Date(e.created_at))} · referência {e.id.slice(0,8)}</small>{e.voided_at?<p className="mf-cancelled">Cancelado: {e.void_reason}</p>:<VoidForm ministryKey={selected.key} id={e.id}/>}</article>)}</div>}
        <nav className="mf-pagination">{page>1&&<Link href={`${ledgerUrl}&pagina=${page-1}`}>← Anteriores</Link>}<span>Página {page} · {entryResult.count??0} registros</span>{page*50<(entryResult.count??0)&&<Link href={`${ledgerUrl}&pagina=${page+1}`}>Próximos →</Link>}</nav>
      </section>
    </>}
    {tab==="sonhos"&&<>
      <details className="mf-panel"><summary>＋ Criar sonho / meta de compra</summary><DreamForm ministryKey={selected.key} id={randomUUID()}/></details>
      <section className="mf-grid" aria-label="Painel de sonhos">{dreams.length===0?<p className="mf-empty">O que o ministério deseja conquistar? Cadastre uma meta de compra.</p>:dreams.map(d=>{const t=totals.find(t=>t.scope==="dream"&&t.scope_id===d.id)??EMPTY_TOTAL;const progress=dreamProgress(t.balance_cents,d.target_cents);return <article className="mf-card" key={d.id}><span>{d.status==="active"?"Arrecadando":d.status==="purchased"?"Comprado / realizado":"Arquivado"}</span><h2>{d.title}</h2><p>{d.description}</p><strong className="mf-goal-value">Meta: {money(d.target_cents)}</strong><progress max={100} value={progress.percent} aria-label={`Progresso de ${d.title}`}/><p>{progress.percent}% · saldo destinado: {money(t.balance_cents)}</p><p>Faltam {money(progress.remaining)}</p><small>Entradas menos saídas vinculadas a este sonho. Já faz parte do saldo do ministério; não some novamente.</small><details><summary>Editar sonho</summary><DreamForm ministryKey={selected.key} id={d.id} dream={d}/></details></article>;})}</section>
    </>}
  </main>;
}
