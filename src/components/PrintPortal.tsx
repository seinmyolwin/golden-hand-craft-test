import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

export interface PrintPortalProps {
  children: React.ReactNode;
}

/**
 * Portals printable voucher content into a dedicated #print-portal-root element
 * appended directly to document.body, isolating it completely from #root and min-h-screen.
 */
export const PrintPortal: React.FC<PrintPortalProps> = ({ children }) => {
  const [container, setContainer] = useState<HTMLElement | null>(() => {
    if (typeof document === 'undefined') return null;
    let el = document.getElementById('print-portal-root');
    if (!el && document.body) {
      el = document.createElement('div');
      el.id = 'print-portal-root';
      document.body.appendChild(el);
    }
    return el;
  });

  useEffect(() => {
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.add('has-print-portal');
    }

    if (!container && typeof document !== 'undefined' && document.body) {
      let el = document.getElementById('print-portal-root');
      if (!el) {
        el = document.createElement('div');
        el.id = 'print-portal-root';
        document.body.appendChild(el);
      }
      setContainer(el);
    }

    return () => {
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.remove('has-print-portal');
      }
      const el = typeof document !== 'undefined' ? document.getElementById('print-portal-root') : null;
      if (el) {
        el.innerHTML = '';
      }
    };
  }, [container]);

  if (!container) return null;

  return ReactDOM.createPortal(children, container);
};
