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
 * Apple Health-Style Activity Rings mit Overachiever-Support
 *
 * - Alle Ringe werden immer angezeigt (motiviert mehr zu sammeln)
 * - Wenn ein Ziel 0 ist, zeigt der Ring die Punkte ohne Limit (dreht weiter)
 * - Der Gesamtwert berechnet sich automatisch aus godi + gemeinde
 * - Bei Übererfüllung (>100%) wird ein zweiter äußerer Ring gezeigt
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

  // Prozent berechnen (kann über 100% gehen für Overachiever)
  const totalPercent = (totalPoints / effectiveTotalGoal) * 100;
  const gottesdienstPercent = (gottesdienstPoints / effectiveGottesdienstGoal) * 100;
  const gemeindePercent = (gemeindePoints / effectiveGemeindeGoal) * 100;

  // Overachiever Check
  const isOverachiever = totalPercent > 100;
  const overachievePercent = isOverachiever ? Math.min(totalPercent - 100, 100) : 0;

  // Ring-Parameter
  const center = size / 2;
  const strokeWidth = size * 0.075;
  const gap = strokeWidth * 0.5;

  // Alle 3 Ringe werden immer angezeigt
  const activeRings = 3;

  // Radien für die Ringe (von außen nach innen)
  const outerRadius = center - strokeWidth / 2 - 4;
  const overachieveRadius = outerRadius + strokeWidth + gap * 0.5; // Overachiever außen

  // Feste Radien für alle 3 Ringe
  const ringRadii: number[] = [];
  let currentRadius = outerRadius;
  for (let i = 0; i < activeRings; i++) {
    ringRadii.push(currentRadius);
    currentRadius -= strokeWidth + gap;
  }

  // Farben - Außenring jetzt gold/orange statt lila für besseren Kontrast
  const colors = {
    total: '#f59e0b',        // Gold/Orange - Gesamtpunkte (besser sichtbar)
    overachieve: '#10b981',  // Smaragd-Grün - Overachiever
    gottesdienst: '#3b82f6', // Blau - Gottesdienst
    gemeinde: '#22c55e',     // Grün - Gemeinde
    background: 'rgba(255, 255, 255, 0.12)'
  };

  // Ring Component mit Overachiever-Support
  const Ring: React.FC<{
    radius: number;
    percent: number;
    color: string;
    isOverachieve?: boolean;
  }> = ({ radius, percent, color, isOverachieve = false }) => {
    const circumference = 2 * Math.PI * radius;
    // Bei normalem Ring maximal 100%, bei Overachieve den tatsächlichen Wert
    const displayPercent = isOverachieve ? percent : Math.min(percent, 100);
    const offset = circumference - (circumference * displayPercent) / 100;

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
        {displayPercent > 0 && (
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
              transition: 'stroke-dashoffset 0.8s ease-out',
              filter: `drop-shadow(0 0 6px ${color}50)`
            }}
          />
        )}
      </>
    );
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px'
    }}>
      {/* SVG Rings */}
      <div style={{ position: 'relative', width: size + (isOverachiever ? 30 : 0), height: size + (isOverachiever ? 30 : 0) }}>
        <svg
          width={size + (isOverachiever ? 30 : 0)}
          height={size + (isOverachiever ? 30 : 0)}
          style={{
            transform: isOverachiever ? 'translate(15px, 15px)' : undefined
          }}
        >
          {/* Overachiever Ring (ganz außen) */}
          {isOverachiever && (
            <Ring
              radius={overachieveRadius}
              percent={overachievePercent}
              color={colors.overachieve}
              isOverachieve={true}
            />
          )}

          {/* Außenring - Gesamt */}
          <Ring
            radius={ringRadii[0]}
            percent={totalPercent}
            color={colors.total}
          />

          {/* Mittlerer Ring - Gottesdienst */}
          <Ring
            radius={ringRadii[1]}
            percent={gottesdienstPercent}
            color={colors.gottesdienst}
          />

          {/* Innenring - Gemeinde */}
          <Ring
            radius={ringRadii[2]}
            percent={gemeindePercent}
            color={colors.gemeinde}
          />
        </svg>

        {/* Zentrale Anzeige */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) ${isOverachiever ? 'translate(15px, 15px)' : ''}`,
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
            fontSize: size * 0.075,
            opacity: 0.8,
            marginTop: '2px'
          }}>
            {isOverachiever ? 'Punkte' : `von ${effectiveTotalGoal}`}
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
          hasGoal={gottesdienstGoal > 0 || gemeindeGoal > 0}
        />
        <LegendItem
          color={colors.gottesdienst}
          label="Gottesdienst"
          value={gottesdienstPoints}
          goal={effectiveGottesdienstGoal}
          hasGoal={gottesdienstGoal > 0}
        />
        <LegendItem
          color={colors.gemeinde}
          label="Gemeinde"
          value={gemeindePoints}
          goal={effectiveGemeindeGoal}
          hasGoal={gemeindeGoal > 0}
        />
        {isOverachiever && (
          <LegendItem
            color={colors.overachieve}
            label="Bonus"
            value={totalPoints - effectiveTotalGoal}
            goal={0}
            isOverachieve={true}
          />
        )}
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
  hasGoal?: boolean;
  isOverachieve?: boolean;
}> = ({ color, label, value, goal, hasGoal = true, isOverachieve }) => (
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
      {label}: <strong>{value}</strong>{!isOverachieve && hasGoal && `/${goal}`}
    </span>
  </div>
);

export default ActivityRings;
