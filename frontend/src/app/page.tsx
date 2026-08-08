"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [eventId, setEventId] = useState("");

  const goToEvent = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseInt(eventId, 10);
    if (Number.isFinite(id) && id > 0) {
      router.push(`/events/${id}`);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Event Seat Booking
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          Enter an event ID to view seats and book.
        </p>

        <form onSubmit={goToEvent} className="space-y-4">
          <div>
            <label
              htmlFor="event-id"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Event ID
            </label>
            <input
              id="event-id"
              type="number"
              min={1}
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              placeholder="e.g. 1"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none"

            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-gray-900 text-white py-2 font-medium hover:bg-gray-800"
          >
            View Seats
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <Link
            href="/admin"
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            Go to Admin
          </Link>
        </div>
      </div>
    </main>
  );
}