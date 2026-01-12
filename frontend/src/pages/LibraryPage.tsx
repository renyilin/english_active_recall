import { useState, useEffect, useCallback } from 'react';
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
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import { cardsApi } from '../services/api';
import type { Card as CardType, CardListResponse } from '../services/api';
import SmartInputDialog from '../components/SmartInputDialog';
import EditCardDialog from '../components/EditCardDialog';

export default function LibraryPage() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [smartInputOpen, setSmartInputOpen] = useState(false);
  const [editCard, setEditCard] = useState<CardType | null>(null);
  const [deleteCard, setDeleteCard] = useState<CardType | null>(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const fetchCards = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await cardsApi.list(page + 1, pageSize, typeFilter || undefined);
      const data: CardListResponse = response.data;
      setCards(data.items);
      setTotal(data.total);
    } catch (error) {
      console.error('Failed to fetch cards:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, typeFilter]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

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

  const filteredCards = searchText
    ? cards.filter(
      (card) =>
        card.target_text.toLowerCase().includes(searchText.toLowerCase()) ||
        card.target_meaning.includes(searchText)
    )
    : cards;

  const columns: GridColDef[] = [
    {
      field: 'type',
      headerName: 'Type',
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value === 'phrase' ? 'primary' : 'secondary'}
        />
      ),
    },
    { field: 'target_text', headerName: 'English', flex: 1, minWidth: 150 },
    { field: 'target_meaning', headerName: 'Meaning', flex: 1, minWidth: 150 },
    {
      field: 'interval',
      headerName: 'Interval',
      width: 80,
      renderCell: (params: GridRenderCellParams) => `${params.value}d`,
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      renderCell: (params: GridRenderCellParams<CardType>) => (
        <>
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
          {filteredCards.map((card) => (
            <Card key={card.id}>
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
                <Typography variant="subtitle1" fontWeight="bold">
                  {card.target_text}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {card.target_meaning}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                  {card.context_sentence}
                </Typography>
              </CardContent>
              <CardActions>
                <IconButton size="small" onClick={() => setEditCard(card)}>
                  <EditIcon />
                </IconButton>
                <IconButton size="small" onClick={() => setDeleteCard(card)} color="error">
                  <DeleteIcon />
                </IconButton>
              </CardActions>
            </Card>
          ))}
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
          pageSizeOptions={[10, 20, 50]}
          rowCount={total}
          paginationMode="server"
          loading={isLoading}
          autoHeight
          disableRowSelectionOnClick
        />
      )}

      {/* Smart Input Dialog */}
      <SmartInputDialog
        open={smartInputOpen}
        onClose={() => setSmartInputOpen(false)}
        onSuccess={() => {
          setSmartInputOpen(false);
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
