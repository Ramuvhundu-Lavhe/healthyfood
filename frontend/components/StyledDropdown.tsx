import React, { useState, useRef, useEffect, ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
}

interface Props {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  triggerIcon?: ComponentType<{ size?: number; className?: string }>;
  labelPrefix?: string;
  // Optional: which values count as "default" (used to decide active-state styling)
  defaultValues?: string[];
  ariaLabel?: string;
}

// Custom dropdown that renders its menu via a portal so it never gets clipped
// by an overflow-x-auto ancestor (the bug the native <select> was covering up).
// Discovery-styled: navy-tint highlight, teal check for selected, animated chevron.
const StyledDropdown: React.FC<Props> = ({
  value, options, onChange, triggerIcon: TriggerIcon, labelPrefix = '',
  defaultValues = ['all', 'none', 'general'], ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);
  const isActive = !defaultValues.includes(value);
  const IconComp = selected?.icon || TriggerIcon;

  const measure = () => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
  };

  const openMenu = () => { measure(); setIsOpen(true); };
  const closeMenu = () => setIsOpen(false);

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      closeMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    const onScroll = () => measure();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [isOpen]);

  const activeClass = isActive || isOpen
    ? 'bg-white border-[var(--teal)] text-[var(--navy)]'
    : 'bg-[var(--bg)] border-[var(--line)] text-[var(--ink)]';
  const iconTone = isActive || isOpen ? 'text-[var(--teal)]' : 'text-[var(--ink-muted)]';

  return (
    <>
      <button
        ref={triggerRef}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        className={`flex-shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold border-2 transition-colors ${activeClass}`}
      >
        {IconComp && <IconComp size={14} className={iconTone} />}
        <span>{labelPrefix}{selected?.label || value}</span>
        <ChevronDown size={12} className={`transition-transform ${iconTone} ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && rect && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          className="fixed bg-white rounded-xl border border-[var(--line)] shadow-lg z-[9999] py-1.5 min-w-[180px] animate-fade-in"
          style={{
            top: Math.min(rect.bottom + 6, window.innerHeight - 200),
            left: Math.max(8, Math.min(rect.left, window.innerWidth - 200)),
          }}
        >
          {options.map(opt => {
            const isSelected = opt.value === value;
            const OptIcon = opt.icon;
            return (
              <button
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => { onChange(opt.value); closeMenu(); }}
                className={`w-[calc(100%-8px)] mx-1 my-0.5 text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${
                  isSelected
                    ? 'bg-[var(--navy-tint)] text-[var(--navy)]'
                    : 'text-[var(--ink)] hover:bg-[var(--bg)]'
                }`}
              >
                {OptIcon && (
                  <OptIcon size={14} className={isSelected ? 'text-[var(--teal)]' : 'text-[var(--ink-muted)]'} />
                )}
                <span className="flex-1">{opt.label}</span>
                {isSelected && <Check size={14} className="text-[var(--teal)]" />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
};

export default StyledDropdown;
