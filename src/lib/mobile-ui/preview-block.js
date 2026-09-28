/** Destino interno do rewrite de `/m/preview` em build de produção. */
const MOBILE_PREVIEW_DISABLED_PATH = '/api/mobile/preview-disabled';

/** `beforeFiles`: URL pública continua `/m/preview`; resposta é 404 real. */
function productionMobilePreviewRewrites() {
  return [
    {
      source: '/m/preview',
      destination: MOBILE_PREVIEW_DISABLED_PATH,
    },
  ];
}

module.exports = {
  MOBILE_PREVIEW_DISABLED_PATH,
  productionMobilePreviewRewrites,
};
