"use client";

import { useEffect, useMemo, useState } from "react";
import Pagination from "../components/ui/Pagination";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import DesktopShell from "../components/layout/DesktopShell";
import AppCard from "../components/ui/AppCard";
import MetricBox from "../components/ui/MetricBox";
import Modal from "../components/ui/Modal";
import PageTitle from "../components/ui/PageTitle";
import SmallButton from "../components/ui/SmallButton";
import StatusPill from "../components/ui/StatusPill";

import { useConfirm } from "../contexts/confirm.context";
import { useToast } from "../contexts/toast.context";
import { BackendApi, type CashFlowMovementInput } from "../services/backend.api";
import { exportCSV } from "../utils/csv";
import { directionLabel, money, statusLabel } from "../utils/format";

import Tabs from "../cash-flow/component/tabs.component";
import Chip from "../cash-flow/component/chip.component";

import "./cashflow.css";
import "./types/cashflow.types";

const CATEGORIES = [
  { value: "venta",      label: "Venta" },
  { value: "cliente",    label: "Cliente" },
  { value: "proveedor",  label: "Proveedor" },
  { value: "sueldo",     label: "Sueldo" },
  { value: "impuesto",   label: "Impuesto" },
  { value: "arriendo",   label: "Arriendo" },
  { value: "servicio",   label: "Servicio" },
  { value: "other",      label: "Otro" },
];

export default function CashFlowPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [data, setData] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [selectedTab, setSelectedTab] = useState<0 | 1 | 2>(0);

  const [startMonth, setStartMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Add form
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => formatDate(new Date()));
  const [direction, setDirection] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("other");
  const [status, setStatus] = useState("forecast");

  // Movement filters
  const [selectedMovementMonth, setSelectedMovementMonth] = useState("all");
  const [filterDirection, setFilterDirection] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("date");
  const [sortAsc, setSortAsc] = useState(false);

  // Edit modal
  const [editing, setEditing] = useState<Movement | null>(null);
  const [editForm, setEditForm] = useState<Omit<Movement, "id">>({
    date: formatDate(new Date()), description: "", direction: "expense",
    category: "other", amount: 0, status: "forecast", sourceType: "manual",
  });

  const monthsToShow = 12;

  async function loadData(targetMonth = startMonth) {
    try {
      setLoading(true);
      setError("");
      const response = await BackendApi.getCashFlowSummary(
        formatMonthStart(targetMonth),
        monthsToShow
      );
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando flujo de caja");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(startMonth); }, []);

  const movementMonths = useMemo(() => {
    const months = Array.from(
      new Set((data?.movements ?? []).map((m) => monthKeyFromDate(m.date)).filter((k) => k.length === 7))
    );
    return months.sort((a, b) => b.localeCompare(a));
  }, [data]);

  const filteredMovements = useMemo(() => {
    const term = search.toLowerCase();
    const base = (data?.movements ?? []).filter((m) => {
      const matchMonth = selectedMovementMonth === "all" || monthKeyFromDate(m.date) === selectedMovementMonth;
      const matchDir = filterDirection === "all" || m.direction === filterDirection;
      const matchStatus = filterStatus === "all" || m.status === filterStatus;
      const matchSearch = !term || m.description.toLowerCase().includes(term) || m.category.toLowerCase().includes(term);
      return matchMonth && matchDir && matchStatus && matchSearch;
    });
    return [...base].sort((a, b) => {
      const av = String(a[sortCol as keyof Movement]);
      const bv = String(b[sortCol as keyof Movement]);
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [data, selectedMovementMonth, filterDirection, filterStatus, search, sortCol, sortAsc]);

  function handleSort(col: string) {
    if (sortCol === col) setSortAsc((v) => !v);
    else { setSortCol(col); setSortAsc(true); }
  }

  function goPreviousPeriod() {
    const next = new Date(startMonth.getFullYear(), startMonth.getMonth() - 1, 1);
    setStartMonth(next); loadData(next);
  }

  function goNextPeriod() {
    const next = new Date(startMonth.getFullYear(), startMonth.getMonth() + 1, 1);
    setStartMonth(next); loadData(next);
  }

  function goToday() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartMonth(next); loadData(next);
  }

  async function saveMovement() {
    const parsedAmount = Number(amount.replaceAll(".", "").replace(",", "."));
    if (!description.trim()) { toast.error("Debes ingresar una descripción"); return; }
    if (!date.trim()) { toast.error("Debes ingresar una fecha"); return; }
    if (!parsedAmount || parsedAmount <= 0) { toast.error("Debes ingresar un monto válido"); return; }
    try {
      setSaving(true);
      await BackendApi.createCashFlowMovement({ date, description: description.trim(), direction, category, amount: parsedAmount, status });
      setDescription(""); setAmount("");
      setSelectedTab(0);
      setSelectedMovementMonth("all"); setFilterDirection("all"); setFilterStatus("all");
      toast.success("Movimiento guardado. Flujo recalculado.");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar movimiento");
    } finally {
      setSaving(false);
    }
  }

  async function deleteMovement(movement: Movement) {
    const ok = await confirm({
      title: "Eliminar movimiento",
      message: `¿Eliminar "${movement.description}"? El flujo se recalcula automáticamente.`,
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    try {
      await BackendApi.deleteCashFlowMovement(movement.id);
      toast.success("Movimiento eliminado");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  function startEdit(movement: Movement) {
    setEditForm({
      date: movement.date, description: movement.description,
      direction: movement.direction, category: movement.category,
      amount: movement.amount, status: movement.status, sourceType: movement.sourceType,
    });
    setEditing(movement);
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editForm.description.trim()) { toast.error("Debes ingresar una descripción"); return; }
    if (!editForm.amount || editForm.amount <= 0) { toast.error("Monto inválido"); return; }
    try {
      setSaving(true);
      await BackendApi.updateCashFlowMovement(editing.id, editForm as CashFlowMovementInput);
      setEditing(null);
      toast.success("Movimiento actualizado");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    exportCSV("movimientos-flujo-caja",
      ["Fecha", "Descripción", "Tipo", "Categoría", "Monto", "Estado"],
      filteredMovements.map((m) => [m.date, m.description, directionLabel(m.direction), m.category, m.amount, statusLabel(m.status)])
    );
  }

  const rangeStart = data?.range?.startDate ?? formatMonthStart(startMonth);
  const lastEndingBalance = data?.monthlySummary?.length
    ? data.monthlySummary[data.monthlySummary.length - 1].endingBalance
    : data?.currentBalance ?? 0;
  const isSafe = data !== null ? data.lowestBalance >= data.minimumThreshold : true;

  return (
    <DesktopShell activeRoute="/cash-flow">
      <div className="cashflowPage">
        <section className="cashflowHero">
          <div>
            <PageTitle title="Flujo de Caja" subtitle="Proyección financiera, movimientos y control de caja." />
          </div>
          <div className="heroRight">
            <div className="rangeCard">
              <span>Rango activo</span>
              <strong>{rangeStart} · {monthsToShow} meses</strong>
            </div>
            <SmallButton label="+ Agregar movimiento" primary onClick={() => setSelectedTab(2)} />
          </div>
        </section>

        <section className="cashflowToolbar">
          <Tabs selectedTab={selectedTab} onChange={setSelectedTab} />
          <div className="periodControls">
            <button onClick={goPreviousPeriod}>← Anterior</button>
            <button onClick={goToday}>Hoy</button>
            <button onClick={goNextPeriod}>Siguiente →</button>
          </div>
        </section>

        {loading && (
          <>
            <div className="metricsGrid">
              {[...Array(3)].map((_, i) => <div key={i} className="skeletonMetric" />)}
            </div>
            <AppCard noPadding>
              <div style={{ height: 430, background: "linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)", backgroundSize: "800px 100%", animation: "shimmer 1.4s infinite", borderRadius: 12 }} />
            </AppCard>
          </>
        )}

        {error && <AppCard><div className="errorBox">{error}</div></AppCard>}

        {!loading && data && selectedTab === 0 && (
          <>
            <div className="metricsGrid">
              <MetricBox title="Saldo inicial proyectado" value={`CLP ${money(data.currentBalance)}`} subtitle="Base de cálculo del flujo" accent="blue" />
              <MetricBox title="Umbral mínimo" value={`CLP ${money(data.minimumThreshold)}`} subtitle="Línea roja de seguridad" accent="red" />
              <MetricBox title="Saldo final proyectado" value={`CLP ${money(lastEndingBalance)}`} subtitle="Al final del rango visible" accent="green" />
            </div>

            <AppCard noPadding>
              <div className="chartHeaderFull">
                <div className="chartTitleGroup">
                  <span className={isSafe ? "safeDot" : "riskDot"} />
                  <div>
                    <h3>Pronóstico de flujo de caja</h3>
                    <p>Saldo proyectado contra umbral mínimo.</p>
                  </div>
                  <StatusPill label={isSafe ? "Alta confianza" : "Riesgo de caja"} color={isSafe ? "green" : "red"} />
                </div>
                <div className="chartLegend">
                  <span className="legendLine blueLine" /> Saldo proyectado
                  <span className="legendLine redLine dashed" /> Umbral mínimo
                </div>
              </div>
              <div className="chartContainer">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.chart}>
                    <defs>
                      <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#e7ecf3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(Number(v) / 1_000_000).toFixed(0)}M`} />
                    <Tooltip formatter={(v) => `CLP ${money(Number(v))}`} />
                    <Area type="monotone" dataKey="balance" stroke="#2563eb" strokeWidth={3} fill="url(#balanceFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </AppCard>

            <MonthlyTable rows={data.monthlySummary} minimumThreshold={data.minimumThreshold} />
          </>
        )}

        {!loading && data && selectedTab === 1 && (
          <MovementsTab
            movements={filteredMovements}
            allMovementsCount={data.movements.length}
            selectedMonth={selectedMovementMonth}
            availableMonths={movementMonths}
            filterDirection={filterDirection}
            filterStatus={filterStatus}
            search={search}
            sortCol={sortCol}
            sortAsc={sortAsc}
            onMonthChange={setSelectedMovementMonth}
            onDirectionChange={setFilterDirection}
            onStatusChange={setFilterStatus}
            onSearchChange={setSearch}
            onSort={handleSort}
            onDelete={deleteMovement}
            onEdit={startEdit}
            onExport={handleExport}
          />
        )}

        {!loading && selectedTab === 2 && (
          <AppCard>
            <div className="addMovementCard">
              <h2>Agregar movimiento manual</h2>
              <p>Ingresa un ingreso o egreso. El sistema recalcula el flujo de caja automáticamente.</p>
              <div className="formGrid">
                <label>Tipo
                  <select value={direction} onChange={(e) => setDirection(e.target.value as "income" | "expense")}>
                    <option value="income">Ingreso</option>
                    <option value="expense">Egreso</option>
                  </select>
                </label>
                <label>Categoría
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </label>
                <label>Fecha<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
                <label>Monto<input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ej: 1000000" /></label>
              </div>
              <label className="fullField">Descripción
                <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: Pago proveedor mayo" />
              </label>
              <label className="fullField">Estado
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="forecast">Proyectado</option>
                  <option value="confirmed">Confirmado</option>
                  <option value="scheduled">Programado</option>
                  <option value="overdue">Vencido</option>
                  <option value="paid">Pagado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </label>
              <div className="formActions">
                <SmallButton label={saving ? "Guardando..." : "Guardar y recalcular"} primary onClick={saveMovement} />
              </div>
            </div>
          </AppCard>
        )}
      </div>

      {editing && (
        <Modal title="Editar movimiento" onClose={() => setEditing(null)}>
          <div className="modalFormGrid">
            <label>Tipo
              <select value={editForm.direction} onChange={(e) => setEditForm({ ...editForm, direction: e.target.value as "income" | "expense" })}>
                <option value="income">Ingreso</option>
                <option value="expense">Egreso</option>
              </select>
            </label>
            <label>Categoría
              <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <label>Estado
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                <option value="forecast">Proyectado</option>
                <option value="confirmed">Confirmado</option>
                <option value="scheduled">Programado</option>
                <option value="overdue">Vencido</option>
                <option value="paid">Pagado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </label>
            <label>Fecha
              <input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
            </label>
            <label>Monto
              <input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })} />
            </label>
            <label className="modalFormFull">Descripción
              <input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </label>
          </div>
          <div className="modalFormActions">
            <SmallButton label="Cancelar" onClick={() => setEditing(null)} />
            <SmallButton label={saving ? "Guardando..." : "Guardar cambios"} primary onClick={saveEdit} />
          </div>
        </Modal>
      )}
    </DesktopShell>
  );
}

function MonthlyTable({ rows, minimumThreshold }: { rows: MonthlySummary[]; minimumThreshold: number }) {
  return (
    <AppCard noPadding>
      <div className="tableHeader"><h3>Resumen mensual</h3></div>
      <table className="cashflowTable">
        <thead>
          <tr>
            <th>Mes</th><th>Saldo inicial</th><th>Ingresos</th>
            <th>Costos</th><th>Flujo neto</th><th>Saldo final</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isRisk = row.endingBalance < minimumThreshold;
            return (
              <tr key={row.month} className={isRisk ? "riskRow" : ""}>
                <td>{isRisk ? "⚠ " : ""}{row.month}</td>
                <td>{money(row.startingBalance)}</td>
                <td>{money(row.income)}</td>
                <td>{money(row.costs)}</td>
                <td className={row.netMovement < 0 ? "negative" : ""}>{money(row.netMovement)}</td>
                <td>{money(row.endingBalance)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </AppCard>
  );
}

const MOVEMENTS_PAGE_SIZE = 20;

function MovementsTab({
  movements, allMovementsCount, selectedMonth, availableMonths,
  filterDirection, filterStatus, search, sortCol, sortAsc,
  onMonthChange, onDirectionChange, onStatusChange, onSearchChange,
  onSort, onDelete, onEdit, onExport,
}: {
  movements: Movement[];
  allMovementsCount: number;
  selectedMonth: string;
  availableMonths: string[];
  filterDirection: string;
  filterStatus: string;
  search: string;
  sortCol: string;
  sortAsc: boolean;
  onMonthChange: (v: string) => void;
  onDirectionChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onSearchChange: (v: string) => void;
  onSort: (col: string) => void;
  onDelete: (m: Movement) => void;
  onEdit: (m: Movement) => void;
  onExport: () => void;
}) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [movements.length, search, sortCol, sortAsc, filterDirection, filterStatus, selectedMonth]);

  const paginated = useMemo(
    () => movements.slice((page - 1) * MOVEMENTS_PAGE_SIZE, page * MOVEMENTS_PAGE_SIZE),
    [movements, page]
  );

  const totals = movements.reduce(
    (acc, m) => {
      if (m.direction === "income") acc.income += m.amount;
      else acc.expense += m.amount;
      acc.net = acc.income - acc.expense;
      return acc;
    },
    { income: 0, expense: 0, net: 0 }
  );

  function SortTh({ col, label }: { col: string; label: string }) {
    return (
      <th className="sortable" onClick={() => onSort(col)}>
        {label}{sortCol === col ? (sortAsc ? " ↑" : " ↓") : ""}
      </th>
    );
  }

  return (
    <AppCard noPadding>
      <div className="movementsHeader">
        <div>
          <h3>Movimientos de caja</h3>
          <span>{movements.length} de {allMovementsCount} movimientos</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select value={selectedMonth} onChange={(e) => onMonthChange(e.target.value)}>
            <option value="all">Todos los meses</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
          <SmallButton label="Exportar CSV" onClick={onExport} />
        </div>
      </div>

      <div className="tableToolbar" style={{ borderBottom: "1px solid #e7ecf3" }}>
        <input
          className="searchInput"
          placeholder="Buscar movimientos..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="quickFilters">
        <span>Tipo:</span>
        <Chip label="Todos" active={filterDirection === "all"} onClick={() => onDirectionChange("all")} />
        <Chip label="Ingresos" active={filterDirection === "income"} onClick={() => onDirectionChange("income")} />
        <Chip label="Egresos" active={filterDirection === "expense"} onClick={() => onDirectionChange("expense")} />
        <span className="filterDivider">Estado:</span>
        <Chip label="Todos" active={filterStatus === "all"} onClick={() => onStatusChange("all")} />
        <Chip label="Proyectado" active={filterStatus === "forecast"} onClick={() => onStatusChange("forecast")} />
        <Chip label="Confirmado" active={filterStatus === "confirmed"} onClick={() => onStatusChange("confirmed")} />
        <Chip label="Vencido" active={filterStatus === "overdue"} onClick={() => onStatusChange("overdue")} />
        <Chip label="Pagado" active={filterStatus === "paid"} onClick={() => onStatusChange("paid")} />
      </div>

      {movements.length === 0 ? (
        <div className="emptyBox">No hay movimientos para el filtro seleccionado.</div>
      ) : (
        <>
          <div className="tableScroll">
            <table className="cashflowTable">
              <thead>
                <tr>
                  <SortTh col="date"        label="Fecha" />
                  <SortTh col="description" label="Descripción" />
                  <SortTh col="direction"   label="Tipo" />
                  <SortTh col="category"    label="Categoría" />
                  <SortTh col="amount"      label="Monto" />
                  <SortTh col="status"      label="Estado" />
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((m) => (
                  <tr key={m.id}>
                    <td>{m.date}</td>
                    <td>{m.description}</td>
                    <td>{directionLabel(m.direction)}</td>
                    <td>{m.category}</td>
                    <td className={m.direction === "expense" ? "negative" : ""}>
                      {m.direction === "expense" ? "-" : ""}CLP {money(m.amount)}
                    </td>
                    <td className={m.status === "overdue" ? "negative" : ""}>{statusLabel(m.status)}</td>
                    <td style={{ display: "flex", gap: 6 }}>
                      {m.sourceType === "manual" && (
                        <button className="editButton" onClick={() => onEdit(m)}>Editar</button>
                      )}
                      <button className="deleteButton" onClick={() => onDelete(m)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={movements.length} page={page} pageSize={MOVEMENTS_PAGE_SIZE} onChange={setPage} />
          <div className="totalsBar">
            <span>Totales del filtro:</span>
            <b className="positive">Ingresos: CLP {money(totals.income)}</b>
            <b className="negative">Egresos: -CLP {money(totals.expense)}</b>
            <b className={totals.net >= 0 ? "positive" : "negative"}>
              Neto: CLP {totals.net >= 0 ? money(totals.net) : `-${money(Math.abs(totals.net))}`}
            </b>
          </div>
        </>
      )}
    </AppCard>
  );
}

function formatDate(date: Date) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function formatMonthStart(date: Date) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${m}-01`;
}

function monthKeyFromDate(date: string) {
  return date.length >= 7 ? date.substring(0, 7) : date;
}

function monthLabel(monthKey: string) {
  const [year, monthRaw] = monthKey.split("-");
  const month = Number(monthRaw);
  const labels = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  return `${labels[month] ?? monthKey} ${year}`;
}
