import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';

import { bbApi } from '#/store/api';
import { buildReducer } from '#/store/buildSlice';

export const store = configureStore({
  reducer: {
    build: buildReducer,
    [bbApi.reducerPath]: bbApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(bbApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
