// src/services/backend.api.ts

import axios from "axios";

const TOKEN_KEY = "cashflow_auth_token";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "https://cashflow-axxk.onrender.com/api",
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem(TOKEN_KEY)
      : null;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  config.headers["Content-Type"] = "application/json";

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers?.["retry-after"];
      const seconds = retryAfter ? Number(retryAfter) : null;
      const msg = seconds
        ? `Demasiadas solicitudes. Espera ${seconds} segundos antes de intentar de nuevo.`
        : "Demasiadas solicitudes. Espera unos segundos antes de intentar de nuevo.";
      return Promise.reject(new Error(msg));
    }

    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

type CursorPaginationParams = {
  limit?: number;
  cursor?: string | null;
};

export type CashFlowMovementInput = {
  date: string;
  description: string;
  direction: string;
  category: string;
  amount: number;
  status: string;
};

export type BillInput = {
  dueDate: string;
  supplier: string;
  description: string;
  category: string;
  amount: number;
  status: string;
};

export type InvoiceInput = {
  dueDate: string;
  customer: string;
  description: string;
  category: string;
  amount: number;
  status: string;
};

export type PeopleCostInput = {
  date: string;
  description: string;
  category: string;
  amount: number;
  status: string;
};

export const BackendApi = {
  async getCashFlowMovements(params: CursorPaginationParams = {}) {
    const response = await api.get("/cash-flow/movements", {
      params: {
        cursor: params.cursor ?? undefined,
        limit: params.limit ?? 20,
      },
    });
    return response.data;
  },

  async getCashFlowSummary(startDate: string, months = 12) {
    const response = await api.get("/cash-flow/summary", {
      params: { startDate, months },
    });
    return response.data;
  },

  async createCashFlowMovement(data: CashFlowMovementInput) {
    await api.post("/cash-flow/movements", data);
  },

  async updateCashFlowMovement(id: string, data: CashFlowMovementInput) {
    await api.put(`/cash-flow/movements/${id}`, data);
  },

  async deleteCashFlowMovement(id: string) {
    await api.delete(`/cash-flow/movements/${id}`);
  },

  async getPeopleCosts() {
    const response = await api.get("/people-costs");
    return response.data;
  },

  async getPeopleCostsSummary() {
    const response = await api.get("/people-costs/summary");
    return response.data;
  },

  async createPeopleCost(data: PeopleCostInput) {
    await api.post("/people-costs", data);
  },

  async updatePeopleCost(id: string, data: PeopleCostInput) {
    await api.put(`/people-costs/${id}`, data);
  },

  async deletePeopleCost(id: string) {
    await api.delete(`/people-costs/${id}`);
  },

  async getBillsToPay() {
    const response = await api.get("/bills");
    return response.data;
  },

  async getBillsToPaySummary() {
    const response = await api.get("/bills/summary");
    return response.data;
  },

  async createBillToPay(data: BillInput) {
    await api.post("/bills", data);
  },

  async updateBillToPay(id: string, data: BillInput) {
    await api.put(`/bills/${id}`, data);
  },

  async deleteBillToPay(id: string) {
    await api.delete(`/bills/${id}`);
  },

  async getInvoicesDue() {
    const response = await api.get("/invoices-due");
    return response.data;
  },

  async getInvoicesDueSummary() {
    const response = await api.get("/invoices-due/summary");
    return response.data;
  },

  async createInvoiceDue(data: InvoiceInput) {
    await api.post("/invoices-due", data);
  },

  async updateInvoiceDue(id: string, data: InvoiceInput) {
    await api.put(`/invoices-due/${id}`, data);
  },

  async deleteInvoiceDue(id: string) {
    await api.delete(`/invoices-due/${id}`);
  },
};
