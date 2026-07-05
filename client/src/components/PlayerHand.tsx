import CardComponent from './Card';
import { Card } from '../types';

interface PlayerHandProps {
  cards: Card[];
  onPlayCard: (index: number) => void;
  disabled: boolean;
}

export default function PlayerHand({ cards, onPlayCard, disabled }: PlayerHandProps) {
  return (
    <div style={{
      display: 'flex',
      gap: 8,
      justifyContent: 'center',
      flexWrap: 'wrap',
      padding: '12px 0',
    }}>
      {cards.map((card, i) => (
        <CardComponent
          key={`${card.type}-${card.color}-${card.value}-${i}`}
          card={card}
          onClick={() => onPlayCard(i)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
