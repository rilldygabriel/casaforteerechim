"use client";
export default function MinistryFundsError({reset}:{reset:()=>void}) {
  return <main className="mf-page"><section className="mf-panel"><h1>Não foi possível carregar o painel</h1><p>Seus dados não foram alterados. Atualize a página ou tente novamente.</p><button type="button" onClick={reset}>Tentar novamente</button></section></main>;
}
