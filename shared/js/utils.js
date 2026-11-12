/**
 * shared/js/utils.js
 * Gedeelde helpers voor admin en customer flow.
 *
 * Laad dit bestand als EERSTE script op elke pagina.
 * Definieer deze functies nergens anders opnieuw: een tweede
 * function-declaratie met dezelfde naam overschrijft deze versie globaal.
 */

/**
 * Escapet tekst voor gebruik in HTML, inclusief attribuutwaarden
 * zoals value="..." en src="...".
 * null, undefined en false worden een lege string; 0 blijft "0".
 */
function escHtml(value) {
  if (
    value === null ||
    value === undefined ||
    value === false
  ) {
    return '';
  }

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Bedrag als "€ 12,50". Leeg of ongeldig wordt "—".
 */
function formatEuro(value) {
  if (
    value === null ||
    value === undefined ||
    value === '' ||
    Number.isNaN(Number(value))
  ) {
    return '—';
  }

  return `€ ${Number(value).toFixed(2).replace('.', ',')}`;
}

/**
 * Datum als "dd-mm-jjjj". Leeg of ongeldig wordt "—".
 */
function formatDate(iso) {
  if (!iso) {
    return '—';
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Statussen die een order als afgerond/gearchiveerd markeren.
 * Bevat zowel de huidige workflowstatussen als oude (legacy) statussen.
 */
const ARCHIVED_ORDER_STATUSES = [
  'completed',
  'cancelled',
  'verzonden',
  'afgerond',
];

/**
 * Is deze order gearchiveerd?
 * Gebruikt normalizeOrderWorkflow (admin/orders.js) als die geladen is,
 * zodat er één bron van waarheid is. Anders een veilige fallback.
 */
function isOrderArchived(order = {}) {
  if (typeof normalizeOrderWorkflow === 'function') {
    return Boolean(normalizeOrderWorkflow(order).archived);
  }

  const workflow = order.workflow || {};

  return Boolean(
    workflow.archived ||
    ARCHIVED_ORDER_STATUSES.includes(workflow.status) ||
    ARCHIVED_ORDER_STATUSES.includes(order.status)
  );
}

window.Utils = {
  escHtml,
  formatEuro,
  formatDate,
  ARCHIVED_ORDER_STATUSES,
  isOrderArchived,
};