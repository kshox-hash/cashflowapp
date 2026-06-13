"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { login } from "../services/auth.service";

import "./login.css";

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (lockedUntil === null) return;

    timerRef.current = setInterval(() => {
      const remaining = Math.ceil((lockedUntil - Date.now()) / 1000);

      if (remaining <= 0) {
        clearInterval(timerRef.current!);
        setLockedUntil(null);
        setAttempts(0);
        setCountdown(0);
        setError("");
      } else {
        setCountdown(remaining);
      }
    }, 500);

    return () => clearInterval(timerRef.current!);
  }, [lockedUntil]);

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLocked) return;

    setError("");
    setMessage("");

    if (!email.trim() || !password.trim()) {
      setError("Debes ingresar correo y contraseña");
      return;
    }

    try {
      setLoading(true);

      await login(email, password);

      setMessage("Sesión iniciada correctamente");
      setAttempts(0);

      router.push("/dashboard");
    } catch (err) {
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);

      if (nextAttempts >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_SECONDS * 1000;
        setLockedUntil(until);
        setCountdown(LOCKOUT_SECONDS);
        setError(
          `Demasiados intentos fallidos. Espera ${LOCKOUT_SECONDS} segundos.`
        );
      } else {
        const remaining = MAX_ATTEMPTS - nextAttempts;
        setError(
          `${err instanceof Error ? err.message : "Error al iniciar sesión"}. ${remaining} intento${remaining === 1 ? "" : "s"} restante${remaining === 1 ? "" : "s"}.`
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="loginPage">
      <div className="loginRight">
        <form className="loginCard" onSubmit={handleLogin}>
          <div className="loginLogo">
            <div className="loginLogoIcon">↗</div>
            <span className="loginLogoText">CASHFLOW</span>
          </div>

          <h1>Bienvenido</h1>
          <p>Ingresa con las credenciales entregadas por el administrador.</p>

          {error && (
            <div className="loginAlert error">
              {error}
              {isLocked && countdown > 0 && (
                <span className="lockCountdown"> ({countdown}s)</span>
              )}
            </div>
          )}
          {message && <div className="loginAlert success">{message}</div>}

          <label>
            Correo electrónico
            <input
              type="email"
              placeholder="correo@empresa.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isLocked}
            />
          </label>

          <label>
            Contraseña
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isLocked}
            />
          </label>

          <button type="submit" disabled={loading || isLocked}>
            {isLocked ? `Bloqueado (${countdown}s)` : loading ? "Ingresando..." : "Ingresar →"}
          </button>
        </form>
      </div>
    </main>
  );
}
