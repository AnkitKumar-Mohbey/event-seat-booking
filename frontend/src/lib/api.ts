const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

// ---------- Types (mirror of backend schemas) ----------

export type Event = {
  id: number;
  name: string;
  event_date: string;
  rows: number;
  cols: number;
  created_at: string;
};

export type Seat = {
  id: number;
  row_label: string;
  col_number: number;
  is_blocked: boolean;
  is_booked: boolean;
};

export type SeatMap = {
  event: Event;
  seats: Seat[];
};

export type Booking = {
  id: number;
  seat_id: number;
  booker_name: string;
  booker_email: string;
  created_at: string;
};

export type AdminBookingRow = {
  booking_id: number;
  row_label: string;
  col_number: number;
  booker_name: string;
  booker_email: string;
  created_at: string;
};

export type AdminSummary = {
  event: Event;
  total_seats: number;
  booked_seats: number;
  blocked_seats: number;
  available_seats: number;
  bookings: AdminBookingRow[];
};

// ---------- Error type ----------

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ---------- Core fetch wrapper ----------

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* non-JSON error body — ignore, use default */
    }
    throw new ApiError(res.status, detail);
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

// ---------- API functions ----------

export const api = {
  createEvent: (payload: {
    name: string;
    event_date: string;
    rows: number;
    cols: number;
  }) => request<Event>("/events", { method: "POST", body: JSON.stringify(payload) }),

  getSeatMap: (eventId: number) => request<SeatMap>(`/events/${eventId}`),

  createBooking: (payload: {
    event_id: number;
    seat_ids: number[];
    booker_name: string;
    booker_email: string;
  }) => request<Booking[]>("/bookings", { method: "POST", body: JSON.stringify(payload) }),

  getAdminSummary: (eventId: number) =>
    request<AdminSummary>(`/admin/events/${eventId}/summary`),

  setSeatBlocked: (seatId: number, isBlocked: boolean) =>
    request<Seat>(`/admin/seats/${seatId}/block`, {
      method: "PATCH",
      body: JSON.stringify({ is_blocked: isBlocked }),
    }),
};