(() => {
  const resetVersion = 'cf-session-reset-v1';
  try {
    if (localStorage.getItem(resetVersion) !== 'done') {
      localStorage.removeItem('casa-forte-auth');
      localStorage.setItem(resetVersion, 'done');
    }
  } catch (_) {
    // O login continuará funcionando mesmo sem acesso ao armazenamento.
  }
})();
