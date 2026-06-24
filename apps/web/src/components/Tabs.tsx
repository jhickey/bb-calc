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
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={`-mb-px cursor-pointer border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
            active === tab.id
              ? 'border-tamarillo text-pale-mocha'
              : 'border-transparent text-au-chico hover:text-pale-mocha'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
