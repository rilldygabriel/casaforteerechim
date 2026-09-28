import Image from "next/image";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { money,dateLabel } from "@/lib/ministry-funds";
import { getSupabaseConfig } from "@/lib/supabase/config";
export default async function MinistryPublicEvents(){
  // Public RLS only: this homepage component never receives a service key or private data.
  const {url,publishableKey}=getSupabaseConfig();
  const db=createClient(url,publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo"}).format(new Date());
  const {data,error}=await db.from("events").select("id,title,slug,start_date,image_url,registration_fee_cents").not("ministry_key","is",null).eq("is_public",true).eq("registration_status","open").is("archived_at",null).neq("status","cancelled").gte("start_date",today).order("start_date").limit(12);
  if(error||!data?.length)return null;
  return <section className="home-ministry-events" aria-label="Eventos dos ministérios"><p className="home-kicker">Juntos pelos ministérios</p><h2>Participe e contribua</h2><div>{data.map(event=><Link key={event.id} href={`/eventos/${event.slug}`}>{event.image_url&&<Image src={event.image_url} alt={event.title} width={600} height={360} sizes="(max-width:650px) 100vw,33vw"/>}<span>{dateLabel(event.start_date)}</span><h3>{event.title}</h3><p>A partir de {money(event.registration_fee_cents)}</p><strong>Escolher produtos →</strong></Link>)}</div></section>;
}
