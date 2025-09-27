#!/usr/bin/env node

/**
 * Final verification that the fix works correctly
 * This script simulates what Claude Desktop does when it requests the tools list
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function verifyFix() {
  console.log('🔧 YouTube MCP Extended - Schema Serialization Fix Verification\n');
  console.log('─'.repeat(80));

  // Start server with mock credentials
  const serverPath = path.join(__dirname, 'dist', 'index.js');

  const server = spawn('node', [serverPath], {
    env: {
      ...process.env,
      YOUTUBE_CLIENT_ID: 'mock-client-id-for-testing',
      YOUTUBE_CLIENT_SECRET: 'mock-client-secret-for-testing'
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let responseReceived = false;
  let outputBuffer = '';

  // Capture stdout (MCP communication)
  server.stdout.on('data', (data) => {
    const text = data.toString();
    outputBuffer += text;

    // Look for JSON-RPC response
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('{') && line.includes('"jsonrpc"')) {
        try {
          const response = JSON.parse(line);
          if (response.id === 1 && response.result?.tools) {
            responseReceived = true;
            analyzeResponse(response);
          }
        } catch (e) {
          // Not a complete JSON line, continue
        }
      }
    }
  });

  // Capture stderr (logs)
  server.stderr.on('data', (data) => {
    // Ignore logs for this test
  });

  // Send MCP request
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };

  console.log('📤 Sending MCP Request: tools/list\n');

  // MCP uses line-delimited JSON
  server.stdin.write(JSON.stringify(request) + '\n');

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 3000));

  if (!responseReceived) {
    console.log('❌ ERROR: No valid response received from server\n');
    console.log('Server output:', outputBuffer);
  }

  server.kill();
  process.exit(responseReceived ? 0 : 1);
}

function analyzeResponse(response) {
  console.log('📥 MCP Response Received\n');
  console.log('─'.repeat(80));

  const tools = response.result.tools;
  console.log(`\n✅ Found ${tools.length} tools\n`);

  // Analyze first tool in detail
  const firstTool = tools[0];
  console.log('🔍 Detailed Analysis of First Tool:\n');
  console.log(`Name: ${firstTool.name}`);
  console.log(`Description: ${firstTool.description}`);

  if (firstTool.inputSchema) {
    console.log('\nInput Schema Structure:');

    // Check for correct JSON Schema format
    const schema = firstTool.inputSchema;
    const hasJsonSchemaFormat = !!(schema.$schema || schema.type);
    const hasZodInternals = !!schema._def;

    if (hasJsonSchemaFormat && !hasZodInternals) {
      console.log('  ✅ Valid JSON Schema format detected');
      console.log('  ✅ No Zod internal structures (_def) found');
      console.log('\n  Schema preview:');
      console.log('  ' + JSON.stringify(schema, null, 2).split('\n').slice(0, 10).join('\n  '));
    } else if (hasZodInternals) {
      console.log('  ❌ ERROR: Zod internal structures detected!');
      console.log('  This means the schema was not properly converted.');
    } else {
      console.log('  ⚠️  WARNING: Unexpected schema format');
    }
  }

  // Summary of all tools
  console.log('\n\n📋 All Tools Validation Summary:\n');
  console.log('─'.repeat(80));

  let allValid = true;
  tools.forEach((tool, index) => {
    const isValid = tool.inputSchema &&
                    (tool.inputSchema.$schema || tool.inputSchema.type) &&
                    !tool.inputSchema._def;

    const status = isValid ? '✅' : '❌';
    console.log(`${status} ${(index + 1).toString().padStart(2)}. ${tool.name.padEnd(30)} - ${isValid ? 'Valid JSON Schema' : 'INVALID SCHEMA!'}`);

    if (!isValid) allValid = false;
  });

  console.log('\n' + '─'.repeat(80));
  if (allValid) {
    console.log('\n🎉 SUCCESS: All tools have valid JSON Schema format!');
    console.log('The fix has been successfully applied.');
    console.log('The MCP server should now work correctly with Claude Desktop.');
  } else {
    console.log('\n❌ FAILURE: Some tools still have invalid schema format.');
    console.log('The fix may not have been applied correctly.');
  }
  console.log('\n' + '═'.repeat(80));
}