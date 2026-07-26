import { redirect } from "next/navigation";

// As recorrências agora vivem na aba Recorrentes de /transacoes.
export default function RecorrentesRedirect() {
  redirect("/transacoes?tab=recorrentes");
}
