import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Inventory } from 'bb-calc-js';

import type { SaveSummary } from '#/lib/saves';
import { createSave, deleteSave, listSaves } from '#/lib/saves';
import type { BuildConfig, BuildSummary } from '#/lib/builds';
import { createBuild, deleteBuild, listBuilds, renameBuild } from '#/lib/builds';

type ApiError = { message: string };

/** Wrap a lib call into the queryFn `{ data } | { error }` shape. */
async function run<T>(fn: () => Promise<T>): Promise<{ data: T } | { error: ApiError }> {
  try {
    return { data: await fn() };
  } catch (e) {
    return { error: { message: e instanceof Error ? e.message : String(e) } };
  }
}

/**
 * Server data (Supabase) via RTK Query. Endpoints wrap the lib/saves & lib/builds
 * functions; mutations invalidate the relevant list so the Saves/Builds tabs
 * refetch automatically.
 */
export const bbApi = createApi({
  reducerPath: 'bbApi',
  baseQuery: fakeBaseQuery<ApiError>(),
  tagTypes: ['Save', 'Build'],
  endpoints: (builder) => ({
    listSaves: builder.query<Array<SaveSummary>, void>({
      queryFn: () => run(listSaves),
      providesTags: ['Save'],
    }),
    createSave: builder.mutation<string, Inventory>({
      queryFn: (inventory) => run(() => createSave(inventory)),
      invalidatesTags: ['Save'],
    }),
    deleteSave: builder.mutation<void, string>({
      queryFn: (id) => run(() => deleteSave(id)),
      invalidatesTags: ['Save'],
    }),
    listBuilds: builder.query<Array<BuildSummary>, void>({
      queryFn: () => run(listBuilds),
      providesTags: ['Build'],
    }),
    createBuild: builder.mutation<BuildSummary, { name: string; config: BuildConfig; saveId: string | null }>({
      queryFn: ({ name, config, saveId }) => run(() => createBuild(name, config, saveId)),
      invalidatesTags: ['Build'],
    }),
    renameBuild: builder.mutation<void, { id: string; name: string }>({
      queryFn: ({ id, name }) => run(() => renameBuild(id, name)),
      invalidatesTags: ['Build'],
    }),
    deleteBuild: builder.mutation<void, string>({
      queryFn: (id) => run(() => deleteBuild(id)),
      invalidatesTags: ['Build'],
    }),
  }),
});

export const {
  useListSavesQuery,
  useCreateSaveMutation,
  useDeleteSaveMutation,
  useListBuildsQuery,
  useCreateBuildMutation,
  useRenameBuildMutation,
  useDeleteBuildMutation,
} = bbApi;
