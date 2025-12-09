#!/usr/bin/env node
import o from"fs";import r from"path";import{fileURLToPath as a}from"url";import{CONFIG_EXAMPLE_PATH as e,CONFIG_PATH as n}from"./utils/constants.js";const t=a(import.meta.url),d=r.dirname(t),s=process.argv[2]??"serve",i=()=>{console.log(`@gratio/wg CLI

Commands:
  serve             Start the WireGuard Control server
  init-config       Create config.json from config.example.json
  help              Show this message
`)},c=()=>{if(o.existsSync(n)){console.log("config.json already exists");return}o.existsSync(e)||(console.error("config.example.json not found. Cannot initialize config."),process.exit(1)),o.copyFileSync(e,n),console.log("config.json created from config.example.json")},m=async()=>{await import("./server.js")};(async()=>{switch(s){case"serve":await m();break;case"init-config":c();break;case"help":case"--help":case"-h":i();break;default:console.warn(`Unknown command: ${s}`),i(),process.exit(1)}})();
