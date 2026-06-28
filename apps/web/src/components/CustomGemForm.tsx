import { useId, useState } from 'react';
import type { GemShape } from 'bb-calc-js';
import { parseGemEffects } from 'bb-calc-js';

import type { CustomGemInput } from '#/lib/customGems';
import { GEM_SHAPES } from '#/lib/gems';

type CustomGemFormProps = {
  initialName?: string;
  initialShape: GemShape;
  initialEffects?: Array<string>;
  submitLabel: string;
  onSubmit: (gem: CustomGemInput) => void;
};

/**
 * The custom-gem editor: a name, an imprint shape, and a list of effect clauses
 * (each validated via `parseGemEffects`). Shared by the gem picker's "Custom gem"
 * tab and the Gems-tab create/edit modal.
 */
export function CustomGemForm({
  initialName = 'Custom gem',
  initialShape,
  initialEffects = [],
  submitLabel,
  onSubmit,
}: CustomGemFormProps) {
  const nameId = useId();
  const shapeId = useId();
  const effectId = useId();
  const [name, setName] = useState(initialName);
  const [shape, setShape] = useState<GemShape>(initialShape);
  const [effects, setEffects] = useState<Array<string>>(initialEffects);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  function addEffect() {
    const clause = draft.trim();
    if (!clause) return;
    try {
      // Validate this single clause; throws with a readable message if invalid.
      parseGemEffects(clause, name, shape);
      setEffects((prev) => [...prev, clause]);
      setDraft('');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function submit() {
    try {
      // Final validation of the whole spec.
      parseGemEffects(effects.join('; '), name || 'Custom gem', shape);
      onSubmit({ name: name.trim() || 'Custom gem', shape, effects });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={nameId} className="text-xs uppercase tracking-wide text-au-chico">
            Name
          </label>
          <input
            id={nameId}
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-md border border-black-wool bg-black-wool px-3 py-2 text-sm text-pale-mocha"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={shapeId} className="text-xs uppercase tracking-wide text-au-chico">
            Imprint
          </label>
          <select
            id={shapeId}
            value={shape}
            onChange={(event) => setShape(event.target.value as GemShape)}
            className="rounded-md border border-black-wool bg-black-wool px-3 py-2 pr-10 text-sm text-pale-mocha"
          >
            {GEM_SHAPES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor={effectId} className="text-xs uppercase tracking-wide text-au-chico">
          Add effect
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id={effectId}
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addEffect();
              }
            }}
            placeholder="e.g. phys 27.2%  ·  +15 phys  ·  str-scale 9.9"
            className="min-w-0 flex-1 rounded-md border border-black-wool bg-black-wool px-3 py-2 text-sm text-pale-mocha placeholder:text-au-chico"
          />
          <button
            type="button"
            onClick={addEffect}
            className="shrink-0 cursor-pointer rounded-md bg-black-wool px-3 py-2 text-sm font-semibold text-pale-mocha transition-colors hover:bg-old-red"
          >
            Add
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>

      {effects.length > 0 && (
        <ul className="space-y-1">
          {effects.map((effect, i) => (
            <li
              key={`${effect}-${i}`}
              className="flex items-center justify-between gap-2 rounded border border-black-wool px-3 py-1.5 text-sm text-pale-mocha"
            >
              <span>{effect}</span>
              <button
                type="button"
                onClick={() => setEffects((prev) => prev.filter((_, index) => index !== i))}
                aria-label={`Remove effect ${effect}`}
                className="cursor-pointer text-au-chico hover:text-pale-mocha"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={effects.length === 0}
        className="cursor-pointer rounded-md bg-tamarillo px-4 py-2 text-sm font-semibold text-pale-mocha transition-colors hover:bg-old-red disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </div>
  );
}
