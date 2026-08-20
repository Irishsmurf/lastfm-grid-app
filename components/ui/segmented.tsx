import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  name: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

export function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      className={cn(
        'inline-flex overflow-hidden rounded-md border border-input',
        className
      )}
    >
      {options.map((opt, index) => {
        const checked = opt.value === value;
        return (
          <label
            key={opt.value}
            className={cn(
              'flex cursor-pointer items-center px-3 py-1.5 text-[13px] font-archivo font-extrabold transition-colors',
              index > 0 && 'border-l border-input',
              checked
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={checked}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}

export default Segmented;
