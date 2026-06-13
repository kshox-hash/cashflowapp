"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";

import DesktopShell from "../components/layout/DesktopShell";
import AppCard from "../components/ui/AppCard";
import PageTitle from "../components/ui/PageTitle";
import { BackendApi } from "../services/backend.api";
import { money, monthLabelShort } from "../utils/format";

import "./dashboard.css";

type DashboardData = {
  cashFlow: {
    currentBalance: number;
    minimumThreshold: number;
    lowestBalance: number;
    chart: { label: string; balance: number }[];
    monthlySummary: { month: string; income: number; costs: number; netMovement: number; endingBalance: number }[];
  } | null;
  invoices: { total: number; overdue: number; currentMonth: number } | null;
  bills: { total: number; dueThisWeek: number; overdue: number } | null;
  people: { total: number; currentMonthTotal: number } | null;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    cashFlow: null,
    invoices: null,
    bills: null,
    people: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const now = new Date();
        const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

        const [cashFlow, invoices, bills, people] = await Promise.all([
          BackendApi.getCashFlowSummary(startDate, 6),
          BackendApi.getInvoicesDueSummary(),
          BackendApi.getBillsToPaySummary(),
          BackendApi.getPeopleCostsSummary(),
        ]);

        setData({ cashFlow, invoices, bills, people });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error cargando datos");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const cf = data.cashFlow;
  const burnRate = cf?.monthlySummary?.length
    ? cf.monthlySummary.reduce((s, m) => s + m.costs, 0) / cf.monthlySummary.length
    : 0;
  const runway = burnRate > 0 ? (cf?.currentBalance ?? 0) / burnRate : null;
  const isSafe = cf ? cf.lowestBalance >= cf.minimumThreshold : true;

  const chartData = cf?.chart?.slice(-6).map((item) => ({
    ...item,
    label: item.label,
  })) ?? [];

  const recentMonths = cf?.monthlySummary?.slice(-3) ?? [];

  return (
    <DesktopShell activeRoute="/dashboard">
      <div className="dashboardPage">
        <div className="dashboardHero">
          <PageTitle
            title="Dashboard"
            subtitle="Visión consolidada del estado financiero."
          />
          {!isSafe && cf && (
            <div className="riskBanner">
              <AlertTriangle size={16} />
              Riesgo de caja detectado — el saldo proyectado cae bajo el umbral mínimo.
            </div>
          )}
        </div>

        {loading && (
          <div className="metricsGrid">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeletonMetric" />
            ))}
          </div>
        )}

        {error && (
          <AppCard>
            <div className="errorBox">{error}</div>
          </AppCard>
        )}

        {!loading && !error && (
          <>
            <div className="metricsGrid">
              <AppCard>
                <div className="dashMetric">
                  <div className="dashMetricIcon blue">
                    <Wallet size={18} />
                  </div>
                  <div>
                    <p className="dashMetricLabel">Saldo actual</p>
                    <h2 className="dashMetricValue">
                      CLP {money(cf?.currentBalance ?? 0)}
                    </h2>
                    <p className="dashMetricSub">
                      {runway !== null
                        ? `Runway ~${runway.toFixed(1)} meses`
                        : "Sin datos de proyección"}
                    </p>
                  </div>
                </div>
              </AppCard>

              <AppCard>
                <div className="dashMetric">
                  <div className="dashMetricIcon green">
                    <TrendingUp size={18} />
                  </div>
                  <div>
                    <p className="dashMetricLabel">Facturas por cobrar</p>
                    <h2 className="dashMetricValue green">
                      CLP {money(data.invoices?.total ?? 0)}
                    </h2>
                    <p className="dashMetricSub">
                      {money(data.invoices?.overdue ?? 0)} vencidas
                    </p>
                  </div>
                </div>
              </AppCard>

              <AppCard>
                <div className="dashMetric">
                  <div className="dashMetricIcon red">
                    <TrendingDown size={18} />
                  </div>
                  <div>
                    <p className="dashMetricLabel">Cuentas por pagar</p>
                    <h2 className="dashMetricValue red">
                      CLP {money(data.bills?.total ?? 0)}
                    </h2>
                    <p className="dashMetricSub">
                      {money(data.bills?.dueThisWeek ?? 0)} vencen esta semana
                    </p>
                  </div>
                </div>
              </AppCard>

              <AppCard>
                <div className="dashMetric">
                  <div className="dashMetricIcon amber">
                    <Users size={18} />
                  </div>
                  <div>
                    <p className="dashMetricLabel">Personal este mes</p>
                    <h2 className="dashMetricValue amber">
                      CLP {money(data.people?.currentMonthTotal ?? 0)}
                    </h2>
                    <p className="dashMetricSub">
                      Total acumulado: CLP {money(data.people?.total ?? 0)}
                    </p>
                  </div>
                </div>
              </AppCard>
            </div>

            <div className="dashGrid2">
              <AppCard noPadding>
                <div className="chartHeaderFull">
                  <h3>Proyección de saldo (6 meses)</h3>
                  <p>Evolución del saldo proyectado</p>
                </div>
                <div className="dashChart">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="dashFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#e7ecf3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `${(Number(v) / 1_000_000).toFixed(0)}M`}
                      />
                      <Tooltip formatter={(v) => `CLP ${money(Number(v))}`} />
                      <Area
                        type="monotone"
                        dataKey="balance"
                        stroke="#2563eb"
                        strokeWidth={2.5}
                        fill="url(#dashFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </AppCard>

              <AppCard noPadding>
                <div className="chartHeaderFull">
                  <h3>Resumen últimos meses</h3>
                  <p>Ingresos, costos y flujo neto</p>
                </div>
                {recentMonths.length === 0 ? (
                  <div className="emptyBox">Sin datos disponibles</div>
                ) : (
                  <table className="dashTable">
                    <thead>
                      <tr>
                        <th>Mes</th>
                        <th>Ingresos</th>
                        <th>Costos</th>
                        <th>Neto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentMonths.map((row) => (
                        <tr key={row.month}>
                          <td>{monthLabelShort(row.month)}</td>
                          <td className="positive">{money(row.income)}</td>
                          <td className="negative">-{money(row.costs)}</td>
                          <td className={row.netMovement < 0 ? "negative" : "positive"}>
                            {row.netMovement < 0 ? "-" : ""}{money(Math.abs(row.netMovement))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </AppCard>
            </div>

            <div className="dashGrid3">
              <AppCard>
                <h3 className="dashCardTitle">Estado de cuentas por pagar</h3>
                <div className="dashStatList">
                  <div className="dashStat">
                    <span>Total abierto</span>
                    <strong>CLP {money(data.bills?.total ?? 0)}</strong>
                  </div>
                  <div className="dashStat">
                    <span>Vence esta semana</span>
                    <strong className="amber">CLP {money(data.bills?.dueThisWeek ?? 0)}</strong>
                  </div>
                  <div className="dashStat">
                    <span>Vencidas</span>
                    <strong className="red">CLP {money(data.bills?.overdue ?? 0)}</strong>
                  </div>
                </div>
              </AppCard>

              <AppCard>
                <h3 className="dashCardTitle">Estado de facturas por cobrar</h3>
                <div className="dashStatList">
                  <div className="dashStat">
                    <span>Total por cobrar</span>
                    <strong>CLP {money(data.invoices?.total ?? 0)}</strong>
                  </div>
                  <div className="dashStat">
                    <span>Esperado este mes</span>
                    <strong className="green">CLP {money(data.invoices?.currentMonth ?? 0)}</strong>
                  </div>
                  <div className="dashStat">
                    <span>Vencidas</span>
                    <strong className="red">CLP {money(data.invoices?.overdue ?? 0)}</strong>
                  </div>
                </div>
              </AppCard>

              <AppCard>
                <h3 className="dashCardTitle">Indicadores de caja</h3>
                <div className="dashStatList">
                  <div className="dashStat">
                    <span>Burn rate mensual</span>
                    <strong>CLP {money(burnRate)}</strong>
                  </div>
                  <div className="dashStat">
                    <span>Umbral mínimo</span>
                    <strong className="amber">CLP {money(cf?.minimumThreshold ?? 0)}</strong>
                  </div>
                  <div className="dashStat">
                    <span>Estado</span>
                    <strong className={isSafe ? "green" : "red"}>
                      {isSafe ? "Seguro" : "En riesgo"}
                    </strong>
                  </div>
                </div>
              </AppCard>
            </div>
          </>
        )}
      </div>
    </DesktopShell>
  );
}
