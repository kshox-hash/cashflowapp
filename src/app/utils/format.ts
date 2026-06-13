export function money(value: number): string {
  return Math.round(value).toLocaleString("es-CL");
}

export function formatDate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

export function monthKeyFromDate(dateStr: string): string {
  return dateStr.length >= 7 ? dateStr.substring(0, 7) : dateStr;
}

const MONTH_NAMES_SHORT = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTH_NAMES_FULL  = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export function monthLabel(monthKey: string): string {
  const [year, raw] = monthKey.split("-");
  return `${MONTH_NAMES_FULL[Number(raw)] ?? monthKey} ${year}`;
}

export function monthLabelShort(monthKey: string): string {
  const [year, raw] = monthKey.split("-");
  return `${MONTH_NAMES_SHORT[Number(raw)] ?? monthKey} ${year}`;
}

export function directionLabel(value: string): string {
  if (value === "income") return "Ingreso";
  if (value === "expense") return "Egreso";
  return value;
}

export function statusLabel(value: string): string {
  const map: Record<string, string> = {
    forecast: "Proyectado",
    confirmed: "Confirmado",
    scheduled: "Programado",
    overdue: "Vencido",
    paid: "Pagado",
    cancelled: "Cancelado",
    pending: "Pendiente",
    approved: "Aprobado",
  };
  return map[value] ?? value;
}
