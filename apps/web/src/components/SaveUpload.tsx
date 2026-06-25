import { useId } from 'react';
import type { ChangeEvent } from 'react';

type SaveUploadProps = {
  /** Called with the chosen file when the user selects one. */
  onFile: (file: File) => void;
  className?: string;
};

/**
 * A file picker for a Bloodborne save. The native input is visually hidden so
 * the browser's default "No file chosen" text never shows; a styled label
 * ("Import Save") opens the picker in its place.
 */
export function SaveUpload({ onFile, className = '' }: SaveUploadProps) {
  const inputId = useId();

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className="inline-flex cursor-pointer items-center rounded-md bg-black-wool px-4 py-2 text-sm font-semibold text-pale-mocha shadow-sm transition-colors hover:bg-old-red"
      >
        Import Save
      </label>
      <input id={inputId} name="save_upload" type="file" className="sr-only" onChange={handleChange} />
    </div>
  );
}
