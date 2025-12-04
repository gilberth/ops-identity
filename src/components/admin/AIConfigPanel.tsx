import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Save, Eye, EyeOff } from "lucide-react";
import { api } from "@/utils/api";

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
      const VPS_ENDPOINT = import.meta.env.VITE_VPS_ENDPOINT || 'http://localhost:3000';
      const response = await fetch(`${VPS_ENDPOINT}/api/config/ai`);
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
      const VPS_ENDPOINT = import.meta.env.VITE_VPS_ENDPOINT || 'http://localhost:3000';
      const payload: any = {
        provider: config?.provider,
        model: config?.model,
        api_keys: {}
      };

      // Solo enviar keys que no estén vacías
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

      // Limpiar los campos de API keys después de guardar
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
      <Card className="mb-6">
        <CardContent className="p-6">
          <p className="text-muted-foreground">Cargando configuración...</p>
        </CardContent>
      </Card>
    );
  }

  const providerLabels: { [key: string]: string } = {
    openai: 'OpenAI',
    gemini: 'Google Gemini',
    deepseek: 'DeepSeek',
    anthropic: 'Anthropic (Claude)'
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Configuración de IA</CardTitle>
        <CardDescription>
          Configura el proveedor y modelo de inteligencia artificial para el análisis de seguridad
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Provider Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="provider">Proveedor de IA</Label>
            <Select
              value={config.provider}
              onValueChange={(value) => setConfig({ ...config, provider: value })}
            >
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai" disabled={!config.available_providers.openai && !apiKeys.openai}>
                  OpenAI {config.available_providers.openai && <Badge variant="outline" className="ml-2">Configurado</Badge>}
                </SelectItem>
                <SelectItem value="gemini" disabled={!config.available_providers.gemini && !apiKeys.gemini}>
                  Google Gemini {config.available_providers.gemini && <Badge variant="outline" className="ml-2">Configurado</Badge>}
                </SelectItem>
                <SelectItem value="deepseek" disabled={!config.available_providers.deepseek && !apiKeys.deepseek}>
                  DeepSeek {config.available_providers.deepseek && <Badge variant="outline" className="ml-2">Configurado</Badge>}
                </SelectItem>
                <SelectItem value="anthropic" disabled={!config.available_providers.anthropic && !apiKeys.anthropic}>
                  Anthropic (Claude) {config.available_providers.anthropic && <Badge variant="outline" className="ml-2">Configurado</Badge>}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Modelo</Label>
            <Select
              value={config.model}
              onValueChange={(value) => setConfig({ ...config, model: value })}
            >
              <SelectTrigger id="model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {config.models[config.provider as keyof typeof config.models]?.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* API Keys */}
        <div className="space-y-4 border-t pt-4">
          <h4 className="text-sm font-medium">Claves de API (opcional - solo si necesitas cambiarlas)</h4>

          {/* OpenAI API Key */}
          <div className="space-y-2">
            <Label htmlFor="openai-key" className="flex items-center gap-2">
              OpenAI API Key
              {config.available_providers.openai && (
                <Badge variant="secondary" className="text-xs">Configurada</Badge>
              )}
            </Label>
            <div className="flex gap-2">
              <Input
                id="openai-key"
                type={showKeys.openai ? "text" : "password"}
                placeholder="sk-..."
                value={apiKeys.openai}
                onChange={(e) => setApiKeys({ ...apiKeys, openai: e.target.value })}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowKeys({ ...showKeys, openai: !showKeys.openai })}
              >
                {showKeys.openai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Gemini API Key */}
          <div className="space-y-2">
            <Label htmlFor="gemini-key" className="flex items-center gap-2">
              Google Gemini API Key
              {config.available_providers.gemini && (
                <Badge variant="secondary" className="text-xs">Configurada</Badge>
              )}
            </Label>
            <div className="flex gap-2">
              <Input
                id="gemini-key"
                type={showKeys.gemini ? "text" : "password"}
                placeholder="AIza..."
                value={apiKeys.gemini}
                onChange={(e) => setApiKeys({ ...apiKeys, gemini: e.target.value })}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowKeys({ ...showKeys, gemini: !showKeys.gemini })}
              >
                {showKeys.gemini ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* DeepSeek API Key */}
          <div className="space-y-2">
            <Label htmlFor="deepseek-key" className="flex items-center gap-2">
              DeepSeek API Key
              {config.available_providers.deepseek && (
                <Badge variant="secondary" className="text-xs">Configurada</Badge>
              )}
            </Label>
            <div className="flex gap-2">
              <Input
                id="deepseek-key"
                type={showKeys.deepseek ? "text" : "password"}
                placeholder="sk-..."
                value={apiKeys.deepseek}
                onChange={(e) => setApiKeys({ ...apiKeys, deepseek: e.target.value })}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowKeys({ ...showKeys, deepseek: !showKeys.deepseek })}
              >
                {showKeys.deepseek ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Anthropic API Key */}
          <div className="space-y-2">
            <Label htmlFor="anthropic-key" className="flex items-center gap-2">
              Anthropic API Key
              {config.available_providers.anthropic && (
                <Badge variant="secondary" className="text-xs">Configurada</Badge>
              )}
            </Label>
            <div className="flex gap-2">
              <Input
                id="anthropic-key"
                type={showKeys.anthropic ? "text" : "password"}
                placeholder="sk-ant-..."
                value={apiKeys.anthropic}
                onChange={(e) => setApiKeys({ ...apiKeys, anthropic: e.target.value })}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowKeys({ ...showKeys, anthropic: !showKeys.anthropic })}
              >
                {showKeys.anthropic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </Button>
        </div>

        {/* Current Configuration Display */}
        <div className="bg-muted p-4 rounded-md space-y-2">
          <p className="text-sm font-medium">Configuración Actual:</p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Proveedor:</span>
            <Badge variant="outline">{providerLabels[config.provider]}</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Modelo:</span>
            <Badge variant="outline">{config.model}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIConfigPanel;
