import { useState } from "react";
import { FaEye, FaEyeSlash, FaSignInAlt, FaArrowLeft } from "react-icons/fa";
import { Link } from "react-router-dom";
import api from "../api/axiosClient";
import "../styles/Auth.css";
import LogoArgen from '../assets/images/Logotipo.jpeg';
//import fluxAdminLogo from '/fluxRosa.jpeg';

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showRedirectModal, setShowRedirectModal] = useState(false);
  const rateLimitMessage = sessionStorage.getItem('rateLimitMessage');
  const rateLimitUntil = Number(sessionStorage.getItem('rateLimitUntil') || 0);
  const rateLimited = Boolean(rateLimitMessage) && Date.now() < rateLimitUntil;
  //"https://u.today/sites/default/files/styles/1600x900/public/2023-01/Flux.jpg";
  //const adminBackground = "/src/assets/images/flux.JFIF";
  const normalizeCuit = (value) => String(value ?? "").replace(/[^0-9]/g, "");

  const login = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const { data } = await api.post("/auth/login", { email, password });

      const token = data?.token;
      if (!token) {
        setError("No se recibió token de autenticación");
        setIsLoading(false);
        return;
      }

      const decoded = JSON.parse(atob(token.split(".")[1]));
      const decodedCuit = normalizeCuit(decoded?.cuit);
      const envAdminCuit = normalizeCuit(import.meta.env.VITE_ADMIN_CUIT);

      if (!envAdminCuit || decodedCuit !== envAdminCuit) {
        setError("Acceso denegado: este login es solo para administración");
        setIsLoading(false);
        return;
      }

      sessionStorage.setItem("token", token);
      if (data.refreshToken) {
        sessionStorage.setItem("refreshToken", data.refreshToken);
      }
      setShowRedirectModal(true);
      setTimeout(() => {
        window.location.replace("/admin");
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.msg || "Error de conexión");
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
      <div
        className="auth-container"
        style={{
          background: "rgba(255, 255, 255, 0.06)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.30)",
          color: "#000000"
        }}
      >
        <Link to="/" className="back-home">
          <FaArrowLeft /> Volver al inicio
        </Link>
        <div className="form-header" style={{ textAlign: 'center', margin: '5px 0 5px' }}>
          <img 
            src={LogoArgen} 
            alt="Logo" 
            style={{ maxWidth: '150px', height: 'auto' }} 
          />
        </div>

        {rateLimited && <div className="alert alert-error">{rateLimitMessage}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={login} className="auth-form">
          <div className="form-group">
            <label htmlFor="email" className="form-label" style={{ color: 'rgb(0,0,0)' }}>
              Correo Electrónico
            </label>
            <input
              id="email"
              type="email"
              className="form-control"
              placeholder="admin@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label" style={{ color: 'rgb(0,0,0)' }}>
              Contraseña
            </label>
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
          </div>

          <div className="form-group">
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? (
                "Iniciando sesión..."
              ) : (
                <>
                  <FaSignInAlt style={{ marginRight: "8px" }} />
                  Iniciar Sesión
                </>
              )}
            </button>
          </div>

        </form>

        <div className="auth-footer">
          ¿No tenés usuario admin?{" "}
          <Link to="/register?admin=1" className="auth-link">Registrarse</Link>
        </div>
      </div>

      {showRedirectModal && (
        <div className="modal-overlay">
          <div className="modal-content redirect-modal">
            <div className="modal-icon">
              <div className="spinner"></div>
            </div>
            <h3 style={{ color: "#FFFFFF" }}>Redirigiendo al panel administrativo</h3>
            <p style={{ color: "#FFFFFF" }}>Por favor, espera un momento...</p>
          </div>
        </div>
      )}
    </div>
  );
}
