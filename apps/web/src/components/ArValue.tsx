import { useEffect } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';

type ArValueProps = {
  /** The Attack Rating to display; transitions when it changes. */
  value: number;
  className?: string;
};

/**
 * An Attack Rating figure that briefly counts up/down to its new value when it
 * changes, giving socketing and stat edits a touch of life. Honors reduced
 * motion (snaps instantly).
 */
export function ArValue({ value, className = '' }: ArValueProps) {
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(value);
  const display = useTransform(motionValue, (current) => Math.round(current).toLocaleString());

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: reduceMotion ? 0 : 0.3,
      ease: 'easeOut',
    });
    return controls.stop;
  }, [value, motionValue, reduceMotion]);

  return <motion.div className={className}>{display}</motion.div>;
}
