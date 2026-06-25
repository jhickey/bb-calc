import { motion, type HTMLMotionProps } from 'motion/react';

type ButtonProps = HTMLMotionProps<'button'>;

/** Primary action button, themed to the Bloodborne palette. Grows slightly on
 *  hover (skipped when disabled; reduced-motion users get no scale). */
export function Button({ className = '', type = 'button', disabled, ...props }: ButtonProps) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.04 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      className={`inline-flex cursor-pointer items-center rounded-md bg-tamarillo px-4 py-2 text-sm font-semibold text-pale-mocha shadow-sm transition-colors hover:bg-old-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-au-chico disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-tamarillo ${className}`}
      {...props}
    />
  );
}
