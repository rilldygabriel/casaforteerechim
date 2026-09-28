"use client";
import { useRef,useState } from "react";
import dynamic from "next/dynamic";
import { METHOD_LABELS,type MinistryProduct,type MinistryMethod } from "@/lib/ministry-event-policy";
import { money } from "@/lib/ministry-funds";
import styles from "./ministry-order.module.css";
const Payment=dynamic(()=>import("./pagbank-event-payment"),{ssr:false});
type Order={registrationId:string;paymentId:string|null;amountCents:number;method:MinistryMethod;status:string};
export default function MinistryOrderForm({slug,products,methods,enabled,member}:{slug:string;products:MinistryProduct[];methods:MinistryMethod[];enabled:boolean;member:{fullName:string;phone:string;email:string}|null}){
  const [quantities,setQuantities]=useState<Record<string,number>>({}),[method,setMethod]=useState<MinistryMethod>(methods[0]);
  const [order,setOrder]=useState<Order|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[name,setName]=useState(member?.fullName||"");
  const requestId=useRef<string|null>(null),lock=useRef(false);
  const total=products.reduce((n,p)=>n+p.price_cents*(quantities[p.id]||0),0);
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError("");
    const fields=new FormData(e.currentTarget);
    if(!requestId.current){try{requestId.current=sessionStorage.getItem(`ministry-order:${slug}`);}catch{}requestId.current??=crypto.randomUUID();try{sessionStorage.setItem(`ministry-order:${slug}`,requestId.current);}catch{}}
    try{const response=await fetch(`/api/eventos/${encodeURIComponent(slug)}/pedidos-ministerio`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:requestId.current,name,email:fields.get("email"),phone:fields.get("phone"),consent:fields.get("consent")==="on",method,items:products.filter(p=>quantities[p.id]>0).map(p=>({id:p.id,quantity:quantities[p.id]}))})});const data=await response.json();if(!response.ok)throw new Error(data.error);setOrder(data);}
    catch(e){setError(e instanceof Error?e.message:"Erro ao criar pedido.");}finally{setBusy(false);lock.current=false;}
  }
  function newOrder(){try{sessionStorage.removeItem(`ministry-order:${slug}`);}catch{}requestId.current=null;setOrder(null);setQuantities({});}
  if(order?.method==="cash")return <section className={styles.form} role="status"><h2>{order.status==="confirmed"?"Pagamento confirmado":order.status==="cancelled"?"Pedido cancelado":"Pedido reservado"}</h2><p>Total: {money(order.amountCents)} · pagamento em dinheiro no local.</p>{order.status==="awaiting_payment"&&<p>Ainda não está pago. O responsável confirmará quando receber.</p>}<small>Referência: {order.registrationId}</small><p><button type="button" onClick={newOrder}>Fazer outro pedido</button></p></section>;
  if(order?.paymentId)return <section className={styles.form}><Payment slug={slug} paymentId={order.paymentId} amountCents={order.amountCents} fullName={name} maxInstallments={1} allowedMethods={[order.method as "pix"|"card"]}/><p>Guarde esta página até concluir. Só faça outro pedido se quiser comprar mais itens ou se esta cobrança estiver encerrada. Não pague novamente um valor já debitado.</p><button type="button" onClick={newOrder}>Fazer outro pedido</button></section>;
  if(!enabled)return <section className={styles.form}><h2>Pedidos indisponíveis</h2><p>As vendas estão encerradas ou as unidades estão esgotadas.</p></section>;
  return <form className={styles.form} onSubmit={submit}><h2>Escolha seus itens</h2><fieldset disabled={busy}>
    {products.map(p=><article className={styles.product} key={p.id}><div><strong>{p.name}</strong><span>{money(p.price_cents)}</span></div><div className={styles.quantity}><button type="button" aria-label={`Diminuir ${p.name}`} disabled={!quantities[p.id]} onClick={()=>setQuantities({...quantities,[p.id]:(quantities[p.id]||0)-1})}>−</button><output aria-label={`Quantidade de ${p.name}`}>{quantities[p.id]||0}</output><button type="button" aria-label={`Aumentar ${p.name}`} disabled={(quantities[p.id]||0)>=1000} onClick={()=>setQuantities({...quantities,[p.id]:(quantities[p.id]||0)+1})}>＋</button></div></article>)}
    <label>Seu nome<input required minLength={3} maxLength={160} value={name} autoComplete="name" onChange={e=>setName(e.target.value)}/></label>
    <label>Telefone / WhatsApp<input required name="phone" type="tel" autoComplete="tel" defaultValue={member?.phone||""} maxLength={20}/></label>
    <label>E-mail {method==="cash"?"(opcional)":"para o comprovante"}<input name="email" type="email" autoComplete="email" required={method!=="cash"} defaultValue={member?.email||""} maxLength={254}/></label>
    <fieldset><legend>Como deseja pagar?</legend>{methods.map(m=><label className={styles.choice} key={m}><input type="radio" name="method" checked={method===m} onChange={()=>setMethod(m)}/>{METHOD_LABELS[m]}</label>)}</fieldset>
    <label className={styles.choice}><input name="consent" type="checkbox" required/>Autorizo o uso desses dados para organizar meu pedido e enviar o comprovante.</label>
    <strong className={styles.total}>Total {money(total)}</strong><button disabled={total===0} type="submit">{busy?"Reservando…":method==="cash"?"Reservar e pagar em dinheiro":"Continuar para pagamento"}</button>
    <p>Escolha quantas unidades desejar, dentro da disponibilidade. Pix e cartão processados pelo PagSeguro; cartão em 1 vez.</p>
  </fieldset>{error&&<p role="alert">{error}</p>}</form>;
}
