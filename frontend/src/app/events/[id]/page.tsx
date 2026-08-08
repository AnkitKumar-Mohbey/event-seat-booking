"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, type SeatMap } from "@/lib/api";
import { SeatGrid } from "@/components/SeatGrid";

type PageProps = {
  params: Promise<{ id: string }>;
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; count: number }
  | { kind: "error"; message: string };

export default function EventBookingPage({ params }: PageProps) {
  const [eventId, setEventId] = useState<number | null>(null);
  const [seatMap, setSeatMap] = useState<SeatMap | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" });

  // Resolve dynamic route param (Next.js 15+ params is a Promise).
  useEffect(() => {
    params.then((p) => setEventId(parseInt(p.id, 10)));
  }, [params]);

  const loadSeatMap = useCallback(async () => {
    if (eventId === null) return;
    try {
      const data = await api.getSeatMap(eventId);
      setSeatMap(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load event.");
    }
  }, [eventId]);

  // Initial load + refetch when window regains focus (keeps seats fresh).
  useEffect(() => {
    loadSeatMap();
    const onFocus = () => loadSeatMap();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadSeatMap]);

  const toggleSeat = (seatId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(seatId) ? next.delete(seatId) : next.add(seatId);
      return next;
    });
    // Clear stale success/error when user starts a new selection.
    if (submitState.kind !== "idle" && submitState.kind !== "submitting") {
      setSubmitState({ kind: "idle" });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (eventId === null || selectedIds.size === 0) return;

    setSubmitState({ kind: "submitting" });
    try {
      const bookings = await api.createBooking({
        event_id: eventId,
        seat_ids: Array.from(selectedIds),
        booker_name: name.trim(),
        booker_email: email.trim(),
      });
      setSubmitState({ kind: "success", count: bookings.length });
      setSelectedIds(new Set());
      setName("");
      setEmail("");
      await loadSeatMap();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Booking failed. Please try again.";
      setSubmitState({ kind: "error", message });
      // Refresh seat map so any newly-booked seats show up immediately.
      await loadSeatMap();
    }
  };

  if (loadError) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <p className="text-red-600 mb-4">{loadError}</p>
          <Link href="/" className="text-sm underline text-gray-700">
            ← Back to home
          </Link>
        </div>
      </main>
    );
  }

  if (!seatMap) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </main>
    );
  }

  const canSubmit =
    selectedIds.size > 0 &&
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    submitState.kind !== "submitting";

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {seatMap.event.name}
            </h1>
            <p className="text-sm text-gray-600">
              {seatMap.event.event_date} · {seatMap.event.rows} × {seatMap.event.cols} seats
            </p>
          </div>
          <Link href="/" className="text-sm text-gray-600 underline">
            Home
          </Link>
        </header>

        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <SeatGrid
            seats={seatMap.seats}
            cols={seatMap.event.cols}
            selectedIds={selectedIds}
            onToggle={toggleSeat}
          />
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Book your seats
          </h2>

          {selectedIds.size === 0 ? (
            <p className="text-sm text-gray-500">
              Select one or more seats above to continue.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <p className="text-sm text-gray-700">
                Selected: <strong>{selectedIds.size}</strong>{" "}
                {selectedIds.size === 1 ? "seat" : "seats"}
              </p>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Full name
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full rounded-md bg-gray-900 text-white py-2 font-medium hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {submitState.kind === "submitting" ? "Booking…" : "Confirm booking"}
              </button>
            </form>
          )}

          {submitState.kind === "success" && (
            <p className="mt-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-3">
              Booking confirmed for {submitState.count}{" "}
              {submitState.count === 1 ? "seat" : "seats"}.
            </p>
          )}
          {submitState.kind === "error" && (
            <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
              {submitState.message}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}