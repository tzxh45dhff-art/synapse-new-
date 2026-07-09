"use client"

import * as React from "react"
import { SearchIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Lightweight, dependency-free command palette / combobox.
 *
 * The repo doesn't ship `cmdk`, and its style layer is `@base-ui/react`, so
 * this is a self-contained implementation covering the surface we use:
 * a search input that filters `CommandItem`s by their `value`, with an
 * empty-state that appears when nothing matches. Filtering is case-insensitive
 * substring matching on `value`.
 */

type CommandContextValue = {
  search: string
  setSearch: (value: string) => void
  matches: (value: string) => boolean
  registerVisibility: (id: string, visible: boolean) => void
  visibleCount: number
}

const CommandContext = React.createContext<CommandContextValue | null>(null)

function useCommand(): CommandContextValue {
  const ctx = React.useContext(CommandContext)
  if (!ctx) throw new Error("Command components must be used within <Command>")
  return ctx
}

function Command({ className, children, ...props }: React.ComponentProps<"div">) {
  const [search, setSearch] = React.useState("")
  const visibilityRef = React.useRef<Map<string, boolean>>(new Map())
  const [visibleCount, setVisibleCount] = React.useState(0)

  const recount = React.useCallback(() => {
    let count = 0
    for (const visible of visibilityRef.current.values()) if (visible) count++
    setVisibleCount(count)
  }, [])

  const registerVisibility = React.useCallback(
    (id: string, visible: boolean) => {
      const prev = visibilityRef.current.get(id)
      if (prev === visible) return
      visibilityRef.current.set(id, visible)
      recount()
    },
    [recount]
  )

  const matches = React.useCallback(
    (value: string) =>
      search.trim() === "" ||
      value.toLowerCase().includes(search.trim().toLowerCase()),
    [search]
  )

  const value = React.useMemo(
    () => ({ search, setSearch, matches, registerVisibility, visibleCount }),
    [search, matches, registerVisibility, visibleCount]
  )

  return (
    <CommandContext.Provider value={value}>
      <div
        data-slot="command"
        className={cn("flex flex-col overflow-hidden rounded-md", className)}
        {...props}
      >
        {children}
      </div>
    </CommandContext.Provider>
  )
}

function CommandInput({ className, ...props }: React.ComponentProps<"input">) {
  const { search, setSearch } = useCommand()
  return (
    <div
      data-slot="command-input-wrapper"
      className="flex items-center gap-2 border-b border-white/[0.08] px-3"
    >
      <SearchIcon className="size-4 shrink-0 text-zinc-500" />
      <input
        data-slot="command-input"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={cn(
          "flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    </div>
  )
}

function CommandList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-list"
      className={cn("max-h-64 overflow-y-auto overflow-x-hidden p-1", className)}
      {...props}
    />
  )
}

function CommandEmpty({ className, ...props }: React.ComponentProps<"div">) {
  const { visibleCount } = useCommand()
  if (visibleCount > 0) return null
  return (
    <div
      data-slot="command-empty"
      className={cn("py-6 text-center text-sm text-zinc-500", className)}
      {...props}
    />
  )
}

function CommandGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="command-group" className={cn("text-foreground", className)} {...props} />
  )
}

function CommandSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="command-separator"
      className={cn("-mx-1 my-1 h-px bg-white/[0.08]", className)}
      {...props}
    />
  )
}

type CommandItemProps = Omit<React.ComponentProps<"div">, "onSelect"> & {
  value: string
  onSelect?: (value: string) => void
  disabled?: boolean
}

function CommandItem({
  className,
  value,
  onSelect,
  disabled,
  children,
  ...props
}: CommandItemProps) {
  const { matches, registerVisibility } = useCommand()
  const id = React.useId()
  const visible = matches(value)

  React.useEffect(() => {
    registerVisibility(id, visible)
    return () => registerVisibility(id, false)
  }, [id, visible, registerVisibility])

  if (!visible) return null

  return (
    <div
      data-slot="command-item"
      role="option"
      aria-selected={false}
      data-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onSelect?.(value)
      }}
      className={cn(
        "relative flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
}
