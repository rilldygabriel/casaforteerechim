const SUPABASE_URL='https://mfqlmsisrceyajspeeav.supabase.co';
const SUPABASE_KEY='sb_publishable_0UsdpSSgbF0pADTG-Viazw_vIphuNnE';
const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

const loginScreen=document.getElementById('loginScreen');
const appShell=document.getElementById('appShell');
const loginForm=document.getElementById('loginForm');
const loginMessage=document.getElementById('loginMessage');
const userEmail=document.getElementById('userEmail');
const connectionStatus=document.getElementById('connectionStatus');
const titles={dashboard:'Visão geral',visitantes:'Visitantes',eventos:'Eventos',intercessao:'Intercessão e Cuidado'};

function escapeHtml(value=''){return String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}
function formatDate(value){if(!value)return '—';return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value));}
function setVisible(element,show){element.hidden=!show;}

async function verifyAdmin(){
  const {data:{session}}=await client.auth.getSession();
  if(!session)return false;
  const {data,error}=await client.rpc('is_admin');
  if(error||data!==true){await client.auth.signOut();return false;}
  userEmail.textContent=session.user.email||'';
  return true;
}

async function showApp(){
  setVisible(loginScreen,false);setVisible(appShell,true);
  connectionStatus.textContent='Conectado';
  await Promise.all([loadDashboard(),loadVisitors(),loadEvents(),loadPrayer()]);
}

async function showLogin(message=''){
  setVisible(appShell,false);setVisible(loginScreen,true);
  loginMessage.textContent=message;
}

loginForm.addEventListener('submit',async event=>{
  event.preventDefault();loginMessage.textContent='Entrando...';
  const email=document.getElementById('loginEmail').value.trim();
  const password=document.getElementById('loginPassword').value;
  const {error}=await client.auth.signInWithPassword({email,password});
  if(error){loginMessage.textContent='Não foi possível entrar. Confira e-mail e senha.';return;}
  if(!(await verifyAdmin())){showLogin('Este usuário não possui acesso administrativo.');return;}
  loginMessage.textContent='';await showApp();
});

document.getElementById('logoutButton').addEventListener('click',async()=>{await client.auth.signOut();showLogin('Sessão encerrada.');});

const buttons=document.querySelectorAll('.nav-item');
const views=document.querySelectorAll('.view');
const pageTitle=document.getElementById('pageTitle');
buttons.forEach(button=>button.addEventListener('click',()=>{
  const target=button.dataset.view;
  buttons.forEach(item=>item.classList.toggle('active',item===button));
  views.forEach(view=>view.classList.toggle('active',view.id===target));
  pageTitle.textContent=titles[target]||'Casa Forte Admin';
}));

async function loadDashboard(){
  const {data,error}=await client.from('dashboard_resumo').select('*').single();
  if(error){connectionStatus.textContent='Erro ao carregar';return;}
  document.getElementById('statVisitors').textContent=data.total_visitantes??0;
  document.getElementById('statSupport').textContent=data.visitantes_que_querem_acompanhamento??0;
  document.getElementById('statEvents').textContent=data.total_inscricoes??0;
  document.getElementById('statPrayer').textContent=data.pedidos_oracao_novos??0;
  document.getElementById('metricMonth').textContent=`${data.visitantes_ultimos_30_dias??0} visitantes nos últimos 30 dias`;
  document.getElementById('metricPastor').textContent=`${data.visitantes_que_querem_mensagem_pastor??0} querem mensagem do pastor`;
  document.getElementById('metricActiveEvents').textContent=`${data.total_eventos_ativos??0} eventos ativos`;
}

async function loadVisitors(){
  const body=document.getElementById('visitorsBody');const empty=document.getElementById('visitorsEmpty');
  const {data,error}=await client.from('visitantes').select('*').order('created_at',{ascending:false}).limit(100);
  if(error){body.innerHTML='';empty.hidden=false;empty.querySelector('p').textContent='Erro ao carregar visitantes.';return;}
  body.innerHTML=(data||[]).map(item=>`<tr><td><strong>${escapeHtml(item.nome)}</strong><br><small>${formatDate(item.created_at)}</small></td><td>${escapeHtml(item.telefone)}</td><td>${escapeHtml(item.bairro||'—')}</td><td>${escapeHtml(item.passo_fe||'—')}</td><td><span class="badge ${item.acompanhamento?'yes':''}">${item.acompanhamento?'Sim':'Não'}</span></td><td>${escapeHtml(item.status_acompanhamento||'novo')}</td></tr>`).join('');
  empty.hidden=(data||[]).length>0;
}

async function loadEvents(){
  const body=document.getElementById('eventsBody');const empty=document.getElementById('eventsEmpty');
  const {data,error}=await client.from('eventos').select('*').order('data_evento',{ascending:true}).limit(100);
  if(error){empty.hidden=false;return;}
  body.innerHTML=(data||[]).map(item=>`<tr><td><strong>${escapeHtml(item.titulo)}</strong></td><td>${formatDate(item.data_evento)}</td><td>${escapeHtml(item.local||'—')}</td><td>${item.limite_vagas??'Livre'}</td><td><span class="badge ${item.ativo?'yes':''}">${item.ativo?'Ativo':'Encerrado'}</span></td></tr>`).join('');
  empty.hidden=(data||[]).length>0;
}

async function loadPrayer(){
  const body=document.getElementById('prayerBody');const empty=document.getElementById('prayerEmpty');
  const {data,error}=await client.from('pedidos_oracao').select('*').order('created_at',{ascending:false}).limit(100);
  if(error){empty.hidden=false;return;}
  body.innerHTML=(data||[]).map(item=>`<tr><td>${escapeHtml(item.nome||'Anônimo')}</td><td>${escapeHtml(item.categoria||'—')}</td><td>${escapeHtml(item.pedido)}</td><td><span class="badge ${item.urgente?'yes':''}">${item.urgente?'Sim':'Não'}</span></td><td>${escapeHtml(item.status||'novo')}</td></tr>`).join('');
  empty.hidden=(data||[]).length>0;
}

document.getElementById('refreshVisitors').addEventListener('click',loadVisitors);
document.getElementById('refreshEvents').addEventListener('click',loadEvents);
document.getElementById('refreshPrayer').addEventListener('click',loadPrayer);

(async()=>{if(await verifyAdmin())await showApp();else showLogin();})();