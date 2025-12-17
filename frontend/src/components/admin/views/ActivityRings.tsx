import React from 'react';

interface ActivityRingsProps {
  // Aktuelle Werte
  totalPoints: number;
  gottesdienstPoints: number;
  gemeindePoints: number;
  // Zielwerte (für Prozentberechnung)
  totalGoal?: number;
  gottesdienstGoal?: number;
  gemeindeGoal?: number;
  // Größe
  size?: number;
}

/**
 * Apple Health-Style Activity Rings
 * Drei konzentrische Ringe: Gesamt (außen), Gottesdienst (mitte), Gemeinde (innen)
 *
 * Einfach zu entfernen: Diese Komponente kann komplett ausgetauscht werden,
 * ohne den Rest der KonfiDetailView zu beeinflussen.
 */
const ActivityRings: React.FC<ActivityRingsProps> = ({
  totalPoints,
  gottesdienstPoints,
  gemeindePoints,
  totalGoal = 100,
  gottesdienstGoal = 50,
  gemeindeGoal = 50,
  size = 160
}) => {
  // Prozent berechnen (max 100% für volle Anzeige, kann aber überschritten werden)
  const totalPercent = Math.min((totalPoints / totalGoal) * 100, 100);
  const gottesdienstPercent = Math.min((gottesdienstPoints / gottesdienstGoal) * 100, 100);
  const gemeindePercent = Math.min((gemeindePoints / gemeindeGoal) * 100, 100);

  // Ring-Parameter
  const center = size / 2;
  const strokeWidth = size * 0.08; // 8% der Größe
  const gap = strokeWidth * 0.4; // Abstand zwischen Ringen

  // Radien für die drei Ringe (von außen nach innen)
  const outerRadius = center - strokeWidth / 2 - 2;
  const middleRadius = outerRadius - strokeWidth - gap;
  const innerRadius = middleRadius - strokeWidth - gap;

  // Umfang berechnen für stroke-dasharray
  const outerCircumference = 2 * Math.PI * outerRadius;
  const middleCircumference = 2 * Math.PI * middleRadius;
  const innerCircumference = 2 * Math.PI * innerRadius;

  // Farben
  const colors = {
    total: '#5b21b6',      // Lila - Gesamtpunkte
    gottesdienst: '#007aff', // Blau - Gottesdienst
    gemeinde: '#22c55e',     // Grün - Gemeinde
    background: 'rgba(255, 255, 255, 0.15)'
  };

  // Ring Component
  const Ring: React.FC<{
    radius: number;
    circumference: number;
    percent: number;
    color: string;
  }> = ({ radius, circumference, percent, color }) => {
    const offset = circumference - (circumference * percent) / 100;

    return (
      <>
        {/* Hintergrund-Ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={colors.background}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Fortschritts-Ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: 'center',
            transition: 'stroke-dashoffset 0.5s ease-out',
            filter: `drop-shadow(0 0 4px ${color}40)`
          }}
        />
      </>
    );
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px'
    }}>
      {/* SVG Rings */}
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size}>
          {/* Außenring - Gesamt */}
          <Ring
            radius={outerRadius}
            circumference={outerCircumference}
            percent={totalPercent}
            color={colors.total}
          />
          {/* Mittlerer Ring - Gottesdienst */}
          <Ring
            radius={middleRadius}
            circumference={middleCircumference}
            percent={gottesdienstPercent}
            color={colors.gottesdienst}
          />
          {/* Innenring - Gemeinde */}
          <Ring
            radius={innerRadius}
            circumference={innerCircumference}
            percent={gemeindePercent}
            color={colors.gemeinde}
          />
        </svg>

        {/* Zentrale Anzeige */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: 'white'
        }}>
          <div style={{
            fontSize: size * 0.18,
            fontWeight: '800',
            lineHeight: 1
          }}>
            {totalPoints}
          </div>
          <div style={{
            fontSize: size * 0.08,
            opacity: 0.8,
            marginTop: '2px'
          }}>
            Punkte
          </div>
        </div>
      </div>

      {/* Legende */}
      <div style={{
        display: 'flex',
        gap: '16px',
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
        <LegendItem
          color={colors.total}
          label="Gesamt"
          value={totalPoints}
          goal={totalGoal}
        />
        <LegendItem
          color={colors.gottesdienst}
          label="Gottesdienst"
          value={gottesdienstPoints}
          goal={gottesdienstGoal}
        />
        <LegendItem
          color={colors.gemeinde}
          label="Gemeinde"
          value={gemeindePoints}
          goal={gemeindeGoal}
        />
      </div>
    </div>
  );
};

// Legende Item
const LegendItem: React.FC<{
  color: string;
  label: string;
  value: number;
  goal: number;
}> = ({ color, label, value, goal }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  }}>
    <div style={{
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      backgroundColor: color,
      boxShadow: `0 0 4px ${color}60`
    }} />
    <span style={{
      color: 'rgba(255, 255, 255, 0.9)',
      fontSize: '0.75rem'
    }}>
      {label}: <strong>{value}</strong>/{goal}
    </span>
  </div>
);

export default ActivityRings;
