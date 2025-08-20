#!/usr/bin/env node

/**
 * Basic syntax validation for Compact files
 * This script checks for common syntax issues in .compact files
 */

import * as fs from 'fs';
import * as path from 'path';

interface SyntaxIssue {
  file: string;
  line: number;
  issue: string;
  content: string;
}

function validateCompactFile(filePath: string): SyntaxIssue[] {
  const issues: SyntaxIssue[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();

    // Check for common syntax issues
    
    // 1. Struct definitions should end with semicolons
    if (trimmed.includes('struct') && trimmed.includes('{')) {
      // Find the closing brace and check if fields have semicolons
      let braceCount = 0;
      let inStruct = false;
      
      for (let i = index; i < lines.length; i++) {
        const structLine = lines[i];
        if (structLine.includes('{')) {
          braceCount += (structLine.match(/\{/g) || []).length;
          inStruct = true;
        }
        if (structLine.includes('}')) {
          braceCount -= (structLine.match(/\}/g) || []).length;
          if (braceCount === 0) break;
        }
        
        if (inStruct && braceCount > 0) {
          const fieldLine = structLine.trim();
          // Check if it's a field definition (has colon)
          if (fieldLine.includes(':') && !fieldLine.includes('//') && 
              !fieldLine.endsWith(';') && !fieldLine.endsWith('{') && !fieldLine.endsWith('}')) {
            issues.push({
              file: filePath,
              line: i + 1,
              issue: 'Struct field should end with semicolon',
              content: fieldLine
            });
          }
        }
      }
    }

    // 2. Enum values should end with semicolons
    if (trimmed.includes('=') && trimmed.includes('n') && !trimmed.endsWith(';') && 
        !trimmed.includes('//') && !trimmed.includes('const ')) {
      issues.push({
        file: filePath,
        line: lineNumber,
        issue: 'Enum value should end with semicolon',
        content: trimmed
      });
    }

    // 3. Check for common function syntax issues
    if (trimmed.includes('@zkFunction') || trimmed.includes('@viewFunction')) {
      // Next non-empty line should be a function declaration
      for (let j = index + 1; j < lines.length; j++) {
        const nextLine = lines[j].trim();
        if (nextLine === '') continue;
        
        if (!nextLine.includes('(') || !nextLine.includes(':')) {
          issues.push({
            file: filePath,
            line: j + 1,
            issue: 'Function declaration should have parameters and return type',
            content: nextLine
          });
        }
        break;
      }
    }

    // 4. Check for Map syntax
    if (trimmed.includes('Map<') && !trimmed.includes('new Map<')) {
      if (!trimmed.includes(':') || trimmed.includes('=')) {
        issues.push({
          file: filePath,
          line: lineNumber,
          issue: 'Map type should be used in type annotation, use "new Map<>()" for initialization',
          content: trimmed
        });
      }
    }

    // 5. Check for missing export keyword on main structures
    if ((trimmed.includes('struct ') || trimmed.includes('enum ') || trimmed.includes('const ')) &&
        !trimmed.startsWith('export ') && !trimmed.includes('//')) {
      issues.push({
        file: filePath,
        line: lineNumber,
        issue: 'Consider adding export keyword for reusability',
        content: trimmed
      });
    }
  });

  return issues;
}

function main() {
  const contractsDir = path.join(process.cwd(), 'src', 'contracts');
  const compactFiles = fs.readdirSync(contractsDir)
    .filter(file => file.endsWith('.compact'))
    .map(file => path.join(contractsDir, file));

  console.log('🔍 Validating Compact files syntax...\n');

  let totalIssues = 0;
  const allIssues: SyntaxIssue[] = [];

  for (const file of compactFiles) {
    console.log(`📄 Checking ${path.basename(file)}:`);
    const issues = validateCompactFile(file);
    
    if (issues.length === 0) {
      console.log('   ✅ No syntax issues found');
    } else {
      console.log(`   ⚠️  Found ${issues.length} potential issue(s):`);
      issues.forEach(issue => {
        console.log(`      Line ${issue.line}: ${issue.issue}`);
        console.log(`      Code: ${issue.content}`);
      });
      allIssues.push(...issues);
    }
    console.log('');
  }

  totalIssues = allIssues.length;

  console.log('\n📊 Summary:');
  console.log(`   Total files checked: ${compactFiles.length}`);
  console.log(`   Total issues found: ${totalIssues}`);

  if (totalIssues === 0) {
    console.log('   🎉 All Compact files appear to have correct basic syntax!');
  } else {
    console.log('   🔧 Some issues found. Review the suggestions above.');
    
    // Group issues by type
    const issuesByType = allIssues.reduce((acc, issue) => {
      acc[issue.issue] = (acc[issue.issue] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\n📈 Issue breakdown:');
    Object.entries(issuesByType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
  }

  process.exit(totalIssues > 0 ? 1 : 0);
}

// Run the main function
main();