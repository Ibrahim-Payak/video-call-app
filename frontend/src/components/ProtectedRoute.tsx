import { Navigate } from 'react-router-dom';
import { getDisplayName } from '../services/auth';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const name = getDisplayName();

  if (!name) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
