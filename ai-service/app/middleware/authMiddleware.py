import os
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "")

class InternalAPIKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Skip key check for health endpoint
        if request.url.path == "/health":
            return await call_next(request)
        
        api_key = request.headers.get("X-Internal-API-Key")
        if not api_key or api_key != INTERNAL_API_KEY:
            return JSONResponse(
                status_code=403,
                content={
                    "status": "error",
                    "message": "Invalid or missing API key",
                    "timestamp": None  # FastAPI will add timestamp if needed
                }
            )
        return await call_next(request)