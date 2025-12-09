import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/utils/api";
import { useClient } from "@/context/ClientContext";
import { useNavigate } from "react-router-dom";
import { Plus, Building, ArrowRight, Briefcase } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function ClientSelector() {
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { selectClient } = useClient();
    const navigate = useNavigate();

    // New Client Form
    const [newClientName, setNewClientName] = useState("");
    const [newClientEmail, setNewClientEmail] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    useEffect(() => {
        loadClients();
    }, []);

    const loadClients = async () => {
        try {
            setLoading(true);
            const data = await api.getClients();
            setClients(data);
        } catch (error) {
            console.error(error);
            toast({
                title: "Error",
                description: "No se pudieron cargar los clientes",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSelectClient = (client: any) => {
        selectClient(client);
        toast({
            title: `Empresa Seleccionada: ${client.name}`,
            description: "Accediendo al dashboard...",
        });
        navigate("/dashboard");
    };

    const handleCreateClient = async () => {
        if (!newClientName.trim()) return;

        try {
            const newClient = await api.createClient({
                name: newClientName,
                contact_email: newClientEmail
            });
            setClients([...clients, newClient]);
            setIsDialogOpen(false);
            setNewClientName("");
            setNewClientEmail("");
            toast({
                title: "Cliente Creado",
                description: `Se ha registrado ${newClient.name} exitosamente.`
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "No se pudo crear el cliente",
                variant: "destructive"
            });
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-5xl space-y-8">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                        OpsIdentity Portfolio
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400">
                        Selecciona una empresa para gestionar su seguridad e identidad
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Create New Client Card */}
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Card className="border-dashed border-2 cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors flex flex-col items-center justify-center p-8 h-[250px]">
                                <div className="h-16 w-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                                    <Plus className="h-8 w-8" />
                                </div>
                                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Nuevo Cliente</h3>
                                <p className="text-slate-500 text-sm mt-2 text-center">Registrar una nueva organización</p>
                            </Card>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Registrar Nuevo Cliente</DialogTitle>
                                <DialogDescription>
                                    Crea un espacio de trabajo aislado para una nueva organización.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Nombre de la Empresa</Label>
                                    <Input
                                        id="name"
                                        placeholder="Ej. Acme Corp"
                                        value={newClientName}
                                        onChange={(e) => setNewClientName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email de Contacto (Opcional)</Label>
                                    <Input
                                        id="email"
                                        placeholder="admin@acme.com"
                                        value={newClientEmail}
                                        onChange={(e) => setNewClientEmail(e.target.value)}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                                <Button onClick={handleCreateClient}>Crear Cliente</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Client List */}
                    {clients.map((client) => (
                        <Card key={client.id} className="cursor-pointer hover:shadow-lg transition-all group h-[250px] flex flex-col justify-between" onClick={() => handleSelectClient(client)}>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div className="h-12 w-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                                        <Briefcase className="h-6 w-6" />
                                    </div>
                                    <div className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                        Activo
                                    </div>
                                </div>
                                <CardTitle className="mt-4 text-xl">{client.name}</CardTitle>
                                <CardDescription>{client.contact_email || "Sin contacto registrado"}</CardDescription>
                            </CardHeader>
                            <CardFooter className="border-t bg-slate-50 dark:bg-slate-900/50 p-4">
                                <Button variant="ghost" className="w-full justify-between group-hover:text-blue-600">
                                    Ficha de Salud
                                    <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
