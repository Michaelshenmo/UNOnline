import { Card as CardType } from '../types';

const colorMap: Record<string, string> = {
  red: '#e53935',
  yellow: '#fdd835',
  green: '#43a047',
  blue: '#1e88e5',
};

function getCardDisplay(card: CardType) {
  switch (card.type) {
    case 'number': return card.value;
    case 'skip': return '⊘';
    case 'reverse': return '⟳';
    case 'draw2': return '+2';
    case 'wild': return '★';
    case 'wild4': return '+4';
  }
}

interface CardProps {
  card: CardType;
  onClick?: () => void;
  disabled?: boolean;
  small?: boolean;
  hidden?: boolean;
}

export default function CardComponent({ card, onClick, disabled, small, hidden }: CardProps) {
  const bg = card.color ? colorMap[card.color] : '#212121';
  const textColor = card.color === 'yellow' ? '#333' : '#fff';
  const display = hidden ? '?' : getCardDisplay(card);
  const size = small ? { width: 64, height: 90, fontSize: 20 } : { width: 90, height: 130, fontSize: 28 };

  return (
    <div
      onClick={!disabled && onClick ? onClick : undefined}
      style={{
        ...size,
        background: bg,
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: onClick && !disabled ? 'pointer' : 'default',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s',
        transform: onClick && !disabled ? 'translateY(0)' : 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        color: textColor,
        fontWeight: 'bold',
        fontSize: size.fontSize,
        userSelect: 'none',
        position: 'relative',
        border: '2px solid rgba(255,255,255,0.1)',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (onClick && !disabled) {
          e.currentTarget.style.transform = 'translateY(-8px)';
          e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.4)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
      }}
    >
      <div style={{ position: 'absolute', top: 4, left: 6, fontSize: size.fontSize * 0.4 }}>{display}</div>
      <div>{display}</div>
      <div style={{ position: 'absolute', bottom: 4, right: 6, fontSize: size.fontSize * 0.4 }}>{display}</div>
    </div>
  );
}
