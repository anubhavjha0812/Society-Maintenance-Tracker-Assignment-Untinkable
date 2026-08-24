const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}/api/v1`;

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? "unknown_error", body.message ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown, idempotencyKey?: string) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    }),
  patch: <T>(path: string, body?: unknown, idempotencyKey?: string) =>
    request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    }),
};

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export type ComplaintStatus = "Open" | "InProgress" | "Resolved";
export type Priority = "Low" | "Medium" | "High";

export interface ComplaintPhoto {
  id: string;
  objectStorageKey: string;
  contentType: string;
}

export interface Complaint {
  id: string;
  societyId: string;
  residentId: string;
  category: string;
  description: string;
  priority: Priority;
  currentStatus: ComplaintStatus;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
  photos?: ComplaintPhoto[];
}

export interface ComplaintHistoryEntry {
  id: string;
  complaintId: string;
  status: "Open" | "InProgress" | "Resolved" | "Reopened";
  note: string | null;
  actorId: string;
  timestamp: string;
  actor: { id: string; name: string; role: string };
}

export interface Notice {
  id: string;
  societyId: string;
  title: string;
  body: string;
  isImportant: boolean;
  postedBy: string;
  createdAt: string;
}

export interface DashboardSummary {
  totalOpen: number;
  totalInProgress: number;
  totalResolved: number;
  totalOverdue: number;
  byCategory: { category: string; count: number }[];
}
