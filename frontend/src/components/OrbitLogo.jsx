/**
 * Orbit Logo Component
 *
 * A modern, minimal logo representing orbital motion and connectivity.
 * The design features a central dot with orbital rings, suggesting
 * everything in sync around a central system.
 */

const OrbitLogo = ({
  size = 40,
  variant = 'default', // 'default' | 'light' | 'dark' | 'icon'
  className = '',
  showText = true,
}) => {
  const colors = {
    default: {
      primary: '#1A1A1A',
      accent: '#22C55E',
      text: '#1A1A1A',
    },
    light: {
      primary: '#FFFFFF',
      accent: '#22C55E',
      text: '#FFFFFF',
    },
    dark: {
      primary: '#1A1A1A',
      accent: '#22C55E',
      text: '#1A1A1A',
    },
  };

  const color = colors[variant] || colors.default;
  const iconSize = size;
  const strokeWidth = size * 0.05;

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* Logo Icon */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer orbital ring */}
        <circle
          cx="20"
          cy="20"
          r="16"
          stroke={color.primary}
          strokeWidth={strokeWidth}
          strokeOpacity="0.2"
          fill="none"
        />

        {/* Middle orbital ring - tilted */}
        <ellipse
          cx="20"
          cy="20"
          rx="12"
          ry="16"
          transform="rotate(-30 20 20)"
          stroke={color.primary}
          strokeWidth={strokeWidth}
          strokeOpacity="0.4"
          fill="none"
        />

        {/* Inner orbital ring - tilted opposite */}
        <ellipse
          cx="20"
          cy="20"
          rx="8"
          ry="14"
          transform="rotate(30 20 20)"
          stroke={color.accent}
          strokeWidth={strokeWidth * 1.2}
          fill="none"
        />

        {/* Central core */}
        <circle
          cx="20"
          cy="20"
          r="4"
          fill={color.primary}
        />

        {/* Orbiting dot - accent */}
        <circle
          cx="32"
          cy="14"
          r="2.5"
          fill={color.accent}
        />
      </svg>

      {/* Logo Text */}
      {showText && (
        <span
          className="text-xl font-semibold tracking-tight"
          style={{ color: color.text, letterSpacing: '-0.02em' }}
        >
          Orbit
        </span>
      )}
    </div>
  );
};

// Simplified icon-only version for favicon/small uses
export const OrbitIcon = ({ size = 32, color = '#1A1A1A', accent = '#22C55E' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Outer ring */}
    <circle
      cx="16"
      cy="16"
      r="13"
      stroke={color}
      strokeWidth="1.5"
      strokeOpacity="0.2"
      fill="none"
    />

    {/* Middle orbital */}
    <ellipse
      cx="16"
      cy="16"
      rx="9"
      ry="13"
      transform="rotate(-30 16 16)"
      stroke={color}
      strokeWidth="1.5"
      strokeOpacity="0.4"
      fill="none"
    />

    {/* Inner orbital - accent */}
    <ellipse
      cx="16"
      cy="16"
      rx="6"
      ry="11"
      transform="rotate(30 16 16)"
      stroke={accent}
      strokeWidth="2"
      fill="none"
    />

    {/* Core */}
    <circle cx="16" cy="16" r="3" fill={color} />

    {/* Orbiting dot */}
    <circle cx="26" cy="10" r="2" fill={accent} />
  </svg>
);

// Animated version for hero sections
export const OrbitLogoAnimated = ({ size = 48, variant = 'default' }) => {
  const colors = {
    default: { primary: '#1A1A1A', accent: '#22C55E' },
    light: { primary: '#FFFFFF', accent: '#22C55E' },
  };
  const color = colors[variant] || colors.default;

  return (
    <div className="inline-flex items-center gap-3">
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="animate-spin-slow"
        style={{ animation: 'spin 20s linear infinite' }}
      >
        {/* Outer ring */}
        <circle
          cx="24"
          cy="24"
          r="20"
          stroke={color.primary}
          strokeWidth="1.5"
          strokeOpacity="0.15"
          fill="none"
        />

        {/* Middle orbital */}
        <ellipse
          cx="24"
          cy="24"
          rx="14"
          ry="20"
          transform="rotate(-30 24 24)"
          stroke={color.primary}
          strokeWidth="1.5"
          strokeOpacity="0.3"
          fill="none"
        />

        {/* Inner orbital - accent */}
        <ellipse
          cx="24"
          cy="24"
          rx="10"
          ry="17"
          transform="rotate(30 24 24)"
          stroke={color.accent}
          strokeWidth="2"
          fill="none"
        />

        {/* Core */}
        <circle cx="24" cy="24" r="5" fill={color.primary} />

        {/* Orbiting dot */}
        <circle cx="40" cy="16" r="3" fill={color.accent}>
          <animate
            attributeName="opacity"
            values="1;0.5;1"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>

      <span
        className="text-2xl font-semibold tracking-tight"
        style={{ color: color.primary, letterSpacing: '-0.02em' }}
      >
        Orbit
      </span>
    </div>
  );
};

export default OrbitLogo;
