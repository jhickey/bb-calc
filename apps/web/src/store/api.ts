import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Inventory } from 'bb-calc-js';

import type { SaveSummary } from '#/lib/saves';
import { createSave, deleteSave, listSaves } from '#/lib/saves';
import type { BuildConfig, BuildSummary } from '#/lib/builds';
import { createBuild, deleteBuild, listBuilds, renameBuild } from '#/lib/builds';
import type { CustomGemInput, CustomGemRow } from '#/lib/customGems';
import { createCustomGem, deleteCustomGem, listCustomGems, updateCustomGem } from '#/lib/customGems';

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
 * Like `run`, but for void-returning lib calls. RTK Query rejects a `{ data:
 * undefined }` result, so report success as `{ data: null }`.
 */
async function runVoid(fn: () => Promise<void>): Promise<{ data: null } | { error: ApiError }> {
  try {
    await fn();
    return { data: null };
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
  tagTypes: ['Save', 'Build', 'CustomGem'],
  endpoints: (builder) => ({
    listSaves: builder.query<Array<SaveSummary>, void>({
      queryFn: () => run(listSaves),
      providesTags: ['Save'],
    }),
    createSave: builder.mutation<string, Inventory>({
      queryFn: (inventory) => run(() => createSave(inventory)),
      invalidatesTags: ['Save'],
    }),
    deleteSave: builder.mutation<null, string>({
      queryFn: (id) => runVoid(() => deleteSave(id)),
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
    renameBuild: builder.mutation<null, { id: string; name: string }>({
      queryFn: ({ id, name }) => runVoid(() => renameBuild(id, name)),
      invalidatesTags: ['Build'],
    }),
    deleteBuild: builder.mutation<null, string>({
      queryFn: (id) => runVoid(() => deleteBuild(id)),
      invalidatesTags: ['Build'],
    }),
    listCustomGems: builder.query<Array<CustomGemRow>, void>({
      queryFn: () => run(listCustomGems),
      providesTags: ['CustomGem'],
    }),
    createCustomGem: builder.mutation<null, CustomGemInput>({
      queryFn: (input) => runVoid(() => createCustomGem(input)),
      invalidatesTags: ['CustomGem'],
    }),
    updateCustomGem: builder.mutation<null, { id: string; input: CustomGemInput }>({
      queryFn: ({ id, input }) => runVoid(() => updateCustomGem(id, input)),
      invalidatesTags: ['CustomGem'],
    }),
    deleteCustomGem: builder.mutation<null, string>({
      queryFn: (id) => runVoid(() => deleteCustomGem(id)),
      invalidatesTags: ['CustomGem'],
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
  useListCustomGemsQuery,
  useCreateCustomGemMutation,
  useUpdateCustomGemMutation,
  useDeleteCustomGemMutation,
} = bbApi;
