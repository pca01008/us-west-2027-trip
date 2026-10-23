(() => {
  if (!window.isSecureContext || !('serviceWorker' in navigator) ||
      !/^https?:$/.test(location.protocol) ||
      document.documentElement.dataset.offline === 'true') return;

  // Resolve beside this script so GitHub Pages project paths work as well.
  const workerURL = new URL('./sw.js', document.currentScript.src);
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(workerURL, { updateViaCache: 'none' })
      .catch(error => console.warn('홈 화면 앱의 오프라인 준비에 실패했습니다.', error));
  }, { once: true });
})();
