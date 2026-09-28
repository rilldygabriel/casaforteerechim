"use client";
import Image from "next/image";
import { useActionState, useState } from "react";
import { publishMinistryEvent, confirmMinistryCash } from "./publication-actions";
import { METHOD_LABELS, type MinistryProduct, type MinistryMethod } from "@/lib/ministry-event-policy";
import { parseCents, type FundEvent } from "@/lib/ministry-funds";
export type Publication={image_url:string|null;start_time:string|null;location:string;capacity:number|null;is_public:boolean;slug:string;ministry_products:MinistryProduct[];ministry_payment_methods:MinistryMethod[]};
export function PublicationForm({event,publication}:{event:FundEvent;publication:Publication|null}){
  const [state,action,pending]=useActionState(publishMinistryEvent,{ok:false,message:""});
  const [products,setProducts]=useState((publication?.ministry_products||[{id:"produto-1",name:"",price_cents:0}]).map(p=>({...p,price:(p.price_cents/100).toFixed(2).replace(".",",")})));
  const [image,setImage]=useState(publication?.image_url||""),[uploading,setUploading]=useState(false),[error,setError]=useState("");
  async function upload(file:File){setUploading(true);setError("");try{const response=await fetch(`/api/admin/ministerios/imagem?ministerio=${encodeURIComponent(event.ministry_key)}`,{method:"POST",headers:{"Content-Type":file.type},body:file});const data=await response.json();if(!response.ok)throw new Error(data.error);setImage(data.url);}catch(e){setError(e instanceof Error?e.message:"Erro ao carregar foto.");}finally{setUploading(false);}}
  const payload=products.map(p=>{let price=0;try{price=parseCents(p.price);}catch{}return{id:p.id,name:p.name,price_cents:price};});
  return <form action={action} className="mf-form"><input type="hidden" name="id" value={event.id}/><input type="hidden" name="ministry_key" value={event.ministry_key}/><input type="hidden" name="image" value={image}/><input type="hidden" name="products" value={JSON.stringify(payload)}/>
    <fieldset disabled={pending||uploading}>
      <label>Título público<input name="title" required minLength={3} maxLength={120} defaultValue={event.title}/></label>
      <label>Descrição de divulgação<textarea name="description" maxLength={2000} rows={4} defaultValue={event.description}/></label>
      <div className="mf-grid"><label>Data<input type="date" name="date" required defaultValue={event.event_date}/></label><label>Horário<input type="time" name="time" defaultValue={publication?.start_time?.slice(0,5)||""}/></label></div>
      <label>Local<input name="location" maxLength={200} defaultValue={publication?.location||"Igreja Casa Forte Erechim"}/></label>
      <label>Foto de divulgação (até 4 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{if(e.target.files?.[0])void upload(e.target.files[0]);}}/></label>
      {image&&<Image src={image} alt="Prévia da divulgação" width={640} height={360} style={{width:"100%",height:"auto",maxHeight:260,objectFit:"contain",borderRadius:16}}/>}
      <h3>Produtos / itens à venda</h3>
      {products.map((p,index)=><div className="mf-product-editor" key={p.id}><label>Produto {index+1}<input required minLength={2} maxLength={100} value={p.name} onChange={e=>setProducts(products.map(x=>x.id===p.id?{...x,name:e.target.value}:x))}/></label><label>Preço (R$)<input required inputMode="decimal" value={p.price} onChange={e=>setProducts(products.map(x=>x.id===p.id?{...x,price:e.target.value}:x))}/></label>{products.length>1&&<button type="button" onClick={()=>setProducts(products.filter(x=>x.id!==p.id))}>Remover item</button>}</div>)}
      {products.length<10&&<button type="button" onClick={()=>setProducts([...products,{id:crypto.randomUUID(),name:"",price_cents:0,price:""}])}>＋ Adicionar produto</button>}
      <label>Limite total de unidades (opcional)<input name="capacity" type="number" min={1} max={1000000} defaultValue={publication?.capacity??""}/></label>
      <fieldset><legend>Formas de recebimento</legend>{Object.entries(METHOD_LABELS).map(([key,label])=><label className="mf-check" key={key}><input type="checkbox" name="methods" value={key} defaultChecked={(publication?.ministry_payment_methods||["pix","card"]).includes(key as MinistryMethod)}/>{label}</label>)}</fieldset>
      <p>Pix e cartão passam pelo PagSeguro. Dinheiro é reservado e só entra na caixinha após sua confirmação. As taxas devem ser registradas como despesas; não repita o recebimento como venda manual.</p>
      <div className="mf-grid"><button name="publish" value="yes">{pending?"Salvando…":"Publicar no site e abrir pedidos"}</button><button name="publish" value="no">Salvar sem publicar / retirar do site</button></div>
    </fieldset>{uploading&&<p role="status">Preparando foto…</p>}{error&&<p role="alert">{error}</p>}{state.message&&<p role={state.ok?"status":"alert"}>{state.message}</p>}
  </form>;
}
export function CashConfirmation({id}:{id:string}){
  const [state,action,pending]=useActionState(confirmMinistryCash,{ok:false,message:""});
  return <details><summary>Confirmar dinheiro / cancelar reserva</summary><form action={action} className="mf-form"><input type="hidden" name="id" value={id}/><p>Confirme apenas depois de receber o dinheiro do comprador.</p><button disabled={pending||state.ok} name="cancel" value="no">Recebi o dinheiro</button><button disabled={pending||state.ok} name="cancel" value="yes">Cancelar sem recebimento</button>{state.message&&<p role="status">{state.message}</p>}</form></details>;
}
