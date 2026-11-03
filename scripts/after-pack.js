// Grava o ícone e os dados de versão no Vox.exe depois do empacotamento.
// O electron-builder faria isso sozinho, mas "signAndEditExecutable": false
// (necessário no Windows sem permissão de symlink) desliga essa etapa.
const path = require('path');
const rcedit = require('rcedit');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const { productFilename } = context.packager.appInfo;
  const version = context.packager.appInfo.version;
  await rcedit(path.join(context.appOutDir, `${productFilename}.exe`), {
    icon: path.join(context.packager.projectDir, 'build', 'icon.ico'),
    'file-version': version,
    'product-version': version,
    'version-string': {
      ProductName: 'Vox',
      FileDescription: 'Vox',
      CompanyName: 'Vox',
      OriginalFilename: `${productFilename}.exe`
    }
  });
};
