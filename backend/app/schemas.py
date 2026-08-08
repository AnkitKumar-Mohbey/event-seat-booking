from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---------- Event ----------

class EventCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    event_date: date
    rows: int = Field(ge=1, le=50)
    cols: int = Field(ge=1, le=50)


class EventOut(BaseModel):
    id: int
    name: str
    event_date: date
    rows: int
    cols: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------- Seat ----------

class SeatOut(BaseModel):
    id: int
    row_label: str
    col_number: int
    is_blocked: bool
    is_booked: bool

    model_config = ConfigDict(from_attributes=True)


class SeatMap(BaseModel):
    event: EventOut
    seats: list[SeatOut]


# ---------- Booking ----------

class BookingCreate(BaseModel):
    event_id: int
    seat_ids: list[int] = Field(min_length=1, max_length=20)
    booker_name: str = Field(min_length=1, max_length=120)
    booker_email: EmailStr


class BookingOut(BaseModel):
    id: int
    seat_id: int
    booker_name: str
    booker_email: EmailStr
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------- Admin ----------

class SeatBlockUpdate(BaseModel):
    is_blocked: bool


class AdminBookingRow(BaseModel):
    booking_id: int
    row_label: str
    col_number: int
    booker_name: str
    booker_email: EmailStr
    created_at: datetime


class AdminSummary(BaseModel):
    event: EventOut
    total_seats: int
    booked_seats: int
    blocked_seats: int
    available_seats: int
    bookings: list[AdminBookingRow]