(() => {
  async function validarAdmin(session) {
    if (!session?.user?.id) return false;

    const { data, error } = await db
      .from('member_profiles')
      .select('is_admin,email')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (error) throw error;
    return data?.is_admin === true;
  }

  async function abrirPainel(session) {
    show('loading');
    try {
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
    }
  }

  window.verify = abrirPainel;
  window.start = async function () {
    show('loading');
    const { data, error } = await db.auth.getSession();
    if (error || !data.session) {
      show('auth');
      return;
    }
    await abrirPainel(data.session);
  };

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

  setTimeout(async () => {
    const { data } = await db.auth.getSession();
    if (data.session) await abrirPainel(data.session);
  }, 50);
})();