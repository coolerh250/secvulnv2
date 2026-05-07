const DEVICE_TYPE_PRODUCTS = {
  'FortiGate':     ['fortios', 'fortios ips engine'],
  'FortiWiFi':     ['fortios', 'fortiwifi'],
  'FortiAnalyzer': ['fortianalyzer'],
  'FortiManager':  ['fortimanager'],
  'FortiProxy':    ['fortiproxy'],
  'FortiADC':      ['fortiadc'],
  'FortiMail':     ['fortimail'],
  'FortiWeb':      ['fortiweb'],
  'PA-Series':     ['pan-os'],
  'Panorama':      ['panorama', 'pan-os'],
};

const DEVICE_TYPE_OPTIONS = {
  'Fortinet':  ['FortiGate', 'FortiWiFi', 'FortiAnalyzer', 'FortiManager', 'FortiProxy', 'FortiADC', 'FortiMail', 'FortiWeb'],
  'Palo Alto': ['PA-Series', 'Panorama'],
};

module.exports = { DEVICE_TYPE_PRODUCTS, DEVICE_TYPE_OPTIONS };
