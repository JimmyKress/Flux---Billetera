// App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useTokenRefresh } from './hooks/useTokenRefresh';
import Home from './pages/Home/Home';
import Login from './pages/Login';
import Register from './pages/Register/Register';
import Admin from './pages/Admin';
import AdminClientes from './pages/AdminClientes';
import VerifyCode from './pages/VerifyCode';
import Wallet from './pages/Wallet';
import Transacciones from './pages/Transacciones';
import Deposit from './pages/Deposit';
import Cupones from './pages/Cupones/Cupones';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ResendVerify from './pages/ResendVerify';
import AdminLogin from './pages/AdminLogin';
import Terminos from './pages/Terminos/Terminos';

function App() {
  useTokenRefresh();
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/login/admin" element={<AdminLogin />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify" element={<VerifyCode />} />
        <Route path="/terminos" element={<Terminos />} />
        <Route path="/resend-verify" element={<ResendVerify />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/transacciones" element={<Transacciones />} />
        <Route path="/deposit" element={<Deposit />} />
        <Route path="/retiros/solicitar" element={<Navigate to="/wallet" replace />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/clientes" element={<AdminClientes />} />
        <Route path="/cupones" element={<Cupones />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;