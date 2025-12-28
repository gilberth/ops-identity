import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/utils/api";
import { useClient } from "@/context/ClientContext";
import { useNavigate } from "react-router-dom";
import { Plus, ArrowRight, Briefcase, Zap, Shield, Activity, Building2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function ClientSelector() {
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { selectClient } = useClient();
    const navigate = useNavigate();

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
                description: "Could not load clients",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSelectClient = (client: any) => {
        selectClient(client);
        toast({
            title: `Selected: ${client.name}`,
            description: "Accessing security dashboard...",
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
                title: "Client Created",
                description: `${newClient.name} has been registered successfully.`
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Could not create client",
                variant: "destructive"
            });
        }
    };

    return (
        <div className="min-h-screen bg-[hsl(222,47%,6%)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-grid-pattern opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-emerald-500/10" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-cyan-500/20 rounded-full blur-[120px] -translate-y-1/2" />

            <div className="w-full max-w-5xl space-y-8 relative z-10">
                {/* Header */}
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-4">
                        <Zap className="h-4 w-4 text-cyan-400" />
                        <span className="text-sm font-medium text-cyan-400">Security Command Center</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
                        OpsIdentity
                    </h1>
                    <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                        Select an organization to monitor its Active Directory health and security posture
                    </p>
                </div>

                {/* Client Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {/* Create New Client Card */}
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Card className="border-dashed border-2 border-white/10 bg-white/[0.02] cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all duration-300 flex flex-col items-center justify-center p-8 h-[280px] group">
                                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Plus className="h-8 w-8 text-cyan-400" />
                                </div>
                                <h3 className="text-xl font-semibold text-white">New Organization</h3>
                                <p className="text-slate-500 text-sm mt-2 text-center">Register a new client workspace</p>
                            </Card>
                        </DialogTrigger>
                        <DialogContent className="bg-[hsl(222,47%,8%)] border-white/10 text-white">
                            <DialogHeader>
                                <DialogTitle className="text-white">Register New Client</DialogTitle>
                                <DialogDescription className="text-slate-400">
                                    Create an isolated workspace for a new organization.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-slate-300">Organization Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g. Acme Corp"
                                        value={newClientName}
                                        onChange={(e) => setNewClientName(e.target.value)}
                                        className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500/50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-slate-300">Contact Email (Optional)</Label>
                                    <Input
                                        id="email"
                                        placeholder="admin@acme.com"
                                        value={newClientEmail}
                                        onChange={(e) => setNewClientEmail(e.target.value)}
                                        className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500/50"
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-white/10 text-slate-300 hover:bg-white/5">
                                    Cancel
                                </Button>
                                <Button onClick={handleCreateClient} className="bg-gradient-to-r from-cyan-500 to-emerald-500 text-[hsl(222,47%,6%)] font-semibold hover:from-cyan-400 hover:to-emerald-400">
                                    Create Client
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Client Cards */}
                    {clients.map((client, index) => (
                        <Card
                            key={client.id}
                            className="bg-white/[0.03] border-white/5 cursor-pointer hover:border-cyan-500/30 hover:bg-white/[0.05] transition-all duration-300 h-[280px] flex flex-col justify-between group animate-fade-in"
                            style={{ animationDelay: `${index * 0.1}s` }}
                            onClick={() => handleSelectClient(client)}
                        >
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-white/10 flex items-center justify-center group-hover:border-cyan-500/30 transition-colors">
                                        <Building2 className="h-6 w-6 text-cyan-400" />
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        <span className="text-emerald-400 text-[10px] font-semibold uppercase tracking-wider">Active</span>
                                    </div>
                                </div>
                                <CardTitle className="mt-4 text-xl text-white group-hover:text-cyan-400 transition-colors">
                                    {client.name}
                                </CardTitle>
                                <CardDescription className="text-slate-500">
                                    {client.contact_email || "No contact registered"}
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="pt-2">
                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                    <div className="flex items-center gap-1.5">
                                        <Shield className="h-3.5 w-3.5" />
                                        <span>Protected</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Activity className="h-3.5 w-3.5" />
                                        <span>Monitored</span>
                                    </div>
                                </div>
                            </CardContent>

                            <CardFooter className="border-t border-white/5 bg-white/[0.02] p-4">
                                <Button variant="ghost" className="w-full justify-between text-slate-400 group-hover:text-cyan-400 hover:bg-transparent">
                                    View Security Dashboard
                                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>

                {/* Footer */}
                <div className="text-center pt-8">
                    <p className="text-slate-600 text-sm font-mono">
                        OpsIdentity Security Platform v2.0
                    </p>
                </div>
            </div>
        </div>
    );
}
