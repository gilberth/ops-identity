import React from 'react';
import MainLayout from "@/components/layout/MainLayout";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  // In self-hosted mode, we just ensure the layout is applied
  return <MainLayout>{children}</MainLayout>;
};

export default ProtectedRoute;
