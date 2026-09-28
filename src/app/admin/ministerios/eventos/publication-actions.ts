"use server";
import { revalidatePath } from "next/cache";
import { ministryFundAccess } from "@/lib/ministry-funds-server";
import { validateMethods, validateProducts } from "@/lib/ministry-event-policy";
import { validDate } from "@/lib/ministry-funds";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { ensureEventTicket } from "@/lib/event-tickets";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type { FundActionState } from "./actions";

export async function publishMinistryEvent(_state:FundActionState,data:FormData):Promise<FundActionState> {
  try {
    const access=await ministryFundAccess(), key=String(data.get("ministry_key")||"");
    if(!access?.ministries.some(m=>m.key===key)) throw new Error("Você não gerencia este ministério.");
    const products=validateProducts(JSON.parse(String(data.get("products")||"[]")));
    const methods=validateMethods(data.getAll("methods"));
    const title=String(data.get("title")||"").trim(), description=String(data.get("description")||"").trim(), location=String(data.get("location")||"").trim();
    if(title.length<3||title.length>120||description.length>2000||location.length>200) throw new Error("Confira o título, a descrição e o local.");
    const image=String(data.get("image")||"");
    const prefix=`${getSupabaseConfig().url}/storage/v1/object/public/casa-event-images/ministerios/${key}/`;
    if(image && (!image.startsWith(prefix)||!/^[-a-f0-9]+\.webp$/.test(image.slice(prefix.length)))) throw new Error("Envie a foto pelo botão de divulgação deste ministério.");
    const capacityText=String(data.get("capacity")||""),capacity=capacityText?Number(capacityText):null;
    if(capacity!==null&&(!Number.isSafeInteger(capacity)||capacity<1||capacity>1000000)) throw new Error("Informe um limite de 1 a 1 milhão de unidades ou deixe vazio.");
    const time=String(data.get("time")||"");
    if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Horário inválido.");
    const publish=data.get("publish")==="yes";
    if(publish&&!image) throw new Error("Carregue a foto de divulgação antes de publicar.");
    const {data:fund,error:fundError}=await access.db.from("ministry_fund_events").select("status").eq("id",String(data.get("id"))).eq("ministry_key",key).single();
    if(fundError||!fund) throw new Error("Evento indisponível para este ministério.");
    if(publish&&fund.status!=="planned") throw new Error("Para abrir as vendas, o evento precisa estar em andamento, não realizado ou arquivado.");
    const {error}=await access.db.rpc("publish_ministry_event",{p_id:String(data.get("id")),p_key:key,p_title:title,p_description:description,p_date:validDate(String(data.get("date"))),p_time:time||null,p_location:location,p_image:image||null,p_products:products,p_methods:methods,p_capacity:capacity,p_publish:publish});
    if(error){console.error("ministry-publish",{code:error.code});throw new Error("Não foi possível salvar. Confira data, foto, produtos e permissões.");}
    for(const path of ["/","/eventos","/calendario","/admin/ministerios/eventos"]) revalidatePath(path);
    return {ok:true,message:publish?"Evento publicado no site. Os pedidos já podem ser feitos.":"Rascunho salvo. O evento não está disponível para novas compras."};
  }catch(error){return {ok:false,message:error instanceof Error?error.message:"Não foi possível salvar."};}
}

export async function confirmMinistryCash(_state:FundActionState,data:FormData):Promise<FundActionState>{
  try{
    const access=await ministryFundAccess();
    if(!access)throw new Error("Sua sessão expirou.");
    const id=String(data.get("id")),cancel=data.get("cancel")==="yes";
    const service=getSupabaseServiceClient();
    const {error}=await service.rpc("confirm_ministry_cash",{p_registration:id,p_actor:access.user.id,p_cancel:cancel});
    if(error)throw new Error("Pedido indisponível ou sem permissão. Atualize o painel.");
    if(!cancel){const {data:order}=await service.from("event_registrations").select("event_id").eq("id",id).single();if(order)await ensureEventTicket({eventId:order.event_id,registrationId:id});}
    revalidatePath("/admin/ministerios/eventos");
    return {ok:true,message:cancel?"Pedido cancelado sem recebimento.":"Dinheiro confirmado. Valor e unidades contabilizados uma única vez."};
  }catch(error){return {ok:false,message:error instanceof Error?error.message:"Não foi possível confirmar."};}
}
