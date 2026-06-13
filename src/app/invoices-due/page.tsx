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
import { BackendApi, type InvoiceInput } from "../services/backend.api";
import { exportCSV } from "../utils/csv";
import { money, statusLabel } from "../utils/format";

import "./invoices-due.css";

type Invoice = {
  id: string;
  dueDate: string;
  customer: string;
  description: string;
  category: string;
  amount: number;
  status: string;
};

type Summary = {
  total: number;
  overdue: number;
  currentMonth: number;
};

const CATEGORIES = [
  { value: "venta",      label: "Venta" },
  { value: "servicio",   label: "Servicio" },
  { value: "proyecto",   label: "Proyecto" },
  { value: "mantencion", label: "Mantención" },
];

const STATUSES = [
  { value: "forecast",  label: "Proyectada" },
  { value: "confirmed", label: "Confirmada" },
  { value: "overdue",   label: "Vencida" },
  { value: "paid",      label: "Pagada" },
];

function categoryLabel(v: string) {
  return CATEGORIES.find((c) => c.value === v)?.label ?? v;
}

export default function InvoicesDuePage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [summary, setSummary] = useState<Summary | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTab, setSelectedTab] = useState<0 | 1 | 2>(0);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const [dueDate, setDueDate] = useState(today);
  const [customer, setCustomer] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("venta");
  const [status, setStatus] = useState("forecast");

  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("dueDate");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const [editing, setEditing] = useState<Invoice | null>(null);
  const [editForm, setEditForm] = useState<Omit<Invoice, "id">>({
    dueDate: today, customer: "", description: "", category: "venta", amount: 0, status: "forecast",
  });

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const [s, inv] = await Promise.all([
        BackendApi.getInvoicesDueSummary(),
        BackendApi.getInvoicesDue(),
      ]);
      setSummary(s);
      setInvoices(inv);
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
    const filtered = invoices.filter(
      (inv) =>
        inv.description.toLowerCase().includes(term) ||
        inv.customer.toLowerCase().includes(term) ||
        categoryLabel(inv.category).toLowerCase().includes(term) ||
        statusLabel(inv.status).toLowerCase().includes(term)
    );
    return [...filtered].sort((a, b) => {
      const av = String(a[sortCol as keyof Invoice]);
      const bv = String(b[sortCol as keyof Invoice]);
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [invoices, search, sortCol, sortAsc]);

  const paginated = useMemo(
    () => displayed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [displayed, page]
  );

  async function saveInvoice() {
    const parsed = Number(amount.replaceAll(".", "").replace(",", "."));
    if (!customer.trim()) { toast.error("Debes ingresar un cliente"); return; }
    if (!description.trim()) { toast.error("Debes ingresar una descripción"); return; }
    if (!parsed || parsed <= 0) { toast.error("Monto inválido"); return; }
    try {
      setSaving(true);
      await BackendApi.createInvoiceDue({
        dueDate, customer: customer.trim(),
        description: description.trim(), category, amount: parsed, status,
      });
      setCustomer(""); setDescription(""); setAmount("");
      setSelectedTab(0);
      toast.success("Factura creada correctamente");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function deleteInvoice(inv: Invoice) {
    const ok = await confirm({
      title: "Eliminar factura",
      message: `¿Eliminar "${inv.description}"? Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    try {
      await BackendApi.deleteInvoiceDue(inv.id);
      toast.success("Factura eliminada");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  function startEdit(inv: Invoice) {
    setEditForm({
      dueDate: inv.dueDate, customer: inv.customer,
      description: inv.description, category: inv.category,
      amount: inv.amount, status: inv.status,
    });
    setEditing(inv);
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editForm.customer.trim()) { toast.error("Debes ingresar un cliente"); return; }
    if (!editForm.description.trim()) { toast.error("Debes ingresar una descripción"); return; }
    if (!editForm.amount || editForm.amount <= 0) { toast.error("Monto inválido"); return; }
    try {
      setSaving(true);
      await BackendApi.updateInvoiceDue(editing.id, editForm as InvoiceInput);
      setEditing(null);
      toast.success("Factura actualizada");
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    exportCSV("facturas-por-cobrar",
      ["Fecha venc.", "Cliente", "Tipo", "Descripción", "Monto", "Estado"],
      displayed.map((inv) => [inv.dueDate, inv.customer, categoryLabel(inv.category), inv.description, inv.amount, statusLabel(inv.status)])
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
          {search ? "Sin resultados para la búsqueda." : "Aún no hay facturas registradas."}
        </div>
      ) : (
        <>
          <div className="tableScroll">
            <table className="dataTable">
              <thead>
                <tr>
                  <SortTh col="dueDate"     label="Fecha" />
                  <SortTh col="customer"    label="Cliente" />
                  <SortTh col="category"    label="Tipo" />
                  <SortTh col="description" label="Descripción" />
                  <SortTh col="amount"      label="Monto" />
                  <SortTh col="status"      label="Estado" />
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.dueDate}</td>
                    <td>{inv.customer}</td>
                    <td>{categoryLabel(inv.category)}</td>
                    <td>{inv.description}</td>
                    <td className="positive">CLP {money(inv.amount)}</td>
                    <td className={inv.status === "overdue" ? "negative" : ""}>
                      {statusLabel(inv.status)}
                    </td>
                    <td>
                      <button className="editButton" onClick={() => startEdit(inv)}>Editar</button>
                      <button className="deleteButton" onClick={() => deleteInvoice(inv)}>Eliminar</button>
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
    <DesktopShell activeRoute="/invoices-due">
      <div className="invoicesPage">
        <div className="invoicesHeader">
          <div className="tabs">
            {["Resumen", "Facturas", "Agregar"].map((tab, i) => (
              <button key={tab} className={selectedTab === i ? "active" : ""} onClick={() => setSelectedTab(i as 0 | 1 | 2)}>
                {tab}
              </button>
            ))}
          </div>
          <PageTitle title="Facturas por Cobrar" subtitle="Ingresos esperados desde facturas pendientes." />
          <SmallButton label="Crear factura" primary onClick={() => setSelectedTab(2)} />
        </div>

        {loading && (
          <>
            <div className="metricsGrid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
              {[...Array(3)].map((_, i) => <div key={i} className="skeletonMetric" />)}
            </div>
            <AppCard noPadding>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeletonRow">
                  <div className="skeletonCell narrow" /><div className="skeletonCell" />
                  <div className="skeletonCell narrow" /><div className="skeletonCell wide" />
                  <div className="skeletonCell" /><div className="skeletonCell narrow" />
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
                  <MetricBox title="Total por cobrar" value={`CLP ${money(summary.total)}`} subtitle="Facturas abiertas" accent="blue" />
                  <MetricBox title="Vencidas" value={`CLP ${money(summary.overdue)}`} subtitle="Requiere gestión" accent="red" />
                  <MetricBox title="Esperado este mes" value={`CLP ${money(summary.currentMonth)}`} subtitle="Ingreso proyectado" accent="green" />
                </div>
                <div className="spacing" />
                {tableContent}
              </>
            )}
            {selectedTab === 1 && tableContent}
            {selectedTab === 2 && (
              <AppCard>
                <div className="formCard">
                  <h2>Agregar factura por cobrar</h2>
                  <p>Registra facturas emitidas o ingresos esperados.</p>
                  <div className="formGrid">
                    <label>Cliente<input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Ej: Cliente Demo SPA" /></label>
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
                    <label>Monto<input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="8400000" /></label>
                    <label>Descripción<input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: Factura cliente mayo" /></label>
                  </div>
                  <div className="formActions">
                    <SmallButton label={saving ? "Guardando..." : "Guardar factura"} primary onClick={saveInvoice} />
                  </div>
                </div>
              </AppCard>
            )}
          </>
        )}
      </div>

      {editing && (
        <Modal title="Editar factura por cobrar" onClose={() => setEditing(null)}>
          <div className="modalFormGrid">
            <label>Cliente
              <input value={editForm.customer} onChange={(e) => setEditForm({ ...editForm, customer: e.target.value })} />
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
