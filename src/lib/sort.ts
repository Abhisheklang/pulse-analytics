import type { QueryFilters } from './types';

// P-ADV-2: pagedRawQuery interpolates orderBy into raw SQL, so the sink
// itself only accepts a plain column reference: an optionally quoted
// identifier, optionally qualified by one table or alias identifier.
// Anything else (expressions, subqueries, function calls, extra keywords)
// is dropped, and the caller falls back to its default ordering. The sort
// direction is handled separately as a boolean, never as part of this value.
const RAW_ORDER_BY_PATTERN =
  /^"?[A-Za-z_][A-Za-z0-9_]*"?(\."?[A-Za-z_][A-Za-z0-9_]*"?)?$/;

export function sanitizeRawOrderBy(orderBy?: string | null): string | undefined {
  if (!orderBy) {
    return undefined;
  }

  return RAW_ORDER_BY_PATTERN.test(orderBy) ? orderBy : undefined;
}

export function sanitizeSortFilters<const T extends readonly string[]>(
  filters: QueryFilters = {},
  allowedFields: T,
  defaults: Partial<Pick<QueryFilters, 'orderBy' | 'sortDescending'>> = {},
): QueryFilters {
  const { orderBy, sortDescending, ...rest } = filters;
  const fallbackOrderBy = defaults.orderBy;
  const fallbackSortDescending = defaults.sortDescending;
  const isAllowed = orderBy ? allowedFields.includes(orderBy as T[number]) : false;

  return {
    ...rest,
    ...(isAllowed
      ? {
          orderBy,
          sortDescending,
        }
      : {
          ...(fallbackOrderBy && { orderBy: fallbackOrderBy }),
          ...(fallbackSortDescending !== undefined && {
            sortDescending: fallbackSortDescending,
          }),
        }),
  };
}
