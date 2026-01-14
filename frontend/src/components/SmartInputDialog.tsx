import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  CircularProgress,
  Alert,
  Typography,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { generateApi, cardsApi, tagsApi } from '../services/api';
import type { CardCreate, Tag } from '../services/api';
import TagSelector from './TagSelector';

interface SmartInputDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface GeneratedData {
  type: 'phrase' | 'sentence';
  target_text: string;
  target_meaning: string;
  context_sentence: string;
  context_translation: string;
  cloze_sentence: string;
  tags?: string[];
}

export default function SmartInputDialog({ open, onClose, onSuccess }: SmartInputDialogProps) {
  const [inputText, setInputText] = useState('');
  const [generatedData, setGeneratedData] = useState<GeneratedData | null>(null);
  const [editedData, setEditedData] = useState<GeneratedData | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[] | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!inputText.trim()) return;

    setIsGenerating(true);
    setError('');

    try {
      const response = await generateApi.generate(inputText.trim());
      const data: GeneratedData = response.data;
      setGeneratedData(data);
      setEditedData(data);

      if (data.tags && data.tags.length > 0) {
        try {
          // fetch all existing tags
          const tagsResponse = await tagsApi.list();
          let allTags = tagsResponse.data.items;
          const newTagIds: string[] = [];

          for (const tagName of data.tags) {
            const existingTag = allTags.find(
              (t) => t.name.toLowerCase() === tagName.toLowerCase()
            );

            if (existingTag) {
              newTagIds.push(existingTag.id);
            } else {
              try {
                const newTagResponse = await tagsApi.create({ name: tagName });
                const newTag = newTagResponse.data;
                newTagIds.push(newTag.id);
                allTags = [...allTags, newTag];
              } catch (createErr) {
                console.error(`Failed to create tag ${tagName}:`, createErr);
              }
            }
          }
          setAvailableTags(allTags);
          setSelectedTagIds(newTagIds);
        } catch (tagErr) {
          console.error('Failed to process generated tags:', tagErr);
        }
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Failed to generate card data');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!editedData) return;

    setIsSaving(true);
    setError('');

    try {
      const cardData: CardCreate = {
        ...editedData,
        tag_ids: selectedTagIds,
      };
      await cardsApi.create(cardData);
      handleClose();
      onSuccess();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Failed to save card');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setInputText('');
    setGeneratedData(null);
    setEditedData(null);
    setSelectedTagIds([]);
    setError('');
    onClose();
  };

  const updateField = (field: keyof GeneratedData, value: string) => {
    if (editedData) {
      setEditedData({ ...editedData, [field]: value });
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesomeIcon color="primary" />
          Smart Input
        </Box>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!generatedData ? (
          // Input Stage
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Enter a phrase or sentence and let AI generate learning data for you.
            </Typography>
            <TextField
              fullWidth
              label="Enter phrase or sentence"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g., call it a day"
              multiline
              rows={2}
              autoFocus
            />
          </Box>
        ) : (
          // Review & Edit Stage
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Review and edit the generated data before saving.
            </Typography>

            <FormControl fullWidth margin="normal" size="small">
              <InputLabel>Type</InputLabel>
              <Select
                value={editedData?.type || ''}
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
              value={editedData?.target_text || ''}
              onChange={(e) => updateField('target_text', e.target.value)}
              margin="normal"
              size="small"
            />

            <TextField
              fullWidth
              label="Meaning (Chinese)"
              value={editedData?.target_meaning || ''}
              onChange={(e) => updateField('target_meaning', e.target.value)}
              margin="normal"
              size="small"
            />

            <TagSelector
              selectedTagIds={selectedTagIds}
              onChange={setSelectedTagIds}
              availableTags={availableTags}
            />

            <Divider sx={{ my: 2 }} />

            <TextField
              fullWidth
              label="Context Sentence"
              value={editedData?.context_sentence || ''}
              onChange={(e) => updateField('context_sentence', e.target.value)}
              margin="normal"
              size="small"
              multiline
            />

            <TextField
              fullWidth
              label="Context Translation (Chinese)"
              value={editedData?.context_translation || ''}
              onChange={(e) => updateField('context_translation', e.target.value)}
              margin="normal"
              size="small"
              multiline
            />

            <TextField
              fullWidth
              label="Cloze Sentence"
              value={editedData?.cloze_sentence || ''}
              onChange={(e) => updateField('cloze_sentence', e.target.value)}
              margin="normal"
              size="small"
              helperText="Use _______ for the blank"
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        {!generatedData ? (
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={!inputText.trim() || isGenerating}
            startIcon={isGenerating ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
          >
            {isGenerating ? 'Generating...' : 'Generate'}
          </Button>
        ) : (
          <>
            <Button onClick={() => setGeneratedData(null)}>Back</Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Card'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

