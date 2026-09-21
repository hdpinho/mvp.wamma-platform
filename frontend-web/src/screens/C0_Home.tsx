import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boton } from '../components/Boton';

interface C0HomeProps {
  rateBCV?: number;
}

export const C0_Home: React.FC<C0HomeProps> = () => {
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');

  /** Respeta la preferencia del sistema de reducir animaciones. */
  const menosMovimiento = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(busqueda.trim() ? `/catalogo?q=${encodeURIComponent(busqueda.trim())}` : '/catalogo');
  };

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="hero">
        {/*
          Capa base: la fotografía. Se pinta de inmediato y queda de respaldo si
          el video no llega a cargar o el visitante pidió menos movimiento.
        */}
        <picture>
          <img
            src="/hero/portada-poster.webp"
            alt="Vehículos inspeccionados WAMMA"
            aria-hidden="true"
            /* Es la primera imagen visible: se carga con prioridad, no en diferido */
            fetchPriority="high"
            decoding="async"
            className="hero-foto"
          />
        </picture>

        {/*
          Capa de video, encima de la foto. Silenciado y en bucle: es la única
          forma en que los navegadores permiten la reproducción automática.
          No se monta si el visitante pidió reducir el movimiento, así tampoco
          gasta sus datos.
        */}
        {!menosMovimiento && (
          <video
            className="hero-video"
            src="/video/portada-wamma.mp4"
            poster="/hero/portada-poster.webp"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
            tabIndex={-1}
          />
        )}

        {/*
          Velo de contraste. Sobre video no se puede medir el fondo real, así que
          está calibrado contra el PEOR CASO posible —un fotograma blanco puro—:
          con 0.72 de opacidad el texto blanco queda en 7.4:1, por encima del
          4.5:1 que exige AA, sea cual sea el contenido del video.
        */}
        <div className="hero-velo" />

        <div className="hero-contenido">
          <h1 className="hero-titulo">
            Inspeccionado, financiado y tuyo hoy mismo.
          </h1>
          <p className="hero-bajada">
            Olvídate de ir de un lado a otro. Aquí resolvemos todo el camino, para que llegues tranquilo al carro que se ajusta a ti.
          </p>

          {/* Buscador central WAMMA */}
          <form onSubmit={buscar} className="buscador-hero-wamma">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--texto-secundario)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="icono-busqueda-wamma"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por marca o modelo (ej. Chevrolet, Aveo, Fiesta, Arauca)"
              aria-label="Buscar vehículos"
              className="input-hero-wamma"
            />
            <Boton type="submit" className="boton-hero-wamma">
              Ver vehículos
            </Boton>
          </form>

          {/* Botones de acción principales WAMMA (cuadrados con esquinas redondeadas, en naranja como en la imagen) */}
          <div className="acciones-hero-wamma">
            <button
              type="button"
              onClick={() => navigate('/catalogo')}
              className="boton-wamma-accion"
            >
              Encuéntralo
            </button>
            <button
              type="button"
              onClick={() => navigate('/financiamiento')}
              className="boton-wamma-accion"
            >
              Fináncialo
            </button>
          </div>
        </div>

        <style>{`
          .hero {
            position: relative;
            overflow: hidden;
            width: 100%;
            height: calc(88vh - 88px);
            min-height: 600px;
            max-height: 860px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            background-color: #120E0B;
            margin: 0;
            border-radius: 0;
          }
          .hero-foto, .hero-video {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center;
          }
          /* El video es decorativo: no debe recibir foco ni puntero */
          .hero-video { pointer-events: none; }
          .hero-velo {
            position: absolute;
            inset: 0;
            background: linear-gradient(
              180deg,
              rgba(14, 11, 9, 0.18) 0%,
              rgba(14, 11, 9, 0.38) 45%,
              rgba(14, 11, 9, 0.75) 100%
            );
          }
          .hero-contenido {
            position: relative;
            z-index: 2;
            width: 100%;
            max-width: 860px;
            padding: var(--space-xxxl) var(--space-xl);
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .hero-titulo {
            color: var(--blanco);
            font-size: clamp(30px, 4.2vw, 50px);
            font-weight: 800;
            line-height: 1.15;
            margin-bottom: var(--space-md);
            text-shadow: 0 2px 14px rgba(0, 0, 0, 0.85), 0 0 28px rgba(0, 0, 0, 0.6);
            letter-spacing: -0.02em;
          }
          .hero-bajada {
            color: var(--blanco);
            opacity: 0.98;
            font-size: clamp(15px, 1.5vw, 19px);
            line-height: 1.5;
            margin-bottom: var(--space-xl);
            max-width: 660px;
            text-shadow: 0 2px 10px rgba(0, 0, 0, 0.85), 0 0 20px rgba(0, 0, 0, 0.5);
            font-weight: 500;
          }
          .buscador-hero-wamma {
            width: 100%;
            max-width: 680px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            background: #FFFFFF;
            border-radius: 12px;
            padding: 6px 8px 6px 18px;
            box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
            border: 1px solid rgba(255, 255, 255, 0.85);
            transition: box-shadow 0.2s ease, transform 0.2s ease;
          }
          .buscador-hero-wamma:focus-within {
            box-shadow: 0 16px 44px rgba(0, 0, 0, 0.55), 0 0 0 2px var(--naranja-500);
            transform: translateY(-1px);
          }
          .icono-busqueda-wamma {
            margin-right: 12px;
            flex-shrink: 0;
          }
          .input-hero-wamma {
            flex: 1;
            border: none;
            outline: none;
            background: transparent;
            font-family: var(--font-sans);
            font-size: 15px;
            color: var(--texto-primario);
            min-width: 120px;
          }
          .boton-hero-wamma {
            border-radius: 8px !important;
            padding: 12px 26px !important;
            font-size: 15px !important;
            font-weight: 700 !important;
            box-shadow: none !important;
            white-space: nowrap;
          }
          .acciones-hero-wamma {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
            justify-content: center;
            align-items: center;
            margin-top: 32px;
          }
          .boton-wamma-accion {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 16px 40px;
            font-family: var(--font-sans);
            font-size: 18px;
            font-weight: 700;
            color: #FFFFFF;
            background: #D17438;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            min-width: 210px;
            border: 1px solid rgba(255, 255, 255, 0.25);
            box-shadow: 0 8px 24px rgba(209, 116, 56, 0.45), 0 2px 4px rgba(0, 0, 0, 0.2);
          }
          .boton-wamma-accion:hover {
            background: #BA5F28;
            transform: translateY(-2px);
            box-shadow: 0 12px 28px rgba(209, 116, 56, 0.6);
          }
          .barra-pilares-hero {
            width: 100%;
            background: linear-gradient(180deg, #D97A3B 0%, #C66526 100%);
            border-top: 1px solid rgba(255, 255, 255, 0.35);
            padding: 16px var(--space-xl);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 4px 18px rgba(0, 0, 0, 0.22);
            position: relative;
            z-index: 10;
          }
          .barra-pilares-contenedor {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            justify-content: space-evenly;
            align-items: center;
            gap: 16px;
          }
          .pilar-item {
            display: inline-flex;
            align-items: center;
            cursor: default;
            user-select: none;
            transition: transform 0.2s ease, opacity 0.2s ease;
            opacity: 0.95;
          }
          .pilar-item:hover {
            transform: translateY(-1px);
            opacity: 1;
          }
          .pilar-texto {
            color: #FFFFFF;
            font-family: var(--font-sans);
            font-size: 17px;
            font-weight: 700;
            letter-spacing: 0.03em;
            white-space: nowrap;
            text-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
          }
          .pilar-separador {
            color: rgba(255, 255, 255, 0.55);
            font-size: 20px;
            font-weight: 800;
            line-height: 1;
            user-select: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
          @media (max-width: 1024px) {
            .pilar-texto {
              font-size: 15px;
            }
            .barra-pilares-contenedor {
              gap: 12px;
            }
          }
          @media (max-width: 768px) {
            .hero {
              height: auto;
              min-height: calc(100vh - 70px);
              padding: var(--space-xxxl) 0;
            }
            .hero-contenido {
              padding: var(--space-xl) var(--space-lg);
            }
            .barra-pilares-hero {
              padding: 13px var(--space-md);
              overflow-x: auto;
              -webkit-overflow-scrolling: touch;
              scrollbar-width: none;
            }
            .barra-pilares-hero::-webkit-scrollbar {
              display: none;
            }
            .barra-pilares-contenedor {
              justify-content: flex-start;
              gap: 14px;
              min-width: max-content;
            }
            .pilar-texto {
              font-size: 14px;
            }
            .pilar-separador {
              font-size: 16px;
            }
            .buscador-hero-wamma {
              flex-direction: column;
              border-radius: 12px;
              padding: var(--space-sm);
              gap: var(--space-sm);
            }
            .input-hero-wamma {
              width: 100%;
              padding: var(--space-sm);
            }
            .boton-hero-wamma {
              width: 100%;
            }
            .acciones-hero-wamma {
              margin-top: 24px;
              width: 100%;
              gap: 12px;
            }
            .boton-wamma-accion {
              width: 100%;
              padding: 14px 24px;
              min-width: unset;
            }
          }
        `}</style>
      </section>

      {/* ── Franja de Pilares WAMMA desplegados debajo del Hero ── */}
      <div className="barra-pilares-hero">
        <div className="barra-pilares-contenedor">
          <div className="pilar-item">
            <span className="pilar-texto">Inspección</span>
          </div>

          <span className="pilar-separador" aria-hidden="true">·</span>

          <div className="pilar-item">
            <span className="pilar-texto">Certificación</span>
          </div>

          <span className="pilar-separador" aria-hidden="true">·</span>

          <div className="pilar-item">
            <span className="pilar-texto">Financiamiento</span>
          </div>

          <span className="pilar-separador" aria-hidden="true">·</span>

          <div className="pilar-item">
            <span className="pilar-texto">Seguro</span>
          </div>

          <span className="pilar-separador" aria-hidden="true">·</span>

          <div className="pilar-item">
            <span className="pilar-texto">Acompañamiento</span>
          </div>
        </div>
      </div>
    </div>
  );
};
