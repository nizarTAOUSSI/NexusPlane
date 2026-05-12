import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type NoteColor = 'yellow' | 'pink' | 'mint' | 'blue' | 'lavender' | 'peach';

export interface NoteData {
  content: string;
  color: NoteColor;
}

export interface NotesState {
  notes: Record<string, NoteData>;
}

const initialState: NotesState = { notes: {} };

const notesSlice = createSlice({
  name: 'notes',
  initialState,
  reducers: {
    setNote(state, action: PayloadAction<{ id: string; data: NoteData }>) {
      state.notes[action.payload.id] = action.payload.data;
    },
    deleteNote(state, action: PayloadAction<string>) {
      delete state.notes[action.payload];
    },
  },
});

export const { setNote, deleteNote } = notesSlice.actions;
export default notesSlice.reducer;
