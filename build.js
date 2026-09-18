// Construye index.html a partir de src/: cabecera + módulos JS, con las imágenes incrustadas como data URI.
//   node build.js
// No requiere dependencias.
const fs = require('fs');
const path = require('path');
const root = __dirname;
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const b64 = (f, mime) => 'data:' + mime + ';base64,' + fs.readFileSync(path.join(root, f)).toString('base64');

let head = read('src/head.html');
head = head
  .replace('__IMG_LOGO__', b64('src/assets/logo_petrodoom.jpg', 'image/jpeg'))
  .replace('__IMG_PHOTO__', b64('src/assets/foto_edgar_izurieta.jpg', 'image/jpeg'))
  .replace('__IMG_QR__', b64('src/assets/qr_sitio_web.png', 'image/png'));

// logo hexagonal de SEP-DOOM: cabecera + favicon
const hex = 'logo_sepdoom.png';
if (fs.existsSync(path.join(root, hex))) {
  const uri = b64(hex, 'image/png');
  head = head
    .replace('__IMG_HEX__', uri)
    .replace(' alt="" hidden data-hex', ' alt="Logo SEP-DOOM" data-hex')
    .replace('<title>SEP-DOOM</title>', '<title>SEP-DOOM</title>\n<link rel="icon" type="image/png" href="' + uri + '">');
} else {
  head = head.replace('src="__IMG_HEX__" ', '');
}

const html = head + ['src/model.js', 'src/draw.js', 'src/particles.js', 'src/ui.js'].map(read).join('');
fs.writeFileSync(path.join(root, 'index.html'), html);

// comprobación de sintaxis del script embebido
const m = html.match(/<script>([\s\S]*)<\/script>/);
try { new Function(m[1]); console.log('index.html generado ·', Math.round(html.length / 1024), 'KB'); }
catch (e) { console.error('ERROR de sintaxis en el script:', e.message); process.exitCode = 1; }
