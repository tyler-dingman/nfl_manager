export const DEFAULT_BEAT_PAGE_SIZE = 20;

export type BeatPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export const parseBeatPage = (value: string | null | undefined) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

export function visiblePageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const values = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  return [...values].filter((page) => page > 0 && page <= totalPages).sort((a, b) => a - b);
}
