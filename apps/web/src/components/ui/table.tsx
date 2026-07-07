import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TableColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
}

export interface TableProps<T> {
  columns: Array<TableColumn<T>>;
  rows: readonly T[];
  rowKey: (row: T) => string;
  caption?: string;
  emptyMessage?: string;
}

/**
 * Generic data table. Horizontal scroll lives on the wrapper so wide CSV
 * previews never break the page layout; the header is sticky for long lists.
 */
export function Table<T>({
  columns,
  rows,
  rowKey,
  caption,
  emptyMessage = "No data to display.",
}: TableProps<T>) {
  return (
    <div className="max-h-[32rem] overflow-auto rounded-lg border border-border">
      <table className="min-w-full border-collapse text-left text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="sticky top-0 z-10 bg-surface-muted">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "whitespace-nowrap border-b border-border px-4 py-3 font-semibold",
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-border last:border-b-0">
                {columns.map((column) => (
                  <td key={column.key} className={cn("px-4 py-3", column.className)}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
