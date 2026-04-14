import { Box, Typography, Card as MuiCard, CardContent, IconButton, Chip } from '@mui/material';
import { useEffect, useCallback, useRef } from 'react';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import type { Card } from '../services/api';
import { ttsApi } from '../services/api';

interface FlashcardDisplayProps {
  card: Card;
  isFlipped: boolean;
  onFlip: () => void;
  isAudioEnabled: boolean;
  onAudioEnabledChange: (enabled: boolean) => void;
}

export default function FlashcardDisplay({
  card,
  isFlipped,
  onFlip,
  isAudioEnabled,
  onAudioEnabledChange,
}: FlashcardDisplayProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Map<string, string>>(new Map()); // text -> blob URL
  const pendingAudioRef = useRef<Map<string, Promise<string>>>(new Map());
  const playbackRequestIdRef = useRef(0);

  const toggleAutoPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAudioEnabledChange(!isAudioEnabled);
  };

  const stopAudio = useCallback(() => {
    playbackRequestIdRef.current += 1;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    window.speechSynthesis.cancel();
  }, []);

  const getAudioUrl = useCallback(async (text: string) => {
    const cachedAudioUrl = audioCacheRef.current.get(text);
    if (cachedAudioUrl) {
      return cachedAudioUrl;
    }

    const pendingRequest = pendingAudioRef.current.get(text);
    if (pendingRequest) {
      return pendingRequest;
    }

    const audioRequest = ttsApi.generateAudio(text)
      .then((blob) => {
        const audioUrl = URL.createObjectURL(blob);
        audioCacheRef.current.set(text, audioUrl);
        pendingAudioRef.current.delete(text);
        return audioUrl;
      })
      .catch((error) => {
        pendingAudioRef.current.delete(text);
        throw error;
      });

    pendingAudioRef.current.set(text, audioRequest);
    return audioRequest;
  }, []);

  const speakText = useCallback(async (text: string) => {
    const requestId = playbackRequestIdRef.current + 1;

    try {
      // Stop any currently playing audio
      stopAudio();
      const audioUrl = await getAudioUrl(text);

      // Ignore stale async completions after the card/view state has changed.
      if (playbackRequestIdRef.current !== requestId) {
        return;
      }

      // Play audio
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      await audio.play();

      if (playbackRequestIdRef.current !== requestId) {
        audio.pause();
        audio.currentTime = 0;
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
      }
    } catch (error) {
      if (playbackRequestIdRef.current !== requestId) {
        return;
      }

      console.error('Failed to play audio:', error);
      // Fallback to Web Speech API if TTS fails
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  }, [getAudioUrl, stopAudio]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    const audioCache = audioCacheRef.current;

    return () => {
      stopAudio();
      pendingAudioRef.current.clear();
      audioCache.forEach((url) => URL.revokeObjectURL(url));
      audioCache.clear();
    };
  }, [stopAudio]);

  // Stop audio when navigating away from a revealed answer or to a new card.
  useEffect(() => {
    if (!isFlipped) {
      stopAudio();
    }
  }, [card.id, isFlipped, stopAudio]);

  // Handle auto-play when flipped
  useEffect(() => {
    if (isFlipped && isAudioEnabled) {
      const timer = setTimeout(() => {
        speakText(card.context_sentence);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isFlipped, isAudioEnabled, card.context_sentence, speakText]);

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
        color={isAudioEnabled ? 'primary' : 'default'}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          opacity: 0.7,
          '&:hover': { opacity: 1 },
        }}
        title={isAudioEnabled ? 'Disable voice auto-play' : 'Enable voice auto-play'}
      >
        <VolumeUpIcon />
        {!isAudioEnabled && (
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
