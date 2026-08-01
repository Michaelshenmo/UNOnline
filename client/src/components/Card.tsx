import { Card as CardType, FlipCardPair } from '../types';

const colorMap: Record<string, string> = {
  red: '#e53935', yellow: '#fdd835', green: '#43a047', blue: '#1e88e5',
  orange: '#ff6d00', purple: '#aa00ff', pink: '#e91e88', teal: '#00bcd4',
};

function getCardDisplay(card: CardType) {
  switch (card.type) {
    case 'number': return card.value;
    case 'skip': return '⊘';
    case 'reverse': return '⟳';
    case 'draw2': return '+2';
    case 'draw4': return '+4';
    case 'draw1': return '+1';
    case 'draw5': return '+5';
    case 'wild2': return '+2';
    case 'wild4': return '+4';
    case 'wild_rev4': return '⟲+4';
    case 'wild6': return '+6';
    case 'wild10': return '+10';
    case 'discard_all': return 'DISCARD';
    case 'wild_wheel': return 'COLOR';
    case 'wild': return '★';
    case 'flip': return '⟷';
  }
}

function resolveCard(card: CardType | FlipCardPair, suit: 'light' | 'dark', flipped: boolean): CardType {
  if ('light' in card && 'dark' in card) {
    const side = flipped ? (suit === 'light' ? 'dark' : 'light') : suit;
    return (card as FlipCardPair)[side];
  }
  return card as CardType;
}

interface CardProps {
  card: CardType | FlipCardPair;
  onClick?: () => void;
  disabled?: boolean;
  small?: boolean;
  hidden?: boolean;
  suit?: 'light' | 'dark';
  previewFlip?: boolean;
}

export default function CardComponent({ card, onClick, disabled, small, hidden, suit, previewFlip }: CardProps) {
  const displayCard = resolveCard(card, suit || 'light', previewFlip || false);
  const isFlipPair = 'light' in card && 'dark' in card;
  const side = isFlipPair ? (previewFlip ? (suit === 'light' ? 'dark' : 'light') : suit) : null;

  const bg = displayCard.color ? colorMap[displayCard.color] : '#212121';
  const textColor = displayCard.color === 'yellow' || displayCard.color === 'teal' ? '#333' : '#fff';
  const display = hidden ? '?' : getCardDisplay(displayCard);
  const size = small ? { width: 64, height: 90, fontSize: 20 } : { width: 90, height: 130, fontSize: 28 };
  const borderColor = side === 'dark' ? '#111' : side === 'light' ? '#fff' : 'rgba(255,255,255,0.2)';
  const borderWidth = side ? 2.5 : 2;

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
        border: `${borderWidth}px solid ${borderColor}`,
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
