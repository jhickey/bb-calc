import { motion } from 'motion/react';

type Tab = {
  id: string;
  label: string;
};

type TabsProps = {
  tabs: ReadonlyArray<Tab>;
  active: string;
  onChange: (id: string) => void;
  className?: string;
};

/** A simple controlled tab bar; the parent renders the active panel. */
export function Tabs({ tabs, active, onChange, className = '' }: TabsProps) {
  return (
    <div role="tablist" className={`flex gap-1 border-b border-black-wool ${className}`}>
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`relative -mb-px cursor-pointer px-4 py-2 text-sm font-semibold transition-colors ${
              isActive ? 'text-pale-mocha' : 'text-au-chico hover:text-pale-mocha'
            }`}
          >
            {tab.label}
            {isActive && (
              <motion.span
                layoutId="tab-underline"
                className="absolute inset-x-0 -bottom-px h-0.5 bg-tamarillo"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
