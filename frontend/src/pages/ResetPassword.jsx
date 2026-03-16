import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import "../styles/PasswordReset.css";
import api from "../api/axiosClient";
import { useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (password !== repeat) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setInfo("Contraseña cambiada exitosamente. Puedes iniciar sesión.");
    } catch (err) {
      setError(err.response?.data?.msg || "Error al cambiar la contraseña");
    }
    setLoading(false);
  };

  return (
    <div className="password-reset-container">
      <form className="password-reset-form" onSubmit={handleSubmit}>
        <div className="password-reset-title">Establecer nueva contraseña</div>
        {error && <div className="error">{error}</div>}
        {info && <div className="info">{info}</div>}
        <div className="password-input-group">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Contraseña nueva"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="password-toggle-btn"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>
        <div className="password-input-group">
          <input
            type={showRepeat ? "text" : "password"}
            placeholder="Repetir contraseña nueva"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            required
          />
          <button
            type="button"
            className="password-toggle-btn"
            onClick={() => setShowRepeat((v) => !v)}
            tabIndex={-1}
            aria-label={showRepeat ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {showRepeat ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>
        <button disabled={loading}>{loading ? "Guardando..." : "Guardar"}</button>
        <Link to="/" className="auth-link">Volver al inicio</Link>
      </form>
    </div>
  );
}
