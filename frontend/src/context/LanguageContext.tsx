import React, { createContext, useContext, useState } from 'react';
import { translations, type Language } from '../i18n/translations';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string, params?: Record<string, any>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Default to Spanish, try to get from localStorage
    const [language, setLanguageState] = useState<Language>(() => {
        const saved = localStorage.getItem('trustonic_language');
        return (saved as Language) || 'es';
    });

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('trustonic_language', lang);
    };

    const t = (key: string, params?: Record<string, any>): string => {
        const translation = (translations[language] as any)[key] || (translations['es'] as any)[key] || key;

        if (params) {
            let result = translation;
            Object.entries(params).forEach(([k, v]) => {
                result = result.replace(`{${k}}`, String(v));
            });
            return result;
        }

        return translation;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
