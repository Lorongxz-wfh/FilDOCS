import { useState, useCallback } from "react";

export function useBulkActions<T>(
  items: T[],
  rowKey: (item: T) => string | number,
  canAction: (item: T, action: string) => boolean = () => true
) {
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  const toggleRow = useCallback((id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === items.length && items.length > 0) {
        return new Set();
      }
      const next = new Set<string | number>();
      items.forEach((item) => next.add(rowKey(item)));
      return next;
    });
  }, [items, rowKey]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectionCount = selectedIds.size;

  const getActionableCount = useCallback((action: string) => {
    return items.filter(i => selectedIds.has(rowKey(i)) && canAction(i, action)).length;
  }, [items, selectedIds, rowKey, canAction]);

  const getActionableItems = useCallback((action: string) => {
    return items.filter(i => selectedIds.has(rowKey(i)) && canAction(i, action));
  }, [items, selectedIds, rowKey, canAction]);

  const getSelectedItems = useCallback(() => {
    return items.filter(i => selectedIds.has(rowKey(i)));
  }, [items, selectedIds, rowKey]);

  return {
    selectedIds,
    setSelectedIds,
    isSelectMode,
    setIsSelectMode,
    toggleRow,
    toggleAll,
    clearSelection,
    selectionCount,
    getActionableCount,
    getActionableItems,
    getSelectedItems,
  };
}
