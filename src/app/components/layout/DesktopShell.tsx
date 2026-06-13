"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

import { getToken, getUser, logout } from "../../services/auth.service";

import "./DesktopShell.css";

type Props = {
  activeRoute: string;
  children: React.ReactNode;
};

const navItems = [
  { label: "Dashboard", route: "/dashboard" },
  { label: "Flujo de Caja", route: "/cash-flow" },
  { label: "Costos de Personal", route: "/people-costs" },
  { label: "Facturas por Cobrar", route: "/invoices-due" },
  { label: "Cuentas por Pagar", route: "/bills-to-pay" },
  { label: "Indicadores", route: "/insights" },
];

export default function DesktopShell({ activeRoute, children }: Props) {
  const router = useRouter();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
    } else {
      setUser(getUser());
    }
  }, [router]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [activeRoute]);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <div className="desktopShell">
      <header className="topNavigation">
        <div className="brand">
          <div className="brandIcon">↗</div>
          <div className="brandText">CASHFLOW</div>
        </div>

        <nav className="navScroll">
          {navItems.map((item) => {
            const isActive = activeRoute === item.route;
            return (
              <Link
                key={item.route}
                href={item.route}
                className={`topNavItem ${isActive ? "active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="navRight">
          <div className="userMenuWrapper" ref={userMenuRef}>
            <button
              className="userButton"
              onClick={() => setIsUserMenuOpen((v) => !v)}
              title="Opciones de usuario"
              type="button"
            >
              {user?.email?.[0]?.toUpperCase() ?? "U"}
            </button>

            {isUserMenuOpen && (
              <div className="userDropdown">
                <div className="userDropdownHeader">
                  <span className="userDropdownName">
                    {user?.email ?? "Usuario"}
                  </span>
                  <span className="userDropdownRole">
                    {user?.role ?? "Sesión activa"}
                  </span>
                </div>
                <button
                  className="logoutButton"
                  onClick={handleLogout}
                  type="button"
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>

          <button
            className="hamburger"
            onClick={() => setIsMobileNavOpen((v) => !v)}
            type="button"
            aria-label="Menú"
          >
            {isMobileNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {isMobileNavOpen && (
        <div className="mobileNav">
          {navItems.map((item) => {
            const isActive = activeRoute === item.route;
            return (
              <Link
                key={item.route}
                href={item.route}
                className={`mobileNavItem ${isActive ? "active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
          <button className="mobileLogout" onClick={handleLogout} type="button">
            Cerrar sesión
          </button>
        </div>
      )}

      <main className="contentScroll">
        <div className="contentInner">{children}</div>
      </main>
    </div>
  );
}
