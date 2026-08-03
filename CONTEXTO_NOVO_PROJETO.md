# Casa Forte Erechim — contexto atual do projeto

Este arquivo registra o estado atual do site em produção. O código da branch
`main` é a fonte principal da verdade e não deve ser reconstruído do zero.

## Regras de trabalho definidas pelo pastor Rilldy

- Trabalhar em português do Brasil.
- Executar diretamente no GitHub, Vercel e Supabase usando os conectores
  autorizados, sem transferir tarefas de painel ao usuário.
- Não afirmar que algo foi publicado sem confirmar o deploy READY.
- Avançar uma etapa por vez.
- Não despejar planos longos nem ideias não solicitadas.
- Usar exclusivamente o Supabase novo `CasaForte-Site-2026`
  (`fjwkfpwraipxmcjlwssv`).
- É proibido acessar, consultar ou alterar o Supabase antigo
  (`mfqlmsisrceyajspeeav`).
- Criar backup antes de mudanças arriscadas e preservar os backups existentes.
- Em autenticação e envio de e-mail, investigar o erro antes de uma nova
  tentativa real.
- O site público, a Área da Família e o Painel Administrativo devem ser módulos separados e independentes.
- Só avançar quando a etapa atual estiver funcionando em produção.

## Identidade visual

- Igreja Casa Forte Erechim.
- Cores: preto, grafite, branco e amarelo `#FFFE15`.
- Tom: acolhedor, moderno, forte e simples.
- Frases principais:
  - “Você tem um lugar aqui.”
  - “Não ande sozinho. Vem pra casa.”
  - “Aqui você não é só mais um. Você é família.”

## Dados institucionais

- Endereço: Rua José Reinaldo Angonezze, 319, José Bonifácio, Erechim – RS.
- WhatsApp oficial/pastoral: `+55 54 99264-0253`.
- WhatsApp em formato internacional: `5554992640253`.
- Google Maps: https://maps.app.goo.gl/wAtHfmS7cFcFP5UC9?g_st=ic
- Instagram da igreja: https://www.instagram.com/casaforteerechim
- YouTube da igreja: https://youtube.com/@igrejacasaforte-erechim5031
- Casa Forte Music: https://youtube.com/@casafortemusic
- Canal do pastor: https://ig.me/j/AbbdKixwGYdyTwoi/
- Grupo da igreja: https://chat.whatsapp.com/Ix3EKdZymHEAhYpgVqUzQG?mode=gi_t
- Fotos do culto mais recente: https://drive.google.com/drive/folders/1TInw-3LUzBaKKEUJ5V_60rJbYmCCIUEo

## Programação semanal

- Domingo na Casa: domingo, 19h.
- Quarta na Casa: quarta-feira, 19h30.
- 1 Hora de Intercessão: sexta-feira, 19h30.

## Generosidade

- Primícias: PIX `54993217227`.
- Dízimos e ofertas: PIX `46534858000137`.

## Pastores

- Rilldy Gabriel — pastor presidente — https://www.instagram.com/rilldygabriel
- Elisiane Gabriel — pastora presidente — https://www.instagram.com/lisigabriel
- Pastores auxiliares: Elilucia Morona, Airton Morona, Herrison Ribeiro e Pamela Ribeiro.

## Site público desejado

Página principal com:

- Hero com “Você tem um lugar aqui”.
- Botões:
  - Novo Visitante.
  - Sou da Casa.
  - Quero conhecer a Casa.
- Links sociais e de conexão.
- Programação semanal.
- Seção de pertencimento.
- Seção “Sou da Casa”.
- Generosidade com botões para copiar os PIX.
- Pastores da Casa.
- Galeria de fotos.
- Formulário de pedido de oração.
- Rodapé com endereço, WhatsApp, Maps, Instagram e YouTube.

## Formulário de visitante

Campos desejados:

- Nome completo.
- Telefone.
- Cidade.
- Bairro.
- Quem convidou.
- Igreja anterior.
- Deseja acompanhamento de um líder.
- Passo de fé.
- Deseja mensagem do pastor.
- Experiência no culto.
- Deseja voltar.

Após o envio, exibir um botão grande para entrar no grupo oficial da igreja.

## Pedido de oração

Campos desejados:

- Nome completo.
- WhatsApp.
- Categoria.
- Pedido.
- Deseja contato da equipe.

Os dados devem ser enviados ao banco e futuramente notificados pelo WhatsApp.

## Área da Família — visão futura

Não implementar junto com o site público. Criar depois, separadamente, por etapas.

Perfil do membro:

- Foto de perfil.
- Nome completo.
- WhatsApp.
- Instagram.
- Data de nascimento.
- Endereço.
- Mês e ano em que começou a frequentar a Casa.
- Ano em que aceitou Jesus.
- Se já frequentou outra igreja evangélica e, em caso positivo, qual.
- Se é batizado nas águas.
- Estado civil e nome do cônjuge quando casado.
- Status na igreja.
- Perfil 100% preenchido gera a “Estrela da Família”, calculada no banco.
- Área de generosidade com os dois PIX.

Neste primeiro momento, não incluir GC nem “Meu Ministério”.

## Ministérios futuros

- Conect (Recepção)
- Conect (Consolidação)
- Intercessão
- Louvor
- Mídias (Fotos)
- Mídias (Transmissão)
- Mídias (Stories)
- Café
- Escolinha Kids
- Projeção
- Mesa de Som
- Pastores
- Líder e Discipulador

Um membro pode ter mais de uma função.

## Painel Administrativo — visão futura

Criar somente depois da Área da Família estar estável.

O administrador deve poder:

- Ver e pesquisar membros.
- Ver todos os dados pessoais do perfil.
- Alterar status na igreja.
- Definir múltiplos ministérios.
- Conceder ou remover acesso administrativo.
- Ver visitantes.
- Ver pedidos de oração.
- Ver eventos e inscrições.

A regra administrativa deve usar somente `member_profiles.is_admin = true`.

## Infraestrutura conhecida

### GitHub

- Repositório: https://github.com/rilldygabriel/casaforteerechim
- Branch principal: `main`.

### Vercel

- Projeto: `casaforteerechim`.
- Projeto: https://vercel.com/rilldy-gabriel/casaforteerechim
- Team slug: `rilldy-gabriel`.
- Team ID: `team_Pw24QkatuwWyFJiYuYCKi12Z`.
- Project ID: `prj_My9r71EBQYchsF5T97S35WFXV8Kg`.
- Domínio: https://www.casaforteerechim.app.br
- Variáveis antigas do WhatsApp não devem ser copiadas automaticamente sem auditoria.

### Supabase

- Projeto autorizado: `CasaForte-Site-2026`.
- Project ref: `fjwkfpwraipxmcjlwssv`.
- URL: https://fjwkfpwraipxmcjlwssv.supabase.co
- Administrador: `ragrilldy@gmail.com` (`member_profiles.is_admin = true`).
- Tabelas públicas em uso: `visitantes`, `pedidos_oracao` e
  `member_profiles`, todas protegidas por RLS.
- `anon` pode somente inserir nos formulários públicos. Não pode selecionar,
  atualizar ou excluir registros.
- Administradores autenticados podem selecionar e atualizar conforme as
  políticas. Não existe permissão de `DELETE`.
- A função Edge `admin-password-recovery` atende exclusivamente a recuperação
  administrativa e valida criptograficamente a identidade OIDC da Vercel.
- A chave privilegiada do Supabase e a credencial do Resend nunca ficam no
  navegador nem no repositório.
- Projeto antigo proibido: `mfqlmsisrceyajspeeav`.

Não registrar tokens secretos neste repositório.

## WhatsApp Cloud API — referência futura

- Número da automação/API: `+55 54 9139-4214`.
- Phone Number ID: `1188719124331063`.
- WABA ID: `1641857234201988`.
- Número que deve receber as notificações: `5554992640253`.
- Template planejado: `notificacao_site_casa_forte`.
- Idioma: `pt_BR`.

Não registrar token permanente no GitHub. Usar variáveis de ambiente da Vercel.

## Estado atual da reconstrução

- Site público publicado na Vercel.
- Formulário de visitantes integrado ao novo Supabase e validado em produção.
- Módulo de pedidos de oração integrado e disponível na página inicial e em
  `/oracao`.
- API interna de oração implementada em `/api/oracao`, usando `Prefer: return=minimal`.
- Notificações WhatsApp Cloud API de visitantes e pedidos de oração validadas.
- Rotas administrativas publicadas: `/admin/login`, `/admin`,
  `/admin/callback` e `/admin/redefinir-senha`.
- Login, logout, proteção de `/admin` e autorização por
  `member_profiles.is_admin` validados.
- Recuperação administrativa usa Vercel OIDC, função Edge do Supabase e
  Resend, sem depender do SMTP padrão limitado do Supabase.
- O painel de visitantes está disponível em `/admin/visitantes`, com pesquisa,
  filtro por status, consulta completa das fichas e atualização do andamento do
  acolhimento. O módulo mantém as políticas RLS existentes e não oferece nem
  concede `DELETE`.
- O painel de pedidos de oração está disponível em
  `/admin/pedidos-oracao`, com pesquisa, filtros, sinalização de urgência e
  atualização de status, responsável e observações internas. O módulo usa as
  políticas RLS existentes e não oferece nem concede `DELETE`.
- A página inicial oferece acesso direto e discreto ao painel administrativo no
  cabeçalho e no rodapé.
- As fotos da galeria abrem em rotas internas `/fotos/[slug]`, com botões
  explícitos para voltar ao site e à seção de fotos.
- Cada novo cadastro concluído na Área da Família envia uma notificação
  automática ao WhatsApp pastoral com nome, WhatsApp e e-mail do membro. O
  aviso só é disparado quando o cadastro nasce de fato; acessos já existentes
  não geram mensagens duplicadas.
- Cada membro aprovado pode preencher e atualizar os próprios dados dentro de
  `/familia`. A estrela só é concedida quando todos os campos obrigatórios e
  condicionais estão completos; `profile_completed` é calculado pelo banco e
  não pode ser alterado diretamente pelo navegador.
- Backup imediatamente anterior ao painel de visitantes:
  `backup-pre-painel-visitantes-2026-07-26`.
- Backup imediatamente anterior ao painel de pedidos de oração:
  `backup-pre-painel-oracoes-2026-07-26`.
- Backup imediatamente anterior à gestão de visitantes e ao visualizador de
  fotos: `backup-pre-painel-visitantes-gestao-e-fotos-2026-07-26`.
- A integração oficial da Bíblia está implementada em `/biblia` usando
  exclusivamente a YouVersion Platform pelo servidor. A chave
  `YVP_APP_KEY` deve existir somente nas variáveis protegidas da Vercel.
- A página inicial possui link para a Bíblia e um Versículo do Dia carregado
  sem bloquear o restante da home. Se a YouVersion estiver indisponível, o
  card é ocultado.
- Os textos bíblicos não são gravados no Supabase nem mantidos em cache
  permanente. Somente traduções confirmadas no catálogo licenciado da conta
  da organização são habilitadas.
- A Área da Família permite ativar notificações Web Push no aparelho para
  lembrar os cultos de domingo, quarta e sexta duas horas antes. No iPhone,
  o site precisa estar adicionado à Tela de Início. As inscrições ficam
  vinculadas ao membro, protegidas por RLS, e os envios são idempotentes.
- O endpoint `/api/cron/push-culto-reminders` é protegido por `CRON_SECRET`.
  Os jobs `notificacao-push-domingo`, `notificacao-push-quarta` e
  `notificacao-push-sexta` usam Supabase Cron, `pg_net` e o segredo existente
  no Vault. As chaves VAPID ficam nas variáveis protegidas da Vercel.

## Estado deste repositório

Este arquivo deve permanecer atualizado como referência de continuidade, sem
substituir a branch `main` como fonte da verdade.
