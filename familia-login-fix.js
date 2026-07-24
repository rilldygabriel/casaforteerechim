(() => {
  const button = document.getElementById('authButton');
  if (!button || typeof db === 'undefined') return;

  button.onclick = async () => {
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    const name = document.getElementById('signupName').value.trim();

    if (!email || !password) return msg('authMsg', 'Preencha e-mail e senha.', true);
    if (mode === 'signup' && !name) return msg('authMsg', 'Informe seu nome completo.', true);
    if (mode === 'signup' && password.length < 6) return msg('authMsg', 'A senha precisa ter pelo menos 6 caracteres.', true);

    button.disabled = true;
    button.textContent = 'Aguarde…';
    msg('authMsg', '');

    try {
      let result;
      if (mode === 'signup') {
        result = await db.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } }
        });
        if (result.error) throw result.error;
        if (!result.data.session) {
          setMode('login');
          msg('authMsg', 'Conta criada. Confirme o e-mail e depois entre.');
          return;
        }
      } else {
        result = await db.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
      }

      const session = result.data.session;
      if (!session?.user?.id || !session.access_token) {
        throw new Error('O login foi aceito, mas a sessão não foi concluída. Tente novamente.');
      }

      await loadProfile(session);
      show('app');
    } catch (error) {
      msg('authMsg', error.message || 'Não foi possível continuar.', true);
    } finally {
      button.disabled = false;
      button.textContent = mode === 'signup' ? 'Criar minha conta' : 'Entrar';
    }
  };
})();