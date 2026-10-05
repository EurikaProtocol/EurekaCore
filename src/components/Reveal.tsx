import type { ElementType, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { classNames } from './ui';

export function Reveal({ children, className, as: Tag = 'div', delay = 0, id }: { id?: string; children: ReactNode; className?: string; as?: ElementType; delay?: number }) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.12 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag id={id} className={classNames('eu-reveal', visible && 'is-visible', className)} ref={ref} style={{ scrollMarginTop: '5rem', ...(delay ? { transitionDelay: `${delay}ms` } : {}) }}>
      {children}
    </Tag>
  );
}
