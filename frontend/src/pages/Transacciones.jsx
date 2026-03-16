import { useState, useEffect } from 'react';
import { 
  FaFilter, 
  FaSearch, 
  FaDownload, 
  FaArrowUp, 
  FaArrowDown, 
  FaInfoCircle,
  FaArrowLeft
} from 'react-icons/fa';
import { Link } from 'react-router-dom';
import api from '../api/axiosClient';
import '../styles/Transacciones.css';

export default function Transacciones() {
  const [transacciones, setTransacciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    tipo: 'todos',
    fechaDesde: '',
    fechaHasta: '',
    estado: 'todos',
    busqueda: ''
  });
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [transaccionSeleccionada, setTransaccionSeleccionada] = useState(null);

  useEffect(() => {
    cargarTransacciones();
  }, [filtros]);

  const cargarTransacciones = async () => {
    try {
      setLoading(true);
      // Simulando datos de ejemplo - Reemplazar con llamada real a la API
      const datosEjemplo = [
        {
          id: 1,
          fecha: '2023-11-15T10:30:00',
          tipo: 'acreditacion',
          descripcion: 'Pago con tarjeta',
          monto: 12500.50,
          estado: 'completado',
          referencia: 'TARJ-789456',
          detalles: {
            montoBruto: 13000,
            arancel: 450.50,
            comision: 49.00,
            neto: 12500.50
          }
        },
        {
          id: 2,
          fecha: '2023-11-14T14:22:10',
          tipo: 'ajuste',
          descripcion: 'Ajuste por diferencia',
          monto: -120.00,
          estado: 'completado',
          referencia: 'AJ-20231114-001',
          detalles: {
            motivo: 'Diferencia de cierre',
            usuario: 'admin@ejemplo.com'
          }
        },
        {
          id: 3,
          fecha: '2023-11-13T09:15:30',
          tipo: 'retiro',
          descripcion: 'Retiro de fondos',
          monto: -5000.00,
          estado: 'pendiente',
          referencia: 'RET-20231113-001',
          detalles: {
            cbu: '*************4567',
            banco: 'Banco Ejemplo',
            solicitadoEl: '2023-11-13T09:10:00'
          }
        }
      ];
      
      // Aplicar filtros a los datos de ejemplo
      let datosFiltrados = [...datosEjemplo];
      
      if (filtros.tipo !== 'todos') {
        datosFiltrados = datosFiltrados.filter(t => t.tipo === filtros.tipo);
      }
      
      if (filtros.estado !== 'todos') {
        datosFiltrados = datosFiltrados.filter(t => t.estado === filtros.estado);
      }
      
      if (filtros.busqueda) {
        const busqueda = filtros.busqueda.toLowerCase();
        datosFiltrados = datosFiltrados.filter(t => 
          t.descripcion.toLowerCase().includes(busqueda) ||
          t.referencia.toLowerCase().includes(busqueda)
        );
      }
      
      setTransacciones(datosFiltrados);
      
      // Descomentar cuando la API esté lista
      // const { data } = await api.get('/transacciones', { params: filtros });
      // setTransacciones(data);
      
    } catch (error) {
      console.error('Error al cargar transacciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltros(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const formatearFecha = (fechaISO) => {
    const opciones = { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(fechaISO).toLocaleDateString('es-AR', opciones);
  };

  const formatearMoneda = (monto) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(monto);
  };

  const getClaseTipo = (tipo) => {
    switch(tipo) {
      case 'acreditacion': return 'tipo-acreditacion';
      case 'ajuste': return 'tipo-ajuste';
      case 'retiro': return 'tipo-retiro';
      default: return '';
    }
  };

  const getIconoTipo = (tipo) => {
    switch(tipo) {
      case 'acreditacion': return <FaArrowDown className="icono-tipo acreditacion" />;
      case 'ajuste': return <FaInfoCircle className="icono-tipo ajuste" />;
      case 'retiro': return <FaArrowUp className="icono-tipo retiro" />;
      default: return null;
    }
  };

  const verDetalle = (transaccion) => {
    setTransaccionSeleccionada(transaccion);
  };

  const cerrarDetalle = () => {
    setTransaccionSeleccionada(null);
  };

  if (loading) {
    return (
      <div className="cargando">
        <div className="spinner"></div>
        <p>Cargando transacciones...</p>
      </div>
    );
  }

  return (
    <div className="contenedor-transacciones">
      <div className="encabezado">
        <Link to="/wallet" className="btn-volver">
          <FaArrowLeft /> Volver al Wallet
        </Link>
        <h1>Historial de Transacciones</h1>
      </div>

      <div className="filtros">
        <div className="busqueda">
          <FaSearch className="icono-busqueda" />
          <input
            type="text"
            name="busqueda"
            placeholder="Buscar por descripción o referencia..."
            value={filtros.busqueda}
            onChange={handleFiltroChange}
          />
        </div>

        <button 
          className="btn-filtros"
          onClick={() => setMostrarFiltros(!mostrarFiltros)}
        >
          <FaFilter /> Filtros
        </button>

        {mostrarFiltros && (
          <div className="panel-filtros">
            <div className="filtro-grupo">
              <label>Tipo de transacción:</label>
              <select 
                name="tipo" 
                value={filtros.tipo}
                onChange={handleFiltroChange}
              >
                <option value="todos">Todos los tipos</option>
                <option value="acreditacion">Acreditaciones</option>
                <option value="ajuste">Ajustes</option>
                <option value="retiro">Retiros</option>
              </select>
            </div>

            <div className="filtro-grupo">
              <label>Estado:</label>
              <select 
                name="estado" 
                value={filtros.estado}
                onChange={handleFiltroChange}
              >
                <option value="todos">Todos los estados</option>
                <option value="pendiente">Pendientes</option>
                <option value="completado">Completados</option>
                <option value="rechazado">Rechazados</option>
              </select>
            </div>

            <div className="filtro-grupo">
              <label>Desde:</label>
              <input 
                type="date" 
                name="fechaDesde"
                value={filtros.fechaDesde}
                onChange={handleFiltroChange}
              />
            </div>

            <div className="filtro-grupo">
              <label>Hasta:</label>
              <input 
                type="date" 
                name="fechaHasta"
                value={filtros.fechaHasta}
                onChange={handleFiltroChange}
              />
            </div>
          </div>
        )}
      </div>

      <div className="acciones">
        <button className="btn-descargar">
          <FaDownload /> Exportar a Excel
        </button>
      </div>

      <div className="lista-transacciones">
        {transacciones.length === 0 ? (
          <div className="sin-resultados">
            No se encontraron transacciones con los filtros seleccionados.
          </div>
        ) : (
          <table className="tabla-transacciones">
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Descripción</th>
                <th>Referencia</th>
                <th>Estado</th>
                <th className="text-right">Monto</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {transacciones.map((transaccion) => (
                <tr key={transaccion.id} className={getClaseTipo(transaccion.tipo)}>
                  <td>{formatearFecha(transaccion.fecha)}</td>
                  <td>
                    {getIconoTipo(transaccion.tipo)}
                    {transaccion.descripcion}
                  </td>
                  <td>{transaccion.referencia}</td>
                  <td>
                    <span className={`estado ${transaccion.estado}`}>
                      {transaccion.estado.charAt(0).toUpperCase() + transaccion.estado.slice(1)}
                    </span>
                  </td>
                  <td className={`monto ${transaccion.monto < 0 ? 'negativo' : 'positivo'}`}>
                    {formatearMoneda(transaccion.monto)}
                  </td>
                  <td>
                    <button 
                      className="btn-detalle"
                      onClick={() => verDetalle(transaccion)}
                    >
                      Ver Detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {transaccionSeleccionada && (
        <div className="modal-detalle">
          <div className="modal-contenido">
            <div className="modal-encabezado">
              <h2>Detalle de Transacción</h2>
              <button className="btn-cerrar" onClick={cerrarDetalle}>&times;</button>
            </div>
            
            <div className="detalle-cuerpo">
              <div className="detalle-grupo">
                <h3>Información General</h3>
                <div className="detalle-fila">
                  <span className="detalle-etiqueta">Fecha:</span>
                  <span className="detalle-valor">
                    {formatearFecha(transaccionSeleccionada.fecha)}
                  </span>
                </div>
                <div className="detalle-fila">
                  <span className="detalle-etiqueta">Tipo:</span>
                  <span className="detalle-valor">
                    {transaccionSeleccionada.tipo.charAt(0).toUpperCase() + 
                     transaccionSeleccionada.tipo.slice(1)}
                  </span>
                </div>
                <div className="detalle-fila">
                  <span className="detalle-etiqueta">Descripción:</span>
                  <span className="detalle-valor">
                    {transaccionSeleccionada.descripcion}
                  </span>
                </div>
                <div className="detalle-fila">
                  <span className="detalle-etiqueta">Referencia:</span>
                  <span className="detalle-valor">
                    {transaccionSeleccionada.referencia}
                  </span>
                </div>
                <div className="detalle-fila">
                  <span className="detalle-etiqueta">Estado:</span>
                  <span className={`detalle-valor estado ${transaccionSeleccionada.estado}`}>
                    {transaccionSeleccionada.estado.charAt(0).toUpperCase() + 
                     transaccionSeleccionada.estado.slice(1)}
                  </span>
                </div>
              </div>

              <div className="detalle-grupo">
                <h3>Detalles Financieros</h3>
                {transaccionSeleccionada.tipo === 'acreditacion' && (
                  <>
                    <div className="detalle-fila">
                      <span className="detalle-etiqueta">Monto Bruto:</span>
                      <span className="detalle-valor">
                        {formatearMoneda(transaccionSeleccionada.detalles.montoBruto)}
                      </span>
                    </div>
                    <div className="detalle-fila">
                      <span className="detalle-etiqueta">Arancel:</span>
                      <span className="detalle-valor negativo">
                        -{formatearMoneda(transaccionSeleccionada.detalles.arancel)}
                      </span>
                    </div>
                    <div className="detalle-fila">
                      <span className="detalle-etiqueta">Comisión:</span>
                      <span className="detalle-valor negativo">
                        -{formatearMoneda(transaccionSeleccionada.detalles.comision)}
                      </span>
                    </div>
                    <div className="detalle-fila total">
                      <span className="detalle-etiqueta">Neto Acreditado:</span>
                      <span className="detalle-valor positivo">
                        {formatearMoneda(transaccionSeleccionada.detalles.neto)}
                      </span>
                    </div>
                  </>
                )}

                {transaccionSeleccionada.tipo === 'retiro' && (
                  <>
                    <div className="detalle-fila">
                      <span className="detalle-etiqueta">Monto Solicitado:</span>
                      <span className="detalle-valor">
                        {formatearMoneda(Math.abs(transaccionSeleccionada.monto))}
                      </span>
                    </div>
                    <div className="detalle-fila">
                      <span className="detalle-etiqueta">CBU Destino:</span>
                      <span className="detalle-valor">
                        {transaccionSeleccionada.detalles.cbu}
                      </span>
                    </div>
                    <div className="detalle-fila">
                      <span className="detalle-etiqueta">Banco:</span>
                      <span className="detalle-valor">
                        {transaccionSeleccionada.detalles.banco}
                      </span>
                    </div>
                    <div className="detalle-fila">
                      <span className="detalle-etiqueta">Solicitado el:</span>
                      <span className="detalle-valor">
                        {formatearFecha(transaccionSeleccionada.detalles.solicitadoEl)}
                      </span>
                    </div>
                  </>
                )}

                {transaccionSeleccionada.tipo === 'ajuste' && (
                  <>
                    <div className="detalle-fila">
                      <span className="detalle-etiqueta">Motivo:</span>
                      <span className="detalle-valor">
                        {transaccionSeleccionada.detalles.motivo}
                      </span>
                    </div>
                    <div className="detalle-fila">
                      <span className="detalle-etiqueta">Realizado por:</span>
                      <span className="detalle-valor">
                        {transaccionSeleccionada.detalles.usuario}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="modal-pie">
              <button className="btn-cerrar-modal" onClick={cerrarDetalle}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
