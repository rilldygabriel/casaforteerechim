const SUPABASE_URL='https://mfqlmsisrceyajspeeav.supabase.co';
const SUPABASE_KEY='sb_publishable_0UsdpSSgbF0pADTG-Viazw_vIphuNnE';
const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const authArea=$('authArea'),dashboard=$('dashboard'),form=$('authForm'),status=$('authStatus'),submit=$('authSubmit'),nameLabel=$('nameLabel'),nameInput=$('name'),emailInput=$('email'),passwordInput=$('password');
let mode='login',currentUser=null,currentPhoto='',currentProfile=null;
const requiredProfile=['full_name','phone','birth_date','accepted_jesus_year','came_from_other_ministry','baptized','photo_url'];
function hasValue(value){return value===true||value===false||String(value??'').trim()!==''}
function profilePercent(profile={}){return Math.round(requiredProfile.filter(k=>hasValue(profile[k])).length/requiredProfile.length*100)}
async function ensureProfile(user){
  const {data}=await client.from('member_profiles').select('*').eq('user_id',user.id).maybeSingle();
  if(data)return data;
  const initial={user_id:user.id,full_name:user.user_metadata?.full_name||'',church_role:'visitante',ministries:[],profile_completed:false};
  const {data:created,error}=await client.from('member_profiles').insert(initial).select().single();
  if(error){console.error('Erro ao criar perfil:',error);return initial}
  return created;
}
function renderProfile(user,profile={}){
  currentUser=user;currentProfile=profile;
  const name=profile.full_name||user.user_metadata?.full_name||user.email?.split('@')[0]||'Família Casa Forte';
  $('welcomeName').textContent=`Olá, ${name}!`;$('welcomeEmail').textContent=user.email||'';
  const pct=profilePercent(profile);$('profileProgress').innerHTML=pct===100?'<span class="star">★</span> Perfil completo!':`Perfil ${pct}% completo`;
  $('profileName').value=profile.full_name||'';$('profilePhone').value=profile.phone||'';$('profileInstagram').value=profile.instagram||'';$('profileBirth').value=profile.birth_date||'';$('profileJesusYear').value=profile.accepted_jesus_year||'';$('profilePreviousMinistry').value=profile.came_from_other_ministry===true?'Sim':profile.came_from_other_ministry===false?'Não':'';$('profileBaptized').value=profile.baptized===true?'Sim':profile.baptized===false?'Não':'';
  currentPhoto=profile.photo_url||'';$('photoPreview').src=currentPhoto||'logo.png';$('avatarBox').outerHTML=currentPhoto?`<img id="avatarBox" class="avatar" src="${currentPhoto}" alt="Foto de perfil">`:'<div id="avatarBox" class="avatar-placeholder">CF</div>';
}
async function showDashboard(user){authArea.classList.add('hidden');dashboard.classList.add('active');const profile=await ensureProfile(user);renderProfile(user,profile)}
function showAuth(){dashboard.classList.remove('active');authArea.classList.remove('hidden')}
document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{mode=tab.dataset.mode;document.querySelectorAll('.tab').forEach(i=>i.classList.toggle('active',i===tab));nameLabel.classList.toggle('hidden',mode!=='signup');nameInput.required=mode==='signup';passwordInput.autocomplete=mode==='signup'?'new-password':'current-password';submit.textContent=mode==='signup'?'Criar meu acesso':'Entrar na Família Casa Forte';status.textContent=''}));
form.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;status.textContent=mode==='signup'?'Criando seu acesso...':'Entrando...';if(mode==='signup'){const {data,error}=await client.auth.signUp({email:emailInput.value.trim(),password:passwordInput.value,options:{data:{full_name:nameInput.value.trim()}}});if(error)status.textContent=error.message;else if(data.session)await showDashboard(data.user);else status.textContent='Cadastro criado. Confira seu e-mail para confirmar o acesso.'}else{const {data,error}=await client.auth.signInWithPassword({email:emailInput.value.trim(),password:passwordInput.value});if(error)status.textContent='E-mail ou senha inválidos.';else await showDashboard(data.user)}submit.disabled=false});
$('editProfile').addEventListener('click',()=>{$('profilePanel').hidden=!$('profilePanel').hidden;if(!$('profilePanel').hidden)$('profilePanel').scrollIntoView({behavior:'smooth'})});
$('profilePhoto').addEventListener('change',e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>900000){$('profileStatus').textContent='Escolha uma foto com até 900 KB.';return}const reader=new FileReader();reader.onload=()=>{currentPhoto=reader.result;$('photoPreview').src=currentPhoto};reader.readAsDataURL(file)});
$('profileForm').addEventListener('submit',async e=>{e.preventDefault();$('saveProfile').disabled=true;$('profileStatus').textContent='Salvando perfil...';const profile={user_id:currentUser.id,full_name:$('profileName').value.trim(),phone:$('profilePhone').value.trim(),instagram:$('profileInstagram').value.trim(),birth_date:$('profileBirth').value||null,accepted_jesus_year:$('profileJesusYear').value?Number($('profileJesusYear').value):null,came_from_other_ministry:$('profilePreviousMinistry').value==='Sim',baptized:$('profileBaptized').value==='Sim',photo_url:currentPhoto||null,church_role:currentProfile?.church_role||'visitante',ministries:currentProfile?.ministries||[],profile_completed:false,updated_at:new Date().toISOString()};profile.profile_completed=profilePercent(profile)===100;const {data,error}=await client.from('member_profiles').upsert(profile,{onConflict:'user_id'}).select().single();if(error){console.error(error);$('profileStatus').textContent='Não foi possível salvar o perfil.'}else{currentProfile=data;await client.auth.updateUser({data:{full_name:data.full_name}});renderProfile(currentUser,data);$('profileStatus').textContent='Perfil salvo com sucesso.'}$('saveProfile').disabled=false});
$('logout').addEventListener('click',async()=>{await client.auth.signOut();form.reset();showAuth()});
document.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',async()=>{const v=$(b.dataset.copy).textContent.trim();try{await navigator.clipboard.writeText(v);const o=b.textContent;b.textContent='Pix copiado!';setTimeout(()=>b.textContent=o,1800)}catch{prompt('Copie a chave Pix:',v)}}));
client.auth.getSession().then(async({data})=>{if(data.session?.user)await showDashboard(data.session.user)});client.auth.onAuthStateChange(async(_e,s)=>{if(s?.user)await showDashboard(s.user)});