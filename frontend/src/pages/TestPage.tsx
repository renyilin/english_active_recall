import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Stack,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { cardsApi } from '../services/api';
import type { Card as CardType } from '../services/api';
import FlashcardDisplay from '../components/FlashcardDisplay';

export default function TestPage() {
  const [dueCards, setDueCards] = useState<CardType[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isReviewing, setIsReviewing] = useState(false);

  const fetchDueCards = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await cardsApi.getDue(50);
      setDueCards(response.data);
      setCurrentIndex(0);
      setIsFlipped(false);
    } catch (error) {
      console.error('Failed to fetch due cards:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDueCards();
  }, [fetchDueCards]);

  const currentCard = dueCards[currentIndex];

  const handleReview = async (rating: 'forgot' | 'hard' | 'remembered') => {
    if (!currentCard || isReviewing) return;

    setIsReviewing(true);
    try {
      await cardsApi.review(currentCard.id, rating);

      // Move to next card
      if (currentIndex < dueCards.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        setIsFlipped(false);
      } else {
        // No more cards
        setDueCards([]);
      }
    } catch (error) {
      console.error('Failed to review card:', error);
    } finally {
      setIsReviewing(false);
    }
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (dueCards.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
          textAlign: 'center',
          p: 3,
        }}
      >
        <Typography variant="h4" gutterBottom>
          All caught up!
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          No cards due for review right now. Add more cards or come back later.
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchDueCards}
        >
          Check Again
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      {/* Progress */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Test Mode</Typography>
        <Chip
          label={`${currentIndex + 1} / ${dueCards.length}`}
          color="primary"
          variant="outlined"
        />
      </Box>

      {/* Flashcard */}
      <FlashcardDisplay
        card={currentCard}
        isFlipped={isFlipped}
        onFlip={() => setIsFlipped(!isFlipped)}
      />

      {/* Tap to flip hint */}
      {!isFlipped && (
        <Typography
          variant="body2"
          color="text.secondary"
          align="center"
          sx={{ mt: 2 }}
        >
          Tap card to reveal answer
        </Typography>
      )}

      {/* Grading buttons */}
      {isFlipped && (
        <Stack direction="row" spacing={2} sx={{ mt: 3 }} justifyContent="center">
          <Button
            variant="contained"
            color="error"
            size="large"
            onClick={() => handleReview('forgot')}
            disabled={isReviewing}
            sx={{ flex: 1, maxWidth: 120 }}
          >
            Forgot
          </Button>
          <Button
            variant="contained"
            color="warning"
            size="large"
            onClick={() => handleReview('hard')}
            disabled={isReviewing}
            sx={{ flex: 1, maxWidth: 120 }}
          >
            Hard
          </Button>
          <Button
            variant="contained"
            color="success"
            size="large"
            onClick={() => handleReview('remembered')}
            disabled={isReviewing}
            sx={{ flex: 1, maxWidth: 120 }}
          >
            Remembered
          </Button>
        </Stack>
      )}
    </Box>
  );
}
