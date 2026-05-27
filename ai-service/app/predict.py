from fastapi import APIRouter, HTTPException
import httpx
import numpy as np
from sklearn.linear_model import LinearRegression
from datetime import datetime, timedelta
import os

router = APIRouter()

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000/api")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "secret")

@router.get("/predict/{policyId}")
async def predict_policy(policyId: str, days: int = 7):
    # Fetch historical trends from backend
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{BACKEND_URL}/analytics/{policyId}/trends?interval=day",
            headers={"X-Internal-API-Key": INTERNAL_API_KEY}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Failed to fetch trends")

    data = resp.json()
    trends = data["data"]
    if len(trends) < 3:
        raise HTTPException(status_code=400, detail="Not enough historical data (need at least 3 days)")

    # Prepare training data: X = day index, y = averageRating
    X = np.array(range(len(trends))).reshape(-1, 1)
    y = np.array([t["averageRating"] for t in trends])

    # Train linear regression
    model = LinearRegression()
    model.fit(X, y)

    # Predict next 'days'
    last_idx = len(trends)
    future_indices = np.array(range(last_idx, last_idx + days)).reshape(-1, 1)
    predictions = model.predict(future_indices)

    # Generate future dates
    last_date = datetime.strptime(trends[-1]["date"], "%Y-%m-%d")
    future_dates = [(last_date + timedelta(days=i+1)).strftime("%Y-%m-%d") for i in range(days)]

    # Clip predictions to 1-5 range
    predictions = np.clip(predictions, 1, 5)

    result = [
        {"date": future_dates[i], "predictedRating": round(float(predictions[i]), 2)}
        for i in range(days)
    ]

    return {"policyId": policyId, "predictions": result}