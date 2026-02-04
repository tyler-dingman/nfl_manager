import * as React from 'react';

import { cn } from '@/lib/utils';

type DropdownContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const DropdownContext = React.createContext<DropdownContextValue | null>(null);

function useDropdownContext() {
  const context = React.useContext(DropdownContext);
  if (!context) {
    throw new Error('DropdownMenu components must be used within DropdownMenu.');
  }
  return context;
}

function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-flex">{children}</div>
    </DropdownContext.Provider>
  );
}

function DropdownMenuTrigger({
  children,
  asChild,
}: {
  children: React.ReactElement;
  asChild?: boolean;
}) {
  const { open, setOpen } = useDropdownContext();
  const triggerProps = {
    onClick: (event: React.MouseEvent) => {
      event.preventDefault();
      setOpen(!open);
    },
    'aria-expanded': open,
    'aria-haspopup': 'menu',
  };

  if (asChild) {
    return React.cloneElement(children, triggerProps);
  }

  return (
    <button type="button" {...triggerProps}>
      {children}
    </button>
  );
}

const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { open, setOpen } = useDropdownContext();
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useImperativeHandle(ref, () => contentRef.current as HTMLDivElement);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) {
        return;
      }
      if (contentRef.current?.contains(event.target)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, setOpen]);

  if (!open) {
    return null;
  }

  return (
    <div
      ref={contentRef}
      role="menu"
      className={cn(
        'absolute right-0 top-full z-50 mt-2 min-w-[10rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md',
        className
      )}
      {...props}
    />
  );
});
DropdownMenuContent.displayName = 'DropdownMenuContent';

const DropdownMenuItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, ...props }, ref) => {
  const { setOpen } = useDropdownContext();
  return (
    <button
      ref={ref}
      type="button"
      role="menuitem"
      className={cn(
        'relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
        className
      )}
      onClick={(event) => {
        onClick?.(event);
        setOpen(false);
      }}
      {...props}
    />
  );
});
DropdownMenuItem.displayName = 'DropdownMenuItem';

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
