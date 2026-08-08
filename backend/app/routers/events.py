from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Booking, Event, Seat
from app.schemas import EventCreate, EventOut, SeatMap, SeatOut

router = APIRouter(prefix="/events", tags=["events"])


def _row_label(index: int) -> str:
    """0 -> 'A', 1 -> 'B', ..., 25 -> 'Z', 26 -> 'AA'."""
    label = ""
    n = index
    while True:
        label = chr(ord("A") + n % 26) + label
        n = n // 26 - 1
        if n < 0:
            return label


@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(payload: EventCreate, db: Session = Depends(get_db)):
    event = Event(
        name=payload.name,
        event_date=payload.event_date,
        rows=payload.rows,
        cols=payload.cols,
    )
    db.add(event)
    db.flush()  

    seats = [
        Seat(
            event_id=event.id,
            row_label=_row_label(r),
            col_number=c + 1,
        )
        for r in range(payload.rows)
        for c in range(payload.cols)
    ]
    db.add_all(seats)
    db.commit()
    db.refresh(event)
    return event


@router.get("/{event_id}", response_model=SeatMap)
def get_event_seat_map(event_id: int, db: Session = Depends(get_db)):
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    stmt = (
        select(Seat)
        .where(Seat.event_id == event_id)
        .options(selectinload(Seat.booking))
        .order_by(Seat.row_label, Seat.col_number)
    )
    seats = db.scalars(stmt).all()

    seat_dtos = [
        SeatOut(
            id=s.id,
            row_label=s.row_label,
            col_number=s.col_number,
            is_blocked=s.is_blocked,
            is_booked=s.booking is not None,
        )
        for s in seats
    ]
    return SeatMap(event=event, seats=seat_dtos)