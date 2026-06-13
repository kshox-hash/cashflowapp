"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import DesktopShell from "../components/layout/DesktopShell";
import AppCard from "../components/ui/AppCard";
import MetricBox from "../components/ui/MetricBox";
import PageTitle from "../components/ui/PageTitle";
import StatusPill from "../components/ui/StatusPill";
import { BackendApi } from "../services/backend.api";
import { money, monthLabelShort } from "../utils/format";

import "./insights.css";

const CATEGORY_COLORS: Record<string, string> = {
  venta: "#2563eb",
  cliente: "#7c3aed",
  proveedor: "#dc2626",
  sueldo: "#d97706",
  impuesto: "#059669",
  arriendo: "#0891b2",
  servicio: "#9333ea",
  logistica: "#ea580c",
  other: "#94a3b8",
};

type Movement = {
  direction: "income" | "expense";
  category: string;
  amount: number;
};

type MonthlySummary = {
  month: string;
  income: number;
  costs: number;
  netMovement: number;
  endingBalance: number;
};

export default function InsightsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [cashFlow, setCashFlow] = useState<{
    currentBalance: number;
    minimumThreshold: number;
    lowestBalance: number;
    monthlySummary: MonthlySummary[];
    movements: Movement[];
  } | null>(null);

  const [bills, setBills] = useState<{ total: number; overdue: number } | null>(null);
  const [invoices, setInvoices] = useState<{ total: number; overdue: number; currentMonth: number } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const now = new Date();
        const startDate = `${now.getFullYear()}-${String(now.getMonth() - 5).padStart(2, "0")}-01`;
        const fixedStart = now.getMonth() < 6
          ? `${now.getFullYear() - 1}-${String(now.getMonth() + 7).padStart(2, "0")}-01`
          : `${now.getFullYear()}-${String(now.getMonth() - 5).padStart(2, "0")}-01`;

        const [cf, b, inv] = await Promise.all([
          BackendApi.getCashFlowSummary(fixedStart, 6),
          BackendApi.getBillsToPaySummary(),
          BackendApi.getInvoicesDueSummary(),
        ]);
        setCashFlow(cf);
        setBills(b);
        setInvoices(inv);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error cargando indicadores");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const monthlySummary: MonthlySummary[] = cashFlow?.monthlySummary ?? [];
  const movements: Movement[] = cashFlow?.movements ?? [];

  const avgBurnRate =
    monthlySummary.length > 0
      ? monthlySummary.reduce((s, m) => s + m.costs, 0) / monthlySummary.length
      : 0;

  const avgIncome =
    monthlySummary.length > 0
      ? monthlySummary.reduce((s, m) => s + m.income, 0) / monthlySummary.length
      : 0;

  const runway =
    avgBurnRate > 0
      ? (cashFlow?.currentBalance ?? 0) / avgBurnRate
      : null;

  const coverageRatio = avgBurnRate > 0 ? avgIncome / avgBurnRate : null;
  const isSafe = cashFlow
    ? cashFlow.lowestBalance >= cashFlow.minimumThreshold
    : true;

  const expenseByCategory = movements
    .filter((m) => m.direction === "expense")
    .reduce<Record<string, number>>((acc, m) => {
      acc[m.category] = (acc[m.category] ?? 0) + m.amount;
      return acc;
    }, {});

  const pieData = Object.entries(expenseByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));

  const barData = monthlySummary.map((m) => ({
    month: monthLabelShort(m.month),
    Ingresos: m.income,
    Costos: m.costs,
  }));

  return (
    <DesktopShell activeRoute="/insights">
      <div className="insightsPage">
        <div className="insightsHero">
          <PageTitle
            title="Indicadores"
            subtitle="Métricas financieras clave calculadas en tiempo real."
          />
          <StatusPill
            label={isSafe ? "Caja saludable" : "Riesgo de caja"}
            color={isSafe ? "green" : "red"}
          />
        </div>

        {loading && (
          <div className="metricsGrid4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeletonMetric" />
            ))}
          </div>
        )}

        {error && (
          <AppCard>
            <div style={{ color: "#b91c1c", padding: 16, fontSize: 13 }}>{error}</div>
          </AppCard>
        )}

        {!loading && !error && (
          <>
            <div className="metricsGrid4">
              <MetricBox
                title="Runway"
                value={runway !== null ? `${runway.toFixed(1)} meses` : "N/A"}
                subtitle="Meses de operación al ritmo actual"
                accent={
                  runway === null ? undefined : runway > 6 ? "green" : runway > 3 ? "amber" : "red"
                }
              />
              <MetricBox
                title="Burn rate mensual"
                value={`CLP ${money(avgBurnRate)}`}
                subtitle="Gasto promedio por mes (últimos 6 meses)"
                accent="amber"
              />
              <MetricBox
                title="Ingreso promedio"
                value={`CLP ${money(avgIncome)}`}
                subtitle="Ingreso promedio mensual (últimos 6 meses)"
                accent="blue"
              />
              <MetricBox
                title="Cobertura de ingresos"
                value={
                  coverageRatio !== null
                    ? `${(coverageRatio * 100).toFixed(0)}%`
                    : "N/A"
                }
                subtitle="Ingresos / Costos — sobre 100% es superávit"
                accent={
                  coverageRatio === null
                    ? undefined
                    : coverageRatio >= 1
                    ? "green"
                    : "red"
                }
              />
            </div>

            <div className="insightsAlerts">
              {(bills?.overdue ?? 0) > 0 && (
                <div className="alertCard red">
                  <strong>Cuentas por pagar vencidas</strong>
                  <span>CLP {money(bills!.overdue)} sin pagar</span>
                </div>
              )}
              {(invoices?.overdue ?? 0) > 0 && (
                <div className="alertCard amber">
                  <strong>Facturas por cobrar vencidas</strong>
                  <span>CLP {money(invoices!.overdue)} pendientes de cobro</span>
                </div>
              )}
              {!isSafe && (
                <div className="alertCard red">
                  <strong>Riesgo de caja proyectado</strong>
                  <span>
                    El saldo mínimo proyectado ({money(cashFlow!.lowestBalance)}) cae bajo el
                    umbral ({money(cashFlow!.minimumThreshold)})
                  </span>
                </div>
              )}
            </div>

            <div className="insightsGrid2">
              <AppCard noPadding>
                <div className="chartHeaderFull">
                  <h3>Ingresos vs Costos por mes</h3>
                  <p>Comparativa mensual de flujos</p>
                </div>
                {barData.length === 0 ? (
                  <div className="emptyBox">Sin datos disponibles</div>
                ) : (
                  <div className="insightsChart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} barSize={18}>
                        <CartesianGrid stroke="#e7ecf3" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => `${(Number(v) / 1_000_000).toFixed(0)}M`}
                        />
                        <Tooltip formatter={(v) => `CLP ${money(Number(v))}`} />
                        <Legend />
                        <Bar dataKey="Ingresos" fill="#2563eb" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Costos" fill="#dc2626" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </AppCard>

              <AppCard noPadding>
                <div className="chartHeaderFull">
                  <h3>Composición de gastos</h3>
                  <p>Por categoría en el período visible</p>
                </div>
                {pieData.length === 0 ? (
                  <div className="emptyBox">Sin movimientos de egreso registrados</div>
                ) : (
                  <div className="insightsChart">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          dataKey="value"
                          label={({ name, percent }: { name?: string; percent?: number }) =>
                            `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                          }
                          labelLine={false}
                        >
                          {pieData.map((entry, index) => (
                            <Cell
                              key={entry.name}
                              fill={
                                CATEGORY_COLORS[entry.name] ??
                                `hsl(${(index * 47) % 360}, 65%, 52%)`
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => `CLP ${money(Number(v))}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </AppCard>
            </div>

            <AppCard noPadding>
              <div className="chartHeaderFull">
                <h3>Detalle mensual</h3>
                <p>Ingresos, costos, neto y saldo final por mes</p>
              </div>
              {monthlySummary.length === 0 ? (
                <div className="emptyBox">Sin datos</div>
              ) : (
                <div className="tableScroll">
                  <table className="insightsTable">
                    <thead>
                      <tr>
                        <th>Mes</th>
                        <th>Ingresos</th>
                        <th>Costos</th>
                        <th>Flujo neto</th>
                        <th>Saldo final</th>
                        <th>Cobertura</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlySummary.map((row) => {
                        const cov = row.costs > 0 ? row.income / row.costs : null;
                        return (
                          <tr key={row.month}>
                            <td>{monthLabelShort(row.month)}</td>
                            <td className="positive">{money(row.income)}</td>
                            <td className="negative">-{money(row.costs)}</td>
                            <td className={row.netMovement < 0 ? "negative" : "positive"}>
                              {row.netMovement < 0 ? "-" : ""}
                              {money(Math.abs(row.netMovement))}
                            </td>
                            <td>{money(row.endingBalance)}</td>
                            <td>
                              {cov !== null ? (
                                <span className={cov >= 1 ? "positive" : "negative"}>
                                  {(cov * 100).toFixed(0)}%
                                </span>
                              ) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </AppCard>
          </>
        )}
      </div>
    </DesktopShell>
  );
}
