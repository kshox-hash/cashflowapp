"use client";

import { useEffect, useMemo, useState } from "react";
import Pagination from "../components/ui/Pagination";

import DesktopShell from "../components/layout/DesktopShell";
import AppCard from "../components/ui/AppCard";
import MetricBox from "../components/ui/MetricBox";
import Modal from "../components/ui/Modal";
import PageTitle from "../components/ui/PageTitle";
import SmallButton from "../components/ui/SmallButton";

import { useConfirm } from "../contexts/confirm.context";
import { useToast } from "../contexts/toast.context";
import { BackendApi, type PeopleCostInput } from "../services/backend.api";
import { exportCSV } from "../utils/csv";
import { money, statusLabel } from "../utils/format";

import "./people-costs.css";

type PeopleCost = {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  status: string;
};

type Summary = {
  total: number;
  currentMonthTotal: number;
  nextPayment?: { date: string; description: string; amount: number } | null;
};

const CATEGORIES = [
  { value: "sueldo",        label: "Sueldo" },
  { value: "honorario",     label: "Honorario" },
  { value: "imposiciones",  label: "Imposiciones" },
  { value: "bono",          label: "Bono" },
  { value: "finiquito",     label: "Finiquito" },
  { value: "beneficio",     label: "Beneficio" },
  { value: "otro_personal", label: "Otro personal" },
];

const STATUSES = [
  { value: "forecast",  label: "Proyectado" },
  { value: "confirmed", label: "Confirmado" },
  { value: "scheduled", label: "Programado" },
  { value: "overdue",   label: "Vencido" },
  { value: "paid",      label: "Pagado" },
  { value: "cancelled", label: "Cancelado" },
];

function categoryLabel(v: string) {
  return CATEGORIES.find((c) => c.value === v)?.label ?? v;
}

export default function PeopleCostsPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [summary, setSummary] = useState<Summary | null>(null);
  const [costs, setCosts] = useState<PeopleCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTab, setSelectedTab] = useState<0 | 1 | 2>(0);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("sueldo");
  const [status, setStatus] = useState("forecast");

  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const [editing, setEditing] = useState<PeopleCost | null>(null);
  const [editForm, setEditForm] = useState<Omit<PeopleCost, "id">>({
    date: today, description: "", category: "sueldo", amount: 0, status: "forecast",
  });

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const [s, c] = await Promise.all([
        BackendApi.getPeopleCostsSummary(),
        BackendApi.getPeopleCosts(),
      ]);
      setSummary(s);
      setCosts(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando datos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  useEffect(() => { setPage(1); }, [search, sortCol, sortAsc]);

  function handleSort(col: string) {
    if (sortCol === col) setSortAsc((v) => !v);
    else { setSortCol(col); setSortAsc(true); }
  }

  const displayed = useMemo(() => {
    const term = search.toLowerCase();
    const filtered = costs.filter(
      (c) =>
        c.description.toLowerCase().includes(term) ||
        categoryLabel(c.category).toLowerCase().includes(term) ||
        statusLabel(c.status).toLowerCase().includes(term)
    );
    return [...filtered].sort((a, b) => {
      const av = String(a[sortCol as keyof PeopleCost]);
      const bv = String(b[sortCol as keyof PeopleCost]);
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [costs, search, sortCol, sortAsc]);

  const paginated = useMemo(
    () => displayed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [displayed, page]
  );

  async function saveCost() {
    const parsed = Number(amount.replaceAll(".", "").replace(",", "."));
    if (!description.trim()) { toast.error("Debes ingresar una descripción"); return; }
    if (!parsed || parsed <= 0) { toast.error("Monto inválido"); return; }
    try {
      setSaving(true);
      await BackendApi.createPeopleCost({
        date, description: description.trim(), category, amount: parsed, status,
      });
      setDescription(""); setAmount("");
      setSelectedTab(0);
      toast.success("Costo creado correctamente");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCost(cost: PeopleCost) {
    const ok = await confirm({
      title: "Eliminar costo",
      message: `¿Eliminar "${cost.description}"? Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    try {
      await BackendApi.deletePeopleCost(cost.id);
      toast.success("Costo eliminado");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  function startEdit(cost: PeopleCost) {
    setEditForm({
      date: cost.date, description: cost.description,
      category: cost.category, amount: cost.amount, status: cost.status,
    });
    setEditing(cost);
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editForm.description.trim()) { toast.error("Debes ingresar una descripción"); return; }
    if (!editForm.amount || editForm.amount <= 0) { toast.error("Monto inválido"); return; }
    try {
      setSaving(true);
      await BackendApi.updatePeopleCost(editing.id, editForm as PeopleCostInput);
      setEditing(null);
      toast.success("Costo actualizado");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    exportCSV("costos-de-personal",
      ["Fecha", "Tipo", "Descripción", "Monto", "Estado"],
      displayed.map((c) => [c.date, categoryLabel(c.category), c.description, c.amount, statusLabel(c.status)])
    );
  }

  function SortTh({ col, label }: { col: string; label: string }) {
    return (
      <th className="sortable" onClick={() => handleSort(col)}>
        {label}{sortCol === col ? (sortAsc ? " ↑" : " ↓") : ""}
      </th>
    );
  }

  const tableContent = (
    <AppCard noPadding>
      <div className="tableToolbar">
        <input className="searchInput" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="tableToolbarRight">
          <SmallButton label="Exportar CSV" onClick={handleExport} />
        </div>
      </div>
      {displayed.length === 0 ? (
        <div className="emptyBox">
          {search ? "Sin resultados." : "Aún no hay costos registrados."}
        </div>
      ) : (
        <>
          <div className="tableScroll">
            <table className="dataTable">
              <thead>
                <tr>
                  <SortTh col="date"        label="Fecha" />
                  <SortTh col="category"    label="Tipo" />
                  <SortTh col="description" label="Descripción" />
                  <SortTh col="amount"      label="Monto" />
                  <SortTh col="status"      label="Estado" />
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((cost) => (
                  <tr key={cost.id}>
                    <td>{cost.date}</td>
                    <td>{categoryLabel(cost.category)}</td>
                    <td>{cost.description}</td>
                    <td className="negative">-CLP {money(cost.amount)}</td>
                    <td>{statusLabel(cost.status)}</td>
                    <td>
                      <button className="editButton" onClick={() => startEdit(cost)}>Editar</button>
                      <button className="deleteButton" onClick={() => deleteCost(cost)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination total={displayed.length} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
        </>
      )}
    </AppCard>
  );

  return (
    <DesktopShell activeRoute="/people-costs">
      <div className="peopleCostsPage">
        <div className="peopleCostsHeader">
          <div className="tabs">
            {["Resumen", "Costos", "Agregar"].map((tab, i) => (
              <button key={tab} className={selectedTab === i ? "active" : ""} onClick={() => setSelectedTab(i as 0 | 1 | 2)}>
                {tab}
              </button>
            ))}
          </div>
          <PageTitle title="Costos de Personal" subtitle="Sueldos, honorarios, imposiciones y otros costos." />
          <SmallButton label="Agregar costo" primary onClick={() => setSelectedTab(2)} />
        </div>

        {loading && (
          <>
            <div className="metricsGrid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
              {[...Array(3)].map((_, i) => <div key={i} className="skeletonMetric" />)}
            </div>
            <AppCard noPadding>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeletonRow">
                  <div className="skeletonCell narrow" /><div className="skeletonCell narrow" />
                  <div className="skeletonCell wide" /><div className="skeletonCell" />
                  <div className="skeletonCell narrow" />
                </div>
              ))}
            </AppCard>
          </>
        )}

        {error && <AppCard><div className="errorBox">{error}</div></AppCard>}

        {!loading && summary && (
          <>
            {selectedTab === 0 && (
              <>
                <div className="metricsGrid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
                  <MetricBox title="Total costos" value={`CLP ${money(summary.total)}`} subtitle="Todos los costos registrados" />
                  <MetricBox title="Costos del mes" value={`CLP ${money(summary.currentMonthTotal)}`} subtitle="Periodo actual" accent="amber" />
                  <MetricBox
                    title="Próximo pago"
                    value={summary.nextPayment ? `CLP ${money(summary.nextPayment.amount)}` : "Sin datos"}
                    subtitle={summary.nextPayment ? `${summary.nextPayment.date} · ${summary.nextPayment.description}` : "No hay pagos próximos"}
                    accent="blue"
                  />
                </div>
                <div className="spacing" />
                {tableContent}
              </>
            )}
            {selectedTab === 1 && tableContent}
            {selectedTab === 2 && (
              <AppCard>
                <div className="formCard">
                  <h2>Agregar costo de personal</h2>
                  <p>Todo costo de personal afecta automáticamente el flujo de caja.</p>
                  <div className="formGrid">
                    <label>Tipo de costo
                      <select value={category} onChange={(e) => setCategory(e.target.value)}>
                        {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </label>
                    <label>Estado
                      <select value={status} onChange={(e) => setStatus(e.target.value)}>
                        {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </label>
                    <label>Fecha de pago<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
                    <label>Monto<input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="12000000" /></label>
                  </div>
                  <label className="full">Descripción
                    <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: Pago sueldos mayo" />
                  </label>
                  <div className="formActions">
                    <SmallButton label={saving ? "Guardando..." : "Guardar costo"} primary onClick={saveCost} />
                  </div>
                </div>
              </AppCard>
            )}
          </>
        )}
      </div>

      {editing && (
        <Modal title="Editar costo de personal" onClose={() => setEditing(null)}>
          <div className="modalFormGrid">
            <label>Tipo de costo
              <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <label>Estado
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <label>Fecha de pago
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
