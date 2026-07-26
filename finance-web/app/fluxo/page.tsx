import { redirect } from "next/navigation";

// O fluxo de caixa agora vive em /analises.
export default function FluxoRedirect() {
  redirect("/analises");
}
