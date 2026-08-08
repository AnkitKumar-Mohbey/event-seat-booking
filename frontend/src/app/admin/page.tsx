"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";

type CreateState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

export default function AdminHomePage() {
  const router = useRouter();

  // Create-event form state
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [rows, setRows] = useState(5);
  const [cols, setCols] = useState(8);
  const [createState, setCreateState] = useState<CreateState>({ kind: "idle" });

  // Open-dashboard form state
  const [dashboardId, setDashboardId] = useState("");

  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateState({ kind: "submitting" });
    try {
      const event = await api.createEvent({
        name: name.trim(),
        event_date: eventDate,
        rows,
        cols,
      });
      setCreateState({ kind: "idle" });
      router.push(`/admin/events/${event.id}`);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to create event.";
      setCreateState({ kind: "error", message });
    }
  };

  const openDashboard = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(dashboardId, 10);
    if (Number.isFinite(id) && id > 0) {
      router.push(`/admin/events/${id}`);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Admin</h1>
          <Link href="/" className="text-sm text-gray-600 underline">
            Home
          </Link>
        </header>

        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Create a new event
          </h2>
          <form onSubmit={createEvent} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Event name
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
              <label htmlFor="event-date" className="block text-sm font-medium text-gray-700 mb-1">
                Event date
              </label>
              <input
                id="event-date"
                type="date"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="rows" className="block text-sm font-medium text-gray-700 mb-1">
                  Rows
                </label>
                <input
                  id="rows"
                  type="number"
                  min={1}
                  max={50}
                  required
                  value={rows}
                  onChange={(e) => setRows(parseInt(e.target.value, 10) || 1)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="cols" className="block text-sm font-medium text-gray-700 mb-1">
                  Seats per row
                </label>
                <input
                  id="cols"
                  type="number"
                  min={1}
                  max={50}
                  required
                  value={cols}
                  onChange={(e) => setCols(parseInt(e.target.value, 10) || 1)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none"
                />
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Total seats: <strong>{rows * cols}</strong>
            </p>

            <button
              type="submit"
              disabled={createState.kind === "submitting"}
              className="rounded-md bg-gray-900 text-white px-4 py-2 font-medium hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {createState.kind === "submitting" ? "Creating…" : "Create event"}
            </button>

            {createState.kind === "error" && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
                {createState.message}
              </p>
            )}
          </form>
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Open an event dashboard
          </h2>
          <form onSubmit={openDashboard} className="flex gap-3">
            <input
              type="number"
              min={1}
              placeholder="Event ID"
              value={dashboardId}
              onChange={(e) => setDashboardId(e.target.value)}
              required
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-md bg-gray-900 text-white px-4 py-2 font-medium hover:bg-gray-800"
            >
              Open
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}