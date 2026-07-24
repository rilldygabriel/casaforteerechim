# Casa Forte Erechim — contexto para reconstrução

Este repositório foi limpo para que o site seja reconstruído do zero em uma nova conversa.

## Regras de trabalho definidas pelo pastor Rilldy

- Trabalhar em português do Brasil.
- Executar diretamente no GitHub e publicar na Vercel quando solicitado.
- Não afirmar que algo foi publicado sem confirmar o deploy READY.
- Avançar uma etapa por vez.
- Não despejar planos longos nem ideias não solicitadas.
- Tudo que precisar ser alterado no Supabase deve ser entregue em formato de prompt completo para o Claude executar.
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
- Fotos dos cultos: https://drive.google.com/drive/folders/1yzaEqUTo51ujr6KShIY2KjOgglW5WDd_

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
- Ano em que aceitou Jesus.
- Se veio de outro ministério nos últimos 3 anos.
- Se é batizado.
- Status na igreja.
- Perfil 100% preenchido gera uma estrela.
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

O Supabase será limpo pelo Claude antes da reconstrução.

Referências conhecidas:

- Projeto antigo: `Casaforte-Admin`.
- Project ref: `mfqlmsisrceyajspeeav`.
- URL: https://mfqlmsisrceyajspeeav.supabase.co
- Usuário administrador esperado: `ragrilldy@gmail.com`.
- UID conhecido: `4388cb10-ed64-4950-ba86-9a82c45ab7dd`.

Não registrar tokens secretos neste repositório.

## WhatsApp Cloud API — referência futura

- Número da automação/API: `+55 54 9139-4214`.
- Phone Number ID: `1188719124331063`.
- WABA ID: `1641857234201988`.
- Número que deve receber as notificações: `5554992640253`.
- Template planejado: `notificacao_site_casa_forte`.
- Idioma: `pt_BR`.

Não registrar token permanente no GitHub. Usar variáveis de ambiente da Vercel.

## Ordem recomendada para a nova conversa

1. Recriar somente o site público estático.
2. Publicar e testar em celular e computador.
3. Conectar visitante e oração ao Supabase.
4. Configurar notificações WhatsApp.
5. Criar Área da Família em etapas pequenas.
6. Criar Painel Administrativo somente depois.

## Estado deste repositório

O código antigo foi removido intencionalmente. Este arquivo deve permanecer como fonte de contexto para a reconstrução.