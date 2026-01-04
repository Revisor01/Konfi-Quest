import React, { useState, useEffect, useRef } from 'react';

interface ActivityRingsProps {
  totalPoints: number;
  gottesdienstPoints: number;
  gemeindePoints: number;
  gottesdienstGoal: number;
  gemeindeGoal: number;
  size?: number;
}

/**
 * Apple Health-Style Activity Rings mit Zeichnen-Animation
 * Die Ringe "zeichnen" sich von 0 bis zum Zielwert
 */
const ActivityRings: React.FC<ActivityRingsProps> = ({
  totalPoints,
  gottesdienstPoints,
  gemeindePoints,
  gottesdienstGoal,
  gemeindeGoal,
  size = 160
}) => {
  // Animierte Werte (starten bei 0)
  const [animatedValues, setAnimatedValues] = useState({
    total: 0,
    gottesdienst: 0,
    gemeinde: 0
  });

  // Ref für Animation Frame
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Zielwerte berechnen
  const effectiveGottesdienstGoal = gottesdienstGoal > 0 ? gottesdienstGoal : 10;
  const effectiveGemeindeGoal = gemeindeGoal > 0 ? gemeindeGoal : 10;
  const effectiveTotalGoal = effectiveGottesdienstGoal + effectiveGemeindeGoal;

  const targetPercents = {
    total: (totalPoints / effectiveTotalGoal) * 100,
    gottesdienst: (gottesdienstPoints / effectiveGottesdienstGoal) * 100,
    gemeinde: (gemeindePoints / effectiveGemeindeGoal) * 100
  };

  // Animation starten wenn Werte sich ändern
  useEffect(() => {
    // Reset auf 0
    setAnimatedValues({ total: 0, gottesdienst: 0, gemeinde: 0 });
    startTimeRef.current = null;

    // Kurze Verzögerung damit der Reset sichtbar wird
    const timeout = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (!startTimeRef.current) {
          startTimeRef.current = timestamp;
        }

        const elapsed = timestamp - startTimeRef.current;
        const duration = 1500; // 1.5 Sekunden Animation
        const progress = Math.min(elapsed / duration, 1);

        // Easing: ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);

        setAnimatedValues({
          total: targetPercents.total * eased,
          gottesdienst: targetPercents.gottesdienst * eased,
          gemeinde: targetPercents.gemeinde * eased
        });

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    }, 100);

    return () => {
      clearTimeout(timeout);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [totalPoints, gottesdienstPoints, gemeindePoints, targetPercents.total, targetPercents.gottesdienst, targetPercents.gemeinde]);

  // Ring-Parameter
  const center = size / 2;
  const strokeWidth = size * 0.075;
  const gap = strokeWidth * 0.5;
  const outerRadius = center - strokeWidth / 2 - 4;

  const ringRadii = [
    outerRadius,
    outerRadius - strokeWidth - gap,
    outerRadius - 2 * (strokeWidth + gap)
  ];

  // Farben
  const colors = {
    total: '#f59e0b',
    totalDark: '#b45309',
    gottesdienst: '#3b82f6',
    gottesdienstDark: '#1d4ed8',
    gemeinde: '#059669',
    gemeindeDark: '#047857',
    background: 'rgba(255, 255, 255, 0.12)'
  };

  // Ring Component
  const Ring: React.FC<{
    radius: number;
    percent: number;
    color: string;
    colorDark: string;
  }> = ({ radius, percent, color, colorDark }) => {
    const circumference = 2 * Math.PI * radius;

    // Erste Runde (max 100%)
    const firstRoundPercent = Math.min(percent, 100);
    const offset = circumference - (circumference * firstRoundPercent) / 100;

    // Zweite Runde (wenn >100%)
    const hasSecondRound = percent > 100;
    const secondRoundPercent = percent > 100 ? Math.min(percent - 100, 100) : 0;
    const secondCircumference = circumference * 0.97;
    const secondOffset = secondCircumference - (secondCircumference * secondRoundPercent) / 100;

    // Dritte Runde (wenn >200%)
    const hasThirdRound = percent > 200;
    const thirdRoundPercent = percent > 200 ? Math.min(percent - 200, 100) : 0;
    const thirdCircumference = circumference * 0.94;
    const thirdOffset = thirdCircumference - (thirdCircumference * thirdRoundPercent) / 100;

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

        {/* Erste Runde */}
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
            filter: `drop-shadow(0 0 6px ${color}50)`
          }}
        />

        {/* Zweite Runde (dunklere Farbe) */}
        {hasSecondRound && (
          <circle
            cx={center}
            cy={center}
            r={radius - strokeWidth * 0.15}
            fill="none"
            stroke={colorDark}
            strokeWidth={strokeWidth * 0.7}
            strokeLinecap="round"
            strokeDasharray={secondCircumference}
            strokeDashoffset={secondOffset}
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
              filter: `drop-shadow(0 0 4px ${colorDark}70)`
            }}
          />
        )}

        {/* Dritte Runde */}
        {hasThirdRound && (
          <circle
            cx={center}
            cy={center}
            r={radius - strokeWidth * 0.3}
            fill="none"
            stroke={colorDark}
            strokeWidth={strokeWidth * 0.4}
            strokeLinecap="round"
            strokeDasharray={thirdCircumference}
            strokeDashoffset={thirdOffset}
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
              opacity: 0.8
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
      <div style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Außenring - Gesamt */}
          <Ring
            radius={ringRadii[0]}
            percent={animatedValues.total}
            color={colors.total}
            colorDark={colors.totalDark}
          />

          {/* Mittlerer Ring - Gottesdienst */}
          <Ring
            radius={ringRadii[1]}
            percent={animatedValues.gottesdienst}
            color={colors.gottesdienst}
            colorDark={colors.gottesdienstDark}
          />

          {/* Innenring - Gemeinde */}
          <Ring
            radius={ringRadii[2]}
            percent={animatedValues.gemeinde}
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
          percent={targetPercents.total}
          hasGoal={gottesdienstGoal > 0 || gemeindeGoal > 0}
        />
        <LegendItem
          color={colors.gottesdienst}
          label="Gottesdienst"
          value={gottesdienstPoints}
          goal={effectiveGottesdienstGoal}
          percent={targetPercents.gottesdienst}
          hasGoal={gottesdienstGoal > 0}
        />
        <LegendItem
          color={colors.gemeinde}
          label="Gemeinde"
          value={gemeindePoints}
          goal={effectiveGemeindeGoal}
          percent={targetPercents.gemeinde}
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
