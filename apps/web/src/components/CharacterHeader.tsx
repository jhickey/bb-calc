import { motion } from 'motion/react';
import type { Inventory, Stats } from 'bb-calc-js';

import { SaveUpload } from '#/components/SaveUpload';
import { StatsDisplay } from '#/components/StatsDisplay';

type CharacterHeaderProps = {
  inventory: Inventory | null;
  /** The current (possibly edited) scaling stats fed to the optimizer. */
  stats: Stats;
  onEditStat: (key: keyof Stats, value: number) => void;
  onRevertStat: (key: keyof Stats) => void;
  onResetStats: () => void;
  onFile: (file: File) => void;
  className?: string;
};

/** Format a millisecond playtime as `H:MM:SS`, matching the in-game display. */
function formatPlaytime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${hours}:${pad(minutes)}:${pad(seconds)}`;
}

/** A labeled secondary figure (HP, Insight, Echoes, …) rendered as plain text. */
function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-xs uppercase tracking-wide text-au-chico">{label}</span>
      <span className="text-base font-semibold text-pale-mocha">{value}</span>
    </div>
  );
}

/**
 * Top-of-page header: the imported character's name, level, progression, and
 * stats on the left, with the Import Save button aligned right. Before a save is
 * imported, the left side shows a prompt instead.
 */
export function CharacterHeader({
  inventory,
  stats,
  onEditStat,
  onRevertStat,
  onResetStats,
  onFile,
  className = '',
}: CharacterHeaderProps) {
  const character = inventory?.character ?? null;
  const newGameLabel = character ? (character.newGame === 0 ? 'NG' : `NG+${character.newGame}`) : '';
  const statsChanged =
    character != null &&
    (stats.str !== character.strength ||
      stats.skl !== character.skill ||
      stats.blt !== character.bloodtinge ||
      stats.arc !== character.arcane);

  return (
    <header className={`flex flex-wrap items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {character ? (
          <motion.div
            key={character.name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-2xl font-semibold text-pale-mocha">{character.name}</h2>
              <span className="text-au-chico">Level {character.level}</span>
              <span className="rounded-sm bg-black-wool px-2 py-0.5 text-xs font-semibold text-pale-mocha">
                {newGameLabel}
              </span>
            </div>

            <StatsDisplay
              className="mt-3"
              character={character}
              stats={stats}
              onEditStat={onEditStat}
              onRevertStat={onRevertStat}
            />
            {statsChanged && (
              <button
                type="button"
                onClick={onResetStats}
                className="mt-2 cursor-pointer text-xs text-au-chico underline transition-colors hover:text-pale-mocha"
              >
                Reset stats to save
              </button>
            )}

            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              <Figure label="HP" value={character.health} />
              <Figure label="Stamina" value={character.stamina} />
              <Figure label="Insight" value={character.insight} />
              <Figure label="Blood Echoes" value={character.bloodEchoes.toLocaleString()} />
              <Figure label="Playtime" value={formatPlaytime(character.playtimeMs)} />
            </div>
          </motion.div>
        ) : (
          <div>
            <p className="text-au-chico">
              No save loaded — set your stats and build below, or log in to upload a save.
            </p>
            <StatsDisplay
              className="mt-3"
              character={null}
              stats={stats}
              onEditStat={onEditStat}
              onRevertStat={onRevertStat}
            />
          </div>
        )}
      </div>
      <SaveUpload onFile={onFile} />
    </header>
  );
}
