import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f7fb", fontFamily: "Arial, sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: "#2563eb", color: "#fff", fontSize: 22, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>↗</div>
        <h1 style={{ margin: "0 0 8px", fontSize: 64, fontWeight: 900, color: "#101828", letterSpacing: -2 }}>404</h1>
        <p style={{ margin: "0 0 28px", fontSize: 15, color: "#667085" }}>Esta página no existe o fue movida.</p>
        <Link href="/dashboard" style={{ display: "inline-block", padding: "12px 24px", background: "#2563eb", color: "#fff", borderRadius: 10, fontSize: 14, fontWeight: 800, textDecoration: "none" }}>
          Ir al Dashboard
        </Link>
      </div>
    </main>
  );
}
