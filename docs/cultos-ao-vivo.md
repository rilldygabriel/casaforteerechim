# Cultos ao vivo

- Canal fixo da igreja: `UCKNTxNCEZrPT-EHiU61qA2A`.
- `/ao-vivo`, início e Área da Família consultam `/api/live` a cada 30 segundos, somente com a página visível. Sem autoplay com áudio.
- `/api/cron/youtube-live` exige `CRON_SECRET` e roda a cada minuto na produção. A chave `YOUTUBE_API_KEY` fica somente no servidor e deve ser restrita a YouTube Data API v3.
- Busca de lives a cada 5 minutos a partir de domingo 18h30 e quarta 19h, até a virada do dia em America/Sao_Paulo. Nos outros horários, busca a cada hora. Horários anunciados ao público: domingo 19h e quarta 19h30.
- Uma transmissão identificada é revalidada a cada minuto, mesmo fora da janela e após a meia-noite. Só encerra quando o YouTube deixa de confirmar a live. A última Palavra gravada não é substituída.
- O início depende da indexação do YouTube, mais o intervalo de busca. Não há promessa de detecção instantânea. Limite defensivo de 90 buscas por dia no fuso America/Los_Angeles; todos os espectadores compartilham o mesmo cache.
- Sem resposta do provedor, uma confirmação ao vivo expira em 3 minutos. O player já aberto é mantido para não interromper quem assiste, mas o selo ao vivo é retirado. Uma confirmação de encerramento limpa o player.
- Lives precisam ser públicas e pertencer ao canal configurado. Se a incorporação estiver bloqueada, aparece link direto para o YouTube.
- A tabela `youtube_live_status` possui RLS e acesso revogado para anon/authenticated; apenas o servidor a consulta/atualiza. Lease impede chamadas simultâneas duplicadas.
- Não há disparo de push/WhatsApp, publicação de vídeo nem alteração do canal nesta integração.

## Verificação

`node --experimental-strip-types --test scripts/youtube-live*.test.mjs`

Após deploy: verificar `/api/live`, o cache e `checked_at` no Supabase, execução automática do cron, HTTP 401 sem segredo e a tela `/ao-vivo`. Sem culto em andamento, não usar vídeo gravado como falsa evidência de live; a reprodução real precisa ser conferida na próxima transmissão.
