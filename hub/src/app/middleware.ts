import { auth } from "@/lib/auth";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const isLoginPage = nextUrl.pathname === "/login";
  const isPublic = nextUrl.pathname === "/" || isLoginPage;

  if (isPublic && !isLoggedIn && nextUrl.pathname === "/") {
    return Response.redirect(new URL("/login", nextUrl));
  }

  if (isLoginPage && isLoggedIn) {
    const role = (req.auth?.user as { role?: string })?.role;
    if (role === "admin") {
      return Response.redirect(new URL("/admin/config/clientes", nextUrl));
    }
    return Response.redirect(new URL("/dashboard", nextUrl));
  }

  if (!isLoggedIn && !isPublic) {
    return Response.redirect(new URL("/login", nextUrl));
  }

  return undefined;
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
