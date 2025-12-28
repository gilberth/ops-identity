import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/utils/api";
import { useClient } from "@/context/ClientContext";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  ArrowRight,
  Terminal,
  Shield,
  Activity,
  Building2,
  Loader2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function ClientSelector() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectClient } = useClient();
  const navigate = useNavigate();

  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

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
        description: "Could not load organizations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectClient = (client: any) => {
    selectClient(client);
    toast({
      title: `Connected: ${client.name}`,
      description: "Loading security dashboard...",
    });
    navigate("/dashboard");
  };

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;

    try {
      setIsCreating(true);
      const newClient = await api.createClient({
        name: newClientName,
        contact_email: newClientEmail,
      });
      setClients([...clients, newClient]);
      setIsDialogOpen(false);
      setNewClientName("");
      setNewClientEmail("");
      toast({
        title: "Organization Created",
        description: `${newClient.name} has been registered.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not create organization",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid-tactical opacity-20" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />

      {/* Top glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/10 rounded-full blur-[100px] -translate-y-1/2" />

      <div className="w-full max-w-4xl space-y-8 relative z-10">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Terminal className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-mono font-medium text-primary uppercase tracking-wider">
              Tactical Operations Console
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-wide text-foreground">
            OPSIDENTITY
          </h1>

          <p className="text-muted-foreground max-w-lg mx-auto">
            Select an organization to analyze Active Directory operational hygiene
          </p>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground font-mono">
              Loading organizations...
            </p>
          </div>
        ) : (
          /* Client Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Create New Client Card */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <button className="group panel p-6 h-[200px] flex flex-col items-center justify-center gap-4 border-dashed border-2 border-border hover:border-primary/50 transition-all cursor-pointer">
                  <div className="h-14 w-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Plus className="h-6 w-6 text-primary" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-medium text-foreground">
                      New Organization
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Register a new workspace
                    </p>
                  </div>
                </button>
              </DialogTrigger>

              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="font-display">
                    Register Organization
                  </DialogTitle>
                  <DialogDescription>
                    Create an isolated workspace for a new client.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Organization Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g. Acme Corp"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      className="bg-secondary border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Contact Email (Optional)</Label>
                    <Input
                      id="email"
                      placeholder="admin@acme.com"
                      value={newClientEmail}
                      onChange={(e) => setNewClientEmail(e.target.value)}
                      className="bg-secondary border-border"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateClient}
                    disabled={isCreating || !newClientName.trim()}
                    className="btn-primary"
                  >
                    {isCreating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Client Cards */}
            {clients.map((client, index) => (
              <button
                key={client.id}
                className={cn(
                  "group panel p-5 h-[200px] flex flex-col justify-between text-left",
                  "hover:border-primary/30 transition-all cursor-pointer",
                  "animate-slide-up opacity-0"
                )}
                style={{
                  animationDelay: `${index * 50}ms`,
                  animationFillMode: "forwards",
                }}
                onClick={() => handleSelectClient(client)}
              >
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Building2 className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent pulse-live" />
                      <span className="text-[9px] font-mono font-medium text-accent uppercase">
                        Active
                      </span>
                    </div>
                  </div>

                  <h3 className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                    {client.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {client.contact_email || "No contact registered"}
                  </p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      Protected
                    </span>
                    <span className="flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      Monitored
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-8">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            OpsIdentity Security Platform v3.0
          </p>
        </div>
      </div>
    </div>
  );
}
