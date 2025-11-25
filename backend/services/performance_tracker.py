"""
Performance Tracker
===================
Tracks and logs real metrics for invoice extraction performance.
Generates CSV reports for before/after comparison.
"""

import csv
import json
import time
from pathlib import Path
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict
from datetime import datetime


@dataclass
class InvoiceMetrics:
    """Metrics for a single invoice extraction."""
    
    # Identification
    filename: str
    timestamp: str
    system_version: str  # "baseline", "phase1", "phase2", "hybrid"
    
    # Timing (seconds)
    total_time: float
    layout_time: float
    deterministic_time: float
    llm_time: float
    validation_time: float
    
    # Token usage
    input_tokens: int
    output_tokens: int
    total_tokens: int
    
    # Cost (USD)
    input_cost: float
    output_cost: float
    total_cost: float
    
    # Extraction stats
    total_line_items: int
    deterministic_items: int
    llm_items: int
    deterministic_percentage: float
    
    # Quality metrics
    success: bool
    error_message: Optional[str]
    validation_pass: bool
    confidence_score: float
    
    # Metadata
    page_count: int
    chunk_count: int
    layout_source: str  # "unstructured", "pdfplumber", "skip"


class PerformanceTracker:
    """
    Tracks performance metrics and generates reports.
    """
    
    def __init__(self, output_dir: str = "performance_metrics"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.metrics: List[InvoiceMetrics] = []
        
        # OpenAI pricing (as of 2024)
        self.INPUT_PRICE_PER_1M = 0.150  # $0.15 per 1M tokens
        self.OUTPUT_PRICE_PER_1M = 0.600  # $0.60 per 1M tokens
    
    def calculate_cost(self, input_tokens: int, output_tokens: int) -> Dict[str, float]:
        """Calculate cost based on token usage."""
        input_cost = (input_tokens / 1_000_000) * self.INPUT_PRICE_PER_1M
        output_cost = (output_tokens / 1_000_000) * self.OUTPUT_PRICE_PER_1M
        total_cost = input_cost + output_cost
        
        return {
            "input_cost": input_cost,
            "output_cost": output_cost,
            "total_cost": total_cost
        }
    
    def track_invoice(
        self,
        filename: str,
        system_version: str,
        stage_times: Dict[str, float],
        token_usage: Dict[str, int],
        extraction_stats: Dict[str, Any],
        quality_metrics: Dict[str, Any],
        metadata: Dict[str, Any],
        success: bool = True,
        error_message: Optional[str] = None
    ) -> InvoiceMetrics:
        """
        Track metrics for a single invoice extraction.
        
        Args:
            filename: Invoice filename
            system_version: "baseline", "phase1", "phase2", or "hybrid"
            stage_times: Dict with keys: layout, deterministic, llm, validation
            token_usage: Dict with keys: input_tokens, output_tokens
            extraction_stats: Dict with keys: total_items, deterministic_items, llm_items
            quality_metrics: Dict with keys: validation_pass, confidence_score
            metadata: Dict with keys: page_count, chunk_count, layout_source
            success: Whether extraction succeeded
            error_message: Error message if failed
        """
        # Calculate costs
        costs = self.calculate_cost(
            token_usage.get("input_tokens", 0),
            token_usage.get("output_tokens", 0)
        )
        
        # Calculate percentages
        total_items = extraction_stats.get("total_items", 0)
        deterministic_items = extraction_stats.get("deterministic_items", 0)
        deterministic_pct = (deterministic_items / total_items * 100) if total_items > 0 else 0.0
        
        # Create metrics object
        metrics = InvoiceMetrics(
            filename=filename,
            timestamp=datetime.now().isoformat(),
            system_version=system_version,
            total_time=sum(stage_times.values()),
            layout_time=stage_times.get("layout", 0.0),
            deterministic_time=stage_times.get("deterministic", 0.0),
            llm_time=stage_times.get("llm", 0.0),
            validation_time=stage_times.get("validation", 0.0),
            input_tokens=token_usage.get("input_tokens", 0),
            output_tokens=token_usage.get("output_tokens", 0),
            total_tokens=token_usage.get("input_tokens", 0) + token_usage.get("output_tokens", 0),
            input_cost=costs["input_cost"],
            output_cost=costs["output_cost"],
            total_cost=costs["total_cost"],
            total_line_items=total_items,
            deterministic_items=deterministic_items,
            llm_items=extraction_stats.get("llm_items", 0),
            deterministic_percentage=deterministic_pct,
            success=success,
            error_message=error_message,
            validation_pass=quality_metrics.get("validation_pass", False),
            confidence_score=quality_metrics.get("confidence_score", 0.0),
            page_count=metadata.get("page_count", 0),
            chunk_count=metadata.get("chunk_count", 0),
            layout_source=metadata.get("layout_source", "unknown")
        )
        
        self.metrics.append(metrics)
        return metrics
    
    def save_to_csv(self, filename: str = "invoice_metrics.csv"):
        """Save all tracked metrics to CSV."""
        if not self.metrics:
            print("No metrics to save")
            return
        
        filepath = self.output_dir / filename
        
        with open(filepath, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=asdict(self.metrics[0]).keys())
            writer.writeheader()
            for metric in self.metrics:
                writer.writerow(asdict(metric))
        
        print(f"✓ Metrics saved to {filepath}")
        return filepath
    
    def generate_report(self, output_file: str = "performance_report.txt") -> str:
        """
        Generate a human-readable performance report.
        """
        if not self.metrics:
            return "No metrics to report"
        
        # Group by system version
        by_version = {}
        for m in self.metrics:
            if m.system_version not in by_version:
                by_version[m.system_version] = []
            by_version[m.system_version].append(m)
        
        # Generate report
        report_lines = []
        report_lines.append("=" * 70)
        report_lines.append("INVOICE EXTRACTION PERFORMANCE REPORT")
        report_lines.append("=" * 70)
        report_lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append(f"Total invoices tested: {len(self.metrics)}")
        report_lines.append("")
        
        for version, metrics_list in sorted(by_version.items()):
            report_lines.append("-" * 70)
            report_lines.append(f"SYSTEM: {version.upper()}")
            report_lines.append("-" * 70)
            report_lines.append(f"Invoices: {len(metrics_list)}")
            report_lines.append("")
            
            # Calculate averages
            avg_time = sum(m.total_time for m in metrics_list) / len(metrics_list)
            avg_cost = sum(m.total_cost for m in metrics_list) / len(metrics_list)
            avg_tokens = sum(m.total_tokens for m in metrics_list) / len(metrics_list)
            avg_items = sum(m.total_line_items for m in metrics_list) / len(metrics_list)
            avg_det_pct = sum(m.deterministic_percentage for m in metrics_list) / len(metrics_list)
            success_rate = sum(1 for m in metrics_list if m.success) / len(metrics_list) * 100
            
            report_lines.append(f"Average processing time: {avg_time:.1f}s")
            report_lines.append(f"Average cost per invoice: ${avg_cost:.5f}")
            report_lines.append(f"Average tokens used: {avg_tokens:.0f}")
            report_lines.append(f"Average line items: {avg_items:.0f}")
            report_lines.append(f"Deterministic extraction: {avg_det_pct:.1f}%")
            report_lines.append(f"Success rate: {success_rate:.1f}%")
            report_lines.append("")
            
            # Individual invoices
            report_lines.append("Individual Results:")
            for m in metrics_list:
                status = "✓" if m.success else "✗"
                report_lines.append(
                    f"  {status} {m.filename}: {m.total_time:.1f}s, "
                    f"${m.total_cost:.5f}, {m.total_line_items} items, "
                    f"{m.deterministic_percentage:.0f}% deterministic"
                )
            report_lines.append("")
        
        # Comparison if multiple versions
        if len(by_version) > 1:
            report_lines.append("=" * 70)
            report_lines.append("COMPARISON")
            report_lines.append("=" * 70)
            
            versions = sorted(by_version.keys())
            if len(versions) >= 2:
                baseline = by_version[versions[0]]
                improved = by_version[versions[-1]]
                
                baseline_avg_time = sum(m.total_time for m in baseline) / len(baseline)
                improved_avg_time = sum(m.total_time for m in improved) / len(improved)
                time_improvement = (1 - improved_avg_time / baseline_avg_time) * 100
                
                baseline_avg_cost = sum(m.total_cost for m in baseline) / len(baseline)
                improved_avg_cost = sum(m.total_cost for m in improved) / len(improved)
                cost_improvement = (1 - improved_avg_cost / baseline_avg_cost) * 100
                
                report_lines.append(f"Time improvement: {time_improvement:+.1f}%")
                report_lines.append(f"Cost reduction: {cost_improvement:+.1f}%")
                report_lines.append("")
        
        report = "\n".join(report_lines)
        
        # Save to file
        report_path = self.output_dir / output_file
        report_path.write_text(report)
        print(f"✓ Report saved to {report_path}")
        
        return report


# Global tracker instance
_tracker = None

def get_tracker() -> PerformanceTracker:
    """Get or create the global performance tracker."""
    global _tracker
    if _tracker is None:
        _tracker = PerformanceTracker()
    return _tracker





