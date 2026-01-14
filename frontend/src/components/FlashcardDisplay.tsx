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

  const renderCardContent = (side: 'front' | 'back') => (
    <CardContent
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        p: 4,
        height: '100%', // Ensure content takes full height
      }}
    >
      <Chip
        label={card.type}
        size="small"
        color={card.type === 'phrase' ? 'primary' : 'secondary'}
        sx={{ mb: 2 }}
      />

      {side === 'front' ? (
        // Front Content
        card.type === 'sentence' ? (
          <Box>
            <Typography variant="h5" gutterBottom>
              {card.target_meaning}
            </Typography>
          </Box>
        ) : (
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
        // Back Content
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
  );

  return (
    <Box
      sx={{
        perspective: '1000px',
        width: '100%',
        minHeight: 300, // Keep minHeight on container
        cursor: 'pointer',
      }}
      onClick={onFlip}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transition: 'transform 0.6s',
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(-180deg)' : 'rotateY(0deg)',
          display: 'grid',
          gridTemplateColumns: '1fr',
        }}
      >
        {/* Front Face */}
        <MuiCard
          sx={{
            gridArea: '1 / 1',
            backfaceVisibility: 'hidden',
            // transform: 'rotateY(0deg)', // Optional, implied
            minHeight: 300,
            display: 'flex',
            flexDirection: 'column',
            width: '100%', // Ensure card fills grid cell
          }}
        >
          {renderCardContent('front')}
        </MuiCard>

        {/* Back Face */}
        <MuiCard
          sx={{
            gridArea: '1 / 1',
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            backgroundColor: '#f8f7ff',
            minHeight: 300,
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
          }}
        >
          {renderCardContent('back')}
        </MuiCard>
      </Box>
    </Box>
  );
}
