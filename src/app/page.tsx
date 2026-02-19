export default function HomePage() {
  return (
    <main style={{ textAlign: "center", padding: "2rem" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Northempresarial</h1>
      <p style={{ color: "#a1a1aa", marginBottom: "2rem" }}>Site institucional</p>
      <a
        href="https://hub.northempresarial.com"
        style={{
          display: "inline-block",
          padding: "0.75rem 1.5rem",
          background: "#2563eb",
          color: "white",
          borderRadius: "0.5rem",
          textDecoration: "none",
          fontWeight: 500,
        }}
      >
        Acessar o Hub
      </a>
    </main>
  );
}
