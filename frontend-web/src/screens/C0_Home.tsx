import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boton } from '../components/Boton';

interface C0HomeProps {
  rateBCV?: number;
}

/** Los tres pilares para la compra de vehículos publicados. */
const ACCESOS = [
  {
    titulo: 'Explora la vitrina',
    detalle: 'Inventario con inspección Estándar WAMMA listo para entrega inmediata.',
    a: '/catalogo',
    icono: (
      <>
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </>
    ),
  },
  {
    titulo: 'Inspección 240 puntos',
    detalle: 'Inspección exhaustiva mecánica, legal y estética garantizada.',
    a: '/catalogo',
    icono: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </>
    ),
  },
  {
    titulo: 'Financiamiento directo',
    detalle: 'Simula tu cuota en EUR. El crédito se solicita después de tu visita.',
    a: '/financiamiento',
    icono: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </>
    ),
  },
];

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
          <source media="(max-width: 640px)" srcSet="/hero/carro-playa-movil.webp" />
          <img
            src="/hero/carro-playa.webp"
            alt=""
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
            poster="/hero/carro-playa.webp"
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
          <h1
            style={{
              color: 'var(--blanco)',
              fontSize: 'clamp(26px, 3.4vw, 44px)',
              lineHeight: 1.08,
              marginBottom: 'var(--space-md)',
              textShadow: '0 2px 12px rgba(0,0,0,0.35)',
            }}
          >
            Inspeccionado, financiado y tuyo hoy mismo. Encuéntralo aquí.
          </h1>
          <p
            style={{
              color: 'var(--blanco)',
              opacity: 0.94,
              fontSize: '17px',
              marginBottom: 'var(--space-xl)',
              maxWidth: '46ch',
              textShadow: '0 1px 8px rgba(0,0,0,0.4)',
            }}
          >
            Compra y financia vehículos usados con Estándar WAMMA en Venezuela. Todo bajo un mismo
            techo.
          </p>

          {/* Buscador rápido */}
          <form
            onSubmit={buscar}
            style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', maxWidth: '560px' }}
          >
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Busca por marca o modelo. Ej. Toyota Corolla"
              aria-label="Buscar vehículos"
              style={{
                flex: '1 1 240px',
                padding: 'var(--space-md) var(--space-lg)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-sans)',
                fontSize: '15px',
                color: 'var(--texto-primario)',
              }}
            />
            <Boton type="submit" style={{ padding: '12px 32px', fontSize: '15px' }}>
              Ver vehículos
            </Boton>
          </form>
        </div>

        <style>{`
          .hero {
            position: relative;
            overflow: hidden;
            border-radius: var(--radius-lg);
            margin-bottom: var(--space-xxxl);
            min-height: 440px;
            display: flex;
            align-items: center;
            background-color: #221B16;
          }
          .hero-foto, .hero-video {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: center 55%;
          }
          /* El video es decorativo: no debe recibir foco ni puntero */
          .hero-video { pointer-events: none; }
          /*
            Velo de contraste calibrado sobre esta fotografía en concreto:
            se mantiene alto hasta el 40%, cae a 0.26 en el 52% y deja limpia
            la placa WAMMA (ocupa del 53% al 58%). Medido: texto blanco a
            7.45:1 con la columna al 44%. Si se cambia la foto hay que volver
            a medir — con el velo anterior el texto caía a 2.88:1.
          */
          .hero-velo {
            position: absolute;
            inset: 0;
            background:
              linear-gradient(90deg,
                rgba(24,18,13,0.90) 0%,
                rgba(24,18,13,0.80) 30%,
                rgba(24,18,13,0.72) 44%,
                rgba(24,18,13,0.34) 62%,
                rgba(24,18,13,0.12) 100%);
          }
          .hero-contenido {
            position: relative;
            padding: var(--space-xxxl) var(--space-xxl);
            max-width: 44%;
          }

          /* Por debajo de 900px la columna del 44% es demasiado angosta:
             el texto pasa al pie, sobre la carretera, que es zona oscura. */
          @media (max-width: 900px) {
            .hero { min-height: 480px; align-items: flex-end; }
            .hero-foto { object-position: center 42%; }
            .hero-velo {
              background:
                linear-gradient(to top,
                  rgba(24,18,13,0.94) 0%,
                  rgba(24,18,13,0.88) 40%,
                  rgba(24,18,13,0.72) 56%,
                  rgba(24,18,13,0.35) 76%,
                  rgba(24,18,13,0.12) 100%);
            }
            .hero-contenido { max-width: 100%; padding: var(--space-xl); }
          }
        `}</style>
      </section>

      {/* ── Tres accesos ─────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 'var(--space-lg)',
          marginBottom: 'var(--space-xxxl)',
        }}
      >
        {ACCESOS.map((acceso) => (
          <button
            key={acceso.titulo}
            type="button"
            onClick={() => navigate(acceso.a)}
            style={{
              textAlign: 'left',
              cursor: 'pointer',
              backgroundColor: 'var(--blanco)',
              border: '1px solid var(--borde-claro)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-xl)',
              fontFamily: 'var(--font-sans)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-sm)',
            }}
          >
            <span
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--naranja-50)',
                color: 'var(--naranja-500)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {acceso.icono}
              </svg>
            </span>
            <span style={{ fontSize: '17px', fontWeight: 700 }}>{acceso.titulo}</span>
            <span style={{ fontSize: '13px', color: 'var(--texto-secundario)' }}>
              {acceso.detalle}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
