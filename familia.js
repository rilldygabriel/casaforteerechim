const SUPABASE_URL='https://mfqlmsisrceyajspeeav.supabase.co';
const SUPABASE_KEY='sb_publishable_0UsdpSSgbF0pADTG-Viazw_vIphuNnE';
const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

const authArea=document.getElementById('authArea');
const dashboard=document.getElementById('dashboard');
const form=document.getElementById('authForm');
const status=document.getElementById('authStatus');
const submit=document.getElementById('authSubmit');
const nameLabel=document.getElementById('nameLabel');
const nameInput=document.getElementById('name');
const emailInput=document.getElementById('email');
const passwordInput=document.getElementById('password');
let mode='login';

function showDashboard(user){
  authArea.classList.add('hidden');
  dashboard.classList.add('active');
  const name=user.user_metadata?.full_name || user.email?.split('@')[0] || 'Família Casa Forte';
  document.getElementById('welcomeName').textContent=`Olá, ${name}!`;
  document.getElementById('welcomeEmail').textContent=user.email || '';
}

function showAuth(){
  dashboard.classList.remove('active');
  authArea.classList.remove('hidden');
}

document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{
  mode=tab.dataset.mode;
  document.querySelectorAll('.tab').forEach(item=>item.classList.toggle('active',item===tab));
  nameLabel.classList.toggle('hidden',mode!=='signup');
  nameInput.required=mode==='signup';
  passwordInput.autocomplete=mode==='signup'?'new-password':'current-password';
  submit.textContent=mode==='signup'?'Criar meu acesso':'Entrar na Família Casa Forte';
  status.textContent='';
}));

form.addEventListener('submit',async event=>{
  event.preventDefault();
  submit.disabled=true;
  status.textContent=mode==='signup'?'Criando seu acesso...':'Entrando...';

  if(mode==='signup'){
    const {data,error}=await client.auth.signUp({
      email:emailInput.value.trim(),
      password:passwordInput.value,
      options:{data:{full_name:nameInput.value.trim()}}
    });
    if(error){
      status.textContent=error.message;
    }else if(data.session){
      showDashboard(data.user);
    }else{
      status.textContent='Cadastro criado. Confira seu e-mail para confirmar o acesso.';
    }
  }else{
    const {data,error}=await client.auth.signInWithPassword({
      email:emailInput.value.trim(),
      password:passwordInput.value
    });
    if(error){
      status.textContent='E-mail ou senha inválidos.';
    }else{
      showDashboard(data.user);
    }
  }

  submit.disabled=false;
});

document.getElementById('logout').addEventListener('click',async()=>{
  await client.auth.signOut();
  form.reset();
  showAuth();
});

document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{
  const value=document.getElementById(button.dataset.copy).textContent.trim();
  try{
    await navigator.clipboard.writeText(value);
    const original=button.textContent;
    button.textContent='Pix copiado!';
    setTimeout(()=>button.textContent=original,1800);
  }catch{
    prompt('Copie a chave Pix:',value);
  }
}));

client.auth.getSession().then(({data})=>{
  if(data.session?.user) showDashboard(data.session.user);
});

client.auth.onAuthStateChange((_event,session)=>{
  if(session?.user) showDashboard(session.user);
});