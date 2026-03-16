import { useState } from "react";
import { FaEye, FaEyeSlash, FaSignInAlt, FaArrowLeft } from "react-icons/fa";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/Auth.css";
import LogoArgen from '../assets/images/Logotipo.jpeg';
//import fluxAdminLogo from '/fluxRosa.jpeg';

export default function Login() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showRedirectModal, setShowRedirectModal] = useState(false);
  const approved = params.get('approved') === '1';
  const rateLimitMessage = sessionStorage.getItem('rateLimitMessage');
  const rateLimitUntil = Number(sessionStorage.getItem('rateLimitUntil') || 0);
  const rateLimited = Boolean(rateLimitMessage) && Date.now() < rateLimitUntil;
  
  //const backgroundImage = import.meta.env.VITE_IMGFLUX;

  const normalizeCuit = (value) => String(value ?? "").replace(/[^0-9]/g, "");

  const login = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    try {
      const { data } = await api.post("/auth/login", { email, password });
      sessionStorage.setItem("token", data.token);
      if (data.refreshToken) {
        sessionStorage.setItem("refreshToken", data.refreshToken);
      }
      
      if (data.role === 'admin') {
        try {
          const decoded = JSON.parse(atob(data.token.split('.')[1]));
          const decodedCuit = normalizeCuit(decoded?.cuit);
          const envAdminCuit = normalizeCuit(import.meta.env.VITE_ADMIN_CUIT);
          if (envAdminCuit && decodedCuit === envAdminCuit) {
            sessionStorage.removeItem("token");
            setIsLoading(false);
            return;
          }
        } catch (e2) {
          // si falla el decode, continua con el comportamiento normal
        }
      }

      window.location.replace("/wallet");
    } catch (err) {
      setError(err.response?.data?.msg || 'Error de conexión');
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="auth-page"
      style={{
        backgroundColor: 'white',
        color: 'rgb(0,0,0)'
      }}
    >
      <div className="auth-container"
        style={{
          background: "rgba(255, 255, 255, 0.06)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.30)",
          color: "#FFFFFF"
        }}
        >
        <Link to="/" className="back-home" >
          <FaArrowLeft /> Volver al inicio
        </Link>
        <div className="form-header" style={{ textAlign: 'center', margin: '5px 0 5px' }}>
          <img 
            src={LogoArgen} 
            alt="Logo" 
            style={{ maxWidth: '150px', height: 'auto' }} 
          />
        </div>
        {approved && (
          <div className="alert alert-success">
            ¡Felicidades! Su cuenta ya está creada. Ya puede iniciar sesión.
          </div>
        )}
        {rateLimited && (
          <div className="alert alert-error">
            {rateLimitMessage}
          </div>
        )}
        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}
        
        <form onSubmit={login} className="auth-form">
          <div className="form-group">
            <label htmlFor="email" className="form-label" style={{ color: 'rgb(0,0,0)' }}>Correo Electrónico</label>
            <input
              id="email"
              type="email"
              className="form-control"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password" className="form-label" style={{ color: 'rgb(0,0,0)' }}>Contraseña</label>
            <div className="password-container">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            <div style={{marginTop:'8px'}}>
              <Link to="/forgot-password" className="auth-link">¿Olvidaste tu contraseña?</Link>
            </div>
          </div>
          
          <div className="form-group">
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? (
                "Iniciando sesión..."
              ) : (
                <>
                  <FaSignInAlt style={{ marginRight: '8px' }} />
                  Iniciar Sesión
                </>
              )}
            </button>
          </div>
          
          <div className="auth-footer"
          style={{
            color: '#000000',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            alignItems: 'center',
            marginTop: '15px'
          }}>
            <div>
              ¿No tienes una cuenta? <Link to="/register" className="auth-link">Regístrate</Link>
            </div>
            <div>
              <Link to="/resend-verify" className="auth-link">
                ¿No recibiste el código de verificación? Reenviar
              </Link>
            </div>
          </div>
        </form>
      </div>
    
    {showRedirectModal && (
      <div className="modal-overlay">
        <div className="modal-content redirect-modal">
          <div className="modal-icon">
            <div className="spinner"></div>
          </div>
          <h3>Redirigiendo al panel administrativo</h3>
          <p>Por favor, espera un momento...</p>
        </div>
      </div>
    )}
  </div>
);
}