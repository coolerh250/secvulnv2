import { createContext, useContext, useState } from 'react';

export const LangContext = createContext('zh');
export const useLang = () => useContext(LangContext);

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'zh');
  const changeLang = (l) => { localStorage.setItem('lang', l); setLang(l); };
  return <LangContext.Provider value={{ lang, setLang: changeLang }}>{children}</LangContext.Provider>;
}
