/**
 * shared/js/deliveryPlanning.js
 * Berekent de vroegst mogelijke leverdatum en kiest de juiste drukker.
 *
 * Opbouw van de vroegste leverdatum:
 *   vandaag
 *   + ontwerptijd (werkdagen; eigen ontwerp via tool = 0, laat ons ontwerpen = 5)
 *   → eerstvolgende besteldag van de drukker (bijv. Solfer alleen op dinsdag;
 *     valt het ontwerp klaar op een besteldag, dan wordt die dag nog besteld)
 *   + doorlooptijd drukker (werkdagen)
 *   + 6 werkdagen productie en verzenden
 *
 * Werkdagen = maandag t/m vrijdag, zonder Nederlandse feestdagen:
 * Nieuwjaarsdag, 2e paasdag, Koningsdag, Hemelvaart, 2e pinksterdag,
 * 1e en 2e kerstdag. Goede Vrijdag en 5 mei tellen als werkdag.
 *
 * Drukkerregels per personalisatie: [{ printerId, fromQty, toQty }]
 * toQty leeg = geen bovengrens. Per order is er precies één drukker.
 */

const DeliveryPlanning = (() => {
  const DESIGN_WORKDAYS = {
    'eigen-ontwerp': 0,
    'laat-ontwerpen': 5,
  };

  const PRODUCTION_AND_SHIPPING_WORKDAYS = 6;

  const WEEKDAY_NAMES = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

  // Bestelbare weekdagen in de admin (JS getDay: 1 = maandag … 5 = vrijdag).
  const ORDER_WEEKDAY_OPTIONS = [
    { value: 1, label: 'Ma' },
    { value: 2, label: 'Di' },
    { value: 3, label: 'Wo' },
    { value: 4, label: 'Do' },
    { value: 5, label: 'Vr' },
  ];

  const holidayCache = new Map();

  // ─── DATUMHULP ─────────────────────────────────────────────────────────────

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addCalendarDays(date, days) {
    const result = startOfDay(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  function toKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  function fromKey(key) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));

    if (!match) {
      return null;
    }

    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function formatLong(date) {
    if (!date) {
      return '';
    }

    return date.toLocaleDateString('nl-NL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  // ─── FEESTDAGEN ────────────────────────────────────────────────────────────

  // Paaszondag (Gregoriaanse kalender, anonieme algoritme).
  function getEasterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    return new Date(year, month - 1, day);
  }

  function getHolidays(year) {
    if (holidayCache.has(year)) {
      return holidayCache.get(year);
    }

    const easter = getEasterSunday(year);

    // Koningsdag: 27 april, of 26 april als 27 april op zondag valt.
    const kingsDay = new Date(year, 3, 27);

    if (kingsDay.getDay() === 0) {
      kingsDay.setDate(26);
    }

    const holidays = new Set([
      toKey(new Date(year, 0, 1)),        // Nieuwjaarsdag
      toKey(addCalendarDays(easter, 1)),  // 2e paasdag
      toKey(kingsDay),                    // Koningsdag
      toKey(addCalendarDays(easter, 39)), // Hemelvaartsdag
      toKey(addCalendarDays(easter, 50)), // 2e pinksterdag
      toKey(new Date(year, 11, 25)),      // 1e kerstdag
      toKey(new Date(year, 11, 26)),      // 2e kerstdag
    ]);

    holidayCache.set(year, holidays);

    return holidays;
  }

  function isHoliday(date) {
    return getHolidays(date.getFullYear()).has(toKey(date));
  }

  function isWorkday(date) {
    const weekday = date.getDay();

    return weekday >= 1 && weekday <= 5 && !isHoliday(date);
  }

  /**
   * Telt 'workdays' werkdagen vooruit. Bij 0 blijft de datum gelijk.
   */
  function addWorkdays(date, workdays) {
    let result = startOfDay(date);
    let added = 0;

    while (added < workdays) {
      result = addCalendarDays(result, 1);

      if (isWorkday(result)) {
        added += 1;
      }
    }

    return result;
  }

  /**
   * Eerstvolgende dag (vanaf 'date', die dag zelf meegeteld) die een
   * werkdag is en op een besteldag van de drukker valt.
   * Geen besteldagen ingesteld = elke werkdag.
   */
  function getNextOrderDay(date, orderWeekdays) {
    const allowed = normalizeOrderWeekdays(orderWeekdays);
    let result = startOfDay(date);

    for (let guard = 0; guard < 400; guard += 1) {
      if (isWorkday(result) && (allowed.length === 0 || allowed.includes(result.getDay()))) {
        return result;
      }

      result = addCalendarDays(result, 1);
    }

    return null;
  }

  // ─── DRUKKERS ──────────────────────────────────────────────────────────────

  function normalizeOrderWeekdays(value) {
    return (Array.isArray(value) ? value : [])
      .map(Number)
      .filter(day => Number.isInteger(day) && day >= 1 && day <= 5);
  }

  function normalizeLeadTime(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const number = Number(value);

    return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
  }

  function normalizePrinterRules(rules) {
    return (Array.isArray(rules) ? rules : [])
      .map(rule => ({
        printerId: String(rule?.printerId || ''),
        fromQty: Number(rule?.fromQty) > 0 ? Math.round(Number(rule.fromQty)) : 1,
        toQty:
          rule?.toQty === null || rule?.toQty === undefined || rule?.toQty === ''
            ? null
            : Math.round(Number(rule.toQty)),
      }))
      .filter(rule => rule.printerId);
  }

  function getMinQuantity(persType) {
    const value = Number(persType?.minQuantity);

    return Number.isFinite(value) && value > 1 ? Math.round(value) : 1;
  }

  function findPrinterRule(persType, quantity) {
    const qty = Number(quantity);

    if (!Number.isFinite(qty) || qty <= 0) {
      return null;
    }

    return normalizePrinterRules(persType?.printerRules).find(rule =>
      qty >= rule.fromQty &&
      (rule.toQty === null || qty <= rule.toQty)
    ) || null;
  }

  /**
   * Controleert drukkerregels op fouten. Geeft een lijst met meldingen terug.
   */
  function validatePrinterRules(rules) {
    const errors = [];
    const normalized = normalizePrinterRules(rules)
      .slice()
      .sort((a, b) => a.fromQty - b.fromQty);

    normalized.forEach(rule => {
      if (rule.toQty !== null && (!Number.isFinite(rule.toQty) || rule.toQty < rule.fromQty)) {
        errors.push(`De regel vanaf ${rule.fromQty} stuks heeft een "t/m" die lager is dan "vanaf".`);
      }
    });

    for (let index = 1; index < normalized.length; index += 1) {
      const previous = normalized[index - 1];
      const current = normalized[index];

      if (previous.toQty === null || current.fromQty <= previous.toQty) {
        errors.push(`Drukkerregels overlappen rond ${current.fromQty} stuks. Per aantal mag maar één drukker gelden.`);
      }
    }

    return errors;
  }

  // ─── BEREKENING ────────────────────────────────────────────────────────────

  /**
   * Geeft { ok: true, ... } of { ok: false, reason } terug.
   * reasons: 'no-quantity', 'below-minimum', 'no-printer-rule',
   *          'printer-missing', 'printer-incomplete'
   */
  function calculateEarliestDelivery({
    today = new Date(),
    designChoice,
    persType,
    quantity,
    printers = [],
  } = {}) {
    const qty = Number(quantity);

    if (!Number.isFinite(qty) || qty <= 0) {
      return { ok: false, reason: 'no-quantity' };
    }

    const minQuantity = getMinQuantity(persType);

    if (qty < minQuantity) {
      return { ok: false, reason: 'below-minimum', minQuantity };
    }

    const rule = findPrinterRule(persType, qty);

    if (!rule) {
      return { ok: false, reason: 'no-printer-rule' };
    }

    const printer = printers.find(item => item.id === rule.printerId);

    if (!printer) {
      return { ok: false, reason: 'printer-missing', printerId: rule.printerId };
    }

    const leadTimeDays = normalizeLeadTime(printer.leadTimeDays);

    if (leadTimeDays === null) {
      return { ok: false, reason: 'printer-incomplete', printerId: printer.id, printerName: printer.name || '' };
    }

    const designDays = DESIGN_WORKDAYS[designChoice] ?? DESIGN_WORKDAYS['laat-ontwerpen'];
    const designReady = addWorkdays(today, designDays);
    const orderDay = getNextOrderDay(designReady, printer.orderWeekdays);

    if (!orderDay) {
      return { ok: false, reason: 'printer-incomplete', printerId: printer.id, printerName: printer.name || '' };
    }

    const printReady = addWorkdays(orderDay, leadTimeDays);
    const earliest = addWorkdays(printReady, PRODUCTION_AND_SHIPPING_WORKDAYS);

    return {
      ok: true,
      earliestDate: earliest,
      earliestKey: toKey(earliest),
      printerId: printer.id,
      printerName: printer.name || printer.id,
      breakdown: {
        today: toKey(startOfDay(today)),
        designDays,
        designReady: toKey(designReady),
        orderDay: toKey(orderDay),
        leadTimeDays,
        printReady: toKey(printReady),
        productionAndShippingDays: PRODUCTION_AND_SHIPPING_WORKDAYS,
        earliest: toKey(earliest),
      },
    };
  }

  function formatWeekdays(orderWeekdays) {
    const days = normalizeOrderWeekdays(orderWeekdays);

    if (!days.length) {
      return 'elke werkdag';
    }

    return days.map(day => WEEKDAY_NAMES[day]).join(', ');
  }

  return {
    DESIGN_WORKDAYS,
    PRODUCTION_AND_SHIPPING_WORKDAYS,
    ORDER_WEEKDAY_OPTIONS,
    toKey,
    fromKey,
    formatLong,
    formatWeekdays,
    isWorkday,
    addWorkdays,
    getNextOrderDay,
    getHolidays,
    getMinQuantity,
    normalizeLeadTime,
    normalizeOrderWeekdays,
    normalizePrinterRules,
    findPrinterRule,
    validatePrinterRules,
    calculateEarliestDelivery,
  };
})();

window.DeliveryPlanning = DeliveryPlanning;