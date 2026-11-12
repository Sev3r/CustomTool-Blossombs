/**
 * shared/js/fileStorage.js
 * Bestanden (ontwerpen, PDF's, referentiebeelden, definitieve documenten)
 * worden in Supabase Storage bewaard in plaats van als base64-tekst in de order.
 *
 * Werking:
 * - externalize() loopt een record na en uploadt elke ingebakken bestandstekst
 *   ("data:...") naar Storage. In het record komt de openbare link ervoor terug.
 * - Velden houden hun naam (bijv. designDataURL), maar bevatten nu een link.
 *
 * Vereist in Supabase: een openbare bucket 'order-files' met een upload-policy
 * (zie de SQL in de oplevering).
 *
 * Laad dit bestand na utils.js en vóór dataService.js.
 */

const FileStorage = (() => {
  const BUCKET = 'order-files';

  // Kleine stukjes (bijv. een icoontje) mogen inline blijven.
  const MIN_INLINE_LENGTH = 1024;

  const MIME_EXTENSIONS = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'application/pdf': 'pdf',
    'application/postscript': 'eps',
    'application/illustrator': 'ai',
    'application/json': 'json',
    'text/plain': 'txt',
  };

  // Voorkomt dat hetzelfde bestand twee keer wordt geüpload
  // (bijv. bij een tweede poging of twee snelle wijzigingen).
  const uploadCache = new Map();

  function isInlineFile(value) {
    return (
      typeof value === 'string' &&
      value.startsWith('data:') &&
      value.length > MIN_INLINE_LENGTH
    );
  }

  function getMimeType(dataURL) {
    const meta = dataURL.slice(5, dataURL.indexOf(','));
    return meta.split(';')[0] || 'application/octet-stream';
  }

  function dataURLToBlob(dataURL) {
    const commaIndex = dataURL.indexOf(',');
    const meta = dataURL.slice(5, commaIndex);
    const payload = dataURL.slice(commaIndex + 1);
    const mimeType = meta.split(';')[0] || 'application/octet-stream';

    if (meta.includes(';base64')) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);

      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }

      return new Blob([bytes], { type: mimeType });
    }

    return new Blob([decodeURIComponent(payload)], { type: mimeType });
  }

  function randomId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }

    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }

  function sanitizeFolder(folder) {
    return String(folder || 'misc').replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  async function uploadDataURL(client, dataURL, folder) {
    if (uploadCache.has(dataURL)) {
      return uploadCache.get(dataURL);
    }

    const uploadPromise = (async () => {
      const mimeType = getMimeType(dataURL);
      const extension = MIME_EXTENSIONS[mimeType] || 'bin';
      const path = `${sanitizeFolder(folder)}/${randomId()}.${extension}`;
      const blob = dataURLToBlob(dataURL);

      const { error } = await client.storage
        .from(BUCKET)
        .upload(path, blob, {
          contentType: mimeType,
          cacheControl: '31536000',
          upsert: false,
        });

      if (error) {
        throw error;
      }

      const { data } = client.storage
        .from(BUCKET)
        .getPublicUrl(path);

      return data.publicUrl;
    })();

    uploadCache.set(dataURL, uploadPromise);

    try {
      return await uploadPromise;
    } catch (error) {
      uploadCache.delete(dataURL);
      throw error;
    }
  }

  function isPlainObject(value) {
    return Boolean(value) && Object.prototype.toString.call(value) === '[object Object]';
  }

  /**
   * Geeft een kopie van 'value' terug waarin alle ingebakken bestanden
   * zijn vervangen door Storage-links. Het origineel blijft ongewijzigd.
   */
  async function externalize(client, value, folder) {
    let uploadedCount = 0;

    async function walk(node) {
      if (isInlineFile(node)) {
        uploadedCount += 1;
        return uploadDataURL(client, node, folder);
      }

      if (Array.isArray(node)) {
        const result = [];

        for (const item of node) {
          result.push(await walk(item));
        }

        return result;
      }

      if (isPlainObject(node)) {
        const result = {};

        for (const [key, item] of Object.entries(node)) {
          result[key] = await walk(item);
        }

        return result;
      }

      return node;
    }

    const result = await walk(value);

    return {
      value: result,
      uploadedCount,
    };
  }

  function containsInlineFiles(value) {
    if (isInlineFile(value)) {
      return true;
    }

    if (Array.isArray(value)) {
      return value.some(containsInlineFiles);
    }

    if (isPlainObject(value)) {
      return Object.values(value).some(containsInlineFiles);
    }

    return false;
  }

  function getPathFromRef(ref) {
    if (typeof ref !== 'string') {
      return '';
    }

    try {
      return new URL(ref).pathname.toLowerCase();
    } catch {
      return '';
    }
  }

  function isImageRef(ref) {
    if (typeof ref !== 'string' || !ref) {
      return false;
    }

    if (ref.startsWith('data:')) {
      return ref.startsWith('data:image');
    }

    return /\.(png|jpe?g|gif|webp|svg)$/.test(getPathFromRef(ref));
  }

  function isPdfRef(ref) {
    if (typeof ref !== 'string' || !ref) {
      return false;
    }

    if (ref.startsWith('data:')) {
      return ref.startsWith('data:application/pdf');
    }

    return /\.pdf$/.test(getPathFromRef(ref));
  }

  function isStorageUrl(ref) {
    return typeof ref === 'string' && ref.includes(`/storage/v1/object/public/${BUCKET}/`);
  }

  /**
   * Link waarmee de browser het bestand downloadt (i.p.v. opent).
   * Voor Storage-links vraagt '?download=' Supabase om een downloadkop.
   */
  function getDownloadHref(ref, fileName) {
    if (!isStorageUrl(ref)) {
      return ref;
    }

    const separator = ref.includes('?') ? '&' : '?';

    return `${ref}${separator}download=${encodeURIComponent(fileName || '')}`;
  }

  return {
    BUCKET,
    isInlineFile,
    externalize,
    containsInlineFiles,
    isImageRef,
    isPdfRef,
    isStorageUrl,
    getDownloadHref,
  };
})();

window.FileStorage = FileStorage;