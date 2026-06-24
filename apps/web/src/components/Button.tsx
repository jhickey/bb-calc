import type { ButtonHTMLAttributes } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/** Primary action button, themed to the Bloodborne palette. */
export function Button({ className = '', type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center rounded-md bg-tamarillo px-4 py-2 text-sm font-semibold text-pale-mocha shadow-sm transition-colors hover:bg-old-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-au-chico disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-tamarillo ${className}`}
      {...props}
    />
  );
}
