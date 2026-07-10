import CardComponent from './Card';
import { Card, FlipCardPair } from '../types';

interface PlayerHandProps {
  cards: (Card | FlipCardPair)[];
  onPlayCard: (index: number) => void;
  disabled: boolean;
  suit?: 'light' | 'dark';
  previewFlip?: boolean;
}

export default function PlayerHand({ cards, onPlayCard, disabled, suit, previewFlip }: PlayerHandProps) {
  return (
    <div style={{
      display: 'flex',
      gap: 8,
      justifyContent: 'center',
      flexWrap: 'wrap',
      padding: '12px 0',
    }}>
      {cards.map((card, i) => {
        const key = 'light' in card ? `flip-${(card as FlipCardPair).light.color}-${(card as FlipCardPair).light.value}-${i}` : `card-${(card as Card).type}-${(card as Card).color}-${(card as Card).value}-${i}`;
        return (
          <CardComponent
            key={key}
            card={card}
            onClick={() => onPlayCard(i)}
            disabled={disabled}
            suit={suit}
            previewFlip={previewFlip}
          />
        );
      })}
    </div>
  );
}
