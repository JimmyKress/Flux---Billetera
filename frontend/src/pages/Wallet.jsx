import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { FiDollarSign, FiRefreshCw, FiArrowUpRight, FiArrowDownLeft, FiLogOut, FiSend, FiPlus, FiTrendingUp, FiEye, FiEyeOff, FiX, FiTrash2, FiCheckSquare, FiEdit, FiCreditCard, FiMoreVertical, FiArrowLeft, FiGrid, FiUser, FiList, FiHelpCircle, FiShield, FiFileText, FiPlusCircle, FiDownload } from 'react-icons/fi';
import { FiCopy } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { initMercadoPago, Wallet as MercadoPagoWallet } from '@mercadopago/sdk-react';
import api from '../api/axiosClient';
import Notificaciones from '../components/Notificaciones';
import * as XLSX from 'xlsx';
import './Wallet/Wallet.css';

const mercadoPagoPublicKey = import.meta.env.VITE_MP_PUBLIC_KEY || 'APP_USR-37512469-6774-4d3b-abb8-df8afbba8215';
if (mercadoPagoPublicKey) initMercadoPago(mercadoPagoPublicKey);

function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.45)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 4px 32px rgba(0,0,0,0.18)',
        minWidth: 320,
        maxWidth: 520,
        width: '90%',
        padding: '2rem 1.5rem 1.5rem 1.5rem',
        position: 'relative',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute',
          top: 12,
          right: 16,
          background: 'none',
          border: 'none',
          fontSize: 22,
          color: '#333',
          cursor: 'pointer',
        }} aria-label="Cerrar">
          <FiX />
        </button>
        {children}
      </div>
    </div>
  );
}

export default function Wallet() {
  const [movimientos, setMovimientos] = useState([]);
  const [selectMovMode, setSelectMovMode] = useState(false);
  const [selectedMovIds, setSelectedMovIds] = useState([]);
  const [showConfirmDeleteMovs, setShowConfirmDeleteMovs] = useState(false);

  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileNotificaciones, setShowMobileNotificaciones] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const [showCuponAcreditadoModal, setShowCuponAcreditadoModal] = useState(false);
  const [cuponAcreditadoData, setCuponAcreditadoData] = useState(null);
  const [showIngresoAcreditadoModal, setShowIngresoAcreditadoModal] = useState(false);
  const [ingresoAcreditadoData, setIngresoAcreditadoData] = useState(null);
  const [movimientosTab, setMovimientosTab] = useState('ALL');
  const [deleteMovsMode, setDeleteMovsMode] = useState(null); // 'selected' | 'all'
  const [selectRetPaidMode, setSelectRetPaidMode] = useState(false);
  const [selectedRetPaidIds, setSelectedRetPaidIds] = useState([]);
  const [showConfirmDeleteRetPaid, setShowConfirmDeleteRetPaid] = useState(false);
  const [deleteRetPaidMode, setDeleteRetPaidMode] = useState(null); // 'selected' | 'all'
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [userData, setUserData] = useState({});
  const [modoAcreditacion, setModoAcreditacion] = useState('PORTAL');
  const [showRetiroForm, setShowRetiroForm] = useState(false);
  const [showRetiroFormOtroCbu, setShowRetiroFormOtroCbu] = useState(false);
  const [montoRetiro, setMontoRetiro] = useState('');
  const [cbuRetiro, setCbuRetiro] = useState('');
  const [retiros, setRetiros] = useState([]);
  const [loadingRetiro, setLoadingRetiro] = useState(false);
  const [errorRetiro, setErrorRetiro] = useState('');
  const [successRetiro, setSuccessRetiro] = useState('');
  const [showRetiroTokenModal, setShowRetiroTokenModal] = useState(false);
  const [retiroToken, setRetiroToken] = useState('');
  const [retiroTokenRetiroId, setRetiroTokenRetiroId] = useState(null);
  const [retiroTokenStep, setRetiroTokenStep] = useState(1); // 1 = token1, 2 = token2
  const [loadingRetiroToken, setLoadingRetiroToken] = useState(false);
  const [errorRetiroToken, setErrorRetiroToken] = useState('');
  const [successRetiroToken, setSuccessRetiroToken] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [showPerfilInfoModal, setShowPerfilInfoModal] = useState(false);
  const [showCalculadora, setShowCalculadora] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [showLiquidacion, setShowLiquidacion] = useState(true);
  const [montoCobranza, setMontoCobranza] = useState('');
  const [cuotas, setCuotas] = useState('1');
  const [metodoPago, setMetodoPago] = useState('CREDITO_1_CUOTA');
  const [financingPlans, setFinancingPlans] = useState(null);

  const [actionError, setActionError] = useState('');

  const isDirectBankMode = String(userData?.wallet_mode || '').toUpperCase() === 'DIRECT_BANK';
  const [mostrarDetalle, setMostrarDetalle] = useState(false);
  const [financingStatus, setFinancingStatus] = useState({ editing: false });
  const [showEditPerfil, setShowEditPerfil] = useState(false);
  const [editAlias, setEditAlias] = useState('');
  const [editBanco, setEditBanco] = useState('');
  const [editEdad, setEditEdad] = useState('');
  const [editDireccion, setEditDireccion] = useState('');
  const [editUbicacion, setEditUbicacion] = useState('');
  const [editSexo, setEditSexo] = useState('');

  const getArgentinaISODate = () => {
    const now = new Date();
    const argentinaNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    const y = argentinaNow.getFullYear();
    const m = String(argentinaNow.getMonth() + 1).padStart(2, '0');
    const d = String(argentinaNow.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const [loadingPerfil, setLoadingPerfil] = useState(false);
  const [errorPerfil, setErrorPerfil] = useState('');
  const [successPerfil, setSuccessPerfil] = useState('');
  const [refreshPerfilLoading, setRefreshPerfilLoading] = useState(false);
  const [showFluxPos, setShowFluxPos] = useState(false);
  const [fluxPosMonto, setFluxPosMonto] = useState('');
  const [fluxPosNote, setFluxPosNote] = useState('');
  const [fluxPosCheckoutUrl, setFluxPosCheckoutUrl] = useState('');
  const [fluxPosPreferenceId, setFluxPosPreferenceId] = useState('');
  const [loadingFluxPos, setLoadingFluxPos] = useState(false);
  const [errorFluxPos, setErrorFluxPos] = useState('');
  const [fluxPosQrBase64, setFluxPosQrBase64] = useState('');
  const navigate = useNavigate();

  // Obtener CUIT desde token
  const getCuitFromToken = () => {
    const token = sessionStorage.getItem('token');
    if (!token) return null;
    try {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      return decoded.cuit;
    } catch {
      return null;
    }
  };

  const downloadRetiroComprobante = async (retiroId) => {
    try {
      if (!retiroId) return;
      const res = await api.get(`/retiros/comprobante-pdf/${retiroId}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: res.headers?.['content-type'] || 'application/pdf' });
      const url = window.URL.createObjectURL(blob);

      let filename = `comprobante-retiro-${retiroId}.pdf`;
      const disposition = res.headers?.['content-disposition'] || res.headers?.['Content-Disposition'];
      if (disposition) {
        const match = String(disposition).match(/filename="?([^";]+)"?/i);
        if (match && match[1]) filename = match[1];
      }

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      const msg = e?.response?.data?.msg || e?.message || 'Error descargando comprobante';
      setErrorRetiro(String(msg));
    }
  };

  const [userCuit, setUserCuit] = useState(getCuitFromToken());
  const [liquidacionTotal, setLiquidacionTotal] = useState(null);
  const initialFetchDone = useRef(false);
  const tokenPollRef = useRef(null);
  const fetchDataInFlight = useRef(false);
  const notifCountInFlight = useRef(false);

  const fetchUnreadNotifCount = async () => {
    if (!userCuit) return;
    if (notifCountInFlight.current) return;
    notifCountInFlight.current = true;
    try {
      const response = await api.get(`/notificaciones/${userCuit}`);
      if (response.data?.ok && Array.isArray(response.data?.data)) {
        const count = response.data.data.filter(n => !n.leida).length;
        setUnreadNotifCount(count);
      }
    } catch (e) {
      // noop
    } finally {
      notifCountInFlight.current = false;
    }
  };

  useEffect(() => {
    if (!userCuit) return;
    fetchUnreadNotifCount();
    const interval = setInterval(fetchUnreadNotifCount, 10000);

    const handleFocus = () => fetchUnreadNotifCount();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchUnreadNotifCount();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [userCuit]);

  useEffect(() => {
    if (showMobileMenu || showMobileNotificaciones) fetchUnreadNotifCount();
  }, [showMobileMenu, showMobileNotificaciones]);

  useEffect(() => {
    if (!showRetiroForm) return;
    const normalized = String(userData?.cbu_registro ?? '').replace(/\D/g, '');
    if (normalized) {
      setCbuRetiro(normalized);
    }
  }, [showRetiroForm, userData?.cbu_registro]);

  const openRetiroFormOtroCbu = () => {
    const normalized = String(userData?.cbu_registro ?? '').replace(/\D/g, '');
    setErrorRetiro('');
    setSuccessRetiro('');
    setShowRetiroForm(false);
    setShowRetiroFormOtroCbu(true);
    if (normalized) setCbuRetiro(normalized);
  };

  const fetchUserMe = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data?.data) {
        const nombre = res.data.data.nombre || '';
        const firstName = nombre.split(' ')[0] || '';
        // store first name in userData for greetings
        setUserData(prev => ({ ...prev, firstName }));
      }
    } catch (err) {
    }
  };

  const fetchPerfilCliente = async (currentCuit) => {
    try {
      const clientRes = await api.get('/clientes/perfil/actual');
      if (clientRes.data.data) {
        setUserData(clientRes.data.data);
        if (typeof clientRes.data.data.saldo !== 'undefined') {
          setBalance(Number(clientRes.data.data.saldo || 0));
        }
        // Guardar el modo de acreditación
        if (clientRes.data.data.wallet_mode) {
          setModoAcreditacion(clientRes.data.data.wallet_mode);
        } else {
          setModoAcreditacion('INTERNAL_WALLET');
        }
        // Actualizar liquidación diaria desde el perfil del cliente (como fallback)
        if (typeof clientRes.data.data.liquidacion_diaria !== 'undefined') {
          // No sobreescribir el cálculo local, solo usar como referencia si no hay movimientos
          // setLiquidacionTotal(Number(clientRes.data.data.liquidacion_diaria || 0));
        }
        // Cargar foto de localStorage si existe
        const savedImage = localStorage.getItem(`profile_${currentCuit || userCuit}`);
        if (savedImage) setProfileImage(savedImage);
      }
    } catch (err) {
    }
  };

  const fetchData = async () => {
    if (fetchDataInFlight.current) return;
    fetchDataInFlight.current = true;
    try {
      setLoading(true);
      const token = sessionStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      // actualizar userCuit desde el token actual
      const currentCuit = getCuitFromToken();
      if (currentCuit && currentCuit !== userCuit) setUserCuit(currentCuit);

      // Obtener datos del cliente (con CBU, alias, saldo, liquidacion_diaria)
      await fetchPerfilCliente(currentCuit || userCuit);

      // Movimientos
      // IMPORTANTE: pedimos los movimientos del día (Argentina) desde backend para evitar problemas
      // de timezone al filtrar por created_at en el navegador.
      const hoyISO = getArgentinaISODate();
      const movRes = await api.get(
        `/transacciones?cuit=${encodeURIComponent(currentCuit || userCuit || '')}&fechaDesde=${encodeURIComponent(hoyISO)}&fechaHasta=${encodeURIComponent(hoyISO)}&limit=10000&offset=0`
      );
      const movs = movRes.data.data || [];

      try {
        const byTipo = (Array.isArray(movs) ? movs : []).reduce((acc, m) => {
          const t = String(m?.tipo_movimiento ?? '').toUpperCase() || 'UNKNOWN';
          acc[t] = (acc[t] || 0) + 1;
          return acc;
        }, {});
        const sampleCupon = (Array.isArray(movs) ? movs : []).find(
          (m) => String(m?.tipo_movimiento ?? '').toUpperCase() === 'CUPON'
        );
        if (sampleCupon) {
        }
      } catch (e) {
      }

      const normalizedMovs = movs.map(m => ({
        ...m,
        _source: 'transaccion',
        estado: String(m?.estado ?? '').trim().toUpperCase(),
      }));
      
      // Usar solo los movimientos por ahora
      setMovimientos(normalizedMovs);

      // Retiros
      const retRes = await api.get(`/retiros/historico/${encodeURIComponent(currentCuit || userCuit || '')}`);
      const rawRetiros = retRes.data.data || [];
      const normalizedRetiros = rawRetiros.map(r => ({
        ...r,
        estado: String(r?.estado ?? '').trim().toUpperCase(),
        _source: 'retiro',
      }));
      setRetiros(normalizedRetiros);

      setUserData(prev => ({ ...prev, cuit: currentCuit || userCuit }));
    } catch (error) {
      console.error('Error fetching data:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
      }
    } finally {
      setLoading(false);
      fetchDataInFlight.current = false;
    }
  };

  useEffect(() => {
    fetchData();
    fetchUserMe();
    initialFetchDone.current = true;
  }, []);

  // Si la página se carga sin token (redirigida al login) y luego el usuario
  // inicia sesión en la misma pestaña, muchos flujos no disparan un evento
  // que vuelva a montar este componente. Hacemos un sondeo corto del token
  // en sessionStorage y forzamos la recarga de datos cuando aparece.
  useEffect(() => {
    if (sessionStorage.getItem('token')) return; // ya hay token
    tokenPollRef.current = setInterval(() => {
      const tk = sessionStorage.getItem('token');
      if (tk) {
        clearInterval(tokenPollRef.current);
        tokenPollRef.current = null;
        const cuit = getCuitFromToken();
        if (cuit) setUserCuit(cuit);
        // forzar recarga
        fetchData();
        fetchUserMe();
      }
    }, 500);

    return () => {
      if (tokenPollRef.current) {
        clearInterval(tokenPollRef.current);
        tokenPollRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!userCuit) return;
    if (!initialFetchDone.current) return;
    // Cuando el CUIT cambia (por login), recargar datos
    fetchData();
  }, [userCuit]);

  useEffect(() => {
    if (!showPerfilInfoModal && !showEditPerfil) return;
    fetchPerfilCliente(userCuit);
  }, [showPerfilInfoModal, showEditPerfil, userCuit]);

  useEffect(() => {
    if (!showPerfilInfoModal) return;
    const interval = setInterval(() => {
      fetchPerfilCliente(userCuit);
    }, 15000);
    return () => clearInterval(interval);
  }, [showPerfilInfoModal, userCuit]);

  const refreshPerfilCliente = async () => {
    setRefreshPerfilLoading(true);
    await fetchPerfilCliente(userCuit);
    setRefreshPerfilLoading(false);
  };

  useEffect(() => {
    if (!showCalculadora) return;
    let mounted = true;

    const loadPlansAndStatus = async () => {
      try {
        const normalizeCuit = (value) => String(value ?? '').replace(/[^0-9]/g, '');
        const qcuit = normalizeCuit(userCuit);
        const [plansRes, statusRes] = await Promise.all([
          api.get('/config/financing-plans'),
          api.get(`/config/financing-status${qcuit ? `?cuit=${qcuit}` : ''}`),
        ]);

        const plans = Array.isArray(plansRes.data?.data?.plans) ? plansRes.data.data.plans : [];
        const MAX_CUOTAS = 24;
        const normalized = plans
          .map(p => ({
            cuotas: Number(p?.cuotas),
            ctf_pct: String(p?.ctf_pct ?? ''),
            enabled: p?.enabled === false || p?.enabled === 0 ? 0 : 1,
          }))
          .filter(p =>
            Number.isFinite(p.cuotas) &&
            p.cuotas > 0 &&
            p.cuotas <= MAX_CUOTAS
          );

        const editing = Boolean(statusRes.data?.data?.editing);

        if (!mounted) return;
        setFinancingPlans(normalized);
        setFinancingStatus({ editing });

        const enabledCuotas = normalized
          .filter(p => Number(p.enabled) === 1)
          .map(p => String(p.cuotas));
        const cuotasOptions = enabledCuotas.length > 0 ? enabledCuotas : ['1', '3', '6', '12'];
        if (!cuotasOptions.includes(String(cuotas))) {
          setCuotas(cuotasOptions.sort((a, b) => Number(a) - Number(b))[0]);
        }
      } catch (e) {
        if (!mounted) return;
        setFinancingPlans(null);
        setFinancingStatus({ editing: false });
      }
    };

    loadPlansAndStatus();
    const interval = setInterval(loadPlansAndStatus, 2000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [showCalculadora]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatArsDecimal = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatArsFromCentavosInput = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';
    const centavos = Number(digits);
    if (!Number.isFinite(centavos)) return '';
    return formatArsDecimal(centavos / 100);
  };

  const parseArAmountToCentavos = (raw) => {
    const s = String(raw ?? '').trim();
    if (!s) return 0;
    // Compatibilidad: si viene solo dígitos, interpretarlo como centavos (formato legacy)
    // Ej: "2701851" => 27.018,51
    if (/^\d+$/.test(s)) {
      const centavos = Number(s);
      return Number.isFinite(centavos) ? centavos : 0;
    }
    const normalized = s.replace(/\./g, '').replace(/,/g, '.').replace(/\s+/g, '');
    const num = Number.parseFloat(normalized);
    if (!Number.isFinite(num)) return 0;
    return Math.round(num * 100);
  };

  const formatArAmountInput = (raw) => {
    const s = String(raw ?? '');
    const cleaned = s.replace(/[^0-9.,]/g, '');
    if (!cleaned) return '';

    const parts = cleaned.split(',');
    const intDigits = String(parts[0] ?? '').replace(/\./g, '').replace(/\D/g, '');
    const decimalsRaw = parts.length > 1 ? String(parts.slice(1).join('')).replace(/\D/g, '') : '';

    if (!intDigits && !decimalsRaw) return '';

    const intNumber = Number(intDigits || '0');
    const formattedInt = new Intl.NumberFormat('es-AR', {
      style: 'decimal',
      maximumFractionDigits: 0,
    }).format(intNumber);

    if (parts.length > 1) {
      const decimals = decimalsRaw.slice(0, 2);
      return decimals.length ? `${formattedInt},${decimals}` : `${formattedInt},`;
    }

    return formattedInt;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRetiroRejectedAt = (retiro) => {
    return (
      retiro?.rechazado_at ||
      retiro?.rejected_at ||
      retiro?.fecha_rechazo ||
      retiro?.updated_at ||
      retiro?.created_at ||
      null
    );
  };

  const getRetiroMotivo = (retiro) => {
    return (
      retiro?.motivo_rechazo ||
      retiro?.motivoRechazo ||
      retiro?.motivo ||
      retiro?.reason ||
      retiro?.observacion ||
      retiro?.observaciones ||
      ''
    );
  };

  const getMovimientoMotivo = (mov) => {
    return (
      mov?.motivo_rechazo ||
      mov?.motivoRechazo ||
      mov?.motivo ||
      mov?.reason ||
      mov?.observacion ||
      mov?.observaciones ||
      mov?.detalle_rechazo ||
      mov?.descripcion_rechazo ||
      ''
    );
  };

  const getRetiroEventAt = (retiro) => {
    if (!retiro) return null;
    if (['RECHAZADO', 'RECHAZADA', 'REJECTED', 'DENEGADO', 'DENEGADA'].includes(String(retiro?.estado ?? '').toUpperCase())) {
      return getRetiroRejectedAt(retiro);
    }
    return (
      retiro?.pagado_at ||
      retiro?.approved_at ||
      retiro?.aprobado_at ||
      retiro?.solicitado_at ||
      retiro?.created_at ||
      retiro?.updated_at ||
      null
    );
  };

  const getDisplayName = () => {
    return (userData.firstName) || (userData.nombre) || (userData.razon_social) || 'Cliente';
  };

  const getInitial = () => {
    const name = getDisplayName();
    return name && name.length ? name.charAt(0).toUpperCase() : '';
  };

  // Suma total de los netos liquidados en cupones (APROBADO / PAGADO) y depósitos aprobados
  const computedLiquidacion = useMemo(() => {
    if (!Array.isArray(movimientos)) {
      return 0;
    }

    // La API ya trae movimientos del día (fechaDesde/fechaHasta), no volvemos a filtrar por fecha acá.
    const movimientosHoy = movimientos;

    // Sumar cupones aprobados
    const cupones = movimientosHoy.filter(m => String(m.tipo_movimiento || '').toUpperCase() === 'CUPON' && String(m.estado || '').toUpperCase() !== 'ELIMINADO');
    const cuponesAprobados = cupones.filter(m => ['APROBADO', 'PAGADO'].includes(String(m.estado || '').toUpperCase()));
    const totalCupones = cuponesAprobados.reduce((s, m) => s + Math.abs(Number(m.neto) || 0), 0);

    // Sumar ingresos aprobados (desde tabla movimientos)
    const ingresosAprobados = movimientosHoy.filter(m =>
      String(m.tipo_movimiento || '').toUpperCase() === 'INGRESO' &&
      ['APROBADO', 'PAGADO'].includes(String(m.estado || '').toUpperCase())
    );
    const totalIngresos = ingresosAprobados.reduce((s, m) => s + (Number(m.neto) || 0), 0);

    // Compatibilidad: depósitos aprobados legacy (wallet_movements) si llegan por alguna razón
    const depositosLegacy = movimientosHoy.filter(m =>
      String(m.tipo_movimiento || '').toUpperCase() === 'DEPOSIT_APPROVED'
    );
    const totalDepositosLegacy = depositosLegacy.reduce((s, m) => s + (Number(m.monto) || Number(m.neto) || 0), 0);

    const total = totalCupones + totalIngresos + totalDepositosLegacy;

    return total;
  }, [movimientos]);

  const pendingRetirosHoyTotal = useMemo(() => {
    if (!Array.isArray(retiros)) return 0;
    const today = getArgentinaISODate();
    const allowed = new Set(['PENDIENTE_TOKEN', 'PENDIENTE_TOKEN2', 'VALIDATION', 'PROCESSING', 'APPROVED']);

    const asArgentinaDate = (dt) => {
      if (!dt) return null;
      const d = new Date(dt);
      if (Number.isNaN(d.getTime())) return null;
      const parts = d.toLocaleString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 10);
      return parts;
    };

    return retiros
      .filter((r) => allowed.has(String(r?.estado ?? '').toUpperCase()))
      .filter((r) => {
        const dt = r?.solicitado_at || r?.created_at || r?.updated_at;
        const day = asArgentinaDate(dt);
        return !day || day === today;
      })
      .reduce((s, r) => s + Math.abs(Number(r?.monto || 0) || 0), 0);
  }, [retiros]);

  const displayedLiquidacion = Math.max(0, Number(computedLiquidacion || 0) - Number(pendingRetirosHoyTotal || 0));

  const handleRefresh = () => fetchData();
  const handleLogout = () => { sessionStorage.removeItem('token'); navigate('/login'); };

  const copyToClipboard = async (text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(String(text));
    } catch (e) {
      try {
        const ta = document.createElement('textarea');
        ta.value = String(text);
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e2) {
        console.error('No se pudo copiar al portapapeles', e2);
      }
    }
  };

  const getFluxPosPayload = () => {
    const amount = Number(fluxPosMonto || 0);
    const ts = Date.now();
    const base = {
      app: 'FluxPOS',
      cuit: userCuit,
      amount: isFinite(amount) ? amount : 0,
      note: (fluxPosNote || '').slice(0, 120),
      ts,
    };
    return JSON.stringify(base);
  };
//ENLACE DE REDIRECCION QR
  const getFluxPosRedirectUrl = () => {
    const url = fluxPosCheckoutUrl || import.meta.env.VITE_URL_PAGO;
    return url;
  };

  const getFluxPosQrUrl = () => {
    const payload = getFluxPosRedirectUrl();
    const size = 210;
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(payload)}`;
  };

  // const createFluxPosPreference = async () => {
  //   setErrorFluxPos('');
  //   setLoadingFluxPos(true);
  //   try {
  //     const amount = Number(fluxPosMonto);
  //     const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 1;
  //     const res = await api.post('/mercadopago/preference', {
  //       title: 'Cobro FluxPOS',
  //       amount: safeAmount,
  //     });
  //     const preferenceId = res.data?.preference_id || res.data?.data?.id || res.data?.id;
  //     const initPoint =
  //       res.data?.preference_url ||
  //       res.data?.data?.init_point ||
  //       res.data?.data?.sandbox_init_point ||
  //       res.data?.init_point ||
  //       res.data?.sandbox_init_point;
  //
  //     if (!preferenceId) throw new Error('No se recibió preferenceId');
  //     if (!initPoint) throw new Error('No se recibió init_point');
  //
  //     setFluxPosPreferenceId(preferenceId);
  //     setFluxPosCheckoutUrl(initPoint);
  //   } catch (e) {
  //     const msg = e?.response?.data?.msg || e?.message || 'Error generando link de pago';
  //     setErrorFluxPos(String(msg));
  //     setFluxPosCheckoutUrl('');
  //     setFluxPosPreferenceId('');
  //   } finally {
  //     setLoadingFluxPos(false);
  //   }
  // };

  const createEpagosQr = async () => {
    setErrorFluxPos('');
    setFluxPosQrBase64('');
    setLoadingFluxPos(true);
    try {
      const amount = Number(fluxPosMonto);
      const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 1;

      const res = await api.post('/epagos/qr', {
        amount: safeAmount,
        reference: `ARWPAY-${userData?.id || ''}-${Date.now()}`,
        note: (fluxPosNote || '').slice(0, 120),
      });

      const qrBase64 = res.data?.qrBase64;
      if (!qrBase64) throw new Error('No se recibió QR');

      setFluxPosQrBase64(String(qrBase64));
      setFluxPosCheckoutUrl('');
      setFluxPosPreferenceId('');
    } catch (e) {
      const msg = e?.response?.data?.msg || e?.message || 'Error generando QR';
      setErrorFluxPos(String(msg));
      setFluxPosQrBase64('');
    } finally {
      setLoadingFluxPos(false);
    }
  };

  useEffect(() => {
    if (!showFluxPos) return;
    createEpagosQr();
  }, [showFluxPos]);
 
  const toggleMovSelection = (id) => {
    setSelectedMovIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const exitMovSelectionMode = () => {
    setSelectMovMode(false);
    setSelectedMovIds([]);
  };

  const toggleRetPaidSelection = (id) => {
    setSelectedRetPaidIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const exitRetPaidSelectionMode = () => {
    setSelectRetPaidMode(false);
    setSelectedRetPaidIds([]);
  };

  const requestDeleteSelectedRetPaid = () => {
    if (selectedRetPaidIds.length === 0) return;
    setDeleteRetPaidMode('selected');
    setShowConfirmDeleteRetPaid(true);
  };

  const requestDeleteAllRetPaid = () => {
    setDeleteRetPaidMode('all');
    setShowConfirmDeleteRetPaid(true);
  };

  const confirmDeleteRetPaid = async () => {
    try {
      if (deleteRetPaidMode === 'selected') {
        await api.post('/retiros/ocultar', { ids: selectedRetPaidIds });
      } else if (deleteRetPaidMode === 'all') {
        await api.post('/retiros/ocultar-todo');
      }
      setShowConfirmDeleteRetPaid(false);
      setDeleteRetPaidMode(null);
      exitRetPaidSelectionMode();
      fetchData();
    } catch (e) {
      setShowConfirmDeleteRetPaid(false);
      setDeleteRetPaidMode(null);
    }
  };

  const requestDeleteSelectedMovs = () => {
    if (selectedMovIds.length === 0) return;
    setDeleteMovsMode('selected');
    setShowConfirmDeleteMovs(true);
  };

  const requestDeleteAllMovs = () => {
    setDeleteMovsMode('all');
    setShowConfirmDeleteMovs(true);
  };

  const confirmDeleteMovs = async () => {
    try {
      if (deleteMovsMode === 'selected') {
        await api.post('/transacciones/ocultar', { ids: selectedMovIds });
      } else if (deleteMovsMode === 'all') {
        await api.post('/transacciones/ocultar-todo');
      }
      setShowConfirmDeleteMovs(false);
      setDeleteMovsMode(null);
      exitMovSelectionMode();
      fetchData();
    } catch (e) {
      setShowConfirmDeleteMovs(false);
      setDeleteMovsMode(null);
    }
  };

  const handleProfileImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageData = event.target?.result;
        setProfileImage(imageData);
        localStorage.setItem(`profile_${userCuit}`, imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSolicitarRetiro = async (e, allowOtroCbu = false) => {
    e.preventDefault();
    setErrorRetiro('');
    setSuccessRetiro('');
    setLoadingRetiro(true);

    try {
      const centavos = parseArAmountToCentavos(montoRetiro);
      const monto = centavos / 100;
      if (!monto || monto <= 0) throw new Error('Ingrese un monto válido');

      const maxCentavos = Math.round((Number(displayedLiquidacion || 0) || 0) * 100);
      if (centavos > maxCentavos) {
        throw new Error(`El monto no puede superar tu liquidación diaria (${formatCurrency(displayedLiquidacion || 0)})`);
      }
      
      if (!cbuRetiro || cbuRetiro.length < 22) throw new Error('Ingrese un CBU válido');
      const perfilCbu = String(userData?.cbu_registro ?? '').replace(/\D/g, '');
      if (!allowOtroCbu && perfilCbu && cbuRetiro !== perfilCbu) {
        throw new Error('El CBU ingresado no coincide con el registrado en tu perfil');
      }

      const res = await api.post('/retiros/solicitar', { cuit: userCuit, monto, cbu: cbuRetiro });

      if (res?.data?.requires_token) {
        setRetiroTokenRetiroId(res?.data?.id || null);
        setRetiroToken('');
        setRetiroTokenStep(1);
        setErrorRetiroToken('');
        setSuccessRetiroToken(res?.data?.msg || 'Te enviamos un código a tu correo para autorizar el retiro.');
        setShowRetiroForm(false);
        setShowRetiroFormOtroCbu(false);
        setShowRetiroTokenModal(true);
        return;
      }

      setSuccessRetiro(res?.data?.msg || 'Retiro solicitado correctamente');
      setMontoRetiro('');
      setCbuRetiro('');
      setShowRetiroForm(false);
      setShowRetiroFormOtroCbu(false);
      setTimeout(fetchData, 1000);
    } catch (error) {
      setErrorRetiro(error.response?.data?.msg || error.message);
    } finally {
      setLoadingRetiro(false);
    }
  };

  const handleConfirmarRetiroToken = async (e) => {
    e.preventDefault();
    setErrorRetiroToken('');
    setSuccessRetiroToken('');

    try {
      if (!retiroTokenRetiroId) throw new Error('No se encontró el retiro a confirmar');
      const tokenClean = String(retiroToken || '').trim();
      if (!tokenClean) throw new Error('Ingrese el token');

      setLoadingRetiroToken(true);

      let res;
      if (retiroTokenStep === 2) {
        res = await api.post('/retiros/confirmar-token2', {
          id: retiroTokenRetiroId,
          token: tokenClean,
        });
      } else {
        res = await api.post('/retiros/confirmar-token', {
          id: retiroTokenRetiroId,
          token: tokenClean,
        });
      }

      if (res?.data?.requires_token2) {
        setRetiroTokenStep(2);
        setRetiroToken('');
        setSuccessRetiroToken(res?.data?.msg || 'Te enviamos un segundo código para confirmar el retiro.');
        return;
      }

      setSuccessRetiroToken(res?.data?.msg || 'Retiro confirmado');
      setShowRetiroTokenModal(false);
      setRetiroTokenRetiroId(null);
      setRetiroToken('');
      setRetiroTokenStep(1);
      setMontoRetiro('');
      setCbuRetiro('');
      setTimeout(fetchData, 800);
    } catch (error) {
      setErrorRetiroToken(error.response?.data?.msg || error.message);
    } finally {
      setLoadingRetiroToken(false);
    }
  };

  const handleActualizarPerfil = async (e) => {
    e.preventDefault();
    setErrorPerfil('');
    setSuccessPerfil('');
    setLoadingPerfil(true);

    try {
      if (!editAlias && !editBanco && !editEdad && !editDireccion && !editUbicacion && !editSexo) {
        throw new Error('Ingrese al menos un campo para actualizar');
      }

      const payload = {};
      if (editAlias) payload.alias = editAlias;
      if (editBanco) payload.banco = editBanco;
      if (editEdad) payload.edad = parseInt(editEdad);
      if (editDireccion) payload.direccion = editDireccion;
      if (editUbicacion) payload.ubicacion = editUbicacion;
      if (editSexo) payload.sexo = editSexo;

      await api.put('/clientes/perfil/actual', payload);

      setSuccessPerfil('Perfil actualizado exitosamente');
      setEditAlias('');
      setEditBanco('');
      setEditEdad('');
      setEditDireccion('');
      setEditUbicacion('');
      setEditSexo('');
      setShowEditPerfil(false);
      setTimeout(fetchData, 1000);
    } catch (error) {
      setErrorPerfil(error.response?.data?.msg || error.message);
    } finally {
      setLoadingPerfil(false);
    }
  };

  const handleCuponChange = (e) => {
    const { name, value } = e.target;
    setCuponForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCuotasChange = (e) => {
    setCuotas(e.target.value);
  };

  const handleMetodoPagoChange = (e) => {
    setMetodoPago(e.target.value);
    // Extraer número de cuotas del método de pago si aplica
    const match = e.target.value.match(/(\d+)_CUOTAS?/);
    if (match) {
      setCuotas(match[1]);
    } else {
      setCuotas('1');
    }
  };

  const calcularCobranza = () => {
    const monto = parseFloat(montoCobranza);
    if (!monto || monto <= 0) return null;

    const cantidadCuotas = parseInt(cuotas);

    // Porcentajes CTF por método de pago (editables)
    const metodosPagoCtf = {
      'QR_INTEROPERABLE_3_0': 0,
      'QR_MODO_CON_TARJETA': 0,
      'DEBITO_BANCARIA': 0,
      'DEBITO_PREPAGA': 0,
      'DEBITO_ALIMENTAR': 0,
      'CREDITO_1_CUOTA': 17.85,
      'CREDITO_2_CUOTAS': 25.50,
      'CREDITO_3_CUOTAS': 42.19,
      'CREDITO_6_CUOTAS': 60.28,
      'CREDITO_9_CUOTAS': 85.00,
      'CREDITO_12_CUOTAS': 108.69,
      'CREDITO_18_CUOTAS': 150.00,
      'CREDITO': 120.00
    };

    // Buscar CTF desde planes configurados o usar valor por defecto del método
    let ctf;
    if (Array.isArray(financingPlans)) {
      const planFromBackend = financingPlans.find(p => 
        Number(p.cuotas) === Number(cantidadCuotas) && 
        Number(p.enabled) === 1
      );
      if (planFromBackend && Number.isFinite(Number(planFromBackend.ctf_pct))) {
        ctf = Number(planFromBackend.ctf_pct);
      } else {
        ctf = metodosPagoCtf[metodoPago] || 0;
      }
    } else {
      ctf = metodosPagoCtf[metodoPago] || 0;
    }

    const montoConInteres = monto * (1 + (ctf / 100));
    const precioPorCuota = montoConInteres / cantidadCuotas;

    return {
      cantidadCuotas,
      ctf: Number(ctf).toFixed(2),
      precioPorCuota: Number(precioPorCuota).toFixed(2),
      totalADicar: montoConInteres.toFixed(2),
      metodoPago
    };
  };

  const getEstadoColor = (estado) => {
    const st = String(estado || '').trim().toUpperCase();
    switch (st) {
      case 'PENDIENTE':
      case 'PENDIENTE_TOKEN':
      case 'PENDIENTE_TOKEN2':
      case 'VALIDATION':
      case 'PROCESSING':
        return 'status-pending';
      case 'APROBADO':
      case 'PAGADO':
      case 'APPROVED':
        return 'status-approved';
      case 'RECHAZADO':
      case 'REJECTED':
      case 'DENEGADO':
        return 'status-rejected';
      default:
        return 'status-default';
    }
  };

  const getEstadoLabel = (estado) => {
    const st = String(estado || '').trim().toUpperCase();
    switch (st) {
      case 'APPROVED':
        return 'APROBADO';
      case 'REJECTED':
        return 'RECHAZADO';
      case 'PENDIENTE_TOKEN':
      case 'PENDIENTE_TOKEN2':
      case 'VALIDATION':
      case 'PROCESSING':
        return 'PENDIENTE';
      default:
        return estado;
    }
  };

  const getTipoMovimiento = (tipo) => {
    const tipos = {
      'CUPON': '📊 Cupón Acreditado',
      'AJUSTE_NEGATIVO': '⚠️ Ajuste',
      'PAGO_RETIRO': '💸 Retiro',
      'ACREDITACION': '✅ Acreditación',
      'INGRESO': '💰 Ingreso Acreditado',
      'DEPOSIT_APPROVED': '💰 Ingreso Acreditado'
    };
    return tipos[tipo] || tipo;
  };

  const openCuponAcreditadoModal = (mov) => {
    setCuponAcreditadoData(mov || null);
    setShowCuponAcreditadoModal(true);
  };

  const openIngresoAcreditadoModal = (mov) => {
    setIngresoAcreditadoData(mov || null);
    setShowIngresoAcreditadoModal(true);
  };

  const closeCuponAcreditadoModal = () => {
    setShowCuponAcreditadoModal(false);
    setCuponAcreditadoData(null);
  };

  const closeIngresoAcreditadoModal = () => {
    setShowIngresoAcreditadoModal(false);
    setIngresoAcreditadoData(null);
  };

  const getTransactionIcon = (type) => {
    return type === 'INGRESO' ? (
      <FiArrowDownLeft className="transaction-icon income" />
    ) : (
      <FiArrowUpRight className="transaction-icon expense" />
    );
  };

  // Función para descargar historial completo en Excel
  const downloadHistorialExcel = async () => {
    try {
      // Obtener todos los datos necesarios
      const getCuitFromToken = () => {
        try {
          const token = sessionStorage.getItem('token');
          if (!token) return null;
          const payload = JSON.parse(atob(token.split('.')[1]));
          return payload.cuit || payload.user_cuit || payload.CUIT;
        } catch (e) {
          return null;
        }
      };
      
      const currentCuit = getCuitFromToken();
      const cuit = currentCuit || userCuit;
      
      // Obtener movimientos completos
      const [movRes, cupRes, retRes] = await Promise.all([
        api.get(`/transacciones?cuit=${encodeURIComponent(cuit)}&limit=1000`),
        api.get(`/transacciones?tipo_movimiento=CUPON&cuit=${encodeURIComponent(cuit)}&limit=1000`),
        api.get(`/retiros/historico/${encodeURIComponent(cuit)}`)
      ]);

      const movimientos = movRes.data.data || [];
      const cupones = cupRes.data.data || [];
      const retiros = retRes.data.data || [];

      // Combinar todos los datos
      const allData = [];

      // Agregar cupones con detalles completos
      cupones.forEach(cupon => {
        const bruto = Number(cupon.montoBruto || cupon.monto_bruto || 0);
        const neto = Number(cupon.neto || 0);
        const descuentosSum = Number(cupon.arancel || 0) + Number(cupon.comision || 0) + Number(cupon.ajuste || 0);
        const descuentos = bruto > 0 ? Math.max(0, bruto - neto) : Math.max(0, descuentosSum);
        
        allData.push({
          'Fecha': cupon.created_at ? new Date(cupon.created_at).toLocaleString('es-AR') : '-',
          'Tipo': 'CUPÓN',
          'Estado': String(cupon.estado || '').toUpperCase(),
          'Código': cupon.codigo_cupon || '-',
          'Monto Bruto': bruto,
          'Descuentos': descuentos,
          'Monto Neto': neto,
          'Terminal': cupon.terminal_nombre || cupon.terminal || '-',
          'Sucursal': cupon.sucursal_nombre || cupon.sucursal || '-',
          'CBU Destino': cupon.cbu_cvu || 'Tu cuenta Flux',
          'Detalle': cupon.detalle_cupon || cupon.descripcion || '-'
        });
      });

      // Agregar retiros
      retiros.forEach(retiro => {
        allData.push({
          'Fecha': retiro.solicitado_at ? new Date(retiro.solicitado_at).toLocaleString('es-AR') : '-',
          'Tipo': 'RETIRO',
          'Estado': String(retiro.estado || '').toUpperCase(),
          'Código': retiro.codigo_retiro || '-',
          'Monto Bruto': Number(retiro.monto || 0),
          'Descuentos': 0,
          'Monto Neto': Number(retiro.monto || 0),
          'Comercio': userData?.razon_social || '-',
          'CUIT Comercio': cuit || '-',
          'CBU Destino': retiro.cbu_destino || '-',
          'Detalle': `Retiro solicitado${retiro.observaciones ? ' - ' + retiro.observaciones : ''}`
        });
      });

      // Agregar otros movimientos
      movimientos.forEach(mov => {
        if (mov.tipo_movimiento !== 'CUPON') {
          allData.push({
            'Fecha': mov.created_at ? new Date(mov.created_at).toLocaleString('es-AR') : '-',
            'Tipo': getTipoMovimiento(mov.tipo_movimiento) || mov.tipo_movimiento,
            'Estado': String(mov.estado || '').toUpperCase(),
            'Código': mov.codigo || '-',
            'Monto Bruto': Number(mov.montoBruto || mov.monto_bruto || 0),
            'Descuentos': Number(mov.arancel || 0) + Number(mov.comision || 0),
            'Monto Neto': Number(mov.neto || 0),
            'Comercio': userData?.razon_social || '-',
            'CUIT Comercio': cuit || '-',
            'CBU Destino': '-',
            'Detalle': mov.descripcion || mov.detalle || '-'
          });
        }
      });

      // Ordenar por fecha (más reciente primero)
      allData.sort((a, b) => new Date(b.Fecha) - new Date(a.Fecha));

      // Crear worksheet
      const ws = XLSX.utils.json_to_sheet(allData);
      
      // Crear workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Historial Completo');

      // Ajustar anchos de columnas
      const colWidths = [
        { wch: 20 }, // Fecha
        { wch: 15 }, // Tipo
        { wch: 12 }, // Estado
        { wch: 20 }, // Código
        { wch: 15 }, // Monto Bruto
        { wch: 15 }, // Descuentos
        { wch: 15 }, // Monto Neto
        { wch: 15 }, // Terminal
        { wch: 15 }, // Sucursal
        { wch: 25 }, // CBU Destino
        { wch: 30 }  // Detalle
      ];
      ws['!cols'] = colWidths;

      // Generar nombre de archivo
      const fileName = `Historial_Flux_${userData?.razon_social || 'Cliente'}_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Descargar archivo
      XLSX.writeFile(wb, fileName);
      
    } catch (error) {
      console.error('Error al descargar historial en Excel:', error);
      alert('Error al descargar el historial. Por favor, intente nuevamente.');
    }
  };

  // Función para descargar cupón individual en Excel
  const downloadCuponExcel = (cupon) => {
    try {
      // Extraer datos del cupón exactamente como se muestran en el frontend
      const bruto = Number(cupon.montoBruto || cupon.monto_bruto || 0);
      const neto = Number(cupon.neto || 0);
      const descuentosSum = Number(cupon.arancel || 0) + Number(cupon.comision || 0) + Number(cupon.ajuste || 0);
      const descuentos = bruto > 0 ? Math.max(0, bruto - neto) : Math.max(0, descuentosSum);
      
      const estado = String(cupon?.estado ?? '').trim().toUpperCase();
      const codigo = String(cupon?.codigo_cupon || '').trim();
      const fechaText = cupon?.created_at ? formatDate(cupon.created_at) : '-';
      const origenNombre = cupon?.nombre_comercio || cupon?.razon_social || cupon?.comercio || cupon?.origen_nombre || 'NORDATA MEDIOS DIGITALES S.A.S';
      const origenCuit = cupon?.cuit_comercio || cupon?.origen_cuit || '30-71890890-2';
      const destinoCuit = cupon?.cuit || userData?.cuit || '20368387062';
      const destinoCuenta = cupon?.cbu_cvu || 'Tu cuenta Flux';
      const motivo = cupon?.detalle_cupon || cupon?.descripcion || cupon?.motivo || 'Sin motivo';
      const terminal = cupon.terminal_nombre || cupon.terminal || '-';
      const sucursal = cupon.sucursal_nombre || cupon.sucursal || '-';
      //const terminal = cupon?.terminal || '-';
      //const sucursal = cupon?.sucursal || '-';
      
      // Calcular IVA de comisión Flux
      const ivaComisionFlux = (cupon?.comision_flux_pct && cupon?.iva_comision_flux_pct && cupon?.comision) 
        ? (Number(cupon.comision) * (Number(cupon.iva_comision_flux_pct) / 100))
        : 0;
      
      // Crear datos para el Excel con el mismo formato que el frontend
      const excelData = [
        // Encabezado principal
        ['DETALLES DEL CUPÓN'],
        [],
        // Montos principales
        ['MONTO LIQUIDADO', neto],
        ['DESCUENTOS', `-${descuentos}`],
        ['MONTO BRUTO', bruto],
        [],
        ['ESTADO', `CUPON ${estado}`],
        ['ID', codigo],
        ['FECHA', fechaText],
        [],
        // Información de la transacción
        ['TIPO', 'ACREDITACIÓN'],
        ['MOTIVO', motivo],
        [],
        // Información de origen y destino
        ['ORIGEN', ''],
        ['Comercio', origenNombre],
        ['CUIT/CUIT', origenCuit],
        ['Fecha', fechaText],
        [],
        ['DESTINO', ''],
        ['CUIT/CUIT', destinoCuit],
        ['CBU/CVU', destinoCuenta],
        [],
        // Información de terminal y sucursal
        ['INFORMACIÓN DE TERMINAL'],
        ['Terminal', terminal],
        ['Sucursal', sucursal],
        [],
        // Detalles de descuentos (tabla detallada)
        ['DETALLES DE DESCUENTOS'],
        [],
        ['Concepto', 'Monto'],
        ['Monto bruto', bruto],
        ['Comisión Flux', cupon?.comision || 0],
        ['IVA Com Flux', ivaComisionFlux],
        ['Conciliación Bancaria', cupon?.ajuste || 0],
        ['Otros', cupon?.arancel || 0],
        ['Total descuentos', `-${descuentos}`],
        [],
        // Resumen final
        ['MONTO LIQUIDADO FINAL', neto],
        ['CBU/CVU DESTINO', cupon?.cbu_cvu || '-'],
        [],
        // Nota importante
        ['NOTA: Pago procesado: La acreditación es inmediata, en algunos casos puede demorar hasta 72 hs hábiles bancarias según banco o billetera receptora.']
      ];

      // Crear worksheet
      const ws = XLSX.utils.aoa_to_sheet(excelData);
      
      // Crear workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Detalles del Cupón');

      // Ajustar anchos de columnas
      ws['!cols'] = [
        { wch: 25 }, // Columna 1: Conceptos
        { wch: 20 }  // Columna 2: Valores
      ];

      // Generar nombre de archivo
      const fileName = `Cupon_${codigo}_${origenNombre}_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Descargar archivo
      XLSX.writeFile(wb, fileName);
      
    } catch (error) {
      console.error('Error al descargar cupón en Excel:', error);
      alert('Error al descargar el cupón. Por favor, intente nuevamente.');
    }
  };

  // =====================
  // RENDER PRINCIPAL
  // =====================

  if (loading) {
    return <div className="wallet-container"><p>Cargando...</p></div>;
  }

  return (
    <div className="wallet-container">

      {/* HEADER CON PERFIL */}
      <div className="wallet-header-profile">
        <div className="profile-section">
          <div className="profile-avatar-container">
            <div className="profile-avatar">
              {profileImage ? (
                <img src={profileImage} alt="Perfil" />
              ) : (
                <div className="avatar-placeholder">{getInitial()}</div>
              )}
              <label className="avatar-upload-btn" title="Cambiar foto de perfil">
                <FiPlus />
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleProfileImageUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>
          
          <div className="profile-info-section">
            <div className="profile-greeting">
              <h1>Hola, <span>{(userData.firstName) || (userData.razon_social || 'Cliente').split(' ')[0]}</span></h1>
            </div>
          </div>
        </div>

        <div className="header-actions">
          <button onClick={handleRefresh} className="btn-icon header-action-btn wallet-mobile-refresh-btn" title="Actualizar"><FiRefreshCw /></button>

          <button
            type="button"
            className="btn-icon wallet-mobile-menu-btn"
            title="Menú"
            onClick={() => setShowMobileMenu(true)}
          >
            <FiMoreVertical />
          </button>
        </div>
      </div>

      {showMobileMenu && (
        <div className="wallet-mobile-menu-overlay" onClick={() => setShowMobileMenu(false)}>
          <div className="wallet-mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="wallet-mobile-drawer-header">
              <button
                type="button"
                className="wallet-mobile-drawer-back"
                onClick={() => setShowMobileMenu(false)}
                aria-label="Cerrar"
              >
                <FiArrowLeft />
              </button>
              <div className="wallet-mobile-drawer-user">
                <div className="wallet-mobile-drawer-name">
                  {String(userData?.firstName || userData?.razon_social || 'Cliente').toUpperCase()}
                </div>
                <div className="wallet-mobile-drawer-role">Cliente</div>
              </div>
            </div>

            <div className="wallet-mobile-drawer-section">
              <div className="wallet-mobile-drawer-section-title">Mi cuenta</div>
              <div className="wallet-mobile-drawer-card">
                <button type="button" className="wallet-mobile-drawer-item" onClick={() => setShowMobileMenu(false)}>
                  <FiGrid /> Dashboard
                </button>
                <button
                  type="button"
                  className="wallet-mobile-drawer-item"
                  onClick={() => {
                    setShowMobileMenu(false);
                    setShowMobileNotificaciones(true);
                  }}
                >
                  <span className="wallet-mobile-drawer-item-text">Mis notificaciones</span>
                  {unreadNotifCount > 0 && (
                    <span className="wallet-mobile-drawer-badge">{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</span>
                  )}
                </button>
                <button
                  type="button"
                  className="wallet-mobile-drawer-item"
                  onClick={() => {
                    setShowMobileMenu(false);
                    setShowPerfilInfoModal(true);
                  }}
                >
                  <FiUser /> Mi perfil
                </button>
                {/*<button type="button" className="wallet-mobile-drawer-item" onClick={() => setShowMobileMenu(false)}>
                  <FiList /> Movimientos
                </button>*/}
              </div>
            </div>

            <div className="wallet-mobile-drawer-section">
              <div className="wallet-mobile-drawer-section-title">Flux</div>
              <div className="wallet-mobile-drawer-card">
                <button
                  type="button"
                  className="wallet-mobile-drawer-item"
                  onClick={() => {
                    setShowMobileMenu(false);
                    setShowFluxPos(true);
                  }}
                >
                  <FiCreditCard /> ARW PAY
                </button>
                <a 
                  href="/soporte.html"
                  type="button" 
                  className="wallet-mobile-drawer-item" 
                  onClick={() => {
                    setShowMobileMenu(false);
                }}>
                  <FiHelpCircle /> Soporte
                </a>
                <a 
                  href="/politicas-privacidad.html" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="wallet-mobile-drawer-item"
                  onClick={() => setShowMobileMenu(false)}
                >
                  <FiShield /> Políticas de privacidad
                </a>
                <a 
                  type="button" 
                  className="wallet-mobile-drawer-item" 
                  onClick={() => setShowMobileMenu(false)} 
                  href="/terminos.html" 
                  >
                  <FiFileText /> 
                      Términos y condiciones
                </a>
              </div>
            </div>

            <div className="wallet-mobile-drawer-section">
              <div className="wallet-mobile-drawer-section-title">Herramientas</div>
              <div className="wallet-mobile-drawer-card">
                <button
                  type="button"
                  className="wallet-mobile-drawer-item"
                  onClick={() => {
                    setShowMobileMenu(false);
                    setShowCalculadora(true);
                  }}
                >
                  <FiTrendingUp /> Calculadora de ventas
                </button>
                <button type="button" className="wallet-mobile-drawer-item" onClick={() => setShowMobileMenu(false)}>
                  <FiPlusCircle /> Solicitud de rollitos
                </button>
              </div>
            </div>

            <div className="wallet-mobile-drawer-footer">
              <button type="button" className="wallet-mobile-drawer-logout" onClick={handleLogout}>
                <FiLogOut /> Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal open={showMobileNotificaciones} onClose={() => setShowMobileNotificaciones(false)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Notificaciones</h3>
        </div>
        <div style={{ marginTop: 12 }}>
          <Notificaciones cuit={userCuit} embedded />
        </div>
      </Modal>

      <Modal open={showPerfilInfoModal} onClose={() => setShowPerfilInfoModal(false)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Mi perfil</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={refreshPerfilCliente}
              disabled={refreshPerfilLoading}
            >
              {refreshPerfilLoading ? 'Actualizando...' : 'Refrescar'}
            </button>
            <button
              type="button"
              className="btn-icon"
              onClick={() => {
                setShowPerfilInfoModal(false);
                setShowEditPerfil(true);
              }}
              title="Editar perfil"
            >
              <FiEdit />
            </button>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="info-item">
            <span className="info-label">CUIT:</span>
            <span className="info-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {userData.cuit}
              <button
                title="Copiar CUIT"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                onClick={() => navigator.clipboard.writeText(userData.cuit)}
              >
                <FiCopy />
              </button>
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">CBU</span>
            <span className="info-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {userData.cbu_registro ? userData.cbu_registro : <em style={{color: '#999'}}>No configurado</em>}
              {userData.cbu_registro && (
                <button
                  title="Copiar CBU"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  onClick={() => navigator.clipboard.writeText(userData.cbu_registro)}
                >
                  <FiCopy />
                </button>
              )}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Banco:</span>
            <span className="info-value">
              {userData.banco ? userData.banco : <em style={{color: '#999'}}>No configurado</em>}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Alias:</span>
            <span className="info-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {userData.alias ? userData.alias : <em style={{color: '#999'}}>No configurado</em>}
              {userData.alias && (
                <button
                  title="Copiar Alias"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  onClick={() => navigator.clipboard.writeText(userData.alias)}
                >
                  <FiCopy />
                </button>
              )}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Edad:</span>
            <span className="info-value">
              {userData.edad ? userData.edad : <em style={{color: '#999'}}>No configurado</em>}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Dirección:</span>
            <span className="info-value">
              {userData.direccion ? userData.direccion : <em style={{color: '#999'}}>No configurado</em>}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Ubicación:</span>
            <span className="info-value">
              {userData.ubicacion ? userData.ubicacion : <em style={{color: '#999'}}>No configurado</em>}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Sexo:</span>
            <span className="info-value">
              {userData.sexo ? userData.sexo : <em style={{color: '#999'}}>No configurado</em>}
            </span>
          </div>
        </div>
      </Modal>

      {/* TARJETA DE SALDO - NUEVA ESTRUCTURA */}
      <div className="balance-card-new">
        {/* SECCIÓN SUPERIOR: PERFIL Y HOLA */}
        <div className="balance-header">
          <div className="balance-profile">
            <div className="balance-avatar-small">
              {profileImage ? (
                <img src={profileImage} alt="Perfil" />
              ) : (
                <div>{getInitial()}</div>
              )}
            </div>
              <div className="balance-greeting-small">
            </div>
          </div>
        </div>

        {/* LÍNEA DIVISORIA */}
        <div className="divider"></div>

        {/* SECCIÓN LIQUIDACIÓN DIARIA */}
        <div className="balance-liquidacion">
          <div className="liquidacion-label">
            <span>Liquidación Diaria</span>
          </div>
          
          <div className="liquidacion-monto">
            <>
              <span className="monto-valor">{showLiquidacion ? formatCurrency(displayedLiquidacion) : '••••••'}</span>
            </>
            <button
              title={showLiquidacion ? "Ocultar liquidación" : "Mostrar liquidación"}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0,
               marginLeft: '8px' }}
              onClick={() => setShowLiquidacion(!showLiquidacion)}
            >
              {showLiquidacion ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
        </div>

        <div className="divider"></div>
      </div>

      {/* BOTONES DE ACCIÓN */}
      <div className="balance-actions">
        {!isDirectBankMode && (
          <button
            type="button"
            className="btn-ingreso"
            onClick={() => {
              setActionError('');
              navigate('/deposit');
            }}
          >
            <span className="wallet-action-icon">
              <FiPlusCircle />
            </span>
            <span className="wallet-action-label">Ingresar</span>
          </button>
        )}

        {!isDirectBankMode && (
          <button
            type="button"
            className="btn-retiro"
            onClick={() => {
              setActionError('');
              setShowRetiroForm(true);
            }}
          >
            <span className="wallet-action-icon">
              <FiSend />
            </span>
            <span className="wallet-action-label">Retirar</span>
          </button>
        )}
        
        <button onClick={() => setShowCalculadora(!showCalculadora)} className="btn-calculadora">
          <span className="wallet-action-icon">
            <FiTrendingUp />
          </span>
          <span className="wallet-action-label">{showCalculadora ? 'Cancelar' : 'Calculadora'}</span>
        </button>
        
        <button className="btn-fluxpos" onClick={() => setShowFluxPos(true)}>
          <span className="wallet-action-icon">
            <FiCreditCard />
          </span>
          <span className="wallet-action-label">ARW PAY</span>
        </button>
      </div>

      {actionError && (
        <div className="alert alert-error" style={{ marginTop: 10 }}>
          {actionError}
        </div>
      )}

      {/* FLUXPOS */}
      <Modal open={showFluxPos} onClose={() => setShowFluxPos(false)}>
        <div className="fluxpos-modal">
          <div className="fluxpos-header">
            <div>
              <div className="fluxpos-title">Cobro con QR</div>
              <div className="fluxpos-subtitle"></div>
            </div>
          </div>

          <div className="fluxpos-grid">
            <div className="fluxpos-qr-card">
              <div className="fluxpos-qr-wrap">
                {fluxPosQrBase64 ? (
                  <img className="fluxpos-qr" src={`data:image/png;base64,${fluxPosQrBase64}`} alt="QR de pago" />
                ) : (
                  <div className="fluxpos-qr" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {loadingFluxPos ? 'Generando QR...' : errorFluxPos ? 'No se pudo generar el QR' : 'QR no disponible'}
                  </div>
                )}
              </div>
              <div className="fluxpos-qr-meta">
                <div className="fluxpos-meta-item">
                  <span className="fluxpos-meta-label">CUIT</span>
                  <span className="fluxpos-meta-value">{userCuit || '-'}</span>
                </div>
                <div className="fluxpos-meta-item">
                  <span className="fluxpos-meta-label">Importe</span>
                  <span className="fluxpos-meta-value">{fluxPosMonto ? formatCurrency(Number(fluxPosMonto || 0)) : 'A definir'}</span>
                </div>
                <div className="fluxpos-meta-item">
                  <span className="fluxpos-meta-label">Estado</span>
                  <span className="fluxpos-meta-value">
                    {loadingFluxPos ? 'Generando link...' : (errorFluxPos ? 'Error' : 'Listo')}
                  </span>
                </div>
                {errorFluxPos && (
                  <div className="fluxpos-meta-item">
                    <span className="fluxpos-meta-label">Detalle</span>
                    <span className="fluxpos-meta-value">{errorFluxPos}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="fluxpos-info">
              <div className="fluxpos-form">
                <div className="fluxpos-field">
                  <label>Monto (ARS)</label>
                  <input
                    type="number"
                    value={fluxPosMonto}
                    onChange={(e) => setFluxPosMonto(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
                <span>En caso de que el monto no sea aplicado, por favor recuerde actualizar el código QR.</span>
              {/*
                <div className="fluxpos-field">
                  <label>Detalle (opcional)</label>
                  <input
                    type="text"
                    value={fluxPosNote}
                    onChange={(e) => setFluxPosNote(e.target.value)}
                    placeholder="Ej: Venta mostrador"
                    maxLength={120}
                  />
                </div>
              */}   

              </div>
            </div>
    
          </div>

          <div className="fluxpos-footer">
            <button className="btn-secondary" type="button" onClick={createEpagosQr} disabled={loadingFluxPos}>Actualizar QR</button>
            <button className="btn-secondary" type="button" onClick={() => setShowFluxPos(false)}>Cerrar</button>
          </div>
        </div>
      </Modal>

      {/* Variables para el modal de cupón - definidas en el scope principal */}
      {(() => {
        if (!cuponAcreditadoData) return null;
        
        window.cuponModalVars = {
          bruto: Number(cuponAcreditadoData?.montoBruto || 0),
          neto: Number(cuponAcreditadoData?.neto || 0),
          descuentosSum: Number(cuponAcreditadoData?.arancel || 0) + Number(cuponAcreditadoData?.comision || 0) + Number(cuponAcreditadoData?.ajuste || 0),
          descuentos: 0,
          estado: String(cuponAcreditadoData?.estado || '').toUpperCase() || '-',
          numero: cuponAcreditadoData?.numero_autorizacion || cuponAcreditadoData?.numero_lote || cuponAcreditadoData?.marca_tarjeta || '-',
          motivo: cuponAcreditadoData?.detalle_cupon || cuponAcreditadoData?.descripcion || '-',
          codigo: String(cuponAcreditadoData?.codigo_cupon || '').trim(),
          fechaText: cuponAcreditadoData?.created_at ? formatDate(cuponAcreditadoData.created_at) : '-',
          origenNombre: cuponAcreditadoData?.nombre_comercio || cuponAcreditadoData?.razon_social || cuponAcreditadoData?.comercio || cuponAcreditadoData?.origen_nombre || 'NORDATA MEDIOS DIGITALES S.A.S',
          origenCuit: cuponAcreditadoData?.cuit_comercio || cuponAcreditadoData?.origen_cuit || '30-71890890-2',
          destinoCuit: cuponAcreditadoData?.cuit || userData?.cuit || '20368387062',
          destinoCuenta: cuponAcreditadoData?.cbu_cvu || 'Tu cuenta Flux'
        };
        
        window.cuponModalVars.descuentos = window.cuponModalVars.bruto > 0 ? Math.max(0, window.cuponModalVars.bruto - window.cuponModalVars.neto) : Math.max(0, window.cuponModalVars.descuentosSum);
        
        return null;
      })()}

      <Modal open={showCuponAcreditadoModal} onClose={closeCuponAcreditadoModal} style={{ maxWidth: '400px' }}>
        {(() => {
          const bruto = Number(cuponAcreditadoData?.montoBruto || 0);
          const neto = Number(cuponAcreditadoData?.neto || 0);
          const descuentosSum = Number(cuponAcreditadoData?.arancel || 0) + Number(cuponAcreditadoData?.comision || 0) + Number(cuponAcreditadoData?.ajuste || 0);
          const descuentos = bruto > 0 ? Math.max(0, bruto - neto) : Math.max(0, descuentosSum);
          const estado = String(cuponAcreditadoData?.estado || '').toUpperCase() || '-';
          const numero = cuponAcreditadoData?.numero_autorizacion || cuponAcreditadoData?.numero_lote || cuponAcreditadoData?.marca_tarjeta || '-';
          const motivo = cuponAcreditadoData?.detalle_cupon || cuponAcreditadoData?.descripcion || '-';
          const codigo = String(cuponAcreditadoData?.codigo_cupon || '').trim();
          const fechaText = cuponAcreditadoData?.created_at ? formatDate(cuponAcreditadoData.created_at) : '-';
          const origenNombre = cuponAcreditadoData?.nombre_comercio || cuponAcreditadoData?.razon_social || cuponAcreditadoData?.comercio || cuponAcreditadoData?.origen_nombre || 'NORDATA MEDIOS DIGITALES S.A.S';
          const origenCuit = cuponAcreditadoData?.cuit_comercio || cuponAcreditadoData?.origen_cuit || '30-71890890-2';
          const destinoCuit = cuponAcreditadoData?.cuit || userData?.cuit || '20368387062';
          const destinoCuenta = cuponAcreditadoData?.cbu_cvu || 'Tu cuenta Flux';
          const iva = cuponAcreditadoData?.iva_comision || 0;
          
          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 900 }}>Detalles del cupon</div>
                {['APROBADO', 'PAGADO'].includes(estado) && (
                  <button
                    type="button"
                    title="Descargar cupón en Excel"
                    style={{ 
                      background: '#059669', 
                      color: 'white', 
                      border: 'none', 
                      padding: '8px 12px', 
                      borderRadius: '8px', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}
                    onClick={() => downloadCuponExcel(cuponAcreditadoData)}
                  >
                    <FiDownload /> Descargar Excel
                  </button>
                )}
              </div>

              <div
                style={{
                  borderRadius: 16,
                  padding: 12,
                  color: '#fff',
                  background: 'linear-gradient(135deg, #4b73f7ff 0%, #ec4899 55%, #f59e0b 120%)',
                  border: '2px solid #34d399',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 700 }}>Monto liquidado</div>
                <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 0.2, marginTop: 4 }}>{formatCurrency(neto)}</div>

                <div style={{ marginTop: 12, fontSize: 12, opacity: 0.9, fontWeight: 700 }}>Descuentos</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{`- ${formatCurrency(descuentos)}`}</div>

                <div style={{ marginTop: 12, fontSize: 12, opacity: 0.9, fontWeight: 700 }}>Monto bruto</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{formatCurrency(bruto)}</div>

                <div style={{ height: 1, background: 'rgba(255,255,255,0.35)', margin: '14px 0' }} />

                <div style={{ fontSize: 14, fontWeight: 800 }}>{`Estado: CUPON ${estado}`}</div>
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 700 }}>ID:</div>
                  <div style={{ fontFamily: 'Courier New, monospace', fontWeight: 900 }}>{codigo || '-'}</div>
                  {!!codigo && (
                    <button
                      type="button"
                      title="Copiar código"
                      style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.35)', color: '#fff', borderRadius: 10, padding: '6px 8px', cursor: 'pointer' }}
                      onClick={() => copyToClipboard(codigo)}
                    >
                      <FiCopy />
                    </button>
                  )}
                  <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', color: '#302929ff' }} onClick={() => {
                                              setMostrarDetalle(!mostrarDetalle);
                     }}>
                    Más información
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 12, borderRadius: 16, background: '#f3e8ff', padding: 10, border: '1px solid #e9d5ff' }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#1f2937' }}>Tipo</div>
                <div style={{ marginTop: 6, fontWeight: 900, color: '#1d4ed8' }}>{`ACREDITACIÓN`}</div>
                <div style={{ height: 1, background: '#e9d5ff', margin: '12px 0' }} />
                <div style={{ fontSize: 14, fontWeight: 900, color: '#1f2937' }}>Motivo</div>
                <div style={{ marginTop: 6, fontWeight: 700, color: '#111827' }}>{motivo || 'Sin motivo'}</div>
              </div>

              <div style={{ marginTop: 12, borderRadius: 16, background: '#fff', padding: 10, border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 10, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#6b7280' }}>↓</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, color: '#111827' }}>{origenNombre}</div>
                    <div style={{ marginTop: 2, fontSize: 12, fontWeight: 800, color: '#374151' }}>{`CUIL/CUIT: ${origenCuit}`}</div>
                    <div style={{ marginTop: 2, fontSize: 12, fontWeight: 800, color: '#374151' }}>{cuponAcreditadoData?.created_at ? formatDate(cuponAcreditadoData.created_at) : '-'}</div>
                  </div>
                </div>

                <div style={{ height: 1, background: '#f3f4f6', margin: '12px 0' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 10, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#4f46e5' }}>↑</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#6b7280' }}>Para</div>
                    <div style={{ marginTop: 2, fontSize: 12, fontWeight: 800, color: '#374151' }}>{`CUIL/CUIT: ${destinoCuit}`}</div>
                    <div
                      style={{ marginTop: 2, fontSize: 12, fontWeight: 700, color: '#9ca3af' }}
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(destinoCuenta) }}
                    />
                  </div>
                </div>
              </div>
              <div style={{ height: 1, background: '#f3f4f6', margin: '12px 0' }} >
                <h3 style={{ marginTop: 2, fontSize: 12, fontWeight: 800, color: '#374151' }}>
                  Pago procesado: La acreditación es inmediata, en algunos casos puede demorar hasta 72 hs hábiles bancarias
                  según banco o billetera receptora.
                </h3>
              </div><br />
             { /* <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', color: '#302929ff' }} onClick={() => {
                                              setMostrarDetalle(!mostrarDetalle);
                     }}>
                    Más información
              </div> */}
            </div>
          );
        })()}
      </Modal>

      <Modal open={showIngresoAcreditadoModal} onClose={closeIngresoAcreditadoModal} style={{ maxWidth: '400px' }}>
        {(() => {
          const bruto = Number(ingresoAcreditadoData?.montoBruto || ingresoAcreditadoData?.monto_bruto || 0);
          const neto = Number(ingresoAcreditadoData?.neto || 0);
          const descuentosSum = Number(ingresoAcreditadoData?.arancel || 0) + Number(ingresoAcreditadoData?.comision || 0) + Number(ingresoAcreditadoData?.ajuste || 0);
          const descuentos = bruto > 0 ? Math.max(0, bruto - neto) : Math.max(0, descuentosSum);
          const estado = String(ingresoAcreditadoData?.estado || '').toUpperCase() || '-';
          const fechaText = ingresoAcreditadoData?.created_at ? formatDate(ingresoAcreditadoData.created_at) : '-';
          const motivo = ingresoAcreditadoData?.detalle_descripcion || ingresoAcreditadoData?.descripcion || 'Ingreso validado por administración';
          const destinoCuit = ingresoAcreditadoData?.cuit || userData?.cuit || '-';
          const destinoCuenta = userData?.cbu_registro || userData?.alias || 'Tu cuenta';

          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 900 }}>Detalles del ingreso</div>
              </div>

              <div
                style={{
                  borderRadius: 16,
                  padding: 12,
                  color: '#fff',
                  background: 'linear-gradient(135deg, #4b73f7ff 0%, #ec4899 55%, #f59e0b 120%)',
                  border: '2px solid #34d399',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 700 }}>Neto liquidado</div>
                <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 0.2, marginTop: 4 }}>{formatCurrency(neto)}</div>

                <div style={{ marginTop: 12, fontSize: 12, opacity: 0.9, fontWeight: 700 }}>Descuentos</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{`- ${formatCurrency(descuentos)}`}</div>

                <div style={{ marginTop: 12, fontSize: 12, opacity: 0.9, fontWeight: 700 }}>Monto bruto</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{formatCurrency(bruto)}</div>

                <div style={{ height: 1, background: 'rgba(255,255,255,0.35)', margin: '14px 0' }} />

                <div style={{ fontSize: 14, fontWeight: 800 }}>{`Estado: INGRESO ${estado}`}</div>
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 700 }}>Fecha:</div>
                  <div style={{ fontFamily: 'Courier New, monospace', fontWeight: 900 }}>{fechaText}</div>
                </div>
              </div>

              <div style={{ marginTop: 12, borderRadius: 16, background: '#f3e8ff', padding: 10, border: '1px solid #e9d5ff' }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#1f2937' }}>Tipo</div>
                <div style={{ marginTop: 6, fontWeight: 900, color: '#1d4ed8' }}>{`INGRESO`}</div>
                <div style={{ height: 1, background: '#e9d5ff', margin: '12px 0' }} />
                <div style={{ fontSize: 14, fontWeight: 900, color: '#1f2937' }}>Detalle</div>
                <div style={{ marginTop: 6, fontWeight: 700, color: '#111827' }}>{motivo || '-'}</div>
              </div>

              <div style={{ marginTop: 12, borderRadius: 16, background: '#fff', padding: 10, border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 10, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#6b7280' }}>↓</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, color: '#111827' }}>ADMINISTRACIÓN</div>
                    <div style={{ marginTop: 2, fontSize: 12, fontWeight: 800, color: '#374151' }}>{fechaText}</div>
                  </div>
                </div>

                <div style={{ height: 1, background: '#f3f4f6', margin: '12px 0' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 10, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#4f46e5' }}>↑</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#6b7280' }}>Para</div>
                    <div style={{ marginTop: 2, fontSize: 12, fontWeight: 800, color: '#374151' }}>{`CUIL/CUIT: ${destinoCuit}`}</div>
                    <div style={{ marginTop: 2, fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>{destinoCuenta}</div>
                  </div>
                </div>
              </div>

              <div style={{ height: 1, background: '#f3f4f6', margin: '12px 0' }}>
                <h3 style={{ marginTop: 2, fontSize: 12, fontWeight: 800, color: '#374151' }}>
                  Pago procesado: La acreditación es inmediata, en algunos casos puede demorar hasta 72 hs hábiles bancarias
                  según banco o billetera receptora.
                </h3>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* INFORMACIÓN ADICIONAL - SE MUESTRA AL HACER CLIC EN "MÁS INFORMACIÓN" */}
  {mostrarDetalle && (
  <>
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: 9998
      }}
      onClick={() => setMostrarDetalle(false)}
    />

    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: '#fff',
        padding: '12px',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        zIndex: 9999,
        minWidth: '260px',
        maxWidth: '300px'
      }}
    >
      <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#111827' }}>
        Información del Cupón
      </h4>

      <div style={{ marginBottom: '6px' }}>
        <div style={{ fontSize: '12px', fontWeight: '700', color: '#6b7280' }}>Estado</div>
        <div style={{ fontSize: '14px', color: '#111827' }}>
          {window.cuponModalVars?.estado || '-'}
        </div>
      </div>

      <div style={{ marginBottom: '6px' }}>
        <div style={{ fontSize: '12px', fontWeight: '700', color: '#6b7280' }}>Código</div>
        <div style={{ fontSize: '14px', color: '#111827' }}>
          {window.cuponModalVars?.codigo || '-'}
        </div>
      </div>

      <div style={{ marginBottom: '6px' }}>
        <div style={{ fontSize: '12px', fontWeight: '700', color: '#6b7280' }}>
          Fecha de Transacción
        </div>
        <div style={{ fontSize: '14px', color: '#111827' }}>
          {window.cuponModalVars?.fechaText || '-'}
        </div>
      </div>

      <div style={{ marginBottom: '6px' }}>
        <div style={{ fontSize: '12px', fontWeight: '700', color: '#6b7280' }}>
          Motivo / Detalle
        </div>
        <div style={{ fontSize: '14px', color: '#111827' }}>
          {window.cuponModalVars?.motivo || '-'}
        </div>
      </div>

      {/* DESCUENTOS */}
      <div
        style={{
          marginTop: '8px',
          background: 'linear-gradient(90deg, #d63384 0%, #a855f7 100%)',
          color: '#fff',
          fontWeight: 900,
          textAlign: 'center',
          padding: '6px',
          borderRadius: '10px'
        }}
      >
        Detalles
      </div>

      <div
        style={{
          marginTop: '8px',
          border: '1px solid #fbcfe8',
          borderRadius: '10px',
          overflow: 'hidden'
        }}
      >
        <div style={{ padding: '8px', background: '#fbcfe8' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ fontSize: '11px', fontWeight: 900, color: '#111827', padding: '2px 0' }}>
                  Monto bruto
                </td>
                <td style={{ fontSize: '11px', fontWeight: 900, color: '#111827', padding: '2px 0', textAlign: 'right' }}>
                  {formatCurrency(window.cuponModalVars?.bruto || 0)}
                </td>
              </tr>

              <tr>
                <td style={{ fontSize: '11px', fontWeight: 900, color: '#111827', padding: '2px 0' }}>  
                  Comisión Flux
                </td>
                <td style={{ fontSize: '11px', fontWeight: 900, color: '#111827', padding: '2px 0', textAlign: 'right' }}>
                  {formatCurrency(cuponAcreditadoData?.comision || 0)}
                </td>
              </tr>

              <tr>
                <td style={{ fontSize: '11px', fontWeight: 900, color: '#111827', padding: '2px 0' }}>
                  IVA Com Flux
                </td>
                <td style={{ fontSize: '11px', fontWeight: 900, color: '#111827', padding: '2px 0', textAlign: 'right' }}>
                  {formatCurrency(
                    (cuponAcreditadoData?.comision_flux_pct && cuponAcreditadoData?.iva_comision_flux_pct && cuponAcreditadoData?.comision) 
                      ? (Number(cuponAcreditadoData.comision) * (Number(cuponAcreditadoData.iva_comision_flux_pct) / 100))
                      : 0
                  )}
                </td>
              </tr>

              <tr>
                <td style={{ fontSize: '11px', fontWeight: 900, color: '#111827', padding: '2px 0' }}>
                  Conciliación Bancaria
                </td>
                <td style={{ fontSize: '11px', fontWeight: 900, color: '#111827', padding: '2px 0', textAlign: 'right' }}>
                  {formatCurrency(cuponAcreditadoData?.ajuste || 0)}
                </td>
              </tr>

              <tr>
                <td style={{ fontSize: '11px', fontWeight: 900, color: '#111827', padding: '2px 0' }}>
                  Otros
                </td>
                <td style={{ fontSize: '11px', fontWeight: 900, color: '#111827', padding: '2px 0', textAlign: 'right' }}>
                  {formatCurrency(cuponAcreditadoData?.arancel || 0)}
                </td>
              </tr>

              <tr>
                <td style={{ fontSize: '11px', fontWeight: 900, color: '#111827', padding: '2px 0' }}>
                  Total descuentos
                </td>
                <td style={{ fontSize: '11px', fontWeight: 900, color: '#111827', padding: '2px 0', textAlign: 'right' }}>
                  - {formatCurrency(
                    (Number(cuponAcreditadoData?.comision || 0) +
                    (cuponAcreditadoData?.comision_flux_pct && cuponAcreditadoData?.iva_comision_flux_pct && cuponAcreditadoData?.comision 
                      ? (Number(cuponAcreditadoData.comision) * (Number(cuponAcreditadoData.iva_comision_flux_pct) / 100))
                      : 0) +
                    Number(cuponAcreditadoData?.ajuste || 0) +
                    Number(cuponAcreditadoData?.arancel || 0))
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ height: '1px', background: '#f472b6', margin: '10px 0' }} />

          <div
            style={{
              fontSize: '14px',
              fontWeight: 900,
              color: '#111827'
            }}
          >
            Monto liquidado <br />
            {formatCurrency(cuponAcreditadoData?.neto || 0)}
          </div>

          <div
            style={{
              fontSize: '12px',
              fontWeight: 900,
              color: '#111827',
              marginTop: '6px'
            }}
          >
            En CBU/CVU <br />
            {cuponAcreditadoData?.cbu_cvu || '-'}
          </div>
        </div>
      </div>

      <button
        onClick={() => setMostrarDetalle(false)}
        style={{
          background: 'linear-gradient(90deg, #d63384 0%, #a855f7 100%)',
          color: '#fff',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '600',
          marginTop: '15px',
          width: '100%'
        }}
      >
            Cerrar
      </button>
    </div>
  </>
)}


      {/* FORMULARIO EDITAR PERFIL */}
      <Modal open={showEditPerfil} onClose={() => setShowEditPerfil(false)}>
        <h3>Editar Perfil</h3>
        {errorPerfil && <div className="alert alert-error">{errorPerfil}</div>}
        {successPerfil && <div className="alert alert-success">{successPerfil}</div>}
        <form onSubmit={handleActualizarPerfil}>
          <div className="form-group">
            <label>Alias</label>
            <input type="text" maxLength="50" placeholder="Ej: MiComercio" value={editAlias} onChange={e => setEditAlias(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Banco</label>
            <input type="text" maxLength="120" placeholder="Ej: Banco Nación" value={editBanco} onChange={e => setEditBanco(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Edad</label>
            <input type="number" min="0" max="150" placeholder="Ej: 35" value={editEdad} onChange={e => setEditEdad(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Dirección</label>
            <input type="text" maxLength="100" placeholder="Ej: Calle Principal 123" value={editDireccion} onChange={e => setEditDireccion(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Ubicación / Localidad</label>
            <input type="text" maxLength="100" placeholder="Ej: Buenos Aires" value={editUbicacion} onChange={e => setEditUbicacion(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Sexo</label>
            <select value={editSexo} onChange={e => setEditSexo(e.target.value)}>
              <option value="">Seleccionar...</option>
              <option value="masculino">Masculino</option>
              <option value="femenino">Femenino</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <button className="btn-primary" disabled={loadingPerfil}>
            {loadingPerfil ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </form>
      </Modal>

      {/* FORMULARIO RETIRO */}
      <Modal open={showRetiroForm} onClose={() => setShowRetiroForm(false)}>
        <h3>Solicitar Retiro</h3>
        {errorRetiro && <div className="alert alert-error">{errorRetiro}</div>}
        {successRetiro && <div className="alert alert-success">{successRetiro}</div>}
        <form onSubmit={(e) => handleSolicitarRetiro(e, false)}>
          {String(userData?.cbu_registro ?? '').replace(/\D/g, '') && (
            <div className="form-group" style={{ marginBottom: 8 }}>
              <button type="button" className="btn-secondary" onClick={openRetiroFormOtroCbu}>
                Poner otro CBU
              </button>
            </div>
          )}
          <div className="form-group">
            <label>Monto *</label>
            <input
              type="text"
              inputMode="decimal"
              value={montoRetiro}
              onChange={(e) => setMontoRetiro(formatArAmountInput(e.target.value))}
              placeholder="0,00"
            />
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
              Podés escribirlo <b>dígito por dígito</b> o <b>pegarlo</b> directamente. Formato: <b>8.100,32</b>
            </div>
          </div>
          <div className="form-group">
            <label>CBU *</label>
            <input
              type="text"
              maxLength="22"
              value={cbuRetiro}
              onChange={e => setCbuRetiro(e.target.value.replace(/\D/g, ''))}
              disabled={!!String(userData?.cbu_registro ?? '').replace(/\D/g, '')}
            />
          </div>
          <button className="btn-primary" disabled={loadingRetiro}>
            {loadingRetiro ? 'Procesando...' : 'Solicitar'}
          </button>
        </form>
      </Modal>

      {/* CONFIRMAR TOKEN RETIRO */}
      <Modal
        open={showRetiroTokenModal}
        onClose={() => {
          setShowRetiroTokenModal(false);
          setRetiroToken('');
          setRetiroTokenRetiroId(null);
          setRetiroTokenStep(1);
          setErrorRetiroToken('');
          setSuccessRetiroToken('');
        }}
      >
        <h3>Autorizar Retiro</h3>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>
          {retiroTokenStep === 2
            ? 'Ingresá el segundo código que te enviamos por correo para confirmar el retiro.'
            : 'Ingresá el código que te enviamos por correo para autorizar el retiro.'}
        </div>
        {errorRetiroToken && <div className="alert alert-error">{errorRetiroToken}</div>}
        {successRetiroToken && <div className="alert alert-success">{successRetiroToken}</div>}
        <form onSubmit={handleConfirmarRetiroToken}>
          <div className="form-group">
            <label>Token *</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={retiroToken}
              onChange={(e) => setRetiroToken(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
            />
          </div>
          <button className="btn-primary" disabled={loadingRetiroToken}>
            {loadingRetiroToken ? 'Verificando...' : 'Confirmar'}
          </button>
        </form>
      </Modal>

      {/* FORMULARIO RETIRO (OTRO CBU) */}
      <Modal open={showRetiroFormOtroCbu} onClose={() => setShowRetiroFormOtroCbu(false)}>
        <h3>Solicitar Retiro</h3>
        {errorRetiro && <div className="alert alert-error">{errorRetiro}</div>}
        {successRetiro && <div className="alert alert-success">{successRetiro}</div>}
        <form onSubmit={(e) => handleSolicitarRetiro(e, true)}>
          <div className="form-group">
            <label>Monto *</label>
            <input
              type="text"
              inputMode="decimal"
              value={montoRetiro}
              onChange={(e) => setMontoRetiro(formatArAmountInput(e.target.value))}
              placeholder="0,00"
            />
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
              Podés escribirlo <b>dígito por dígito</b> o <b>pegarlo</b> directamente. Formato: <b>8.100,32</b>
            </div>
          </div>
          <div className="form-group">
            <label>CBU *</label>
            <input type="text" maxLength="22" value={cbuRetiro} onChange={e => setCbuRetiro(e.target.value.replace(/\D/g, ''))} />
          </div>
          <button className="btn-primary" disabled={loadingRetiro}>
            {loadingRetiro ? 'Procesando...' : 'Solicitar'}
          </button>
        </form>
      </Modal>

      {/* CALCULADORA DE VENTAS */}
      <Modal open={showCalculadora} onClose={() => setShowCalculadora(false)}>
        <h3>Calculadora de Ventas</h3>
        <div className="calculadora-container">
          {financingStatus?.editing && (
            <div style={{
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              color: '#9a3412',
              padding: '10px 12px',
              borderRadius: 10,
              marginBottom: 12,
              fontWeight: 600,
              fontSize: 13,
            }}>
              En estos momentos la administración está haciendo cambios en su calculadora. Los valores pueden actualizarse automáticamente.
            </div>
          )}
          {/* MONTO A COBRAR */}
          <div className="form-group">
            <label><FiDollarSign /> Monto a Cobrar *</label>
            <input type="number" value={montoCobranza} onChange={e => setMontoCobranza(e.target.value)} placeholder="0.00" step="0.01" min="0" />
          </div>
          {/* MÉTODO DE PAGO */}
          <div className="form-group">
            <label>Método de Pago</label>
            <select value={metodoPago} onChange={handleMetodoPagoChange}>
              <option value="QR_INTEROPERABLE_3_0">QR Interoperable 3.0</option>
              <option value="QR_MODO_CON_TARJETA">QR Modo con Tarjeta</option>
              <option value="DEBITO_BANCARIA">Débito Bancaria</option>
              <option value="DEBITO_PREPAGA">Débito Prepagas</option>
              <option value="DEBITO_ALIMENTAR">Débito Alimentario</option>
              <option value="CREDITO_1_CUOTA">Crédito 1 Cuota</option>
              <option value="CREDITO_2_CUOTAS">Crédito 2 Cuotas</option>
              <option value="CREDITO_3_CUOTAS">Crédito 3 Cuotas</option>
              <option value="CREDITO_6_CUOTAS">Crédito 6 Cuotas</option>
              <option value="CREDITO_9_CUOTAS">Crédito 9 Cuotas</option>
              <option value="CREDITO_12_CUOTAS">Crédito 12 Cuotas</option>
              <option value="CREDITO_18_CUOTAS">Crédito 18 Cuotas</option>
              <option value="CREDITO">Crédito (Sin cuotas fijas)</option>
            </select>
          </div>
          {/* CUOTAS (solo para métodos que usan cuotas) */}
          {(metodoPago.includes('CREDITO') && metodoPago !== 'CREDITO') && (
            <div className="form-group">
              <label>Cuotas</label>
              <select value={cuotas} onChange={handleCuotasChange}>
                {(() => {
                  const MAX_CUOTAS = 24;
                  const enabled = (financingPlans || [])
                    .filter(p => Number(p.enabled) === 1)
                    .filter(p => Number(p.cuotas) > 0 && Number(p.cuotas) <= MAX_CUOTAS)
                    .sort((a, b) => Number(a.cuotas) - Number(b.cuotas));
                  const opts = enabled.length > 0
                    ? enabled.map(p => ({ cuotas: Number(p.cuotas) }))
                    : [{ cuotas: 1 }, { cuotas: 3 }, { cuotas: 6 }, { cuotas: 12 }];

                  return opts.map(p => (
                    <option key={String(p.cuotas)} value={String(p.cuotas)}>
                      {String(p.cuotas)} {Number(p.cuotas) === 1 ? 'cuota' : 'cuotas'}
                    </option>
                  ));
                })()}
              </select>
            </div>
          )}
          {/* RESULTADOS */}
          {montoCobranza && calcularCobranza() && (
            <div className="calculadora-resultados">
              <div className="resultado-item">
                <span className="resultado-label">Método de Pago:</span>
                <span className="resultado-valor">
                  {(() => {
                    const metodos = {
                      'QR_INTEROPERABLE_3_0': 'QR Interoperable 3.0',
                      'QR_MODO_CON_TARJETA': 'QR Modo con Tarjeta',
                      'DEBITO_BANCARIA': 'Débito Bancaria',
                      'DEBITO_PREPAGA': 'Débito Prepagas',
                      'DEBITO_ALIMENTAR': 'Débito Alimentario',
                      'CREDITO_1_CUOTA': 'Crédito 1 Cuota',
                      'CREDITO_2_CUOTAS': 'Crédito 2 Cuotas',
                      'CREDITO_3_CUOTAS': 'Crédito 3 Cuotas',
                      'CREDITO_6_CUOTAS': 'Crédito 6 Cuotas',
                      'CREDITO_9_CUOTAS': 'Crédito 9 Cuotas',
                      'CREDITO_12_CUOTAS': 'Crédito 12 Cuotas',
                      'CREDITO_18_CUOTAS': 'Crédito 18 Cuotas',
                      'CREDITO': 'Crédito (Sin cuotas fijas)'
                    };
                    return metodos[metodoPago] || metodoPago;
                  })()}
                </span>
              </div>
              <div className="resultado-item">
                <span className="resultado-label">Cantidad de cuotas:</span>
                <span className="resultado-valor">{calcularCobranza().cantidadCuotas}</span>
              </div>
              <div className="resultado-item">
                <span className="resultado-label">Plan de cuotas (CTF):</span>
                <span className="resultado-valor">{calcularCobranza().ctf}%</span>
              </div>
              <div className="resultado-item">
                <span className="resultado-label">Precio por cada cuota:</span>
                <span className="resultado-valor">${calcularCobranza().precioPorCuota}</span>
              </div>
              <div className="resultado-item destaque">
                <span className="resultado-label">Total a discrar en Terminal:</span>
                <span className="resultado-valor">${calcularCobranza().totalADicar}</span>
              </div>
            </div>
          )}
          {/* DISCLAIMER */}
          <div className="calculadora-disclaimer">
            <p>
              Los cálculos son aproximados y sirven de referencia para el cobro de una venta financiada.
              El costo total financiero (CTF%) incluye la suma de arancel, tasa de interés, costo de cobro anticipado, costos administrativos, impuestos (IVA, IBB, GANANCIAS y OTROS).
              Los descuentos no son computables, compensables, negociables ni transferibles.
            </p>
          </div>
        </div>
      </Modal>

      {/* MOVIMIENTOS */}
      <div className="movimientos-card">
        <div className="movimientos-header">
          <div className="movimientos-header-left">
            <button
              type="button"
              className={`mov-tab mov-tab-title ${movimientosTab === 'ALL' ? 'active' : ''}`}
              onClick={() => setMovimientosTab('ALL')}
              title="Ver todos los movimientos"
            >
              Historial
            </button>
            <div className="mov-tabs" role="tablist" aria-label="Filtros de movimientos">
              <button
                type="button"
                role="tab"
                aria-selected={movimientosTab === 'CUPON'}
                className={`mov-tab ${movimientosTab === 'CUPON' ? 'active' : ''}`}
                onClick={() => setMovimientosTab(prev => (prev === 'CUPON' ? 'ALL' : 'CUPON'))}
              >
                Cupón
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={movimientosTab === 'INGRESO'}
                className={`mov-tab ${movimientosTab === 'INGRESO' ? 'active' : ''}`}
                onClick={() => setMovimientosTab(prev => (prev === 'INGRESO' ? 'ALL' : 'INGRESO'))}
              >
                Ingreso
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={movimientosTab === 'RETIRO'}
                className={`mov-tab ${movimientosTab === 'RETIRO' ? 'active' : ''}`}
                onClick={() => setMovimientosTab(prev => (prev === 'RETIRO' ? 'ALL' : 'RETIRO'))}
              >
                Retiro
              </button>
            </div>
          </div>
          <button onClick={downloadHistorialExcel} className="btn-download-excel-small" title="Descargar historial completo en Excel">
            <FiDownload /> Descargar Excel
          </button>
        </div>

        {(() => {
          const retirosComoMov = retiros.map(r => {
            const estado = String(r?.estado ?? '').trim().toUpperCase();
            const monto = Number(r?.monto ?? 0);
            return {
              id: `retiro-${r.id}`,
              _source: 'retiro',
              tipo_movimiento: 'PAGO_RETIRO',
              descripcion: `Retiro (${getEstadoLabel(estado)})`,
              numero_lote: null,
              created_at: getRetiroEventAt(r),
              estado,
              neto: isFinite(monto) && monto ? -Math.abs(monto) : 0,
              _retiro: r,
            };
          });

          const lista = [...(movimientos || []), ...retirosComoMov]
            .filter(m => m && m.created_at && String(m.estado || '').toUpperCase() !== 'ELIMINADO')
            .sort((a, b) => {
              const ta = new Date(a.created_at).getTime();
              const tb = new Date(b.created_at).getTime();
              return tb - ta;
            });

          const listaFiltrada = lista.filter((m) => {
            if (movimientosTab === 'ALL') return true;
            const tipo = String(m?.tipo_movimiento || '').toUpperCase();
            if (movimientosTab === 'RETIRO') return tipo === 'PAGO_RETIRO';
            if (movimientosTab === 'CUPON') return tipo === 'CUPON';
            if (movimientosTab === 'INGRESO') return tipo === 'INGRESO';
            return true;
          });

          if (listaFiltrada.length === 0) {
            return (
              <div className="no-movimientos">
                <FiX className="no-movimientos-icon" />
                <p>No tienes ningún movimiento</p>
              </div>
            );
          }

          return (
            <div className="movimientos-list">
              {listaFiltrada.map(mov => (
                <div
                  key={mov.id}
                  className="movimiento-item"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (selectMovMode) return;
                    if (mov._source !== 'transaccion') return;
                    const tipo = String(mov.tipo_movimiento || '').toUpperCase();
                    const est = String(mov.estado || '').toUpperCase();
                    if (!['APROBADO', 'PAGADO'].includes(est)) return;
                    if (tipo === 'CUPON') {
                      openCuponAcreditadoModal(mov);
                      return;
                    }
                    if (tipo === 'INGRESO') {
                      openIngresoAcreditadoModal(mov);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    if (selectMovMode) return;
                    if (mov._source !== 'transaccion') return;
                    const tipo = String(mov.tipo_movimiento || '').toUpperCase();
                    const est = String(mov.estado || '').toUpperCase();
                    if (!['APROBADO', 'PAGADO'].includes(est)) return;
                    if (tipo === 'CUPON') {
                      openCuponAcreditadoModal(mov);
                      return;
                    }
                    if (tipo === 'INGRESO') {
                      openIngresoAcreditadoModal(mov);
                    }
                  }}
                  style={{ cursor: (!selectMovMode && mov._source === 'transaccion' && ['CUPON', 'INGRESO'].includes(String(mov.tipo_movimiento || '').toUpperCase()) && ['APROBADO', 'PAGADO'].includes(String(mov.estado || '').toUpperCase())) ? 'pointer' : 'default' }}
                >
                  {selectMovMode && mov._source === 'transaccion' && (
                    <label className="movimiento-select">
                      <input
                        type="checkbox"
                        checked={selectedMovIds.includes(mov.id)}
                        onChange={() => toggleMovSelection(mov.id)}
                      />
                    </label>
                  )}
                  <div className="movimiento-icon">
                    {mov.tipo_movimiento === 'CUPON' || mov.tipo_movimiento === 'ACREDITACION' ? (
                      <FiArrowDownLeft className="icon-ingreso" />
                    ) : (
                      <FiArrowUpRight className="icon-egreso" />
                    )}
                  </div>

                  <div className="movimiento-details">
                    <div className="movimiento-tipo">{getTipoMovimiento(mov.tipo_movimiento)}</div>
                    <div className="movimiento-meta">
                      {mov.descripcion && <span>{mov.descripcion}</span>}
                      {String(mov.tipo_movimiento || '').toUpperCase() === 'INGRESO' && (
                        (() => {
                          const bruto = Number(mov.montoBruto || mov.monto_bruto || 0);
                          const neto = Number(mov.neto || 0);
                          const descuentosSum = Number(mov.arancel || 0) + Number(mov.comision || 0) + Number(mov.ajuste || 0);
                          const descuentos = bruto > 0 ? Math.max(0, bruto - neto) : Math.max(0, descuentosSum);
                          return (
                            <span>{`Bruto: ${formatCurrency(bruto)} | Descuentos: ${formatCurrency(descuentos)} | Neto: ${formatCurrency(neto)}`}</span>
                          );
                        })()
                      )}
                      {(['ACREDITACION', 'AJUSTE_NEGATIVO'].includes(String(mov.tipo_movimiento || '').toUpperCase()) && String(mov.estado || '').toUpperCase() === 'RECHAZADO' && getMovimientoMotivo(mov)) && (
                        <span>{`Motivo: ${getMovimientoMotivo(mov)}`}</span>
                      )}
                      {mov.numero_lote && <span>Lote: {mov.numero_lote}</span>}
                      <span className="movimiento-fecha">{formatDate(mov.created_at)}</span>
                      {String(mov.tipo_movimiento || '').toUpperCase() === 'CUPON' && mov.codigo_cupon && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontFamily: 'Courier New, monospace', fontWeight: 700 }}>{mov.codigo_cupon}</span>
                          <button
                            type="button"
                            title="Copiar código"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(mov.codigo_cupon);
                            }}
                          >
                            <FiCopy />
                          </button>
                          {['APROBADO', 'PAGADO'].includes(String(mov.estado || '').toUpperCase()) && (
                            <button
                              type="button"
                              title="Descargar cupón en Excel"
                              className="btn-cupon-download"
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadCuponExcel(mov);
                              }}
                            >
                              <FiDownload />
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="movimiento-monto">
                    <div className={`monto ${Number(mov.neto || 0) >= 0 ? 'positivo' : 'negativo'}`}>{formatCurrency(Number(mov.neto || 0))}</div>
                    <span className={`status ${getEstadoColor(mov.estado)}`}>{getEstadoLabel(mov.estado)}</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      <Modal open={showConfirmDeleteMovs} onClose={() => setShowConfirmDeleteMovs(false)}>
        <h3>{deleteMovsMode === 'all' ? 'Eliminar todo el historial' : 'Eliminar movimientos seleccionados'}</h3>
        <p>
          {deleteMovsMode === 'all'
            ? 'Esto ocultará todos los movimientos del historial.'
            : `Esto ocultará ${selectedMovIds.length} movimiento(s) del historial.`}
        </p>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={() => setShowConfirmDeleteMovs(false)}>Cancelar</button>
          <button className="btn-danger" onClick={confirmDeleteMovs}>Eliminar</button>
        </div>
      </Modal>

      {/* RETIROS RECHAZADOS */}
      {retiros.some(r => ['RECHAZADO', 'RECHAZADA', 'REJECTED', 'DENEGADO', 'DENEGADA'].includes(String(r?.estado || '').toUpperCase())) && (
        <div className="retiros-paid-card">
          <div className="movimientos-header">
            <h3>Retiros Rechazados</h3>
          </div>
          <div className="retiros-list">
            {retiros
              .filter(r => ['RECHAZADO', 'RECHAZADA', 'REJECTED', 'DENEGADO', 'DENEGADA'].includes(String(r?.estado || '').toUpperCase()))
              .map(r => (
                <div key={r.id} className="retiro-item rejected">
                  <div className="retiro-info">
                    <div>CBU: {r.cbu}</div>
                    <div className="movimiento-fecha">{formatDate(getRetiroRejectedAt(r))}</div>
                    <div>{getRetiroMotivo(r) ? `Motivo: ${getRetiroMotivo(r)}` : 'Motivo: -'}</div>
                  </div>
                  <span className="status status-rejected">✕ {getEstadoLabel(r.estado)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* RETIROS PROCESADOS */}
      {retiros.some(r => ['APROBADO', 'PAGADO', 'APPROVED'].includes(String(r?.estado || '').toUpperCase())) && (
        <div className="retiros-paid-card">
          <div className="movimientos-header">
            <h3>Retiros Procesados</h3>
          </div>
          <div className="retiros-list">
            {retiros.filter(r => ['APROBADO', 'PAGADO', 'APPROVED'].includes(String(r?.estado || '').toUpperCase())).map(r => (
              <div key={r.id} className="retiro-item paid">
                {selectRetPaidMode && (
                  <label className="movimiento-select">
                    <input
                      type="checkbox"
                      checked={selectedRetPaidIds.includes(r.id)}
                      onChange={() => toggleRetPaidSelection(r.id)}
                    />
                  </label>
                )}
                <div className="retiro-info">
                  <div>CBU: {r.cbu}</div>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => downloadRetiroComprobante(r.id)}
                  style={{ padding: '6px 10px', borderRadius: 10, fontSize: 12 }}
                  title="Descargar comprobante"
                >
                  Descargar
                </button>
                <span className="status status-approved">• {getEstadoLabel(r.estado)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}