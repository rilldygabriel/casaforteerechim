const phone='5554993217227';
const groupUrl='https://chat.whatsapp.com/Ix3EKdZymHEAhYpgVqUzQG?mode=gi_t';
const SUPABASE_URL='https://mfqlmsisrceyajspeeav.supabase.co';
const SUPABASE_KEY='sb_publishable_0UsdpSSgbF0pADTG-Viazw_vIphuNnE';
const supabaseClient=window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY);

const year=document.getElementById('year'); if(year) year.textContent=new Date().getFullYear();
document.querySelectorAll('[data-copy]').forEach(btn=>btn.addEventListener('click',async()=>{const text=document.getElementById(btn.dataset.copy).textContent.trim();try{await navigator.clipboard.writeText(text);const old=btn.textContent;btn.textContent='Chave copiada!';setTimeout(()=>btn.textContent=old,1800)}catch{prompt('Copie a chave Pix:',text)}}));
const openWhatsApp=(message)=>window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`,'_blank');

const visitor=document.getElementById('visitorForm');
visitor?.addEventListener('submit',async event=>{
  event.preventDefault();
  const submit=document.getElementById('visitorSubmit');
  const status=document.getElementById('visitorStatus');
  const success=document.getElementById('visitorSuccess');
  const data=new FormData(visitor);

  if(!supabaseClient){
    status.textContent='Não foi possível conectar ao cadastro. Tente novamente em instantes.';
    return;
  }

  submit.disabled=true;
  submit.textContent='Enviando cadastro...';
  status.textContent='';

  const payload={
    nome:String(data.get('nome')||'').trim(),
    telefone:String(data.get('telefone')||'').trim(),
    cidade:String(data.get('cidade')||'').trim(),
    bairro:String(data.get('bairro')||'').trim(),
    acompanhamento:data.get('suporteLider')==='Sim',
    convidado_por:String(data.get('convidadoPor')||'').trim()||null,
    igreja_anterior:String(data.get('igrejaAnterior')||'').trim()||null,
    passo_fe:data.get('passoFe'),
    mensagem_pastor:data.get('mensagemPastor')==='Sim',
    experiencia_culto:data.get('experienciaCulto'),
    voltar_culto:data.get('voltarCasa'),
    data_visita:new Date().toISOString().slice(0,10),
    status_acompanhamento:'novo'
  };

  const {error}=await supabaseClient.from('visitantes').insert(payload);
  if(error){
    console.error(error);
    status.textContent='Não foi possível enviar agora. Confira sua conexão e tente novamente.';
    submit.disabled=false;
    submit.textContent='Enviar ficha de visitante';
    return;
  }

  visitor.reset();
  visitor.hidden=true;
  success.hidden=false;
  success.scrollIntoView({behavior:'smooth',block:'center'});
});

const prayer=document.getElementById('prayerForm');
prayer?.addEventListener('submit',event=>{event.preventDefault();const data=new FormData(prayer);openWhatsApp(`Olá! Gostaria de enviar um pedido de oração.\n\nNome: ${data.get('nome')||'Anônimo'}\nPedido: ${data.get('pedido')}`)});

const footerBar=document.querySelector('.bottom .wrap');
if(footerBar && !document.getElementById('adminAccessButton')){
  const adminButton=document.createElement('a');
  adminButton.id='adminAccessButton';
  adminButton.href='admin.html';
  adminButton.className='button primary';
  adminButton.textContent='Painel Administrativo';
  adminButton.setAttribute('aria-label','Acessar o painel administrativo da Casa Forte');
  footerBar.appendChild(adminButton);
}