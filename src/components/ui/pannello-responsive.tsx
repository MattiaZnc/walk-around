import type * as React from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useDesktop } from '@/lib/use-media-query';

type Props = {
  aperto: boolean;
  onCambioApertura: (aperto: boolean) => void;
  titolo: string;
  descrizione?: string;
  children: React.ReactNode;
};

/**
 * Dialog centrato su desktop, drawer a tutto schermo su telefono.
 * Entrambi i componenti gestiscono focus trap ed Escape, quindi la scelta
 * non incide sull'accessibilità.
 */
export function PannelloResponsive({
  aperto,
  onCambioApertura,
  titolo,
  descrizione,
  children,
}: Props) {
  const desktop = useDesktop();

  if (desktop) {
    return (
      <Dialog open={aperto} onOpenChange={onCambioApertura}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{titolo}</DialogTitle>
            {descrizione ? <DialogDescription>{descrizione}</DialogDescription> : null}
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={aperto} onOpenChange={onCambioApertura}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{titolo}</DrawerTitle>
          {descrizione ? <DrawerDescription>{descrizione}</DrawerDescription> : null}
        </DrawerHeader>
        {children}
      </DrawerContent>
    </Drawer>
  );
}
