console.log('[B&H bridge] import-bridge loaded');

async function postStoredPayloadToPage() {
  try {
    const data = await chrome.storage.local.get([
      'bhImportPayload',
      'bhImportUpdatedAt',
    ]);

    console.log('[B&H bridge] storage data', data);

    if (!data?.bhImportPayload?.html) {
      console.log('[B&H bridge] no stored payload found');
      return;
    }

    const payload = data.bhImportPayload;

    let count = 0;
    const maxCount = 5;

    const timer = setInterval(() => {
      count += 1;

      window.postMessage(
        {
          type: 'BH_IMPORT_PAYLOAD_FROM_EXTENSION',
          payload,
        },
        window.location.origin
      );

      console.log(`[B&H bridge] posted stored payload to page (${count}/${maxCount})`);

      if (count >= maxCount) {
        clearInterval(timer);
      }
    }, 250);
  } catch (error) {
    console.error('[B&H bridge] failed to read storage', error);
  }
}

postStoredPayloadToPage();