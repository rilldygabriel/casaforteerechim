"use server";
import { revalidatePath } from "next/cache";
import { ministryFundAccess } from "@/lib/ministry-funds-server";
import { ENTRY_KINDS, parseCents, validDate, type EntryKind } from "@/lib/ministry-funds";

export type FundActionState={ok:boolean;message:string};
function text(data:FormData,key:string,max:number,min=0) {
  const value=String(data.get(key)??"").trim();
  if(value.length<min||value.length>max) throw new Error(`Confira o campo ${key}: de ${min} a ${max} caracteres.`);
  return value;
}
function uuid(value:string) {
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error("Identificador inválido. Atualize a página.");
  return value;
}
export async function saveMinistryFund(_state:FundActionState,data:FormData):Promise<FundActionState> {
  try {
    const access=await ministryFundAccess();
    if(!access) return {ok:false,message:"Você não tem acesso ou sua sessão expirou."};
    const ministryKey=text(data,"ministry_key",80,1);
    if(!access.ministries.some(m=>m.key===ministryKey)) return {ok:false,message:"Você não gerencia este ministério."};
    const id=uuid(text(data,"id",36,36));
    const action=text(data,"operation",20,1);
    const {db}=access;
    let result;
    if(action==="event"||action==="dream") {
      const title=text(data,"title",120,3),description=text(data,"description",2000);
      const status=text(data,"status",20,1);
      if(!(action==="event"?["planned","completed","archived"]:["active","purchased","archived"]).includes(status)) throw new Error("Situação inválida.");
      const payload=action==="event"?{title,description,status,event_date:validDate(text(data,"event_date",10,10))}:{title,description,status,target_cents:parseCents(text(data,"target",30,1))};
      if("target_cents" in payload && !payload.target_cents) throw new Error("A meta precisa ser maior que zero.");
      const table=action==="event"?"ministry_fund_events":"ministry_fund_dreams";
      result=data.get("editing")==="true"?await db.from(table).update(payload).eq("id",id).eq("ministry_key",ministryKey).select("id").single():await db.from(table).insert({...payload,id,ministry_key:ministryKey}).select("id").single();
    } else if(action==="entry") {
      const kind=text(data,"kind",25,1) as EntryKind;
      if(!Object.hasOwn(ENTRY_KINDS,kind)) throw new Error("Tipo de lançamento inválido.");
      const amount=parseCents(text(data,"amount",30,1));
      if(kind!=="in_kind"&&amount===0) throw new Error("Informe um valor maior que zero.");
      const quantityText=text(data,"quantity",10)||"0";
      if(!/^\d+$/.test(quantityText)) throw new Error("Informe uma quantidade inteira.");
      const quantity=Number(quantityText);
      if(quantity>1000000||(kind==="sale"&&quantity<1)||(kind!=="sale"&&kind!=="in_kind"&&quantity!==0)) throw new Error("Confira a quantidade de unidades.");
      const event=text(data,"event_id",36),dream=text(data,"dream_id",36);
      if(kind==="sale"&&!event) throw new Error("Selecione o evento desta venda.");
      if(kind==="opening_balance"&&(event||dream)) throw new Error("O saldo inicial pertence à caixinha, não a um evento ou sonho.");
      // RLS and composite foreign keys also enforce same-ministry ownership.
      for(const [table,ref] of [["ministry_fund_events",event],["ministry_fund_dreams",dream]]) {
        if(!ref) continue;
        const linked=await db.from(table).select("id,status").eq("id",uuid(ref)).eq("ministry_key",ministryKey).maybeSingle();
        if(linked.error||!linked.data||linked.data.status==="archived") throw new Error("O evento ou sonho não está disponível neste ministério.");
      }
      result=await db.from("ministry_fund_entries").insert({id,ministry_key:ministryKey,kind,amount_cents:amount,quantity,event_id:event||null,dream_id:dream||null,description:text(data,"description",500,3),occurred_on:validDate(text(data,"occurred_on",10,10))}).select("id").single();
    } else if(action==="void") {
      result=await db.from("ministry_fund_entries").update({voided_at:new Date().toISOString(),void_reason:text(data,"reason",500,3)}).eq("id",id).eq("ministry_key",ministryKey).is("voided_at",null).select("id").single();
    } else throw new Error("Operação inválida.");
    if(result.error) {
      if(result.error.code==="23505") return {ok:false,message:"Este registro já foi salvo ou já existe um saldo inicial ativo. Atualize a página antes de lançar novamente."};
      console.error("ministry-fund-save",{code:result.error.code,operation:action});
      return {ok:false,message:"Não foi possível salvar. Confira suas permissões e atualize a página antes de tentar novamente."};
    }
    revalidatePath("/admin/ministerios/eventos");
    revalidatePath("/admin/meu-ministerio");
    return {ok:true,message:action==="void"?"Lançamento cancelado; histórico preservado e saldo atualizado.":"Salvo com sucesso."};
  } catch(error) {
    return {ok:false,message:error instanceof Error?error.message:"Não foi possível salvar."};
  }
}
