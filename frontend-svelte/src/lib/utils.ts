import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type {
	WithoutChild,
	WithoutChildren,
	WithoutChildrenOrChild,
	WithElementRef
} from 'bits-ui';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
