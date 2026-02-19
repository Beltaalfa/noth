import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Northempresarial",
  description: "Northempresarial",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0a0a0a", color: "#fafafa", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {children}
      </body>
    </html>
  );
}
