import os
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.main import app as api_app

# Create a main app that wraps both API and Frontend
app = FastAPI()

# Mount the existing backend API at /api
# This matches the frontend's expectation (vite proxy rewrites /api -> /)
# But here we are mounting the app which expects /questions, at /api.
# So a request to /api/questions will be routed to api_app and matched against /questions.
app.mount("/api", api_app)

# Path to frontend build
# We assume this script is run from backend/ directory
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend/dist"))
assets_dir = os.path.join(frontend_dir, "assets")

print(f"Serving frontend from: {frontend_dir}")

# Mount assets directory if it exists
if os.path.exists(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

# Catch-all route for SPA
# This must be defined last
@app.get("/{full_path:path}")
async def serve_spa(request: Request, full_path: str):
    # If the path starts with /api, it should have been handled by the mount above.
    # But just in case:
    if full_path.startswith("api/"):
        return {"error": "API endpoint not found"}

    # Try to serve a static file if it exists directly in dist (like vite.svg, favicon.ico)
    possible_file = os.path.join(frontend_dir, full_path)
    if os.path.isfile(possible_file):
        return FileResponse(possible_file)
    
    # Default to index.html for client-side routing
    index_path = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    
    return {"error": "Frontend build not found. Please build the frontend first."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
