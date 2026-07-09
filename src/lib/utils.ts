import { isValidElement, type ReactElement, type ReactNode } from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Adapter for the Radix-style `asChild` prop on top of `@base-ui/react`, which
 * instead uses a `render` prop. When `asChild` is set and `children` is a single
 * element, return props that render the base-ui component *as* that element
 * (merging props onto it). Otherwise render children normally.
 *
 * Usage inside a base-ui wrapper:
 *   <Primitive {...asChildProps(asChild, children)} {...props} />
 */
export function asChildProps(
  asChild: boolean | undefined,
  children: ReactNode
): { render: ReactElement } | { children: ReactNode } {
  if (asChild && isValidElement(children)) {
    return { render: children as ReactElement }
  }
  return { children }
}
