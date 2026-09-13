import './webLayout.css';

export function setDocumentBackground(color: string) {
  if (typeof document !== 'undefined') document.documentElement.style.setProperty('--mistakeos-canvas', color);
}
