import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface ImageData {
  src: string; 
  caption?: string;
}

export interface ImagesState {
  images: Record<string, ImageData>;
}

const initialState: ImagesState = { images: {} };

const imagesSlice = createSlice({
  name: 'images',
  initialState,
  reducers: {
    setImage(state, action: PayloadAction<{ id: string; data: ImageData }>) {
      state.images[action.payload.id] = action.payload.data;
    },
    deleteImage(state, action: PayloadAction<string>) {
      delete state.images[action.payload];
    },
    clearImages(state) {
      state.images = {};
    },
  },
});

export const { setImage, deleteImage, clearImages } = imagesSlice.actions;
export default imagesSlice.reducer;
