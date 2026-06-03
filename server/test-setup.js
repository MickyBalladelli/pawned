// Test script to verify server setup
const fs = require('fs');
const path = require('path');

console.log('Pawned MMO Server Setup Verification');

// Check if required files exist
const requiredFiles = [
  'server.js',
  'package.json',
  '../client/index.html',
  '../README.md'
];

let allFilesExist = true;

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✓ ${file} exists`);
  } else {
    console.log(`✗ ${file} missing`);
    allFilesExist = false;
  }
});

// Check package.json dependencies
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  const requiredDeps = ['express', 'socket.io', 'pg'];
  let allDepsFound = true;
  
  requiredDeps.forEach(dep => {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`✓ ${dep} dependency found`);
    } else {
      console.log(`✗ ${dep} dependency missing`);
      allDepsFound = false;
    }
  });
  
  if (allDepsFound) {
    console.log('✓ All required dependencies found in package.json');
  }
  
} catch (err) {
  console.log('✗ Error reading package.json:', err.message);
}

if (allFilesExist) {
  console.log('\n🎉 Server setup is complete and all required files are present!');
  console.log('\nTo start the server:');
  console.log('1. Make sure PostgreSQL is running');
  console.log('2. Create a database named "pawned"');
  console.log('3. Run: npm run dev');
} else {
  console.log('\n❌ Some files are missing. Please check the setup.');
}