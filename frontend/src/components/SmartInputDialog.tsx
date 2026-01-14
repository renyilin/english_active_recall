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
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { generateApi, cardsApi, tagsApi } from '../services/api';
import type { CardCreate, Tag } from '../services/api';
import TagSelector from './TagSelector';

interface SmartInputDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (closeDialog?: boolean) => void;
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

type Mode = 'single' | 'batch';

export default function SmartInputDialog({ open, onClose, onSuccess }: SmartInputDialogProps) {
  // Mode State
  const [mode, setMode] = useState<Mode>('single');

  // Workflow State
  const [inputText, setInputText] = useState('');
  const [generatedData, setGeneratedData] = useState<GeneratedData | null>(null);
  const [editedData, setEditedData] = useState<GeneratedData | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[] | undefined>(undefined);

  // Batch State
  const [batchText, setBatchText] = useState('');
  const [candidates, setCandidates] = useState<string[]>([]);
  const [processedIndices, setProcessedIndices] = useState<Set<number>>(new Set());
  const [currentCandidateIndex, setCurrentCandidateIndex] = useState<number | null>(null);

  // Loading States
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleModeChange = (_event: React.SyntheticEvent, newValue: Mode) => {
    setMode(newValue);
    setError('');
    // Reset generation state when switching modes
    setGeneratedData(null);
    setEditedData(null);
  };

  const handleExtract = async () => {
    if (!batchText.trim()) return;
    setIsExtracting(true);
    setError('');
    try {
      const response = await generateApi.extract(batchText.trim());
      setCandidates(response.data.candidates);
      setProcessedIndices(new Set());
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Failed to extract items');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleCandidateClick = (index: number) => {
    const text = candidates[index];
    setInputText(text);
    setCurrentCandidateIndex(index);
    // Switch "view" to generation, but stay conceptually in batch mode workflow
    // We achieve this by just using the `inputText` and `handleGenerate` flow
    // But we need to know we are in a sub-flow of batch.
  };

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

      if (mode === 'batch' && currentCandidateIndex !== null) {
        // Mark as processed
        setProcessedIndices(prev => new Set([...prev, currentCandidateIndex!]));
        // Return to list
        setGeneratedData(null);
        setEditedData(null);
        setCurrentCandidateIndex(null);
        setInputText('');
        // Trigger generic success callback to update library, but keep dialog open
        onSuccess(false);
      } else {
        // Single mode - close dialog
        handleClose();
        onSuccess(true);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Failed to save card');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    // Reset all state
    setInputText('');
    setBatchText('');
    setCandidates([]);
    setProcessedIndices(new Set());
    setGeneratedData(null);
    setEditedData(null);
    setSelectedTagIds([]);
    setCurrentCandidateIndex(null);
    setError('');
    setMode('single');
    onClose();
  };

  const updateField = (field: keyof GeneratedData, value: string) => {
    if (editedData) {
      setEditedData({ ...editedData, [field]: value });
    }
  };

  const handleBack = () => {
    if (generatedData) {
      // If we are reviewing generated data
      setGeneratedData(null);
      setEditedData(null);
      // If in batch mode, we stay in "processing item" state (showSingleInput for batch)
      // so user can edit the text again or go back further
    } else if (mode === 'batch' && currentCandidateIndex !== null) {
      // If we are in "processing item" state (input view), go back to list
      setCurrentCandidateIndex(null);
      setInputText('');
    }
  };

  // Determine what view to show
  const showReview = !!generatedData;
  const showBatchList = mode === 'batch' && !showReview && candidates.length > 0 && currentCandidateIndex === null;
  const showBatchInput = mode === 'batch' && !showReview && candidates.length === 0;
  // reuse single input UI for batch item processing
  const showSingleInput = (mode === 'single' && !showReview) || (mode === 'batch' && !showReview && currentCandidateIndex !== null);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesomeIcon color="primary" />
          Smart Input
        </Box>
        {!showReview && currentCandidateIndex === null && (
          <Tabs value={mode} onChange={handleModeChange} sx={{ mt: 1 }}>
            <Tab label="Phrase / Sentence" value="single" />
            <Tab label="Batch Import" value="batch" />
          </Tabs>
        )}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
            {error}
          </Alert>
        )}

        {showSingleInput && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {mode === 'batch'
                ? `Processing item ${currentCandidateIndex! + 1} of ${candidates.length}`
                : 'Enter a phrase or sentence and let AI generate learning data for you.'}
            </Typography>
            <TextField
              fullWidth
              label={mode === 'batch' ? 'Selected phrase' : 'Enter phrase or sentence'}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g., call it a day"
              multiline
              autoFocus
            />
          </Box>
        )}

        {showBatchInput && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Paste a full paragraph or article. AI will extract key phrases and sentences for you to review.
            </Typography>
            <TextField
              fullWidth
              label="Content"
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder="Paste English text here..."
              multiline
              rows={6}
              autoFocus
            />
          </Box>
        )}

        {showBatchList && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2">
                Found {candidates.length} items ({processedIndices.size} processed)
              </Typography>
              <Button
                size="small"
                onClick={() => {
                  setCandidates([]);
                  setProcessedIndices(new Set());
                }}
              >
                Clear & Start Over
              </Button>
            </Box>
            <List dense sx={{ maxHeight: '400px', overflow: 'auto', border: '1px solid #eee', borderRadius: 1 }}>
              {candidates.map((candidate, index) => {
                const isProcessed = processedIndices.has(index);
                return (
                  <ListItem key={index} disablePadding>
                    <ListItemButton
                      onClick={() => handleCandidateClick(index)}
                      selected={currentCandidateIndex === index}
                    >
                      <ListItemIcon>
                        {isProcessed ? <CheckCircleIcon color="success" fontSize="small" /> : <RadioButtonUncheckedIcon fontSize="small" />}
                      </ListItemIcon>
                      <ListItemText primary={candidate} sx={{ textDecoration: isProcessed ? 'line-through' : 'none', opacity: isProcessed ? 0.6 : 1 }} />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Box>
        )}

        {showReview && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Review and edit the generated data before saving.
            </Typography>

            <FormControl fullWidth margin="normal" size="small">
              <InputLabel>Type</InputLabel>
              <Select
                value={editedData?.type || ''}
                label="Type"
                onChange={(e) => updateField('type', e.target.value as any)}
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

        {showSingleInput && (
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={!inputText.trim() || isGenerating}
            startIcon={isGenerating ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
          >
            {isGenerating ? 'Generating...' : 'Generate'}
          </Button>
        )}

        {showBatchInput && (
          <Button
            variant="contained"
            onClick={handleExtract}
            disabled={!batchText.trim() || isExtracting}
            startIcon={isExtracting ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
          >
            {isExtracting ? 'Analyze Content' : 'Analyze'}
          </Button>
        )}

        {showBatchList && (
          // No main action button in list view, items are clickable. 
          // Maybe a "Finish" button if they are done? But "Cancel" works too.
          // Let's add a "Generate" button if an item is selected?
          // No, I made item click trigger setup. But user still needs to click "Generate" if I didn't auto-trigger.
          // In my code `handleCandidateClick` just sets input text. It does NOT switch to single input view fully?
          // Wait, `handleCandidateClick` sets currentCandidateIndex.
          // `showBatchList` is true if `mode=='batch' && !showReview && candidates > 0`.
          // If I set `inputText`, `showReview` is still false.
          // But `showBatchList` is still true.
          // Ah, I need to hide list and show input?
          // Actually, if `currentCandidateIndex` is set (item clicked), I should probably show the "Single Input" review view?
          // Or rather, directly go to the "Generate" state?
          // Let's make `handleCandidateClick` auto-trigger `handleGenerate`?
          // Or better: In `showBatchList`, if `currentCandidateIndex !== null`, show the "Single Input" view pre-filled?
          // But I want a seamless flow.
          // Let's adjust `handleCandidateClick` to call `handleGenerate` immediately?
          // Yes, "Review result one by one" usually implies: Click -> (Load) -> Review Dialog.
          <></>
        )}
        {showBatchList && currentCandidateIndex !== null && (
          // If I implement auto-generate, I don't need this.
          // But if I want manual confirmation:
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={!inputText.trim() || isGenerating}
          >
            Generate
          </Button>
        )}

        {showReview && (
          <>
            <Button onClick={handleBack}>Back</Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Card'}
            </Button>
          </>
        )}

        {!showReview && mode === 'batch' && currentCandidateIndex !== null && (
          <Button onClick={handleBack}>Back to List</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
