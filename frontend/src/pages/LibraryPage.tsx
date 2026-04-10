import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  useMediaQuery,
  useTheme,
  Card,
  CardContent,
  CardActions,
  TablePagination,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { cardsApi, ttsApi } from '../services/api';
import type { Card as CardType, CardListResponse } from '../services/api';
import SmartInputDialog from '../components/SmartInputDialog';
import EditCardDialog from '../components/EditCardDialog';
import { useDebounce } from '../hooks/useDebounce';

export default function LibraryPage() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [total, setTotal] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Map<string, string>>(new Map());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const debouncedSearchText = useDebounce(searchText, 500);
  const [isLoading, setIsLoading] = useState(false);
  const [smartInputOpen, setSmartInputOpen] = useState(false);
  const [editCard, setEditCard] = useState<CardType | null>(null);
  const [deleteCard, setDeleteCard] = useState<CardType | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const fetchCards = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await cardsApi.list(page + 1, pageSize, typeFilter || undefined, debouncedSearchText || undefined);
      const data: CardListResponse = response.data;
      setCards(data.items);
      setTotal(data.total);
    } catch (error) {
      console.error('Failed to fetch cards:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, typeFilter, debouncedSearchText]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [typeFilter, debouncedSearchText]);

  const handleDelete = async () => {
    if (!deleteCard) return;
    try {
      await cardsApi.delete(deleteCard.id);
      setDeleteCard(null);
      fetchCards();
    } catch (error) {
      console.error('Failed to delete card:', error);
    }
  };

  const handlePlayAudio = useCallback(async (text: string) => {
    try {
      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      // Check cache first
      let audioUrl = audioCacheRef.current.get(text);

      if (!audioUrl) {
        // Fetch from API
        const blob = await ttsApi.generateAudio(text);
        audioUrl = URL.createObjectURL(blob);
        audioCacheRef.current.set(text, audioUrl);
      }

      // Play audio
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      await audio.play();
    } catch (error) {
      console.error('Failed to play audio:', error);
      // Fallback to Web Speech API if TTS fails
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      audioCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      audioCacheRef.current.clear();
    };
  }, []);

  const getCardAudioText = (card: CardType) =>
    card.type === 'phrase' && card.context_sentence ? card.context_sentence : card.target_text;

  // Reset selection when cards change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [cards]);

  // Keyboard navigation: up/down to select, space to play
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if focus is on an input, dialog, or select
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement).closest('[role="dialog"]')) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, cards.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === ' ' && selectedIndex >= 0 && selectedIndex < cards.length) {
        e.preventDefault();
        handlePlayAudio(getCardAudioText(cards[selectedIndex]));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cards, selectedIndex, handlePlayAudio]);

  // Auto-scroll selected card into view
  useEffect(() => {
    if (selectedIndex >= 0) {
      const el = document.querySelector(`[data-card-index="${selectedIndex}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  const filteredCards = cards;

  const columns: GridColDef<CardType>[] = [
    {
      field: 'type',
      headerName: 'Type',
      width: 100,
      renderCell: (params: GridRenderCellParams<CardType, string>) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value === 'phrase' ? 'primary' : 'secondary'}
        />
      ),
    },
    {
      field: 'target_text',
      headerName: 'English',
      flex: 1,
      minWidth: 150,
      renderCell: (params: GridRenderCellParams<CardType, string>) =>
        params.row.type === 'phrase' && params.row.context_sentence
          ? <span><strong>{params.value}</strong> - {params.row.context_sentence}</span>
          : params.value,
    },
    { field: 'target_meaning', headerName: 'Meaning', flex: 1, minWidth: 150 },
    {
      field: 'tags',
      headerName: 'Tags',
      width: 150,
      sortable: false,
      renderCell: (params: GridRenderCellParams<CardType, CardType['tags']>) => (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center', height: '100%' }}>
          {params.value?.map((tag) => (
            <Chip key={tag.id} label={tag.name} size="small" variant="outlined" />
          ))}
        </Box>
      ),
    },
    {
      field: 'interval',
      headerName: 'Interval',
      width: 80,
      renderCell: (params: GridRenderCellParams<CardType, number>) => `${params.value}d`,
    },
    {
      field: 'ease_factor',
      headerName: 'Ease Factor',
      width: 100,
      renderCell: (params: GridRenderCellParams<CardType, number>) =>
        params.value?.toFixed(2) ?? '0.00',
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params: GridRenderCellParams<CardType>) => (
        <>
          <IconButton size="small" onClick={() => handlePlayAudio(getCardAudioText(params.row))} color="primary">
            <PlayArrowIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => setEditCard(params.row)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => setDeleteCard(params.row)} color="error">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </>
      ),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Library</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setSmartInputOpen(true)}
        >
          Add Card
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search by English or Chinese..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          sx={{ minWidth: 250 }}
        />
        <ToggleButtonGroup
          value={typeFilter}
          exclusive
          onChange={(_, value) => setTypeFilter(value)}
          size="small"
        >
          <ToggleButton value="">All</ToggleButton>
          <ToggleButton value="phrase">Phrase</ToggleButton>
          <ToggleButton value="sentence">Sentence</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {isMobile ? (
        // Mobile List View
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filteredCards.map((card, index) => (
            <Card
              key={card.id}
              data-card-index={index}
              onClick={() => setSelectedIndex(index)}
              sx={{
                cursor: 'pointer',
                outline: selectedIndex === index ? '2px solid' : 'none',
                outlineColor: 'primary.main',
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Chip
                    label={card.type}
                    size="small"
                    color={card.type === 'phrase' ? 'primary' : 'secondary'}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {card.interval}d
                  </Typography>
                </Box>
                <Typography variant="subtitle1">
                  {card.type === 'phrase' && card.context_sentence
                    ? <><strong>{card.target_text}</strong> - {card.context_sentence}</>
                    : <strong>{card.target_text}</strong>}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {card.target_meaning}
                </Typography>
              </CardContent>
              <CardActions>
                <IconButton size="small" onClick={() => handlePlayAudio(getCardAudioText(card))} color="primary">
                  <PlayArrowIcon />
                </IconButton>
                <IconButton size="small" onClick={() => setEditCard(card)}>
                  <EditIcon />
                </IconButton>
                <IconButton size="small" onClick={() => setDeleteCard(card)} color="error">
                  <DeleteIcon />
                </IconButton>
              </CardActions>
            </Card>
          ))}
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(e) => {
              setPageSize(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[20, 50, 100]}
            sx={{
              '& .MuiTablePagination-toolbar': {
                flexWrap: 'wrap',
                justifyContent: 'center',
              },
              '& .MuiTablePagination-actions': {
                order: -1,
              },
            }}
          />
        </Box>
      ) : (
        // Desktop Data Grid
        <DataGrid
          rows={filteredCards}
          columns={columns}
          paginationModel={{ page, pageSize }}
          onPaginationModelChange={(model) => {
            setPage(model.page);
            setPageSize(model.pageSize);
          }}
          pageSizeOptions={[20, 50, 100]}
          rowCount={total}
          paginationMode="server"
          loading={isLoading}
          autoHeight
          disableRowSelectionOnClick
          onRowClick={(params) => {
            const index = filteredCards.findIndex((c) => c.id === params.row.id);
            setSelectedIndex(index);
          }}
          getRowClassName={(params) => {
            const index = filteredCards.findIndex((c) => c.id === params.row.id);
            return index === selectedIndex ? 'Mui-selected' : '';
          }}
        />
      )}

      {/* Smart Input Dialog */}
      <SmartInputDialog
        open={smartInputOpen}
        onClose={() => setSmartInputOpen(false)}
        onSuccess={(closeDialog = true) => {
          if (closeDialog) {
            setSmartInputOpen(false);
          }
          fetchCards();
        }}
      />

      {/* Edit Card Dialog */}
      <EditCardDialog
        card={editCard}
        onClose={() => setEditCard(null)}
        onSuccess={() => {
          setEditCard(null);
          fetchCards();
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteCard} onClose={() => setDeleteCard(null)}>
        <DialogTitle>Delete Card</DialogTitle>
        <DialogContent>
          Are you sure you want to delete "{deleteCard?.target_text}"?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteCard(null)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
