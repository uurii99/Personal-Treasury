import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export function Modal({ open, onOpenChange, title, description, children, size = 'md' }: ModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm
            data-[state=open]:animate-[fade-in_200ms_ease-out]
            data-[state=closed]:animate-[fade-in_200ms_ease-out_reverse]"
        />
        <DialogPrimitive.Content
          className={`
            fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2
            w-[calc(100%-2rem)] ${sizeClasses[size]}
            bg-white dark:bg-surface-900
            border border-surface-200 dark:border-surface-800
            rounded-xl shadow-modal
            p-6
            data-[state=open]:animate-[scale-in_200ms_cubic-bezier(0.16,1,0.3,1)]
            focus:outline-none
            max-h-[85vh] overflow-y-auto
          `}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <DialogPrimitive.Title className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="text-sm text-surface-500 mt-1">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800 dark:hover:text-surface-300 transition-colors"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
