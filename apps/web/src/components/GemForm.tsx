import { useId, useState } from 'react';
import type { GemShape } from 'bb-calc-js';

import type { CustomGemEffect, CustomGemInput } from '#/lib/customGems';
import { AR_EFFECTS, buildEffectText } from '#/lib/gemEffects';
import { GEM_SHAPES } from '#/lib/gems';

type GemFormProps = {
  initialName?: string;
  initialShape: GemShape;
  initialTier?: number;
  initialEffects?: Array<CustomGemEffect>;
  submitLabel: string;
  onSubmit: (gem: CustomGemInput) => void;
};

type EffectMode = 'ar' | 'other';

/**
 * The gem editor: a name, imprint shape, tier, and a list of effects. Effects are
 * added either from the AR-effect dropdown (which generates an in-game-style
 * string) or as free text with no AR impact; either can be flagged cursed. Shared
 * by the gem picker's "Add Gem" tab and the Gems-tab create/edit modal.
 */
export function GemForm({
  initialName = 'New gem',
  initialShape,
  initialTier = 0,
  initialEffects = [],
  submitLabel,
  onSubmit,
}: GemFormProps) {
  const nameId = useId();
  const shapeId = useId();
  const tierId = useId();
  const [name, setName] = useState(initialName);
  const [shape, setShape] = useState<GemShape>(initialShape);
  const [tier, setTier] = useState(String(initialTier));
  const [effects, setEffects] = useState<Array<CustomGemEffect>>(initialEffects);

  const [mode, setMode] = useState<EffectMode>('ar');
  const [effectKey, setEffectKey] = useState(AR_EFFECTS[0].key);
  const [value, setValue] = useState('');
  const [freeText, setFreeText] = useState('');
  const [cursed, setCursed] = useState(false);

  const selected = AR_EFFECTS.find((e) => e.key === effectKey) ?? AR_EFFECTS[0];
  const magnitude = Number(value);
  const canAddAr = value.trim() !== '' && !Number.isNaN(magnitude);
  const canAddOther = freeText.trim() !== '';

  function addEffect() {
    if (mode === 'ar') {
      if (!canAddAr) return;
      setEffects((prev) => [...prev, { text: buildEffectText(selected, magnitude, cursed), cursed }]);
      setValue('');
    } else {
      if (!canAddOther) return;
      setEffects((prev) => [...prev, { text: freeText.trim(), cursed }]);
      setFreeText('');
    }
    setCursed(false);
  }

  function submit() {
    onSubmit({
      name: name.trim() || 'New gem',
      shape,
      tier: Math.max(0, Math.trunc(Number(tier)) || 0),
      effects,
    });
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
        <div className="flex flex-col gap-1">
          <label htmlFor={tierId} className="text-xs uppercase tracking-wide text-au-chico">
            Tier
          </label>
          <input
            id={tierId}
            type="number"
            min={0}
            value={tier}
            onChange={(event) => setTier(event.target.value)}
            className="w-20 rounded-md border border-black-wool bg-black-wool px-3 py-2 text-sm text-pale-mocha"
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex gap-1">
          {(
            [
              ['ar', 'Effect'],
              ['other', 'Other (no AR)'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                mode === id ? 'bg-tamarillo/20 text-pale-mocha' : 'text-au-chico hover:text-pale-mocha'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          {mode === 'ar' ? (
            <>
              <select
                aria-label="Effect"
                value={effectKey}
                onChange={(event) => setEffectKey(event.target.value)}
                className="min-w-40 flex-1 rounded-md border border-black-wool bg-black-wool px-3 py-2 pr-10 text-sm text-pale-mocha"
              >
                {AR_EFFECTS.map((effect) => (
                  <option key={effect.key} value={effect.key}>
                    {effect.label}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="any"
                  aria-label="Value"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addEffect();
                    }
                  }}
                  placeholder="0"
                  className="w-24 rounded-md border border-black-wool bg-black-wool px-3 py-2 text-sm text-pale-mocha placeholder:text-au-chico"
                />
                <span className="text-sm text-au-chico">{selected.unit}</span>
              </div>
            </>
          ) : (
            <input
              type="text"
              aria-label="Effect description"
              value={freeText}
              onChange={(event) => setFreeText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addEffect();
                }
              }}
              placeholder="e.g. Increases stamina costs"
              className="min-w-0 flex-1 rounded-md border border-black-wool bg-black-wool px-3 py-2 text-sm text-pale-mocha placeholder:text-au-chico"
            />
          )}
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-au-chico">
            <input type="checkbox" checked={cursed} onChange={(event) => setCursed(event.target.checked)} />
            Cursed
          </label>
          <button
            type="button"
            onClick={addEffect}
            disabled={mode === 'ar' ? !canAddAr : !canAddOther}
            className="shrink-0 cursor-pointer rounded-md bg-black-wool px-3 py-2 text-sm font-semibold text-pale-mocha transition-colors hover:bg-old-red disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      {effects.length > 0 && (
        <ul className="space-y-1">
          {effects.map((effect, i) => (
            <li
              key={`${effect.text}-${i}`}
              className="flex items-center justify-between gap-2 rounded border border-black-wool px-3 py-1.5 text-sm"
            >
              <span className={effect.cursed ? 'text-red-400' : 'text-pale-mocha'}>{effect.text}</span>
              <button
                type="button"
                onClick={() => setEffects((prev) => prev.filter((_, index) => index !== i))}
                aria-label={`Remove effect ${effect.text}`}
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
