import React, {
  forwardRef,
  ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

interface DocumentPictureInPictureController {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPictureController;
  }
}

export interface TaskPanelPictureInPictureBridgeHandle {
  open: () => Promise<void>;
  close: () => void;
}

const copyThemeVariables = (target: HTMLElement, themeVariables: Record<string, string>) => {
  Object.entries(themeVariables).forEach(([key, value]) => {
    target.style.setProperty(key, value);
  });
};

const syncHeadStyles = (targetDocument: Document) => {
  Array.from(targetDocument.head.querySelectorAll('[data-pip-clone="true"]')).forEach((node) => node.remove());

  Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]')).forEach((node) => {
    const clone = node.cloneNode(true) as HTMLElement;
    clone.setAttribute('data-pip-clone', 'true');
    targetDocument.head.appendChild(clone);
  });
};

export const TaskPanelPictureInPictureBridge = forwardRef<TaskPanelPictureInPictureBridgeHandle, {
  title: string;
  themeVariables: Record<string, string>;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}>(({ title, themeVariables, onOpenChange, children }, ref) => {
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  const pipWindowRef = useRef<Window | null>(null);
  const headObserverRef = useRef<MutationObserver | null>(null);
  const closeHandlerRef = useRef<(() => void) | null>(null);

  const teardownWindow = useCallback((shouldNotify: boolean) => {
    headObserverRef.current?.disconnect();
    headObserverRef.current = null;

    const pipWindow = pipWindowRef.current;
    const closeHandler = closeHandlerRef.current;

    if (pipWindow && closeHandler) {
      pipWindow.removeEventListener('pagehide', closeHandler);
    }

    closeHandlerRef.current = null;
    pipWindowRef.current = null;
    setPortalNode(null);

    if (shouldNotify) onOpenChange(false);
  }, [onOpenChange]);

  const close = useCallback(() => {
    const pipWindow = pipWindowRef.current;
    teardownWindow(true);

    if (pipWindow && !pipWindow.closed) {
      pipWindow.close();
    }
  }, [teardownWindow]);

  const open = useCallback(async () => {
    if (!window.documentPictureInPicture) return;

    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.focus();
      return;
    }

    const pipWindow = await window.documentPictureInPicture.requestWindow({
      width: 460,
      height: 680,
    });
    const targetDocument = pipWindow.document;
    pipWindowRef.current = pipWindow;

    targetDocument.title = title;
    targetDocument.body.innerHTML = '';
    targetDocument.body.className = 'pip-window-body';

    syncHeadStyles(targetDocument);

    const root = targetDocument.createElement('div');
    root.id = 'pip-root';
    root.className = 'pip-window-root';
    targetDocument.body.appendChild(root);

    copyThemeVariables(targetDocument.documentElement, themeVariables);
    copyThemeVariables(targetDocument.body, themeVariables);
    targetDocument.documentElement.style.colorScheme = getComputedStyle(document.documentElement).colorScheme;

    const handleWindowClosed = () => {
      teardownWindow(true);
    };

    closeHandlerRef.current = handleWindowClosed;
    pipWindow.addEventListener('pagehide', handleWindowClosed, { once: true });

    const observer = new MutationObserver(() => syncHeadStyles(targetDocument));
    observer.observe(document.head, { childList: true, subtree: true, attributes: true, characterData: true });
    headObserverRef.current = observer;

    setPortalNode(root);
    onOpenChange(true);
  }, [onOpenChange, teardownWindow, themeVariables, title]);

  useImperativeHandle(ref, () => ({ open, close }), [close, open]);

  useEffect(() => {
    const pipWindow = pipWindowRef.current;
    if (!pipWindow || pipWindow.closed) return;

    pipWindow.document.title = title;
    copyThemeVariables(pipWindow.document.documentElement, themeVariables);
    copyThemeVariables(pipWindow.document.body, themeVariables);
  }, [themeVariables, title]);

  useEffect(() => () => {
    const pipWindow = pipWindowRef.current;
    teardownWindow(false);
    if (pipWindow && !pipWindow.closed) {
      pipWindow.close();
    }
  }, [teardownWindow]);

  return portalNode ? createPortal(children, portalNode) : null;
});

TaskPanelPictureInPictureBridge.displayName = 'TaskPanelPictureInPictureBridge';
