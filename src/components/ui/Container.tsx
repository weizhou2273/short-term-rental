import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/util/cn';

type ContainerProps = {
  as?: ElementType;
  size?: 'narrow' | 'default' | 'wide' | 'full';
  className?: string;
  children: ReactNode;
};

const sizes = {
  narrow: 'max-w-[42rem]',
  default: 'max-w-[72rem]',
  wide: 'max-w-[88rem]',
  full: 'max-w-none',
} as const;

export function Container({
  as: Tag = 'div',
  size = 'default',
  className,
  children,
}: ContainerProps) {
  return (
    <Tag className={cn('mx-auto w-full px-5 sm:px-8', sizes[size], className)}>{children}</Tag>
  );
}
