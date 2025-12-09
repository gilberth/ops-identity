import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Client {
    id: string;
    name: string;
    contact_email?: string;
}

interface ClientContextType {
    currentClient: Client | null;
    isClientSelected: boolean;
    selectClient: (client: Client) => void;
    clearClient: () => void;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export const ClientProvider = ({ children }: { children: ReactNode }) => {
    const [currentClient, setCurrentClient] = useState<Client | null>(null);

    useEffect(() => {
        // Load from local storage on mount
        const savedClient = localStorage.getItem('ops-selected-client');
        if (savedClient) {
            try {
                setCurrentClient(JSON.parse(savedClient));
            } catch (e) {
                console.error("Failed to parse saved client", e);
                localStorage.removeItem('ops-selected-client');
            }
        }
    }, []);

    const selectClient = (client: Client) => {
        setCurrentClient(client);
        localStorage.setItem('ops-selected-client', JSON.stringify(client));
    };

    const clearClient = () => {
        setCurrentClient(null);
        localStorage.removeItem('ops-selected-client');
    };

    return (
        <ClientContext.Provider value={{
            currentClient,
            isClientSelected: !!currentClient,
            selectClient,
            clearClient
        }}>
            {children}
        </ClientContext.Provider>
    );
};

export const useClient = () => {
    const context = useContext(ClientContext);
    if (context === undefined) {
        throw new Error('useClient must be used within a ClientProvider');
    }
    return context;
};
