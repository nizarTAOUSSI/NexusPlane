import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  createTransform,
} from 'redux-persist';
import localforage from 'localforage';
import dashboardLayoutReducer, {
  reconcileDashboardLayout,
  type DashboardLayoutState,
} from './dashboardLayoutSlice';
import notesReducer from './notesSlice';
import imagesReducer from './imagesSlice';

function getPersistUserId(): string {
  try {
    const raw = localStorage.getItem('user_info');
    if (!raw) return 'anon';
    const parsed = JSON.parse(raw) as { id?: string };
    return typeof parsed.id === 'string' && parsed.id.trim() ? parsed.id : 'anon';
  } catch {
    return 'anon';
  }
}

function scopedKey(baseKey: string): string {
  return `${baseKey}:${getPersistUserId()}`;
}

localforage.config({
  name: 'nexusplan',
  storeName: 'redux_persist',
  driver: [localforage.INDEXEDDB, localforage.WEBSQL, localforage.LOCALSTORAGE],
});

const idbStorage = {
  getItem: (key: string) => localforage.getItem<string>(scopedKey(key)),
  setItem: (key: string, value: string) => localforage.setItem(scopedKey(key), value),
  removeItem: (key: string) => localforage.removeItem(scopedKey(key)),
};

const layoutReconcileTransform = createTransform(
  (inbound: DashboardLayoutState) => inbound,
  (outbound: DashboardLayoutState) => ({
    ...outbound,
    layout: reconcileDashboardLayout(outbound?.layout as unknown, outbound?.hiddenWidgets ?? []),
    hiddenWidgets: outbound?.hiddenWidgets ?? [],
  }),
);

const dashboardLayoutPersistConfig = {
  key: 'nexusplanDashboardLayout',
  version: 2,
  storage: idbStorage,
  transforms: [layoutReconcileTransform],
};

const notesPersistConfig = {
  key: 'nexusplanNotes',
  version: 1,
  storage: idbStorage,
};

const imagesPersistConfig = {
  key: 'nexusplanImages',
  version: 1,
  storage: idbStorage,
};

const rootReducer = combineReducers({
  dashboardLayout: persistReducer(dashboardLayoutPersistConfig, dashboardLayoutReducer),
  notes: persistReducer(notesPersistConfig, notesReducer),
  images: persistReducer(imagesPersistConfig, imagesReducer),
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
