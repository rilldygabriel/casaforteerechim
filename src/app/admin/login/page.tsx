import AdminLoginForm from "./login-form";

type LoginPageProps = {
  searchParams: Promise<{
    erro?: string;
    mensagem?: string;
  }>;
};

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const initialMessage =
    params.mensagem === "senha-atualizada"
      ? "Senha atualizada. Agora você já pode entrar."
      : "";
  const initialError =
    params.erro === "sem-permissao"
      ? "Este usuário não possui acesso administrativo."
      : params.erro === "link-invalido"
        ? "Este link expirou ou não é mais válido."
        : params.erro === "sessao-expirada"
          ? "Sua sessão expirou. Entre novamente para continuar."
        : "";

  return (
    <AdminLoginForm
      initialError={initialError}
      initialMessage={initialMessage}
    />
  );
}
