import type {
  DashboardData,
  LineUserInput,
  LineUserSetup,
  OnboardingInput,
  Transaction,
  TransactionInput,
  WhatIfResult,
  WhatIfScenario,
} from "./types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export function getDashboard(): Promise<DashboardData> {
  return request<DashboardData>("/dashboard");
}

export function getTransactions(): Promise<Transaction[]> {
  return request<Transaction[]>("/transactions");
}

export function createTransaction(payload: TransactionInput): Promise<Transaction> {
  return request<Transaction>("/transactions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateTransaction(id: number, payload: TransactionInput): Promise<Transaction> {
  return request<Transaction>(`/transactions/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteTransaction(id: number): Promise<void> {
  return request<void>(`/transactions/${id}`, { method: "DELETE" });
}

export function runWhatIf(payload: WhatIfScenario): Promise<WhatIfResult> {
  return request<WhatIfResult>("/what-if", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function upsertLineUser(payload: LineUserInput): Promise<LineUserSetup> {
  return request<LineUserSetup>("/users/line", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function saveLineUserOnboarding(lineUserId: string, payload: OnboardingInput): Promise<LineUserSetup> {
  return request<LineUserSetup>(`/users/line/${encodeURIComponent(lineUserId)}/onboarding`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
