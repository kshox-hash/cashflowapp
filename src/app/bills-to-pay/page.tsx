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
import { BackendApi, type BillInput } from "../services/backend.api";
import { exportCSV } from "../utils/csv";
import { money, statusLabel } from "../utils/format";

import "./bills-to-pay.css";

type Bill = {
  id: string;
  dueDate: string;
  supplier: string;
  description: string;
  category: string;
  amount: number;
  status: string;
};

type Summary = {
  total: number;
  dueThisWeek: number;
  overdue: number;
};

const CATEGORIES = [
  { value: "proveedor", label: "Proveedor" },
  { value: "arriendo",  label: "Arriendo" },
  { value: "servicio",  label: "Servicio" },
  { value: "impuesto",  label: "Impuesto" },
  { value: "logistica", label: "Logística" },
  { value: "otro",      label: "Otro" },
];

const STATUSES = [
  { value: "pending",   label: "Pendiente" },
  { value: "approved",  label: "Aprobada" },
  { value: "scheduled", label: "Programada" },
  { value: "overdue",   label: "Vencida" },
  { value: "paid",      label: "Pagada" },
  { value: "cancelled", label: "Cancelada" },
];

function categoryLabel(v: string) {
  return CATEGORIES.find((c) => c.value === v)?.label ?? v;
}

const BLANK_FORM: Omit<Bill, "id"> = {
  dueDate: new Date().toISOString().slice(0, 10),
  supplier: "",
  description: "",
  category: "proveedor",
  amount: 0,
  status: "pending",
};

export default function BillsToPayPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [summary, setSummary] = useState<Summary | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTab, setSelectedTab] = useState<0 | 1 | 2>(0);
  const [saving, setSaving] = useState(false);

  // Add form
  const today = new Date().toISOString().slice(0, 10);
  const [dueDate, setDueDate] = useState(today);
  const [supplier, setSupplier] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("proveedor");
  const [status, setStatus] = useState("pending");

  // Table controls
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("dueDate");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // Edit
  const [editing, setEditing] = useState<Bill | null>(null);
  const [editForm, setEditForm] = useState<Omit<Bill, "id">>(BLANK_FORM);

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const [s, b] = await Promise.all([
        BackendApi.getBillsToPaySummary(),
        BackendApi.getBillsToPay(),
      ]);
      setSummary(s);
      setBills(b);
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
    const filtered = bills.filter(
      (b) =>
        b.description.toLowerCase().includes(term) ||
        b.supplier.toLowerCase().includes(term) ||
        categoryLabel(b.category).toLowerCase().includes(term) ||
        statusLabel(b.status).toLowerCase().includes(term)
    );
    return [...filtered].sort((a, b) => {
      const av = String(a[sortCol as keyof Bill]);
      const bv = String(b[sortCol as keyof Bill]);
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [bills, search, sortCol, sortAsc]);

  const paginated = useMemo(
    () => displayed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [displayed, page]
  );

  async function saveBill() {
    const parsed = Number(amount.replaceAll(".", "").replace(",", "."));
    if (!supplier.trim()) { toast.error("Debes ingresar un proveedor"); return; }
    if (!description.trim()) { toast.error("Debes ingresar una descripción"); return; }
    if (!parsed || parsed <= 0) { toast.error("Debes ingresar un monto válido"); return; }
    try {
      setSaving(true);
      await BackendApi.createBillToPay({
        dueDate, supplier: supplier.trim(),
        description: description.trim(), category, amount: parsed, status,
      });
      setSupplier(""); setDescription(""); setAmount("");
      setSelectedTab(0);
      toast.success("Cuenta creada correctamente");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function deleteBill(bill: Bill) {
    const ok = await confirm({
      title: "Eliminar cuenta",
      message: `¿Eliminar "${bill.description}"? Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    try {
      await BackendApi.deleteBillToPay(bill.id);
      toast.success("Cuenta eliminada");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  function startEdit(bill: Bill) {
    setEditForm({
      dueDate: bill.dueDate, supplier: bill.supplier,
      description: bill.description, category: bill.category,
      amount: bill.amount, status: bill.status,
    });
    setEditing(bill);
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editForm.supplier.trim()) { toast.error("Debes ingresar un proveedor"); return; }
    if (!editForm.description.trim()) { toast.error("Debes ingresar una descripción"); return; }
    if (!editForm.amount || editForm.amount <= 0) { toast.error("Monto inválido"); return; }
    try {
      setSaving(true);
      await BackendApi.updateBillToPay(editing.id, editForm as BillInput);
      setEditing(null);
      toast.success("Cuenta actualizada");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    exportCSV("cuentas-por-pagar",
      ["Fecha venc.", "Proveedor", "Tipo", "Descripción", "Monto", "Estado"],
      displayed.map((b) => [b.dueDate, b.supplier, categoryLabel(b.category), b.description, b.amount, statusLabel(b.status)])
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
        <input
          className="searchInput"
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="tableToolbarRight">
          <SmallButton label="Exportar CSV" onClick={handleExport} />
        </div>
      </div>

      {displayed.length === 0 ? (
        <div className="emptyBox">
          {search ? "Sin resultados para la búsqueda." : "Aún no hay cuentas por pagar."}
        </div>
      ) : (
        <>
          <div className="tableScroll">
            <table className="dataTable">
              <thead>
                <tr>
                  <SortTh col="dueDate"     label="Fecha" />
                  <SortTh col="supplier"    label="Proveedor" />
                  <SortTh col="category"    label="Tipo" />
                  <SortTh col="description" label="Descripción" />
                  <SortTh col="amount"      label="Monto" />
                  <SortTh col="status"      label="Estado" />
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((bill) => (
                  <tr key={bill.id}>
                    <td>{bill.dueDate}</td>
                    <td>{bill.supplier}</td>
                    <td>{categoryLabel(bill.category)}</td>
                    <td>{bill.description}</td>
                    <td>CLP {money(bill.amount)}</td>
                    <td className={bill.status === "overdue" ? "negative" : ""}>
                      {statusLabel(bill.status)}
                    </td>
                    <td>
                      <button className="editButton" onClick={() => startEdit(bill)}>Editar</button>
                      <button className="deleteButton" onClick={() => deleteBill(bill)}>Eliminar</button>
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
    <DesktopShell activeRoute="/bills-to-pay">
      <div className="billsPage">
        <div className="billsHeader">
          <div className="tabs">
            {["Resumen", "Cuentas", "Agregar"].map((tab, i) => (
              <button key={tab} className={selectedTab === i ? "active" : ""} onClick={() => setSelectedTab(i as 0 | 1 | 2)}>
                {tab}
              </button>
            ))}
          </div>
          <PageTitle title="Cuentas por Pagar" subtitle="Controla pagos próximos, vencidos y programados." />
          <SmallButton label="Crear cuenta" primary onClick={() => setSelectedTab(2)} />
        </div>

        {loading && (
          <>
            <div className="metricsGrid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
              {[...Array(3)].map((_, i) => <div key={i} className="skeletonMetric" />)}
            </div>
            <AppCard noPadding>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeletonRow">
                  <div className="skeletonCell narrow" />
                  <div className="skeletonCell" />
                  <div className="skeletonCell narrow" />
                  <div className="skeletonCell wide" />
                  <div className="skeletonCell" />
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
                  <MetricBox title="Total por pagar" value={`CLP ${money(summary.total)}`} subtitle="Documentos abiertos" />
                  <MetricBox title="Vence esta semana" value={`CLP ${money(summary.dueThisWeek)}`} subtitle="Pagos programados" accent="amber" />
                  <MetricBox title="Vencidas" value={`CLP ${money(summary.overdue)}`} subtitle="Pendiente de aprobación" accent="red" />
                </div>
                <div className="spacing" />
                {tableContent}
              </>
            )}

            {selectedTab === 1 && tableContent}

            {selectedTab === 2 && (
              <AppCard>
                <div className="formCard">
                  <h2>Agregar cuenta por pagar</h2>
                  <p>Registra compromisos de pago a proveedores.</p>
                  <div className="formGrid">
                    <label>Proveedor<input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Ej: Proveedor Uno" /></label>
                    <label>Tipo
                      <select value={category} onChange={(e) => setCategory(e.target.value)}>
                        {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </label>
                    <label>Estado
                      <select value={status} onChange={(e) => setStatus(e.target.value)}>
                        {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </label>
                    <label>Fecha de vencimiento<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
                    <label>Monto<input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2400000" /></label>
                    <label>Descripción<input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: Factura proveedor mayo" /></label>
                  </div>
                  <div className="formActions">
                    <SmallButton label={saving ? "Guardando..." : "Guardar cuenta"} primary onClick={saveBill} />
                  </div>
                </div>
              </AppCard>
            )}
          </>
        )}
      </div>

      {editing && (
        <Modal title="Editar cuenta por pagar" onClose={() => setEditing(null)}>
          <div className="modalFormGrid">
            <label>Proveedor
              <input value={editForm.supplier} onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })} />
            </label>
            <label>Tipo
              <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <label>Estado
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <label>Fecha de vencimiento
              <input type="date" value={editForm.dueDate} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} />
            </label>
            <label>Monto
              <input
                type="number"
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })}
              />
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
