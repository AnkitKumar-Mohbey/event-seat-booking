from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Booking, Seat
from app.schemas import BookingCreate, BookingOut

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.post(
    "",
    response_model=list[BookingOut],
    status_code=status.HTTP_201_CREATED,
)
def create_booking(payload: BookingCreate, db: Session = Depends(get_db)):
    # 1. Fetch the requested seats scoped to the event.
    #    Validates that (a) they exist and (b) belong to THIS event —
    #    prevents a client from booking seats from another event by ID guessing.
    stmt = select(Seat).where(
        Seat.event_id == payload.event_id,
        Seat.id.in_(payload.seat_ids),
    )
    seats = db.scalars(stmt).all()

    if len(seats) != len(set(payload.seat_ids)):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "One or more seats do not exist for this event.",
        )

    # 2. Reject admin-blocked seats up front (better error message).
    #    Not a race-critical check — admin blocking is not concurrent
    #    with user bookings by design.
    blocked = [f"{s.row_label}{s.col_number}" for s in seats if s.is_blocked]
    if blocked:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Seat(s) not available: {', '.join(blocked)}.",
        )

    # 3. Attempt atomic insert of ALL bookings in ONE transaction.
    #    The UNIQUE(seat_id) constraint on the bookings table is the
    #    real concurrency guarantee: if any seat was booked concurrently
    #    by another request, MySQL raises IntegrityError and we roll back
    #    the entire transaction — no partial bookings, ever.
    bookings = [
        Booking(
            seat_id=seat_id,
            booker_name=payload.booker_name,
            booker_email=payload.booker_email,
        )
        for seat_id in payload.seat_ids
    ]
    db.add_all(bookings)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "One or more selected seats have just been booked. "
            "Please refresh and try again.",
        )

    for b in bookings:
        db.refresh(b)
    return bookings