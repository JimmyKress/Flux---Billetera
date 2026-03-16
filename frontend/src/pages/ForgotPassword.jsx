import { useState } from "react";
import "../styles/PasswordReset.css";
import api from "../api/axiosClient";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      await api.post("/auth/request-password-reset", { email });
      setInfo("Si el correo está registrado, recibirás un email con el enlace para recuperar tu contraseña.");
    } catch (err) {
      setError(err.response?.data?.msg || "Error al solicitar recuperación");
    }
    setLoading(false);
  };

  return (
    <div className="password-reset-container">
      <form className="password-reset-form" onSubmit={handleSubmit}>
        <div className="password-reset-title">Recuperar Contraseña</div>
        {error && <div className="error">{error}</div>}
        {info && <div className="info">{info}</div>}
        <input
          type="email"
          placeholder="Tu correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button disabled={loading}>{loading ? "Enviando..." : "Enviar enlace"}</button>
      </form>
    </div>
  );
}
