import { useEffect, useRef, useState } from 'react';
import { FiBell, FiX, FiCheck, FiAlertCircle, FiInfo, FiCheckCircle } from 'react-icons/fi';
import api from '../api/axiosClient';
import './Notificaciones.css';

export default function Notificaciones({ cuit, embedded = false }) {
  const [notificaciones, setNotificaciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const fetchingRef = useRef(false);

  // Obtener notificaciones
  const fetchNotificaciones = async () => {
    if (!cuit) return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const response = await api.get(`/notificaciones/${cuit}`);
      if (response.data.ok && response.data.data) {
        setNotificaciones(response.data.data);
        // Contar como no leídas
        const count = response.data.data.filter(n => !n.leida).length;
        setUnreadCount(count);
      }
    } catch (error) {
      // Error fetching notifications
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  // Marcar como leída
  const marcarComoLeida = async (id, e) => {
    e.stopPropagation();
    try {
      await api.post(`/notificaciones/${id}/marcar-leida`);
      fetchNotificaciones(); // Actualizar lista
    } catch (error) {
      // Error marking notification as read
    }
  };

  // Eliminar notificación
  const eliminarNotificacion = async (id, e) => {
    e.stopPropagation();
    try {
      await api.delete(`/notificaciones/${id}`);
      fetchNotificaciones(); 
    } catch (error) {
      // Error deleting notification
    }
  };

  // Obtener icono según tipo
  const getIconoNotificacion = (tipo) => {
    const iconProps = { size: 20, className: 'notif-icono' };
    switch (tipo) {
      case 'CUPON_APROBADO':
      case 'AJUSTE_APROBADO':
      case 'RETIRO_APROBADO':
        return <FiCheckCircle {...iconProps} style={{ color: '#4CAF50' }} />;
      case 'CUPON_RECHAZADO':
      case 'AJUSTE_RECHAZADO':
      case 'RETIRO_RECHAZADO':
        return <FiAlertCircle {...iconProps} style={{ color: '#F44336' }} />;
      default:
        return <FiInfo {...iconProps} style={{ color: '#2196F3' }} />;
    }
  };

  // Obtener título según tipo
  const getTituloNotificacion = (tipo) => {
    const titulos = {
      'CUPON_APROBADO': 'Cupón Aprobado',
      'CUPON_RECHAZADO': 'Cupón Rechazado',
      'AJUSTE_APROBADO': 'Ajuste Aprobado',
      'AJUSTE_RECHAZADO': 'Ajuste Rechazado',
      'RETIRO_APROBADO': 'Retiro Aprobado',
      'RETIRO_RECHAZADO': 'Retiro Rechazado',
      //'RETIRO_PAGADO': 'Retiro Pagado',
    };
    return titulos[tipo] || tipo;
  };

  // Obtener clase de color
  const getColorClase = (tipo) => {
    if (tipo.includes('APROBADO') || tipo.includes('PAGADO')) return 'success';
    if (tipo.includes('RECHAZADO')) return 'danger';
    return 'info';
  };

  // Cargar notificaciones al montar
  useEffect(() => {
    if (cuit) {
      fetchNotificaciones();
      // Auto-refresh cada 30 segundos
      const interval = setInterval(fetchNotificaciones, 30000);
      return () => clearInterval(interval);
    }
  }, [cuit]);

  if (!cuit) return null;

  const content = (
    <>
      <div className="notif-content">
        {loading ? (
          <div className="loading-notif">
            <div className="spinner"></div>
            <p>Cargando...</p>
          </div>
        ) : notificaciones.length === 0 ? (
          <div className="no-notificaciones">
            <FiBell size={40} />
            <p>No tienes notificaciones</p>
          </div>
        ) : (
          <div className="notif-list">
            {notificaciones.map((notif) => (
              (() => {
                const tipoDisplay = notif.tipo === 'RETIRO_PAGADO' ? 'RETIRO_APROBADO' : notif.tipo;
                return (
                  <div
                    key={notif.id}
                    className={`notif-item ${getColorClase(tipoDisplay)} ${
                      !notif.leida ? 'no-leida' : ''
                    }`}
                  >
                    <div className="notif-icon-wrapper">
                      {getIconoNotificacion(tipoDisplay)}
                    </div>

                    <div className="notif-contenido">
                      <div className="notif-header-item">
                        <h4>{getTituloNotificacion(tipoDisplay)}</h4>
                        {!notif.leida && <span className="badge-new">Nuevo</span>}
                      </div>
                      <p className="notif-mensaje">{notif.mensaje}</p>
                      {notif.detalles && (
                        <p className="notif-detalles">{notif.detalles}</p>
                      )}
                      <div className="notif-footer">
                        <small>
                          <span>{notif.cuit}</span>
                          {' • '}
                          {new Date(notif.created_at).toLocaleDateString('es-AR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </small>
                        <div className="notif-acciones">
                          <button
                            className="btn-eliminar"
                            onClick={(e) => eliminarNotificacion(notif.id, e)}
                            title="Eliminar"
                          >
                            <FiX size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            ))}
          </div>
        )}
      </div>

      {notificaciones.length > 0 && (
        <div className="notif-footer-panel">
          <button
            className="btn-limpiar-todas"
            onClick={() => {
              notificaciones.forEach((n) => eliminarNotificacion(n.id, { stopPropagation: () => {} }));
            }}
          >
            Limpiar todas
          </button>
        </div>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="notificaciones-embedded">
        {content}
      </div>
    );
  }

  return (
    <div className="notificaciones-container">
      <button
        className="btn-notificaciones"
        onClick={() => setShowPanel(!showPanel)}
        title="Notificaciones"
      >
        <FiBell size={24} />
        {unreadCount > 0 && (
          <span className="notif-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showPanel && (
        <div className="notificaciones-panel">
          <div className="notif-header">
            <h3>Notificaciones</h3>
            <button
              className="btn-close"
              onClick={() => setShowPanel(false)}
            >
              <FiX size={20} />
            </button>
          </div>
          {content}
        </div>
      )}
    </div>
  );
}
