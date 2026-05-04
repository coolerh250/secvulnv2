import { createContext, useContext, useState } from 'react';

export const LangContext = createContext('zh');
export const useLang = () => useContext(LangContext);

export function LangProvider({ children }) {
  const [lang, setLang] = useState('zh');
  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}
