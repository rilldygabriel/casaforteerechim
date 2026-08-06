import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Política de Privacidade da Igreja Casa Forte Erechim.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="legal-page">
      <article className="legal-card">
        <p className="section-eyebrow"><span />Privacidade e cuidado</p>
        <h1>Política de Privacidade</h1>
        <p className="legal-updated">Última atualização: 6 de agosto de 2026.</p>

        <p>
          A Igreja Casa Forte Erechim respeita sua privacidade. Esta política explica como tratamos os dados enviados pelo site, pela Área da Família e pelos canais oficiais de atendimento, incluindo o WhatsApp.
        </p>

        <h2>Dados que podemos receber</h2>
        <p>
          Podemos receber nome, telefone, e-mail, foto de perfil, data de nascimento, informações de participação na igreja, pedidos de oração, inscrições em eventos e mensagens enviadas ao número oficial da Casa.
        </p>

        <h2>Como usamos esses dados</h2>
        <p>
          Usamos as informações para administrar cadastros e inscrições, prestar cuidado pastoral, acompanhar visitantes e membros, responder mensagens, enviar avisos solicitados e manter a segurança dos nossos serviços.
        </p>

        <h2>WhatsApp</h2>
        <p>
          As mensagens enviadas ao número oficial podem ser armazenadas de forma segura para que a equipe autorizada consiga visualizar o histórico e responder pelo painel administrativo. Não vendemos nem utilizamos essas mensagens para publicidade de terceiros.
        </p>

        <h2>Compartilhamento e segurança</h2>
        <p>
          O acesso é limitado a pessoas autorizadas conforme suas funções. Podemos usar fornecedores de infraestrutura, autenticação, hospedagem e comunicação somente para operar o serviço e sempre de acordo com as finalidades descritas nesta política.
        </p>

        <h2>Seus direitos</h2>
        <p>
          Você pode solicitar confirmação do tratamento, acesso, correção ou exclusão de seus dados, quando aplicável. Para isso, entre em contato pelos canais oficiais disponíveis no site.
        </p>

        <h2>Contato</h2>
        <p>
          Para dúvidas sobre privacidade ou solicitações relacionadas aos seus dados, fale com a Igreja Casa Forte Erechim pela página <Link href="/#contato">Fale Conosco</Link>.
        </p>

        <Link className="legal-back-link" href="/">Voltar ao site</Link>
      </article>
    </main>
  );
}
