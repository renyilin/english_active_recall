import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  CircularProgress,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  Paper,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import { cardsApi } from '../services/api';
import type { Card as CardType } from '../services/api';
import FlashcardDisplay from '../components/FlashcardDisplay';
import TagSelector from '../components/TagSelector';
import { primePlaybackAudio } from '../utils/audioPlayback';

const AUTO_FLIP_DELAY_MS = 3000;
const AUTO_ADVANCE_DELAY_MS = 9000;
const AUTO_REPEAT_COUNT = 2;

export default function StudyPage() {
  // Phase 1: Configuration state
  const [isConfiguring, setIsConfiguring] = useState(true);
  const [cardLimit, setCardLimit] = useState(50);
  const [strategy, setStrategy] = useState<'hardest' | 'random' | 'tag'>('hardest');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Phase 2: Study session state
  const [studyCards, setStudyCards] = useState<CardType[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [autoPlayRepeatCount, setAutoPlayRepeatCount] = useState(0);
  const [isAudioEnabled, setIsAudioEnabled] = useState(() => {
    return localStorage.getItem('autoPlayAudio') === 'true';
  });
  const [isAutoPlayEnabled, setIsAutoPlayEnabled] = useState(() => {
    return localStorage.getItem('autoPlayStudy') === 'true';
  });

  const handleAudioEnabledChange = useCallback((enabled: boolean) => {
    setIsAudioEnabled(enabled);
    localStorage.setItem('autoPlayAudio', String(enabled));
  }, []);

  const toggleAutoPlay = useCallback(() => {
    void primePlaybackAudio();
    setIsAutoPlayEnabled((prev) => {
      const nextValue = !prev;
      localStorage.setItem('autoPlayStudy', String(nextValue));
      return nextValue;
    });
  }, []);

  const handleStartStudy = async () => {
    void primePlaybackAudio();

    if (strategy === 'tag' && selectedTagIds.length === 0) {
      alert('Please select at least one tag');
      return;
    }

    setIsLoading(true);
    try {
      const tagIds = strategy === 'tag' ? selectedTagIds : undefined;
      const response = await cardsApi.getStudy(cardLimit, strategy, tagIds);
      setStudyCards(response.data);
      setCurrentIndex(0);
      setIsFlipped(false);
      setIsSessionComplete(false);
      setAutoPlayRepeatCount(0);
      setIsConfiguring(false);
    } catch (error) {
      console.error('Failed to fetch study cards:', error);
      alert('Failed to load study cards. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextCard = useCallback(() => {
    if (currentIndex < studyCards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
      setAutoPlayRepeatCount(0);
    } else {
      setIsSessionComplete(true);
    }
  }, [currentIndex, studyCards.length]);

  const handlePreviousCard = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
      setAutoPlayRepeatCount(0);
    }
  }, [currentIndex]);

  const handleStartNewSession = () => {
    setIsConfiguring(true);
    setStudyCards([]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsSessionComplete(false);
    setAutoPlayRepeatCount(0);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle arrow keys if we're in active study session
      if (isConfiguring || isLoading || isSessionComplete || studyCards.length === 0) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        handlePreviousCard();
      } else if (event.key === 'ArrowRight') {
        handleNextCard();
      } else if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        setIsFlipped((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePreviousCard, handleNextCard, isConfiguring, isLoading, isSessionComplete, studyCards.length]);

  useEffect(() => {
    if (!isAutoPlayEnabled || isConfiguring || isLoading || isSessionComplete || studyCards.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (isFlipped) {
        if (autoPlayRepeatCount < AUTO_REPEAT_COUNT - 1) {
          setIsFlipped(false);
          setAutoPlayRepeatCount((prev) => prev + 1);
          return;
        }

        handleNextCard();
        return;
      }

      setIsFlipped(true);
    }, isFlipped ? AUTO_ADVANCE_DELAY_MS : AUTO_FLIP_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [
    autoPlayRepeatCount,
    currentIndex,
    handleNextCard,
    isAutoPlayEnabled,
    isConfiguring,
    isFlipped,
    isLoading,
    isSessionComplete,
    studyCards.length,
  ]);

  const currentCard = studyCards[currentIndex];

  // Phase 1: Configuration Screen
  if (isConfiguring) {
    return (
      <Box sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
        <Typography variant="h4" gutterBottom>
          Study Mode
        </Typography>
        <Paper elevation={2} sx={{ p: 3 }}>
          <Stack spacing={3}>
            {/* Card Limit */}
            <TextField
              label="Number of cards"
              type="number"
              value={cardLimit}
              onChange={(e) => setCardLimit(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
              helperText="Default: 50 cards (1-100 range)"
              fullWidth
              inputProps={{ min: 1, max: 100 }}
            />

            {/* Strategy Selection */}
            <FormControl component="fieldset">
              <RadioGroup
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as 'hardest' | 'random' | 'tag')}
              >
                <FormControlLabel
                  value="hardest"
                  control={<Radio />}
                  label="Hardest cards"
                />
                <FormControlLabel
                  value="random"
                  control={<Radio />}
                  label="Random"
                />
                <FormControlLabel
                  value="tag"
                  control={<Radio />}
                  label="By tag"
                />
              </RadioGroup>
            </FormControl>

            {/* Tag Selector (conditional) */}
            {strategy === 'tag' && (
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Select tags to filter cards
                </Typography>
                <TagSelector
                  selectedTagIds={selectedTagIds}
                  onChange={setSelectedTagIds}
                />
              </Box>
            )}

            {/* Start Button */}
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrowIcon />}
              onClick={handleStartStudy}
              disabled={isLoading}
              fullWidth
            >
              {isLoading ? 'Loading...' : 'Start Study Session'}
            </Button>
          </Stack>
        </Paper>
      </Box>
    );
  }

  // Loading state
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

  // Session complete
  if (isSessionComplete) {
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
        <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
        <Typography variant="h4" gutterBottom>
          Session Complete!
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          You've reviewed {studyCards.length} {studyCards.length === 1 ? 'card' : 'cards'}
        </Typography>
        <Button
          variant="contained"
          startIcon={<PlayArrowIcon />}
          onClick={handleStartNewSession}
          size="large"
        >
          Start New Session
        </Button>
      </Box>
    );
  }

  // No cards found
  if (studyCards.length === 0) {
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
          No cards found
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          No cards match your selected criteria. Try different settings.
        </Typography>
        <Button
          variant="outlined"
          onClick={handleStartNewSession}
        >
          Back to Settings
        </Button>
      </Box>
    );
  }

  // Phase 2: Flashcard Viewer
  return (
    <Box sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      {/* Progress */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2 }}>
        <Typography variant="h5">Study Mode</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            label={`${currentIndex + 1} / ${studyCards.length}`}
            color="primary"
            variant="outlined"
          />
          <Tooltip title={isAutoPlayEnabled ? 'Pause autoplay' : 'Start autoplay'}>
            <Button
              variant={isAutoPlayEnabled ? 'contained' : 'outlined'}
              color={isAutoPlayEnabled ? 'success' : 'primary'}
              startIcon={isAutoPlayEnabled ? <PauseCircleOutlineIcon /> : <PlayCircleOutlineIcon />}
              onClick={toggleAutoPlay}
            >
              {isAutoPlayEnabled ? 'Auto On' : 'Auto Off'}
            </Button>
          </Tooltip>
        </Stack>
      </Box>

      {/* Flashcard with arrow navigation */}
      <Box sx={{ position: 'relative' }}>
        {/* Left arrow */}
        <IconButton
          onClick={handlePreviousCard}
          disabled={currentIndex === 0}
          sx={{
            position: 'absolute',
            left: -60,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10,
            bgcolor: 'background.paper',
            boxShadow: 2,
            '&:hover': {
              bgcolor: 'action.hover',
            },
            '&.Mui-disabled': {
              bgcolor: 'action.disabledBackground',
            },
          }}
          aria-label="Previous card"
        >
          <ArrowBackIcon />
        </IconButton>

        {/* Flashcard */}
        <FlashcardDisplay
          card={currentCard}
          isFlipped={isFlipped}
          onFlip={() => setIsFlipped(!isFlipped)}
          isAudioEnabled={isAudioEnabled}
          onAudioEnabledChange={handleAudioEnabledChange}
        />

        {/* Right arrow */}
        <IconButton
          onClick={handleNextCard}
          sx={{
            position: 'absolute',
            right: -60,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10,
            bgcolor: 'background.paper',
            boxShadow: 2,
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
          aria-label="Next card"
        >
          <ArrowForwardIcon />
        </IconButton>
      </Box>

    </Box>
  );
}
