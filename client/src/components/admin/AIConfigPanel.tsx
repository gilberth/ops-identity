import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Save, Eye, EyeOff, Github, LogOut, Copy, Check, Loader2, ExternalLink } from "lucide-react";
import { getApiEndpoint } from "@/utils/api";

interface CopilotModel {
  id: string;
  name: string;
  description: string;
}

interface CopilotConfig {
  authenticated: boolean;
  userLogin: string | null;
  tokenValid: boolean;
  selectedModel: string;
  models: CopilotModel[];
}

interface AIConfig {
  provider: string;
  model: string;
  available_providers: {
    openai: boolean;
    gemini: boolean;
    deepseek: boolean;
    anthropic: boolean;
    copilot: boolean;
  };
  models: {
    openai: string[];
    gemini: string[];
    deepseek: string[];
    anthropic: string[];
    copilot: string[];
  };
  copilot?: CopilotConfig;
}

interface DeviceFlowState {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

const AIConfigPanel = () => {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  const [apiKeys, setApiKeys] = useState({
    openai: '',
    gemini: '',
    deepseek: '',
    anthropic: ''
  });
  
  // Copilot OAuth state
  const [copilotConnecting, setCopilotConnecting] = useState(false);
  const [deviceFlow, setDeviceFlow] = useState<DeviceFlowState | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [pollStatus, setPollStatus] = useState<string>('');
  const pollIntervalRef = useRef<number | null>(null);

  const VPS_ENDPOINT = getApiEndpoint();

  useEffect(() => {
    loadConfig();
    return () => {
      // Cleanup polling on unmount
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch(`${VPS_ENDPOINT}/api/config/ai`);
      if (!response.ok) throw new Error('Failed to load config');
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error('Error loading AI config:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar la configuración de IA",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        provider: config?.provider,
        model: config?.model,
        api_keys: {}
      };

      if (apiKeys.openai) payload.api_keys.openai = apiKeys.openai;
      if (apiKeys.gemini) payload.api_keys.gemini = apiKeys.gemini;
      if (apiKeys.deepseek) payload.api_keys.deepseek = apiKeys.deepseek;
      if (apiKeys.anthropic) payload.api_keys.anthropic = apiKeys.anthropic;

      const response = await fetch(`${VPS_ENDPOINT}/api/config/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to save config');

      toast({
        title: "Exito",
        description: "Configuracion de IA actualizada correctamente"
      });

      setApiKeys({ openai: '', gemini: '', deepseek: '', anthropic: '' });
      loadConfig();
    } catch (error) {
      console.error('Error saving AI config:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la configuracion",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // =========================================================================
  // Copilot OAuth Device Flow
  // =========================================================================
  
  const startCopilotAuth = async () => {
    setCopilotConnecting(true);
    setPollStatus('Iniciando autorizacion...');
    
    try {
      const response = await fetch(`${VPS_ENDPOINT}/api/copilot/auth/start`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to start device flow');
      
      const data = await response.json();
      setDeviceFlow({
        deviceCode: data.deviceCode,
        userCode: data.userCode,
        verificationUri: data.verificationUri,
        expiresIn: data.expiresIn,
        interval: data.interval
      });
      
      // Open GitHub authorization page in new window
      window.open(data.verificationUri, '_blank', 'width=600,height=700');
      
      // Start polling
      setPollStatus('Esperando autorizacion en GitHub...');
      startPolling(data.deviceCode, data.interval);
      
    } catch (error) {
      console.error('Error starting Copilot auth:', error);
      toast({
        title: "Error",
        description: "No se pudo iniciar la autenticacion con GitHub",
        variant: "destructive"
      });
      setCopilotConnecting(false);
    }
  };

  const startPolling = useCallback((deviceCode: string, interval: number) => {
    // Clear any existing polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    const pollFn = async () => {
      try {
        const response = await fetch(`${VPS_ENDPOINT}/api/copilot/auth/poll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceCode })
        });
        
        const result = await response.json();
        
        switch (result.status) {
          case 'success':
            // Clear polling
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            
            toast({
              title: "Conectado",
              description: `Conectado como ${result.data?.userLogin || 'GitHub User'}`
            });
            
            setDeviceFlow(null);
            setCopilotConnecting(false);
            setPollStatus('');
            loadConfig();
            break;
            
          case 'pending':
            setPollStatus('Esperando autorizacion en GitHub...');
            break;
            
          case 'expired':
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            toast({
              title: "Codigo expirado",
              description: "El codigo de autorizacion ha expirado. Intenta de nuevo.",
              variant: "destructive"
            });
            setDeviceFlow(null);
            setCopilotConnecting(false);
            setPollStatus('');
            break;
            
          case 'denied':
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            toast({
              title: "Acceso denegado",
              description: "Has denegado el acceso a GitHub Copilot.",
              variant: "destructive"
            });
            setDeviceFlow(null);
            setCopilotConnecting(false);
            setPollStatus('');
            break;
            
          case 'error':
            console.error('Polling error:', result.error);
            break;
        }
      } catch (error) {
        console.error('Polling request failed:', error);
      }
    };
    
    // Poll immediately, then at interval
    pollFn();
    pollIntervalRef.current = window.setInterval(pollFn, (interval + 1) * 1000);
  }, [VPS_ENDPOINT]);

  const cancelCopilotAuth = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setDeviceFlow(null);
    setCopilotConnecting(false);
    setPollStatus('');
  };

  const disconnectCopilot = async () => {
    try {
      const response = await fetch(`${VPS_ENDPOINT}/api/copilot/auth/logout`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to logout');
      
      toast({
        title: "Desconectado",
        description: "Has cerrado sesion de GitHub Copilot"
      });
      
      loadConfig();
    } catch (error) {
      console.error('Error disconnecting Copilot:', error);
      toast({
        title: "Error",
        description: "No se pudo cerrar sesion",
        variant: "destructive"
      });
    }
  };

  const setCopilotModel = async (model: string) => {
    try {
      const response = await fetch(`${VPS_ENDPOINT}/api/copilot/model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model })
      });
      
      if (!response.ok) throw new Error('Failed to set model');
      
      toast({
        title: "Modelo actualizado",
        description: `Modelo de Copilot cambiado a ${model}`
      });
      
      loadConfig();
    } catch (error) {
      console.error('Error setting Copilot model:', error);
    }
  };

  const copyUserCode = () => {
    if (deviceFlow?.userCode) {
      navigator.clipboard.writeText(deviceFlow.userCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  if (loading || !config) {
    return (
      <div className="panel p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground text-sm">Cargando configuracion...</p>
      </div>
    );
  }

  const providerLabels: { [key: string]: string } = {
    openai: 'OpenAI',
    gemini: 'Google Gemini',
    deepseek: 'DeepSeek',
    anthropic: 'Anthropic (Claude)',
    copilot: 'GitHub Copilot'
  };

  return (
    <div className="panel overflow-hidden">
      <div className="panel-header">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Configuracion de IA</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configura el proveedor y modelo de inteligencia artificial para el analisis de seguridad
          </p>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* GitHub Copilot Section */}
        <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 p-4 rounded-lg border border-purple-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Github className="h-5 w-5 text-purple-400" />
              <h3 className="font-semibold text-sm">GitHub Copilot</h3>
              {config.copilot?.authenticated && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                  Conectado
                </Badge>
              )}
            </div>
            
            {config.copilot?.authenticated ? (
              <Button
                variant="outline"
                size="sm"
                onClick={disconnectCopilot}
                className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                <LogOut className="h-3 w-3 mr-1" />
                Desconectar
              </Button>
            ) : (
              <Button
                onClick={startCopilotAuth}
                disabled={copilotConnecting}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs"
              >
                {copilotConnecting ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <Github className="h-3 w-3 mr-1" />
                    Conectar con GitHub
                  </>
                )}
              </Button>
            )}
          </div>
          
          {/* Device Flow Modal/Status */}
          {deviceFlow && (
            <div className="bg-background/50 p-4 rounded-lg border border-border mt-3">
              <p className="text-sm text-muted-foreground mb-3">
                Ingresa este codigo en GitHub para autorizar:
              </p>
              
              <div className="flex items-center justify-center gap-2 mb-3">
                <code className="text-2xl font-mono font-bold tracking-widest text-purple-400 bg-purple-500/10 px-4 py-2 rounded">
                  {deviceFlow.userCode}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyUserCode}
                  className="h-10"
                >
                  {codeCopied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-3">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{pollStatus}</span>
              </div>
              
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(deviceFlow.verificationUri, '_blank')}
                  className="text-xs"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Abrir GitHub
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelCopilotAuth}
                  className="text-xs text-muted-foreground"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
          
          {/* Connected Status */}
          {config.copilot?.authenticated && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Usuario:</span>
                <span className="font-medium">@{config.copilot.userLogin}</span>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Modelo de Copilot
                </Label>
                <Select
                  value={config.copilot.selectedModel}
                  onValueChange={setCopilotModel}
                >
                  <SelectTrigger className="h-9 rounded-lg border-purple-500/30 bg-purple-500/5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {config.copilot.models?.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex flex-col">
                          <span>{m.name}</span>
                          <span className="text-xs text-muted-foreground">{m.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Usa tu suscripcion de GitHub Copilot para acceder a GPT-4o, Claude, Gemini y mas sin claves API adicionales.
              </p>
            </div>
          )}
          
          {!config.copilot?.authenticated && !deviceFlow && (
            <p className="text-xs text-muted-foreground mt-2">
              Conecta tu cuenta de GitHub para usar los modelos de Copilot (GPT-4o, Claude, Gemini) sin necesidad de claves API individuales.
            </p>
          )}
        </div>

        {/* Provider Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="provider" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Proveedor de IA</Label>
            <Select
              value={config.provider}
              onValueChange={(value) => setConfig({ ...config, provider: value, model: config.models[value as keyof typeof config.models]?.[0] || '' })}
            >
              <SelectTrigger id="provider" className="h-10 rounded-lg border-border bg-secondary/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="copilot" disabled={!config.available_providers.copilot}>
                  <div className="flex items-center gap-2">
                    <Github className="h-4 w-4" />
                    GitHub Copilot
                  </div>
                  {config.available_providers.copilot && <Badge className="ml-2 badge-low text-xs">Conectado</Badge>}
                </SelectItem>
                <SelectItem value="openai" disabled={!config.available_providers.openai && !apiKeys.openai}>
                  OpenAI {config.available_providers.openai && <Badge className="ml-2 badge-low text-xs">Configurado</Badge>}
                </SelectItem>
                <SelectItem value="gemini" disabled={!config.available_providers.gemini && !apiKeys.gemini}>
                  Google Gemini {config.available_providers.gemini && <Badge className="ml-2 badge-low text-xs">Configurado</Badge>}
                </SelectItem>
                <SelectItem value="deepseek" disabled={!config.available_providers.deepseek && !apiKeys.deepseek}>
                  DeepSeek {config.available_providers.deepseek && <Badge className="ml-2 badge-low text-xs">Configurado</Badge>}
                </SelectItem>
                <SelectItem value="anthropic" disabled={!config.available_providers.anthropic && !apiKeys.anthropic}>
                  Anthropic (Claude) {config.available_providers.anthropic && <Badge className="ml-2 badge-low text-xs">Configurado</Badge>}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Modelo</Label>
            <Select
              value={config.model}
              onValueChange={(value) => setConfig({ ...config, model: value })}
              disabled={!config.provider || config.provider === 'copilot'}
            >
              <SelectTrigger id="model" className="h-10 rounded-lg border-border bg-secondary/50">
                <SelectValue placeholder={config.provider === 'copilot' ? 'Configura arriba' : 'Selecciona un modelo'} />
              </SelectTrigger>
              <SelectContent>
                {config.provider && config.provider !== 'copilot' && config.models[config.provider as keyof typeof config.models]?.length > 0 ? (
                  config.models[config.provider as keyof typeof config.models].map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    {config.provider === 'copilot' ? 'Usa el selector de modelo de Copilot arriba' : 'No hay modelos disponibles'}
                  </div>
                )}
              </SelectContent>
            </Select>
            {config.provider === 'copilot' && (
              <p className="text-xs text-muted-foreground">
                El modelo de Copilot se configura en la seccion de GitHub Copilot arriba
              </p>
            )}
          </div>
        </div>

        {/* API Keys */}
        <div className="space-y-4 border-t border-border pt-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Claves de API (opcional - solo si necesitas cambiarlas)</h4>

          {/* OpenAI API Key */}
          <div className="space-y-2">
            <Label htmlFor="openai-key" className="flex items-center gap-2 text-sm">
              OpenAI API Key
              {config.available_providers.openai && (
                <Badge className="text-xs bg-secondary text-muted-foreground border-border">Configurada</Badge>
              )}
            </Label>
            <div className="flex gap-2">
              <Input
                id="openai-key"
                type={showKeys.openai ? "text" : "password"}
                placeholder="sk-..."
                value={apiKeys.openai}
                onChange={(e) => setApiKeys({ ...apiKeys, openai: e.target.value })}
                className="h-9 rounded-lg border-border bg-secondary/50"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 border-border"
                onClick={() => setShowKeys({ ...showKeys, openai: !showKeys.openai })}
              >
                {showKeys.openai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Gemini API Key */}
          <div className="space-y-2">
            <Label htmlFor="gemini-key" className="flex items-center gap-2 text-sm">
              Google Gemini API Key
              {config.available_providers.gemini && (
                <Badge className="text-xs bg-secondary text-muted-foreground border-border">Configurada</Badge>
              )}
            </Label>
            <div className="flex gap-2">
              <Input
                id="gemini-key"
                type={showKeys.gemini ? "text" : "password"}
                placeholder="AIza..."
                value={apiKeys.gemini}
                onChange={(e) => setApiKeys({ ...apiKeys, gemini: e.target.value })}
                className="h-9 rounded-lg border-border bg-secondary/50"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 border-border"
                onClick={() => setShowKeys({ ...showKeys, gemini: !showKeys.gemini })}
              >
                {showKeys.gemini ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* DeepSeek API Key */}
          <div className="space-y-2">
            <Label htmlFor="deepseek-key" className="flex items-center gap-2 text-sm">
              DeepSeek API Key
              {config.available_providers.deepseek && (
                <Badge className="text-xs bg-secondary text-muted-foreground border-border">Configurada</Badge>
              )}
            </Label>
            <div className="flex gap-2">
              <Input
                id="deepseek-key"
                type={showKeys.deepseek ? "text" : "password"}
                placeholder="sk-..."
                value={apiKeys.deepseek}
                onChange={(e) => setApiKeys({ ...apiKeys, deepseek: e.target.value })}
                className="h-9 rounded-lg border-border bg-secondary/50"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 border-border"
                onClick={() => setShowKeys({ ...showKeys, deepseek: !showKeys.deepseek })}
              >
                {showKeys.deepseek ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Anthropic API Key */}
          <div className="space-y-2">
            <Label htmlFor="anthropic-key" className="flex items-center gap-2 text-sm">
              Anthropic API Key
              {config.available_providers.anthropic && (
                <Badge className="text-xs bg-secondary text-muted-foreground border-border">Configurada</Badge>
              )}
            </Label>
            <div className="flex gap-2">
              <Input
                id="anthropic-key"
                type={showKeys.anthropic ? "text" : "password"}
                placeholder="sk-ant-..."
                value={apiKeys.anthropic}
                onChange={(e) => setApiKeys({ ...apiKeys, anthropic: e.target.value })}
                className="h-9 rounded-lg border-border bg-secondary/50"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 border-border"
                onClick={() => setShowKeys({ ...showKeys, anthropic: !showKeys.anthropic })}
              >
                {showKeys.anthropic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t border-border">
          <Button onClick={handleSave} disabled={saving} className="btn-primary">
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Guardando...' : 'Guardar Configuracion'}
          </Button>
        </div>

        {/* Current Configuration Display */}
        <div className="bg-secondary/30 p-4 rounded-lg border border-border space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Configuracion Actual:</p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Proveedor:</span>
            <Badge className="bg-secondary text-foreground border-border">
              {config.provider === 'copilot' && <Github className="h-3 w-3 mr-1" />}
              {providerLabels[config.provider] || config.provider}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Modelo:</span>
            <Badge className="bg-secondary text-foreground border-border">
              {config.provider === 'copilot' ? config.copilot?.selectedModel : config.model}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIConfigPanel;
