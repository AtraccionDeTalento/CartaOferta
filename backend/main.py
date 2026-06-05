"""
HR Operations Management System — FastAPI Entry Point.
Sirve el backend API + frontend estático.
"""
import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from backend.database import init_db
from backend.config import FRONTEND_DIR
from backend.routers import catalogos, ingresos, cartas, movimientos

app = FastAPI(
    title="HR Operations Management System",
    description="Sistema de gestión de operaciones de RRHH",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar routers
app.include_router(catalogos.router)
app.include_router(ingresos.router)
app.include_router(cartas.router)
app.include_router(movimientos.router)

# Servir archivos estáticos del frontend
if os.path.exists(FRONTEND_DIR):
    # Soporte para la estructura de build de Vite
    assets_path = os.path.join(FRONTEND_DIR, "assets")
    data_path = os.path.join(FRONTEND_DIR, "data")
    
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")
    if os.path.exists(data_path):
        app.mount("/data", StaticFiles(directory=data_path), name="data")
        
    # Compatibilidad heredada
    if os.path.exists(os.path.join(FRONTEND_DIR, "css")):
        app.mount("/css", StaticFiles(directory=os.path.join(FRONTEND_DIR, "css")), name="css")
    if os.path.exists(os.path.join(FRONTEND_DIR, "js")):
        app.mount("/js", StaticFiles(directory=os.path.join(FRONTEND_DIR, "js")), name="js")


@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


@app.on_event("startup")
def startup():
    init_db()
    print("HR Operations System started")
    print(f"Frontend: {FRONTEND_DIR}")
