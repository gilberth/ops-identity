import { ShieldCheck, LogOut, Settings, Activity } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { ModeToggle } from "@/components/mode-toggle";

const Header = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate("/");
    toast({
      title: "Sesión cerrada",
      description: "Sistema self-hosted sin autenticación.",
    });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center space-x-2">
          <Activity className="h-6 w-6 text-indigo-600" />
          <span className="font-bold text-xl tracking-tight">OpsPulse</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/admin">
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Admin
            </Button>
          </Link>
          <ModeToggle />
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
