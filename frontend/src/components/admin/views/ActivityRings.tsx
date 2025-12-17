import React from 'react';

interface ActivityRingsProps {
  // Aktuelle Werte
  totalPoints: number;
  gottesdienstPoints: number;
  gemeindePoints: number;
  // Zielwerte (für Prozentberechnung) - 0 bedeutet ausgeblendet
  gottesdienstGoal: number;
  gemeindeGoal: number;
  // Größe
  size?: number;
}

/**
 * Apple Health-Style Activity Rings mit Overachiever-Support
 *
 * - Wenn ein Ziel 0 ist, wird dieser Ring nicht angezeigt
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
  // Prüfen welche Ringe angezeigt werden sollen
  const showGottesdienst = gottesdienstGoal > 0;
  const showGemeinde = gemeindeGoal > 0;

  // Gesamtziel berechnet sich aus den aktiven Zielen
  const totalGoal = gottesdienstGoal + gemeindeGoal;
  const showTotal = totalGoal > 0;

  // Wenn nichts angezeigt werden soll, nichts rendern
  if (!showTotal) {
    return (
      <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.7)' }}>
        <div style={{ fontSize: '2rem', fontWeight: '800', color: 'white' }}>{totalPoints}</div>
        <div style={{ fontSize: '0.9rem' }}>Punkte</div>
      </div>
    );
  }

  // Prozent berechnen (kann über 100% gehen für Overachiever)
  const totalPercent = (totalPoints / totalGoal) * 100;
  const gottesdienstPercent = gottesdienstGoal > 0 ? (gottesdienstPoints / gottesdienstGoal) * 100 : 0;
  const gemeindePercent = gemeindeGoal > 0 ? (gemeindePoints / gemeindeGoal) * 100 : 0;

  // Overachiever Check
  const isOverachiever = totalPercent > 100;
  const overachievePercent = isOverachiever ? Math.min(totalPercent - 100, 100) : 0;

  // Ring-Parameter
  const center = size / 2;
  const strokeWidth = size * 0.075;
  const gap = strokeWidth * 0.5;

  // Zähle aktive Ringe für dynamische Radien-Berechnung
  const activeRings = [showTotal, showGottesdienst, showGemeinde].filter(Boolean).length;

  // Radien für die Ringe (von außen nach innen)
  const outerRadius = center - strokeWidth / 2 - 4;
  const overachieveRadius = outerRadius + strokeWidth + gap * 0.5; // Overachiever außen

  // Dynamische Radien basierend auf aktiven Ringen
  let ringRadii: number[] = [];
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

  // Ring-Index für Zuordnung
  let ringIndex = 0;

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
          {showTotal && (
            <Ring
              radius={ringRadii[ringIndex++]}
              percent={totalPercent}
              color={colors.total}
            />
          )}

          {/* Mittlerer Ring - Gottesdienst */}
          {showGottesdienst && (
            <Ring
              radius={ringRadii[ringIndex++]}
              percent={gottesdienstPercent}
              color={colors.gottesdienst}
            />
          )}

          {/* Innenring - Gemeinde */}
          {showGemeinde && (
            <Ring
              radius={ringRadii[ringIndex++]}
              percent={gemeindePercent}
              color={colors.gemeinde}
            />
          )}
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
            {isOverachiever ? 'Punkte' : `von ${totalGoal}`}
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
        {showTotal && (
          <LegendItem
            color={colors.total}
            label="Gesamt"
            value={totalPoints}
            goal={totalGoal}
          />
        )}
        {showGottesdienst && (
          <LegendItem
            color={colors.gottesdienst}
            label="Gottesdienst"
            value={gottesdienstPoints}
            goal={gottesdienstGoal}
          />
        )}
        {showGemeinde && (
          <LegendItem
            color={colors.gemeinde}
            label="Gemeinde"
            value={gemeindePoints}
            goal={gemeindeGoal}
          />
        )}
        {isOverachiever && (
          <LegendItem
            color={colors.overachieve}
            label="Bonus"
            value={totalPoints - totalGoal}
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
  isOverachieve?: boolean;
}> = ({ color, label, value, goal, isOverachieve }) => (
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
      {label}: <strong>{value}</strong>{!isOverachieve && goal > 0 && `/${goal}`}
    </span>
  </div>
);

export default ActivityRings;
