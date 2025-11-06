from fastapi import FastAPI
from routers import ocr, telemetry, files
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Insight-First Reading API")


# Allow CORS for frontend dev 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers 
app.include_router(ocr.router, prefix="/ocr", tags=["OCR"])
app.include_router(telemetry.router, prefix="/telemetry", tags=["Telemetry"])
app.include_router(files.router, tags=["Files"])

@app.get("/")
def read_root():
    return {"message": "Insight-First Reading API is running"}