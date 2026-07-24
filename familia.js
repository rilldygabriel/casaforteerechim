const SUPABASE_URL='https://mfqlmsisrceyajspeeav.supabase.co';
const SUPABASE_KEY='sb_publishable_0UsdpSSgbF0pADTG-Viazw_vIphuNnE';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

const $=id=>document.getElementById(id);
let mode='login';

function show(id){['loading','auth','member'].forEach(v=>$(v).classList.add('hidden'));$(id).classList.remove('hidden');}
function message(text,error=false){const el=$('message');el.textContent=text||'';el.className='msg'+(error?' error':text?' ok':'');}
function profileMessage(text,error=false){const el=$('profileMessage');el.textContent=text||'';el.className='msg'+(error?' error':'');}
function setMode(next){mode=next;$('loginTab').classList.toggle('active',next==='login');$('signupTab').classList.toggle('active',next==='signup');$('nameField').classList.toggle('hidden',next!=='signup');$('submit').textContent=next==='signup'?'Criar minha conta':'Entrar';$('password').autocomplete=next==='signup'?'new-password':'current-password';message('');}
function initials(name){return (name||'CF').trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'CF';}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function openMember(session){
  if(!session?.user?.id){show('auth');return;}
  show('loading');
  profileMessage('');

  const userCheck=await db.auth.getUser();
  if(userCheck.error||!userCheck.data.user){
    await db.auth.signOut();
    show('auth');
    return message('Sua sessão expirou. Entre novamente.',true);
  }

  let result=await db.rpc('get_my_profile');
  if(result.error){
    await wait(200);
    result=await db.rpc('get_my_profile');
  }

  if(result.error){
    show('auth');
    return message('Não foi possível carregar seu perfil. Entre novamente.',true);
  }

  const data=result.data;
  if(!data){
    show('auth');
    return message('Perfil não encontrado para esta conta.',true);
  }

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
    message(error.message||'Não foi possível continuar.',true);
    show('auth');
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

db.auth.onAuthStateChange(event=>{
  if(event==='SIGNED_OUT')show('auth');
});

(async()=>{
  const {data,error}=await db.auth.getSession();
  if(error||!data.session){show('auth');return;}
  await openMember(data.session);
})();