import { useCallback, useState } from 'react';

type Modal = {
  open: boolean;
  openModal: () => void;
  closeModal: () => void;
};

export function useModal(): Modal {
  const [open, setOpen] = useState(false);

  const openModal = useCallback((): void => setOpen(true), []);
  const closeModal = useCallback((): void => setOpen(false), []);

  return { open, openModal, closeModal };
}
