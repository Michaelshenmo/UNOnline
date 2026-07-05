import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Lobby from './pages/Lobby';
import Game from './pages/Game';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/lobby" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/lobby" replace /> : <Register />} />
      <Route path="/lobby" element={<ProtectedRoute><Lobby /></ProtectedRoute>} />
      <Route path="/game/:roomId" element={<ProtectedRoute><Game /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={user ? '/lobby' : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
