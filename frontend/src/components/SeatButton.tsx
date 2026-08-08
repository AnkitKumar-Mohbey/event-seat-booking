"use client";

import type { Seat } from "@/lib/api";

type SeatState = "available" | "selected" | "booked" | "blocked";

function getState(seat: Seat, isSelected: boolean): SeatState {
  if (seat.is_booked) return "booked";
  if (seat.is_blocked) return "blocked";
  if (isSelected) return "selected";
  return "available";
}

const stateStyles: Record<SeatState, string> = {
  available: "bg-white border-gray-300 text-gray-700 hover:border-gray-900",
  selected: "bg-gray-900 border-gray-900 text-white",
  booked: "bg-red-100 border-red-200 text-red-400 cursor-not-allowed",
  blocked: "bg-gray-200 border-gray-300 text-gray-400 cursor-not-allowed",
};

type Props = {
  seat: Seat;
  isSelected: boolean;
  onToggle: (seatId: number) => void;
};

export function SeatButton({ seat, isSelected, onToggle }: Props) {
  const state = getState(seat, isSelected);
  const disabled = state === "booked" || state === "blocked";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onToggle(seat.id)}
      aria-label={`Seat ${seat.row_label}${seat.col_number} (${state})`}
      className={`
        h-10 w-10 rounded-md border text-xs font-medium
        transition-colors
        ${stateStyles[state]}
      `}
    >
      {seat.row_label}
      {seat.col_number}
    </button>
  );
}