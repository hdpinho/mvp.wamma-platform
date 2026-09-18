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
            Compra y financia vehículos usados con Estándar WAMMA en Venezuela. Todo bajo un mismo techo.
          </p>

          {/* Buscador central estilo Kavak */}
          <form onSubmit={buscar} className="buscador-hero-kavak">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--texto-secundario)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="icono-busqueda-kavak"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Busca por marca o modelo (ej. Toyota, Aveo, Yaris...)"
              aria-label="Buscar vehículos"
              className="input-hero-kavak"
            />
            <Boton type="submit" className="boton-hero-kavak">
              Ver vehículos
            </Boton>
          </form>

          {/* Acciones directas estilo píldora como Kavak */}
          <div className="pildoras-hero-kavak">
            <button
              type="button"
              onClick={() => navigate('/catalogo')}
              className="pildora-kavak"
            >
              Comprar auto
            </button>
            <button
              type="button"
              onClick={() => navigate('/financiamiento')}
              className="pildora-kavak"
            >
              Financiamiento
            </button>
            <button
              type="button"
              onClick={() => navigate('/catalogo')}
              className="pildora-kavak"
            >
              Inspección 240 pts
            </button>
          </div>
        </div>

        <style>{`
          .hero {
            position: relative;
            overflow: hidden;
            width: 100%;
            height: calc(88vh - 88px);
            min-height: 580px;
            max-height: 840px;
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
            background:
              radial-gradient(ellipse at center, rgba(16, 12, 10, 0.40) 0%, rgba(16, 12, 10, 0.72) 100%),
              linear-gradient(180deg, rgba(12, 9, 7, 0.35) 0%, rgba(12, 9, 7, 0.55) 50%, rgba(12, 9, 7, 0.88) 100%);
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
            font-size: clamp(32px, 4.4vw, 54px);
            font-weight: 800;
            line-height: 1.12;
            margin-bottom: var(--space-md);
            text-shadow: 0 2px 16px rgba(0, 0, 0, 0.6);
            letter-spacing: -0.02em;
          }
          .hero-bajada {
            color: var(--blanco);
            opacity: 0.95;
            font-size: clamp(16px, 1.6vw, 20px);
            line-height: 1.45;
            margin-bottom: var(--space-xl);
            max-width: 620px;
            text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
          }
          .buscador-hero-kavak {
            width: 100%;
            max-width: 640px;
            margin: 0 auto var(--space-lg) auto;
            display: flex;
            align-items: center;
            background: rgba(255, 255, 255, 0.96);
            backdrop-filter: blur(12px);
            border-radius: var(--radius-pill);
            padding: 6px 8px 6px 18px;
            box-shadow: 0 10px 32px rgba(0, 0, 0, 0.35);
            transition: box-shadow 0.2s ease, transform 0.2s ease;
          }
          .buscador-hero-kavak:focus-within {
            box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45), 0 0 0 2px var(--naranja-500);
            transform: translateY(-1px);
          }
          .icono-busqueda-kavak {
            margin-right: 12px;
            flex-shrink: 0;
          }
          .input-hero-kavak {
            flex: 1;
            border: none;
            outline: none;
            background: transparent;
            font-family: var(--font-sans);
            font-size: 16px;
            color: var(--texto-primario);
            min-width: 120px;
          }
          .boton-hero-kavak {
            border-radius: var(--radius-pill) !important;
            padding: 12px 28px !important;
            font-size: 15px !important;
            font-weight: 700 !important;
            box-shadow: none !important;
            white-space: nowrap;
          }
          .pildoras-hero-kavak {
            display: flex;
            gap: var(--space-md);
            flex-wrap: wrap;
            justify-content: center;
            align-items: center;
          }
          .pildora-kavak {
            background: rgba(255, 255, 255, 0.88);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.5);
            border-radius: var(--radius-pill);
            padding: 10px 24px;
            font-family: var(--font-sans);
            font-size: 15px;
            font-weight: 700;
            color: var(--texto-primario);
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          }
          .pildora-kavak:hover {
            background: var(--blanco);
            color: var(--naranja-600);
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
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
            .buscador-hero-kavak {
              flex-direction: column;
              border-radius: var(--radius-lg);
              padding: var(--space-sm);
              gap: var(--space-sm);
            }
            .input-hero-kavak {
              width: 100%;
              padding: var(--space-sm);
            }
            .boton-hero-kavak {
              width: 100%;
            }
          }
        `}</style>
      </section>
    </div>
  );
};
