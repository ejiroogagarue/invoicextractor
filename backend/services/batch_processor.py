"""
Batch Processing Manager
========================
Coordinates concurrent invoice jobs with progress tracking.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, asdict
from typing import Any, Awaitable, Callable, Dict, List, Tuple

from fastapi import UploadFile


@dataclass
class BatchJobSnapshot:
    """Represents the lifecycle of a single invoice within a batch."""

    job_id: str
    filename: str
    status: str = "queued"
    order: int = 0
    started_at: float | None = None
    completed_at: float | None = None
    duration_ms: float | None = None
    error: str | None = None

    def to_public_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        # Drop internal ordering metadata from public payload
        payload.pop("order", None)
        return payload


class BatchProcessingManager:
    """
    Coordinates asynchronous invoice processing with bounded concurrency.

    Responsibilities:
    - Limits the number of invoices processed simultaneously
    - Tracks per-invoice status (queued → processing → completed/failed)
    - Provides snapshots for frontend trust dashboards
    """

    def __init__(self, max_workers: int):
        self.max_workers = max(1, max_workers)
        self._semaphore = asyncio.Semaphore(self.max_workers)
        self._jobs: Dict[str, BatchJobSnapshot] = {}
        self._lock = asyncio.Lock()

    def _register_job(self, filename: str, order: int) -> str:
        job_id = str(uuid.uuid4())
        self._jobs[job_id] = BatchJobSnapshot(
            job_id=job_id,
            filename=filename,
            order=order,
        )
        return job_id

    async def _update_job(
        self,
        job_id: str,
        *,
        status: str | None = None,
        error: str | None = None,
        timestamp: float | None = None,
    ) -> None:
        async with self._lock:
            snapshot = self._jobs[job_id]
            now = timestamp or time.time()
            if status:
                snapshot.status = status
                if status == "processing":
                    snapshot.started_at = now
                if status in {"completed", "failed"}:
                    snapshot.completed_at = now
                    if snapshot.started_at:
                        snapshot.duration_ms = (now - snapshot.started_at) * 1000
            if error:
                snapshot.error = error

    async def _run_job(
        self,
        order: int,
        file: UploadFile,
        handler: Callable[[UploadFile], Awaitable[Any]],
    ) -> Tuple[str, Any]:
        job_id = self._register_job(file.filename, order)
        async with self._semaphore:
            await self._update_job(job_id, status="processing")
            try:
                result = await handler(file)
                await self._update_job(job_id, status="completed")
                return job_id, result
            except Exception as exc:  # pragma: no cover - defensive
                await self._update_job(job_id, status="failed", error=str(exc))
                return job_id, exc

    async def process(
        self,
        files: List[UploadFile],
        handler: Callable[[UploadFile], Awaitable[Any]],
    ) -> Tuple[List[Any], Dict[str, Any]]:
        """
        Process files concurrently while keeping deterministic ordering.

        Returns:
            results: List of handler outputs/exceptions sorted by original order
            progress_snapshot: Dict for telemetry/UX surfaces
        """
        tasks = [
            asyncio.create_task(self._run_job(index, file, handler))
            for index, file in enumerate(files)
        ]

        results: Dict[str, Any] = {}
        for task in asyncio.as_completed(tasks):
            job_id, outcome = await task
            results[job_id] = outcome

        ordered_results = [
            results[job.job_id]
            for job in sorted(self._jobs.values(), key=lambda j: j.order)
        ]

        return ordered_results, self.snapshot()

    def snapshot(self) -> Dict[str, Any]:
        jobs = [
            job.to_public_dict()
            for job in sorted(self._jobs.values(), key=lambda j: j.order)
        ]

        completed = sum(1 for job in jobs if job["status"] == "completed")
        failed = sum(1 for job in jobs if job["status"] == "failed")
        avg_duration = (
            sum(job["duration_ms"] or 0 for job in jobs if job["duration_ms"])
            / max(1, completed)
            if completed
            else 0
        )

        return {
            "jobs": jobs,
            "summary": {
                "total_jobs": len(jobs),
                "completed": completed,
                "failed": failed,
                "avg_duration_ms": round(avg_duration, 2),
            },
        }






