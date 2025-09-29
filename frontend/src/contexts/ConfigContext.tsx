"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface PublicConfig {
  company: string;
  env: string;
  parentCompany: string;
  siteUrl: string;
  stripePublishableKey: string;
  supportEmail: string;
  authProvider: string;
  databaseProvider: string;
  btcPayServerUrl: string;
}

interface ConfigContextType {
  config: PublicConfig | null;
  isLoading: boolean;
  error: string | null;
}

const ConfigContext = createContext<ConfigContextType>({
  config: null,
  isLoading: true,
  error: null,
});

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return context;
};

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch("/api/config");
        if (!response.ok) {
          throw new Error("Failed to fetch configuration");
        }
        const data = await response.json();
        setConfig(data);
        setError(null);
      } catch (err) {
        console.error("Error fetching config:", err);
        setError(err instanceof Error ? err.message : "Failed to load configuration");

        // Fallback to default values for development
        setConfig({
          company: "KeyFate",
          env: "development",
          parentCompany: "Aviat, LLC",
          siteUrl: "http://localhost:3000",
          stripePublishableKey: "",
          supportEmail: "support@keyfate.com",
          authProvider: "google",
          databaseProvider: "cloudsql",
          btcPayServerUrl: "",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, []);

  return (
    <ConfigContext.Provider value={{ config, isLoading, error }}>
      {children}
    </ConfigContext.Provider>
  );
}