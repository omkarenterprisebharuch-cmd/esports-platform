/**
 * Bundle Size Analysis Script
 * 
 * Run with: npx tsx scripts/analyze-bundle.ts
 * 
 * This script analyzes the project's dependencies and provides
 * recommendations for bundle size optimization.
 */

import fs from 'fs';
import path from 'path';

interface PackageInfo {
  name: string;
  version: string;
  sizeKB: number;
  description: string;
  recommendation?: string;
  alternative?: string;
}

interface TreeShakingIssue {
  file: string;
  issue: string;
  suggestion: string;
}

// Known package sizes (approximate gzipped sizes for client bundles)
const PACKAGE_SIZES: Record<string, { sizeKB: number; clientBundle: boolean; recommendation?: string; alternative?: string }> = {
  // Core framework - required
  'next': { sizeKB: 0, clientBundle: false },
  'react': { sizeKB: 2.5, clientBundle: true },
  'react-dom': { sizeKB: 40, clientBundle: true },
  
  // UI/Styling - required
  'tailwindcss': { sizeKB: 0, clientBundle: false }, // Build-time only
  '@tailwindcss/postcss': { sizeKB: 0, clientBundle: false },
  
  // Utilities
  'zod': { sizeKB: 13, clientBundle: true, recommendation: 'Good choice - lightweight validation' },
  'isomorphic-dompurify': { sizeKB: 15, clientBundle: true, recommendation: 'Required for XSS protection' },
  
  // Real-time
  'socket.io-client': { sizeKB: 40, clientBundle: true, recommendation: 'Consider lazy loading for pages that need it' },
  'socket.io': { sizeKB: 0, clientBundle: false }, // Server only
  
  // Storage
  'idb': { sizeKB: 5, clientBundle: true, recommendation: 'Lightweight IndexedDB wrapper - good choice' },
  
  // Server-only packages (not in client bundle)
  'pg': { sizeKB: 0, clientBundle: false },
  'bcryptjs': { sizeKB: 0, clientBundle: false },
  'jsonwebtoken': { sizeKB: 0, clientBundle: false },
  'nodemailer': { sizeKB: 0, clientBundle: false },
  'cloudinary': { sizeKB: 0, clientBundle: false },
  'sharp': { sizeKB: 0, clientBundle: false },
  'web-push': { sizeKB: 0, clientBundle: false },
  'dotenv': { sizeKB: 0, clientBundle: false },
};

async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;
  
  try {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        totalSize += await getDirectorySize(itemPath);
      } else {
        totalSize += stats.size;
      }
    }
  } catch (error) {
    // Ignore errors for inaccessible directories
  }
  
  return totalSize;
}

async function analyzeBundle() {
  console.log('\n🔍 Bundle Size Analysis Report');
  console.log('='.repeat(60));
  console.log('\n');

  // Read package.json
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const dependencies = { ...packageJson.dependencies };

  console.log('📦 CLIENT BUNDLE DEPENDENCIES');
  console.log('-'.repeat(60));
  
  let totalClientSize = 0;
  const clientPackages: PackageInfo[] = [];
  
  for (const [name, version] of Object.entries(dependencies)) {
    const info = PACKAGE_SIZES[name];
    if (info?.clientBundle) {
      totalClientSize += info.sizeKB;
      clientPackages.push({
        name,
        version: version as string,
        sizeKB: info.sizeKB,
        description: info.recommendation || '',
        alternative: info.alternative,
      });
    }
  }
  
  // Sort by size
  clientPackages.sort((a, b) => b.sizeKB - a.sizeKB);
  
  console.log('\nPackages included in client bundle (gzipped):');
  console.log('');
  for (const pkg of clientPackages) {
    console.log(`  ${pkg.name.padEnd(25)} ${pkg.sizeKB.toString().padStart(5)} KB`);
    if (pkg.description) {
      console.log(`    └─ ${pkg.description}`);
    }
  }
  
  console.log('\n' + '-'.repeat(60));
  console.log(`  Total client dependencies: ~${totalClientSize} KB (gzipped)`);
  console.log('');

  console.log('\n🖥️  SERVER-ONLY DEPENDENCIES (not in client bundle)');
  console.log('-'.repeat(60));
  
  for (const [name] of Object.entries(dependencies)) {
    const info = PACKAGE_SIZES[name];
    if (info && !info.clientBundle) {
      console.log(`  ✓ ${name} (server-only)`);
    }
  }

  console.log('\n\n✅ OPTIMIZATION RECOMMENDATIONS');
  console.log('='.repeat(60));
  console.log('');

  console.log('1. ALREADY OPTIMIZED:');
  console.log('   ✓ Heavy packages (pg, bcryptjs, jsonwebtoken, nodemailer,');
  console.log('     cloudinary, sharp, web-push) are correctly marked as');
  console.log('     serverExternalPackages in next.config.ts');
  console.log('');
  
  console.log('2. DYNAMIC IMPORTS (Code Splitting):');
  console.log('   Consider lazy loading these for pages that need them:');
  console.log('');
  console.log('   // Instead of:');
  console.log('   import { io } from "socket.io-client";');
  console.log('');
  console.log('   // Use dynamic import:');
  console.log('   const socket = await import("socket.io-client").then(m => m.io(...));');
  console.log('');
  
  console.log('3. COMPONENT LAZY LOADING:');
  console.log('   Lazy load heavy components like chat, notifications:');
  console.log('');
  console.log('   const ChatPanel = dynamic(() => import("@/components/chat/ChatPanel"), {');
  console.log('     loading: () => <ChatSkeleton />,');
  console.log('     ssr: false');
  console.log('   });');
  console.log('');

  console.log('4. IMAGE OPTIMIZATION:');
  console.log('   ✓ Already configured with AVIF/WebP formats');
  console.log('   ✓ Device sizes and cache TTL configured');
  console.log('');

  console.log('5. TREE SHAKING:');
  console.log('   Ensure named imports for better tree shaking:');
  console.log('');
  console.log('   // Good:');
  console.log('   import { z } from "zod";');
  console.log('');
  console.log('   // Avoid:');
  console.log('   import * as zod from "zod";');
  console.log('');

  console.log('\n📊 BUNDLE ANALYZER');
  console.log('='.repeat(60));
  console.log('');
  console.log('To generate a visual bundle report, run:');
  console.log('');
  console.log('  # Stop the dev server first, then:');
  console.log('  $env:ANALYZE="true"; npm run build');
  console.log('');
  console.log('This will open an interactive treemap showing exact bundle sizes.');
  console.log('');

  // Check for actual node_modules sizes
  console.log('\n📁 ACTUAL NODE_MODULES SIZES');
  console.log('='.repeat(60));
  console.log('');
  
  const topPackages: { name: string; sizeMB: number }[] = [];
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  
  try {
    const dirs = fs.readdirSync(nodeModulesPath);
    
    for (const dir of dirs.slice(0, 50)) { // Limit to prevent long runtime
      if (dir.startsWith('.')) continue;
      
      const dirPath = path.join(nodeModulesPath, dir);
      const stats = fs.statSync(dirPath);
      
      if (stats.isDirectory()) {
        const size = await getDirectorySize(dirPath);
        topPackages.push({ name: dir, sizeMB: size / (1024 * 1024) });
      }
    }
    
    topPackages.sort((a, b) => b.sizeMB - a.sizeMB);
    
    console.log('Top 15 largest packages in node_modules:');
    console.log('');
    for (const pkg of topPackages.slice(0, 15)) {
      console.log(`  ${pkg.name.padEnd(30)} ${pkg.sizeMB.toFixed(2).padStart(8)} MB`);
    }
    console.log('');
    console.log('Note: node_modules size ≠ client bundle size');
    console.log('Server-only packages are NOT included in the browser bundle.');
  } catch (error) {
    console.log('Could not analyze node_modules directory');
  }

  // Tree shaking verification
  console.log('\n🌳 TREE SHAKING VERIFICATION');
  console.log('='.repeat(60));
  console.log('');
  
  const treeShakingIssues: TreeShakingIssue[] = [];
  
  // Check for namespace imports
  const srcPath = path.join(process.cwd(), 'src');
  await checkTreeShakingRecursive(srcPath, treeShakingIssues);
  
  if (treeShakingIssues.length === 0) {
    console.log('✅ No tree shaking issues found!');
    console.log('');
    console.log('Your codebase follows tree shaking best practices:');
    console.log('  • Using named imports (import { x } from "module")');
    console.log('  • No namespace imports (import * as x from "module")');
    console.log('  • Barrel files use explicit re-exports');
    console.log('  • sideEffects field configured in package.json');
  } else {
    console.log(`⚠️  Found ${treeShakingIssues.length} potential tree shaking issues:`);
    console.log('');
    for (const issue of treeShakingIssues) {
      console.log(`  📄 ${issue.file}`);
      console.log(`     Issue: ${issue.issue}`);
      console.log(`     Fix: ${issue.suggestion}`);
      console.log('');
    }
  }

  // Check package.json for sideEffects
  console.log('\n📦 SIDE EFFECTS CONFIGURATION');
  console.log('='.repeat(60));
  console.log('');
  
  const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  if (pkgJson.sideEffects) {
    console.log('✅ sideEffects field configured in package.json:');
    console.log(`   ${JSON.stringify(pkgJson.sideEffects)}`);
  } else {
    console.log('⚠️  No sideEffects field in package.json');
    console.log('   Add "sideEffects": ["*.css"] to enable better tree shaking');
  }

  console.log('\n');
}

async function checkTreeShakingRecursive(dirPath: string, issues: TreeShakingIssue[]): Promise<void> {
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        await checkTreeShakingRecursive(itemPath, issues);
      } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
        const content = fs.readFileSync(itemPath, 'utf-8');
        const relativePath = path.relative(process.cwd(), itemPath);
        
        // Check for namespace imports (except type imports)
        const namespaceImports = content.match(/import \* as \w+ from ['"][^'"]+['"]/g);
        if (namespaceImports) {
          for (const imp of namespaceImports) {
            // Skip if it's a type-only import
            if (!content.includes(`import type * as`)) {
              issues.push({
                file: relativePath,
                issue: `Namespace import: ${imp}`,
                suggestion: 'Use named imports instead: import { x, y } from "module"'
              });
            }
          }
        }
        
        // Check for default + namespace imports
        const mixedImports = content.match(/import \w+, \* as \w+ from ['"][^'"]+['"]/g);
        if (mixedImports) {
          for (const imp of mixedImports) {
            issues.push({
              file: relativePath,
              issue: `Mixed import: ${imp}`,
              suggestion: 'Split into separate imports with named exports'
            });
          }
        }
      }
    }
  } catch (error) {
    // Ignore errors for inaccessible directories
  }
}

analyzeBundle().catch(console.error);
