/**
 * WASM module exports
 * Provides URLs to compiled WASM artifacts
 */

// Base URL for WASM files
const baseUrl = typeof import.meta.url !== 'undefined' 
  ? new URL('.', import.meta.url).href 
  : '/';

export const wasmModuleUrl = `${baseUrl}wasm/jsbsim_wasm.mjs`;
export const wasmBinaryUrl = `${baseUrl}wasm/jsbsim_wasm.wasm`;
