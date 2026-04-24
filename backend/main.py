from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.auth import router as auth_router
from routes.claims import router as claims_router

app = FastAPI(
    title="Agentic Decision Intelligence Insurance Platform",
    description="Multi-stakeholder insurance system with Z.AI GLM as an autonomous Adjuster",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(claims_router)


@app.get("/")
def root():
    return {"message": "Agentic Decision Intelligence Insurance Platform is running."}


@app.get("/health")
def health():
    return {"status": "ok"}
