import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface SetupResponse {
    success: boolean;
    message?: string;
    client_id?: string;
    redirect_uri?: string;
    next_step?: string;
    error?: string;
    step?: string;
}

const AuthentikSetup = () => {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState<SetupResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        authentik_url: "",
        api_token: "",
        app_url: ""
    });

    // Auto-detect application URL
    useEffect(() => {
        if (typeof window !== "undefined") {
            const protocol = window.location.protocol;
            const host = window.location.host;
            setFormData(prev => ({ ...prev, app_url: `${protocol}//${host}` }));
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            // Using /api/setup endpoint
            // Ensure we use the full URL if in dev mode or rely on proxy
            // The backend is on the same host in production, or different port in dev
            // We'll use the relative path assuming proxy or same origin
            const ENDPOINT = import.meta.env.VITE_VPS_ENDPOINT ? `${import.meta.env.VITE_VPS_ENDPOINT}/api/setup` : '/api/setup';

            const response = await fetch(ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                setSuccess(result);
            } else {
                setError(result.error || "An unknown error occurred during setup.");
            }
        } catch (err: any) {
            setError(`Connection error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4 font-sans">
            <Card className="w-full max-w-lg shadow-2xl border-0 rounded-xl overflow-hidden">
                <CardHeader className="bg-white pb-2 pt-8 px-8">
                    <CardTitle className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <span className="text-3xl">🔧</span> Authentik Setup Wizard
                    </CardTitle>
                    <CardDescription className="text-gray-500 mt-2 text-base">
                        Configura automáticamente la autenticación OAuth2 con Authentik en un solo paso.
                    </CardDescription>
                </CardHeader>

                <CardContent className="p-8 bg-white">
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r-md">
                        <h3 className="text-blue-700 font-semibold mb-2">📋 Antes de comenzar:</h3>
                        <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
                            <li>URL de tu instancia Authentik</li>
                            <li>Token de API con permisos de Provider y App</li>
                            <li>URL de esta aplicación (detectada automáticamente)</li>
                        </ol>
                    </div>

                    {success && (
                        <Alert className="mb-6 bg-green-50 border-green-200 text-green-900">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <AlertTitle className="text-lg font-bold text-green-800">¡Éxito!</AlertTitle>
                            <AlertDescription className="mt-2">
                                <p>{success.message}</p>
                                <div className="mt-4 p-3 bg-white/60 rounded border border-green-100 text-sm font-mono space-y-2 text-green-800">
                                    <p><strong>Client ID:</strong> {success.client_id}</p>
                                    <p><strong>Redirect URI:</strong> {success.redirect_uri}</p>
                                </div>
                                <p className="mt-4 font-semibold">{success.next_step}</p>

                                <Button
                                    onClick={() => window.location.href = '/'}
                                    className="mt-4 bg-green-600 hover:bg-green-700 text-white w-full"
                                >
                                    Ir al Inicio
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}

                    {error && (
                        <Alert variant="destructive" className="mb-6">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="authentik_url" className="text-gray-700 font-semibold">URL de Authentik</Label>
                            <Input
                                id="authentik_url"
                                type="url"
                                placeholder="https://auth.example.com"
                                required
                                value={formData.authentik_url}
                                onChange={(e) => setFormData({ ...formData, authentik_url: e.target.value })}
                                className="h-11 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                            />
                            <p className="text-xs text-gray-400">URL base de tu servidor (sin trailing slash)</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="api_token" className="text-gray-700 font-semibold">Token de API</Label>
                            <Input
                                id="api_token"
                                type="password"
                                placeholder="••••••••••••••••••••"
                                required
                                value={formData.api_token}
                                onChange={(e) => setFormData({ ...formData, api_token: e.target.value })}
                                className="h-11 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                            />
                            <p className="text-xs text-gray-400">Token con scope de lectura/escritura para Core y Providers</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="app_url" className="text-gray-700 font-semibold">URL de esta aplicación</Label>
                            <Input
                                id="app_url"
                                type="url"
                                required
                                value={formData.app_url}
                                onChange={(e) => setFormData({ ...formData, app_url: e.target.value })}
                                className="h-11 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 bg-gray-50"
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
                            disabled={loading || !!success}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Configurando...
                                </>
                            ) : (
                                "Configurar Authentik"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default AuthentikSetup;
