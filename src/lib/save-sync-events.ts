export const SAVE_DATA_UPDATED_EVENT = 'falco:save-data-updated';

export type SaveDataUpdatedDetail = {
  saveId: string;
  teamAbbr?: string | null;
  reason?:
    | 'trade-offer-accepted'
    | 'trade-accepted'
    | 'free-agent-signed'
    | 'roster-updated'
    | 'save-restored'
    | string;
};

export const dispatchSaveDataUpdated = (detail: SaveDataUpdatedDetail) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<SaveDataUpdatedDetail>(SAVE_DATA_UPDATED_EVENT, { detail }));
};

export const subscribeToSaveDataUpdated = (
  listener: (detail: SaveDataUpdatedDetail) => void,
) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<SaveDataUpdatedDetail>;
    if (!customEvent.detail?.saveId) return;
    listener(customEvent.detail);
  };

  window.addEventListener(SAVE_DATA_UPDATED_EVENT, handler as EventListener);
  return () => {
    window.removeEventListener(SAVE_DATA_UPDATED_EVENT, handler as EventListener);
  };
};
