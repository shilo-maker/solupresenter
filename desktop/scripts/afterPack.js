const path = require('path');
const { rcedit } = require('rcedit');

exports.default = async function(context) {
  // Only run for Windows builds
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  const exePath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const iconPath = path.join(__dirname, '..', 'resources', 'icon.ico');

  console.log(`Setting icon on ${exePath}`);
  console.log(`Using icon from ${iconPath}`);

  try {
    await rcedit(exePath, { icon: iconPath });
    console.log('Icon set successfully');
  } catch (error) {
    console.error('Failed to set icon:', error);
    throw error;
  }
};
