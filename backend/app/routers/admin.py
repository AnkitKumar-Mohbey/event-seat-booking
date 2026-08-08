from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Booking, Event, Seat
from app.schemas import AdminBookingRow, AdminSummary, SeatBlockUpdate, SeatOut

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/events/{event_id}/summary", response_model=AdminSummary)
def event_summary(event_id: int, db: Session = Depends(get_db)):
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    seats_stmt = (
        select(Seat)
        .where(Seat.event_id == event_id)
        .options(selectinload(Seat.booking))
    )
    seats = db.scalars(seats_stmt).all()

    total = len(seats)
    blocked = sum(1 for s in seats if s.is_blocked)
    booked = sum(1 for s in seats if s.booking is not None)
    available = total - blocked - booked

    bookings_rows = [
        AdminBookingRow(
            booking_id=s.booking.id,
            row_label=s.row_label,
            col_number=s.col_number,
            booker_name=s.booking.booker_name,
            booker_email=s.booking.booker_email,
            created_at=s.booking.created_at,
        )
        for s in seats
        if s.booking is not None
    ]
    bookings_rows.sort(key=lambda r: r.created_at, reverse=True)

    return AdminSummary(
        event=event,
        total_seats=total,
        booked_seats=booked,
        blocked_seats=blocked,
        available_seats=available,
        bookings=bookings_rows,
    )


@router.patch("/seats/{seat_id}/block", response_model=SeatOut)
def set_seat_blocked(
    seat_id: int,
    payload: SeatBlockUpdate,
    db: Session = Depends(get_db),
):
    seat = db.get(Seat, seat_id)
    if seat is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Seat not found")

    if seat.booking is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Cannot change block status of a booked seat.",
        )

    seat.is_blocked = payload.is_blocked
    db.commit()
    db.refresh(seat)

    return SeatOut(
        id=seat.id,
        row_label=seat.row_label,
        col_number=seat.col_number,
        is_blocked=seat.is_blocked,
        is_booked=False,
    )