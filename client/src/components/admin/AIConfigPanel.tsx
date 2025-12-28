import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Save, Eye, EyeOff } from "lucide-react";
import { getApiEndpoint } from "@/utils/api";

interface AIConfig {
  provider: string;
  model: string;
  available_providers: {
    openai: boolean;
    gemini: boolean;
    deepseek: boolean;
    anthropic: boolean;
  };
  models: {
    openai: string[];
    gemini: string[];
    deepseek: string[];
    anthropic: string[];
  };
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

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const VPS_ENDPOINT = getApiEndpoint();
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
      const VPS_ENDPOINT = getApiEndpoint();
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
        title: "Éxito",
        description: "Configuración de IA actualizada correctamente"
      });

      setApiKeys({ openai: '', gemini: '', deepseek: '', anthropic: '' });
      loadConfig();
    } catch (error) {
      console.error('Error saving AI config:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) {
    return (
      <div className="panel p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground text-sm">Cargando configuración...</p>
      </div>
    );
  }

  const providerLabels: { [key: string]: string } = {
    openai: 'OpenAI',
    gemini: 'Google Gemini',
    deepseek: 'DeepSeek',
    anthropic: 'Anthropic (Claude)'
  };

  return (
    <div className="panel overflow-hidden">
      <div className="panel-header">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Configuración de IA</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configura el proveedor y modelo de inteligencia artificial para el análisis de seguridad
          </p>
        </div>
      </div>

      <div className="p-5 space-y-6">
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
              disabled={!config.provider}
            >
              <SelectTrigger id="model" className="h-10 rounded-lg border-border bg-secondary/50">
                <SelectValue placeholder="Selecciona un modelo" />
              </SelectTrigger>
              <SelectContent>
                {config.provider && config.models[config.provider as keyof typeof config.models]?.length > 0 ? (
                  config.models[config.provider as keyof typeof config.models].map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-sm text-muted-foreground text-center">No hay modelos disponibles</div>
                )}
              </SelectContent>
            </Select>
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
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </Button>
        </div>

        {/* Current Configuration Display */}
        <div className="bg-secondary/30 p-4 rounded-lg border border-border space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Configuración Actual:</p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Proveedor:</span>
            <Badge className="bg-secondary text-foreground border-border">{providerLabels[config.provider]}</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Modelo:</span>
            <Badge className="bg-secondary text-foreground border-border">{config.model}</Badge>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIConfigPanel;
