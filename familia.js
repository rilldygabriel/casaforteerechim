/* ============================================================
   Casa Forte Erechim — Área da Família
   ============================================================ */

const SUPABASE_URL = 'https://mfqlmsisrceyajspeeav.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0UsdpSSgbF0pADTG-Viazw_vIphuNnE';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const $ = (id) => document.getElementById(id);
const show = (el) => el.classList.remove('cf-hidden');
const hide = (el) => el.classList.add('cf-hidden');

let profile = null;
let mode = 'login';

function toast(text, isError) {
  const t = $('toast');
  t.textContent = text;
  t.classList.toggle('is-error', !!isError);
  t.classList.add('is-visible');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('is-visible'), 3200);
}

function message(el, text, isError) {
  el.textContent = text || '';
  el.className = 'cf-msg' + (text ? (isError ? ' cf-msg-error' : ' cf-msg-ok') : '');
}

function screen(name) {
  ['view-loading', 'view-auth', 'view-app'].forEach(id => hide($(id)));
  show($('view-' + name));
}

$('tab-login').onclick = () => setMode('login');
$('tab-signup').onclick = () => setMode('signup');

function setMode(next) {
  mode = next;
  const isSignup = next === 'signup';
  $('tab-login').classList.toggle('is-active', !isSignup);
  $('tab-signup').classList.toggle('is-active', isSignup);
  $('field-name').classList.toggle('cf-hidden', !isSignup);
  $('btn-auth').textContent = isSignup ? 'Criar minha conta' : 'Entrar';
  $('auth-password').setAttribute('autocomplete', isSignup ? 'new-password' : 'current-password');
  message($('auth-msg'), '');
}

$('btn-auth').onclick = async () => {
  const email = $('auth-email').value.trim().toLowerCase();
  const password = $('auth-password').value;
  const name = $('signup-name').value.trim();

  if (!email || !password) return message($('auth-msg'), 'Preencha e-mail e senha.', true);
  if (mode === 'signup' && password.length < 6) return message($('auth-msg'), 'A senha precisa ter pelo menos 6 caracteres.', true);
  if (mode === 'signup' && !name) return message($('auth-msg'), 'Informe seu nome completo.', true);

  $('btn-auth').disabled = true;
  $('btn-auth').textContent = 'Aguarde…';
  message($('auth-msg'), '');

  try {
    if (mode === 'signup') {
      const { error } = await db.auth.signUp({ email, password, options: { data: { full_name: name } } });
      if (error) throw error;
      const { data: sess } = await db.auth.getSession();
      if (!sess.session) {
        message($('auth-msg'), 'Conta criada. Confirme o e-mail que enviamos e depois entre.', false);
        setMode('login');
        return;
      }
    } else {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
    await start();
  } catch (err) {
    message($('auth-msg'), traduzir(err.message), true);
  } finally {
    $('btn-auth').disabled = false;
    $('btn-auth').textContent = mode === 'signup' ? 'Criar minha conta' : 'Entrar';
  }
};

function traduzir(msg) {
  const m = (msg || '').toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (m.includes('already registered')) return 'Este e-mail já tem conta. Use "Entrar".';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Aguarde um minuto.';
  return msg || 'Não foi possível concluir.';
}

$('btn-forgot').onclick = async () => {
  const email = $('auth-email').value.trim().toLowerCase();
  if (!email) return message($('auth-msg'), 'Digite seu e-mail para receber o link.', true);
  const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/familia.html' });
  message($('auth-msg'), error ? traduzir(error.message) : 'Link de recuperação enviado para seu e-mail.', !!error);
};

$('btn-logout').onclick = async () => {
  await db.auth.signOut();
  profile = null;
  screen('auth');
};

async function start() {
  screen('loading');
  const { data: { session } } = await db.auth.getSession();
  if (!session) { screen('auth'); return; }

  const { data, error } = await db.rpc('get_my_profile');
  if (error || !data) {
    toast('Não conseguimos carregar seu perfil. Tente entrar novamente.', true);
    screen('auth');
    return;
  }

  profile = data;
  render();
  screen('app');
}

function render() {
  $('hd-name').textContent = profile.full_name || 'Bem-vindo';
  $('hd-email').textContent = profile.email || '';
  $('f-name').value = profile.full_name || '';
  $('f-phone').value = profile.phone || '';
  $('f-instagram').value = profile.instagram || '';
  $('f-birth').value = profile.birth_date || '';
  $('f-year').value = profile.accepted_jesus_year || '';
  $('f-previous').value = profile.came_from_other_ministry === null ? '' : String(profile.came_from_other_ministry);
  $('f-baptized').value = profile.baptized === null ? '' : String(profile.baptized);

  const pct = Number(profile.completion_pct || 0);
  $('pct').textContent = pct;
  $('bar').style.width = pct + '%';
  $('star').classList.toggle('cf-hidden', pct < 100);
  desenharAvatar();
  $('my-status').textContent = profile.church_status || 'visitante';

  const lista = profile.ministries || [];
  $('my-ministries').innerHTML = lista.length
    ? lista.map(n => `<span class="cf-chip">${escapar(n)}</span>`).join('')
    : '<span class="cf-chip">Nenhum ministério ainda</span>';
}

function desenharAvatar() {
  const el = $('avatar');
  if (profile.photo_url) {
    el.innerHTML = `<img src="${escapar(profile.photo_url)}" alt="Sua foto de perfil" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  } else {
    const partes = (profile.full_name || 'CF').trim().split(/\s+/);
    el.textContent = ((partes[0] || 'C')[0] + (partes[1] || partes[0] || 'F')[0]).toUpperCase();
  }
}

function escapar(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

$('btn-save').onclick = async () => {
  const btn = $('btn-save');
  btn.disabled = true;
  btn.textContent = 'Salvando…';
  message($('save-msg'), '');

  const ano = $('f-year').value ? parseInt($('f-year').value, 10) : null;
  if (ano !== null && (ano < 1900 || ano > 2200)) {
    btn.disabled = false;
    btn.textContent = 'Salvar alterações';
    return message($('save-msg'), 'Informe um ano válido.', true);
  }

  const patch = {
    full_name: $('f-name').value.trim() || null,
    phone: $('f-phone').value.trim() || null,
    instagram: $('f-instagram').value.trim() || null,
    birth_date: $('f-birth').value || null,
    accepted_jesus_year: ano,
    came_from_other_ministry: $('f-previous').value === '' ? null : $('f-previous').value === 'true',
    baptized: $('f-baptized').value === '' ? null : $('f-baptized').value === 'true'
  };

  const { error } = await db.from('member_profiles').update(patch).eq('user_id', profile.user_id);
  if (error) {
    message($('save-msg'), 'Não foi possível salvar: ' + error.message, true);
  } else {
    const { data } = await db.rpc('get_my_profile');
    if (data) { profile = data; render(); }
    toast('Perfil salvo');
  }

  btn.disabled = false;
  btn.textContent = 'Salvar alterações';
};

$('btn-photo').onclick = () => $('photo-input').click();
$('photo-input').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return toast('Escolha um arquivo de imagem.', true);
  if (file.size > 5 * 1024 * 1024) return toast('A imagem precisa ter até 5 MB.', true);

  $('btn-photo').disabled = true;
  $('btn-photo').textContent = 'Enviando…';
  try {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${profile.user_id}/avatar_${Date.now()}.${ext}`;
    const { error: upErr } = await db.storage.from('member-avatars').upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) throw upErr;
    const { data: pub } = db.storage.from('member-avatars').getPublicUrl(path);
    const { error: dbErr } = await db.from('member_profiles').update({ photo_url: pub.publicUrl }).eq('user_id', profile.user_id);
    if (dbErr) throw dbErr;
    const { data } = await db.rpc('get_my_profile');
    if (data) { profile = data; render(); }
    toast('Foto atualizada');
  } catch (err) {
    toast('Não foi possível enviar a foto: ' + err.message, true);
  } finally {
    $('btn-photo').disabled = false;
    $('btn-photo').textContent = 'Enviar foto';
    e.target.value = '';
  }
};

document.querySelectorAll('.cf-tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.cf-tab').forEach(t => t.classList.remove('is-active'));
    document.querySelectorAll('.cf-panel').forEach(p => p.classList.remove('is-active'));
    tab.classList.add('is-active');
    document.querySelector(`.cf-panel[data-panel="${tab.dataset.panel}"]`).classList.add('is-active');
  };
});

document.querySelectorAll('[data-copy]').forEach(btn => {
  btn.onclick = async () => {
    const texto = $(btn.dataset.copy).textContent.trim();
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const tmp = document.createElement('textarea');
      tmp.value = texto;
      tmp.style.position = 'fixed';
      tmp.style.opacity = '0';
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand('copy');
      document.body.removeChild(tmp);
    }
    toast('Chave Pix copiada');
  };
});

db.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') { profile = null; screen('auth'); }
});

start();
