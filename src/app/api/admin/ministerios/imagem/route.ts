import sharp from "sharp";
import { NextRequest,NextResponse } from "next/server";
import { ministryFundAccess } from "@/lib/ministry-funds-server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
export const runtime="nodejs";
export async function POST(request:NextRequest){
  if(request.headers.get("origin")!==request.nextUrl.origin)return NextResponse.json({error:"Origem inválida."},{status:403});
  const access=await ministryFundAccess(),key=request.nextUrl.searchParams.get("ministerio");
  if(!access?.ministries.some(m=>m.key===key))return NextResponse.json({error:"Sem permissão neste ministério."},{status:403});
  const size=Number(request.headers.get("content-length")),type=request.headers.get("content-type")||"";
  if(!["image/jpeg","image/png","image/webp"].includes(type)||size<1||size>4*1024*1024)return NextResponse.json({error:"Envie JPG, PNG ou WebP de até 4 MB."},{status:400});
  try{
    const input=Buffer.from(await request.arrayBuffer());
    if(input.length>4*1024*1024)throw new Error("size");
    const output=await sharp(input,{limitInputPixels:40000000}).rotate().resize(1600,1600,{fit:"inside",withoutEnlargement:true}).webp({quality:85}).toBuffer();
    const service=getSupabaseServiceClient(),path=`ministerios/${key}/${crypto.randomUUID()}.webp`;
    const {error}=await service.storage.from("casa-event-images").upload(path,output,{contentType:"image/webp",cacheControl:"31536000",upsert:false});
    if(error)throw error;
    return NextResponse.json({url:service.storage.from("casa-event-images").getPublicUrl(path).data.publicUrl});
  }catch{return NextResponse.json({error:"Não foi possível preparar a foto. Tente outra imagem."},{status:422});}
}
