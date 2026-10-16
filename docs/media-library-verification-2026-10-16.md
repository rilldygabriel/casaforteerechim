# Pronto para postar — verificação em produção

Data: 16/10/2026. Site: https://www.casaforteerechim.app.br/admin/pronto-para-postar

## Escopo e isolamento

- Projeto Supabase exclusivo da igreja: fjwkfpwraipxmcjlwssv; bucket privado casa-ready-media.
- Administradores aprovados e membros aprovados classificados como Mídia têm acesso. Nenhum membro real foi classificado automaticamente.
- Testes de servidor: visitante 401, membro sem classificação 403, membro Mídia autorizado, retirada da classificação revoga o acesso.
- Arquivos com URLs temporárias individuais; escrita de metadados restrita ao servidor.

## Testes efetivamente executados

- Imagem única de mais de 7 MB (TUS em múltiplos blocos), carrossel de nove slides e Reel MP4 válido com capa separada.
- Manifestos idempotentes, conclusão e persistência, sequência de slides, downloads individuais e ZIP com legenda completa.
- Comparação SHA-256 de cada original baixado; ZIP inclui os mesmos bytes dos originais e legenda com acentos, emoji e quebras de linha.
- Marcar/desmarcar postado entre duas contas temporárias autorizadas; status compartilhado sem alterar arquivos.
- Busca e filtros combinados cobertos por testes unitários; busca e contadores de Reel observados no Safari.
- Upload real pela interface Safari, reprodução do MP4 até o fim, visualização da capa, confirmação de copiar legenda e download ZIP concluído.
- ZIP baixado pelo Safari conferido no disco: video-final.mp4, capa.png e legenda.txt; hashes iguais aos arquivos enviados.
- Compartilhamento nativo do Safari abriu com opção Adicionar ao Fotos; cancelado sem importar material técnico.
- Limite global de armazenamento ajustado de 2 para 5 GB. Reserva TUS de 5 GiB aceita pelo provedor; não foi transferido um arquivo completo de 5 GB.
- Contas, registros e objetos técnicos removidos. Consulta final retornou zero contas de teste, zero materiais e zero objetos neste bucket novo.

## Limites da verificação

- Não houve teste físico em iPhone ou Android. O compartilhamento depende do suporte do aparelho; a interface oferece originais e ZIP como alternativa e exige ação explícita para salvar nas Fotos.
- Vídeos MOV podem depender do codec disponível no navegador, sem conversão dos originais.
- A biblioteca não publica automaticamente em redes sociais.
- A rota temporária de verificação privada foi removida nesta entrega final.

## Publicação

- Next.js 16.3.5 / Node.js 24, Vercel; PRs 206, 207 e 208 implementaram a biblioteca e a correção do endpoint TUS assinado.
- Verificação funcional realizada no deploy de produção READY 53868f1. Esta revisão final remove a rota técnica e ajusta os controles do cabeçalho.
- Testes locais: testes unitários da mídia, TypeScript, ESLint dos arquivos da biblioteca e build de produção.
