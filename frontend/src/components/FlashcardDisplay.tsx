import { Box, Typography, Card as MuiCard, CardContent, IconButton, Chip } from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import type { Card } from '../services/api';

interface FlashcardDisplayProps {
  card: Card;
  isFlipped: boolean;
  onFlip: () => void;
}

export default function FlashcardDisplay({ card, isFlipped, onFlip }: FlashcardDisplayProps) {
  const speakText = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    speechSynthesis.speak(utterance);
  };

  return (
    <MuiCard
      sx={{
        minHeight: 300,
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'transform 0.3s',
        '&:hover': { transform: 'scale(1.01)' },
        backgroundColor: isFlipped ? '#f8f7ff' : undefined,
      }}
      onClick={onFlip}
    >
      <CardContent
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          p: 4,
        }}
      >
        <Chip
          label={card.type}
          size="small"
          color={card.type === 'phrase' ? 'primary' : 'secondary'}
          sx={{ mb: 2 }}
        />

        {!isFlipped ? (
          // Front of card
          card.type === 'sentence' ? (
            // Sentence Mode: Show Chinese meaning
            <Box>
              <Typography variant="h5" gutterBottom>
                {card.target_meaning}
              </Typography>
            </Box>
          ) : (
            // Phrase Mode: Show cloze + Chinese hint
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {card.cloze_sentence}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Hint: {card.target_meaning}
              </Typography>
            </Box>
          )
        ) : (
          // Back of card (Answer)
          <Box>
            <Typography variant="h5" color="primary" gutterBottom>
              {card.target_text}
            </Typography>
            <Typography variant="body1" sx={{ mt: 2 }}>
              {card.context_sentence}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {card.context_translation}
            </Typography>
            <IconButton
              sx={{ mt: 2 }}
              onClick={(e) => {
                e.stopPropagation();
                speakText(card.context_sentence);
              }}
              color="primary"
            >
              <VolumeUpIcon />
            </IconButton>
          </Box>
        )}
      </CardContent>
    </MuiCard>
  );
}
