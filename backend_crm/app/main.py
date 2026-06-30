import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import Base, engine
from .routers import auth, employees, departments, tabel, ball, attendance, reports

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="TMSITI CRM API",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(departments.router)
app.include_router(tabel.router)
app.include_router(ball.router)
app.include_router(attendance.router)
app.include_router(reports.router)


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "message": "TMSITI CRM API v2"}

@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}
