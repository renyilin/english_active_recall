import { useState, useEffect } from 'react';
import {
    Autocomplete,
    TextField,
    Chip,
    CircularProgress,
} from '@mui/material';
import { tagsApi } from '../services/api';
import type { Tag } from '../services/api';

interface TagSelectorProps {
    selectedTagIds: string[];
    onChange: (tagIds: string[]) => void;
    availableTags?: Tag[];
}

export default function TagSelector({ selectedTagIds, onChange, availableTags }: TagSelectorProps) {
    const [tags, setTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(true);
    const [inputValue, setInputValue] = useState('');

    useEffect(() => {
        if (availableTags) {
            setTags(availableTags);
            setLoading(false);
        } else {
            loadTags();
        }
    }, [availableTags]);

    const loadTags = async () => {
        try {
            setLoading(true);
            const response = await tagsApi.list();
            setTags(response.data.items);
        } catch (err) {
            console.error('Failed to load tags:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = async (
        _event: React.SyntheticEvent,
        newValue: (Tag | string)[]
    ) => {
        const tagIds: string[] = [];

        for (const item of newValue) {
            if (typeof item === 'string') {
                // Create new tag
                try {
                    const response = await tagsApi.create({ name: item });
                    const newTag = response.data;
                    setTags((prev) => [...prev, newTag]);
                    tagIds.push(newTag.id);
                } catch (err) {
                    console.error('Failed to create tag:', err);
                }
            } else {
                tagIds.push(item.id);
            }
        }

        onChange(tagIds);
    };

    const selectedTags = tags.filter((tag) => selectedTagIds.includes(tag.id));

    return (
        <Autocomplete
            multiple
            freeSolo
            options={tags}
            value={selectedTags}
            loading={loading}
            inputValue={inputValue}
            onInputChange={(_, newInputValue) => setInputValue(newInputValue)}
            onChange={handleChange}
            getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                    const { key, ...chipProps } = getTagProps({ index });
                    return (
                        <Chip
                            key={key}
                            label={option.name}
                            size="small"
                            {...chipProps}
                        />
                    );
                })
            }
            renderInput={(params) => (
                <TextField
                    {...params}
                    label="Tags"
                    placeholder="Select or create tags..."
                    size="small"
                    margin="normal"
                    InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                            <>
                                {loading ? <CircularProgress color="inherit" size={16} /> : null}
                                {params.InputProps.endAdornment}
                            </>
                        ),
                    }}
                />
            )}
        />
    );
}
