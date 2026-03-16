import { useState, useEffect } from 'react';
import { FaUser, FaEnvelope, FaKey, FaCheck, FaTimes, FaArrowLeft, FaUserPlus, FaEye, FaEyeSlash } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axiosClient';
import '../../styles/Auth.css';
import LogoArgen from '../../assets/images/Logotipo.jpeg';
//import fluxAdminLogo from '/fluxRosa.jpeg';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ 
    nombre: '', 
    apellido: '', 
    cuit: '', 
    email: '', 
    cbu: '',
    password: '', 
    password2: '',
    modoAcreditacion: 'INTERNAL_WALLET' // Valor por defecto
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const backgroundImage = "/src/assets/images/flux.JFIF";

  const normalizeCuit = (value) => String(value ?? '').replace(/[^0-9]/g, '');
  const adminCuit = normalizeCuit(import.meta.env.VITE_ADMIN_CUIT);
  const isAdminRegister = new URLSearchParams(window.location.search).get('admin') === '1';
  const lockAdminCuit = isAdminRegister && Boolean(adminCuit);

  const [passwordValidations, setPasswordValidations] = useState({
    length: false,
    uppercase: false,
    number: false,
    special: false,
    match: false
  });

  useEffect(() => {
    // Validaciones de contraseña
    setPasswordValidations({
      length: form.password.length >= 8,
      uppercase: /[A-Z]/.test(form.password),
      number: /\d/.test(form.password),
      special: /[^A-Za-z0-9]/.test(form.password),
      match: form.password === form.password2 && form.password !== ''
    });
  }, [form.password, form.password2]);

  useEffect(() => {
    if (!isAdminRegister) return;
    if (!adminCuit) return;
    setForm(prev => ({ ...prev, cuit: adminCuit }));
  }, [isAdminRegister, adminCuit]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (form.password !== form.password2) {
      setError('Las contraseñas no coinciden');
      setIsLoading(false);
      return;
    }

    const passRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passRegex.test(form.password)) {
      setError('La contraseña no cumple con los requisitos');
      setIsLoading(false);
      return;
    }

    try {
      await api.post('/auth/register', {
        nombre: form.nombre,
        apellido: form.apellido,
        cuit: form.cuit,
        email: form.email,
        cbu: form.cbu,
        password: form.password,
        modoAcreditacion: form.modoAcreditacion
      });

      const requestedCuit = normalizeCuit(form.cuit);
      if (adminCuit && requestedCuit === adminCuit) {
        navigate('/login/admin');
        return;
      }

      window.location.href = `/verify?email=${encodeURIComponent(form.email)}`;
    } catch (err) {
      setError(err.response?.data?.msg || 'Error en el registro');
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
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
        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}
        <form onSubmit={submit} className="auth-form"><br />
          <Link to="/" className="back-home" style={{
            position: 'static',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#111',
            fontWeight: 500,
            fontSize: '0.95rem',
            marginBottom: '1.5rem',
            textDecoration: 'none',
            width: 'fit-content'
          }}>
            <FaArrowLeft /> Volver al inicio
          </Link>
          <div className="form-header" style={{ textAlign: 'center', margin: '10px 0 15px' }}>
            <img 
              src={LogoArgen} 
              alt="Logo" 
              style={{ maxWidth: '150px', height: 'auto' }} 
            />
          </div>
          <div className="form-row" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="nombre" className="form-label" style={{ color: 'rgb(0,0,0)' }}>Nombre</label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                className="form-control"
                placeholder="Tu nombre"
                value={form.nombre}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="apellido" className="form-label" style={{ color: 'rgb(0,0,0)' }}>Apellido</label>
              <input
                id="apellido"
                name="apellido"
                type="text"
                className="form-control"
                placeholder="Tu apellido"
                value={form.apellido}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="cuit" className="form-label" style={{ color: 'rgb(0,0,0)' }}>CUIT</label>
            <input
              id="cuit"
              name="cuit"
              type="text"
              className="form-control"
              placeholder="Ej: 20304567891 (sin guiones)"
              value={form.cuit}
              maxLength={11}
              readOnly={lockAdminCuit}
              onChange={e => {
                // Solo permito números, sin guiones ni espacios
                const value = e.target.value.replace(/[^0-9]/g, '');
                handleChange({ target: { name: 'cuit', value } });
              }}
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label" style={{ color: 'rgb(0,0,0)', fontWeight: 'bold', fontSize: '16px', marginBottom: '10px', display: 'block' }}>
              ¿CÓMO QUERES ACREDITAR TUS VENTAS?
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', border: '1px solid #ddd', borderRadius: '5px', backgroundColor: form.modoAcreditacion === 'DIRECT_BANK' ? '#f0f8ff' : '#fff' }}>
                <input
                  type="radio"
                  name="modoAcreditacion"
                  value="DIRECT_BANK"
                  checked={form.modoAcreditacion === 'DIRECT_BANK'}
                  onChange={handleChange}
                  style={{ marginRight: '10px' }}
                />
                <div>
                  <strong>ACREDITACIÓN DIRECTA</strong>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                    Acreditación directa a tu cuenta bancaria o virtual favorita
                  </div>
                </div>
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', border: '1px solid #ddd', borderRadius: '5px', backgroundColor: form.modoAcreditacion === 'INTERNAL_WALLET' ? '#f0f8ff' : '#fff' }}>
                <input
                  type="radio"
                  name="modoAcreditacion"
                  value="INTERNAL_WALLET"
                  checked={form.modoAcreditacion === 'INTERNAL_WALLET'}
                  onChange={handleChange}
                  style={{ marginRight: '10px' }}
                />
                <div>
                  <strong>INGRESO O RETIRO DESDE EL PORTAL</strong>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                    Operas dentro del portal y el sistema administra tu saldo
                  </div>
                </div>
              </label>
            </div>
            
            {form.modoAcreditacion === 'DIRECT_BANK' && (
              <div style={{ 
                padding: '15px', 
                backgroundColor: '#f8f9fa', 
                border: '1px solid #dee2e6', 
                borderRadius: '5px',
                fontSize: '14px',
                color: '#495057'
              }}>
                <strong>INDICA TU CUENTA BANCARIA O VIRTUAL FAVORITA</strong>
                <div style={{ marginTop: '5px' }}>SON 22 DIGITOS - CBU/CVU</div>
              </div>
            )}
            
            {form.modoAcreditacion === 'INTERNAL_WALLET' && (
              <div style={{ 
                padding: '15px', 
                backgroundColor: '#f8f9fa', 
                border: '1px solid #dee2e6', 
                borderRadius: '5px',
                fontSize: '14px',
                color: '#495057'
              }}>
                <strong>🧩 Acreditación en Portal (Resumen Onboarding)</strong>
                <div style={{ marginTop: '10px' }}>
                  <div>✅ El cliente opera dentro del portal y el sistema administra su saldo.</div>
                  <div>✅ Acredita cupones (suman a la liquidación diaria).</div>
                  <div>✅ Tiene saldo: Disponible y En revisión.</div>
                  <div>✅ Puede ingresar y retirar dinero.</div>
                  <div>✅ Las operaciones pasan por clearing bancario.</div>
                </div>
                
                <div style={{ marginTop: '10px', fontWeight: 'bold' }}>
                  🏦 Clearing
                </div>
                <div style={{ marginLeft: '10px' }}>
                  <div>• Solo en días hábiles bancarios.</div>
                  <div>• Procesos a las 12:00, 16:00 y 19:00 hs.</div>
                  <div>• Fines de semana y feriados no se procesan.</div>
                </div>
                
                <div style={{ marginTop: '10px', fontWeight: 'bold' }}>
                  ⏱ Estados
                </div>
                <div style={{ marginLeft: '10px' }}>
                  <div>• Solicitud → En curso / En revisión.</div>
                  <div>• Procesada → Aprobada / Confirmada.</div>
                  <div>• Acreditación de fondos es inmediata. Puede demorar 24 a 72 horas hábiles según banco receptor.</div>
                  <div>• 👉 El saldo impacta definitivamente una vez aprobado el clearing.</div>
                </div>
              </div>
            )}
          </div>
          
          <div className="form-group">
            <label htmlFor="cbu" className="form-label" style={{ color: 'rgb(0,0,0)' }}>CBU/CVU</label>
            <input
              id="cbu"
              name="cbu"
              type="text"
              className="form-control"
              placeholder="0140123456789012345678"
              maxLength="22"
              value={form.cbu}
              onChange={(e) => handleChange({ target: { name: 'cbu', value: e.target.value.replace(/\D/g, '') } })}
              required
            />
            <span style={{ color: 'rgb(0,0,0)', fontSize: '12px' }}>Es importante que indiques correctamente los datos proporcionados</span>
          </div>

          <div className="form-group">
            <label htmlFor="email" className="form-label" style={{ color: 'rgb(0,0,0)' }}>Correo Electrónico</label>
            <input
              id="email"
              name="email"
              type="email"
              className="form-control"
              placeholder="tu@email.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password" className="form-label" style={{ color: 'rgb(0,0,0)' }}>Contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                className="form-control"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                required
                style={{ paddingRight: '40px' }}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#666',
                  cursor: 'pointer',
                  padding: '5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            <div className="password-requirements" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
              <p style={{ margin: '0.5rem 0', color: 'rgb(0,0,0)' }}>La contraseña debe contener:</p>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ color: passwordValidations.length ? '#4caf50' : '#ff6b6b', marginRight: '0.5rem' }}>
                  {passwordValidations.length ? <FaCheck /> : <FaTimes />}
                </span>
                <span style={{ color: 'rgb(0,0,0)' }}>Mínimo 8 caracteres</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ color: passwordValidations.uppercase ? '#4caf50' : '#ff6b6b', marginRight: '0.5rem' }}>
                  {passwordValidations.uppercase ? <FaCheck /> : <FaTimes />}
                </span>
                <span style={{ color: 'rgb(0,0,0)' }}>Al menos una mayúscula</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ color: passwordValidations.number ? '#4caf50' : '#ff6b6b', marginRight: '0.5rem' }}>
                  {passwordValidations.number ? <FaCheck /> : <FaTimes />}
                </span>
                <span style={{ color: 'rgb(0,0,0)' }}>Al menos un número</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: passwordValidations.special ? '#4caf50' : '#ff6b6b', marginRight: '0.5rem' }}>
                  {passwordValidations.special ? <FaCheck /> : <FaTimes />}
                </span>
                <span style={{ color: 'rgb(0,0,0)' }}>Al menos un carácter especial</span>
              </div>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="password2" className="form-label"  style={{ color: 'rgb(0,0,0)' }}>Confirmar Contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password2"
                name="password2"
                type={showConfirmPassword ? "text" : "password"}
                className="form-control"
                placeholder="••••••••"
                value={form.password2}
                onChange={handleChange}
                required
                style={{ paddingRight: '40px' }}
              />
              <button 
                type="button" 
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#666',
                  cursor: 'pointer',
                  padding: '5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.25rem' }}>
              <span style={{ color: passwordValidations.match ? '#4caf50' : '#ff6b6b', marginRight: '0.5rem' }}>
                {passwordValidations.match ? <FaCheck /> : <FaTimes />}
              </span>
              <span style={{ color: 'rgb(0,0,0)' }}>Las contraseñas coinciden</span>
            </div>
          </div>
          
          <div className="form-group">
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isLoading || !Object.values(passwordValidations).every(v => v)}
            >
              {isLoading ? (
                "Creando cuenta..."
              ) : (
                <>
                  <FaUserPlus style={{ marginRight: '8px' }} />
                  Registrarse
                </>
              )}
            </button>
          </div>
          
          <div className="auth-footer">
            ¿Ya tienes una cuenta? <Link to="/login" className="auth-link">Inicia sesión</Link>
          </div>
        </form>
      </div>
    </div>
  );
}