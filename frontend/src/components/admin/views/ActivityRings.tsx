import React from 'react';

interface ActivityRingsProps {
  // Aktuelle Werte
  totalPoints: number;
  gottesdienstPoints: number;
  gemeindePoints: number;
  // Zielwerte (für Prozentberechnung) - 0 = kein Limit, Ring dreht weiter
  gottesdienstGoal: number;
  gemeindeGoal: number;
  // Größe
  size?: number;
}

/**
 * Apple Health-Style Activity Rings mit Mehrfachdrehungs-Support
 *
 * - Alle Ringe werden immer angezeigt (motiviert mehr zu sammeln)
 * - Bei >100% dreht der Ring weiter und wird dunkler/ändert Farbe
 * - Der Gesamtwert berechnet sich automatisch aus godi + gemeinde
 * - Eigenständige Komponente - leicht austauschbar
 */
const ActivityRings: React.FC<ActivityRingsProps> = ({
  totalPoints,
  gottesdienstPoints,
  gemeindePoints,
  gottesdienstGoal,
  gemeindeGoal,
  size = 160
}) => {
  // Alle Ringe werden immer angezeigt - motiviert zum Sammeln!
  // Wenn Ziel 0 ist, verwenden wir einen Default-Wert für die Visualisierung
  const effectiveGottesdienstGoal = gottesdienstGoal > 0 ? gottesdienstGoal : 10;
  const effectiveGemeindeGoal = gemeindeGoal > 0 ? gemeindeGoal : 10;
  const effectiveTotalGoal = effectiveGottesdienstGoal + effectiveGemeindeGoal;

  // Prozent berechnen (kann über 100% gehen)
  const totalPercent = (totalPoints / effectiveTotalGoal) * 100;
  const gottesdienstPercent = (gottesdienstPoints / effectiveGottesdienstGoal) * 100;
  const gemeindePercent = (gemeindePoints / effectiveGemeindeGoal) * 100;

  // Ring-Parameter
  const center = size / 2;
  const strokeWidth = size * 0.075;
  const gap = strokeWidth * 0.5;

  // Radien für die Ringe (von außen nach innen)
  const outerRadius = center - strokeWidth / 2 - 4;
  const ringRadii = [
    outerRadius,
    outerRadius - strokeWidth - gap,
    outerRadius - 2 * (strokeWidth + gap)
  ];

  // Farben
  const colors = {
    total: '#f59e0b',        // Gold/Orange - Gesamtpunkte
    totalDark: '#b45309',    // Dunkleres Gold für 2. Runde
    gottesdienst: '#3b82f6', // Blau - Gottesdienst
    gottesdienstDark: '#1d4ed8', // Dunkleres Blau für 2. Runde
    gemeinde: '#22c55e',     // Grün - Gemeinde
    gemeindeDark: '#15803d', // Dunkleres Grün für 2. Runde
    background: 'rgba(255, 255, 255, 0.12)'
  };

  // Ring Component mit Mehrfachdrehungs-Support
  const Ring: React.FC<{
    radius: number;
    percent: number;
    color: string;
    colorDark: string;
  }> = ({ radius, percent, color, colorDark }) => {
    const circumference = 2 * Math.PI * radius;

    // Berechne wie viele volle Runden und den Rest
    const fullRounds = Math.floor(percent / 100);
    const remainder = percent % 100;

    // Erste Runde (immer anzeigen, max 100%)
    const firstRoundPercent = Math.min(percent, 100);
    const firstOffset = circumference - (circumference * firstRoundPercent) / 100;

    // Zweite Runde (wenn >100%)
    const hasSecondRound = percent > 100;
    const secondRoundPercent = hasSecondRound ? remainder : 0;
    const secondOffset = circumference - (circumference * secondRoundPercent) / 100;

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

        {/* Erste Runde - normale Farbe */}
        {firstRoundPercent > 0 && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={firstOffset}
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
              transition: 'stroke-dashoffset 0.8s ease-out',
              filter: `drop-shadow(0 0 6px ${color}50)`
            }}
          />
        )}

        {/* Zweite Runde - dunklere Farbe, leicht nach innen versetzt */}
        {hasSecondRound && secondRoundPercent > 0 && (
          <circle
            cx={center}
            cy={center}
            r={radius - strokeWidth * 0.15}
            fill="none"
            stroke={colorDark}
            strokeWidth={strokeWidth * 0.7}
            strokeLinecap="round"
            strokeDasharray={circumference * 0.97}
            strokeDashoffset={(circumference * 0.97) - ((circumference * 0.97) * secondRoundPercent) / 100}
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
              transition: 'stroke-dashoffset 0.8s ease-out',
              filter: `drop-shadow(0 0 4px ${colorDark}70)`
            }}
          />
        )}

        {/* Dritte Runde andeuten wenn >200% */}
        {percent > 200 && (
          <circle
            cx={center}
            cy={center}
            r={radius - strokeWidth * 0.3}
            fill="none"
            stroke={colorDark}
            strokeWidth={strokeWidth * 0.4}
            strokeLinecap="round"
            strokeDasharray={circumference * 0.94}
            strokeDashoffset={(circumference * 0.94) - ((circumference * 0.94) * (percent - 200)) / 100}
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
              transition: 'stroke-dashoffset 0.8s ease-out',
              opacity: 0.8
            }}
          />
        )}
      </>
    );
  };

  // Prüfen ob irgendein Ring über 100% ist
  const hasOverachievement = totalPercent > 100 || gottesdienstPercent > 100 || gemeindePercent > 100;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px'
    }}>
      {/* SVG Rings */}
      <div style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Außenring - Gesamt */}
          <Ring
            radius={ringRadii[0]}
            percent={totalPercent}
            color={colors.total}
            colorDark={colors.totalDark}
          />

          {/* Mittlerer Ring - Gottesdienst */}
          <Ring
            radius={ringRadii[1]}
            percent={gottesdienstPercent}
            color={colors.gottesdienst}
            colorDark={colors.gottesdienstDark}
          />

          {/* Innenring - Gemeinde */}
          <Ring
            radius={ringRadii[2]}
            percent={gemeindePercent}
            color={colors.gemeinde}
            colorDark={colors.gemeindeDark}
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
            fontSize: size * 0.22,
            fontWeight: '800',
            lineHeight: 1
          }}>
            {totalPoints}
          </div>
        </div>
      </div>

      {/* Legende */}
      <div style={{
        display: 'flex',
        gap: '12px',
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
        <LegendItem
          color={colors.total}
          label="Gesamt"
          value={totalPoints}
          goal={effectiveTotalGoal}
          percent={totalPercent}
          hasGoal={gottesdienstGoal > 0 || gemeindeGoal > 0}
        />
        <LegendItem
          color={colors.gottesdienst}
          label="Gottesdienst"
          value={gottesdienstPoints}
          goal={effectiveGottesdienstGoal}
          percent={gottesdienstPercent}
          hasGoal={gottesdienstGoal > 0}
        />
        <LegendItem
          color={colors.gemeinde}
          label="Gemeinde"
          value={gemeindePoints}
          goal={effectiveGemeindeGoal}
          percent={gemeindePercent}
          hasGoal={gemeindeGoal > 0}
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
  percent: number;
  hasGoal?: boolean;
}> = ({ color, label, value, goal, percent, hasGoal = true }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '5px'
  }}>
    <div style={{
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      backgroundColor: color,
      boxShadow: `0 0 4px ${color}60`
    }} />
    <span style={{
      color: 'rgba(255, 255, 255, 0.9)',
      fontSize: '0.7rem'
    }}>
      {label}: <strong>{value}</strong>
      {hasGoal && `/${goal}`}
      {percent > 100 && (
        <span style={{ color: '#10b981', marginLeft: '4px' }}>
          ({Math.round(percent)}%)
        </span>
      )}
    </span>
  </div>
);

export default ActivityRings;
