import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import './Home.css';
import fluxAdminLogo from '/Logotipo.jpeg';
import BallAnimation from '../../components/BallAnimation.jsx';

const Home = () => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const mensaje = '¡Hola! Quiero mas información sobre sus servicios.';
  const mensajeCodificado = encodeURIComponent(mensaje);
  const numero = 5491126652486;
  const whatsappLink = `https://wa.me/${numero}?text=${mensajeCodificado}`;

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) setShowMobileMenu(false);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const closeMobileMenu = () => setShowMobileMenu(false);

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <BallAnimation />
      <div className="home-container">
        <header className="home-header">
          <div className="home-brand">
            <img
              src={fluxAdminLogo}
              alt="Logo"
              className="home-brand-logo"
            />
          </div>

          <nav className="home-nav">
            <a className="home-nav-link" href="#inicio">Inicio</a>
            <a className="home-nav-link" href="#servicios">Servicios</a>
            <Link className="home-nav-link" to="/login">Iniciar sesión</Link>
            <Link className="home-nav-link" to="/register">Registrarse</Link>
            <a className="home-nav-link" href={whatsappLink} target="_blank" rel="noopener noreferrer">Contacto</a>
          </nav>

          <button
            type="button"
            className="home-menu-btn"
            aria-label="Abrir menú"
            aria-expanded={showMobileMenu}
            onClick={() => setShowMobileMenu((v) => !v)}
          >
            <span className="home-menu-btn-line" />
            <span className="home-menu-btn-line" />
            <span className="home-menu-btn-line" />
          </button>
        </header>

        {showMobileMenu && (
          <>
            <button
              type="button"
              className="home-mobile-backdrop"
              aria-label="Cerrar menú"
              onClick={closeMobileMenu}
            />
            <div className="home-mobile-menu" role="menu">
              <Link className="home-mobile-link" to="/login" onClick={closeMobileMenu} role="menuitem">
                Iniciar sesión
              </Link>
              <Link className="home-mobile-link" to="/register" onClick={closeMobileMenu} role="menuitem">
                Registrarse
              </Link>
              <a className="home-mobile-link" href="#servicios" onClick={closeMobileMenu} role="menuitem">
                Servicios
              </a>
              <a className="home-mobile-link" href="/quienes-somos.html" onClick={closeMobileMenu} role="menuitem">
                Quienes somos
              </a>
              <a
                className="home-mobile-link"
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeMobileMenu}
                role="menuitem"
              >
                Contacto
              </a>
            </div>
          </>
        )}

        <main className="home-main" id="inicio">
          <section className="home-hero">
            <div className="home-hero-grid">
              <div className="home-hero-left">
                <h1 className="home-hero-title">
                  Tu negocio listo para despegar
                  <br />
                  <span>Probá nuestra plataforma para crecer sin límites</span>
                </h1>
              </div>

              <div className="home-hero-center">
                <div className="home-hero-device-shadow" />
                <img
                  className="home-hero-device"
                  src="/posne.png"
                  alt="POS"
                />
              </div>

              <div className="home-hero-right">
                <p className="home-hero-right-text">
                  Somos la plataforma que te permite aceptar todos los medios de pago.
                  Sabemos el empeño que le ponés detrás de cada venta.
                  Por eso estamos con vos.
                </p>
                <Link to="/register" className="home-cta">
                  Quiero ser cliente
                </Link>
              </div>
            </div>
          </section>

          <section className="home-services" id="servicios">
            <div className="home-services-grid">
              <article className="home-service">
                <div className="home-service-icon">⚙️</div>
                <h3 className="home-service-title">Nuestros servicios</h3>
                <p className="home-service-text">
                  Con nosotros podés cobrar mediante nuestro QRpro, terminal virtual o cualquiera
                  de las tecnologías POS que ofrecemos. Además vas a visualizar diaramente tus cupones,
                   descuentos, resúmenes y acreditaciónes de dinero en tu cuenta favorita.
                </p>
                <a className="home-service-btn" href="/servicios.html">Que ofrecemos</a>
              </article>

              <article className="home-service">
                <div className="home-service-icon">👥</div>
                <h3 className="home-service-title">Compromiso con el cliente</h3>
                <p className="home-service-text">
                  Contamos con un equipo de profesionales altamente capacitados
                  para acompañarte en todo el proceso.
                </p>
                <a
                  className="home-service-btn"
                  href="/soporte.html"
                  onClick={closeMobileMenu}
                >
                  Asesoramiento
                </a>
              </article>
              <article className="home-service">
                <div className="home-service-icon">🧩</div>
                <h3 className="home-service-title">¿Emprendés?</h3>
                <span className="home-service-title">Usá FLUXPOS para crecer sin límites</span>
                <p className="home-service-text">
                  La terminal virtual diseñada para que pequeños emprendedores y feriantes,
                  puedan gestionar sus cobros y aumentar sus ventas. Recibí todas las tarjetas
                  y billeteras virtuales
                </p>
                <a className="home-service-btn" href="/quienes-somos.html">Quienes somos</a>
              </article>
            </div>
          </section>
        </main>

        <footer className="home-footer">
          <div className="footer-content">
            <img src={fluxAdminLogo} alt="Flux" className="home-brand-logo" style={{height:'36px',marginRight:'10px',verticalAlign:'middle'}} />
            <a href="/acerca-de.html" style={{color:'#000000'}}>Acerca de</a>
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" style={{color:'#000000'}}>Contacto</a>
            <a href="/politicas-privacidad.html" style={{color:'#000000'}}>Privacidad</a>
          </div>
          <div className="footer-copyright" style={{color:'#000000',textAlign:'right',marginTop:'8px',fontSize:'0.98rem'}}>
            © 2026 Flux Admin. Todos los derechos reservados.
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Home;
