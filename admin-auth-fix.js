(() => {
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  let checking = false;

  async function obterSessao(expectedSession = null) {
    if (expectedSession?.access_token && expectedSession?.refresh_token) {
      const applied = await db.auth.setSession({
        access_token: expectedSession.access_token,
        refresh_token: expectedSession.refresh_token
      });
      if (applied.error) throw applied.error;
    }

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const { data, error } = await db.auth.getSession();
      if (error) throw error;
      if (data.session?.user?.id && data.session.access_token) {
        const userResult = await db.auth.getUser();
        if (!userResult.error && userResult.data.user?.id) return data.session;
      }
      await pause(180);
    }

    return null;
  }

  async function validarAdmin(session) {
    const activeSession = await obterSessao(session);
    if (!activeSession?.user?.id) throw new Error('Sessão não encontrada. Entre novamente.');

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { data, error } = await db
        .from('member_profiles')
        .select('is_admin,email')
        .eq('user_id', activeSession.user.id)
        .maybeSingle();

      if (!error && data) return data.is_admin === true;
      if (error && !/jwt|session|permission|fetch/i.test(error.message || '')) throw error;

      const refreshed = await db.auth.refreshSession();
      if (refreshed.error) throw error || refreshed.error;
      await pause(220);
    }

    const rpc = await db.rpc('is_admin');
    if (rpc.error) throw rpc.error;
    return rpc.data === true;
  }

  async function abrirPainel(expectedSession = null) {
    if (checking) return;
    checking = true;
    show('loading');

    try {
      const session = await obterSessao(expectedSession);
      if (!session) {
        show('auth');
        return;
      }

      const permitido = await validarAdmin(session);
      if (!permitido) {
        show('denied');
        return;
      }

      $('adminEmail').textContent = session.user.email || '';
      show('app');
      await loadAll();
    } catch (error) {
      msg('loginMsg', 'Falha ao verificar permissão: ' + (error.message || 'erro desconhecido'), true);
      show('auth');
    } finally {
      checking = false;
    }
  }

  window.verify = abrirPainel;
  window.start = abrirPainel;

  $('login').onclick = async () => {
    const email = $('email').value.trim().toLowerCase();
    const password = $('password').value;
    if (!email || !password) return msg('loginMsg', 'Preencha e-mail e senha.', true);

    $('login').disabled = true;
    msg('loginMsg', '');

    const { data, error } = await db.auth.signInWithPassword({ email, password });
    $('login').disabled = false;

    if (error) return msg('loginMsg', error.message, true);
    await abrirPainel(data.session);
  };

  db.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      setTimeout(() => abrirPainel(session), 0);
    }
  });

  setTimeout(() => abrirPainel(), 250);
})();