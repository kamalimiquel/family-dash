import { useEffect, useState } from 'react'
import type { PdfState } from '../hooks/usePdf'
import type { PdfDocument } from '../lib/types'

/** Motivos de "no hay PDF" explicados para la familia. */
const REASON_TEXT: Record<string, string> = {
  pdf_not_configured: 'Falta decir en qué carpeta está el PDF',
  pdf_not_found: 'No encuentro el PDF en la carpeta compartida',
  pdf_empty: 'La carpeta compartida no tiene ningún PDF',
  pdf_unreachable: 'No puedo leer la carpeta compartida',
  pdf_unreadable: 'El PDF no se puede leer',
  pdf_render_failed: 'No he podido sacar las páginas del PDF',
}

const pageUrl = (document: PdfDocument, page: number): string =>
  `/api/pdf/page/${page}?v=${encodeURIComponent(document.version)}`

/**
 * Tarjeta 4: el PDF que la familia deja en la carpeta compartida (el menú de la
 * semana). Enseña la primera página en pequeño y, al tocarla, se abre a pantalla
 * completa — encima del panel, sin salir de la aplicación, que en un kiosco es
 * la diferencia entre poder volver solo o quedarse atrapado en un visor.
 */
export function PdfWidget({ state }: { state: PdfState }) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)

  const document_ = state.data?.document ?? null
  const reason = state.data?.reason ?? null

  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const hint = reason
    ? (REASON_TEXT[reason.error] ?? reason.message)
    : state.error
      ? 'sin conexión con el servidor'
      : state.loading
        ? 'consultando…'
        : null

  const openViewer = () => {
    if (!document_) return
    setPage(1)
    setOpen(true)
  }

  return (
    <>
      <div
        className="widget widget--pdf"
        role="button"
        tabIndex={document_ ? 0 : -1}
        aria-label={document_ ? `Ver ${document_.file} a pantalla completa` : 'Menú no disponible'}
        data-disabled={document_ ? undefined : 'true'}
        onClick={openViewer}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openViewer()
          }
        }}
      >
        <header className="pdf__head card-head">
          <h2 className="pdf__title card-title">Menú</h2>
          <span className="pdf__file">{document_ ? document_.file : '—'}</span>
        </header>

        {document_ ? (
          <div className="pdf__body">
            <img
              className="pdf__thumb"
              src={pageUrl(document_, 1)}
              alt=""
              style={{ aspectRatio: String(document_.aspect) }}
            />
            <div className="pdf__info">
              <span className="pdf__hint">Toca para verlo entero</span>
              <span className="pdf__meta">
                {document_.pages} página{document_.pages === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        ) : (
          <p className="pdf__empty card-empty">{hint ?? 'sin PDF'}</p>
        )}
      </div>

      {open && document_ && (
        <div
          className="viewer"
          role="dialog"
          aria-modal="true"
          aria-label={document_.file}
          onClick={() => setOpen(false)}
        >
          <div className="viewer__bar">
            <span className="viewer__name">{document_.file}</span>
            {document_.pages > 1 && (
              <span className="viewer__count">
                {page} / {document_.pages}
              </span>
            )}
            <span className="viewer__close">Cerrar</span>
          </div>

          <img
            className="viewer__page"
            src={pageUrl(document_, page)}
            alt={`${document_.file}, página ${page}`}
          />

          {document_.pages > 1 && (
            <>
              <button
                type="button"
                className="viewer__nav viewer__nav--prev"
                disabled={page === 1}
                aria-label="Página anterior"
                onClick={(event) => {
                  event.stopPropagation()
                  setPage((value) => Math.max(1, value - 1))
                }}
              >
                ‹
              </button>
              <button
                type="button"
                className="viewer__nav viewer__nav--next"
                disabled={page === document_.pages}
                aria-label="Página siguiente"
                onClick={(event) => {
                  event.stopPropagation()
                  setPage((value) => Math.min(document_.pages, value + 1))
                }}
              >
                ›
              </button>
            </>
          )}

          <p className="viewer__hint">Toca fuera para cerrar</p>
        </div>
      )}
    </>
  )
}
