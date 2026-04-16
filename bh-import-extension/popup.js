const IMPORT_PAGE_URL = 'https://memory-media-tracker-o9qx.vercel.app/';
const statusEl = document.getElementById('status');
const importBtn = document.getElementById('importBtn');

function setStatus(message) {
  console.log('[B&H Import]', message);
  if (statusEl) statusEl.textContent = message;
}

async function findExistingImportTab() {
  const tabs = await chrome.tabs.query({});
  return (
    tabs.find((tab) => {
      if (!tab.url) return false;
      return (
        tab.url === IMPORT_PAGE_URL ||
        tab.url === IMPORT_PAGE_URL.slice(0, -1) ||
        tab.url.startsWith(IMPORT_PAGE_URL)
      );
    }) ?? null
  );
}

setStatus('popup.js loaded');

if (importBtn) {
  importBtn.addEventListener('click', async () => {
    try {
      setStatus('クリックされました');

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab?.id || !tab.url) {
        setStatus('アクティブなタブを取得できませんでした');
        return;
      }

      const isBh =
        tab.url.startsWith('https://www.bhphotovideo.com/') ||
        tab.url.startsWith('https://bhphotovideo.com/');

      if (!isBh) {
        setStatus(`B&Hページではありません: ${tab.url}`);
        return;
      }

      setStatus('B&Hページ確認OK / HTML抽出中');

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({
          html: document.documentElement.outerHTML,
          sourceUrl: location.href,
          pageTitle: document.title,
        }),
      });

      const payload = results?.[0]?.result;

      if (!payload?.html) {
        setStatus('HTMLを取得できませんでした');
        return;
      }

      setStatus(`HTML取得OK (${payload.html.length} chars)`);

      await chrome.storage.local.set({
        bhImportPayload: payload,
        bhImportUpdatedAt: Date.now(),
      });

      const existingTab = await findExistingImportTab();

      if (existingTab?.id) {
        setStatus(`既存タブ再利用: ${existingTab.id}`);
        await chrome.tabs.update(existingTab.id, {
          url: IMPORT_PAGE_URL,
          active: true,
        });
      } else {
        setStatus('新規タブを開きます');
        const createdTab = await chrome.tabs.create({
          url: IMPORT_PAGE_URL,
          active: true,
        });
        setStatus(`新規タブ作成: ${createdTab?.id ?? 'unknown'}`);
      }

      // すぐ閉じると状況が見えないので少し待つ
      setTimeout(() => window.close(), 400);
    } catch (error) {
      console.error(error);
      setStatus(`エラー: ${error?.message ?? 'unknown error'}`);
    }
  });
} else {
  console.error('importBtn not found');
}