import type { ConditionRow } from "../types/audience";
import { EVENT_TYPES, OPERATORS } from "../types/audience";

interface ConditionRowProps {
  condition: ConditionRow;
  index: number;
  isRemovable: boolean;
  onChange: (id: string, updates: Partial<ConditionRow>) => void;
  onRemove: (id: string) => void;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  page_view: "Page View",
  product_view: "Product View",
  add_to_cart: "Add to Cart",
  checkout_started: "Checkout Started",
  purchase: "Purchase",
};

const OPERATOR_LABELS: Record<string, string> = {
  at_least: "at least",
  exactly: "exactly",
};

export function ConditionRow({
  condition,
  index,
  isRemovable,
  onChange,
  onRemove,
}: ConditionRowProps) {
  const rowNumber = index + 1;

  return (
    <div
      role="group"
      aria-label={`Condition ${rowNumber}`}
      className="flex items-end gap-3 rounded-lg border border-border bg-surface-alt px-4 py-3 focus-within:border-border-focus transition-colors"
    >
      <span
        aria-hidden="true"
        className="shrink-0 pb-2 text-xs font-semibold text-text-hint min-w-5"
      >
        {rowNumber}
      </span>

      <div className="flex flex-1 flex-wrap gap-3">
        {/* Event type */}
        <div className="flex min-w-36 flex-1 flex-col gap-1">
          <label
            htmlFor={`event-type-${condition.id}`}
            className="text-xs font-medium text-text-secondary"
          >
            Event type
          </label>
          <select
            id={`event-type-${condition.id}`}
            value={condition.eventType}
            onChange={(e) =>
              onChange(condition.id, {
                eventType: e.target.value as (typeof EVENT_TYPES)[number],
              })
            }
          >
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {EVENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        {/* Operator */}
        <div className="flex min-w-28 flex-1 flex-col gap-1">
          <label
            htmlFor={`operator-${condition.id}`}
            className="text-xs font-medium text-text-secondary"
          >
            Operator
          </label>
          <select
            id={`operator-${condition.id}`}
            value={condition.operator}
            onChange={(e) =>
              onChange(condition.id, {
                operator: e.target.value as (typeof OPERATORS)[number],
              })
            }
          >
            {OPERATORS.map((op) => (
              <option key={op} value={op}>
                {OPERATOR_LABELS[op]}
              </option>
            ))}
          </select>
        </div>

        {/* Count */}
        <div className="flex w-24 shrink-0 flex-col gap-1">
          <label
            htmlFor={`count-${condition.id}`}
            className="text-xs font-medium text-text-secondary"
          >
            Count
          </label>
          <input
            id={`count-${condition.id}`}
            type="number"
            min={0}
            max={1_000_000}
            value={condition.count}
            onChange={(e) =>
              onChange(condition.id, { count: parseInt(e.target.value, 10) })
            }
          />
        </div>

        {/* Within days */}
        <div className="flex w-24 shrink-0 flex-col gap-1">
          <label
            htmlFor={`within-days-${condition.id}`}
            className="text-xs font-medium text-text-secondary"
          >
            Within days
          </label>
          <input
            id={`within-days-${condition.id}`}
            type="number"
            min={1}
            max={365}
            value={condition.withinDays}
            onChange={(e) =>
              onChange(condition.id, {
                withinDays: parseInt(e.target.value, 10),
              })
            }
          />
        </div>
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={() => onRemove(condition.id)}
        disabled={!isRemovable}
        aria-label={
          isRemovable
            ? `Remove condition ${rowNumber}`
            : "Cannot remove the only condition"
        }
        title={isRemovable ? undefined : "At least one condition is required"}
        className="mb-0.5 shrink-0 rounded border border-border px-3 py-2.5 text-xs text-text-secondary transition-colors hover:border-error-border hover:bg-error-bg hover:text-error disabled:cursor-not-allowed disabled:opacity-40"
      >
        ✕
      </button>
    </div>
  );
}
