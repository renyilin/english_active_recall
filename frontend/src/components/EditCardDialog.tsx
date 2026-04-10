import { useState, useEffect } from 'react';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DeleteIcon from '@mui/icons-material/Delete';
import { cardsApi, generateApi } from '../services/api';
import type { Card, CardUpdate } from '../services/api';
import TagSelector from './TagSelector';

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
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
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
      setSelectedTagIds(card.tags?.map((tag) => tag.id) || []);
    }
  }, [card]);

  const handleSave = async () => {
    if (!card) return;

    setIsSaving(true);
    setError('');

    try {
      const updateData: CardUpdate = {
        type: formData.type || undefined,
        target_text: formData.target_text,
        target_meaning: formData.target_meaning,
        context_sentence: formData.context_sentence,
        context_translation: formData.context_translation,
        cloze_sentence: formData.cloze_sentence,
        tag_ids: selectedTagIds,
      };
      await cardsApi.update(card.id, updateData);
      onSuccess();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to update card'));
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const getApiErrorMessage = (err: unknown, fallback: string) => {
    const response = err as {
      response?: {
        data?: {
          detail?: string | Array<{ msg?: string }>;
        };
      };
    };
    const detail = response.response?.data?.detail;
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => item.msg)
        .filter((msg): msg is string => !!msg);
      return messages.length > 0 ? messages.join('; ') : fallback;
    }
    return detail || fallback;
  };

  const buildGenerationPrompt = () => {
    const targetText = formData.target_text.trim();
    const targetMeaning = formData.target_meaning.trim();
    const contextSentence = formData.context_sentence.trim();

    const lines = [
      `Generate flashcard data for this English item.`,
      `target_text: ${targetText}`,
    ];

    if (targetMeaning) {
      lines.push(`target_meaning: ${targetMeaning}`);
    }

    if (contextSentence) {
      lines.push(`context_sentence: ${contextSentence}`);
    }

    lines.push(
      'Rules:',
      '- If target_meaning is provided, use it as the primary meaning hint and generate the other fields from target_text + target_meaning.',
      '- If context_sentence is provided, generate context_translation and cloze_sentence from target_text, target_meaning, and context_sentence.',
      '- If the type is phrase, keep target_text in sentence-style casing and do not capitalize the first letter unless capitalization is necessary for a proper noun, acronym, or other valid reason.',
      '- Return JSON only.',
    );

    return lines.join('\n');
  };

  const handleAIGenerate = async () => {
    if (!formData.target_text.trim()) return;

    setIsGenerating(true);
    setError('');

    try {
      const response = await generateApi.generate(buildGenerationPrompt());
      const data = response.data;
      setFormData((prev) => ({
        ...prev,
        type: data.type || prev.type,
        target_meaning: data.target_meaning || prev.target_meaning,
        context_sentence: data.context_sentence || prev.context_sentence,
        context_translation: data.context_translation || prev.context_translation,
        cloze_sentence: data.cloze_sentence || prev.cloze_sentence,
      }));
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to generate card data'));
    } finally {
      setIsGenerating(false);
    }
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

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 2 }}>
          <TextField
            fullWidth
            label="Meaning (Chinese)"
            value={formData.target_meaning}
            onChange={(e) => updateField('target_meaning', e.target.value)}
            size="small"
          />
          <IconButton
            onClick={handleAIGenerate}
            disabled={!formData.target_text.trim() || isGenerating}
            color="primary"
          >
            {isGenerating ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mt: 2 }}>
          <TextField
            fullWidth
            label="Context Sentence"
            value={formData.context_sentence}
            onChange={(e) => updateField('context_sentence', e.target.value)}
            size="small"
            multiline
          />
          <IconButton
            aria-label="clear context sentence"
            onClick={() => updateField('context_sentence', '')}
            disabled={!formData.context_sentence.trim()}
            color="error"
            sx={{ mt: 0.5 }}
          >
            <DeleteIcon />
          </IconButton>
        </Box>

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

        <TagSelector
          selectedTagIds={selectedTagIds}
          onChange={setSelectedTagIds}
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
