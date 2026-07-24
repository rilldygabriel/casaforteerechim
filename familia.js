const SUPABASE_URL='https://mfqlmsisrceyajspeeav.supabase.co';
const SUPABASE_KEY='sb_publishable_0UsdpSSgbF0pADTG-Viazw_vIphuNnE';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

const $=id=>document.getElementById(id);
let mode='login';
let opening=false;

function show(id){['loading','auth','member'].forEach(v=>$(v).classList.add('hidden'));$(id).classList.remove('hidden');}
function message(text,error=false){const el=$('message');el.textContent=text||'';el.className='msg'+(error?' error':text?' ok':'');}
function profileMessage(text,error=false){const el=$('profileMessage');el.textContent=text||'';el.className='msg'+(error?' error':'');}
function setMode(next){mode=next;$('loginTab').classList.toggle('active',next==='login');$('signupTab').classList.toggle('active',next==='signup');$('nameField').classList.toggle('hidden',next!=='signup');$('submit').textContent=next==='signup'?'Criar minha conta':'Entrar';$('password').autocomplete=next==='signup'?'new-password':'current-password';message('');}
function initials(name){return (name||'CF').trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'CF';}

async function profileRequest(session){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_my_profile`,{
    method:'POST',
    headers:{
      apikey:SUPABASE_KEY,
      Authorization:`Bearer ${session.access_token}`,
      'Content-Type':'application/json'
    },
    body:'{}'
  });
  if(!response.ok){
    const body=await response.json().catch(()=>({}));
    throw new Error(body.message||body.error_description||`Erro ${response.status}`);
  }
  return response.json();
}

async function validSession(session){
  if(!session?.access_token||!session?.user?.id)return null;
  const expiresAt=Number(session.expires_at||0)*1000;
  if(expiresAt&&expiresAt>Date.now()+30000)return session;
  const refreshed=await db.auth.refreshSession();
  if(refreshed.error||!refreshed.data.session)return null;
  return refreshed.data.session;
}

async function openMember(initialSession){
  if(opening)return;
  opening=true;
  show('loading');
  profileMessage('');
  try{
    let session=await validSession(initialSession);
    if(!session)throw new Error('Sua sessão expirou. Entre novamente.');

    let data;
    try{
      data=await profileRequest(session);
    }catch(firstError){
      const refreshed=await db.auth.refreshSession();
      if(refreshed.error||!refreshed.data.session)throw firstError;
      session=refreshed.data.session;
      data=await profileRequest(session);
    }

    if(!data)throw new Error('Perfil não encontrado para esta conta.');

    const name=data.full_name||'Bem-vindo';
    $('memberName').textContent=name;
    $('memberEmail').textContent=data.email||session.user.email||'';
    $('memberStatus').textContent=data.church_status||'visitante';
    $('profileState').textContent=data.profile_completed?'Completo':'Ainda não preenchido';

    if(data.photo_url){
      $('avatar').innerHTML=`<img src="${data.photo_url}" alt="Foto de perfil">`;
    }else{
      $('avatar').textContent=initials(name);
    }
    show('member');
  }catch(error){
    show('auth');
    message(error.message||'Não foi possível carregar seu perfil.',true);
  }finally{
    opening=false;
  }
}

$('loginTab').onclick=()=>setMode('login');
$('signupTab').onclick=()=>setMode('signup');

$('submit').onclick=async()=>{
  const email=$('email').value.trim().toLowerCase();
  const password=$('password').value;
  const fullName=$('name').value.trim();
  if(!email||!password)return message('Preencha e-mail e senha.',true);
  if(mode==='signup'&&!fullName)return message('Informe seu nome completo.',true);
  if(password.length<6)return message('A senha precisa ter pelo menos 6 caracteres.',true);

  $('submit').disabled=true;
  $('submit').textContent='Aguarde…';
  message('');
  try{
    let result;
    if(mode==='signup'){
      result=await db.auth.signUp({email,password,options:{data:{full_name:fullName}}});
      if(result.error)throw result.error;
      if(!result.data.session){setMode('login');message('Conta criada. Confirme seu e-mail e depois entre.');return;}
    }else{
      result=await db.auth.signInWithPassword({email,password});
      if(result.error)throw result.error;
    }
    if(!result.data.session)throw new Error('O login não criou uma sessão.');
    await openMember(result.data.session);
  }catch(error){
    show('auth');
    message(error.message||'Não foi possível continuar.',true);
  }finally{
    $('submit').disabled=false;
    $('submit').textContent=mode==='signup'?'Criar minha conta':'Entrar';
  }
};

$('forgot').onclick=async()=>{
  const email=$('email').value.trim().toLowerCase();
  if(!email)return message('Digite seu e-mail.',true);
  const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/familia.html'});
  message(error?error.message:'Link de recuperação enviado.',!!error);
};

$('logout').onclick=async()=>{await db.auth.signOut();message('');show('auth');};

db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')show('auth');});

(async()=>{
  const {data,error}=await db.auth.getSession();
  if(error||!data.session){show('auth');return;}
  await openMember(data.session);
})();