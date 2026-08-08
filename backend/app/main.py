from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app.models import Base
from app.routers import events, bookings

@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    yield


app = FastAPI(
    title="Event Seat Booking API",
    description="Concurrency-safe seat booking for events.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["*"],
)


app.include_router(events.router)
app.include_router(bookings.router)

@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}

