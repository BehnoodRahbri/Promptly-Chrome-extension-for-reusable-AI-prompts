// Advanced PNG icon generator using Sharp library
// Run: npm install sharp
// Then: node scripts/advanced-icon-generator.js

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
  console.log('✅ Sharp library found - generating high-quality PNG icons');
} catch {
  console.log('⚠️  Sharp library not found. Install with: npm install sharp');
  console.log('Falling back to manual conversion instructions...\n');
}

const iconSizes = [16, 32, 48, 128];
const iconsDir = path.resolve(__dirname, '..');

async function generateIconsWithSharp() {
  const svgPath = path.join(iconsDir, 'icon.svg');
  
  if (!fs.existsSync(svgPath)) {
    console.error('❌ icon.svg not found in current directory');
    return;
  }

  console.log('🎨 Generating PNG icons from SVG...');

  for (const size of iconSizes) {
    const outputPath = path.join(iconsDir, `icon${size}.png`);
    
    try {
      await sharp(svgPath)
        .resize(size, size)
        .png({
          quality: 100,
          compressionLevel: 9,
          adaptiveFiltering: true
        })
        .toFile(outputPath);
      
      console.log(`✅ Created: icon${size}.png (${size}x${size})`);
    } catch (error) {
      console.error(`❌ Error creating icon${size}.png:`, error.message);
    }
  }
  
  console.log('\n🎉 All PNG icons generated successfully!');
  console.log('Your Chrome extension now has proper icons.');
}

function showManualInstructions() {
  console.log('📋 MANUAL CONVERSION INSTRUCTIONS\n');
  
  console.log('Option 1 - Use the HTML converter:');
  console.log('1. Open svg-to-png.html in your browser');
  console.log('2. Click "Generate PNG Icons"');
  console.log('3. Download each size and replace the files\n');
  
  console.log('Option 2 - Online converter:');
  console.log('1. Go to https://svgtopng.com/');
  console.log('2. Upload icon.svg');
  console.log('3. Generate and download these sizes:');
  iconSizes.forEach(size => {
    console.log(`   - ${size}x${size} → save as icon${size}.png`);
  });
  
  console.log('\nOption 3 - Install Sharp for high-quality conversion:');
  console.log('npm install sharp');
  console.log('node advanced-icon-generator.js\n');
  
  console.log('Option 4 - Use Inkscape (if installed):');
  iconSizes.forEach(size => {
    console.log(`inkscape icon.svg --export-filename=icon${size}.png --export-width=${size} --export-height=${size}`);
  });
}

// Main execution
if (sharp) {
  generateIconsWithSharp().catch(error => {
    console.error('❌ Error generating icons:', error);
    showManualInstructions();
  });
} else {
  showManualInstructions();
}
