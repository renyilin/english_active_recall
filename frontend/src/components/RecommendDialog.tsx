import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  CircularProgress,
  Alert,
  Typography,
  Checkbox,
  Card,
  CardContent,
  CardActionArea,
  Chip,
} from '@mui/material';
import { generateApi, cardsApi, tagsApi } from '../services/api';
import type { Card as CardType, GenerateResponse } from '../services/api';

interface RecommendDialogProps {
  card: CardType | null;
  existingTexts: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function RecommendDialog({
  card,
  existingTexts,
  onClose,
  onSuccess,
}: RecommendDialogProps) {
  const [recommendations, setRecommendations] = useState<GenerateResponse[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (card) {
      fetchRecommendations();
    }
    return () => {
      setRecommendations([]);
      setSelected(new Set());
      setError('');
      setSuccessMsg('');
    };
  }, [card]);

  const fetchRecommendations = async () => {
    if (!card) return;
    setLoading(true);
    setError('');
    setSuccessMsg('');
    setRecommendations([]);
    setSelected(new Set());
    try {
      const res = await generateApi.recommend(card.target_text, existingTexts);
      setRecommendations(res.data.recommendations);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to get recommendations';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleAddSelected = async () => {
    if (selected.size === 0) return;
    setAdding(true);
    setError('');
    setSuccessMsg('');

    try {
      // Resolve tags: get or create each tag name
      const allTags = await tagsApi.list();
      const tagMap = new Map<string, string>();
      for (const tag of allTags.data.items) {
        tagMap.set(tag.name.toLowerCase(), tag.id);
      }

      let addedCount = 0;
      for (const index of selected) {
        const rec = recommendations[index];
        const tagIds: string[] = [];
        for (const tagName of rec.tags || []) {
          const key = tagName.toLowerCase();
          if (tagMap.has(key)) {
            tagIds.push(tagMap.get(key)!);
          } else {
            const created = await tagsApi.create({ name: tagName });
            tagMap.set(key, created.data.id);
            tagIds.push(created.data.id);
          }
        }

        await cardsApi.create({
          type: rec.type,
          target_text: rec.target_text,
          target_meaning: rec.target_meaning,
          context_sentence: rec.context_sentence,
          context_translation: rec.context_translation,
          cloze_sentence: rec.cloze_sentence,
          tag_ids: tagIds,
        });
        addedCount++;
      }

      setSuccessMsg(`Added ${addedCount} card${addedCount > 1 ? 's' : ''} to library`);
      setSelected(new Set());
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add cards';
      setError(msg);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog open={!!card} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Recommended Phrases
        {card && (
          <Typography variant="body2" color="text.secondary">
            Related to: <strong>{card.target_text}</strong>
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {successMsg && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {successMsg}
          </Alert>
        )}

        {!loading && recommendations.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {recommendations.map((rec, index) => (
              <Card
                key={index}
                variant="outlined"
                sx={{
                  borderColor: selected.has(index) ? 'primary.main' : 'divider',
                  borderWidth: selected.has(index) ? 2 : 1,
                }}
              >
                <CardActionArea onClick={() => toggleSelect(index)}>
                  <CardContent sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                    <Checkbox
                      checked={selected.has(index)}
                      sx={{ p: 0, mt: 0.5 }}
                      tabIndex={-1}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {rec.target_text}
                        </Typography>
                        <Chip
                          label={rec.type}
                          size="small"
                          color={rec.type === 'phrase' ? 'primary' : 'secondary'}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        {rec.target_meaning}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 0.25 }}>
                        {rec.context_sentence}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {rec.context_translation}
                      </Typography>
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        )}

        {!loading && recommendations.length === 0 && !error && !card && (
          <Typography color="text.secondary">No recommendations available.</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={fetchRecommendations} disabled={loading}>
          Refresh
        </Button>
        <Button
          variant="contained"
          onClick={handleAddSelected}
          disabled={selected.size === 0 || adding}
          startIcon={adding ? <CircularProgress size={16} /> : undefined}
        >
          Add Selected ({selected.size})
        </Button>
      </DialogActions>
    </Dialog>
  );
}
