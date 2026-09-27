'use client';
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useState,
  type ReactNode,
  type ReactElement,
  type TableHTMLAttributes,
} from 'react';
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import styles from './responsive-player-table.module.css';

const CardContext = createContext(false);
export const usePlayerCard = () => useContext(CardContext);
export type PlayerCardField = { label: string; value: ReactNode };
function buttons(node: ReactNode): ReactElement<any>[] {
  return elements(node).flatMap((n) =>
    n.type === 'button' ? [n] : typeof n.type === 'string' ? buttons(n.props.children) : [],
  );
}
function CardActions({ children }: { children: ReactNode }) {
  const items = buttons(children);
  return items.length > 1 ? (
    <PlayerActions
      name="Player actions"
      actions={items.map((item) => ({
        label: item.props['aria-label'] || text(item.props.children) || 'Player action',
        disabled: item.props.disabled,
        onClick: item.props.onClick,
      }))}
    />
  ) : (
    <>{children}</>
  );
}
export function PlayerCard({
  identity,
  fields,
  actions,
  onClick,
}: {
  identity: ReactNode;
  fields: PlayerCardField[];
  actions?: ReactNode;
  onClick?: React.MouseEventHandler<HTMLElement>;
}) {
  return (
    <CardContext.Provider value={true}>
      <article className={styles.card} onClick={onClick}>
        <div className={styles.identity}>{identity}</div>
        {actions && (
          <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
            <CardActions>{actions}</CardActions>
          </div>
        )}
        <dl className={styles.fields}>
          {fields.map((field, i) => (
            <div key={`${field.label}-${i}`}>
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
      </article>
    </CardContext.Provider>
  );
}
export function PlayerActions({
  name,
  actions,
}: {
  name: string;
  actions: {
    label: string;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    disabledReason?: string;
    icon?: React.ElementType;
  }[];
}) {
  const [open, setOpen] = useState(false);
  if (!actions.length) return null;
  if (actions.length === 1)
    return (
      <button
        type="button"
        className={styles.direct}
        disabled={actions[0].disabled}
        onClick={actions[0].onClick}
      >
        {actions[0].label}
      </button>
    );
  return (
    <>
      <button
        type="button"
        className={styles.more}
        aria-label={`Actions for ${name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <MoreHorizontal aria-hidden="true" />
      </button>
      {open && (
        <BottomSheet
          className={styles.actionSheet}
          title={name}
          closeLabel="Close player actions"
          onClose={() => setOpen(false)}
        >
          {actions.map((action) => (
            <button
              type="button"
              key={action.label}
              disabled={action.disabled}
              title={action.disabledReason}
              onClick={(event) => {
                setOpen(false);
                action.onClick?.(event);
              }}
            >
              {action.icon && <action.icon size={18} aria-hidden="true" />}
              <span>{action.label}</span>
              {action.disabledReason && <small>{action.disabledReason}</small>}
            </button>
          ))}
        </BottomSheet>
      )}
    </>
  );
}
function elements(children: ReactNode): ReactElement<any>[] {
  return Children.toArray(children).filter(isValidElement) as ReactElement<any>[];
}
function text(node: ReactNode): string {
  return Children.toArray(node)
    .map((n) =>
      typeof n === 'string' || typeof n === 'number'
        ? String(n)
        : isValidElement<any>(n)
          ? (n.props.label ?? text(n.props.children))
          : '',
    )
    .join(' ')
    .trim();
}
/** Existing table rows are the data contract: both views render the identical cell content/callbacks. */
export function ResponsivePlayerTable({
  children,
  className = '',
  mobileLabels,
  identityColumn = 0,
  actionColumn,
  mobileSort = true,
  ...props
}: TableHTMLAttributes<HTMLTableElement> & {
  mobileSort?: boolean;
  mobileLabels?: string[];
  identityColumn?: number;
  actionColumn?: number;
}) {
  const sections = elements(children);
  const headers = elements(sections.find((s) => s.type === 'thead')?.props.children).flatMap((r) =>
    elements(r.props.children),
  );
  const labels = mobileLabels ?? headers.map((h) => text(h));
  const action = actionColumn ?? labels.findIndex((l) => /^(actions?|add|select)$/i.test(l));
  const rows = elements(sections.find((s) => s.type === 'tbody')?.props.children);
  return (
    <>
      <table {...props} className={`${className} ${styles.desktop}`}>
        {children}
      </table>
      <div className={styles.mobile}>
        {mobileSort && (
          <PlayerSortSheet
            controls={headers.map((h) =>
              h.type === 'th' ? h.props.children : cloneElement(h, { as: 'span' }),
            )}
          />
        )}
        {rows.map((row, index) => {
          const cells = elements(row.props.children);
          if (cells.length === 1 && cells[0].props.colSpan > 1)
            return <div key={row.key ?? index}>{cells[0].props.children}</div>;
          return (
            <PlayerCard
              key={row.key ?? index}
              identity={cells[identityColumn]?.props.children}
              actions={action >= 0 ? cells[action]?.props.children : undefined}
              onClick={row.props.onClick}
              fields={cells.flatMap((cell, i) =>
                i === identityColumn || i === action
                  ? []
                  : [{ label: labels[i] || 'Details', value: cell.props.children }],
              )}
            />
          );
        })}
      </div>
    </>
  );
}
/** Adapter for existing CSS-grid player rows; metadata is supplied by the feature. */
export function ResponsivePlayerRow({
  children,
  labels,
  identityColumn = 0,
  actionColumn = -1,
  className = '',
  onClick,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  labels: string[];
  identityColumn?: number;
  actionColumn?: number;
}) {
  const cells = Children.toArray(children);
  return (
    <>
      <div {...props} className={`${className} ${styles.desktopRow}`} onClick={onClick}>
        {children}
      </div>
      <div className={styles.mobileRow}>
        <PlayerCard
          identity={cells[identityColumn]}
          actions={cells[actionColumn]}
          onClick={onClick as React.MouseEventHandler<HTMLElement>}
          fields={cells.flatMap((value, i) =>
            i === identityColumn || i === actionColumn
              ? []
              : [{ label: labels[i] || 'Details', value }],
          )}
        />
      </div>
    </>
  );
}

export function ResponsivePlayerLink({
  children,
  href,
  labels,
  identityColumn = 0,
  actionColumn = -1,
  className = '',
}: {
  children: ReactNode;
  href: string;
  labels: string[];
  identityColumn?: number;
  actionColumn?: number;
  className?: string;
}) {
  const cells = Children.toArray(children);
  return (
    <>
      <Link href={href} className={`${className} ${styles.desktopRow}`}>
        {children}
      </Link>
      <div className={styles.mobileRow}>
        <PlayerCard
          identity={<Link href={href}>{cells[identityColumn]}</Link>}
          fields={cells.flatMap((value, i) =>
            i === identityColumn || i === actionColumn
              ? []
              : [{ label: labels[i] || 'Details', value }],
          )}
        />
      </div>
    </>
  );
}

function sortable(node: ReactNode): boolean {
  return elements(node).some(
    (n) =>
      n.type === 'button' ||
      Boolean(n.props.onSort) ||
      Boolean(n.props.column) ||
      sortable(n.props.children),
  );
}
export function PlayerSortSheet({ controls }: { controls: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!sortable(controls)) return null;
  return (
    <>
      <button
        type="button"
        className={styles.direct}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        Sort ▾
      </button>
      {open && (
        <BottomSheet title="Sort players" onClose={() => setOpen(false)}>
          <div
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('button')) setOpen(false);
            }}
          >
            {elements(controls)
              .filter(sortable)
              .map((control, i) => (
                <div key={i}>{control}</div>
              ))}
          </div>
        </BottomSheet>
      )}
    </>
  );
}
export function PlayerTableHeader({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <>
      <div {...props} className={`${className} ${styles.desktopRow}`}>
        {children}
      </div>
      <div className={styles.mobileRow}>
        <PlayerSortSheet controls={children} />
      </div>
    </>
  );
}
export function ResponsivePlayerButton({
  children,
  labels,
  identityColumn = 0,
  identityColumns = [identityColumn],
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  labels: string[];
  identityColumn?: number;
  identityColumns?: number[];
}) {
  const cells = Children.toArray(children);
  return (
    <>
      <button {...props} className={`${className} ${styles.desktopRow}`}>
        {children}
      </button>
      <div className={styles.mobileRow}>
        <PlayerCard
          identity={
            <button {...props} className={styles.identityButton}>
              {identityColumns.map((i) => cells[i])}
            </button>
          }
          fields={cells.flatMap((value, i) =>
            identityColumns.includes(i) ? [] : [{ label: labels[i] || 'Details', value }],
          )}
        />
      </div>
    </>
  );
}
