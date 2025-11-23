// Self-hosted version - Authentication disabled

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  // Bypass auth for self-hosted version
  return <>{children}</>;
};

export default ProtectedRoute;
