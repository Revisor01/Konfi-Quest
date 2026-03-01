import React from 'react';
import { IonIcon } from '@ionic/react';

interface SectionHeaderProps {
  title: string;
  subtitle: string;
  icon: string;
  preset?: 'events' | 'activities' | 'konfis' | 'users' | 'organizations' | 'badges' | 'requests' | 'jahrgang';
  colors?: { primary: string; secondary: string };
  stats: Array<{ value: number; label: string }>;
}

const PRESET_COLORS: Record<string, { primary: string; secondary: string }> = {
  events: { primary: '#dc2626', secondary: '#b91c1c' },
  activities: { primary: '#059669', secondary: '#047857' },
  konfis: { primary: '#5b21b6', secondary: '#4c1d95' },
  users: { primary: '#667eea', secondary: '#5a67d8' },
  organizations: { primary: '#2dd36f', secondary: '#28ba62' },
  badges: { primary: '#f59e0b', secondary: '#d97706' },
  requests: { primary: '#5b21b6', secondary: '#4c1d95' },
  jahrgang: { primary: '#007aff', secondary: '#0066d6' },
};

// Hilfsfunktion: HEX zu RGB-String fuer rgba()
const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0, 0, 0';
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
};

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  icon,
  preset,
  colors,
  stats,
}) => {
  const resolvedColors = preset ? PRESET_COLORS[preset] : colors;
  const primary = resolvedColors?.primary || '#667eea';
  const secondary = resolvedColors?.secondary || '#5a67d8';

  return (
    <div
      className="app-header-banner"
      style={{
        background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
        boxShadow: `0 8px 32px rgba(${hexToRgb(primary)}, 0.25)`,
      }}
    >
      {/* Dekorative Kreise */}
      <div className="app-header-banner__circle-top" />
      <div className="app-header-banner__circle-bottom" />

      {/* Header mit Icon und Titel */}
      <div className="app-header-banner__header">
        <div className="app-header-banner__icon">
          <IonIcon icon={icon} />
        </div>
        <div>
          <h2 className="app-header-banner__title">{title}</h2>
          <p className="app-header-banner__subtitle">{subtitle}</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="app-stats-row">
        {stats.map((stat, index) => (
          <div key={index} className="app-stats-row__item">
            <div className="app-stats-row__value">{stat.value}</div>
            <div className="app-stats-row__label">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SectionHeader;
