"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, type AdminSummary, type SeatMap } from "@/lib/api";
import { SeatButton } from "@/components/SeatButton";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function AdminDashboardPage({ params }: PageProps) {
  const [eventId, setEventId] = useState<number | null>(null);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [seatMap, setSeatMap] = useState<SeatMap | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setEventId(parseInt(p.id, 10)));
  }, [params]);

  const load = useCallback(async () => {
    if (eventId === null) return;
    try {
      const [s, m] = await Promise.all([
        api.getAdminSummary(eventId),
        api.getSeatMap(eventId),
      ]);
      setSummary(s);
      setSeatMap(m);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load event.");
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleBlockedById = async (seatId: number, currentlyBlocked: boolean) => {
    setActionError(null);
    try {
      await api.setSeatBlocked(seatId, !currentlyBlocked);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Action failed.");
    }
  };

  if (loadError) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <p className="text-red-600 mb-4">{loadError}</p>
          <Link href="/admin" className="text-sm underline text-gray-700">
            ← Back to admin
          </Link>
        </div>
      </main>
    );
  }

  if (!summary || !seatMap) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {summary.event.name}
            </h1>
            <p className="text-sm text-gray-600">
              {summary.event.event_date} · Event #{summary.event.id}
            </p>
          </div>
          <Link href="/admin" className="text-sm text-gray-600 underline">
            ← Admin
          </Link>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Total seats" value={summary.total_seats} />
          <Stat label="Booked" value={summary.booked_seats} tone="danger" />
          <Stat label="Blocked" value={summary.blocked_seats} tone="muted" />
          <Stat label="Available" value={summary.available_seats} tone="success" />
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Seat map</h2>
            <p className="text-xs text-gray-500">
              Click an available or blocked seat to toggle its block status.
              Booked seats can’t be blocked.
            </p>
          </div>

          <div className="w-full overflow-x-auto">
            <div
              className="grid gap-2 mx-auto w-fit"
              style={{
                gridTemplateColumns: `repeat(${seatMap.event.cols}, minmax(0, 1fr))`,
              }}
            >
              {seatMap.seats.map((seat) => (
                <SeatButton
                  key={seat.id}
                  seat={seat}
                  isSelected={false}
                  onToggle={() => toggleBlockedById(seat.id, seat.is_blocked)}
                />
              ))}
            </div>
          </div>

          {actionError && (
            <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
              {actionError}
            </p>
          )}
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Bookings ({summary.bookings.length})
          </h2>
          {summary.bookings.length === 0 ? (
            <p className="text-sm text-gray-500">No bookings yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b border-gray-200">
                    <th className="py-2 pr-4 font-medium">Seat</th>
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 pr-4 font-medium">Email</th>
                    <th className="py-2 pr-4 font-medium">Booked at</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.bookings.map((b) => (
                    <tr key={b.booking_id} className="border-b border-gray-100">
                      <td className="py-2 pr-4 font-medium text-gray-900">
                        {b.row_label}
                        {b.col_number}
                      </td>
                      <td className="py-2 pr-4 text-gray-700">{b.booker_name}</td>
                      <td className="py-2 pr-4 text-gray-700">{b.booker_email}</td>
                      <td className="py-2 pr-4 text-gray-500">
                        {new Date(b.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

type StatProps = {
  label: string;
  value: number;
  tone?: "default" | "success" | "danger" | "muted";
};

function Stat({ label, value, tone = "default" }: StatProps) {
  const toneStyles: Record<NonNullable<StatProps["tone"]>, string> = {
    default: "text-gray-900",
    success: "text-green-700",
    danger: "text-red-700",
    muted: "text-gray-500",
  };
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-600 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${toneStyles[tone]}`}>{value}</p>
    </div>
  );
}