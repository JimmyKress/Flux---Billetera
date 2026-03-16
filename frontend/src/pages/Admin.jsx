import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiRefreshCw, FiCheck, FiEye, FiLogOut, FiPlus, FiSearch, FiUsers, FiDollarSign, FiClock, FiCheckCircle, FiXCircle, FiMinus, FiTrash, FiSettings, FiCopy, FiMail, FiX, FiTarget, FiDownload } from 'react-icons/fi';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import api from '../api/axiosClient';
import RegistroMovimiento from '../components/RegistroMovimiento';
import './Admin/Admin.css';
import '../styles/ConfigModal.css';
import './Wallet/Wallet.css';
// Componente para gestión de sucursales del cliente

export default function Admin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const TAB_SUCURSALES = 2;
  const [adminCuit, setAdminCuit] = useState(null);
  const [financingEditingActive, setFinancingEditingActive] = useState(null);
  const cuponesPendientesInFlight = useRef(false);
  const cuponesHistoricoInFlight = useRef(false);
  const fetchLiquidacionInFlight = useRef(false);
  const [addClienteForm, setAddClienteForm] = useState({
    nombre: '',
    apellido: '',
    cuit: '',
    email: '',
    cbu: '',
    password: '',
    password2: '',
  });
  const [addClienteError, setAddClienteError] = useState('');
  const [addClienteSuccess, setAddClienteSuccess] = useState('');
  const [addClienteLoading, setAddClienteLoading] = useState(false);
  const [addClienteShowPassword, setAddClienteShowPassword] = useState(false);
  const [addClienteShowPassword2, setAddClienteShowPassword2] = useState(false);
  const [addClientePasswordValidations, setAddClientePasswordValidations] = useState({
    length: false,
    uppercase: false,
    number: false,
    special: false,
    match: false,
  });
  const [movimientos, setMovimientos] = useState({
    data: [],
    pagination: { total: 0, limit: 10, offset: 0 }
  });
  const [filtros, setFiltros] = useState({
    cuit: '',
    fechaDesde: '',
    fechaHasta: ''
  });
  const [loading, setLoading] = useState(false);
  const [showRegistro, setShowRegistro] = useState(false);
  const [userRol, setUserRol] = useState('admin');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0
  });
  
  // Nuevos estados para la pestaña de clientes
  const [clientes, setClientes] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [movimientosCliente, setMovimientosCliente] = useState([]);
  const [movimientosClientePage, setMovimientosClientePage] = useState(0);
  const [cargandoClientes, setCargandoClientes] = useState(false);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false);
  const [editClienteId, setEditClienteId] = useState(null);
  const [editClienteForm, setEditClienteForm] = useState({
    cuit: '',
    razon_social: '',
    cbu_registro: '',
    banco: '',
    alias: '',
    edad: '',
    direccion: '',
    ubicacion: '',
    sexo: '',
    config_retiro_automatico: false,
  });
  const [editClienteError, setEditClienteError] = useState('');
  const [editClienteSuccess, setEditClienteSuccess] = useState('');
  const [editClienteLoading, setEditClienteLoading] = useState(false);

  // Estados para eliminación de movimientos
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [toDeleteMovement, setToDeleteMovement] = useState(null);
  const [deleteMotivo, setDeleteMotivo] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [configLoading, setConfigLoading] = useState(false);
  const [financingPlans, setFinancingPlans] = useState([]);
  const [financingPlansError, setFinancingPlansError] = useState('');
  const [calcMonto, setCalcMonto] = useState('');
  const [calcCuotas, setCalcCuotas] = useState('1');
  const [calcClienteCuit, setCalcClienteCuit] = useState('');
  const [calcPlanApplyMsg, setCalcPlanApplyMsg] = useState('');
  const [calcPlanCards, setCalcPlanCards] = useState(() => {
    try {
      const stored = localStorage.getItem('admin_calc_plan_cards');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [calcAddPlanSelected, setCalcAddPlanSelected] = useState('');
  const [calcHistory, setCalcHistory] = useState([]);
  const [calcHistoryLoading, setCalcHistoryLoading] = useState(false);
  const [calcHistoryError, setCalcHistoryError] = useState('');

  // Estados para retiros
  const [retirosPendientes, setRetirosPendientes] = useState([]);
  const [retirosHistorico, setRetirosHistorico] = useState([]);
  const [cargandoRetiros, setCargandoRetiros] = useState(false);
  const [retirosProcesoID, setRetirosProcesoID] = useState(null);

  // Estados para depósitos (ingresos)
  const [depositosPendientes, setDepositosPendientes] = useState([]);
  const [depositosAprobados, setDepositosAprobados] = useState([]);
  const [cargandoDepositos, setCargandoDepositos] = useState(false);
  const [depositosProcesoId, setDepositosProcesoId] = useState(null);
  const [depositosError, setDepositosError] = useState('');

  // Estados para cupones
  const [showFormCupon, setShowFormCupon] = useState(false);
  const [showCuponesMasivos, setShowCuponesMasivos] = useState(false);
  const [cuponesMasivosText, setCuponesMasivosText] = useState('');
  const [cuponesMasivosLoading, setCuponesMasivosLoading] = useState(false);
  const [cuponesMasivosSummary, setCuponesMasivosSummary] = useState(null);
  const [cupones, setCupones] = useState([]);
  const [cuponesHistorico, setCuponesHistorico] = useState([]);
  const [cuponesSeleccionados, setCuponesSeleccionados] = useState(new Set());
  const [selectAllHistorico, setSelectAllHistorico] = useState(false);
  const [cuponForm, setCuponForm] = useState({
    cuit: '',
    sucursal_id: '',
    terminal_id: '',
    montoBruto: '',
    otros: 0,
    porcentaje_autocomplete_pct: '',
    detalle_cupon: '',
    comision_flux_pct: 3,
    conciliacion_bancaria_pct: 3.7,
    iva_comision_flux_pct: 21,
    cbu_cvu: '',
    fecha_transaccion: new Date().toISOString().slice(0, 16)
  });
  const [cargandoCupones, setCargandoCupones] = useState(false);
  const [errorCupon, setErrorCupon] = useState('');
  const [successCupon, setSuccessCupon] = useState('');
  const [sucursales, setSucursales] = useState([]);
  const [terminales, setTerminales] = useState([]);
  const [sendingCuponEmailId, setSendingCuponEmailId] = useState(null);
  const [totalLiquidadoCliente, setTotalLiquidadoCliente] = useState(0);
  const [cuponCbuTouched, setCuponCbuTouched] = useState(false);

  // Estados para ajustes negativos
  const [showFormAjuste, setShowFormAjuste] = useState(false);
  const [ajustesNegativos, setAjustesNegativos] = useState([]);
  const [ajusteForm, setAjusteForm] = useState({
    cuit: '',
    monto: '',
    motivo: 'mantenimiento',
    descripcion: ''
  });
  const [ajusteClienteId, setAjusteClienteId] = useState('');
  const [cargandoAjustes, setCargandoAjustes] = useState(false);
  const [errorAjuste, setErrorAjuste] = useState('');
  const [successAjuste, setSuccessAjuste] = useState('');
  const [filtroAjusteCuit, setFiltroAjusteCuit] = useState('');

  // Estados para notificaciones del cliente (solicitudes de retiro)
  const [solicitudesRetiro, setSolicitudesRetiro] = useState([]);
  const [cargandoSolicitudes, setCargandoSolicitudes] = useState(false);
  const [cuponesEliminados, setCuponesEliminados] = useState([]);
  const [cargandoCuponesEliminados, setCargandoCuponesEliminados] = useState(false);

  const [registrosPendientes, setRegistrosPendientes] = useState([]);
  const [cargandoRegistrosPendientes, setCargandoRegistrosPendientes] = useState(false);

  const [selectedRegistrosPendientes, setSelectedRegistrosPendientes] = useState([]);
  const [selectedSolicitudesRetiro, setSelectedSolicitudesRetiro] = useState([]);

  const [liquidacionDiariaTotal, setLiquidacionDiariaTotal] = useState(0);
  const [liquidacionDiariaLoading, setLiquidacionDiariaLoading] = useState(false);
  const [liquidacionDiariaError, setLiquidacionDiariaError] = useState('');
  const [liquidacionClientesSeries, setLiquidacionClientesSeries] = useState([]);
  const [liquidacionHistorial, setLiquidacionHistorial] = useState(() => {
    try {
      const stored = localStorage.getItem('admin_liquidacion_historial');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const aprobarRegistro = async (id) => {
    try {
      await api.post('/clientes/admin/registros-pendientes/aprobar', { id });
      setRegistrosPendientes((prev) => prev.filter((r) => r.id !== id));
      setSelectedRegistrosPendientes((prev) => prev.filter((x) => x !== id));
    } catch (error) {
      // Error al aprobar registro
      alert('Error al aprobar registro: ' + (error.response?.data?.msg || error.message));
    }
  };

  const getArgentinaISODate = useCallback(() => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(new Date());
  }, []);

  const CALC_PLAN_TEMPLATES = useMemo(
    () => [
      'QR INTEROPETABLE 3.0',
      'QR MODO CON TARJETA',
      'DEBITO BANCARIA',
      'DEBITO PREPAGA',
      'DEBITO ALIMENTAR',
      'CREDITO 1 CUOTA',
      'CREDITO 2 CUOTAS',
      'CREDITO 3 CUOTAS',
      'CREDITO 6 CUOTAS',
      'CREDITO 9 CUOTAS',
      'CREDITO 12 CUOTAS',
      'CREDITO 18 CUOTAS',
      'CREDITO',
    ],
    []
  );

  useEffect(() => {
    try {
      localStorage.setItem('admin_calc_plan_cards', JSON.stringify(calcPlanCards || []));
    } catch {
      // noop
    }
  }, [calcPlanCards]);

  const addCalcPlanCard = (name) => {
    const label = String(name || '').trim();
    if (!label) return;

    const inferPagos = (n) => {
      const m = String(n).match(/(\d+)\s*CUOTA/i);
      if (m) return Number(m[1]) || 1;
      const m2 = String(n).match(/(\d+)\s*CUOTAS/i);
      if (m2) return Number(m2[1]) || 1;
      return 1;
    };

    setCalcPlanCards((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      if (list.some((p) => String(p?.name).toUpperCase() === label.toUpperCase())) return list;
      return [
        ...list,
        {
          id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
          name: label,
          ctf_pct: '0',
          pagos: inferPagos(label),
        },
      ];
    });
  };

  const updateCalcPlanCard = (id, patch) => {
    setCalcPlanCards((prev) => (Array.isArray(prev) ? prev.map((p) => (p?.id === id ? { ...p, ...patch } : p)) : prev));
  };

  const removeCalcPlanCard = (id) => {
    setCalcPlanCards((prev) => (Array.isArray(prev) ? prev.filter((p) => p?.id !== id) : prev));
  };

  const applyCalcPlanCardToCalculator = (planCard) => {
    const cuotas = Number(planCard?.pagos) || 1;
    const ctfPct = String(planCard?.ctf_pct ?? '0');

    setCalcCuotas(String(cuotas));
    setFinancingPlans((prev) => {
      const list = Array.isArray(prev) ? [...prev] : [];
      const idx = list.findIndex((x) => Number(x?.cuotas) === Number(cuotas));
      const row = { cuotas, ctf_pct: ctfPct, enabled: 1 };
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...row };
        return list;
      }
      return [...list, row];
    });

    setCalcPlanApplyMsg(`Plan aplicado: ${String(planCard?.name || '')}`);
    window.setTimeout(() => setCalcPlanApplyMsg(''), 2500);
  };

  const registerHistorial = useCallback((fecha, total) => {
    if (!fecha) return;
    const entry = { fecha, total: Number(total) || 0 };
    setLiquidacionHistorial((prev) => {
      const updated = [entry, ...prev.filter((h) => h.fecha !== fecha)].slice(0, 30);
      localStorage.setItem('admin_liquidacion_historial', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const fetchLiquidacionDiariaTotal = useCallback(async (retryCount = 0) => {
    if (fetchLiquidacionInFlight.current && retryCount === 0) return;
    fetchLiquidacionInFlight.current = true;
    try {
      setLiquidacionDiariaLoading(true);
      setLiquidacionDiariaError('');
      const hoyISO = getArgentinaISODate();
      const storedDate = localStorage.getItem('admin_liquidacion_fecha');
      const storedTotal = Number(localStorage.getItem('admin_liquidacion_total') || 0);
      if (storedDate && storedDate !== hoyISO) {
        registerHistorial(storedDate, storedTotal);
      }

      let snapshotTotal = null;
      try {
        const snapRes = await api.get(`/config/liquidacion-diaria-global?fecha=${encodeURIComponent(hoyISO)}`);
        if (snapRes?.data?.ok) {
          snapshotTotal = Number(snapRes?.data?.data?.total_neto ?? 0) || 0;
        }
      } catch (snapErr) {
        snapshotTotal = null;
      }

      const params = new URLSearchParams();
      params.append('tipo_movimiento', 'CUPON');
      params.append('fechaDesde', hoyISO);
      params.append('fechaHasta', hoyISO);
      params.append('limit', '10000');
      params.append('offset', '0');

      const res = await api.get(`/transacciones?${params.toString()}`);
      const rows = res?.data?.data || [];
            const computedTotal = (Array.isArray(rows) ? rows : [])
        .filter((mov) => ['APROBADO', 'PAGADO'].includes(String(mov?.estado || '').toUpperCase()))
        .reduce((acc, mov) => {
          const tipo = String(mov?.tipo_movimiento || '').toUpperCase();
          const neto = Number(mov?.neto ?? mov?.monto ?? 0) || 0;
          if (tipo === 'CUPON') return acc + Math.abs(neto);
          if (tipo === 'INGRESO') return acc + neto;
          return acc;
        }, 0);

      const total = snapshotTotal !== null ? snapshotTotal : computedTotal;
      setLiquidacionDiariaTotal(total);

      if (snapshotTotal === null) {
        try {
          await api.post('/config/liquidacion-diaria-global/snapshot', { fecha: hoyISO, total_neto: total });
        } catch (saveErr) {
          // noop
        }
      }
      const grouped = (Array.isArray(rows) ? rows : [])
        .filter((mov) => ['APROBADO', 'PAGADO'].includes(String(mov?.estado || '').toUpperCase()))
        .reduce((acc, mov) => {
          const nombre = mov?.nombre_cliente || mov?.razon_social || mov?.cuit || 'Cliente';
          const tipo = String(mov?.tipo_movimiento || '').toUpperCase();
          const neto = Number(mov?.neto ?? mov?.monto ?? 0) || 0;
          const delta = tipo === 'CUPON' ? Math.abs(neto) : tipo === 'INGRESO' ? neto : 0;
          acc[nombre] = (acc[nombre] || 0) + delta;
          return acc;
        }, {});
      const series = Object.entries(grouped)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);
            setLiquidacionClientesSeries(series);
      localStorage.setItem('admin_liquidacion_fecha', hoyISO);
      localStorage.setItem('admin_liquidacion_total', String(total));
      registerHistorial(hoyISO, total);
    } catch (error) {
      console.error('[Estadísticas] Error completo:', error);
      console.error('[Estadísticas] Response:', error.response);
      console.error('[Estadísticas] Status:', error.response?.status);
      console.error('[Estadísticas] Data:', error.response?.data);
      
      // Retry logic for 429 errors
      if (error.response?.status === 429 && retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
                setTimeout(() => fetchLiquidacionDiariaTotal(retryCount + 1), delay);
        return;
      }
      
      setLiquidacionDiariaError('No se pudo cargar la liquidación diaria total.');
    } finally {
      setLiquidacionDiariaLoading(false);
      fetchLiquidacionInFlight.current = false;
    }
  }, [getArgentinaISODate, registerHistorial]);

  useEffect(() => {
    const scheduleMidnightReset = () => {
      const now = new Date();
      const argentinaNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
      const next = new Date(argentinaNow);
      next.setDate(argentinaNow.getDate() + 1);
      next.setHours(0, 0, 5, 0);
      const delay = Math.max(1000, next.getTime() - argentinaNow.getTime());
      return setTimeout(() => {
        fetchLiquidacionDiariaTotal();
        scheduleMidnightReset();
      }, delay);
    };

    const timer = scheduleMidnightReset();
    return () => clearTimeout(timer);
  }, [fetchLiquidacionDiariaTotal]);

  const rechazarRegistro = async (id) => {
    const motivo = window.prompt('Motivo de rechazo (opcional):', '');
    try {
      await api.post('/clientes/admin/registros-pendientes/rechazar', { id, motivo });
      setRegistrosPendientes((prev) => prev.filter((r) => r.id !== id));
      setSelectedRegistrosPendientes((prev) => prev.filter((x) => x !== id));
    } catch (error) {
      // Error al rechazar registro
      alert('Error al rechazar registro: ' + (error.response?.data?.msg || error.message));
    }
  };

  const [showMotivoModal, setShowMotivoModal] = useState(false);
  const [motivoModalTipo, setMotivoModalTipo] = useState(null); // 'cupon' | 'ajuste'
  const [motivoModalMovimientoId, setMotivoModalMovimientoId] = useState(null);
  const [motivoModalText, setMotivoModalText] = useState('');
  const [motivoModalError, setMotivoModalError] = useState('');

  const [showCuponTicketModal, setShowCuponTicketModal] = useState(false);
  const [cuponTicketData, setCuponTicketData] = useState(null);

  const [showAcreditadoModal, setShowAcreditadoModal] = useState(false);
  const [acreditadoModalData, setAcreditadoModalData] = useState(null);
  const [acreditadoModalCodigo, setAcreditadoModalCodigo] = useState('');

  const [showRetiroConfirmModal, setShowRetiroConfirmModal] = useState(false);
  const [retiroConfirmAction, setRetiroConfirmAction] = useState(null);
  const [retiroConfirmSolicitud, setRetiroConfirmSolicitud] = useState(null);
  const [retiroConfirmMotivo, setRetiroConfirmMotivo] = useState('');

  const fetchMovimientos = async (nuevosFiltros = null) => {
    try {
      setLoading(true);
      const filtrosActuales = nuevosFiltros !== null ? nuevosFiltros : filtros;
      
      const params = new URLSearchParams();
      if (filtrosActuales.cuit) params.append('cuit', filtrosActuales.cuit);
      if (filtrosActuales.fechaDesde) params.append('fechaDesde', filtrosActuales.fechaDesde);
      if (filtrosActuales.fechaHasta) params.append('fechaHasta', filtrosActuales.fechaHasta);
      if (filtrosActuales.fechaDesde && !filtrosActuales.fechaHasta) {
        params.append('fechaHasta', filtrosActuales.fechaDesde);
      }

      const limit = Number.isFinite(Number(filtrosActuales.limit)) ? String(Number(filtrosActuales.limit)) : '10';
      const offset = Number.isFinite(Number(filtrosActuales.offset)) ? String(Number(filtrosActuales.offset)) : '0';
      params.append('excludeTipos', 'CUPON');
      params.append('excludeEstados', 'ELIMINADO');
      params.append('limit', limit);
      params.append('offset', offset);
      
      const res = await api.get(`/transacciones?${params.toString()}`);
      
      setMovimientos({
        data: res.data.data || [],
        pagination: res.data.pagination || { total: 0, limit: 10, offset: 0 }
      });
      
      // Actualizar estadísticas
      const total = res.data.pagination?.total || 0;
      const pending = res.data.data?.filter(m => m.estado === 'PENDIENTE').length || 0;
      setStats({
        total,
        pending,
        completed: total - pending
      });
    } catch (error) {
      // Error al cargar movimientos
    } finally {
      setLoading(false);
    }
  };

  const closeCuponesMasivos = () => {
    setShowCuponesMasivos(false);
    setCuponesMasivosLoading(false);
    setCuponesMasivosSummary(null);
  };

  const formatDateTimeForAPI = (dateTimeLocal) => {
    if (!dateTimeLocal) return new Date().toISOString();
    // Si ya tiene formato ISO completo, devolverlo tal cual
    if (dateTimeLocal.includes('Z') || dateTimeLocal.includes('+')) {
      return dateTimeLocal;
    }
    // Convertir de YYYY-MM-DDTHH:MM a ISO completo
    const date = new Date(dateTimeLocal);
    const isoString = isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
    return isoString;
  };

  const handleCrearCuponesMasivos = async () => {
    setErrorCupon('');
    setSuccessCupon('');
    setCuponesMasivosSummary(null);

    if (!cuponForm.cuit || !cuponForm.sucursal_id || !cuponForm.terminal_id) {
      setErrorCupon('Debe seleccionar CUIT, Sucursal y Terminal antes de cargar cupones masivos');
      return;
    }

    const pctFlux = Number(cuponForm.comision_flux_pct || 0);
    const pctConc = Number(cuponForm.conciliacion_bancaria_pct || 0);
    const pctIvaFlux = Number(cuponForm.iva_comision_flux_pct || 0);
    const otros = Number(cuponForm.otros || 0);

    if (pctFlux < 0 || pctConc < 0 || pctIvaFlux < 0) {
      setErrorCupon('Los porcentajes no pueden ser negativos');
      return;
    }
    if (otros < 0) {
      setErrorCupon('OTROS no puede ser negativo');
      return;
    }

    const lines = String(cuponesMasivosText || '')
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setErrorCupon('Pegá al menos una línea. Formato: montoBruto;detalle (detalle opcional)');
      return;
    }

    const parseLine = (line) => {
      const parts = line.split(/\s*[;,]\s*/);
      const montoStr = (parts[0] ?? '').replace(',', '.').trim();
      const detalle = parts.slice(1).join(' ').trim();
      const bruto = Number(montoStr);
      return {
        bruto,
        detalle: detalle || null,
        raw: line,
      };
    };

    const items = lines.map(parseLine);
    const invalid = items.filter(it => !Number.isFinite(it.bruto) || it.bruto <= 0);
    if (invalid.length > 0) {
      setErrorCupon(`Hay montos inválidos (deben ser > 0). Ej: ${invalid[0].raw}`);
      return;
    }

    setCuponesMasivosLoading(true);
    const results = [];
    try {
      for (const it of items) {
        const otrosMonto = it.bruto * (otros / 100);

        try {
          const res = await api.post('/transacciones/crear-cupon', {
            cuit: cuponForm.cuit,
            sucursal_id: cuponForm.sucursal_id,
            terminal_id: cuponForm.terminal_id,
            montoBruto: it.bruto,
            arancel: otrosMonto,
            detalle_cupon: (it.detalle || cuponForm.detalle_cupon || '').trim() || null,
            comision_flux_pct: pctFlux,
            conciliacion_bancaria_pct: pctConc,
            iva_comision_flux_pct: pctIvaFlux,
            cbu_cvu: String(cuponForm.cbu_cvu || '').trim() || null,
            fecha_transaccion: formatDateTimeForAPI(cuponForm.fecha_transaccion),
          });

          if (res?.data?.ok) {
            results.push({ ok: true, bruto: it.bruto, id: res?.data?.id, codigo_cupon: res?.data?.codigo_cupon, raw: it.raw });
          } else {
            results.push({ ok: false, bruto: it.bruto, error: res?.data?.msg || 'Error creando cupón', raw: it.raw });
          }
        } catch (e) {
          results.push({ ok: false, bruto: it.bruto, error: e?.response?.data?.msg || e?.message || 'Error creando cupón', raw: it.raw });
        }
      }

      const okCount = results.filter(r => r.ok).length;
      const failCount = results.length - okCount;
      setCuponesMasivosSummary({ total: results.length, ok: okCount, fail: failCount, results });
      setSuccessCupon(`Cupones masivos: ${okCount} creados, ${failCount} fallidos`);
            // Enviar notificaciones a los clientes sobre los cupones creados
      try {
        const notifResponse = await api.post('/transacciones/notificar-cupones-creados', {
          cuit: cuponForm.cuit,
          mensaje: `Se han creado ${okCount} cupones nuevos. Por favor, revisa tu panel para aprobarlos.`
        });
      } catch (notifError) {
        // Error al enviar notificaciones de cupones creados
      }
      
      fetchCuponesPendientes();
      fetchCuponesHistorico();
    } finally {
      setCuponesMasivosLoading(false);
    }
  };

  const enviarCuponPorEmail = async (cupon) => {
    try {
      if (!cupon?.id) return;
      setErrorCupon('');
      setSuccessCupon('');
      setSendingCuponEmailId(cupon.id);
      const res = await api.post('/transacciones/cupon/enviar-email', { id: cupon.id, force: true });
      if (res?.data?.ok) {
        setSuccessCupon(res?.data?.msg || 'Cupón enviado al correo.');
      } else {
        setErrorCupon(res?.data?.msg || 'No se pudo enviar el cupón.');
      }
    } catch (e) {
      setErrorCupon(e?.response?.data?.msg || e?.message || 'Error al enviar el cupón por correo.');
    } finally {
      setSendingCuponEmailId(null);
    }
  };

  const setFinancingEditing = async (editing) => {
    const next = Boolean(editing);
    const normalizeCuit = (value) => String(value ?? '').replace(/[^0-9]/g, '');
    const selectedCuit = normalizeCuit(calcClienteCuit);
    if (next && !selectedCuit) {
      setFinancingPlansError('Seleccioná un cliente para poder marcar "Estoy editando".');
      return;
    }
    setFinancingEditingActive(next);
    try {
      await api.put('/config/financing-status', { editing: next, cuit: selectedCuit });
    } catch (e) {
      setFinancingEditingActive(!next);
    }
  };

  const loadFinancingStatus = useCallback(async (cuit = '') => {
    try {
      const normalizeCuit = (value) => String(value ?? '').replace(/[^0-9]/g, '');
      const qcuit = normalizeCuit(cuit);
      const res = await api.get(`/config/financing-status${qcuit ? `?cuit=${qcuit}` : ''}`);
      setFinancingEditingActive(Boolean(res?.data?.data?.editing));
    } catch (e) {
      // noop
    }
  }, []);

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
        // No se pudo copiar al portapapeles
      }
    }
  };

  const openRetiroConfirmModal = (action, solicitud) => {
    setRetiroConfirmAction(action);
    setRetiroConfirmSolicitud(solicitud);
    setRetiroConfirmMotivo('');
    setShowRetiroConfirmModal(true);
  };

  const closeRetiroConfirmModal = () => {
    setShowRetiroConfirmModal(false);
    setRetiroConfirmAction(null);
    setRetiroConfirmSolicitud(null);
    setRetiroConfirmMotivo('');
  };

  const confirmRetiroAction = async () => {
    if (!retiroConfirmSolicitud || !retiroConfirmAction) return;
    const idRetiro = retiroConfirmSolicitud.id;
    setSolicitudesRetiro(prev => prev.filter(s => s.id !== idRetiro));
    closeRetiroConfirmModal();
    try {
      if (retiroConfirmAction === 'aprobar') {
        await aprobarRetiro(idRetiro);
        return;
      }
      if (retiroConfirmAction === 'rechazar') {
        await rechazarRetiro(idRetiro, retiroConfirmMotivo);
      }
    } catch (e) {
      fetchSolicitudesRetiro();
    }
  };

  const getRetiroEstadoLabel = (estado) => {
    const st = String(estado || '').trim().toUpperCase();
    if (st === 'APPROVED') return 'APROBADO';
    if (st === 'REJECTED') return 'RECHAZADO';
    return estado || 'Desconocido';
  };

function SucursalesAdmin({ clienteId }) {
  const [sucursales, setSucursales] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      setError('');
      setSuccess('');
      await Promise.all([fetchSucursales()]);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchSucursales = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/clientes/${clienteId}/sucursales`);
      setSucursales(res.data.data || []);
    } catch (err) {
      setError('Error al cargar sucursales');
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    fetchSucursales();
  }, [fetchSucursales]);

  const handleAddSucursal = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!nombre || !direccion) {
      setError('Completa nombre y dirección');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post(`/clientes/${clienteId}/sucursales`, { nombre, direccion });
      if (res.data.ok) {
        setSuccess('Sucursal agregada correctamente');
        setNombre('');
        setDireccion('');
        fetchSucursales();
      } else {
        setError(res.data.msg || 'Error al agregar sucursal');
      }
    } catch (err) {
      setError('Error al agregar sucursal');
    } finally {
      setLoading(false);
    }
  };

  const deleteSucursal = async (id) => {
    if (!window.confirm('¿Eliminar sucursal?')) return;
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await api.delete(`/clientes/${clienteId}/sucursales/${id}`);
      if (res.data.ok) {
        setSuccess('Sucursal eliminada correctamente');
        fetchSucursales();
      } else {
        setError(res.data.msg || 'Error al eliminar sucursal');
      }
    } catch (err) {
      setError('Error al eliminar sucursal');
    } finally {
      setLoading(false);
    }
  };

  const [minimizado, setMinimizado] = useState(false);
  const contentRef = useRef(null);
  const [height, setHeight] = useState('auto');
  useEffect(() => {
    if (!minimizado && contentRef.current) {
      setHeight(contentRef.current.scrollHeight + 'px');
    } else {
      setHeight('0px');
    }
  }, [minimizado, nombre, direccion, sucursales, error, success, loading]);
  return (
    <div className="sucursales-admin-form" style={{ background: '#fff', borderRadius: 8, border: '1px solid #000', boxShadow: '0 2px 8px #0001', padding: 24, marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: '#2a2a2a' }}>Gestión de sucursales</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            style={{
              transform: refreshing ? 'scale(0.98)' : 'none',
              opacity: refreshing ? 0.85 : 1,
              transition: 'transform 120ms ease, opacity 120ms ease',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  transform: refreshing ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 300ms ease',
                }}
              >
                <FiRefreshCw />
              </span>
              {refreshing ? 'Actualizando...' : 'Actualizar'}
            </span>
          </button>
          <button
            type="button"
            aria-label={minimizado ? 'Expandir' : 'Minimizar'}
            onClick={() => setMinimizado(m => !m)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, fontSize: 18, transition: 'transform 0.3s', transform: minimizado ? 'rotate(-90deg)' : 'rotate(0deg)' }}
          >
            <span style={{ display: 'inline-block', transition: 'transform 0.3s' }}>▼</span>
          </button>
        </div>
      </div>
      <div
        ref={contentRef}
        style={{
          overflow: 'hidden',
          transition: 'height 0.5s cubic-bezier(.4,0,.2,1), opacity 0.5s cubic-bezier(.4,0,.2,1)',
          height: height,
          opacity: minimizado ? 0 : 1
        }}
      >
        <form onSubmit={handleAddSucursal} className="form-grid" style={{ marginBottom: '1.5rem', gap: 16 }}>
          <div className="form-group">
            <label>Nombre de sucursal</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre" />
          </div>
          <div className="form-group">
            <label>Dirección</label>
            <input value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Dirección" />
          </div>
          <div className="form-actions" style={{ alignSelf: 'end' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>Agregar sucursal</button>
          </div>
        </form>
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        <div style={{ borderTop: '1px solid #000', margin: '24px 0 16px 0' }} />
        <h4 style={{ margin: 0, color: '#444' }}>Listado de sucursales</h4>
        {loading ? <div>Cargando...</div> : (
          <table className="transactions-table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Dirección</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sucursales.map((suc) => (
                <tr key={suc.id}>
                  <td>{suc.nombre}</td>
                  <td>{suc.direccion}</td>
                  <td>
                    <button className="btn-icon danger" title="Eliminar" onClick={() => deleteSucursal(suc.id)}>
                      <FiTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

  useEffect(() => {
    // Verificar que el usuario sea admin con CUIT configurado
    const token = sessionStorage.getItem('token');
    if (!token) {
      navigate('/login/admin');
      return;
    }
    
    try {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      const normalizeCuit = (value) => String(value ?? '').replace(/[^0-9]/g, '');
      const decodedCuit = normalizeCuit(decoded.cuit);
      const envAdminCuit = normalizeCuit(import.meta.env.VITE_ADMIN_CUIT);
      if (!envAdminCuit || decodedCuit !== envAdminCuit) {
        navigate('/login/admin');
        return;
      }
      setAdminCuit(decoded.cuit);
    } catch (error) {
      navigate('/login/admin');
    }
    
    fetchMovimientos();
    fetchClientes();
    fetchRetirosPendientes();
    fetchRetirosHistorico();
    fetchSolicitudesRetiro();
    fetchDepositosPendientes();
    fetchDepositosAprobados();
  }, []);

  useEffect(() => {
    setAddClientePasswordValidations({
      length: addClienteForm.password.length >= 8,
      uppercase: /[A-Z]/.test(addClienteForm.password),
      number: /\d/.test(addClienteForm.password),
      special: /[^A-Za-z0-9]/.test(addClienteForm.password),
      match: addClienteForm.password === addClienteForm.password2 && addClienteForm.password !== '',
    });
  }, [addClienteForm.password, addClienteForm.password2]);

  const onAddClienteChange = (e) => {
    const { name, value } = e.target;
    setAddClienteForm((prev) => ({ ...prev, [name]: value }));
  };

  const submitAddCliente = async (e) => {
    e.preventDefault();
    setAddClienteError('');
    setAddClienteSuccess('');

    if (addClienteForm.password !== addClienteForm.password2) {
      setAddClienteError('Las contraseñas no coinciden');
      return;
    }

    const passRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passRegex.test(addClienteForm.password)) {
      setAddClienteError('La contraseña no cumple con los requisitos');
      return;
    }

    if (String(addClienteForm.cbu || '').length !== 22 || !/^\d+$/.test(String(addClienteForm.cbu || ''))) {
      setAddClienteError('CBU debe tener 22 dígitos');
      return;
    }

    setAddClienteLoading(true);
    try {
      await api.post('/clientes/admin', {
        nombre: addClienteForm.nombre,
        apellido: addClienteForm.apellido,
        cuit: addClienteForm.cuit,
        email: addClienteForm.email,
        cbu: addClienteForm.cbu,
        password: addClienteForm.password,
      });

      setAddClienteSuccess('Cliente creado correctamente');
      setAddClienteForm({
        nombre: '',
        apellido: '',
        cuit: '',
        email: '',
        cbu: '',
        password: '',
        password2: '',
      });

      try {
        await fetchClientes();
      } catch (e2) {
        // noop
      }
    } catch (err) {
      setAddClienteError(err?.response?.data?.msg || err?.response?.data?.error || 'Error al crear cliente');
    } finally {
      setAddClienteLoading(false);
    }
  };

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltros(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFiltroSubmit = (e) => {
    e.preventDefault();
    fetchMovimientos({ ...filtros, offset: 0, limit: 10 });
  };

  const limpiarFiltros = () => {
    const filtrosIniciales = { cuit: '', fechaDesde: '', fechaHasta: '' };
    setFiltros(filtrosIniciales);
    fetchMovimientos({ ...filtrosIniciales, offset: 0, limit: 10 });
  };


  const handleLogout = () => {
    sessionStorage.removeItem('token');
    navigate('/login/admin');
  };

  const loadFinancingPlans = useCallback(async () => {
    setFinancingPlansError('');
    try {
      const MAX_CUOTAS = 24;
      const res = await api.get('/config/financing-plans');
      const plans = Array.isArray(res.data?.data?.plans) ? res.data.data.plans : [];
      const normalized = plans
        .map(p => ({
          cuotas: Number(p?.cuotas),
          ctf_pct: String(p?.ctf_pct ?? ''),
          enabled: p?.enabled === false || p?.enabled === 0 ? 0 : 1,
        }))
        .filter(p => Number.isFinite(p.cuotas) && p.cuotas > 0 && p.cuotas <= MAX_CUOTAS);
      setFinancingPlans(normalized);
    } catch (e) {
      setFinancingPlans([]);
      setFinancingPlansError('No se pudieron cargar los planes de financiación');
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 6) return;
    loadFinancingPlans();
    loadFinancingStatus(calcClienteCuit);
  }, [activeTab, loadFinancingPlans, loadFinancingStatus, calcClienteCuit]);

  const addFinancingPlanRow = () => {
    setFinancingPlans(prev => ([...prev, { cuotas: 1, ctf_pct: '0', enabled: 1 }]));
  };

  const updateFinancingPlanRow = (idx, patch) => {
    setFinancingPlans(prev => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const removeFinancingPlanRow = (idx) => {
    setFinancingPlans(prev => prev.filter((_, i) => i !== idx));
  };

  useEffect(() => {
    const enabled = (financingPlans || [])
      .filter(p => Number(p.enabled) === 1)
      .sort((a, b) => Number(a.cuotas) - Number(b.cuotas))
      .map(p => String(p.cuotas));
    const opts = enabled.length > 0 ? enabled : ['1', '3', '6', '12'];
    if (!opts.includes(String(calcCuotas))) {
      setCalcCuotas(opts[0]);
    }
  }, [financingPlans]);

  const calcularCobranzaPreview = () => {
    const monto = parseFloat(calcMonto);
    if (!monto || monto <= 0) return null;

    const cantidadCuotas = parseInt(calcCuotas);

    const defaultCtfPorcentajes = {
      1: 17.85,
      3: 42.19,
      6: 60.28,
      12: 108.69,
    };

    const ctfFromPlans = Array.isArray(financingPlans)
      ? (financingPlans.find(p => Number(p.cuotas) === Number(cantidadCuotas) && Number(p.enabled) === 1)?.ctf_pct)
      : undefined;

    const ctf = Number.isFinite(Number(ctfFromPlans))
      ? Number(ctfFromPlans)
      : (defaultCtfPorcentajes[cantidadCuotas] || 0);
    const montoConInteres = monto * (1 + (ctf / 100));
    const precioPorCuota = montoConInteres / cantidadCuotas;

    return {
      cantidadCuotas,
      ctf: Number(ctf).toFixed(2),
      precioPorCuota: Number(precioPorCuota).toFixed(2),
      totalADicar: montoConInteres.toFixed(2),
    };
  };

  const loadCalcHistory = useCallback(async (cuit) => {
    const normalizeCuit = (value) => String(value ?? '').replace(/[^0-9]/g, '');
    const qcuit = normalizeCuit(cuit);
    if (!qcuit) {
      setCalcHistory([]);
      return;
    }
    setCalcHistoryLoading(true);
    setCalcHistoryError('');
    try {
      const res = await api.get(`/config/client-calc-history?cuit=${qcuit}`);
      const items = Array.isArray(res.data?.data?.items) ? res.data.data.items : [];
      setCalcHistory(items);
    } catch (e) {
      setCalcHistory([]);
      setCalcHistoryError(e?.response?.data?.msg || 'No se pudo cargar el historial');
    } finally {
      setCalcHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 6) return;
    loadCalcHistory(calcClienteCuit);
  }, [activeTab, calcClienteCuit, loadCalcHistory]);

  const saveClientCalculo = async () => {
    const normalizeCuit = (value) => String(value ?? '').replace(/[^0-9]/g, '');
    const qcuit = normalizeCuit(calcClienteCuit);
    if (!qcuit) {
      setCalcHistoryError('Seleccioná un cliente.');
      return;
    }
    const r = calcularCobranzaPreview();
    if (!r) {
      setCalcHistoryError('Ingresá un monto válido para guardar el cálculo.');
      return;
    }

    setConfigLoading(true);
    setCalcHistoryError('');
    try {
      await api.post('/config/client-calc-history', {
        cuit: qcuit,
        monto: Number(calcMonto),
        cuotas: Number(r.cantidadCuotas),
        ctf_pct: Number(r.ctf),
        precio_por_cuota: Number(r.precioPorCuota),
        total_a_dicar: Number(r.totalADicar),
      });
      await loadCalcHistory(qcuit);
    } catch (e) {
      setCalcHistoryError(e?.response?.data?.msg || 'No se pudo guardar el cálculo');
    } finally {
      setConfigLoading(false);
    }
  };

  const deleteCalcHistoryItem = async (id) => {
    const normalizeCuit = (value) => String(value ?? '').replace(/[^0-9]/g, '');
    const qcuit = normalizeCuit(calcClienteCuit);
    if (!qcuit) return;
    setConfigLoading(true);
    setCalcHistoryError('');
    try {
      await api.delete(`/config/client-calc-history/${id}`);
      await loadCalcHistory(qcuit);
    } catch (e) {
      setCalcHistoryError(e?.response?.data?.msg || 'No se pudo eliminar el item');
    } finally {
      setConfigLoading(false);
    }
  };

  const clearCalcHistory = async () => {
    const normalizeCuit = (value) => String(value ?? '').replace(/[^0-9]/g, '');
    const qcuit = normalizeCuit(calcClienteCuit);
    if (!qcuit) {
      setCalcHistoryError('Seleccioná un cliente.');
      return;
    }
    setConfigLoading(true);
    setCalcHistoryError('');
    try {
      await api.delete(`/config/client-calc-history?cuit=${qcuit}`);
      await loadCalcHistory(qcuit);
    } catch (e) {
      setCalcHistoryError(e?.response?.data?.msg || 'No se pudo eliminar el historial');
    } finally {
      setConfigLoading(false);
    }
  };

  const saveFinancingPlans = async () => {
    setConfigLoading(true);
    setFinancingPlansError('');
    try {
      const MAX_CUOTAS = 24;
      const sourcePlans = Array.isArray(financingPlans) ? financingPlans : [];
      const payloadPlans = sourcePlans
        .map((p, idx) => ({
          _idx: idx,
          cuotas: Number(p?.cuotas),
          ctf_pct: Number(p?.ctf_pct),
          enabled: p?.enabled === false || p?.enabled === 0 ? 0 : 1,
        }))
        .filter(p => Number.isFinite(p.cuotas) && p.cuotas > 0 && p.cuotas <= MAX_CUOTAS && Number.isFinite(p.ctf_pct) && p.ctf_pct >= 0)
        .map(({ _idx, ...rest }) => rest);

      if (payloadPlans.length === 0) {
        setFinancingPlansError(
          sourcePlans.length === 0
            ? 'No hay planes cargados. Tocá "Refrescar" o agregá un plan antes de guardar.'
            : 'Hay planes inválidos. Verificá que todas las filas tengan cuotas > 0 y CTF >= 0.'
        );
        return;
      }

      const cuotasList = payloadPlans.map(p => p.cuotas);
      const unique = new Set(cuotasList);
      if (unique.size !== cuotasList.length) {
        setFinancingPlansError('No se permiten cuotas duplicadas.');
        return;
      }

      await api.put('/config/financing-plans', { plans: payloadPlans });
    } catch (e) {
      setFinancingPlansError(e?.response?.data?.msg || 'No se pudieron guardar los planes de financiación');
    } finally {
      setConfigLoading(false);
    }
  };

  const handleConfigAction = async (action) => {
    try {
      setConfigLoading(true);
      const map = {
        cupones: '/config/limpiar-cupones',
        notificaciones: '/config/limpiar-notificaciones',
        clientes: '/config/limpiar-clientes',
      };
      const url = map[action];
      if (!url) return;
      const res = await api.post(url);
      alert(res.data?.msg || 'Acción realizada');
    } catch (e) {
      alert(e?.response?.data?.msg || 'No se pudo ejecutar la acción');
    } finally {
      setConfigLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.post('/transacciones/aprobar', { id, aprobador: 'admin' });
      await fetchMovimientos(); // Actualizar datos después de aprobar
    } catch (error) {
      // Error al aprobar transacción
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const verDetalleMovimiento = (id) => {
    // Implementar lógica para ver detalles del movimiento
  };

  const aprobarMovimiento = async (id) => {
    try {
      await api.post('/transacciones/aprobar', { id, aprobador: 'admin' });
      fetchMovimientos(); 
    } catch (error) {
      // Error al aprobar movimiento
    }
  };

  const openDeleteModal = (mov) => {
    setToDeleteMovement(mov);
    setDeleteMotivo('');
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setToDeleteMovement(null);
    setDeleteMotivo('');
  };

  const confirmDelete = async () => {
    if (!toDeleteMovement) return;

    // Caso especial: eliminación directa de retiro (cuando no existe movimiento_id)
    if (toDeleteMovement?.retiroId || String(toDeleteMovement?.id || '').startsWith('retiro:')) {
      const retiroId = toDeleteMovement?.retiroId || Number(String(toDeleteMovement?.id).replace('retiro:', ''));
      if (!retiroId) return;
      await eliminarRetiroAdminDesdeHistorial(retiroId);
      return;
    }

    try {
      setDeleting(true);
      await api.post('/transacciones/eliminar', { id: toDeleteMovement.id, motivo: deleteMotivo });
      // Refrescar listas relevantes
      await fetchMovimientos();
      if (clienteSeleccionado) {
        await fetchMovimientosCliente(clienteSeleccionado.cuit, { ...filtros, offset: 0 });
      }
      await fetchCuponesPendientes();
      await fetchCuponesHistorico();
      await fetchRetirosPendientes();
      await fetchRetirosHistorico();
      closeDeleteModal();
    } catch (err) {
      console.error('Error al eliminar movimiento:', err?.response?.data || err);
      alert('Error al eliminar movimiento: ' + (err?.response?.data?.msg || err?.response?.data?.error || err.message));
    } finally {
      setDeleting(false);
    }
  };

  const eliminarRetiroAdminDesdeHistorial = async (retiroId) => {
    try {
      setDeleting(true);
      await api.post('/retiros/eliminar-admin', { id: retiroId, motivo: deleteMotivo });
      await fetchRetirosPendientes();
      await fetchRetirosHistorico();
      closeDeleteModal();
    } catch (err) {
      console.error('Error al eliminar retiro:', err?.response?.data || err);
      alert('Error al eliminar retiro: ' + (err?.response?.data?.msg || err?.response?.data?.error || err.message));
    } finally {
      setDeleting(false);
    }
  };

  // Función para cargar la lista de clientes
  const fetchClientes = async () => {
    try {
      setCargandoClientes(true);
      const response = await api.get('/clientes/admin');
      
      // Verificar si la respuesta es exitosa y tiene datos
      if (!response.data || !response.data.data) {
        console.error('No se recibieron datos en la respuesta o formato incorrecto');
        return;
      }
            const datosClientes = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
      
      const clientesFormateados = datosClientes.map(cliente => ({
        id: cliente.id,
        cuit: cliente.cuit,
        nombre: cliente.nombre || cliente.razon_social || 'Cliente sin nombre',
        razon_social: cliente.razon_social,
        cbu_registro: cliente.cbu_registro || '',
        wallet_mode: cliente.wallet_mode || '',
        email: '', 
        saldo: 0,
        retiroAutomatico: cliente.config_retiro_automatico || false,
        raw: cliente
      }));
      
      setClientes(clientesFormateados);
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    } finally {
      setCargandoClientes(false);
    }
  };

  const startEditCliente = (cliente) => {
    setEditClienteId(cliente.id);
    setEditClienteForm({
      cuit: cliente.cuit || '',
      razon_social: cliente.razon_social || cliente.nombre || '',
      cbu_registro: cliente.cbu_registro || '',
      banco: cliente.banco || '',
      alias: cliente.alias || '',
      edad: cliente.edad ?? '',
      direccion: cliente.direccion || '',
      ubicacion: cliente.ubicacion || '',
      sexo: cliente.sexo || '',
      config_retiro_automatico: !!cliente.config_retiro_automatico,
    });
    setEditClienteError('');
    setEditClienteSuccess('');
  };

  const handleEditClienteChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditClienteForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const submitEditCliente = async (e) => {
    e.preventDefault();
    if (!editClienteId) return;
    setEditClienteError('');
    setEditClienteSuccess('');
    setEditClienteLoading(true);
    try {
      await api.put(`/clientes/admin/${editClienteId}`, {
        cuit: editClienteForm.cuit,
        razon_social: editClienteForm.razon_social,
        cbu_registro: editClienteForm.cbu_registro,
        banco: editClienteForm.banco,
        alias: editClienteForm.alias,
        edad: editClienteForm.edad === '' ? null : Number(editClienteForm.edad),
        direccion: editClienteForm.direccion,
        ubicacion: editClienteForm.ubicacion,
        sexo: editClienteForm.sexo,
        config_retiro_automatico: editClienteForm.config_retiro_automatico,
      });
      setEditClienteSuccess('Cliente actualizado correctamente');
      await fetchClientes();

      setClienteSeleccionado((prev) => {
        if (!prev) return prev;
        const updated = (clientes || []).find((c) => String(c.id) === String(editClienteId));
        return updated || prev;
      });
    } catch (error) {
      setEditClienteError(error?.response?.data?.msg || 'Error actualizando cliente');
    } finally {
      setEditClienteLoading(false);
    }
  };

  const eliminarCliente = async (cliente) => {
    const confirmado = window.confirm(`Eliminar cliente ${cliente.razon_social || cliente.nombre || cliente.cuit} y todos sus datos asociados?`);
    if (!confirmado) return;
    try {
      await api.delete(`/clientes/admin/${cliente.id}`);
      if (editClienteId === cliente.id) {
        setEditClienteId(null);
      }
      await fetchClientes();
    } catch (error) {
      alert('Error al eliminar cliente: ' + (error.response?.data?.msg || error.message));
    }
  };

  // Función para cargar los movimientos de un cliente
  const fetchMovimientosCliente = async (cuit) => {
    if (!cuit) return;
    
    try {
      setCargandoMovimientos(true);
      const res = await api.get(`/transacciones?cuit=${encodeURIComponent(cuit)}`);
      const rows = res?.data?.data || [];
      // Mapear los datos para que coincidan con la estructura esperada
      const movimientosFormateados = (Array.isArray(rows) ? rows : []).map(mov => ({
        id: mov.id,
        fecha: mov.fecha_creacion || mov.fecha || mov.created_at,
        tipo: mov.tipo_movimiento || mov.tipo,
        monto: parseFloat(mov.monto ?? mov.neto ?? 0),
        estado: mov.estado || 'COMPLETADO',
        descripcion: mov.descripcion || mov.detalle || 'Sin descripción',
        cuit: mov.cuit || cuit
      }));
      setMovimientosCliente(movimientosFormateados);
      setMovimientosClientePage(0);
    } catch (error) {
      console.error('Error al cargar movimientos del cliente:', error);
    } finally {
      setCargandoMovimientos(false);
    }
  };

  const MOVIMIENTOS_CLIENTE_PER_PAGE = 10;
  const movimientosClienteFiltrados = movimientosCliente.filter(m =>
    (m.estado || '').toUpperCase() !== 'ELIMINADO' &&
    !['AJUSTE_NEGATIVO'].includes((m.tipo_movimiento || m.tipo || '').toUpperCase())
  );
  const movimientosClienteTotalPages = Math.max(1, Math.ceil(movimientosClienteFiltrados.length / MOVIMIENTOS_CLIENTE_PER_PAGE));
  const movimientosClienteCurrentPage = Math.min(movimientosClientePage, movimientosClienteTotalPages - 1);
  const movimientosClientePaginados = movimientosClienteFiltrados.slice(
    movimientosClienteCurrentPage * MOVIMIENTOS_CLIENTE_PER_PAGE,
    (movimientosClienteCurrentPage + 1) * MOVIMIENTOS_CLIENTE_PER_PAGE
  );

  // Función para manejar la selección de un cliente
  const handleSeleccionarCliente = (cliente) => {
    setClienteSeleccionado(cliente);
    fetchMovimientosCliente(cliente.cuit);
  };

  // FUNCIONES PARA RETIROS
  const fetchRetirosPendientes = async () => {
    try {
      setCargandoRetiros(true);
      const { data } = await api.get('/retiros/pendientes');
      const rows = data.data || [];
      const allowed = new Set(['VALIDATION', 'PROCESSING', 'PENDIENTE_TOKEN', 'PENDIENTE_TOKEN2']);
      const filtered = (Array.isArray(rows) ? rows : []).filter((r) => {
        const estado = String(r?.estado || '').toUpperCase();
        return allowed.has(estado);
      });
      setRetirosPendientes(filtered);
    } catch (error) {
      console.error('Error al cargar retiros pendientes:', error);
    } finally {
      setCargandoRetiros(false);
    }
  };

  // FUNCIONES PARA DEPÓSITOS (INGRESOS)
  const fetchDepositosPendientes = async () => {
    try {
      setDepositosError('');
      setCargandoDepositos(true);
      const { data } = await api.get('/deposit/admin/pending');
      setDepositosPendientes(data.data || []);
    } catch (error) {
      console.error('Error al cargar depósitos pendientes:', error);
      setDepositosPendientes([]);
      setDepositosError(error?.response?.data?.msg || error?.message || 'Error al cargar depósitos pendientes');
    } finally {
      setCargandoDepositos(false);
    }
  };

  const fetchDepositosAprobados = async () => {
    try {
      const { data } = await api.get('/deposit/admin/approved');
      setDepositosAprobados(data.data || []);
    } catch (error) {
      console.error('Error al cargar depósitos aprobados:', error);
      setDepositosAprobados([]);
    }
  };

  const downloadDepositoReceipt = async (receiptId) => {
    try {
      if (!receiptId) return;
      const res = await api.get(`/deposit/admin/receipt/${receiptId}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: res.headers?.['content-type'] || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);

      let filename = `comprobante-deposito-${receiptId}`;
      const disposition = res.headers?.['content-disposition'] || res.headers?.['Content-Disposition'];
      if (disposition) {
        const match = String(disposition).match(/filename="?([^";]+)"?/i);
        if (match?.[1]) filename = match[1];
      }

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(e?.response?.data?.msg || e?.message || 'Error descargando comprobante');
    }
  };

  const aprobarDeposito = async (depositId) => {
    const dep = (Array.isArray(depositosPendientes) ? depositosPendientes : []).find((d) => d.id === depositId);
    const detected = Number(dep?.amount_detected || 0);
    if (!Number.isFinite(detected) || detected <= 0) {
      alert('No se puede aprobar: el comprobante no tiene un monto detectado válido.');
      return;
    }

    try {
      setDepositosProcesoId(depositId);
      const res = await api.post('/deposit/admin/approve', { deposit_id: depositId });
      if (res?.data?.ok) {
        fetchDepositosPendientes();
        fetchDepositosAprobados();
      }
    } catch (e) {
      alert(e?.response?.data?.msg || e?.message || 'Error al aprobar depósito');
    } finally {
      setDepositosProcesoId(null);
    }
  };

  const rechazarDeposito = async (depositId) => {
    const reason = window.prompt('Motivo de rechazo (opcional):', '');
    try {
      setDepositosProcesoId(depositId);
      const res = await api.post('/deposit/admin/reject', { deposit_id: depositId, reason: reason || undefined });
      if (res?.data?.ok) {
        fetchDepositosPendientes();
      }
    } catch (e) {
      alert(e?.response?.data?.msg || e?.message || 'Error al rechazar depósito');
    } finally {
      setDepositosProcesoId(null);
    }
  };

  const fetchRetirosHistorico = async () => {
    try {
      const { data } = await api.get('/retiros/historico');
      const rows = data.data || [];
      const allowed = new Set(['APPROVED', 'REJECTED']);
      const filtered = (Array.isArray(rows) ? rows : []).filter((r) => {
        const estado = String(r?.estado || '').toUpperCase();
        return allowed.has(estado);
      });
      setRetirosHistorico(filtered);
    } catch (error) {
      console.error('Error al cargar histórico de retiros:', error);
    }
  };

  const fetchSolicitudesRetiro = async () => {
    try {
      setCargandoSolicitudes(true);
      const { data } = await api.get('/retiros/pendientes');
      setSolicitudesRetiro(data.data || []);
      setSelectedSolicitudesRetiro([]);
    } catch (error) {
      console.error('Error al cargar solicitudes de retiro:', error);
    } finally {
      setCargandoSolicitudes(false);
    }
  };

  const fetchCuponesEliminadosAdmin = async () => {
    try {
      setCargandoCuponesEliminados(true);
      const { data } = await api.get('/notificaciones/admin/list', {
        params: { tipo: 'CUPON_ELIMINADO', limit: 50, offset: 0 }
      });
      setCuponesEliminados(data.data || []);
    } catch (error) {
      console.error('Error al cargar notificaciones de cupones eliminados:', error);
      setCuponesEliminados([]);
    } finally {
      setCargandoCuponesEliminados(false);
    }
  };

  const toggleSelectedSolicitudRetiro = (id) => {
    setSelectedSolicitudesRetiro((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const ocultarSolicitudesRetiro = async (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return;
    try {
      await api.post('/retiros/ocultar-admin', { ids });
      setSolicitudesRetiro((prev) => prev.filter((r) => !ids.includes(r.id)));
      setSelectedSolicitudesRetiro((prev) => prev.filter((x) => !ids.includes(x)));
    } catch (error) {
      console.error('Error al ocultar solicitudes de retiro:', error);
      alert('Error al ocultar solicitudes: ' + (error.response?.data?.msg || error.message));
    }
  };

  const handleResendVerify = async (email) => {
    if (!email) return;
    try {
      await api.post('/auth/resend-verify', { email });
      alert('Código de verificación reenviado al correo del usuario.');
    } catch (e) {
      alert('Error al reenviar código: ' + (e?.response?.data?.msg || e?.response?.data?.error || e.message));
    }
  };

  const fetchRegistrosPendientes = async () => {
    try {
      setCargandoRegistrosPendientes(true);
      const { data } = await api.get('/clientes/admin/registros-pendientes');
      setRegistrosPendientes(data.data || []);
      setSelectedRegistrosPendientes([]);
    } catch (error) {
      console.error('Error al cargar registros pendientes:', error);
      setRegistrosPendientes([]);
    } finally {
      setCargandoRegistrosPendientes(false);
    }
  };

  const toggleSelectedRegistroPendiente = (id) => {
    setSelectedRegistrosPendientes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const ocultarRegistrosPendientes = async (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return;
    try {
      await api.post('/clientes/admin/registros-pendientes/ocultar', { ids });
      setRegistrosPendientes((prev) => prev.filter((r) => !ids.includes(r.id)));
      setSelectedRegistrosPendientes((prev) => prev.filter((x) => !ids.includes(x)));
    } catch (error) {
      console.error('Error al ocultar registros pendientes:', error);
      alert('Error al ocultar registros: ' + (error.response?.data?.msg || error.message));
    }
  };

  const aprobarRetiro = async (idRetiro) => {
    try {
      setRetirosProcesoID(idRetiro);
      const response = await api.post('/retiros/aprobar', { id: idRetiro });
      if (response.data.ok) {
        // Recargar listas
        fetchRetirosPendientes();
        fetchRetirosHistorico();
      }
    } catch (error) {
      console.error('Error al aprobar retiro:', error);
      alert('Error al aprobar retiro: ' + (error.response?.data?.msg || error.message));
    } finally {
      setRetirosProcesoID(null);
    }
  };

  const rechazarRetiro = async (idRetiro, motivo) => {
    try {
      setRetirosProcesoID(idRetiro);
      const response = await api.post('/retiros/rechazar', { id: idRetiro, motivo: motivo || 'Sin especificar' });
      if (response.data.ok) {
        // Recargar listas
        fetchRetirosPendientes();
        fetchRetirosHistorico();
      }
    } catch (error) {
      console.error('Error al rechazar retiro:', error);
      alert('Error al rechazar retiro: ' + (error.response?.data?.msg || error.message));
    } finally {
      setRetirosProcesoID(null);
    }
  };

  // FUNCIONES PARA CUPONES 
  const fetchCuponesPendientes = async () => {
    try {
      if (cuponesPendientesInFlight.current) return;
      cuponesPendientesInFlight.current = true;
      setCargandoCupones(true);
      const response = await api.get('/transacciones?tipo_movimiento=CUPON&estado=PENDIENTE&limit=10000&offset=0');
      setCupones(response.data.data || []);
    } catch (error) {
      console.error('Error al cargar cupones:', error);
    } finally {
      setCargandoCupones(false);
      cuponesPendientesInFlight.current = false;
    }
  };

  const fetchCuponesHistorico = async () => {
    try {
      if (cuponesHistoricoInFlight.current) return;
      cuponesHistoricoInFlight.current = true;
      setCargandoCupones(true);
      const [aprobadosRes, rechazadosRes] = await Promise.all([
        api.get('/transacciones?tipo_movimiento=CUPON&estado=APROBADO&limit=10000&offset=0'),
        api.get('/transacciones?tipo_movimiento=CUPON&estado=RECHAZADO&limit=10000&offset=0')
      ]);

      const pagadosRes = await api.get('/transacciones?tipo_movimiento=CUPON&estado=PAGADO&limit=10000&offset=0');

      const aprobados = aprobadosRes?.data?.data || [];
      const rechazados = rechazadosRes?.data?.data || [];
      const pagados = pagadosRes?.data?.data || [];
      const merged = [...aprobados, ...pagados, ...rechazados].sort((a, b) => {
        const da = new Date(a.created_at || a.fecha || 0).getTime();
        const db = new Date(b.created_at || b.fecha || 0).getTime();
        return db - da;
      });
      setCuponesHistorico(merged);
    } catch (error) {
      console.error('Error al cargar histórico de cupones:', error?.response?.status, error?.response?.data || error?.message || error);
      setCuponesHistorico([]);
    } finally {
      setCargandoCupones(false);
      cuponesHistoricoInFlight.current = false;
    }
  };

  const fetchTotalLiquidado = async (cuit) => {
    try {
      if (!cuit) {
        setTotalLiquidadoCliente(0);
        return;
      }
      const hoyISO = getArgentinaISODate();
      const params = new URLSearchParams();
      params.append('cuit', cuit);
      params.append('fechaDesde', hoyISO);
      params.append('fechaHasta', hoyISO);
      params.append('limit', '10000');
      params.append('offset', '0');
      const res = await api.get(`/transacciones?${params.toString()}`);
      const data = res?.data?.data || [];
      const suma = (Array.isArray(data) ? data : [])
        .filter((m) => ['APROBADO', 'PAGADO'].includes(String(m.estado || '').toUpperCase()))
        .reduce((acc, m) => {
          const tipo = String(m?.tipo_movimiento || '').toUpperCase();
          const neto = Number(m?.neto ?? 0) || 0;
          if (tipo === 'CUPON') return acc + Math.abs(neto);
          if (tipo === 'INGRESO') return acc + neto;
          return acc;
        }, 0);
      setTotalLiquidadoCliente(suma);
    } catch (e) {
      console.error('Error al calcular total liquidado:', e);
      setTotalLiquidadoCliente(0);
    }
  };

  const cargarSucursalesYTerminales = async (cuit) => {
    try {
      if (!cuit) {
        setSucursales([]);
        return;
      }

      const clientRes = await api.get(`/clientes/${cuit}`);
      let clienteId = clientRes?.data?.data?.id;

      if (!clienteId) {
        const found = clientes.find(c => String(c.cuit) === String(cuit));
        if (found) {
          clienteId = found.id;
        }
      }

      if (!clienteId) {
        try {
          const allClientsRes = await api.get('/clientes');
          const list = allClientsRes?.data?.data || [];
          const found2 = Array.isArray(list) ? list.find(x => String(x.cuit) === String(cuit)) : null;
          if (found2) {
            clienteId = found2.id;
          }
        } catch (err) {
          console.warn('No fue posible obtener lista completa de clientes como fallback', err);
        }
      }

      if (!clienteId) {
        setSucursales([]);
        console.warn('No se encontró clienteId para CUIT:', cuit);
        return;
      }

      const response = await api.get(`/clientes/${clienteId}/sucursales`);
      const sucData = response?.data?.data ?? response?.data ?? [];
      setSucursales(Array.isArray(sucData) ? sucData : []);
    } catch (error) {
      console.error('Error al cargar sucursales:', error?.response?.status, error?.response?.data || error.message || error);
    }
  };

  const cargarTerminales = async (sucursalId) => {
    try {
      const response = await api.get(`/clientes/sucursal/${sucursalId}/terminales`);
      if (response.data && response.data.data) {
        setTerminales(response.data.data);
      } else {
        setTerminales([]);
      }
    } catch (error) {
      console.error('Error al cargar terminales:', error);
    }
  };

  const formatCbuCvu = (value) => {
    const s = String(value ?? '').trim();
    if (!s) return '';
    if (s.includes('/')) return s;
    const digits = s.replace(/\s+/g, '');
    if (digits.length === 44) {
      return `${digits.slice(0, 22)}/${digits.slice(22)}`;
    }
    return digits;
  };

  const resolverCbuAcreditacion = useCallback(
    ({ cuit }) => {
      if (!cuit) return '';
      const cliente = (clientes || []).find((c) => String(c.cuit) === String(cuit));
      const fallback = String(cliente?.cbu_registro || '').replace(/\D/g, '').slice(0, 22);

      return fallback || '';
    },
    [clientes]
  );

  const handleCuponChange = (e) => {
    const { name, value } = e.target;
    if (name === 'porcentaje_autocomplete_pct') {
      setCuponForm(prev => ({
        ...prev,
        porcentaje_autocomplete_pct: value,
        comision_flux_pct: value
      }));
      return;
    }
    // OTROS se calcula como porcentaje del monto bruto
    if (name === 'otros') {
      const pctValue = parseFloat(String(value).replace(',', '.')) || 0;
      setCuponForm(prev => ({ ...prev, [name]: pctValue }));
      return;
    }
    if (name === 'cbu_cvu') {
      setCuponCbuTouched(true);
      const digits = String(value ?? '').replace(/\D/g, '').slice(0, 22);
      setCuponForm(prev => ({ ...prev, cbu_cvu: digits }));
      return;
    }
    setCuponForm(prev => ({ ...prev, [name]: value }));
  };

  const handleCuitCuponChange = (e) => {
    const cuit = e.target.value;
    const cliente = clientes.find(x => String(x.cuit) === String(cuit));
    setCuponCbuTouched(false);
    setCuponForm(prev => ({
      ...prev,
      cuit,
      sucursal_id: '',
      terminal_id: '',
      cbu_cvu: formatCbuCvu(cliente?.cbu_registro || '')
    }));
    setSucursales([]);
    setTerminales([]);
    if (cuit) {
      cargarSucursalesYTerminales(cuit);
      fetchTotalLiquidado(cuit);
    }
  };

  const handleSucursalChange = (e) => {
    const sucursal_id = e.target.value;
    setCuponForm(prev => ({ ...prev, sucursal_id, terminal_id: '' }));
    if (sucursal_id) {
      cargarTerminales(sucursal_id);
    }
  };

  const handleTerminalChange = (e) => {
    const terminal_id = e.target.value;
    setCuponForm(prev => ({ ...prev, terminal_id }));
  };

  useEffect(() => {
    if (cuponCbuTouched) return;
    const resolved = resolverCbuAcreditacion({
      cuit: cuponForm.cuit,
    });
    const formatted = formatCbuCvu(resolved);
    if (formatted !== formatCbuCvu(cuponForm.cbu_cvu || '')) {
      setCuponForm((prev) => ({ ...prev, cbu_cvu: formatted }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuponCbuTouched, cuponForm.cuit, resolverCbuAcreditacion]);

  const handleCrearCupon = async (e) => {
    e.preventDefault();
    setErrorCupon('');
    setSuccessCupon('');

    if (!cuponForm.cuit || !cuponForm.sucursal_id || !cuponForm.terminal_id) {
      setErrorCupon('Debe seleccionar CUIT, Sucursal y Terminal');
      return;
    }

    const bruto = Number(cuponForm.montoBruto || 0);
    if (!bruto || bruto <= 0) {
      setErrorCupon('MONTO BRUT LIQ FISERV debe ser mayor a 0');
      return;
    }

    const pctFlux = Number(cuponForm.comision_flux_pct || 0);
    const pctConc = Number(cuponForm.conciliacion_bancaria_pct || 0);
    const pctIvaFlux = Number(cuponForm.iva_comision_flux_pct || 0);
    const otros = Number(cuponForm.otros || 0);
    if (pctFlux < 0 || pctConc < 0 || pctIvaFlux < 0) {
      setErrorCupon('Los porcentajes no pueden ser negativos');
      return;
    }

    if (otros < 0) {
      setErrorCupon('OTROS no puede ser negativo');
      return;
    }

    // Calcular monto base restando OTROS del bruto (ahora OTROS es un porcentaje)
    const otrosMonto = bruto * (otros / 100);
    const montoBase = bruto - otrosMonto;
    
    // Calcular descuentos
    const comisionFluxMonto = bruto * (pctFlux / 100);
    const ivaComisionFluxMonto = pctIvaFlux > 0 ? (comisionFluxMonto * (pctIvaFlux / 100)) : 0;
    const conciliacionMonto = bruto * (pctConc / 100);
    
    // Calcular neto restando todos los descuentos del bruto
    const neto = bruto - otrosMonto - comisionFluxMonto - ivaComisionFluxMonto - conciliacionMonto;

    try {
      setCargandoCupones(true);
            const response = await api.post('/transacciones/crear-cupon', {
        cuit: cuponForm.cuit,
        sucursal_id: cuponForm.sucursal_id,
        terminal_id: cuponForm.terminal_id,
        montoBruto: bruto,
        arancel: otrosMonto, // Enviar el monto calculado de OTROS, no el porcentaje
        detalle_cupon: (cuponForm.detalle_cupon || '').trim() || null,
        comision_flux_pct: pctFlux,
        conciliacion_bancaria_pct: pctConc,
        iva_comision_flux_pct: pctIvaFlux,
        cbu_cvu: String(cuponForm.cbu_cvu || '').trim() || null,
        fecha_transaccion: formatDateTimeForAPI(cuponForm.fecha_transaccion)
      });

      
      if (response.data.ok) {
        const codigo = response.data.codigo_cupon ? ` • Código: ${response.data.codigo_cupon}` : '';
        const destino = response.data.cbu_cvu ? ` • Acreditado en: ${formatCbuCvu(response.data.cbu_cvu)}` : '';
        
        // Enviar notificación al cliente sobre el cupón creado
        try {
          await api.post('/transacciones/notificar-cupones-creados', {
            cuit: cuponForm.cuit,
            mensaje: `Se ha creado un nuevo cupón de $${bruto.toFixed(2)}. Por favor, revisa tu panel para aprobarlo.`
          });
        } catch (notifError) {
          console.error('Error al enviar notificación de cupón creado:', notifError);
        }
        
        setSuccessCupon(`Cupón creado exitosamente. Neto liquidado: $${Number(neto).toFixed(2)}${codigo}${destino}`);
        setCuponForm({
          cuit: '',
          sucursal_id: '',
          terminal_id: '',
          montoBruto: '',
          otros: 0,
          porcentaje_autocomplete_pct: '',
          detalle_cupon: '',
          comision_flux_pct: 3,
          conciliacion_bancaria_pct: 3.7,
          iva_comision_flux_pct: 21,
          cbu_cvu: '',
          fecha_transaccion: new Date().toISOString().slice(0, 16)
        });
        setCuponCbuTouched(false);
        setShowFormCupon(false);
        fetchCuponesPendientes();
        fetchCuponesHistorico();
      }
    } catch (error) {
      setErrorCupon(error.response?.data?.msg || error.message);
    } finally {
      setCargandoCupones(false);
    }
  };

  const aprobarCupon = async (idMovimiento) => {
    try {
      setCargandoCupones(true);
      const response = await api.post('/transacciones/aprobar', { id: idMovimiento });
      if (response.data.ok) {
        setSuccessCupon('Cupón aprobado exitosamente');
        fetchCuponesPendientes();
        fetchCuponesHistorico();
        fetchMovimientos();
      }
    } catch (error) {
      setErrorCupon('Error al aprobar cupón: ' + (error.response?.data?.msg || error.message));
    } finally {
      setCargandoCupones(false);
    }
  };

  const aprobarTodosLosCupones = async () => {
    if (!window.confirm('¿Estás seguro de que quieres aprobar TODOS los cupones pendientes? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      setCargandoCupones(true);
      const response = await api.post('/transacciones/aprobar-todos-cupones');
      if (response.data.ok) {
        setSuccessCupon(response.data.msg || 'Cupones aprobados exitosamente');
        fetchCuponesPendientes();
        fetchCuponesHistorico();
        fetchMovimientos();
        
        // Mostrar detalles si hubo errores
        if (response.data.errores && response.data.errores.length > 0) {
          setErrorCupon(`Se aprobaron ${response.data.aprobados} de ${response.data.total} cupones. Errores: ${response.data.errores.join(', ')}`);
        }
      }
    } catch (error) {
      setErrorCupon('Error al aprobar todos los cupones: ' + (error.response?.data?.msg || error.message));
    } finally {
      setCargandoCupones(false);
    }
  };

  const rechazarTodosLosCupones = async () => {
    const motivo = prompt('Por favor, ingresa el motivo del rechazo para TODOS los cupones pendientes:');
    if (!motivo || motivo.trim() === '') {
      setErrorCupon('El motivo es obligatorio para rechazar los cupones');
      return;
    }

    if (!window.confirm(`¿Estás seguro de que quieres rechazar TODOS los cupones pendientes con el motivo: "${motivo}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      setCargandoCupones(true);
      const response = await api.post('/transacciones/rechazar-todos-cupones', { motivo: motivo.trim() });
      if (response.data.ok) {
        setSuccessCupon(response.data.msg || 'Todos los cupones fueron rechazados exitosamente');
        fetchCuponesPendientes();
        fetchCuponesHistorico();
        fetchMovimientos();
        
        // Mostrar detalles si hubo errores
        if (response.data.errores && response.data.errores.length > 0) {
          setErrorCupon(`Se rechazaron ${response.data.rechazados} de ${response.data.total} cupones. Errores: ${response.data.errores.join(', ')}`);
        }
      }
    } catch (error) {
      setErrorCupon('Error al rechazar todos los cupones: ' + (error.response?.data?.msg || error.message));
    } finally {
      setCargandoCupones(false);
    }
  };

  // Funciones para manejar selección en historial
  const toggleSeleccionCupon = (id) => {
    const nuevosSeleccionados = new Set(cuponesSeleccionados);
    if (nuevosSeleccionados.has(id)) {
      nuevosSeleccionados.delete(id);
    } else {
      nuevosSeleccionados.add(id);
    }
    setCuponesSeleccionados(nuevosSeleccionados);
    setSelectAllHistorico(nuevosSeleccionados.size === cuponesHistorico.length);
  };

  const toggleSeleccionarTodos = () => {
    if (selectAllHistorico) {
      setCuponesSeleccionados(new Set());
      setSelectAllHistorico(false);
    } else {
      const todosIds = new Set(cuponesHistorico.map(cupon => cupon.id));
      setCuponesSeleccionados(todosIds);
      setSelectAllHistorico(true);
    }
  };

  const eliminarCuponesSeleccionados = async () => {
    if (cuponesSeleccionados.size === 0) {
      setErrorCupon('No hay cupones seleccionados para eliminar');
      return;
    }

    const count = cuponesSeleccionados.size;
    if (!window.confirm(`¿Estás seguro de que quieres eliminar ${count} cupón(es) del historial? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      setCargandoCupones(true);
      // Eliminar cada cupón seleccionado
      const promesas = Array.from(cuponesSeleccionados).map(id => 
        api.post('/transacciones/eliminar', { id })
      );
      
      await Promise.all(promesas);
      
      setSuccessCupon(`${count} cupón(es) eliminados exitosamente`);
      setCuponesSeleccionados(new Set());
      setSelectAllHistorico(false);
      fetchCuponesHistorico();
      fetchMovimientos();
    } catch (error) {
      setErrorCupon('Error al eliminar cupones: ' + (error.response?.data?.msg || error.message));
    } finally {
      setCargandoCupones(false);
    }
  };

  const rechazarCupon = async (idMovimiento) => {
    setMotivoModalTipo('cupon');
    setMotivoModalMovimientoId(idMovimiento);
    setMotivoModalText('');
    setMotivoModalError('');
    setShowMotivoModal(true);
  };

  const fetchAjustesNegativos = async (cuit = '') => {
    try {
      setCargandoAjustes(true);
      const response = await api.get('/transacciones/ajustes-negativos', {
        params: cuit ? { cuit } : undefined
      });
      setAjustesNegativos(response.data.data || []);
    } catch (error) {
      console.error('Error al cargar ajustes negativos:', error);
      setErrorAjuste('Error al cargar ajustes negativos');
    } finally {
      setCargandoAjustes(false);
    }
  };

  const handleAjusteChange = (e) => {
    const { name, value } = e.target;
    setAjusteForm(prev => ({
      ...prev,
      [name]: value
    }));
    if (name === 'cuit') {
      const found = clientes.find(c => String(c.cuit) === String(value));
      setAjusteClienteId(found?.id ? String(found.id) : '');
    }
  };

  const handleAjusteClienteIdChange = (e) => {
    const value = e.target.value;
    setAjusteClienteId(value);
    const found = clientes.find(c => String(c.id) === String(value));
    setAjusteForm(prev => ({
      ...prev,
      cuit: found?.cuit ? String(found.cuit) : ''
    }));
  };

  const ajusteIdCuitMatch = !!ajusteClienteId && !!ajusteForm.cuit && clientes.some(
    c => String(c.id) === String(ajusteClienteId) && String(c.cuit) === String(ajusteForm.cuit)
  );

  const handleCrearAjuste = async (e) => {
    e.preventDefault();
    setErrorAjuste('');
    setSuccessAjuste('');

    if (!ajusteClienteId) {
      setErrorAjuste('Debe seleccionar un cliente (ID)');
      return;
    }

    if (!ajusteForm.cuit) {
      setErrorAjuste('Debe seleccionar un cliente (CUIT)');
      return;
    }

    if (!ajusteIdCuitMatch) {
      setErrorAjuste('El ID seleccionado no coincide con el CUIT seleccionado');
      return;
    }

    if (!ajusteForm.monto || parseFloat(ajusteForm.monto) <= 0) {
      setErrorAjuste('El monto debe ser mayor a 0');
      return;
    }

    try {
      setCargandoAjustes(true);
      const response = await api.post('/transacciones/crear-ajuste-negativo', {
        cuit: ajusteForm.cuit,
        monto: parseFloat(ajusteForm.monto),
        motivo: ajusteForm.motivo,
        descripcion: ajusteForm.descripcion
      });

      if (response.data.ok) {
        setSuccessAjuste(`Ajuste negativo creado exitosamente. Débito: -$${parseFloat(ajusteForm.monto).toFixed(2)}`);
        setAjusteForm({
          cuit: '',
          monto: '',
          motivo: 'mantenimiento',
          descripcion: ''
        });
        setAjusteClienteId('');
        setShowFormAjuste(false);
        fetchAjustesNegativos();
        fetchMovimientos();
      }
    } catch (error) {
      setErrorAjuste(error.response?.data?.msg || error.message);
    } finally {
      setCargandoAjustes(false);
    }
  };

  const aprobarAjuste = async (idMovimiento) => {
    try {
      setCargandoAjustes(true);
      const response = await api.post('/transacciones/aprobar-ajuste', { id: idMovimiento });
      if (response.data.ok) {
        setSuccessAjuste('Ajuste aprobado exitosamente');
        fetchAjustesNegativos();
        fetchMovimientos();
      }
    } catch (error) {
      setErrorAjuste('Error al aprobar ajuste: ' + (error.response?.data?.msg || error.message));
    } finally {
      setCargandoAjustes(false);
    }
  };

  const rechazarAjuste = async (idMovimiento) => {
    setMotivoModalTipo('ajuste');
    setMotivoModalMovimientoId(idMovimiento);
    setMotivoModalText('');
    setMotivoModalError('');
    setShowMotivoModal(true);
  };

  const closeMotivoModal = () => {
    setShowMotivoModal(false);
    setMotivoModalTipo(null);
    setMotivoModalMovimientoId(null);
    setMotivoModalText('');
    setMotivoModalError('');
  };

  const openCuponTicketModal = (cupon) => {
    setCuponTicketData(cupon || null);
    setShowCuponTicketModal(true);
  };

  const closeCuponTicketModal = () => {
    setShowCuponTicketModal(false);
    setCuponTicketData(null);
  };

  const generarCodigoRandom = (len = 14) => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
  };

  const openAcreditadoModal = (mov) => {
    setAcreditadoModalData(mov || null);
    setAcreditadoModalCodigo(generarCodigoRandom());
    setShowAcreditadoModal(true);
  };

  const closeAcreditadoModal = () => {
    setShowAcreditadoModal(false);
    setAcreditadoModalData(null);
    setAcreditadoModalCodigo('');
  };

  const confirmMotivoModal = async () => {
    const motivo = (motivoModalText || '').trim();
    if (!motivo) {
      setMotivoModalError('Debe ingresar un motivo');
      return;
    }
    if (!motivoModalTipo || !motivoModalMovimientoId) return;

    try {
      setMotivoModalError('');
      if (motivoModalTipo === 'cupon') {
        setCargandoCupones(true);
        const response = await api.post('/transacciones/rechazar', { id: motivoModalMovimientoId, motivo });
        if (response.data.ok) {
          setSuccessCupon('Cupón rechazado exitosamente');
          fetchCuponesPendientes();
          fetchCuponesHistorico();
          fetchMovimientos();
          closeMotivoModal();
        }
        return;
      }

      if (motivoModalTipo === 'ajuste') {
        setCargandoAjustes(true);
        const response = await api.post('/transacciones/rechazar-ajuste', { id: motivoModalMovimientoId, motivo });
        if (response.data.ok) {
          setSuccessAjuste('Ajuste rechazado exitosamente');
          fetchAjustesNegativos();
          fetchMovimientos();
          closeMotivoModal();
        }
      }
    } catch (error) {
      const msg = error.response?.data?.msg || error.message;
      if (motivoModalTipo === 'cupon') {
        setErrorCupon('Error al rechazar cupón: ' + msg);
      }
      if (motivoModalTipo === 'ajuste') {
        setErrorAjuste('Error al rechazar ajuste: ' + msg);
      }
    } finally {
      setCargandoCupones(false);
      setCargandoAjustes(false);
    }
  };

  // Cargar clientes al montar el componente
  useEffect(() => {
    // tabs that need the list of clients
    // 1 = Clientes, 3 = Ajustes, 5 = Ingresos, 6 = Cupones,
    // 8 = Notificaciones, 9 = Calculadora, 10 = Administrar clientes
    if (
      activeTab === 1 ||
      activeTab === 3 ||
      activeTab === 5 ||
      activeTab === 6 ||
      activeTab === 8 ||
      activeTab === 9 ||
      activeTab === 10
    ) {
      fetchClientes();
    }
    if (activeTab === 3) { // Cargar ajustes solo en pestaña Ajustes (3)
      fetchAjustesNegativos('');
    }
    if (activeTab === 6) { // Cargar cupones en pestaña Cupones (6)
      fetchCuponesPendientes();
      fetchCuponesHistorico();
    }
    if (activeTab === 7) { // Validaciones (registros pendientes)
      fetchRegistrosPendientes();
    }
    if (activeTab === 8) { // Notificaciones del cliente
      fetchSolicitudesRetiro();
      fetchCuponesEliminadosAdmin();
    }
    if (activeTab === 12) { // Estadísticas
      fetchLiquidacionDiariaTotal();
    }
  }, [activeTab, fetchLiquidacionDiariaTotal]);

  // Formatear fecha
  const formatFecha = (fechaStr) => {
    const options = { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(fechaStr).toLocaleString('es-AR', options);
  };

  // Formatear moneda
  const formatMoneda = (monto) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto);
  };

  const liquidacionChartMax = liquidacionDiariaTotal;
  const liquidacionChartProgress = liquidacionChartMax === 0 ? 0 : 1;
  const pieColors = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#14b8a6'];
  const totalClientes = liquidacionClientesSeries.reduce((acc, item) => acc + item.value, 0);
  const pieSlices = liquidacionClientesSeries.reduce((acc, item, index) => {
    const startAngle = acc.currentAngle;
    const sliceAngle = totalClientes > 0 ? (item.value / totalClientes) * 360 : 0;
    const endAngle = startAngle + sliceAngle;
    acc.slices.push({
      ...item,
      startAngle,
      endAngle,
      color: pieColors[index % pieColors.length]
    });
    acc.currentAngle = endAngle;
    return acc;
  }, { slices: [], currentAngle: 0 }).slices;

  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians)
    };
  };

  const describeArc = (x, y, radius, startAngle, endAngle) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return [
      'M', x, y,
      'L', start.x, start.y,
      'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
      'Z'
    ].join(' ');
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Panel de Administración</h1>
        <div className="header-actions">
          <button
            type="button"
            className="admin-sidebar-toggle"
            aria-label="Abrir menú"
            onClick={() => setSidebarOpen(true)}
          >
            <FiSettings />
          </button>
          <button onClick={handleLogout} className="logout-btn">
            <FiLogOut /> Cerrar Sesión
          </button>
        </div>
      </div>

      <Tabs selectedIndex={activeTab} onSelect={(index) => setActiveTab(index)}>
        {sidebarOpen && (
          <button
            type="button"
            className="admin-sidebar-backdrop"
            aria-label="Cerrar menú"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className="admin-tabs-layout">
          <div className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
            <div className="admin-sidebar-header">
              <div className="admin-sidebar-title">Administración</div>
              <button
                type="button"
                className="admin-sidebar-close"
                aria-label="Cerrar menú"
                onClick={() => setSidebarOpen(false)}
              >
                <FiX />
              </button>
            </div>

            <TabList>
              <Tab onClick={() => setSidebarOpen(false)}><FiDollarSign /> Movimientos</Tab>
              <Tab onClick={() => setSidebarOpen(false)}><FiUsers /> Clientes</Tab>
              <Tab onClick={() => setSidebarOpen(false)}><FiSettings /> Sucursales / Terminales</Tab>
              <Tab onClick={() => setSidebarOpen(false)}><FiXCircle /> Ajustes</Tab>
              <Tab onClick={() => setSidebarOpen(false)}><FiCheckCircle /> Retiros</Tab>
              <Tab onClick={() => setSidebarOpen(false)}><FiPlus /> Ingresos</Tab>
              <Tab onClick={() => setSidebarOpen(false)}><FiPlus /> Cupones</Tab>
              <Tab onClick={() => setSidebarOpen(false)}><FiCheck /> Validaciones</Tab>
              <Tab onClick={() => setSidebarOpen(false)}><FiCheck /> Notificaciones del Cliente</Tab>
              <Tab onClick={() => setSidebarOpen(false)}><FiSettings /> Calculadora</Tab>
              <Tab onClick={() => setSidebarOpen(false)}><FiUsers /> Administrar clientes</Tab>
              <Tab onClick={() => setSidebarOpen(false)}><FiPlus /> Agregar Clientes</Tab>
              <Tab onClick={() => setSidebarOpen(false)}><FiTarget />Estadisticas</Tab>
            </TabList>
          </div>

          <div className="admin-tab-content">
            <TabPanel><br></br>
          <div className="filters">
            <form onSubmit={handleFiltroSubmit} className="filter-form">
              <div className="form-group">
                <label>Filtrar por CUIT:</label>
                <input
                  type="text"
                  name="cuit"
                  value={filtros.cuit}
                  onChange={handleFiltroChange}
                  placeholder="Ingrese CUIT"
                />
              </div>
              <div className="form-group">
                <label>Fecha:</label>
                <input
                  type="date"
                  name="fechaDesde"
                  value={filtros.fechaDesde}
                  onChange={handleFiltroChange}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  <FiSearch /> Buscar
                </button>
                <button type="button" onClick={limpiarFiltros} className="btn btn-secondary">
                  Limpiar filtros
                </button>
              </div>
            </form>
          </div>

          <div className="transactions-container">
            <div className="table-header">
              <h2>Movimientos de Clientes</h2>
              <div className="table-actions">
                <span className="total-count">
                  Mostrando {movimientos.data.length} de {movimientos.pagination.total} movimientos
                </span>
              </div>
            </div>
            
            <div className="table-responsive">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Cliente ID</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Descripción</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.data.length > 0 ? (
                    movimientos.data.map((mov) => (
                      <tr key={mov.id}>
                        <td>{mov.cliente_id ?? mov.id_cliente ?? mov.clienteId ?? 'N/A'}</td>
                        <td>{new Date(mov.created_at).toLocaleString()}</td>
                        <td>
                          <div className="client-info">
                            <div className="client-name">{mov.nombre_cliente || 'Cliente'}</div>
                            <div className="client-cuit">{mov.cuit}</div>
                          </div>
                        </td>
                        <td>{mov.descripcion || mov.motivo || 'Sin descripción'}</td>
                        <td>
                          <span className={`tipo-movimiento ${((mov.tipo_movimiento || mov.tipo) || 'desconocido').toLowerCase()}`}>
                            {(mov.tipo_movimiento || mov.tipo) || 'Desconocido'}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge ${(mov.estado || 'desconocido').toLowerCase()}`}>
                            {mov.estado || 'Desconocido'}
                          </span>
                        </td>
                        <td>
                          {mov.estado === 'PENDIENTE' && (
                            <button 
                              className="btn-icon success" 
                              title="Aprobar movimiento"
                              onClick={() => aprobarMovimiento(mov.id)}
                            >
                              <FiCheck />
                            </button>
                          )}

                          {String(mov.tipo_movimiento || mov.tipo || '').toUpperCase() === 'ACREDITACION' && ['APROBADO', 'PAGADO'].includes(String(mov.estado || '').toUpperCase()) && (
                            <button
                              className="btn-icon"
                              title="Ver acreditación"
                              onClick={() => openAcreditadoModal(mov)}
                            >
                              <FiEye />
                            </button>
                          )}

                          {mov.estado !== 'ELIMINADO' && (
                            <button
                              className="btn-icon danger"
                              title="Eliminar movimiento"
                              onClick={() => openDeleteModal(mov)}
                            >
                              <FiTrash />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="no-results">
                        No se encontraron movimientos con los filtros actuales
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          {movimientos.pagination.total > movimientos.pagination.limit && (
            <div className="pagination">
              <button
                disabled={movimientos.pagination.offset === 0}
                onClick={() => {
                  fetchMovimientos({ ...filtros, offset: 0, limit: movimientos.pagination.limit });
                }}
              >
                Volver al inicio
              </button>
              <button 
                disabled={movimientos.pagination.offset === 0}
                onClick={() => {
                  const newOffset = Math.max(0, movimientos.pagination.offset - movimientos.pagination.limit);
                  fetchMovimientos({ ...filtros, offset: newOffset });
                }}
              >
                Anterior
              </button>
              <span>
                Página {Math.floor(movimientos.pagination.offset / movimientos.pagination.limit) + 1} de {Math.ceil(movimientos.pagination.total / movimientos.pagination.limit)}
              </span>
              <button 
                disabled={movimientos.pagination.offset + movimientos.pagination.limit >= movimientos.pagination.total}
                onClick={() => {
                  const newOffset = movimientos.pagination.offset + movimientos.pagination.limit;
                  fetchMovimientos({ ...filtros, offset: newOffset });
                }}
              >
                Siguiente
              </button>
            </div>
          )}
        </TabPanel>

        <TabPanel>
          <div className="clientes-container">
            <div className="clientes-lista">
              <h3>Lista de Clientes</h3>
              {cargandoClientes ? (
                <div className="loading-clients">Cargando clientes...</div>
              ) : clientes.length > 0 ? (
                <div className="clientes-grid">
                  {clientes.map((cliente) => (
                    <div 
                      key={cliente.id} 
                      className={`cliente-card ${clienteSeleccionado?.id === cliente.id ? 'cliente-seleccionado' : ''}`}
                      onClick={() => handleSeleccionarCliente(cliente)}
                    >
                      <div className="cliente-header">
                        <h4 className="cliente-nombre">{cliente.nombre}</h4>
                        <span className="cliente-cuit">{cliente.cuit}</span>
                      </div>
                      
                      <div className="cliente-info">
                        <div className="cliente-info-item">
                          <FiUsers />
                          <span>ID: <code>{cliente.id}</code></span>
                        </div>
                        <div className='cliente-info-item'>
                          <FiUsers />
                          <span>CUIT: <code>{cliente.cuit}</code></span>
                        </div>
                        <div className='cliente-info-item'>
                          <FiUsers />
                          <span>
                            Acreditación:{' '}
                            <code>
                              {String(cliente.wallet_mode || '').toUpperCase() === 'DIRECT_BANK'
                                ? 'Directa'
                                : 'Portal'}
                            </code>
                          </span>
                        </div>
                      </div>
                      
                      <div className="cliente-acciones">
                        <button
                          type="button"
                          className="btn-ver-movimientos"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSeleccionarCliente(cliente);
                            startEditCliente(cliente);
                            setSidebarOpen(false);
                          }}
                        >
                          <FiEye size={14} /> Editar datos
                        </button>
                        <button 
                          className="btn-ver-movimientos"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSeleccionarCliente(cliente);
                            fetchMovimientosCliente(cliente.cuit);
                            setActiveTab(TAB_SUCURSALES);
                            setSidebarOpen(false);
                          }}
                        >
                          <FiSettings size={14} /> Sucursales / Terminales
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-clients">No se encontraron clientes registrados</div>
              )}
            </div>

            {editClienteId && (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginTop: 16 }}>
                <h3 style={{ marginTop: 0 }}>Editar cliente</h3>

                <form onSubmit={submitEditCliente} className="form-grid" style={{ marginTop: 12 }}>
                  {editClienteError && <div className="error-message">{editClienteError}</div>}
                  {editClienteSuccess && <div className="success-message">{editClienteSuccess}</div>}

                  <div className="form-group">
                    <label>CUIT</label>
                    <input
                      name="cuit"
                      value={editClienteForm.cuit}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        handleEditClienteChange({ target: { name: 'cuit', value } });
                      }}
                      maxLength={11}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>CBU</label>
                    <input
                      name="cbu_registro"
                      value={editClienteForm.cbu_registro}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        handleEditClienteChange({ target: { name: 'cbu_registro', value } });
                      }}
                      maxLength={22}
                    />
                  </div>

                  <div className="form-group">
                    <label>Banco</label>
                    <input name="banco" value={editClienteForm.banco} onChange={handleEditClienteChange} />
                  </div>

                  <div className="form-group">
                    <label>Alias</label>
                    <input name="alias" value={editClienteForm.alias} onChange={handleEditClienteChange} />
                  </div>

                  <div className="form-group">
                    <label>Edad</label>
                    <input
                      type="number"
                      name="edad"
                      value={String(editClienteForm.edad)}
                      onChange={handleEditClienteChange}
                      min={0}
                      max={120}
                    />
                  </div>

                  <div className="form-group">
                    <label>Dirección</label>
                    <input name="direccion" value={editClienteForm.direccion} onChange={handleEditClienteChange} />
                  </div>

                  <div className="form-group">
                    <label>Ubicación</label>
                    <input name="ubicacion" value={editClienteForm.ubicacion} onChange={handleEditClienteChange} />
                  </div>

                  <div className="form-group">
                    <label>Sexo</label>
                    <input name="sexo" value={editClienteForm.sexo} onChange={handleEditClienteChange} />
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" className="btn btn-primary" disabled={editClienteLoading}>
                      {editClienteLoading ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setEditClienteId(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}
            
            {clienteSeleccionado && (
              <div className="movimientos-cliente" style={{ background: '#f6f7fa', border: '1.5px solid #e0e2e7', borderRadius: 12, padding: 24, marginBottom: 32, marginTop: 16 }}>
                <h3 style={{ marginTop: 0 }}>Historial de cupones del cliente: {clienteSeleccionado.nombre}</h3>
                <div className="table-responsive">
                  <table className="transactions-table">
                    <thead>
                  <tr>
                    <th>ID del movimiento</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Descripción</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                    </thead>
                    <tbody>
              {movimientosClienteFiltrados.length > 0 ? (
                movimientosClientePaginados.map((mov) => (
                  <tr key={mov.id}>
                    <td>{mov.id}</td>
                    <td>{mov.fecha ? new Date(mov.fecha).toLocaleString() : ''}</td>
                    <td>
                      <div className="client-info">
                        <div className="client-name">{mov.nombre_cliente || clienteSeleccionado.nombre || 'Cliente'}</div>
                        <div className="client-cuit">{mov.cuit}</div>
                      </div>
                    </td>
                    <td>{mov.descripcion || 'Sin descripción'}</td>
                    <td>
                      <span className={`tipo-movimiento ${(mov.tipo || 'desconocido').toLowerCase()}`}>
                        {mov.tipo || 'Desconocido'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${(mov.estado || 'desconocido').toLowerCase()}`}>
                        {mov.estado || 'Desconocido'}
                      </span>
                    </td>
                    <td>

                      {mov.estado === 'PENDIENTE' && (
                        <button 
                          className="btn-icon success" 
                          title="Aprobar movimiento"
                          onClick={() => aprobarMovimiento(mov.id)}
                        >
                          <FiCheck />
                        </button>
                      )}

                      {String(mov.tipo_movimiento || mov.tipo || '').toUpperCase() === 'ACREDITACION' && ['APROBADO', 'PAGADO'].includes(String(mov.estado || '').toUpperCase()) && (
                        <button
                          className="btn-icon"
                          title="Ver acreditación"
                          onClick={() => openAcreditadoModal(mov)}
                        >
                          <FiEye />
                        </button>
                      )}

                      {mov.estado !== 'ELIMINADO' && (
                        <button
                          className="btn-icon danger"
                          title="Eliminar movimiento"
                          onClick={() => openDeleteModal(mov)}
                        >
                          <FiTrash />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="no-results">
                    No se encontraron movimientos con los filtros actuales
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {movimientosClienteFiltrados.length > MOVIMIENTOS_CLIENTE_PER_PAGE && (
            <div className="pagination" style={{ marginTop: 12 }}>
              <button
                disabled={movimientosClienteCurrentPage === 0}
                onClick={() => setMovimientosClientePage(0)}
              >
                Volver al inicio
              </button>
              <button
                disabled={movimientosClienteCurrentPage === 0}
                onClick={() => setMovimientosClientePage(p => Math.max(0, p - 1))}
              >
                Anterior
              </button>
              <span>
                Página {movimientosClienteCurrentPage + 1} de {movimientosClienteTotalPages}
              </span>
              <button
                disabled={movimientosClienteCurrentPage + 1 >= movimientosClienteTotalPages}
                onClick={() => setMovimientosClientePage(p => Math.min(movimientosClienteTotalPages - 1, p + 1))}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      </div>
    )}
  </div>
</TabPanel>

<TabPanel>
  <div className="transactions-container">
    <div className="table-header">
      <h2>Sucursales y Terminales</h2>
    </div>

    <div className="registro-movimiento" style={{ padding: 18 }}>
      <div className="form-group" style={{ maxWidth: 520 }}>
        <label>Cliente</label>
        <select
          value={clienteSeleccionado?.id || ''}
          onChange={(e) => {
            const id = String(e.target.value || '');
            const next = (clientes || []).find((c) => String(c.id) === id) || null;
            if (next) {
              handleSeleccionarCliente(next);
            }
          }}
        >
          <option value="">Seleccionar cliente</option>
          {(clientes || []).map((c) => (
            <option key={String(c.id)} value={String(c.id)}>
              {c.nombre} - {c.cuit}
            </option>
          ))}
        </select>
      </div>

      {!clienteSeleccionado ? (
        <div className="no-movimientos" style={{ padding: 18 }}>
          Seleccioná un cliente para administrar sus sucursales y terminales.
        </div>
      ) : (
        <>
          <div style={{ marginTop: '1.25rem' }}>
            <SucursalesAdmin clienteId={clienteSeleccionado.id} />
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <TerminalesAdmin clienteId={clienteSeleccionado.id} />
          </div>
        </>
      )}
    </div>
  </div>
</TabPanel>

<TabPanel>
  <h2>Ajustes Negativos</h2>
  <div className="ajuste-negativo-section">
    {!showFormAjuste ? (
      <button 
        onClick={() => setShowFormAjuste(true)}
        className="btn btn-danger"
      >
        <FiPlus /> Nuevo Ajuste Negativo
      </button>
    ) : (
      <div className="form-container">
        <h3>Cargar Nuevo Ajuste Negativo</h3>
        {errorAjuste && <div className="error-message">{errorAjuste}</div>}
        {successAjuste && <div className="success-message">{successAjuste}</div>}

        <form onSubmit={handleCrearAjuste}>
          <div className="form-grid">
            <div className="form-group">
              <label>ID Cliente *</label>
              <select
                value={ajusteClienteId}
                onChange={handleAjusteClienteIdChange}
                required
              >
                <option value="">Seleccionar ID...</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>CUIT Cliente *</label>
              <select 
                name="cuit"
                value={ajusteForm.cuit}
                onChange={handleAjusteChange}
                required
              >
                <option value="">Seleccionar CUIT...</option>
                {clientes.map(c => (
                  <option key={c.cuit} value={c.cuit}>
                    {c.cuit} {c.razon_social}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Monto a Descontar (ARS) *</label>
              <input 
                type="number"
                name="monto"
                value={ajusteForm.monto}
                onChange={handleAjusteChange}
                placeholder="Ej: 100.00"
                step="0.01"
                min="0"
                required
              />
              <small>Se descontará -${parseFloat(ajusteForm.monto || 0).toFixed(2)} del saldo del cliente</small>
            </div>

            <div className="form-group">
              <label>Motivo del Ajuste *</label>
              <select 
                name="motivo"
                value={ajusteForm.motivo}
                onChange={handleAjusteChange}
                required
              >
                <option value="mantenimiento">Mantenimiento de Terminal</option>
                <option value="penalidad">Penalidad</option>
                <option value="tarjeta">Ajuste de Marca de Tarjeta</option>
                <option value="correcion">Corrección Administrativa</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Descripción (Opcional)</label>
              <textarea
                name="descripcion"
                value={ajusteForm.descripcion}
                onChange={handleAjusteChange}
                placeholder="Detalle (opcional)"
              />
            </div>

            <div className="form-actions" style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-primary" disabled={cargandoAjustes}>
                Crear ajuste
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowFormAjuste(false);
                  setAjusteClienteId('');
                  setAjusteForm((prev) => ({
                    ...prev,
                    cuit: '',
                  }));
                }}
                className="btn btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </div>
          </form>
        </div>
      )}
    </div>
  <div className="tab-content">
    <div className="filters">
      <form
        className="filter-form"
        onSubmit={(e) => {
          e.preventDefault();
          fetchAjustesNegativos(filtroAjusteCuit.trim());
        }}
      >
        <div className="form-group">
          <label>Filtrar por CUIT:</label>
          <input
            type="text"
            placeholder="CUIT..."
            value={filtroAjusteCuit}
            onChange={(e) => setFiltroAjusteCuit(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={cargandoAjustes}>
          <FiSearch /> Buscar
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setFiltroAjusteCuit('');
            fetchAjustesNegativos('');
          }}
          disabled={cargandoAjustes}
        >
          Limpiar
        </button>
      </form>
    </div>

    <div className="ajustes-table-section">
      <h3>Ajustes Pendientes de Aprobación</h3>
      {cargandoAjustes ? (
        <div className="loading-movimientos">
          <FiRefreshCw className="spinning" />
          Cargando ajustes...
        </div>
      ) : ajustesNegativos.length === 0 ? (
        <div className="no-movimientos">
          <p>No hay ajustes negativos pendientes</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="ajustes-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>CUIT</th>
                <th>Motivo</th>
                <th>Monto</th>
                <th>Descripción</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ajustesNegativos.map((ajuste) => {
                const motivoMatch = ajuste.descripcion?.match(/\[([^\]]+)\]/) || ['', 'otro'];
                const motivo = (motivoMatch[1] || 'otro').toLowerCase();
                const descSinMotivo = ajuste.descripcion?.replace(/\[[^\]]+\]\s*/, '') || '';

                return (
                  <tr key={ajuste.id}>
                    <td><strong>#{ajuste.id}</strong></td>
                    <td>{ajuste.nombre_cliente || 'Sin nombre'}</td>
                    <td><code>{ajuste.cuit}</code></td>
                    <td>
                      <span className={`motivo-badge ${motivo}`}>{motivo}</span>
                    </td>
                    <td className="amount text-danger"><strong>-${parseFloat(ajuste.monto || 0).toFixed(2)}</strong></td>
                    <td className="descripcion">{descSinMotivo || '-'}</td>
                    <td>{new Date(ajuste.created_at).toLocaleDateString('es-AR')}</td>
                    <td>
                      <span className={`badge badge-${(ajuste.estado || 'pendiente').toLowerCase()}`}>{ajuste.estado || 'PENDIENTE'}</span>
                    </td>
                    <td>
                      {String(ajuste.estado || '').toUpperCase() === 'PENDIENTE' ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn-icon success"
                            title="Aprobar ajuste"
                            onClick={() => aprobarAjuste(ajuste.id)}
                            disabled={cargandoAjustes}
                          >
                            <FiCheck size={16} />
                          </button>
                          <button
                            className="btn-icon danger"
                            title="Rechazar ajuste"
                            onClick={() => rechazarAjuste(ajuste.id)}
                            disabled={cargandoAjustes}
                          >
                            <FiXCircle size={16} />
                          </button>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </div>

</TabPanel>

{/* PESTAÑA RETIROS */}
<TabPanel>
  <div className="retiros-content">
    <div className="retiros-header">
      <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>Gestión de Retiros</h2>
      <button 
        onClick={() => {
          fetchRetirosPendientes();
          fetchRetirosHistorico();
        }}
        className="refresh-btn"
        disabled={cargandoRetiros}
      >
        <FiRefreshCw className={cargandoRetiros ? 'spinning' : ''} /> 
        {cargandoRetiros ? 'Actualizando...' : 'Actualizar'}
      </button>
    </div>

    <div className="retiros-section">
      <h3>Retiros Pendientes de Aprobación</h3>
      {cargandoRetiros ? (
        <div className="loading-movimientos">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <FiRefreshCw className="spinning" />
            <span>Cargando retiros pendientes...</span>
          </div>
        </div>
      ) : retirosPendientes.length === 0 ? (
        <div className="no-movimientos">
          <FiCheckCircle size={32} style={{ opacity: 0.5, marginBottom: '10px' }} />
          <p>No hay retiros pendientes de aprobación</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="retiros-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>CUIT</th>
                <th>Monto</th>
                <th>CBU (Últimos 4)</th>
                <th>Solicitado</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {retirosPendientes.map((retiro) => (
                <tr key={retiro.id}>
                  <td><strong>#{retiro.id}</strong></td>
                  <td>{retiro.nombre_cliente || 'Sin nombre'}</td>
                  <td><code>{retiro.cuit}</code></td>
                  <td className="amount">${parseFloat(retiro.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  <td><code>{retiro.cbu?.slice(-4) || 'N/A'}</code></td>
                  <td>{new Date(retiro.solicitado_at).toLocaleDateString('es-AR')}</td>
                  <td>
                    <span className="badge badge-pendiente">{getRetiroEstadoLabel(retiro.estado)}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn-icon success"
                        title="Aprobar retiro"
                        onClick={() => openRetiroConfirmModal('aprobar', retiro)}
                        disabled={cargandoRetiros}
                      >
                        <FiCheck size={16} />
                      </button>
                      <button
                        className="btn-icon danger"
                        title="Rechazar retiro"
                        onClick={() => openRetiroConfirmModal('rechazar', retiro)}
                        disabled={cargandoRetiros}
                      >
                        <FiXCircle size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>

    <div className="retiros-section">
      <h3>Historial de Retiros</h3>
      {retirosHistorico.length === 0 ? (
        <div className="no-movimientos">
          <p>Sin registros de retiros procesados</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="retiros-table">
            <thead>
              <tr>
                <th>ID del retiro</th>
                <th>Cliente ID</th>
                <th>Cliente</th>
                <th>Código</th>
                <th>Monto</th>
                <th>CBU (Últimos 4)</th>
                <th>Estado</th>
                <th>Solicitado</th>
                <th>Aprobado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {retirosHistorico.map((retiro) => (
                <tr key={retiro.id}>
                  <td><strong>#{retiro.id}</strong></td>
                  <td><code>{retiro.cliente_id ?? retiro.id_cliente ?? retiro.clienteId ?? 'N/A'}</code></td>
                  <td>{retiro.nombre_cliente || 'Sin nombre'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <code>{retiro.codigo_retiro || '-'}</code>
                      {!!retiro.codigo_retiro && (
                        <button
                          type="button"
                          className="btn-icon"
                          title="Copiar código"
                          onClick={() => copyToClipboard(retiro.codigo_retiro)}
                        >
                          <FiCopy />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="amount">${parseFloat(retiro.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                  <td><code>{retiro.cbu?.slice(-4) || 'N/A'}</code></td>
                  <td>
                    <span className={`badge badge-${(retiro.estado || 'desconocido').toLowerCase()}`}>
                      {getRetiroEstadoLabel(retiro.estado)}
                    </span>
                  </td>
                  <td>{new Date(retiro.solicitado_at).toLocaleDateString('es-AR')}</td>
                  <td>{retiro.aprobado_at ? new Date(retiro.aprobado_at).toLocaleDateString('es-AR') : '-'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-icon danger"
                      title="Eliminar retiro (movimiento)"
                      onClick={() => {
                        setToDeleteMovement({ id: `retiro:${retiro.id}`, retiroId: retiro.id });
                        setDeleteMotivo('');
                        setShowDeleteModal(true);
                      }}
                    >
                      <FiTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </div>

</TabPanel>

{/* PESTAÑA INGRESOS (DEPÓSITOS) */}
<TabPanel>
  <div className="retiros-content">
    <div className="retiros-header">
      <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>Ingresos (Depósitos)</h2>
      <button
        onClick={() => {
          fetchDepositosPendientes();
          fetchDepositosAprobados();
        }}
        className="refresh-btn"
      >
        <FiRefreshCw /> Actualizar
      </button>
    </div>

    {depositosError && (
      <div className="alert alert-error" style={{ marginBottom: 12 }}>
        {depositosError}
      </div>
    )}

    {cargandoDepositos ? (
      <div className="loading-movimientos">
        <FiRefreshCw className="spinning" />
        <span>Cargando depósitos pendientes...</span>
      </div>
    ) : depositosPendientes.length === 0 ? (
      <div className="no-movimientos">
        <FiCheckCircle size={32} style={{ opacity: 0.5, marginBottom: '10px' }} />
        <p>No hay ingresos pendientes de revisión</p>
      </div>
    ) : (
      <div style={{ overflowX: 'auto' }}>
        <table className="cupones-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>CUIT</th>
              <th>Email</th>
              <th>Comprobante</th>
              <th>Monto (detectado)</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {depositosPendientes.map((dep) => (
              <tr key={dep.id}>
                <td><strong>#{dep.id}</strong></td>
                <td><code>{dep.cuit || '-'}</code></td>
                <td>{dep.email || '-'}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => downloadDepositoReceipt(dep.receipt_id)}
                    title="Descargar comprobante"
                    style={{ padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <FiDownload size={16} /> Descargar
                  </button>
                </td>
                <td className="amount">
                  {Number(dep.amount_detected || 0) > 0 ? `$${Number(dep.amount_detected).toFixed(2)}` : '-'}
                </td>
                <td>{dep.created_at ? new Date(dep.created_at).toLocaleString('es-AR') : '-'}</td>
                <td>
                  <span className="badge badge-pendiente">{dep.status || 'PENDING_REVIEW'}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn-icon success"
                      title="Aprobar depósito"
                      onClick={() => aprobarDeposito(dep.id)}
                      disabled={depositosProcesoId === dep.id}
                    >
                      <FiCheck size={16} />
                    </button>
                    <button
                      className="btn-icon danger"
                      title="Rechazar depósito"
                      onClick={() => rechazarDeposito(dep.id)}
                      disabled={depositosProcesoId === dep.id}
                    >
                      <FiXCircle size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    <div style={{ marginTop: 18 }}>
      <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Ingresos aprobados</h3>

      {depositosAprobados.length === 0 ? (
        <div className="no-movimientos">
          <FiCheckCircle size={32} style={{ opacity: 0.5, marginBottom: '10px' }} />
          <p>No hay ingresos aprobados para mostrar</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="cupones-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>CUIT</th>
                <th>Email</th>
                <th>Bruto</th>
                <th>Comisión (1%)</th>
                <th>Conciliación (1.5%)</th>
                <th>Total Descuentos</th>
                <th>Neto Liquidado</th>
                <th>Fecha aprobación</th>
                <th>Comprobante</th>
              </tr>
            </thead>
            <tbody>
              {depositosAprobados.map((dep) => (
                <tr key={dep.id}>
                  <td><strong>#{dep.id}</strong></td>
                  <td><code>{dep.cuit || '-'}</code></td>
                  <td>{dep.email || '-'}</td>
                  <td className="amount">
                    {dep.monto_bruto ? `$${Number(dep.monto_bruto).toFixed(2)}` : 
                     dep.amount_detected ? `$${Number(dep.amount_detected).toFixed(2)}` : '-'}
                  </td>
                  <td className="amount discount">
                    {dep.comision_arwpay ? `$${Number(dep.comision_arwpay).toFixed(2)}` : '-'}
                  </td>
                  <td className="amount discount">
                    {dep.conciliacion_bancaria ? `$${Number(dep.conciliacion_bancaria).toFixed(2)}` : '-'}
                  </td>
                  <td className="amount discount">
                    {dep.total_descuentos ? `$${Number(dep.total_descuentos).toFixed(2)}` : '-'}
                  </td>
                  <td className="amount approved">
                    {dep.monto_neto ? `$${Number(dep.monto_neto).toFixed(2)}` : 
                     dep.amount_credited ? `$${Number(dep.amount_credited).toFixed(2)}` : '-'}
                  </td>
                  <td>{dep.admin_action_at ? new Date(dep.admin_action_at).toLocaleString('es-AR') : '-'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => downloadDepositoReceipt(dep.receipt_id)}
                      title="Descargar comprobante"
                      style={{ padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <FiDownload size={16} /> Descargar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </div>
</TabPanel>

{/* PESTAÑA CUPONES */}
<TabPanel>
  <div className="cupones-content">
    <div className="cupones-header">
      <h2>Gestión de Cupones</h2>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={() => {
            setShowCuponesMasivos(true);
            setErrorCupon('');
            setSuccessCupon('');
            setCuponesMasivosSummary(null);
          }}
          className="refresh-btn"
          type="button"
        >
          Cupones masivos
        </button>

        <button 
          onClick={() => {
            setShowFormCupon(!showFormCupon);
            setErrorCupon('');
            setSuccessCupon('');
          }}
          className="refresh-btn"
          type="button"
        >
          <FiPlus /> {showFormCupon ? 'Cancelar' : 'Nuevo Cupón'}
        </button>
      </div>
    </div>

    {showCuponesMasivos && (
      <div className="modal-overlay" onClick={closeCuponesMasivos}>
        <div
          className="modal-confirm"
          onClick={(e) => e.stopPropagation()}
          style={{ width: 'min(640px, calc(100vw - 32px))', maxHeight: '80vh', overflowY: 'auto' }}
        >
          <h3 style={{ marginTop: 0 }}>Cupones masivos</h3>
          <div style={{ color: '#ffff', fontWeight: 700, marginBottom: 10 }}>
            Completá los campos del cupón y luego pegá los montos (uno por línea).
          </div>

          <div className="form-grid" style={{ marginBottom: 10 }}>
            <div className="form-group">
              <label style={{ color: '#ffff' }}>CUIT Cliente *</label>
              <select
                name="cuit"
                value={cuponForm.cuit}
                onChange={handleCuitCuponChange}
              >
                <option value="">Seleccionar cliente...</option>
                {clientes.map(c => (
                  <option key={c.cuit} value={c.cuit}>
                    {c.nombre} - {c.cuit}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label style={{ color: '#ffff' }}>Sucursal *</label>
              <select
                name="sucursal_id"
                value={cuponForm.sucursal_id}
                onChange={handleSucursalChange}
                disabled={!cuponForm.cuit}
              >
                <option value="">Seleccionar sucursal...</option>
                {sucursales.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label style={{ color: '#ffff' }}>Terminal *</label>
              <select
                name="terminal_id"
                value={cuponForm.terminal_id}
                onChange={handleTerminalChange}
                disabled={!cuponForm.sucursal_id}
              >
                <option value="">Seleccionar terminal...</option>
                {terminales.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} {t.tipo ? `(${t.tipo})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label style={{ color: '#ffff' }}>ACREDITADO EN CBU/CVU</label>
              <input
                type="text"
                name="cbu_cvu"
                value={cuponForm.cbu_cvu}
                onChange={handleCuponChange}
                maxLength={22}
                inputMode="numeric"
              />
            </div>

            <div className="form-group">
              <label style={{ color: '#ffff' }}>OTROS (%)</label>
              <input
                type="number"
                name="otros"
                value={cuponForm.otros}
                onChange={handleCuponChange}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>

            <div className="form-group">
              <label style={{ color: '#ffff' }}>COMISION FLUX (%)</label>
              <input
                type="number"
                name="comision_flux_pct"
                value={cuponForm.comision_flux_pct}
                onChange={handleCuponChange}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>

            <div className="form-group">
              <label style={{ color: '#ffff' }}>CONSILIACION BANCARIA (%)</label>
              <input
                type="number"
                name="conciliacion_bancaria_pct"
                value={cuponForm.conciliacion_bancaria_pct}
                onChange={handleCuponChange}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>

            <div className="form-group">
              <label style={{ color: '#ffff' }}>IVA COMISIÓN FLUX (%)</label>
              <input
                type="number"
                name="iva_comision_flux_pct"
                value={cuponForm.iva_comision_flux_pct}
                onChange={handleCuponChange}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label style={{ color: '#ffff' }}>Detalle (es para todos los cupones)</label>
              <input
                type="text"
                name="detalle_cupon"
                value={cuponForm.detalle_cupon}
                onChange={handleCuponChange}
                placeholder="Ej: Venta mostrador"
              />
              <small>Si además ponés detalle por línea, el detalle por línea tiene prioridad.</small>
            </div>

            <div className="form-group">
              <label style={{ color: '#ffff' }}>FECHA, HORA</label>
              <input
                type="datetime-local"
                name="fecha_transaccion"
                value={cuponForm.fecha_transaccion || ''}
                onChange={handleCuponChange}
                required
              />
              <small>Fecha y hora para todos los cupones del lote.</small>
            </div>
          </div>

          <div className="form-group">
            <label>Pegá los cupones (uno por línea)</label>
            <textarea
              rows={6}
              value={cuponesMasivosText}
              onChange={(e) => setCuponesMasivosText(e.target.value)}
              placeholder={'Ej:\n1000\n2500; Venta mostrador\n3500; Promo'}
            />
            <small>
              Formato simple: <b>monto</b> (ej: <b>1000</b>)
              <br />
              Opcional: <b>monto;detalle</b> (ej: <b>2500; Venta mostrador</b>)
            </small>
          </div>

          {cuponesMasivosSummary && (
            <div style={{ marginTop: 10, border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, background: '#fff' }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>
                Resumen: cupones pendientes en ser aprobados, {cuponesMasivosSummary.ok}/{cuponesMasivosSummary.total} creados
              </div>
              <div style={{ maxHeight: 180, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(cuponesMasivosSummary.results || []).map((r, idx) => (
                  <div key={String(idx)} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12 }}>
                    <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.raw}</div>
                    <div style={{ fontFamily: 'Courier New, monospace', fontWeight: 900, color: r.ok ? '#166534' : '#b00020' }}>
                      {r.ok ? `OK${r.codigo_cupon ? ` (${r.codigo_cupon})` : ''}` : `ERROR: ${r.error}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button className="btn btn-secondary" type="button" onClick={closeCuponesMasivos} disabled={cuponesMasivosLoading}>
              Cerrar
            </button>
            <button className="btn btn-primary" type="button" onClick={handleCrearCuponesMasivos} disabled={cuponesMasivosLoading}>
              {cuponesMasivosLoading ? 'Creando...' : 'Crear cupones'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* FORMULARIO CREAR CUPÓN */}
    {showFormCupon && (
      <div className="cupon-form-card">
        <h3>Cargar Nuevo Cupón</h3>
        {errorCupon && <div className="error-message">{errorCupon}</div>}
        {successCupon && <div className="success-message">{successCupon}</div>}

        <form onSubmit={handleCrearCupon}>
          {(() => {
            const bruto = Number(cuponForm.montoBruto || 0);
            const pctFlux = Number(cuponForm.comision_flux_pct || 0);
            const pctConc = Number(cuponForm.conciliacion_bancaria_pct || 0);
            const pctIvaFlux = Number(cuponForm.iva_comision_flux_pct || 0);
            const otros = Number(cuponForm.otros || 0);
            
            // Calcular monto base restando OTROS del bruto (OTROS es un monto fijo)
            const otrosMonto = bruto * (otros / 100);
            const montoBase = bruto - otrosMonto;
            
            // Calcular descuentos sobre el monto base con redondeo a 2 decimales
            const comisionFluxMonto = Math.round((bruto * (pctFlux / 100)) * 100) / 100;
            const ivaComisionFluxMonto = pctIvaFlux > 0 ? Math.round((comisionFluxMonto * (pctIvaFlux / 100)) * 100) / 100 : 0;
            const conciliacionMonto = Math.round((bruto * (pctConc / 100)) * 100) / 100;
            
            // Calcular neto restando todos los descuentos del monto base
            const neto = bruto - otrosMonto - comisionFluxMonto - ivaComisionFluxMonto - conciliacionMonto;
            const nowText = new Date().toLocaleString('es-AR');
            return (
          <div className="form-grid">
            {/* CUIT */}
            <div className="form-group">
              <label>CUIT Cliente *</label>
              <select 
                name="cuit"
                value={cuponForm.cuit}
                onChange={handleCuitCuponChange}
                required
              >
                <option value="">Seleccionar cliente...</option>
                {clientes.map(c => (
                  <option key={c.cuit}  value={c.cuit}>
                     {c.nombre} - {c.cuit}
                  </option>
                ))}
              </select>
            </div>

            {/* Nombre de fantasía */}
            <div className="form-group">
              <label>Nombre de fantasía</label>
              <input
                type="text"
                name="nombre_fantasia"
                value={cuponForm.nombre_fantasia || (clientes.find(c => c.cuit === cuponForm.cuit)?.nombre_fantasia || '')}
                onChange={handleCuponChange}
                placeholder="Nombre de fantasía"
                disabled={!!(clientes.find(c => c.cuit === cuponForm.cuit)?.nombre_fantasia)}
              />
            </div>

            {/* Razón social */}
            <div className="form-group">
              <label>Razón social</label>
              <input
                type="text"
                name="razon_social"
                value={cuponForm.razon_social || (clientes.find(c => c.cuit === cuponForm.cuit)?.razon_social || '')}
                onChange={handleCuponChange}
                placeholder="Razón social"
                disabled={!!(clientes.find(c => c.cuit === cuponForm.cuit)?.razon_social)}
              />
            </div>

            {/* SUCURSAL */}
            <div className="form-group">
              <label>Sucursal *</label>
              <select 
                name="sucursal_id"
                value={cuponForm.sucursal_id}
                onChange={handleSucursalChange}
                disabled={!cuponForm.cuit}
                required
              >
                <option value="">Seleccionar sucursal...</option>
                {sucursales.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
              {cuponForm.cuit && sucursales.length === 0 && (
                <div className="no-sucursales"></div>
              )}
            </div>


            {/* TERMINAL */}
            <div className="form-group">
              <label>Terminal *</label>
              <select 
                name="terminal_id"
                value={cuponForm.terminal_id}
                onChange={handleTerminalChange}
                disabled={!cuponForm.sucursal_id}
                required
              >
                <option value="">Seleccionar terminal...</option>
                {terminales.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} {t.tipo ? `(${t.tipo})` : ''}
                  </option>
                ))}
              </select>
              {cuponForm.sucursal_id && terminales.length === 0 && (
                <div className="no-sucursales">No hay terminales para esta sucursal</div>
              )}
            </div>

            <div className="form-group">
              <label>MONTO BRUT LIQ FISERV *</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  name="montoBruto"
                  value={cuponForm.montoBruto}
                  onChange={handleCuponChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  required
                  style={{ flex: 1 }}
                />
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="number"
                    name="porcentaje_autocomplete_pct"
                    value={cuponForm.porcentaje_autocomplete_pct}
                    onChange={handleCuponChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    style={{ width: 90 }}
                    title="Autocompleta Comisión Flux y Conciliación"
                  />
                  <span style={{ fontWeight: 600 }}>%</span>
                </div>
              </div>
              <small>El % autocompleta Comisión Flux.</small>
            </div>

            <div className="form-group">
              <label>COMISION FLUX (%)</label>
              <input
                type="number"
                name="comision_flux_pct"
                value={cuponForm.comision_flux_pct}
                onChange={handleCuponChange}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
              <small>Descuenta: -${Number(comisionFluxMonto || 0).toFixed(2)}</small>
            </div>

            <div className="form-group">
              <label>IVA DE COMISIÓN FLUX (%)</label>
              <input
                type="number"
                name="iva_comision_flux_pct"
                value={cuponForm.iva_comision_flux_pct}
                onChange={handleCuponChange}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
              <small>Descuenta: -${Number(ivaComisionFluxMonto || 0).toFixed(2)}</small>
            </div>
            
            <div className="form-group">
              <label>CONSILIACION BANCARIA (%)</label>
              <input
                type="number"
                name="conciliacion_bancaria_pct"
                value={cuponForm.conciliacion_bancaria_pct}
                onChange={handleCuponChange}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
              <small>Descuenta: -${Number(conciliacionMonto || 0).toFixed(2)}</small>
            </div>

            <div className="form-group">
              <label>OTROS (%)</label>
              <input
                type="number"
                name="otros"
                value={cuponForm.otros}
                onChange={handleCuponChange}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
              <small>Descuenta: -${Number(otrosMonto || 0).toFixed(2)}</small>
            </div>


            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>DETALLE CUPONES</label>
              <input
                type="text"
                name="detalle_cupon"
                value={cuponForm.detalle_cupon}
                onChange={handleCuponChange}
                placeholder="Detalle / referencia"
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>ACREDITADO EN CBU/CVU</label>
              <input
                type="text"
                name="cbu_cvu"
                value={cuponForm.cbu_cvu}
                onChange={handleCuponChange}
                maxLength={22}
                inputMode="numeric"
              />
              <small>Se toma desde la sucursal/terminal seleccionada (si no hay asignación, usa el CBU del cliente).</small>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>TOTAL LIQUIDADO CLIENTE</label>
              <div className="neto-value">{formatCurrency(Number(totalLiquidadoCliente || 0))}</div>
            </div>

            <div className="form-group">
              <label>FECHA, HORA</label>
              <input
                type="datetime-local"
                name="fecha_transaccion"
                value={cuponForm.fecha_transaccion || ''}
                onChange={handleCuponChange}
                required
              />
              <small>Puedes modificar la fecha y hora del cupón.</small>
            </div>

            <div className="form-group">
              <label>BASE PARA CÁLCULO</label>
              <div className="neto-value">${Number(montoBase || 0).toFixed(2)}</div>
              <small>MONTO BRUT LIQ FISERV - OTROS</small>
            </div>

            <div className="form-group neto-display">
              <label>NETO LIQUIDADO</label>
              <div className="neto-value">${Number(neto || 0).toFixed(2)}</div>
            </div>
          </div>
            );
          })()}

          {(() => {
            const bruto = Number(cuponForm.montoBruto || 0);
            const pctFlux = Number(cuponForm.comision_flux_pct || 0);
            const pctConc = Number(cuponForm.conciliacion_bancaria_pct || 0);
            const pctIvaFlux = Number(cuponForm.iva_comision_flux_pct || 0);
            const otros = Number(cuponForm.otros || 0);
            
            // Calcular monto base restando OTROS del bruto (ahora OTROS es un monto fijo)
            const otrosMonto = bruto * (otros / 100);
            const montoBase = bruto - otrosMonto;
            
            // Calcular descuentos sobre el monto base
            const comisionFluxMonto = bruto * (pctFlux / 100);
            const ivaComisionFluxMonto = pctIvaFlux > 0 ? (comisionFluxMonto * (pctIvaFlux / 100)) : 0;
            const conciliacionMonto = bruto * (pctConc / 100);
            
            // Calcular neto restando todos los descuentos del monto base
            const netoACrear = bruto - otrosMonto - comisionFluxMonto - ivaComisionFluxMonto - conciliacionMonto;
            return (
              <div style={{ margin: '12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, color: '#0f5132' }}>TOTAL LIQUIDADO CLIENTE</div>
                  <div style={{ fontSize: 16, fontWeight: 900 }}>{formatCurrency(Number(totalLiquidadoCliente || 0))}</div>
                </div>
                <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, color: '#0f5132' }}>NETO CUPÓN</div>
                  <div style={{ fontSize: 16, fontWeight: 900 }}>{formatCurrency(Number(netoACrear || 0))}</div>
                </div>
              </div>
            );
          })()}

          <button type="submit" className="btn btn-primary" disabled={cargandoCupones}>
            {cargandoCupones ? 'Creando...' : 'Crear Cupón'}
          </button>
        </form>
      </div>
    )}

    {/* CUPONES PENDIENTES */}
    <div className="cupones-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0 }}>Cupones Pendientes de Aprobación</h3>
        {cupones.length > 0 && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn btn-success"
              onClick={aprobarTodosLosCupones}
              disabled={cargandoCupones}
              title="Aprobar todos los cupones pendientes"
            >
              <FiCheck size={16} style={{ marginRight: '5px' }} />
              Aprobar Todos ({cupones.length})
            </button>
            <button
              className="btn btn-danger"
              onClick={rechazarTodosLosCupones}
              disabled={cargandoCupones}
              title="Rechazar todos los cupones pendientes"
            >
              <FiX size={16} style={{ marginRight: '5px' }} />
              Rechazar Todos ({cupones.length})
            </button>
          </div>
        )}
      </div>
      {cargandoCupones ? (
        <div className="loading-movimientos">
          <FiRefreshCw className="spinning" />
          Cargando cupones...
        </div>
      ) : cupones.length === 0 ? (
        <div className="no-movimientos">
          <p>No hay cupones pendientes</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="cupones-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Código</th>
                <th>Cliente (CUIT)</th>
                <th>MONTO BRUT LIQ FISERV</th>
                <th>COMISION FLUX (%)</th>
                <th>CONSILIACION BANCARIA (%)</th>
                <th>NETO LIQUIDADO</th>
                <th>ACREDITADO EN CBU/CVU</th>
                <th>DETALLE CUPONES</th>
                <th>Fecha/Hora</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cupones.map((cupon) => {
                const bruto = Number(cupon.montoBruto || 0);
                const pctFlux = Number(cupon.comision_flux_pct || 0);
                const pctConc = Number(cupon.conciliacion_bancaria_pct || 0);
                const comisionFluxMonto = bruto * (pctFlux / 100);
                const conciliacionMonto = bruto * (pctConc / 100);
                const neto = Number(cupon.neto ?? (bruto - comisionFluxMonto - conciliacionMonto));
                return (
                  <tr key={cupon.id}>
                    <td><strong>#{cupon.id}</strong></td>
                    <td><code>{cupon.codigo_cupon || '-'}</code></td>
                    <td><code>{cupon.cuit}</code></td>
                    <td className="amount">${bruto.toFixed(2)}</td>
                    <td>{pctFlux.toFixed(2)}%</td>
                    <td>{pctConc.toFixed(2)}%</td>
                    <td className="amount text-success"><strong>${neto.toFixed(2)}</strong></td>
                    <td><code>{formatCbuCvu(cupon.cbu_cvu) || '-'}</code></td>
                    <td>{cupon.detalle_cupon || '-'}</td>
                    <td>{cupon.created_at ? new Date(cupon.created_at).toLocaleString('es-AR') : '-'}</td>
                    <td>
                      <span className="badge badge-pendiente">{cupon.estado}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn-icon success"
                          title="Aprobar cupón"
                          onClick={() => aprobarCupon(cupon.id)}
                          disabled={cargandoCupones}
                        >
                          <FiCheck size={16} />
                        </button>
                        <button
                          className="btn-icon danger"
                          title="Rechazar cupón"
                          onClick={() => rechazarCupon(cupon.id)}
                          disabled={cargandoCupones}
                        >
                          <FiXCircle size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div> <br /> <br />

    {/* HISTORIAL CUPONES */}
    <div className="cupones-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0 }}>Historial de Cupones</h3>
        {cuponesHistorico.length > 0 && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectAllHistorico}
                onChange={toggleSeleccionarTodos}
                style={{ cursor: 'pointer' }}
              />
              Seleccionar todos ({cuponesHistorico.length})
            </label>
            {cuponesSeleccionados.size > 0 && (
              <button
                className="btn btn-danger"
                onClick={eliminarCuponesSeleccionados}
                disabled={cargandoCupones}
                title={`Eliminar ${cuponesSeleccionados.size} cupón(es) seleccionado(s)`}
              >
                <FiTrash size={16} style={{ marginRight: '5px' }} />
                Eliminar ({cuponesSeleccionados.size})
              </button>
            )}
          </div>
        )}
      </div>
      {cargandoCupones ? (
        <div className="loading-movimientos">
          <FiRefreshCw className="spinning" />
          Cargando historial...
        </div>
      ) : cuponesHistorico.length === 0 ? (
        <div className="no-movimientos">
          <p>No hay cupones procesados</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="cupones-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>
                  <input
                    type="checkbox"
                    checked={selectAllHistorico}
                    onChange={toggleSeleccionarTodos}
                    style={{ cursor: 'pointer' }}
                    title="Seleccionar todos"
                  />
                </th>
                <th>Cliente (CUIT)</th>
                <th>Fecha y hora de creación</th>
                <th>Código</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {cuponesHistorico.map((cupon) => {
                const neto = Number(cupon.neto ?? 0);
                return (
                  <tr key={cupon.id} className={cuponesSeleccionados.has(cupon.id) ? 'selected-row' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={cuponesSeleccionados.has(cupon.id)}
                        onChange={() => toggleSeleccionCupon(cupon.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td><code>{cupon.cuit}</code></td>
                    <td>
                      {cupon.created_at ? new Date(cupon.created_at).toLocaleString('es-AR') : '-'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <code>{cupon.codigo_cupon || '-'}</code>
                        {!!cupon.codigo_cupon && (
                          <button
                            type="button"
                            className="btn-icon"
                            title="Copiar código"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(cupon.codigo_cupon);
                            }}
                          >
                            <FiCopy />
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span className={`badge badge-${(cupon.estado || 'desconocido').toLowerCase()}`}>
                          {cupon.estado || 'Desconocido'}
                        </span>
                        {(cupon.estado || '').toUpperCase() === 'APROBADO' && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm cupon-ver-btn"
                            onClick={() => openCuponTicketModal(cupon)}
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            <FiEye /> Ver cupón
                          </button>
                        )}

                        {(cupon.estado || '').toUpperCase() === 'APROBADO' && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => enviarCuponPorEmail(cupon)}
                            disabled={sendingCuponEmailId === cupon.id}
                            style={{ whiteSpace: 'nowrap' }}
                            title="Enviar cupón al correo del cliente"
                          >
                            <FiMail /> {sendingCuponEmailId === cupon.id ? 'Enviando...' : 'Enviar mail'}
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn-icon danger"
                          title="Eliminar cupón"
                          onClick={() => openDeleteModal(cupon)}
                        >
                          <FiTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </div>

</TabPanel>

{/* PESTAÑA: VALIDACIONES */}
<TabPanel>
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
    <h2 style={{ margin: 0 }}>Validaciones</h2>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button
        type="button"
        className="refresh-btn"
        onClick={fetchRegistrosPendientes}
        disabled={cargandoRegistrosPendientes}
        style={{ whiteSpace: 'nowrap' }}
      >
        Refrescar registros
      </button>
    </div>
  </div>

  <div style={{ marginTop: 16, marginBottom: 24 }}>
    <div style={{ background: '#fff', border: '1px solid #e9ecef', borderRadius: 12, padding: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Registros pendientes</h3>
        <div style={{ fontSize: 12, color: '#666' }}>
          Total: <strong>{registrosPendientes.length}</strong>
        </div>
      </div>

      {cargandoRegistrosPendientes ? (
        <p>Cargando registros...</p>
      ) : registrosPendientes.length === 0 ? (
        <p>No hay registros pendientes.</p>
      ) : (
        <div className="notification-list">
          {registrosPendientes.map((r) => {
            const initial = r?.nombre ? String(r.nombre).charAt(0).toUpperCase() : 'N';
            const firmaUrl = r?.firma_base64 || '';
            return (
              <div className="notification-item" key={r.id}>
                <div className="notification-meta">
                  <div className="notification-avatar">{initial}</div>
                  <div className="notification-content">
                    <div className="notification-title">
                      Registro pendiente: {r.nombre} {r.apellido}
                    </div>
                    <div className="notification-time">
                      {r.created_at ? new Date(r.created_at).toLocaleString('es-AR') : ''}
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      CUIT: {r.cuit} · Email: {r.email}
                    </div>
                  </div>
                </div>

                <div className="notification-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {firmaUrl && (
                    <a
                      className="btn btn-secondary btn-sm"
                      href={firmaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ver firma"
                    >
                      Ver firma
                    </a>
                  )}
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => aprobarRegistro(r.id)}
                  >
                    Aprobar
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => rechazarRegistro(r.id)}
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>

</TabPanel>

{/* PESTAÑA: NOTIFICACIONES DEL CLIENTE - SOLICITUDES DE RETIRO */}
<TabPanel>
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
    <h2 style={{ margin: 0 }}>Notificaciones del Cliente - Solicitudes de Retiro</h2>
  </div>

  <div style={{ marginTop: 24, marginBottom: 8 }}>
    <div style={{ background: '#fff', border: '1px solid #e9ecef', borderRadius: 12, padding: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Solicitudes de retiro pendientes</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#666', marginRight: 8 }}>
            Total: <strong>{solicitudesRetiro.length}</strong>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => ocultarSolicitudesRetiro(selectedSolicitudesRetiro)}
            disabled={selectedSolicitudesRetiro.length === 0}
            title="Ocultar seleccionadas"
          >
            Ocultar seleccionadas
          </button>
          <button
            type="button"
            className="refresh-btn"
            onClick={fetchSolicitudesRetiro}
            disabled={cargandoSolicitudes}
            style={{ whiteSpace: 'nowrap' }}
          >
            Refrescar retiros
          </button>
        </div>
      </div>

      {cargandoSolicitudes ? (
        <p>Cargando solicitudes de retiro...</p>
      ) : solicitudesRetiro.length === 0 ? (
        <p></p>
      ) : (
        <div className="notification-list">
          {solicitudesRetiro.map((solicitud) => {
            const initial = solicitud.cuit ? solicitud.cuit.charAt(0) : 'C';
            const checked = selectedSolicitudesRetiro.includes(solicitud.id);
            return (
              <div className="notification-item" key={solicitud.id}>
                <div className="notification-meta">
                  <div className="notification-avatar">{initial}</div>
                  <div className="notification-content">
                    <div className="notification-title">Retiro solicitado:<br></br> ID del cliente: {solicitud.cliente_id} <br></br> CUIT: {solicitud.cuit}</div>
                    <div className="notification-body">Monto: <span className="amount">${parseFloat(solicitud.monto).toFixed(2)}</span> • Destino: {solicitud.cbu}</div>
                    <div className="notification-time">{new Date(solicitud.solicitado_at).toLocaleString('es-AR')}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>

  <div style={{ marginTop: 24, marginBottom: 8 }}>
    <div style={{ background: '#fff', border: '1px solid #e9ecef', borderRadius: 12, padding: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Cupones eliminados</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#666', marginRight: 8 }}>
            Total: <strong>{cuponesEliminados.length}</strong>
          </div>
          <button
            type="button"
            className="refresh-btn"
            onClick={fetchCuponesEliminadosAdmin}
            disabled={cargandoCuponesEliminados}
            style={{ whiteSpace: 'nowrap' }}
          >
            Refrescar cupones eliminados
          </button>
        </div>
      </div>

      {cargandoCuponesEliminados ? (
        <p>Cargando notificaciones de cupones eliminados...</p>
      ) : cuponesEliminados.length === 0 ? (
        <p>No hay cupones eliminados registrados.</p>
      ) : (
        <div className="notification-list">
          {cuponesEliminados.map((notif) => {
            const initial = notif.cuit ? notif.cuit.charAt(0) : 'C';
            return (
              <div className="notification-item" key={notif.id}>
                <div className="notification-meta">
                  <div className="notification-avatar">{initial}</div>
                  <div className="notification-content">
                    <div className="notification-title">{notif.mensaje}</div>
                    <div className="notification-body">CUIT: {notif.cuit}</div>
                    <div className="notification-time">
                      {new Date(notif.created_at).toLocaleString('es-AR')}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>

  <div style={{ marginTop: 24, marginBottom: 8 }}>
    <div style={{ background: '#fff', border: '1px solid #e9ecef', borderRadius: 12, padding: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Cupones eliminados</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#666', marginRight: 8 }}>
            Total: <strong>{cuponesEliminados.length}</strong>
          </div>
          <button
            type="button"
            className="refresh-btn"
            onClick={fetchCuponesEliminadosAdmin}
            disabled={cargandoCuponesEliminados}
            style={{ whiteSpace: 'nowrap' }}
          >
            Refrescar cupones eliminados
          </button>
        </div>
      </div>

      {cargandoCuponesEliminados ? (
        <p>Cargando notificaciones de cupones eliminados...</p>
      ) : cuponesEliminados.length === 0 ? (
        <p>No hay cupones eliminados registrados.</p>
      ) : (
        <div className="notification-list">
          {cuponesEliminados.map((notif) => {
            const initial = notif.cuit ? notif.cuit.charAt(0) : 'C';
            return (
              <div className="notification-item" key={notif.id}>
                <div className="notification-meta">
                  <div className="notification-avatar">{initial}</div>
                  <div className="notification-content">
                    <div className="notification-title">{notif.mensaje}</div>
                    <div className="notification-body">CUIT: {notif.cuit}</div>
                    <div className="notification-time">
                      {new Date(notif.created_at).toLocaleString('es-AR')}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
</TabPanel>

{showRetiroConfirmModal && (
  <div className="modal-overlay" onClick={closeRetiroConfirmModal}>
    <div
      className={`modal-confirm retiro-confirm ${retiroConfirmAction === 'rechazar' ? 'is-danger' : 'is-success'}`}
      onClick={(e) => e.stopPropagation()}
      style={{ width: 'min(560px, calc(100vw - 32px))', padding: 20, borderRadius: 14, background: '#fff', boxShadow: '0 18px 70px rgba(0,0,0,0.35)' }}
    >
      <h3 style={{ margin: 0, marginBottom: 10, color: '#111827', fontSize: 18, fontWeight: 900 }}>
        {retiroConfirmAction === 'rechazar'
          ? '¿Estas seguro de que quieres rechazar el retiro solicitado?'
          : '¿Estas seguro que quieres aceptar el retiro solicitado?'}
      </h3>
      <p style={{ marginTop: 0, marginBottom: 12, color: '#374151', fontSize: 13, lineHeight: 1.35 }}>
        ID del cliente: <strong>{retiroConfirmSolicitud?.cliente_id}</strong>
        {' • '}
        CUIT: <strong>{retiroConfirmSolicitud?.cuit}</strong>
      </p>
      {retiroConfirmAction === 'rechazar' && (
        <textarea
          placeholder="Motivo (opcional)"
          value={retiroConfirmMotivo}
          onChange={(e) => setRetiroConfirmMotivo(e.target.value)}
          rows={3}
          style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 12, border: '1px solid #e5e7eb', outline: 'none', resize: 'vertical', fontSize: 13, marginBottom: 10 }}
        />
      )}
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={closeRetiroConfirmModal}>
          Cancelar
        </button>
        <button
          className={`btn ${retiroConfirmAction === 'rechazar' ? 'btn-danger' : 'btn-success'}`}
          onClick={confirmRetiroAction}
        >
          Confirmar
        </button>
      </div>
    </div>
  </div>
)}

{showAcreditadoModal && (
  <div className="modal-overlay" onClick={closeAcreditadoModal}>
    <div className="modal-confirm" onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px, calc(100vw - 32px))', padding: 18 }}>
      {(() => {
        const monto = Number(acreditadoModalData?.neto ?? acreditadoModalData?.montoBruto ?? 0);
        const descuentos = Number(acreditadoModalData?.arancel || 0) + Number(acreditadoModalData?.comision || 0) + Number(acreditadoModalData?.ajuste || 0);
        const estado = String(acreditadoModalData?.estado || '').toUpperCase() || '-';
        const tarjeta = acreditadoModalData?.marca_tarjeta || acreditadoModalData?.numero_autorizacion || acreditadoModalData?.numero_lote || '-';
        const motivo = acreditadoModalData?.motivo || acreditadoModalData?.descripcion || '-';
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ fontWeight: 900 }}>Detalle de Acreditación</div>
              <button className="btn btn-secondary btn-sm" type="button" onClick={closeAcreditadoModal}>Cerrar</button>
            </div>

            <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, background: '#fff' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Monto</div>
                  <div style={{ fontWeight: 900, fontFamily: 'Courier New, monospace' }}>${monto.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Descuentos</div>
                  <div style={{ fontWeight: 900, fontFamily: 'Courier New, monospace', color: '#991b1b' }}>-${Number(descuentos).toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Estado</div>
                  <div style={{ fontWeight: 900 }}>{estado}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Código</div>
                  <div style={{ fontWeight: 900, fontFamily: 'Courier New, monospace' }}>{acreditadoModalCodigo}</div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12, border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, background: '#fff' }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Tipo</div>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>ACREDITACION: {tarjeta}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Motivo</div>
              <div style={{ fontWeight: 700 }}>{motivo}</div>
            </div>
          </div>
        );
      })()}
    </div>
  </div>
)}

{showMotivoModal && (
  <div className="modal-overlay">
    <div className="modal-confirm">
      <h3>
        {motivoModalTipo === 'cupon' ? 'Motivo de rechazo (Cupón)' : 'Motivo de rechazo (Ajuste)'}
      </h3>
      <p>Escribí el motivo por el cual se rechaza.</p>
      <textarea
        placeholder="Motivo"
        value={motivoModalText}
        onChange={(e) => {
          setMotivoModalText(e.target.value);
          if (motivoModalError) setMotivoModalError('');
        }}
        rows={3}
      />
      {motivoModalError && <div className="error-message">{motivoModalError}</div>}
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={closeMotivoModal}>
          Cancelar
        </button>
        <button className="btn btn-danger" onClick={confirmMotivoModal}>
          Confirmar
        </button>
      </div>
    </div>
  </div>
)}

{showCuponTicketModal && (
  <div className="modal-overlay" onClick={closeCuponTicketModal}>
    <div
      className="modal-confirm"
      onClick={(e) => e.stopPropagation()}
      style={{ width: 'min(560px, calc(100vw - 32px))', padding: 0, overflow: 'hidden' }}
    >
      <div style={{ padding: 18, borderBottom: '1px dashed #cbd5e1', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Cupón Aprobado
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={closeCuponTicketModal}>
            Cerrar
          </button>
        </div>
      </div>

      <div style={{ padding: 18, background: '#fff' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Cliente (CUIT)</div>
            <div style={{ fontFamily: 'Courier New, monospace', fontWeight: 800 }}>{cuponTicketData?.cuit || '-'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Fecha</div>
            <div style={{ fontFamily: 'Courier New, monospace', fontWeight: 800 }}>
              {cuponTicketData?.created_at ? new Date(cuponTicketData.created_at).toLocaleString('es-AR') : '-'}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>Detalle</div>
          <div style={{ fontWeight: 700 }}>{cuponTicketData?.detalle_cupon || '-'}</div>
        </div>

        <div style={{ marginTop: 16, borderTop: '1px dashed #cbd5e1', paddingTop: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ color: '#64748b' }}>MONTO BRUT LIQ FISERV</div>
            <div style={{ textAlign: 'right', fontFamily: 'Courier New, monospace', fontWeight: 800 }}>
              ${Number(cuponTicketData?.montoBruto || 0).toFixed(2)}
            </div>

            <div style={{ color: '#64748b' }}>CONSILIACION BANCARIA</div>
            <div style={{ textAlign: 'right', fontFamily: 'Courier New, monospace', fontWeight: 800 }}>
              -${Number(cuponTicketData?.ajuste || 0).toFixed(2)}
            </div>

            <div style={{ color: '#64748b' }}>COMISION FLUX</div>
            <div style={{ textAlign: 'right', fontFamily: 'Courier New, monospace', fontWeight: 800 }}>
              -${Number(cuponTicketData?.comision || 0).toFixed(2)}
            </div>
          </div>

          <div style={{ marginTop: 12, borderTop: '1px solid #e2e8f0', paddingTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>NETO LIQUIDADO</div>
            <div style={{ fontFamily: 'Courier New, monospace', fontWeight: 900, fontSize: 18, color: '#166534' }}>
              ${Number(cuponTicketData?.neto || 0).toFixed(2)}
            </div>
          </div>

          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => {
                try {
                  window.print();
                } catch (e) {
                  console.error(e);
                }
              }}
            >
              Imprimir
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: 14, borderTop: '1px dashed #cbd5e1', background: '#f8fafc', textAlign: 'center', color: '#64748b', fontSize: 12 }}>
        Gracias por operar con nosotros
      </div>
    </div>
  </div>
)}

{/* PESTAÑA CALCULADORA */}
<TabPanel><br></br>
  <div style={{ maxWidth: 980 }}>
    <h2 style={{ marginTop: 0 }}>Calculadora de Ventas</h2>

    <div style={{
      marginBottom: 14,
      padding: 14,
      borderRadius: 12,
      border: '1px solid #e2e8f0',
      background: '#f8fafc'
    }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontWeight: 900 }}>ELEGIR PLAN</div>
        <select value={calcAddPlanSelected} onChange={(e) => setCalcAddPlanSelected(e.target.value)}>
          <option value="">Seleccionar plan...</option>
          {CALC_PLAN_TEMPLATES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            addCalcPlanCard(calcAddPlanSelected);
            setCalcAddPlanSelected('');
          }}
          disabled={!calcAddPlanSelected}
        >
          + Agregar Plan
        </button>
      </div>

      {calcPlanApplyMsg ? (
        <div style={{ marginBottom: 10, fontWeight: 800, color: '#166534' }}>{calcPlanApplyMsg}</div>
      ) : null}

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {(Array.isArray(calcPlanCards) ? calcPlanCards : []).map((p) => (
          <div
            key={String(p.id)}
            style={{
              width: 200,
              minHeight: 160,
              border: '1px solid #94a3b8',
              borderRadius: 8,
              background: '#fff',
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 8
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 900, lineHeight: 1.2, minHeight: 28 }}>
              {String(p.name || '')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
              <label style={{ fontSize: 11, color: '#475569' }}>
                Recargo (%):
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={String(p.ctf_pct ?? '')}
                  onChange={(e) => updateCalcPlanCard(p.id, { ctf_pct: e.target.value })}
                  style={{ width: '100%' }}
                />
              </label>
              <label style={{ fontSize: 11, color: '#475569' }}>
                pagos:
                <input
                  type="number"
                  min="1"
                  value={String(p.pagos ?? 1)}
                  onChange={(e) => updateCalcPlanCard(p.id, { pagos: Number(e.target.value) || 1 })}
                  style={{ width: '100%' }}
                />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => removeCalcPlanCard(p.id)}
                style={{ width: '100%', padding: '8px 10px', background: '#ef4444', borderColor: '#ef4444', color: '#fff' }}
              >
                Eliminar
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => applyCalcPlanCardToCalculator(p)}
                style={{ width: '100%', padding: '8px 10px', background: '#22c55e', borderColor: '#22c55e', color: '#fff' }}
              >
                Guardar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>

    {calcClienteCuit && (
      <div style={{ marginBottom: 10, color: '#475569', fontWeight: 700 }}>
        Cliente seleccionado: {(clientes || []).find(c => String(c.cuit) === String(calcClienteCuit))?.nombre || 'Cliente'} ({calcClienteCuit})
      </div>
    )}

  </div>
</TabPanel>

<TabPanel>
  <div className="registro-movimiento">
    <h2>Administrar clientes</h2>

    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Listado</h3>
        {cargandoClientes ? (
          <div className="loading-clients">Cargando clientes...</div>
        ) : clientes.length === 0 ? (
          <div className="no-clients">No se encontraron clientes registrados</div>
        ) : (
          <div style={{ maxHeight: 420, overflow: 'auto' }}>
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Razón Social</th>
                  <th>CUIT</th>
                  <th>CBU</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((cliente) => (
                  <tr key={cliente.id}>
                    <td>{cliente.razon_social || cliente.nombre || '-'}</td>
                    <td><code>{cliente.cuit}</code></td>
                    <td><code>{cliente.cbu_registro || '-'}</code></td>
                    <td style={{ display: 'flex', gap: 8 }}>
                      {/*<button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => startEditCliente(cliente)}
                      >
                        Editar
                      </button>*/}
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => eliminarCliente(cliente)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/*<div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Editar cliente</h3>
        {!editClienteId ? (
          <div style={{ color: '#64748b' }}>Selecciona un cliente para editar.</div>
        ) : (
          <form onSubmit={submitEditCliente} className="form-grid" style={{ marginTop: 12 }}>
            {editClienteError && <div className="error-message">{editClienteError}</div>}
            {editClienteSuccess && <div className="success-message">{editClienteSuccess}</div>}

            <div className="form-group">
              <label>Razón Social</label>
              <input
                name="razon_social"
                value={editClienteForm.razon_social}
                onChange={handleEditClienteChange}
                required
              />
            </div>

            <div className="form-group">
              <label>CUIT</label>
              <input
                name="cuit"
                value={editClienteForm.cuit}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  handleEditClienteChange({ target: { name: 'cuit', value } });
                }}
                maxLength={11}
                required
              />
            </div>

            <div className="form-group">
              <label>CBU Registro</label>
              <input
                name="cbu_registro"
                value={editClienteForm.cbu_registro}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  handleEditClienteChange({ target: { name: 'cbu_registro', value } });
                }}
                maxLength={22}
              />
            </div>

            <div className="form-group">
              <label>Alias</label>
              <input
                name="alias"
                value={editClienteForm.alias}
                onChange={handleEditClienteChange}
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={editClienteLoading}>
                {editClienteLoading ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditClienteId(null)}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>*/}
    </div>
  </div>
</TabPanel>

<TabPanel>
  <div className="registro-movimiento">
    <h2>Agregar Clientes</h2>

    {addClienteError && <div className="error-message">{addClienteError}</div>}
    {addClienteSuccess && <div className="success-message">{addClienteSuccess}</div>}

    <form onSubmit={submitAddCliente} className="form-grid" style={{ marginTop: 12 }}>
      <div className="form-group">
        <label>Nombre</label>
        <input
          name="nombre"
          value={addClienteForm.nombre}
          onChange={onAddClienteChange}
          placeholder="Nombre"
          required
        />
      </div>

      <div className="form-group">
        <label>Apellido</label>
        <input
          name="apellido"
          value={addClienteForm.apellido}
          onChange={onAddClienteChange}
          placeholder="Apellido"
          required
        />
      </div>

      <div className="form-group">
        <label>CUIT</label>
        <input
          name="cuit"
          value={addClienteForm.cuit}
          onChange={(e) => {
            const value = e.target.value.replace(/[^0-9]/g, '');
            onAddClienteChange({ target: { name: 'cuit', value } });
          }}
          placeholder="20304567891"
          maxLength={11}
          required
        />
      </div>

      <div className="form-group">
        <label>CBU</label>
        <input
          name="cbu"
          value={addClienteForm.cbu}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '');
            onAddClienteChange({ target: { name: 'cbu', value } });
          }}
          placeholder="0140123456789012345678"
          maxLength={22}
          required
        />
      </div>

      <div className="form-group">
        <label>Email</label>
        <input
          type="email"
          name="email"
          value={addClienteForm.email}
          onChange={onAddClienteChange}
          placeholder="cliente@email.com"
          required
        />
      </div>

      <div className="form-group">
        <label>Contraseña</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type={addClienteShowPassword ? 'text' : 'password'}
            name="password"
            value={addClienteForm.password}
            onChange={onAddClienteChange}
            placeholder="••••••••"
            required
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setAddClienteShowPassword((v) => !v)}
            aria-label={addClienteShowPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            <FiEye />
          </button>
        </div>
      </div>

      <div className="form-group">
        <label>Confirmar contraseña</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type={addClienteShowPassword2 ? 'text' : 'password'}
            name="password2"
            value={addClienteForm.password2}
            onChange={onAddClienteChange}
            placeholder="••••••••"
            required
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setAddClienteShowPassword2((v) => !v)}
            aria-label={addClienteShowPassword2 ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            <FiEye />
          </button>
        </div>
      </div>

      <div className="form-actions" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={addClienteLoading || !Object.values(addClientePasswordValidations).every(Boolean)}
        >
          {addClienteLoading ? 'Creando...' : 'Crear cliente'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setAddClienteError('');
            setAddClienteSuccess('');
            setAddClienteForm({ nombre: '', apellido: '', cuit: '', email: '', cbu: '', password: '', password2: '' });
          }}
          disabled={addClienteLoading}
        >
          Limpiar
        </button>
      </div>
    </form>
  </div>
</TabPanel>

<TabPanel>
  <div className="transactions-container">
    <div className="table-header">
      <h2>Estadísticas</h2>
      <div className="table-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={fetchLiquidacionDiariaTotal}
          disabled={liquidacionDiariaLoading}
        >
          <FiRefreshCw /> {liquidacionDiariaLoading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>
    </div>

    <div className="stat-card" style={{ padding: 20, marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ marginTop: 0 }}>Distribución de liquidación diaria por cliente</h3>
        </div>
        <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--text-primary)' }}>
          {liquidacionDiariaLoading ? 'Cargando...' : formatMoneda(liquidacionDiariaTotal)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 320px) 1fr', gap: 24, marginTop: 18, alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 280, height: 280 }}>
          <svg viewBox="0 0 200 200" width="100%" height="100%">
            {pieSlices.length === 0 ? (
              <circle cx="100" cy="100" r="80" fill="rgba(16, 185, 129, 0.12)" />
            ) : (
              pieSlices.map((slice) => (
                <path
                  key={`${slice.label}-${slice.startAngle}`}
                  d={describeArc(100, 100, 80, slice.startAngle, slice.endAngle)}
                  fill={slice.color}
                />
              ))
            )}
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total</span>
            <strong style={{ fontSize: 18, color: 'var(--text-primary)' }}>
              {liquidacionDiariaLoading ? '...' : formatMoneda(liquidacionDiariaTotal)}
            </strong>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <p style={{ marginTop: 6, color: 'var(--text-secondary)' }}>
            Porcentaje del total diario que representa cada cliente.
          </p>
          {pieSlices.length === 0 ? (
            <span style={{ color: 'var(--text-secondary)' }}>No hay liquidaciones del día.</span>
          ) : (
            pieSlices.map((slice) => {
              const percent = totalClientes > 0 ? (slice.value / totalClientes) * 100 : 0;
              return (
                <div key={slice.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 4, background: slice.color }} />
                    <span style={{ fontWeight: 600 }}>{slice.label}</span>
                  </div>
                  <span style={{ fontWeight: 600 }}>{percent.toFixed(1)}%</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>

    {liquidacionDiariaError && (
      <div className="error-message" style={{ marginTop: 16 }}>{liquidacionDiariaError}</div>
    )}
  </div>
</TabPanel>

          </div>
        </div>

</Tabs>
{showDeleteModal && (
  <div className="modal-overlay">
    <div className="modal-confirm">
      <h3>Confirmar eliminación</h3>
      <p>¿Estás seguro que deseas eliminar el registro <strong>#{toDeleteMovement?.id}</strong>?</p>
      <textarea
        placeholder="Motivo (opcional)"
        value={deleteMotivo}
        onChange={(e) => setDeleteMotivo(e.target.value)}
        rows={3}
      />
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={closeDeleteModal} disabled={deleting}>Cancelar</button>
        <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Eliminando...' : 'Eliminar'}</button>
      </div>
    </div>
  </div>
)}
</div>
  );
}

// Componente para gestión de terminales de una sucursal
function TerminalesAdmin({ clienteId }) {
  const [sucursales, setSucursales] = useState([]);
  const storageKey = `admin_terminales_sucursal_${clienteId || 'unknown'}`;
  const [sucursalId, setSucursalId] = useState(() => sessionStorage.getItem(storageKey) || '');
  const [terminales, setTerminales] = useState([]);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const addTerminalNameRef = useRef(null);
  const addTerminalFormRef = useRef(null);

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);

  const handleConfigAction = async (action) => {
    try {
      setConfigLoading(true);
      console.warn('[CONFIG] Acción solicitada (UI):', action);
      alert('Función de configuración aún no implementada en backend. Acción: ' + action);
    } finally {
      setConfigLoading(false);
      setShowConfigModal(false);
    }
  };

  // Cargar sucursales del cliente
  const fetchSucursales = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/clientes/${clienteId}/sucursales`);
      setSucursales(res.data.data || []);
    } catch (err) {
      setError('Error al cargar sucursales');
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  // Cargar terminales de la sucursal seleccionada
  const fetchTerminales = useCallback(async () => {
    if (!sucursalId) {
      setTerminales([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/clientes/sucursal/${sucursalId}/terminales`);
      setTerminales(res.data.data || []);
    } catch (err) {
      setError('Error al cargar terminales');
    } finally {
      setLoading(false);
    }
  }, [sucursalId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      setError('');
      setSuccess('');
      await fetchSucursales();
      await fetchTerminales();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSucursales();
  }, [fetchSucursales]);

  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey) || '';
    setSucursalId(saved);
    setTerminales([]);
    setNombre('');
    setTipo('');
    setError('');
    setSuccess('');
  }, [storageKey]);

  useEffect(() => {
    fetchTerminales();
  }, [fetchTerminales]);


  const moverTerminal = async (terminalId, nuevaSucursalId) => {
    if (!nuevaSucursalId) return;
    if (!window.confirm('¿Mover terminal a otra sucursal?')) return;
    setError('');
    setSuccess('');
    try {
      const res = await api.put(`/clientes/admin/terminales/${terminalId}/mover-sucursal`, {
        sucursal_id: Number(nuevaSucursalId),
      });
      if (res.data.ok) {
        setSuccess('Terminal movida');
        fetchTerminales();
        fetchSucursales();
      } else {
        setError(res.data.msg || 'Error al mover terminal');
      }
    } catch (e) {
      setError('Error al mover terminal');
    }
  };

  useEffect(() => {
    if (sucursalId) {
      sessionStorage.setItem(storageKey, String(sucursalId));
    } else {
      sessionStorage.removeItem(storageKey);
    }
  }, [sucursalId, storageKey]);

  useEffect(() => {
    if (!sucursalId) return;
    const exists = (sucursales || []).some((s) => String(s?.id) === String(sucursalId));
    if (!exists) {
      setSucursalId('');
      setTerminales([]);
    }
  }, [sucursalId, sucursales]);

  const handleAddTerminal = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!sucursalId || !nombre) {
      setError('Selecciona sucursal y completa nombre');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post(`/clientes/sucursal/${sucursalId}/terminales`, { nombre, tipo });
      if (res.data.ok) {
        setSuccess('Terminal agregada correctamente');
        setNombre('');
        setTipo('');
        fetchTerminales();
      } else {
        setError(res.data.msg || 'Error al agregar terminal');
      }
    } catch (err) {
      setError('Error al agregar terminal');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTerminal = async (id) => {
    if (!window.confirm('¿Eliminar terminal?')) return;
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await api.delete(`/clientes/sucursal/${sucursalId}/terminales/${id}`);
      if (res.data.ok) {
        setSuccess('Terminal eliminada correctamente');
        fetchTerminales();
      } else {
        setError(res.data.msg || 'Error al eliminar terminal');
      }
    } catch (err) {
      setError('Error al eliminar terminal');
    } finally {
      setLoading(false);
    }
  };

  const [minimizado, setMinimizado] = useState(false);
  const contentRef = useRef(null);
  const [height, setHeight] = useState('auto');
  useEffect(() => {
    if (!minimizado && contentRef.current) {
      setHeight(contentRef.current.scrollHeight + 'px');
    } else {
      setHeight('0px');
    }
  }, [minimizado, nombre, tipo, sucursalId, terminales, error, success, loading]);

  const terminalesOrdenadas = useMemo(() => {
    const base = Array.isArray(terminales) ? terminales : [];
    return [...base].sort((a, b) => {
      const an = String(a?.nombre || '').toLowerCase();
      const bn = String(b?.nombre || '').toLowerCase();
      if (an < bn) return -1;
      if (an > bn) return 1;
      const aid = Number(a?.id || 0);
      const bid = Number(b?.id || 0);
      return aid - bid;
    });
  }, [terminales]);

  return (
    <div className="terminales-admin-form" style={{ background: '#fff', borderRadius: 8, border: '1px solid #000', boxShadow: '0 2px 8px #0001', padding: 24, marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: '#2a2a2a' }}>Gestión de terminales</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            style={{
              transform: refreshing ? 'scale(0.98)' : 'none',
              opacity: refreshing ? 0.85 : 1,
              transition: 'transform 120ms ease, opacity 120ms ease',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  display: 'inline-flex',
                  transform: refreshing ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 300ms ease',
                }}
              >
                <FiRefreshCw />
              </span>
              {refreshing ? 'Actualizando...' : 'Actualizar'}
            </span>
          </button>
          <button
            type="button"
            aria-label={minimizado ? 'Expandir' : 'Minimizar'}
            onClick={() => setMinimizado(m => !m)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, fontSize: 18, transition: 'transform 0.3s', transform: minimizado ? 'rotate(-90deg)' : 'rotate(0deg)' }}
          >
            <span style={{ display: 'inline-block', transition: 'transform 0.3s' }}>▼</span>
          </button>
        </div>
      </div>
      <div
        ref={contentRef}
        style={{
          overflow: 'hidden',
          transition: 'height 0.5s cubic-bezier(.4,0,.2,1), opacity 0.5s cubic-bezier(.4,0,.2,1)',
          height: height,
          opacity: minimizado ? 0 : 1
        }}
      >
        <form ref={addTerminalFormRef} onSubmit={handleAddTerminal} className="form-grid" style={{ marginBottom: '1.5rem', gap: 16 }}>
          <div className="form-group">
            <label>Sucursal</label>
            <select value={sucursalId} onChange={e => setSucursalId(e.target.value)} required>
              <option value="">Seleccionar sucursal...</option>
              {sucursales.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Nombre de terminal</label>
            <input ref={addTerminalNameRef} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre" />
          </div>
          <div className="form-group">
            <label>Tipo</label>
            <input value={tipo} onChange={e => setTipo(e.target.value)} placeholder="Tipo (opcional)" />
          </div>
          <div className="form-actions" style={{ alignSelf: 'end' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>Agregar terminal</button>
          </div>
        </form>
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        <div style={{ borderTop: '1px solid #eee', margin: '24px 0 16px 0' }} />
        <h4 style={{ margin: 0, color: '#444' }}>Listado de terminales</h4>
        {loading ? <div>Cargando...</div> : (
          <table
            className="transactions-table"
            style={{
              marginTop: 8,
              width: '100%',
              tableLayout: 'fixed',
            }}
          >
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '10px 12px', width: '34%' }}>Nombre</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', width: '22%' }}>Tipo</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', width: '34%' }}>Mover a sucursal</th>
                <th style={{ textAlign: 'center', padding: '10px 12px', width: '10%' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {terminalesOrdenadas.length > 0 ? terminalesOrdenadas.map(term => (
                <tr key={term.id}>
                  <td style={{ padding: '10px 12px', verticalAlign: 'middle', wordBreak: 'break-word' }}>{term.nombre}</td>
                  <td style={{ padding: '10px 12px', verticalAlign: 'middle', wordBreak: 'break-word' }}>{term.tipo || '-'}</td>
                  <td>
                    <select
                      value={String(term?.sucursal_id || sucursalId || '')}
                      onChange={(e) => moverTerminal(term.id, e.target.value)}
                      style={{ width: '100%', maxWidth: 260 }}
                    >
                      <option value="">Seleccionar...</option>
                      {(sucursales || []).map((s) => (
                        <option key={s.id} value={String(s.id)}>
                          {s.nombre}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '10px 12px', verticalAlign: 'middle', textAlign: 'center' }}>
                    <button className="btn-icon danger" title="Eliminar" onClick={() => handleDeleteTerminal(term.id)} style={{ margin: '0 auto' }}>
                      <FiTrash />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="4">No hay terminales registradas</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      
    </div>
  );
}