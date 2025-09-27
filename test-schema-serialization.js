#!/usr/bin/env node

/**
 * Test script to verify that the MCP server now correctly serializes Zod schemas
 * as JSON Schema instead of raw Zod objects.
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testServer() {
  console.log('🔍 Testing YouTube MCP Server Schema Serialization...\n');

  // Start the server
  const serverPath = path.join(__dirname, 'dist', 'index.js');
  console.log(`Starting server from: ${serverPath}\n`);

  const server = spawn('node', [serverPath], {
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let outputBuffer = '';
  let errorBuffer = '';

  server.stdout.on('data', (data) => {
    outputBuffer += data.toString();
  });

  server.stderr.on('data', (data) => {
    errorBuffer += data.toString();
  });

  // Send a tools/list request
  const request = {
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 1
  };

  console.log('📤 Sending tools/list request...\n');
  server.stdin.write(JSON.stringify(request) + '\n');

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Kill the server
  server.kill();

  console.log('📥 Server Response:');
  console.log('─'.repeat(80));

  try {
    // Try to find the JSON response in the output
    const lines = outputBuffer.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('{') && line.includes('jsonrpc')) {
        const response = JSON.parse(line);

        if (response.result && response.result.tools) {
          console.log('✅ SUCCESS: Tools list received!\n');

          // Check the first tool's schema
          const firstTool = response.result.tools[0];
          console.log(`Tool: ${firstTool.name}`);
          console.log(`Description: ${firstTool.description}`);
          console.log('\nInputSchema structure:');

          if (firstTool.inputSchema) {
            // Check if it's a proper JSON Schema (should have $schema or type at minimum)
            if (firstTool.inputSchema.$schema || firstTool.inputSchema.type) {
              console.log('✅ VALID JSON SCHEMA DETECTED!');
              console.log(JSON.stringify(firstTool.inputSchema, null, 2).slice(0, 500) + '...\n');
            } else if (firstTool.inputSchema._def) {
              console.log('❌ ERROR: Still using raw Zod object!');
              console.log('The schema still contains _def property, indicating Zod object.\n');
            } else {
              console.log('⚠️  WARNING: Unknown schema format');
              console.log(JSON.stringify(firstTool.inputSchema, null, 2).slice(0, 500) + '...\n');
            }
          } else {
            console.log('❌ ERROR: No inputSchema found!\n');
          }

          // Show summary of all tools
          console.log('\n📋 All Tools Summary:');
          console.log('─'.repeat(80));
          response.result.tools.forEach((tool, index) => {
            const hasValidSchema = tool.inputSchema &&
                                   (tool.inputSchema.$schema || tool.inputSchema.type) &&
                                   !tool.inputSchema._def;
            const status = hasValidSchema ? '✅' : '❌';
            console.log(`${status} ${index + 1}. ${tool.name}`);
          });

          return;
        }
      }
    }

    console.log('❌ No valid tools/list response found in output');
    console.log('\nFull output:');
    console.log(outputBuffer);

  } catch (error) {
    console.log('❌ Error parsing response:', error.message);
    console.log('\nRaw output:');
    console.log(outputBuffer);
  }

  if (errorBuffer) {
    console.log('\n⚠️  Server errors/logs:');
    console.log(errorBuffer);
  }
}

testServer().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});