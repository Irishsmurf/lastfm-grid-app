import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Conditionally joins class names together and resolves Tailwind CSS class conflicts.
 *
 * This function utilizes `clsx` to efficiently construct class strings from various input types
 * (strings, arrays, objects) and then uses `tailwind-merge` to intelligently merge Tailwind CSS
 * classes, ensuring that conflicting utilities are resolved correctly (e.g., `p-2` and `p-4`
 * becomes `p-4`).
 *
 * @param {...ClassValue} inputs - A list of class values. These can be strings,
 * arrays of strings, or objects where keys are class names and values are booleans.
 * See `clsx` documentation for more details on valid input types.
 * @returns {string} A single string containing the combined and merged class names.
 *
 * @example
 * // Basic usage with strings
 * cn('bg-red-500', 'text-white'); // => "bg-red-500 text-white"
 *
 * // Usage with conditional classes (objects)
 * cn('p-4', { 'font-bold': true, 'text-lg': false }); // => "p-4 font-bold"
 *
 * // Usage with arrays
 * cn(['p-2', 'm-2']); // => "p-2 m-2"
 *
 * // Resolving Tailwind conflicts
 * cn('p-2 bg-red-500', 'p-4 bg-blue-500'); // => "p-4 bg-blue-500" (p-4 overrides p-2, bg-blue-500 overrides bg-red-500)
 *
 * // Mixed inputs
 * cn('base-styles', ['mx-auto', 'my-4'], { 'rounded-md': true }); // => "base-styles mx-auto my-4 rounded-md"
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
