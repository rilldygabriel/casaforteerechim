import { NextRequest,NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { isPagBankConfigured } from "@/lib/pagbank";
import { normalizePhone } from "@/lib/events";
export const runtime="nodejs";
export async function POST(request:NextRequest,{params}:{params:Promise<{slug:string}>}){
  if(request.headers.get("origin")!==request.nextUrl.origin)return NextResponse.json({error:"Origem inválida."},{status:403});
  try{
    if(Number(request.headers.get("content-length"))>12000)return NextResponse.json({error:"Pedido muito grande."},{status:413});
    const body=await request.json(),{slug}=await params;
    const name=String(body.name||"").trim(),email=String(body.email||"").trim().toLowerCase(),phone=normalizePhone(String(body.phone||""));
    if(!/^[0-9a-f-]{36}$/i.test(body.id)||name.length<3||name.length>160||email.length>254||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||phone.length<10||phone.length>13||!body.consent)return NextResponse.json({error:"Confira seu nome, telefone e autorização de contato."},{status:400});
    if(body.method!=="cash"&&(!email||!isPagBankConfigured()))return NextResponse.json({error:!email?"Informe um e-mail para receber o comprovante.":"Pagamento online temporariamente indisponível."},{status:400});
    const {data,error}=await getSupabaseServiceClient().rpc("create_ministry_order",{p_id:body.id,p_slug:slug,p_name:name,p_email:email||null,p_phone:phone,p_items:body.items,p_method:body.method});
    if(error){const message=error.message.includes("CAPACITY_EXCEEDED")?"Não há unidades suficientes. Diminua a quantidade.":error.message.includes("REGISTRATION_CLOSED")?"Os pedidos deste evento estão fechados.":"Não foi possível reservar. Confira os itens e a forma de pagamento.";return NextResponse.json({error:message},{status:409});}
    return NextResponse.json({ok:true,...data},{headers:{"Cache-Control":"no-store"}});
  }catch{return NextResponse.json({error:"Não foi possível criar o pedido. Tente novamente."},{status:400});}
}
