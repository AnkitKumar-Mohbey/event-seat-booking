"use client";

import type { Seat } from "@/lib/api";
import { SeatButton } from "./SeatButton";

type Props = {
  seats: Seat[];
  cols: number;
  selectedIds: Set<number>;
  onToggle: (seatId: number) => void;
};

export function SeatGrid({ seats, cols, selectedIds, onToggle }: Props) {
  return (
    <div className="space-y-6">
      <Legend />

      <div className="w-full overflow-x-auto">
        <div
          className="grid gap-2 mx-auto w-fit"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {seats.map((seat) => (
            <SeatButton
              key={seat.id}
              seat={seat}
              isSelected={selectedIds.has(seat.id)}
              onToggle={onToggle}
            />
          ))}
        </div>
      </div>

      <p className="text-xs text-center text-gray-500">— Stage / Screen —</p>
    </div>
  );
}

function Legend() {
  const items = [
    { label: "Available", className: "bg-white border-gray-300" },
    { label: "Selected", className: "bg-gray-900 border-gray-900" },
    { label: "Booked", className: "bg-red-100 border-red-200" },
    { label: "Blocked", className: "bg-gray-200 border-gray-300" },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-600">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className={`h-4 w-4 rounded border ${item.className}`} />
          {item.label}
        </div>
      ))}
    </div>
  );
}