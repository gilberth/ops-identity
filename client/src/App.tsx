import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import NewAssessment from "./pages/NewAssessment";
import AssessmentDetail from "./pages/AssessmentDetail";
import AdminPanel from "./pages/AdminPanel";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Users from "./pages/Users";
import GPOAnalysis from "./pages/GPOAnalysis";
import DNSNetwork from "./pages/DNSNetwork";
import Reports from "./pages/Reports";
import AuthentikSetup from "./pages/AuthentikSetup";
import ProtectedRoute from "./components/ProtectedRoute";
import { ThemeProvider } from "@/components/theme-provider";

import { ClientProvider } from "./context/ClientContext";
import ClientSelector from "./pages/ClientSelector";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <ClientProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<ProtectedRoute><ClientSelector /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/new-assessment" element={<ProtectedRoute><NewAssessment /></ProtectedRoute>} />
              <Route path="/assessment/:id" element={<ProtectedRoute><AssessmentDetail /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
              <Route path="/gpo" element={<ProtectedRoute><GPOAnalysis /></ProtectedRoute>} />
              <Route path="/dns" element={<ProtectedRoute><DNSNetwork /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
              <Route path="/setup" element={<AuthentikSetup />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <div className="fixed bottom-0 right-0 p-2 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm border-t border-l rounded-tl-md z-50">
              v1.8.9 (Build {new Date().toLocaleDateString()})
            </div>
          </BrowserRouter>
        </TooltipProvider>
      </ClientProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
