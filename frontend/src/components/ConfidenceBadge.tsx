/**
 * ConfidenceBadge.tsx - Visual Trust Indicator
 * 
 * PURPOSE:
 * ========
 * Displays confidence score with color-coded badge for instant trust assessment.
 * Critical for accounting - users need to see data reliability at a glance.
 * 
 * COLOR CODING:
 * -------------
 * 🟢 Green (95%+): High confidence, auto-approved, trustworthy
 * 🟡 Yellow (75-94%): Medium confidence, review recommended
 * 🔴 Red (<75%): Low confidence, review required
 * 
 * USAGE:
 * ------
 * <ConfidenceBadge confidence={0.96} size="small" />
 * <ConfidenceBadge confidence={0.72} showLabel={true} />
 */

import React from "react";

interface ConfidenceBadgeProps {
  confidence: number;           // 0.0 to 1.0
  size?: "small" | "medium" | "large";
  showLabel?: boolean;          // Show "Confidence:" label
  mathValid?: boolean;          // Show checkmark if math validates
}

const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ 
  confidence, 
  size = "medium",
  showLabel = false,
  mathValid = true
}) => {
  // Convert to percentage
  const percentage = Math.round(confidence * 100);
  
  // Determine color and status
  const getStatus = () => {
    if (percentage >= 95) return { color: '#28a745', bg: '#d4edda', label: 'High', icon: '✓' };
    if (percentage >= 75) return { color: '#ffc107', bg: '#fff3cd', label: 'Medium', icon: '⚠️' };
    return { color: '#dc3545', bg: '#f8d7da', label: 'Low', icon: '⚠️' };
  };
  
  const status = getStatus();
  
  // Size configurations
  const sizeStyles = {
    small: { padding: '0.15rem 0.4rem', fontSize: '0.7rem' },
    medium: { padding: '0.25rem 0.5rem', fontSize: '0.8rem' },
    large: { padding: '0.4rem 0.7rem', fontSize: '0.9rem' }
  };
  
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        ...sizeStyles[size],
        borderRadius: '12px',
        fontWeight: 'bold',
        backgroundColor: status.bg,
        color: status.color,
        border: `1px solid ${status.color}`,
      }}
      title={`Confidence: ${percentage}%${mathValid ? ' • Math validated ✓' : ' • Math validation failed'}`}
    >
      {showLabel && <span style={{ marginRight: '0.25rem' }}>Confidence:</span>}
      {mathValid && percentage >= 95 && <span>✓</span>}
      {!mathValid && <span style={{ color: '#dc3545' }}>⚠️</span>}
      <span>{percentage}%</span>
    </span>
  );
};

export default ConfidenceBadge;


