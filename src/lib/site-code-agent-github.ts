import { getToken } from "@vercel/connect";

const REPO = "rilldygabriel/casaforteerechim";
const API = `https://api.github.com/repos/${REPO}`;
const CONNECTOR = "github/casaforte-code-agent";
const INSTALLATION_ID = "161989416";

export type CodeFile = { path: string; action: "upsert" | "delete"; base64?: string };

export async function githubCodeToken() {
  return getToken(CONNECTOR, {
    subject: { type: "app" },
    installationId: INSTALLATION_ID,
    authorizationDetails: [{ type: "github_app_installation", repositories: [REPO],
      permissions: ["contents:write", "pull_requests:write"] }],
  });
}

async function github<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init, cache: "no-store", signal: AbortSignal.timeout(20_000),
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) throw new Error(`GitHub recusou ${path.split("?")[0]} (${response.status}).`);
  return response.json() as Promise<T>;
}

export async function mainCommitSha() {
  const token = await githubCodeToken();
  const ref = await github<{ object: { sha: string } }>(token, "/git/ref/heads/main");
  if (!/^[a-f0-9]{40}$/.test(ref.object.sha)) throw new Error("Referência principal inválida.");
  return ref.object.sha;
}

function isSafeFrontendPath(path: string) {
  if (path.includes("..") || path.includes("\\") || path.startsWith("/")) return false;
  return path === "src/app/casa-ai-overrides.css";
}

export function validateCodeFiles(files: CodeFile[]) {
  if (!files.length || files.length > 3) throw new Error("A alteração precisa conter de 1 a 3 arquivos de estilo.");
  let totalBytes = 0;
  const seen = new Set<string>();
  for (const file of files) {
    if (!isSafeFrontendPath(file.path) || seen.has(file.path)) throw new Error("Arquivo fora da área segura de interface.");
    seen.add(file.path);
    if (file.action !== "upsert") throw new Error("A exclusão de estilos não é automática.");
    if (file.action === "upsert") {
      const bytes = Buffer.from(file.base64 ?? "", "base64");
      if (!bytes.length || bytes.length > 200_000 || bytes.includes(0)) throw new Error("Arquivo vazio, binário ou grande demais.");
      const style = bytes.toString("utf8");
      if (style.includes("�") || /(?:@import|@font-face|url\s*\(|expression\s*\(|behavior\s*:)/i.test(style)) {
        throw new Error("O estilo contém referência externa ou instrução não permitida.");
      }
      totalBytes += bytes.length;
    }
  }
  if (totalBytes > 400_000) throw new Error("Alteração grande demais para publicação automática.");
}

export async function createCodePullRequest(input: { baseSha: string; branchName: string; files: CodeFile[] }) {
  validateCodeFiles(input.files);
  if (!/^codex\/casa-whatsapp-[a-f0-9]{12}$/.test(input.branchName)) throw new Error("Nome de branch inválido.");
  const token = await githubCodeToken();
  const current = await github<{ object: { sha: string } }>(token, "/git/ref/heads/main");
  if (current.object.sha !== input.baseSha) throw new Error("O site avançou desde o pedido. Reenvie a mudança para gerar uma prévia atualizada.");
  const base = await github<{ tree: { sha: string } }>(token, `/git/commits/${input.baseSha}`);
  const treeEntries: Array<{ path: string; mode: string; type: string; sha: string | null }> = [];
  for (const file of input.files) {
    if (file.action === "delete") { treeEntries.push({ path: file.path, mode: "100644", type: "blob", sha: null }); continue; }
    const blob = await github<{ sha: string }>(token, "/git/blobs", { method: "POST",
      body: JSON.stringify({ content: file.base64, encoding: "base64" }) });
    treeEntries.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  const tree = await github<{ sha: string }>(token, "/git/trees", { method: "POST",
    body: JSON.stringify({ base_tree: base.tree.sha, tree: treeEntries }) });
  const commit = await github<{ sha: string }>(token, "/git/commits", { method: "POST",
    body: JSON.stringify({ message: "Atualização de interface solicitada pelo pastor via WhatsApp",
      tree: tree.sha, parents: [input.baseSha] }) });
  await github(token, "/git/refs", { method: "POST", body: JSON.stringify({
    ref: `refs/heads/${input.branchName}`, sha: commit.sha }) });
  const pr = await github<{ number: number; html_url: string; head: { sha: string } }>(token, "/pulls", {
    method: "POST", body: JSON.stringify({ title: "Atualização da interface Casa Forte",
      head: input.branchName, base: "main",
      body: "Alteração de interface gerada em ambiente isolado. A publicação exige confirmação por WhatsApp do pastor e verificações da prévia." }),
  });
  return { number: pr.number, url: pr.html_url, headSha: pr.head.sha };
}

export async function mergeCodePullRequest(number: number, expectedHeadSha: string) {
  const token = await githubCodeToken();
  const pr = await github<{ state: string; head: { sha: string }; base: { ref: string }; merged: boolean; merge_commit_sha: string | null }>(token, `/pulls/${number}`);
  if (pr.merged) {
    if (!pr.merge_commit_sha || !/^[a-f0-9]{40}$/.test(pr.merge_commit_sha)) throw new Error("Merge antigo sem commit verificável.");
    return { merged: true, sha: pr.merge_commit_sha };
  }
  if (pr.state !== "open" || pr.base.ref !== "main" || pr.head.sha !== expectedHeadSha) throw new Error("A prévia mudou ou foi fechada; não vou publicar outra versão.");
  const result = await github<{ merged: boolean; sha: string }>(token, `/pulls/${number}/merge`, {
    method: "PUT", body: JSON.stringify({ commit_title: "Atualização da interface Casa Forte", merge_method: "squash", sha: expectedHeadSha }),
  });
  if (!result.merged) throw new Error("GitHub não confirmou a publicação.");
  return result;
}

export async function vercelCommitDeploymentReady(sha: string) {
  if (!/^[a-f0-9]{40}$/.test(sha)) return false;
  const response = await fetch(`${API}/commits/${sha}/status`, {
    headers: { Accept: "application/vnd.github+json" }, cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Não foi possível conferir a prévia Vercel (${response.status}).`);
  const data = await response.json() as { statuses?: Array<{ context: string; state: string; description?: string }> };
  return Boolean(data.statuses?.some((status) => status.context === "Vercel – casaforteerechim" &&
    status.state === "success" && status.description === "Deployment has completed"));
}
