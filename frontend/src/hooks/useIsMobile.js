import { useEffect, useState } from 'react';

const QUERY = '(max-width: 767px)';

/** true cuando el viewport es de celular (< md de Tailwind). Se actualiza al rotar/redimensionar. */
export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}
