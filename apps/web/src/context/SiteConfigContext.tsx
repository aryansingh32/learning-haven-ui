import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '@/services/api.svc';

interface SiteConfig {
    hero_title: string;
    hero_subtitle: string;
    primary_color: string;
    trending_categories: string;
    features_json: string;
}

const defaultSiteConfig: SiteConfig = {
    hero_title: 'Master Your Craft',
    hero_subtitle: 'The best place to learn and build real-world projects.',
    primary_color: '#f97316', // default orange
    trending_categories: 'Frontend,Backend,DevOps',
    features_json: '[]'
};

const SiteConfigContext = createContext<SiteConfig>(defaultSiteConfig);

export const SiteConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<SiteConfig>(defaultSiteConfig);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                // We use the public settings endpoint so normal users don't get 403
                const data = await api.get('/settings/public');
                if (data && typeof data === 'object') {
                    // Extract values from the API response
                    const merged = { ...defaultSiteConfig };
                    
                    // The keys are returned directly from the public endpoint
                    if (data.hero_title) merged.hero_title = data.hero_title;
                    if (data.hero_subtitle) merged.hero_subtitle = data.hero_subtitle;
                    if (data.primary_color) merged.primary_color = data.primary_color;
                    if (data.trending_categories) merged.trending_categories = data.trending_categories;
                    
                    setConfig(merged);
                    
                    // Inject CSS Variables for Theme Overrides (Removed to prevent HSL format conflicts)
                }
            } catch (error) {
                // Ignore 404s or network errors silently to avoid console spam, fallback to default
                console.debug("Using default site config");
            }
        };

        fetchConfig();
    }, []);

    return (
        <SiteConfigContext.Provider value={config}>
            {children}
        </SiteConfigContext.Provider>
    );
};

export const useSiteConfig = () => {
    return useContext(SiteConfigContext);
};
