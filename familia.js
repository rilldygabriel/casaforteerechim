const SUPABASE_URL='https://mfqlmsisrceyajspeeav.supabase.co';
const SUPABASE_KEY='sb_publishable_0UsdpSSgbF0pADTG-Viazw_vIphuNnE';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

const $=id=>document.getElementById(id);
let mode='login';

function show(id){['loading','auth','member'].forEach(v=>$(v).classList.add('hidden'));$(id).classList.remove('hidden');}
function message(text,error=false){const el=$('message');el.textContent=text||'';el.className='msg'+(error?' error':text?' ok':'');}
function setMode(next){mode=next;$('loginTab').classList.toggle('active',next==='login');$('signupTab').classList.toggle('active',next==='signup');$('nameField').classList.toggle('hidden',next!=='signup');$('submit').textContent=next==='signup'?'Criar minha conta':'Entrar';$('password').autocomplete=next==='signup'?'new-password':'current-password';message('');}
function openMember(session){$('memberEmail').textContent=session.user.email||'';show('member');}

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
    if(mode==='signup'){
      const {data,error}=await db.auth.signUp({email,password,options:{data:{full_name:fullName}}});
      if(error)throw error;
      if(data.session){openMember(data.session);}else{setMode('login');message('Conta criada. Confirme seu e-mail e depois entre.');}
    }else{
      const {data,error}=await db.auth.signInWithPassword({email,password});
      if(error)throw error;
      if(!data.session)throw new Error('O login não criou uma sessão.');
      openMember(data.session);
    }
  }catch(error){message(error.message||'Não foi possível continuar.',true);}
  finally{$('submit').disabled=false;$('submit').textContent=mode==='signup'?'Criar minha conta':'Entrar';}
};

$('forgot').onclick=async()=>{
  const email=$('email').value.trim().toLowerCase();
  if(!email)return message('Digite seu e-mail.',true);
  const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/familia.html'});
  message(error?error.message:'Link de recuperação enviado.',!!error);
};

$('logout').onclick=async()=>{await db.auth.signOut();message('');show('auth');};

db.auth.onAuthStateChange((event,session)=>{
  if(event==='SIGNED_IN'&&session)openMember(session);
  if(event==='SIGNED_OUT')show('auth');
});

(async()=>{
  const {data}=await db.auth.getSession();
  if(data.session)openMember(data.session);else show('auth');
})();