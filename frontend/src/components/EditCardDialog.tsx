import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import { cardsApi } from '../services/api';
import type { Card } from '../services/api';

interface EditCardDialogProps {
  card: Card | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditCardDialog({ card, onClose, onSuccess }: EditCardDialogProps) {
  const [formData, setFormData] = useState<{
    type: 'phrase' | 'sentence' | '';
    target_text: string;
    target_meaning: string;
    context_sentence: string;
    context_translation: string;
    cloze_sentence: string;
  }>({
    type: '',
    target_text: '',
    target_meaning: '',
    context_sentence: '',
    context_translation: '',
    cloze_sentence: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (card) {
      setFormData({
        type: card.type,
        target_text: card.target_text,
        target_meaning: card.target_meaning,
        context_sentence: card.context_sentence,
        context_translation: card.context_translation,
        cloze_sentence: card.cloze_sentence,
      });
    }
  }, [card]);

  const handleSave = async () => {
    if (!card) return;

    setIsSaving(true);
    setError('');

    try {
      const updateData = {
        ...formData,
        type: formData.type || undefined,
      } as { type?: 'phrase' | 'sentence'; target_text: string; target_meaning: string; context_sentence: string; context_translation: string; cloze_sentence: string };
      await cardsApi.update(card.id, updateData);
      onSuccess();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Failed to update card');
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={!!card} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Card</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
            {error}
          </Alert>
        )}

        <FormControl fullWidth margin="normal" size="small">
          <InputLabel>Type</InputLabel>
          <Select
            value={formData.type}
            label="Type"
            onChange={(e) => updateField('type', e.target.value)}
          >
            <MenuItem value="phrase">Phrase</MenuItem>
            <MenuItem value="sentence">Sentence</MenuItem>
          </Select>
        </FormControl>

        <TextField
          fullWidth
          label="Target Text"
          value={formData.target_text}
          onChange={(e) => updateField('target_text', e.target.value)}
          margin="normal"
          size="small"
        />

        <TextField
          fullWidth
          label="Meaning (Chinese)"
          value={formData.target_meaning}
          onChange={(e) => updateField('target_meaning', e.target.value)}
          margin="normal"
          size="small"
        />

        <TextField
          fullWidth
          label="Context Sentence"
          value={formData.context_sentence}
          onChange={(e) => updateField('context_sentence', e.target.value)}
          margin="normal"
          size="small"
          multiline
        />

        <TextField
          fullWidth
          label="Context Translation (Chinese)"
          value={formData.context_translation}
          onChange={(e) => updateField('context_translation', e.target.value)}
          margin="normal"
          size="small"
          multiline
        />

        <TextField
          fullWidth
          label="Cloze Sentence"
          value={formData.cloze_sentence}
          onChange={(e) => updateField('cloze_sentence', e.target.value)}
          margin="normal"
          size="small"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
