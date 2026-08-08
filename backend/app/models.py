from datetime import date, datetime

from sqlalchemy import (
    Boolean, Date, DateTime, ForeignKey, Integer, String,
    UniqueConstraint, func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    rows: Mapped[int] = mapped_column(Integer, nullable=False)
    cols: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    seats: Mapped[list["Seat"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )


class Seat(Base):
    __tablename__ = "seats"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    row_label: Mapped[str] = mapped_column(String(4), nullable=False)
    col_number: Mapped[int] = mapped_column(Integer, nullable=False)
    is_blocked: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    event: Mapped["Event"] = relationship(back_populates="seats")
    booking: Mapped["Booking | None"] = relationship(
        back_populates="seat", uselist=False
    )

    __table_args__ = (
        UniqueConstraint(
            "event_id", "row_label", "col_number",
            name="uq_seat_position",
        ),
    )


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True)
    seat_id: Mapped[int] = mapped_column(
        ForeignKey("seats.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,  # ← THE concurrency guarantee
    )
    booker_name: Mapped[str] = mapped_column(String(120), nullable=False)
    booker_email: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    seat: Mapped["Seat"] = relationship(back_populates="booking")