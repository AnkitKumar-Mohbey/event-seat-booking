"""One-off script to create tables. Run once, or when models change."""
from app.database import engine
from app.models import Base

Base.metadata.create_all(engine)
print("Tables created.")