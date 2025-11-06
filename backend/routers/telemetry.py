# routers/telemetry.py
"""
Telemetry Router - Tracks user engagement with documents

DATA FLOW:
==========
INPUT: Engagement events from frontend (user interactions)
PROCESS: Log/store engagement metrics
OUTPUT: Confirmation of tracking

PURPOSE:
--------
This endpoint tracks how users interact with documents:
- Which sections they view
- How long they spend on each section
- What they select/highlight

Currently logs to console. In production, would store in database
for analytics and insights.

FRONTEND CONNECTION:
--------------------
Not currently connected to frontend in this invoice processing app.
Can be used for future document viewer with engagement tracking.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import time 

router = APIRouter()

class EngagementEvent(BaseModel):
    """
    Engagement event data structure.
    
    Tracks user interactions with document sections for analytics.
    """
    docId: str        # Unique document identifier
    sectionId: str    # Section within document (e.g., "s-1", "s-2")
    event: str        # Event type: "view", "hover", "select", "scroll"
    ms: int           # Duration in milliseconds
    timestamp: Optional[str] = None  # ISO timestamp (auto-generated if not provided)
    
@router.post("/engagement")
async def track_engagement(event: EngagementEvent):
    """
    Track user engagement with document sections.
    
    DATA FLOW:
    ----------
    1. Frontend sends engagement event
    2. Add timestamp if not provided
    3. Log event (would store in DB in production)
    4. Return confirmation
    
    USAGE:
    ------
    POST /telemetry/engagement
    {
        "docId": "invoice-123",
        "sectionId": "line-items",
        "event": "view",
        "ms": 5000
    }
    
    FUTURE USE:
    -----------
    - Track which invoices/line items users spend most time on
    - Identify confusing sections (long view times)
    - A/B testing for UI improvements
    """
    if not event.timestamp:
        event.timestamp = time.strftime('%Y-%m-%dT%H:%M:%SZ')
    
    #In production, you'd stroe this in a database
    #For now, we'll just log it 
    print(f"Engagement event: {event}")
    
    return {"status": "recorded"}

