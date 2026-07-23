const SUPABASE_URL='https://mfqlmsisrceyajspeeav.supabase.co';
const SUPABASE_KEY='sb_publishable_0UsdpSSgbF0pADTG-Viazw_vIphuNnE';
const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id);
const loginScreen=$('loginScreen'),appShell=$('appShell'),loginForm=$('loginForm'),loginMessage=$('loginMessage'),userEmail=$('userEmail'),connectionStatus=$('connectionStatus');
const titles={dashboard:'Visão geral',membros:'Gestão de Membros',visitantes:'Visitantes',eventos:'Eventos',intercessao:'Intercessão e Cuidado'};
const ministries=['Conect (Recepção)','Conect (Consolidação)','Intercessão','Louvor','Mídias (Fotos)','Mídias (Transmissão)','Mídias (Stories)','Café','Escolinha Kids','Projeção','Mesa de Som','Pastores','Líder e Discipulador'];
const roles=['visitante','frequentador','membro','voluntário','líder','discipulador','pastor','administrador'];
function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function formatDate(v){if(!v)return'—';try{return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v))}catch{return String(v)}}
function setVisible(el,show){el.hidden=!show}
function showLogin(message=''){setVisible(appShell,false);setVisible(loginScreen,true);loginMessage.textContent=message;connectionStatus.textContent='Desconectado'}
async function verifyAdmin(){
  const {data:{session},error:sessionError}=await client.auth.getSession();
  if(sessionError||!session)return{ok:false,message:'Sessão não encontrada. Entre novamente.'};
  const {data,error}=await client.rpc('is_admin');
  if(error){console.error('is_admin:',error);return{ok:false,message:`Falha ao verificar permissão: ${error.message}`}}
  if(data!==true)return{ok:false,message:'Acesso autenticado, mas este usuário não está marcado como administrador.'};
  userEmail.textContent=session.user.email||'';
  return{ok:true,session};
}
async function showApp(){setVisible(loginScreen,false);setVisible(appShell,true);connectionStatus.textContent='Conectado';await Promise.allSettled([loadDashboard(),loadMembers(),loadVisitors(),loadEvents(),loadPrayer()])}
loginForm.addEventListener('submit',async e=>{
  e.preventDefault();
  const button=loginForm.querySelector('button[type="submit"]');
  button.disabled=true;loginMessage.textContent='Entrando...';
  await client.auth.signOut({scope:'local'});
  const email=$('loginEmail').value.trim().toLowerCase();
  const password=$('loginPassword').value;
  const {data,error}=await client.auth.signInWithPassword({email,password});
  if(error||!data.session){loginMessage.textContent='Não foi possível entrar. Confira e-mail e senha.';button.disabled=false;return}
  const check=await verifyAdmin();
  if(!check.ok){loginMessage.textContent=check.message;button.disabled=false;return}
  loginMessage.textContent='';button.disabled=false;await showApp();
});
$('logoutButton').addEventListener('click',async()=>{await client.auth.signOut();showLogin('Sessão encerrada.')});
document.querySelectorAll('.nav-item').forEach(button=>button.addEventListener('click',()=>{const target=button.dataset.view;document.querySelectorAll('.nav-item').forEach(i=>i.classList.toggle('active',i===button));document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===target));$('pageTitle').textContent=titles[target]||'Casa Forte Admin'}));
async function loadDashboard(){const {data,error}=await client.from('dashboard_resumo').select('*').single();if(error){console.error(error);connectionStatus.textContent='Conectado com avisos';return}$('statVisitors').textContent=data.total_visitantes??0;$('statSupport').textContent=data.visitantes_que_querem_acompanhamento??0;$('statEvents').textContent=data.total_inscricoes??0;$('statPrayer').textContent=data.pedidos_oracao_novos??0;$('metricMonth').textContent=`${data.visitantes_ultimos_30_dias??0} visitantes nos últimos 30 dias`;$('metricPastor').textContent=`${data.visitantes_que_querem_mensagem_pastor??0} querem mensagem do pastor`;$('metricActiveEvents').textContent=`${data.total_eventos_ativos??0} eventos ativos`}
async function loadMembers(){
  const body=$('membersBody'),empty=$('membersEmpty');
  body.innerHTML='<tr><td colspan="6">Carregando membros...</td></tr>';empty.hidden=true;
  const {data,error}=await client.from('member_profiles').select('*').order('created_at',{ascending:false}).limit(300);
  if(error){console.error('loadMembers:',error);body.innerHTML='';empty.hidden=false;empty.querySelector('p').textContent=`Erro ao carregar: ${error.message}`;return}
  body.innerHTML=(data||[]).map(m=>`<tr><td>${m.photo_url?`<img src="${escapeHtml(m.photo_url)}" alt="" style="width:48px;height:48px;border-radius:12px;object-fit:cover;vertical-align:middle;margin-right:8px">`:''}<strong>${escapeHtml(m.full_name||'Perfil incompleto')}</strong><br><small>${escapeHtml(m.email||'')}</small>${m.profile_completed?' <span title="Perfil completo">⭐</span>':''}</td><td>${escapeHtml(m.phone||'—')}<br><small>${escapeHtml(m.instagram||'')}</small></td><td>Nasc.: ${escapeHtml(m.birth_date||'—')}<br>Aceitou Jesus: ${escapeHtml(m.accepted_jesus_year||'—')}<br>Batizado: ${m.baptized===true?'Sim':m.baptized===false?'Não':'—'}<br>Outro ministério: ${m.came_from_other_ministry===true?'Sim':m.came_from_other_ministry===false?'Não':'—'}</td><td><span class="badge yes">${escapeHtml(m.church_role||'visitante')}</span></td><td>${escapeHtml((m.ministries||[]).join(', ')||'Nenhum')}</td><td><button type="button" data-edit-user="${m.user_id}">Editar funções</button></td></tr>`).join('');
  empty.hidden=(data||[]).length>0;
  body.querySelectorAll('[data-edit-user]').forEach(button=>button.addEventListener('click',()=>{const member=(data||[]).find(m=>m.user_id===button.dataset.editUser);if(member)editMember(member)}));
}
async function editMember(member){
  const role=prompt(`Status da pessoa:\n${roles.join(', ')}`,member.church_role||'visitante');
  if(role===null)return;
  const normalizedRole=role.trim().toLowerCase();
  if(!roles.includes(normalizedRole)){alert('Escolha um status válido.');return}
  const selected=prompt(`Digite um ou mais ministérios separados por vírgula.\n\nOpções:\n${ministries.join('\n')}`,(member.ministries||[]).join(', '));
  if(selected===null)return;
  const list=[...new Set(selected.split(',').map(v=>v.trim()).filter(Boolean))];
  const invalid=list.filter(item=>!ministries.some(valid=>valid.toLocaleLowerCase('pt-BR')===item.toLocaleLowerCase('pt-BR')));
  if(invalid.length){alert(`Ministério inválido: ${invalid.join(', ')}`);return}
  const canonical=list.map(item=>ministries.find(valid=>valid.toLocaleLowerCase('pt-BR')===item.toLocaleLowerCase('pt-BR')));
  const {error}=await client.rpc('admin_update_member_profile',{p_user_id:member.user_id,p_church_role:normalizedRole,p_ministries:canonical});
  if(error){console.error('admin_update_member_profile:',error);alert(`Não foi possível salvar: ${error.message}`);return}
  alert('Funções salvas com sucesso.');await loadMembers();
}
async function loadVisitors(){const body=$('visitorsBody'),empty=$('visitorsEmpty');const {data,error}=await client.from('visitantes').select('*').order('created_at',{ascending:false}).limit(100);if(error){console.error(error);body.innerHTML='';empty.hidden=false;return}body.innerHTML=(data||[]).map(i=>`<tr><td><strong>${escapeHtml(i.nome)}</strong><br><small>${formatDate(i.created_at)}</small></td><td>${escapeHtml(i.telefone)}</td><td>${escapeHtml(i.bairro||'—')}</td><td>${escapeHtml(i.passo_fe||'—')}</td><td><span class="badge ${i.acompanhamento?'yes':''}">${i.acompanhamento?'Sim':'Não'}</span></td><td>${escapeHtml(i.status_acompanhamento||'novo')}</td></tr>`).join('');empty.hidden=(data||[]).length>0}
async function loadEvents(){const body=$('eventsBody'),empty=$('eventsEmpty');const {data,error}=await client.from('eventos').select('*').order('data_evento',{ascending:true}).limit(100);if(error){console.error(error);empty.hidden=false;return}body.innerHTML=(data||[]).map(i=>`<tr><td><strong>${escapeHtml(i.titulo)}</strong></td><td>${formatDate(i.data_evento)}</td><td>${escapeHtml(i.local||'—')}</td><td>${i.limite_vagas??'Livre'}</td><td><span class="badge ${i.ativo?'yes':''}">${i.ativo?'Ativo':'Encerrado'}</span></td></tr>`).join('');empty.hidden=(data||[]).length>0}
async function loadPrayer(){const body=$('prayerBody'),empty=$('prayerEmpty');const {data,error}=await client.from('pedidos_oracao').select('*').order('created_at',{ascending:false}).limit(100);if(error){console.error(error);empty.hidden=false;return}body.innerHTML=(data||[]).map(i=>`<tr><td>${escapeHtml(i.nome||'Anônimo')}</td><td>${escapeHtml(i.categoria||'—')}</td><td>${escapeHtml(i.pedido)}</td><td><span class="badge ${i.urgente?'yes':''}">${i.urgente?'Sim':'Não'}</span></td><td>${escapeHtml(i.status||'novo')}</td></tr>`).join('');empty.hidden=(data||[]).length>0}
$('refreshMembers').addEventListener('click',loadMembers);$('refreshVisitors').addEventListener('click',loadVisitors);$('refreshEvents').addEventListener('click',loadEvents);$('refreshPrayer').addEventListener('click',loadPrayer);
(async()=>{const check=await verifyAdmin();if(check.ok)await showApp();else showLogin('')})();