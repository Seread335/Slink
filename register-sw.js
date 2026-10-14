if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function () {});
  });
}
