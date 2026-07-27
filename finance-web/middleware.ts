import { NextRequest, NextResponse } from "next/server";

// Gate leve: so checa se o cookie de sessao existe (a validacao real da
// assinatura acontece no backend, que devolve 401 se invalido/expirado).
// Evita mostrar a casca do app pra quem nao tem sessao nenhuma.
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has("session");
  const isLoginPage = req.nextUrl.pathname === "/login";

  if (!hasSession && !isLoginPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (hasSession && isLoginPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/backend).*)"],
};
