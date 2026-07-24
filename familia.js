const SUPABASE_URL = 'https://mfqlmsisrceyajspeeav.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0UsdpSSgbF0pADTG-Viazw_vIphuNnE';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'casa-forte-auth'
  }
});

const $ = id => document.getElementById(id);
let mode = 'login';
let profile = null;

function show(id) {
  ['loading', 'auth', 'app'].forEach(view => $(view).classList.add('hidden'));
  $(id).classList.remove('hidden');
}

function msg(id, text, error = false) {
  const el = $(id);
  el.textContent = text || '';
  el.className = 'msg' + (error ? ' error' : '');
}

function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2600);
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForSession(expectedSession = null) {
  if (expectedSession?.access_token) {
    await db.auth.setSession({
      access_token: expectedSession.access_token,
      refresh_token: expectedSession.refresh_token
    });
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    if (data.session?.access_token) return data.session;
    await sleep(150);
  }

  return null;
}

function setMode(next) {
  mode = next;
  $('loginTab').classList.toggle('active', next === 'login');
  $('signupTab').classList.toggle('active', next === 'signup');
  $('nameField').classList.toggle('hidden', next !== 'signup');
  $('authButton').textContent = next === 'signup' ? 'Criar minha conta' : 'Entrar';
  $('password').setAttribute('autocomplete', next === 'signup' ? 'new-password' : 'current-password');
  msg('authMsg', '');
}

async function loadProfile(session) {
  const activeSession = session || await waitForSession();
  if (!activeSession) throw new Error('Sessão não encontrada. Entre novamente.');

  let result = await db.rpc('get_my_profile');

  if (result.error && /permission denied|jwt|session/i.test(result.error.message || '')) {
    const refreshed = await db.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session) throw result.error;
    await sleep(150);
    result = await db.rpc('get_my_profile');
  }

  if (result.error) throw result.error;
  if (!result.data) throw new Error('Perfil não encontrado.');

  profile = result.data;
  render();
}

function render() {
  $('memberName').textContent = profile.full_name || 'Bem-vindo';
  $('memberEmail').textContent = profile.email || '';
  $('fullName').value = profile.full_name || '';
  $('phone').value = profile.phone || '';
  $('instagram').value = profile.instagram || '';
  $('birthDate').value = profile.birth_date || '';
  $('jesusYear').value = profile.accepted_jesus_year || '';
  $('previousMinistry').value = profile.came_from_other_ministry == null ? '' : String(profile.came_from_other_ministry);
  $('baptized').value = profile.baptized == null ? '' : String(profile.baptized);

  const pct = Number(profile.completion_pct || 0);
  $('percent').textContent = pct;
  $('progress').style.width = pct + '%';
  $('star').classList.toggle('hidden', pct < 100);
  $('status').textContent = profile.church_status || 'visitante';

  const mins = profile.ministries || [];
  $('ministries').innerHTML = mins.length
    ? mins.map(name => `<span class="chip">${esc(name)}</span>`).join('')
    : '<span class="chip">Nenhum ministério ainda</span>';

  if (profile.photo_url) {
    $('avatar').innerHTML = `<img src="${esc(profile.photo_url)}" alt="Foto de perfil">`;
  } else {
    $('avatar').textContent = ((profile.full_name || 'CF')
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0])
      .join('') || 'CF').toUpperCase();
  }
}

async function start(expectedSession = null) {
  show('loading');

  try {
    const session = await waitForSession(expectedSession);
    if (!session) {
      show('auth');
      return;
    }

    await loadProfile(session);
    msg('authMsg', '');
    show('app');
  } catch (error) {
    msg('authMsg', 'Não foi possível carregar seu perfil: ' + (error.message || 'erro desconhecido'), true);
    show('auth');
  }
}

$('loginTab').onclick = () => setMode('login');
$('signupTab').onclick = () => setMode('signup');

$('authButton').onclick = async () => {
  const email = $('email').value.trim().toLowerCase();
  const password = $('password').value;
  const name = $('signupName').value.trim();

  if (!email || !password) return msg('authMsg', 'Preencha e-mail e senha.', true);
  if (mode === 'signup' && !name) return msg('authMsg', 'Informe seu nome completo.', true);
  if (mode === 'signup' && password.length < 6) return msg('authMsg', 'A senha precisa ter pelo menos 6 caracteres.', true);

  const button = $('authButton');
  button.disabled = true;
  button.textContent = 'Aguarde…';
  msg('authMsg', '');

  try {
    if (mode === 'signup') {
      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } }
      });
      if (error) throw error;

      if (!data.session) {
        setMode('login');
        msg('authMsg', 'Conta criada. Confirme o e-mail e depois entre.', false);
        return;
      }

      await start(data.session);
    } else {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session) throw new Error('A sessão não foi criada. Tente novamente.');
      await start(data.session);
    }
  } catch (error) {
    msg('authMsg', error.message || 'Não foi possível continuar.', true);
  } finally {
    button.disabled = false;
    button.textContent = mode === 'signup' ? 'Criar minha conta' : 'Entrar';
  }
};

$('forgotButton').onclick = async () => {
  const email = $('email').value.trim().toLowerCase();
  if (!email) return msg('authMsg', 'Digite seu e-mail.', true);

  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: location.origin + '/familia.html'
  });
  msg('authMsg', error ? error.message : 'Link de recuperação enviado.', !!error);
};

$('logout').onclick = async () => {
  await db.auth.signOut();
  profile = null;
  show('auth');
};

$('saveProfile').onclick = async () => {
  const button = $('saveProfile');
  button.disabled = true;
  msg('saveMsg', '');

  try {
    const year = $('jesusYear').value ? Number($('jesusYear').value) : null;
    const patch = {
      full_name: $('fullName').value.trim() || null,
      phone: $('phone').value.trim() || null,
      instagram: $('instagram').value.trim() || null,
      birth_date: $('birthDate').value || null,
      accepted_jesus_year: year,
      came_from_other_ministry: $('previousMinistry').value === '' ? null : $('previousMinistry').value === 'true',
      baptized: $('baptized').value === '' ? null : $('baptized').value === 'true'
    };

    const { error } = await db.from('member_profiles')
      .update(patch)
      .eq('user_id', profile.user_id);

    if (error) throw error;
    await loadProfile();
    toast('Perfil salvo');
  } catch (error) {
    msg('saveMsg', 'Não foi possível salvar: ' + error.message, true);
  } finally {
    button.disabled = false;
  }
};

$('photoButton').onclick = () => $('photo').click();
$('photo').onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
    return toast('Escolha uma imagem de até 5 MB');
  }

  try {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${profile.user_id}/avatar.${ext}`;
    const { error: uploadError } = await db.storage
      .from('member-avatars')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) throw uploadError;

    const { data } = db.storage.from('member-avatars').getPublicUrl(path);
    const { error } = await db.from('member_profiles')
      .update({ photo_url: data.publicUrl + '?v=' + Date.now() })
      .eq('user_id', profile.user_id);
    if (error) throw error;

    await loadProfile();
    toast('Foto atualizada');
  } catch (error) {
    toast(error.message || 'Não foi possível atualizar a foto');
  } finally {
    event.target.value = '';
  }
};

document.querySelectorAll('.tab[data-panel]').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.tab[data-panel]').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(panel => panel.classList.remove('active'));
    tab.classList.add('active');
    $(tab.dataset.panel).classList.add('active');
  };
});

document.querySelectorAll('[data-copy]').forEach(button => {
  button.onclick = async () => {
    await navigator.clipboard.writeText($(button.dataset.copy).textContent.trim());
    toast('Chave Pix copiada');
  };
});

db.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    profile = null;
    show('auth');
  }
  if (event === 'SIGNED_IN' && session && !profile) {
    setTimeout(() => start(session), 0);
  }
});

start();