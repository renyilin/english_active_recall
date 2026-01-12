import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  IconButton,
  Chip,
  CircularProgress,
  Stack,
} from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import RefreshIcon from '@mui/icons-material/Refresh';
import { cardsApi } from '../services/api';
import type { Card as CardType } from '../services/api';

export default function StudyPage() {
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

  const handleReview = async (rating: 'forgot' | 'hard' | 'easy') => {
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

  const speakText = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    speechSynthesis.speak(utterance);
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
        <Typography variant="h5">Study Mode</Typography>
        <Chip
          label={`${currentIndex + 1} / ${dueCards.length}`}
          color="primary"
          variant="outlined"
        />
      </Box>

      {/* Flashcard */}
      <Card
        sx={{
          minHeight: 300,
          display: 'flex',
          flexDirection: 'column',
          cursor: 'pointer',
          transition: 'transform 0.3s',
          '&:hover': { transform: 'scale(1.01)' },
        }}
        onClick={() => setIsFlipped(!isFlipped)}
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
            label={currentCard.type}
            size="small"
            color={currentCard.type === 'phrase' ? 'primary' : 'secondary'}
            sx={{ mb: 2 }}
          />

          {!isFlipped ? (
            // Front of card
            currentCard.type === 'sentence' ? (
              // Sentence Mode: Show Chinese meaning
              <Box>
                <Typography variant="h5" gutterBottom>
                  {currentCard.target_meaning}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Speak the English sentence
                </Typography>
              </Box>
            ) : (
              // Phrase Mode: Show cloze + Chinese hint
              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  {currentCard.cloze_sentence}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Hint: {currentCard.target_meaning}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Speak the missing phrase
                </Typography>
              </Box>
            )
          ) : (
            // Back of card (Answer)
            <Box>
              <Typography variant="h5" color="primary" gutterBottom>
                {currentCard.target_text}
              </Typography>
              <Typography variant="body1" sx={{ mt: 2 }}>
                {currentCard.context_sentence}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {currentCard.context_translation}
              </Typography>
              <IconButton
                sx={{ mt: 2 }}
                onClick={(e) => {
                  e.stopPropagation();
                  speakText(currentCard.context_sentence);
                }}
                color="primary"
              >
                <VolumeUpIcon />
              </IconButton>
            </Box>
          )}
        </CardContent>
      </Card>

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
            onClick={() => handleReview('easy')}
            disabled={isReviewing}
            sx={{ flex: 1, maxWidth: 120 }}
          >
            Easy
          </Button>
        </Stack>
      )}
    </Box>
  );
}
