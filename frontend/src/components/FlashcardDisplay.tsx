import { Box, Typography, Card as MuiCard, CardContent, IconButton, Chip } from '@mui/material';
import { useState, useEffect, useCallback } from 'react';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import type { Card } from '../services/api';

interface FlashcardDisplayProps {
  card: Card;
  isFlipped: boolean;
  onFlip: () => void;
}

export default function FlashcardDisplay({ card, isFlipped, onFlip }: FlashcardDisplayProps) {
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(() => {
    return localStorage.getItem('autoPlayAudio') === 'true';
  });

  const toggleAutoPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newValue = !autoPlayEnabled;
    setAutoPlayEnabled(newValue);
    localStorage.setItem('autoPlayAudio', String(newValue));
  };

  const speakText = useCallback((text: string) => {
    // Cancel any ongoing speech first
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }, []);

  // Handle auto-play when flipped
  useEffect(() => {
    // Cancel speech when component unmounts or card changes
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [card]);

  useEffect(() => {
    if (isFlipped && autoPlayEnabled) {
      // Small timeout to ensure transition looks natural before audio starts
      const timer = setTimeout(() => {
        speakText(card.context_sentence);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isFlipped, autoPlayEnabled, card.context_sentence, speakText]);

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
        position: 'relative',
      }}
    >
      {/* Auto-play toggle - visible on both sides for easy access */}
      <IconButton
        onClick={toggleAutoPlay}
        size="small"
        color={autoPlayEnabled ? 'primary' : 'default'}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          opacity: 0.7,
          '&:hover': { opacity: 1 },
        }}
        title={autoPlayEnabled ? "Disable auto-play" : "Enable auto-play"}
      >
        <VolumeUpIcon />
        {!autoPlayEnabled && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '120%',
              height: '2px',
              bgcolor: 'text.disabled',
              transform: 'translate(-50%, -50%) rotate(-45deg)',
            }}
          />
        )}
      </IconButton>

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
