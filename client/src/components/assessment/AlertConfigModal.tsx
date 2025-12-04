import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  Phone, 
  AlertTriangle,
  Plus,
  Trash2,
  Edit,
  Users,
  Clock,
  Zap
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Alert {
  id: string;
  name: string;
  enabled: boolean;
  condition: string;
  threshold: number;
  channels: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
}

interface ContactGroup {
  id: string;
  name: string;
  members: string[];
}

interface AlertConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AlertConfigModal({ open, onOpenChange }: AlertConfigModalProps) {
  const [alerts, setAlerts] = useState<Alert[]>([
    {
      id: '1',
      name: 'Hallazgos Críticos Nuevos',
      enabled: true,
      condition: 'critical_findings',
      threshold: 1,
      channels: ['email', 'sms'],
      priority: 'critical',
    },
    {
      id: '2',
      name: 'Assessment Completado',
      enabled: true,
      condition: 'assessment_completed',
      threshold: 0,
      channels: ['email'],
      priority: 'medium',
    },
  ]);

  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([
    {
      id: '1',
      name: 'Equipo de Seguridad',
      members: ['security@example.com', 'admin@example.com'],
    },
    {
      id: '2',
      name: 'Gerencia',
      members: ['cto@example.com', 'ceo@example.com'],
    },
  ]);

  const [newAlertName, setNewAlertName] = useState('');
  const [newAlertCondition, setNewAlertCondition] = useState('');
  const [newAlertThreshold, setNewAlertThreshold] = useState(1);
  const [newAlertPriority, setNewAlertPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');
  const [newAlertChannels, setNewAlertChannels] = useState<string[]>(['email']);

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState('');

  const handleToggleAlert = (id: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === id ? { ...alert, enabled: !alert.enabled } : alert
    ));
    toast({
      title: "Alerta actualizada",
      description: "La configuración de la alerta ha sido actualizada.",
    });
  };

  const handleDeleteAlert = (id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
    toast({
      title: "Alerta eliminada",
      description: "La alerta ha sido eliminada exitosamente.",
    });
  };

  const handleAddAlert = () => {
    if (!newAlertName || !newAlertCondition) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos requeridos.",
        variant: "destructive",
      });
      return;
    }

    const newAlert: Alert = {
      id: Date.now().toString(),
      name: newAlertName,
      enabled: true,
      condition: newAlertCondition,
      threshold: newAlertThreshold,
      channels: newAlertChannels,
      priority: newAlertPriority,
    };

    setAlerts(prev => [...prev, newAlert]);
    setNewAlertName('');
    setNewAlertCondition('');
    setNewAlertThreshold(1);
    setNewAlertPriority('medium');
    setNewAlertChannels(['email']);

    toast({
      title: "Alerta creada",
      description: "La nueva alerta ha sido configurada exitosamente.",
    });
  };

  const handleAddContactGroup = () => {
    if (!newGroupName || !newGroupMembers) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos.",
        variant: "destructive",
      });
      return;
    }

    const newGroup: ContactGroup = {
      id: Date.now().toString(),
      name: newGroupName,
      members: newGroupMembers.split(',').map(m => m.trim()).filter(m => m),
    };

    setContactGroups(prev => [...prev, newGroup]);
    setNewGroupName('');
    setNewGroupMembers('');

    toast({
      title: "Grupo creado",
      description: "El grupo de contactos ha sido creado exitosamente.",
    });
  };

  const handleDeleteGroup = (id: string) => {
    setContactGroups(prev => prev.filter(group => group.id !== id));
    toast({
      title: "Grupo eliminado",
      description: "El grupo de contactos ha sido eliminado.",
    });
  };

  const toggleChannel = (channel: string) => {
    setNewAlertChannels(prev =>
      prev.includes(channel) ? prev.filter(c => c !== channel) : [...prev, channel]
    );
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getConditionLabel = (condition: string) => {
    const labels: Record<string, string> = {
      'critical_findings': 'Nuevos hallazgos críticos',
      'high_findings': 'Nuevos hallazgos high',
      'assessment_completed': 'Assessment completado',
      'assessment_failed': 'Assessment fallido',
      'risk_score_high': 'Risk score alto',
    };
    return labels[condition] || condition;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Configurar Alertas y Notificaciones
          </DialogTitle>
          <DialogDescription>
            Configura alertas automáticas, canales de notificación y grupos de contactos
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="alerts" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="alerts">Alertas</TabsTrigger>
            <TabsTrigger value="channels">Canales</TabsTrigger>
            <TabsTrigger value="contacts">Grupos de Contactos</TabsTrigger>
          </TabsList>

          {/* Gestión de Alertas */}
          <TabsContent value="alerts" className="space-y-4 mt-4">
            {/* Alertas Existentes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Alertas Configuradas</CardTitle>
                <CardDescription>Gestiona tus reglas de notificación</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {alerts.map(alert => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Checkbox
                        checked={alert.enabled}
                        onCheckedChange={() => handleToggleAlert(alert.id)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{alert.name}</h4>
                          <Badge className={getPriorityColor(alert.priority)}>
                            {alert.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {getConditionLabel(alert.condition)}
                          {alert.threshold > 0 && ` (≥ ${alert.threshold})`}
                        </p>
                        <div className="flex gap-2 mt-2">
                          {alert.channels.includes('email') && (
                            <Badge variant="outline" className="text-xs">
                              <Mail className="h-3 w-3 mr-1" />
                              Email
                            </Badge>
                          )}
                          {alert.channels.includes('sms') && (
                            <Badge variant="outline" className="text-xs">
                              <MessageSquare className="h-3 w-3 mr-1" />
                              SMS
                            </Badge>
                          )}
                          {alert.channels.includes('push') && (
                            <Badge variant="outline" className="text-xs">
                              <Bell className="h-3 w-3 mr-1" />
                              Push
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteAlert(alert.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Crear Nueva Alerta */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Nueva Alerta
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="alert-name">Nombre de la Alerta</Label>
                    <Input
                      id="alert-name"
                      placeholder="Ej: Hallazgos críticos nuevos"
                      value={newAlertName}
                      onChange={(e) => setNewAlertName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="alert-priority">Prioridad</Label>
                    <Select value={newAlertPriority} onValueChange={(value: any) => setNewAlertPriority(value)}>
                      <SelectTrigger id="alert-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical">Crítica</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="medium">Media</SelectItem>
                        <SelectItem value="low">Baja</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="alert-condition">Condición</Label>
                    <Select value={newAlertCondition} onValueChange={setNewAlertCondition}>
                      <SelectTrigger id="alert-condition">
                        <SelectValue placeholder="Seleccionar condición" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical_findings">Nuevos hallazgos críticos</SelectItem>
                        <SelectItem value="high_findings">Nuevos hallazgos high</SelectItem>
                        <SelectItem value="assessment_completed">Assessment completado</SelectItem>
                        <SelectItem value="assessment_failed">Assessment fallido</SelectItem>
                        <SelectItem value="risk_score_high">Risk score alto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="alert-threshold">Umbral</Label>
                    <Input
                      id="alert-threshold"
                      type="number"
                      min="0"
                      value={newAlertThreshold}
                      onChange={(e) => setNewAlertThreshold(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Canales de Notificación</Label>
                  <div className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="channel-email"
                        checked={newAlertChannels.includes('email')}
                        onCheckedChange={() => toggleChannel('email')}
                      />
                      <Label htmlFor="channel-email" className="flex items-center gap-2 cursor-pointer">
                        <Mail className="h-4 w-4" />
                        Email
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="channel-sms"
                        checked={newAlertChannels.includes('sms')}
                        onCheckedChange={() => toggleChannel('sms')}
                      />
                      <Label htmlFor="channel-sms" className="flex items-center gap-2 cursor-pointer">
                        <MessageSquare className="h-4 w-4" />
                        SMS
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="channel-push"
                        checked={newAlertChannels.includes('push')}
                        onCheckedChange={() => toggleChannel('push')}
                      />
                      <Label htmlFor="channel-push" className="flex items-center gap-2 cursor-pointer">
                        <Bell className="h-4 w-4" />
                        Push
                      </Label>
                    </div>
                  </div>
                </div>

                <Button onClick={handleAddAlert} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Alerta
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configuración de Canales */}
          <TabsContent value="channels" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Mail className="h-5 w-5" />
                    Email
                  </CardTitle>
                  <CardDescription>Configurar notificaciones por correo</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                    <span className="text-sm font-medium">Estado</span>
                    <Badge className="bg-green-500">Configurado</Badge>
                  </div>
                  <div className="space-y-2">
                    <Label>Destinatarios por defecto</Label>
                    <Input placeholder="admin@example.com" />
                  </div>
                  <Button variant="outline" className="w-full">
                    <Edit className="h-4 w-4 mr-2" />
                    Editar Configuración
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MessageSquare className="h-5 w-5" />
                    SMS
                  </CardTitle>
                  <CardDescription>Configurar notificaciones por mensaje</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                    <span className="text-sm font-medium">Estado</span>
                    <Badge className="bg-yellow-500">Pendiente</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Configura tu servicio de SMS para recibir alertas críticas
                  </p>
                  <Button variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Configurar SMS
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Bell className="h-5 w-5" />
                    Push Notifications
                  </CardTitle>
                  <CardDescription>Notificaciones en navegador/móvil</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                    <span className="text-sm font-medium">Estado</span>
                    <Badge className="bg-yellow-500">Pendiente</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Habilita notificaciones push para alertas en tiempo real
                  </p>
                  <Button variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Habilitar Push
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Zap className="h-5 w-5" />
                    Webhooks
                  </CardTitle>
                  <CardDescription>Integración con sistemas externos</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                    <span className="text-sm font-medium">Estado</span>
                    <Badge className="bg-yellow-500">Pendiente</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Conecta con Slack, Teams, o tu SIEM favorito
                  </p>
                  <Button variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Webhook
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Grupos de Contactos */}
          <TabsContent value="contacts" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Grupos de Contactos</CardTitle>
                <CardDescription>Organiza destinatarios para notificaciones dirigidas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {contactGroups.map(group => (
                  <div
                    key={group.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Users className="h-5 w-5 text-blue-500" />
                      <div>
                        <h4 className="font-semibold">{group.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {group.members.length} miembros: {group.members.slice(0, 2).join(', ')}
                          {group.members.length > 2 && ` +${group.members.length - 2} más`}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteGroup(group.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Nuevo Grupo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="group-name">Nombre del Grupo</Label>
                  <Input
                    id="group-name"
                    placeholder="Ej: Equipo de Seguridad"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="group-members">Miembros (separados por comas)</Label>
                  <Textarea
                    id="group-members"
                    placeholder="admin@example.com, security@example.com"
                    value={newGroupMembers}
                    onChange={(e) => setNewGroupMembers(e.target.value)}
                  />
                </div>
                <Button onClick={handleAddContactGroup} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Grupo
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
