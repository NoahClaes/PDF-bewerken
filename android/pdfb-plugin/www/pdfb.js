var exec = require('cordova/exec');
var N = 'PdfbAndroid';
function call(action, args) {
  return new Promise(function (ok, no) { exec(ok, no, N, action, args || []); });
}
module.exports = {
  save: function (name, b64, sub) { return call('save', [name, b64, sub || '']); },
  share: function (uri) { return call('share', [uri]); },
  open: function (uri) { return call('open', [uri]); },
  version: function () { return call('version'); },
  exit: function () { return call('exit'); },
  onFile: function (cb) { exec(function (f) { if (f) cb(f); }, function () {}, N, 'onFile', []); },
  update: function (url, progress) {
    return new Promise(function (ok, no) {
      exec(function (p) { if (progress) progress(p); if (p >= 100) ok(); }, no, N, 'update', [url]);
    });
  }
};
